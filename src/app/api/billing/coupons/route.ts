// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Billing™ — Coupons API
//
// GET /api/billing/coupons?code=LAUNCH50&planId=professional&amount=299900
//   Returns: { ok: true, coupon: Coupon, discount: number }
//
// Validates a coupon code against a plan + amount. Returns the discount amount
// (in paise) that would apply. Used by the pricing page to preview the discount
// before the user clicks "Subscribe".
//
// POST /api/billing/coupons
//   Body: { organizationId, code }
//   Returns: { ok: true, coupon }
//
// Applies a coupon to the current subscription (used for retroactive
// application).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getCoupon } from '@/lib/billing-provider/service';
import { applyCoupon } from '@/lib/billing-provider/server/orchestrator';
import { friendlyBillingError, CouponInvalidError, CouponExpiredError } from '@/lib/billing-provider/errors';
import type { Coupon } from '@/lib/billing-provider/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code');
    const planId = req.nextUrl.searchParams.get('planId');
    const amount = Number(req.nextUrl.searchParams.get('amount') ?? 0);
    if (!code) {
      return NextResponse.json({ ok: false, error: 'code query param is required.' }, { status: 400 });
    }

    const coupon = await getCoupon(code);
    if (!coupon) {
      throw new CouponInvalidError(`Coupon code '${code}' not found.`);
    }
    if (coupon.status !== 'active') {
      throw new CouponInvalidError(`Coupon '${code}' is no longer active.`);
    }
    const now = Date.now();
    if (coupon.validUntil && new Date(coupon.validUntil).getTime() < now) {
      throw new CouponExpiredError();
    }
    if (coupon.applicablePlanIds.length > 0 && planId && !coupon.applicablePlanIds.includes(planId)) {
      throw new CouponInvalidError(`Coupon '${code}' is not valid for the '${planId}' plan.`);
    }
    if (coupon.minCartValue != null && amount < coupon.minCartValue) {
      throw new CouponInvalidError(
        `Coupon '${code}' requires a minimum amount of ${coupon.minCartValue} paise.`,
      );
    }

    // Compute discount.
    let discount = 0;
    if (coupon.discountType === 'percentage') {
      const rawDiscount = Math.round((amount * coupon.discountValue) / 100);
      discount = coupon.maxDiscount != null ? Math.min(rawDiscount, coupon.maxDiscount) : rawDiscount;
    } else {
      discount = Math.min(coupon.discountValue, amount);
    }

    return NextResponse.json({ ok: true, coupon, discount });
  } catch (err) {
    const { statusCode, code, message } = friendlyBillingError(err);
    console.error('[api/billing/coupons GET] error:', code, message);
    return NextResponse.json({ ok: false, error: message, code }, { status: statusCode });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organizationId, code } = body as { organizationId?: string; code?: string };

    if (!organizationId) {
      return NextResponse.json({ ok: false, error: 'organizationId is required.' }, { status: 400 });
    }
    if (!code) {
      return NextResponse.json({ ok: false, error: 'code is required.' }, { status: 400 });
    }

    const coupon: Coupon = await applyCoupon(organizationId, code);
    return NextResponse.json({ ok: true, coupon });
  } catch (err) {
    const { statusCode, code, message } = friendlyBillingError(err);
    console.error('[api/billing/coupons POST] error:', code, message);
    return NextResponse.json({ ok: false, error: message, code }, { status: statusCode });
  }
}
