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
    // Status check is a SAFE READ — never throw 400 when auth context is
    // missing. Instead return a deterministic `connected: false` status so
    // the client UI shows "Not connected" (rather than a misleading
    // "credentials missing" error). The hook still retries once the
    // org/user context becomes available.
    if (!orgId || !userId) {
      return NextResponse.json({
        ok: true,
        status: {
          connected: false,
          userEmail: null,
          googleUserId: null,
          connectedAt: null,
          scopes: [],
          requiresAuth: true,
        },
      });
    }
    const status = await getConnectionStatus(orgId, userId);
    return NextResponse.json({ ok: true, status });
  } catch (err) {
    console.error('[/api/integrations/google/status] error:', err);
    // Even on a server error, return `connected: false` rather than 500 —
    // a transient DB error should never make the UI report
    // "credentials not configured".
    return NextResponse.json({
      ok: true,
      status: {
        connected: false,
        userEmail: null,
        googleUserId: null,
        connectedAt: null,
        scopes: [],
        requiresAuth: true,
      },
    });
  }
}
