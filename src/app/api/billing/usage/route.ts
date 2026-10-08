// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Billing™ — Usage API
//
// GET /api/billing/usage?organizationId=...
//   Returns the org's current-period usage by metric + plan limits + percent.
//
// POST /api/billing/usage
//   Body: { organizationId, metric, quantity, metadata? }
//   Records a usage event. Requires an active subscription (for subscriptionId).
//   Returns: { ok: true, recordId }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import {
  getSubscription,
  getUsageForPeriod,
  recordUsage,
} from '@/lib/billing-provider/service';
import { getPlan } from '@/lib/billing-provider/server/plans';
import { BillingError, friendlyBillingError } from '@/lib/billing-provider/errors';
import type { UsageMetricType } from '@/lib/billing-provider/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_METRICS: UsageMetricType[] = [
  'oracle_requests',
  'storage_bytes',
  'ai_tokens',
  'invoices_generated',
  'returns_filed',
  'api_calls',
  'automation_runs',
];

// ─── GET: read usage for the current period ─────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const organizationId = req.nextUrl.searchParams.get('organizationId');
    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'organizationId is required.' },
        { status: 400 },
      );
    }

    const subscription = await getSubscription(organizationId);
    if (!subscription) {
      // No subscription → return zeroed usage with Free plan limits.
      const freePlan = getPlan('free');
      const limits = freePlan
        ? {
            oracle_requests: freePlan.limits.oracleRequestsMonthly,
            storage_bytes: freePlan.limits.storageBytes,
            ai_tokens: freePlan.limits.aiCreditsMonthly,
            invoices_generated: freePlan.limits.invoicesMonthly,
            returns_filed: freePlan.limits.returnsMonthly,
            api_calls: freePlan.limits.apiCallsMonthly,
            automation_runs: freePlan.limits.automationRunsMonthly,
          }
        : null;
      const usage: Record<UsageMetricType, number> = {
        oracle_requests: 0,
        storage_bytes: 0,
        ai_tokens: 0,
        invoices_generated: 0,
        returns_filed: 0,
        api_calls: 0,
        automation_runs: 0,
      };
      return NextResponse.json({ ok: true, usage, limits, percent: {} });
    }

    const records = await getUsageForPeriod(
      organizationId,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
    );

    // Aggregate by metric.
    const usage: Record<UsageMetricType, number> = {
      oracle_requests: 0,
      storage_bytes: 0,
      ai_tokens: 0,
      invoices_generated: 0,
      returns_filed: 0,
      api_calls: 0,
      automation_runs: 0,
    };
    for (const r of records) {
      if (r.metric in usage) usage[r.metric] += r.quantity;
    }

    // Plan limits.
    const plan = getPlan(subscription.planId);
    const limits = plan
      ? {
          oracle_requests: plan.limits.oracleRequestsMonthly,
          storage_bytes: plan.limits.storageBytes,
          ai_tokens: plan.limits.aiCreditsMonthly,
          invoices_generated: plan.limits.invoicesMonthly,
          returns_filed: plan.limits.returnsMonthly,
          api_calls: plan.limits.apiCallsMonthly,
          automation_runs: plan.limits.automationRunsMonthly,
        }
      : null;

    // Percent.
    const percent: Record<string, number> = {};
    if (limits) {
      for (const m of VALID_METRICS) {
        const limit = limits[m];
        percent[m] = limit === Infinity ? 0 : Math.min(100, Math.round((usage[m] / limit) * 100));
      }
    }

    return NextResponse.json({ ok: true, usage, limits, percent });
  } catch (err) {
    const statusCode = err instanceof BillingError ? err.statusCode : 500;
    const code = err instanceof BillingError ? err.code : 'UNKNOWN';
    console.error('[api/billing/usage GET] error:', code, friendlyBillingError(err));
    return NextResponse.json(
      { ok: false, error: friendlyBillingError(err), code },
      { status: statusCode },
    );
  }
}

// ─── POST: record a usage event ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organizationId, metric, quantity, metadata } = body as {
      organizationId?: string;
      metric?: UsageMetricType;
      quantity?: number;
      metadata?: Record<string, unknown>;
    };

    if (!organizationId) {
      return NextResponse.json({ ok: false, error: 'organizationId is required.' }, { status: 400 });
    }
    if (!metric || !VALID_METRICS.includes(metric)) {
      return NextResponse.json(
        { ok: false, error: `metric must be one of: ${VALID_METRICS.join(', ')}` },
        { status: 400 },
      );
    }
    if (quantity === undefined || quantity <= 0) {
      return NextResponse.json({ ok: false, error: 'quantity must be greater than 0.' }, { status: 400 });
    }

    const subscription = await getSubscription(organizationId);
    if (!subscription) {
      return NextResponse.json(
        { ok: false, error: 'No active subscription found. Subscribe to a plan first.' },
        { status: 404 },
      );
    }

    const recordId = await recordUsage(
      organizationId,
      subscription.id,
      metric,
      quantity,
      metadata,
    );
    return NextResponse.json({ ok: true, recordId });
  } catch (err) {
    const statusCode = err instanceof BillingError ? err.statusCode : 500;
    const code = err instanceof BillingError ? err.code : 'UNKNOWN';
    console.error('[api/billing/usage POST] error:', code, friendlyBillingError(err));
    return NextResponse.json(
      { ok: false, error: friendlyBillingError(err), code },
      { status: statusCode },
    );
  }
}
