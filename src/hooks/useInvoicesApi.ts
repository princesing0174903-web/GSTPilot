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

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useCurrentOrgId } from '@/contexts/OrgContext';
import { invalidateBusinessSnapshot } from '@/lib/business-snapshot-events';
import { fetchWithTimeout } from '@/lib/async';

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
  // Invoice Cloud™ document fields (nullable — older invoices may not have them)
  terms?: string | null;
  bankDetails?: string | null;
  placeOfSupply?: string | null;
  reverseCharge?: boolean;
}

/** Shape of the POST body sent to `/api/invoices` with `cloud: true`. */
export interface CreateInvoicePayload {
  cloud: true;
  /** Resolved organization/firm id — required by the API to scope the new
   * invoice to the caller's tenant (the hook injects this automatically). */
  organizationId?: string;
  clientId?: string;
  customerName: string;
  buyerGstin?: string;
  sellerGstin?: string;
  date?: string;
  dueDate?: string;
  invoiceNumber?: string;
  invoiceType?: string;
  items: Array<{
    description: string;
    hsnCode?: string;
    quantity: number;
    unit?: string;
    unitPrice: number;
    gstRate: number;
    cessRate?: number;
    discount?: number;
  }>;
  notes?: string;
  notesFinance?: string;
  terms?: string;
  bankDetails?: string;
  placeOfSupply?: string;
  reverseCharge?: boolean;
  isInterState?: boolean;
  recurring?: boolean;
  recurringCycle?: string;
}

/** Shape of an Oracle AI insight payload returned by `/api/invoices/[id]/insights`. */
export interface InvoiceInsights {
  paymentPrediction: { likelyPayDate: string | null; confidence: number; reasoning: string };
  latePaymentRisk: { level: 'low' | 'medium' | 'high' | 'critical'; score: number; factors: string[] };
  anomalies: Array<{ type: string; severity: 'info' | 'warning' | 'critical'; message: string }>;
  duplicateDetection: Array<{ type: string; invoiceId: string; invoiceNumber: string; confidence: number; reason: string }>;
  gstMismatch: { hasMismatch: boolean; details: string };
  collectionSuggestion: { action: string; message: string; channel: 'email' | 'whatsapp' | 'call' };
  oneClickFixes: Array<{ id: string; label: string; description: string; endpoint: string; method: 'POST' | 'PATCH'; body: Record<string, unknown> }>;
}

