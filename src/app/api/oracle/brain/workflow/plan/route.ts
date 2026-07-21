// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Workflow Plan API
// POST /api/oracle/brain/workflow/plan
//
// Converts a natural-language message into a WorkflowPlan (no execution).
// Called by the brain route when the LLM emits a `runWorkflow` tool call, OR
// directly by the frontend when the user types a multi-step request.
//
// Request body:
//   {
//     message: string,             — the user's natural-language request
//     orgId: string,               — tenant scope
//     extractedArgs?: Record,      — structured args the LLM extracted earlier
//     sessionId?: string,
//     userId?: string,
//   }
//
// Response (200):
//   { ok: true, plan: WorkflowPlan, source: 'template' | 'llm' }
//   { ok: false, error: string }  — no workflow could be planned (caller falls
//                                   back to single-action mode)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { planWorkflow, type WorkflowPlannerInput } from '@/lib/oracle/workflow-engine';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const message: string = String(body.message ?? '').trim();
  const orgId: string = String(body.orgId ?? '').trim();
  const extractedArgs: Record<string, any> | undefined =
    body.extractedArgs && typeof body.extractedArgs === 'object' ? body.extractedArgs : undefined;
  const sessionId: string | undefined = body.sessionId ? String(body.sessionId) : undefined;
  const userId: string | undefined = body.userId ? String(body.userId) : undefined;

  if (!message) {
    return NextResponse.json({ ok: false, error: 'message is required' }, { status: 400 });
  }
  if (!orgId) {
    return NextResponse.json({ ok: false, error: 'orgId is required' }, { status: 400 });
  }

  const input: WorkflowPlannerInput = { message, orgId, extractedArgs, sessionId, userId };
  const result = await planWorkflow(input);

  if (!result.ok || !result.plan) {
    return NextResponse.json({ ok: false, error: result.error ?? 'Planning failed' }, { status: 200 });
  }

  return NextResponse.json({
    ok: true,
    plan: result.plan,
    source: result.source,
  });
}
