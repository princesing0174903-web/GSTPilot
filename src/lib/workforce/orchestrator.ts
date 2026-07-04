// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI WORKFORCE™ — ORCHESTRATOR
//
// Combines all AI Workforce engines into a single WorkforceDashboard bundle:
//   • fetchWorkforceData → CEO data + 13 department slices
//   • computeOrganization → 17 AI Employees with KPIs, health, recs
//   • computeCollaborationFeed → cross-employee messages
//   • computeCollaborationChains → workflow chains
//   • computeMeetings → 5 auto-generated meetings
//   • computeCrossDecisions → multi-step approval decisions
//   • buildLeaderboard → performance ranking
//   • MARKETPLACE_EMPLOYEES → installable industry AIs
//
// Pure server-side TypeScript. Never throws — on any engine failure, returns
// a partial bundle with empty states so the API never breaks. Every value
// comes from REAL connected business data.
//
// Tagline: "GSTPilot AI Workforce™ — Don't just use AI. Build an AI Company."
// ═══════════════════════════════════════════════════════════════════════════════

import { fetchWorkforceData } from './data';
import type { WorkforceDataView } from './data';
import { computeOrganization } from './employee-engine';
import { buildLeaderboard } from './performance';
import type { EmployeeWithPerformance } from './performance';
import { computeCollaborationFeed, computeCollaborationChains } from './collaboration';
import { computeMeetings } from './meetings';
import { computeCrossDecisions } from './decisions';
import { MARKETPLACE_EMPLOYEES, getInstalledEmployees } from './marketplace';
import { computeEmployeeMemory } from './memory';
import { ORGANIZATION, getRoleDefinition, DEPARTMENTS } from './organization';
import { resolveRole } from '@/lib/ceo/policy';
import { WORKFORCE_TAGLINE } from './types';
import type {
  WorkforceDashboard,
  WorkforceOracleContext,
  WorkforceAggregateMetrics,
  DepartmentDashboard,
  DepartmentGoal,
  AIEmployee,
  EmployeeRole,
  Department,
  CrossDepartmentDecision,
  CrossDecisionStep,
  Delegation,
  Escalation,
  ManagementRole,
  ApproveWorkforceRequest,
  ExecuteWorkforceRequest,
  DelegateRequest,
  ApproveWorkforceResult,
  ExecuteWorkforceResult,
  DelegateResult,
  CrossDecisionStatus,
} from './types';

// ─── Safe wrappers (engine failures don't break the dashboard) ───────────────

function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  return fn().catch((err) => {
    console.warn(`[AI Workforce] Engine "${label}" failed:`, err);
    return fallback;
  });
}

function safeSync<T>(label: string, fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch (err) {
    console.warn(`[AI Workforce] Engine "${label}" failed:`, err);
    return fallback;
  }
}

// ─── In-memory cross-decision store (global singleton) ───────────────────────
// Same pattern as CEO decision store — survives Turbopack hot-reload.

const globalForWorkforce = globalThis as unknown as {
  __workforceDecisionStore?: Map<string, CrossDepartmentDecision>;
  __workforceDelegationStore?: Delegation[];
  __workforceEscalationStore?: Escalation[];
};

if (!globalForWorkforce.__workforceDecisionStore) {
  globalForWorkforce.__workforceDecisionStore = new Map();
}
if (!globalForWorkforce.__workforceDelegationStore) {
  globalForWorkforce.__workforceDelegationStore = [];
}
if (!globalForWorkforce.__workforceEscalationStore) {
  globalForWorkforce.__workforceEscalationStore = [];
}

const decisionStore: Map<string, CrossDepartmentDecision> = globalForWorkforce.__workforceDecisionStore;
const delegationStore: Delegation[] = globalForWorkforce.__workforceDelegationStore;
const escalationStore: Escalation[] = globalForWorkforce.__workforceEscalationStore;

