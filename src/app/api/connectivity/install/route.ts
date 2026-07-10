// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/connectivity/install
// Install a connector from the catalog or marketplace. Creates a real
// ConnectorInstance row in 'inactive' status (awaits authentication).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { installConnector } from '@/lib/connectivity/engine';
import { clearCache } from '@/lib/connectivity/orchestrator';
import type { AuthMethod, SyncInterval } from '@/lib/connectivity/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectorKey, userId, firmId, displayName, identifier, authMethod, scopes, syncInterval, metadata } = body;

    if (!connectorKey) {
      return NextResponse.json({ error: 'connectorKey is required' }, { status: 400 });
    }

    const result = await installConnector({
      connectorKey,
      userId,
      firmId,
      displayName,
      identifier,
      authMethod: authMethod as AuthMethod | undefined,
      scopes,
      syncInterval: syncInterval as SyncInterval | undefined,
      metadata,
    });

    clearCache();
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err) {
    console.error('[Connectivity] Install error:', err);
    return NextResponse.json({ error: 'Failed to install connector', detail: String(err) }, { status: 500 });
  }
}
