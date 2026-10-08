// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Server-side SWR (stale-while-revalidate) cache for GET API routes
// ═══════════════════════════════════════════════════════════════════════════════
//
// A tiny in-memory TTL cache for GET API routes that are read-heavy but
// change infrequently (timeline, recommendations, banking dashboard, banking
// oracle). Cuts Prisma round-trips when the same org's data is requested
// multiple times within the TTL window (e.g. dashboard + child widget both
// firing, or rapid page switches back to the same view).
//
// Features:
//   • TTL-based freshness — cached values expire after `ttlMs`.
//   • In-flight deduplication — concurrent callers within the same TTL window
//     share the same in-flight Promise (prevents N parallel Prisma queries
//     when N components mount at the same time).
//   • `forceRefresh` bypass — pass `{ forceRefresh: true }` to skip the cache
//     and recompute (used after mutations that invalidate the cache).
//   • Per-org invalidation — `invalidateOrg(orgId)` clears all entries for
//     that org (call from mutation handlers when you know the data changed).
//
// This is a SERVER-SIDE cache only. It lives in the Next.js server process
// memory and is NOT shared across instances. For multi-instance deployments,
// upgrade to Redis. For the VEYRO sandbox (single Next.js process), this
// is sufficient and zero-config.
// ═══════════════════════════════════════════════════════════════════════════════

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface InflightEntry<T> {
  promise: Promise<T>;
  expiresAt: number;
}

// Per-route-name cache + in-flight maps. Keyed by `${orgId}:${extraKey}` so
// multiple orgs don't collide. We register each route's maps by name so
// `invalidateOrg(orgId)` can clear them all at once.
const ROUTE_CACHES = new Map<string, Map<string, CacheEntry<unknown>>>();
const ROUTE_INFLIGHT = new Map<string, Map<string, InflightEntry<unknown>>>();

function getRouteCache(name: string): Map<string, CacheEntry<unknown>> {
  let m = ROUTE_CACHES.get(name);
  if (!m) {
    m = new Map();
    ROUTE_CACHES.set(name, m);
  }
  return m;
}

function getRouteInflight(name: string): Map<string, InflightEntry<unknown>> {
  let m = ROUTE_INFLIGHT.get(name);
  if (!m) {
    m = new Map();
    ROUTE_INFLIGHT.set(name, m);
  }
  return m;
}

/**
 * Get a cached value or compute & store it. Concurrent callers within the same
 * TTL window share the same in-flight Promise (deduplication).
 *
 * @param routeName  Cache namespace (use the API route path, e.g. '/api/timeline').
 * @param key        Cache key (typically the orgId, optionally suffixed with extra params).
 * @param ttlMs      Freshness window in milliseconds.
 * @param compute    Function that computes the value if the cache is cold/expired.
 * @param opts.forceRefresh  If true, bypass the cache and recompute.
 */
export async function swrCache<T>(
  routeName: string,
  key: string,
  ttlMs: number,
  compute: () => Promise<T>,
  opts: { forceRefresh?: boolean } = {},
): Promise<T> {
  const cache = getRouteCache(routeName);
  const inflight = getRouteInflight(routeName);
  const now = Date.now();

  // 1. Fresh cache hit → return immediately.
  if (!opts.forceRefresh) {
    const cached = cache.get(key) as CacheEntry<T> | undefined;
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }
  }

  // 2. In-flight deduplication — if another caller is already computing this
  //    exact value (same key, same TTL window), share its Promise.
  if (!opts.forceRefresh) {
    const existing = inflight.get(key) as InflightEntry<T> | undefined;
    if (existing && existing.expiresAt > now) {
      return existing.promise;
    }
  }

  // 3. Cold cache → kick off the compute, register it as in-flight so
  //    concurrent callers share the Promise.
  const expiresAt = now + ttlMs;
  const promise = (async () => {
    try {
      const value = await compute();
      cache.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    } finally {
      // Always clear the in-flight marker — whether the compute succeeded or
      // failed, a subsequent caller should be allowed to try again.
      inflight.delete(key);
    }
  })();
  inflight.set(key, { promise, expiresAt });
  return promise;
}

/**
 * Invalidate all cached entries for a given org across ALL routes. Call this
 * from mutation handlers (POST/PATCH/DELETE) that change data the GET routes
 * would otherwise serve stale.
 */
export function invalidateOrg(orgId: string): void {
  for (const cache of ROUTE_CACHES.values()) {
    for (const key of cache.keys()) {
      if (key.startsWith(`${orgId}:`) || key === orgId) {
        cache.delete(key);
      }
    }
  }
}

/**
 * Invalidate all cached entries for a specific route + org. Useful when a
 * mutation only affects one route's data.
 */
export function invalidateRoute(routeName: string, orgId: string): void {
  const cache = ROUTE_CACHES.get(routeName);
  if (!cache) return;
  for (const key of cache.keys()) {
    if (key.startsWith(`${orgId}:`) || key === orgId) {
      cache.delete(key);
    }
  }
}
