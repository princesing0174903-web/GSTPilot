// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI CEO™ — AUTONOMOUS TASKS API
// GET /api/ceo/tasks
//
// Returns the Autonomous Task Engine™ feed — open / in-progress / blocked /
// completed / cancelled tasks across recover overdue, file GST, reply customer,
// review expense, approve payroll, review compliance, renew subscription,
// review contract, pay vendor, follow up lead, generate invoice, send reminder,
// schedule meeting, generate report, send proposal, create quotation,
// investigate anomaly.
//
// Returns { tasks, openCount, tagline }.
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
        tasks: dashboard.tasks,
        openCount: dashboard.openTaskCount,
        tagline: CEO_TAGLINE,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-AI-CEO': 'true',
          'X-CEO-Open-Tasks': String(dashboard.openTaskCount),
        },
      },
    );
  } catch (error) {
    console.error('[CEO-Tasks] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to compute Autonomous Tasks',
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
