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
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifyGstin } from '@/lib/gstn-provider/server/orchestrator';
import { GSTNError, friendlyGSTNError } from '@/lib/gstn-provider/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
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
