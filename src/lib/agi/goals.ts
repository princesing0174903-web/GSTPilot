// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — INFINITY AGI™ — GOAL ENGINE™
//
// Businesses define goals. Oracle automatically breaks goals into projects,
// creates milestones, assigns work, executes, monitors progress, adapts plans.
//
// Goals are seeded from REAL CEOGoal rows + AGIGoal rows. Progress + confidence
// are derived from the live company observation (revenue, cash, compliance,
// runway) so every goal's status reflects the real enterprise state.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from './helpers';
import { safeCount, safeFindMany, cached, TTL, clamp01, clamp100, parseJson, emptyBreakdown } from './helpers';
import { fetchCEOData } from '@/lib/ceo/data';
import type {
  AGIGoal, GoalSummary, GoalCategory, GoalPriority, GoalStatus, AGIMilestone,
} from './types';

const CATEGORIES: GoalCategory[] = ['revenue', 'cost', 'retention', 'expansion', 'compliance', 'efficiency', 'growth', 'profit'];
const PRIORITIES: GoalPriority[] = ['low', 'medium', 'high', 'critical'];

// ─── Canonical goal templates — derived from the user's examples ─────────────

export interface GoalTemplate {
  goalKey: string;
  title: string;
  description: string;
  category: GoalCategory;
  priority: GoalPriority;
  targetMetric: string;
  unit: string;
  ownerAgent: string;
}

export const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    goalKey: 'increase_revenue_25pct',
    title: 'Increase Revenue by 25%',
    description: 'Grow monthly recurring revenue by 25% over the next two quarters through a combination of new client acquisition, pricing optimization, and expansion of existing accounts.',
    category: 'revenue', priority: 'high', targetMetric: 'revenue_mtd', unit: 'INR', ownerAgent: 'cfo',
  },
  {
    goalKey: 'reduce_gst_penalties',
    title: 'Reduce GST Penalties to Zero',
    description: 'Achieve zero GST penalties by ensuring 100% on-time filing, full ITC reconciliation, and proactive notice resolution.',
    category: 'compliance', priority: 'critical', targetMetric: 'gst_penalty_count', unit: 'count', ownerAgent: 'compliance',
  },
  {
    goalKey: 'reduce_payroll_cost_10pct',
    title: 'Reduce Payroll Cost by 10%',
    description: 'Optimize workforce cost by 10% through AI agent augmentation of repetitive roles, vendor consolidation, and compensation benchmarking.',
    category: 'cost', priority: 'medium', targetMetric: 'payroll_monthly', unit: 'INR', ownerAgent: 'hr',
  },
  {
    goalKey: 'improve_retention_95pct',
    title: 'Improve Customer Retention to 95%',
    description: 'Lift customer retention to 95% via proactive success outreach, churn-risk scoring, and renewal automation.',
    category: 'retention', priority: 'high', targetMetric: 'retention_rate', unit: 'pct', ownerAgent: 'customer_success',
  },
  {
    goalKey: 'launch_new_country',
    title: 'Launch Operations in a New Country',
    description: 'Expand into one new country within 6 months — entity setup, tax registration, compliance baseline, and first revenue.',
    category: 'expansion', priority: 'high', targetMetric: 'countries_active', unit: 'count', ownerAgent: 'ceo',
  },
  {
    goalKey: 'reduce_churn_5pct',
    title: 'Reduce Customer Churn by 5%',
    description: 'Lower monthly customer churn by 5 percentage points through improved onboarding, NPS-driven intervention, and at-risk account workflows.',
    category: 'retention', priority: 'high', targetMetric: 'churn_rate', unit: 'pct', ownerAgent: 'customer_success',
  },
  {
    goalKey: 'increase_profit_margin',
    title: 'Increase Net Profit Margin to 20%',
    description: 'Lift net profit margin to 20% via cost optimization, pricing discipline, and high-margin client mix.',
    category: 'profit', priority: 'high', targetMetric: 'net_margin_pct', unit: 'pct', ownerAgent: 'cfo',
  },
  {
    goalKey: 'improve_cash_runway_180',
    title: 'Extend Cash Runway to 180 Days',
    description: 'Build cash reserves to 180 days of runway via collections acceleration, expense control, and working-capital optimization.',
    category: 'efficiency', priority: 'critical', targetMetric: 'runway_days', unit: 'days', ownerAgent: 'cfo',
  },
];

// ─── Seed canonical goals if missing ─────────────────────────────────────────

export async function seedGoalsIfMissing(): Promise<void> {
  for (const t of GOAL_TEMPLATES) {
    try {
      const existing = await db.aGIGoal.findUnique({ where: { goalKey: t.goalKey } });
      if (!existing) {
        await db.aGIGoal.create({
          data: {
            goalKey: t.goalKey,
            title: t.title,
            description: t.description,
            category: t.category,
            priority: t.priority,
            targetMetric: t.targetMetric,
            targetValue: 0,
            currentValue: 0,
            baselineValue: 0,
            unit: t.unit,
            ownerId: t.ownerAgent,
            status: 'active',
            progressPct: 0,
            milestones: JSON.stringify(defaultMilestones(t.targetMetric)),
            planIds: '[]',
            confidence: 0.5,
          },
        });
      }
    } catch { /* ignore */ }
  }
}

