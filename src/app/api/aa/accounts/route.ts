import { NextResponse } from 'next/server';
import { getAAState } from '@/lib/banking/aggregator';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const state = await getAAState();
    return NextResponse.json({ accounts: state.linkedAccounts, totalLinked: state.totalLinked, totalBalance: state.totalBalance });
  } catch (err) {
    console.error('[API /aa/accounts] error:', err);
    return NextResponse.json({ error: 'Failed to load AA accounts', accounts: [], totalLinked: 0, totalBalance: 0 }, { status: 500 });
  }
}
