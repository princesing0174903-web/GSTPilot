// GET /api/autonomous/decisions — AI Decision Engine: live + recent decisions
import { NextResponse } from 'next/server';
import { observeCompany } from '@/lib/autonomous/observer';
import { buildLiveDecisions } from '@/lib/autonomous/decision-engine';
import { AUTONOMOUS_TAGLINE } from '@/lib/autonomous/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const { observation } = await observeCompany();
    const decisions = await buildLiveDecisions(observation);
    return NextResponse.json(
      { decisions, total: decisions.length, tagline: AUTONOMOUS_TAGLINE },
      { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Autonomous': 'true' } },
    );
  } catch (error) {
    console.error('[Autonomous Decisions] Error:', error);
    return NextResponse.json({ error: 'Failed to load decisions', tagline: AUTONOMOUS_TAGLINE }, { status: 500 });
  }
}
