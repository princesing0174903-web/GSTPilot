// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — PHASE 2B · MODULE 4 — Real-Time Alert Center API
//
// GET  /api/alerts        → list alerts (optional ?status=open|read|archived|all)
// POST /api/alerts        → bulk actions: { action: 'mark-all-read' }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from 'next/server';
import { listAlerts, getAlertSummary, markAllAlertsRead, type AlertStatus } from '@/lib/connections/alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = (searchParams.get('status') ?? 'open') as AlertStatus | 'all';
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10) || 100, 500);

    const [alerts, summary] = await Promise.all([
      listAlerts({ status, limit }),
      getAlertSummary(),
    ]);

    return NextResponse.json({ ok: true, alerts, summary });
  } catch (error) {
    console.error('GET /api/alerts error:', error);
    return NextResponse.json({ ok: true, alerts: [], summary: { total: 0, open: 0, critical: 0, warning: 0, info: 0, positive: 0 } });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body as { action?: string };

    if (action === 'mark-all-read') {
      const count = await markAllAlertsRead();
      return NextResponse.json({ ok: true, updated: count });
    }

    return NextResponse.json(
      { ok: false, error: 'Unknown action. Use action: "mark-all-read".' },
      { status: 400 },
    );
  } catch (error) {
    console.error('POST /api/alerts error:', error);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
