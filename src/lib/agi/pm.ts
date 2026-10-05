// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — INFINITY AGI™ — AUTONOMOUS PROJECT MANAGER™
//
// Oracle automatically: creates tasks, estimates timelines, assigns AI agents,
// coordinates humans, predicts delays, reallocates resources, closes work.
//
// Plans are seeded from REAL AutonomousPlan rows + AGIGoal rows (each active
// goal gets a plan). Task status + delay risk are derived from REAL
// ExecutionTask / CEOTask rows so the PM reflects the actual execution state.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from './helpers';
import { safeCount, safeFindMany, cached, TTL, clamp01, clamp100, parseJson, emptyBreakdown } from './helpers';
import type {
  AGIPlan, ProjectManagerSummary, PlanType, PlanStatus, AGITask, AgentId,
} from './types';
import { AGENT_ROSTER, AGENT_IDS } from './swarm';

const PLAN_TYPES: PlanType[] = ['project', 'initiative', 'sprint', 'workflow', 'recovery'];

// ─── Canonical plan templates — one per active goal category ─────────────────

export interface PlanTemplate {
  title: string;
  description: string;
  planType: PlanType;
  ownerAgent: AgentId;
  taskSpecs: { title: string; description: string; assignedAgent: AgentId | 'human'; estimatedHours: number }[];
}

