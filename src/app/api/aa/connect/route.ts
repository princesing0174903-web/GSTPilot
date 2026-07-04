import { NextResponse } from 'next/server';
import { connectAA } from '@/lib/banking/aggregator';
import { SUPPORTED_BANKS } from '@/lib/banking/accounts';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
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
    console.error('[API /aa/connect] error:', err);
    return NextResponse.json({ error: 'Failed to connect via AA' }, { status: 500 });
  }
}
