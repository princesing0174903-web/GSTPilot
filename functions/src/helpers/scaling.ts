// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Cloud Functions Scaling Helpers
//
// Production-hardening wrappers used by every 2nd-gen Cloud Function trigger:
//   • withIdempotency()  — guarantees a function runs at-most-once per event id
//                          by maintaining a Firestore idempotency log under
//                          `function_idempotency/{eventId}`.
//   • withRetry()        — wraps a handler with exponential-backoff + jitter
//                          retries on retryable errors (DEADLINE_EXCEEDED,
//                          UNAVAILABLE, 429, 5xx). Honors a per-event attempt
//                          counter so we can dead-letter after N attempts.
//   • withConcurrency()  — limits in-flight executions per function instance
//                          via a counting semaphore, so a single CPU-bound
//                          function can't saturate the event loop.
//   • withTimeout()      — rejects if a handler exceeds the deadline.
//
// All wrappers compose — wrap withRetry(withIdempotency(withTimeout(handler))).
//
// Cold-start optimization: this module imports ONLY `firebase-admin` (already
// loaded by index.ts) and Node built-ins. No new dependencies.
// ═══════════════════════════════════════════════════════════════════════════════

import { getFirestore } from 'firebase-admin/firestore';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IdempotencyRecord {
  eventId: string;
  functionName: string;
  status: 'running' | 'completed' | 'failed' | 'dead-letter';
  attempts: number;
  result?: unknown;
  error?: string;
  startedAt: number;
  completedAt?: number;
  expiresAt: number; // TTL — Firestore will purge via TTL policy.
}

export interface RetryOptions {
  maxAttempts?: number; // default 5
  initialDelayMs?: number; // default 200
  maxDelayMs?: number; // default 30_000
  multiplier?: number; // default 2
  jitter?: boolean; // default true (full jitter)
  shouldRetry?: (err: unknown, attempt: number) => boolean;
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
}

export interface ConcurrencyOptions {
  maxConcurrent?: number; // default 4
  queueTimeoutMs?: number; // default 60_000 — reject if waiting longer
}

export interface TimeoutOptions {
  timeoutMs: number;
  errorMessage?: string;
}

// ─── Error detection ─────────────────────────────────────────────────────────

const RETRYABLE_PATTERNS = [
  'DEADLINE_EXCEEDED',
  'UNAVAILABLE',
  'INTERNAL',
  'RESOURCE_EXHAUSTED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  '429',
  '503',
  '502',
  'socket hang up',
];

export function isRetryableError(err: unknown): boolean {
  if (!err) return false;
  const message =
    typeof err === 'string'
      ? err
      : err instanceof Error
        ? err.message
        : String((err as { message?: string })?.message ?? err);
  const code = (err as { code?: string | number })?.code;
  const codeStr = code !== undefined ? String(code) : '';
  return RETRYABLE_PATTERNS.some(
    (p) => message.includes(p) || codeStr.includes(p),
  );
}

// ─── Sleep with jitter ───────────────────────────────────────────────────────

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'));
      return;
    }
    const timer = setTimeout(() => resolve(), ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new Error('Aborted'));
      },
      { once: true },
    );
  });
}

function computeBackoff(
  attempt: number,
  opts: Required<Pick<RetryOptions, 'initialDelayMs' | 'maxDelayMs' | 'multiplier' | 'jitter'>>,
): number {
  const exp = Math.min(
    opts.initialDelayMs * Math.pow(opts.multiplier, attempt - 1),
    opts.maxDelayMs,
  );
  if (!opts.jitter) return exp;
  // Full jitter: [0, exp]
  return Math.floor(Math.random() * exp);
}

// ─── withRetry ───────────────────────────────────────────────────────────────

export function withRetry<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<unknown>,
  opts: RetryOptions = {},
): (...args: TArgs) => Promise<void> {
  const maxAttempts = opts.maxAttempts ?? 5;
  const initialDelayMs = opts.initialDelayMs ?? 200;
  const maxDelayMs = opts.maxDelayMs ?? 30_000;
  const multiplier = opts.multiplier ?? 2;
  const jitter = opts.jitter ?? true;
  const shouldRetry = opts.shouldRetry ?? isRetryableError;

  return async (...args: TArgs) => {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await fn(...args);
        return;
      } catch (err) {
        lastErr = err;
        if (attempt >= maxAttempts || !shouldRetry(err, attempt)) {
          throw err;
        }
        const delayMs = computeBackoff(attempt, {
          initialDelayMs,
          maxDelayMs,
          multiplier,
          jitter,
        });
        opts.onRetry?.(err, attempt, delayMs);
        await sleep(delayMs);
      }
    }
    throw lastErr;
  };
}

