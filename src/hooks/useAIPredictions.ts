'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Oracle™ & AI CFO™ — useAIPredictions() Hook
//
// Generate a forecast for revenue or cashflow.
//   • `predict(metric, months=3)` → POST /api/ai/predict with
//     { organizationId, metric, months }. Returns the Prediction.
//
// Imperative — call `predict()` when you need fresh forecast data (e.g. on a
// button click or when the user picks a metric). The hook keeps loading +
// error state but does NOT cache predictions (the consumer decides whether to
// keep the result).
//
// Mirrors useBanking.ts structure (useOrg for orgId, useCallback, null-safe
// when orgId is null).
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import type { Prediction } from '@/lib/ai-provider';

// ─── Hook return type ──────────────────────────────────────────────────────

export interface UseAIPredictionsResult {
  /** Generate a forecast. Returns the Prediction on success, null on error. */
  predict: (metric: 'revenue' | 'cashflow', months?: number) => Promise<Prediction | null>;
  /** True while the last predict() call is in-flight. */
  loading: boolean;
  /** Error string from the last failed predict() call, or null. */
  error: string | null;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useAIPredictions(): UseAIPredictionsResult {
  const { organization } = useOrg();
  const orgId = organization?.id ?? null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Mutation: predict ───────────────────────────────────────────────────

  const predict = useCallback(
    async (metric: 'revenue' | 'cashflow', months = 3): Promise<Prediction | null> => {
      if (!orgId) {
        setError('No organization selected.');
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/ai/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId: orgId, metric, months }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'AI prediction failed.');
        }
        return (data.prediction as Prediction) ?? null;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  return {
    predict,
    loading,
    error,
  };
}
