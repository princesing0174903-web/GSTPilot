// GET /api/platform/subscriptions — list subscriptions across organisations
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensurePlatformOrganizationsSeeded } from '@/lib/platform/organizations';
import { PLAN_MAP } from '@/lib/platform/plans';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    await ensurePlatformOrganizationsSeeded();
    const subs = await db.platformSubscription.findMany({ orderBy: { createdAt: 'desc' } });
    const orgs = await db.platformOrganization.findMany();
    const orgMap = new Map(orgs.map((o) => [o.id, o]));
    const result = subs.map((s) => ({
      id: s.id,
      organizationId: s.organizationId,
      organizationName: orgMap.get(s.organizationId)?.name ?? 'Unknown',
      plan: s.plan,
      planName: PLAN_MAP[s.plan as keyof typeof PLAN_MAP]?.name ?? s.plan,
      billingCycle: s.billingCycle,
      status: s.status,
      seats: s.seats,
      seatPrice: s.seatPrice,
      monthlyBase: s.monthlyBase,
      annualBase: s.annualBase,
      discountPct: s.discountPct,
      couponCode: s.couponCode,
      trialStartsAt: s.trialStartsAt?.toISOString() ?? null,
      trialEndsAt: s.trialEndsAt?.toISOString() ?? null,
      currentPeriodStart: s.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
      cancelledAt: s.cancelledAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
    }));
    return NextResponse.json(
      { count: result.length, subscriptions: result },
      { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Platform': 'true' } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to list subscriptions', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
