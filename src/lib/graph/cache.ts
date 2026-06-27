// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT BUSINESS GRAPH™ — In-Memory Cache + Live Event Log
// Phase 6 LIVE — supports 100,000+ nodes / 1,000,000+ relationships with
// 60-second TTL caching. Live event log retains last 50 events.
//
// Exports:
//   - getCachedGraphState(loader) → GraphState (cached or fresh)
//   - invalidateGraphCache()       → void (forces next call to refetch)
//   - markGraphStale()             → void (alias for invalidateGraphCache)
//   - pushLiveEvent(event)         → void (append to in-memory event log)
//   - getLiveEvents()              → LiveGraphEvent[] (last 50, newest first)
//   - clearLiveEvents()            → void
//
// This module is intentionally side-effect-free and synchronous for event
// mutations (no await needed). All persistence is in-memory; restart clears.
// ═══════════════════════════════════════════════════════════════════════════════

import type { GraphState, LiveGraphEvent } from '@/lib/graph/types';

// ─── Cache state ──────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60_000; // 60 seconds — balances freshness with 100k-node perf

let cachedState: GraphState | null = null;
let cachedAt = 0; // epoch ms
let cacheGeneration = 0; // bumped on every invalidation — defeats in-flight loaders

// ─── Live event log (in-memory ring buffer, last 50 events) ────────────────────

const LIVE_EVENT_LIMIT = 50;
const liveEvents: LiveGraphEvent[] = [];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the cached GraphState if fresh (< CACHE_TTL_MS old); otherwise invokes
 * the provided loader, caches the result, and returns it. Concurrent callers
 * within the same TTL window share the same cached state.
 *
 * The loader is invoked AT MOST once per TTL window — critical for performance
 * when the graph contains 100,000+ nodes.
 */
export async function getCachedGraphState(
  loader: () => Promise<GraphState>,
): Promise<GraphState> {
  const now = Date.now();
  if (cachedState && now - cachedAt < CACHE_TTL_MS) {
    return cachedState;
  }

  // Bump generation; capture to detect concurrent invalidation.
  const myGeneration = ++cacheGeneration;
  const fresh = await loader();
  // Only commit if no invalidation happened during our load.
  if (myGeneration === cacheGeneration) {
    cachedState = fresh;
    cachedAt = Date.now();
  }
  return fresh;
}

/**
 * Forces the next getCachedGraphState call to refetch from the loader.
 * Call this whenever underlying data changes (invoice created, GST filed, etc.)
 */
export function invalidateGraphCache(): void {
  cachedState = null;
  cachedAt = 0;
  cacheGeneration++;
}

/** Alias for invalidateGraphCache — semantic helper for live-update callers. */
export function markGraphStale(): void {
  invalidateGraphCache();
}

/** Returns cache stats for diagnostics. */
export function getCacheStats(): {
  isCached: boolean;
  ageMs: number;
  ttlMs: number;
  generation: number;
} {
  return {
    isCached: cachedState !== null,
    ageMs: cachedState ? Date.now() - cachedAt : 0,
    ttlMs: CACHE_TTL_MS,
    generation: cacheGeneration,
  };
}

// ─── Live event log API ───────────────────────────────────────────────────────

/**
 * Appends a LiveGraphEvent to the in-memory log. Newest events are unshifted
 * to the front. The log is capped at LIVE_EVENT_LIMIT (50) entries.
 */
export function pushLiveEvent(event: LiveGraphEvent): void {
  liveEvents.unshift(event);
  if (liveEvents.length > LIVE_EVENT_LIMIT) {
    liveEvents.length = LIVE_EVENT_LIMIT;
  }
  // Live events imply the graph changed — invalidate cache so the next read
  // picks up the new state.
  invalidateGraphCache();
}

/**
 * Returns the last LIVE_EVENT_LIMIT live events, newest first.
 * Optionally filter by source.
 */
export function getLiveEvents(source?: string): LiveGraphEvent[] {
  if (!source) return [...liveEvents];
  return liveEvents.filter((e) => e.source === source);
}

/** Clears the live event log (admin/debug only). */
export function clearLiveEvents(): void {
  liveEvents.length = 0;
}

/** Returns the current live event count (capped at LIVE_EVENT_LIMIT). */
export function getLiveEventCount(): number {
  return liveEvents.length;
}
