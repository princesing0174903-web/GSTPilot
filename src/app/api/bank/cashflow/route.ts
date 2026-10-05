// GET /api/bank/cashflow
// Returns the full cash flow state — cash position, burns, runway, shortage, daily series.

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
    return NextResponse.json({ ok: true, cashflow });
  } catch (err) {
    return friendlyApiError(err, 'Failed to load cash flow.');
  }
}
