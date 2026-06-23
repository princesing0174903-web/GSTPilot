import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { Workflow } from '@/lib/execution/types';
import { seedWorkflows, getWorkflowSummary, startWorkflow, advanceWorkflow, WORKFLOW_TEMPLATES } from '@/lib/execution/workflows';
import type { WorkflowType } from '@/lib/execution/types';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT WORKFLOW ENGINE™ — API
// GET  /api/workflows  → list all workflows + summary
// POST /api/workflows  → { action: 'start'|'advance', type?, workflowId? }
// ═══════════════════════════════════════════════════════════════════════════════

function mapWorkflowRow(r: {
  id: string; name: string; type: string; trigger: string | null;
  steps: string; currentStep: number; status: string;
  context: string | null; startedAt: Date | null; completedAt: Date | null;
  createdAt: Date; updatedAt: Date;
}): Workflow {
  return {
    id: r.id, name: r.name, type: r.type as Workflow['type'],
    trigger: r.trigger,
    steps: safeJsonParseArr(r.steps) ?? [],
    currentStep: r.currentStep, status: r.status as Workflow['status'],
    context: r.context ? safeJsonParse(r.context) : null,
    startedAt: r.startedAt ? r.startedAt.toISOString() : null,
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  };
}

function safeJsonParse(s: string): Record<string, unknown> | null {
  try { return JSON.parse(s) as Record<string, unknown>; } catch { return null; }
}

function safeJsonParseArr(s: string): Workflow['steps'] | null {
  try { return JSON.parse(s) as Workflow['steps']; } catch { return null; }
}

export async function GET() {
  try {
    const rows = await db.workflow.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
    const workflows: Workflow[] = rows.length > 0 ? rows.map(mapWorkflowRow) : seedWorkflows();
    const summary = getWorkflowSummary(workflows);
    return NextResponse.json({ workflows, summary, templates: WORKFLOW_TEMPLATES });
  } catch (error) {
    console.error('GET /api/workflows error:', error);
    return NextResponse.json({ error: 'Failed to load workflows' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      action: 'start' | 'advance';
      type?: WorkflowType;
      workflowId?: string;
      context?: Record<string, unknown>;
    };

    if (body.action === 'start') {
      if (!body.type) {
        return NextResponse.json({ error: 'type required' }, { status: 400 });
      }
      const wf = startWorkflow(body.type, body.context);
      const created = await db.workflow.create({
        data: {
          name: wf.name,
          type: wf.type,
          trigger: wf.trigger,
          steps: JSON.stringify(wf.steps),
          currentStep: wf.currentStep,
          status: wf.status,
          context: wf.context ? JSON.stringify(wf.context) : null,
          startedAt: wf.startedAt ? new Date(wf.startedAt) : null,
        },
      });

      // Audit log
      try {
        await db.auditLog.create({
          data: {
            action: 'Workflow Started',
            entity: 'Workflow',
            entityId: created.id,
            details: `${wf.name} (${wf.type})`,
          },
        });
      } catch { /* audit optional */ }

      return NextResponse.json({ workflow: mapWorkflowRow(created) }, { status: 201 });
    }

    if (body.action === 'advance') {
      const workflowId = body.workflowId;
      if (!workflowId) {
        return NextResponse.json({ error: 'workflowId required' }, { status: 400 });
      }
      const existing = await db.workflow.findUnique({ where: { id: workflowId } });
      if (!existing) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
      }
      const current = mapWorkflowRow(existing);
      const advanced = advanceWorkflow(current);
      const updated = await db.workflow.update({
        where: { id: workflowId },
        data: {
          steps: JSON.stringify(advanced.steps),
          currentStep: advanced.currentStep,
          status: advanced.status,
          completedAt: advanced.completedAt ? new Date(advanced.completedAt) : null,
        },
      });

      // Audit log
      try {
        await db.auditLog.create({
          data: {
            action: 'Workflow Advanced',
            entity: 'Workflow',
            entityId: workflowId,
            details: `${advanced.name} → step ${advanced.currentStep + 1}/${advanced.steps.length} (${advanced.status})`,
          },
        });
      } catch { /* audit optional */ }

      return NextResponse.json({ workflow: mapWorkflowRow(updated) });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('POST /api/workflows error:', error);
    return NextResponse.json({ error: 'Failed to process workflow' }, { status: 500 });
  }
}
