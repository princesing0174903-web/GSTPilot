// GET /api/bank/cashflow/forecast
// Returns the forward cash flow forecast (7d / 30d horizons).

import { NextResponse } from 'next/server';
import { buildAccountsState, buildCashFlowState } from '@/lib/banking/engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const accounts = await buildAccountsState();
    const cashflow = await buildCashFlowState(accounts);
    return NextResponse.json({
      ok: true,
      forecast: {
        cashPosition: cashflow.cashPosition,
        dailyBurn: cashflow.dailyBurn,
        monthlyBurn: cashflow.monthlyBurn,
        runwayDays: cashflow.runwayDays,
        expectedCollections: cashflow.expectedCollections,
        expectedPayments: cashflow.expectedPayments,
        shortageDetected: cashflow.shortageDetected,
        shortageAmount: cashflow.shortageAmount,
        shortageDate: cashflow.shortageDate,
        forecast7d: cashflow.forecast7d,
        forecast30d: cashflow.forecast30d,
      },
    });
  } catch (err) {
    console.error('[bank/cashflow/forecast] GET failed:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to load forecast', detail: String(err) },
      { status: 500 },
    );
  }
}