export interface UseInvoicesApiResult {
  invoices: ApiInvoice[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  createInvoice: (payload: CreateInvoicePayload) => Promise<ApiInvoice | null>;
  updateInvoice: (id: string, patch: Record<string, unknown>) => Promise<ApiInvoice | null>;
  deleteInvoice: (id: string) => Promise<boolean>;
  /** Set the invoice status to `sent` via PATCH (promotes a draft). */
  approveInvoice: (id: string) => Promise<ApiInvoice | null>;
  /** Cancel an invoice (status → 'cancelled') via PATCH. */
  cancelInvoice: (id: string) => Promise<ApiInvoice | null>;
  /** Mark an invoice paid (full or partial) via POST /api/invoices/mark-paid. */
  markPaid: (id: string, paidAmount?: number, paymentMode?: string, paymentDate?: string) => Promise<ApiInvoice | null>;
  /** Duplicate an invoice via POST /api/invoices/duplicate. */
  duplicateInvoice: (id: string) => Promise<ApiInvoice | null>;
  /** Fetch Oracle AI insights for an invoice via GET /api/invoices/[id]/insights. */
  fetchInsights: (id: string) => Promise<InvoiceInsights | null>;
  /** Send an invoice (email/whatsapp/sms) via POST /api/invoices/send.
   *  Returns the invoice + delivery status (delivered, deliveryNote). */
  sendInvoice: (id: string, channel?: 'email' | 'whatsapp' | 'sms') => Promise<{ invoice: ApiInvoice; delivered: boolean; deliveryNote: string } | null>;
  /** Generate a print-ready HTML + UPI payment link via POST /api/invoices/pdf. */
  generatePdf: (id: string) => Promise<{ html: string; paymentLink: string; invoice: ApiInvoice } | null>;
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
        const res = await fetchWithTimeout(
          `/api/invoices?cloud=true&organizationId=${encodeURIComponent(orgId)}`,
          { cache: 'no-store' },
          { timeoutMs: 20_000, retries: 1 },
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
        // Inject the resolved org id so the API can scope the new invoice to
        // the caller's tenant. Without this, the POST returns 400 "A client or
        // organization is required" when creating an invoice for a brand-new
        // customer (no clientId to look up the firm from).
        const requestBody = { ...payload, organizationId: orgId };
        const res = await fetchWithTimeout(
          '/api/invoices',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          },
          { timeoutMs: 20_000, retries: 1 },
        );
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
        const res = await fetchWithTimeout(
          '/api/invoices',
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, ...patch }),
          },
          { timeoutMs: 20_000, retries: 1 },
        );
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

  // ── Approve (PATCH status → 'sent' — promotes a draft to sent) ──
  // FIX (B10): 'approved' is not a valid invoice status. The approve action
  // promotes a draft to 'sent' (the invoice is approved for sending).
  const approveInvoice = useCallback(
    async (id: string): Promise<ApiInvoice | null> => {
      return updateInvoice(id, { status: 'sent' });
    },
    [updateInvoice],
  );

  // ── Cancel (PATCH status → 'cancelled') ──
  const cancelInvoice = useCallback(
    async (id: string): Promise<ApiInvoice | null> => {
      return updateInvoice(id, { status: 'cancelled' });
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
        const res = await fetchWithTimeout(
          `/api/invoices?id=${encodeURIComponent(id)}`,
          { method: 'DELETE' },
          { timeoutMs: 20_000, retries: 1 },
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

  // ── Mark Paid (POST /api/invoices/mark-paid) ──
  const markPaid = useCallback(
    async (id: string, paidAmount?: number, paymentMode?: string, paymentDate?: string): Promise<ApiInvoice | null> => {
      if (!orgId) return null;
      setSaving(true);
      try {
        const res = await fetchWithTimeout(
          '/api/invoices/mark-paid',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, paidAmount, paymentMode, paymentDate }),
          },
          { timeoutMs: 20_000, retries: 1 },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `HTTP ${res.status}`);
        }
        const json = (await res.json()) as { invoice: ApiInvoice };
        setInvoices((list) => list.map((inv) => (inv.id === id ? json.invoice : inv)));
        invalidateBusinessSnapshot();
        return json.invoice;
      } catch (err) {
        console.error('[useInvoicesApi] markPaid failed:', err);
        setError(err instanceof Error ? err.message : 'Unable to record payment. Please try again.');
        return null;
      } finally {
        setSaving(false);
      }
    },
    [orgId],
  );

  // ── Duplicate (POST /api/invoices/duplicate) ──
  const duplicateInvoice = useCallback(
    async (id: string): Promise<ApiInvoice | null> => {
      if (!orgId) return null;
      setSaving(true);
      try {
        const res = await fetchWithTimeout(
          '/api/invoices/duplicate',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          },
          { timeoutMs: 20_000, retries: 1 },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `HTTP ${res.status}`);
        }
        const json = (await res.json()) as { invoice: ApiInvoice };
        setInvoices((prev) => [json.invoice, ...prev]);
        invalidateBusinessSnapshot();
        return json.invoice;
      } catch (err) {
        console.error('[useInvoicesApi] duplicate failed:', err);
        setError(err instanceof Error ? err.message : 'Unable to duplicate this invoice. Please try again.');
        return null;
      } finally {
        setSaving(false);
      }
    },
    [orgId],
  );

  // ── Fetch Oracle AI insights (GET /api/invoices/[id]/insights) ──
  const fetchInsights = useCallback(
    async (id: string): Promise<InvoiceInsights | null> => {
      if (!orgId) return null;
      try {
        const res = await fetchWithTimeout(
          `/api/invoices/${encodeURIComponent(id)}/insights`,
          { cache: 'no-store' },
          { timeoutMs: 20_000, retries: 1 },
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return (await res.json()) as InvoiceInsights;
      } catch (err) {
        console.error('[useInvoicesApi] fetchInsights failed:', err);
        return null;
      }
    },
    [orgId],
  );

  // ── Send invoice (POST /api/invoices/send) ──
  // Returns { invoice, delivered, deliveryNote } so the UI can surface the
  // actual delivery status (never fake "sent" when the email wasn't delivered).
  const sendInvoice = useCallback(
    async (id: string, channel: 'email' | 'whatsapp' | 'sms' = 'email'): Promise<{ invoice: ApiInvoice; delivered: boolean; deliveryNote: string } | null> => {
      if (!orgId) return null;
      setSaving(true);
      try {
        const res = await fetchWithTimeout(
          '/api/invoices/send',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, channel }),
          },
          { timeoutMs: 20_000, retries: 1 },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `HTTP ${res.status}`);
        }
        const json = (await res.json()) as { invoice: ApiInvoice; delivered?: boolean; deliveryNote?: string; channel?: string };
        setInvoices((list) => list.map((inv) => (inv.id === id ? json.invoice : inv)));
        invalidateBusinessSnapshot();
        return {
          invoice: json.invoice,
          delivered: Boolean(json.delivered),
          deliveryNote: json.deliveryNote ?? '',
        };
      } catch (err) {
        console.error('[useInvoicesApi] send failed:', err);
        setError(err instanceof Error ? err.message : 'Unable to send this invoice. Please try again.');
        return null;
      } finally {
        setSaving(false);
      }
    },
    [orgId],
  );

  // ── Generate PDF (POST /api/invoices/pdf) ──
  const generatePdf = useCallback(
    async (id: string): Promise<{ html: string; paymentLink: string; invoice: ApiInvoice } | null> => {
      if (!orgId) return null;
      setSaving(true);
      try {
        const res = await fetchWithTimeout(
          '/api/invoices/pdf',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          },
          { timeoutMs: 25_000, retries: 1 },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `HTTP ${res.status}`);
        }
        const json = (await res.json()) as { html: string; paymentLink: string; invoice: ApiInvoice };
        // Keep the local list in sync (status may have transitioned, though we
        // removed the auto-mark-sent side effect — still safe to refresh).
        setInvoices((list) => list.map((inv) => (inv.id === id ? { ...inv, ...json.invoice } : inv)));
        return json;
      } catch (err) {
        console.error('[useInvoicesApi] generatePdf failed:', err);
        setError(err instanceof Error ? err.message : 'Unable to generate PDF. Please try again.');
        return null;
      } finally {
        setSaving(false);
      }
    },
    [orgId],
  );

  // ── Memoize the returned object so consumers that destructure multiple
  // values don't re-render every time the parent re-renders. (Was returning a
  // fresh object literal on every render — caused downstream effects to
  // re-fire whenever any sibling state changed.)
  return useMemo<UseInvoicesApiResult>(
    () => ({
      invoices,
      loading,
      error,
      refetch,
      createInvoice,
      updateInvoice,
      deleteInvoice,
      approveInvoice,
      cancelInvoice,
      markPaid,
      duplicateInvoice,
      fetchInsights,
      sendInvoice,
      generatePdf,
      saving,
    }),
    [
      invoices,
      loading,
      error,
      refetch,
      createInvoice,
      updateInvoice,
      deleteInvoice,
      approveInvoice,
      cancelInvoice,
      markPaid,
      duplicateInvoice,
      fetchInsights,
      sendInvoice,
      generatePdf,
      saving,
    ],
  );
}
