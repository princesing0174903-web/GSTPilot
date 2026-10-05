// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI CEO™ — ORCHESTRATOR
//
// Combines all AI CEO engines into a single CEODashboard bundle:
//   • fetchCEOData → CFO Phase 1 + Digital Twin + raw Prisma data
//   • computeExecutiveDecisions → Executive Decision Engine™
//   • computeDailyBrief → Daily CEO Brief™
//   • computeAutonomousTasks → Autonomous Task Engine™
//   • computeStrategies → AI Strategy Engine™
//   • computeExecutiveAlerts → Executive Alert System™
//   • computeBusinessGoals → Business Goals™
//   • computeCEOMemory → CEO Memory™
//   • computeBoardReport → Board Meeting Mode™
//   • WORKFLOW_TEMPLATES → Autonomous Workflow Engine™
//
// Pure server-side TypeScript. Never throws — on any engine failure, returns
// a partial bundle with empty states so the API never breaks. Every value
// comes from REAL connected business data.
//
// Tagline: "GSTPilot AI CEO™ — Run Your Business. Not Your Software."
// ═══════════════════════════════════════════════════════════════════════════════

import { fetchCEOData } from './data';
import { computeExecutiveDecisions, autoApproveBenign } from './decision-engine';
import { computeDailyBrief } from './daily-brief';
import { computeAutonomousTasks } from './tasks';
import { computeStrategies } from './strategy';
import { computeExecutiveAlerts } from './alerts';
import { computeBusinessGoals } from './goals';
import { computeCEOMemory } from './memory';
import { computeBoardReport } from './board-report';
import { WORKFLOW_TEMPLATES } from './workflows';
import { CEO_TAGLINE } from './types';
import type {
  CEODashboard,
  ExecutiveRole,
  CEOOracleContext,
  ApproveRequest,
  RejectRequest,
  ExecuteRequest,
  ApproveResult,
  RejectResult,
  ExecuteResult,
  ExecutiveDecision,
  WorkflowExecutionResult,
} from './types';
import { validateApproval, validateExecution, resolveRole } from './policy';
import { executeWorkflow } from './workflows';

// ─── Safe wrappers (engine failures don't break the dashboard) ───────────────

function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  return fn().catch((err) => {
    console.warn(`[AI CEO] Engine "${label}" failed:`, err);
    return fallback;
  });
}

function safeSync<T>(label: string, fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch (err) {
    console.warn(`[AI CEO] Engine "${label}" failed:`, err);
    return fallback;
  }
}

// ─── Empty fallbacks ─────────────────────────────────────────────────────────

const EMPTY_DASHBOARD: Partial<CEODashboard> = {
  decisions: [],
  brief: null,
  alerts: [],
  strategies: [],
  tasks: [],
  goals: [],
  workflows: WORKFLOW_TEMPLATES,
  memory: [],
  boardReport: null,
};

// ─── In-memory decision store (global singleton) ─────────────────────────────
// Persisted across hot-reloads and shared between API routes via globalThis.
// (Production would persist to Prisma CEODecision table — this is the Phase 1
// in-memory equivalent that survives Turbopack module isolation.)

const globalForCEO = globalThis as unknown as {
  __ceoDecisionStore?: Map<string, ExecutiveDecision>;
};

if (!globalForCEO.__ceoDecisionStore) {
  globalForCEO.__ceoDecisionStore = new Map();
}

const decisionStore: Map<string, ExecutiveDecision> = globalForCEO.__ceoDecisionStore;

function syncDecisionStore(decisions: ExecutiveDecision[]) {
  // Merge new decisions into the store, preserving user-modified statuses.
  // With deterministic IDs (type + entityId hash), the same logical decision
  // always gets the same ID across refreshes — so an approved decision stays
  // approved even after the dashboard recomputes.
  for (const d of decisions) {
    const existing = decisionStore.get(d.id);
    if (!existing) {
      // New decision — add as-is
      decisionStore.set(d.id, d);
    } else if (existing.status === 'pending') {
      // Existing pending decision — refresh data (evidence, confidence may have changed)
      // but keep it as pending (don't overwrite user actions)
      decisionStore.set(d.id, { ...d, status: 'pending' });
    }
    // If existing.status is 'approved'|'rejected'|'executed'|'executing'|'auto_approved',
    // preserve the user's action — do NOT overwrite with the freshly-computed pending version.
  }
  // Drop stale pending decisions that are no longer being proposed
  const liveIds = new Set(decisions.map((d) => d.id));
  for (const [id, d] of decisionStore.entries()) {
    if (!liveIds.has(id) && d.status === 'pending') {
      decisionStore.delete(id);
    }
  }
}

