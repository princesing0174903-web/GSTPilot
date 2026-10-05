// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI WORKFORCE™ — DASHBOARD API
// GET /api/ai-workforce/dashboard
//
// Returns the full WorkforceDashboard bundle: 17 AI Employees, 13 department
// dashboards, collaboration feed, meetings, cross-department decisions,
// performance leaderboard, marketplace, delegations, escalations, and
// aggregate metrics — everything the AI Workforce cockpit needs.
//
// Cached 60s in-memory via getCachedWorkforceDashboard(). The
// X-Workforce-Cache header reports HIT|MISS by comparing the
// generatedAt timestamp to the last response we sent.
//
// Tagline: GSTPilot AI Workforce™ — Don't just use AI. Build an AI Company.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getCachedWorkforceDashboard } from '@/lib/workforce/orchestrator';
import { WORKFORCE_TAGLINE } from '@/lib/workforce/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Local mirror of the orchestrator's cache state so we can report HIT|MISS.
// The orchestrator returns the SAME generatedAt timestamp on a cache hit, so
// we just compare against the last response we sent.
let lastGeneratedAt: string | null = null;

export async function GET(_req: NextRequest) {
  try {
    const dashboard = await getCachedWorkforceDashboard();

    const cacheStatus = lastGeneratedAt === dashboard.generatedAt ? 'HIT' : 'MISS';
    lastGeneratedAt = dashboard.generatedAt;

    return NextResponse.json(dashboard, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-AI-Workforce': 'true',
        'X-Workforce-Cache': cacheStatus,
        'X-Workforce-Employees': String(dashboard.organization.length),
        'X-Workforce-Departments': String(dashboard.departmentCount),
        'X-Workforce-Live-Data': dashboard.hasLiveData ? 'true' : 'false',
      },
    });
  } catch (error) {
    console.error('[Workforce-Dashboard] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to compute AI Workforce dashboard',
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
