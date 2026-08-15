// POST /api/bank/upi/connect
// Activate UPI Collect on a UPI-enabled account.

import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { connectUPI } from '@/lib/banking/engine';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;
    const url = new URL(req.url);
    const orgId = url.searchParams.get('organizationId') || 'local';
    const org = await requireOrgMembership(uid, orgId);
    if (org instanceof NextResponse) return org;

    const res = await connectUPI();
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (err) {
    return friendlyApiError(err, 'Failed to connect UPI.');
  }
}
