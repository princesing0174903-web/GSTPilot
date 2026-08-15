import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { connectAccount, SUPPORTED_BANKS } from '@/lib/banking/accounts';

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

    if (!body.bankName || !body.accountNumber || !body.ifsc) {
      return NextResponse.json(
        { error: 'bankName, accountNumber, and ifsc are required', supportedBanks: SUPPORTED_BANKS },
        { status: 400 },
      );
    }
    const account = await connectAccount({
      bankName: body.bankName,
      accountNumber: body.accountNumber,
      ifsc: body.ifsc,
      accountType: body.accountType,
    });
    return NextResponse.json({ success: true, account, message: `I've connected your ${body.bankName} account and started syncing.` });
  } catch (err) {
    return friendlyApiError(err, 'Failed to connect account.');
  }
}
