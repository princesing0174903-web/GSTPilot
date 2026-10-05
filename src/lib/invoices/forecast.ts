// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Invoice Engine™ — AI Cash Conversion Engine
// Revenue / cash-flow forecasting, delayed collection detection, surplus/deficit
// prediction. The Oracle reads this output and phrases it conversationally.
// Pure TypeScript.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  CashFlowForecast,
  Expense,
  InvoiceCloudInvoice,
  Payroll,
  PurchaseBill,
  RevenueForecast,
} from './types';
import { isOverdue } from './invoices-utils';

// ─── Forecast generation ──────────────────────────────────────────────────────

export interface ForecastParams {
  invoices: InvoiceCloudInvoice[];
  bills: PurchaseBill[];
  expenses: Expense[];
  payrolls: Payroll[];
  historicalCollectionRate: number;
  period: string; // YYYY-MM
}

/**
 * Generates the AI Cash Conversion Forecast for the given period.
 *
 * Inflow model:
 *   - Outstanding receivables × historical collection rate
 *   - + projected recurring invoice revenue for the period
 *
 * Outflow model:
 *   - Unpaid vendor bills balance
 *   - + upcoming expenses (excluding already-paid)
 *   - + monthly payroll net (sum of netSalary for the period)
 *
 * Confidence: starts at 0.85, drops by 0.05 per overdue invoice (min 0.4).
 *
 * Factors: human-readable strings explaining each driver.
 * aiSummary: Oracle-style sentence with Indian currency + lakh/crore phrasing.
 */
export function generateCashFlowForecast(params: ForecastParams): CashFlowForecast {
  const { invoices, bills, expenses, payrolls, historicalCollectionRate, period } = params;
  const rate = Math.max(0, Math.min(1, historicalCollectionRate));
  const factors: string[] = [];

  // Inflow
  const outstandingReceivables = invoices
    .filter((i) => i.paymentStatus !== 'paid' && i.status !== 'cancelled' && i.status !== 'draft')
    .reduce((sum, i) => sum + i.balanceAmount, 0);
  const expectedFromReceivables = outstandingReceivables * rate;
  factors.push(`Outstanding receivables of ₹${formatLakh(outstandingReceivables)} × ${(rate * 100).toFixed(0)}% historical collection rate = ₹${formatLakh(expectedFromReceivables)} expected inflow.`);

  const recurringRevenue = invoices
    .filter((i) => i.recurring && i.recurringCycle === 'monthly')
    .reduce((sum, i) => sum + i.totalAmount, 0);
  if (recurringRevenue > 0) {
    factors.push(`Recurring monthly invoices contributing ₹${formatLakh(recurringRevenue)} in predictable inflow.`);
  }

  const projectedInflow = round2(expectedFromReceivables + recurringRevenue);

  // Outflow
  const unpaidBills = bills
    .filter((b) => b.paymentStatus !== 'paid' && b.balanceAmount > 0)
    .reduce((sum, b) => sum + b.balanceAmount, 0);
  if (unpaidBills > 0) {
    factors.push(`Vendor payables outstanding: ₹${formatLakh(unpaidBills)}.`);
  }

  const upcomingExpenses = expenses
    .filter((e) => e.status !== 'claimed')
    .reduce((sum, e) => sum + e.amount, 0);
  if (upcomingExpenses > 0) {
    factors.push(`Operational expenses pending: ₹${formatLakh(upcomingExpenses)}.`);
  }

  const payrollOutflow = payrolls.reduce((sum, p) => sum + p.netSalary, 0);
  if (payrollOutflow > 0) {
    factors.push(`Net payroll disbursement for ${period}: ₹${formatLakh(payrollOutflow)}.`);
  }

  const projectedOutflow = round2(unpaidBills + upcomingExpenses + payrollOutflow);
  const projectedNet = round2(projectedInflow - projectedOutflow);

  // Confidence
  const overdueCount = invoices.filter(
    (i) => i.paymentStatus !== 'paid' && isOverdue(i.dueDate ?? '', i.paidAmount, i.totalAmount),
  ).length;
  const confidence = Math.max(0.4, round2(0.85 - overdueCount * 0.05));
  if (overdueCount > 0) {
    factors.push(`${overdueCount} overdue invoice(s) reduce forecast confidence to ${(confidence * 100).toFixed(0)}%.`);
  }

  // AI summary
  const aiSummary = buildAiSummary(projectedInflow, projectedOutflow, projectedNet, period);

  return {
    period,
    projectedInflow,
    projectedOutflow,
    projectedNet,
    confidence,
    factors,
    aiSummary,
  };
}

// ─── Delayed collection detection ─────────────────────────────────────────────

