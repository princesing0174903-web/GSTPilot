'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Oracle™ & AI CFO™ — useAIAnalysis() Hook
//
// Trigger an on-demand AI analysis of the business or a specific module.
//   • `analyze()` → POST /api/ai/analyze with { organizationId, module? }.
//   • For `module='business'` (default), returns the full business bundle
//     { context, insights, recommendations, alerts, businessScore, riskScore, brief }.
//   • For other modules (cashflow/gst/invoices/expenses), returns
//     { result: AnalysisResult }.
//
// This hook is imperative — call `analyze()` when you need fresh analysis
// (e.g. on a button click). The full API payload is stored in `lastResult`.
//
// Mirrors useBanking.ts structure (useOrg for orgId, useCallback, null-safe
// when orgId is null).
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import type { AnalysisModule } from '@/lib/ai-provider';

// ─── Hook return type ──────────────────────────────────────────────────────

export interface UseAIAnalysisResult {
  /** Run a business or per-module analysis. Returns the full API payload. */
  analyze: (module?: AnalysisModule) => Promise<any>;
  /** True while the last analyze() call is in-flight. */
  loading: boolean;
  /** Error string from the last failed analyze() call, or null. */
  error: string | null;
  /** The full response payload from the last successful analyze() call. */
  lastResult: any;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useAIAnalysis(): UseAIAnalysisResult {
  const { organization } = useOrg();
  const orgId = organization?.id ?? null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);

  // ─── Mutation: analyze ───────────────────────────────────────────────────

  const analyze = useCallback(
    async (module: AnalysisModule = 'business'): Promise<any> => {
      if (!orgId) {
        setError('No organization selected.');
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId: orgId, module }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'AI analysis failed.');
        }
        // Strip the `ok` envelope — store the full payload for the consumer.
        const { ok: _ok, ...payload } = data;
        void _ok;
        setLastResult(payload);
        return payload;
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
    analyze,
    loading,
    error,
    lastResult,
  };
}
