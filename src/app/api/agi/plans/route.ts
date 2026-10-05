// GET /api/agi/plans
// Returns all AGI plans (Autonomous Project Manager) + the PM summary.
import { NextResponse } from 'next/server';
import { getPlans, getProjectManagerSummary } from '@/lib/agi/pm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const [plans, summary] = await Promise.all([getPlans(50), getProjectManagerSummary()]);
    return NextResponse.json({ ok: true, plans, summary });
  } catch (err) {
    console.error('[agi/plans] Error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to load AGI plans' }, { status: 500 });
  }
}
