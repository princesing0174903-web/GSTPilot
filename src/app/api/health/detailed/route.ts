// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — /api/health/detailed — Fresh Authenticated Probe
//
// GET /api/health/detailed
//   Requires authentication (any org member). Runs all checks fresh (no cache)
//   so operators can see real-time latency + status without waiting for the
//   30s cache to expire. Slower than /api/health but authoritative.
//
// Auth: Bearer token in the Authorization header. The token is a Firebase
// Auth ID token, verified via adminAuth().verifyIdToken(). Any authenticated
// user is allowed (no org-scope check — system health is cross-tenant).
//
// Response envelope:
//   { ok: true, health: SystemHealth, responseMs: number }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { runAllHealthChecksFresh } from '@/lib/health/monitor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const t0 = Date.now();
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

    let decodedUid: string | null = null;
    try {
      const { adminAuth } = await import('@/lib/firebase-admin');
      const decoded = await adminAuth().verifyIdToken(token);
      decodedUid = decoded.uid;
    } catch (err) {
      console.error('[/api/health/detailed] auth failed:', err);
      return NextResponse.json(
        { ok: false, error: 'Invalid or expired authentication token.' },
        { status: 401 },
      );
    }
    if (!decodedUid) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required.' },
        { status: 401 },
      );
    }

    // ── Fresh health probe (skips cache) ────────────────────────────────────
    const health = await runAllHealthChecksFresh();
    return NextResponse.json(
      {
        ok: true,
        health,
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
    console.error('[/api/health/detailed] fatal error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        responseMs: Date.now() - t0,
      },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  }
}
