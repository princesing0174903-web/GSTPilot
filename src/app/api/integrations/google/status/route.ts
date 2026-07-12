// ═══════════════════════════════════════════════════════════════════════════════
// /api/integrations/google/status — Google Workspace connection status
//
// GET /api/integrations/google/status
//   Headers: x-gstpilot-orgid, x-gstpilot-actor
//   Response: { ok: true, status: ConnectionStatus }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getConnectionStatus, resolveOrgUserFromHeaders } from '@/lib/google-workspace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { orgId, userId } = resolveOrgUserFromHeaders(req);
    if (!orgId || !userId) {
      return NextResponse.json(
        { ok: false, error: 'Organization + user context required.' },
        { status: 400 },
      );
    }
    const status = await getConnectionStatus(orgId, userId);
    return NextResponse.json({ ok: true, status });
  } catch (err) {
    console.error('[/api/integrations/google/status] error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Status check failed.' },
      { status: 500 },
    );
  }
}
