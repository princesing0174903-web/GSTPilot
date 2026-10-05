import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { importTransactions } from '@/lib/banking/statements';

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

    if (!body.accountId || !Array.isArray(body.rows)) {
      return NextResponse.json({ error: 'accountId and rows[] are required' }, { status: 400 });
    }
    const result = await importTransactions(body.accountId, body.rows);
    return NextResponse.json({
      success: true,
      ...result,
      message: `I've imported ${result.imported} transactions from your statement.`,
    });
  } catch (err) {
    return friendlyApiError(err, 'Failed to import transactions.');
  }
}
