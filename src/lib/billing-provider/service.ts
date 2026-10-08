// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Billing, Subscriptions & Payments™ — Client-Safe Firestore Service
//
// The single entry point for all billing Firestore operations on the CLIENT side.
// Mirrors the banking-provider / erp-provider service pattern:
//   • Real-time subscriptions via onSnapshot (org-scoped)
//   • CRUD writes via the Firebase client SDK (rules enforce org isolation)
//   • Multi-tenant — every function filters on `organizationId`
//
// This module is CLIENT-SAFE — it only imports from `firebase/firestore` and
// `@/lib/firebase` (the client SDK). It NEVER imports the provider, crypto, or
// any server-only code.
//
// The flow for each billing operation:
//   1. Client hook calls the appropriate API route (/api/billing/*) for the
//      provider work (subscribe, upgrade, pay, refund, etc.). The API route
//      returns plain data + the encrypted customer id / provider tokens.
//   2. The orchestrator (server-side) writes the result to Firestore directly.
//   3. Real-time onSnapshot subscriptions surface the change to every
//      connected client instantly.
//
// Firestore timeout guard: when the Firebase project has the Firestore API
// disabled, the SDK retries PERMISSION_DENIED for ~120s before rejecting.
// `withTimeout` races every op against a 6s deadline so the UI never hangs.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as limitFn,
  serverTimestamp,
  onSnapshot,
  type Unsubscribe,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  BillingAccount,
  BillingInvoice,
  BillingSummary,
  Coupon,
  Payment,
  PaymentAttempt,
  PaymentProviderName,
  Receipt,
  Subscription,
  SubscriptionPlan,
  SubscriptionPlanId,
  UsageMetricType,
  UsageRecord,
} from './types';
import { BillingError } from './errors';
import { SUBSCRIPTION_PLANS, getPlan } from './server/plans';

// ─── Collection names ────────────────────────────────────────────────────────

/**
 * The 9 Firestore collections used by the billing provider.
 * `subscription_plans` is GLOBAL (read by everyone, written by admin seed).
 * The other 8 are ORG-SCOPED — every doc carries `organizationId`.
 */
export const BILLING_COLLECTIONS = {
  PLANS: 'subscription_plans', // global
  SUBSCRIPTIONS: 'subscriptions',
  BILLING_ACCOUNTS: 'billing_accounts',
  INVOICES: 'billing_invoices',
  PAYMENTS: 'payments',
  PAYMENT_ATTEMPTS: 'payment_attempts',
  RECEIPTS: 'receipts',
  COUPONS: 'coupons',
  USAGE_RECORDS: 'usage_records',
} as const;

// ─── Org guard ───────────────────────────────────────────────────────────────

function assertOrg(orgId: string | undefined | null): void {
  if (!orgId) {
    throw new BillingError(
      'You must belong to an organization to manage billing data.',
      { code: 'NO_ORGANIZATION', statusCode: 403 },
    );
  }
}

// ─── Firestore timeout guard ─────────────────────────────────────────────────

const FIRESTORE_TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  promise.catch(() => {
    /* timed-out op — ignore late rejection */
  });
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new BillingError(
              `${label} timed out — Firestore may be unreachable.`,
              { code: 'FIRESTORE_TIMEOUT', statusCode: 503, retryable: true },
            ),
          ),
        FIRESTORE_TIMEOUT_MS,
      ),
    ),
  ]);
}

// ─── Subscription Plans (GLOBAL) ──────────────────────────────────────────────

/**
 * Get the canonical 5 plans. The source of truth is the `SUBSCRIPTION_PLANS`
 * constant in `server/plans.ts` (re-exported here so the client can read it
 * without a Firestore round-trip). If a Firestore-seeded override exists it
 * would be merged in here in the future.
 */
