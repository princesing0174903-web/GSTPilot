'use client';
import { isLocalOrgId } from '@/lib/gstpilot-data/local-workspace';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Oracle™ & AI CFO™ — useAIRecommendations() Hook
//
// Real-time subscription to AI-generated recommendations for the current org.
// Recommendations are persisted in the `ai_memory` Firestore collection with
// `type='recommendation'` — the orchestrator stores the full Recommendation
// object in the memory's `metadata` field. This hook:
//   1. Subscribes via `subscribeToMemoriesByType(orgId, 'recommendation', cb, 50)`.
//   2. Maps each AIMemory.metadata back to a Recommendation shape.
//   3. Sorts by priority (high→medium→low) then createdAt desc.
//   4. `refresh()` calls POST /api/ai/recommendations to regenerate + persist
//      fresh recommendations — the subscription surfaces them automatically.
//
// Mirrors useBanking.ts structure.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import {
  subscribeToMemoriesByType,
  type Recommendation,
  type RecommendationPriority,
} from '@/lib/ai-provider';

// ─── Priority ranking ──────────────────────────────────────────────────────
// high → medium → low (lower rank = higher priority).
const PRIORITY_RANK: Record<RecommendationPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * Map an AIMemory.metadata payload back to a Recommendation. The orchestrator
 * stores the full Recommendation object verbatim in `metadata`, so we just
 * shape-cast with defensive defaults.
 */
function metadataToRecommendation(
  memoryId: string,
  metadata: Record<string, unknown>,
  fallbackCreatedAt: string,
): Recommendation {
  const meta = metadata as Partial<Recommendation>;
  return {
    id: String(meta.id ?? memoryId),
    organizationId: String(meta.organizationId ?? ''),
    type: meta.type ?? 'review_overdue',
    priority: meta.priority ?? 'medium',
    title: String(meta.title ?? ''),
    description: String(meta.description ?? ''),
    rationale: String(meta.rationale ?? ''),
    actionLabel: String(meta.actionLabel ?? 'Review'),
    actionType: String(meta.actionType ?? ''),
    relatedEntityId: meta.relatedEntityId ?? undefined,
    relatedEntityType: meta.relatedEntityType ?? undefined,
    dueDate: meta.dueDate ?? undefined,
    status: meta.status ?? 'active',
    createdAt: String(meta.createdAt ?? fallbackCreatedAt),
  };
}

/**
 * Sort recommendations: priority rank asc (high first), then createdAt desc.
 */
function sortRecommendations(recs: Recommendation[]): Recommendation[] {
  return [...recs].sort((a, b) => {
    const rankA = PRIORITY_RANK[a.priority] ?? 99;
    const rankB = PRIORITY_RANK[b.priority] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
  });
}

// ─── Hook return type ──────────────────────────────────────────────────────

export interface UseAIRecommendationsResult {
  /** Sorted recommendations (high→medium→low, then newest first). */
  recommendations: Recommendation[];
  /** True until the first subscription snapshot arrives. */
  loading: boolean;
  /** Error string from refresh() failure, or null. */
  error: string | null;
  /** Regenerate + persist fresh recommendations (POST /api/ai/recommendations). */
  refresh: () => Promise<void>;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useAIRecommendations(): UseAIRecommendationsResult {
  const { organization, isPreviewMode } = useOrg();
  const orgId = organization?.id ?? null;

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscription ref (for cleanup).
  const unsubRef = useRef<(() => void) | null>(null);

  // ─── Real-time subscription ──────────────────────────────────────────────

  useEffect(() => {
    unsubRef.current?.();

    if (!orgId || isPreviewMode || isLocalOrgId(orgId)) {
      setRecommendations([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);

    unsubRef.current = subscribeToMemoriesByType(
      orgId,
      'recommendation',
      (memories) => {
        const mapped = memories.map((m) =>
          metadataToRecommendation(m.id, m.metadata ?? {}, m.createdAt),
        );
        setRecommendations(sortRecommendations(mapped));
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
      const res = await fetch('/api/ai/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to refresh AI recommendations.');
      }
      // The Firestore subscription will surface the new recommendations
      // automatically — no need to setRecommendations() here.
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
    }
  }, [orgId]);

  return {
    recommendations,
    loading,
    error,
    refresh,
  };
}
