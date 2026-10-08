// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — /api/health — Public Lightweight Health Probe
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

    // Surface the database check + environment explicitly so deployment
    // health probes (Vercel, k8s, UptimeRobot) can branch without walking
    // the full checks array. Environment is derived from NODE_ENV (set by
    // the hosting platform) — never trust client-supplied values.
    const dbCheck = health.checks.find((c) => c.name === 'database' || c.name === 'db');
    const environment = process.env.NODE_ENV === 'production' ? 'production'
      : process.env.NODE_ENV === 'test' ? 'test'
      : 'development';

    return NextResponse.json(
      {
        ok: true,
        status: health.overall,
        environment,
        app: 'gstpilot-infinity',
        version: health.version,
        database: dbCheck?.status ?? 'unknown',
        uptime: health.uptime,
        timestamp: health.timestamp,
        health,
        cachedAt: health.timestamp,
        cacheAgeMs,
        responseMs: Date.now() - t0,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Health-Overall': health.overall,
          'X-Environment': environment,
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
