// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI WORKFORCE™ — MEETINGS API
// GET /api/ai-workforce/meetings
//
// Returns the auto-generated AI Meeting agenda: daily standup, weekly
// leadership sync, monthly board review, quarterly strategy, annual planning.
// Each meeting includes attendees, agenda, insights, risks, KPIs, action
// items, and executive summary.
//
// Backed by the 60s cached WorkforceDashboard bundle. The
// X-Workforce-Meeting-Count header exposes the total meeting count.
//
// Tagline: GSTPilot AI Workforce™ — Don't just use AI. Build an AI Company.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getCachedWorkforceDashboard } from '@/lib/workforce/orchestrator';
import { WORKFORCE_TAGLINE } from '@/lib/workforce/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  try {
    const dashboard = await getCachedWorkforceDashboard();

    return NextResponse.json(
      {
        meetings: dashboard.meetings,
        count: dashboard.meetings.length,
        tagline: WORKFORCE_TAGLINE,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-AI-Workforce': 'true',
          'X-Workforce-Meeting-Count': String(dashboard.meetings.length),
        },
      },
    );
  } catch (error) {
    console.error('[Workforce-Meetings] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to load AI Workforce meetings',
        message: error instanceof Error ? error.message : 'Unknown error',
        tagline: WORKFORCE_TAGLINE,
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-AI-Workforce': 'true',
        },
      },
    );
  }
}