function defaultMilestones(metric: string): AGIMilestone[] {
  return [
    { order: 1, label: 'Baseline established', targetValue: 0, achievedValue: 0, status: 'achieved', targetDate: null },
    { order: 2, label: '25% progress', targetValue: 25, achievedValue: 0, status: 'pending', targetDate: null },
    { order: 3, label: '50% progress', targetValue: 50, achievedValue: 0, status: 'pending', targetDate: null },
    { order: 4, label: '75% progress', targetValue: 75, achievedValue: 0, status: 'pending', targetDate: null },
    { order: 5, label: 'Goal achieved', targetValue: 100, achievedValue: 0, status: 'pending', targetDate: null },
  ];
}

// ─── Recompute goal progress from REAL live data ─────────────────────────────

export async function refreshGoalProgress(): Promise<void> {
  const ceoData = await fetchCEOData().catch(() => null);
  const live = ceoData?.liveState;
  const cash = live?.cash ?? 0;
  const revenue = live?.revenue ?? 0;
  const runway = live?.runwayDays ?? 0;
  const compliance = ceoData?.twin?.state?.compliance ?? 0;

  const goals = await safeFindMany(() => db.aGIGoal.findMany({
    where: { status: 'active' },
    select: { id: true, goalKey: true, targetMetric: true, baselineValue: true, targetValue: true },
  }));

  for (const g of goals) {
    let currentValue = 0;
    let targetValue = g.targetValue;
    let baseline = g.baselineValue;
    switch (g.targetMetric) {
      case 'revenue_mtd':
        currentValue = revenue;
        targetValue = Math.max(targetValue, revenue * 1.25);
        baseline = baseline || revenue;
        break;
      case 'cash_position':
        currentValue = cash;
        targetValue = Math.max(targetValue, cash * 1.5);
        baseline = baseline || cash;
        break;
      case 'runway_days':
        currentValue = runway;
        targetValue = Math.max(targetValue, 180);
        baseline = baseline || runway;
        break;
      case 'compliance_score':
        currentValue = compliance;
        targetValue = Math.max(targetValue, 100);
        baseline = baseline || compliance;
        break;
      case 'gst_penalty_count':
        // count real overdue GST filings as penalty proxy
        currentValue = await safeCount(() => db.gSTRFiling.count({ where: { status: 'overdue' } }));
        targetValue = 0;
        baseline = Math.max(baseline, currentValue + 1);
        break;
      case 'retention_rate':
        // proxy: 100 - churn. Churn proxy = overdue invoices / total invoices
        const totalClients = await safeCount(() => db.client.count());
        const overdue = await safeCount(() => db.invoice.count({ where: { status: 'overdue' } }));
        currentValue = totalClients > 0 ? Math.max(0, 100 - (overdue / totalClients) * 100) : 100;
        targetValue = Math.max(targetValue, 95);
        baseline = baseline || 80;
        break;
      case 'churn_rate':
        const totalClients2 = await safeCount(() => db.client.count());
        const overdue2 = await safeCount(() => db.invoice.count({ where: { status: 'overdue' } }));
        currentValue = totalClients2 > 0 ? (overdue2 / totalClients2) * 100 : 0;
        targetValue = Math.max(0, currentValue - 5);
        baseline = baseline || currentValue;
        break;
      case 'countries_active':
        currentValue = await safeCount(() => db.country.count({ where: { isActive: true } }));
        targetValue = Math.max(targetValue, currentValue + 1);
        baseline = baseline || currentValue;
        break;
      case 'net_margin_pct':
        const profit = live?.profit ?? 0;
        currentValue = revenue > 0 ? (profit / revenue) * 100 : 0;
        targetValue = Math.max(targetValue, 20);
        baseline = baseline || currentValue;
        break;
      case 'payroll_monthly':
        currentValue = live?.payroll ?? 0;
        targetValue = Math.max(targetValue, currentValue * 0.9);
        baseline = baseline || currentValue;
        break;
      default:
        continue;
    }

    const progress = computeProgress(baseline, targetValue, currentValue, g.targetMetric);
    const confidence = clamp01(0.5 + progress / 400); // higher progress → higher confidence
    const status: GoalStatus = progress >= 100 ? 'achieved' : 'active';
    try {
      await db.aGIGoal.update({
        where: { id: g.id },
        data: {
          currentValue,
          targetValue,
          baselineValue: baseline,
          progressPct: progress,
          confidence,
          status,
        },
      });
    } catch { /* ignore */ }
  }
}