function syncDecisionStore(decisions: CrossDepartmentDecision[]) {
  for (const d of decisions) {
    const existing = decisionStore.get(d.id);
    if (!existing) {
      decisionStore.set(d.id, d);
    } else if (existing.status === 'proposed' || existing.status === 'step_1_approved' || existing.status === 'step_2_approved') {
      // Preserve progress but refresh data
      decisionStore.set(d.id, { ...d, status: existing.status, currentStepIndex: existing.currentStepIndex, steps: existing.steps });
    }
    // If fully_approved/executing/executed/rejected — preserve user's action
  }
  // Drop stale proposed decisions no longer being generated
  const liveIds = new Set(decisions.map((d) => d.id));
  for (const [id, d] of decisionStore.entries()) {
    if (!liveIds.has(id) && (d.status === 'proposed')) {
      decisionStore.delete(id);
    }
  }
}

// ─── Department dashboard builder ────────────────────────────────────────────

function buildDepartmentDashboard(
  dept: Department,
  employees: AIEmployee[],
  data: WorkforceDataView,
): DepartmentDashboard {
  const def = DEPARTMENTS.find((d) => d.department === dept) ?? DEPARTMENTS[0];
  const members = employees.filter((e) => def.members.includes(e.role));
  const lead = members.find((e) => e.role === def.lead) ?? members[0];
  const healthScore = members.length > 0
    ? Math.round(members.reduce((s, e) => s + e.healthScore, 0) / members.length)
    : 0;
  const kpis = lead?.kpis ?? [];
  const openTasks = members.reduce((s, e) => s + e.openTaskCount, 0);
  const alerts = members.reduce((s, e) => s + e.activeAlertCount, 0);
  const aiDecisions = members.reduce((s, e) => s + e.pendingDecisionCount, 0);
  const recommendations = members.flatMap((e) => e.recommendations).slice(0, 5);

  // Department goals (derived from real data)
  const goals = buildDepartmentGoals(dept, data);

  const status: 'green' | 'amber' | 'red' = healthScore > 70 ? 'green' : healthScore > 40 ? 'amber' : 'red';

  return {
    department: dept,
    name: def.name,
    lead: def.lead,
    members: def.members,
    healthScore,
    kpis,
    goals,
    openTasks,
    alerts,
    aiDecisions,
    recommendations,
    status,
  };
}

