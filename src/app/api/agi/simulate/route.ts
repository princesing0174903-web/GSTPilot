// POST /api/agi/simulate
// Run an Organizational Digital Twin simulation. Predict outcomes before execution.
// Body: { scenario, inputs?, initiatedBy? }
import { NextRequest, NextResponse } from 'next/server';
import { runSimulation, SIMULATION_SCENARIOS } from '@/lib/agi/twin';
import { auditCommand } from '@/lib/agi/security';
import { invalidateCache } from '@/lib/agi/helpers';
import type { SimulationScenario } from '@/lib/agi/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body?.scenario) {
      return NextResponse.json({ ok: false, error: 'scenario is required' }, { status: 400 });
    }
    const validScenarios = SIMULATION_SCENARIOS.map((s) => s.scenarioKey);
    if (!validScenarios.includes(body.scenario as SimulationScenario)) {
      return NextResponse.json({ ok: false, error: `Invalid scenario. Valid: ${validScenarios.join(', ')}` }, { status: 400 });
    }
    const audit = await auditCommand({
      actionType: 'simulate',
      targetType: 'simulation',
      actorId: body.initiatedBy ?? 'oracle',
      actorType: 'oracle',
      role: 'manager',
      riskScore: 0, // simulations are risk-free
      financialImpact: 0,
      payload: JSON.stringify(body),
      reason: `Simulate ${body.scenario}`,
    });
    if (!audit.allowed) {
      return NextResponse.json({ ok: false, error: 'Simulation blocked by AGI security', audit }, { status: 403 });
    }
    const simulation = await runSimulation(
      body.scenario as SimulationScenario,
      body.inputs ?? {},
      body.initiatedBy,
    );
    invalidateCache('agi:twin');
    invalidateCache('agi:dashboard');
    return NextResponse.json({ ok: true, simulation, audit });
  } catch (err) {
    console.error('[agi/simulate] Error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to run simulation' }, { status: 500 });
  }
}
