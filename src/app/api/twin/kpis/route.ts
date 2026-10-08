// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT DIGITAL TWIN™ — LIVE KPI ENGINE™ API
// GET /api/twin/kpis
//
// Returns continuously-calculated KPIs: revenue, profit, cash, EBITDA, runway
// days, burn rate, working capital, customer lifetime value, average collection
// time, average payment time, vendor reliability, client reliability, and MoM
// business growth — all from REAL connected business data.
//
// Cached for 60s in-memory.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { computeLiveKPIs } from '@/lib/twin/kpis';
import type { LiveKPIs } from '@/lib/twin/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TWIN_TAGLINE =
  'VEYRO Digital Twin™ — Remember Everything. Understand Everything. Simulate Everything. Predict Everything.';
const CACHE_TTL_MS = 60_000;

let cachedKPIs: { data: LiveKPIs; ts: number } | null = null;

export async function GET() {
  try {
    // Return cached KPIs if fresh
    if (cachedKPIs && Date.now() - cachedKPIs.ts < CACHE_TTL_MS) {
      return NextResponse.json(cachedKPIs.data, {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Digital-Twin': 'true',
          'X-Digital-Twin-Cache': 'HIT',
        },
      });
    }

    const kpis = await computeLiveKPIs();
    cachedKPIs = { data: kpis, ts: Date.now() };

    return NextResponse.json(kpis, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Digital-Twin': 'true',
        'X-Digital-Twin-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('[Digital-Twin-KPIs] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to compute live KPIs',
        message: error instanceof Error ? error.message : 'Unknown error',
        tagline: TWIN_TAGLINE,
      },
      { status: 500 },
    );
  }
}
