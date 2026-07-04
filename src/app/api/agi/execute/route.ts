// POST /api/agi/execute
// Execute an AGI action (advance a decision, run a workflow, etc.). High-risk
// actions are routed through the human-approval workflow automatically.
// Body: { action, targetType, targetId?, actorId?, role?, riskScore?, financialImpact?, reason? }
import { NextRequest, NextResponse } from 'next/server';
import { auditCommand, decideApproval } from '@/lib/agi/security';
import { runReasoningCycle } from '@/lib/agi/reasoning';
import { invalidateCache } from '@/lib/agi/helpers';
import { db } from '@/lib/agi/helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body?.action) {
      return NextResponse.json({ ok: false, error: 'action is required' }, { status: 400 });
    }
    const audit = await auditCommand({
      actionType: body.action,
      targetType: body.targetType ?? 'decision',
      targetId: body.targetId ?? null,
      actorId: body.actorId ?? 'oracle',
      actorType: 'oracle',
      role: body.role ?? 'manager',
      riskScore: Number(body.riskScore) || 0,
      financialImpact: Number(body.financialImpact) || 0,
      payload: JSON.stringify(body),
      reason: body.reason ?? `${body.action} on ${body.targetType ?? 'decision'}`,
    });

    // If the action needs approval, return the approval request
    if (audit.approvalId && !audit.allowed) {
      return NextResponse.json({
        ok: false,
        error: 'Action requires human approval',
        audit,
        approvalId: audit.approvalId,
      }, { status: 202 });
    }
    if (!audit.allowed) {
      return NextResponse.json({ ok: false, error: 'Action blocked by AGI security', audit }, { status: 403 });
    }

    // If this is a decision execution, update the AGIDecision status
    if (body.action === 'execute' && body.targetType === 'decision' && body.targetId) {
      try {
        await db.aGIDecision.update({
          where: { id: body.targetId },
          data: { status: 'executing', executedAt: new Date() },
        });
      } catch { /* ignore */ }
    }

    // If requested, run a reasoning cycle after the action
    if (body.runReasoning) {
      const cycle = await runReasoningCycle('human');
      invalidateCache('agi:');
      return NextResponse.json({ ok: true, audit, cycle });
    }

    invalidateCache('agi:dashboard');
    return NextResponse.json({ ok: true, audit });
  } catch (err) {
    console.error('[agi/execute] Error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to execute AGI action' }, { status: 500 });
  }
}
