// GET /api/agi/goals
// Returns all AGI goals with live progress + the goal summary.
import { NextResponse } from 'next/server';
import { getGoals, getGoalSummary } from '@/lib/agi/goals';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const [goals, summary] = await Promise.all([getGoals(50), getGoalSummary()]);
    return NextResponse.json({ ok: true, goals, summary });
  } catch (err) {
    console.error('[agi/goals] Error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to load AGI goals' }, { status: 500 });
  }
}
