// ═══════════════════════════════════════════════════════════════════════════════
// withTimeout — race any Promise against a hard deadline
// ═══════════════════════════════════════════════════════════════════════════════
//
// WHY THIS EXISTS
//
// Firebase's Firestore SDK has internal retry logic that can hang for MINUTES
// or even HOURS on network issues, offline mode, or permission errors that
// trigger its exponential-backoff retry storm. The SDK has no hard timeout —
// `addDoc()`, `getDoc()`, `setDoc()`, `onSnapshot()` will all happily retry
// forever in a restricted sandbox environment.
//
// This utility provides a hard deadline. If the wrapped promise doesn't
// resolve (resolve OR reject) within `ms`, we reject with a TimeoutError so
// the caller can fall back gracefully (e.g. to a local workspace) instead of
// leaving the user on "Preparing your dashboard…" for hours.
//
// USAGE
//
//   import { withTimeout } from '@/lib/async/withTimeout';
//
//   try {
//     const result = await withTimeout(
//       createOrganization({ name: 'Acme', ownerId: uid, ... }),
//       6_000,
//       'createOrganization'
//     );
//   } catch (err) {
//     if (err instanceof TimeoutError) {
//       // Fall back to local workspace — Firestore is unreachable.
//     }
//     throw err;
//   }
//
// The third argument (operation name) is included in the error message so
// logs clearly identify WHICH Firestore operation timed out.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Error thrown when a `withTimeout`-wrapped promise exceeds its deadline.
 * Callers can distinguish a timeout from a genuine rejection via `instanceof`.
 */
export class TimeoutError extends Error {
  readonly isTimeout = true;
  readonly operation: string;
  readonly ms: number;

  constructor(operation: string, ms: number) {
    super(`[timeout] "${operation}" did not resolve within ${ms}ms`);
    this.name = 'TimeoutError';
    this.operation = operation;
    this.ms = ms;
    // Restore prototype chain (compiled-down ES5 target loses it otherwise).
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Type guard — true if `err` is a `TimeoutError` from `withTimeout`.
 */
export function isTimeoutError(err: unknown): err is TimeoutError {
  return (
    err instanceof Error &&
    (err as TimeoutError).isTimeout === true &&
    typeof (err as TimeoutError).operation === 'string'
  );
}

/**
 * Race `promise` against a hard `ms`-millisecond deadline.
 *
 * - If `promise` resolves/rejects first → that result wins (timeout is cancelled).
 * - If the deadline fires first → rejects with a `TimeoutError`.
 *
 * The timeout timer is cleared on resolution/rejection so it doesn't keep the
 * Node.js event loop alive unnecessarily.
 *
 * `operation` is a short human-readable label (e.g. "createOrganization")
 * included in the error message for debuggability.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  operation = 'operation',
): Promise<T> {
  // A deferred rejection we can cancel — avoids a dangling timer that keeps
  // the event loop alive after the wrapped promise resolves.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(operation, ms));
    }, ms);
  });

  // `Promise.race` settles as soon as EITHER settles. We then clear the timer
  // so the losing branch doesn't leak. If the wrapped promise rejects, that
  // rejection propagates (we don't swallow it — only the TIMEOUT produces a
  // TimeoutError).
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}
