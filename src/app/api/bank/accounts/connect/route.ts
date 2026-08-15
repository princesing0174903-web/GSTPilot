// POST /api/bank/accounts/connect
// Connect a new bank account.

import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { connectBankAccount } from '@/lib/banking/engine';

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

    let body: { bankName?: string; accountType?: string; organizationId?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine — we'll pick a random bank
    }
    const res = await connectBankAccount(body);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (err) {
    return friendlyApiError(err, 'Failed to connect bank account.');
  }
}
