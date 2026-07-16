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

  const fetchSnapshot = useCallback(async () => {
    const currentOrgId = orgIdRef.current;
    if (!currentOrgId) {
      setSnapshot(emptySnapshot());
      setLoading(false);
      setError(null);
      return;
    }

    try {
      const res = await fetch(
        `/api/business/snapshot?organizationId=${encodeURIComponent(currentOrgId)}`,
        { cache: 'no-store' },
      );

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
