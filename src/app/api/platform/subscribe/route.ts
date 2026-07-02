// POST /api/platform/subscribe — subscribe an org to a plan
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensurePlatformOrganizationsSeeded } from '@/lib/platform/organizations';
import { PLAN_MAP } from '@/lib/platform/plans';
import { invalidatePlatformCache } from '@/lib/platform/orchestrator';
import type { PlanKey } from '@/lib/platform/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    await ensurePlatformOrganizationsSeeded();
    const body = await request.json().catch(() => ({}));
    const organizationId: string = body.organizationId;
    const plan: PlanKey = (body.plan as PlanKey) ?? 'professional';
    const billingCycle: 'monthly' | 'annual' = body.billingCycle === 'annual' ? 'annual' : 'monthly';
    const seats: number = Math.max(1, Number(body.seats) || 1);
    const couponCode: string | undefined = body.couponCode;
    const changedBy: string = body.changedBy ?? 'owner@gstpilot.ai';

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const planDef = PLAN_MAP[plan] ?? PLAN_MAP.professional;
    const discountPct = billingCycle === 'annual' ? 10 : couponCode ? 15 : 0;
    const monthlyBase = planDef.monthlyPrice * (1 - discountPct / 100);
    const annualBase = monthlyBase * 12;

    const org = await db.platformOrganization.findUnique({ where: { id: organizationId } });
    if (!org) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });

    // Update the org's plan + plan status
    await db.platformOrganization.update({
      where: { id: organizationId },
      data: {
        plan, planStatus: 'active', trialEndsAt: null,
        monthlyRevenue: monthlyBase, seatsLimit: planDef.limits.seats ?? 250,
        storageLimitMb: planDef.limits.storageGb * 1024,
        aiCreditsLimit: planDef.limits.aiCreditsPerMonth,
      },
    });

    // Deactivate existing subscriptions and create a new one
    await db.platformSubscription.updateMany({
      where: { organizationId, status: { in: ['active', 'trial'] } },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });

    const subscription = await db.platformSubscription.create({
      data: {
        organizationId, plan, billingCycle, status: 'active', seats,
        seatPrice: planDef.seatPrice, monthlyBase, annualBase, discountPct,
        couponCode: couponCode ?? null,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + (billingCycle === 'annual' ? 365 : 30) * 86400000),
      },
    });

    await db.platformAuditEvent.create({
      data: {
        organizationId, actor: changedBy, action: 'billing.subscribed',
        category: 'billing', severity: 'info',
        details: JSON.stringify({ plan, billingCycle, seats, monthlyBase, couponCode }),
      },
    });

    invalidatePlatformCache();

    return NextResponse.json(
      {
        success: true, subscriptionId: subscription.id, plan, billingCycle,
        monthlyBase, annualBase, seats, discountPct, couponCode: couponCode ?? null,
      },
      { status: 201, headers: { 'X-Platform': 'true' } },
    );
  } catch (error) {
    console.error('[Platform subscribe] Error:', error);
    return NextResponse.json(
      { error: 'Failed to subscribe', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
