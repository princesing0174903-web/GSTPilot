'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// Client-Side Performance Monitor — dev-only slow-request + hydration tracking
// ═══════════════════════════════════════════════════════════════════════════════
//
// In development, this module:
//   1. Wraps `window.fetch` to log any /api/ request that takes >1s, with the
//      URL, duration, and status. This makes slow API/database operations
//      immediately visible in the browser console — no profiling tools needed.
//   2. Subscribes to PerformanceObserver for LCP, FCP, TTFB, and long tasks.
//   3. Logs hydration duration (Next.js client hydration).
//
// PRODUCTION-SAFE: the entire module is a no-op when NODE_ENV !== 'development'.
// The wrapper is never installed, PerformanceObserver is never subscribed, and
// zero overhead is added.
//
// SECURITY: never logs request/response BODIES (may contain tokens, financial
// data, PII). Only logs URL, method, status code, and duration. Query-string
// values in URLs are NOT redacted (they may contain organizationId which is
// already visible in network tab) — but no Authorization headers or tokens
// are ever logged.
// ═══════════════════════════════════════════════════════════════════════════════

const SLOW_REQUEST_THRESHOLD_MS = 1_000;
const VERY_SLOW_REQUEST_THRESHOLD_MS = 5_000;
const LONG_TASK_THRESHOLD_MS = 50;

let installed = false;

/**
 * Install the dev-only performance monitor. Safe to call multiple times —
 * subsequent calls are no-ops. Should be called once from the providers
 * (client-side only).
 */
export function installPerfMonitor(): void {
  if (typeof window === 'undefined') return;
  if (process.env.NODE_ENV !== 'development') return;
  if (installed) return;
  installed = true;

  // ── 1. Wrap fetch to log slow API requests ──────────────────────────────
  const originalFetch = window.fetch.bind(window);
  window.fetch = async function perfWrappedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const isApiRequest = url.startsWith('/api/') || url.includes('/api/');

    // Only measure /api/ requests — static asset requests are noise.
    if (!isApiRequest) {
      return originalFetch(input, init);
    }

    const start = performance.now();
    try {
      const response = await originalFetch(input, init);
      const duration = Math.round(performance.now() - start);

      if (duration >= VERY_SLOW_REQUEST_THRESHOLD_MS) {
        // Very slow — 5s+
        console.warn(
          `%c[PERF] VERY SLOW%c ${method} ${url} → ${response.status} in ${duration}ms`,
          'color:#ef4444;font-weight:bold',
          'color:#fca5a5',
        );
      } else if (duration >= SLOW_REQUEST_THRESHOLD_MS) {
        // Slow — 1-5s
        console.warn(
          `%c[PERF] slow%c ${method} ${url} → ${response.status} in ${duration}ms`,
          'color:#f59e0b;font-weight:bold',
          'color:#fcd34d',
        );
      }
      return response;
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      console.error(
        `%c[PERF] FAIL%c ${method} ${url} → error after ${duration}ms`,
        'color:#ef4444;font-weight:bold',
        'color:#fca5a5',
        err,
      );
      throw err;
    }
  };

  // ── 2. PerformanceObserver for LCP, FCP, TTFB ──────────────────────────
  try {
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          const lcp = Math.round(entry.startTime);
          if (lcp > 2_500) {
            console.warn(`%c[PERF] LCP slow: ${lcp}ms`, 'color:#f59e0b;font-weight:bold');
          } else {
            console.log(`%c[PERF] LCP: ${lcp}ms`, 'color:#10b981');
          }
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

      // Long Tasks (>50ms) — these block the main thread
      const longTaskObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          const duration = Math.round(entry.duration);
          if (duration >= LONG_TASK_THRESHOLD_MS) {
            console.warn(
              `%c[PERF] long task: ${duration}ms`,
              'color:#f59e0b',
            );
          }
        }
      });
      try {
        longTaskObserver.observe({ type: 'longtask', buffered: true });
      } catch {
        // 'longtask' type not supported in all browsers — ignore.
      }
    }
  } catch {
    // PerformanceObserver unavailable — non-fatal.
  }

  // ── 3. Hydration timing ────────────────────────────────────────────────
  // Next.js emits a 'hydration' performance entry when client hydration completes.
  try {
    const navEntries = performance.getEntriesByType('navigation');
    for (const entry of navEntries) {
      const navEntry = entry as PerformanceNavigationTiming;
      const domComplete = Math.round(navEntry.domComplete);
      const loadEventEnd = Math.round(navEntry.loadEventEnd);
      const ttfb = Math.round(navEntry.responseStart - navEntry.requestStart);
      if (ttfb > 1_000) {
        console.warn(`%c[PERF] TTFB slow: ${ttfb}ms`, 'color:#f59e0b;font-weight:bold');
      } else {
        console.log(`%c[PERF] TTFB: ${ttfb}ms, DOM complete: ${domComplete}ms, load: ${loadEventEnd}ms`, 'color:#10b981');
      }
    }
  } catch {
    // Navigation Timing API unavailable — non-fatal.
  }

  console.log('%c[PERF] monitor installed (dev-only)', 'color:#10b981;font-weight:bold');
}

/**
 * Manually log a slow operation from anywhere in the app. Useful for
 * instrumenting non-fetch operations (e.g. heavy computations, renders).
 */
export function logSlowOperation(label: string, durationMs: number, context?: string): void {
  if (process.env.NODE_ENV !== 'development') return;
  if (durationMs < SLOW_REQUEST_THRESHOLD_MS) return;
  const ctx = context ? ` (${context})` : '';
  if (durationMs >= VERY_SLOW_REQUEST_THRESHOLD_MS) {
    console.warn(`%c[PERF] VERY SLOW%c ${label}${ctx}: ${durationMs}ms`, 'color:#ef4444;font-weight:bold', 'color:#fca5a5');
  } else {
    console.warn(`%c[PERF] slow%c ${label}${ctx}: ${durationMs}ms`, 'color:#f59e0b;font-weight:bold', 'color:#fcd34d');
  }
}
