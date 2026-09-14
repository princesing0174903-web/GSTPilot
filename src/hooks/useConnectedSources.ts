'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — useConnectedSources() Hook
//
// Returns the list of data sources the current organization has ACTUALLY
// connected — to be used in the Reconciliation "Source" dropdown (and
// anywhere else that needs to enumerate real integrations).
//
// BACKGROUND
//   The Reconciliation page previously rendered a hardcoded `SOURCE_OPTIONS`
//   array ("GSTR-2B vs Purchase Register", "GSTR-1 vs Sales Register", …).
//   Those are not real data sources — they are comparison-type labels — and
//   they had no relationship to the integrations the org had actually
//   connected. The user asked: "Source → connected sources". This hook is
//   the systemic root-cause fix.
//
// WHAT COUNTS AS A "CONNECTED SOURCE"
//   1. Zoho Books     — connected iff /api/integrations/zoho/status returns
//                       status.connected === true (ZohoBooksToken row exists).
//   2. GST Portal     — always available (core of a GST filing platform).
//                       Labelled "GST Portal (built-in)".
//   3. Bank           — connected iff /api/bank/accounts returns a non-empty
//                       accounts array (at least one BankAccount row exists).
//   4. Google Workspace — connected iff /api/integrations/google/status
//                       returns status.connected === true.
//   5. Manual         — always available (users can always enter data by
//                       hand). Labelled "Manual Entry".
//
// DESIGN
//   • Uses TanStack Query's `useQueries` to fire the three status lookups
//     in parallel.
//   • Skips every fetch while the org id is resolving (loading=true) so the
//     dropdown shows "Loading sources…" instead of an incomplete list.
//   • Each query has `retry: 1` and a try/catch in the queryFn so a 404 / 500
//     / network error on one endpoint never crashes the others — the
//     affected source is simply treated as "not connected".
//   • The `sources` array is ordered: connected integrations first, then the
//     always-available built-ins (GST Portal, Manual Entry). Every caller is
//     guaranteed at least those two, so the dropdown is never empty.
//
// VALUE SCHEMA (kept stable for downstream persistence)
//   • 'zoho'             — Zoho Books
//   • 'gst'              — GST Portal (built-in)
//   • 'bank'             — Bank
//   • 'google-workspace' — Google Workspace
//   • 'manual'           — Manual Entry
//   These are the strings written to `ReconciliationRun.sources` — keep them
//   in sync with the server's reconciliation schema.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useOrgUserHeaders } from '@/hooks/useOrgUserHeaders';

/** A single selectable source row for the dropdown. */
export interface ConnectedSource {
  /** Stable identifier persisted to ReconciliationRun.sources. */
  value: string;
  /** Human-readable label shown in the dropdown. */
  label: string;
  /** True if this source is always available (GST Portal, Manual Entry). */
  connected: boolean;
  /** True if this source requires + has a real integration hooking it up
   *  (Zoho, Bank, Google Workspace). Built-ins return `false`. */
  integrated: boolean;
}

export interface UseConnectedSourcesResult {
  /** Ordered list: connected integrations first, then built-ins. */
  sources: ConnectedSource[];
  /** True while the org is resolving or any status query is in flight. */
  loading: boolean;
}

// ─── Header builder ─────────────────────────────────────────────────────
//
// Delegates to the canonical useOrgUserHeaders() hook so all integration
// hooks (useZohoBooks + useGoogleWorkspace + useConnectedSources) emit an
// identical `x-gstpilot-orgid` + `x-gstpilot-actor` JSON shape.

// ─── API response shapes (subset) ────────────────────────────────────────────

interface ZohoStatusResponse {
  ok: boolean;
  status?: { connected?: boolean };
}
interface GoogleStatusResponse {
  ok: boolean;
  status?: { connected?: boolean };
}
interface BankAccountsResponse {
  ok: boolean;
  accounts?: unknown[];
  accountCount?: number;
}

// ─── Built-in sources (always present) ───────────────────────────────────────

