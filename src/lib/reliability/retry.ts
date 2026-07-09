/**
 * Retry + timeout primitives for transient-failure handling.
 *
 * - `retryWithBackoff` — exponential backoff with full jitter, optional
 *   per-attempt predicate and a wall-clock timeout.
 * - `withTimeout` — race a promise against a timeout using AbortController
 *   when the target accepts a signal, otherwise Promise.race.
 * - `isRetryableError` — heuristic classifier for transient network / 5xx /
 *   Firebase-UNAVAILABLE errors.
 */

import { getCircuitBreaker } from "./circuit-breaker";

/** Options for `retryWithBackoff`. */
export interface RetryOptions {
  /** Maximum attempts including the first. Default 5. */
  maxAttempts?: number;
  /** Delay before the 2nd attempt. Default 200 ms. */
  initialDelayMs?: number;
  /** Hard cap on a single delay. Default 10_000 ms. */
  maxDelayMs?: number;
  /** Backoff multiplier between attempts. Default 2. */
  multiplier?: number;
  /** If true (default), apply full jitter (random between 0 and computed delay). */
  jitter?: boolean;
  /**
   * Predicate: return true to retry this error, false to rethrow immediately.
   * Defaults to `isRetryableError`.
   */
  shouldRetry?: (err: unknown, attempt: number) => boolean;
  /** Optional callback fired before each retry (useful for logging / metrics). */
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
  /** Optional wall-clock timeout for the whole operation. */
  timeoutMs?: number;
}

/** Thrown by `withTimeout` when the deadline elapses. */
export class TimeoutError extends Error {
  readonly code = "TIMEOUT";
  constructor(msg = "operation timed out") {
    super(msg);
    this.name = "TimeoutError";
  }
}

/**
 * Retry `fn` with exponential backoff. `fn` receives the 1-based attempt number
 * so it can adapt its behavior (e.g. refresh tokens on attempt 2+).
 *
 * The function is awaited; if it rejects and the predicate allows, we wait
 * `delay(attempt)` ms (with jitter) and try again. After `maxAttempts` we
 * rethrow the last error.
 */
export async function retryWithBackoff<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 5;
  const initialDelayMs = opts.initialDelayMs ?? 200;
  const maxDelayMs = opts.maxDelayMs ?? 10_000;
  const multiplier = opts.multiplier ?? 2;
  const jitter = opts.jitter ?? true;
  const shouldRetry = opts.shouldRetry ?? isRetryableError;

  let attempt = 1;
  // Optional overall timeout via Promise.race — we resolve a sentinel.
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const start = Date.now();
  const timeoutMs = opts.timeoutMs;

   
  while (true) {
    try {
      if (timeoutMs !== undefined) {
        const elapsed = Date.now() - start;
        if (elapsed >= timeoutMs) {
          throw new TimeoutError(`retryWithBackoff: deadline exceeded (${timeoutMs} ms)`);
        }
      }
      // The caller's fn may or may not honour an abort signal; we expose a
      // deadline via a child promise so the timeout can fire.
      if (timeoutMs !== undefined) {
        const remaining = timeoutMs - (Date.now() - start);
        const result = await Promise.race<T>([
          Promise.resolve().then(() => fn(attempt)),
          new Promise<T>((_, reject) => {
            timeoutId = setTimeout(
              () => reject(new TimeoutError(`retryWithBackoff: timeout after ${remaining} ms`)),
              Math.max(0, remaining),
            );
          }),
        ]);
        if (timeoutId) clearTimeout(timeoutId);
        return result;
      }
      return await fn(attempt);
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);

      if (attempt >= maxAttempts) {
        throw err;
      }
      if (!shouldRetry(err, attempt)) {
        throw err;
      }

      const raw = initialDelayMs * Math.pow(multiplier, attempt - 1);
      const capped = Math.min(raw, maxDelayMs);
      const delay = jitter ? Math.floor(Math.random() * capped) : capped;

      if (opts.onRetry) {
        try {
          opts.onRetry(err, attempt, delay);
        } catch {
          /* swallow observer errors */
        }
      }
      await sleep(delay);
      attempt++;
    }
  }
}

