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
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { completeConnection } from '@/lib/gstn-provider/server/orchestrator';
import { GSTNError, friendlyGSTNError } from '@/lib/gstn-provider/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organizationId, gstin, username, otp } = body as {
      organizationId?: string;
      gstin?: string;
      username?: string;
      otp?: string;
    };

    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'organizationId is required' },
        { status: 400 },
      );
    }
    if (!gstin || gstin.trim().length !== 15) {
      return NextResponse.json(
        { ok: false, error: 'A valid 15-character GSTIN is required.' },
        { status: 400 },
      );
    }
    if (!username || username.trim().length < 3) {
      return NextResponse.json(
        { ok: false, error: 'GST portal username is required.' },
        { status: 400 },
      );
    }
    if (!otp || otp.trim().length < 4) {
      return NextResponse.json(
        { ok: false, error: 'A valid OTP is required.' },
        { status: 400 },
      );
    }

    const result = await completeConnection(
      organizationId,
      gstin.trim(),
      username.trim(),
      otp.trim(),
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
