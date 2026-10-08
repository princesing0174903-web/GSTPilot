// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI CFO™ Phase 1 — FORECAST ENGINE
//
// Predicts 6 metrics across 4 horizons (7d, 30d, 90d, 365d) with confidence:
//   • Revenue
//   • Cash Flow
//   • Profit
//   • GST Liability
//   • Expenses
//   • Collections
//
// Methodology: trend-extrapolation with dampening. Uses historical averages
// from the last 3 months as the baseline and applies a dampened growth rate.
// Confidence decreases with horizon length and increases with data volume.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ForecastAnalytics, ForecastRow } from '../types';
import type { RawCFOData } from './data';
import { now, startOfMonth, addDays, roundTo, trendFromPct } from './data';

function revenueForRange(invoices: RawCFOData['invoices'], from: Date, to: Date): number {
  return invoices
    .filter((i) => { const d = new Date(i.invoiceDate); return d >= from && d <= to; })
    .reduce((s, i) => s + (i.totalAmount || 0), 0);
}

function expensesForRange(expenses: RawCFOData['expenses'], from: Date, to: Date): number {
  return expenses
    .filter((e) => { const d = new Date(e.date); return d >= from && d <= to; })
    .reduce((s, e) => s + (e.amount || 0), 0);
}

function collectionsForRange(payments: RawCFOData['payments'], from: Date, to: Date): number {
  return payments
    .filter((p) => {
      if (p.partyType !== 'customer') return false;
      const d = new Date(p.paymentDate);
      return d >= from && d <= to && (p.status === 'completed' || p.status === 'reconciled');
    })
    .reduce((s, p) => s + (p.amount || 0), 0);
}

function gstLiabilityForRange(invoices: RawCFOData['invoices'], from: Date, to: Date): number {
  return invoices
    .filter((i) => { const d = new Date(i.invoiceDate); return d >= from && d <= to; })
    .reduce((s, i) => s + (i.cgst || 0) + (i.sgst || 0) + (i.igst || 0) + (i.cess || 0), 0);
}

function avgOverLast3Months(invoices: RawCFOData['invoices'], field: 'revenue' | 'gst'): number {
  const today = now();
  let total = 0;
  for (let i = 0; i < 3; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    if (field === 'revenue') total += revenueForRange(invoices, start, end);
    else total += gstLiabilityForRange(invoices, start, end);
  }
  return total / 3;
}

function avgExpensesLast3Months(expenses: RawCFOData['expenses']): number {
  const today = now();
  let total = 0;
  for (let i = 0; i < 3; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    total += expensesForRange(expenses, start, end);
  }
  return total / 3;
}

function avgCollectionsLast3Months(payments: RawCFOData['payments']): number {
  const today = now();
  let total = 0;
  for (let i = 0; i < 3; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    total += collectionsForRange(payments, start, end);
  }
  return total / 3;
}

function computeConfidence(days: number, dataPointCount: number): number {
  // Base confidence decreases with horizon: 90% at 7d, 80% at 30d, 65% at 90d, 50% at 365d
  const baseConfidence = 90 - (days / 365) * 40;
  // Boost with more data points (capped at +15%)
  const dataBoost = Math.min(dataPointCount / 100, 1) * 15;
  return Math.max(35, Math.min(95, Math.round(baseConfidence + dataBoost)));
}

function buildForecastRow(
  metric: ForecastRow['metric'],
  label: string,
  currentValue: number,
  avgMonthly: number,
  growthPct: number,
  drivers: string[],
  dataPointCount: number,
): ForecastRow {
  // Daily run rate from monthly average
  const dailyRate = avgMonthly / 30;
  // Dampened growth: apply full growth at 7d, half at 90d, quarter at 365d
  const damp = (days: number) => {
    if (days <= 7) return 1;
    if (days <= 30) return 0.8;
    if (days <= 90) return 0.6;
    return 0.4;
  };
  const projected = (days: number) => Math.round(dailyRate * days * (1 + (growthPct / 100) * damp(days)));

  const sevenDay = projected(7);
  const thirtyDay = projected(30);
  const ninetyDay = projected(90);
  const yearEnd = projected(365);

  // Confidence for each horizon
  const conf7 = computeConfidence(7, dataPointCount);
  const conf30 = computeConfidence(30, dataPointCount);
  const conf90 = computeConfidence(90, dataPointCount);
  const conf365 = computeConfidence(365, dataPointCount);
  const confidencePct = Math.round((conf7 + conf30 + conf90 + conf365) / 4);

  return {
    metric,
    label,
    currentValue: Math.round(currentValue),
    sevenDay,
    thirtyDay,
    ninetyDay,
    yearEnd,
    confidencePct,
    trend: trendFromPct(growthPct),
    drivers,
  };
}

