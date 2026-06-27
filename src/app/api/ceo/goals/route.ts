// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI CEO™ — BUSINESS GOALS API
// GET /api/ceo/goals
//
// Returns the Business Goals™ feed — revenue, profit, collections, GST
// compliance, customer growth, employee growth, runway, and market expansion
// goals with baseline / current / target / progress / status / trend.
//
// Returns { goals, tagline }.
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
        goals: dashboard.goals,
        tagline: CEO_TAGLINE,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-AI-CEO': 'true',
          'X-CEO-Goals-Count': String(dashboard.goals.length),
        },
      },
    );
  } catch (error) {
    console.error('[CEO-Goals] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to compute Business Goals',
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
