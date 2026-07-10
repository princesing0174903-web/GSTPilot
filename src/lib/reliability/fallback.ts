/**
 * Fallback primitives — graceful degradation when a primary call fails.
 *
 * - `withFallback` — try primary, then each fallback in order until one
 *   succeeds; throw the last error if all fail.
 * - `gracefulNull` — return `null` instead of throwing (for non-critical reads
 *   where a missing value is preferable to a 500).
 * - `cachedFallback` — tiny in-memory TTL cache wrapper so a failed read
 *   returns the last good value.
 */

/** A simple TTL cache entry. */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const ttlCache = new Map<string, CacheEntry<unknown>>();

/**
 * Try `primary`, then each fallback in order. Returns the first successful
 * result. If all reject, throws the last error.
 *
 * Fallbacks are invoked in sequence — none is invoked if the primary succeeds.
 */
export async function withFallback<T>(
  primary: () => Promise<T>,
  fallbacks: Array<() => Promise<T>>,
): Promise<T> {
  let lastError: unknown;
  try {
    return await primary();
  } catch (err) {
    lastError = err;
  }
  for (const fb of fallbacks) {
    try {
      return await fb();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`withFallback: all sources failed: ${String(lastError)}`);
}

/**
 * Wrap a non-critical read so it returns `null` instead of throwing. The error
 * is logged via `console.error` (caller can override with `onError`).
 */
export async function gracefulNull<T>(
  primary: () => Promise<T>,
  onError?: (err: unknown) => void,
): Promise<T | null> {
  try {
    return await primary();
  } catch (err) {
    if (onError) {
      try {
        onError(err);
      } catch {
        /* swallow observer errors */
      }
    } else {
       
      console.error("[gracefulNull] read failed:", err);
    }
    return null;
  }
}

/**
 * TTL-cached read wrapper. On a successful read the value is cached for
 * `cacheMs`; on a failed read the last good value (if still cached OR even
 * expired — we serve stale-on-error) is returned instead of throwing.
 *
 * If no cached value exists and the read fails, the error propagates.
 *
 * @param cacheKey  Stable key for the cache entry (process-wide).
 * @param read      Async producer.
 * @param cacheMs   TTL in milliseconds.
 */
export async function cachedFallback<T>(
  cacheKey: string,
  read: () => Promise<T>,
  cacheMs: number,
): Promise<T> {
  const now = Date.now();
  const existing = ttlCache.get(cacheKey) as CacheEntry<T> | undefined;

  // Fresh cache hit.
  if (existing && existing.expiresAt > now) {
    return existing.value;
  }

  try {
    const value = await read();
    ttlCache.set(cacheKey, { value, expiresAt: now + cacheMs });
    return value;
  } catch (err) {
    // Stale-on-error: serve the previous value if we have one.
    if (existing) {
       
      console.warn(`[cachedFallback] serving stale value for "${cacheKey}" after error:`, err);
      return existing.value;
    }
    throw err;
  }
}

/** Clear one cache entry, or the whole cache if no key is provided. */
export function clearCache(cacheKey?: string): void {
  if (cacheKey === undefined) {
    ttlCache.clear();
  } else {
    ttlCache.delete(cacheKey);
  }
}

/** Test helper: peek at the cache size. */
export function cacheSize(): number {
  return ttlCache.size;
}
