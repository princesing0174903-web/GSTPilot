import { NextResponse } from 'next/server';
import { getBankingState } from '@/lib/banking/oracle';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const state = await getBankingState();
    return NextResponse.json(state);
  } catch (err) {
    console.error('[API /banking/state] error:', err);
    return NextResponse.json({ error: 'Failed to load banking state', hasLiveData: false }, { status: 500 });
  }
}
