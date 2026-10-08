// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI WORKFORCE™ — DEPARTMENTS API
// GET /api/ai-workforce/departments
//
// Returns the 13 DepartmentDashboard records: each department's lead, members,
// health score, KPIs, goals, open task count, alerts, AI decisions,
// recommendations, budget utilization, and status (green/amber/red).
//
// Backed by the 60s cached WorkforceDashboard bundle. The
// X-Workforce-Department-Count header exposes the total department count.
//
// Tagline: VEYRO AI Workforce™ — Don't just use AI. Build an AI Company.
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
        departments: dashboard.departments,
        count: dashboard.departmentCount,
        tagline: WORKFORCE_TAGLINE,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-AI-Workforce': 'true',
          'X-Workforce-Department-Count': String(dashboard.departmentCount),
        },
      },
    );
  } catch (error) {
    console.error('[Workforce-Departments] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to load AI Workforce departments',
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
