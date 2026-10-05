/**
 * CircuitBreaker — production reliability primitive.
 *
 * Three states:
 *   - CLOSED:    requests flow through; failures tracked in a rolling window.
 *   - OPEN:      requests are rejected immediately; a fallback (if provided) is
 *                 invoked instead. After `resetTimeoutMs` we transition to HALF_OPEN.
 *   - HALF_OPEN: a limited number of probe calls are allowed through; if enough
 *                 succeed the breaker CLOSES, if any fail it re-OPENS.
 *
 * In-memory state only (no DB). Singletons are returned by `getCircuitBreaker`
 * so different modules share the same breaker instance for a given name
 * (e.g. "firestore", "ai-provider", "erp", "banking", "gstn").
 */

/** Circuit-breaker state machine values. */
export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

/** Constructor options. */
export interface CircuitBreakerOptions {
  /** Number of failures within `resetTimeoutMs` that trip the breaker. Default 5. */
  failureThreshold?: number;
  /** Milliseconds the breaker stays OPEN before transitioning to HALF_OPEN. Default 30_000. */
  resetTimeoutMs?: number;
  /** Max concurrent probe calls allowed in HALF_OPEN state. Default 1. */
  halfOpenMaxCalls?: number;
  /** Number of successes required in HALF_OPEN to re-CLOSE. Default 1. */
  halfOpenSuccessThreshold?: number;
  /** Rolling window length (ms) for counting failures. Default 60_000. */
  rollingWindowMs?: number;
}

/** Snapshot returned by `getBreakerStats`. */
export interface BreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  rejected: number;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
  lastStateChangeAt: number;
  consecutiveFailures: number;
}

/** Internal failure-timestamp ring buffer entry. */
interface FailureEntry {
  at: number;
}

/**
 * CircuitBreaker class. Use `getCircuitBreaker(name)` instead of constructing
 * directly — that ensures breakers are shared across modules.
 */
export class CircuitBreaker {
  readonly name: string;
  state: CircuitState = "CLOSED";

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenMaxCalls: number;
  private readonly halfOpenSuccessThreshold: number;
  private readonly rollingWindowMs: number;

  private failures: FailureEntry[] = [];
  private successes = 0;
  private rejected = 0;
  private consecutiveFailures = 0;
  private halfOpenInFlight = 0;
  private halfOpenSuccesses = 0;
  private lastFailureAt: number | null = null;
  private lastSuccessAt: number | null = null;
  private lastStateChangeAt: number;
  private openedAt: number | null = null;

  constructor(name: string, opts: CircuitBreakerOptions = {}) {
    this.name = name;
    this.failureThreshold = opts.failureThreshold ?? 5;
    this.resetTimeoutMs = opts.resetTimeoutMs ?? 30_000;
    this.halfOpenMaxCalls = opts.halfOpenMaxCalls ?? 1;
    this.halfOpenSuccessThreshold = opts.halfOpenSuccessThreshold ?? 1;
    this.rollingWindowMs = opts.rollingWindowMs ?? 60_000;
    const now = Date.now();
    this.lastStateChangeAt = now;
  }

