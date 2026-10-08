// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Module™ — Dashboard API (TASK 12)
//
// GET /api/banking/dashboard?organizationId=...
//   Auto-seeds the org (idempotent) then returns the full dashboard summary:
//   8 KPI cards + 14-day cash flow trend + 8 recent transactions + health score.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { ensureSeeded, getDashboardSummary } from '@/lib/banking-prisma';
import { swrCache } from '@/lib/cache/swr';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 15s SWR cache — banking KPIs don't change minute-to-minute, and the user
// frequently re-visits the banking tab within 15s (tab switches). The cache
// also dedups concurrent callers (BankingPage + any child widgets) so they
// share the same `getDashboardSummary` Prisma query batch.
const BANKING_DASHBOARD_CACHE_TTL_MS = 15_000;

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;
    const url = new URL(req.url);
    const orgId = url.searchParams.get('organizationId') || 'local';
    const forceRefresh = url.searchParams.get('forceRefresh') === 'true';
    const org = await requireOrgMembership(uid, orgId);
    if (org instanceof NextResponse) return org;

    // ensureSeeded is idempotent — safe to call before the cached compute.
    // The cache wraps ONLY getDashboardSummary so a cache hit skips the 5
    // parallel Prisma queries inside it.
    await ensureSeeded(orgId);
    const summary = await swrCache(
      '/api/banking/dashboard',
      orgId,
      BANKING_DASHBOARD_CACHE_TTL_MS,
      () => getDashboardSummary(orgId),
      { forceRefresh },
    );
    return NextResponse.json(summary);
  } catch (err) {
    return friendlyApiError(err, 'Failed to load banking dashboard.');
  }
}
