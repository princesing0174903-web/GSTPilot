// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Oracle™ & AI CFO™ — Scoring Engine
//
// PURE, CLIENT-SAFE functions that compute the composite Business Score and
// the Risk Score from a real BusinessContext + detected insights.
//
// Business Score (0-100, higher = better):
//   • Revenue component   — growth trend (up/stable/down)
//   • Cash flow component — net inflow + runway health
//   • Compliance component — GST filing status + bank reconciliation
//   • Collections component — overdue ratio + receivables health
//   • Risk component       — inverse of the risk score
//
// Risk Score (0-100, higher = riskier):
//   Sum of weighted risk factors (cash flow risk, GST overdue, high
//   receivables, low balance, expense spike), capped at 100.
//
// Pure & deterministic — given the same inputs, always returns the same
// scores. The MockAIProvider delegates to this.
// ═══════════════════════════════════════════════════════════════════════════════

import type { BusinessContext, BusinessScore, Insight, RiskFactor, RiskScore, ScoreGrade, ScoreTrend } from './types';
import { formatINR } from './knowledge';

// ─── Business Score ───────────────────────────────────────────────────────────

/**
 * Compute the composite Business Score (0-100) from the real context.
 */
export function computeBusinessScoreFromContext(context: BusinessContext): BusinessScore {
  const asOf = new Date().toISOString();

  // ── Revenue component (0-100) ──
  let revenue = 50;
  if (context.revenue.previous > 0) {
    const pct = context.revenue.changePercent;
    if (pct > 20) revenue = 90;
    else if (pct > 10) revenue = 80;
    else if (pct > 0) revenue = 65;
    else if (pct > -10) revenue = 45;
    else if (pct > -20) revenue = 30;
    else revenue = 15;
  } else if (context.revenue.current > 0) {
    revenue = 60; // first revenue month
  }

  // ── Cash flow component (0-100) ──
  let cashflow = 50;
  if (context.cashFlow.netInflow > 0) {
    cashflow = context.cashFlow.runwayMonths > 6 ? 90 : context.cashFlow.runwayMonths > 3 ? 75 : 60;
  } else if (context.cashFlow.netInflow < 0) {
    cashflow = context.cashFlow.runwayMonths < 1 ? 15 : context.cashFlow.runwayMonths < 3 ? 30 : 45;
  }

  // ── Compliance component (0-100) ──
  let compliance = 50;
  if (context.gst.filingStatus === 'filed') compliance = 90;
  else if (context.gst.filingStatus === 'draft') compliance = 65;
  else if (context.gst.filingStatus === 'not_filed') compliance = 45;
  else if (context.gst.filingStatus === 'overdue') compliance = 15;
  // Bank reconciliation bonus
  if (context.bankConnected) {
    if (context.banking.pendingReconciliation === 0) compliance = Math.min(100, compliance + 10);
    else compliance = Math.max(0, compliance - Math.min(15, context.banking.pendingReconciliation * 2));
  }

  // ── Collections component (0-100) ──
  let collections = 50;
  if (context.invoices.total > 0) {
    const overdueRatio = context.invoices.overdue / context.invoices.total;
    if (overdueRatio === 0) collections = 90;
    else if (overdueRatio < 0.1) collections = 75;
    else if (overdueRatio < 0.25) collections = 55;
    else if (overdueRatio < 0.5) collections = 35;
    else collections = 15;
  } else {
    collections = 70; // no invoices yet — neutral
  }

  // ── Risk component (0-100, inverse of risk score) ──
  const riskScore = computeRiskScoreFromContext(context, []).score;
  const risk = Math.max(0, 100 - riskScore);

  // ── Weighted composite ──
  const score = Math.round(
    revenue * 0.25 + cashflow * 0.25 + compliance * 0.2 + collections * 0.15 + risk * 0.15,
  );

  const grade: ScoreGrade = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : 'D';

  const trend: ScoreTrend =
    context.revenue.changePercent > 5 && context.cashFlow.netInflow > 0
      ? 'up'
      : context.revenue.changePercent < -5 || context.cashFlow.netInflow < 0
        ? 'down'
        : 'stable';

  const summary = buildBusinessScoreSummary(score, grade, { revenue, cashflow, compliance, collections, risk });

  return {
    score,
    grade,
    trend,
    components: { revenue, cashflow, compliance, collections, risk },
    summary,
    asOf,
  };
}

