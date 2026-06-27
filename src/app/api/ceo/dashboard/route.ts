// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI CEO™ — EXECUTIVE DASHBOARD API
// GET /api/ceo/dashboard?role=ceo&userName=Prince
//
// Returns the full CEODashboard bundle: live state, decisions, brief, alerts,
// strategies, tasks, goals, workflows, memory, board report, health/risk/cash/
// runway scores, top decision, top alert — everything the CEO cockpit needs.
//
// Cached 60s in-memory (matching the Twin / CFO Phase 1 pattern). The
// X-CEO-Cache header reports HIT|MISS so the frontend can show staleness.
//
// Tagline: GSTPilot AI CEO™ — Run Your Business. Not Your Software.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getCachedCEODashboard } from '@/lib/ceo/orchestrator';
import { resolveRole } from '@/lib/ceo/policy';
import { CEO_TAGLINE } from '@/lib/ceo/types';
import type { ExecutiveRole } from '@/lib/ceo/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Local mirror of the orchestrator's cache state so we can report HIT|MISS.
// The orchestrator returns the SAME generatedAt timestamp on a cache hit, so
// we just compare against the last response we sent.
let lastGeneratedAt: string | null = null;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roleParam = searchParams.get('role') ?? undefined;
    const userName = searchParams.get('userName') ?? undefined;
    const role: ExecutiveRole = resolveRole(roleParam);

    const dashboard = await getCachedCEODashboard(role, userName);

    const cacheStatus = lastGeneratedAt === dashboard.generatedAt ? 'HIT' : 'MISS';
    lastGeneratedAt = dashboard.generatedAt;

    return NextResponse.json(dashboard, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-AI-CEO': 'true',
        'X-CEO-Cache': cacheStatus,
        'X-CEO-Role': role,
        'X-CEO-Data-Sources': dashboard.dataSources.join(','),
        'X-CEO-Live-Data': dashboard.hasLiveData ? 'true' : 'false',
      },
    });
  } catch (error) {
    console.error('[CEO-Dashboard] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to compute AI CEO dashboard',
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
