// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — PHASE 2B · MODULE 3 — Change Detection Events API
//
// GET  /api/events           → list recent business events
// POST /api/events/mark-read → mark events as read (eventId or all)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from 'next/server';
import { listRecentEvents, markEventRead, markAllEventsRead } from '@/lib/connections/change-detection';
import { triggerLazySync } from '@/lib/connections/auto-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Lazy sync-on-read: trigger due syncs in the background
    triggerLazySync();

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 200);
    const events = await listRecentEvents(limit);
    return NextResponse.json({ ok: true, events });
  } catch (error) {
    console.error('GET /api/events error:', error);
    return NextResponse.json({ ok: true, events: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { eventId, all } = body as { eventId?: string; all?: boolean };

    if (all) {
      await markAllEventsRead();
      return NextResponse.json({ ok: true });
    }
    if (eventId) {
      await markEventRead(eventId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { ok: false, error: 'Provide eventId or all=true' },
      { status: 400 },
    );
  } catch (error) {
    console.error('POST /api/events error:', error);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