export function getSubscriptionPlans(): SubscriptionPlan[] {
  return [...SUBSCRIPTION_PLANS].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Get a single plan by id (synchronous — from the in-memory constant). */
export function getSubscriptionPlan(planId: SubscriptionPlanId): SubscriptionPlan | undefined {
  return getPlan(planId);
}

// ─── Subscriptions ──────────────────────────────────────────────────────────

export function toSubscription(id: string, raw: Record<string, unknown>): Subscription {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    planId: (raw.planId as SubscriptionPlanId) ?? 'free',
    planName: String(raw.planName ?? 'Free'),
    billingCycle: (raw.billingCycle as 'monthly' | 'yearly') ?? 'monthly',
    status: (raw.status as Subscription['status']) ?? 'active',
    startDate: String(raw.startDate ?? new Date().toISOString()),
    endDate: (raw.endDate as string | null) ?? null,
    trialEndDate: (raw.trialEndDate as string | null) ?? null,
    cancelledAt: (raw.cancelledAt as string | null) ?? null,
    pausedAt: (raw.pausedAt as string | null) ?? null,
    currentPeriodStart: String(raw.currentPeriodStart ?? new Date().toISOString()),
    currentPeriodEnd: String(raw.currentPeriodEnd ?? new Date().toISOString()),
    gracePeriodEnd: (raw.gracePeriodEnd as string | null) ?? null,
    customerId: String(raw.customerId ?? ''),
    paymentProvider: (raw.paymentProvider as PaymentProviderName) ?? 'mock-razorpay',
    defaultPaymentMethod: (raw.defaultPaymentMethod as Subscription['defaultPaymentMethod']) ?? null,
    couponCode: (raw.couponCode as string | null) ?? null,
    couponDiscountPercent: Number(raw.couponDiscountPercent ?? 0),
    mrr: Number(raw.mrr ?? 0),
    arr: Number(raw.arr ?? 0),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
  };
}

/** Subscribe to the org's active subscription (one per org). */
export function subscribeToSubscription(
  organizationId: string,
  onData: (sub: Subscription | null) => void,
  opts?: { onError?: (err: Error) => void },
): Unsubscribe {
  assertOrg(organizationId);
  const q = query(
    collection(db, BILLING_COLLECTIONS.SUBSCRIPTIONS),
    where('organizationId', '==', organizationId),
    limitFn(1),
  );
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        onData(null);
        return;
      }
      const d = snap.docs[0];
      onData(toSubscription(d.id, d.data() as Record<string, unknown>));
    },
    (err) => opts?.onError?.(err as Error),
  );
}

export async function getSubscription(organizationId: string): Promise<Subscription | null> {
  assertOrg(organizationId);
  const q = query(
    collection(db, BILLING_COLLECTIONS.SUBSCRIPTIONS),
    where('organizationId', '==', organizationId),
    limitFn(1),
  );
  const snap = await withTimeout(getDocs(q), 'billing.getSubscription');
  if (snap.empty) return null;
  const d = snap.docs[0];
  return toSubscription(d.id, d.data() as Record<string, unknown>);
}

// ─── Billing Accounts ───────────────────────────────────────────────────────

export function toBillingAccount(id: string, raw: Record<string, unknown>): BillingAccount {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    subscriptionId: (raw.subscriptionId as string | null) ?? null,
    email: String(raw.email ?? ''),
    phone: (raw.phone as string | null) ?? null,
    gstin: (raw.gstin as string | null) ?? null,
    billingAddress: (raw.billingAddress as BillingAccount['billingAddress']) ?? {
      name: '',
      line1: '',
      line2: null,
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
    },
    taxId: (raw.taxId as string | null) ?? null,
    encryptedCustomerId: (raw.encryptedCustomerId as string | null) ?? null,
    encryptedProviderTokens: (raw.encryptedProviderTokens as string | null) ?? null,
    paymentProvider: (raw.paymentProvider as PaymentProviderName | null) ?? null,
    defaultPaymentMethod: (raw.defaultPaymentMethod as BillingAccount['defaultPaymentMethod']) ?? null,
    autoRenew: Boolean(raw.autoRenew ?? true),
    taxExempt: Boolean(raw.taxExempt ?? false),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
  };
}

export function subscribeToBillingAccount(
  organizationId: string,
  onData: (account: BillingAccount | null) => void,
  opts?: { onError?: (err: Error) => void },
): Unsubscribe {
  assertOrg(organizationId);
  const q = query(
    collection(db, BILLING_COLLECTIONS.BILLING_ACCOUNTS),
    where('organizationId', '==', organizationId),
    limitFn(1),
  );
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        onData(null);
        return;
      }
      const d = snap.docs[0];
      onData(toBillingAccount(d.id, d.data() as Record<string, unknown>));
    },
    (err) => opts?.onError?.(err as Error),
  );
}

// ─── Invoices ───────────────────────────────────────────────────────────────

