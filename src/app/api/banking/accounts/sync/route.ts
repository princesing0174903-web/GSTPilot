import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { syncAccount } from '@/lib/banking/accounts';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;

    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const url = new URL(req.url);
    const orgId = url.searchParams.get('organizationId') || (body.organizationId as string | undefined) || 'local';
    const org = await requireOrgMembership(uid, orgId);
    if (org instanceof NextResponse) return org;

    const accountId = body.accountId;
    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }
    const result = await syncAccount(accountId);
    return NextResponse.json({
      success: true,
      ...result,
      message: `I've synced your bank account — ${result.newTransactions} new transactions detected.`,
    });
  } catch (err) {
    return friendlyApiError(err, 'Failed to sync account.');
  }
}
