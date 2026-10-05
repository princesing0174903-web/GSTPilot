// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE CHAT — Conversations List API
// GET /api/oracle-chat/conversations
//
// Returns all persisted OracleAISession rows (newest first). These survive
// page refreshes — real database memory, not browser memory.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { listSessions } from '@/lib/oracle-chat/persistence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;
  const url = new URL(req.url);
  const orgId0 = url.searchParams.get('orgId') || url.searchParams.get('organizationId') || url.searchParams.get('firmId') || '';
  if (orgId0) {
    const orgResult = await requireOrgMembership(uid, orgId0);
    if (orgResult instanceof NextResponse) return orgResult;
  }

  try {
    const conversations = await listSessions();
    return NextResponse.json({ conversations });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load conversations';
    return NextResponse.json({ conversations: [], error: msg }, { status: 500 });
  }
}
