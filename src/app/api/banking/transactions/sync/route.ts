import { NextResponse } from 'next/server';
import { syncTransactions } from '@/lib/banking/statements';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const accountId = body.accountId;
    const result = await syncTransactions(accountId);
    return NextResponse.json({
      success: true,
      ...result,
      message: `I've synced ${result.synced} new transactions across ${result.accounts} account(s).`,
    });
  } catch (err) {
    console.error('[API /banking/transactions/sync] error:', err);
    return NextResponse.json({ error: 'Failed to sync transactions' }, { status: 500 });
  }
}
