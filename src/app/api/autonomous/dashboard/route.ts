// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AUTONOMOUS ENTERPRISE™ — EXECUTIVE COMMAND CENTER DASHBOARD API
// GET /api/autonomous/dashboard
//
// Returns the full AutonomousDashboard: live company observation, command
// center metrics, 9 AI executives, decisions, strategy room meetings,
// continuous plans, goals, workflows, simulations, memory stats, alerts,
// learnings, self-healing + execution stats. Cached 45s in-memory.
//
// Everything flows from REAL connected business data. No mock values.
// Tagline: VEYRO™ — Think. Decide. Execute. Learn. Grow.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getAutonomousDashboard } from '@/lib/autonomous/orchestrator';
import { AUTONOMOUS_TAGLINE } from '@/lib/autonomous/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

let lastGeneratedAt: string | null = null;

export async function GET() {
  try {
    const dashboard = await getAutonomousDashboard();
    const cacheStatus = lastGeneratedAt === dashboard.generatedAt ? 'HIT' : 'MISS';
    lastGeneratedAt = dashboard.generatedAt;

    return NextResponse.json(dashboard, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Autonomous': 'true',
        'X-Autonomous-Cache': cacheStatus,
        'X-Autonomous-Live-Data': dashboard.hasLiveData ? 'true' : 'false',
        'X-Autonomous-Sources': dashboard.dataSources.join(','),
      },
    });
  } catch (error) {
    console.error('[Autonomous Dashboard] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to compute Autonomous Enterprise dashboard',
        message: error instanceof Error ? error.message : 'Unknown error',
        tagline: AUTONOMOUS_TAGLINE,
      },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Autonomous': 'true' },
      },
    );
  }
}
