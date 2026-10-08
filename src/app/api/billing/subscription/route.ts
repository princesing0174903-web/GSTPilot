// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Billing™ — Subscription API
//
// GET /api/billing/subscription?organizationId=...
//   Returns the org's active subscription + billing health snapshot.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getSubscription } from '@/lib/billing-provider/service';
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
    const [subscription, health] = await Promise.all([
      getSubscription(organizationId),
      getBillingHealth(organizationId),
    ]);

    return NextResponse.json({ ok: true, subscription, health });
  } catch (err) {
    const statusCode = err instanceof BillingError ? err.statusCode : 500;
    const code = err instanceof BillingError ? err.code : 'UNKNOWN';
    console.error('[api/billing/subscription] error:', code, friendlyBillingError(err));
    return NextResponse.json(
      { ok: false, error: friendlyBillingError(err), code },
      { status: statusCode },
    );
  }
}
