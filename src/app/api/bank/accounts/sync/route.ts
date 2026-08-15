// POST /api/bank/accounts/sync
// Trigger a manual sync of all bank accounts (or one by accountId).

import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { syncBankAccounts } from '@/lib/banking/engine';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;
    const url = new URL(request.url);
    const orgId = url.searchParams.get('organizationId') || 'local';
    const org = await requireOrgMembership(uid, orgId);
    if (org instanceof NextResponse) return org;

    let body: { accountId?: string; organizationId?: string } = {};
    try {
      body = await request.json();
    } catch {
      // No body — sync all
    }
    const res = await syncBankAccounts(body.accountId);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (err) {
    return friendlyApiError(err, 'Failed to sync bank accounts.');
  }
}
