// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI WORKFORCE™ — PERFORMANCE API
// GET /api/ai-workforce/performance
//
// Returns the performance leaderboard (all 17 AI Employees ranked by overall
// score), the top employee, and the aggregate metrics bundle (total ROI,
// revenue influenced, cost saved, automation rate, average health score,
// collaboration messages, meetings this week, active cross-decisions).
//
// Backed by the 60s cached WorkforceDashboard bundle. The
// X-Workforce-Top-Employee header exposes the #1 employee's role for quick
// client-side checks.
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
        leaderboard: dashboard.performance,
        topEmployee: dashboard.topEmployee,
        aggregateMetrics: dashboard.aggregateMetrics,
        tagline: WORKFORCE_TAGLINE,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-AI-Workforce': 'true',
          'X-Workforce-Top-Employee': dashboard.topEmployee?.role ?? 'none',
        },
      },
    );
  } catch (error) {
    console.error('[Workforce-Performance] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to load AI Workforce performance',
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
