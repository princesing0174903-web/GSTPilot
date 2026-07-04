// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Oracle™ & AI CFO™ — Recommendation Engine
//
// A PURE, CLIENT-SAFE function that generates actionable recommendations from
// a real BusinessContext + the detected insights. Each recommendation carries
// a rationale referencing the REAL metric that triggered it.
//
// Recommendation types (deterministic):
//   • follow_up_customer   — top debtor has overdue receivables
//   • file_gstr3b / file_gstr1 — return not filed for current period
//   • pay_gst              — net GST payable > 0 and due date approaching
//   • reduce_expenses      — unusual expense spike detected
//   • send_invoice_reminder — pending invoices approaching/past due
//   • improve_cash_flow    — cash flow risk or low runway
//   • reconcile_bank       — pending bank reconciliation
//   • connect_bank         — no bank connected
//   • review_overdue       — overdue invoices or returns
//   • connect_gstn         — GSTN not connected
//
// Pure & deterministic — given the same inputs, always returns the same
// recommendations. The MockAIProvider delegates to this; future LLM providers
// may use these as structured prompts.
// ═══════════════════════════════════════════════════════════════════════════════

import type { BusinessContext, Insight, Recommendation, RecommendationPriority } from './types';
import { deterministicId, formatINR } from './knowledge';

// ─── Recommendation Engine ────────────────────────────────────────────────────

/**
 * Generate actionable recommendations from the real context + insights.
 * Returns recommendations sorted by priority (high → medium → low), capped
 * at `limit` (default 8).
 */
