'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — useGSTpilotPayments() Hook
//
// Real-time payments list (onSnapshot) + CRUD + search.
//
// ORG-SCOPED (MULTI-TENANT):
//   Reads the current organizationId from OrgContext and passes it to every
//   gstpilot-data service call. The Firestore path is:
//     organizations/{organizationId}/payments/{paymentId}
//
//   Creating a customer payment linked to an invoice auto-updates the invoice's
//   paidAmount / balanceDue / paymentStatus (handled in the payments service).
//
//   If no org is resolved (preview mode), the subscription returns an empty
//   list — NO Firestore read, NO permission error.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  subscribePayments,
  createPayment as svcCreate,
  updatePayment as svcUpdate,
  deletePayment as svcDelete,
  searchPayments,
  computePaymentStatsLocal,
  shouldSkipFirestore,
  type Payment,
  type CreatePaymentInput,
  type UpdatePaymentInput,
  type PaymentStats,
} from '@/lib/gstpilot-data';
import { useOrg } from '@/contexts/OrgContext';
import { invalidateBusinessSnapshot } from '@/lib/business-snapshot-events';

export interface UseGSTpilotPaymentsResult {
  payments: Payment[];
  filtered: Payment[];
  loading: boolean;
  error: string | null;
  saving: boolean;
  search: string;
  setSearch: (q: string) => void;
  stats: PaymentStats;
  create: (input: CreatePaymentInput) => Promise<Payment | null>;
  update: (id: string, patch: UpdatePaymentInput) => Promise<Payment | null>;
  remove: (id: string) => Promise<boolean>;
  retry: () => void;
}

export function useGSTpilotPayments(): UseGSTpilotPaymentsResult {
  const { organization, isPreviewMode } = useOrg();
  const orgId = organization?.id ?? null;

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [retryTick, setRetryTick] = useState(0);

  const paymentsRef = useRef<Payment[]>([]);
  paymentsRef.current = payments;

  // Keep orgId in a ref so the subscription effect doesn't re-run on every
  // orgId identity change (it should only re-run when the ID actually changes).
  const orgIdRef = useRef<string | null>(null);
  orgIdRef.current = orgId;

  useEffect(() => {
    const currentOrgId = orgIdRef.current;
    // Local workspace, preview mode, or no org → NO Firestore read.
    if (shouldSkipFirestore(currentOrgId, isPreviewMode)) {
      setPayments([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribePayments(
      currentOrgId,
      (list) => {
        setPayments(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        const code = (err as { code?: string }).code;
        const msg =
          code === 'permission-denied'
            ? 'Unable to load payments.\n\nReason: You don\'t currently have permission to read this organization\'s data. Please sign in and ensure you are a member of the organization.'
            : code === 'unavailable'
              ? 'You appear to be offline. Showing cached payments.'
              : err.message || 'Could not load payments.';
        setError(msg);
        setLoading(false);
        console.error('[useGSTpilotPayments] subscription error:', {
          orgId: currentOrgId,
          path: currentOrgId ? `organizations/${currentOrgId}/payments` : '(no org)',
          code,
          message: err.message,
        });
      },
    );
    return () => unsubscribe();
  }, [orgId, isPreviewMode, retryTick]);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setRetryTick((t) => t + 1);
  }, []);

  const create = useCallback(async (input: CreatePaymentInput) => {
    setSaving(true);
    try {
      const payment = await svcCreate(orgIdRef.current, input);
      setPayments((prev) => [payment, ...prev]);
      // Unified SaaS: invalidate the Business Snapshot so dashboards, Oracle,
      // AI CFO, and reports reflect the new payment immediately.
      invalidateBusinessSnapshot();
      return payment;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create payment.';
      setError(msg);
      console.error('[useGSTpilotPayments] create error:', {
        orgId: orgIdRef.current,
        error: err,
      });
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const update = useCallback(async (id: string, patch: UpdatePaymentInput) => {
    setSaving(true);
    try {
      const updated = await svcUpdate(orgIdRef.current, id, patch);
      setPayments((prev) => prev.map((p) => (p.id === id ? updated : p)));
      invalidateBusinessSnapshot();
      return updated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update payment.';
      setError(msg);
      console.error('[useGSTpilotPayments] update error:', {
        orgId: orgIdRef.current,
        id,
        error: err,
      });
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setSaving(true);
    try {
      const prev = paymentsRef.current;
      setPayments((cur) => cur.filter((p) => p.id !== id));
      try {
        await svcDelete(orgIdRef.current, id);
        invalidateBusinessSnapshot();
        return true;
      } catch (err) {
        setPayments(prev);
        throw err;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete payment.';
      setError(msg);
      console.error('[useGSTpilotPayments] delete error:', {
        orgId: orgIdRef.current,
        id,
        error: err,
      });
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const filtered = useMemo(() => searchPayments(payments, search), [payments, search]);

  const stats = useMemo(() => computePaymentStatsLocal(payments), [payments]);

  return {
    payments,
    filtered,
    loading,
    error,
    saving,
    search,
    setSearch,
    stats,
    create,
    update,
    remove,
    retry,
  };
}
