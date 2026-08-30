// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/integrations/google/status
// ═══════════════════════════════════════════════════════════════════════════════
// Returns the Google Workspace connection status for the calling (org, user).
//
// Status shape:
//   {
//     ok: true,
//     status: {
//       connected: boolean,
//       state: 'live' | 'stale' | 'disconnected',
//       email, googleUserId, connectedAt, updatedAt, expiryDate, scope,
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
import { requireAuth } from '@/lib/auth/session';
import {
  getConnectionStatus,
  resolveOrgUserFromHeaders,
} from '@/lib/integrations/google/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const { orgId, userId } = resolveOrgUserFromHeaders(req);
  if (!orgId || !userId) {
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
