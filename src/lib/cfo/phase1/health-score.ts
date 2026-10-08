// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI CFO™ Phase 1 — REAL FINANCIAL HEALTH SCORE
//
// Computes a 0-100 weighted health score using 10 factors:
//   1.  Revenue Growth (15%)
//   2.  Profit Margin (15%)
//   3.  Cash Position (12%)
//   4.  Collections (10%)
//   5.  Outstanding Invoices (8%)
//   6.  GST Compliance (10%)
//   7.  Bank Balance (10%)
//   8.  Expenses (5%)
//   9.  Debt / Liabilities (10%)
//  10.  Working Capital (5%)
//
// Each factor returns: raw value, sub-score (0-100), weight, contribution,
// direction, explanation, and benchmark. The overall score is the weighted
// sum. Every factor has a transparent explanation of WHY it scored that way.
// ═══════════════════════════════════════════════════════════════════════════════

import type { RealFinancialHealthScore, HealthScoreFactor } from '../types';
import type { RawCFOData } from './data';
import { now, roundTo, clamp } from './data';
import type { RevenueAnalytics } from '../types';
import type { ProfitabilityAnalytics } from '../types';
import type { CashFlowAnalytics } from '../types';
import type { WorkingCapitalAnalytics } from '../types';
import type { CollectionAnalytics } from '../types';

interface HealthContext {
  revenue: RevenueAnalytics;
  profitability: ProfitabilityAnalytics;
  cashFlow: CashFlowAnalytics;
  workingCapital: WorkingCapitalAnalytics;
  collections: CollectionAnalytics;
}

// Helper: convert a raw metric to a 0-100 score given thresholds
function scoreFromBands(value: number, bands: Array<{ upTo: number; score: number }>): number {
  // bands sorted by upTo ascending. First band with value <= upTo wins.
  for (const b of bands) {
    if (value <= b.upTo) return b.score;
  }
  return bands[bands.length - 1].score;
}

function directionFromScore(score: number): 'up' | 'down' | 'stable' {
  if (score >= 70) return 'up';
  if (score < 40) return 'down';
  return 'stable';
}

// ─── Factor 1: Revenue Growth (15%) ──────────────────────────────────────────
function factorRevenueGrowth(ctx: HealthContext): HealthScoreFactor {
  const growth = ctx.revenue.growthPct;
  let score: number;
  if (growth >= 20) score = 100;
  else if (growth >= 10) score = 85;
  else if (growth >= 5) score = 75;
  else if (growth >= 0) score = 60;
  else if (growth >= -5) score = 45;
  else if (growth >= -15) score = 30;
  else if (growth >= -25) score = 15;
  else score = 5;
  const weight = 0.15;
  return {
    key: 'revenue_growth',
    label: 'Revenue Growth',
    rawValue: growth,
    rawUnit: 'percent',
    score,
    weight,
    contribution: score * weight,
    direction: directionFromScore(score),
    explanation: growth >= 0
      ? `Revenue grew ${growth.toFixed(1)}% month-over-month — ${growth >= 10 ? 'strong' : growth >= 5 ? 'healthy' : 'modest'} growth trajectory.`
      : `Revenue declined ${Math.abs(growth).toFixed(1)}% — ${growth <= -15 ? 'significant' : 'mild'} drop requiring attention.`,
    benchmark: 'Healthy services business: 8-15% MoM growth',
  };
}

// ─── Factor 2: Profit Margin (15%) ───────────────────────────────────────────
function factorProfitMargin(ctx: HealthContext): HealthScoreFactor {
  const margin = ctx.profitability.netMarginPct;
  let score: number;
  if (margin >= 25) score = 100;
  else if (margin >= 18) score = 90;
  else if (margin >= 12) score = 75;
  else if (margin >= 8) score = 60;
  else if (margin >= 0) score = 40;
  else if (margin >= -10) score = 20;
  else score = 5;
  const weight = 0.15;
  return {
    key: 'profit_margin',
    label: 'Profit Margin',
    rawValue: margin,
    rawUnit: 'percent',
    score,
    weight,
    contribution: score * weight,
    direction: directionFromScore(score),
    explanation: margin >= 12
      ? `Net margin at ${margin}% — ${margin >= 20 ? 'excellent' : 'healthy'} profitability.`
      : margin >= 0
      ? `Net margin at ${margin}% — ${margin >= 8 ? 'acceptable' : 'thin'} margin, watch costs.`
      : `Net margin negative at ${margin}% — business operating at a loss.`,
    benchmark: 'Healthy services business: 15-25% net margin',
  };
}

