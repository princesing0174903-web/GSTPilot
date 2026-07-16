'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — useInvoicesApi() Hook  (Prisma-backed tenant-scoped invoices)
//
// Replaces the Firestore-backed `useFireInvoices()` hook for the Invoice
// Workspace page. Reads from `GET /api/invoices?cloud=true&organizationId=X`
// (Prisma → SQLite) and exposes create / update / delete / approve mutations
// that hit the REST API with optimistic local-state updates.
//
// Why this exists:
//   The previous implementation used Firestore `onSnapshot` subscriptions that
//   fail with "Missing or insufficient permissions" when the user is not
//   Firebase-authenticated. The Prisma REST API uses tenant-scoped queries
//   (organizationId) and is the production data layer for GSTPilot.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import { useCurrentOrgId } from '@/contexts/OrgContext';
import { invalidateBusinessSnapshot } from '@/lib/business-snapshot-events';

// ─── Types (mirror the Prisma Invoice model) ─────────────────────────────────

export interface ApiInvoice {
  id: string;
  clientId: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  sellerGstin: string;
  buyerGstin: string | null;
  buyerName: string | null;
  invoiceType: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
  status: string;
  matchStatus: string;
  riskLevel: string;
  riskScore: number;
  notes: string | null;
  period: string | null;
  dueDate: string | null;
  gstAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
}

/** Shape of the POST body sent to `/api/invoices` with `cloud: true`. */
export interface CreateInvoicePayload {
  cloud: true;
  clientId?: string;
  customerName: string;
  buyerGstin?: string;
  sellerGstin?: string;
  date?: string;
  dueDate?: string;
  items: Array<{
    description: string;
    hsnCode?: string;
    quantity: number;
    unitPrice: number;
    gstRate: number;
  }>;
  notes?: string;
}

export interface UseInvoicesApiResult {
  invoices: ApiInvoice[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  createInvoice: (payload: CreateInvoicePayload) => Promise<ApiInvoice | null>;
  updateInvoice: (id: string, patch: Record<string, unknown>) => Promise<ApiInvoice | null>;
  deleteInvoice: (id: string) => Promise<boolean>;
  /** Set the invoice status to `approved` via PATCH. */
  approveInvoice: (id: string) => Promise<ApiInvoice | null>;
  /** True while any mutation is in-flight (used for button spinners). */
  saving: boolean;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useInvoicesApi(): UseInvoicesApiResult {
  const orgId = useCurrentOrgId();

  const [invoices, setInvoices] = useState<ApiInvoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [retryTick, setRetryTick] = useState<number>(0);

  // Keep a ref of the latest list so optimistic-update helpers can roll back
  // without re-subscribing.
  const invoicesRef = useRef<ApiInvoice[]>([]);
  invoicesRef.current = invoices;

  // ── Fetch on mount / when orgId changes ──
  useEffect(() => {
    if (!orgId) {
      setInvoices([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(
          `/api/invoices?cloud=true&organizationId=${encodeURIComponent(orgId)}`,
          { cache: 'no-store' },
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as { invoices?: ApiInvoice[] };
        if (cancelled) return;
        setInvoices(Array.isArray(json?.invoices) ? json.invoices : []);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.error('[useInvoicesApi] fetch failed:', err);
        setError('We couldn\'t load your invoices. Please check your connection and try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orgId, retryTick]);

  const refetch = useCallback(() => {
    setRetryTick((t) => t + 1);
  }, []);

  // ── Create ──
  const createInvoice = useCallback(
    async (payload: CreateInvoicePayload): Promise<ApiInvoice | null> => {
      if (!orgId) {
        setError('You need an organization before creating invoices.');
        return null;
      }
      setSaving(true);
      try {
        const res = await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `HTTP ${res.status}`);
        }
        const json = (await res.json()) as { invoice: ApiInvoice };
        // Optimistic: insert at the top of the list.
        setInvoices((prev) => [json.invoice, ...prev]);
        // Instantly refresh every dashboard / Oracle / AI CFO that reads
        // from the Business Snapshot (revenue, GST, health score, etc.).
        invalidateBusinessSnapshot();
        return json.invoice;
      } catch (err) {
        console.error('[useInvoicesApi] create failed:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to create this invoice right now. Please try again.',
        );
        return null;
      } finally {
        setSaving(false);
      }
    },
    [orgId],
  );

  // ── Update ──
  const updateInvoice = useCallback(
    async (id: string, patch: Record<string, unknown>): Promise<ApiInvoice | null> => {
      if (!orgId) return null;
      setSaving(true);
      const prev = invoicesRef.current;
      // Optimistic: patch the local copy immediately.
      setInvoices((list) =>
        list.map((inv) => (inv.id === id ? { ...inv, ...patch } as ApiInvoice : inv)),
      );
      try {
        const res = await fetch('/api/invoices', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...patch }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `HTTP ${res.status}`);
        }
        const json = (await res.json()) as { invoice: ApiInvoice };
        // Replace with the canonical server value.
        setInvoices((list) => list.map((inv) => (inv.id === id ? json.invoice : inv)));
        // Snapshot changed (totals, status, payment) — refresh everywhere.
        invalidateBusinessSnapshot();
        return json.invoice;
      } catch (err) {
        console.error('[useInvoicesApi] update failed:', err);
        // Rollback.
        setInvoices(prev);
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to update this invoice right now. Please try again.',
        );
        return null;
      } finally {
        setSaving(false);
      }
    },
    [orgId],
  );

  // ── Approve (PATCH status → 'approved') ──
  const approveInvoice = useCallback(
    async (id: string): Promise<ApiInvoice | null> => {
      return updateInvoice(id, { status: 'approved' });
    },
    [updateInvoice],
  );

  // ── Delete ──
  const deleteInvoice = useCallback(
    async (id: string): Promise<boolean> => {
      if (!orgId) return false;
      setSaving(true);
      const prev = invoicesRef.current;
      // Optimistic: remove immediately.
      setInvoices((list) => list.filter((inv) => inv.id !== id));
      try {
        const res = await fetch(
          `/api/invoices?id=${encodeURIComponent(id)}`,
          { method: 'DELETE' },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `HTTP ${res.status}`);
        }
        // Invoice removed — revenue / GST / outstanding all change.
        invalidateBusinessSnapshot();
        return true;
      } catch (err) {
        console.error('[useInvoicesApi] delete failed:', err);
        // Rollback.
        setInvoices(prev);
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to delete this invoice. Please try again.',
        );
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId],
  );

  return {
    invoices,
    loading,
    error,
    refetch,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    approveInvoice,
    saving,
  };
}