export function toInvoice(id: string, raw: Record<string, unknown>): BillingInvoice {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    subscriptionId: String(raw.subscriptionId ?? ''),
    invoiceNumber: String(raw.invoiceNumber ?? ''),
    type: (raw.type as BillingInvoice['type']) ?? 'tax_invoice',
    status: (raw.status as BillingInvoice['status']) ?? 'draft',
    issueDate: String(raw.issueDate ?? new Date().toISOString()),
    dueDate: String(raw.dueDate ?? new Date().toISOString()),
    paidDate: (raw.paidDate as string | null) ?? null,
    periodStart: String(raw.periodStart ?? new Date().toISOString()),
    periodEnd: String(raw.periodEnd ?? new Date().toISOString()),
    lineItems: (raw.lineItems as BillingInvoice['lineItems']) ?? [],
    subtotal: Number(raw.subtotal ?? 0),
    discount: Number(raw.discount ?? 0),
    tax: Number(raw.tax ?? 0),
    taxBreakdown: (raw.taxBreakdown as BillingInvoice['taxBreakdown']) ?? {
      cgst: 0,
      sgst: 0,
      igst: 0,
      cess: 0,
    },
    total: Number(raw.total ?? 0),
    amountPaid: Number(raw.amountPaid ?? 0),
    amountDue: Number(raw.amountDue ?? 0),
    currency: 'INR',
    notes: (raw.notes as string | null) ?? null,
    couponCode: (raw.couponCode as string | null) ?? null,
    linkedInvoiceId: (raw.linkedInvoiceId as string | null) ?? null,
    pdfReady: Boolean(raw.pdfReady ?? false),
    pdfPath: (raw.pdfPath as string | null) ?? null,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
  };
}

export function subscribeToInvoices(
  organizationId: string,
  onData: (invoices: BillingInvoice[]) => void,
  opts?: { onError?: (err: Error) => void; limitCount?: number },
): Unsubscribe {
  assertOrg(organizationId);
  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
  ];
  if (opts?.limitCount) constraints.push(limitFn(opts.limitCount));
  const q = query(collection(db, BILLING_COLLECTIONS.INVOICES), ...constraints);
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => toInvoice(d.id, d.data() as Record<string, unknown>))),
    (err) => opts?.onError?.(err as Error),
  );
}

export async function getInvoices(organizationId: string): Promise<BillingInvoice[]> {
  assertOrg(organizationId);
  const q = query(
    collection(db, BILLING_COLLECTIONS.INVOICES),
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await withTimeout(getDocs(q), 'billing.getInvoices');
  return snap.docs.map((d) => toInvoice(d.id, d.data() as Record<string, unknown>));
}

// ─── Payments ───────────────────────────────────────────────────────────────

export function toPayment(id: string, raw: Record<string, unknown>): Payment {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    subscriptionId: String(raw.subscriptionId ?? ''),
    invoiceId: (raw.invoiceId as string | null) ?? null,
    amount: Number(raw.amount ?? 0),
    currency: 'INR',
    status: (raw.status as Payment['status']) ?? 'pending',
    provider: (raw.provider as PaymentProviderName) ?? 'mock-razorpay',
    providerPaymentId: (raw.providerPaymentId as string | null) ?? null,
    providerOrderId: (raw.providerOrderId as string | null) ?? null,
    method: (raw.method as Payment['method']) ?? 'card',
    description: (raw.description as string | null) ?? null,
    failureReason: (raw.failureReason as string | null) ?? null,
    refundAmount: Number(raw.refundAmount ?? 0),
    refundedAt: (raw.refundedAt as string | null) ?? null,
    paidAt: (raw.paidAt as string | null) ?? null,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
  };
}

export function subscribeToPayments(
  organizationId: string,
  onData: (payments: Payment[]) => void,
  opts?: { onError?: (err: Error) => void; limitCount?: number },
): Unsubscribe {
  assertOrg(organizationId);
  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
  ];
  if (opts?.limitCount) constraints.push(limitFn(opts.limitCount));
  const q = query(collection(db, BILLING_COLLECTIONS.PAYMENTS), ...constraints);
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => toPayment(d.id, d.data() as Record<string, unknown>))),
    (err) => opts?.onError?.(err as Error),
  );
}

// ─── Payment Attempts ───────────────────────────────────────────────────────