// ─── Factor 3: Cash Position (12%) ───────────────────────────────────────────
function factorCashPosition(ctx: HealthContext): HealthScoreFactor {
  const { runwayDays, availableCash } = ctx.cashFlow;
  let score: number;
  if (runwayDays === 0 && availableCash > 0) score = 95; // > 365 days
  else if (runwayDays >= 180) score = 95;
  else if (runwayDays >= 90) score = 85;
  else if (runwayDays >= 60) score = 70;
  else if (runwayDays >= 30) score = 50;
  else if (runwayDays >= 15) score = 30;
  else if (runwayDays > 0) score = 15;
  else score = 5;
  const weight = 0.12;
  return {
    key: 'cash_position',
    label: 'Cash Position',
    rawValue: runwayDays,
    rawUnit: 'days',
    score,
    weight,
    contribution: score * weight,
    direction: directionFromScore(score),
    explanation: runwayDays === 0
      ? `Cash position strong — runway exceeds 1 year (₹${Math.round(availableCash).toLocaleString('en-IN')} available).`
      : runwayDays >= 60
      ? `${runwayDays} days of runway — comfortable buffer.`
      : runwayDays >= 30
      ? `${runwayDays} days of runway — adequate but monitor closely.`
      : `${runwayDays} days of runway — CRITICAL, action needed immediately.`,
    benchmark: 'Minimum 60 days runway, ideal 180+ days',
  };
}

// ─── Factor 4: Collections (10%) ─────────────────────────────────────────────
function factorCollections(ctx: HealthContext): HealthScoreFactor {
  const eff = ctx.collections.collectionEfficiencyPct;
  let score: number;
  if (eff >= 95) score = 100;
  else if (eff >= 85) score = 85;
  else if (eff >= 75) score = 70;
  else if (eff >= 60) score = 50;
  else if (eff >= 40) score = 30;
  else score = 15;
  const weight = 0.10;
  return {
    key: 'collections',
    label: 'Collection Efficiency',
    rawValue: eff,
    rawUnit: 'percent',
    score,
    weight,
    contribution: score * weight,
    direction: directionFromScore(score),
    explanation: eff >= 85
      ? `Collection efficiency at ${eff}% — receivables converting to cash quickly.`
      : eff >= 60
      ? `Collection efficiency at ${eff}% — ${eff < 75 ? 'below healthy threshold' : 'acceptable'} but improvement possible.`
      : `Collection efficiency at ${eff}% — poor, significant cash trapped in receivables.`,
    benchmark: 'Healthy: > 85% collection efficiency',
  };
}

// ─── Factor 5: Outstanding Invoices (8%) ─────────────────────────────────────
function factorOutstandingInvoices(ctx: HealthContext, data: RawCFOData): HealthScoreFactor {
  const overdueCount = ctx.collections.overdueCount;
  const totalInvoices = data.invoices.filter((i) => i.paymentStatus !== 'paid').length;
  const overduePct = totalInvoices > 0 ? (overdueCount / totalInvoices) * 100 : 0;
  let score: number;
  if (overdueCount === 0) score = 100;
  else if (overduePct <= 10) score = 85;
  else if (overduePct <= 25) score = 65;
  else if (overduePct <= 50) score = 40;
  else if (overduePct <= 75) score = 20;
  else score = 10;
  const weight = 0.08;
  return {
    key: 'outstanding_invoices',
    label: 'Outstanding Invoices',
    rawValue: overdueCount,
    rawUnit: 'count',
    score,
    weight,
    contribution: score * weight,
    direction: directionFromScore(score),
    explanation: overdueCount === 0
      ? 'No overdue invoices — clean receivables book.'
      : `${overdueCount} overdue invoice(s) out of ${totalInvoices} outstanding (${overduePct.toFixed(0)}% overdue rate).`,
    benchmark: 'Target: < 10% overdue rate',
  };
}

// ─── Factor 6: GST Compliance (10%) ──────────────────────────────────────────
function factorGSTCompliance(data: RawCFOData): HealthScoreFactor {
  const today = now();
  const overdueFilings = data.filings.filter((f) => {
    if (f.status === 'filed') return false;
    const due = (() => {
      const [y, m] = f.period.split('-').map(Number);
      if (!y || !m) return null;
      const rt = (f.returnType || '').toUpperCase();
      if (rt === 'GSTR-1') return new Date(y, m, 11);
      if (rt === 'GSTR-3B') return new Date(y, m, 20);
      return new Date(y, m, 20);
    })();
    return due ? due < today : false;
  }).length;
  const openNotices = data.notices.filter((n) => n.status === 'open' || n.status === 'pending').length;
  const penaltyNotices = data.notices.filter((n) => {
    const t = (n.noticeType || '').toLowerCase();
    return t.includes('penalty') || t.includes('fine') || t.includes('interest') || t.includes('demand');
  }).length;

  let score: number;
  if (penaltyNotices > 0) score = 15;
  else if (overdueFilings >= 3) score = 25;
  else if (overdueFilings >= 1) score = 50;
  else if (openNotices > 3) score = 60;
  else if (openNotices > 0) score = 75;
  else score = 100;
  const weight = 0.10;
  return {
    key: 'gst_compliance',
    label: 'GST Compliance',
    rawValue: overdueFilings,
    rawUnit: 'count',
    score,
    weight,
    contribution: score * weight,
    direction: directionFromScore(score),
    explanation: overdueFilings === 0 && penaltyNotices === 0
      ? 'All GST returns filed on time, no penalty notices — clean compliance record.'
      : penaltyNotices > 0
      ? `${penaltyNotices} penalty notice(s) received — high compliance risk.`
      : `${overdueFilings} overdue GST filing(s) — late fee + interest accruing.`,
    benchmark: '100% on-time filing, zero penalty notices',
  };
}

