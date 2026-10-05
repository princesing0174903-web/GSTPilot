// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI CFO™ — Module 11: Smart CFO Insights (Phase 3)
//
// Surfaces the most important CFO takeaways from the live engine:
//   • topRisks         — highest-severity risks + critical analysis conditions
//   • topOpportunities — ITC, growth, and collection-improvement signals
//   • urgentActions    — daily brief priority actions, in SmartInsight form
//   • summaries        — weekly / monthly / quarterly / yearly PeriodSummary
//
// Pure server-side library imported by API routes. No 'use server'.
// Deterministic & transparent — every insight links back to a numeric metric.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { generateCFOInsights } from './engine';
import { buildFinancialAnalysis } from './analysis';
import type {
  CFOResponse,
  FinancialCondition,
  PeriodSummary,
  PriorityAction,
  RiskAssessment,
  SmartCFOInsights,
  SmartInsight,
  SummaryPeriod,
} from './types';

// ─── Time helpers ─────────────────────────────────────────────────────────────

function now(): Date {
  return new Date();
}

function startOfToday(d = now()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfMonth(d = now()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function periodLabelFor(period: SummaryPeriod, anchor = now()): string {
  switch (period) {
    case 'weekly':
      return `Last 7 days (${startOfToday(addDays(anchor, -7)).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      })} – ${anchor.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`;
    case 'monthly':
      return `This month so far (${anchor.toLocaleString('en-IN', {
        month: 'long',
        year: 'numeric',
      })})`;
    case 'quarterly':
      return `Last 90 days (${addDays(anchor, -90).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      })} – ${anchor.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`;
    case 'yearly':
      return `Last 365 days / YTD (${anchor.getFullYear()})`;
  }
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function inrFmt(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(
    Math.round(n),
  );
}

function pctFmt(n: number): string {
  return `${n.toFixed(1)}%`;
}

// ─── Row shapes (subset of Prisma models used for period aggregation) ─────────

interface InvoiceRowLite {
  invoiceDate: string;
  totalAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  status?: string;
  buyerGstin?: string | null;
}

interface ExpenseRowLite {
  date: string;
  amount: number;
}

// ─── Period aggregation ───────────────────────────────────────────────────────

interface PeriodAgg {
  revenue: number;
  expenses: number;
  profit: number;
  invoiceCount: number;
  expenseCount: number;
}

function aggregatePeriod(
  invoices: InvoiceRowLite[],
  expenses: ExpenseRowLite[],
  from: Date,
  to: Date,
): PeriodAgg {
  const periodInvoices = invoices.filter((i) => {
    const d = new Date(i.invoiceDate);
    return d >= from && d < to;
  });
  const periodExpenses = expenses.filter((e) => {
    const d = new Date(e.date);
    return d >= from && d < to;
  });
  const revenue = periodInvoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const expensesTotal = periodExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  return {
    revenue,
    expenses: expensesTotal,
    profit: revenue - expensesTotal,
    invoiceCount: periodInvoices.length,
    expenseCount: periodExpenses.length,
  };
}

// ─── Mapping helpers ──────────────────────────────────────────────────────────

function riskLevelToPriority(
  level: RiskAssessment['level'],
): SmartInsight['priority'] {
  if (level === 'high') return 'critical';
  if (level === 'medium') return 'high';
  return 'low';
}

function conditionSeverityToPriority(
  severity: FinancialCondition['severity'],
): SmartInsight['priority'] {
  if (severity === 'critical') return 'critical';
  if (severity === 'warning') return 'high';
  if (severity === 'opportunity') return 'medium';
  return 'low';
}

function urgencyToPriority(
  u: PriorityAction['urgency'],
): SmartInsight['priority'] {
  if (u === 'critical') return 'critical';
  if (u === 'high') return 'high';
  if (u === 'medium') return 'medium';
  return 'low';
}

/** Map a PriorityAction.actionType to a navigable AppView. */
function actionTypeToView(actionType: PriorityAction['actionType']): string {
  switch (actionType) {
    case 'recover':
      return 'reconcile'; // collection recovery — reconciliation workspace
    case 'file':
      return 'returns'; // file overdue / upcoming returns
    case 'respond':
      return 'notices'; // respond to GST notices
    case 'claim':
      return 'reconcile'; // claim ITC — reconciliation
    case 'pay':
      return 'payments'; // schedule vendor payments
    case 'review':
    default:
      return 'ai-cfo';
  }
}

function actionTypeToLabel(actionType: PriorityAction['actionType']): string {
  switch (actionType) {
    case 'recover':
      return 'Recover Collections';
    case 'file':
      return 'Open Returns';
    case 'respond':
      return 'Open Notices';
    case 'claim':
      return 'Claim ITC';
    case 'pay':
      return 'Schedule Payments';
    case 'review':
      return 'Review in CFO';
    default:
      return 'Take Action';
  }
}

// ─── Top risks ────────────────────────────────────────────────────────────────

function buildTopRisks(
  risks: RiskAssessment[],
  conditions: FinancialCondition[],
): SmartInsight[] {
  const out: SmartInsight[] = [];

  // 1. Engine risks — high & medium severity, sorted by score desc
  const rankedRisks = [...risks]
    .filter((r) => r.level !== 'low')
    .sort((a, b) => b.score - a.score);
  for (const r of rankedRisks.slice(0, 4)) {
    out.push({
      id: `risk-${r.category}`,
      category: 'risk',
      title: `${r.category.charAt(0).toUpperCase() + r.category.slice(1)} Risk`,
      detail:
        r.reasons.length > 0
          ? `${r.reasons[0]}${r.recommendation ? ' ' + r.recommendation : ''}`
          : r.recommendation || 'Risk identified by the Business Risk Engine.',
      priority: riskLevelToPriority(r.level),
      metric: { label: 'Risk score', value: `${r.score}/100` },
      actionLabel: 'Review in CFO',
      actionView: 'ai-cfo',
    });
  }

  // 2. Critical & warning analysis conditions (only detected ones)
  const detectedRiskConditions = conditions
    .filter(
      (c) =>
        c.detected && (c.severity === 'critical' || c.severity === 'warning'),
    )
    .sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2, opportunity: 3 };
      return order[a.severity] - order[b.severity];
    });
  for (const c of detectedRiskConditions.slice(0, 4)) {
    out.push({
      id: `analysis-${c.type}`,
      category: 'risk',
      title: c.title,
      detail: c.description,
      priority: conditionSeverityToPriority(c.severity),
      metric: c.metric ? { label: c.metric.label, value: c.metric.value } : undefined,
      actionLabel: 'Review in CFO',
      actionView: 'ai-cfo',
    });
  }

  // Sort final list by priority (critical first) and cap at 6
  const order: Record<SmartInsight['priority'], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return out.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 6);
}

