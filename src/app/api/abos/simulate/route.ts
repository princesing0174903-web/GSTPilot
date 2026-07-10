// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT ABOS™ — POST /api/abos/simulate
// Run a what-if simulation on the Business Digital Twin™.
// Body: SimulationRequest { type, label, magnitudePct, detail? }
// Returns: { twin, result } — the current twin snapshot + the simulation result.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getAbosState, runSimulation } from '@/lib/abos/engine';
import type { SimulationRequest } from '@/lib/abos/types';

export async function POST(request: Request) {
  let body: SimulationRequest;
  try {
    body = (await request.json()) as SimulationRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body.magnitudePct !== 'number' || !body.type) {
    return NextResponse.json(
      { error: 'type (string) and magnitudePct (number) are required' },
      { status: 400 },
    );
  }
  try {
    // Build the live state (this also primes the cfo cache for burn-rate maths).
    const state = await getAbosState(null);
    const twin = state.digitalTwin.twinState;
    const result = runSimulation(twin, body);
    return NextResponse.json({ twin, result });
  } catch (err) {
    console.error('[/api/abos/simulate] error:', err);
    return NextResponse.json(
      { error: 'Simulation failed', detail: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
