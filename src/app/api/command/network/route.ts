// GET /api/command/network
// Returns the Enterprise Command Engine™ fabric — the 22-module connectivity graph.
// Founder & Owner: Prince Singh.

import { NextRequest, NextResponse } from 'next/server';
import { getCommandFabric, getCommandExecutives } from '@/lib/command-network';

export async function GET(_request: NextRequest) {
  try {
    const [fabric, executives] = await Promise.all([
      getCommandFabric(),
      getCommandExecutives(),
    ]);
    return NextResponse.json({ ok: true, fabric, executives });
  } catch (err) {
    console.error('[command/network] Error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to load command network';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
