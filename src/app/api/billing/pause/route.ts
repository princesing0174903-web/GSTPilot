// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Billing™ — Pause API
// POST /api/billing/pause
//   Body: { organizationId, subscriptionId, reason? }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { BillingError, friendlyBillingError } from '@/lib/billing-provider/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organizationId, subscriptionId, reason } = body as {
      organizationId?: string;
      subscriptionId?: string;
      reason?: string;
    };

    if (!organizationId) return NextResponse.json({ ok: false, error: 'organizationId is required.' }, { status: 400 });
    if (!subscriptionId) return NextResponse.json({ ok: false, error: 'subscriptionId is required.' }, { status: 400 });

    const { pauseSubscription } = await import('@/lib/billing-provider/server/orchestrator');
    const subscription = await pauseSubscription(organizationId, subscriptionId, reason);
    return NextResponse.json({ ok: true, subscription });
  } catch (err) {
    const statusCode = err instanceof BillingError ? err.statusCode : 500;
    const code = err instanceof BillingError ? err.code : 'UNKNOWN';
    console.error('[api/billing/pause] error:', code, friendlyBillingError(err));
    return NextResponse.json({ ok: false, error: friendlyBillingError(err), code }, { status: statusCode });
  }
}
