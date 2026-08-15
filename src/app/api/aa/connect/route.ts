import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { connectAA } from '@/lib/banking/aggregator';
import { SUPPORTED_BANKS } from '@/lib/banking/accounts';

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

    if (!body.bankName || !body.accountNumber) {
      return NextResponse.json({ error: 'bankName and accountNumber are required', supportedBanks: SUPPORTED_BANKS }, { status: 400 });
    }
    const result = await connectAA({ bankName: body.bankName, accountNumber: body.accountNumber });
    return NextResponse.json({
      success: true,
      ...result,
      message: `I've linked your ${body.bankName} account via Account Aggregator.`,
    });
  } catch (err) {
    return friendlyApiError(err, 'Failed to connect via AA.');
  }
}
