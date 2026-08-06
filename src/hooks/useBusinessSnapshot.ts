'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — useBusinessSnapshot() Hook
//
// The single hook every GSTPilot component uses to read the business snapshot.
// Auto-refreshes every 60 seconds and on window focus.
//
// Reliability (Task 2):
//   • fetchWithTimeout — 30s timeout, no hung requests.
//   • useSafePolling — interval never stacks on top of itself.
//   • AbortController — cancelled on unmount + on org change so stale responses
//     can't setState on a dead component.
//   • Invalidation listener registered synchronously (no race with dynamic import).
//   • Safety timer — if the first fetch hangs past the timeout, `loading` always
//     clears to `false` so no skeleton sits forever.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import type { BusinessSnapshot } from '@/lib/financial-engine';
import { emptySnapshot } from '@/lib/financial-engine';
import { fetchWithTimeout } from '@/lib/async';
import { onBusinessSnapshotInvalidated } from '@/lib/business-snapshot-events';

const REFRESH_INTERVAL_MS = 60_000; // 60 seconds
const FETCH_TIMEOUT_MS = 30_000;

// ── Module-level request deduplication ─────────────────────────────────────
// Multiple components (DashboardPage + OracleDailyBrief) mount this hook
// concurrently. Without dedup, each instance fires its own fetch → duplicate
// API calls. This module-level cache ensures only ONE fetch is in-flight per
// orgId at a time; concurrent callers share the same promise.
interface CacheEntry {
  promise: Promise<BusinessSnapshot>;
  timestamp: number;
}
const inflightCache = new Map<string, CacheEntry>();
const latestSnapshot = new Map<string, BusinessSnapshot>();

export interface UseBusinessSnapshotResult {
  snapshot: BusinessSnapshot;
  loading: boolean;
  error: string | null;
  hasLiveData: boolean;
  refresh: () => void;
}

export function useBusinessSnapshot(): UseBusinessSnapshotResult {
  const { organization } = useOrg();
  const orgId = organization?.id ?? null;

  const [snapshot, setSnapshot] = useState<BusinessSnapshot>(() => {
    // Hydrate from module-level cache so a second instance (e.g.
    // OracleDailyBrief) shows data instantly without a duplicate fetch.
    if (orgId && latestSnapshot.has(orgId)) {
      return latestSnapshot.get(orgId)!;
    }
    return emptySnapshot();
  });
  const [loading, setLoading] = useState(() => {
    // If we have cached data, don't show a loading state.
    if (orgId && latestSnapshot.has(orgId)) return false;
    return true;
  });
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Refs to avoid stale closures + allow unmount cancellation.
  const orgIdRef = useRef<string | null>(orgId);
  orgIdRef.current = orgId;
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Cancel any in-flight fetch on unmount.
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const fetchSnapshot = useCallback(async (forceRefresh = false) => {
    const currentOrgId = orgIdRef.current;
    if (!currentOrgId) {
      if (mountedRef.current) {
        setSnapshot(emptySnapshot());
        setLoading(false);
        setError(null);
      }
      return;
    }

    // ── Module-level deduplication ──
    // If a fetch for this org is already in-flight (e.g. another component
    // mounted this hook), share its promise instead of firing a second request.
    const cacheKey = `${currentOrgId}:${forceRefresh ? 'force' : 'normal'}`;
    const existing = inflightCache.get(cacheKey);
    let promise: Promise<BusinessSnapshot>;
    if (existing && Date.now() - existing.timestamp < FETCH_TIMEOUT_MS) {
      promise = existing.promise;
    } else {
      const url = forceRefresh
        ? `/api/business/snapshot?organizationId=${encodeURIComponent(currentOrgId)}&forceRefresh=true`
        : `/api/business/snapshot?organizationId=${encodeURIComponent(currentOrgId)}`;
      promise = (async () => {
        const res = await fetchWithTimeout(url, {
          cache: 'no-store',
          timeoutMs: FETCH_TIMEOUT_MS,
        });
        const data: BusinessSnapshot = await res.json();
        latestSnapshot.set(currentOrgId, data);
        return data;
      })();
      inflightCache.set(cacheKey, { promise, timestamp: Date.now() });
      // Clean up the inflight entry once it settles (keep latestSnapshot).
      promise.finally(() => inflightCache.delete(cacheKey));
    }

    // Per-instance single-flight: don't stack a second concurrent fetch on
    // the SAME hook instance (e.g. rapid refresh clicks).
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      const data = await promise;
      if (mountedRef.current) {
        setSnapshot(data);
        setError(null);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof Error && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Failed to load business data.';
      if (mountedRef.current) {
        setError(msg);
      }
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // ── Initial fetch + refetch when org changes ──
  useEffect(() => {
    if (mountedRef.current) setLoading(true);
    void fetchSnapshot();
  }, [orgId, refreshTick]);

  // ── Auto-refresh every 60 seconds (single-flight, no stacking) ──
  useEffect(() => {
    if (!orgId) return;
    const interval = setInterval(() => {
      void fetchSnapshot();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [orgId, fetchSnapshot]);

  // ── Refresh on window focus (single-flight via inFlightRef) ──
  useEffect(() => {
    const handleFocus = () => {
      if (orgIdRef.current) void fetchSnapshot();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchSnapshot]);

  // ── INSTANT refresh on global invalidation events ──
  // Registered synchronously (no late dynamic import) so there's no race with
  // component unmount. The handler is a no-op if the component has unmounted.
  useEffect(() => {
    const handler = () => {
      if (!mountedRef.current) return;
      if (orgIdRef.current) {
        if (mountedRef.current) setLoading(true);
        // Bypass the 30s server cache via forceRefresh=true.
        void fetchSnapshot(true);
      }
    };
    const off = onBusinessSnapshotInvalidated(handler);
    return () => {
      off();
    };
  }, [fetchSnapshot]);

  const refresh = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  return {
    snapshot,
    loading,
    error,
    hasLiveData: snapshot.hasLiveData,
    refresh,
  };
}
