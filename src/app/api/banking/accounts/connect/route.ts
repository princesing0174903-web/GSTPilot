import { NextResponse } from 'next/server';
import { connectAccount, SUPPORTED_BANKS } from '@/lib/banking/accounts';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
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
    console.error('[API /banking/accounts/connect] error:', err);
    return NextResponse.json({ error: 'Failed to connect account' }, { status: 500 });
  }
}