/**
 * Race `fn` against a timeout. If `fn` is a function, it is invoked with an
 * `AbortSignal` (the function may ignore it; we still race the result). If
 * `fn` is a promise, we race it directly (cannot abort).
 */
export async function withTimeout<T>(
  fn: Promise<T> | (() => Promise<T>),
  timeoutMs: number,
  msg?: string,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const target: Promise<T> =
    typeof fn === "function"
      ? (fn as (signal: AbortSignal) => Promise<T>)(controller.signal)
      : fn;

  try {
    return await Promise.race<T>([
      target,
      new Promise<T>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(new TimeoutError(msg ?? `operation timed out after ${timeoutMs} ms`));
        });
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Heuristic: is this error likely to be transient and worth retrying?
 *
 * Returns `true` for:
 *   - Node `errno` codes: ECONNRESET, ETIMEDOUT, ECONNREFUSED, EPIPE,
 *     ENOTFOUND, EAI_AGAIN, UND_ERR_SOCKET, UND_ERR_CONNECT_TIMEOUT.
 *   - HTTP 429 and 5xx responses (detected via `.status` / `.statusCode` /
 *     `.response.status`).
 *   - Firebase error strings: UNAVAILABLE, DEADLINE_EXCEEDED, INTERNAL,
 *     RESOURCE_EXHAUSTED, ABORTED.
 *   - Fetch `network error` messages.
 *   - Errors explicitly tagged `retryable: true` by the caller.
 */
export function isRetryableError(err: unknown): boolean {
  if (!err) return false;

  // Explicit opt-in.
  if (typeof err === "object" && err !== null && (err as { retryable?: boolean }).retryable === true) {
    return true;
  }

  // Node errno / code.
  const code = (err as { code?: string | number }).code;
  if (typeof code === "string") {
    const upper = code.toUpperCase();
    if (
      upper === "ECONNRESET" ||
      upper === "ETIMEDOUT" ||
      upper === "ECONNREFUSED" ||
      upper === "EPIPE" ||
      upper === "ENOTFOUND" ||
      upper === "EAI_AGAIN" ||
      upper === "UND_ERR_SOCKET" ||
      upper === "UND_ERR_CONNECT_TIMEOUT" ||
      upper === "EAGAIN"
    ) {
      return true;
    }
    // Firebase / gRPC codes (string form).
    if (
      upper === "UNAVAILABLE" ||
      upper === "DEADLINE_EXCEEDED" ||
      upper === "INTERNAL" ||
      upper === "RESOURCE_EXHAUSTED" ||
      upper === "ABORTED"
    ) {
      return true;
    }
  }

  // HTTP status codes.
  const status =
    (err as { status?: number; statusCode?: number; response?: { status?: number } }).status ??
    (err as { statusCode?: number }).statusCode ??
    (err as { response?: { status?: number } }).response?.status;
  if (typeof status === "number") {
    if (status === 429 || (status >= 500 && status < 600)) return true;
  }

  // Message string heuristic.
  const msg =
    typeof err === "string" ? err : (err as { message?: string }).message ?? "";
  const lower = msg.toLowerCase();
  if (
    lower.includes("unavailable") ||
    lower.includes("deadline_exceeded") ||
    lower.includes("deadline exceeded") ||
    lower.includes("resource_exhausted") ||
    lower.includes("network error") ||
    lower.includes("network request failed") ||
    lower.includes("connection reset") ||
    lower.includes("socket hang up") ||
    lower.includes("timeout") ||
    lower.includes("temporarily unavailable") ||
    lower.includes("rate limit") ||
    lower.includes("rate-limit") ||
    lower.includes("too many requests")
  ) {
    return true;
  }

  return false;
}

/** Internal sleep helper. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convenience: retry with circuit-breaker protection. The breaker is consulted
 * BEFORE the call; if OPEN we either invoke `fallback` or throw. Each attempt
 * is wrapped by the retry policy. Useful for high-level orchestration.
 */
export async function retryWithBreaker<T>(
  breakerName: string,
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions & { fallback?: () => Promise<T> } = {},
): Promise<T> {
  const breaker = getCircuitBreaker(breakerName);
  return breaker.execute(
    () => retryWithBackoff(fn, opts),
    opts.fallback,
  );
}
