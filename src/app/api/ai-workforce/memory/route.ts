// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI WORKFORCE™ — MEMORY API
// GET /api/ai-workforce/memory?role=ceo
//
// Returns AI Employee memories: each AI Employee maintains a `recentMemory[]`
// array of EmployeeMemoryEntry records (decision, conversation, mistake,
// success, outcome, strategy, meeting, learning, risk_event, milestone).
//
// Optional `?role=<EmployeeRole>` query param filters memories to a single
// employee (e.g. `?role=cfo` returns only the CFO's memory). When omitted,
// memories from all 17 AI Employees are returned in a single flat array.
//
// Backed by the 60s cached WorkforceDashboard bundle. The
// X-Workforce-Memory-Count header exposes the total memory entry count.
//
// Tagline: GSTPilot AI Workforce™ — Don't just use AI. Build an AI Company.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getCachedWorkforceDashboard } from '@/lib/workforce/orchestrator';
import { WORKFORCE_TAGLINE } from '@/lib/workforce/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roleFilter = searchParams.get('role')?.toLowerCase().trim() || undefined;

    const dashboard = await getCachedWorkforceDashboard();

    // Filter the organization by role if a role query param was provided.
    const scopedEmployees = roleFilter
      ? dashboard.organization.filter((e) => e.role === roleFilter)
      : dashboard.organization;

    // Flatten each employee's recentMemory array into a single list.
    const memories = scopedEmployees.flatMap((employee) => employee.recentMemory);

    return NextResponse.json(
      {
        memories,
        count: memories.length,
        tagline: WORKFORCE_TAGLINE,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-AI-Workforce': 'true',
          'X-Workforce-Memory-Count': String(memories.length),
        },
      },
    );
  } catch (error) {
    console.error('[Workforce-Memory] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to load AI Workforce memory',
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