export interface DelayedCollection {
  invoiceId: string;
  invoiceNumber: string;
  daysLate: number;
  amount: number;
}

export function identifyDelayedCollections(invoices: InvoiceCloudInvoice[]): DelayedCollection[] {
  const result: DelayedCollection[] = [];
  for (const inv of invoices) {
    if (inv.paymentStatus === 'paid' || !inv.dueDate) continue;
    const dueTs = new Date(inv.dueDate).getTime();
    if (Number.isNaN(dueTs)) continue;
    if (dueTs >= Date.now()) continue;
    const daysLate = Math.floor((Date.now() - dueTs) / (1000 * 60 * 60 * 24));
    if (daysLate > 0) {
      result.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        daysLate,
        amount: inv.balanceAmount,
      });
    }
  }
  return result.sort((a, b) => b.daysLate - a.daysLate);
}

// ─── Surplus / deficit prediction ─────────────────────────────────────────────

export interface SurplusPrediction {
  type: 'surplus' | 'deficit' | 'balanced';
  amount: number;
  recommendation: string;
}

export function predictSurplusOrDeficit(forecast: CashFlowForecast): SurplusPrediction {
  const amount = forecast.projectedNet;
  const abs = Math.abs(amount);
  if (Math.abs(amount) < 10000) {
    return {
      type: 'balanced',
      amount: round2(amount),
      recommendation: 'Cash position is roughly balanced — maintain a 1-month contingency buffer.',
    };
  }
  if (amount > 0) {
    const recommendation =
      abs >= 500000
        ? `Significant surplus of ₹${formatLakh(abs)} predicted — consider parking in liquid debt funds or prepaying high-cost vendor payables for early-payment discounts.`
        : `Modest surplus of ₹${formatLakh(abs)} — build working-capital reserve before discretionary spend.`;
    return { type: 'surplus', amount: round2(amount), recommendation };
  }
  const recommendation =
    abs >= 500000
      ? `Material deficit of ₹${formatLakh(abs)} — accelerate receivables collection, stagger vendor payments, and arrange a working-capital line.`
      : `Small deficit of ₹${formatLakh(abs)} — delay non-essential expenses and prioritize overdue collections.`;
  return { type: 'deficit', amount: round2(amount), recommendation };
}

// ─── Trend analysis across historical forecasts ───────────────────────────────

export interface ForecastStatsResult {
  avgInflow: number;
  avgOutflow: number;
  avgNet: number;
  trend: 'improving' | 'declining' | 'stable';
}

export function getForecastStats(forecasts: RevenueForecast[]): ForecastStatsResult {
  if (!forecasts.length) {
    return { avgInflow: 0, avgOutflow: 0, avgNet: 0, trend: 'stable' };
  }
  const sorted = [...forecasts].sort((a, b) => a.period.localeCompare(b.period));
  let avgInflow = 0;
  let avgOutflow = 0;
  let avgNet = 0;
  for (const f of sorted) {
    avgInflow += f.projectedInflow;
    avgOutflow += f.projectedOutflow;
    avgNet += f.projectedNet;
  }
  avgInflow /= sorted.length;
  avgOutflow /= sorted.length;
  avgNet /= sorted.length;

  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  if (sorted.length >= 2) {
    const firstNet = sorted[0].projectedNet;
    const lastNet = sorted[sorted.length - 1].projectedNet;
    const delta = lastNet - firstNet;
    const threshold = Math.max(5000, Math.abs(firstNet) * 0.1);
    if (delta > threshold) trend = 'improving';
    else if (delta < -threshold) trend = 'declining';
  }
  return {
    avgInflow: round2(avgInflow),
    avgOutflow: round2(avgOutflow),
    avgNet: round2(avgNet),
    trend,
  };
}

// ─── helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Formats an INR amount into Indian lakh/crore phrasing:
 *   - ≥ 1 crore  → "₹X.XX crore"
 *   - ≥ 1 lakh   → "₹X.XX lakh"
 *   - else       → "₹X,XXX" (Indian numbering)
 */
export function formatLakh(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 10000000) {
    return `${sign}₹${(abs / 10000000).toFixed(2)} crore`;
  }
  if (abs >= 100000) {
    return `${sign}₹${(abs / 100000).toFixed(2)} lakh`;
  }
  return `${sign}₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(abs)}`;
}

function buildAiSummary(inflow: number, outflow: number, net: number, period: string): string {
  const direction = net >= 0 ? 'surplus' : 'deficit';
  const abs = Math.abs(net);
  return `I've predicted a ${formatLakh(abs)} cash ${direction} for ${period}, driven by ${formatLakh(inflow)} in expected collections against ${formatLakh(outflow)} in scheduled payables.`;
}
