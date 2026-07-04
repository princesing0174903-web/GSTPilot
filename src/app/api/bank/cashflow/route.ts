// GET /api/bank/cashflow
// Returns the full cash flow state — cash position, burns, runway, shortage, daily series.

import { NextResponse } from 'next/server';
import { buildAccountsState, buildCashFlowState } from '@/lib/banking/engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const accounts = await buildAccountsState();
    const cashflow = await buildCashFlowState(accounts);
    return NextResponse.json({ ok: true, cashflow });
  } catch (err) {
    console.error('[bank/cashflow] GET failed:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to load cash flow', detail: String(err) },
      { status: 500 },
    );
  }
}