const GST_PORTAL_SOURCE: ConnectedSource = {
  value: 'gst',
  label: 'GST Portal (built-in)',
  connected: true,
  integrated: false,
};

const MANUAL_SOURCE: ConnectedSource = {
  value: 'manual',
  label: 'Manual Entry',
  connected: true,
  integrated: false,
};

/**
 * Enumerate the data sources the current org has connected.
 *
 * Safe to call from any component under `OrgProvider`. While the org id is
 * resolving (or in preview mode), `loading` is `true` and `sources` contains
 * only the two built-ins so the dropdown is never visually empty.
 */
export function useConnectedSources(): UseConnectedSourcesResult {
  const getHeaders = useOrgUserHeaders();
  const { orgId } = getHeaders();
  const buildHeaders = useCallback(() => getHeaders().headers, [getHeaders]);

  const queries = useQueries({
    queries: [
      {
        queryKey: ['zoho-status', orgId ?? 'no-org'],
        queryFn: async () => {
          if (!orgId) return false;
          try {
            const res = await fetch('/api/integrations/zoho/status', {
              headers: buildHeaders(),
            });
            if (!res.ok) return false;
            const body = (await res.json().catch(() => ({}))) as ZohoStatusResponse;
            return Boolean(body?.status?.connected);
          } catch (e) {
            console.warn('[useConnectedSources] zoho-status failed:', e);
            return false;
          }
        },
        enabled: Boolean(orgId),
        staleTime: 30 * 1000,
        retry: 1,
      },
      {
        queryKey: ['google-workspace-status', orgId ?? 'no-org'],
        queryFn: async () => {
          if (!orgId) return false;
          try {
            const res = await fetch('/api/integrations/google/status', {
              headers: buildHeaders(),
            });
            if (!res.ok) return false;
            const body = (await res.json().catch(() => ({}))) as GoogleStatusResponse;
            return Boolean(body?.status?.connected);
          } catch (e) {
            console.warn('[useConnectedSources] google-workspace-status failed:', e);
            return false;
          }
        },
        enabled: Boolean(orgId),
        staleTime: 30 * 1000,
        retry: 1,
      },
      {
        queryKey: ['bank-accounts-count', orgId ?? 'no-org'],
        queryFn: async () => {
          if (!orgId) return false;
          try {
            const res = await fetch('/api/bank/accounts', { headers: buildHeaders() });
            if (!res.ok) return false;
            const body = (await res.json().catch(() => ({}))) as BankAccountsResponse;
            const count = Array.isArray(body?.accounts)
              ? body.accounts.length
              : body?.accountCount ?? 0;
            return count > 0;
          } catch (e) {
            console.warn('[useConnectedSources] bank-accounts-count failed:', e);
            return false;
          }
        },
        enabled: Boolean(orgId),
        staleTime: 30 * 1000,
        retry: 1,
      },
    ],
  });

  const [zohoQuery, googleQuery, bankQuery] = queries;
  const zohoConnected = zohoQuery.data === true;
  const googleConnected = googleQuery.data === true;
  const bankConnected = bankQuery.data === true;

  // Loading: org still resolving OR any enabled query still in flight.
  const loading =
    !orgId ||
    zohoQuery.isLoading ||
    googleQuery.isLoading ||
    bankQuery.isLoading;

  // Order: real connected integrations first, then the always-on built-ins.
  const sources: ConnectedSource[] = [];
  if (zohoConnected) {
    sources.push({
      value: 'zoho',
      label: 'Zoho Books',
      connected: true,
      integrated: true,
    });
  }
  if (bankConnected) {
    sources.push({
      value: 'bank',
      label: 'Bank',
      connected: true,
      integrated: true,
    });
  }
  if (googleConnected) {
    sources.push({
      value: 'google-workspace',
      label: 'Google Workspace',
      connected: true,
      integrated: true,
    });
  }
  sources.push(GST_PORTAL_SOURCE, MANUAL_SOURCE);

  return { sources, loading };
}
