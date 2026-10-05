'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — useClientsApi() Hook  (Prisma-backed tenant-scoped clients)
//
// Companion to `useInvoicesApi()` for the Invoice Workspace page. Reads from
// `GET /api/clients?organizationId=X` (Prisma → SQLite) and exposes a simple
// `clients` array + loading / error / refetch surface.
//
// This intentionally mirrors the shape of `useClients()` but is kept as a
// separate file so the Invoice Workspace can evolve its client needs
// independently (e.g. extra fields for invoice creation).
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useCurrentOrgId } from '@/contexts/OrgContext';
import { fetchWithTimeout } from '@/lib/async';

export interface ApiClient {
  id: string;
  gstin: string;
  tradeName: string;
  legalName?: string | null;
  state?: string | null;
  stateCode?: string | null;
  status: string;
  healthScore: number;
  contactEmail?: string | null;
  contactPhone?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UseClientsApiResult {
  clients: ApiClient[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useClientsApi(): UseClientsApiResult {
  const orgId = useCurrentOrgId();

  const [clients, setClients] = useState<ApiClient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState<number>(0);

  useEffect(() => {
    if (!orgId) {
      setClients([]);
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
          `/api/clients?organizationId=${encodeURIComponent(orgId)}`,
          { cache: 'no-store' },
          { timeoutMs: 20_000, retries: 1 },
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as { clients?: ApiClient[] };
        if (cancelled) return;
        setClients(Array.isArray(json?.clients) ? json.clients : []);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.error('[useClientsApi] fetch failed:', err);
        setError('We couldn\'t load your clients. Please check your connection and try again.');
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

  // Memoize the returned object so consumers don't re-render on every parent
  // render. (Was returning a fresh object literal on every render.)
  return useMemo<UseClientsApiResult>(
    () => ({ clients, loading, error, refetch }),
    [clients, loading, error, refetch],
  );
}
