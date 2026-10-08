// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT DIGITAL TWIN™ — BUSINESS SNAPSHOTS™ API
// GET /api/twin/snapshots
//
// Returns the snapshot bundle: daily, weekly, monthly, quarterly, and yearly
// business snapshots automatically created by the twin, plus three comparisons
// (today vs yesterday, this month vs last month, this year vs last year) with
// deltas and narrative summaries.
//
// Cached for 120s in-memory: snapshots are aggregates that change slowly.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { computeSnapshotBundle } from '@/lib/twin/snapshots';
import type { SnapshotBundle } from '@/lib/twin/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TWIN_TAGLINE =
  'VEYRO Digital Twin™ — Remember Everything. Understand Everything. Simulate Everything. Predict Everything.';
const CACHE_TTL_MS = 120_000;

let cachedBundle: { data: SnapshotBundle; ts: number } | null = null;

export async function GET() {
  try {
    // Return cached bundle if fresh
    if (cachedBundle && Date.now() - cachedBundle.ts < CACHE_TTL_MS) {
      return NextResponse.json(cachedBundle.data, {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Digital-Twin': 'true',
          'X-Digital-Twin-Cache': 'HIT',
        },
      });
    }

    const bundle = await computeSnapshotBundle();
    cachedBundle = { data: bundle, ts: Date.now() };

    return NextResponse.json(bundle, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Digital-Twin': 'true',
        'X-Digital-Twin-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('[Digital-Twin-Snapshots] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to compute snapshot bundle',
        message: error instanceof Error ? error.message : 'Unknown error',
        tagline: TWIN_TAGLINE,
      },
      { status: 500 },
    );
  }
}
