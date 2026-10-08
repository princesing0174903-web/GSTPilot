// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI WORKFORCE™ — EXECUTE DECISION API
// POST /api/ai-workforce/execute
//
// Body: {
//   decisionId: string,
//   role: ManagementRole | 'admin' | 'owner' | 'founder' | 'accountant' | 'finance',
//   userId?: string,
//   workflowType?: string
// }
//
// Force-executes a Cross-Department Decision, marking all remaining steps as
// approved/executed. Per orchestrator policy, only the CEO role may
// force-execute a decision — non-CEO callers receive a 200 response with a
// explanatory `message` and the decision's unchanged status. Callers should
// use the /approve endpoint to advance decisions step-by-step instead.
//
// Role policy: `resolveRole()` from @/lib/ceo/policy normalizes admin/owner/
// founder → ceo and accountant/finance → cfo. The 5 valid management roles
// are ceo, cfo, manager, employee, auditor.
//
// After execution the Workforce dashboard cache is invalidated so the next
// GET reflects the updated status.
//
// Tagline: VEYRO AI Workforce™ — Don't just use AI. Build an AI Company.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { executeCrossDecision, invalidateWorkforceCache } from '@/lib/workforce/orchestrator';
import { resolveRole } from '@/lib/ceo/policy';
import { WORKFORCE_TAGLINE } from '@/lib/workforce/types';
import type { ExecuteWorkforceRequest, ManagementRole } from '@/lib/workforce/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Accepted role inputs: the 5 management roles plus the aliases handled by
// resolveRole() (admin/owner/founder → ceo, accountant/finance → cfo).
const VALID_ROLE_INPUTS: ReadonlySet<string> = new Set([
  'ceo',
  'cfo',
  'manager',
  'employee',
  'auditor',
  'admin',
  'owner',
  'founder',
  'accountant',
  'finance',
]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        {
          error: 'INVALID_BODY',
          message: 'Request body must be a JSON object.',
          tagline: WORKFORCE_TAGLINE,
        },
        {
          status: 400,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
            'X-AI-Workforce': 'true',
          },
        },
      );
    }

    const { decisionId, role, userId, workflowType } = body as Record<string, unknown>;

    if (typeof decisionId !== 'string' || decisionId.trim() === '') {
      return NextResponse.json(
        {
          error: 'INVALID_BODY',
          message: 'decisionId is required and must be a non-empty string.',
          tagline: WORKFORCE_TAGLINE,
        },
        {
          status: 400,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
            'X-AI-Workforce': 'true',
          },
        },
      );
    }

    if (typeof role !== 'string' || !VALID_ROLE_INPUTS.has(role.toLowerCase())) {
      return NextResponse.json(
        {
          error: 'INVALID_BODY',
          message: `role must be one of: ceo, cfo, manager, employee, auditor (aliases: admin/owner/founder → ceo, accountant/finance → cfo).`,
          tagline: WORKFORCE_TAGLINE,
        },
        {
          status: 400,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
            'X-AI-Workforce': 'true',
          },
        },
      );
    }

    // Normalize the role (admin/owner/founder → ceo, etc.) via the policy layer.
    const normalizedRole: ManagementRole = resolveRole(role) as ManagementRole;

    // workflowType is optional — when omitted the orchestrator picks a sensible
    // default. When provided it must be a non-empty string.
    let normalizedWorkflowType: string | undefined;
    if (workflowType !== undefined && workflowType !== null) {
      if (typeof workflowType !== 'string' || workflowType.trim() === '') {
        return NextResponse.json(
          {
            error: 'INVALID_BODY',
            message: 'workflowType must be a non-empty string when provided.',
            tagline: WORKFORCE_TAGLINE,
          },
          {
            status: 400,
            headers: {
              'Cache-Control': 'no-store, max-age=0',
              'X-AI-Workforce': 'true',
            },
          },
        );
      }
      normalizedWorkflowType = workflowType.trim();
    }

    const executeReq: ExecuteWorkforceRequest = {
      decisionId: decisionId.trim(),
      role: normalizedRole,
      userId: typeof userId === 'string' && userId.trim() !== '' ? userId.trim() : undefined,
      workflowType: normalizedWorkflowType,
    };

    const result = await executeCrossDecision(executeReq);

    // Invalidate cache so the next dashboard GET shows the updated status
    invalidateWorkforceCache();

    return NextResponse.json(
      { result, tagline: WORKFORCE_TAGLINE },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-AI-Workforce': 'true',
          'X-Workforce-Decision-Status': result.status,
        },
      },
    );
  } catch (error) {
    console.error('[Workforce-Execute] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to execute cross-department decision',
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
