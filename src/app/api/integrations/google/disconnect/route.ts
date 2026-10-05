// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/integrations/google/disconnect
// ═══════════════════════════════════════════════════════════════════════════════
// Disconnects the Google Workspace integration for the calling (org, user).
//
//   1. Best-effort revoke the token at Google.
//   2. Mark the GoogleWorkspaceToken row as revokedAt = now.
//
// Always returns `{ ok: true }` — even if Google's revoke endpoint fails, the
// local revoke is authoritative for the user's experience.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership } from "@/lib/auth/session";
import {
  disconnectGoogle,
  
} from '@/lib/integrations/google/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgId = req.headers.get('x-gstpilot-orgid');
  const userId = authResult.uid;
  const memberResult = await requireOrgMembership(userId, orgId);
  if (memberResult instanceof NextResponse) return memberResult;
  if (!orgId) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Missing workspace context.',
        code: 'NO_ORG_CONTEXT',
      },
      { status: 400 }
    );
  }

  await disconnectGoogle(orgId, userId);
  return NextResponse.json({ ok: true });
}
