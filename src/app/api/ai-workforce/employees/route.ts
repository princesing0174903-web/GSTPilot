// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI WORKFORCE™ — EMPLOYEES API
// GET /api/ai-workforce/employees
//
// Returns the 17 AI Employees (full AIEmployee records: KPIs, health,
// recommendations, performance, memory, skills, status) plus the active
// employee count.
//
// Backed by the 60s cached WorkforceDashboard bundle. The
// X-Workforce-Employee-Count header exposes the total headcount for quick
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
        employees: dashboard.organization,
        activeCount: dashboard.activeEmployeeCount,
        tagline: WORKFORCE_TAGLINE,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-AI-Workforce': 'true',
          'X-Workforce-Employee-Count': String(dashboard.organization.length),
        },
      },
    );
  } catch (error) {
    console.error('[Workforce-Employees] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to load AI Workforce employees',
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