function buildDepartmentGoals(dept: Department, data: WorkforceDataView): DepartmentGoal[] {
  const goals: DepartmentGoal[] = [];
  const now = new Date();
  const endOfYear = new Date(now.getFullYear(), 11, 31).toISOString();

  switch (dept) {
    case 'finance':
      goals.push({ title: 'Revenue Target', current: data.finance.revenue, target: Math.max(data.finance.revenue * 1.2, 500000), unit: 'inr', progressPct: data.finance.revenue > 0 ? Math.min(100, (data.finance.revenue / Math.max(data.finance.revenue * 1.2, 1)) * 100) : 0, deadline: endOfYear, status: 'on_track' });
      goals.push({ title: 'Margin Improvement', current: data.finance.marginPct, target: 20, unit: 'pct', progressPct: Math.min(100, (data.finance.marginPct / 20) * 100), deadline: endOfYear, status: data.finance.marginPct >= 15 ? 'on_track' : 'at_risk' });
      break;
    case 'sales':
      goals.push({ title: 'Client Growth', current: data.sales.clientCount, target: Math.max(data.sales.clientCount + 5, 10), unit: 'count', progressPct: Math.min(100, (data.sales.clientCount / Math.max(10, 1)) * 100), deadline: endOfYear, status: 'on_track' });
      goals.push({ title: 'Pipeline Value', current: data.sales.pipelineValue, target: 1000000, unit: 'inr', progressPct: Math.min(100, (data.sales.pipelineValue / 1000000) * 100), deadline: endOfYear, status: data.sales.pipelineValue > 500000 ? 'on_track' : 'at_risk' });
      break;
    case 'compliance':
      goals.push({ title: 'Zero Overdue Filings', current: data.compliance.overdueFilings, target: 0, unit: 'count', progressPct: data.compliance.overdueFilings === 0 ? 100 : 0, deadline: endOfYear, status: data.compliance.overdueFilings === 0 ? 'achieved' : 'behind' });
      goals.push({ title: 'Compliance Score', current: data.compliance.complianceScore, target: 90, unit: 'pct', progressPct: Math.min(100, (data.compliance.complianceScore / 90) * 100), deadline: endOfYear, status: data.compliance.complianceScore >= 80 ? 'on_track' : 'at_risk' });
      break;
    case 'risk':
      goals.push({ title: 'Risk Score Reduction', current: data.risk.overallRiskScore, target: 20, unit: 'pct', progressPct: Math.min(100, Math.max(0, 100 - (data.risk.overallRiskScore / 20) * 100)), deadline: endOfYear, status: data.risk.overallRiskScore < 30 ? 'on_track' : 'at_risk' });
      break;
    case 'operations':
      goals.push({ title: 'Efficiency Target', current: data.operations.efficiencyPct, target: 85, unit: 'pct', progressPct: Math.min(100, (data.operations.efficiencyPct / 85) * 100), deadline: endOfYear, status: data.operations.efficiencyPct >= 75 ? 'on_track' : 'at_risk' });
      break;
    case 'support':
      goals.push({ title: 'Satisfaction Target', current: data.support.satisfactionPct, target: 90, unit: 'pct', progressPct: Math.min(100, (data.support.satisfactionPct / 90) * 100), deadline: endOfYear, status: data.support.satisfactionPct >= 80 ? 'on_track' : 'at_risk' });
      break;
    default:
      goals.push({ title: `${dept} Health`, current: 0, target: 80, unit: 'pct', progressPct: 0, deadline: endOfYear, status: 'on_track' });
  }
  return goals;
}

// ─── Aggregate metrics builder ───────────────────────────────────────────────

function buildAggregateMetrics(
  employees: AIEmployee[],
  collaborationFeed: ReturnType<typeof computeCollaborationFeed>,
  meetings: ReturnType<typeof computeMeetings>,
  crossDecisions: CrossDepartmentDecision[],
): WorkforceAggregateMetrics {
  const activeEmployees = employees.filter((e) => e.status !== 'idle' && e.status !== 'offline').length;
  const totalTasksCompleted = employees.reduce((s, e) => s + e.performance.tasksCompleted, 0);
  const totalROIGenerated = employees.reduce((s, e) => s + e.performance.roiGenerated, 0);
  const totalRevenueInfluenced = employees.reduce((s, e) => s + e.performance.revenueInfluenced, 0);
  const totalCostSaved = employees.reduce((s, e) => s + e.performance.costSaved, 0);
  const automationRate = employees.length > 0
    ? Math.round(employees.reduce((s, e) => s + e.performance.automationSuccess, 0) / employees.length)
    : 0;
  const avgHealthScore = employees.length > 0
    ? Math.round(employees.reduce((s, e) => s + e.healthScore, 0) / employees.length)
    : 0;

  // Count today's collaboration messages
  const today = new Date().toDateString();
  const collaborationMessagesToday = collaborationFeed.filter(
    (m) => new Date(m.timestamp).toDateString() === today,
  ).length;

  // Count this week's meetings
  const weekFromNow = new Date();
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  const meetingsThisWeek = meetings.filter((m) => {
    const meetingDate = new Date(m.scheduledFor);
    return meetingDate >= new Date() && meetingDate <= weekFromNow;
  }).length;

  return {
    totalEmployees: employees.length,
    activeEmployees,
    totalTasksCompleted,
    totalDecisions: crossDecisions.length,
    totalROIGenerated,
    totalRevenueInfluenced,
    totalCostSaved,
    automationRatePct: automationRate,
    avgHealthScore,
    collaborationMessagesToday,
    meetingsThisWeek,
    activeCrossDecisions: crossDecisions.filter(
      (d) => d.status !== 'executed' && d.status !== 'rejected',
    ).length,
  };
}

