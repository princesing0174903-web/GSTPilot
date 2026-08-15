// GET /api/bank/upi
// Returns the UPI state — collections, payments, top customers, transactions.

import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { buildUPIState } from '@/lib/banking/engine';

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

    const upi = await buildUPIState();
    return NextResponse.json({ ok: true, upi });
  } catch (err) {
    return friendlyApiError(err, 'Failed to load UPI state.');
  }
}