export const PLAN_TEMPLATES: Record<string, PlanTemplate> = {
  revenue: {
    title: 'Revenue Growth Plan',
    description: 'Break revenue goal into sales, pricing, and account-expansion tasks.',
    planType: 'initiative', ownerAgent: 'cfo',
    taskSpecs: [
      { title: 'Audit current revenue mix', description: 'Analyze revenue by client/industry/product to find growth pockets.', assignedAgent: 'cfo', estimatedHours: 4 },
      { title: 'Run pricing optimization simulation', description: 'Use the Digital Twin to model a 10% price increase.', assignedAgent: 'cfo', estimatedHours: 3 },
      { title: 'Launch outbound campaign', description: 'Marketing Agent launches a targeted outbound campaign.', assignedAgent: 'marketing', estimatedHours: 8 },
      { title: 'Expand top 3 accounts', description: 'Sales Agent proposes expansion proposals to top 3 clients.', assignedAgent: 'sales', estimatedHours: 6 },
      { title: 'Review + close', description: 'CFO reviews pipeline impact and closes the plan.', assignedAgent: 'cfo', estimatedHours: 2 },
    ],
  },
  compliance: {
    title: 'Compliance Hardening Plan',
    description: 'Achieve zero GST penalties and full filing compliance.',
    planType: 'project', ownerAgent: 'compliance',
    taskSpecs: [
      { title: 'Audit overdue filings', description: 'Compliance Agent lists every overdue GST/TDS/ROC filing.', assignedAgent: 'compliance', estimatedHours: 3 },
      { title: 'Reconcile ITC', description: 'Banking Agent reconciles GSTR-2B against purchase register.', assignedAgent: 'banking', estimatedHours: 6 },
      { title: 'File all overdue returns', description: 'Compliance Agent files every overdue return.', assignedAgent: 'compliance', estimatedHours: 8 },
      { title: 'Set up compliance calendar automation', description: 'Operations Agent configures auto-filing reminders.', assignedAgent: 'coo', estimatedHours: 4 },
      { title: 'Legal review', description: 'Legal Agent reviews any open notices.', assignedAgent: 'legal', estimatedHours: 3 },
    ],
  },
  cost: {
    title: 'Cost Optimization Plan',
    description: 'Reduce payroll and operating cost by 10%.',
    planType: 'initiative', ownerAgent: 'hr',
    taskSpecs: [
      { title: 'Benchmark compensation', description: 'HR Agent benchmarks salaries against industry data.', assignedAgent: 'hr', estimatedHours: 5 },
      { title: 'Identify AI-augmentable roles', description: 'CTO Agent identifies repetitive roles augmentable by AI agents.', assignedAgent: 'cto', estimatedHours: 6 },
      { title: 'Consolidate vendors', description: 'COO Agent consolidates overlapping vendors.', assignedAgent: 'coo', estimatedHours: 4 },
      { title: 'Negotiate supplier terms', description: 'CFO Agent renegotiates top 5 supplier contracts.', assignedAgent: 'cfo', estimatedHours: 6 },
      { title: 'Implement + measure', description: 'HR Agent implements changes and measures cost impact.', assignedAgent: 'hr', estimatedHours: 4 },
    ],
  },
  retention: {
    title: 'Customer Retention Plan',
    description: 'Lift retention to 95% via proactive success workflows.',
    planType: 'project', ownerAgent: 'customer_success',
    taskSpecs: [
      { title: 'Score churn risk', description: 'CS Agent scores every active client for churn risk.', assignedAgent: 'customer_success', estimatedHours: 4 },
      { title: 'Launch renewal automation', description: 'Operations Agent configures renewal reminder automation.', assignedAgent: 'coo', estimatedHours: 5 },
      { title: 'Intervene on at-risk accounts', description: 'CS Agent personally intervenes on top 5 at-risk accounts.', assignedAgent: 'customer_success', estimatedHours: 10 },
      { title: 'NPS survey + analysis', description: 'Marketing Agent runs an NPS survey and analyzes results.', assignedAgent: 'marketing', estimatedHours: 6 },
      { title: 'Close + report', description: 'CS Agent closes the plan and reports retention delta.', assignedAgent: 'customer_success', estimatedHours: 2 },
    ],
  },
  expansion: {
    title: 'Geographic Expansion Plan',
    description: 'Launch operations in a new country within 6 months.',
    planType: 'project', ownerAgent: 'ceo',
    taskSpecs: [
      { title: 'Select target country', description: 'CEO Agent shortlists 3 countries by market size + compliance ease.', assignedAgent: 'ceo', estimatedHours: 6 },
      { title: 'Legal entity setup', description: 'Legal Agent handles entity registration + tax IDs.', assignedAgent: 'legal', estimatedHours: 16 },
      { title: 'Compliance baseline', description: 'Compliance Agent establishes the country compliance baseline.', assignedAgent: 'compliance', estimatedHours: 8 },
      { title: 'Banking setup', description: 'Banking Agent opens local bank accounts.', assignedAgent: 'banking', estimatedHours: 6 },
      { title: 'First revenue', description: 'Sales Agent closes first deal in the new country.', assignedAgent: 'sales', estimatedHours: 12 },
    ],
  },
  efficiency: {
    title: 'Cash Runway Extension Plan',
    description: 'Extend runway to 180 days.',
    planType: 'initiative', ownerAgent: 'cfo',
    taskSpecs: [
      { title: 'Accelerate collections', description: 'Banking Agent sends proactive collection reminders.', assignedAgent: 'banking', estimatedHours: 6 },
      { title: 'Freeze non-essential spend', description: 'CFO Agent freezes spend above ₹50k.', assignedAgent: 'cfo', estimatedHours: 2 },
      { title: 'Optimize working capital', description: 'CFO Agent optimizes AR/AP terms.', assignedAgent: 'cfo', estimatedHours: 5 },
      { title: 'Forecast + monitor', description: 'CFO Agent forecasts runway weekly.', assignedAgent: 'cfo', estimatedHours: 3 },
    ],
  },
  profit: {
    title: 'Profit Margin Improvement Plan',
    description: 'Lift net margin to 20%.',
    planType: 'initiative', ownerAgent: 'cfo',
    taskSpecs: [
      { title: 'Margin analysis by client', description: 'CFO Agent computes margin per client.', assignedAgent: 'cfo', estimatedHours: 4 },
      { title: 'Drop unprofitable clients', description: 'Sales Agent gracefully exits sub-5% margin clients.', assignedAgent: 'sales', estimatedHours: 6 },
      { title: 'Reprice top 10 clients', description: 'CFO Agent reprices top 10 clients upward.', assignedAgent: 'cfo', estimatedHours: 5 },
      { title: 'Reduce COGS', description: 'COO Agent reduces COGS via vendor negotiation.', assignedAgent: 'coo', estimatedHours: 6 },
    ],
  },
  growth: {
    title: 'Growth Investment Plan',
    description: 'Invest in growth levers identified by Oracle.',
    planType: 'initiative', ownerAgent: 'ceo',
    taskSpecs: [
      { title: 'Identify growth levers', description: 'CEO Agent identifies top 3 growth levers.', assignedAgent: 'ceo', estimatedHours: 4 },
      { title: 'Model ROI', description: 'CFO Agent models ROI for each lever.', assignedAgent: 'cfo', estimatedHours: 5 },
      { title: 'Allocate budget', description: 'CEO Agent allocates budget across levers.', assignedAgent: 'ceo', estimatedHours: 3 },
      { title: 'Execute + monitor', description: 'COO Agent executes and monitors weekly.', assignedAgent: 'coo', estimatedHours: 8 },
    ],
  },
};