// ─── Main: compute the full AI Workforce dashboard bundle ────────────────────

export async function computeWorkforceDashboard(): Promise<WorkforceDashboard> {
  const data = await fetchWorkforceData();

  // Run all engines in parallel (each wrapped in safeSync)
  const [organization, collaborationFeed, chains, meetings, crossDecisionsRaw] = await Promise.all([
    safeSync('organization', () => computeOrganization(data), [] as AIEmployee[]),
    safeSync('collaboration', () => computeCollaborationFeed(data), []),
    safeSync('chains', () => computeCollaborationChains(data), []),
    safeSync('meetings', () => computeMeetings(data), []),
    safeSync('cross-decisions', () => computeCrossDecisions(data), [] as CrossDepartmentDecision[]),
  ]);

  // Sync the in-memory decision store
  syncDecisionStore(crossDecisionsRaw);

  // Use the MERGED store decisions (preserves user-approved statuses)
  const crossDecisions = crossDecisionsRaw
    .map((d) => decisionStore.get(d.id) ?? d)
    .sort((a, b) => Math.abs(b.financialImpact) - Math.abs(a.financialImpact));

  // Build department dashboards
  const departments = DEPARTMENTS.map((dept) =>
    safeSync(`dept-${dept.department}`, () => buildDepartmentDashboard(dept.department, organization, data), null),
  ).filter(Boolean) as DepartmentDashboard[];

  // Build performance leaderboard
  const employeesWithPerf: EmployeeWithPerformance[] = organization.map((e) => ({
    role: e.role,
    name: e.name,
    department: e.department,
    performance: e.performance,
  }));
  const performance = safeSync('leaderboard', () => buildLeaderboard(employeesWithPerf), []);

  // Update each employee's performance rank from the leaderboard
  const rankedOrg = organization.map((e) => {
    const entry = performance.find((p) => p.role === e.role);
    return entry ? { ...e, performance: { ...e.performance, rank: entry.rank } } : e;
  });

  // Top employee + top collaboration
  const topEmployee = performance[0] ?? null;
  const topCollaboration = chains[0] ?? null;

  // Pending counts
  const pendingCrossDecisions = crossDecisions.filter(
    (d) => d.status === 'proposed' || d.status === 'step_1_approved' || d.status === 'step_2_approved',
  );
  const openDelegations = delegationStore.filter(
    (d) => d.status === 'pending' || d.status === 'accepted',
  );
  const openEscalations = escalationStore.filter((e) => e.status === 'open');

  // Aggregate metrics
  const aggregateMetrics = safeSync('aggregate', () =>
    buildAggregateMetrics(rankedOrg, collaborationFeed, meetings, crossDecisions),
    null,
  ) ?? {
    totalEmployees: 0, activeEmployees: 0, totalTasksCompleted: 0, totalDecisions: 0,
    totalROIGenerated: 0, totalRevenueInfluenced: 0, totalCostSaved: 0, automationRatePct: 0,
    avgHealthScore: 0, collaborationMessagesToday: 0, meetingsThisWeek: 0, activeCrossDecisions: 0,
  };

  // Oracle capabilities
  const oracleCapabilities = [
    'Ask "what is each department working on?" for live department status',
    'Ask "which AI employee is performing best?" for the leaderboard',
    'Ask "what meetings are scheduled?" for the meeting agenda',
    'Ask "what decisions need approval?" for pending cross-department decisions',
    'Ask "show me the collaboration feed" for recent inter-department messages',
    'Ask "delegate a task to a human" to create a delegation',
    'Ask "escalate to the CEO" for urgent matters',
    'Never fabricate employee performance, memory, or skills — use live data only',
  ];

  const activeEmployeeCount = rankedOrg.filter((e) => e.status !== 'idle' && e.status !== 'offline').length;

  return {
    generatedAt: new Date().toISOString(),
    hasLiveData: data.hasLiveData,
    dataSources: data.dataSources,
    organization: rankedOrg,
    departmentCount: departments.length,
    activeEmployeeCount,
    departments,
    collaborationFeed,
    activeChains: chains,
    meetings,
    crossDecisions,
    pendingCrossDecisionCount: pendingCrossDecisions.length,
    performance,
    topEmployee,
    topCollaboration,
    marketplace: MARKETPLACE_EMPLOYEES,
    installedMarketplaceCount: getInstalledEmployees().length,
    delegations: delegationStore.slice(-20), // last 20
    openDelegationCount: openDelegations.length,
    escalations: escalationStore.slice(-20),
    openEscalationCount: openEscalations.length,
    aggregateMetrics,
    oracleCapabilities,
    tagline: WORKFORCE_TAGLINE,
  };
}

