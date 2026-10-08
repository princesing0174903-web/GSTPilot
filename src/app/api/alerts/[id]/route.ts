// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — PHASE 2B · MODULE 4 — Real-Time Alert Center API
//
// PATCH /api/alerts/[id] → update alert lifecycle
//   body: { action: 'read' | 'dismiss' | 'archive' | 'resolve' }
// GET   /api/alerts/[id] → fetch a single alert with details
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from 'next/server';
import {
  markAlertRead,
  dismissAlert,
  archiveAlert,
  resolveAlert,
  getAlert,
} from '@/lib/connections/alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const alert = await getAlert(id);
    if (!alert) {
      return NextResponse.json({ ok: false, error: 'Alert not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, alert });
  } catch (error) {
    console.error('GET /api/alerts/[id] error:', error);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { action } = body as { action?: string };

    switch (action) {
      case 'read':
        await markAlertRead(id);
        break;
      case 'dismiss':
        await dismissAlert(id);
        break;
      case 'archive':
        await archiveAlert(id);
        break;
      case 'resolve':
        await resolveAlert(id);
        break;
      default:
        return NextResponse.json(
          { ok: false, error: 'Invalid action. Use: read, dismiss, archive, resolve.' },
          { status: 400 },
        );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('PATCH /api/alerts/[id] error:', error);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
