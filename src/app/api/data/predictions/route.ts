// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/data/predictions?type=<ForecastType>
// Predictive Data Engine™ — returns forecasts + summary + the active (most
// recent per type/horizon) forecasts. All data is REAL production data.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import {
  getForecasts,
  getForecastSummary,
  getActiveForecasts,
} from '@/lib/data-intelligence';
import type { ForecastType } from '@/lib/data-intelligence/types';

export async function GET(request: NextRequest) {
  try {
    const typeParam = request.nextUrl.searchParams.get('type');
    const type = (typeParam || undefined) as ForecastType | undefined;

    const [forecasts, summary, active] = await Promise.all([
      getForecasts(type),
      getForecastSummary(),
      getActiveForecasts(),
    ]);

    return NextResponse.json({ ok: true, forecasts, summary, active });
  } catch (err) {
    console.error('[/api/data/predictions] Error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to load predictions',
        forecasts: [],
        summary: null,
        active: [],
      },
      { status: 500 },
    );
  }
}