// ─── Factor 7: Bank Balance (10%) ────────────────────────────────────────────
function factorBankBalance(ctx: HealthContext, data: RawCFOData): HealthScoreFactor {
  // Bank balance = available cash + any bank-connector-synced balance
  let bankBalance = ctx.cashFlow.availableCash;
  for (const rec of data.syncedRecords) {
    if (rec.sourceType !== 'bank_tx') continue;
    try {
      const payload = rec.rawData ? JSON.parse(rec.rawData) : {};
      if (payload.balance && typeof payload.balance === 'number' && payload.balance > bankBalance) {
        bankBalance = payload.balance;
      }
    } catch {
      // ignore
    }
  }
  const monthlyBurn = ctx.cashFlow.burnRatePerMonth;
  const monthsCovered = monthlyBurn > 0 ? bankBalance / monthlyBurn : 999;
  let score: number;
  if (monthsCovered >= 6) score = 100;
  else if (monthsCovered >= 3) score = 85;
  else if (monthsCovered >= 2) score = 70;
  else if (monthsCovered >= 1) score = 50;
  else if (monthsCovered >= 0.5) score = 30;
  else score = 10;
  const weight = 0.10;
  return {
    key: 'bank_balance',
    label: 'Bank Balance',
    rawValue: bankBalance,
    rawUnit: 'inr',
    score,
    weight,
    contribution: score * weight,
    direction: directionFromScore(score),
    explanation: monthsCovered >= 3
      ? `Bank balance ₹${Math.round(bankBalance).toLocaleString('en-IN')} covers ${Math.round(monthsCovered)} months of burn — strong cushion.`
      : monthsCovered >= 1
      ? `Bank balance ₹${Math.round(bankBalance).toLocaleString('en-IN')} covers ${Math.round(monthsCovered * 10) / 10} month(s) of burn — adequate.`
      : `Bank balance ₹${Math.round(bankBalance).toLocaleString('en-IN')} covers less than half a month of burn — critical.`,
    benchmark: '6+ months of operating expenses in bank',
  };
}

// ─── Factor 8: Expenses (5%) ─────────────────────────────────────────────────
function factorExpenses(ctx: HealthContext, data: RawCFOData): HealthScoreFactor {
  // Lower expense ratio = better score
  const expenseRatio = ctx.profitability.expenseRatioPct;
  let score: number;
  if (expenseRatio <= 50) score = 100;
  else if (expenseRatio <= 65) score = 85;
  else if (expenseRatio <= 75) score = 70;
  else if (expenseRatio <= 85) score = 50;
  else if (expenseRatio <= 95) score = 30;
  else score = 15;
  const weight = 0.05;
  return {
    key: 'expenses',
    label: 'Expense Ratio',
    rawValue: expenseRatio,
    rawUnit: 'percent',
    score,
    weight,
    contribution: score * weight,
    direction: directionFromScore(score),
    explanation: expenseRatio <= 65
      ? `Expense ratio at ${expenseRatio}% — ${expenseRatio <= 50 ? 'excellent' : 'healthy'} cost control.`
      : expenseRatio <= 85
      ? `Expense ratio at ${expenseRatio}% — elevated, costs eating into margins.`
      : `Expense ratio at ${expenseRatio}% — critically high, barely breaking even.`,
    benchmark: 'Healthy services business: 50-65% expense ratio',
  };
}

