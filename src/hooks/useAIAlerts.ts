'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Oracle™ & AI CFO™ — useAIAlerts() Hook
//
// Live alerts for the current organization. Alerts are NOT persisted to
// `ai_memory` by default — they are recomputed live by the orchestrator from
// the current BusinessContext on every fetch. So this hook:
//   1. Fetches via GET /api/ai/alerts?orgId=X on mount + on refresh().
//   2. No real-time subscription (alerts are derived, not stored).
//
// Mirrors useBanking.ts structure: useOrg() for orgId, useEffect with [orgId]
// deps, useCallback for refresh, null-safe when orgId is null.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import type { Alert } from '@/lib/ai-provider';

// ─── Hook return type ──────────────────────────────────────────────────────

export interface UseAIAlertsResult {
  /** Live alerts (as returned by the API — already sorted by severity server-side). */
  alerts: Alert[];
  /** True while the initial fetch is in-flight. */
  loading: boolean;
  /** Error string from fetch failure, or null. */
  error: string | null;
  /** Re-fetch live alerts (GET /api/ai/alerts). */
  refresh: () => Promise<void>;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useAIAlerts(): UseAIAlertsResult {
  const { organization } = useOrg();
  const orgId = organization?.id ?? null;

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track the latest fetch so a stale response can't overwrite a fresh one
  // (e.g. if the user clicks refresh twice quickly or orgId changes mid-fetch).
  const fetchIdRef = useRef(0);

  // ─── Fetch helper ────────────────────────────────────────────────────────

  const fetchAlerts = useCallback(
    async (id: string): Promise<void> => {
      setLoading(true);
      setError(null);
      const myFetchId = ++fetchIdRef.current;
      try {
        const res = await fetch(`/api/ai/alerts?orgId=${encodeURIComponent(id)}`, {
          method: 'GET',
          cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Failed to load AI alerts.');
        }
        // Guard against stale responses overwriting newer state.
        if (myFetchId !== fetchIdRef.current) return;
        const next = Array.isArray(data.alerts) ? (data.alerts as Alert[]) : [];
        setAlerts(next);
      } catch (err) {
        if (myFetchId !== fetchIdRef.current) return;
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
      } finally {
        if (myFetchId === fetchIdRef.current) {
          setLoading(false);
        }
      }
    },
    [],
  );

  // ─── Initial / org-change fetch ──────────────────────────────────────────

  useEffect(() => {
    if (!orgId) {
      setAlerts([]);
      setLoading(false);
      setError(null);
      return;
    }
    // Fire and forget — fetchAlerts is self-contained.
    void fetchAlerts(orgId);
  }, [orgId, fetchAlerts]);

  // ─── Mutation: refresh ────────────────────────────────────────────────────

  const refresh = useCallback(async (): Promise<void> => {
    if (!orgId) return;
    await fetchAlerts(orgId);
  }, [orgId, fetchAlerts]);

  return {
    alerts,
    loading,
    error,
    refresh,
  };
}
