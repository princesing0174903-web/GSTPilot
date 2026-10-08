// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI WORKFORCE™ — TASKS API
// GET /api/ai-workforce/tasks
//
// Returns the open task queue: every EmployeeRecommendation that includes a
// `suggestedAction` (i.e. an actionable recommendation) is treated as an open
// task. Tasks are derived by iterating across all 17 AI Employees in the
// organization and flattening their `recommendations[]` arrays.
//
// Each task record includes: { role, title, rationale, impact, priority,
// suggestedAction, deadline }. The `deadline` field defaults to the
// employee's `lastActiveAt` since the source recommendation does not carry
// its own due-date.
//
// Backed by the 60s cached WorkforceDashboard bundle. The
// X-Workforce-Open-Tasks header exposes the total open task count.
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

    // Flatten every employee's recommendations into a single task list.
    // Only recommendations with a `suggestedAction` count as actionable tasks.
    const tasks = dashboard.organization.flatMap((employee) =>
      employee.recommendations
        .filter((rec) => typeof rec.suggestedAction === 'string' && rec.suggestedAction!.trim() !== '')
        .map((rec) => ({
          role: employee.role,
          title: rec.title,
          rationale: rec.rationale,
          impact: rec.impact,
          priority: rec.priority,
          suggestedAction: rec.suggestedAction as string,
          // Recommendations don't carry an explicit deadline; use the employee's
          // lastActiveAt as a proxy for when the task was last reviewed.
          deadline: employee.lastActiveAt,
        })),
    );

    // Open count = tasks that are critical or high priority (need attention now)
    const openCount = tasks.filter((t) => t.priority === 'critical' || t.priority === 'high').length;

    return NextResponse.json(
      {
        tasks,
        openCount,
        tagline: WORKFORCE_TAGLINE,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-AI-Workforce': 'true',
          'X-Workforce-Open-Tasks': String(openCount),
        },
      },
    );
  } catch (error) {
    console.error('[Workforce-Tasks] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to load AI Workforce tasks',
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
