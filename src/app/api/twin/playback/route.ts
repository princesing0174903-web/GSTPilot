// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT DIGITAL TWIN™ — PLAYBACK™ API
// GET /api/twin/playback
//
// Replays history for a range. Aggregates timeline events and period state
// into bucketed frames so the user can scrub through time. Each frame contains
// the state at that point + the events that led to it + the delta from the
// previous frame. The response also includes start/end state, overall evolution,
// and a narrative summary.
//
// Query params:
//   ?range=last_month  (default 'last_month')
//                         one of: yesterday | last_week | last_month | last_quarter
//                                 | q1 | q2 | q3 | q4 | this_year | last_year | all
//   ?buckets=12        (default 12, max 52)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { computePlayback } from '@/lib/twin/playback';
import type { PlaybackRange } from '@/lib/twin/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TWIN_TAGLINE =
  'GSTPilot Digital Twin™ — Remember Everything. Understand Everything. Simulate Everything. Predict Everything.';

const VALID_RANGES: PlaybackRange[] = [
  'yesterday',
  'last_week',
  'last_month',
  'last_quarter',
  'q1',
  'q2',
  'q3',
  'q4',
  'this_year',
  'last_year',
  'all',
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse + validate range
    const rawRange = searchParams.get('range') || 'last_month';
    if (!VALID_RANGES.includes(rawRange as PlaybackRange)) {
      return NextResponse.json(
        {
          error: `Invalid range '${rawRange}'`,
          message: `Range must be one of: ${VALID_RANGES.join(', ')}`,
          tagline: TWIN_TAGLINE,
        },
        { status: 400 },
      );
    }
    const range = rawRange as PlaybackRange;

    // Parse + clamp buckets
    const buckets = Math.min(parseInt(searchParams.get('buckets') || '12', 10) || 12, 52);

    const result = await computePlayback(range, buckets);

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Digital-Twin': 'true',
        'X-Playback-Range': range,
        'X-Playback-Buckets': String(buckets),
      },
    });
  } catch (error) {
    console.error('[Digital-Twin-Playback] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to compute playback',
        message: error instanceof Error ? error.message : 'Unknown error',
        tagline: TWIN_TAGLINE,
      },
      { status: 500 },
    );
  }
}
