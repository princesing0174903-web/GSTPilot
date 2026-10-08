// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT DIGITAL TWIN™ — BUSINESS TIMELINE™ API
// GET /api/twin/history
//
// Returns the complete chronological history of the business. Every event
// (invoice created, GST filed, bank synced, expense added, payroll processed,
// collection received, anomaly detected, decision simulated, etc.) is part of
// the twin's permanent memory.
//
// Query params:
//   ?limit=200  (default 200, max 1000)
//
// No in-memory cache — the timeline is cheap and history queries are user-driven.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { computeBusinessTimeline } from '@/lib/twin/timeline';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TWIN_TAGLINE =
  'VEYRO Digital Twin™ — Remember Everything. Understand Everything. Simulate Everything. Predict Everything.';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10), 1000);

    const timeline = await computeBusinessTimeline(limit);

    return NextResponse.json(timeline, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Digital-Twin': 'true',
        'X-Timeline-Limit': String(limit),
      },
    });
  } catch (error) {
    console.error('[Digital-Twin-History] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to compute business timeline',
        message: error instanceof Error ? error.message : 'Unknown error',
        tagline: TWIN_TAGLINE,
      },
      { status: 500 },
    );
  }
}
