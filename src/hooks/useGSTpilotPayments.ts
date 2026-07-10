'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — useGSTpilotPayments() Hook
//
// Real-time payments list (onSnapshot) + CRUD + search.
// Firestore is the ONLY source of truth: organizations/GSTpilot_SAAS/payments
//
// Creating a customer payment linked to an invoice auto-updates the invoice's
// paidAmount / balanceDue / paymentStatus (handled in the payments service).
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  subscribePayments,
  createPayment as svcCreate,
  updatePayment as svcUpdate,
  deletePayment as svcDelete,
  searchPayments,
  computePaymentStatsLocal,
  type Payment,
  type CreatePaymentInput,
  type UpdatePaymentInput,
  type PaymentStats,
} from '@/lib/gstpilot-data';

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
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [retryTick, setRetryTick] = useState(0);

  const paymentsRef = useRef<Payment[]>([]);
  paymentsRef.current = payments;

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribePayments(
      (list) => {
        setPayments(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        const code = (err as { code?: string }).code;
        const msg =
          code === 'permission-denied'
            ? 'Permission denied. Check Firestore security rules for organizations/GSTpilot_SAAS/payments.'
            : code === 'unavailable'
              ? 'You appear to be offline. Showing cached payments.'
              : err.message || 'Could not load payments.';
        setError(msg);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [retryTick]);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setRetryTick((t) => t + 1);
  }, []);

  const create = useCallback(async (input: CreatePaymentInput) => {
    setSaving(true);
    try {
      const payment = await svcCreate(input);
      setPayments((prev) => [payment, ...prev]);
      return payment;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create payment.');
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const update = useCallback(async (id: string, patch: UpdatePaymentInput) => {
    setSaving(true);
    try {
      const updated = await svcUpdate(id, patch);
      setPayments((prev) => prev.map((p) => (p.id === id ? updated : p)));
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update payment.');
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
        await svcDelete(id);
        return true;
      } catch (err) {
        setPayments(prev);
        throw err;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete payment.');
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
