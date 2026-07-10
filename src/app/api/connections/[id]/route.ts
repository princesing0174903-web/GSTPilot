// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Real Data Activation + Auto Sync Engine
//
// DELETE /api/connections/[id] → disconnect a connection (soft-delete)
// PATCH  /api/connections/[id] → update sync schedule (autoSync, syncIntervalMins)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from 'next/server';
import { disconnectConnection } from '@/lib/connections';
import { updateSyncSchedule } from '@/lib/connections/auto-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── DELETE: disconnect ────────────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Connection id is required' },
        { status: 400 },
      );
    }

    await disconnectConnection(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/connections/[id] error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Disconnect failed' },
      { status: 500 },
    );
  }
}

// ─── PATCH: update sync schedule ───────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Connection id is required' },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { autoSync, syncIntervalMins } = body as {
      autoSync?: boolean;
      syncIntervalMins?: number;
    };

    if (autoSync === undefined && syncIntervalMins === undefined) {
      return NextResponse.json(
        { ok: false, error: 'No fields to update. Provide autoSync or syncIntervalMins.' },
        { status: 400 },
      );
    }

    if (syncIntervalMins !== undefined && (syncIntervalMins < 5 || syncIntervalMins > 1440)) {
      return NextResponse.json(
        { ok: false, error: 'syncIntervalMins must be between 5 and 1440 (1 day)' },
        { status: 400 },
      );
    }

    await updateSyncSchedule(id, { autoSync, syncIntervalMins });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('PATCH /api/connections/[id] error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 },
    );
  }
}
