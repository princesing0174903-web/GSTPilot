// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT DIGITAL TWIN™ — LIVE BUSINESS STATE API
// GET /api/twin/state
//
// Returns the centralized live business state: revenue, profit, cash, working
// capital, GST position, ITC, payroll, receivables, payables, bank accounts,
// clients, vendors, health/risk/compliance scores, and a forward forecast —
// all computed from REAL connected business data.
//
// Cached for 30s in-memory: the live state is cheap enough to refresh often
// but expensive enough to avoid recomputing on every keystroke.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { computeLiveBusinessState } from '@/lib/twin/live-state';
import type { LiveBusinessState } from '@/lib/twin/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TWIN_TAGLINE =
  'GSTPilot Digital Twin™ — Remember Everything. Understand Everything. Simulate Everything. Predict Everything.';
const CACHE_TTL_MS = 30_000;

let cachedState: { data: LiveBusinessState; ts: number } | null = null;

export async function GET() {
  try {
    // Return cached state if fresh
    if (cachedState && Date.now() - cachedState.ts < CACHE_TTL_MS) {
      return NextResponse.json(cachedState.data, {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Digital-Twin': 'true',
          'X-Digital-Twin-Cache': 'HIT',
        },
      });
    }

    const state = await computeLiveBusinessState();
    cachedState = { data: state, ts: Date.now() };

    return NextResponse.json(state, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Digital-Twin': 'true',
        'X-Digital-Twin-Cache': 'MISS',
        'X-Data-Sources': state.dataSources.join(','),
      },
    });
  } catch (error) {
    console.error('[Digital-Twin-State] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to compute live business state',
        message: error instanceof Error ? error.message : 'Unknown error',
        tagline: TWIN_TAGLINE,
      },
      { status: 500 },
    );
  }
}
