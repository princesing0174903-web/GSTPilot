// GET /api/bank/accounts
// Returns all connected bank accounts with balances, types, AA consent and last sync.

import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { buildAccountsState } from '@/lib/banking/engine';

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
    return NextResponse.json({
      ok: true,
      accountCount: accounts.length,
      totalBalance: accounts.reduce((s, a) => s + a.currentBalance, 0),
      totalAvailable: accounts.reduce((s, a) => s + a.availableBalance, 0),
      accounts,
    });
  } catch (err) {
    return friendlyApiError(err, 'Failed to load bank accounts.');
  }
}
