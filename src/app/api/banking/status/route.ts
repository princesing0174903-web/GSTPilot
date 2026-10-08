// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Real Banking Foundation™ — Provider Status API
//
// GET /api/banking/status
//   Returns: { ok: true, result: { healthy, name, provider, isLive } }
//
// Health check for the active banking provider. Used by the dashboard to show
// whether banking sync is operational.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership } from '@/lib/auth/session';
import { providerHealthCheck } from '@/lib/banking-provider/server/orchestrator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;
    const url = new URL(req.url);
    const orgId = url.searchParams.get('organizationId') || 'local';
    const org = await requireOrgMembership(uid, orgId);
    if (org instanceof NextResponse) return org;

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
