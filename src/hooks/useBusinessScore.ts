'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Oracle™ & AI CFO™ — useBusinessScore() Hook
//
// Composite Business Score + Risk Score for the current organization.
// Scores are computed on demand by the orchestrator (not persisted by default),
// so this hook:
//   1. Fetches via GET /api/ai/score?orgId=X on mount + on refresh().
//   2. No real-time subscription (scores are derived, not stored).
//
// Mirrors useBanking.ts structure: useOrg() for orgId, useEffect with [orgId]
// deps, useCallback for refresh, null-safe when orgId is null.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import type { BusinessScore, RiskScore } from '@/lib/ai-provider';

// ─── Hook return type ──────────────────────────────────────────────────────

export interface UseBusinessScoreResult {
  /** Composite business score (0-100, higher = healthier). Null until fetched. */
  businessScore: BusinessScore | null;
  /** Risk score (0-100, higher = riskier). Null until fetched. */
  riskScore: RiskScore | null;
  /** True while the initial fetch is in-flight. */
  loading: boolean;
  /** Error string from fetch failure, or null. */
  error: string | null;
  /** Re-fetch scores (GET /api/ai/score). */
  refresh: () => Promise<void>;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useBusinessScore(): UseBusinessScoreResult {
  const { organization } = useOrg();
  const orgId = organization?.id ?? null;

  const [businessScore, setBusinessScore] = useState<BusinessScore | null>(null);
  const [riskScore, setRiskScore] = useState<RiskScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track the latest fetch so a stale response can't overwrite a fresh one.
  const fetchIdRef = useRef(0);

  // ─── Fetch helper ────────────────────────────────────────────────────────

  const fetchScores = useCallback(
    async (id: string): Promise<void> => {
      setLoading(true);
      setError(null);
      const myFetchId = ++fetchIdRef.current;
      try {
        const res = await fetch(`/api/ai/score?orgId=${encodeURIComponent(id)}`, {
          method: 'GET',
          cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Failed to load business score.');
        }
        if (myFetchId !== fetchIdRef.current) return;
        setBusinessScore((data.businessScore as BusinessScore) ?? null);
        setRiskScore((data.riskScore as RiskScore) ?? null);
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
      setBusinessScore(null);
      setRiskScore(null);
      setLoading(false);
      setError(null);
      return;
    }
    void fetchScores(orgId);
  }, [orgId, fetchScores]);

  // ─── Mutation: refresh ────────────────────────────────────────────────────

  const refresh = useCallback(async (): Promise<void> => {
    if (!orgId) return;
    await fetchScores(orgId);
  }, [orgId, fetchScores]);

  return {
    businessScore,
    riskScore,
    loading,
    error,
    refresh,
  };
}
