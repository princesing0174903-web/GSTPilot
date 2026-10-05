'use client';
import { isLocalOrgId } from '@/lib/gstpilot-data/local-workspace';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — useGSTTransactions() Hook
//
// The single hook every GSTPilot component uses to:
//   • LIST GST transactions for the current organization (real-time, org-scoped)
//   • SYNC an invoice to a GST transaction (auto-create/update via calculations)
//   • DELETE all GST transactions for an invoice (e.g. when the invoice is cancelled)
//   • RETRY the subscription after a transient error
//
// Plus derived (memoized) artifacts that recompute on every transactions change:
//   • summary       — GSTSummary (output tax, input tax, net liability, health score)
//   • itcSummary    — ITCSummary (eligible / blocked / used ITC)
//   • gstr1Draft    — GSTR-1 draft (B2B / B2C / CDNs / Nil)
//   • gstr3bDraft   — GSTR-3B draft (monthly summary)
//
// All tenant scoping is automatic — components never touch `organizationId`.
// If the user has no organization yet, every operation no-ops safely.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import {
  subscribeToTransactions,
  syncInvoiceToTransaction as svcSyncInvoice,
  deleteTransactionsForInvoice as svcDeleteForInvoice,
  generateGSTSummary,
  calculateITC,
  prepareGSTR1,
  prepareGSTR3B,
  type GSTTransaction,
  type GSTTransactionType,
  type GSTSummary,
  type ITCSummary,
  type GSTR1Draft,
  type GSTR3BDraft,
} from '@/lib/gst-engine';
import type { Invoice } from '@/lib/invoice-engine/types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UseGSTTransactionsResult {
  /** GST transactions for the current org (real-time). */
  transactions: GSTTransaction[];
  /** Aggregated GST summary — recomputed whenever transactions change. */
  summary: GSTSummary | null;
  /** ITC summary — recomputed whenever transactions change. */
  itcSummary: ITCSummary | null;
  /** GSTR-1 draft for the current period. */
  gstr1Draft: GSTR1Draft | null;
  /** GSTR-3B draft for the current period. */
  gstr3bDraft: GSTR3BDraft | null;
  /** True while the initial subscription is loading. */
  loading: boolean;
  /** Friendly error message if the subscription failed. */
  error: string | null;
  /** True while any mutation is in-flight. */
  saving: boolean;

  /** Sync an invoice to a GST transaction (auto-create/update). */
  syncInvoice: (
    invoice: Invoice,
    transactionType: GSTTransactionType,
  ) => Promise<boolean>;
  /** Delete all GST transactions for an invoice. */
  deleteForInvoice: (invoiceId: string) => Promise<boolean>;
  /** Retry the last failed subscription. */
  retry: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Derive the current filing period (YYYY-MM) from a Date.
 * Used as the default `period` when the caller doesn't supply one.
 */
function currentFilingPeriod(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useGSTTransactions(options?: {
  period?: string;
  transactionType?: GSTTransactionType;
}): UseGSTTransactionsResult {
  const { organization, isPreviewMode } = useOrg();

  const [transactions, setTransactions] = useState<GSTTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  const orgId = organization?.id ?? null;
  const period = options?.period ?? currentFilingPeriod();
  const transactionType = options?.transactionType;

  // Keep the latest transactions in a ref so mutation helpers can read the
  // current list without re-subscribing.
  const transactionsRef = useRef<GSTTransaction[]>([]);
  transactionsRef.current = transactions;

  // ── Real-time subscription ──
  useEffect(() => {
    if (!orgId || isPreviewMode || isLocalOrgId(orgId)) {
      setTransactions([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToTransactions(
      orgId,
      (docs) => {
        setTransactions(docs);
        setLoading(false);
        setError(null);
      },
      {
        period: options?.period,
        transactionType,
        onError: (err) => {
          console.warn('[useGSTTransactions] subscription error:', err);
          const errCode = (err as { code?: string }).code;
          const errMsg = err.message || '';
          const msg =
            errCode === 'unavailable' || errMsg.includes('offline')
              ? 'You appear to be offline. Showing cached GST data — changes will sync when you reconnect.'
              : 'Could not load GST transactions. Please check your connection.';
          setError(msg);
          setLoading(false);
        },
      },
    );

    return () => unsubscribe();
  }, [orgId, isPreviewMode, options?.period, transactionType, retryTick]);

  // ── Retry handler ──
  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setRetryTick((t) => t + 1);
  }, []);

  // ── Sync an invoice to a GST transaction ──
  const syncInvoice = useCallback(
    async (
      invoice: Invoice,
      type: GSTTransactionType,
    ): Promise<boolean> => {
      if (!orgId) {
        setError('You need an organization before syncing GST transactions.');
        return false;
      }
      setSaving(true);
      try {
        await svcSyncInvoice(orgId, invoice, type);
        // The real-time subscription will pick up the change — no local
        // mutation needed.
        return true;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to sync invoice to GST transaction.';
        setError(message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId],
  );

  // ── Delete all GST transactions for an invoice ──
  const deleteForInvoice = useCallback(
    async (invoiceId: string): Promise<boolean> => {
      if (!orgId) {
        setError('You need an organization to delete GST transactions.');
        return false;
      }
      setSaving(true);
      try {
        // Optimistic: remove from local list immediately.
        const prev = transactionsRef.current;
        setTransactions((curr) => curr.filter((t) => t.invoiceId !== invoiceId));
        try {
          await svcDeleteForInvoice(orgId, invoiceId);
          return true;
        } catch (err) {
          // Rollback on failure.
          setTransactions(prev);
          throw err;
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to delete GST transactions for invoice.';
        setError(message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId],
  );

  // ── Derived artifacts (recomputed on every transactions change) ──
  const summary = useMemo<GSTSummary | null>(() => {
    if (!transactions.length) return null;
    try {
      return generateGSTSummary(transactions, period);
    } catch (err) {
      console.warn('[useGSTTransactions] generateGSTSummary failed:', err);
      return null;
    }
  }, [transactions, period]);

  const itcSummary = useMemo<ITCSummary | null>(() => {
    if (!transactions.length) return null;
    try {
      return calculateITC(transactions);
    } catch (err) {
      console.warn('[useGSTTransactions] calculateITC failed:', err);
      return null;
    }
  }, [transactions]);

  const gstr1Draft = useMemo<GSTR1Draft | null>(() => {
    if (!transactions.length) return null;
    try {
      return prepareGSTR1(transactions, period);
    } catch (err) {
      console.warn('[useGSTTransactions] prepareGSTR1 failed:', err);
      return null;
    }
  }, [transactions, period]);

  const gstr3bDraft = useMemo<GSTR3BDraft | null>(() => {
    if (!transactions.length) return null;
    try {
      return prepareGSTR3B(transactions, period);
    } catch (err) {
      console.warn('[useGSTTransactions] prepareGSTR3B failed:', err);
      return null;
    }
  }, [transactions, period]);

  return {
    transactions,
    summary,
    itcSummary,
    gstr1Draft,
    gstr3bDraft,
    loading,
    error,
    saving,
    syncInvoice,
    deleteForInvoice,
    retry,
  };
}
