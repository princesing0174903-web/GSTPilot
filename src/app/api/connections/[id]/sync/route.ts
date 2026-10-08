// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — PHASE 2B · Auto Sync Engine
//
// POST /api/connections/[id]/sync → trigger a fresh sync for a connection.
//   • Uses executeSync() which runs the full post-sync pipeline:
//     sync → validate → detect changes → generate alerts → schedule next sync
//   • Returns the sync result with events/alerts created counts
//   • Never 500s (executeSync swallows errors)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from 'next/server';
import { executeSync } from '@/lib/connections/auto-sync';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
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

    const result = await executeSync(id, 'manual');

    // Fetch the updated connection to return full state
    const connection = await db.businessConnection.findUnique({ where: { id } });

    if (!connection) {
      return NextResponse.json(
        { ok: false, error: 'Connection not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: result.success,
      result: {
        success: result.success,
        status: result.status,
        recordsImported: result.recordsImported,
        errorsCount: result.errorsCount,
        durationMs: result.durationMs,
        eventsCreated: result.eventsCreated,
        alertsCreated: result.alertsCreated,
        nextSyncAt: result.nextSyncAt,
      },
      connection: {
        id: connection.id,
        type: connection.type,
        provider: connection.provider,
        gstin: connection.gstin,
        legalName: connection.legalName,
        tradeName: connection.tradeName,
        status: connection.status,
        syncStatus: connection.syncStatus,
        maskedRef: connection.maskedRef,
        lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
        lastSyncRecords: connection.lastSyncRecords,
        lastSyncErrors: connection.lastSyncErrors,
        lastSyncMessage: connection.lastSyncMessage,
        lastSyncDurationMs: connection.lastSyncDurationMs,
        nextSyncAt: connection.nextSyncAt?.toISOString() ?? null,
        autoSync: connection.autoSync,
        syncIntervalMins: connection.syncIntervalMins,
        consecutiveFailures: connection.consecutiveFailures,
      },
    });
  } catch (error) {
    console.error('POST /api/connections/[id]/sync error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      },
      { status: 500 },
    );
  }
}
