'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — useTimelineEvents() Hook
//
// Reads the most recent Business Timeline events from /api/timeline (which
// delegates to the canonical `BusinessEvent` Prisma table via
// `listTimelineEvents` in src/lib/timeline/emit.ts).
//
// Auto-refreshes every 30 seconds and on window focus. Also subscribes to the
// same global invalidation event bus as `useBusinessSnapshot` — so whenever
// ANY mutation happens (invoice created, payment recorded, Zoho sync, etc.),
// the timeline refetches immediately and the new event appears INSTANTLY.
//
// The returned events are normalized into the same shape the dashboard's
// existing Timeline widget consumed from Firestore activities
// ({ id, type, title, description, createdAt, ... }) — so swapping the data
// source required zero UI changes.
//
// Usage:
//   const { events, loading, error, refresh } = useTimelineEvents(20);
//   if (loading) return <Skeleton />;
//   return events.map(e => <TimelineRow key={e.id} event={e} />);
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import type { TimelineEvent } from '@/lib/timeline/emit';
import { onBusinessSnapshotInvalidated } from '@/lib/business-snapshot-events';

const REFRESH_INTERVAL_MS = 30_000; // 30 seconds

export interface UseTimelineEventsResult {
  events: TimelineEvent[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Fetch the most recent timeline events for the current organization.
 *
 * @param limit Max events to fetch (default 20). Passed to /api/timeline.
 */
export function useTimelineEvents(limit: number = 20): UseTimelineEventsResult {
  const { organization } = useOrg();
  const orgId = organization?.id ?? null;

  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const orgIdRef = useRef<string | null>(null);
  orgIdRef.current = orgId;
  const limitRef = useRef<number>(limit);
  limitRef.current = limit;

  const fetchEvents = useCallback(async () => {
    const currentOrgId = orgIdRef.current;
    const currentLimit = limitRef.current;
    if (!currentOrgId) {
      setEvents([]);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      const url = `/api/timeline?organizationId=${encodeURIComponent(currentOrgId)}&limit=${currentLimit}`;
      const res = await fetch(url, { cache: 'no-store' });

      // The route ALWAYS returns 200 (even for local- or missing orgs —
      // returns { events: [] } in those cases). Any non-200 is an actual
      // server error and we surface it via `error`.
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Request failed (${res.status})`);
      }

      const data = (await res.json()) as { events: TimelineEvent[] };
      setEvents(Array.isArray(data.events) ? data.events : []);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load timeline.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Initial fetch + refetch when org or limit changes ──
  useEffect(() => {
    setLoading(true);
    fetchEvents();
  }, [orgId, limit, refreshTick, fetchEvents]);

  // ── Auto-refresh every 30 seconds ──
  useEffect(() => {
    if (!orgId) return;
    const interval = setInterval(() => {
      fetchEvents();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [orgId, fetchEvents]);

  // ── Refresh on window focus ──
  useEffect(() => {
    const handleFocus = () => {
      if (orgIdRef.current) fetchEvents();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchEvents]);

  // ── INSTANT refresh on global mutation events ──
  // Reuses the same invalidation bus as `useBusinessSnapshot` — whenever any
  // mutation happens (invoice created, payment recorded, Zoho sync, etc.),
  // the mutation fires `invalidateBusinessSnapshot()` and this hook re-fetches
  // the timeline immediately so the new event appears without waiting 30s.
  // (Was dynamic-imported in a .then() — caused a microtask delay before the
  // listener attached. Now uses a static import for synchronous registration.)
  useEffect(() => {
    const handler = () => {
      if (orgIdRef.current) fetchEvents();
    };
    const cleanup = onBusinessSnapshotInvalidated(handler);
    return () => {
      cleanup();
    };
  }, [fetchEvents]);

  const refresh = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  return {
    events,
    loading,
    error,
    refresh,
  };
}
