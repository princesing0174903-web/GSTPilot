// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/connectivity/uninstall
// Uninstall a connector — cascades to events/logs/syncJobs/credentials.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { uninstallConnector } from '@/lib/connectivity/engine';
import { clearCache } from '@/lib/connectivity/orchestrator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectorId } = body;

    if (!connectorId) {
      return NextResponse.json({ error: 'connectorId is required' }, { status: 400 });
    }

    const result = await uninstallConnector(connectorId);
    clearCache();
    return NextResponse.json(result, { status: result.success ? 200 : 404 });
  } catch (err) {
    console.error('[Connectivity] Uninstall error:', err);
    return NextResponse.json({ error: 'Failed to uninstall connector' }, { status: 500 });
  }
}
