'use client';
import { isLocalOrgId } from '@/lib/gstpilot-data/local-workspace';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Billing, Subscriptions & Payments™ — useBilling() Hook
//
// The SINGLE hook every GSTPilot component uses to interact with billing data.
// Mirrors the useBanking() / useERP() pattern:
//
//   • READ — real-time subscriptions to subscription + billing account + invoices
//     + payments + payment attempts + receipts + usage records (org-scoped via
//     onSnapshot)
//   • SUBSCRIBE — create a subscription (plan + cycle) → provider creates customer
//   • UPGRADE / DOWNGRADE — change plan mid-cycle (proration)
//   • CANCEL / PAUSE / RESUME — lifecycle control
//   • PAY — initiate payment for an invoice → redirect to provider → complete
//   • REFUND — issue a full/partial refund
//   • COUPON — apply a coupon code to the subscription
//   • USAGE — record a usage event (oracle requests, AI tokens, etc.)
//   • RETRY — re-subscribe on error
//
// All tenant scoping is automatic — components never touch `organizationId`.
// If the user has no organization yet, every operation no-ops safely.
//
// Architecture:
//   1. Mutations call the API route (/api/billing/*) for provider work. The
//      orchestrator (server-side) persists results to Firestore.
//   2. Real-time onSnapshot subscriptions surface the change to every connected
//      client instantly.
//
// Security: the encrypted customer id + provider tokens are stored in Firestore
// (billing_accounts collection) but can ONLY be decrypted by the server
// (AES-256-GCM with a server-only master key). The client never sees decrypted
// values.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  subscribeToSubscription,
  subscribeToBillingAccount,
  subscribeToInvoices,
  subscribeToPayments,
  subscribeToPaymentAttempts,
  subscribeToReceipts,
  subscribeToUsageRecords,
  computeBillingSummary,
  getSubscriptionPlans,
  type Subscription,
  type BillingAccount,
  type BillingInvoice,
  type Payment,
  type PaymentAttempt,
  type Receipt,
  type UsageRecord,
  type BillingSummary,
  type SubscriptionPlan,
  type SubscriptionPlanId,
  type BillingCycle,
  type PaymentMethod,
  type UsageMetricType,
} from '@/lib/billing-provider';

// ─── Hook return type ────────────────────────────────────────────────────────

export interface UseBillingResult {
  /** The org's active subscription (null if none). */
  subscription: Subscription | null;
  /** The org's billing account (null if none). */
  billingAccount: BillingAccount | null;
  /** All billing invoices (newest first). */
  invoices: BillingInvoice[];
  /** All payments (newest first). */
  payments: Payment[];
  /** All payment attempts (newest first). */
  paymentAttempts: PaymentAttempt[];
  /** All receipts (newest first). */
  receipts: Receipt[];
  /** All usage records for the current period. */
  usageRecords: UsageRecord[];
  /** The 5 canonical subscription plans. */
  plans: SubscriptionPlan[];
  /** Memoized billing summary — recomputed when any data changes. */
  summary: BillingSummary;

  /** Convenience: does the org have an active subscription? */
  hasSubscription: boolean;
  /** Convenience: is the subscription in a trial? */
  isTrialing: boolean;
  /** Convenience: is the subscription past due (in grace period)? */
  isPastDue: boolean;

  loading: boolean;
  error: string | null;
  /** True while any mutation is in-flight. */
  saving: boolean;

  // ─── Mutations ────────────────────────────────────────────────────────────

