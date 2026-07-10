// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/connectivity/health
// Connectivity Health Center — health scores, top issues, 24h aggregates,
// per-connector health (latency, reliability, credential expiry, freshness).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { mapInstance } from '@/lib/connectivity/engine';
import { getHealthCenter, autoRecover } from '@/lib/connectivity/health';

export async function GET() {
  try {
    const instanceRows = await db.connectorInstance.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const installed = await Promise.all(instanceRows.map(mapInstance));
    const health = await getHealthCenter(installed);
    return NextResponse.json(health);
  } catch (err) {
    console.error('[Connectivity] Health error:', err);
    return NextResponse.json({ error: 'Failed to compute health center' }, { status: 500 });
  }
}

// ─── POST /api/connectivity/health — trigger auto-recovery ──────────────────────
export async function POST() {
  try {
    const result = await autoRecover();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('[Connectivity] Auto-recover error:', err);
    return NextResponse.json({ error: 'Auto-recovery failed' }, { status: 500 });
  }
}
