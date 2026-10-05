// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI CEO™ — BUSINESS GOALS™
//
// Oracle maintains 8 default business goals covering revenue, profit,
// collections, GST compliance, customer growth, employee growth, runway, and
// market expansion. Each goal is computed from the live business state and
// carries:
//
//   • Baseline   — where the business started (current snapshot)
//   • Current    — where it is now
//   • Target     — the goal value
//   • Unit       — 'inr' | 'pct' | 'days' | 'count'
//   • Deadline   — end of financial year (31 March)
//   • Progress % — 0-100 computed from baseline → target
//   • Status     — on_track | at_risk | behind | achieved | overdue
//   • Trend %    — month-over-month change
//
// Every value flows from the REAL CFO + Twin snapshot. No fabrication.
//
// Tagline: GSTPilot AI CEO™ — Run Your Business. Not Your Software.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  BusinessGoal,
  GoalCategory,
} from './types';
import type { CEODataView } from './data';
import { formatINR } from './data';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let counter = 0;
function makeId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

/** End of current Indian financial year (31 March). */
function endOfFY(): string {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  // FY ends 31 March. If we're in Jan-Mar, FY ends this year; otherwise next year.
  const fyEndYear = month <= 2 ? now.getFullYear() : now.getFullYear() + 1;
  return new Date(fyEndYear, 2, 31, 23, 59, 59, 999).toISOString(); // March = month 2
}

