// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/autonomous/simulate — Digital Twin Simulator 2.0
//
// Body: { scenario: SimulationScenario, parameters?: SimulationParameters }
//
// Runs a what-if simulation (hire_employees, increase_prices, expand_city,
// launch_product, acquire_company, open_office, raise_funding, cut_costs,
// delay_payment, switch_vendor) against the REAL live company baseline.
// Returns predicted revenue, profit, cash flow, GST, risk, hiring,
// compliance and ROI.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { observeCompany } from '@/lib/autonomous/observer';
import { runSimulation, SCENARIO_META } from '@/lib/autonomous/simulator';
import { invalidateAutonomousCache } from '@/lib/autonomous/orchestrator';
import { AUTONOMOUS_TAGLINE, type SimulationScenario } from '@/lib/autonomous/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'INVALID_BODY', message: 'Request body must be a JSON object.', tagline: AUTONOMOUS_TAGLINE },
        { status: 400 },
      );
    }

    const { scenario, parameters } = body as {
      scenario: string;
      parameters?: Record<string, unknown>;
    };

    if (!scenario || !(scenario in SCENARIO_META)) {
      return NextResponse.json(
        {
          error: 'INVALID_SCENARIO',
          message: `scenario must be one of: ${Object.keys(SCENARIO_META).join(', ')}`,
          tagline: AUTONOMOUS_TAGLINE,
        },
        { status: 400 },
      );
    }

    const { observation } = await observeCompany();
    const params = { ...SCENARIO_META[scenario as SimulationScenario].defaultParams, ...(parameters ?? {}) };
    const simulation = await runSimulation(scenario as SimulationScenario, params, observation);
    invalidateAutonomousCache();

    return NextResponse.json(
      { simulation, tagline: AUTONOMOUS_TAGLINE },
      { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Autonomous': 'true' } },
    );
  } catch (error) {
    console.error('[Autonomous Simulate] Error:', error);
    return NextResponse.json(
      { error: 'Failed to run simulation', message: error instanceof Error ? error.message : 'Unknown error', tagline: AUTONOMOUS_TAGLINE },
      { status: 500 },
    );
  }
}
