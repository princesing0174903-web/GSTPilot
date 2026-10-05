// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Oracle™ & AI CFO™ — Insight Engine
//
// A PURE, CLIENT-SAFE function that detects business events from a real
// BusinessContext. Every insight references the REAL metric it was derived
// from — no fabricated values.
//
// Detection rules (deterministic):
//   • revenue_increase / revenue_decrease — period-over-period change > 10%
//   • cash_flow_risk — net inflow negative OR runway < 1 month
//   • high_gst_liability — net GST payable > 50% of revenue
//   • customers_delaying — overdue receivables > 30% of receivables
//   • unusual_expense — expense spike > 50% vs previous period
//   • large_withdrawal — (detected by orchestrator from bank txns, passed via context)
//   • duplicate_invoice / duplicate_expense — same amount + party (detected by orchestrator)
//   • low_bank_balance — available balance < 1 month burn
//   • high_receivables — receivables > 40% of revenue
//   • high_payables — payables > 40% of revenue
//   • gst_filing_overdue — filing status overdue
//   • positive_growth — composite positive signal
//
// Pure & deterministic — given the same context, always returns the same
// insights. The MockAIProvider delegates to this; future LLM providers may
// use these as structured prompts.
// ═══════════════════════════════════════════════════════════════════════════════

import type { BusinessContext, Insight, InsightSeverity, InsightType } from './types';
import { deterministicId, formatINR, formatPercent } from './knowledge';

// ─── Thresholds (tunable, deterministic) ──────────────────────────────────────

const REVENUE_CHANGE_THRESHOLD_PCT = 10;     // ±10% triggers an insight
const EXPENSE_SPIKE_THRESHOLD_PCT = 50;      // +50% vs previous = unusual
const HIGH_GST_LIABILITY_RATIO = 0.5;        // net payable > 50% of revenue
const CUSTOMERS_DELAYING_RATIO = 0.3;        // overdue > 30% of receivables
const HIGH_RECEIVABLES_RATIO = 0.4;          // receivables > 40% of revenue
const HIGH_PAYABLES_RATIO = 0.4;             // payables > 40% of revenue
const LOW_BALANCE_RUNWAY_MONTHS = 1;         // < 1 month runway = low balance
const LARGE_WITHDRAWAL_RATIO = 0.2;          // outflow > 20% of balance = large

// ─── Insight Engine ───────────────────────────────────────────────────────────

/**
 * Detect business insights from a real BusinessContext.
 * Returns insights sorted by severity (critical → warning → positive → info).
 */
