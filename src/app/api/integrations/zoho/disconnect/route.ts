// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/integrations/zoho/disconnect
// ═══════════════════════════════════════════════════════════════════════════════
// Disconnects the Zoho Books integration for the calling (org, user).
//
//   1. (No remote revoke — Zoho has no revoke endpoint. The user must
//      manually revoke the app from their Zoho account page if they want
//      the refresh token invalidated immediately.)
//   2. Mark the ZohoBooksToken row as revokedAt = now.
//
// Always returns `{ ok: true }` — the local revoke is authoritative for the
// user's experience.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership } from "@/lib/auth/session";
import {
  disconnectZoho,
  resolveOrgFromHeaders,
} from '@/lib/integrations/zoho/oauth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgId = resolveOrgFromHeaders(req);
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

  await disconnectZoho(orgId, userId);
  return NextResponse.json({ ok: true });
}
