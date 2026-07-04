// GET /api/agi/dashboard
// Returns the unified Infinity AGI™ dashboard: AGI core, reasoning, swarm,
// memory, goals, plans, learning, twin, decisions, security + live state.
// One Intelligence. Every Decision. Entire Enterprise. Founder & Owner: Prince Singh.

import { NextResponse } from 'next/server';
import { getAGIDashboard } from '@/lib/agi/dashboard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const dashboard = await getAGIDashboard();
    return NextResponse.json({ ok: true, dashboard });
  } catch (err) {
    console.error('[agi/dashboard] Error:', err);
    const message = err instanceof Error ? err.message : 'Failed to load AGI dashboard';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