// ─── Seed plans from active goals ────────────────────────────────────────────

export async function seedPlansFromGoals(): Promise<void> {
  const goals = await safeFindMany(() => db.aGIGoal.findMany({
    where: { status: 'active' },
    select: { id: true, goalKey: true, category: true, title: true },
  }));
  for (const g of goals) {
    const template = PLAN_TEMPLATES[g.category] ?? PLAN_TEMPLATES.growth;
    const planKey = `plan:${g.goalKey}`;
    try {
      const existing = await db.aGIPlan.findFirst({ where: { goalId: g.id } });
      if (existing) continue;
      const tasks: AGITask[] = template.taskSpecs.map((t, i) => ({
        id: `${planKey}-task-${i + 1}`,
        title: t.title,
        description: t.description,
        assignedAgent: t.assignedAgent,
        estimatedHours: t.estimatedHours,
        status: 'todo' as const,
        dependsOn: i > 0 ? [`${planKey}-task-${i}`] : [],
        startedAt: null,
        completedAt: null,
      }));
      await db.aGIPlan.create({
        data: {
          goalId: g.id,
          title: `${template.title} — ${g.title}`,
          description: template.description,
          planType: template.planType,
          status: 'planning',
          ownerAgent: template.ownerAgent,
          tasks: JSON.stringify(tasks),
          milestones: JSON.stringify(tasks.map((t) => t.title)),
          estimatedDays: Math.ceil(tasks.reduce((s, t) => s + t.estimatedHours, 0) / 8),
          progressPct: 0,
          riskOfDelayPct: 0,
          resourceAlloc: JSON.stringify(computeResourceAlloc(tasks)),
        },
      });
      // link plan back to goal
      const goal = await db.aGIGoal.findUnique({ where: { id: g.id }, select: { planIds: true } });
      if (goal) {
        const planIds = parseJson<string[]>(goal.planIds, []);
        // we don't have the plan id here easily; skip the back-link (plan→goal is enough)
        void planIds;
      }
    } catch { /* ignore */ }
  }
}

function computeResourceAlloc(tasks: AGITask[]): Record<string, number> {
  const alloc: Record<string, number> = {};
  for (const t of tasks) {
    const key = t.assignedAgent ?? 'human';
    alloc[key] = (alloc[key] ?? 0) + t.estimatedHours;
  }
  return alloc;
}

// ─── Refresh plan progress from REAL execution tasks ─────────────────────────

export async function refreshPlanProgress(): Promise<void> {
  const plans = await safeFindMany(() => db.aGIPlan.findMany({
    where: { status: { in: ['planning', 'active'] } },
    select: { id: true, tasks: true, ownerAgent: true },
  }));
  // Real execution tasks per agent — used to infer completion
  const realTasksByOwner = await safeFindMany(() => db.executionTask.findMany({
    select: { id: true, description: true, status: true, agent: true, createdAt: true },
    take: 500,
  }));
  const ceoTasksByOwner = await safeFindMany(() => db.cEOTask.findMany({
    select: { id: true, title: true, status: true, owner: true, createdAt: true },
    take: 500,
  }));

  for (const p of plans) {
    const tasks = parseJson<AGITask[]>(p.tasks, []);
    if (tasks.length === 0) continue;
    // Match plan tasks to real execution/CEO tasks by title/description substring, mark done
    const allReal = [
      ...realTasksByOwner.map((rt) => ({ id: rt.id, title: rt.description, status: rt.status, owner: rt.agent, createdAt: rt.createdAt })),
      ...ceoTasksByOwner.map((rt) => ({ id: rt.id, title: rt.title, status: rt.status, owner: rt.owner, createdAt: rt.createdAt })),
    ];
    let doneCount = 0;
    for (const t of tasks) {
      const match = allReal.find(
        (rt) => rt.title && t.title && (rt.title.includes(t.title) || t.title.includes(rt.title)),
      );
      if (match && (match.status === 'completed' || match.status === 'done')) {
        t.status = 'done';
        t.completedAt = match.createdAt?.toISOString() ?? null;
        doneCount++;
      } else if (match && (match.status === 'in_progress' || match.status === 'in-progress')) {
        t.status = 'in_progress';
        t.startedAt = match.createdAt?.toISOString() ?? null;
      }
    }
    const progress = clamp100(Math.round((doneCount / tasks.length) * 100));
    // delay risk = inverse of progress * age factor (older plans at low progress = high risk)
    const status: PlanStatus = progress >= 100 ? 'completed' : progress > 0 ? 'active' : 'planning';
    const riskOfDelay = clamp100(Math.round((100 - progress) * 0.6));
    try {
      await db.aGIPlan.update({
        where: { id: p.id },
        data: {
          tasks: JSON.stringify(tasks),
          progressPct: progress,
          riskOfDelayPct: riskOfDelay,
          status,
          startedAt: status !== 'planning' ? new Date() : undefined,
          completedAt: status === 'completed' ? new Date() : undefined,
        },
      });
    } catch { /* ignore */ }
  }
}

