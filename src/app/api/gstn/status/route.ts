// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Real GSTN Integration™ — Provider Status API
//
// GET /api/gstn/status
//   Returns: { ok: true, result: { healthy, name, isLive } }
//
// Lightweight health check — returns which GSTN provider is active (Mock vs
// Official) and whether it's reachable. Used by the UI to show a diagnostics
// badge and by the scheduler to decide whether to attempt a sync.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { providerHealthCheck } from '@/lib/gstn-provider/server/orchestrator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const result = await providerHealthCheck();
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error('[api/gstn/status] error:', err);
    return NextResponse.json(
      {
        ok: true,
        result: { healthy: false, name: 'unknown', isLive: false },
      },
      { status: 200 },
    );
  }
}
