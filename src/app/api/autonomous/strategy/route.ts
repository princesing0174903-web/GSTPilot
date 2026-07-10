// GET /api/autonomous/strategy — AI Strategy Room: recent meetings + live debate
import { NextRequest, NextResponse } from 'next/server';
import { observeCompany } from '@/lib/autonomous/observer';
import { loadRecentMeetings, runStrategyDebate } from '@/lib/autonomous/strategy-room';
import { AUTONOMOUS_TAGLINE } from '@/lib/autonomous/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { observation } = await observeCompany();
    const recentMeetings = await loadRecentMeetings(8);
    return NextResponse.json(
      {
        recentMeetings,
        total: recentMeetings.length,
        tagline: AUTONOMOUS_TAGLINE,
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Autonomous': 'true' } },
    );
  } catch (error) {
    console.error('[Autonomous Strategy] Error:', error);
    return NextResponse.json({ error: 'Failed to load strategy room', tagline: AUTONOMOUS_TAGLINE }, { status: 500 });
  }
}