// ─── Top opportunities ────────────────────────────────────────────────────────

function buildTopOpportunities(cfo: CFOResponse): SmartInsight[] {
  const out: SmartInsight[] = [];
  const { dashboard, predictions } = cfo;

  // 1. ITC opportunity
  if (dashboard.gst.itcAvailable > 0) {
    out.push({
      id: 'opp-itc',
      category: 'opportunity',
      title: 'Claim Input Tax Credit',
      detail: `₹${inrFmt(
        dashboard.gst.itcAvailable,
      )} ITC is sitting unused. Offset against upcoming GST liability in the next GSTR-3B filing to improve cash flow.`,
      priority: 'high',
      metric: { label: 'ITC available', value: `₹${inrFmt(dashboard.gst.itcAvailable)}` },
      actionLabel: 'Reconcile ITC',
      actionView: 'reconcile',
    });
  }

  // 2. Growth signal — positive revenue trajectory
  if (dashboard.revenue.growthPct > 5) {
    out.push({
      id: 'opp-growth',
      category: 'opportunity',
      title: 'Capitalise on Revenue Growth',
      detail: `Revenue is up ${pctFmt(
        dashboard.revenue.growthPct,
      )} month-over-month. Scale capacity (hire / automate) to capture additional demand without losing service quality.`,
      priority: 'medium',
      metric: { label: 'MoM growth', value: pctFmt(dashboard.revenue.growthPct) },
      actionLabel: 'Open CFO',
      actionView: 'ai-cfo',
    });
  } else if (predictions.revenue.thirtyDay > dashboard.revenue.thisMonth) {
    out.push({
      id: 'opp-pipeline',
      category: 'opportunity',
      title: 'Strong Revenue Pipeline',
      detail: `Next-30-day revenue forecast is ₹${inrFmt(
        predictions.revenue.thirtyDay,
      )} — exceeding current-month actuals. Confirm pipeline commitments to lock in the upside.`,
      priority: 'medium',
      metric: { label: '30-day forecast', value: `₹${inrFmt(predictions.revenue.thirtyDay)}` },
      actionLabel: 'Open CFO',
      actionView: 'ai-cfo',
    });
  }

  // 3. Collection improvement potential
  if (dashboard.receivables.pendingCollections > 0) {
    const efficiency = dashboard.receivables.collectionEfficiencyPct;
    const lift = Math.max(100 - efficiency, 0);
    const potential = Math.round(
      (dashboard.receivables.pendingCollections * Math.min(lift, 30)) / 100,
    );
    out.push({
      id: 'opp-collection',
      category: 'opportunity',
      title: 'Improve Collection Efficiency',
      detail: `₹${inrFmt(
        dashboard.receivables.pendingCollections,
      )} is pending collection. Tightening reminder cadence could release up to ₹${inrFmt(
        potential,
      )} in working capital.`,
      priority: efficiency < 80 ? 'high' : 'medium',
      metric: { label: 'Pending', value: `₹${inrFmt(dashboard.receivables.pendingCollections)}` },
      actionLabel: 'Recover Collections',
      actionView: 'reconcile',
    });
  }

  // 4. Refund potential (GST)
  if (predictions.gst.refundPrediction > 0) {
    out.push({
      id: 'opp-refund',
      category: 'opportunity',
      title: 'Pursue GST Refund',
      detail: `Estimated refund of ₹${inrFmt(
        predictions.gst.refundPrediction,
      )} available if ITC exceeds output liability. File refund application after GSTR-3B reconciliation.`,
      priority: 'low',
      metric: { label: 'Est. refund', value: `₹${inrFmt(predictions.gst.refundPrediction)}` },
      actionLabel: 'Open Returns',
      actionView: 'returns',
    });
  }

  const order: Record<SmartInsight['priority'], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return out.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 5);
}

