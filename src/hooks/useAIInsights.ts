'use client';
import { isLocalOrgId } from '@/lib/gstpilot-data/local-workspace';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Oracle™ & AI CFO™ — useAIInsights() Hook
//
// Real-time subscription to AI-generated insights for the current organization.
// Insights are persisted in the `ai_memory` Firestore collection with
// `type='insight'` — the orchestrator stores the full Insight object in the
// memory's `metadata` field. This hook:
//   1. Subscribes via `subscribeToMemoriesByType(orgId, 'insight', cb, 50)`
//      (real-time onSnapshot — fires on every write/update/delete).
//   2. Maps each AIMemory.metadata back to an Insight shape.
//   3. Sorts by severity (critical→warning→positive→info) then createdAt desc.
//   4. `refresh()` calls POST /api/ai/insights to regenerate + persist fresh
//      insights — the Firestore subscription then surfaces them automatically.
//
// Mirrors useBanking.ts structure: useOrg() for orgId, useRef for the
// unsubscribe function, useEffect with [orgId] deps, cleanup on unmount,
// null-safe when orgId is null.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import {
  subscribeToMemoriesByType,
  type Insight,
  type InsightSeverity,
} from '@/lib/ai-provider';

// ─── Severity ranking ──────────────────────────────────────────────────────
// critical → warning → positive → info (lower rank = higher priority).
const SEVERITY_RANK: Record<InsightSeverity, number> = {
  critical: 0,
  warning: 1,
  positive: 2,
  info: 3,
};

/**
 * Map an AIMemory.metadata payload back to an Insight. The orchestrator stores
 * the full Insight object verbatim in `metadata`, so we just shape-cast.
 * Falls back to safe defaults for any missing field (defensive — should never
 * happen in practice since the orchestrator always writes complete Insight
 * objects).
 */
function metadataToInsight(
  memoryId: string,
  metadata: Record<string, unknown>,
  fallbackCreatedAt: string,
): Insight {
  const meta = metadata as Partial<Insight>;
  return {
    id: String(meta.id ?? memoryId),
    organizationId: String(meta.organizationId ?? ''),
    type: meta.type ?? 'positive_growth',
    severity: meta.severity ?? 'info',
    title: String(meta.title ?? ''),
    description: String(meta.description ?? ''),
    category: meta.category ?? 'revenue',
    metric: typeof meta.metric === 'number' ? meta.metric : undefined,
    metricLabel: meta.metricLabel ?? undefined,
    changePercent: typeof meta.changePercent === 'number' ? meta.changePercent : undefined,
    relatedEntityId: meta.relatedEntityId ?? undefined,
    relatedEntityType: meta.relatedEntityType ?? undefined,
    createdAt: String(meta.createdAt ?? fallbackCreatedAt),
    dismissed: typeof meta.dismissed === 'boolean' ? meta.dismissed : undefined,
  };
}

/**
 * Sort insights: severity rank asc (critical first), then createdAt desc.
 */
function sortInsights(insights: Insight[]): Insight[] {
  return [...insights].sort((a, b) => {
    const rankA = SEVERITY_RANK[a.severity] ?? 99;
    const rankB = SEVERITY_RANK[b.severity] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    // Newer first (ISO strings sort lexicographically).
    return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
  });
}

// ─── Hook return type ──────────────────────────────────────────────────────

export interface UseAIInsightsResult {
  /** Sorted insights (critical→warning→positive→info, then newest first). */
  insights: Insight[];
  /** True until the first subscription snapshot arrives. */
  loading: boolean;
  /** Error string from refresh() failure, or null. */
  error: string | null;
  /** Regenerate + persist fresh insights (POST /api/ai/insights). */
  refresh: () => Promise<void>;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useAIInsights(): UseAIInsightsResult {
  const { organization, isPreviewMode } = useOrg();
  const orgId = organization?.id ?? null;

  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscription ref (for cleanup).
  const unsubRef = useRef<(() => void) | null>(null);

  // ─── Real-time subscription ──────────────────────────────────────────────

  useEffect(() => {
    unsubRef.current?.();

    if (!orgId || isPreviewMode || isLocalOrgId(orgId)) {
      setInsights([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);

    unsubRef.current = subscribeToMemoriesByType(
      orgId,
      'insight',
      (memories) => {
        const mapped = memories.map((m) =>
          metadataToInsight(m.id, m.metadata ?? {}, m.createdAt),
        );
        setInsights(sortInsights(mapped));
        setLoading(false);
        setError(null);
      },
      50,
    );

    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [orgId, isPreviewMode]);

  const refresh = useCallback(async (): Promise<void> => {
    if (!orgId) return;
    setError(null);
    try {
      const res = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to refresh AI insights.');
      }
      // The Firestore subscription will surface the new insights automatically —
      // no need to setInsights() here.
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
    }
  }, [orgId]);

  return {
    insights,
    loading,
    error,
    refresh,
  };
}