function buildBusinessScoreSummary(
  score: number,
  grade: ScoreGrade,
  components: { revenue: number; cashflow: number; compliance: number; collections: number; risk: number },
): string {
  const weakest = (Object.entries(components) as [string, number][]).sort((a, b) => a[1] - b[1])[0];
  const strongest = (Object.entries(components) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
  return `Grade ${grade} (${score}/100). Strongest area: ${strongest[0]}. Focus area: ${weakest[0]} (${weakest[1]}/100).`;
}

// ─── Risk Score ───────────────────────────────────────────────────────────────

/**
 * Compute the Risk Score (0-100, higher = riskier) from the real context +
 * insights. Returns the top contributing risk factors.
 */
export function computeRiskScoreFromContext(context: BusinessContext, insights: Insight[]): RiskScore {
  const asOf = new Date().toISOString();
  const factors: RiskFactor[] = [];

  // ── Cash flow risk ──
  if (context.cashFlow.netInflow < 0) {
    factors.push({
      label: 'Negative cash flow',
      impact: 30,
      detail: `Net cash flow is ${formatINR(context.cashFlow.netInflow)} this period.`,
    });
  } else if (Number.isFinite(context.cashFlow.runwayMonths) && context.cashFlow.runwayMonths < 3) {
    factors.push({
      label: 'Short runway',
      impact: 25,
      detail: `Runway is ~${context.cashFlow.runwayMonths.toFixed(1)} months at current burn.`,
    });
  }

  // ── GST filing overdue ──
  if (context.gst.filingStatus === 'overdue') {
    factors.push({
      label: 'GST filing overdue',
      impact: 25,
      detail: `The GST return for ${context.period} is overdue — penalties and interest apply.`,
    });
  }

  // ── High receivables / customers delaying ──
  if (context.outstanding.receivables > 0 && context.invoices.overdueValue / context.outstanding.receivables > 0.3) {
    factors.push({
      label: 'Customers delaying payments',
      impact: 20,
      detail: `${formatINR(context.invoices.overdueValue)} of ${formatINR(context.outstanding.receivables)} receivables is overdue.`,
    });
  }

  // ── Low bank balance ──
  if (context.bankConnected && Number.isFinite(context.cashFlow.runwayMonths) && context.cashFlow.runwayMonths < 1) {
    factors.push({
      label: 'Low bank balance',
      impact: 25,
      detail: `Available balance ${formatINR(context.banking.availableBalance)} covers less than 1 month of outflows.`,
    });
  }

  // ── Expense spike ──
  if (context.expenses.previous > 0 && context.expenses.changePercent > 50) {
    factors.push({
      label: 'Expense spike',
      impact: 15,
      detail: `Expenses up ${context.expenses.changePercent.toFixed(0)}% vs last period.`,
    });
  }

  // ── High GST liability ──
  if (context.revenue.current > 0 && context.gst.netPayable > context.revenue.current * 0.5) {
    factors.push({
      label: 'High GST liability',
      impact: 15,
      detail: `Net GST payable is ${formatINR(context.gst.netPayable)}, over 50% of revenue.`,
    });
  }

  // ── Insight-driven risk (critical insights add risk) ──
  const criticalInsights = insights.filter((i) => i.severity === 'critical');
  for (const ins of criticalInsights) {
    // Avoid duplicating factors already added above.
    if (factors.some((f) => f.label.toLowerCase().includes(ins.category))) continue;
    factors.push({
      label: ins.title,
      impact: 10,
      detail: ins.description,
    });
  }

  // ── Sum & cap ──
  const raw = factors.reduce((acc, f) => acc + f.impact, 0);
  const score = Math.min(100, Math.max(0, Math.round(raw)));

  const level = score >= 60 ? 'critical' : score >= 40 ? 'high' : score >= 20 ? 'medium' : 'low';

  // Sort factors by impact descending, cap at 5.
  const topFactors = factors.sort((a, b) => b.impact - a.impact).slice(0, 5);

  const summary =
    score === 0
      ? 'No significant risks detected — your business is in a healthy position.'
      : `Risk level: ${level} (${score}/100). Top risk: ${topFactors[0]?.label ?? 'none'}.`;

  return { score, level, factors: topFactors, summary, asOf };
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

import type { Alert, AlertSeverity, AlertSource } from './types';
import { deterministicId } from './knowledge';

/**
 * Derive time-sensitive alerts from the context + insights.
 * Only the most urgent items (critical / warning insights) become alerts.
 */
export function generateAlertsFromContext(
  context: BusinessContext,
  insights: Insight[],
): Alert[] {
  const alerts: Alert[] = [];
  const asOf = new Date().toISOString();
  const { organizationId, period } = context;

  for (const ins of insights) {
    if (ins.severity !== 'critical' && ins.severity !== 'warning') continue;
    const severity: AlertSeverity = ins.severity === 'critical' ? 'critical' : 'warning';
    const source: AlertSource = mapCategoryToSource(ins.category);
    alerts.push({
      id: deterministicId('alert', organizationId, period, ins.type),
      organizationId,
      severity,
      title: ins.title,
      description: ins.description,
      source,
      actionLabel: mapTypeToAction(ins.type).label,
      actionType: mapTypeToAction(ins.type).type,
      createdAt: asOf,
    });
  }

  // Also add an info alert for the nearest deadline if within 7 days.
  const nextDeadline = context.deadlines.upcoming[0];
  if (nextDeadline && nextDeadline.daysRemaining <= 7) {
    alerts.push({
      id: deterministicId('alert', organizationId, period, 'deadline', nextDeadline.label),
      organizationId,
      severity: nextDeadline.daysRemaining <= 2 ? 'critical' : 'warning',
      title: `Deadline approaching: ${nextDeadline.label}`,
      description: `${nextDeadline.label} is due in ${nextDeadline.daysRemaining} day${nextDeadline.daysRemaining === 1 ? '' : 's'} (${new Date(nextDeadline.date).toLocaleDateString('en-IN')}).`,
      source: 'compliance',
      actionLabel: 'Review',
      actionType: 'tasks',
      createdAt: asOf,
    });
  }

  // Sort by severity (critical first), cap at 6.
  return alerts
    .sort((a, b) => (a.severity === 'critical' ? 0 : 1) - (b.severity === 'critical' ? 0 : 1))
    .slice(0, 6);
}

function mapCategoryToSource(category: Insight['category']): AlertSource {
  switch (category) {
    case 'gst':
    case 'compliance':
      return 'gst';
    case 'banking':
    case 'cashflow':
      return 'banking';
    case 'invoices':
    case 'customers':
      return 'invoices';
    default:
      return 'ai';
  }
}

function mapTypeToAction(type: Insight['type']): { label: string; type: string } {
  switch (type) {
    case 'cash_flow_risk':
    case 'low_bank_balance':
      return { label: 'Review cash flow', type: 'reports' };
    case 'high_gst_liability':
    case 'gst_filing_overdue':
      return { label: 'Review GST', type: 'return-prep' };
    case 'customers_delaying':
    case 'high_receivables':
      return { label: 'Follow up', type: 'invoices' };
    case 'unusual_expense':
    case 'large_withdrawal':
      return { label: 'Review expenses', type: 'expenses' };
    case 'duplicate_invoice':
    case 'duplicate_expense':
      return { label: 'Review', type: 'reconcile' };
    default:
      return { label: 'Review', type: 'dashboard' };
  }
}