// ─── Urgent actions (from Daily Brief priority actions) ───────────────────────

function buildUrgentActions(actions: PriorityAction[]): SmartInsight[] {
  const out: SmartInsight[] = actions.map((a) => ({
    id: `action-${a.id}`,
    category: 'action',
    title: a.title,
    detail: a.detail,
    priority: urgencyToPriority(a.urgency),
    metric: a.amount ? { label: 'Amount', value: `₹${inrFmt(a.amount)}` } : undefined,
    actionLabel: actionTypeToLabel(a.actionType),
    actionView: actionTypeToView(a.actionType),
  }));
  // Brief already returns ≤6 priority actions sorted by urgency; cap to 6
  return out.slice(0, 6);
}

// ─── Period summaries ─────────────────────────────────────────────────────────

function buildPeriodSummaries(
  invoices: InvoiceRowLite[],
  expenses: ExpenseRowLite[],
  cfo: CFOResponse,
): PeriodSummary[] {
  const today = now();
  const todayStart = startOfToday(today);
  const summaries: PeriodSummary[] = [];

  // ── Weekly: last 7 days ────────────────────────────────────────────────────
  {
    const from = addDays(todayStart, -7);
    const to = addDays(todayStart, 1);
    const agg = aggregatePeriod(invoices, expenses, from, to);
    const highlights: string[] = [];
    const concerns: string[] = [];
    if (agg.revenue > 0) highlights.push(`₹${inrFmt(agg.revenue)} collected in the last 7 days`);
    if (agg.profit > 0) highlights.push(`Net profit of ₹${inrFmt(agg.profit)} this week`);
    if (agg.invoiceCount > 0) highlights.push(`${agg.invoiceCount} invoices issued`);
    if (agg.revenue === 0) concerns.push('No revenue recorded in the last 7 days');
    if (agg.expenses > agg.revenue && agg.revenue > 0)
      concerns.push(`Weekly expenses (₹${inrFmt(agg.expenses)}) exceeded revenue`);
    if (cfo.dashboard.receivables.overdueCount > 0)
      concerns.push(`${cfo.dashboard.receivables.overdueCount} overdue invoice(s) still open`);
    const outlook =
      agg.profit > 0
        ? `Maintain the weekly cadence — projected monthly revenue at this pace is ₹${inrFmt(
            agg.revenue * 4,
          )}.`
        : `Focus on converting pending receivables to restore weekly profitability.`;
    summaries.push({
      period: 'weekly',
      label: periodLabelFor('weekly', today),
      headline:
        agg.revenue > 0
          ? `Weekly revenue: ₹${inrFmt(agg.revenue)} · Profit: ₹${inrFmt(agg.profit)}`
          : `No revenue recorded this week`,
      revenue: agg.revenue,
      expenses: agg.expenses,
      profit: agg.profit,
      highlights: highlights.slice(0, 3),
      concerns: concerns.slice(0, 3),
      outlook,
    });
  }

  // ── Monthly: this month so far ─────────────────────────────────────────────
  {
    const from = startOfMonth(today);
    const to = addDays(todayStart, 1);
    const agg = aggregatePeriod(invoices, expenses, from, to);
    const growth = cfo.dashboard.revenue.growthPct;
    const highlights: string[] = [];
    const concerns: string[] = [];
    if (agg.revenue > 0) highlights.push(`₹${inrFmt(agg.revenue)} revenue booked this month`);
    if (growth > 0) highlights.push(`Revenue up ${pctFmt(growth)} vs last month`);
    if (cfo.dashboard.gst.itcAvailable > 0)
      highlights.push(`₹${inrFmt(cfo.dashboard.gst.itcAvailable)} ITC available to claim`);
    if (growth < 0) concerns.push(`Revenue down ${pctFmt(Math.abs(growth))} vs last month`);
    if (cfo.dashboard.cash.runwayDays > 0 && cfo.dashboard.cash.runwayDays < 30)
      concerns.push(`Cash runway tight at ${cfo.dashboard.cash.runwayDays} days`);
    if (cfo.dashboard.receivables.overdueCount > 0)
      concerns.push(`${cfo.dashboard.receivables.overdueCount} overdue invoice(s)`);
    const outlook =
      growth >= 0
        ? `Sustain the pace — file GSTR-3B on time and claim eligible ITC to lock in margins.`
        : `Activate client outreach and pricing review to reverse the revenue decline.`;
    summaries.push({
      period: 'monthly',
      label: periodLabelFor('monthly', today),
      headline:
        agg.revenue > 0
          ? `MTD revenue: ₹${inrFmt(agg.revenue)} · Margin: ${pctFmt(
              cfo.dashboard.profit.marginPct,
            )}`
          : `No revenue recorded this month yet`,
      revenue: agg.revenue,
      expenses: agg.expenses,
      profit: agg.profit,
      highlights: highlights.slice(0, 3),
      concerns: concerns.slice(0, 3),
      outlook,
    });
  }

  // ── Quarterly: last 90 days ────────────────────────────────────────────────
  {
    const from = addDays(todayStart, -90);
    const to = addDays(todayStart, 1);
    const agg = aggregatePeriod(invoices, expenses, from, to);
    const highlights: string[] = [];
    const concerns: string[] = [];
    if (agg.revenue > 0) highlights.push(`₹${inrFmt(agg.revenue)} revenue in the trailing quarter`);
    if (agg.profit > 0) highlights.push(`Net profit of ₹${inrFmt(agg.profit)} over 90 days`);
    if (cfo.dashboard.healthScore.overall >= 60)
      highlights.push(`Business health score at ${cfo.dashboard.healthScore.overall}/100`);
    if (agg.expenses > agg.revenue && agg.revenue > 0)
      concerns.push(`Quarterly expenses exceeded revenue by ₹${inrFmt(agg.expenses - agg.revenue)}`);
    if (cfo.dashboard.healthScore.overall < 50)
      concerns.push(`Health score ${cfo.dashboard.healthScore.overall}/100 — below healthy threshold`);
    if (cfo.brief.priorityActions.length > 3)
      concerns.push(`${cfo.brief.priorityActions.length} priority actions open`);
    const outlook =
      agg.profit > 0
        ? `Quarterly trajectory is positive — invest in capacity to sustain momentum.`
        : `Quarter needs course correction — recover receivables and trim discretionary spend.`;
    summaries.push({
      period: 'quarterly',
      label: periodLabelFor('quarterly', today),
      headline:
        agg.revenue > 0
          ? `90-day revenue: ₹${inrFmt(agg.revenue)} · Profit: ₹${inrFmt(agg.profit)}`
          : `No revenue recorded in the trailing 90 days`,
      revenue: agg.revenue,
      expenses: agg.expenses,
      profit: agg.profit,
      highlights: highlights.slice(0, 3),
      concerns: concerns.slice(0, 3),
      outlook,
    });
  }

  // ── Yearly: last 365 days / YTD ────────────────────────────────────────────
  {
    const from = addDays(todayStart, -365);
    const to = addDays(todayStart, 1);
    const agg = aggregatePeriod(invoices, expenses, from, to);
    const highlights: string[] = [];
    const concerns: string[] = [];
    if (agg.revenue > 0) highlights.push(`₹${inrFmt(agg.revenue)} revenue in the trailing 12 months`);
    if (agg.invoiceCount > 0)
      highlights.push(`${agg.invoiceCount} invoices processed in the last year`);
    if (cfo.memory.revenueTrends.some((t) => t.trend === 'up'))
      highlights.push(`Year shows positive revenue trend months`);
    if (agg.expenses > agg.revenue && agg.revenue > 0)
      concerns.push(`Annual expenses exceeded revenue — unsustainable`);
    if (cfo.memory.cashPatterns.some((q) => q.shortageRisk === 'high'))
      concerns.push(`Cash shortage risk flagged in at least one quarter`);
    if (cfo.memory.filingHistory.some((f) => f.overdue > 0))
      concerns.push(`Overdue returns in at least one month — review filing discipline`);
    const outlook =
      agg.profit > 0
        ? `Year is profitable — reinvest in growth, automation, and team capacity.`
        : `Year needs decisive action — restore profitability before extending runway burn.`;
    summaries.push({
      period: 'yearly',
      label: periodLabelFor('yearly', today),
      headline:
        agg.revenue > 0
          ? `12-month revenue: ₹${inrFmt(agg.revenue)} · Profit: ₹${inrFmt(agg.profit)}`
          : `No revenue recorded in the trailing 12 months`,
      revenue: agg.revenue,
      expenses: agg.expenses,
      profit: agg.profit,
      highlights: highlights.slice(0, 3),
      concerns: concerns.slice(0, 3),
      outlook,
    });
  }

  return summaries;
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * Build Smart CFO Insights — the executive takeaways from the engine + analysis.
 *
 * Calls generateCFOInsights() and buildFinancialAnalysis() in parallel, then
 * maps their outputs into SmartInsight / PeriodSummary objects.
 *
 * Empty data → valid empty arrays. Never throws.
 */
export async function buildSmartInsights(): Promise<SmartCFOInsights> {
  try {
    // Run both engines in parallel — they hit disjoint Prisma queries.
    const [cfo, analysis] = await Promise.all([
      generateCFOInsights(),
      buildFinancialAnalysis(),
    ]);

    // Fetch lightweight invoice + expense rows for period aggregation.
    // The engine's dashboard only exposes thisMonth/lastMonth — for weekly,
    // quarterly and yearly summaries we need direct range queries.
    const [invoicesRaw, expensesRaw] = await Promise.all([
      db.invoice.findMany({
        select: {
          invoiceDate: true,
          totalAmount: true,
          cgst: true,
          sgst: true,
          igst: true,
          cess: true,
          status: true,
          buyerGstin: true,
        },
        take: 8000,
      }) as Promise<InvoiceRowLite[]>,
      db.expense.findMany({
        select: { date: true, amount: true },
        take: 8000,
      }) as Promise<ExpenseRowLite[]>,
    ]);

    const topRisks = buildTopRisks(cfo.risks, analysis.conditions);
    const topOpportunities = buildTopOpportunities(cfo);
    const urgentActions = buildUrgentActions(cfo.brief.priorityActions);
    const summaries = buildPeriodSummaries(invoicesRaw, expensesRaw, cfo);

    return { topRisks, topOpportunities, urgentActions, summaries };
  } catch (err) {
    // Fail-safe: never throw — return empty-but-valid structures so the API
    // route can still respond 200 with a sensible empty payload.
    // Log so "no insights exist" stays distinguishable from "the insights
    // builder threw" — the latter usually means a DB query is unreachable.
    console.warn(
      '[cfo/insights] generateSmartCFOInsights failed — returning empty:',
      err instanceof Error ? err.message : err,
    );
    return {
      topRisks: [],
      topOpportunities: [],
      urgentActions: [],
      summaries: [],
    };
  }
}

// Re-export types for convenience
export type {
  SmartCFOInsights,
  SmartInsight,
  PeriodSummary,
  SummaryPeriod,
} from './types';
