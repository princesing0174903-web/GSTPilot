// GET /api/autonomous/goals — Goal Engine: live goal tracking
import { NextResponse } from 'next/server';
import { observeCompany } from '@/lib/autonomous/observer';
import { loadGoals } from '@/lib/autonomous/goals';
import { AUTONOMOUS_TAGLINE } from '@/lib/autonomous/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const { observation } = await observeCompany();
    const goals = await loadGoals(observation);
    return NextResponse.json(
      { goals, total: goals.length, tagline: AUTONOMOUS_TAGLINE },
      { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Autonomous': 'true' } },
    );
  } catch (error) {
    console.error('[Autonomous Goals] Error:', error);
    return NextResponse.json({ error: 'Failed to load goals', tagline: AUTONOMOUS_TAGLINE }, { status: 500 });
  }
}
