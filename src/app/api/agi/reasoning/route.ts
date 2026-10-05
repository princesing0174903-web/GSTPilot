// GET /api/agi/reasoning
// Returns recent reasoning cycles + the reasoning summary. Accepts ?run=1 to trigger a new cycle.
import { NextRequest, NextResponse } from 'next/server';
import { getRecentCycles, getReasoningSummary, runReasoningCycle } from '@/lib/agi/reasoning';
import type { ReasoningCycle, ReasoningTrigger, ReasoningFocus } from '@/lib/agi/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const run = request.nextUrl.searchParams.get('run');
    let newCycle: ReasoningCycle | null = null;
    if (run === '1') {
      const trigger = (request.nextUrl.searchParams.get('trigger') as ReasoningTrigger) ?? 'scheduled';
      const focus = request.nextUrl.searchParams.get('focus') as ReasoningFocus | null;
      newCycle = await runReasoningCycle(trigger, focus ?? undefined);
    }
    const [recent, summary] = await Promise.all([getRecentCycles(20), getReasoningSummary()]);
    return NextResponse.json({ ok: true, recent, summary, newCycle });
  } catch (err) {
    console.error('[agi/reasoning] Error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to load AGI reasoning' }, { status: 500 });
  }
}
