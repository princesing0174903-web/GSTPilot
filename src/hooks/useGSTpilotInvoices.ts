'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — useGSTpilotInvoices() Hook
//
// Real-time invoices list (onSnapshot) + CRUD + search + mark paid + cancel.
// Firestore is the ONLY source of truth: organizations/GSTpilot_SAAS/invoices
// GST totals are computed in the service layer (never in the UI).
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  subscribeInvoices,
  createInvoice as svcCreate,
  updateInvoice as svcUpdate,
  deleteInvoice as svcDelete,
  markInvoicePaid as svcMarkPaid,
  cancelInvoice as svcCancel,
  searchInvoices,
  computeInvoiceStatsLocal,
  type Invoice,
  type CreateInvoiceInput,
  type UpdateInvoiceInput,
  type InvoiceStats,
} from '@/lib/gstpilot-data';

export interface UseGSTpilotInvoicesResult {
  invoices: Invoice[];
  filtered: Invoice[];
  loading: boolean;
  error: string | null;
  saving: boolean;
  search: string;
  setSearch: (q: string) => void;
  stats: InvoiceStats;
  create: (input: CreateInvoiceInput) => Promise<Invoice | null>;
  update: (id: string, patch: UpdateInvoiceInput) => Promise<Invoice | null>;
  remove: (id: string) => Promise<boolean>;
  markPaid: (id: string, amount?: number) => Promise<Invoice | null>;
  cancel: (id: string) => Promise<Invoice | null>;
  retry: () => void;
}

export function useGSTpilotInvoices(): UseGSTpilotInvoicesResult {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [retryTick, setRetryTick] = useState(0);

  const invoicesRef = useRef<Invoice[]>([]);
  invoicesRef.current = invoices;

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeInvoices(
      (list) => {
        setInvoices(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        const code = (err as { code?: string }).code;
        const msg =
          code === 'permission-denied'
            ? 'Permission denied. Check Firestore security rules for organizations/GSTpilot_SAAS/invoices.'
            : code === 'unavailable'
              ? 'You appear to be offline. Showing cached invoices.'
              : err.message || 'Could not load invoices.';
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

  const create = useCallback(async (input: CreateInvoiceInput) => {
    setSaving(true);
    try {
      const invoice = await svcCreate(input);
      setInvoices((prev) => [invoice, ...prev]);
      return invoice;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice.');
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const update = useCallback(async (id: string, patch: UpdateInvoiceInput) => {
    setSaving(true);
    try {
      const updated = await svcUpdate(id, patch);
      setInvoices((prev) => prev.map((i) => (i.id === id ? updated : i)));
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update invoice.');
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setSaving(true);
    try {
      const prev = invoicesRef.current;
      setInvoices((cur) => cur.filter((i) => i.id !== id));
      try {
        await svcDelete(id);
        return true;
      } catch (err) {
        setInvoices(prev);
        throw err;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete invoice.');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const markPaid = useCallback(async (id: string, amount?: number) => {
    setSaving(true);
    try {
      const updated = await svcMarkPaid(id, amount);
      setInvoices((prev) => prev.map((i) => (i.id === id ? updated : i)));
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark invoice as paid.');
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const cancel = useCallback(async (id: string) => {
    setSaving(true);
    try {
      const updated = await svcCancel(id);
      setInvoices((prev) => prev.map((i) => (i.id === id ? updated : i)));
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel invoice.');
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const filtered = useMemo(
    () => searchInvoices(invoices, search),
    [invoices, search],
  );

  const stats = useMemo(() => computeInvoiceStatsLocal(invoices), [invoices]);

  return {
    invoices,
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
    markPaid,
    cancel,
    retry,
  };
}
