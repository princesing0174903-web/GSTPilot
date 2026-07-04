// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Banking Foundation™ — Provider Status API
//
// GET /api/banking/status
//   Returns: { ok: true, result: { healthy, name, provider, isLive } }
//
// Health check for the active banking provider. Used by the dashboard to show
// whether banking sync is operational.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { providerHealthCheck } from '@/lib/banking-provider/server/orchestrator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const result = await providerHealthCheck();
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json(
      {
        ok: true,
        result: { healthy: false, name: 'Unknown', provider: 'mock', isLive: false },
      },
      { status: 200 },
    );
  }
}