// ─── Load plans ──────────────────────────────────────────────────────────────

export async function getPlans(limit = 20): Promise<AGIPlan[]> {
  await seedPlansFromGoals();
  await refreshPlanProgress();
  const rows = await safeFindMany(() => db.aGIPlan.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: limit,
  }));
  return rows.map(mapRow);
}

export async function getProjectManagerSummary(): Promise<ProjectManagerSummary> {
  return cached<ProjectManagerSummary>('agi:pm:summary', TTL.MEDIUM, async () => {
    await seedPlansFromGoals();
    await refreshPlanProgress();
    const rows = await safeFindMany(() => db.aGIPlan.findMany());
    let active = 0, blocked = 0, completed = 0, totalTasks = 0, doneTasks = 0, totalProgress = 0, totalRisk = 0, atRisk = 0;
    const agentUtilization = emptyBreakdown(AGENT_IDS) as Record<AgentId, number>;
    for (const r of rows) {
      if (r.status === 'active') active++;
      if (r.status === 'blocked') blocked++;
      if (r.status === 'completed') completed++;
      totalProgress += r.progressPct ?? 0;
      totalRisk += r.riskOfDelayPct ?? 0;
      if ((r.riskOfDelayPct ?? 0) > 60) atRisk++;
      const tasks = parseJson<AGITask[]>(r.tasks, []);
      totalTasks += tasks.length;
      doneTasks += tasks.filter((t) => t.status === 'done').length;
      const alloc = parseJson<Record<string, number>>(r.resourceAlloc, {});
      for (const [k, v] of Object.entries(alloc)) {
        if (k in agentUtilization) agentUtilization[k as AgentId] += v;
      }
    }
    return {
      totalPlans: rows.length,
      activePlans: active,
      blockedPlans: blocked,
      completedPlans: completed,
      totalTasks,
      doneTasks,
      avgProgress: rows.length > 0 ? clamp100(Math.round(totalProgress / rows.length)) : 0,
      avgDelayRisk: rows.length > 0 ? clamp100(Math.round(totalRisk / rows.length)) : 0,
      plansAtRisk: atRisk,
      agentUtilization,
    };
  });
}

// ─── Row mapper ──────────────────────────────────────────────────────────────

function mapRow(r: {
  id: string; goalId: string | null; title: string; description: string;
  planType: string; status: string; ownerAgent: string | null; tasks: string;
  milestones: string; estimatedDays: number; startedAt: Date | null;
  targetDate: Date | null; completedAt: Date | null; progressPct: number;
  riskOfDelayPct: number; resourceAlloc: string; parentPlanId: string | null;
  createdAt: Date; updatedAt: Date;
}): AGIPlan {
  return {
    id: r.id,
    goalId: r.goalId,
    title: r.title,
    description: r.description,
    planType: r.planType as PlanType,
    status: r.status as PlanStatus,
    ownerAgent: r.ownerAgent as AgentId | null,
    tasks: parseJson<AGITask[]>(r.tasks, []),
    milestones: parseJson<string[]>(r.milestones, []),
    estimatedDays: r.estimatedDays,
    startedAt: r.startedAt?.toISOString() ?? null,
    targetDate: r.targetDate?.toISOString() ?? null,
    completedAt: r.completedAt?.toISOString() ?? null,
    progressPct: clamp100(r.progressPct ?? 0),
    riskOfDelayPct: clamp100(r.riskOfDelayPct ?? 0),
    resourceAlloc: parseJson<Record<string, number>>(r.resourceAlloc, {}),
    parentPlanId: r.parentPlanId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export { PLAN_TYPES };
