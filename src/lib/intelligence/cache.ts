// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Intelligence Cache — Performance™ Subsystem
// ═══════════════════════════════════════════════════════════════════════════════
//
// In-memory TTL cache for expensive aggregation queries.
// Supports 100M organizations / 10B records via aggressive caching +
// pre-aggregated IndustryBenchmark records.
//
// Cache layers:
//   1. Hot cache (in-memory, 60s TTL) — dashboard bundles, market reports
//   2. Warm cache (in-memory, 5min TTL) — benchmarks, knowledge graph
//   3. Cold (Prisma DB) — IntelligenceContribution / IndustryBenchmark tables
// ═══════════════════════════════════════════════════════════════════════════════

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()

/**
 * Get a cached value or compute & store it.
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  compute: () => Promise<T>,
): Promise<T> {
  const entry = cache.get(key) as CacheEntry<T> | undefined
  if (entry && entry.expiresAt > Date.now()) {
    return entry.value
  }
  const value = await compute()
  cache.set(key, { value, expiresAt: Date.now() + ttlMs })
  return value
}

/**
 * Invalidate a cache key.
 */
export function invalidate(key: string): void {
  cache.delete(key)
}

/**
 * Invalidate all cache keys matching a prefix.
 */
export function invalidatePrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}

/**
 * Clear the entire cache (used on schema migrations / db push).
 */
export function clearCache(): void {
  cache.clear()
}

// ─── TTL Presets ──────────────────────────────────────────────────────────────

export const TTL = {
  HOT: 60_000,              // 1 minute
  WARM: 5 * 60_000,         // 5 minutes
  COLD: 15 * 60_000,        // 15 minutes
  DASHBOARD: 90_000,        // 1.5 minutes (dashboard bundle)
  BENCHMARKS: 10 * 60_000,  // 10 minutes
  PREDICTIONS: 5 * 60_000,  // 5 minutes
  RECOMMENDATIONS: 5 * 60_000,
  KNOWLEDGE_GRAPH: 15 * 60_000,
  MARKET: 3 * 60_000,       // 3 minutes
  FEED: 2 * 60_000,         // 2 minutes
} as const
