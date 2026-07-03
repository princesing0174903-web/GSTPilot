// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/graph/backfill
// One-time backfill: scan every existing Client / Invoice / GSTRFiling / Payment
// (Collection) / Notice / Employee / AITask / DataConnection (Bank + GSTN) and
// emit a graph node for each. Useful for existing seeded data that predates the
// auto-emit wiring in the POST create routes.
//
// Response: { ok, emitted: BackfillResult }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { backfillAllGraphNodes } from '@/lib/graph/auto-emit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  try {
    const emitted = await backfillAllGraphNodes();
    return NextResponse.json({ ok: true, emitted });
  } catch (err) {
    console.error('[graph] backfill error', err);
    return NextResponse.json(
      { ok: false, error: 'Backfill failed', detail: String(err) },
      { status: 500 },
    );
  }
}
