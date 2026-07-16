'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — useBusinessSnapshot() Hook
//
// The single hook every GSTPilot component uses to read the business snapshot.
// Auto-refreshes every 60 seconds and on window focus.
//
// Usage:
//   const { snapshot, loading, error, refresh } = useBusinessSnapshot();
//   if (loading) return <Skeleton />;
//   if (error) return <ErrorState onRetry={refresh} />;
//   if (!snapshot.hasLiveData) return <EmptyState />;
//   return <Dashboard revenue={snapshot.revenue} />;
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import type { BusinessSnapshot } from '@/lib/financial-engine';
import { emptySnapshot } from '@/lib/financial-engine';

const REFRESH_INTERVAL_MS = 60_000; // 60 seconds

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
  const orgIdRef = useRef<string | null>(null);
  orgIdRef.current = orgId;

  const fetchSnapshot = useCallback(async (forceRefresh = false) => {
    const currentOrgId = orgIdRef.current;
    if (!currentOrgId) {
      setSnapshot(emptySnapshot());
      setLoading(false);
      setError(null);
      return;
    }

    try {
      const url = forceRefresh
        ? `/api/business/snapshot?organizationId=${encodeURIComponent(currentOrgId)}&forceRefresh=true`
        : `/api/business/snapshot?organizationId=${encodeURIComponent(currentOrgId)}`;
      const res = await fetch(url, { cache: 'no-store' });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Request failed (${res.status})`);
      }

      const data: BusinessSnapshot = await res.json();
      setSnapshot(data);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load business data.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Force-refresh variant for the invalidation event bus. Bypasses the
  // 30-second server cache so dashboards update INSTANTLY after a mutation.
  const fetchSnapshotWithForceRefresh = useCallback(() => {
    void fetchSnapshot(true);
  }, [fetchSnapshot]);

  // ── Initial fetch + refetch when org changes ──
  useEffect(() => {
    setLoading(true);
    fetchSnapshot();
  }, [orgId, refreshTick, fetchSnapshot]);

  // ── Auto-refresh every 60 seconds ──
  useEffect(() => {
    if (!orgId) return;
    const interval = setInterval(() => {
      fetchSnapshot();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [orgId, fetchSnapshot]);

  // ── Refresh on window focus ──
  useEffect(() => {
    const handleFocus = () => {
      if (orgIdRef.current) fetchSnapshot();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchSnapshot]);

  // ── INSTANT refresh on global invalidation events ──
  // When ANY mutation happens (create invoice, create client, Zoho sync,
  // payment recorded, etc.), the mutation calls `invalidateBusinessSnapshot()`
  // and this hook re-fetches immediately with forceRefresh=true. This is
  // what makes the dashboard update INSTANTLY after a save — no 60-second wait.
  useEffect(() => {
    const handler = () => {
      if (orgIdRef.current) {
        // Bypass the 30s server cache by fetching with forceRefresh=true
        setLoading(true);
        fetchSnapshotWithForceRefresh();
      }
    };
    // Late import to avoid circular dependency in SSR
    import('@/lib/business-snapshot-events').then(({ onBusinessSnapshotInvalidated }) => {
      const off = onBusinessSnapshotInvalidated(handler);
      // Store cleanup on the handler so the effect's return can call it
      (handler as unknown as { _cleanup?: () => void })._cleanup = off;
    });
    return () => {
      const cleanup = (handler as unknown as { _cleanup?: () => void })._cleanup;
      if (cleanup) cleanup();
    };
  }, []);

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
