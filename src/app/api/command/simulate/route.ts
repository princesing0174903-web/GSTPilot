// POST /api/command/simulate
// Run a Command Simulator™ scenario against the REAL live enterprise state.
// Body: { scenario: string, overrides?: Record<string, unknown> }
// Returns the full impact assessment (financial/operational/compliance/legal/risk/ROI).
// Founder & Owner: Prince Singh.

import { NextRequest, NextResponse } from 'next/server';
import { runSimulation, auditCommand, SIMULATION_SCENARIOS } from '@/lib/command-network';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const scenario = body.scenario as string | undefined;
    const overrides = body.overrides as Record<string, unknown> | undefined;
    const role = (body.role as string) ?? 'oracle';
    const actorId = (body.actorId as string) ?? 'oracle';

    if (!scenario) {
      return NextResponse.json(
        { ok: false, error: 'scenario is required', availableScenarios: SIMULATION_SCENARIOS.map((s) => s.scenario) },
        { status: 400 },
      );
    }

    const simulation = await runSimulation(scenario, overrides);
    await auditCommand({
      commandType: 'simulate',
      targetModule: 'digital_twin',
      targetEntity: simulation.id,
      actorId,
      actorType: 'oracle',
      role,
      payload: { scenario, overrides },
      result: 'success',
    });
    return NextResponse.json({ ok: true, simulation });
  } catch (err) {
    console.error('[command/simulate][POST] Error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to run simulation';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
