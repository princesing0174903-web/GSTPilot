// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI CEO™ — APPROVE DECISION API
// POST /api/ceo/approve
//
// Body: { decisionId: string, role: ExecutiveRole, userId?: string, comment?: string }
//
// Marks an Executive Decision Engine™ decision as approved. If the decision's
// actions are non-destructive and automated, the workflow is executed
// immediately (e.g. send_reminder, create_follow_up, schedule_meeting).
//
// Role policy is enforced: only roles >= the decision's required role may
// approve. Returns HTTP 400 for malformed bodies, 200 with the result on
// success.
//
// After approval the CEO dashboard cache is invalidated so the next GET
// reflects the updated status.
//
// Tagline: GSTPilot AI CEO™ — Run Your Business. Not Your Software.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { approveDecision, invalidateCEOCache } from '@/lib/ceo/orchestrator';
import { CEO_TAGLINE } from '@/lib/ceo/types';
import type { ApproveRequest, ExecutiveRole } from '@/lib/ceo/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_ROLES: ReadonlySet<ExecutiveRole> = new Set([
  'ceo',
  'cfo',
  'manager',
  'employee',
  'auditor',
]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        {
          error: 'INVALID_BODY',
          message: 'Request body must be a JSON object.',
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

    const { decisionId, role, userId, comment } = body as Record<string, unknown>;

    if (typeof decisionId !== 'string' || decisionId.trim() === '') {
      return NextResponse.json(
        {
          error: 'INVALID_BODY',
          message: 'decisionId is required and must be a non-empty string.',
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

    if (typeof role !== 'string' || !VALID_ROLES.has(role.toLowerCase() as ExecutiveRole)) {
      return NextResponse.json(
        {
          error: 'INVALID_BODY',
          message: `role must be one of: ${Array.from(VALID_ROLES).join(', ')}.`,
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

    const approveReq: ApproveRequest = {
      decisionId: decisionId.trim(),
      role: role.toLowerCase() as ExecutiveRole,
      userId: typeof userId === 'string' && userId.trim() !== '' ? userId.trim() : undefined,
      comment: typeof comment === 'string' && comment.trim() !== '' ? comment.trim() : undefined,
    };

    const result = await approveDecision(approveReq);

    // Invalidate cache so the next dashboard GET shows the updated status
    invalidateCEOCache();

    return NextResponse.json(
      { result, tagline: CEO_TAGLINE },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-AI-CEO': 'true',
          'X-CEO-Decision-Status': result.status,
        },
      },
    );
  } catch (error) {
    console.error('[CEO-Approve] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to approve decision',
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
