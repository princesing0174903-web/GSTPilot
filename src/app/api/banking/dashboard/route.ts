// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Module™ — Dashboard API (TASK 12)
//
// GET /api/banking/dashboard?organizationId=...
//   Auto-seeds the org (idempotent) then returns the full dashboard summary:
//   8 KPI cards + 14-day cash flow trend + 8 recent transactions + health score.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { ensureSeeded, getDashboardSummary } from '@/lib/banking-prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
    const summary = await getDashboardSummary(orgId);
    return NextResponse.json(summary);
  } catch (err) {
    return friendlyApiError(err, 'Failed to load banking dashboard.');
  }
}
