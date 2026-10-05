// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real GSTN Integration™ — Sync API
//
// POST /api/gstn/sync
//   Body: {
//     organizationId,
//     connectionId,
//     encryptedSession,
//     scope: 'full' | 'profile' | 'returns' | 'notices' | 'ledgers'  (default 'full')
//   }
//   Returns: { ok: true, result: { profile?, returns?, notices?, ledgers? } }
//
// Performs a sync against GSTN. The server decrypts the session, calls the
// provider, stamps each result with `organizationId` + `connectionId`, and
// returns everything ready for the client to write to Firestore.
//
// The client then writes via the service layer:
//   - saveProfile()      for profile
//   - saveReturns()      for returns[]
//   - saveNotices()      for notices[]
//   - saveLedgers()      for ledgers[]
//   - updateConnection() to set lastSync + authStatus='session_active'
//   - createSyncJob()    to record the sync job for audit
//
// SECURITY:
//   • requireAuth — must be signed in.
//   • requireOrgMembership — must be an active member of `organizationId`.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import {
  fullSync,
  fetchProfile,
  fetchReturns,
  fetchNotices,
  fetchLedgers,
} from '@/lib/gstn-provider/server/orchestrator';
import { GSTNError, friendlyGSTNError } from '@/lib/gstn-provider/errors';
import { requireAuth, requireOrgMembership } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SyncScope = 'full' | 'profile' | 'returns' | 'notices' | 'ledgers';

export async function POST(req: NextRequest) {
  // ── 1. Authentication ─────────────────────────────────────────────────────
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  try {
    const body = await req.json();
    const { organizationId, connectionId, encryptedSession, scope = 'full' } = body as {
      organizationId?: string;
      connectionId?: string;
      encryptedSession?: string;
      scope?: SyncScope;
    };

    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'organizationId is required' },
        { status: 400 },
      );
    }

    // ── 2. Authorization — caller must be a member of organizationId ─────────
    const memberResult = await requireOrgMembership(uid, organizationId);
    if (memberResult instanceof NextResponse) return memberResult;

    if (!connectionId) {
      return NextResponse.json(
        { ok: false, error: 'connectionId is required' },
        { status: 400 },
      );
    }
    if (!encryptedSession) {
      return NextResponse.json(
        { ok: false, error: 'encryptedSession is required. Reconnect GST.', code: 'SESSION_EXPIRED' },
        { status: 401 },
      );
    }

    const validScopes: SyncScope[] = ['full', 'profile', 'returns', 'notices', 'ledgers'];
    if (!validScopes.includes(scope)) {
      return NextResponse.json(
        { ok: false, error: `scope must be one of: ${validScopes.join(', ')}` },
        { status: 400 },
      );
    }

    if (scope === 'full') {
      const result = await fullSync(organizationId, connectionId, encryptedSession);
      return NextResponse.json({ ok: true, result });
    }

    if (scope === 'profile') {
      const profile = await fetchProfile(organizationId, connectionId, encryptedSession);
      return NextResponse.json({ ok: true, result: { profile } });
    }
    if (scope === 'returns') {
      const returns = await fetchReturns(organizationId, connectionId, encryptedSession);
      return NextResponse.json({ ok: true, result: { returns } });
    }
    if (scope === 'notices') {
      const notices = await fetchNotices(organizationId, connectionId, encryptedSession);
      return NextResponse.json({ ok: true, result: { notices } });
    }
    // scope === 'ledgers'
    const ledgers = await fetchLedgers(organizationId, connectionId, encryptedSession);
    return NextResponse.json({ ok: true, result: { ledgers } });
  } catch (err) {
    const statusCode = err instanceof GSTNError ? err.statusCode : 500;
    const code = err instanceof GSTNError ? err.code : 'UNKNOWN';
    console.error('[api/gstn/sync] error:', code, friendlyGSTNError(err));
    return NextResponse.json(
      { ok: false, error: friendlyGSTNError(err), code },
      { status: statusCode },
    );
  }
}
