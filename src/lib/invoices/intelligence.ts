// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Invoice Engine™ — Module 10: Revenue Intelligence™
// Pipeline: Invoices → Payments → Expenses → Receivables → Forecast → Profitability
// Deterministic forecast engine. Reads Prisma. No LLM. Persists RevenueForecast.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import {
  type IntelligenceResult,
  type ForecastPoint,
  type ForecastHorizon,
  type RevenuePipelineStage,
  type CashPositionSnapshot,
  type InvoiceListResult,
  type ExpenseListResult,
  type ReceivablesListResult,
  type PayablesListResult,
  type PaymentListResult,
  type PayrollListResult,
  type AnalyticsResult,
  currentMonth,
  lastMonth,
  monthLabel,
  isoToday,
  isoDaysFromNow,
  inrShort,
} from './types';

// ─── Last N months ─────────────────────────────────────────────────────────────

function lastNMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const dd = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(dd.toISOString().slice(0, 7));
  }
  return out;
}

// ─── NaN guard ─────────────────────────────────────────────────────────────────

function safeNum(n: number, fallback = 0): number {
  return !isFinite(n) || isNaN(n) ? fallback : Math.round(n * 100) / 100;
}

// ─── Moving average forecast ───────────────────────────────────────────────────

function movingAverage(values: number[], periods: number): number {
  if (values.length === 0) return 0;
  const slice = values.slice(-periods);
  return slice.reduce((s, v) => s + v, 0) / slice.length;
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

// ─── Compute revenue pipeline ──────────────────────────────────────────────────

async function computePipeline(deps: {
  invoices?: InvoiceListResult;
  payments?: PaymentListResult;
  expenses?: ExpenseListResult;
  receivables?: ReceivablesListResult;
}): Promise<RevenuePipelineStage[]> {
  const thisMonth = currentMonth();
  const lastMonthStr = lastMonth();

  // ── Stage 1: Invoices (revenue raised) ──
  const invThis = deps.invoices?.invoices.filter((i) => i.invoiceDate.slice(0, 7) === thisMonth)
    .reduce((s, i) => s + i.total, 0) ?? 0;
  const invLast = deps.invoices?.invoices.filter((i) => i.invoiceDate.slice(0, 7) === lastMonthStr)
    .reduce((s, i) => s + i.total, 0) ?? 0;

  // ── Stage 2: Payments collected ──
  const payThis = deps.payments?.payments
    .filter((p) => p.direction === 'incoming' && p.paidAt.slice(0, 7) === thisMonth)
    .reduce((s, p) => s + p.amount, 0) ?? 0;
  const payLast = deps.payments?.payments
    .filter((p) => p.direction === 'incoming' && p.paidAt.slice(0, 7) === lastMonthStr)
    .reduce((s, p) => s + p.amount, 0) ?? 0;

  // ── Stage 3: Expenses ──
  const expThis = deps.expenses?.expenses.filter((e) => e.date.slice(0, 7) === thisMonth)
    .reduce((s, e) => s + e.amount, 0) ?? 0;
  const expLast = deps.expenses?.expenses.filter((e) => e.date.slice(0, 7) === lastMonthStr)
    .reduce((s, e) => s + e.amount, 0) ?? 0;

  // ── Stage 4: Receivables outstanding ──
  const recTotal = deps.receivables?.totalOutstanding ?? 0;
  const recCount = deps.receivables?.total ?? 0;

  // ── Stage 5: Forecast (computed below, placeholder delta) ──
  const forecastAmount = deps.receivables?.totalExpected ?? 0;

  // ── Stage 6: Profitability ──
  const profit = invThis - expThis;
  const profitLast = invLast - expLast;

  return [
    { stage: 'invoices', label: 'Invoices Raised', amount: Math.round(invThis * 100) / 100, count: deps.invoices?.invoices.filter((i) => i.invoiceDate.slice(0, 7) === thisMonth).length ?? 0, deltaPct: pctChange(invThis, invLast) },
    { stage: 'payments', label: 'Payments Collected', amount: Math.round(payThis * 100) / 100, count: deps.payments?.payments.filter((p) => p.direction === 'incoming' && p.paidAt.slice(0, 7) === thisMonth).length ?? 0, deltaPct: pctChange(payThis, payLast) },
    { stage: 'expenses', label: 'Expenses', amount: Math.round(expThis * 100) / 100, count: deps.expenses?.expenses.filter((e) => e.date.slice(0, 7) === thisMonth).length ?? 0, deltaPct: pctChange(expThis, expLast) },
    { stage: 'receivables', label: 'Receivables Outstanding', amount: Math.round(recTotal * 100) / 100, count: recCount, deltaPct: 0 },
    { stage: 'forecast', label: 'Forecast Collection', amount: Math.round(forecastAmount * 100) / 100, count: recCount, deltaPct: 0 },
    { stage: 'profitability', label: 'Net Profit', amount: Math.round(profit * 100) / 100, count: 0, deltaPct: pctChange(profit, profitLast) },
  ];
}

// ─── Compute MRR (from recurring invoices) ─────────────────────────────────────

async function computeMRR(): Promise<{ mrr: number; arr: number; trendPct: number }> {
  // Recurring invoices: those with notes containing 'recurring' or sent on a monthly cadence.
  // Deterministic approximation: sum of invoices in the current month divided by avg invoice count,
  // plus explicit recurring-flagged expenses inverted. Here we use a simpler deterministic proxy:
  // MRR = average monthly revenue over last 3 months.
  const months = lastNMonths(3);
  const monthlyTotals: number[] = [];
  for (const m of months) {
    const total = await db.invoice.aggregate({
      where: { invoiceDate: { startsWith: m } },
      _sum: { totalAmount: true },
    });
    monthlyTotals.push(total._sum.totalAmount ?? 0);
  }
  const mrr = Math.round(movingAverage(monthlyTotals, 3) * 100) / 100;
  const arr = Math.round(mrr * 12 * 100) / 100;
  const trendPct = monthlyTotals.length >= 2
    ? pctChange(monthlyTotals[monthlyTotals.length - 1], monthlyTotals[0])
    : 0;
  return { mrr, arr, trendPct };
}

// ─── Compute cash position ─────────────────────────────────────────────────────

async function computeCashPosition(deps: {
  payments?: PaymentListResult;
  expenses?: ExpenseListResult;
  payroll?: PayrollListResult;
}): Promise<CashPositionSnapshot> {
  const thirtyDaysAgo = isoDaysFromNow(-30);

  const inflow30d = deps.payments?.payments
    .filter((p) => p.direction === 'incoming' && p.paidAt.slice(0, 10) >= thirtyDaysAgo)
    .reduce((s, p) => s + p.amount, 0) ?? 0;

  const outflow30d = deps.payments?.payments
    .filter((p) => p.direction === 'outgoing' && p.paidAt.slice(0, 10) >= thirtyDaysAgo)
    .reduce((s, p) => s + p.amount, 0)
    ?? (deps.expenses?.expenses.filter((e) => e.date >= thirtyDaysAgo).reduce((s, e) => s + e.amount, 0) ?? 0)
    + (deps.payroll?.currentMonthPayroll.totalNet ?? 0);

  // Cash in hand = all-time net (deterministic proxy)
  const totalInflow = deps.payments?.totalIncoming ?? inflow30d;
  const totalOutflow = deps.payments?.totalOutgoing ?? outflow30d;
  const cashInHand = safeNum(totalInflow - totalOutflow);

  const burnRate = safeNum(outflow30d); // monthly burn proxy
  const runwayMonths = burnRate > 0 ? Math.round((cashInHand / burnRate) * 10) / 10 : 0;

  return {
    cashInHand,
    cashInflow30d: safeNum(inflow30d),
    cashOutflow30d: safeNum(outflow30d),
    netCashFlow30d: safeNum(inflow30d - outflow30d),
    runwayMonths: safeNum(runwayMonths),
    burnRate,
  };
}

// ─── Compute forecast for a horizon ────────────────────────────────────────────

async function computeForecast(
  horizon: ForecastHorizon,
  deps: {
    invoices?: InvoiceListResult;
    expenses?: ExpenseListResult;
    receivables?: ReceivablesListResult;
    payables?: PayablesListResult;
    payroll?: PayrollListResult;
  },
): Promise<ForecastPoint> {
  // Historical monthly revenue (last 6 months) for trend
  const months = lastNMonths(6);
  const monthlyRevenue: number[] = [];
  for (const m of months) {
    const r = deps.invoices?.invoices.filter((i) => i.invoiceDate.slice(0, 7) === m).reduce((s, i) => s + i.total, 0)
      ?? 0;
    monthlyRevenue.push(r);
  }

  const monthlyExpenses: number[] = [];
  for (const m of months) {
    const e = deps.expenses?.expenses.filter((e) => e.date.slice(0, 7) === m).reduce((s, e) => s + e.amount, 0)
      ?? 0;
    monthlyExpenses.push(e);
  }

  const avgRevenue = movingAverage(monthlyRevenue, 3);
  const avgExpenses = movingAverage(monthlyExpenses, 3);
  const payrollCost = deps.payroll?.currentMonthPayroll.totalCost ?? 0;

  // Horizon scaling
  const horizonConfig: Record<ForecastHorizon, { label: string; revenueFactor: number; expenseFactor: number; confidence: number }> = {
    next_week: { label: 'Next 7 Days', revenueFactor: 0.25, expenseFactor: 0.25, confidence: 0.92 },
    next_month: { label: 'Next Month', revenueFactor: 1.0, expenseFactor: 1.0, confidence: 0.85 },
    next_quarter: { label: 'Next Quarter', revenueFactor: 3.0, expenseFactor: 3.0, confidence: 0.72 },
  };
  const cfg = horizonConfig[horizon];

  // Expected revenue = trend-adjusted average
  const trendPct = monthlyRevenue.length >= 2 ? pctChange(monthlyRevenue[monthlyRevenue.length - 1], monthlyRevenue[0]) : 0;
  const trendMultiplier = 1 + (trendPct / 100) * 0.3; // damp the trend
  const expectedRevenue = safeNum(avgRevenue * cfg.revenueFactor * trendMultiplier);

  // Expected collections = receivables due in horizon + collection probability
  const horizonDays = horizon === 'next_week' ? 7 : horizon === 'next_month' ? 30 : 90;
  const collectedInHorizon = deps.receivables?.receivables
    .filter((r) => {
      if (!r.dueDate) return false;
      const daysToDue = Math.ceil((new Date(r.dueDate).getTime() - Date.now()) / 86_400_000);
      return daysToDue >= -30 && daysToDue <= horizonDays;
    })
    .reduce((s, r) => s + (r.expectedAmount || 0), 0) ?? 0;
  const expectedCollections = safeNum(
    collectedInHorizon > 0
      ? collectedInHorizon
      : (deps.receivables?.totalExpected ?? 0) * (horizonDays / 90),
  );

  // Expected expenses
  const expectedExpenses = safeNum(avgExpenses * cfg.expenseFactor);
  const expectedPayroll = safeNum(payrollCost * cfg.expenseFactor);
  const expectedPayables = safeNum((deps.payables?.totalDue ?? 0) * (horizonDays / 90));

  // Profitability
  const projectedProfit = safeNum(expectedRevenue - expectedExpenses - expectedPayroll);
  const projectedMarginPct = expectedRevenue > 0 ? Math.round((projectedProfit / expectedRevenue) * 100) : 0;

  // Cash position
  const projectedCashInflow = expectedCollections;
  const projectedCashOutflow = safeNum(expectedExpenses + expectedPayroll + expectedPayables);
  const netCashPosition = safeNum(projectedCashInflow - projectedCashOutflow);

  // Drivers (deterministic human-readable factors)
  const drivers: string[] = [];
  drivers.push(`${months.length}-month revenue trend: ${trendPct >= 0 ? '+' : ''}${trendPct}%`);
  if (deps.receivables && deps.receivables.overdueCount > 0) {
    drivers.push(`${deps.receivables.overdueCount} overdue invoices (${inrShort(deps.receivables.overdueAmount)}) affecting collections`);
  }
  if (deps.payables && deps.payables.totalDue > 0) {
    drivers.push(`${inrShort(deps.payables.totalDue)} payables due in next 90 days`);
  }
  if (payrollCost > 0) {
    drivers.push(`Payroll commitment of ${inrShort(payrollCost)}/month`);
  }
  drivers.push(`Collection efficiency at ${deps.receivables?.collectionEfficiencyPct ?? 0}%`);

  const targetMonth = horizon === 'next_week' ? isoToday().slice(0, 7)
    : horizon === 'next_month' ? (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 7); })()
    : (() => { const d = new Date(); d.setMonth(d.getMonth() + 3); return d.toISOString().slice(0, 7); })();

  return {
    horizon,
    horizonLabel: cfg.label,
    targetMonth,
    expectedRevenue,
    expectedCollections,
    expectedExpenses,
    expectedPayroll,
    expectedPayables,
    projectedProfit,
    projectedMarginPct,
    projectedCashInflow,
    projectedCashOutflow,
    netCashPosition,
    confidence: cfg.confidence,
    drivers,
  };
}

