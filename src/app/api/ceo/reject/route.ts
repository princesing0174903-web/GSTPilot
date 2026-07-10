// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI CEO™ — REJECT DECISION API
// POST /api/ceo/reject
//
// Body: { decisionId: string, role: ExecutiveRole, userId?: string, reason?: string }
//
// Marks an Executive Decision Engine™ decision as rejected. The reason (if
// provided) is recorded so Oracle can learn from CEO/CFO/Manager feedback.
//
// Role policy is enforced. Returns HTTP 400 for malformed bodies, 200 with the
// result on success. After rejection the CEO dashboard cache is invalidated so
// the next GET reflects the updated status.
//
// Tagline: GSTPilot AI CEO™ — Run Your Business. Not Your Software.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { rejectDecision, invalidateCEOCache } from '@/lib/ceo/orchestrator';
import { CEO_TAGLINE } from '@/lib/ceo/types';
import type { RejectRequest, ExecutiveRole } from '@/lib/ceo/types';

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

    const { decisionId, role, userId, reason } = body as Record<string, unknown>;

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

    const rejectReq: RejectRequest = {
      decisionId: decisionId.trim(),
      role: role.toLowerCase() as ExecutiveRole,
      userId: typeof userId === 'string' && userId.trim() !== '' ? userId.trim() : undefined,
      reason: typeof reason === 'string' && reason.trim() !== '' ? reason.trim() : undefined,
    };

    const result = await rejectDecision(rejectReq);

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
    console.error('[CEO-Reject] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to reject decision',
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