export function generateInsightsFromContext(context: BusinessContext): Insight[] {
  const insights: Insight[] = [];
  const { organizationId, period, asOf } = context;

  // ── Revenue change ──
  if (context.revenue.previous > 0) {
    const pct = context.revenue.changePercent;
    if (Math.abs(pct) >= REVENUE_CHANGE_THRESHOLD_PCT) {
      const increasing = pct > 0;
      insights.push({
        id: deterministicId('ins', organizationId, period, 'rev', increasing ? 'up' : 'down'),
        organizationId,
        type: increasing ? 'revenue_increase' : 'revenue_decrease',
        severity: increasing ? 'positive' : 'warning',
        title: increasing ? 'Revenue is trending up' : 'Revenue has dropped',
        description: `Revenue for ${period} is ${formatINR(context.revenue.current)}, ${formatPercent(pct)} vs ${formatINR(context.revenue.previous)} last month across ${context.revenue.invoiceCount} invoice${context.revenue.invoiceCount === 1 ? '' : 's'}.`,
        category: 'revenue',
        metric: context.revenue.current,
        metricLabel: 'Revenue',
        changePercent: pct,
        createdAt: asOf,
      });
    }
  }

  // ── Cash flow risk ──
  if (context.cashFlow.netInflow < 0 || context.cashFlow.runwayMonths < LOW_BALANCE_RUNWAY_MONTHS) {
    const runwayFinite = Number.isFinite(context.cashFlow.runwayMonths);
    insights.push({
      id: deterministicId('ins', organizationId, period, 'cashflow'),
      organizationId,
      type: 'cash_flow_risk',
      severity: 'critical',
      title: 'Cash flow risk detected',
      description: `Net cash flow is ${formatINR(context.cashFlow.netInflow)} this period${runwayFinite ? ` and at the current burn rate of ${formatINR(context.cashFlow.burnRate)}/month, runway is ~${context.cashFlow.runwayMonths.toFixed(1)} months` : ''}. Consider accelerating collections or reducing outflows.`,
      category: 'cashflow',
      metric: context.cashFlow.netInflow,
      metricLabel: 'Net Cash Flow',
      createdAt: asOf,
    });
  }

  // ── High GST liability ──
  if (context.revenue.current > 0 && context.gst.netPayable > context.revenue.current * HIGH_GST_LIABILITY_RATIO) {
    insights.push({
      id: deterministicId('ins', organizationId, period, 'gst'),
      organizationId,
      type: 'high_gst_liability',
      severity: 'warning',
      title: 'High GST liability this period',
      description: `Net GST payable is ${formatINR(context.gst.netPayable)} (output ${formatINR(context.gst.liability)} − ITC ${formatINR(context.gst.itcAvailable)}), which is ${((context.gst.netPayable / context.revenue.current) * 100).toFixed(0)}% of revenue. Ensure funds are available before the due date.`,
      category: 'gst',
      metric: context.gst.netPayable,
      metricLabel: 'Net GST Payable',
      createdAt: asOf,
    });
  }

  // ── Customers delaying payments ──
  if (context.outstanding.receivables > 0 && context.invoices.overdueValue / context.outstanding.receivables > CUSTOMERS_DELAYING_RATIO) {
    insights.push({
      id: deterministicId('ins', organizationId, period, 'delay'),
      organizationId,
      type: 'customers_delaying',
      severity: 'warning',
      title: 'Customers are delaying payments',
      description: `${formatINR(context.invoices.overdueValue)} of ${formatINR(context.outstanding.receivables)} in receivables is overdue across ${context.invoices.overdue} invoice${context.invoices.overdue === 1 ? '' : 's'}. Follow up to protect cash flow.`,
      category: 'customers',
      metric: context.invoices.overdueValue,
      metricLabel: 'Overdue Receivables',
      createdAt: asOf,
    });
  }

  // ── Unusual expense ──
  if (context.expenses.previous > 0 && context.expenses.changePercent > EXPENSE_SPIKE_THRESHOLD_PCT) {
    const topCat = context.expenses.topCategories[0];
    insights.push({
      id: deterministicId('ins', organizationId, period, 'exp'),
      organizationId,
      type: 'unusual_expense',
      severity: 'warning',
      title: 'Expense spike detected',
      description: `Expenses rose ${formatPercent(context.expenses.changePercent)} to ${formatINR(context.expenses.current)} vs ${formatINR(context.expenses.previous)} last period${topCat ? `, led by ${topCat.label} (${formatINR(topCat.amount)})` : ''}. Review for unnecessary spending.`,
      category: 'expense',
      metric: context.expenses.current,
      metricLabel: 'Expenses',
      changePercent: context.expenses.changePercent,
      createdAt: asOf,
    });
  }

  // ── Large withdrawal ──
  if (context.banking.totalBalance > 0 && context.banking.outgoingPayments > context.banking.totalBalance * LARGE_WITHDRAWAL_RATIO) {
    insights.push({
      id: deterministicId('ins', organizationId, period, 'withdraw'),
      organizationId,
      type: 'large_withdrawal',
      severity: 'warning',
      title: 'Large bank outflow detected',
      description: `Outgoing payments of ${formatINR(context.banking.outgoingPayments)} this period represent ${((context.banking.outgoingPayments / context.banking.totalBalance) * 100).toFixed(0)}% of your total bank balance of ${formatINR(context.banking.totalBalance)}. Verify these transactions.`,
      category: 'banking',
      metric: context.banking.outgoingPayments,
      metricLabel: 'Outgoing Payments',
      createdAt: asOf,
    });
  }

  // ── Low bank balance ──
  if (context.banking.availableBalance > 0 && context.cashFlow.burnRate > 0 && context.cashFlow.runwayMonths < LOW_BALANCE_RUNWAY_MONTHS) {
    insights.push({
      id: deterministicId('ins', organizationId, period, 'lowbal'),
      organizationId,
      type: 'low_bank_balance',
      severity: 'critical',
      title: 'Bank balance is low',
      description: `Available bank balance is ${formatINR(context.banking.availableBalance)}, which covers less than ${LOW_BALANCE_RUNWAY_MONTHS} month${LOW_BALANCE_RUNWAY_MONTHS === 1 ? '' : 's'} of outflows at the current burn rate of ${formatINR(context.cashFlow.burnRate)}/month.`,
      category: 'banking',
      metric: context.banking.availableBalance,
      metricLabel: 'Available Balance',
      createdAt: asOf,
    });
  }

  // ── High receivables ──
  if (context.revenue.current > 0 && context.outstanding.receivables > context.revenue.current * HIGH_RECEIVABLES_RATIO) {
    insights.push({
      id: deterministicId('ins', organizationId, period, 'rec'),
      organizationId,
      type: 'high_receivables',
      severity: 'info',
      title: 'Receivables are building up',
      description: `Outstanding receivables of ${formatINR(context.outstanding.receivables)} equal ${((context.outstanding.receivables / context.revenue.current) * 100).toFixed(0)}% of current revenue. Tighter payment terms could free up cash.`,
      category: 'invoices',
      metric: context.outstanding.receivables,
      metricLabel: 'Receivables',
      createdAt: asOf,
    });
  }

  // ── High payables ──
  if (context.revenue.current > 0 && context.outstanding.payables > context.revenue.current * HIGH_PAYABLES_RATIO) {
    insights.push({
      id: deterministicId('ins', organizationId, period, 'pay'),
      organizationId,
      type: 'high_payables',
      severity: 'info',
      title: 'Payables are elevated',
      description: `Outstanding payables of ${formatINR(context.outstanding.payables)} equal ${((context.outstanding.payables / context.revenue.current) * 100).toFixed(0)}% of current revenue. Schedule payments to avoid straining vendor relationships.`,
      category: 'invoices',
      metric: context.outstanding.payables,
      metricLabel: 'Payables',
      createdAt: asOf,
    });
  }

  // ── GST filing overdue ──
  if (context.gst.filingStatus === 'overdue') {
    insights.push({
      id: deterministicId('ins', organizationId, period, 'gstover'),
      organizationId,
      type: 'gst_filing_overdue',
      severity: 'critical',
      title: 'GST return is overdue',
      description: `The GST return for ${period} is overdue. Late filing attracts penalties and interest — file immediately.`,
      category: 'compliance',
      metric: context.gst.pendingReturns,
      metricLabel: 'Pending Returns',
      createdAt: asOf,
    });
  }

  // ── Positive growth (composite) ──
  if (
    context.revenue.changePercent > REVENUE_CHANGE_THRESHOLD_PCT &&
    context.profit.margin > 0.1 &&
    context.cashFlow.netInflow > 0
  ) {
    insights.push({
      id: deterministicId('ins', organizationId, period, 'pos'),
      organizationId,
      type: 'positive_growth',
      severity: 'positive',
      title: 'Business is growing healthily',
      description: `Revenue is up ${formatPercent(context.revenue.changePercent)} with a ${(context.profit.margin * 100).toFixed(0)}% margin and positive cash flow of ${formatINR(context.cashFlow.netInflow)}. Keep up the momentum.`,
      category: 'revenue',
      metric: context.profit.current,
      metricLabel: 'Profit',
      changePercent: context.revenue.changePercent,
      createdAt: asOf,
    });
  }

  // ── Sort by severity ──
  return insights.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}

