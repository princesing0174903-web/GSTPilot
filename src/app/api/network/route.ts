// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT NETWORK™ — Module 10: Network API
// GET /api/network — full network state (auto-refreshes every 90s on the client)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getNetworkState } from '@/lib/network/engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const state = await getNetworkState();
    return NextResponse.json(state);
  } catch (err) {
    console.error('[/api/network] failed:', err);
    return NextResponse.json(
      { error: 'Failed to load network state', message: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
