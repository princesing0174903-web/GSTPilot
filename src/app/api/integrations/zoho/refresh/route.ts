// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/integrations/zoho/refresh
// ═══════════════════════════════════════════════════════════════════════════════
// Force a Zoho access-token refresh for the calling (org, user).
//
// This is a no-op if the token is still valid (the next call will use it as-is)
// — but it's useful when the user wants to force-refresh after a stale event.
//
// Returns:
//   • 200 { ok: true, status: {...} }   — refresh succeeded (or token was live)
//   • 401 { ok: false, code: 'AUTH_REVOKED' }  — refresh token revoked
//   • 503 { ok: false, code: 'AUTH_STALE' }    — temp refresh failure
//   • 400 — missing orgId/userId
//   • 401 — auth required (from requireAuth)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership } from "@/lib/auth/session";
import {
  getValidAccessToken,
  getConnectionStatus,
  
} from '@/lib/integrations/zoho/oauth';

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

  const result = await getValidAccessToken(orgId, userId);
  if (!result.accessToken) {
    if (result.permanent) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Zoho access was revoked. Please reconnect.',
          code: 'AUTH_REVOKED',
        },
        { status: 401 }
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: 'Temporarily unable to reach Zoho. Please retry in a moment.',
        code: 'AUTH_STALE',
      },
      { status: 503 }
    );
  }

  // Refresh succeeded (or the token was already live) — return fresh status.
  const status = await getConnectionStatus(orgId, userId);
  return NextResponse.json({ ok: true, status });
}
