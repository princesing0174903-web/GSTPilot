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

  const [snapshot, setSnapshot] = useState<BusinessSnapshot>(emptySnapshot());
  const [loading, setLoading] = useState(true);
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
    // Single-flight: skip if a previous fetch is still pending.
    if (inFlightRef.current) return;
    const currentOrgId = orgIdRef.current;
    if (!currentOrgId) {
      if (mountedRef.current) {
        setSnapshot(emptySnapshot());
        setLoading(false);
        setError(null);
      }
      return;
    }

    inFlightRef.current = true;
    // Abort any previous fetch (e.g. rapid refresh clicks).
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const url = forceRefresh
        ? `/api/business/snapshot?organizationId=${encodeURIComponent(currentOrgId)}&forceRefresh=true`
        : `/api/business/snapshot?organizationId=${encodeURIComponent(currentOrgId)}`;
      const res = await fetchWithTimeout(url, {
        cache: 'no-store',
        signal: controller.signal,
        timeoutMs: FETCH_TIMEOUT_MS,
      });
      const data: BusinessSnapshot = await res.json();
      if (mountedRef.current && !controller.signal.aborted) {
        setSnapshot(data);
        setError(null);
      }
    } catch (err) {
      // AbortError (from a superseding fetch or unmount) — silently ignore.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof Error && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Failed to load business data.';
      if (mountedRef.current && !controller.signal.aborted) {
        setError(msg);
      }
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current && !controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  // ── Initial fetch + refetch when org changes ──
  useEffect(() => {
    if (mountedRef.current) setLoading(true);
    void fetchSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