function getDecision(id: string): ExecutiveDecision | undefined {
  return decisionStore.get(id);
}

function updateDecision(id: string, patch: Partial<ExecutiveDecision>): ExecutiveDecision | undefined {
  const existing = decisionStore.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch };
  decisionStore.set(id, updated);
  return updated;
}

// ─── Main: compute the full AI CEO dashboard bundle ──────────────────────────

export async function computeCEODashboard(role: ExecutiveRole = 'ceo', userName?: string): Promise<CEODashboard> {
  const data = await fetchCEOData();

  // Run all engines in parallel (each wrapped in safe())
  const [decisionsRaw, brief, tasks, strategies, alerts, goals, memory, boardReport] = await Promise.all([
    safeSync('decisions', () => autoApproveBenign(computeExecutiveDecisions(data)), [] as ExecutiveDecision[]),
    safe('brief', () => Promise.resolve(computeDailyBrief(data, userName)), null),
    safeSync('tasks', () => computeAutonomousTasks(data), []),
    safeSync('strategies', () => computeStrategies(data), []),
    safeSync('alerts', () => computeExecutiveAlerts(data), []),
    safeSync('goals', () => computeBusinessGoals(data), []),
    safeSync('memory', () => computeCEOMemory(data), []),
    safeSync('board-report', () => computeBoardReport(data), null),
  ]);

  // Sync the in-memory decision store (preserves user-approved/rejected statuses)
  syncDecisionStore(decisionsRaw);

  // Return the MERGED store decisions (which include any user-approved/rejected
  // statuses from prior calls) instead of the raw freshly-computed decisions.
  // Sort by priority then financial impact, same as computeExecutiveDecisions.
  const priorityRank: Record<string, number> = {
    critical: 0, high: 1, medium: 2, low: 3,
  };
  const decisions = decisionsRaw
    .map((d) => decisionStore.get(d.id) ?? d)
    .sort((a, b) => {
      if (priorityRank[a.priority] !== priorityRank[b.priority]) {
        return priorityRank[a.priority] - priorityRank[b.priority];
      }
      return Math.abs(b.financialImpact) - Math.abs(a.financialImpact);
    });

  const pendingDecisions = decisions.filter((d) => d.status === 'pending');
  const activeAlerts = alerts.filter((a) => !a.acknowledged);
  const criticalAlerts = activeAlerts.filter((a) => a.severity === 'critical');
  const openTasks = tasks.filter((t) => t.status === 'open' || t.status === 'in_progress');
  const activeStrategies = strategies.filter((s) => s.status === 'active' || s.status === 'on_track');

  const topDecision = decisions[0] ?? null;
  const topAlert = alerts[0] ?? null;

  return {
    generatedAt: new Date().toISOString(),
    hasLiveData: data.hasLiveData,
    dataSources: data.dataSources,
    role,
    liveState: data.liveState,
    decisions,
    pendingDecisionCount: pendingDecisions.length,
    brief,
    alerts,
    activeAlertCount: activeAlerts.length,
    criticalAlertCount: criticalAlerts.length,
    strategies,
    activeStrategyCount: activeStrategies.length,
    tasks,
    openTaskCount: openTasks.length,
    goals,
    workflows: WORKFLOW_TEMPLATES,
    memory,
    boardReport,
    healthScore: data.liveState.healthScore,
    riskScore: data.liveState.riskScore,
    cashPosition: data.liveState.cash,
    runwayDays: data.liveState.runwayDays,
    topDecision,
    topAlert,
    tagline: CEO_TAGLINE,
  };
}

// ─── Oracle context (compact — injected into Oracle chat) ────────────────────

