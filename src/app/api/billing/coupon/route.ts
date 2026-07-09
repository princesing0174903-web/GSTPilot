// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Billing™ — Apply Coupon API
// POST /api/billing/coupon
//   Body: ApplyCouponInput
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { BillingError, friendlyBillingError } from '@/lib/billing-provider/errors';
import type { ApplyCouponInput } from '@/lib/billing-provider/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ApplyCouponInput & {
      appliedBy?: { uid: string; name: string; email: string };
    };

    if (!body.organizationId) return NextResponse.json({ ok: false, error: 'organizationId is required.' }, { status: 400 });
    if (!body.subscriptionId) return NextResponse.json({ ok: false, error: 'subscriptionId is required.' }, { status: 400 });
    if (!body.couponCode || !body.couponCode.trim()) return NextResponse.json({ ok: false, error: 'couponCode is required.' }, { status: 400 });
    if (!body.appliedBy) body.appliedBy = { uid: '', name: '', email: '' };

    const { applyCoupon } = await import('@/lib/billing-provider/server/orchestrator');
    const result = await applyCoupon(body);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const statusCode = err instanceof BillingError ? err.statusCode : 500;
    const code = err instanceof BillingError ? err.code : 'UNKNOWN';
    console.error('[api/billing/coupon] error:', code, friendlyBillingError(err));
    return NextResponse.json({ ok: false, error: friendlyBillingError(err), code }, { status: statusCode });
  }
}