export function toPaymentAttempt(id: string, raw: Record<string, unknown>): PaymentAttempt {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    paymentId: (raw.paymentId as string | null) ?? null,
    subscriptionId: String(raw.subscriptionId ?? ''),
    invoiceId: String(raw.invoiceId ?? ''),
    amount: Number(raw.amount ?? 0),
    provider: (raw.provider as PaymentProviderName) ?? 'mock-razorpay',
    status: (raw.status as PaymentAttempt['status']) ?? 'initiated',
    errorCode: (raw.errorCode as string | null) ?? null,
    errorMessage: (raw.errorMessage as string | null) ?? null,
    providerRequestId: (raw.providerRequestId as string | null) ?? null,
    attemptNumber: Number(raw.attemptNumber ?? 1),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
  };
}

export function subscribeToPaymentAttempts(
  organizationId: string,
  onData: (attempts: PaymentAttempt[]) => void,
  opts?: { onError?: (err: Error) => void; limitCount?: number },
): Unsubscribe {
  assertOrg(organizationId);
  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
  ];
  if (opts?.limitCount) constraints.push(limitFn(opts.limitCount));
  const q = query(collection(db, BILLING_COLLECTIONS.PAYMENT_ATTEMPTS), ...constraints);
  return onSnapshot(
    q,
    (snap) =>
      onData(snap.docs.map((d) => toPaymentAttempt(d.id, d.data() as Record<string, unknown>))),
    (err) => opts?.onError?.(err as Error),
  );
}

// ─── Receipts ───────────────────────────────────────────────────────────────

export function toReceipt(id: string, raw: Record<string, unknown>): Receipt {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    paymentId: String(raw.paymentId ?? ''),
    invoiceId: (raw.invoiceId as string | null) ?? null,
    receiptNumber: String(raw.receiptNumber ?? ''),
    amount: Number(raw.amount ?? 0),
    currency: 'INR',
    method: (raw.method as Receipt['method']) ?? 'card',
    provider: (raw.provider as PaymentProviderName) ?? 'mock-razorpay',
    issuedTo: (raw.issuedTo as Receipt['issuedTo']) ?? { name: '', email: '', phone: null },
    notes: (raw.notes as string | null) ?? null,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
  };
}

export function subscribeToReceipts(
  organizationId: string,
  onData: (receipts: Receipt[]) => void,
  opts?: { onError?: (err: Error) => void; limitCount?: number },
): Unsubscribe {
  assertOrg(organizationId);
  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
  ];
  if (opts?.limitCount) constraints.push(limitFn(opts.limitCount));
  const q = query(collection(db, BILLING_COLLECTIONS.RECEIPTS), ...constraints);
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => toReceipt(d.id, d.data() as Record<string, unknown>))),
    (err) => opts?.onError?.(err as Error),
  );
}

// ─── Coupons ────────────────────────────────────────────────────────────────

export function toCoupon(id: string, raw: Record<string, unknown>): Coupon {
  return {
    id,
    organizationId: (raw.organizationId as string | null) ?? null,
    code: String(raw.code ?? ''),
    type: (raw.type as Coupon['type']) ?? 'percent',
    value: Number(raw.value ?? 0),
    currency: 'INR',
    maxRedemptions: Number(raw.maxRedemptions ?? 0),
    redemptionsCount: Number(raw.redemptionsCount ?? 0),
    validFrom: String(raw.validFrom ?? new Date().toISOString()),
    validUntil: (raw.validUntil as string | null) ?? null,
    applicablePlans: (raw.applicablePlans as Coupon['applicablePlans']) ?? 'all',
    isActive: Boolean(raw.isActive ?? true),
    createdBy: (raw.createdBy as Coupon['createdBy']) ?? { uid: '', name: '', email: '' },
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
  };
}

export function subscribeToCoupons(
  organizationId: string,
  onData: (coupons: Coupon[]) => void,
  opts?: { onError?: (err: Error) => void },
): Unsubscribe {
  assertOrg(organizationId);
  // Both global (organizationId == null) and org-private coupons.
  const q = query(
    collection(db, BILLING_COLLECTIONS.COUPONS),
    where('isActive', '==', true),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const all = snap.docs.map((d) => toCoupon(d.id, d.data() as Record<string, unknown>));
      // Filter: global coupons OR this org's coupons.
      onData(
        all.filter(
          (c) => c.organizationId === null || c.organizationId === organizationId,
        ),
      );
    },
    (err) => opts?.onError?.(err as Error),
  );
}

