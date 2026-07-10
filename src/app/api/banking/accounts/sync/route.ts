import { NextResponse } from 'next/server';
import { syncAccount } from '@/lib/banking/accounts';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
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
    console.error('[API /banking/accounts/sync] error:', err);
    return NextResponse.json({ error: 'Failed to sync account' }, { status: 500 });
  }
}