export function computeForecast(data: RawCFOData): ForecastAnalytics {
  const { invoices, expenses, payments, purchaseBills } = data;
  const today = now();
  const mStart = startOfMonth();
  const tomorrow = addDays(today, 1);

  // Current month values
  const currentRevenue = revenueForRange(invoices, mStart, tomorrow);
  const currentExpenses = expensesForRange(expenses, mStart, tomorrow);
  const currentCollections = collectionsForRange(payments, mStart, tomorrow);
  const currentGST = gstLiabilityForRange(invoices, mStart, tomorrow);
  const currentProfit = currentRevenue - currentExpenses - (purchaseBills
    .filter((p) => { const d = new Date(p.invoiceDate); return d >= mStart && d <= tomorrow; })
    .reduce((s, p) => s + (p.totalAmount || 0), 0));

  // Averages
  const avgRev = avgOverLast3Months(invoices, 'revenue');
  const avgExp = avgExpensesLast3Months(expenses);
  const avgColl = avgCollectionsLast3Months(payments);
  const avgGST = avgOverLast3Months(invoices, 'gst');
  const avgProfit = avgRev - avgExp;

  // Growth rates (this month vs avg)
  const revGrowth = avgRev > 0 ? ((currentRevenue - avgRev) / avgRev) * 100 : 0;
  const expGrowth = avgExp > 0 ? ((currentExpenses - avgExp) / avgExp) * 100 : 0;
  const collGrowth = avgColl > 0 ? ((currentCollections - avgColl) / avgColl) * 100 : 0;
  const gstGrowth = avgGST > 0 ? ((currentGST - avgGST) / avgGST) * 100 : 0;
  const profitGrowth = avgProfit > 0 ? ((currentProfit - avgProfit) / Math.abs(avgProfit)) * 100 : 0;

  const dataPointCount = invoices.length + expenses.length + payments.length + purchaseBills.length;

  const rows: ForecastRow[] = [
    buildForecastRow(
      'revenue', 'Revenue Forecast',
      currentRevenue, avgRev, revGrowth,
      [
        `${invoices.length} historical invoices analyzed`,
        `3-month avg: ₹${Math.round(avgRev).toLocaleString('en-IN')}/month`,
        `Current month trend: ${revGrowth >= 0 ? '+' : ''}${roundTo(revGrowth, 1)}% vs 3-mo avg`,
      ],
      dataPointCount,
    ),
    buildForecastRow(
      'cash_flow', 'Cash Flow Forecast',
      currentCollections - currentExpenses,
      avgColl - avgExp,
      collGrowth - expGrowth,
      [
        `Inflow run rate: ₹${Math.round(avgColl).toLocaleString('en-IN')}/month`,
        `Outflow run rate: ₹${Math.round(avgExp).toLocaleString('en-IN')}/month`,
        `Net cash trend: ${collGrowth - expGrowth >= 0 ? 'improving' : 'declining'}`,
      ],
      dataPointCount,
    ),
    buildForecastRow(
      'profit', 'Profit Forecast',
      currentProfit, avgProfit, profitGrowth,
      [
        `Avg monthly profit: ₹${Math.round(avgProfit).toLocaleString('en-IN')}`,
        `Margin trend: ${profitGrowth >= 0 ? 'expanding' : 'compressing'}`,
        `Cost structure: ${roundTo((avgExp / Math.max(avgRev, 1)) * 100, 1)}% expense ratio`,
      ],
      dataPointCount,
    ),
    buildForecastRow(
      'gst_liability', 'GST Liability Forecast',
      currentGST, avgGST, gstGrowth,
      [
        `Output tax run rate: ₹${Math.round(avgGST).toLocaleString('en-IN')}/month`,
        `ITC available: ₹${Math.round(purchaseBills.reduce((s, p) => s + (p.gstAmount || 0), 0)).toLocaleString('en-IN')}`,
        `Next filing due: GSTR-3B by 20th`,
      ],
      dataPointCount,
    ),
    buildForecastRow(
      'expenses', 'Expense Forecast',
      currentExpenses, avgExp, expGrowth,
      [
        `${expenses.length} expense records analyzed`,
        `3-month avg: ₹${Math.round(avgExp).toLocaleString('en-IN')}/month`,
        `Burn rate trend: ${expGrowth > 5 ? 'rising' : expGrowth < -5 ? 'falling' : 'stable'}`,
      ],
      dataPointCount,
    ),
    buildForecastRow(
      'collections', 'Collection Forecast',
      currentCollections, avgColl, collGrowth,
      [
        `Collection run rate: ₹${Math.round(avgColl).toLocaleString('en-IN')}/month`,
        `Outstanding receivables: ₹${Math.round(invoices.filter((i) => i.paymentStatus !== 'paid').reduce((s, i) => s + (i.balanceAmount || i.totalAmount || 0), 0)).toLocaleString('en-IN')}`,
        `${invoices.filter((i) => i.paymentStatus === 'overdue').length} overdue invoice(s)`,
      ],
      dataPointCount,
    ),
  ];

  const overallConfidencePct = Math.round(rows.reduce((s, r) => s + r.confidencePct, 0) / rows.length);

  return {
    rows,
    overallConfidencePct,
    methodology: 'Forecasts computed via trend-extrapolation with dampening. Baseline = 3-month trailing average. Growth rate applied with horizon-dependent dampening (full at 7d, 40% at 365d). Confidence decreases with horizon length and increases with data volume.',
    generatedAt: new Date().toISOString(),
  };
}
