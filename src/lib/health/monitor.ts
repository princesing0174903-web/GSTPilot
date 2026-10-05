// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Health, Monitoring & Alerting — Monitor
//
// The monitor orchestrates the individual checks:
//   • runAllHealthChecks()    — runs every check in parallel, aggregates.
//   • runHealthCheck(name)    — runs a single check by name.
//   • startHealthMonitoring() — background loop, stores 24h of history.
//   • getHealthHistory(hours) — returns historical readings.
//   • getHealthSummary()      — uptime, p95 latencies, incidents.
//
// Cache strategy:
//   • The cached SystemHealth is valid for `cacheTtlMs` (default 30s).
//   • `/api/health` (lightweight, public) reads from cache; refreshes if stale.
//   • `/api/health/detailed` (authenticated) skips the cache and runs fresh.
//
// History strategy:
//   • Background loop runs every `intervalMs` (default 60s) and appends a
//     reading to a ring buffer (max 1440 readings = 24h at 1-min interval).
//   • The loop is started lazily on first `runAllHealthChecks()` call so dev
//     environments that never hit /api/health don't pay the cost.
//   • If `intervalMs` is 0, the background loop is disabled (useful for tests).
// ═══════════════════════════════════════════════════════════════════════════════

import { HEALTH_CHECKS, HEALTH_CHECK_BY_NAME } from './checks';
import type { HealthCheck, HealthStatus, HealthSummary, SystemHealth } from './types';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Default cache TTL for the lightweight /api/health endpoint (30s). */
const DEFAULT_CACHE_TTL_MS = 30_000;

/** Default monitoring loop interval (60s). */
const DEFAULT_INTERVAL_MS = 60_000;

/** Max readings to retain in the history ring buffer (1440 = 24h @ 60s). */
const MAX_HISTORY = 1_440;

/** App version stamped into every SystemHealth payload. */
const APP_VERSION = readAppVersion();

/** Process start time for uptime computation. */
const PROCESS_STARTED_AT = Date.now();

// ─── Aggregation ────────────────────────────────────────────────────────────

/**
 * Compute the overall status across all checks. 'unknown' does NOT drag the
 * overall down — it represents "feature not deployed" rather than "feature
 * broken". Worst-of is determined by the most severe known status.
 *
 * Priority: unhealthy > degraded > healthy > unknown.
 * Empty list → 'unknown'.
 */
export function aggregateOverall(checks: HealthCheck[]): HealthStatus {
  if (checks.length === 0) return 'unknown';

  let hasUnhealthy = false;
  let hasDegraded = false;
  let hasHealthy = false;
  let allUnknown = true;

  for (const c of checks) {
    if (c.status === 'unhealthy') hasUnhealthy = true;
    if (c.status === 'degraded') hasDegraded = true;
    if (c.status === 'healthy') hasHealthy = true;
    if (c.status !== 'unknown') allUnknown = false;
  }

  if (hasUnhealthy) return 'unhealthy';
  if (hasDegraded) return 'degraded';
  if (hasHealthy) return 'healthy';
  if (allUnknown) return 'unknown';
  return 'unknown';
}

// ─── State ──────────────────────────────────────────────────────────────────

interface CacheEntry {
  health: SystemHealth;
  cachedAt: number;
}

let cache: CacheEntry | null = null;
const cacheTtlMs: number = DEFAULT_CACHE_TTL_MS;

/** Historical readings (ring buffer — older entries dropped from the front). */
const history: SystemHealth[] = [];

let monitoringTimer: NodeJS.Timeout | null = null;
let monitoringStarted = false;

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Run every health check in parallel and aggregate the results into a
 * SystemHealth. The result is cached for `cacheTtlMs` (30s by default).
 *
 * Side effects:
 *   • On the very first call, starts the background monitoring loop.
 *   • Updates the cache.
 */
export async function runAllHealthChecks(): Promise<SystemHealth> {
  if (cache && Date.now() - cache.cachedAt < cacheTtlMs) {
    return cache.health;
  }

  // Lazily start the monitoring loop on first probe.
  if (!monitoringStarted) {
    startHealthMonitoring();
  }

  const health = await runAllHealthChecksFresh();
  cache = { health, cachedAt: Date.now() };
  return health;
}