// ─── Persist forecast to DB ────────────────────────────────────────────────────

async function persistForecast(fp: ForecastPoint, mrr: number): Promise<void> {
  try {
    await db.revenueForecast.create({
      data: {
        horizon: fp.horizon,
        forecastDate: isoToday(),
        targetMonth: fp.targetMonth,
        expectedRevenue: fp.expectedRevenue,
        confidence: fp.confidence,
        expectedCollections: fp.expectedCollections,
        collectionSource: 'blended',
        expectedExpenses: fp.expectedExpenses,
        expectedPayroll: fp.expectedPayroll,
        expectedPayables: fp.expectedPayables,
        projectedProfit: fp.projectedProfit,
        projectedMarginPct: fp.projectedMarginPct,
        projectedCashInflow: fp.projectedCashInflow,
        projectedCashOutflow: fp.projectedCashOutflow,
        netCashPosition: fp.netCashPosition,
        drivers: JSON.stringify(fp.drivers),
        mrr,
        arr: mrr * 12,
      },
    });
  } catch {
    // non-fatal — forecast is returned regardless
  }
}

// ─── Main: compute full Revenue Intelligence ───────────────────────────────────

export async function getIntelligence(deps?: {
  invoices?: InvoiceListResult;
  expenses?: ExpenseListResult;
  receivables?: ReceivablesListResult;
  payables?: PayablesListResult;
  payments?: PaymentListResult;
  payroll?: PayrollListResult;
  analytics?: AnalyticsResult;
}): Promise<IntelligenceResult> {
  const pipeline = await computePipeline({
    invoices: deps?.invoices,
    payments: deps?.payments,
    expenses: deps?.expenses,
    receivables: deps?.receivables,
  });

  const { mrr, arr, trendPct: mrrTrendPct } = await computeMRR();

  const cashPosition = await computeCashPosition({
    payments: deps?.payments,
    expenses: deps?.expenses,
    payroll: deps?.payroll,
  });

  // Collections next 7 / 30 days (from receivables due dates)
  const collectionsNext7Days = deps?.receivables?.receivables
    .filter((r) => {
      if (!r.dueDate) return false;
      const days = Math.ceil((new Date(r.dueDate).getTime() - Date.now()) / 86_400_000);
      return days >= -7 && days <= 7;
    })
    .reduce((s, r) => s + r.expectedAmount, 0) ?? 0;

  const collectionsNext30Days = deps?.receivables?.receivables
    .filter((r) => {
      if (!r.dueDate) return false;
      const days = Math.ceil((new Date(r.dueDate).getTime() - Date.now()) / 86_400_000);
      return days >= -7 && days <= 30;
    })
    .reduce((s, r) => s + r.expectedAmount, 0) ?? 0;

  // Forecasts for all 3 horizons
  const forecastDeps = {
    invoices: deps?.invoices,
    expenses: deps?.expenses,
    receivables: deps?.receivables,
    payables: deps?.payables,
    payroll: deps?.payroll,
  };
  const [nextWeek, nextMonth, nextQuarter] = await Promise.all([
    computeForecast('next_week', forecastDeps),
    computeForecast('next_month', forecastDeps),
    computeForecast('next_quarter', forecastDeps),
  ]);
  const forecasts = [nextWeek, nextMonth, nextQuarter];

  // Persist forecasts (fire-and-forget, non-blocking)
  await Promise.all(forecasts.map((fp) => persistForecast(fp, mrr)));

  // Revenue / profit (from analytics or pipeline)
  const revenue = deps?.analytics?.totalRevenue ?? pipeline[0].amount;
  const revenueThisMonth = deps?.analytics?.revenueThisMonth ?? pipeline[0].amount;
  const revenueGrowthPct = deps?.analytics?.revenueGrowthPct ?? pipeline[0].deltaPct;
  const expenses = deps?.analytics?.totalExpenses ?? pipeline[2].amount;
  const expensesThisMonth = pipeline[2].amount;
  const profit = deps?.analytics?.netProfit ?? pipeline[5].amount;
  const marginPct = deps?.analytics?.netMarginPct ?? (revenue > 0 ? Math.round((profit / revenue) * 100) : 0);

  // Deterministic insights for Oracle
  const insights: string[] = [];
  insights.push(`I've forecasted ${inrShort(nextMonth.expectedRevenue)} revenue for next month (${nextMonth.confidence >= 0.8 ? 'high' : 'moderate'} confidence).`);
  insights.push(`I've predicted ${inrShort(collectionsNext7Days)} in collections over the next 7 days.`);
  if (deps?.receivables && deps.receivables.overdueCount > 0) {
    insights.push(`I've identified ${deps.receivables.overdueCount} overdue invoices worth ${inrShort(deps.receivables.overdueAmount)}.`);
  }
  if (deps?.payables && deps.payables.totalDue > 0) {
    insights.push(`I've identified ${inrShort(deps.payables.totalDue)} in upcoming payments over the next 90 days.`);
  }
  insights.push(`I've calculated your MRR at ${inrShort(mrr)} (${mrrTrendPct >= 0 ? '+' : ''}${mrrTrendPct}% trend) and ARR at ${inrShort(arr)}.`);
  if (cashPosition.runwayMonths > 0 && cashPosition.runwayMonths < 6) {
    insights.push(`I've detected a cash runway of ${cashPosition.runwayMonths} months at the current burn rate of ${inrShort(cashPosition.burnRate)}/month.`);
  }
  insights.push(`I've projected ${inrShort(nextMonth.projectedProfit)} net profit next month at a ${nextMonth.projectedMarginPct}% margin.`);

  const hasLiveData = (deps?.invoices?.total ?? 0) > 0 || (deps?.expenses?.total ?? 0) > 0 || (deps?.receivables?.total ?? 0) > 0;

  return {
    pipeline,
    mrr,
    arr,
    mrrTrendPct,
    revenue,
    revenueThisMonth,
    revenueGrowthPct,
    expenses,
    expensesThisMonth,
    profit,
    marginPct,
    cashPosition,
    collectionsNext7Days,
    collectionsNext30Days,
    collectionForecast: nextMonth.expectedCollections,
    forecasts,
    insights,
    hasLiveData,
  };
}

// ─── Oracle-friendly summary ───────────────────────────────────────────────────

export function intelligenceSummary(i: IntelligenceResult): string {
  if (!i.hasLiveData) return 'No revenue intelligence yet — connect invoices to unlock forecasting.';
  const nextMonth = i.forecasts.find((f) => f.horizon === 'next_month');
  return `MRR ${inrShort(i.mrr)} · ARR ${inrShort(i.arr)} · Next month forecast ${inrShort(nextMonth?.expectedRevenue ?? 0)} revenue / ${inrShort(nextMonth?.projectedProfit ?? 0)} profit · Cash ${inrShort(i.cashPosition.cashInHand)}`;
}
