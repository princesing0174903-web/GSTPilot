import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { Approval, ExecutionTask } from '@/lib/execution/types';
import { seedApprovals, getApprovalSummary, assessRisk, createApproval, needsApproval } from '@/lib/execution/approvals';
import { seedExecutionTasks } from '@/lib/execution/execute';
import { seedDecisions } from '@/lib/execution/think';
import { seedBusinessEvents } from '@/lib/execution/observe';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT APPROVAL ENGINE™ — API
// GET  /api/approvals  → list all approvals + summary
// POST /api/approvals  → { action: 'request'|'approve'|'reject', taskId?, approvalId? }
// ═══════════════════════════════════════════════════════════════════════════════

function mapApprovalRow(r: {
  id: string; taskId: string; risk: number; status: string;
  reason: string | null; approvedBy: string | null; approvedAt: Date | null;
  createdAt: Date; updatedAt: Date;
}): Approval {
  return {
    id: r.id, taskId: r.taskId, risk: r.risk,
    status: r.status as Approval['status'], reason: r.reason,
    approvedBy: r.approvedBy,
    approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  };
}

function mapTaskRow(r: {
  id: string; decisionId: string | null; type: string; description: string;
  status: string; startedAt: Date | null; completedAt: Date | null;
  result: string | null; riskScore: number; agent: string | null;
  createdAt: Date; updatedAt: Date;
}): ExecutionTask {
  return {
    id: r.id, decisionId: r.decisionId,
    type: r.type as ExecutionTask['type'], description: r.description,
    status: r.status as ExecutionTask['status'],
    startedAt: r.startedAt ? r.startedAt.toISOString() : null,
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    result: r.result ? safeJsonParse(r.result) : null,
    riskScore: r.riskScore, agent: r.agent as ExecutionTask['agent'],
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  };
}

function safeJsonParse(s: string): Record<string, unknown> | null {
  try { return JSON.parse(s) as Record<string, unknown>; } catch { return null; }
}

async function resolveTasks(): Promise<ExecutionTask[]> {
  const rows = await db.executionTask.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  if (rows.length > 0) return rows.map(mapTaskRow);
  // Seed fallback chain: events → decisions → tasks
  const events = seedBusinessEvents();
  const decisions = seedDecisions(events);
  return seedExecutionTasks(decisions);
}

export async function GET() {
  try {
    const tasks = await resolveTasks();
    const approvalRows = await db.approval.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
    const approvals: Approval[] = approvalRows.length > 0 ? approvalRows.map(mapApprovalRow) : seedApprovals(tasks);
    const summary = getApprovalSummary(approvals);
    return NextResponse.json({ approvals, summary });
  } catch (error) {
    console.error('GET /api/approvals error:', error);
    return NextResponse.json({ error: 'Failed to load approvals' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      action: 'request' | 'approve' | 'reject';
      taskId?: string;
      approvalId?: string;
      approvedBy?: string;
      reason?: string;
      taskType?: string;
      taskDescription?: string;
      riskScore?: number;
    };

    if (body.action === 'request') {
      // Create a new approval request for a task
      const tasks = await resolveTasks();
      const task = tasks.find((t) => t.id === body.taskId) ?? {
        id: body.taskId ?? `task_${Date.now()}`,
        decisionId: null,
        type: (body.taskType ?? 'gst_prepare') as ExecutionTask['type'],
        description: body.taskDescription ?? 'Manual task',
        status: 'awaiting_approval',
        startedAt: null,
        completedAt: null,
        result: null,
        riskScore: body.riskScore ?? 65,
        agent: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const risk = assessRisk(task);
      const approval = createApproval(task);
      const created = await db.approval.create({
        data: {
          taskId: approval.taskId,
          risk: approval.risk,
          status: 'pending',
          reason: risk.reason,
        },
      });
      // Also mark the task as awaiting approval if it exists in DB
      try {
        await db.executionTask.update({
          where: { id: task.id },
          data: { status: 'awaiting_approval' },
        });
      } catch { /* task may be seed-only */ }

      // Audit log
      try {
        await db.auditLog.create({
          data: {
            action: 'Approval Requested',
            entity: 'Approval',
            entityId: created.id,
            details: `${task.description} — risk ${approval.risk}`,
          },
        });
      } catch { /* audit optional */ }

      return NextResponse.json({ approval: mapApprovalRow(created) }, { status: 201 });
    }

    if (body.action === 'approve' || body.action === 'reject') {
      const approvalId = body.approvalId;
      if (!approvalId) {
        return NextResponse.json({ error: 'approvalId required' }, { status: 400 });
      }
      const newStatus = body.action === 'approve' ? 'approved' : 'rejected';
      const updated = await db.approval.update({
        where: { id: approvalId },
        data: {
          status: newStatus,
          approvedBy: body.approvedBy ?? 'oracle',
          approvedAt: new Date(),
        },
      });

      // If approved, mark the linked task as queued (ready to execute)
      if (newStatus === 'approved') {
        try {
          await db.executionTask.update({
            where: { id: updated.taskId },
            data: { status: 'queued' },
          });
        } catch { /* task may be seed-only */ }
      }

      // Audit log
      try {
        await db.auditLog.create({
          data: {
            action: `Approval ${newStatus === 'approved' ? 'Granted' : 'Rejected'}`,
            entity: 'Approval',
            entityId: approvalId,
            details: body.reason ?? `Risk ${updated.risk} task ${newStatus}`,
          },
        });
      } catch { /* audit optional */ }

      return NextResponse.json({ approval: mapApprovalRow(updated) });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('POST /api/approvals error:', error);
    return NextResponse.json({ error: 'Failed to process approval' }, { status: 500 });
  }
}
