import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { getBankingState } from '@/lib/banking/oracle';

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

    const state = await getBankingState();
    return NextResponse.json(state);
  } catch (err) {
    return friendlyApiError(err, 'Failed to load banking state.');
  }
}