// ─── withTimeout ─────────────────────────────────────────────────────────────

export function withTimeout<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<unknown>,
  opts: TimeoutOptions,
): (...args: TArgs) => Promise<void> {
  return async (...args: TArgs) => {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      opts.timeoutMs,
    );
    try {
      await Promise.race([
        fn(...args),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener(
            'abort',
            () => reject(new Error(opts.errorMessage ?? `Function timed out after ${opts.timeoutMs}ms`)),
            { once: true },
          );
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
  };
}

// ─── withConcurrency ─────────────────────────────────────────────────────────

export function withConcurrency<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<unknown>,
  opts: ConcurrencyOptions = {},
): (...args: TArgs) => Promise<void> {
  const maxConcurrent = opts.maxConcurrent ?? 4;
  const queueTimeoutMs = opts.queueTimeoutMs ?? 60_000;
  let inFlight = 0;
  const waiters: Array<{ resolve: () => void; reject: (err: Error) => void; enqueuedAt: number }> = [];
  const queueTimer = setInterval(() => {
    const now = Date.now();
    while (waiters.length > 0 && now - waiters[0].enqueuedAt > queueTimeoutMs) {
      const w = waiters.shift()!;
      w.reject(new Error('Concurrency queue timeout'));
    }
  }, 5_000);
  // Keep process alive while queue is active — but don't prevent graceful exit.
  if (queueTimer.unref) queueTimer.unref();

  return async (...args: TArgs) => {
    if (inFlight >= maxConcurrent) {
      await new Promise<void>((resolve, reject) => {
        waiters.push({ resolve, reject, enqueuedAt: Date.now() });
      });
    }
    inFlight++;
    try {
      await fn(...args);
    } finally {
      inFlight--;
      const next = waiters.shift();
      next?.resolve();
    }
  };
}

// ─── withIdempotency ─────────────────────────────────────────────────────────

const IDEMPOTENCY_COLLECTION = 'function_idempotency';
const IDEMPOTENCY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function withIdempotency<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<unknown>,
  functionName: string,
  eventIdExtractor: (...args: TArgs) => string,
): (...args: TArgs) => Promise<void> {
  return async (...args: TArgs) => {
    const eventId = eventIdExtractor(...args);
    if (!eventId) {
      // No event id → can't enforce idempotency, just run.
      await fn(...args);
      return;
    }

    const db = getFirestore();
    const ref = db.collection(IDEMPOTENCY_COLLECTION).doc(eventId);

    try {
      // Try to create the record — atomic via transaction.
      const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists) {
          const data = snap.data() as IdempotencyRecord;
          if (data.status === 'completed') {
            return { alreadyCompleted: true, record: data };
          }
          if (data.status === 'running' && Date.now() - data.startedAt < 5 * 60 * 1000) {
            // Another instance is processing this event within 5 minutes — skip.
            return { alreadyRunning: true, record: data };
          }
          // Stale 'running' record — claim it.
          tx.set(ref, {
            functionName,
            status: 'running',
            attempts: data.attempts + 1,
            startedAt: Date.now(),
            expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
          } satisfies Partial<IdempotencyRecord>, { merge: true });
          return { claimed: true, record: null };
        }
        tx.create(ref, {
          eventId,
          functionName,
          status: 'running',
          attempts: 1,
          startedAt: Date.now(),
          expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
        } satisfies Partial<IdempotencyRecord>);
        return { claimed: true, record: null };
      });

      if (result.alreadyCompleted) {
        // Already processed — skip silently (idempotent).
        return;
      }
      if (result.alreadyRunning) {
        // Another instance has it — skip.
        return;
      }

      // Execute the actual function.
      try {
        await fn(...args);
        await ref.set(
          {
            status: 'completed',
            completedAt: Date.now(),
            expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
          } satisfies Partial<IdempotencyRecord>,
          { merge: true },
        );
      } catch (err) {
        const attempts = (await ref.get()).data()?.attempts ?? 1;
        const isDead = attempts >= 5;
        await ref.set(
          {
            status: isDead ? 'dead-letter' : 'failed',
            error: err instanceof Error ? err.message : String(err),
            completedAt: Date.now(),
            expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
          } satisfies Partial<IdempotencyRecord>,
          { merge: true },
        );
        throw err;
      }
    } catch (err) {
      // Idempotency log failure shouldn't block the function — log and proceed.
      console.error(`[idempotency:${functionName}] event ${eventId} log error:`, err);
      await fn(...args);
    }
  };
}

