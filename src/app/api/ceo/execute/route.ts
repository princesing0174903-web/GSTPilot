// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI CEO™ — EXECUTE DECISION API
// POST /api/ceo/execute
//
// Body: {
//   decisionId: string,
//   role: ExecutiveRole,
//   userId?: string,
//   workflowType?: WorkflowType
// }
//
// Triggers the Autonomous Workflow Engine™ for an approved decision. If
// `workflowType` is omitted, the engine maps the decision type to a sensible
// default workflow (e.g. recover_payment → send_reminder, follow_up_lead →
// create_follow_up, review_compliance → generate_report).
//
// Allowed workflow types: send_reminder, generate_invoice, schedule_meeting,
// create_follow_up, generate_report, send_proposal, create_quotation,
// assign_task.
//
// Role policy is enforced (decision must be approved/auto-approved first).
// Returns HTTP 400 for malformed bodies, 200 with the execution result on
// success. After execution the CEO dashboard cache is invalidated.
//
// Tagline: VEYRO AI CEO™ — Run Your Business. Not Your Software.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { executeDecision, invalidateCEOCache } from '@/lib/ceo/orchestrator';
import { CEO_TAGLINE } from '@/lib/ceo/types';
import type { ExecuteRequest, ExecutiveRole, WorkflowType } from '@/lib/ceo/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_ROLES: ReadonlySet<ExecutiveRole> = new Set([
  'ceo',
  'cfo',
  'manager',
  'employee',
  'auditor',
]);

const VALID_WORKFLOW_TYPES: ReadonlySet<WorkflowType> = new Set([
  'send_reminder',
  'generate_invoice',
  'schedule_meeting',
  'create_follow_up',
  'generate_report',
  'send_proposal',
  'create_quotation',
  'assign_task',
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

    const { decisionId, role, userId, workflowType } = body as Record<string, unknown>;

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

    let normalizedWorkflowType: WorkflowType | undefined;
    if (workflowType !== undefined && workflowType !== null) {
      if (
        typeof workflowType !== 'string' ||
        !VALID_WORKFLOW_TYPES.has(workflowType.toLowerCase() as WorkflowType)
      ) {
        return NextResponse.json(
          {
            error: 'INVALID_BODY',
            message: `workflowType must be one of: ${Array.from(VALID_WORKFLOW_TYPES).join(', ')}.`,
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
      normalizedWorkflowType = workflowType.toLowerCase() as WorkflowType;
    }

    const executeReq: ExecuteRequest = {
      decisionId: decisionId.trim(),
      role: role.toLowerCase() as ExecutiveRole,
      userId: typeof userId === 'string' && userId.trim() !== '' ? userId.trim() : undefined,
      workflowType: normalizedWorkflowType,
    };

    const result = await executeDecision(executeReq);

    // Invalidate cache so the next dashboard GET shows the updated status
    invalidateCEOCache();

    return NextResponse.json(
      { result, tagline: CEO_TAGLINE },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-AI-CEO': 'true',
          'X-CEO-Decision-Status': result.status,
          'X-CEO-Workflow-Status': result.workflowResult.status,
        },
      },
    );
  } catch (error) {
    console.error('[CEO-Execute] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to execute decision',
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
