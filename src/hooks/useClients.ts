'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — useClients() Hook  (Prisma-backed tenant-scoped clients)
//
// ROOT-CAUSE FIX for the "empty dropdown" production blocker.
//
// BACKGROUND
//   The /api/clients endpoint is multi-tenant: it REQUIRES a `?organizationId=`
//   (or legacy `?firmId=`) query param and returns `{ clients: [] }` when no
//   tenant scope is supplied (this is by design — it prevents cross-tenant
//   data leakage).
//
//   Many pages (Reconciliation, Returns, Review, Audit Logs, Client Health,
//   AI Task Generator, AI Benchmark, Error Resolution, Client Portal) were
//   calling `fetch('/api/clients')` with NO query param, so they ALWAYS
//   received an empty list — even when real clients existed in the DB. The
//   dropdowns built on top of those lists were therefore always empty.
//
//   This is NOT a UI bug and NOT a business-logic bug — it is a data-loading
//   bug: the orgId was never being threaded into the request.
//
// THE FIX
//   A single shared hook that:
//     1. Reads the current organization id from OrgContext (useCurrentOrgId).
//     2. Skips the fetch entirely while the org is still resolving (returns
//        loading:true) so callers render the proper "Loading…" state instead
//        of an empty dropdown.
//     3. Fetches `/api/clients?organizationId={orgId}` via TanStack Query,
//        which gives us caching, dedup, auto-retry, and `refetch` for
//        "newly created records appear immediately" behavior.
//     4. Surfaces `loading`, `error`, and `empty` flags so every dropdown
//        can render the correct state (spinner / options / "No clients
//        found" / error message).
//
//   Every page that previously called `fetch('/api/clients')` should switch
//   to this hook. This is the systemic root-cause fix — no per-page patches.
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import { useCurrentOrgId } from '@/contexts/OrgContext';
import { fetchWithTimeout } from '@/lib/async/fetchWithTimeout';

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT-CAUSE FIX (Task 9 — "Failed to load clients (HTTP 401)"):
// Previously this hook called raw `fetch()`. The `requireAuth()` middleware on
// `/api/clients` requires either a Bearer token OR the `x-gstpilot-actor`
// header (sandbox/preview fallback). Without that header, every call returned
// 401 AUTH_REQUIRED and the Customers page showed "Failed to load clients".
//
// `fetchWithTimeout` auto-injects the `x-gstpilot-actor` header for browser-side
// `/api/` requests by reading `localStorage.gstpilot_session` (set by AuthContext).
// Switching the single `fetch()` call below to `fetchWithTimeout()` permanently
// fixes the 401 for guest/local-workspace users.
//
// Bonus: 20s timeout + 1 retry on transient (5xx/network) errors.
// ═══════════════════════════════════════════════════════════════════════════════

/** Subset of the Prisma `Client` model returned by GET /api/clients. */
export interface ClientOption {
  id: string;
  gstin: string;
  tradeName: string;
  legalName?: string | null;
  status: string;
  healthScore: number;
  address?: string | null;
  state?: string | null;
  stateCode?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  createdAt?: string;
  updatedAt?: string;
  _aggregations?: {
    totalInvoices: number;
    filedReturns: number;
    pendingReturns: number;
    matchPercentage: number;
  };
}

export interface UseClientsResult {
  /** The list of clients for the current org (empty until loaded). */
  clients: ClientOption[];
  /** True while the initial load is in flight (or the org is resolving). */
  loading: boolean;
  /** Non-null when the fetch failed — surface in the dropdown as an error. */
  error: string | null;
  /** Convenience: true when the load succeeded but the org has no clients. */
  empty: boolean;
  /** Force a fresh fetch (e.g. after creating a new client). */
  refetch: () => void;
}

/**
 * Fetch the tenant-scoped client list.
 *
 * The hook is safe to call from any component under `OrgProvider`. While the
 * org id is resolving (or in preview mode where there is no org), `loading`
 * is `true` and `clients` is `[]` — callers should show a spinner, not an
 * empty dropdown.
 */
export function useClients(): UseClientsResult {
  const orgId = useCurrentOrgId();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['clients', orgId ?? 'no-org'],
    // Skip the network call when there is no org yet — TanStack Query will
    // keep the query in `pending` (isLoading=true) which is exactly the
    // "Loading…" state we want dropdowns to render.
    queryFn: async ({ signal }) => {
      if (!orgId) return [] as ClientOption[];
      // Use fetchWithTimeout so the `x-gstpilot-actor` header is auto-injected
      // (fixes HTTP 401 AUTH_REQUIRED for guest/local-workspace users).
      const res = await fetchWithTimeout(
        `/api/clients?organizationId=${encodeURIComponent(orgId)}`,
        { signal },
        { timeoutMs: 20_000, retries: 1 },
      );
      if (!res.ok) {
        throw new Error(`Failed to load clients (HTTP ${res.status})`);
      }
      const json = (await res.json()) as { clients?: ClientOption[] };
      return Array.isArray(json?.clients) ? json.clients : [];
    },
    // Only enable the query once we have an org id. Until then the hook
    // reports loading=true so dropdowns show "Loading…" instead of "No
    // clients found".
    enabled: Boolean(orgId),
    staleTime: 30 * 1000,
    retry: 1,
  });

  return {
    clients: data ?? [],
    loading: isLoading || !orgId,
    error: error instanceof Error ? error.message : null,
    empty: Boolean(orgId) && !isLoading && (data?.length ?? 0) === 0 && !error,
    refetch: () => void refetch(),
  };
}
