'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — useGSTpilotInvoices() Hook
//
// Real-time invoices list (onSnapshot) + CRUD + search + mark paid + cancel.
//
// ORG-SCOPED (MULTI-TENANT):
//   Reads the current organizationId from OrgContext and passes it to every
//   gstpilot-data service call. The Firestore path is:
//     organizations/{organizationId}/invoices/{invoiceId}
//   GST totals are computed in the service layer (never in the UI).
//
//   If no org is resolved (preview mode), the subscription returns an empty
//   list — NO Firestore read, NO permission error.
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
  shouldSkipFirestore,
  type Invoice,
  type CreateInvoiceInput,
  type UpdateInvoiceInput,
  type InvoiceStats,
} from '@/lib/gstpilot-data';
import { useOrg } from '@/contexts/OrgContext';

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
  const { organization, isPreviewMode } = useOrg();
  const orgId = organization?.id ?? null;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [retryTick, setRetryTick] = useState(0);

  const invoicesRef = useRef<Invoice[]>([]);
  invoicesRef.current = invoices;

  // Keep orgId in a ref so the subscription effect doesn't re-run on every
  // orgId identity change (it should only re-run when the ID actually changes).
  const orgIdRef = useRef<string | null>(null);
  orgIdRef.current = orgId;

  useEffect(() => {
    const currentOrgId = orgIdRef.current;
    // Local workspace, preview mode, or no org → NO Firestore read.
    if (shouldSkipFirestore(currentOrgId, isPreviewMode)) {
      setInvoices([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeInvoices(
      currentOrgId,
      (list) => {
        setInvoices(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        const code = (err as { code?: string }).code;
        const msg =
          code === 'permission-denied'
            ? 'Unable to load invoices.\n\nReason: You don\'t currently have permission to read this organization\'s data. Please sign in and ensure you are a member of the organization.'
            : code === 'unavailable'
              ? 'You appear to be offline. Showing cached invoices.'
              : err.message || 'Could not load invoices.';
        setError(msg);
        setLoading(false);
        console.error('[useGSTpilotInvoices] subscription error:', {
          orgId: currentOrgId,
          path: currentOrgId ? `organizations/${currentOrgId}/invoices` : '(no org)',
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

  const create = useCallback(async (input: CreateInvoiceInput) => {
    setSaving(true);
    try {
      const invoice = await svcCreate(orgIdRef.current, input);
      setInvoices((prev) => [invoice, ...prev]);
      return invoice;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create invoice.';
      setError(msg);
      console.error('[useGSTpilotInvoices] create error:', {
        orgId: orgIdRef.current,
        error: err,
      });
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const update = useCallback(async (id: string, patch: UpdateInvoiceInput) => {
    setSaving(true);
    try {
      const updated = await svcUpdate(orgIdRef.current, id, patch);
      setInvoices((prev) => prev.map((i) => (i.id === id ? updated : i)));
      return updated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update invoice.';
      setError(msg);
      console.error('[useGSTpilotInvoices] update error:', {
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
      const prev = invoicesRef.current;
      setInvoices((cur) => cur.filter((i) => i.id !== id));
      try {
        await svcDelete(orgIdRef.current, id);
        return true;
      } catch (err) {
        setInvoices(prev);
        throw err;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete invoice.';
      setError(msg);
      console.error('[useGSTpilotInvoices] delete error:', {
        orgId: orgIdRef.current,
        id,
        error: err,
      });
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const markPaid = useCallback(async (id: string, amount?: number) => {
    setSaving(true);
    try {
      const updated = await svcMarkPaid(orgIdRef.current, id, amount);
      setInvoices((prev) => prev.map((i) => (i.id === id ? updated : i)));
      return updated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to mark invoice as paid.';
      setError(msg);
      console.error('[useGSTpilotInvoices] markPaid error:', {
        orgId: orgIdRef.current,
        id,
        error: err,
      });
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const cancel = useCallback(async (id: string) => {
    setSaving(true);
    try {
      const updated = await svcCancel(orgIdRef.current, id);
      setInvoices((prev) => prev.map((i) => (i.id === id ? updated : i)));
      return updated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel invoice.';
      setError(msg);
      console.error('[useGSTpilotInvoices] cancel error:', {
        orgId: orgIdRef.current,
        id,
        error: err,
      });
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
