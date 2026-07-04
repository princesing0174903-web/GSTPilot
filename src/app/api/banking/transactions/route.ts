import { NextResponse } from 'next/server';
import { getTransactions } from '@/lib/banking/statements';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const accountId = url.searchParams.get('accountId') || undefined;
    const category = url.searchParams.get('category') || undefined;
    const type = url.searchParams.get('type') || undefined;
    const matchedParam = url.searchParams.get('matched');
    const matched = matchedParam === 'true' ? true : matchedParam === 'false' ? false : undefined;
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 200;

    const result = await getTransactions({ accountId, category, type, matched, limit });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[API /banking/transactions] GET error:', err);
    return NextResponse.json(
      { error: 'Failed to load transactions', transactions: [], total: 0, totalInflow: 0, totalOutflow: 0, netFlow: 0, hasLiveData: false },
      { status: 500 },
    );
  }
}
