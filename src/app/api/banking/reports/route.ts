// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Module™ — Reports API (TASK 12)
//
// GET /api/banking/reports?organizationId=...&period=daily|weekly|monthly|quarterly|yearly&referenceDate=YYYY-MM-DD
//   → generateReport(orgId, period, referenceDate?)
//
// Returns a BankingReport: totalInflow/outflow/net, opening/closing balances,
// topExpenses, topCustomers, outstanding invoices, collectionRate, byCategory.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { ensureSeeded, generateReport } from '@/lib/banking-prisma';
import type { ReportPeriod } from '@/lib/banking-prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_PERIODS: ReportPeriod[] = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

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

    const periodParam = url.searchParams.get('period') || 'monthly';
    const period: ReportPeriod = (ALLOWED_PERIODS as string[]).includes(periodParam)
      ? (periodParam as ReportPeriod)
      : 'monthly';

    const referenceDateParam = url.searchParams.get('referenceDate');
    const referenceDate = referenceDateParam
      ? new Date(referenceDateParam)
      : new Date();

    if (Number.isNaN(referenceDate.getTime())) {
      return NextResponse.json(
        { error: 'referenceDate must be a valid ISO date (YYYY-MM-DD).' },
        { status: 400 },
      );
    }

    const report = await generateReport(orgId, period, referenceDate);
    return NextResponse.json(report);
  } catch (err) {
    return friendlyApiError(err, 'Failed to generate banking report.');
  }
}