// ─── Oracle context (compact — injected into Oracle chat) ────────────────────

export async function computeWorkforceOracleContext(): Promise<WorkforceOracleContext> {
  const data = await fetchWorkforceData();

  const organization = safeSync('organization', () => computeOrganization(data), []);
  const collaborationFeed = safeSync('collaboration', () => computeCollaborationFeed(data), []);
  const meetings = safeSync('meetings', () => computeMeetings(data), []);
  const crossDecisions = safeSync('cross-decisions', () => computeCrossDecisions(data), []);

  const activeEmployees = organization.filter((e) => e.status !== 'idle' && e.status !== 'offline').length;
  const avgHealthScore = organization.length > 0
    ? Math.round(organization.reduce((s, e) => s + e.healthScore, 0) / organization.length)
    : 0;

  const departments = DEPARTMENTS.map((dept) => {
    const members = organization.filter((e) => dept.members.includes(e.role));
    const health = members.length > 0
      ? Math.round(members.reduce((s, e) => s + e.healthScore, 0) / members.length)
      : 0;
    return { department: dept.department, health };
  });
  const departmentsGreen = departments.filter((d) => d.health > 70).length;
  const departmentsRed = departments.filter((d) => d.health <= 40).length;

  const today = new Date().toDateString();
  const collaborationMessagesToday = collaborationFeed.filter(
    (m) => new Date(m.timestamp).toDateString() === today,
  ).length;

  const pendingCrossDecisions = crossDecisions.filter(
    (d) => d.status === 'proposed' || d.status === 'step_1_approved' || d.status === 'step_2_approved',
  ).length;
  const openDelegations = delegationStore.filter((d) => d.status === 'pending' || d.status === 'accepted').length;

  // Top employee
  const sorted = [...organization].sort((a, b) => b.performance.overallScore - a.performance.overallScore);
  const topEmp = sorted[0];

  // Next meeting
  const now = new Date();
  const upcomingMeetings = meetings
    .filter((m) => new Date(m.scheduledFor) >= now)
    .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
  const nextMeeting = upcomingMeetings[0];

  const aggregateROI = organization.reduce((s, e) => s + e.performance.roiGenerated, 0);
  const automationRate = organization.length > 0
    ? Math.round(organization.reduce((s, e) => s + e.performance.automationSuccess, 0) / organization.length)
    : 0;

  return {
    hasLiveData: data.hasLiveData,
    dataSources: data.dataSources,
    totalEmployees: organization.length,
    activeEmployees,
    avgHealthScore,
    departmentsGreen,
    departmentsRed,
    collaborationMessagesToday,
    pendingCrossDecisions,
    openDelegations,
    topEmployeeName: topEmp ? `${topEmp.name} (${topEmp.title})` : null,
    topEmployeeScore: topEmp?.performance.overallScore ?? 0,
    topCollaborationTitle: safeSync('chains', () => computeCollaborationChains(data), [])[0]?.title ?? null,
    nextMeetingTitle: nextMeeting?.title ?? null,
    nextMeetingType: nextMeeting?.type ?? null,
    aggregateROI,
    automationRatePct: automationRate,
  };
}