/**
 * Run every health check in parallel WITHOUT consulting or updating the
 * cache. Used by /api/health/detailed for authenticated, always-fresh reads.
 */
export async function runAllHealthChecksFresh(): Promise<SystemHealth> {
  const checks = await Promise.all(
    HEALTH_CHECKS.map((c) => c.run().catch((err): HealthCheck => {
      // Defensive: every check should already swallow its own errors. If a
      // check still throws, convert to an unhealthy result so the probe never
      // crashes the API route.
      return {
        name: c.name,
        status: 'unhealthy',
        lastCheckedAt: new Date().toISOString(),
        message: `Check threw uncaught error: ${err instanceof Error ? err.message : String(err)}`,
        details: { uncaught: true },
      };
    })),
  );

  return {
    overall: aggregateOverall(checks),
    checks,
    version: APP_VERSION,
    uptime: Math.floor((Date.now() - PROCESS_STARTED_AT) / 1000),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Run a single named health check. Returns 'unknown' for unknown check names.
 */
export async function runHealthCheck(name: string): Promise<HealthCheck> {
  const runner = HEALTH_CHECK_BY_NAME.get(name);
  if (!runner) {
    return {
      name,
      status: 'unknown',
      lastCheckedAt: new Date().toISOString(),
      message: `Unknown health check: ${name}`,
      details: { knownChecks: HEALTH_CHECKS.map((c) => c.name) },
    };
  }
  return runner().catch((err): HealthCheck => ({
    name,
    status: 'unhealthy',
    lastCheckedAt: new Date().toISOString(),
    message: `Check threw uncaught error: ${err instanceof Error ? err.message : String(err)}`,
    details: { uncaught: true },
  }));
}

/**
 * Start the background monitoring loop. Idempotent — safe to call multiple
 * times. The loop runs `runAllHealthChecksFresh()` every `intervalMs` and
 * appends the result to the history ring buffer.
 *
 * Pass `intervalMs = 0` to disable (the loop will not start).
 */
export function startHealthMonitoring(intervalMs: number = DEFAULT_INTERVAL_MS): void {
  if (monitoringStarted) return;
  if (intervalMs <= 0) return;
  monitoringStarted = true;

  // Initial reading so history is non-empty immediately.
  void runAllHealthChecksFresh()
    .then((h) => {
      history.push(h);
      if (history.length > MAX_HISTORY) history.shift();
    })
    .catch((err) => {
      console.error('[health/monitor] initial probe failed:', err);
    });

  monitoringTimer = setInterval(() => {
    void runAllHealthChecksFresh()
      .then((h) => {
        history.push(h);
        if (history.length > MAX_HISTORY) history.shift();
      })
      .catch((err) => {
        console.error('[health/monitor] background probe failed:', err);
      });
  }, intervalMs);

  // Don't keep the process alive just for the monitor — this is a long-running
  // Next.js server and the timer is fine to be unref'd in dev.
  if (monitoringTimer && typeof monitoringTimer.unref === 'function') {
    monitoringTimer.unref();
  }
}

/** Stop the background monitoring loop (mainly for tests). */
export function stopHealthMonitoring(): void {
  if (monitoringTimer) {
    clearInterval(monitoringTimer);
    monitoringTimer = null;
  }
  monitoringStarted = false;
}

/**
 * Return historical SystemHealth readings from the last `hours` hours.
 * Returns an empty array if monitoring hasn't started or no readings exist.
 */
export function getHealthHistory(hours: number = 24): SystemHealth[] {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return history.filter((h) => new Date(h.timestamp).getTime() >= cutoff);
}

/** Return the most recent cached SystemHealth, or null if no probe has run yet. */
export function getCachedHealth(): SystemHealth | null {
  return cache?.health ?? null;
}

/**
 * Compute an aggregate summary over the historical readings:
 *   • uptime: fraction of readings where overall === 'healthy'
 *   • p95LatencyByCheck: per-check p95 latency
 *   • incidents: consecutive non-healthy reading streaks, per check
 *
 * If history is empty, returns a zeroed summary.
 */
export function getHealthSummary(hours: number = 24): HealthSummary {
  const relevant = getHealthHistory(hours);
  if (relevant.length === 0) {
    return {
      uptime: 0,
      p95LatencyByCheck: {},
      incidents: [],
      sampleCount: 0,
      hours,
    };
  }

  const healthyCount = relevant.filter((h) => h.overall === 'healthy').length;
  const uptime = healthyCount / relevant.length;

  // Per-check p95 latency.
  const latenciesByCheck = new Map<string, number[]>();
  for (const h of relevant) {
    for (const c of h.checks) {
      if (typeof c.latencyMs === 'number') {
        const list = latenciesByCheck.get(c.name) ?? [];
        list.push(c.latencyMs);
        latenciesByCheck.set(c.name, list);
      }
    }
  }
  const p95LatencyByCheck: Record<string, number> = {};
  for (const [name, list] of latenciesByCheck) {
    p95LatencyByCheck[name] = computeP95(list);
  }

  // Incident detection: walk history per check; a streak of consecutive
  // non-healthy readings for a single check (or overall) is one incident.
  const incidents = detectIncidents(relevant);

  return {
    uptime,
    p95LatencyByCheck,
    incidents,
    sampleCount: relevant.length,
    hours,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Compute the 95th percentile of a list of numbers. */
function computeP95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return sorted[idx] ?? 0;
}

/**
 * Detect incidents in the history. An incident is a maximal run of consecutive
 * non-healthy readings for a single check (or the overall). Returns one entry
 * per incident with start/end/duration/check/status.
 *
 * We track both per-check incidents AND overall incidents so the dashboard can
 * show "firestore down for 4 minutes" alongside "system degraded for 4 minutes".
 */
function detectIncidents(
  history: SystemHealth[],
): HealthSummary['incidents'] {
  const incidents: HealthSummary['incidents'] = [];

  // Per-check incidents.
  const checkNames = new Set<string>();
  for (const h of history) {
    for (const c of h.checks) checkNames.add(c.name);
  }

  for (const name of checkNames) {
    let streakStart: { ts: string; worstStatus: HealthStatus } | null = null;
    let worstStatus: HealthStatus = 'healthy';

    for (const h of history) {
      const check = h.checks.find((c) => c.name === name);
      const status = check?.status ?? 'unknown';
      const isUnhealthy = status !== 'healthy' && status !== 'unknown';

      if (isUnhealthy) {
        if (!streakStart) {
          streakStart = { ts: h.timestamp, worstStatus: status };
          worstStatus = status;
        } else {
          worstStatus = worstOf(worstStatus, status);
        }
      } else if (streakStart) {
        const startMs = new Date(streakStart.ts).getTime();
        const endMs = new Date(h.timestamp).getTime();
        incidents.push({
          start: streakStart.ts,
          end: h.timestamp,
          duration: Math.max(0, Math.round((endMs - startMs) / 1000)),
          check: name,
          status: worstStatus,
        });
        streakStart = null;
        worstStatus = 'healthy';
      }
    }

    // If the streak extends to the end of history, close it at the last reading.
    if (streakStart) {
      const last = history[history.length - 1];
      const startMs = new Date(streakStart.ts).getTime();
      const endMs = new Date(last.timestamp).getTime();
      incidents.push({
        start: streakStart.ts,
        end: last.timestamp,
        duration: Math.max(0, Math.round((endMs - startMs) / 1000)),
        check: name,
        status: worstStatus,
      });
    }
  }

  return incidents.sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
}

/** Return the worse of two HealthStatus values (priority: unhealthy > degraded > healthy > unknown). */
function worstOf(a: HealthStatus, b: HealthStatus): HealthStatus {
  const rank: Record<HealthStatus, number> = {
    unhealthy: 3,
    degraded: 2,
    healthy: 1,
    unknown: 0,
  };
  return rank[a] >= rank[b] ? a : b;
}

/** Read the app version from package.json. Best-effort — returns '0.0.0' on error. */
function readAppVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const pkg = require('../../../package.json') as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}
