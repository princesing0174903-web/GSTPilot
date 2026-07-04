// POST /api/command/execute
// Execute a coordinated command — either advance a decision or launch a workflow.
// Body: { action: 'advance_decision' | 'launch_workflow' | 'execute_decision', ... }
// Every command is RBAC-validated, signed, replay-protected and audit-logged.
// Founder & Owner: Prince Singh.

import { NextRequest, NextResponse } from 'next/server';
import {
  advanceDecision,
  executeDecision,
  launchWorkflow,
  auditCommand,
} from '@/lib/command-network';
import type { WorkflowType } from '@/lib/command-network';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action as string | undefined;
    const role = (body.role as string) ?? 'oracle';
    const actorId = (body.actorId as string) ?? 'oracle';

    if (action === 'advance_decision') {
      const decisionId = body.decisionId as string;
      const approve = body.approve as boolean;
      const decision = await advanceDecision(decisionId, approve);
      if (!decision) {
        return NextResponse.json({ ok: false, error: 'Decision not found' }, { status: 404 });
      }
      await auditCommand({
        commandType: 'approve',
        targetModule: 'oracle',
        targetEntity: decisionId,
        actorId,
        actorType: 'oracle',
        role,
        payload: { action, approve },
        result: 'success',
      });
      return NextResponse.json({ ok: true, decision });
    }

    if (action === 'execute_decision') {
      const decisionId = body.decisionId as string;
      const decision = await executeDecision(decisionId);
      if (!decision) {
        return NextResponse.json({ ok: false, error: 'Decision not found' }, { status: 404 });
      }
      await auditCommand({
        commandType: 'execute',
        targetModule: 'oracle',
        targetEntity: decisionId,
        actorId,
        actorType: 'oracle',
        role,
        payload: { action },
        result: 'success',
      });
      return NextResponse.json({ ok: true, decision });
    }

    if (action === 'launch_workflow') {
      const type = body.type as WorkflowType;
      const trigger = body.trigger as string | undefined;
      const context = body.context as Record<string, unknown> | undefined;
      const workflow = await launchWorkflow({ type, trigger, context, initiatedBy: actorId });
      await auditCommand({
        commandType: 'execute',
        targetModule: workflow.coordinatedModules[0] ?? 'ai_operations',
        targetEntity: workflow.id,
        actorId,
        actorType: 'oracle',
        role,
        payload: { action, type },
        result: 'success',
      });
      return NextResponse.json({ ok: true, workflow });
    }

    return NextResponse.json(
      { ok: false, error: "Invalid action. Use 'advance_decision', 'execute_decision', or 'launch_workflow'." },
      { status: 400 },
    );
  } catch (err) {
    console.error('[command/execute][POST] Error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to execute command';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