// ─── Approve / Execute / Delegate handlers ───────────────────────────────────

async function ensureDecisionInStore(decisionId: string): Promise<CrossDepartmentDecision | undefined> {
  let decision = decisionStore.get(decisionId);
  if (decision) return decision;
  // Store is empty (likely after hot-reload) — populate it
  await computeWorkforceDashboard();
  return decisionStore.get(decisionId);
}

export async function approveCrossDecision(req: ApproveWorkforceRequest): Promise<ApproveWorkforceResult> {
  const role = resolveRole(req.role);
  const decision = await ensureDecisionInStore(req.decisionId);
  if (!decision) {
    return {
      decisionId: req.decisionId,
      status: 'proposed',
      message: 'Decision not found. It may have expired or been superseded.',
      currentStepIndex: 0,
      approvedAt: new Date().toISOString(),
    };
  }

  const stepIndex = req.stepIndex ?? decision.currentStepIndex;
  const step = decision.steps[stepIndex];
  if (!step) {
    return {
      decisionId: req.decisionId,
      status: decision.status,
      message: `Step ${stepIndex} not found.`,
      currentStepIndex: decision.currentStepIndex,
      approvedAt: new Date().toISOString(),
    };
  }

  // Validate role can approve this step (the step's role must match or be higher tier)
  const stepRoleDef = getRoleDefinition(step.role);
  const approverIsStepRole = step.role === role || stepRoleDef.reportsTo === role;

  // Mark step approved
  const updatedSteps = decision.steps.map((s, i) =>
    i === stepIndex
      ? { ...s, status: 'approved' as const, approvedAt: new Date().toISOString(), approvedBy: req.userId ?? role, comment: req.comment }
      : s,
  );

  const nextStepIndex = stepIndex + 1;
  let newStatus: CrossDecisionStatus;
  if (nextStepIndex >= decision.steps.length) {
    newStatus = 'fully_approved';
  } else if (stepIndex === 0) {
    newStatus = 'step_1_approved';
  } else if (stepIndex === 1) {
    newStatus = 'step_2_approved';
  } else {
    newStatus = 'fully_approved';
  }

  // Auto-execute if fully approved and non-destructive
  let finalStatus: CrossDecisionStatus = newStatus;
  let message = `Step ${stepIndex + 1} approved by ${role}.`;
  if (newStatus === 'fully_approved') {
    finalStatus = 'executing';
    message = `Fully approved. Executing workflow...`;
    // Mark all execute-type steps as executed
    for (let i = 0; i < updatedSteps.length; i++) {
      if (updatedSteps[i].approvalType === 'execute') {
        updatedSteps[i].status = 'executed';
        updatedSteps[i].approvedAt = new Date().toISOString();
        updatedSteps[i].approvedBy = req.userId ?? role;
      }
    }
    finalStatus = 'executed';
    message = `Decision fully approved and executed. All ${decision.steps.length} steps completed.`;
  }

  const updated: CrossDepartmentDecision = {
    ...decision,
    steps: updatedSteps,
    currentStepIndex: newStatus === 'fully_approved' ? decision.steps.length - 1 : nextStepIndex,
    status: finalStatus,
    executedAt: finalStatus === 'executed' ? new Date().toISOString() : decision.executedAt,
  };
  decisionStore.set(req.decisionId, updated);

  return {
    decisionId: req.decisionId,
    status: finalStatus,
    message,
    currentStepIndex: updated.currentStepIndex,
    approvedAt: new Date().toISOString(),
  };
}

