// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/platform/create-org
// Create a new customer organisation on the SaaS platform. Provisions an
// isolated tenant (workspace + AGI instance + devops environments + identity
// provider + subscription). Audit-logged.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensurePlatformOrganizationsSeeded } from '@/lib/platform/organizations';
import { PLAN_MAP } from '@/lib/platform/plans';
import { invalidatePlatformCache } from '@/lib/platform/orchestrator';
import type { PlanKey } from '@/lib/platform/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'organization';
}

export async function POST(request: Request) {
  try {
    await ensurePlatformOrganizationsSeeded();

    const body = await request.json().catch(() => ({}));
    const name: string = body.name ?? 'New Organisation';
    const plan: PlanKey = (body.plan as PlanKey) ?? 'professional';
    const planDef = PLAN_MAP[plan] ?? PLAN_MAP.professional;
    const billingCycle: 'monthly' | 'annual' = body.billingCycle === 'annual' ? 'annual' : 'monthly';
    const ownerEmail: string = body.ownerEmail ?? 'owner@neworg.in';
    const ownerName: string = body.ownerName ?? 'Owner';
    const country: string = body.country ?? 'IN';
    const timezone: string = body.timezone ?? 'Asia/Kolkata';
    const industry: string = body.industry ?? 'Services';
    const seats: number = Math.max(1, Number(body.seats) || 1);

    // Ensure slug uniqueness
    let slug = slugify(name);
    const existingSlug = await db.platformOrganization.findUnique({ where: { slug } });
    if (existingSlug) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

    const org = await db.platformOrganization.create({
      data: {
        name, slug, domain: slug + '.in', legalName: name,
        country, timezone, currency: 'INR',
        organizationType: 'standalone', plan,
        planStatus: 'trial',
        trialEndsAt: new Date(Date.now() + 14 * 86400000),
        status: 'active', industry,
        employeeCount: seats, monthlyRevenue: 0,
        seatsUsed: 1, seatsLimit: planDef.limits.seats ?? 250,
        storageUsedMb: 0, storageLimitMb: planDef.limits.storageGb * 1024,
        apiCallsMonth: 0, aiCreditsUsed: 0, aiCreditsLimit: planDef.limits.aiCreditsPerMonth,
        healthScore: 75, churnRisk: 0.2,
        branding: JSON.stringify({ primaryColor: '#0ea5e9', accentColor: '#14b8a6', loginHeading: name, emailFromName: name, domain: slug + '.in' }),
        settings: JSON.stringify({ isolatedTenant: true, agiInstance: plan, region: 'ap-south-1' }),
        provisioningState: 'provisioned', provisionedAt: new Date(),
      },
    });

    // Provision owner tenant user
    await db.platformTenantUser.create({
      data: {
        organizationId: org.id, email: ownerEmail, name: ownerName, role: 'owner',
        status: 'active', mfaEnabled: false, joinedAt: new Date(),
      },
    });

    // Provision email identity provider
    await db.platformIdentityProvider.create({
      data: {
        organizationId: org.id, provider: 'email', label: 'Email & Password',
        status: 'connected',
        config: JSON.stringify({ ssoReady: false, supportsMfa: true, supportsPasswordless: true }),
        userCount: 1, lastSyncAt: new Date(),
      },
    });

    // Provision subscription (trial)
    await db.platformSubscription.create({
      data: {
        organizationId: org.id, plan, billingCycle, status: 'trial', seats,
        seatPrice: planDef.seatPrice, monthlyBase: planDef.monthlyPrice, annualBase: planDef.annualPrice,
        discountPct: billingCycle === 'annual' ? 10 : 0,
        trialStartsAt: new Date(), trialEndsAt: new Date(Date.now() + 14 * 86400000),
      },
    });

    // Provision devops environments
    for (const env of [
      { name: 'production', type: 'production', replicas: 2, strategy: 'blue_green' },
      { name: 'staging', type: 'staging', replicas: 1, strategy: 'rolling' },
      { name: 'development', type: 'development', replicas: 1, strategy: 'recreate' },
    ]) {
      await db.platformDevopsEnvironment.create({
        data: {
          organizationId: org.id, name: env.name, environmentType: env.type,
          region: 'ap-south-1', version: 'v1.0.0', status: 'healthy', strategy: env.strategy,
          replicas: env.replicas, uptimePct: 100, latencyMs: 95, errorRatePct: 0,
          cpuUsagePct: 25, memUsageMb: 450, lastDeployAt: new Date(), lastDeployBy: 'oracle',
        },
      });
    }

    // Provision customer health record
    await db.platformCustomerHealth.create({
      data: {
        organizationId: org.id, score: 75, adoptionPct: 30,
        featureUsage: JSON.stringify({ gst: 0.4, ai: 0.1, banking: 0, marketplace: 0 }),
        churnRisk: 0.2, expansionScore: 0.1, openTickets: 0, satisfaction: 4.0,
        lastContactAt: new Date(),
        recommendedActions: JSON.stringify(['Schedule onboarding call', 'Demo AI CFO', 'Configure branding']),
      },
    });

    // Audit log
    await db.platformAuditEvent.create({
      data: {
        organizationId: org.id, actor: ownerEmail, action: 'organization.created',
        category: 'admin', severity: 'info',
        details: JSON.stringify({ name, plan, billingCycle, seats, industry }),
      },
    });

    invalidatePlatformCache();

    return NextResponse.json(
      { success: true, organizationId: org.id, slug: org.slug, provisioningState: 'provisioned', trialEndsAt: org.trialEndsAt },
      { status: 201, headers: { 'X-Platform': 'true' } },
    );
  } catch (error) {
    console.error('[Platform create-org] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create organisation', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
