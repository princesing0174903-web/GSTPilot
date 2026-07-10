// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI CEO™ — EXECUTIVE DECISIONS API
// GET /api/ceo/decisions?status=pending
//
// Returns the Executive Decision Engine™ feed — autonomous decisions with
// financial impact, confidence, priority, risk, business impact, rollback plan,
// approval requirement, evidence, and current status.
//
// Optional `?status=pending` filter restricts to pending decisions only.
//
// Returns { decisions, pendingCount, tagline }.
//
// Tagline: GSTPilot AI CEO™ — Run Your Business. Not Your Software.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getCachedCEODashboard } from '@/lib/ceo/orchestrator';
import { CEO_TAGLINE } from '@/lib/ceo/types';
import type { DecisionStatus, ExecutiveDecision } from '@/lib/ceo/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Allowed status filter values (matches DecisionStatus type)
const ALLOWED_STATUSES: ReadonlySet<DecisionStatus> = new Set([
  'pending',
  'approved',
  'rejected',
  'executing',
  'executed',
  'failed',
  'superseded',
  'auto_approved',
]);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status');

    const dashboard = await getCachedCEODashboard('ceo');

    let decisions: ExecutiveDecision[] = dashboard.decisions;
    let statusFilterApplied = false;

    if (statusParam) {
      const normalized = statusParam.toLowerCase();
      if (!ALLOWED_STATUSES.has(normalized as DecisionStatus)) {
        return NextResponse.json(
          {
            error: 'INVALID_STATUS',
            message: `Unknown status "${statusParam}". Allowed: ${Array.from(ALLOWED_STATUSES).join(', ')}.`,
            tagline: CEO_TAGLINE,
          },
          {
            status: 400,
            headers: {
              'Cache-Control': 'no-store, max-age=0',
              'X-AI-CEO': 'true',
            },
          },
        );
      }
      decisions = decisions.filter((d) => d.status === normalized);
      statusFilterApplied = true;
    }

    return NextResponse.json(
      {
        decisions,
        pendingCount: dashboard.pendingDecisionCount,
        tagline: CEO_TAGLINE,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-AI-CEO': 'true',
          'X-CEO-Decision-Count': String(decisions.length),
          'X-CEO-Pending-Decisions': String(dashboard.pendingDecisionCount),
          'X-CEO-Status-Filter': statusFilterApplied ? (statusParam ?? '') : 'none',
        },
      },
    );
  } catch (error) {
    console.error('[CEO-Decisions] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to compute Executive Decisions',
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
