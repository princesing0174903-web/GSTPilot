// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — /api/health/history — Historical Health Readings
//
// GET /api/health/history?hours=24
//   Requires authentication (any org member). Returns the historical
//   SystemHealth readings captured by the background monitoring loop. Default
//   range: last 24 hours. Max: 168 hours (7 days).
//
// Also returns the computed HealthSummary (uptime %, p95 latencies, incidents)
// for the requested time range so the dashboard can render a single payload.
//
// Response envelope:
//   { ok: true, history: SystemHealth[], summary: HealthSummary, hours: number }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getHealthHistory, getHealthSummary } from '@/lib/health/monitor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_HOURS = 168; // 7 days

export async function GET(req: NextRequest) {
  try {
    // ── Auth: verify Firebase ID token ──────────────────────────────────────
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required. Provide a Bearer token.' },
        { status: 401 },
      );
    }

    try {
      const { adminAuth } = await import('@/lib/firebase-admin');
      await adminAuth().verifyIdToken(token);
    } catch (err) {
      console.error('[/api/health/history] auth failed:', err);
      return NextResponse.json(
        { ok: false, error: 'Invalid or expired authentication token.' },
        { status: 401 },
      );
    }

    // ── Parse query ─────────────────────────────────────────────────────────
    const hoursRaw = Number.parseInt(req.nextUrl.searchParams.get('hours') ?? '24', 10);
    const hours = Number.isFinite(hoursRaw) && hoursRaw > 0
      ? Math.min(hoursRaw, MAX_HOURS)
      : 24;

    const history = getHealthHistory(hours);
    const summary = getHealthSummary(hours);

    return NextResponse.json(
      {
        ok: true,
        history,
        summary,
        hours,
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (err) {
    console.error('[/api/health/history] fatal error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        history: [],
        summary: null,
        hours: 0,
      },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  }
}