export async function computeCEOOracleContext(): Promise<CEOOracleContext> {
  const data = await fetchCEOData();

  const decisions = safeSync('decisions', () => computeExecutiveDecisions(data), []);
  const alerts = safeSync('alerts', () => computeExecutiveAlerts(data), []);
  const tasks = safeSync('tasks', () => computeAutonomousTasks(data), []);
  const strategies = safeSync('strategies', () => computeStrategies(data), []);
  const brief = safeSync('brief', () => computeDailyBrief(data), null);

  const pendingDecisions = decisions.filter((d) => d.status === 'pending');
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical' && !a.acknowledged);
  const openTasks = tasks.filter((t) => t.status === 'open' || t.status === 'in_progress');
  const activeStrategies = strategies.filter((s) => s.status === 'active' || s.status === 'on_track');

  return {
    hasLiveData: data.hasLiveData,
    dataSources: data.dataSources,
    healthScore: data.liveState.healthScore,
    riskScore: data.liveState.riskScore,
    cash: data.liveState.cash,
    revenueMTD: data.liveState.revenue,
    profitMTD: data.liveState.profit,
    runwayDays: data.liveState.runwayDays,
    pendingDecisions: pendingDecisions.length,
    criticalAlerts: criticalAlerts.length,
    openTasks: openTasks.length,
    activeStrategies: activeStrategies.length,
    topDecisionTitle: decisions[0]?.title ?? null,
    topAlertTitle: alerts[0]?.title ?? null,
    briefOneLiner: brief?.oneLiner ?? null,
  };
}

// ─── Approve / Reject / Execute handlers ─────────────────────────────────────

/**
 * Ensures the in-memory decision store is populated before looking up a decision.
 * Called by approve/reject/execute so they work even after a hot-reload (which
 * resets the module-level Map) or on a fresh server start.
 */
async function ensureDecisionInStore(decisionId: string): Promise<ExecutiveDecision | undefined> {
  let decision = getDecision(decisionId);
  if (decision) return decision;
  // Store is empty (likely after hot-reload) — populate it by computing the dashboard
  await computeCEODashboard('ceo');
  return getDecision(decisionId);
}

export async function approveDecision(req: ApproveRequest): Promise<ApproveResult> {
  const role = resolveRole(req.role);
  const decision = await ensureDecisionInStore(req.decisionId);
  if (!decision) {
    return {
      decisionId: req.decisionId,
      status: 'pending',
      message: 'Decision not found. It may have expired or been superseded.',
      approvedAt: new Date().toISOString(),
    };
  }

  const check = validateApproval(decision, role);
  if (!check.allowed) {
    return {
      decisionId: req.decisionId,
      status: decision.status,
      message: `Approval denied. ${check.reason}`,
      approvedAt: new Date().toISOString(),
    };
  }

  // Mark approved
  const updated = updateDecision(req.decisionId, {
    status: 'approved',
    approvedBy: req.userId ?? role,
  })!;

  // For non-destructive, auto-executable workflows, execute immediately
  let workflowResult: WorkflowExecutionResult | undefined;
  if (decision.actions.some((a) => a.automated && !a.destructive)) {
    const data = await fetchCEOData();
    const workflowType = mapDecisionToWorkflow(decision.type);
    if (workflowType) {
      workflowResult = await executeWorkflow(workflowType, decision.id, data);
      if (workflowResult.status === 'completed') {
        updateDecision(req.decisionId, {
          status: 'executed',
          executedAt: new Date().toISOString(),
          executedBy: req.userId ?? role,
        });
      }
    }
  }

  return {
    decisionId: req.decisionId,
    status: workflowResult?.status === 'completed' ? 'executed' : 'approved',
    message: workflowResult
      ? `Approved and executed: ${workflowResult.message}`
      : 'Decision approved. Awaiting manual execution.',
    workflowResult,
    approvedAt: new Date().toISOString(),
  };
}

export async function rejectDecision(req: RejectRequest): Promise<RejectResult> {
  const role = resolveRole(req.role);
  const decision = await ensureDecisionInStore(req.decisionId);
  if (!decision) {
    return {
      decisionId: req.decisionId,
      status: 'pending',
      message: 'Decision not found.',
      rejectedAt: new Date().toISOString(),
    };
  }

  const updated = updateDecision(req.decisionId, {
    status: 'rejected',
    approvedBy: req.userId ?? role,
  })!;

  return {
    decisionId: req.decisionId,
    status: 'rejected',
    message: req.reason
      ? `Decision rejected: ${req.reason}`
      : 'Decision rejected by ' + (req.userId ?? role),
    rejectedAt: new Date().toISOString(),
  };
}