// ─── Factor 9: Debt / Liabilities (10%) ──────────────────────────────────────
function factorDebt(ctx: HealthContext, data: RawCFOData): HealthScoreFactor {
  const shortTermDebt = ctx.workingCapital.shortTermDebt;
  const currentLiabilities = ctx.workingCapital.currentLiabilities;
  const debtRatio = currentLiabilities > 0 ? (shortTermDebt / currentLiabilities) * 100 : 0;
  let score: number;
  if (shortTermDebt === 0) score = 100;
  else if (debtRatio <= 10) score = 90;
  else if (debtRatio <= 25) score = 75;
  else if (debtRatio <= 40) score = 60;
  else if (debtRatio <= 60) score = 40;
  else if (debtRatio <= 80) score = 25;
  else score = 10;
  const weight = 0.10;
  return {
    key: 'debt',
    label: 'Debt / Liabilities',
    rawValue: shortTermDebt,
    rawUnit: 'inr',
    score,
    weight,
    contribution: score * weight,
    direction: directionFromScore(score),
    explanation: shortTermDebt === 0
      ? 'No overdue debt or short-term liabilities — clean balance sheet.'
      : `₹${Math.round(shortTermDebt).toLocaleString('en-IN')} in overdue/short-term liabilities — ${debtRatio.toFixed(0)}% of current liabilities.`,
    benchmark: 'Short-term debt < 25% of current liabilities',
  };
}

// ─── Factor 10: Working Capital (5%) ─────────────────────────────────────────
function factorWorkingCapital(ctx: HealthContext): HealthScoreFactor {
  const ratio = ctx.workingCapital.workingCapitalRatio;
  let score: number;
  if (ratio >= 2.0) score = 100;
  else if (ratio >= 1.5) score = 90;
  else if (ratio >= 1.2) score = 75;
  else if (ratio >= 1.0) score = 60;
  else if (ratio >= 0.8) score = 40;
  else if (ratio >= 0.5) score = 20;
  else score = 10;
  const weight = 0.05;
  return {
    key: 'working_capital',
    label: 'Working Capital Ratio',
    rawValue: ratio,
    rawUnit: 'ratio',
    score,
    weight,
    contribution: score * weight,
    direction: directionFromScore(score),
    explanation: ratio >= 1.5
      ? `Working capital ratio ${ratio.toFixed(2)} — strong liquidity cushion.`
      : ratio >= 1.0
      ? `Working capital ratio ${ratio.toFixed(2)} — adequate, just above 1.0.`
      : `Working capital ratio ${ratio.toFixed(2)} — current liabilities exceed current assets.`,
    benchmark: 'Healthy: 1.5-2.0 working capital ratio',
  };
}

export function computeHealthScore(data: RawCFOData, ctx: HealthContext): RealFinancialHealthScore {
  const factors: HealthScoreFactor[] = [
    factorRevenueGrowth(ctx),
    factorProfitMargin(ctx),
    factorCashPosition(ctx),
    factorCollections(ctx),
    factorOutstandingInvoices(ctx, data),
    factorGSTCompliance(data),
    factorBankBalance(ctx, data),
    factorExpenses(ctx, data),
    factorDebt(ctx, data),
    factorWorkingCapital(ctx),
  ];

  // Verify weights sum to ~1.0 (sanity check)
  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  // Normalize contributions if weights don't sum to exactly 1
  const weightScale = totalWeight > 0 ? 1 / totalWeight : 1;
  for (const f of factors) {
    f.contribution = Math.round((f.score * f.weight * weightScale) * 100) / 100;
  }

  const overall = Math.round(clamp(factors.reduce((s, f) => s + f.contribution, 0), 0, 100));

  // Determine tier
  let tier: RealFinancialHealthScore['tier'];
  if (overall >= 80) tier = 'excellent';
  else if (overall >= 65) tier = 'healthy';
  else if (overall >= 50) tier = 'attention';
  else if (overall >= 35) tier = 'at_risk';
  else tier = 'critical';

  // Find top driver (highest contribution with positive direction) and top drag
  const sorted = [...factors].sort((a, b) => b.contribution - a.contribution);
  const topDriver = sorted[0];
  const topDrag = sorted[sorted.length - 1];

  const summary = `${tier === 'excellent' ? 'Excellent' : tier === 'healthy' ? 'Healthy' : tier === 'attention' ? 'Needs attention' : tier === 'at_risk' ? 'At risk' : 'Critical'} financial health (score ${overall}/100). Strongest area: ${topDriver.label.toLowerCase()}. ${topDrag.contribution < 10 ? 'Biggest drag: ' + topDrag.label.toLowerCase() + '.' : 'No major drags.'}`;

  return {
    overall,
    tier,
    factors,
    summary,
    topDriver: `${topDriver.label} (score ${topDriver.score}/100, contributing ${topDriver.contribution.toFixed(1)} points)`,
    topDrag: `${topDrag.label} (score ${topDrag.score}/100, contributing ${topDrag.contribution.toFixed(1)} points)`,
    asOfDate: new Date().toISOString(),
  };
}
