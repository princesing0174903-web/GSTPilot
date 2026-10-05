// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/integrations/zoho/status
// ═══════════════════════════════════════════════════════════════════════════════
// Returns the Zoho Books connection status for the calling (org, user).
//
// Status shape:
//   {
//     ok: true,
//     status: {
//       connected: boolean,
//       state: 'live' | 'stale' | 'disconnected',
//       email, zohoUserId, zohoOrgId, zohoOrgName, dataCenter, apiDomain,
//       connectedAt, updatedAt, expiryDate, scope,
//       error: string | null,
//       permanent: boolean
//     }
//   }
//
//   • `live`         — token valid + (refresh succeeded if was expired)
//   • `stale`        — refresh failed with a TEMPORARY error (429/5xx/network)
//                      → still connected, retry later
//   • `disconnected` — no row, revoked, OR refresh failed permanently
//                      (refresh token revoked) → user must re-connect
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership } from "@/lib/auth/session";
import {
  getConnectionStatus,
  
} from '@/lib/integrations/zoho/oauth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
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

  const status = await getConnectionStatus(orgId, userId);
  return NextResponse.json({ ok: true, status });
}
