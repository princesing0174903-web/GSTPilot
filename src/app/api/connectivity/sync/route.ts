// ═══════════════════════════════════════════════════════════════════════════════
// /api/connectivity/sync
// GET  — Universal Data Synchronization report (entity-level sync status).
// POST — Trigger a sync for a connector (creates ConnectorSyncJob, publishes
//        sync.completed event, updates instance lastSyncAt).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getUniversalSyncReport } from '@/lib/connectivity/sync';
import { triggerSync } from '@/lib/connectivity/engine';
import { clearCache } from '@/lib/connectivity/orchestrator';

export async function GET() {
  try {
    const report = await getUniversalSyncReport();
    return NextResponse.json(report);
  } catch (err) {
    console.error('[Connectivity] Sync report error:', err);
    return NextResponse.json({ error: 'Failed to load sync report' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectorId, trigger, entities } = body;

    if (!connectorId) {
      return NextResponse.json({ error: 'connectorId is required' }, { status: 400 });
    }

    const result = await triggerSync({
      connectorId,
      trigger,
      entities,
    });

    clearCache();
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (err) {
    console.error('[Connectivity] Sync trigger error:', err);
    return NextResponse.json({ error: 'Failed to trigger sync' }, { status: 500 });
  }
}
