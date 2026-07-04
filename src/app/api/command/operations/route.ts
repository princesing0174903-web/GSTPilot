// GET /api/command/operations
// Returns the live Global Operations Map™ — every node in the enterprise.
// Founder & Owner: Prince Singh.

import { NextRequest, NextResponse } from 'next/server';
import { getOperationsMap } from '@/lib/command-network';

export async function GET(_request: NextRequest) {
  try {
    const operationsMap = await getOperationsMap();
    return NextResponse.json({ ok: true, operationsMap });
  } catch (err) {
    console.error('[command/operations] Error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to load operations map';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
