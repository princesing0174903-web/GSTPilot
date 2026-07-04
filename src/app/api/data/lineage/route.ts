// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/data/lineage
//   ?replay=<replayToken>        → replay a single lineage event (read-only)
//   ?datasetKey=<key>            → recent lineage events for a dataset
//   (no params)                  → recent lineage events across all datasets
// Always returns the lineage summary alongside the events list (when not replaying).
// Founder & Owner: Prince Singh. Every Data Point. One Enterprise Brain.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getLineage, getLineageSummary, replayLineageEvent } from '@/lib/data-intelligence';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const replay = searchParams.get('replay');

    if (replay) {
      const replayResult = await replayLineageEvent(replay);
      return NextResponse.json({ ok: true, replay: replayResult });
    }

    const datasetKey = searchParams.get('datasetKey') ?? undefined;

    const [events, summary] = await Promise.all([
      getLineage(datasetKey, 100),
      getLineageSummary(),
    ]);

    return NextResponse.json({ ok: true, events, summary });
  } catch (err) {
    console.error('[data-intelligence/lineage] Error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to load data lineage';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
