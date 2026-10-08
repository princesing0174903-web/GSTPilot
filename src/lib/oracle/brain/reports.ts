// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Reports Engine (PROMPT 6)
//
// Auto-generated daily / weekly / monthly executive reports. Each report is
// stored in OracleBrainReport (upserted on firmId+type+period) so re-running
// for the same period replaces it. Reports pull real numbers from the
// Business Snapshot and cross-reference OracleBrainTask / OracleBrainDecision.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getBusinessSnapshot, type BusinessSnapshot } from '@/lib/business/snapshot';
import type {
  BrainReport,
  ReportType,
  ReportContent,
  ReportSection,
  ReportInsight,
  ReportRecommendation,
} from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(n: number): string {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getISOWeek(d: Date): { year: number; week: number } {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return { year: d.getFullYear(), week };
}

async function safeSnapshot(
  firmId: string,
): Promise<BusinessSnapshot | null> {
  try {
    return await getBusinessSnapshot(firmId);
  } catch {
    return null;
  }
}

interface ReportRow {
  id: string;
  firmId: string;
  userId: string | null;
  type: string;
  period: string;
  title: string;
  summary: string;
  content: string;
  insights: string;
  recommendations: string;
  metrics: string;
  generatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

function mapRow(row: ReportRow): BrainReport {
  let content: ReportContent = { sections: [] };
  try {
    content = JSON.parse(row.content || '{"sections":[]}');
  } catch {
    /* keep default */
  }
  let insights: ReportInsight[] = [];
  try {
    insights = JSON.parse(row.insights || '[]');
  } catch {
    /* keep default */
  }
  let recommendations: ReportRecommendation[] = [];
  try {
    recommendations = JSON.parse(row.recommendations || '[]');
  } catch {
    /* keep default */
  }
  let metrics: Record<string, number | string> = {};
  try {
    metrics = JSON.parse(row.metrics || '{}');
  } catch {
    /* keep default */
  }
  return {
    id: row.id,
    firmId: row.firmId,
    userId: row.userId,
    type: row.type as ReportType,
    period: row.period,
    title: row.title,
    summary: row.summary,
    content,
    insights,
    recommendations,
    metrics,
    generatedBy: row.generatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── Insight & recommendation builders ───────────────────────────────────────

function buildInsights(snap: BusinessSnapshot | null): ReportInsight[] {
  if (!snap) return [];
  const out: ReportInsight[] = [];
  if (snap.collectionRate < 0.5) {
    out.push({
      headline: 'Low collection rate',
      detail: `Collection rate at ${(snap.collectionRate * 100).toFixed(1)}% — over half of invoiced revenue is uncollected. This is the #1 cash flow risk.`,
      severity: snap.collectionRate < 0.25 ? 'critical' : 'warn',
    });
  }
  if (snap.topCustomerShare > 0.6) {
    out.push({
      headline: 'Customer concentration risk',
      detail: `Top customer represents ${(snap.topCustomerShare * 100).toFixed(1)}% of revenue. Diversification needed to reduce dependency.`,
      severity: snap.topCustomerShare > 0.8 ? 'critical' : 'warn',
    });
  }
  if (snap.runwayDays < 90 && snap.runwayDays !== Infinity) {
    out.push({
      headline: 'Limited cash runway',
      detail: `Cash runway ${Math.round(snap.runwayDays)} days at current burn. Action needed to extend.`,
      severity: snap.runwayDays < 30 ? 'critical' : 'warn',
    });
  }
  if (snap.profitMargin > 0.2) {
    out.push({
      headline: 'Strong profitability',
      detail: `Profit margin ${(snap.profitMargin * 100).toFixed(1)}% — well above industry benchmark. Reinvest in growth.`,
      severity: 'info',
    });
  }
  if (snap.gstLiability > 0) {
    out.push({
      headline: 'GST liability pending',
      detail: `Net GST payable ${formatINR(snap.gstLiability)}. Ensure timely filing to avoid penalties.`,
      severity: 'watch',
    });
  }
  if (snap.overdueReturns > 0) {
    out.push({
      headline: 'Overdue GST returns',
      detail: `${snap.overdueReturns} GST return(s) past due date. File immediately.`,
      severity: 'critical',
    });
  }
  return out.slice(0, 6);
}

function buildRecommendations(snap: BusinessSnapshot | null): ReportRecommendation[] {
  if (!snap) return [];
  const out: ReportRecommendation[] = [];
  if (snap.receivables > 0 && snap.collectionRate < 0.5) {
    out.push({
      title: 'Collect outstanding receivables',
      priority: 'P0',
      action: `Send reminders to all customers with overdue invoices totaling ${formatINR(snap.overdueReceivables)}.`,
      reason: 'Collection rate below 50% is starving the business of cash.',
      impact: `Could unlock ${formatINR(snap.receivables)} in working capital.`,
    });
  }
  if (snap.topCustomerShare > 0.6) {
    out.push({
      title: 'Diversify customer base',
      priority: 'P1',
      action: 'Acquire 2-3 new mid-size customers in the next quarter.',
      reason: `Single customer concentration at ${(snap.topCustomerShare * 100).toFixed(0)}% creates existential risk.`,
      impact: 'Reduces revenue volatility and improves valuation.',
    });
  }
  if (snap.gstLiability > 0) {
    out.push({
      title: 'File GST return',
      priority: snap.overdueReturns > 0 ? 'P0' : 'P2',
      action: `File GSTR-3B and pay ${formatINR(snap.gstLiability)} net GST.`,
      reason: 'Late filing attracts ₹50/day penalty plus interest.',
      impact: 'Avoids penalties and maintains compliance score.',
    });
  }
  if (snap.runwayDays < 90 && snap.runwayDays !== Infinity) {
    out.push({
      title: 'Extend cash runway',
      priority: snap.runwayDays < 30 ? 'P0' : 'P1',
      action: 'Reduce discretionary spend by 20% or accelerate collections.',
      reason: `Runway of ${Math.round(snap.runwayDays)} days is below the 90-day safety threshold.`,
      impact: 'Buys time to execute growth strategy without dilution.',
    });
  }
  if (snap.profitMargin > 0.2 && snap.forecast.trend === 'up') {
    out.push({
      title: 'Reinvest in growth',
      priority: 'P2',
      action: 'Allocate 15% of profit to sales/marketing for the next 2 quarters.',
      reason: 'Strong margins + upward revenue trend = ideal time to scale.',
      impact: `Forecast revenue next month: ${formatINR(snap.forecast.nextMonthRevenue)}.`,
    });
  }
  return out.slice(0, 5);
}

// ─── Daily report ─────────────────────────────────────────────────────────────

/** Generate (or replace) today's daily report. */
export async function generateDailyReport(
  firmId: string,
  userId?: string,
  date?: Date,
): Promise<BrainReport> {
  try {
    const now = date ?? new Date();
    const period = now.toISOString().slice(0, 10);
    const title = `Daily Business Brief — ${formatDate(now)}`;

    const [snap, recentConvs, pendingTasks, activeReminders] = await Promise.all([
      safeSnapshot(firmId),
      db.oracleBrainMemory.findMany({
        where: {
          firmId,
          type: 'conversation',
          createdAt: {
            gte: new Date(now.getTime() - 48 * 3600 * 1000),
            lt: new Date(now.getTime() - 12 * 3600 * 1000),
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { title: true },
      }),
      db.oracleBrainTask.count({
        where: { firmId, status: { notIn: ['completed', 'cancelled'] } },
      }),
      db.oracleBrainReminder.count({
        where: { firmId, status: 'active' },
      }),
    ]);

    const revenue = snap?.revenueThisMonth ?? 0;
    const cash = snap?.cash ?? 0;
    const gstLiability = snap?.gstLiability ?? 0;
    const receivables = snap?.receivables ?? 0;
    const health = snap?.healthScore ?? 0;

    const sections: ReportSection[] = [
      {
        heading: "Yesterday's Activity",
        body:
          recentConvs.length > 0
            ? `You held ${recentConvs.length} conversation(s) with Oracle yesterday:`
            : 'No conversations were recorded yesterday.',
        bullets: recentConvs.map((c) => c.title),
      },
      {
        heading: "Today's Snapshot",
        body: 'Current business position from real data:',
        metrics: [
          { label: 'Revenue (MTD)', value: formatINR(revenue), tone: revenue > 0 ? 'positive' : 'neutral' },
          { label: 'Cash', value: formatINR(cash), tone: cash < 50000 ? 'warning' : 'positive' },
          { label: 'GST Liability', value: formatINR(gstLiability), tone: gstLiability > 0 ? 'neutral' : 'positive' },
          { label: 'Receivables', value: formatINR(receivables), tone: receivables > 0 ? 'warning' : 'positive' },
          { label: 'Health Score', value: `${health}/100`, tone: health >= 70 ? 'positive' : health >= 50 ? 'neutral' : 'negative' },
        ],
      },
      {
        heading: 'Priorities',
        body: 'Top items needing attention today:',
        bullets: [
          pendingTasks > 0 ? `${pendingTasks} pending task(s) need attention` : 'No pending tasks',
          activeReminders > 0 ? `${activeReminders} active alert(s)` : 'No active alerts',
          receivables > 0 ? `Follow up on ${formatINR(receivables)} in receivables` : 'No receivables outstanding',
          gstLiability > 0 ? `Plan GST filing for ${formatINR(gstLiability)}` : 'GST position is clear',
        ].filter(Boolean),
      },
      {
        heading: 'Watch Items',
        body: 'Active reminders from Oracle:',
        bullets:
          activeReminders > 0
            ? [`${activeReminders} active reminder(s) — review in the Memory panel`]
            : ['No active reminders — business is operating normally'],
      },
    ];

    const insights = buildInsights(snap);
    const recommendations = buildRecommendations(snap);
    const summary = `Daily brief for ${formatDate(now)}: Revenue ${formatINR(revenue)}, Health ${health}/100, ${pendingTasks} pending tasks, ${activeReminders} active alerts.`;
    const metrics: Record<string, number | string> = {
      revenue,
      cash,
      gstLiability,
      receivables,
      healthScore: health,
      pendingTasks,
      activeReminders,
    };

    const row = await db.oracleBrainReport.upsert({
      where: { firmId_type_period: { firmId, type: 'daily', period } },
      create: {
        firmId,
        userId: userId ?? null,
        type: 'daily',
        period,
        title,
        summary,
        content: JSON.stringify({ sections }),
        insights: JSON.stringify(insights),
        recommendations: JSON.stringify(recommendations),
        metrics: JSON.stringify(metrics),
        generatedBy: 'oracle',
      },
      update: {
        userId: userId ?? null,
        title,
        summary,
        content: JSON.stringify({ sections }),
        insights: JSON.stringify(insights),
        recommendations: JSON.stringify(recommendations),
        metrics: JSON.stringify(metrics),
        generatedBy: 'oracle',
      },
    });
    return mapRow(row as unknown as ReportRow);
  } catch (err) {
    throw new Error(
      `generateDailyReport failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ─── Weekly report ────────────────────────────────────────────────────────────

/** Generate (or replace) this week's weekly report. */
export async function generateWeeklyReport(
  firmId: string,
  userId?: string,
  weekStart?: Date,
): Promise<BrainReport> {
  try {
    const now = weekStart ?? new Date();
    const { year, week } = getISOWeek(now);
    const period = `${year}-W${String(week).padStart(2, '0')}`;
    const title = `Weekly Executive Report — Week ${week}, ${year}`;

    const [snap, weekDecisions, completedTasks, pendingTasks] = await Promise.all([
      safeSnapshot(firmId),
      db.oracleBrainDecision.findMany({
        where: {
          firmId,
          createdAt: { gte: new Date(now.getTime() - 7 * 86400000) },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { title: true, status: true, priority: true },
      }),
      db.oracleBrainTask.count({
        where: {
          firmId,
          status: 'completed',
          completedAt: { gte: new Date(now.getTime() - 7 * 86400000) },
        },
      }),
      db.oracleBrainTask.findMany({
        where: { firmId, status: { notIn: ['completed', 'cancelled'] } },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { title: true, priority: true },
      }),
    ]);

    const revenue = snap?.revenue ?? 0;
    const profit = snap?.profit ?? 0;
    const expenses = snap?.expenses ?? 0;
    const cash = snap?.cash ?? 0;
    const gstLiability = snap?.gstLiability ?? 0;
    const health = snap?.healthScore ?? 0;
    const marginPct = snap ? Math.round(snap.profitMargin * 100) : 0;
    const revenueChange =
      snap && snap.revenueLastMonth > 0
        ? Math.round(((snap.revenueThisMonth - snap.revenueLastMonth) / snap.revenueLastMonth) * 100)
        : 0;

    const sections: ReportSection[] = [
      {
        heading: 'Week at a Glance',
        body: 'Headline numbers for the week:',
        metrics: [
          { label: 'Revenue (FY)', value: formatINR(revenue), tone: 'positive' },
          { label: 'Profit', value: formatINR(profit), tone: profit > 0 ? 'positive' : 'negative' },
          { label: 'Expenses', value: formatINR(expenses), tone: 'neutral' },
          { label: 'Cash', value: formatINR(cash), tone: cash < 50000 ? 'warning' : 'positive' },
          { label: 'GST Liability', value: formatINR(gstLiability), tone: 'neutral' },
          { label: 'Health Score', value: `${health}/100`, tone: health >= 70 ? 'positive' : 'neutral' },
        ],
      },
      {
        heading: 'Revenue & Growth',
        body: 'Revenue momentum and profitability:',
        bullets: [
          `Revenue (FY): ${formatINR(revenue)}`,
          `Profit margin: ${marginPct}%`,
          `Month-over-month revenue change: ${revenueChange >= 0 ? '+' : ''}${revenueChange}%`,
          `Forecast next month: ${formatINR(snap?.forecast.nextMonthRevenue ?? 0)} (${snap?.forecast.trend ?? 'flat'})`,
        ],
      },
      {
        heading: 'GST & Compliance',
        body: 'Tax position and filings:',
        bullets: [
          `GST liability: ${formatINR(gstLiability)}`,
          `Filed returns: ${snap?.filedReturns ?? 0}`,
          `Pending returns: ${snap?.pendingReturns ?? 0}`,
          `Overdue returns: ${snap?.overdueReturns ?? 0}`,
        ],
      },
      {
        heading: 'Collections & Cash',
        body: 'Receivables and cash position:',
        bullets: [
          `Collection rate: ${Math.round((snap?.collectionRate ?? 0) * 100)}%`,
          `Overdue receivables: ${formatINR(snap?.overdueReceivables ?? 0)} (${snap?.overdueInvoiceCount ?? 0} invoices)`,
          `Cash runway: ${snap && snap.runwayDays !== Infinity ? `${Math.round(snap.runwayDays)} days` : 'N/A'}`,
        ],
      },
      {
        heading: 'Risk & Concentration',
        body: 'Top risk exposures:',
        bullets: [
          `Risky customers: ${snap?.customerCount ?? 0} total customers`,
          `Top customer concentration: ${Math.round((snap?.topCustomerShare ?? 0) * 100)}%`,
          `Risk score: ${snap?.riskScore ?? 0}/100`,
        ],
      },
      {
        heading: 'Major Decisions This Week',
        body: '',
        bullets:
          weekDecisions.length > 0
            ? weekDecisions.map((d) => `${d.priority} · ${d.title} (${d.status})`)
            : ['No decisions logged this week'],
      },
      {
        heading: 'Completed Tasks',
        body: '',
        bullets: [`${completedTasks} task(s) completed this week`],
      },
      {
        heading: 'Pending Tasks',
        body: '',
        bullets:
          pendingTasks.length > 0
            ? pendingTasks.map((t) => `${t.priority.toUpperCase()} · ${t.title}`)
            : ['No pending tasks'],
      },
    ];

    const insights = buildInsights(snap);
    const recommendations = buildRecommendations(snap);
    const summary = `Week ${week}: Revenue ${formatINR(revenue)}, ${completedTasks} tasks completed, ${pendingTasks.length} pending, Health ${health}/100.`;
    const metrics: Record<string, number | string> = {
      revenue,
      profit,
      expenses,
      cash,
      gstLiability,
      healthScore: health,
      profitMargin: marginPct,
      revenueChangePct: revenueChange,
      completedTasks,
      pendingTasks: pendingTasks.length,
      decisionsThisWeek: weekDecisions.length,
    };

    const row = await db.oracleBrainReport.upsert({
      where: { firmId_type_period: { firmId, type: 'weekly', period } },
      create: {
        firmId,
        userId: userId ?? null,
        type: 'weekly',
        period,
        title,
        summary,
        content: JSON.stringify({ sections }),
        insights: JSON.stringify(insights),
        recommendations: JSON.stringify(recommendations),
        metrics: JSON.stringify(metrics),
        generatedBy: 'oracle',
      },
      update: {
        userId: userId ?? null,
        title,
        summary,
        content: JSON.stringify({ sections }),
        insights: JSON.stringify(insights),
        recommendations: JSON.stringify(recommendations),
        metrics: JSON.stringify(metrics),
        generatedBy: 'oracle',
      },
    });
    return mapRow(row as unknown as ReportRow);
  } catch (err) {
    throw new Error(
      `generateWeeklyReport failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ─── Monthly report ───────────────────────────────────────────────────────────

/** Generate (or replace) this month's monthly board report. */
export async function generateMonthlyReport(
  firmId: string,
  userId?: string,
  yearMonth?: string,
): Promise<BrainReport> {
  try {
    const now = new Date();
    const period = yearMonth ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthName = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const title = `Monthly Board Report — ${monthName}`;

    const [snap, monthDecisions, completedCount, pendingTasks] = await Promise.all([
      safeSnapshot(firmId),
      db.oracleBrainDecision.findMany({
        where: {
          firmId,
          createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { title: true, status: true, priority: true, confidence: true },
      }),
      db.oracleBrainTask.count({
        where: {
          firmId,
          status: 'completed',
          completedAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
        },
      }),
      db.oracleBrainTask.findMany({
        where: { firmId, status: { notIn: ['completed', 'cancelled'] } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { title: true, priority: true },
      }),
    ]);

    const revenue = snap?.revenue ?? 0;
    const profit = snap?.profit ?? 0;
    const expenses = snap?.expenses ?? 0;
    const cash = snap?.cash ?? 0;
    const marginPct = snap ? Math.round(snap.profitMargin * 100) : 0;
    const health = snap?.healthScore ?? 0;
    const runway = snap && snap.runwayDays !== Infinity ? Math.round(snap.runwayDays) : null;

    const sections: ReportSection[] = [
      {
        heading: 'Executive Summary',
        body: `${monthName}: Revenue ${formatINR(revenue)}, profit ${formatINR(profit)} (${marginPct}% margin). Business health is ${health}/100. ${completedCount} tasks completed, ${pendingTasks.length} pending.`,
      },
      {
        heading: 'Financial Performance',
        body: '',
        metrics: [
          { label: 'Revenue', value: formatINR(revenue), tone: 'positive' },
          { label: 'Profit', value: formatINR(profit), tone: profit > 0 ? 'positive' : 'negative' },
          { label: 'Profit Margin', value: `${marginPct}%`, tone: marginPct > 20 ? 'positive' : 'neutral' },
          { label: 'Expenses', value: formatINR(expenses), tone: 'neutral' },
          { label: 'Cash', value: formatINR(cash), tone: cash < 50000 ? 'warning' : 'positive' },
          { label: 'Runway', value: runway ? `${runway} days` : 'N/A', tone: runway && runway < 90 ? 'warning' : 'positive' },
        ],
      },
      {
        heading: 'GST & Compliance',
        body: '',
        bullets: [
          `Net GST liability: ${formatINR(snap?.gstLiability ?? 0)}`,
          `Filed returns: ${snap?.filedReturns ?? 0}`,
          `Pending returns: ${snap?.pendingReturns ?? 0}`,
          `Overdue returns: ${snap?.overdueReturns ?? 0}`,
          `Compliance risk score: ${snap?.riskScore ?? 0}/100`,
        ],
      },
      {
        heading: 'Collections',
        body: '',
        bullets: [
          `Collection rate: ${Math.round((snap?.collectionRate ?? 0) * 100)}%`,
          `Receivables outstanding: ${formatINR(snap?.receivables ?? 0)}`,
          `Overdue receivables: ${formatINR(snap?.overdueReceivables ?? 0)}`,
          `Avg days to pay: ${Math.round(snap?.avgDaysToPay ?? 0)}`,
        ],
      },
      {
        heading: 'Customer Health',
        body: '',
        bullets: [
          `Total customers: ${snap?.customerCount ?? 0}`,
          `Top customer concentration: ${Math.round((snap?.topCustomerShare ?? 0) * 100)}%`,
          `Working capital: ${formatINR(snap?.workingCapital ?? 0)}`,
        ],
      },
      {
        heading: 'Growth & Forecast',
        body: '',
        bullets: [
          `Revenue this month: ${formatINR(snap?.revenueThisMonth ?? 0)}`,
          `Revenue last month: ${formatINR(snap?.revenueLastMonth ?? 0)}`,
          `Forecast next month: ${formatINR(snap?.forecast.nextMonthRevenue ?? 0)} (${snap?.forecast.trend ?? 'flat'})`,
        ],
      },
      {
        heading: 'Risk Assessment',
        body: '',
        bullets: buildInsights(snap)
          .filter((i) => i.severity === 'critical' || i.severity === 'warn')
          .map((i) => `${i.severity.toUpperCase()} · ${i.headline}`),
      },
      {
        heading: 'Decisions Log',
        body: '',
        bullets:
          monthDecisions.length > 0
            ? monthDecisions.map((d) => `${d.priority} · ${d.title} (${d.status}, ${d.confidence}% conf.)`)
            : ['No decisions logged this month'],
      },
      {
        heading: 'Tasks Summary',
        body: '',
        bullets: [
          `${completedCount} completed this month`,
          `${pendingTasks.length} pending`,
          ...pendingTasks.slice(0, 3).map((t) => `→ ${t.priority.toUpperCase()} · ${t.title}`),
        ],
      },
      {
        heading: 'Strategic Recommendations',
        body: '',
        bullets: buildRecommendations(snap).map((r) => `${r.priority} · ${r.title} — ${r.reason}`),
      },
    ];

    const insights = buildInsights(snap);
    const recommendations = buildRecommendations(snap);
    const summary = `${monthName}: Revenue ${formatINR(revenue)}, Profit ${formatINR(profit)} (${marginPct}%), Health ${health}/100. ${completedCount} tasks completed.`;
    const metrics: Record<string, number | string> = {
      revenue,
      profit,
      expenses,
      cash,
      profitMargin: marginPct,
      healthScore: health,
      gstLiability: snap?.gstLiability ?? 0,
      collectionRate: snap ? Math.round(snap.collectionRate * 100) : 0,
      topCustomerShare: snap ? Math.round(snap.topCustomerShare * 100) : 0,
      completedTasks: completedCount,
      pendingTasks: pendingTasks.length,
      decisionsThisMonth: monthDecisions.length,
    };

    const row = await db.oracleBrainReport.upsert({
      where: { firmId_type_period: { firmId, type: 'monthly', period } },
      create: {
        firmId,
        userId: userId ?? null,
        type: 'monthly',
        period,
        title,
        summary,
        content: JSON.stringify({ sections }),
        insights: JSON.stringify(insights),
        recommendations: JSON.stringify(recommendations),
        metrics: JSON.stringify(metrics),
        generatedBy: 'oracle',
      },
      update: {
        userId: userId ?? null,
        title,
        summary,
        content: JSON.stringify({ sections }),
        insights: JSON.stringify(insights),
        recommendations: JSON.stringify(recommendations),
        metrics: JSON.stringify(metrics),
        generatedBy: 'oracle',
      },
    });
    return mapRow(row as unknown as ReportRow);
  } catch (err) {
    throw new Error(
      `generateMonthlyReport failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

/** Fetch a specific report by type + period. */
export async function getReport(
  firmId: string,
  type: ReportType,
  period: string,
): Promise<BrainReport | null> {
  try {
    const row = await db.oracleBrainReport.findUnique({
      where: { firmId_type_period: { firmId, type, period } },
    });
    return row ? mapRow(row as unknown as ReportRow) : null;
  } catch (err) {
    throw new Error(
      `getReport failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Most recent report of a given type. */
export async function getLatestReport(
  firmId: string,
  type: ReportType,
): Promise<BrainReport | null> {
  try {
    const row = await db.oracleBrainReport.findFirst({
      where: { firmId, type },
      orderBy: { createdAt: 'desc' },
    });
    return row ? mapRow(row as unknown as ReportRow) : null;
  } catch (err) {
    throw new Error(
      `getLatestReport failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** List reports. */
export async function listReports(opts: {
  firmId: string;
  type?: ReportType;
  limit?: number;
}): Promise<BrainReport[]> {
  try {
    const where: Record<string, unknown> = { firmId: opts.firmId };
    if (opts.type) where.type = opts.type;
    const rows = await db.oracleBrainReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: opts.limit ?? 20,
    });
    return rows.map((r) => mapRow(r as unknown as ReportRow));
  } catch (err) {
    throw new Error(
      `listReports failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Get today's daily report, generating it if missing. */
export async function getOrCreateDailyReport(
  firmId: string,
  userId?: string,
): Promise<BrainReport> {
  const period = new Date().toISOString().slice(0, 10);
  const existing = await getReport(firmId, 'daily', period);
  if (existing) return existing;
  return generateDailyReport(firmId, userId);
}
