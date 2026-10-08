// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Real GSTN Integration™ — Disconnect API
//
// POST /api/gstn/disconnect
//   Body: { organizationId, encryptedSession }
//   Returns: { ok: true }
//
// Invalidates the GSTN session server-side (idempotent — does not throw if the
// session is already invalid). The client is responsible for deleting the
// Firestore connection doc + cascading deletes (profiles/returns/notices/
// ledgers) via `cascadeDisconnect()` from the service layer.
//
// SECURITY:
//   • requireAuth — must be signed in.
//   • requireOrgMembership — must be an active member of `organizationId`.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { terminateConnection } from '@/lib/gstn-provider/server/orchestrator';
import { requireAuth, requireOrgMembership } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // ── 1. Authentication ─────────────────────────────────────────────────────
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const { organizationId, encryptedSession } = body as {
      organizationId?: string;
      encryptedSession?: string | null;
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

    // Idempotent — passing null/empty is a no-op.
    await terminateConnection(encryptedSession ?? null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Disconnect is intentionally lenient — never surface a hard error to the
    // user. They're disconnecting; the session may already be dead.
    console.warn('[api/gstn/disconnect] non-fatal error:', err);
    return NextResponse.json({ ok: true });
  }
}
