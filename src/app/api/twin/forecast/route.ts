// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT DIGITAL TWIN™ — FORECAST ENGINE API
// GET /api/twin/forecast
//
// Returns forward-looking projections for revenue, cash flow, profit, GST
// liability, expenses, and collections across 7d/30d/90d/year-end horizons with
// confidence scores — all derived from REAL connected business data.
//
// Cached for 120s in-memory: forecasts change slowly relative to live state.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { computeTwinForecast } from '@/lib/twin/forecast';
import type { TwinForecast } from '@/lib/twin/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TWIN_TAGLINE =
  'VEYRO Digital Twin™ — Remember Everything. Understand Everything. Simulate Everything. Predict Everything.';
const CACHE_TTL_MS = 120_000;

let cachedForecast: { data: TwinForecast; ts: number } | null = null;

export async function GET() {
  try {
    // Return cached forecast if fresh
    if (cachedForecast && Date.now() - cachedForecast.ts < CACHE_TTL_MS) {
      return NextResponse.json(cachedForecast.data, {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Digital-Twin': 'true',
          'X-Digital-Twin-Cache': 'HIT',
        },
      });
    }

    const forecast = await computeTwinForecast();
    cachedForecast = { data: forecast, ts: Date.now() };

    return NextResponse.json(forecast, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Digital-Twin': 'true',
        'X-Digital-Twin-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('[Digital-Twin-Forecast] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to compute twin forecast',
        message: error instanceof Error ? error.message : 'Unknown error',
        tagline: TWIN_TAGLINE,
      },
      { status: 500 },
    );
  }
}
