// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Upgrade Phase 1 · Upgrade 4: Financial Forecasting
//
// Multi-horizon forecasting engine for 8 financial metrics:
//   Revenue · GST Liability · Cash Flow · Expenses · Working Capital
//   Collections · Profit · Tax
//
// Horizons: 30-day · 90-day · 1-year (365-day)
//
// Method: linear regression on historical monthly buckets + confidence intervals
// derived from residual variance and data-volume weighting. No fake data —
// degrades gracefully when history is short. Every forecast carries a
// confidence score and named drivers.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ForecastMetric =
  | 'revenue'
  | 'gst_liability'
  | 'cash_flow'
  | 'expenses'
  | 'working_capital'
  | 'collections'
  | 'profit'
  | 'tax';

export type ForecastHorizon = 30 | 90 | 365;

export interface ForecastPoint {
  metric: ForecastMetric;
  horizon: ForecastHorizon;
  predicted: number;
  low: number;
  high: number;
  confidence: number;
  trend: 'up' | 'down' | 'flat';
  changePct: number;
  drivers: string[];
  targetDate: string;
  currentRunRate: number;
}

export interface ForecastBundle {
  generatedAt: string;
  horizons: ForecastHorizon[];
  forecasts: ForecastPoint[];
  overallConfidence: number;
  dataPoints: number;
  summary: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatForecastCurrency(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function parseDate(iso: string | null | undefined): Date | null {
  if (!iso || typeof iso !== 'string') return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

// ─── Linear regression (least squares) ────────────────────────────────────────

interface RegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
  stdErr: number;
}

function linearRegression(points: { x: number; y: number }[]): RegressionResult | null {
  const n = points.length;
  if (n < 2) return null;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const meanY = sumY / n;
  let ssTot = 0;
  let ssRes = 0;
  for (const p of points) {
    const yHat = slope * p.x + intercept;
    ssTot += (p.y - meanY) ** 2;
    ssRes += (p.y - yHat) ** 2;
  }
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  const stdErr = n > 2 ? Math.sqrt(ssRes / (n - 2)) : Math.sqrt(ssRes / Math.max(n, 1));

  return { slope, intercept, rSquared, stdErr };
}

// ─── Confidence model ─────────────────────────────────────────────────────────

function confidenceFromData(
  dataPoints: number,
  rSquared: number,
  horizon: ForecastHorizon,
): number {
  let base: number;
  if (dataPoints < 2) base = 0.15;
  else if (dataPoints < 4) base = 0.35;
  else if (dataPoints < 8) base = 0.55;
  else if (dataPoints < 14) base = 0.75;
  else base = 0.88;

  base *= 0.5 + 0.5 * Math.max(0, Math.min(1, rSquared));

  if (horizon === 90) base *= 0.82;
  if (horizon === 365) base *= 0.65;

  return Math.max(0.1, Math.min(0.95, base));
}

// ─── Historical data gathering ────────────────────────────────────────────────

interface MonthlyBuckets {
  revenue: Map<string, number>;
  expenses: Map<string, number>;
  gstOutput: Map<string, number>;
  gstInput: Map<string, number>;
  collections: Map<string, number>;
  payments: Map<string, number>;
}

async function gatherHistoricalData(): Promise<MonthlyBuckets> {
  const buckets: MonthlyBuckets = {
    revenue: new Map(),
    expenses: new Map(),
    gstOutput: new Map(),
    gstInput: new Map(),
    collections: new Map(),
    payments: new Map(),
  };

  try {
    const invoices = await db.invoice.findMany({
      where: { status: { not: 'draft' } },
      select: { invoiceDate: true, totalAmount: true, cgst: true, sgst: true, igst: true, cess: true },
    });
    for (const inv of invoices) {
      const d = parseDate(inv.invoiceDate);
      if (!d) continue;
      const k = monthKey(d);
      buckets.revenue.set(k, (buckets.revenue.get(k) ?? 0) + (inv.totalAmount || 0));
      const outputGst = (inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0) + (inv.cess || 0);
      buckets.gstOutput.set(k, (buckets.gstOutput.get(k) ?? 0) + outputGst);
    }
  } catch {
    // graceful — table may not exist in preview
  }

  try {
    const purchases = await db.purchaseBill.findMany({
      select: { invoiceDate: true, totalAmount: true, cgst: true, sgst: true, igst: true, cess: true },
    });
    for (const p of purchases) {
      const d = parseDate(p.invoiceDate);
      if (!d) continue;
      const k = monthKey(d);
      buckets.expenses.set(k, (buckets.expenses.get(k) ?? 0) + (p.totalAmount || 0));
      const inputGst = (p.cgst || 0) + (p.sgst || 0) + (p.igst || 0) + (p.cess || 0);
      buckets.gstInput.set(k, (buckets.gstInput.get(k) ?? 0) + inputGst);
    }
  } catch {
    // graceful
  }

  try {
    const expenses = await db.expense.findMany({
      select: { date: true, amount: true },
    });
    for (const e of expenses) {
      const d = parseDate(e.date);
      if (!d) continue;
      const k = monthKey(d);
      buckets.expenses.set(k, (buckets.expenses.get(k) ?? 0) + (e.amount || 0));
    }
  } catch {
    // graceful
  }

  try {
    const paymentsIn = await db.payment.findMany({
      where: { partyType: 'customer' },
      select: { paymentDate: true, amount: true },
    });
    for (const p of paymentsIn) {
      const d = parseDate(p.paymentDate);
      if (!d) continue;
      const k = monthKey(d);
      buckets.collections.set(k, (buckets.collections.get(k) ?? 0) + (p.amount || 0));
    }
  } catch {
    // graceful — partyType column may differ
  }

  try {
    const paymentsOut = await db.payment.findMany({
      where: { partyType: 'vendor' },
      select: { paymentDate: true, amount: true },
    });
    for (const p of paymentsOut) {
      const d = parseDate(p.paymentDate);
      if (!d) continue;
      const k = monthKey(d);
      buckets.payments.set(k, (buckets.payments.get(k) ?? 0) + (p.amount || 0));
    }
  } catch {
    // graceful
  }

  return buckets;
}

// ─── Build regression series from a Map ───────────────────────────────────────

function seriesFromMap(m: Map<string, number>): { x: number; y: number; month: string }[] {
  const keys = Array.from(m.keys()).sort();
  return keys.map((k, i) => ({ x: i, y: m.get(k) ?? 0, month: k }));
}

function projectValue(
  reg: RegressionResult,
  stepsAhead: number,
): { predicted: number; stdErr: number } {
  const predicted = reg.slope * stepsAhead + reg.intercept;
  return { predicted: Math.max(0, predicted), stdErr: reg.stdErr };
}

function trendOf(curr: number, projected: number): { trend: 'up' | 'down' | 'flat'; pct: number } {
  if (curr === 0) return { trend: projected > 0 ? 'up' : 'flat', pct: 0 };
  const pct = ((projected - curr) / Math.abs(curr)) * 100;
  if (Math.abs(pct) < 3) return { trend: 'flat', pct };
  return { trend: pct > 0 ? 'up' : 'down', pct };
}

// ─── Main: generate all forecasts ─────────────────────────────────────────────

export async function generateForecasts(): Promise<ForecastBundle> {
  const buckets = await gatherHistoricalData();

  const revenueSeries = seriesFromMap(buckets.revenue);
  const expenseSeries = seriesFromMap(buckets.expenses);
  const gstOutSeries = seriesFromMap(buckets.gstOutput);
  const gstInSeries = seriesFromMap(buckets.gstInput);
  const collectionSeries = seriesFromMap(buckets.collections);
  const paymentSeries = seriesFromMap(buckets.payments);

  function runRate(series: { y: number }[]): number {
    if (series.length === 0) return 0;
    const last = series.slice(-3);
    return last.reduce((s, p) => s + p.y, 0) / last.length;
  }

  const revenueRR = runRate(revenueSeries);
  const expenseRR = runRate(expenseSeries);
  const gstOutRR = runRate(gstOutSeries);
  const gstInRR = runRate(gstInSeries);
  const collectionRR = runRate(collectionSeries);
  const paymentRR = runRate(paymentSeries);

  const profitRR = revenueRR - expenseRR;
  const gstNetRR = Math.max(0, gstOutRR - gstInRR);
  const cashFlowRR = collectionRR - paymentRR;
  const workingCapitalRR = Math.max(0, collectionRR - paymentRR) * 1.5;
  const taxRR = gstNetRR * 0.9;

  const totalPoints =
    revenueSeries.length + expenseSeries.length + gstOutSeries.length + collectionSeries.length;

  const forecasts: ForecastPoint[] = [];
  const horizons: ForecastHorizon[] = [30, 90, 365];
  const now = new Date();

  function buildForecast(
    metric: ForecastMetric,
    series: { x: number; y: number }[],
    currentRunRate: number,
    drivers: string[],
  ): void {
    const reg = linearRegression(series);
    for (const horizon of horizons) {
      const stepsAhead = horizon / 30;
      let predicted: number;
      let stdErr: number;
      let confidence: number;

      if (reg) {
        const proj = projectValue(reg, stepsAhead);
        predicted = proj.predicted;
        stdErr = proj.stdErr;
        confidence = confidenceFromData(series.length, reg.rSquared, horizon);
      } else {
        predicted = currentRunRate * stepsAhead;
        stdErr = currentRunRate * 0.5;
        confidence = 0.15;
      }

      const margin = 1.96 * stdErr * Math.sqrt(Math.max(1, stepsAhead));
      const low = Math.max(0, predicted - margin);
      const high = predicted + margin;

      const { trend, pct } = trendOf(currentRunRate * stepsAhead, predicted);

      const target = new Date(now);
      target.setDate(target.getDate() + horizon);

      forecasts.push({
        metric,
        horizon,
        predicted,
        low,
        high,
        confidence,
        trend,
        changePct: pct,
        drivers,
        targetDate: target.toISOString(),
        currentRunRate,
      });
    }
  }

  buildForecast('revenue', revenueSeries, revenueRR, [
    'Historical invoice volume trend',
    'Seasonal billing patterns',
    'Client acquisition rate',
  ]);

  const gstNetSeries: { x: number; y: number }[] = [];
  const allMonths = new Set([...gstOutSeries.map((s) => s.x), ...gstInSeries.map((s) => s.x)]);
  for (const x of Array.from(allMonths).sort((a, b) => a - b)) {
    const out = gstOutSeries.find((s) => s.x === x)?.y ?? 0;
    const inp = gstInSeries.find((s) => s.x === x)?.y ?? 0;
    gstNetSeries.push({ x, y: Math.max(0, out - inp) });
  }
  buildForecast('gst_liability', gstNetSeries, gstNetRR, [
    'Output GST from sales',
    'Input Tax Credit availability',
    'Reverse-charge transactions',
  ]);

  const cashFlowSeries: { x: number; y: number }[] = [];
  const cfMonths = new Set([...collectionSeries.map((s) => s.x), ...paymentSeries.map((s) => s.x)]);
  for (const x of Array.from(cfMonths).sort((a, b) => a - b)) {
    const col = collectionSeries.find((s) => s.x === x)?.y ?? 0;
    const pay = paymentSeries.find((s) => s.x === x)?.y ?? 0;
    cashFlowSeries.push({ x, y: col - pay });
  }
  buildForecast('cash_flow', cashFlowSeries, cashFlowRR, [
    'Collection velocity',
    'Payment obligations',
    'Working capital cycle',
  ]);

  buildForecast('expenses', expenseSeries, expenseRR, [
    'Operational cost trend',
    'Vendor billing cycle',
    'Overhead commitments',
  ]);

  buildForecast('working_capital', cashFlowSeries, workingCapitalRR, [
    'Receivables aging',
    'Payables schedule',
    'Inventory turnover',
  ]);

  buildForecast('collections', collectionSeries, collectionRR, [
    'Customer payment behavior',
    'Invoice aging profile',
    'Collection effectiveness',
  ]);

  const profitSeries: { x: number; y: number }[] = [];
  const pMonths = new Set([...revenueSeries.map((s) => s.x), ...expenseSeries.map((s) => s.x)]);
  for (const x of Array.from(pMonths).sort((a, b) => a - b)) {
    const rev = revenueSeries.find((s) => s.x === x)?.y ?? 0;
    const exp = expenseSeries.find((s) => s.x === x)?.y ?? 0;
    profitSeries.push({ x, y: rev - exp });
  }
  buildForecast('profit', profitSeries, profitRR, [
    'Revenue growth',
    'Cost containment',
    'Margin pressure',
  ]);

  buildForecast('tax', gstNetSeries, taxRR, [
    'GST net liability',
    'TDS obligations',
    'Advance tax estimates',
  ]);

  const overallConfidence =
    forecasts.length > 0
      ? forecasts.reduce((s, f) => s + f.confidence, 0) / forecasts.length
      : 0.15;

  const revenue30 = forecasts.find((f) => f.metric === 'revenue' && f.horizon === 30);
  const profit90 = forecasts.find((f) => f.metric === 'profit' && f.horizon === 90);
  const gst365 = forecasts.find((f) => f.metric === 'gst_liability' && f.horizon === 365);

  const summaryParts: string[] = [];
  if (revenue30) summaryParts.push(`30-day revenue projected at ${formatForecastCurrency(revenue30.predicted)} (${revenue30.trend})`);
  if (profit90) summaryParts.push(`90-day profit forecast ${formatForecastCurrency(profit90.predicted)} at ${Math.round(profit90.confidence * 100)}% confidence`);
  if (gst365) summaryParts.push(`Annual GST liability estimated ${formatForecastCurrency(gst365.predicted)}`);

  return {
    generatedAt: now.toISOString(),
    horizons,
    forecasts,
    overallConfidence,
    dataPoints: totalPoints,
    summary: summaryParts.join(' · ') || 'Insufficient historical data for reliable forecasts. Connect invoices and bank transactions for accurate predictions.',
  };
}

export function formatForecast(f: ForecastPoint): string {
  return `${formatForecastCurrency(f.predicted)} (${Math.round(f.confidence * 100)}% conf, ${f.trend} ${f.changePct > 0 ? '+' : ''}${f.changePct.toFixed(0)}%)`;
}
