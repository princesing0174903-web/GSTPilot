// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Billing™ — Health API
//
// GET /api/billing/health?organizationId=...
//   Returns the org's billing health snapshot.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { BillingError, friendlyBillingError } from '@/lib/billing-provider/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const organizationId = req.nextUrl.searchParams.get('organizationId');
    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'organizationId is required.' },
        { status: 400 },
      );
    }
    const { getBillingHealth } = await import('@/lib/billing-provider/server/orchestrator');
    const health = await getBillingHealth(organizationId);
    return NextResponse.json({ ok: true, ...health });
  } catch (err) {
    const statusCode = err instanceof BillingError ? err.statusCode : 500;
    const code = err instanceof BillingError ? err.code : 'UNKNOWN';
    console.error('[api/billing/health] error:', code, friendlyBillingError(err));
    return NextResponse.json(
      { ok: false, error: friendlyBillingError(err), code },
      { status: statusCode },
    );
  }
}