  /** Create a new subscription (plan + cycle). */
  subscribe: (input: {
    planId: SubscriptionPlanId;
    billingCycle: BillingCycle;
    couponCode?: string;
    customerEmail: string;
    customerName: string;
    customerPhone?: string;
  }) => Promise<boolean>;
  /** Upgrade to a higher plan (prorated charge). */
  upgrade: (input: {
    newPlanId: SubscriptionPlanId;
    newBillingCycle?: BillingCycle;
    applyImmediately?: boolean;
  }) => Promise<boolean>;
  /** Downgrade to a lower plan (prorated refund, default at period end). */
  downgrade: (input: {
    newPlanId: SubscriptionPlanId;
    applyImmediately?: boolean;
  }) => Promise<boolean>;
  /** Cancel the subscription. */
  cancel: (input: { immediately?: boolean; reason?: string }) => Promise<boolean>;
  /** Pause the subscription. */
  pause: (input: { reason?: string }) => Promise<boolean>;
  /** Resume a paused subscription. */
  resume: () => Promise<boolean>;
  /** Initiate a payment for an invoice (returns payment URL if hosted). */
  initiatePayment: (input: {
    invoiceId: string;
    amount: number;
    description: string;
    method?: PaymentMethod;
    returnUrl: string;
  }) => Promise<{ orderId: string; paymentUrl: string | null; attemptId: string } | null>;
  /** Complete a payment after the customer returns from checkout. */
  completePayment: (input: {
    orderId: string;
    paymentId: string;
    signature?: string;
  }) => Promise<boolean>;
  /** Refund a payment (full or partial). */
  refund: (input: {
    paymentId: string;
    amount: number;
    reason?: string;
  }) => Promise<boolean>;
  /** Apply a coupon code to the subscription. */
  applyCoupon: (couponCode: string) => Promise<boolean>;
  /** Record a usage event. */
  recordUsage: (
    metric: UsageMetricType,
    quantity: number,
    metadata?: Record<string, unknown>,
  ) => Promise<boolean>;
  /** Retry the last failed subscription. */
  retry: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useBilling(): UseBillingResult {
  const { organization, isPreviewMode } = useOrg();
  const { user } = useAuth();
  const orgId = organization?.id ?? null;

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [billingAccount, setBillingAccount] = useState<BillingAccount | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentAttempts, setPaymentAttempts] = useState<PaymentAttempt[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  // Subscription refs (for cleanup)
  const unsubs = useRef<Array<(() => void) | null>>([
    null, null, null, null, null, null, null,
  ]);

  // Static: the 5 plans (in-memory constant, no Firestore needed).
  const plans = useMemo(() => getSubscriptionPlans(), []);

  // ─── Real-time subscriptions ──────────────────────────────────────────────

  useEffect(() => {
    unsubs.current.forEach((u) => u?.());
    unsubs.current = unsubs.current.map(() => null);

    if (!orgId || isPreviewMode || isLocalOrgId(orgId)) {
      setSubscription(null);
      setBillingAccount(null);
      setInvoices([]);
      setPayments([]);
      setPaymentAttempts([]);
      setReceipts([]);
      setUsageRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const onSubError = (err: Error) => {
      console.warn('[useBilling] subscription error:', err.message);
      setError(err.message);
      setLoading(false);
    };

    unsubs.current[0] = subscribeToSubscription(orgId, (s) => {
      setSubscription(s);
      setLoading(false);
      setError(null);
    }, { onError: onSubError });
    unsubs.current[1] = subscribeToBillingAccount(orgId, (a) => {
      setBillingAccount(a);
    }, { onError: onSubError });
    unsubs.current[2] = subscribeToInvoices(orgId, (i) => {
      setInvoices(i);
    }, { onError: onSubError, limitCount: 100 });
    unsubs.current[3] = subscribeToPayments(orgId, (p) => {
      setPayments(p);
    }, { onError: onSubError, limitCount: 100 });
    unsubs.current[4] = subscribeToPaymentAttempts(orgId, (a) => {
      setPaymentAttempts(a);
    }, { onError: onSubError, limitCount: 50 });
    unsubs.current[5] = subscribeToReceipts(orgId, (r) => {
      setReceipts(r);
    }, { onError: onSubError, limitCount: 50 });
    unsubs.current[6] = subscribeToUsageRecords(orgId, (u) => {
      setUsageRecords(u);
    }, { onError: onSubError, limitCount: 500 });

    return () => {
      unsubs.current.forEach((u) => u?.());
    };
  }, [orgId, isPreviewMode, retryTick]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  // Memoized so callbacks that depend on `actor` (subscribe / refund /
  // applyCoupon) don't lose their `useCallback` identity on every render.
  const actor = useMemo(
    () => ({
      uid: user?.id ?? '',
      name: user?.name ?? 'Unknown',
      email: user?.email ?? '',
    }),
    [user?.id, user?.name, user?.email],
  );

  // ─── Mutation: subscribe ───────────────────────────────────────────────────

  const subscribe = useCallback(
    async (input: {
      planId: SubscriptionPlanId;
      billingCycle: BillingCycle;
      couponCode?: string;
      customerEmail: string;
      customerName: string;
      customerPhone?: string;
    }): Promise<boolean> => {
      if (!orgId) return false;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch('/api/billing/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            planId: input.planId,
            billingCycle: input.billingCycle,
            couponCode: input.couponCode,
            customerEmail: input.customerEmail,
            customerName: input.customerName,
            customerPhone: input.customerPhone,
            createdBy: actor,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Failed to create subscription.');
        }
        // The orchestrator persists the subscription + billing account + invoice;
        // real-time subscriptions will surface them automatically.
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId, actor],
  );

  // ─── Mutation: upgrade ──────────────────────────────────────────────────────

  const upgrade = useCallback(
    async (input: {
      newPlanId: SubscriptionPlanId;
      newBillingCycle?: BillingCycle;
      applyImmediately?: boolean;
    }): Promise<boolean> => {
      if (!orgId || !subscription) return false;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch('/api/billing/upgrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            subscriptionId: subscription.id,
            newPlanId: input.newPlanId,
            newBillingCycle: input.newBillingCycle,
            applyImmediately: input.applyImmediately ?? true,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Failed to upgrade plan.');
        }
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId, subscription],
  );

  // ─── Mutation: downgrade ────────────────────────────────────────────────────

  const downgrade = useCallback(
    async (input: {
      newPlanId: SubscriptionPlanId;
      applyImmediately?: boolean;
    }): Promise<boolean> => {
      if (!orgId || !subscription) return false;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch('/api/billing/downgrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            subscriptionId: subscription.id,
            newPlanId: input.newPlanId,
            applyImmediately: input.applyImmediately ?? false,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Failed to downgrade plan.');
        }
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId, subscription],
  );

  // ─── Mutation: cancel ───────────────────────────────────────────────────────

  const cancel = useCallback(
    async (input: { immediately?: boolean; reason?: string }): Promise<boolean> => {
      if (!orgId || !subscription) return false;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch('/api/billing/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            subscriptionId: subscription.id,
            immediately: input.immediately ?? false,
            reason: input.reason,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Failed to cancel subscription.');
        }
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId, subscription],
  );

  // ─── Mutation: pause ────────────────────────────────────────────────────────

  const pause = useCallback(
    async (input: { reason?: string }): Promise<boolean> => {
      if (!orgId || !subscription) return false;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch('/api/billing/pause', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            subscriptionId: subscription.id,
            reason: input.reason,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Failed to pause subscription.');
        }
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId, subscription],
  );

  // ─── Mutation: resume ───────────────────────────────────────────────────────

  const resume = useCallback(async (): Promise<boolean> => {
    if (!orgId || !subscription) return false;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          subscriptionId: subscription.id,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to resume subscription.');
      }
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      return false;
    } finally {
      setSaving(false);
    }
  }, [orgId, subscription]);

  // ─── Mutation: initiatePayment ──────────────────────────────────────────────

  const initiatePayment = useCallback(
    async (input: {
      invoiceId: string;
      amount: number;
      description: string;
      method?: PaymentMethod;
      returnUrl: string;
    }): Promise<{ orderId: string; paymentUrl: string | null; attemptId: string } | null> => {
      if (!orgId || !subscription) return null;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch('/api/billing/payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            subscriptionId: subscription.id,
            invoiceId: input.invoiceId,
            amount: input.amount,
            description: input.description,
            method: input.method,
            returnUrl: input.returnUrl,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Failed to initiate payment.');
        }
        return data.result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [orgId, subscription],
  );

  // ─── Mutation: completePayment ──────────────────────────────────────────────

  const completePayment = useCallback(
    async (input: {
      orderId: string;
      paymentId: string;
      signature?: string;
    }): Promise<boolean> => {
      if (!orgId) return false;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch('/api/billing/payment/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            orderId: input.orderId,
            paymentId: input.paymentId,
            signature: input.signature,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Payment completion failed.');
        }
        return data.result?.succeeded ?? false;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId],
  );

  // ─── Mutation: refund ───────────────────────────────────────────────────────

  const refund = useCallback(
    async (input: {
      paymentId: string;
      amount: number;
      reason?: string;
    }): Promise<boolean> => {
      if (!orgId) return false;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch('/api/billing/refund', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            paymentId: input.paymentId,
            amount: input.amount,
            reason: input.reason,
            refundedBy: actor,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Refund failed.');
        }
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId, actor],
  );

  // ─── Mutation: applyCoupon ──────────────────────────────────────────────────

  const applyCoupon = useCallback(
    async (couponCode: string): Promise<boolean> => {
      if (!orgId || !subscription) return false;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch('/api/billing/coupon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            subscriptionId: subscription.id,
            couponCode,
            appliedBy: actor,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Failed to apply coupon.');
        }
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId, subscription, actor],
  );

  // ─── Mutation: recordUsage ──────────────────────────────────────────────────

  const recordUsage = useCallback(
    async (
      metric: UsageMetricType,
      quantity: number,
      metadata?: Record<string, unknown>,
    ): Promise<boolean> => {
      if (!orgId) return false;
      try {
        const res = await fetch('/api/billing/usage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            metric,
            quantity,
            metadata,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          console.warn('[useBilling] recordUsage failed:', data.error);
          return false;
        }
        return true;
      } catch (err) {
        console.warn('[useBilling] recordUsage error:', err);
        return false;
      }
    },
    [orgId],
  );

  // ─── Mutation: retry ────────────────────────────────────────────────────────

  const retry = useCallback(() => {
    setRetryTick((t) => t + 1);
  }, []);

  // ─── Derived state ─────────────────────────────────────────────────────────

  const hasSubscription = !!subscription;
  const isTrialing = subscription?.status === 'trialing';
  const isPastDue = subscription?.status === 'past_due';

  const summary = useMemo(
    () => computeBillingSummary(subscription, invoices, payments, usageRecords),
    [subscription, invoices, payments, usageRecords],
  );

  return {
    subscription,
    billingAccount,
    invoices,
    payments,
    paymentAttempts,
    receipts,
    usageRecords,
    plans,
    summary,
    hasSubscription,
    isTrialing,
    isPastDue,
    loading,
    error,
    saving,
    subscribe,
    upgrade,
    downgrade,
    cancel,
    pause,
    resume,
    initiatePayment,
    completePayment,
    refund,
    applyCoupon,
    recordUsage,
    retry,
  };
}

// ─── Convenience re-exports ───────────────────────────────────────────────────

export type {
  Subscription,
  BillingAccount,
  BillingInvoice,
  Payment,
  PaymentAttempt,
  Receipt,
  UsageRecord,
  BillingSummary,
  SubscriptionPlan,
  SubscriptionPlanId,
  BillingCycle,
  PaymentMethod,
  UsageMetricType,
} from '@/lib/billing-provider';
