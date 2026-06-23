import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type {
  BusinessEvent,
  Decision,
  ExecutionTask,
  Approval,
  Workflow,
  UserBehaviour,
  ExecutionTimelineEntry,
  AgentMemory,
  ExecutionEngineState,
  ExecutionPipelineEntry,
  TimelineStage,
} from '@/lib/execution/types';
import { seedBusinessEvents, getObservationSummary } from '@/lib/execution/observe';
import { seedDecisions, getDecisionSummary } from '@/lib/execution/think';
import { planAllActions } from '@/lib/execution/decide';
import { seedExecutionTasks, getExecutionSummary } from '@/lib/execution/execute';
import { seedApprovals, getApprovalSummary } from '@/lib/execution/approvals';
import { seedWorkflows, getWorkflowSummary } from '@/lib/execution/workflows';
import { seedUserBehaviours, getLearningSummary } from '@/lib/execution/learn';
import { seedTimeline, getTimelineSummary } from '@/lib/execution/timeline';
import { AI_AGENTS, getAgentRoster } from '@/lib/execution/agents';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT EXECUTION ENGINE™ — Aggregation API
// GET /api/execution
// Returns the full Execution Engine state: observation + decisions + execution +
// approvals + workflows + learning + timeline + agents + pipeline.
// Falls back to seed data when DB tables are empty so the dashboard always
// shows realistic Indian business data.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Row mappers (Prisma → engine type) ───────────────────────────────────────

function mapEventRow(r: {
  id: string; businessId: string | null; type: string; source: string;
  payload: string | null; severity: string; status: string; createdAt: Date;
}): BusinessEvent {
  return {
    id: r.id, businessId: r.businessId,
    type: r.type as BusinessEvent['type'], source: r.source as BusinessEvent['source'],
    payload: r.payload ? safeJsonParse(r.payload) : null,
    severity: r.severity as BusinessEvent['severity'],
    status: r.status as BusinessEvent['status'],
    createdAt: r.createdAt.toISOString(),
  };
}

