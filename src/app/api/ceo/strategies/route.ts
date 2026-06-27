// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI CEO™ — AI STRATEGY ENGINE API
// GET /api/ceo/strategies
//
// Returns the AI Strategy Engine™ feed — proposed / active / on-track / at-risk
// / completed / paused strategies across revenue, expenses, collections, GST,
// margin, runway, diversification, and growth categories with milestones,
// KPIs, expected ROI, confidence, and progress.
//
// Returns { strategies, activeCount, tagline }.
//
// Tagline: GSTPilot AI CEO™ — Run Your Business. Not Your Software.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getCachedCEODashboard } from '@/lib/ceo/orchestrator';
import { CEO_TAGLINE } from '@/lib/ceo/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const dashboard = await getCachedCEODashboard('ceo');

    return NextResponse.json(
      {
        strategies: dashboard.strategies,
        activeCount: dashboard.activeStrategyCount,
        tagline: CEO_TAGLINE,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-AI-CEO': 'true',
          'X-CEO-Active-Strategies': String(dashboard.activeStrategyCount),
        },
      },
    );
  } catch (error) {
    console.error('[CEO-Strategies] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to compute AI Strategies',
        message: error instanceof Error ? error.message : 'Unknown error',
        tagline: CEO_TAGLINE,
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-AI-CEO': 'true',
        },
      },
    );
  }
}
