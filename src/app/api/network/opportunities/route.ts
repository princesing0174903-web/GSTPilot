// GET /api/network/opportunities
// Returns the Global Opportunity Engine™ summary (funnel, byType, bySource, top opportunities).

import { NextResponse } from 'next/server';
import { getOpportunityEngineSummary } from '@/lib/network/opportunities';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const summary = await getOpportunityEngineSummary();
    return NextResponse.json(summary, {
      headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Network': 'true' },
    });
  } catch (error) {
    console.error('[Network opportunities] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load opportunity summary', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