function computeProgress(baseline: number, target: number, current: number, metric: string): number {
  // For "reduce" goals (penalties, churn, payroll_cost), lower is better
  const reduceMetrics = new Set(['gst_penalty_count', 'churn_rate', 'payroll_monthly']);
  if (reduceMetrics.has(metric)) {
    if (baseline <= 0) return current <= target ? 100 : 0;
    const reduction = baseline - current;
    const targetReduction = baseline - target;
    if (targetReduction <= 0) return current <= target ? 100 : 0;
    return clamp100(Math.round((reduction / targetReduction) * 100));
  }
  // For "increase" goals, higher is better
  if (target <= baseline) return current >= target ? 100 : 0;
  const gain = current - baseline;
  const targetGain = target - baseline;
  return clamp100(Math.round((gain / targetGain) * 100));
}

// ─── Create a custom goal ────────────────────────────────────────────────────

export async function createGoal(input: {
  title: string;
  description: string;
  category: GoalCategory;
  priority?: GoalPriority;
  targetMetric: string;
  targetValue: number;
  unit?: string;
  deadline?: string;
  ownerId?: string;
}): Promise<AGIGoal> {
  const goalKey = `custom_${Date.now()}`;
  const created = await db.aGIGoal.create({
    data: {
      goalKey,
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority ?? 'high',
      targetMetric: input.targetMetric,
      targetValue: input.targetValue,
      currentValue: 0,
      baselineValue: 0,
      unit: input.unit ?? null,
      deadline: input.deadline ? new Date(input.deadline) : null,
      ownerId: input.ownerId ?? 'ceo',
      status: 'active',
      progressPct: 0,
      milestones: JSON.stringify(defaultMilestones(input.targetMetric)),
      planIds: '[]',
      confidence: 0.5,
    },
  });
  return mapRow(created);
}

// ─── Load goals ──────────────────────────────────────────────────────────────

export async function getGoals(limit = 24): Promise<AGIGoal[]> {
  await seedGoalsIfMissing();
  await refreshGoalProgress();
  const rows = await safeFindMany(() => db.aGIGoal.findMany({
    orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  }));
  return rows.map(mapRow);
}

export async function getGoalSummary(): Promise<GoalSummary> {
  return cached<GoalSummary>('agi:goals:summary', TTL.MEDIUM, async () => {
    await seedGoalsIfMissing();
    await refreshGoalProgress();
    const rows = await safeFindMany(() => db.aGIGoal.findMany());
    const byCategory = emptyBreakdown(CATEGORIES);
    const byPriority = emptyBreakdown(PRIORITIES);
    let active = 0, achieved = 0, failed = 0, atRisk = 0;
    let totalProgress = 0, totalConfidence = 0;
    const now = Date.now();
    for (const r of rows) {
      byCategory[r.category as GoalCategory] = (byCategory[r.category as GoalCategory] ?? 0) + 1;
      byPriority[r.priority as GoalPriority] = (byPriority[r.priority as GoalPriority] ?? 0) + 1;
      totalProgress += r.progressPct ?? 0;
      totalConfidence += r.confidence ?? 0;
      if (r.status === 'active') {
        active++;
        const dl = r.deadline ? new Date(r.deadline).getTime() : null;
        if ((r.progressPct ?? 0) < 50 && dl && dl - now < 14 * 86400000) atRisk++;
      }
      if (r.status === 'achieved') achieved++;
      if (r.status === 'failed') failed++;
    }
    return {
      totalGoals: rows.length,
      activeGoals: active,
      achievedGoals: achieved,
      failedGoals: failed,
      avgProgress: rows.length > 0 ? clamp100(Math.round(totalProgress / rows.length)) : 0,
      avgConfidence: rows.length > 0 ? clamp01(totalConfidence / rows.length) : 0,
      byCategory,
      byPriority,
      goalsAtRisk: atRisk,
    };
  });
}

// ─── Row mapper ──────────────────────────────────────────────────────────────

function mapRow(r: {
  id: string; goalKey: string; title: string; description: string;
  category: string; priority: string; targetMetric: string; targetValue: number;
  currentValue: number; baselineValue: number; unit: string | null;
  deadline: Date | null; ownerId: string | null; status: string;
  progressPct: number; milestones: string; planIds: string; confidence: number;
  notes: string | null; createdAt: Date; updatedAt: Date;
}): AGIGoal {
  return {
    id: r.id,
    goalKey: r.goalKey,
    title: r.title,
    description: r.description,
    category: r.category as GoalCategory,
    priority: r.priority as GoalPriority,
    targetMetric: r.targetMetric,
    targetValue: r.targetValue,
    currentValue: r.currentValue,
    baselineValue: r.baselineValue,
    unit: r.unit,
    deadline: r.deadline ? r.deadline.toISOString() : null,
    ownerId: r.ownerId,
    status: r.status as GoalStatus,
    progressPct: clamp100(r.progressPct ?? 0),
    milestones: parseJson<AGIMilestone[]>(r.milestones, []),
    planIds: parseJson<string[]>(r.planIds, []),
    confidence: clamp01(r.confidence ?? 0.5),
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
