'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — useAIRecommendations() Hook
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

// ── Module-level request deduplication ─────────────────────────────────────
// Multiple components (DashboardPage + OracleDailyBrief) mount this hook
// concurrently. Without dedup, each instance fires its own fetch → duplicate
// /api/recommendations calls on every dashboard mount (confirmed in dev.log:
// pairs of identical requests within ~10ms of each other). Mirrors the
// `useBusinessSnapshot` pattern: concurrent callers share the same in-flight
// promise; second instance hydrates instantly from the module-level cache.
interface CacheEntry {
  promise: Promise<Recommendation[]>;
  timestamp: number;
}
const inflightCache = new Map<string, CacheEntry>();
const latestRecommendations = new Map<string, Recommendation[]>();

export function useAIRecommendations(): UseAIRecommendationsResult {
  const { organization } = useOrg();
  const orgId = organization?.id ?? null;

  const [recommendations, setRecommendations] = useState<Recommendation[]>(() => {
    // Hydrate from module-level cache so a second instance (e.g.
    // OracleDailyBrief) shows data instantly without a duplicate fetch.
    if (orgId && latestRecommendations.has(orgId)) {
      return latestRecommendations.get(orgId)!;
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    // If we have cached data, don't show a loading state.
    if (orgId && latestRecommendations.has(orgId)) return false;
    return true;
  });
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
    // Per-instance single-flight: skip if a previous fetch is still pending
    // on THIS hook instance (e.g. rapid refresh clicks).
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

    // ── Module-level deduplication ──
    // If a fetch for this org is already in-flight (e.g. another component
    // mounted this hook), share its promise instead of firing a second request.
    const existing = inflightCache.get(currentOrgId);
    let promise: Promise<Recommendation[]>;
    if (existing && Date.now() - existing.timestamp < FETCH_TIMEOUT_MS) {
      promise = existing.promise;
    } else {
      const url = `/api/recommendations?organizationId=${encodeURIComponent(currentOrgId)}`;
      promise = (async () => {
        const res = await fetchWithTimeout(url, {
          cache: 'no-store',
          timeoutMs: FETCH_TIMEOUT_MS,
        });
        const data = (await res.json()) as {
          recommendations?: Recommendation[];
          error?: string;
        };
        const recs = data.recommendations ?? [];
        latestRecommendations.set(currentOrgId, recs);
        return recs;
      })();
      inflightCache.set(currentOrgId, { promise, timestamp: Date.now() });
      promise.finally(() => inflightCache.delete(currentOrgId));
    }

    inFlightRef.current = true;
    if (abortRef.current) abortRef.current.abort();
    // Note: we don't pass our own AbortController to fetchWithTimeout here
    // because the promise is shared across hook instances — aborting one
    // instance's request would abort it for all. The shared fetch relies on
    // the 30s timeout inside fetchWithTimeout for cancellation.

    try {
      const recs = await promise;
      if (mountedRef.current) {
        setRecommendations(recs);
        setError(null);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof Error && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Failed to load recommendations.';
      if (mountedRef.current) {
        setError(msg);
        // Degrade gracefully — keep showing the previous list rather than
        // flashing an empty state on transient network errors.
      }
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // ── Initial fetch + refetch when org changes or refresh() is called ──
  // Only show loading state if we don't have cached data — avoids a brief
  // loading flicker when a second hook instance (e.g. OracleDailyBrief)
  // mounts and hydrates from the module-level cache.
  useEffect(() => {
    if (mountedRef.current && !latestRecommendations.has(orgId ?? '')) {
      setLoading(true);
    }
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
