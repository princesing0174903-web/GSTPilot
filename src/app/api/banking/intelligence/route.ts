import { NextResponse } from 'next/server';
import { getPaymentIntelligence } from '@/lib/banking/intelligence';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const state = await getPaymentIntelligence();
    return NextResponse.json(state);
  } catch (err) {
    console.error('[API /banking/intelligence] error:', err);
    return NextResponse.json(
      { error: 'Failed to load payment intelligence', riskyClients: [], hasLiveData: false },
      { status: 500 },
    );
  }
}
