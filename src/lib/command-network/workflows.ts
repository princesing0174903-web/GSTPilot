// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Command Workflows™
//
// Enterprise workflows orchestrated by Oracle. Examples:
//   Hire Employee → Payroll → Compliance → IT Provisioning → Knowledge Graph →
//   Business Graph → Oracle Learning.
//   Lead → Opportunity → Proposal → Contract → Invoice → Payment → GST →
//   Accounting → Analytics → Forecast → Oracle Memory.
// Each step maps to a real module. Oracle coordinates all departments.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { db, cached, safeFindMany, TTL, countBy, parseJson } from './helpers';
import type {
  CoordinatedWorkflow, WorkflowSummary, WorkflowType, WorkflowStep, CommandModule,
} from './types';

// ─── Pure static definitions (re-exported from workflows-defs for client-safe imports) ─
// Client components should import WORKFLOW_TEMPLATES from
// '@/lib/command-network/workflows-defs' to avoid pulling @prisma/client into the bundle.
export { WORKFLOW_TEMPLATES } from './workflows-defs';
import { WORKFLOW_TEMPLATES } from './workflows-defs';

/** Find a template by type. */
export function findTemplate(type: WorkflowType) {
  return WORKFLOW_TEMPLATES.find((t) => t.type === type);
}

// ─── Map a CommandWorkflow Prisma row → CoordinatedWorkflow ──────────────────
function mapWorkflow(row: {
  id: string; workflowKey: string; name: string; type: string; description: string;
  steps: string; currentStep: number; status: string; trigger: string | null;
  coordinatedModules: string; startedAt: Date | null; completedAt: Date | null;
  relatedDecisionId: string | null; relatedIncidentId: string | null;
  initiatedBy: string | null; context: string; createdAt: Date; updatedAt: Date;
}): CoordinatedWorkflow {
  const steps = parseJson<WorkflowStep[]>(row.steps, []);
  const modules = parseJson<CommandModule[]>(row.coordinatedModules, []);
  return {
    id: row.id,
    workflowKey: row.workflowKey,
    name: row.name,
    type: row.type as WorkflowType,
    description: row.description,
    steps,
    currentStep: row.currentStep,
    status: row.status as CoordinatedWorkflow['status'],
    trigger: row.trigger,
    coordinatedModules: modules,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    relatedDecisionId: row.relatedDecisionId,
    relatedIncidentId: row.relatedIncidentId,
    initiatedBy: row.initiatedBy,
    context: parseJson<Record<string, unknown>>(row.context, {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Get recent coordinated workflows (live from CommandWorkflow). */
export async function getWorkflows(limit = 20): Promise<CoordinatedWorkflow[]> {
  return cached<CoordinatedWorkflow[]>(`cn:workflows:${limit}`, TTL.SHORT, async () => {
    const rows = await safeFindMany(() =>
      db.commandWorkflow.findMany({ orderBy: { createdAt: 'desc' }, take: limit }),
    );
    return rows.map(mapWorkflow);
  });
}

/** Workflow summary — aggregated from real CommandWorkflow rows. */
export async function getWorkflowSummary(): Promise<WorkflowSummary> {
  return cached<WorkflowSummary>('cn:workflows:summary', TTL.SHORT, async () => {
    const rows = await safeFindMany(() => db.commandWorkflow.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }));
    const mapped = rows.map(mapWorkflow);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const completedToday = rows.filter((r) => r.status === 'completed' && r.completedAt && r.completedAt >= dayAgo).length;
    const failedToday = rows.filter((r) => r.status === 'failed' && r.updatedAt >= dayAgo).length;
    const avgStepCount = mapped.length > 0
      ? Math.round((mapped.reduce((s, w) => s + w.steps.length, 0) / mapped.length) * 10) / 10
      : 0;
    const durations = mapped
      .filter((w) => w.startedAt && w.completedAt)
      .map((w) => (new Date(w.completedAt!).getTime() - new Date(w.startedAt!).getTime()) / 60000);
    const avgDurationMin = durations.length > 0
      ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
      : 0;
    return {
      totalWorkflows: rows.length,
      byStatus: countBy(rows, (r) => r.status),
      byType: countBy(rows, (r) => r.type),
      activeNow: rows.filter((r) => r.status === 'running').length,
      completedToday,
      failedToday,
      avgStepCount,
      avgDurationMin,
    };
  });
}

/** Launch a new coordinated workflow from a template. */
export async function launchWorkflow(input: {
  type: WorkflowType;
  trigger?: string;
  context?: Record<string, unknown>;
  initiatedBy?: string;
  relatedDecisionId?: string;
  relatedIncidentId?: string;
}): Promise<CoordinatedWorkflow> {
  const template = findTemplate(input.type);
  if (!template) throw new Error(`Unknown workflow type: ${input.type}`);

  const steps: WorkflowStep[] = template.steps.map((s, i) => ({
    order: i + 1,
    module: s.module,
    action: s.action,
    agent: s.agent,
    status: i === 0 ? 'running' : 'pending',
    startedAt: i === 0 ? new Date().toISOString() : null,
    completedAt: null,
    result: null,
    durationMs: null,
  }));
  const coordinatedModules = Array.from(new Set(template.steps.map((s) => s.module)));

  const row = await db.commandWorkflow.create({
    data: {
      workflowKey: `wf-${input.type}-${Date.now().toString(36)}`,
      name: template.name,
      type: input.type,
      description: template.description,
      steps: JSON.stringify(steps),
      currentStep: 0,
      status: 'running',
      trigger: input.trigger ?? 'manual',
      coordinatedModules: JSON.stringify(coordinatedModules),
      startedAt: new Date(),
      relatedDecisionId: input.relatedDecisionId ?? null,
      relatedIncidentId: input.relatedIncidentId ?? null,
      initiatedBy: input.initiatedBy ?? 'oracle',
      context: JSON.stringify(input.context ?? {}),
    },
  });
  return mapWorkflow(row);
}

/** Advance a workflow to the next step (Oracle coordinates execution). */
export async function advanceWorkflow(workflowId: string, success: boolean): Promise<CoordinatedWorkflow | null> {
  const row = await db.commandWorkflow.findUnique({ where: { id: workflowId } });
  if (!row) return null;

  const steps = parseJson<WorkflowStep[]>(row.steps, []);
  const currentIdx = row.currentStep;
  if (currentIdx >= steps.length) return mapWorkflow(row);

  const now = new Date();
  const startedAt = steps[currentIdx].startedAt ? new Date(steps[currentIdx].startedAt!) : now;
  const durationMs = now.getTime() - startedAt.getTime();

  steps[currentIdx] = {
    ...steps[currentIdx],
    status: success ? 'completed' : 'failed',
    completedAt: now.toISOString(),
    result: success ? 'Step completed successfully.' : 'Step failed — see incident.',
    durationMs,
  };

  const nextIdx = currentIdx + 1;
  const isLast = nextIdx >= steps.length;
  let newStatus = row.status;

  if (!success) {
    newStatus = 'failed';
  } else if (isLast) {
    newStatus = 'completed';
  } else {
    newStatus = 'running';
    steps[nextIdx] = {
      ...steps[nextIdx],
      status: 'running',
      startedAt: now.toISOString(),
    };
  }

  const updated = await db.commandWorkflow.update({
    where: { id: workflowId },
    data: {
      steps: JSON.stringify(steps),
      currentStep: success ? (isLast ? currentIdx : nextIdx) : currentIdx,
      status: newStatus,
      completedAt: newStatus === 'completed' || newStatus === 'failed' ? now : null,
    },
  });
  return mapWorkflow(updated);
}