/** Severity sort rank (lower = more urgent). */
function severityRank(s: InsightSeverity): number {
  switch (s) {
    case 'critical': return 0;
    case 'warning': return 1;
    case 'positive': return 2;
    case 'info': return 3;
  }
}

/**
 * Detect duplicate invoices/expenses from a raw invoice snapshot.
 * Returns insight-shaped entries the orchestrator can merge in.
 * (Called by the orchestrator which has access to raw invoices.)
 */
export function detectDuplicateInvoices(
  organizationId: string,
  period: string,
  invoices: { id: string; kind: string; grandTotal: number; partyName?: string; invoiceDate: string }[],
): Insight[] {
  const asOf = new Date().toISOString();
  const insights: Insight[] = [];
  const groups = new Map<string, typeof invoices>();

  for (const inv of invoices) {
    const key = `${(inv.partyName || '').toLowerCase().trim()}|${Math.round(inv.grandTotal)}`;
    const arr = groups.get(key) ?? [];
    arr.push(inv);
    groups.set(key, arr);
  }

  for (const [, arr] of groups) {
    if (arr.length < 2) continue;
    const kind = arr[0].kind === 'purchase' ? 'expense' : 'invoice';
    insights.push({
      id: deterministicId('ins', organizationId, period, 'dup', kind, Math.round(arr[0].grandTotal)),
      organizationId,
      type: kind === 'expense' ? 'duplicate_expense' : 'duplicate_invoice',
      severity: 'warning',
      title: `Possible duplicate ${kind} detected`,
      description: `${arr.length} ${kind}s for ${arr[0].partyName || 'the same party'} at ${formatINR(arr[0].grandTotal)} each. Verify these are genuine and not duplicates.`,
      category: kind === 'expense' ? 'expense' : 'invoices',
      metric: arr[0].grandTotal,
      metricLabel: 'Amount',
      createdAt: asOf,
    });
  }

  return insights;
}

/** Re-export the threshold constants for diagnostics. */
export const INSIGHT_THRESHOLDS = {
  REVENUE_CHANGE_THRESHOLD_PCT,
  EXPENSE_SPIKE_THRESHOLD_PCT,
  HIGH_GST_LIABILITY_RATIO,
  CUSTOMERS_DELAYING_RATIO,
  HIGH_RECEIVABLES_RATIO,
  HIGH_PAYABLES_RATIO,
  LOW_BALANCE_RUNWAY_MONTHS,
  LARGE_WITHDRAWAL_RATIO,
} as const;

/** Re-export the InsightType union for consumers. */
export type { InsightType };
