// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Module™ — Cash Flow API (TASK 12)
//
// GET /api/banking/cashflow?organizationId=...&period=7d|30d|90d|1y
//   → getCashFlow(orgId, period)
//
// Returns daily inflow/outflow/net/closingBalance for the trailing window,
// plus openingBalance + averages. Persists daily snapshots idempotently
// (unique constraint [orgId, date, period]).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { ensureSeeded, getCashFlow } from '@/lib/banking-prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_PERIODS = new Set(['7d', '30d', '90d', '1y']);

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;
    const url = new URL(req.url);
    const orgId = url.searchParams.get('organizationId') || 'local';
    const org = await requireOrgMembership(uid, orgId);
    if (org instanceof NextResponse) return org;

    await ensureSeeded(orgId);

    const periodParam = url.searchParams.get('period') || '30d';
    const period = ALLOWED_PERIODS.has(periodParam)
      ? (periodParam as '7d' | '30d' | '90d' | '1y')
      : '30d';

    const result = await getCashFlow(orgId, period);
    return NextResponse.json(result);
  } catch (err) {
    return friendlyApiError(err, 'Failed to load cash flow data.');
  }
}