/**
 * Look up a single coupon by its code (case-insensitive). Returns null if no
 * coupon with that code exists. Matches both global and org-private coupons —
 * callers that need org scoping should filter the result themselves.
 */
export async function getCoupon(code: string): Promise<Coupon | null> {
  const normalized = code.toUpperCase().trim();
  if (!normalized) return null;
  const q = query(
    collection(db, BILLING_COLLECTIONS.COUPONS),
    where('code', '==', normalized),
    limitFn(1),
  );
  const snap = await withTimeout(getDocs(q), 'billing.getCoupon');
  if (snap.empty) return null;
  const d = snap.docs[0];
  return toCoupon(d.id, d.data() as Record<string, unknown>);
}

// ─── Usage Records ──────────────────────────────────────────────────────────

export function toUsageRecord(id: string, raw: Record<string, unknown>): UsageRecord {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    subscriptionId: String(raw.subscriptionId ?? ''),
    metric: (raw.metric as UsageMetricType) ?? 'oracle_requests',
    quantity: Number(raw.quantity ?? 0),
    periodStart: String(raw.periodStart ?? new Date().toISOString()),
    periodEnd: String(raw.periodEnd ?? new Date().toISOString()),
    metadata: (raw.metadata as Record<string, unknown>) ?? {},
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
  };
}

export function subscribeToUsageRecords(
  organizationId: string,
  onData: (records: UsageRecord[]) => void,
  opts?: { onError?: (err: Error) => void; limitCount?: number },
): Unsubscribe {
  assertOrg(organizationId);
  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
  ];
  if (opts?.limitCount) constraints.push(limitFn(opts.limitCount));
  const q = query(collection(db, BILLING_COLLECTIONS.USAGE_RECORDS), ...constraints);
  return onSnapshot(
    q,
    (snap) =>
      onData(snap.docs.map((d) => toUsageRecord(d.id, d.data() as Record<string, unknown>))),
    (err) => opts?.onError?.(err as Error),
  );
}

/**
 * Get the current period's usage records (org-scoped, current billing period).
 * Pure read — no subscription.
 */
export async function getUsageForPeriod(
  organizationId: string,
  periodStart: string,
  periodEnd: string,
): Promise<UsageRecord[]> {
  assertOrg(organizationId);
  const q = query(
    collection(db, BILLING_COLLECTIONS.USAGE_RECORDS),
    where('organizationId', '==', organizationId),
    where('periodStart', '>=', periodStart),
    where('periodEnd', '<=', periodEnd),
  );
  const snap = await withTimeout(getDocs(q), 'billing.getUsageForPeriod');
  return snap.docs.map((d) => toUsageRecord(d.id, d.data() as Record<string, unknown>));
}

/**
 * Write a usage record directly (used by usage metering on the client for
 * low-stakes events like oracle_requests). High-stakes events go through the
 * /api/billing/usage route which calls the server-side usage meter.
 */
export async function recordUsage(
  organizationId: string,
  subscriptionId: string,
  metric: UsageMetricType,
  quantity: number,
  metadata?: Record<string, unknown>,
): Promise<string> {
  assertOrg(organizationId);
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  const ref = await withTimeout(
    addDoc(collection(db, BILLING_COLLECTIONS.USAGE_RECORDS), {
      organizationId,
      subscriptionId,
      metric,
      quantity,
      periodStart,
      periodEnd,
      metadata: metadata ?? {},
      createdAt: serverTimestamp(),
    }),
    'billing.recordUsage',
  );
  return ref.id;
}

// ─── Billing Summary (pure function, dashboard-facing) ──────────────────────

/**
 * Aggregate the org's billing state into a single `BillingSummary` for the
 * dashboard. Pure function — takes the already-subscribed collections and
 * returns the computed summary. The `useBilling()` hook calls this on every
 * real-time update so the dashboard always reflects current data.
 */