function progressPct(baseline: number, target: number, current: number): number {
  // For "minimise" goals (target < baseline), invert the sign
  const span = target - baseline;
  if (Math.abs(span) < 1e-6) return current === target ? 100 : 0;
  const pct = ((current - baseline) / span) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

type GoalStatus = BusinessGoal['status'];

function statusFromProgress(progress: number, deadlineISO: string, current: number, target: number): GoalStatus {
  const deadlinePassed = new Date(deadlineISO).getTime() < Date.now();
  if (progress >= 100) return 'achieved';
  if (deadlinePassed) return 'overdue';
  // For "minimise" goals (target < baseline), achieving target is achievement
  const reachedTarget = (target >= 0 && current <= target && target < 0) || (current >= target && target > 0);
  if (reachedTarget) return 'achieved';
  if (progress >= 66) return 'on_track';
  if (progress >= 33) return 'at_risk';
  return 'behind';
}

function trendPctFrom(data: CEODataView, currentMonthValue: number, lastMonthValue: number): number {
  if (lastMonthValue === 0) return currentMonthValue > 0 ? 100 : 0;
  return Math.round(((currentMonthValue - lastMonthValue) / Math.abs(lastMonthValue)) * 100);
}

// ─── Goal builders ───────────────────────────────────────────────────────────

function buildRevenueGoal(data: CEODataView): BusinessGoal | null {
  const baseline = data.cfo.revenue.thisMonth;
  if (baseline <= 0 && !data.hasLiveData) return null;

  const target = baseline * 1.20; // +20%
  const current = baseline;
  const progress = progressPct(baseline, target, current);
  const lastMonth = data.cfo.revenue.lastMonth;
  const trend = trendPctFrom(data, current, lastMonth);
  const deadline = endOfFY();

  return {
    id: makeId('goal-revenue'),
    category: 'revenue',
    title: 'Revenue Target — +20% this FY',
    description: `Grow monthly revenue from ${formatINR(baseline)} to ${formatINR(target)}. Annualised uplift: ${formatINR(target * 12)}.`,
    baseline,
    current,
    target,
    unit: 'inr',
    deadline,
    progressPct: progress,
    status: statusFromProgress(progress, deadline, current, target),
    trendPct: trend,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildProfitGoal(data: CEODataView): BusinessGoal | null {
  const baseline = data.cfo.profitability.netMarginPct;
  if (baseline === 0 && data.liveState.revenue <= 0) return null;

  const target = 20; // 20% net margin
  const current = baseline;
  const progress = progressPct(baseline, target, current);
  const lastMonthTrend = data.cfo.profitability.monthlyTrends;
  const lastMonth = lastMonthTrend.length >= 2 ? lastMonthTrend[lastMonthTrend.length - 2].netMarginPct : baseline;
  const trend = trendPctFrom(data, current, lastMonth);
  const deadline = endOfFY();

  return {
    id: makeId('goal-profit'),
    category: 'profit',
    title: 'Profit Margin Target — 20% net',
    description: `Lift net margin from ${baseline.toFixed(1)}% to 20% via gross-margin expansion and opex discipline.`,
    baseline,
    current,
    target,
    unit: 'pct',
    deadline,
    progressPct: progress,
    status: statusFromProgress(progress, deadline, current, target),
    trendPct: trend,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildCollectionsGoal(data: CEODataView): BusinessGoal | null {
  const baseline = data.cfo.collections.collectionEfficiencyPct;
  if (baseline <= 0 && data.cfo.collections.totalOutstanding <= 0) return null;

  const target = 90;
  const current = baseline;
  const progress = progressPct(baseline, target, current);
  const deadline = endOfFY();

  return {
    id: makeId('goal-collections'),
    category: 'collections',
    title: 'Collection Efficiency Target — 90%',
    description: `Lift collection efficiency from ${baseline.toFixed(1)}% to 90% via early reminders, structured dunning, and term renegotiation.`,
    baseline,
    current,
    target,
    unit: 'pct',
    deadline,
    progressPct: progress,
    status: statusFromProgress(progress, deadline, current, target),
    trendPct: 0, // No MoM history available for collection efficiency
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildGSTComplianceGoal(data: CEODataView): BusinessGoal | null {
  const baseline = data.liveState.compliance;
  if (baseline <= 0 && data.cfo.gst.pendingFilings === 0) return null;

  const target = 100;
  const current = baseline;
  const progress = progressPct(baseline, target, current);
  const deadline = endOfFY();

  return {
    id: makeId('goal-gst'),
    category: 'gst_compliance',
    title: 'GST Compliance Target — 100% on-time',
    description: `Achieve 100% on-time GST filing. Current compliance score: ${baseline}/100. Overdue filings: ${data.cfo.gst.overdueFilings}.`,
    baseline,
    current,
    target,
    unit: 'pct',
    deadline,
    progressPct: progress,
    status: statusFromProgress(progress, deadline, current, target),
    trendPct: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildCustomerGrowthGoal(data: CEODataView): BusinessGoal | null {
  const baseline = data.liveState.clients;
  if (baseline <= 0 && !data.hasLiveData) return null;

  const target = baseline * 1.25; // +25%
  const current = baseline;
  const progress = progressPct(baseline, target, current);
  const deadline = endOfFY();

  return {
    id: makeId('goal-customer'),
    category: 'customer_growth',
    title: 'Customer Growth Target — +25%',
    description: `Grow active client base from ${baseline} to ${Math.round(target)} clients via outbound + referral programs.`,
    baseline,
    current,
    target,
    unit: 'count',
    deadline,
    progressPct: progress,
    status: statusFromProgress(progress, deadline, current, target),
    trendPct: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildEmployeeGrowthGoal(data: CEODataView): BusinessGoal | null {
  const baseline = data.liveState.employees;
  if (baseline <= 0 && !data.hasLiveData) return null;

  const target = Math.round(baseline * 1.10); // +10%
  const current = baseline;
  const progress = progressPct(baseline, target, current);
  const deadline = endOfFY();

  return {
    id: makeId('goal-employee'),
    category: 'employee_growth',
    title: 'Employee Growth Target — +10%',
    description: `Grow headcount from ${baseline} to ${target} employees, aligned with revenue growth.`,
    baseline,
    current,
    target,
    unit: 'count',
    deadline,
    progressPct: progress,
    status: statusFromProgress(progress, deadline, current, target),
    trendPct: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildRunwayGoal(data: CEODataView): BusinessGoal | null {
  const baseline = data.liveState.runwayDays;
  if (baseline <= 0 && data.liveState.burnRate <= 0) return null;

  const target = 180;
  const current = baseline;
  const progress = progressPct(baseline, target, current);
  const deadline = endOfFY();

  return {
    id: makeId('goal-runway'),
    category: 'runway',
    title: 'Cash Runway Target — ≥ 180 days',
    description: `Extend cash runway from ${baseline} days to 180 days via expense reduction, collections acceleration, and working-capital facility if needed.`,
    baseline,
    current,
    target,
    unit: 'days',
    deadline,
    progressPct: progress,
    status: statusFromProgress(progress, deadline, current, target),
    trendPct: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildMarketExpansionGoal(data: CEODataView): BusinessGoal | null {
  // Baseline = number of distinct states where clients are located
  const states = new Set(
    data.raw.clients
      .map((c) => c.state)
      .filter((s): s is string => Boolean(s)),
  );
  const baseline = Math.max(1, states.size); // at least 1 (current city/state)
  if (!data.hasLiveData) return null;

  const target = 2; // expand to ≥ 2 cities
  const current = baseline;
  const progress = progressPct(baseline, target, current);
  const deadline = endOfFY();

  return {
    id: makeId('goal-market'),
    category: 'market_expansion',
    title: 'Market Expansion Target — ≥ 2 cities',
    description: `Expand operations from ${baseline} to ${target}+ cities/states. Currently serving clients in: ${Array.from(states).slice(0, 5).join(', ') || 'single location'}.`,
    baseline,
    current,
    target,
    unit: 'count',
    deadline,
    progressPct: progress,
    status: statusFromProgress(progress, deadline, current, target),
    trendPct: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ─── Main entry: compute all 8 business goals ────────────────────────────────

export function computeBusinessGoals(data: CEODataView): BusinessGoal[] {
  const builders = [
    buildRevenueGoal,
    buildProfitGoal,
    buildCollectionsGoal,
    buildGSTComplianceGoal,
    buildCustomerGrowthGoal,
    buildEmployeeGrowthGoal,
    buildRunwayGoal,
    buildMarketExpansionGoal,
  ];

  const goals: BusinessGoal[] = [];
  for (const b of builders) {
    try {
      const g = b(data);
      if (g) goals.push(g);
    } catch (err) {
      console.warn(`[AI CEO Goals] Builder ${b.name} failed:`, err);
    }
  }

  return goals;
}
