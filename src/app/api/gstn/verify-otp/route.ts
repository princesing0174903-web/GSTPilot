// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real GSTN Integration™ — Verify OTP API
//
// POST /api/gstn/verify-otp
//   Body: { organizationId, gstin, username, otp }
//   Returns: { ok: true, result: VerifyOTPResult }
//     where VerifyOTPResult = { encryptedSession, sessionExpiry, profile }
//
// Step 2 of the GST connect flow — verifies the OTP with GSTN, establishes a
// session, encrypts it (AES-256-GCM), and returns the encrypted blob + initial
// profile. The client writes both to Firestore (gst_connections + gst_profiles).
//
// SECURITY (POLISH-06):
//   • requireAuth — must be signed in.
//   • requireOrgMembership — must be an active member of `organizationId`.
//   • zod validation via schemas.gstnVerifyOtp (no manual parsing).
//   • Rate-limited via RATE_LIMIT_PRESETS.otp (5 req/min per uid+ip) to
//     prevent OTP brute force.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { completeConnection } from '@/lib/gstn-provider/server/orchestrator';
import { GSTNError, friendlyGSTNError } from '@/lib/gstn-provider/errors';
import { requireAuth, requireOrgMembership } from '@/lib/auth/session';
import { rateLimit, rateLimitedResponse, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';
import { parseBody, schemas } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // ── 1. Rate limit (tight — OTP brute force protection) ────────────────────
  // Apply before auth so unauthenticated flooders still get throttled. The key
  // is per-IP at this stage; after auth we'd add uid too.
  const rl = rateLimit(req, RATE_LIMIT_PRESETS.otp, 'gstn-verify-otp');
  if (rl.denied) {
    return rateLimitedResponse(rl.retryAfterSec, 'Too many OTP attempts. Please wait a minute and try again.');
  }

  // ── 2. Authentication ─────────────────────────────────────────────────────
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  try {
    // ── 3. Validate body via zod ────────────────────────────────────────────
    const [body, validationErr] = await parseBody(req, schemas.gstnVerifyOtp);
    if (validationErr) return validationErr;

    // ── 4. Authorization — caller must be a member of organizationId ────────
    const memberResult = await requireOrgMembership(uid, body.organizationId);
    if (memberResult instanceof NextResponse) return memberResult;

    const result = await completeConnection(
      body.organizationId,
      body.gstin,
      body.username,
      body.otp,
    );
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const statusCode = err instanceof GSTNError ? err.statusCode : 500;
    const code = err instanceof GSTNError ? err.code : 'UNKNOWN';
    console.error('[api/gstn/verify-otp] error:', code, friendlyGSTNError(err));
    return NextResponse.json(
      { ok: false, error: friendlyGSTNError(err), code },
      { status: statusCode },
    );
  }
}