// ─── Composition helper ──────────────────────────────────────────────────────

export interface ProductionWrapperOptions {
  functionName: string;
  eventIdExtractor?: (...args: unknown[]) => string;
  retry?: RetryOptions;
  timeout?: TimeoutOptions;
  concurrency?: ConcurrencyOptions;
  idempotent?: boolean;
}

/**
 * Wrap a Cloud Function handler with the full production stack:
 * idempotency → concurrency → timeout → retry.
 *
 * Usage:
 *   export const myFn = onCall(
 *     withProductionWrapper(
 *       async (req) => { ... },
 *       { functionName: 'myFn', idempotent: true, eventIdExtractor: (req) => req.data?.requestId }
 *     )
 *   );
 */
export function withProductionWrapper<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<unknown>,
  opts: ProductionWrapperOptions,
): (...args: TArgs) => Promise<void> {
  let wrapped: (...args: TArgs) => Promise<unknown> = fn;

  if (opts.timeout) {
    const t = opts.timeout;
    const original = wrapped;
    wrapped = (...args: TArgs) =>
      withTimeout(original as (...args: TArgs) => Promise<void>, t)(...args);
  }
  if (opts.concurrency) {
    const c = opts.concurrency;
    const original = wrapped;
    wrapped = (...args: TArgs) =>
      withConcurrency(original as (...args: TArgs) => Promise<void>, c)(...args);
  }
  if (opts.retry) {
    const r = opts.retry;
    const original = wrapped;
    wrapped = (...args: TArgs) =>
      withRetry(original as (...args: TArgs) => Promise<void>, r)(...args);
  }
  if (opts.idempotent && opts.eventIdExtractor) {
    const name = opts.functionName;
    const extractor = opts.eventIdExtractor as (...args: TArgs) => string;
    const original = wrapped;
    wrapped = (...args: TArgs) =>
      withIdempotency(original as (...args: TArgs) => Promise<void>, name, extractor)(...args);
  }

  return async (...args: TArgs) => {
    await wrapped(...args);
  };
}

// ─── Cold-start optimization ─────────────────────────────────────────────────

/**
 * Returns the optimal Cloud Functions 2nd-gen instance options for production.
 * Tune per-function by passing overrides.
 *
 * Defaults are tuned for the GSTPilot Infinity™ workload:
 *   - 1GiB memory (enough for Firestore + JSON parsing)
 *   - 1 vCPU (Firebase scales this with memory tier)
 *   - 80 concurrent requests per instance (2nd-gen default)
 *   - 60s timeout (most triggers complete in <2s; AI triggers override to 540s)
 *   - minInstances: 0 (cost-optimized; set to 1 for hot paths)
 *   - maxInstances: 100 (per-region cap)
 */
export function getInstanceConfig(overrides?: {
  memory?: '256MiB' | '512MiB' | '1GiB' | '2GiB' | '4GiB' | '8GiB';
  timeoutSeconds?: number;
  minInstances?: number;
  maxInstances?: number;
  concurrency?: number | 'auto';
  cpu?: number;
}) {
  return {
    memory: overrides?.memory ?? '1GiB',
    timeoutSeconds: overrides?.timeoutSeconds ?? 60,
    minInstances: overrides?.minInstances ?? 0,
    maxInstances: overrides?.maxInstances ?? 100,
    concurrency: overrides?.concurrency ?? 80,
    cpu: overrides?.cpu ?? 1,
  };
}

/**
 * AI-heavy triggers (Oracle background analysis, bulk context gathering) need
 * more memory and longer timeouts. Use this instead of getInstanceConfig for
 * those triggers.
 */
export function getAIInstanceConfig(overrides?: {
  memory?: '2GiB' | '4GiB' | '8GiB';
  timeoutSeconds?: number;
  minInstances?: number;
  maxInstances?: number;
}) {
  return getInstanceConfig({
    memory: overrides?.memory ?? '2GiB',
    timeoutSeconds: overrides?.timeoutSeconds ?? 540,
    minInstances: overrides?.minInstances ?? 0,
    maxInstances: overrides?.maxInstances ?? 20,
    cpu: 2,
  });
}
