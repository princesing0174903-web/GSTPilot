import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { fetchAAData } from '@/lib/banking/aggregator';

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

    if (!body.accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }
    const result = await fetchAAData(body.accountId);
    return NextResponse.json({
      success: true,
      ...result,
      message: `I've fetched ${result.fetched} transactions via Account Aggregator.`,
    });
  } catch (err) {
    return friendlyApiError(err, 'Failed to fetch AA transactions.');
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;
    const url = new URL(req.url);
    const orgId = url.searchParams.get('organizationId') || 'local';
    const org = await requireOrgMembership(uid, orgId);
    if (org instanceof NextResponse) return org;

    return NextResponse.json({ transactions: [], message: 'Use POST with accountId to fetch AA transactions.' });
  } catch (err) {
    return friendlyApiError(err, 'Failed to load AA transactions.');
  }
}