function mapDecisionRow(r: {
  id: string; eventId: string; reason: string; priority: string;
  action: string; status: string; createdAt: Date; updatedAt: Date;
}): Decision {
  return {
    id: r.id, eventId: r.eventId, reason: r.reason,
    priority: r.priority as Decision['priority'], action: r.action as Decision['action'],
    status: r.status as Decision['status'],
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

function mapWorkflowRow(r: {
  id: string; name: string; type: string; trigger: string | null;
  steps: string; currentStep: number; status: string;
  context: string | null; startedAt: Date | null; completedAt: Date | null;
  createdAt: Date; updatedAt: Date;
}): Workflow {
  return {
    id: r.id, name: r.name, type: r.type as Workflow['type'],
    trigger: r.trigger, steps: safeJsonParseSteps(r.steps),
    currentStep: r.currentStep, status: r.status as Workflow['status'],
    context: r.context ? safeJsonParse(r.context) : null,
    startedAt: r.startedAt ? r.startedAt.toISOString() : null,
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  };
}

function mapBehaviourRow(r: {
  id: string; userId: string | null; action: string; preference: string;
  confidence: number; evidence: number; updatedAt: Date; createdAt: Date;
}): UserBehaviour {
  return {
    id: r.id, userId: r.userId,
    action: r.action as UserBehaviour['action'], preference: r.preference,
    confidence: r.confidence, evidence: r.evidence,
    updatedAt: r.updatedAt.toISOString(), createdAt: r.createdAt.toISOString(),
  };
}

function mapTimelineRow(r: {
  id: string; taskId: string | null; agent: string | null;
  stage: string; title: string; description: string | null; timestamp: Date;
}): ExecutionTimelineEntry {
  return {
    id: r.id, taskId: r.taskId,
    agent: r.agent as ExecutionTimelineEntry['agent'],
    stage: r.stage as TimelineStage, title: r.title, description: r.description,
    timestamp: r.timestamp.toISOString(),
  };
}

function mapMemoryRow(r: {
  id: string; agent: string; memoryType: string; key: string; value: string;
  importance: number; lastUsedAt: Date; createdAt: Date; updatedAt: Date;
}): AgentMemory {
  return {
    id: r.id, agent: r.agent as AgentMemory['agent'],
    memoryType: r.memoryType as AgentMemory['memoryType'],
    key: r.key, value: r.value, importance: r.importance,
    lastUsedAt: r.lastUsedAt.toISOString(),
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  };
}

function safeJsonParse(s: string): Record<string, unknown> | null {
  try { return JSON.parse(s) as Record<string, unknown>; } catch { return null; }
}

function safeJsonParseSteps(s: string): Workflow['steps'] {
  try { return JSON.parse(s) as Workflow['steps']; } catch { return []; }
}

// ─── GET handler — full Execution Engine state ────────────────────────────────

export async function GET() {
  try {
    // Fetch all 8 entity sets in parallel; fall back to seed data if empty.
    const [eventRows, decisionRows, taskRows, approvalRows, workflowRows, behaviourRows, timelineRows, memoryRows] = await Promise.all([
      db.businessEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
      db.decision.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
      db.executionTask.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
      db.approval.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
      db.workflow.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
      db.userBehaviour.findMany({ orderBy: { updatedAt: 'desc' }, take: 50 }),
      db.executionTimeline.findMany({ orderBy: { timestamp: 'desc' }, take: 100 }),
      db.agentMemory.findMany({ orderBy: { updatedAt: 'desc' }, take: 50 }),
    ]);

    // ── Resolve entities (DB → engine type, or seed fallback) ──
    const events: BusinessEvent[] = eventRows.length > 0 ? eventRows.map(mapEventRow) : seedBusinessEvents();
    const decisions: Decision[] = decisionRows.length > 0 ? decisionRows.map(mapDecisionRow) : seedDecisions(events);
    const tasks: ExecutionTask[] = taskRows.length > 0 ? taskRows.map(mapTaskRow) : seedExecutionTasks(decisions);
    const approvals: Approval[] = approvalRows.length > 0 ? approvalRows.map(mapApprovalRow) : seedApprovals(tasks);
    const workflows: Workflow[] = workflowRows.length > 0 ? workflowRows.map(mapWorkflowRow) : seedWorkflows();
    const behaviours: UserBehaviour[] = behaviourRows.length > 0 ? behaviourRows.map(mapBehaviourRow) : seedUserBehaviours();
    const timeline: ExecutionTimelineEntry[] = timelineRows.length > 0 ? timelineRows.map(mapTimelineRow) : seedTimeline(tasks);
    const memories: AgentMemory[] = memoryRows.length > 0 ? memoryRows.map(mapMemoryRow) : [];

    // ── Compute summaries via pure-TS engines ──
    const observation = getObservationSummary(events);
    const decisionsSummary = getDecisionSummary(decisions);
    const execution = getExecutionSummary(tasks);
    const approvalsSummary = getApprovalSummary(approvals);
    const workflowsSummary = getWorkflowSummary(workflows);
    const learning = getLearningSummary(behaviours);
    const timelineSummary = getTimelineSummary(timeline);
    const agents = getAgentRoster(tasks);

    // ── Build the unified Execution Pipeline (Observe→Think→Decide→Execute→Confirm→Learn) ──
    // Takes the most recent entry from each stage and assembles them in pipeline order.
    const stageOrder: TimelineStage[] = ['observe', 'think', 'decide', 'execute', 'confirm', 'learn'];
    const pipeline: ExecutionPipelineEntry[] = [];
    for (const stage of stageOrder) {
      const entry = timeline.find((e) => e.stage === stage);
      if (!entry) continue;
      pipeline.push({
        stage,
        title: entry.title,
        description: entry.description ?? '',
        agent: entry.agent,
        timestamp: entry.timestamp,
        status: 'done',
      });
    }

    // If pipeline is sparse, pad with action plans (queued items)
    const actionPlans = planAllActions(decisions.slice(0, 4));
    for (const plan of actionPlans) {
      if (pipeline.length >= 6) break;
      pipeline.push({
        stage: 'execute',
        title: plan.description,
        description: `Agent: ${plan.agent} · Risk: ${plan.riskScore}${plan.needsApproval ? ' · Needs approval' : ''}`,
        agent: plan.agent,
        timestamp: new Date().toISOString(),
        status: 'queued',
      });
    }

    const state: ExecutionEngineState = {
      observation,
      decisions: decisionsSummary,
      execution,
      approvals: approvalsSummary,
      workflows: workflowsSummary,
      learning,
      timeline: timelineSummary,
      agents,
      pipeline,
    };

    return NextResponse.json(state);
  } catch (error) {
    console.error('GET /api/execution error:', error);
    return NextResponse.json(
      { error: 'Failed to load Execution Engine state' },
      { status: 500 },
    );
  }
}