  /**
   * Execute `fn` under circuit-breaker protection.
   *
   * If the breaker is OPEN and a `fallback` is provided, the fallback is
   * invoked. If no fallback is provided, an `Error` is thrown (with
   * `cause.state === "OPEN"`).
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => Promise<T>,
  ): Promise<T> {
    // Try to transition OPEN → HALF_OPEN after the reset timeout has elapsed.
    if (this.state === "OPEN") {
      if (this.openedAt !== null && Date.now() - this.openedAt >= this.resetTimeoutMs) {
        this.transition("HALF_OPEN");
      } else {
        this.rejected++;
        if (fallback) return fallback();
        const err = new Error(
          `circuit-breaker[${this.name}]: OPEN — requests rejected`,
        );
        (err as Error & { circuitState?: CircuitState }).circuitState = "OPEN";
        throw err;
      }
    }

    // HALF_OPEN admission control: limit concurrent probes.
    if (this.state === "HALF_OPEN" && this.halfOpenInFlight >= this.halfOpenMaxCalls) {
      this.rejected++;
      if (fallback) return fallback();
      const err = new Error(
        `circuit-breaker[${this.name}]: HALF_OPEN — probe slot busy`,
      );
      (err as Error & { circuitState?: CircuitState }).circuitState = "HALF_OPEN";
      throw err;
    }

    if (this.state === "HALF_OPEN") this.halfOpenInFlight++;

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    } finally {
      if (this.state === "HALF_OPEN") this.halfOpenInFlight = Math.max(0, this.halfOpenInFlight - 1);
    }
  }

  /** Record a successful call. */
  private onSuccess(): void {
    this.successes++;
    this.lastSuccessAt = Date.now();
    if (this.state === "HALF_OPEN") {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.halfOpenSuccessThreshold) {
        this.transition("CLOSED");
      }
    } else if (this.state === "CLOSED") {
      this.consecutiveFailures = 0;
    }
  }

  /** Record a failed call. */
  private onFailure(): void {
    const now = Date.now();
    this.lastFailureAt = now;
    this.consecutiveFailures++;
    this.failures.push({ at: now });
    this.trimFailures(now);

    if (this.state === "HALF_OPEN") {
      // Any failure during HALF_OPEN re-opens the breaker.
      this.transition("OPEN");
      return;
    }

    if (this.state === "CLOSED" && this.failures.length >= this.failureThreshold) {
      this.transition("OPEN");
    }
  }

  /** Drop failure entries outside the rolling window. */
  private trimFailures(now: number): void {
    const cutoff = now - this.rollingWindowMs;
    while (this.failures.length > 0 && this.failures[0]!.at < cutoff) {
      this.failures.shift();
    }
  }

  /** State-machine transition helper. */
  private transition(next: CircuitState): void {
    if (this.state === next) return;
    this.state = next;
    this.lastStateChangeAt = Date.now();
    if (next === "OPEN") {
      this.openedAt = Date.now();
      this.halfOpenSuccesses = 0;
      this.halfOpenInFlight = 0;
    } else if (next === "HALF_OPEN") {
      this.halfOpenSuccesses = 0;
      this.halfOpenInFlight = 0;
    } else if (next === "CLOSED") {
      this.failures = [];
      this.consecutiveFailures = 0;
      this.openedAt = null;
    }
  }

  /** Snapshot of breaker statistics (safe to expose via admin endpoints). */
  getStats(): BreakerStats {
    return {
      state: this.state,
      failures: this.failures.length,
      successes: this.successes,
      rejected: this.rejected,
      lastFailureAt: this.lastFailureAt,
      lastSuccessAt: this.lastSuccessAt,
      lastStateChangeAt: this.lastStateChangeAt,
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  /** Reset the breaker to CLOSED and clear all counters (admin / test only). */
  reset(): void {
    this.failures = [];
    this.successes = 0;
    this.rejected = 0;
    this.consecutiveFailures = 0;
    this.halfOpenInFlight = 0;
    this.halfOpenSuccesses = 0;
    this.lastFailureAt = null;
    this.openedAt = null;
    this.transition("CLOSED");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton registry
// ─────────────────────────────────────────────────────────────────────────────

const registry = new Map<string, CircuitBreaker>();
const defaultOpts: Record<string, CircuitBreakerOptions> = {
  firestore: { failureThreshold: 8, resetTimeoutMs: 15_000, rollingWindowMs: 60_000 },
  "ai-provider": { failureThreshold: 5, resetTimeoutMs: 60_000, rollingWindowMs: 120_000 },
  erp: { failureThreshold: 5, resetTimeoutMs: 30_000, rollingWindowMs: 60_000 },
  banking: { failureThreshold: 5, resetTimeoutMs: 30_000, rollingWindowMs: 60_000 },
  gstn: { failureThreshold: 4, resetTimeoutMs: 60_000, rollingWindowMs: 120_000 },
};

/**
 * Return (or create) the singleton CircuitBreaker for `name`. Subsequent calls
 * with the same name return the same instance, so failure counts are shared
 * across all callers within the process.
 *
 * Options passed on subsequent calls are ignored — the breaker is configured
 * the first time it is created. If no options are provided, per-name defaults
 * are used (`firestore`, `ai-provider`, `erp`, `banking`, `gstn`).
 */
export function getCircuitBreaker(
  name: string,
  opts?: CircuitBreakerOptions,
): CircuitBreaker {
  let breaker = registry.get(name);
  if (!breaker) {
    breaker = new CircuitBreaker(name, opts ?? defaultOpts[name]);
    registry.set(name, breaker);
  }
  return breaker;
}

/**
 * Stats snapshot for a named breaker. Returns `null` if no breaker with that
 * name has been created yet.
 */
export function getBreakerStats(name: string): BreakerStats | null {
  const breaker = registry.get(name);
  return breaker ? breaker.getStats() : null;
}

/**
 * Return a snapshot of all registered breakers (for admin dashboards).
 */
export function getAllBreakerStats(): Record<string, BreakerStats> {
  const out: Record<string, BreakerStats> = {};
  for (const [name, breaker] of registry.entries()) {
    out[name] = breaker.getStats();
  }
  return out;
}
