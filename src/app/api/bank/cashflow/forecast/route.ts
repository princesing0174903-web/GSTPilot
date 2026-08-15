// GET /api/bank/cashflow/forecast
// Returns the forward cash flow forecast (7d / 30d horizons).

import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { buildAccountsState, buildCashFlowState } from '@/lib/banking/engine';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;
    const url = new URL(req.url);
    const orgId = url.searchParams.get('organizationId') || 'local';
    const org = await requireOrgMembership(uid, orgId);
    if (org instanceof NextResponse) return org;

    const accounts = await buildAccountsState();
    const cashflow = await buildCashFlowState(accounts);
    return NextResponse.json({
      ok: true,
      forecast: {
        cashPosition: cashflow.cashPosition,
        dailyBurn: cashflow.dailyBurn,
        monthlyBurn: cashflow.monthlyBurn,
        runwayDays: cashflow.runwayDays,
        expectedCollections: cashflow.expectedCollections,
        expectedPayments: cashflow.expectedPayments,
        shortageDetected: cashflow.shortageDetected,
        shortageAmount: cashflow.shortageAmount,
        shortageDate: cashflow.shortageDate,
        forecast7d: cashflow.forecast7d,
        forecast30d: cashflow.forecast30d,
      },
    });
  } catch (err) {
    return friendlyApiError(err, 'Failed to load forecast.');
  }
}
