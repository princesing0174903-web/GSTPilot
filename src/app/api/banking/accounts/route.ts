import { NextResponse } from 'next/server';
import { getAccounts, connectAccount, SUPPORTED_BANKS } from '@/lib/banking/accounts';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await getAccounts();
    return NextResponse.json({ ...result, supportedBanks: SUPPORTED_BANKS });
  } catch (err) {
    console.error('[API /banking/accounts] GET error:', err);
    return NextResponse.json(
      { error: 'Failed to load bank accounts', accounts: [], totalBalance: 0, totalAccounts: 0, activeAccounts: 0, syncedToday: 0, hasLiveData: false, supportedBanks: SUPPORTED_BANKS },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const account = await connectAccount({
      bankName: body.bankName,
      accountNumber: body.accountNumber,
      ifsc: body.ifsc,
      accountType: body.accountType,
    });
    return NextResponse.json({ success: true, account });
  } catch (err) {
    console.error('[API /banking/accounts] POST error:', err);
    return NextResponse.json({ error: 'Failed to connect bank account' }, { status: 500 });
  }
}
