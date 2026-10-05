// GET /api/command/executives
// Returns the 9 AI executives with real decision/workflow/incident metrics.
// Founder & Owner: Prince Singh.

import { NextRequest, NextResponse } from 'next/server';
import { getCommandExecutives } from '@/lib/command-network';

export async function GET(_request: NextRequest) {
  try {
    const executives = await getCommandExecutives();
    return NextResponse.json({ ok: true, executives });
  } catch (err) {
    console.error('[command/executives] Error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to load executives';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
