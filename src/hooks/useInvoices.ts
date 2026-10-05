'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — useInvoices() Hook
//
// The single hook every GSTPilot component uses to:
//   • LIST invoices for the current organization (real-time, org-scoped)
//   • CREATE a new invoice (server-calculated totals + atomic numbering)
//   • UPDATE an invoice (re-calculated totals)
//   • DELETE an invoice
//   • DUPLICATE an invoice
//   • MARK AS PAID (full or partial)
//   • CANCEL an invoice
//   • GET a printable PDF URL
//
// All tenant scoping is automatic — components never touch `organizationId`.
// If the user has no organization yet, every operation no-ops safely.
//
// Optimistic updates: mutations update the local list immediately, then the
// real-time onSnapshot subscription confirms (or rolls back) the change.
// Offline mode: Firestore SDK buffers writes locally and syncs when online.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { isLocalOrgId } from '@/lib/gstpilot-data/local-workspace';
import {
  subscribeToInvoices,
  createInvoice as svcCreate,
  updateInvoice as svcUpdate,
  deleteInvoice as svcDelete,
  duplicateInvoice as svcDuplicate,
  markInvoicePaid as svcMarkPaid,
  cancelInvoice as svcCancel,
  computeInvoiceStats,
  generateInvoiceHTML,
  type Invoice,
  type CreateInvoiceInput,
  type UpdateInvoiceInput,
  type InvoiceStats,
  type InvoiceStatus,
} from '@/lib/invoice-engine';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UseInvoicesResult {
  /** Invoices for the current org (real-time). */
  invoices: Invoice[];
  /** Aggregated stats — recomputed whenever invoices change. */
  stats: InvoiceStats;
  loading: boolean;
  error: string | null;
  /** True while any mutation is in-flight. */
  saving: boolean;

  /** Create a new invoice. Server calculates totals + generates number. */
  create: (input: Omit<CreateInvoiceInput, 'organizationId' | 'createdBy'>) => Promise<Invoice | null>;
  /** Update an invoice. Server recalculates totals when items change. */
  update: (id: string, patch: UpdateInvoiceInput) => Promise<Invoice | null>;
  /** Delete an invoice permanently. */
  remove: (id: string) => Promise<boolean>;
  /** Duplicate an invoice (new number, draft status, zero paid). */
  duplicate: (id: string) => Promise<Invoice | null>;
  /** Mark an invoice as paid (full or partial amount). */
  markPaid: (id: string, amount?: number) => Promise<Invoice | null>;
  /** Cancel an invoice. */
  cancel: (id: string) => Promise<Invoice | null>;
  /** Open a printable invoice view in a new tab (user uses browser Print → PDF). */
  printInvoice: (id: string) => void;
  /** Retry the last failed fetch. */
  retry: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useInvoices(
  statusFilter?: InvoiceStatus,
): UseInvoicesResult {
  const { organization, profile, isPreviewMode } = useOrg();
  const { user } = useAuth();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  const orgId = organization?.id ?? null;

  // Keep the latest invoices in a ref so optimistic-update helpers can read
  // the current list without re-subscribing.
  const invoicesRef = useRef<Invoice[]>([]);
  invoicesRef.current = invoices;

  // ── Real-time subscription ──
  useEffect(() => {
    if (!orgId || isPreviewMode || isLocalOrgId(orgId)) {
      setInvoices([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToInvoices(
      orgId,
      (docs) => {
        setInvoices(docs);
        setLoading(false);
        setError(null);
      },
      {
        status: statusFilter,
        onError: (err) => {
          console.warn('[useInvoices] subscription error:', err);
          // Firestore throws "offline" / "unavailable" when the network drops.
          // Show a friendly message but keep the cached data if we have it.
          const errCode = (err as { code?: string }).code;
          const errMsg = err.message || '';
          const msg =
            errCode === 'unavailable' || errMsg.includes('offline')
              ? 'You appear to be offline. Showing cached invoices — changes will sync when you reconnect.'
              : 'Could not load invoices. Please check your connection.';
          setError(msg);
          setLoading(false);
        },
      },
    );

    return () => unsubscribe();
  }, [orgId, isPreviewMode, statusFilter, retryTick]);

  // ── Retry handler ──
  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setRetryTick((t) => t + 1);
  }, []);

  // ── Build the createdBy object from the current user + profile ──
  const buildCreatedBy = useCallback(() => {
    if (!user) return null;
    return {
      uid: user.id,
      name: profile?.displayName || user.name || user.email || 'Unknown',
      email: user.email || '',
    };
  }, [user, profile]);

  // ── Create ──
  // Plain async function — the React Compiler (Next.js 16) auto-memoizes it.
  const create = async (
    input: Omit<CreateInvoiceInput, 'organizationId' | 'createdBy'>,
  ): Promise<Invoice | null> => {
    if (!orgId) {
      setError('You need an organization before creating invoices.');
      return null;
    }
    const createdBy = buildCreatedBy();
    if (!createdBy) {
      setError('Please sign in to create invoices.');
      return null;
    }

    setSaving(true);
    try {
      const invoice = await svcCreate({
        ...input,
        organizationId: orgId,
        createdBy,
      });
      // Optimistic: insert at the top of the local list. The onSnapshot
      // subscription will confirm the write shortly.
      setInvoices((prev) => [invoice, ...prev]);
      return invoice;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create invoice.';
      setError(message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  // ── Update ──
  const update = async (
    id: string,
    patch: UpdateInvoiceInput,
  ): Promise<Invoice | null> => {
    if (!orgId) {
      setError('You need an organization to edit invoices.');
      return null;
    }
    setSaving(true);
    try {
      const updated = await svcUpdate(id, orgId, patch);
      // Optimistic: replace in the local list.
      setInvoices((prev) => prev.map((i) => (i.id === id ? updated : i)));
      return updated;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to update invoice.';
      setError(message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──
  const remove = async (id: string): Promise<boolean> => {
    if (!orgId) {
      setError('You need an organization to delete invoices.');
      return false;
    }
    setSaving(true);
    try {
      // Optimistic: remove from local list immediately.
      const prev = invoicesRef.current;
      setInvoices((prevList) => prevList.filter((i) => i.id !== id));
      try {
        await svcDelete(id, orgId);
        return true;
      } catch (err) {
        // Rollback on failure.
        setInvoices(prev);
        throw err;
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete invoice.';
      setError(message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  // ── Duplicate ──
  const duplicate = async (id: string): Promise<Invoice | null> => {
    if (!orgId) {
      setError('You need an organization to duplicate invoices.');
      return null;
    }
    const createdBy = buildCreatedBy();
    if (!createdBy) {
      setError('Please sign in to duplicate invoices.');
      return null;
    }
    setSaving(true);
    try {
      const invoice = await svcDuplicate(id, orgId, createdBy);
      setInvoices((prev) => [invoice, ...prev]);
      return invoice;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to duplicate invoice.';
      setError(message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  // ── Mark Paid ──
  const markPaid = async (id: string, amount?: number): Promise<Invoice | null> => {
    if (!orgId) {
      setError('You need an organization to update invoices.');
      return null;
    }
    setSaving(true);
    try {
      const updated = await svcMarkPaid(id, orgId, amount);
      setInvoices((prev) => prev.map((i) => (i.id === id ? updated : i)));
      return updated;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to mark invoice as paid.';
      setError(message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  // ── Cancel ──
  const cancel = async (id: string): Promise<Invoice | null> => {
    if (!orgId) {
      setError('You need an organization to cancel invoices.');
      return null;
    }
    setSaving(true);
    try {
      const updated = await svcCancel(id, orgId);
      setInvoices((prev) => prev.map((i) => (i.id === id ? updated : i)));
      return updated;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to cancel invoice.';
      setError(message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  // ── Print invoice (opens a new tab with a printable HTML invoice) ──
  // Generates the HTML entirely client-side from the invoice data we already
  // have via the real-time subscription — no server round-trip needed.
  const printInvoice = useCallback(
    (id: string): void => {
      const invoice = invoicesRef.current.find((i) => i.id === id);
      if (!invoice) {
        setError('Invoice not found. Please refresh and try again.');
        return;
      }
      const html = generateInvoiceHTML(invoice);
      const printWindow = window.open('', '_blank', 'noopener,noreferrer');
      if (!printWindow) {
        setError('Pop-up blocked. Please allow pop-ups to print invoices.');
        return;
      }
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    },
    [],
  );

  // ── Stats (recomputed on every invoices change) ──
  const stats = computeInvoiceStats(invoices);

  return {
    invoices,
    stats,
    loading,
    error,
    saving,
    create,
    update,
    remove,
    duplicate,
    markPaid,
    cancel,
    printInvoice,
    retry,
  };
}
