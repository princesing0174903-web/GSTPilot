import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { grantConsent, revokeConsent, getAAState } from '@/lib/banking/aggregator';

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

    const state = await getAAState();
    return NextResponse.json(state);
  } catch (err) {
    return friendlyApiError(err, 'Failed to load AA state.');
  }
}

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

    if (!body.accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }
    if (body.action === 'revoke') {
      const result = await revokeConsent(body.accountId);
      return NextResponse.json({ success: true, ...result, message: "I've revoked AA consent for this account." });
    }
    const result = await grantConsent(body.accountId);
    return NextResponse.json({
      success: true,
      ...result,
      message: "I've granted AA consent — data will sync automatically.",
    });
  } catch (err) {
    return friendlyApiError(err, 'Failed to manage consent.');
  }
}
