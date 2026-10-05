// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Module™ — Banking Oracle API (TASK 12)
//
// GET /api/banking/oracle?organizationId=...
//   → getBankingOracleInsights(orgId)
//
// Returns the full Oracle AI insights payload (10 sections):
//   cashFlowAnalysis, largeWithdrawals, duplicatePayments, gstPaymentReadiness,
//   collectionEfficiency, unmatchedTransactions, lateCollections,
//   fraudIndicators, nextMonthPrediction, recommendations.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { ensureSeeded, getBankingOracleInsights } from '@/lib/banking-prisma';
import { swrCache } from '@/lib/cache/swr';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 30s SWR cache — Oracle insights run 8+ Prisma queries in parallel (unmatched
// txns, large withdrawals, duplicate payments, GST readiness, collection
// efficiency, late collections, fraud indicators, next-month prediction) +
// cash flow + recommendations. The insights are analytical (not real-time) —
// 30s staleness is invisible to the user.
const BANKING_ORACLE_CACHE_TTL_MS = 30_000;

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

    await ensureSeeded(orgId);
    const insights = await swrCache(
      '/api/banking/oracle',
      orgId,
      BANKING_ORACLE_CACHE_TTL_MS,
      () => getBankingOracleInsights(orgId),
      { forceRefresh },
    );
    return NextResponse.json(insights);
  } catch (err) {
    return friendlyApiError(err, 'Failed to load banking oracle insights.');
  }
}
