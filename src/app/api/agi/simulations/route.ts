// GET /api/agi/simulations
// Returns recent Organizational Digital Twin simulations + the twin summary.
import { NextResponse } from 'next/server';
import { getRecentSimulations, getTwinSummary, SIMULATION_SCENARIOS } from '@/lib/agi/twin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const [recent, summary] = await Promise.all([getRecentSimulations(30), getTwinSummary()]);
    return NextResponse.json({ ok: true, recent, summary, scenarios: SIMULATION_SCENARIOS });
  } catch (err) {
    console.error('[agi/simulations] Error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to load AGI simulations' }, { status: 500 });
  }
}
