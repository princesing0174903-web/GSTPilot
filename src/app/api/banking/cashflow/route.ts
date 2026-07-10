import { NextResponse } from 'next/server';
import { getCashFlowState } from '@/lib/banking/cashflow';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const state = await getCashFlowState();
    return NextResponse.json(state);
  } catch (err) {
    console.error('[API /banking/cashflow] error:', err);
    return NextResponse.json(
      { error: 'Failed to load cash flow state', hasLiveData: false, metrics: null, forecast: null, daily: [], riskTriggers: [] },
      { status: 500 },
    );
  }
}
