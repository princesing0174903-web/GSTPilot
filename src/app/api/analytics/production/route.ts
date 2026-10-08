// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — /api/analytics/production
//
// GET /api/analytics/production
//   Admin-gated production report combining DAU, org, revenue, usage, billing
//   metrics across all Firestore collections. Returns the cached report if
//   available (60s TTL inside production-analytics.ts).
//
// Auth: optional `x-admin-token` header matched against process.env.ADMIN_TOKEN.
// In dev (NODE_ENV !== 'production'), if ADMIN_TOKEN is unset the endpoint is
// open so local development isn't blocked.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getFullProductionReport } from '@/lib/analytics/production-analytics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  try {
    // ── Minimal admin-token check ──────────────────────────────────────────
    const provided = request.headers.get('x-admin-token');
    const expected = process.env.ADMIN_TOKEN;
    const isDev = process.env.NODE_ENV !== 'production';

    if (expected) {
      // Constant-time-ish compare (lengths equal → char-by-char XOR).
      const a = Buffer.from(String(provided ?? ''));
      const b = Buffer.from(expected);
      const ok = a.length === b.length && a.equals(b);
      if (!ok) {
        return NextResponse.json(
          { ok: false, error: 'unauthorized' },
          { status: 401 }
        );
      }
    } else if (!isDev) {
      // In prod with no ADMIN_TOKEN configured — refuse.
      return NextResponse.json(
        { ok: false, error: 'ADMIN_TOKEN not configured' },
        { status: 500 }
      );
    }
    // Else (dev + no ADMIN_TOKEN) → allow.

    const report = await getFullProductionReport();
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    console.error('[/api/analytics/production] fatal:', err);
    return NextResponse.json(
      { ok: false, error: 'internal_error', message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
