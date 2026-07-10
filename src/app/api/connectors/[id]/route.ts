// ═══════════════════════════════════════════════════════════════════════════════
// PATCH   /api/connectors/[id]?userId=<firebase_uid>
//   Body: { status?, syncInterval?, label?, errorMessage? }
//   Updates a real DataConnection row + writes an AuditLog entry.
//
// DELETE  /api/connectors/[id]?userId=<firebase_uid>
//   Deletes a data connection + all its synced records (cascade).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { safeAudit } from '@/lib/audit/safe-write';

const VALID_STATUSES = new Set(['connected', 'disconnected', 'error', 'syncing']);
const VALID_INTERVALS = new Set(['15m', '1h', '6h', 'daily']);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  let body: {
    status?: string;
    syncInterval?: string;
    label?: string;
    errorMessage?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const conn = await db.dataConnection.findUnique({ where: { id } });
    if (!conn || conn.userId !== userId) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.status && VALID_STATUSES.has(body.status)) data.status = body.status;
    if (body.syncInterval && VALID_INTERVALS.has(body.syncInterval)) data.syncInterval = body.syncInterval;
    if (typeof body.label === 'string' && body.label.trim()) data.label = body.label.trim();
    if (body.errorMessage !== undefined) data.errorMessage = body.errorMessage;

    const updated = await db.dataConnection.update({
      where: { id },
      data,
    });

    await safeAudit({
      userId,
      action: 'CONNECTOR_UPDATED',
      entity: 'DataConnection',
      entityId: id,
      oldValue: JSON.stringify({ status: conn.status, syncInterval: conn.syncInterval }),
      newValue: JSON.stringify(data),
      details: `Updated ${conn.type.toUpperCase()} connector — ${conn.label}`,
    });

    return NextResponse.json({
      success: true,
      connection: {
        id: updated.id,
        type: updated.type,
        status: updated.status,
        label: updated.label,
        identifier: updated.identifier,
        syncInterval: updated.syncInterval,
        lastSyncAt: updated.lastSyncAt?.toISOString() ?? null,
      },
    });
  } catch (err) {
    console.error('[Connectors] Patch error:', err);
    return NextResponse.json({ error: 'Failed to update connection' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    // Verify ownership
    const conn = await db.dataConnection.findUnique({ where: { id } });
    if (!conn || conn.userId !== userId) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    const label = conn.label;
    const type = conn.type;

    // Delete synced records first (cascade), then the connection
    await db.syncedRecord.deleteMany({ where: { connectionId: id } }).catch(() => {});
    await db.dataConnection.delete({ where: { id } });

    await safeAudit({
      userId,
      action: 'CONNECTOR_DISCONNECTED',
      entity: 'DataConnection',
      entityId: id,
      oldValue: JSON.stringify({ type, label }),
      details: `Disconnected ${type.toUpperCase()} — ${label}`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Connectors] Delete error:', err);
    return NextResponse.json({ error: 'Failed to delete connection' }, { status: 500 });
  }
}
