// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — /api/health — Public Lightweight Health Probe
//
// GET /api/health
//   Public (no auth) — designed for uptime monitors (UptimeRobot, Pingdom,
//   Firebase Hosting health checks, k8s liveness probes). Returns the cached
//   SystemHealth (refreshes if cache stale > 30s). Must be FAST (<500ms).
//
// Response envelope:
//   { ok: true, health: SystemHealth, cachedAt: ISO, cacheAgeMs: number }
//
// Always returns 200 — even when individual checks are unhealthy. The HTTP
// status reflects "the health endpoint is reachable", not "everything is OK".
// Monitoring tools should branch on `health.overall` instead.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { runAllHealthChecks, getCachedHealth } from '@/lib/health/monitor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Always-on cache: even if a request hits during a cold start, we serve the
// last cached reading (if any) rather than re-running all checks. The cache
// refresh is done in runAllHealthChecks() itself.
export async function GET() {
  const t0 = Date.now();
  try {
    const beforeCache = getCachedHealth();
    const health = await runAllHealthChecks();
    const cacheAgeMs = beforeCache
      ? Date.now() - new Date(beforeCache.timestamp).getTime()
      : 0;

    return NextResponse.json(
      {
        ok: true,
        health,
        cachedAt: health.timestamp,
        cacheAgeMs,
        responseMs: Date.now() - t0,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Health-Overall': health.overall,
        },
      },
    );
  } catch (err) {
    // This block should be unreachable — runAllHealthChecks is resilient.
    // If we get here, return a synthetic unhealthy payload with 200 so uptime
    // monitors can still detect "service reachable but broken" via overall.
    console.error('[/api/health] fatal error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown health probe error',
        health: {
          overall: 'unhealthy',
          checks: [],
          version: '0.0.0',
          uptime: 0,
          timestamp: new Date().toISOString(),
        },
        responseMs: Date.now() - t0,
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Health-Overall': 'unhealthy' },
      },
    );
  }
}
