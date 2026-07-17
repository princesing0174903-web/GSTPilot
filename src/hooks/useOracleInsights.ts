'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — useOracleInsights() Hook
//
// Reads the persisted "Oracle is alive" insights doc at
// organizations/{orgId}/oracle/insights via /api/oracle/activation-insights.
// Auto-refreshes every 60 seconds and on window focus.
//
// Returns null insights when Oracle is not yet activated (the GET route
// returns 404/empty in that case — we treat both as "no insights yet").
//
// Usage:
//   const { insights, loading, error, refresh } = useOracleInsights();
//   if (loading) return <Skeleton />;
//   if (!insights) return null; // Oracle not activated yet
//   return <OracleLivePanel insights={insights} />;
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOrg } from '@/contexts/OrgContext';

// Re-export the OracleInsights type from the activation route so any
// component can import it from a single, hook-side location.
export type { OracleInsights } from '@/app/api/oracle/activate/route';

import type { OracleInsights } from '@/app/api/oracle/activate/route';

const REFRESH_INTERVAL_MS = 60_000; // 60 seconds

export interface UseOracleInsightsResult {
  insights: OracleInsights | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useOracleInsights(): UseOracleInsightsResult {
  const { organization } = useOrg();
  const orgId = organization?.id ?? null;

  const [insights, setInsights] = useState<OracleInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const orgIdRef = useRef<string | null>(null);
  orgIdRef.current = orgId;

  const fetchInsights = useCallback(async () => {
    const currentOrgId = orgIdRef.current;
    if (!currentOrgId) {
      setInsights(null);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      // Get the Firebase ID token for server-side authentication.
      const { auth } = await import('@/lib/firebase');
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setInsights(null);
        setLoading(false);
        setError(null);
        return;
      }
      const idToken = await currentUser.getIdToken();

      const url = `/api/oracle/activation-insights?organizationId=${encodeURIComponent(currentOrgId)}`;
      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (res.status === 401 || res.status === 403) {
        // Not authenticated / not a member — treat as "no insights yet".
        setInsights(null);
        setError(null);
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Request failed (${res.status})`);
      }

      const data = (await res.json()) as OracleInsights;
      setInsights(data);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load Oracle insights.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Initial fetch + refetch when org changes ──
  useEffect(() => {
    setLoading(true);
    fetchInsights();
  }, [orgId, refreshTick, fetchInsights]);

  // ── Auto-refresh every 60 seconds ──
  useEffect(() => {
    if (!orgId) return;
    const interval = setInterval(() => {
      fetchInsights();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [orgId, fetchInsights]);

  // ── Refresh on window focus ──
  useEffect(() => {
    const handleFocus = () => {
      if (orgIdRef.current) fetchInsights();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchInsights]);

  const refresh = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  return {
    insights,
    loading,
    error,
    refresh,
  };
}