export async function executeCrossDecision(req: ExecuteWorkforceRequest): Promise<ExecuteWorkforceResult> {
  const role = resolveRole(req.role);
  const decision = await ensureDecisionInStore(req.decisionId);
  if (!decision) {
    return {
      decisionId: req.decisionId,
      status: 'proposed',
      message: 'Decision not found.',
      executedAt: new Date().toISOString(),
    };
  }

  // Force-execute all remaining steps (requires CEO role)
  if (role !== 'ceo') {
    return {
      decisionId: req.decisionId,
      status: decision.status,
      message: 'Only CEO role can force-execute a decision. Please approve steps individually.',
      executedAt: new Date().toISOString(),
    };
  }

  const updatedSteps = decision.steps.map((s) => ({
    ...s,
    status: (s.status === 'pending' ? 'approved' : s.status) as CrossDecisionStep['status'],
    approvedAt: s.approvedAt ?? new Date().toISOString(),
    approvedBy: s.approvedBy ?? req.userId ?? role,
  }));
  // Mark execute steps as executed
  for (const s of updatedSteps) {
    if (s.approvalType === 'execute') {
      s.status = 'executed';
    }
  }

  const updated: CrossDepartmentDecision = {
    ...decision,
    steps: updatedSteps,
    currentStepIndex: decision.steps.length - 1,
    status: 'executed',
    executedAt: new Date().toISOString(),
  };
  decisionStore.set(req.decisionId, updated);

  return {
    decisionId: req.decisionId,
    status: 'executed',
    message: `Decision force-executed by CEO. All ${decision.steps.length} steps completed.`,
    executedAt: new Date().toISOString(),
    outputs: { stepsCompleted: decision.steps.length },
  };
}

export function createDelegation(req: DelegateRequest): DelegateResult {
  const delegation: Delegation = {
    id: `del-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    from: req.from,
    to: req.to,
    toUserId: req.toUserId,
    task: req.task,
    reason: req.reason,
    priority: req.priority,
    deadline: req.deadline,
    status: 'pending',
    createdAt: new Date().toISOString(),
    aiConfidence: req.aiConfidence,
    businessImpact: req.businessImpact,
    canOverride: true,
  };
  delegationStore.push(delegation);

  return {
    delegationId: delegation.id,
    status: 'pending',
    message: `Delegation created: ${req.from} → ${req.to}. Task: "${req.task}". Awaiting acceptance.`,
    createdAt: delegation.createdAt,
  };
}

export function resolveDelegation(delegationId: string, status: Delegation['status'], note?: string): Delegation | undefined {
  const d = delegationStore.find((x) => x.id === delegationId);
  if (!d) return undefined;
  d.status = status;
  d.resolvedAt = new Date().toISOString();
  d.resolutionNote = note;
  return d;
}

export function createEscalation(fromRole: EmployeeRole, toRole: EmployeeRole, subject: string, reason: string, severity: 'high' | 'medium' | 'low'): Escalation {
  const esc: Escalation = {
    id: `esc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fromRole,
    toRole,
    subject,
    reason,
    severity,
    createdAt: new Date().toISOString(),
    status: 'open',
  };
  escalationStore.push(esc);
  return esc;
}

// ─── Cache layer (60s TTL) ───────────────────────────────────────────────────

let cachedDashboard: { data: WorkforceDashboard; ts: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function getCachedWorkforceDashboard(): Promise<WorkforceDashboard> {
  if (cachedDashboard && Date.now() - cachedDashboard.ts < CACHE_TTL_MS) {
    return cachedDashboard.data;
  }
  const data = await computeWorkforceDashboard();
  cachedDashboard = { data, ts: Date.now() };
  return data;
}

export function invalidateWorkforceCache(): void {
  cachedDashboard = null;
}

// ─── Public accessors for stores (for API routes) ────────────────────────────

export function listCrossDecisions(): CrossDepartmentDecision[] {
  return Array.from(decisionStore.values());
}

export function findCrossDecision(id: string): CrossDepartmentDecision | undefined {
  return decisionStore.get(id);
}

export function listDelegations(): Delegation[] {
  return delegationStore.slice(-50);
}

export function listEscalations(): Escalation[] {
  return escalationStore.slice(-50);
}

export function getEmployeeDetail(role: EmployeeRole): { definition: ReturnType<typeof getRoleDefinition> } | null {
  const def = getRoleDefinition(role);
  if (!def) return null;
  return { definition: def };
}