export function computeBillingSummary(
  subscription: Subscription | null,
  invoices: BillingInvoice[],
  payments: Payment[],
  usageRecords: UsageRecord[],
): BillingSummary {
  const now = new Date();
  const plan = subscription ? getPlan(subscription.planId) : null;

  // MRR / ARR
  const mrr = subscription?.mrr ?? 0;
  const arr = subscription?.arr ?? 0;

  // Renewal date
  const nextRenewalDate = subscription?.currentPeriodEnd ?? null;
  const daysToRenewal = nextRenewalDate
    ? Math.max(
        0,
        Math.round(
          (new Date(nextRenewalDate).getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
        ),
      )
    : null;

  // Trial days
  const trialDaysLeft = subscription?.trialEndDate
    ? Math.max(
        0,
        Math.round(
          (new Date(subscription.trialEndDate).getTime() - now.getTime()) /
            (24 * 60 * 60 * 1000),
        ),
      )
    : null;

  // Outstanding amount — sum of unpaid invoices
  const outstandingAmount = invoices
    .filter((i) => i.status === 'sent' || i.status === 'overdue')
    .reduce((sum, i) => sum + i.amountDue, 0);

  // Failed payments in last 30 days
  const failedPayments = payments.filter(
    (p) =>
      p.status === 'failed' &&
      new Date(p.createdAt).getTime() > now.getTime() - 30 * 24 * 60 * 60 * 1000,
  ).length;

  // Usage this period — aggregate by metric
  const usageThisPeriod: Record<UsageMetricType, number> = {
    oracle_requests: 0,
    storage_bytes: 0,
    ai_tokens: 0,
    invoices_generated: 0,
    returns_filed: 0,
    api_calls: 0,
    automation_runs: 0,
  };
  const periodStart = subscription?.currentPeriodStart ?? null;
  const periodEnd = subscription?.currentPeriodEnd ?? null;
  for (const r of usageRecords) {
    if (periodStart && periodEnd) {
      // Only count records in the current billing period.
      if (r.periodStart < periodStart || r.periodEnd > periodEnd) continue;
    }
    if (r.metric in usageThisPeriod) {
      usageThisPeriod[r.metric] += r.quantity;
    }
  }

  // Plan limits
  const usageLimits: Record<UsageMetricType, number> | null = plan
    ? {
        oracle_requests: plan.limits.oracleRequestsMonthly,
        storage_bytes: plan.limits.storageBytes,
        ai_tokens: plan.limits.aiCreditsMonthly,
        invoices_generated: plan.limits.invoicesMonthly,
        returns_filed: plan.limits.returnsMonthly,
        api_calls: plan.limits.apiCallsMonthly,
        automation_runs: plan.limits.automationRunsMonthly,
      }
    : null;

  // Usage percentage (0..100; Infinity if limit is Infinity)
  const usagePercent: Record<UsageMetricType, number> = {
    oracle_requests: 0,
    storage_bytes: 0,
    ai_tokens: 0,
    invoices_generated: 0,
    returns_filed: 0,
    api_calls: 0,
    automation_runs: 0,
  };
  if (usageLimits) {
    (Object.keys(usageThisPeriod) as UsageMetricType[]).forEach((metric) => {
      const used = usageThisPeriod[metric];
      const limit = usageLimits[metric];
      usagePercent[metric] =
        limit === Infinity ? 0 : Math.min(100, Math.round((used / limit) * 100));
    });
  }

  // Recent invoices (newest 10)
  const recentInvoices = [...invoices]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  // Recent payments (newest 10)
  const recentPayments = [...payments]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  // Connected providers
  const connectedProviders: PaymentProviderName[] = subscription
    ? [subscription.paymentProvider]
    : [];

  return {
    currentPlan: subscription?.planId ?? null,
    planName: subscription?.planName ?? plan?.name ?? null,
    subscriptionStatus: subscription?.status ?? null,
    mrr,
    arr,
    nextRenewalDate,
    daysToRenewal,
    trialDaysLeft,
    outstandingAmount,
    failedPayments,
    usageThisPeriod,
    usageLimits,
    usagePercent,
    recentInvoices,
    recentPayments,
    connectedProviders,
  };
}

// ─── Cascade cancel (used on cancelSubscription) ────────────────────────────

/**
 * Mark all org billing data as cancelled/expired. Does NOT delete — billing
 * records must be retained for audit. Called by the client after a successful
 * /api/billing/cancel call to provide instant UI feedback.
 */
export async function markSubscriptionCancelled(
  organizationId: string,
  subscriptionId: string,
): Promise<void> {
  assertOrg(organizationId);
  await withTimeout(
    updateDoc(doc(db, BILLING_COLLECTIONS.SUBSCRIPTIONS, subscriptionId), {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    }),
    'billing.markSubscriptionCancelled',
  );
}
