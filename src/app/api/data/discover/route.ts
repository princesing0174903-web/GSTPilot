// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/data/discover
//   No body required.
// Runs every AI Data Discovery™ detector against REAL production data and
// persists DataDiscoveryInsight rows. Returns the newly-created insights.
// Founder & Owner: Prince Singh. Every Data Point. One Enterprise Brain.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { runDiscovery } from '@/lib/data-intelligence';

export async function POST(_request: NextRequest) {
  try {
    const insights = await runDiscovery();
    return NextResponse.json({ ok: true, insights });
  } catch (err) {
    console.error('[data-intelligence/discover][POST] Error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to run AI data discovery';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
