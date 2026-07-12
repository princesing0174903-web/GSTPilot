// ═══════════════════════════════════════════════════════════════════════════════
// /api/integrations/google/disconnect — Revoke + delete Google tokens
//
// POST /api/integrations/google/disconnect
//   Headers: x-gstpilot-orgid, x-gstpilot-actor
//   Response: { ok: true } | { ok: false, error }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { disconnectGoogle, resolveOrgUserFromHeaders } from '@/lib/google-workspace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { orgId, userId } = resolveOrgUserFromHeaders(req);
    if (!orgId || !userId) {
      return NextResponse.json(
        { ok: false, error: 'Organization + user context required.' },
        { status: 400 },
      );
    }
    const { error } = await disconnectGoogle(orgId, userId);
    if (error) return NextResponse.json({ ok: false, error }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/integrations/google/disconnect] error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Disconnect failed.' },
      { status: 500 },
    );
  }
}
