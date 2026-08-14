// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real GSTN Integration™ — Public GSTIN Verification API
//
// POST /api/gstn/verify-gstin
//   Body: { organizationId, gstin }
//   Returns: { ok: true, result: VerifyGSTINResult }
//
// Public GSTIN lookup — does NOT require a connected session. Anyone can verify
// any GSTIN's legal name, trade name, status, and business constitution. Used
// during onboarding / customer creation to validate a GSTIN before connecting.
//
// SECURITY:
//   • requireAuth — must be signed in.
//   • requireOrgMembership — must be an active member of `organizationId`.
//   (Rate limiting on this endpoint is a future TODO — see GST-AUDIT-1 §8.)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifyGstin } from '@/lib/gstn-provider/server/orchestrator';
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
    const { organizationId, gstin } = body as {
      organizationId?: string;
      gstin?: string;
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

    if (!gstin || gstin.trim().length !== 15) {
      return NextResponse.json(
        { ok: false, error: 'A valid 15-character GSTIN is required.' },
        { status: 400 },
      );
    }

    const result = await verifyGstin(organizationId, gstin.trim());
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const statusCode = err instanceof GSTNError ? err.statusCode : 500;
    const code = err instanceof GSTNError ? err.code : 'UNKNOWN';
    console.error('[api/gstn/verify-gstin] error:', code, friendlyGSTNError(err));
    return NextResponse.json(
      { ok: false, error: friendlyGSTNError(err), code },
      { status: statusCode },
    );
  }
}
