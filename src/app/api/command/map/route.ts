// GET /api/command/map
// Returns the Global Operations Map™ — visualizable node graph.
// Founder & Owner: Prince Singh.

import { NextRequest, NextResponse } from 'next/server';
import { getOperationsMap } from '@/lib/command-network';

export async function GET(_request: NextRequest) {
  try {
    const operationsMap = await getOperationsMap();
    return NextResponse.json({ ok: true, map: operationsMap });
  } catch (err) {
    console.error('[command/map] Error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to load operations map';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
