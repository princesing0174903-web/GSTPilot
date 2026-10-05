/**
 * Reliability barrel — re-exports circuit-breaker, retry, fallback, offline-sync.
 * Also exposes `safeExecute` which composes circuit-breaker + retry + fallback.
 */

export {
  CircuitBreaker,
  getCircuitBreaker,
  getBreakerStats,
  getAllBreakerStats,
  type CircuitState,
  type CircuitBreakerOptions,
  type BreakerStats,
} from "./circuit-breaker";

export {
  retryWithBackoff,
  retryWithBreaker,
  withTimeout,
  isRetryableError,
  TimeoutError,
  type RetryOptions,
} from "./retry";

export {
  withFallback,
  gracefulNull,
  cachedFallback,
  clearCache,
  cacheSize,
} from "./fallback";

export {
  OfflineWriteQueue,
  offlineWriteQueue,
  type OfflineWriteOp,
  type OfflineWriteType,
  type FlushResult,
} from "./offline-sync";

import { getCircuitBreaker } from "./circuit-breaker";
import { retryWithBackoff, type RetryOptions } from "./retry";
import { withFallback } from "./fallback";

/** Options for `safeExecute`. */
export interface SafeExecuteOptions extends RetryOptions {
  /** Circuit-breaker name (e.g. "firestore", "ai-provider"). */
  breaker?: string;
  /** Optional fallback chain used when the breaker rejects or all retries fail. */
  fallbacks?: Array<() => Promise<unknown>>;
  /** If true and everything fails, return `null` instead of throwing. */
  gracefulNull?: boolean;
}

/**
 * `safeExecute` — compose circuit-breaker + retry + fallback into a single
 * high-level wrapper. Designed for cross-module use where the caller does not
 * want to wire each primitive individually.
 *
 * Behaviour:
 *   1. If `breaker` is set, the call runs under that breaker. If OPEN and a
 *      fallback chain is provided, the chain is invoked. If OPEN and no
 *      fallback, the call rejects (unless `gracefulNull` is set).
 *   2. Each invocation is wrapped by `retryWithBackoff` with the supplied
 *      `RetryOptions`.
 *   3. If all retries fail and a fallback chain is provided, the chain is
 *      invoked.
 *   4. If `gracefulNull` is true, a final failure returns `null` instead of
 *      throwing.
 *
 * @example
 *   const data = await safeExecute(
 *     "firestore",
 *     () => adminDb().collection("orgs").doc(id).get(),
 *     { maxAttempts: 4, gracefulNull: true },
 *   );
 */
export async function safeExecute<T>(
  name: string,
  fn: (attempt: number) => Promise<T>,
  opts: SafeExecuteOptions = {},
): Promise<T | null> {
  const breakerName = opts.breaker ?? name;
  const breaker = getCircuitBreaker(breakerName);

  const primary = (): Promise<T> => retryWithBackoff(fn, opts);

  try {
    if (opts.fallbacks && opts.fallbacks.length > 0) {
      const fb = opts.fallbacks as Array<() => Promise<T>>;
      return await breaker.execute(primary, async () => withFallback(primary, fb));
    }
    return await breaker.execute(primary);
  } catch (err) {
    if (opts.gracefulNull) {
       
      console.error(`[safeExecute:${name}] all sources failed, returning null:`, err);
      return null;
    }
    throw err;
  }
}
