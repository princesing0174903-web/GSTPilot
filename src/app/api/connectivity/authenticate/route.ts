// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/connectivity/authenticate
// Complete the OAuth/API-key authentication flow for a connector. Stores a real
// ConnectorCredential row and flips the instance to 'active'.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { authenticateConnector } from '@/lib/connectivity/engine';
import { clearCache } from '@/lib/connectivity/orchestrator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectorId, scopes, expiresAt, metadata } = body;

    if (!connectorId) {
      return NextResponse.json({ error: 'connectorId is required' }, { status: 400 });
    }

    const result = await authenticateConnector({
      connectorId,
      scopes,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      metadata,
    });

    clearCache();
    return NextResponse.json(result, { status: result.success ? 200 : 404 });
  } catch (err) {
    console.error('[Connectivity] Authenticate error:', err);
    return NextResponse.json({ error: 'Failed to authenticate connector' }, { status: 500 });
  }
}