export function generateRecommendationsFromContext(
  context: BusinessContext,
  insights: Insight[],
  limit = 8,
): Recommendation[] {
  const recs: Recommendation[] = [];
  const { organizationId, period, asOf } = context;

  const hasInsight = (type: Insight['type']) => insights.some((i) => i.type === type);

  // ── Connect GSTN (highest priority if not connected) ──
  if (!context.gstnConnected) {
    recs.push({
      id: deterministicId('rec', organizationId, period, 'gstn'),
      organizationId,
      type: 'connect_gstn',
      priority: 'high',
      title: 'Connect GSTN for live return filing',
      description: 'Connect your GSTN account to enable live GSTR-1/3B filing, e-invoicing, and auto-reconciliation.',
      rationale: 'GSTN is not connected — returns are being tracked manually, which risks missed deadlines.',
      actionLabel: 'Connect GSTN',
      actionType: 'gstn',
      status: 'active',
      createdAt: asOf,
    });
  }

  // ── Connect Bank ──
  if (!context.bankConnected) {
    recs.push({
      id: deterministicId('rec', organizationId, period, 'bank'),
      organizationId,
      type: 'connect_bank',
      priority: 'high',
      title: 'Connect a bank account for live cash flow',
      description: 'Connect your bank to track real-time balances, auto-categorise transactions, and reconcile payments.',
      rationale: 'No bank account connected — cash flow analysis is based on invoices only.',
      actionLabel: 'Connect bank',
      actionType: 'banking',
      status: 'active',
      createdAt: asOf,
    });
  }

  // ── File GSTR-3B / GSTR-1 (overdue or due soon) ──
  if (context.gst.filingStatus === 'overdue' || context.gst.filingStatus === 'not_filed') {
    const returnType = context.gst.filingStatus === 'overdue' ? 'GSTR-3B' : 'GSTR-1';
    recs.push({
      id: deterministicId('rec', organizationId, period, 'file', returnType),
      organizationId,
      type: returnType === 'GSTR-3B' ? 'file_gstr3b' : 'file_gstr1',
      priority: context.gst.filingStatus === 'overdue' ? 'high' : 'medium',
      title: `File ${returnType} for ${period}`,
      description: `The ${returnType} return for ${period} is ${context.gst.filingStatus === 'overdue' ? 'overdue' : 'not yet filed'}. File now to avoid penalties.`,
      rationale: `Filing status: ${context.gst.filingStatus}. ${context.gst.pendingReturns} return${context.gst.pendingReturns === 1 ? '' : 's'} pending overall.`,
      actionLabel: 'Prepare return',
      actionType: 'return-prep',
      relatedEntityId: period,
      relatedEntityType: 'period',
      dueDate: context.gst.nextDueDate ?? undefined,
      status: 'active',
      createdAt: asOf,
    });
  }

  // ── Pay GST before due date ──
  if (context.gst.netPayable > 0) {
    const due = context.gst.nextDueDate;
    const daysToDue = due ? Math.round((new Date(due).getTime() - Date.now()) / 86_400_000) : null;
    const urgent = daysToDue !== null && daysToDue <= 7;
    recs.push({
      id: deterministicId('rec', organizationId, period, 'paygst'),
      organizationId,
      type: 'pay_gst',
      priority: urgent ? 'high' : 'medium',
      title: `Pay GST of ${formatINR(context.gst.netPayable)}${daysToDue !== null && daysToDue >= 0 ? ` in ${daysToDue} day${daysToDue === 1 ? '' : 's'}` : ''}`,
      description: `Net GST payable for ${period} is ${formatINR(context.gst.netPayable)} (output ${formatINR(context.gst.liability)} − ITC ${formatINR(context.gst.itcAvailable)}). Ensure funds are available before the due date.`,
      rationale: `Net GST payable: ${formatINR(context.gst.netPayable)}. Due: ${due ?? 'this period'}.`,
      actionLabel: 'Review GST',
      actionType: 'reports',
      relatedEntityId: period,
      relatedEntityType: 'period',
      dueDate: due ?? undefined,
      status: 'active',
      createdAt: asOf,
    });
  }

  // ── Follow up top debtor ──
  const topDebtor = context.customers.topDebtors[0];
  if (topDebtor && topDebtor.amount > 0) {
    recs.push({
      id: deterministicId('rec', organizationId, period, 'followup', topDebtor.id),
      organizationId,
      type: 'follow_up_customer',
      priority: context.invoices.overdueValue > 0 ? 'high' : 'medium',
      title: `Follow up ${topDebtor.name} for ${formatINR(topDebtor.amount)}`,
      description: `${topDebtor.name} has the largest outstanding balance of ${formatINR(topDebtor.amount)}. A timely follow-up could accelerate collection.`,
      rationale: `Top debtor: ${formatINR(topDebtor.amount)} outstanding. ${context.invoices.overdue} overdue invoice${context.invoices.overdue === 1 ? '' : 's'} across all customers.`,
      actionLabel: 'Open client',
      actionType: 'client-workspace',
      relatedEntityId: topDebtor.id,
      relatedEntityType: 'client',
      status: 'active',
      createdAt: asOf,
    });
  }

  // ── Send invoice reminders ──
  if (context.invoices.pending > 0 && context.invoices.overdue > 0) {
    recs.push({
      id: deterministicId('rec', organizationId, period, 'remind'),
      organizationId,
      type: 'send_invoice_reminder',
      priority: 'medium',
      title: `Send reminders for ${context.invoices.overdue} overdue invoice${context.invoices.overdue === 1 ? '' : 's'}`,
      description: `${formatINR(context.invoices.overdueValue)} is overdue across ${context.invoices.overdue} invoice${context.invoices.overdue === 1 ? '' : 's'}. Automated reminders can recover this faster.`,
      rationale: `Overdue value: ${formatINR(context.invoices.overdueValue)} across ${context.invoices.overdue} invoice${context.invoices.overdue === 1 ? '' : 's'}.`,
      actionLabel: 'Review invoices',
      actionType: 'invoices',
      status: 'active',
      createdAt: asOf,
    });
  }

  // ── Improve cash flow ──
  if (hasInsight('cash_flow_risk') || hasInsight('low_bank_balance')) {
    recs.push({
      id: deterministicId('rec', organizationId, period, 'cashflow'),
      organizationId,
      type: 'improve_cash_flow',
      priority: 'high',
      title: 'Improve cash flow',
      description: `Net cash flow is ${formatINR(context.cashFlow.netInflow)} this period. Accelerate collections, negotiate longer payment terms with vendors, or arrange short-term funding.`,
      rationale: `Net cash flow: ${formatINR(context.cashFlow.netInflow)}. Burn rate: ${formatINR(context.cashFlow.burnRate)}/month.`,
      actionLabel: 'Review cash flow',
      actionType: 'reports',
      status: 'active',
      createdAt: asOf,
    });
  }

  // ── Reduce expenses ──
  if (hasInsight('unusual_expense')) {
    const topCat = context.expenses.topCategories[0];
    recs.push({
      id: deterministicId('rec', organizationId, period, 'reduce'),
      organizationId,
      type: 'reduce_expenses',
      priority: 'medium',
      title: 'Review and reduce unnecessary expenses',
      description: `Expenses rose to ${formatINR(context.expenses.current)} this period${topCat ? `, led by ${topCat.label} (${formatINR(topCat.amount)})` : ''}. Identify non-essential spending to cut.`,
      rationale: `Expense change: +${context.expenses.changePercent.toFixed(1)}% vs last period.`,
      actionLabel: 'Review expenses',
      actionType: 'expenses',
      status: 'active',
      createdAt: asOf,
    });
  }

  // ── Reconcile bank ──
  if (context.banking.pendingReconciliation > 0) {
    recs.push({
      id: deterministicId('rec', organizationId, period, 'reconcile'),
      organizationId,
      type: 'reconcile_bank',
      priority: 'medium',
      title: `Reconcile ${context.banking.pendingReconciliation} bank transaction${context.banking.pendingReconciliation === 1 ? '' : 's'}`,
      description: `${context.banking.pendingReconciliation} bank transaction${context.banking.pendingReconciliation === 1 ? '' : 's'} need reconciliation. Matching them to invoices keeps your books accurate.`,
      rationale: `Pending reconciliation: ${context.banking.pendingReconciliation} transaction${context.banking.pendingReconciliation === 1 ? '' : 's'}.`,
      actionLabel: 'Reconcile',
      actionType: 'reconcile',
      status: 'active',
      createdAt: asOf,
    });
  }

  // ── Review overdue (catch-all if no specific rec fired) ──
  if (recs.length < 3 && (context.invoices.overdue > 0 || context.gst.pendingReturns > 0)) {
    recs.push({
      id: deterministicId('rec', organizationId, period, 'review'),
      organizationId,
      type: 'review_overdue',
      priority: 'medium',
      title: 'Review overdue items',
      description: `You have ${context.invoices.overdue} overdue invoice${context.invoices.overdue === 1 ? '' : 's'} and ${context.gst.pendingReturns} pending return${context.gst.pendingReturns === 1 ? '' : 's'}. Clear these to stay compliant.`,
      rationale: `Overdue invoices: ${context.invoices.overdue}. Pending returns: ${context.gst.pendingReturns}.`,
      actionLabel: 'Review',
      actionType: 'reconcile',
      status: 'active',
      createdAt: asOf,
    });
  }

  // ── Sort by priority and cap ──
  return recs.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority)).slice(0, limit);
}

/** Priority sort rank (lower = higher priority). */
function priorityRank(p: RecommendationPriority): number {
  switch (p) {
    case 'high': return 0;
    case 'medium': return 1;
    case 'low': return 2;
  }
}
