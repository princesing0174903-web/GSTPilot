// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT DIGITAL TWIN™ — BUSINESS ANOMALY DETECTION™ API
// GET /api/twin/anomalies
//
// Returns detected business anomalies (revenue drop, expense spike, cash drain,
// duplicate payments, vendor overcharging, customer delays, etc.) computed from
// real connected business data.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { detectAnomalies } from '@/lib/twin/anomaly';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TWIN_TAGLINE = 'GSTPilot Digital Twin™ — Remember Everything. Understand Everything. Simulate Everything. Predict Everything.';

// In-memory cache (60s)
let cached: { data: Awaited<ReturnType<typeof detectAnomalies>>; ts: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function GET() {
  try {
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return NextResponse.json(cached.data, { headers: { 'X-Digital-Twin': 'true', 'X-Digital-Twin-Cache': 'HIT' } });
    }
    const report = await detectAnomalies();
    cached = { data: report, ts: Date.now() };
    return NextResponse.json(report, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Digital-Twin': 'true',
        'X-Digital-Twin-Cache': 'MISS',
        'X-Anomaly-Count': String(report.totalCount),
        'X-Critical-Anomalies': String(report.criticalCount),
      },
    });
  } catch (error) {
    console.error('[Digital-Twin-Anomalies] Error:', error);
    return NextResponse.json(
      { error: 'Failed to detect anomalies', message: error instanceof Error ? error.message : 'Unknown error', tagline: TWIN_TAGLINE },
      { status: 500 },
    );
  }
}
