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
    const insights = await getBankingOracleInsights(orgId);
    return NextResponse.json(insights);
  } catch (err) {
    return friendlyApiError(err, 'Failed to load banking oracle insights.');
  }
}
