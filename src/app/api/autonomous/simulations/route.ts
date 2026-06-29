// GET /api/autonomous/simulations — Digital Twin Simulator 2.0: recent simulations
import { NextResponse } from 'next/server';
import { loadRecentSimulations } from '@/lib/autonomous/simulator';
import { AUTONOMOUS_TAGLINE, type SimulationScenario } from '@/lib/autonomous/types';
import { SCENARIO_META } from '@/lib/autonomous/simulator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const simulations = await loadRecentSimulations(12);
    const scenarios = (Object.keys(SCENARIO_META) as SimulationScenario[]).map((s) => ({
      scenario: s,
      title: SCENARIO_META[s].title,
      description: SCENARIO_META[s].description,
      defaultParams: SCENARIO_META[s].defaultParams,
    }));
    return NextResponse.json(
      { simulations, scenarios, total: simulations.length, tagline: AUTONOMOUS_TAGLINE },
      { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Autonomous': 'true' } },
    );
  } catch (error) {
    console.error('[Autonomous Simulations] Error:', error);
    return NextResponse.json({ error: 'Failed to load simulations', tagline: AUTONOMOUS_TAGLINE }, { status: 500 });
  }
}
