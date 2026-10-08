// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT DIGITAL TWIN™ — REPLAY API
// POST /api/twin/replay   — body: { range: PlaybackRange, buckets?: number }
// GET  /api/twin/replay   — query: ?range=last_month&buckets=12
//
// Alias for the Playback engine, exposed under a friendlier "replay" name.
// Replays history for a range, aggregating timeline events and period state
// into bucketed frames. Each frame contains the state at that point + the
// events that led to it + the delta from the previous frame.
//
// Both GET and POST produce identical results — the route works either way.
//
// Range options (PlaybackRange):
//   yesterday | last_week | last_month | last_quarter | q1 | q2 | q3 | q4
//   | this_year | last_year | all
//
// Buckets: default 12, max 52.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { computePlayback } from '@/lib/twin/playback';
import type { PlaybackRange } from '@/lib/twin/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TWIN_TAGLINE =
  'VEYRO Digital Twin™ — Remember Everything. Understand Everything. Simulate Everything. Predict Everything.';

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

interface ReplayOptions {
  range: PlaybackRange;
  buckets: number;
}

function resolveOptions(raw: { range?: string; buckets?: number | string }): {
  options: ReplayOptions | null;
  error: { error: string; message: string } | null;
} {
  // Range
  const rawRange = (raw.range || 'last_month').toString();
  if (!VALID_RANGES.includes(rawRange as PlaybackRange)) {
    return {
      options: null,
      error: {
        error: `Invalid range '${rawRange}'`,
        message: `Range must be one of: ${VALID_RANGES.join(', ')}`,
      },
    };
  }
  const range = rawRange as PlaybackRange;

  // Buckets — default 12, max 52, min 1
  const parsedBuckets =
    typeof raw.buckets === 'number' ? raw.buckets : parseInt(String(raw.buckets || '12'), 10);
  const buckets = Math.max(1, Math.min(Number.isFinite(parsedBuckets) ? parsedBuckets : 12, 52));

  return { options: { range, buckets }, error: null };
}

function successHeaders(options: ReplayOptions) {
  return {
    'Cache-Control': 'no-store, max-age=0',
    'X-Digital-Twin': 'true',
    'X-Digital-Twin-Endpoint': 'replay',
    'X-Replay-Range': options.range,
    'X-Replay-Buckets': String(options.buckets),
  };
}

// ─── GET — replay via query params ────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const resolved = resolveOptions({
      range: searchParams.get('range') || undefined,
      buckets: searchParams.get('buckets') || undefined,
    });

    if (resolved.error || !resolved.options) {
      return NextResponse.json(
        { ...resolved.error, tagline: TWIN_TAGLINE },
        { status: 400 },
      );
    }

    const result = await computePlayback(resolved.options.range, resolved.options.buckets);

    return NextResponse.json(result, { headers: successHeaders(resolved.options) });
  } catch (error) {
    console.error('[Digital-Twin-Replay-GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to replay history',
        message: error instanceof Error ? error.message : 'Unknown error',
        tagline: TWIN_TAGLINE,
      },
      { status: 500 },
    );
  }
}

// ─── POST — replay via JSON body ──────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: 'Invalid JSON body',
          message: 'Request body must be valid JSON: { range?: PlaybackRange, buckets?: number }.',
          tagline: TWIN_TAGLINE,
        },
        { status: 400 },
      );
    }

    const rawBody = (body || {}) as { range?: string; buckets?: number | string };
    const resolved = resolveOptions({
      range: rawBody.range,
      buckets: rawBody.buckets,
    });

    if (resolved.error || !resolved.options) {
      return NextResponse.json(
        { ...resolved.error, tagline: TWIN_TAGLINE },
        { status: 400 },
      );
    }

    const result = await computePlayback(resolved.options.range, resolved.options.buckets);

    return NextResponse.json(result, { headers: successHeaders(resolved.options) });
  } catch (error) {
    console.error('[Digital-Twin-Replay-POST] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to replay history',
        message: error instanceof Error ? error.message : 'Unknown error',
        tagline: TWIN_TAGLINE,
      },
      { status: 500 },
    );
  }
}
