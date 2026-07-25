'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — useAIRecommendations() Hook
//
// Real recommendations derived from the Business Snapshot + targeted Prisma
// queries (replaces the previous Firestore subscription model).
//
// The hook now calls GET /api/recommendations?organizationId=... which:
//   1. Reads the canonical Business Snapshot (single source of truth).
//   2. Runs the pure rules engine (snapshot-level checks).
//   3. Runs async Prisma enrichment (overdue-tomorrow invoices, revenue drop,
//      customer payment delays, top-customer concentration).
//   4. Merges + sorts by priority (critical → high → medium → low) then
//      dueInDays (sooner first).
//
// The hook:
//   • Auto-fetches on mount + when the org changes.
//   • Auto-refreshes every 60s (matches the snapshot's cache TTL).
//   • Refreshes on window focus (so new invoices/payments surface quickly).
//   • Exposes `refresh()` to force a re-fetch after a known mutation.
//
// Local- org IDs (prefix `local-`) ALSO work — the snapshot returns zeros and
// the Prisma queries return empty arrays, so most rules do not fire. The
// `isLocalOrgId` helper is kept (imported) for any future gating that needs to
// distinguish local vs real orgs, but it no longer disables recommendations.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import { isLocalOrgId } from '@/lib/gstpilot-data/local-workspace';
import { fetchWithTimeout } from '@/lib/async';
import type {
  Recommendation,
  RecommendationPriority,
  RecommendationType,
} from '@/lib/recommendations/engine';

// Re-export the new types so existing import sites (`import type { Recommendation }
// from '@/hooks/useAIRecommendations'`) keep working without churn.
export type { Recommendation, RecommendationPriority, RecommendationType };

// ─── Hook return type ──────────────────────────────────────────────────────────

export interface UseAIRecommendationsResult {
  /** Sorted recommendations (critical → high → medium → low, then dueInDays). */
  recommendations: Recommendation[];
  /** True until the first fetch resolves. */
  loading: boolean;
  /** Error string from the fetch, or null. */
  error: string | null;
  /** Force a re-fetch (e.g. after recording a payment). */
  refresh: () => Promise<void>;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 60_000; // 60 seconds — matches snapshot cache TTL
const FETCH_TIMEOUT_MS = 30_000;

export function useAIRecommendations(): UseAIRecommendationsResult {
  const { organization } = useOrg();
  const orgId = organization?.id ?? null;

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const orgIdRef = useRef<string | null>(orgId);
  orgIdRef.current = orgId;
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const fetchRecommendations = useCallback(async () => {
    // Single-flight: skip if a previous fetch is still pending.
    if (inFlightRef.current) return;
    const currentOrgId = orgIdRef.current;
    if (!currentOrgId) {
      if (mountedRef.current) {
        setRecommendations([]);
        setLoading(false);
        setError(null);
      }
      return;
    }

    inFlightRef.current = true;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const url = `/api/recommendations?organizationId=${encodeURIComponent(currentOrgId)}`;
      const res = await fetchWithTimeout(url, {
        cache: 'no-store',
        signal: controller.signal,
        timeoutMs: FETCH_TIMEOUT_MS,
      });
      const data = (await res.json()) as {
        recommendations?: Recommendation[];
        error?: string;
      };
      if (mountedRef.current && !controller.signal.aborted) {
        setRecommendations(data.recommendations ?? []);
        setError(null);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof Error && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Failed to load recommendations.';
      if (mountedRef.current && !controller.signal.aborted) {
        setError(msg);
        // Degrade gracefully — keep showing the previous list rather than
        // flashing an empty state on transient network errors.
      }
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current && !controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  // ── Initial fetch + refetch when org changes or refresh() is called ──
  useEffect(() => {
    setLoading(true);
    void fetchRecommendations();
  }, [orgId, refreshTick, fetchRecommendations]);

  // ── Auto-refresh every 60s ──
  useEffect(() => {
    if (!orgId) return;
    const interval = setInterval(() => {
      void fetchRecommendations();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [orgId, fetchRecommendations]);

  // ── Refresh on window focus ──
  useEffect(() => {
    const handleFocus = () => {
      if (orgIdRef.current) void fetchRecommendations();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchRecommendations]);

  const refresh = useCallback(async (): Promise<void> => {
    setRefreshTick((t) => t + 1);
  }, []);

  // `isLocalOrgId` is intentionally retained (per task spec) — it documents
  // that local- workspace org IDs are supported by the recommendations API
  // (snapshot + Prisma queries return empty for them). We log it once per org
  // change so the dev console makes the local-vs-real distinction visible.
  useEffect(() => {
    if (orgId && isLocalOrgId(orgId)) {
      console.debug('[useAIRecommendations] local-workspace org — recommendations will be derived from Prisma data only (no Firestore).');
    }
  }, [orgId]);

  return {
    recommendations,
    loading,
    error,
    refresh,
  };
}
