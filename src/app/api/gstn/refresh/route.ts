// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real GSTN Integration™ — Refresh Session API
//
// POST /api/gstn/refresh
//   Body: { organizationId, encryptedSession }
//   Returns: { ok: true, result: { encryptedSession, sessionExpiry } }
//
// Refreshes an expired (or soon-to-expire) GSTN session using the refresh
// token. The client passes the current encrypted session blob; the server
// decrypts it, refreshes, re-encrypts, and returns the new blob. The client
// then writes the new encryptedSession + sessionExpiry to Firestore.
//
// SECURITY:
//   • requireAuth — must be signed in.
//   • requireOrgMembership — must be an active member of `organizationId`.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { refreshSession } from '@/lib/gstn-provider/server/orchestrator';
import { GSTNError, friendlyGSTNError } from '@/lib/gstn-provider/errors';
import { requireAuth, requireOrgMembership } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // ── 1. Authentication ─────────────────────────────────────────────────────
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  try {
    const body = await req.json();
    const { organizationId, encryptedSession } = body as {
      organizationId?: string;
      encryptedSession?: string;
    };

    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'organizationId is required.' },
        { status: 400 },
      );
    }

    // ── 2. Authorization — caller must be a member of organizationId ─────────
    const memberResult = await requireOrgMembership(uid, organizationId);
    if (memberResult instanceof NextResponse) return memberResult;

    if (!encryptedSession) {
      return NextResponse.json(
        { ok: false, error: 'encryptedSession is required.', code: 'SESSION_EXPIRED' },
        { status: 401 },
      );
    }

    const result = await refreshSession(encryptedSession);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const statusCode = err instanceof GSTNError ? err.statusCode : 500;
    const code = err instanceof GSTNError ? err.code : 'UNKNOWN';
    console.error('[api/gstn/refresh] error:', code, friendlyGSTNError(err));
    return NextResponse.json(
      { ok: false, error: friendlyGSTNError(err), code },
      { status: statusCode },
    );
  }
}
