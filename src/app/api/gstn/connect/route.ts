// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real GSTN Integration™ — Connect (Request OTP) API
//
// POST /api/gstn/connect
//   Body: { organizationId, gstin, username }
//   Returns: { ok: true, result: ConnectResult }
//
// Step 1 of the GST connect flow — requests GSTN to send an OTP to the
// registered mobile/email. The client then writes a `gst_connections` doc with
// authStatus='otp_requested' and prompts the user for the OTP.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { initiateConnection } from '@/lib/gstn-provider/server/orchestrator';
import { GSTNError, friendlyGSTNError } from '@/lib/gstn-provider/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organizationId, gstin, username } = body as {
      organizationId?: string;
      gstin?: string;
      username?: string;
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
        { ok: false, error: 'GST portal username must be at least 3 characters.' },
        { status: 400 },
      );
    }

    const result = await initiateConnection(organizationId, gstin.trim(), username.trim());
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const statusCode = err instanceof GSTNError ? err.statusCode : 500;
    const code = err instanceof GSTNError ? err.code : 'UNKNOWN';
    console.error('[api/gstn/connect] error:', code, friendlyGSTNError(err));
    return NextResponse.json(
      { ok: false, error: friendlyGSTNError(err), code },
      { status: statusCode },
    );
  }
}