export async function executeDecision(req: ExecuteRequest): Promise<ExecuteResult> {
  const role = resolveRole(req.role);
  const decision = await ensureDecisionInStore(req.decisionId);
  if (!decision) {
    return {
      decisionId: req.decisionId,
      status: 'pending',
      message: 'Decision not found.',
      workflowResult: {
        workflowType: (req.workflowType ?? 'send_reminder'),
        decisionId: req.decisionId,
        status: 'failed',
        message: 'Decision not found.',
        startedAt: new Date().toISOString(),
      },
      executedAt: new Date().toISOString(),
    };
  }

  const check = validateExecution(decision, role);
  if (!check.allowed) {
    return {
      decisionId: req.decisionId,
      status: decision.status,
      message: `Execution denied. ${check.reason}`,
      workflowResult: {
        workflowType: (req.workflowType ?? mapDecisionToWorkflow(decision.type) ?? 'send_reminder'),
        decisionId: req.decisionId,
        status: 'awaiting_approval',
        message: check.reason ?? 'Execution denied.',
        startedAt: new Date().toISOString(),
      },
      executedAt: new Date().toISOString(),
    };
  }

  // Mark executing
  updateDecision(req.decisionId, { status: 'executing' });

  const workflowType = req.workflowType ?? mapDecisionToWorkflow(decision.type);
  if (!workflowType) {
    return {
      decisionId: req.decisionId,
      status: 'approved',
      message: 'No automated workflow mapped for this decision type. Manual execution required.',
      workflowResult: {
        workflowType: 'send_reminder',
        decisionId: req.decisionId,
        status: 'failed',
        message: 'No workflow mapped.',
        startedAt: new Date().toISOString(),
      },
      executedAt: new Date().toISOString(),
    };
  }

  const data = await fetchCEOData();
  const workflowResult = await executeWorkflow(workflowType, decision.id, data);

  if (workflowResult.status === 'completed') {
    updateDecision(req.decisionId, {
      status: 'executed',
      executedAt: new Date().toISOString(),
      executedBy: req.userId ?? role,
    });
  } else {
    // Revert to approved so it can be retried
    updateDecision(req.decisionId, { status: 'approved' });
  }

  return {
    decisionId: req.decisionId,
    status: workflowResult.status === 'completed' ? 'executed' : 'approved',
    message: workflowResult.message,
    workflowResult,
    executedAt: new Date().toISOString(),
  };
}

// ─── Helper: map DecisionType → WorkflowType ─────────────────────────────────

function mapDecisionToWorkflow(type: string): WorkflowExecutionResult['workflowType'] | null {
  const map: Record<string, WorkflowExecutionResult['workflowType']> = {
    recover_payment: 'send_reminder',
    remind_client: 'send_reminder',
    reply_customer: 'send_reminder',
    follow_up_lead: 'create_follow_up',
    create_quotation: 'create_quotation',
    schedule_meeting: 'schedule_meeting',
    review_compliance: 'generate_report',
    investigate_anomaly: 'generate_report',
  };
  return map[type] ?? null;
}

// ─── Cache layer (60s TTL — same as Twin orchestrator) ───────────────────────

let cachedDashboard: { data: CEODashboard; ts: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function getCachedCEODashboard(role: ExecutiveRole = 'ceo', userName?: string): Promise<CEODashboard> {
  if (cachedDashboard && Date.now() - cachedDashboard.ts < CACHE_TTL_MS && cachedDashboard.data.role === role) {
    return cachedDashboard.data;
  }
  const data = await computeCEODashboard(role, userName);
  cachedDashboard = { data, ts: Date.now() };
  return data;
}

export function invalidateCEOCache(): void {
  cachedDashboard = null;
}

// ─── Public accessor for current decision store (for API routes) ─────────────

export function listDecisions(): ExecutiveDecision[] {
  return Array.from(decisionStore.values());
}

export function findDecision(id: string): ExecutiveDecision | undefined {
  return decisionStore.get(id);
}
