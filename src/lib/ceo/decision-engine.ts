// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI CEO™ — EXECUTIVE DECISION ENGINE™
//
// Oracle continuously evaluates the live business state and proposes decisions
// across 30 categories: recover payments, file GST, claim ITC, hire, take a
// loan, pause marketing, etc. Every decision is grounded in REAL data from
// CFO Phase 1 + Digital Twin + raw Prisma records.
//
// Each decision carries:
//   • Reason          — why Oracle is proposing this now
//   • Financial Impact — expected ₹ effect (positive = save/gain, negative = spend)
//   • Confidence      — 0-100 (data volume + signal strength)
//   • Priority        — critical / high / medium / low
//   • Risk            — none / low / medium / high / critical
//   • Business Impact — narrative
//   • Rollback Plan   — how to undo if it goes wrong
//   • Approval + Role — minimum role that must approve
//
// Tagline: VEYRO AI CEO™ — Run Your Business. Not Your Software.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  ExecutiveDecision,
  DecisionAction,
  DecisionEvidence,
  DecisionType,
  DecisionPriority,
} from './types';
import { resolveApprovalRequirement, isAutoApprovable } from './policy';
import type { CEODataView } from './data';
import { formatINR, formatINRFull } from './data';

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Deterministic ID generator: same decision content → same ID across refreshes.
// This is critical for the in-memory decision store: when the user approves a
// decision and the dashboard refreshes, the decision must retain its approved
// status. Using Date.now() would generate a new ID on every refresh, losing
// the user's approval state.
function decisionId(type: DecisionType, entityId?: string): string {
  // Hash the type + optional entityId into a stable suffix
  const seed = `${type}:${entityId ?? 'default'}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0; // force 32-bit
  }
  return `ceo-dec-${type}-${Math.abs(hash).toString(36)}`;
}

function confidenceFrom(dataPoints: number, base = 60): number {
  // More data points → higher confidence (capped at 95 — never 100% certain)
  return Math.min(95, Math.round(base + Math.min(35, dataPoints * 3)));
}

function priorityFrom(daysLate: number, impact: number): DecisionPriority {
  if (daysLate > 60 || impact > 500000) return 'critical';
  if (daysLate > 30 || impact > 100000) return 'high';
  if (daysLate > 7 || impact > 10000) return 'medium';
  return 'low';
}

function evidence(source: string, fact: string, value?: number): DecisionEvidence {
  return { source, fact, value };
}

function action(
  label: string,
  description: string,
  agent: string,
  estimatedMinutes: number,
  automated: boolean,
  destructive = false,
): DecisionAction {
  return { label, description, agent, estimatedMinutes, automated, destructive };
}

// ─── Decision builders ───────────────────────────────────────────────────────
// Each builder returns null when the trigger condition is not met (so the
// orchestrator only surfaces live decisions).

function buildRecoverPayment(data: CEODataView): ExecutiveDecision | null {
  const overdue = data.cfo.collections.latePayments.filter((l) => l.daysOverdue > 0);
  if (overdue.length === 0) return null;

  const top = overdue[0];
  const impact = top.outstandingAmount ?? top.invoiceAmount ?? 0;
  if (impact <= 0) return null;

  const daysLate = top.daysOverdue;
  const confidence = confidenceFrom(overdue.length, 70);
  const priority = priorityFrom(daysLate, impact);
  const { requirement, requiresRole, risk } = resolveApprovalRequirement('recover_payment', impact);

  return {
    id: decisionId('recover_payment', top.invoiceId),
    type: 'recover_payment',
    title: `Recover ${formatINR(impact)} from ${top.clientName ?? 'a client'}`,
    reason: `${top.clientName ?? 'A client'} has an invoice ${daysLate} days overdue (₹${Math.round(impact).toLocaleString('en-IN')}). The longer it stays unpaid, the lower the recovery probability.`,
    financialImpact: impact,
    financialImpactLabel: `Recover ${formatINRFull(impact)} in overdue receivables`,
    confidence,
    priority,
    risk,
    businessImpact: `Immediate cash inflow of ${formatINR(impact)}. Improves runway by ~${Math.round(impact / (data.liveState.burnRate / 30 || 1))} days at current burn.`,
    rollbackPlan: 'If the client disputes, pause follow-up and escalate to a demand letter. Recovery attempts have no financial downside.',
    approvalRequired: requirement,
    requiresRole,
    actions: [
      action('Send reminder email', `Send a polite reminder to ${top.clientName} with the invoice attached.`, 'oracle', 5, true),
      action('Schedule a call', `If no reply in 48 hours, schedule a recovery call with ${top.clientName}.`, 'oracle', 15, false),
      action('Escalate to demand letter', `If still unpaid after 7 days, send a formal demand letter.`, 'cfo_agent', 30, false),
    ],
    relatedEntityType: 'invoice',
    relatedEntityId: top.invoiceId ?? top.invoiceNumber,
    relatedEntityLabel: top.invoiceNumber,
    evidence: [
      evidence('invoice', `Invoice ${top.invoiceNumber} is ${daysLate} days overdue`, impact),
      evidence('collection_engine', `Collection probability: ${top.collectionProbabilityPct}%`, top.collectionProbabilityPct),
      evidence('cfo_phase1', `Total overdue receivables: ${formatINR(data.cfo.collections.overdueAmount)}`, data.cfo.collections.overdueAmount),
      evidence('cfo_phase1', `Total outstanding: ${formatINR(data.cfo.collections.totalOutstanding)}`, data.cfo.collections.totalOutstanding),
    ],
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

function buildRemindClient(data: CEODataView): ExecutiveDecision | null {
  // Due-soon invoices (not yet overdue, but due within 3 days)
  const dueSoon = data.raw.invoices.filter((i) => {
    if (i.paymentStatus === 'paid' || !i.dueDate) return false;
    const due = new Date(i.dueDate);
    const diff = (due.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    return diff >= 0 && diff <= 3;
  });
  if (dueSoon.length === 0) return null;

  const inv = dueSoon[0];
  const impact = inv.balanceAmount ?? inv.totalAmount ?? 0;
  // Note: Invoice table uses balanceAmount (Phase 8 Invoice Cloud™). CollectionRow uses outstandingAmount.
  const client = data.raw.clients.find((c) => c.id === inv.clientId);
  const { requirement, requiresRole, risk } = resolveApprovalRequirement('remind_client', impact);

  return {
    id: decisionId('remind_client', inv.id),
    type: 'remind_client',
    title: `Send payment reminder to ${client?.tradeName ?? 'client'}`,
    reason: `Invoice ${inv.invoiceNumber} (${formatINR(impact)}) is due in ≤3 days. A friendly reminder now maximises on-time payment.`,
    financialImpact: impact,
    financialImpactLabel: `Protect ${formatINRFull(impact)} from going overdue`,
    confidence: confidenceFrom(dueSoon.length, 75),
    priority: 'medium',
    risk,
    businessImpact: 'Reduces Days Sales Outstanding and prevents future overdue-chase cycles.',
    rollbackPlan: 'Reminders are non-destructive. If the client has already paid, simply acknowledge.',
    approvalRequired: requirement,
    requiresRole,
    actions: [
      action('Send reminder email', `Send a polite reminder with invoice ${inv.invoiceNumber} attached.`, 'oracle', 5, true),
    ],
    relatedEntityType: 'invoice',
    relatedEntityId: inv.id,
    relatedEntityLabel: inv.invoiceNumber,
    evidence: [
      evidence('invoice', `Invoice ${inv.invoiceNumber} due ${inv.dueDate}`, impact),
    ],
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

function buildFileOverdueReturn(data: CEODataView): ExecutiveDecision | null {
  const overdue = data.raw.filings.filter((f) => {
    if (f.status === 'filed') return false;
    return f.status !== 'filed' && data.cfo.gst.overdueFilings > 0;
  });
  if (overdue.length === 0 && data.cfo.gst.overdueFilings === 0) return null;

  const filing = overdue[0] ?? data.raw.filings.find((f) => f.status !== 'filed');
  if (!filing) return null;

  const impact = data.cfo.gst.netGSTPayable;
  const { requirement, requiresRole, risk } = resolveApprovalRequirement('file_overdue_return', impact);

  return {
    id: decisionId('file_overdue_return', filing.id),
    type: 'file_overdue_return',
    title: `File overdue ${filing.returnType} for ${filing.period}`,
    reason: `${filing.returnType} for period ${filing.period} is not filed. Late filing attracts ₹50/day penalty + 18% interest.`,
    financialImpact: -Math.abs(impact),
    financialImpactLabel: `Avoid ₹50/day penalty + 18% interest on ${formatINRFull(impact)}`,
    confidence: confidenceFrom(data.raw.filings.length, 85),
    priority: 'critical',
    risk,
    businessImpact: 'Avoids escalating late-filing penalties, interest, and GSTN notice risk. Restores compliance score.',
    rollbackPlan: 'A filed return can be revised via GSTR-1A / rectification if a mistake is found.',
    approvalRequired: requirement,
    requiresRole,
    actions: [
      action('Prepare return JSON', `Auto-generate ${filing.returnType} JSON from invoices for ${filing.period}.`, 'gst_agent', 20, true),
      action('File on GSTN', `Submit the return on the GSTN portal.`, 'gst_agent', 15, false),
      action('Confirm acknowledgement', `Verify the ARN is generated and store it.`, 'gst_agent', 5, false),
    ],
    relatedEntityType: 'gstr_filing',
    relatedEntityId: filing.id,
    relatedEntityLabel: `${filing.returnType} ${filing.period}`,
    evidence: [
      evidence('gst', `Pending filings: ${data.cfo.gst.pendingFilings}`, data.cfo.gst.pendingFilings),
      evidence('gst', `Overdue filings: ${data.cfo.gst.overdueFilings}`, data.cfo.gst.overdueFilings),
      evidence('gst', `Net GST payable: ${formatINR(impact)}`, impact),
    ],
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

function buildClaimITC(data: CEODataView): ExecutiveDecision | null {
  const itc = data.cfo.gst.inputTaxCredit;
  if (itc <= 0) return null;

  const atRisk = data.cfo.gst.itcAtRisk;
  const { requirement, requiresRole, risk } = resolveApprovalRequirement('claim_itc', itc);

  return {
    id: decisionId('claim_itc', 'itc-pool'),
    type: 'claim_itc',
    title: `Claim ${formatINR(itc)} in pending Input Tax Credit`,
    reason: `${formatINR(itc)} of ITC is available from purchase bills but not yet claimed. ITC not claimed within the statutory timeline lapses permanently.`,
    financialImpact: itc,
    financialImpactLabel: `Save ${formatINRFull(itc)} in cash outflow (reduces net GST payable)`,
    confidence: confidenceFrom(data.raw.purchaseBills.length, 80),
    priority: atRisk > 0 ? 'high' : 'medium',
    risk,
    businessImpact: `Reduces net GST payable from ${formatINR(data.cfo.gst.netGSTPayable)} to ${formatINR(Math.max(0, data.cfo.gst.netGSTPayable - itc))}.`,
    rollbackPlan: 'ITC claims can be reversed in subsequent returns if a vendor invoice is found invalid.',
    approvalRequired: requirement,
    requiresRole,
    actions: [
      action('Reconcile 2A/2B', `Match purchase bills with GSTR-2B before claiming.`, 'gst_agent', 30, true),
      action('Claim ITC in GSTR-3B', `Report eligible ITC in the next GSTR-3B filing.`, 'gst_agent', 15, false),
    ],
    relatedEntityType: 'gst',
    relatedEntityLabel: 'Input Tax Credit',
    evidence: [
      evidence('gst', `ITC available: ${formatINR(itc)}`, itc),
      evidence('gst', `ITC at risk of lapse: ${formatINR(atRisk)}`, atRisk),
      evidence('gst', `Current net GST payable: ${formatINR(data.cfo.gst.netGSTPayable)}`, data.cfo.gst.netGSTPayable),
    ],
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

function buildPayGST(data: CEODataView): ExecutiveDecision | null {
  const payable = data.cfo.gst.netGSTPayable;
  if (payable <= 0) return null;

  const upcoming = data.cfo.gst.upcomingDueDates.find((d) => d.daysLeft <= 7);
  if (!upcoming) return null;

  const { requirement, requiresRole, risk } = resolveApprovalRequirement('pay_gst', payable);

  return {
    id: decisionId('pay_gst', upcoming.period),
    type: 'pay_gst',
    title: `Pay ${formatINR(payable)} GST for ${upcoming.period}`,
    reason: `${upcoming.returnType} for ${upcoming.period} is due in ${upcoming.daysLeft} day(s). Net GST payable: ${formatINR(payable)}.`,
    financialImpact: -Math.abs(payable),
    financialImpactLabel: `Pay ${formatINRFull(payable)} to avoid 18% interest + penalty`,
    confidence: confidenceFrom(data.raw.filings.length, 85),
    priority: upcoming.daysLeft <= 2 ? 'critical' : 'high',
    risk,
    businessImpact: 'Avoids 18% annual interest on unpaid GST + late fee of ₹50/day. Protects compliance score.',
    rollbackPlan: 'GST payments are non-reversible. Verify liability before payment.',
    approvalRequired: requirement,
    requiresRole,
    actions: [
      action('Generate challan', `Create GST payment challan on GSTN for ${formatINR(payable)}.`, 'gst_agent', 10, true),
      action('Make payment', `Pay via net-banking / UPI from the linked bank account.`, 'gst_agent', 10, false, true),
      action('File GSTR-3B', `File the return referencing the paid challan.`, 'gst_agent', 15, false),
    ],
    relatedEntityType: 'gst',
    relatedEntityLabel: `${upcoming.returnType} ${upcoming.period}`,
    evidence: [
      evidence('gst', `Net GST payable: ${formatINR(payable)}`, payable),
      evidence('gst', `Due in ${upcoming.daysLeft} day(s)`, upcoming.daysLeft),
    ],
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(upcoming.dueDate).toISOString(),
  };
}

function buildDelayHiring(data: CEODataView): ExecutiveDecision | null {
  const runway = data.liveState.runwayDays;
  const profitMargin = data.cfo.profitability.netMarginPct;
  // Suggest delaying hiring when runway < 90 days OR profit margin < 5%
  if (runway >= 90 && profitMargin >= 5) return null;

  const { requirement, requiresRole, risk } = resolveApprovalRequirement('delay_hiring', 0);

  return {
    id: decisionId('delay_hiring', 'headcount-plan'),
    type: 'delay_hiring',
    title: 'Delay new hiring for 60 days',
    reason: `Runway is ${runway} days and net margin is ${profitMargin.toFixed(1)}%. Hiring now would increase burn and accelerate cash depletion.`,
    financialImpact: data.liveState.burnRate * 2, // 2 months of new-hire cost saved
    financialImpactLabel: `Avoid ${formatINRFull(data.liveState.burnRate * 2)} in additional burn over 60 days`,
    confidence: confidenceFrom(data.raw.employees.length + 1, 70),
    priority: runway < 30 ? 'critical' : 'high',
    risk,
    businessImpact: `Extends runway by ~${Math.round((data.liveState.burnRate * 2) / (data.liveState.burnRate / 30 || 1))} days. Buys time to recover receivables first.`,
    rollbackPlan: 'Hiring freeze is reversible at any time. Re-evaluate when runway > 120 days or receivables recover.',
    approvalRequired: requirement,
    requiresRole,
    actions: [
      action('Pause open roles', 'Mark all open positions as on-hold in the HR system.', 'oracle', 10, true),
      action('Notify recruiters', 'Inform talent partners about the 60-day pause.', 'oracle', 5, true),
    ],
    relatedEntityType: 'hr',
    relatedEntityLabel: 'Headcount plan',
    evidence: [
      evidence('cfo_phase1', `Runway: ${runway} days`, runway),
      evidence('cfo_phase1', `Net margin: ${profitMargin.toFixed(1)}%`, profitMargin),
      evidence('twin', `Burn rate: ${formatINR(data.liveState.burnRate)}/mo`, data.liveState.burnRate),
    ],
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

function buildSuggestLoan(data: CEODataView): ExecutiveDecision | null {
  const runway = data.liveState.runwayDays;
  if (runway >= 60) return null;

  const cashGap = Math.max(0, data.liveState.burnRate * 3 - data.liveState.cash);
  if (cashGap <= 0) return null;

  const { requirement, requiresRole, risk } = resolveApprovalRequirement('suggest_loan', cashGap);

  return {
    id: decisionId('suggest_loan', 'wc-loan'),
    type: 'suggest_loan',
    title: `Arrange ${formatINR(cashGap)} working-capital loan`,
    reason: `Runway is only ${runway} days. A working-capital loan of ${formatINR(cashGap)} would extend operations by ~90 days while receivables recover.`,
    financialImpact: -cashGap,
    financialImpactLabel: `Borrow ${formatINRFull(cashGap)} (cost ~${formatINR(cashGap * 0.12)} at 12% p.a.)`,
    confidence: confidenceFrom(data.raw.dataConnections.length + 1, 60),
    priority: runway < 30 ? 'critical' : 'high',
    risk,
    businessImpact: `Extends runway to ~${runway + 90} days. Interest cost ~${formatINR(cashGap * 0.12)}/year.`,
    rollbackPlan: 'Loan can be prepaid from recovered receivables. No prepayment penalty on most WC facilities.',
    approvalRequired: requirement,
    requiresRole,
    actions: [
      action('Compare lenders', 'Fetch offers from 3+ lenders via the Financing Marketplace.', 'oracle', 30, true),
      action('Prepare documents', 'Compile last 6 months bank statements + GST returns.', 'oracle', 60, false),
      action('Submit application', 'Apply to the best-rate lender.', 'cfo_agent', 30, false, true),
    ],
    relatedEntityType: 'finance',
    relatedEntityLabel: 'Working-capital loan',
    evidence: [
      evidence('cfo_phase1', `Runway: ${runway} days`, runway),
      evidence('cfo_phase1', `Cash: ${formatINR(data.liveState.cash)}`, data.liveState.cash),
      evidence('cfo_phase1', `Burn rate: ${formatINR(data.liveState.burnRate)}/mo`, data.liveState.burnRate),
    ],
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

function buildReduceExpenses(data: CEODataView): ExecutiveDecision | null {
  // Find the largest non-essential expense category
  const cats = data.cfo.expenses.byCategory
    .filter((c) => !['payroll', 'gst', 'rent'].includes(c.category))
    .sort((a, b) => b.amount - a.amount);
  if (cats.length === 0) return null;

  const top = cats[0];
  const cutTarget = top.amount * 0.20; // 20% reduction
  if (cutTarget < 5000) return null;

  const { requirement, requiresRole, risk } = resolveApprovalRequirement('reduce_expenses', cutTarget);

  return {
    id: decisionId('reduce_expenses', top.category),
    type: 'reduce_expenses',
    title: `Cut ${formatINR(cutTarget)}/mo from ${top.label}`,
    reason: `${top.label} is your largest discretionary expense at ${formatINR(top.amount)}/mo (MoM ${top.momChangePct >= 0 ? '+' : ''}${top.momChangePct.toFixed(1)}%). A 20% trim saves ${formatINR(cutTarget)}/mo.`,
    financialImpact: cutTarget * 12, // annualised
    financialImpactLabel: `Save ${formatINRFull(cutTarget * 12)}/year`,
    confidence: confidenceFrom(data.raw.expenses.length, 65),
    priority: 'medium',
    risk,
    businessImpact: `Annualised savings of ${formatINR(cutTarget * 12)}. Improves net margin by ~${((cutTarget * 12) / (data.cfo.revenue.thisYear || 1) * 100).toFixed(1)}%.`,
    rollbackPlan: 'Expense cuts are reversible — restore the spend if the category is critical to operations.',
    approvalRequired: requirement,
    requiresRole,
    actions: [
      action(`Audit ${top.label} vendors`, `List all vendors in ${top.label} with monthly spend.`, 'cfo_agent', 30, true),
      action('Negotiate or switch', 'Negotiate lower rates or switch to a cheaper alternative.', 'cfo_agent', 60, false),
    ],
    relatedEntityType: 'expense',
    relatedEntityLabel: top.label,
    evidence: [
      evidence('expense_engine', `${top.label} spend: ${formatINR(top.amount)}/mo`, top.amount),
      evidence('expense_engine', `MoM change: ${top.momChangePct.toFixed(1)}%`, top.momChangePct),
    ],
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

function buildPauseMarketing(data: CEODataView): ExecutiveDecision | null {
  const marketing = data.cfo.expenses.byCategory.find((c) => c.category === 'marketing');
  if (!marketing || marketing.amount < 5000) return null;

  // Pause only if runway is short or marketing > 15% of expenses
  const isRunwayShort = data.liveState.runwayDays < 90 && data.liveState.runwayDays > 0;
  const isMarketingTooHigh = marketing.amount / Math.max(1, data.cfo.expenses.totalThisMonth) > 0.15;
  if (!isRunwayShort && !isMarketingTooHigh) return null;

  const { requirement, requiresRole, risk } = resolveApprovalRequirement('pause_marketing', marketing.amount);

  return {
    id: decisionId('pause_marketing', 'marketing-spend'),
    type: 'pause_marketing',
    title: `Pause marketing spend (${formatINR(marketing.amount)}/mo)`,
    reason: `Marketing is ${formatINR(marketing.amount)}/mo (${((marketing.amount / Math.max(1, data.cfo.expenses.totalThisMonth)) * 100).toFixed(1)}% of expenses) and runway is ${data.liveState.runwayDays} days. Pausing protects cash.`,
    financialImpact: marketing.amount,
    financialImpactLabel: `Save ${formatINRFull(marketing.amount)}/mo while paused`,
    confidence: confidenceFrom(2, 60),
    priority: isRunwayShort ? 'high' : 'medium',
    risk,
    businessImpact: `Saves ${formatINR(marketing.amount)}/mo. May slow lead flow temporarily — monitor pipeline closely.`,
    rollbackPlan: 'Marketing can be resumed at any time. Reactivate the top-performing channel first.',
    approvalRequired: requirement,
    requiresRole,
    actions: [
      action('Pause ad campaigns', 'Pause Google/Meta ad campaigns in the marketing dashboard.', 'oracle', 15, true),
      action('Notify agency', 'Inform the marketing agency/partner about the pause.', 'oracle', 10, true),
    ],
    relatedEntityType: 'expense',
    relatedEntityLabel: 'Marketing',
    evidence: [
      evidence('expense_engine', `Marketing spend: ${formatINR(marketing.amount)}/mo`, marketing.amount),
      evidence('cfo_phase1', `Runway: ${data.liveState.runwayDays} days`, data.liveState.runwayDays),
    ],
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

function buildInvestigateAnomaly(data: CEODataView): ExecutiveDecision | null {
  const critical = data.twin.anomalies.anomalies.filter((a) => a.severity === 'critical' || a.severity === 'high');
  if (critical.length === 0) return null;

  const top = critical[0];
  const { requirement, requiresRole, risk } = resolveApprovalRequirement('investigate_anomaly', 0);

  return {
    id: decisionId('investigate_anomaly', top.id),
    type: 'investigate_anomaly',
    title: `Investigate anomaly: ${top.title}`,
    reason: `Digital Twin flagged: ${top.description} Severity: ${top.severity}.`,
    financialImpact: top.currentValue ?? 0,
    financialImpactLabel: top.description,
    confidence: confidenceFrom(critical.length, 70),
    priority: top.severity === 'critical' ? 'critical' : 'high',
    risk,
    businessImpact: 'Identifying the root cause early prevents larger downstream losses.',
    rollbackPlan: 'Investigation is read-only — no rollback needed.',
    approvalRequired: requirement,
    requiresRole,
    actions: [
      action('Pull anomaly details', 'Fetch the full anomaly context from the Digital Twin.', 'oracle', 10, true),
      action('Trace root cause', 'Use the Business Graph to find what caused this anomaly.', 'oracle', 30, true),
      action('Recommend fix', 'Generate a corrective decision based on root cause.', 'cfo_agent', 20, false),
    ],
    relatedEntityType: 'anomaly',
    relatedEntityId: top.id,
    relatedEntityLabel: top.title,
    evidence: [
      evidence('digital_twin', `Anomaly: ${top.title}`, top.currentValue),
      evidence('digital_twin', `Severity: ${top.severity}`),
      evidence('digital_twin', `Metric: ${top.metric}, deviation: ${top.deviationPct.toFixed(1)}%`, top.deviationPct),
      evidence('digital_twin', `Active anomalies: ${data.twin.anomalies.totalCount}`, data.twin.anomalies.totalCount),
    ],
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

function buildReplyCustomer(data: CEODataView): ExecutiveDecision | null {
  // Look at un-acknowledged WhatsApp / email messages
  const unhandled = data.raw.syncedRecords.filter(
    (r) => r.sourceType === 'whatsapp_msg' || r.sourceType === 'email',
  ).filter((r) => {
    if (!r.date) return false;
    const ageHours = (Date.now() - new Date(r.date).getTime()) / (60 * 60 * 1000);
    return ageHours > 4; // waiting > 4 hours
  });
  if (unhandled.length === 0) return null;

  const msg = unhandled[0];
  const { requirement, requiresRole, risk } = resolveApprovalRequirement('reply_customer', 0);
  const ageHours = msg.date ? Math.round((Date.now() - new Date(msg.date).getTime()) / (60 * 60 * 1000)) : 0;

  return {
    id: decisionId('reply_customer', msg.id),
    type: 'reply_customer',
    title: `Reply to ${msg.sourceType === 'email' ? 'email' : 'WhatsApp message'}`,
    reason: `A customer message has been waiting ${ageHours} hours. Slow responses hurt client retention.`,
    financialImpact: 0,
    financialImpactLabel: 'Protects client relationship and retention',
    confidence: confidenceFrom(unhandled.length, 65),
    priority: 'medium',
    risk,
    businessImpact: 'Customer satisfaction improves → reduces churn risk and supports revenue continuity.',
    rollbackPlan: 'A reply can be edited or recalled. No financial downside.',
    approvalRequired: requirement,
    requiresRole,
    actions: [
      action('Draft reply', `Use Oracle to draft a context-aware reply to: ${msg.title ?? 'the message'}.`, 'oracle', 5, true),
      action('Send reply', 'Send the reply via the same channel.', 'oracle', 2, true),
    ],
    relatedEntityType: 'communication',
    relatedEntityId: msg.id,
    relatedEntityLabel: msg.title ?? msg.sourceType,
    evidence: [
      evidence('communication', `Unhandled messages: ${unhandled.length}`, unhandled.length),
      evidence('communication', `Oldest waiting: ${ageHours}h`, ageHours),
    ],
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

function buildOptimizeCash(data: CEODataView): ExecutiveDecision | null {
  // Suggest moving idle cash from savings → OD account if there's an OD with negative balance
  const accounts = data.twin.state.bankAccounts;
  if (accounts.length < 2) return null;

  const idleAccounts = accounts.filter((a) => a.type === 'savings' && a.balance > 200000);
  const odAccounts = accounts.filter((a) => (a.type === 'od' || a.type === 'cc') && a.balance < 0);
  if (idleAccounts.length === 0 || odAccounts.length === 0) return null;

  const idle = idleAccounts[0];
  const od = odAccounts[0];
  const moveAmount = Math.min(idle.balance - 100000, Math.abs(od.balance));

  const { requirement, requiresRole, risk } = resolveApprovalRequirement('optimize_cash', moveAmount);

  return {
    id: decisionId('optimize_cash', idle.id),
    type: 'optimize_cash',
    title: `Move ${formatINR(moveAmount)} from ${idle.bank} to ${od.bank}`,
    reason: `${idle.bank} has ${formatINR(idle.balance)} idle (savings). ${od.bank} OD is at ${formatINR(od.balance)} (costing ~12% interest). Sweeping saves interest cost.`,
    financialImpact: Math.abs(od.balance) * 0.12 / 12, // monthly interest saved
    financialImpactLabel: `Save ${formatINRFull(Math.abs(od.balance) * 0.12 / 12)}/mo in OD interest`,
    confidence: confidenceFrom(accounts.length, 70),
    priority: 'medium',
    risk,
    businessImpact: 'Reduces interest cost without changing total cash position.',
    rollbackPlan: 'Funds can be swept back at any time. No penalty on intra-bank transfers.',
    approvalRequired: requirement,
    requiresRole,
    actions: [
      action('Sweep funds', `Transfer ${formatINR(moveAmount)} from ${idle.bank} to ${od.bank}.`, 'oracle', 10, true, true),
    ],
    relatedEntityType: 'bank_account',
    relatedEntityId: idle.id,
    relatedEntityLabel: `${idle.bank} → ${od.bank}`,
    evidence: [
      evidence('banking', `${idle.bank} balance: ${formatINR(idle.balance)}`, idle.balance),
      evidence('banking', `${od.bank} OD balance: ${formatINR(od.balance)}`, od.balance),
    ],
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

// ─── Main entry: compute all live decisions ──────────────────────────────────

export function computeExecutiveDecisions(data: CEODataView): ExecutiveDecision[] {
  const builders = [
    buildRecoverPayment,
    buildRemindClient,
    buildFileOverdueReturn,
    buildClaimITC,
    buildPayGST,
    buildDelayHiring,
    buildSuggestLoan,
    buildReduceExpenses,
    buildPauseMarketing,
    buildInvestigateAnomaly,
    buildReplyCustomer,
    buildOptimizeCash,
  ];

  const decisions: ExecutiveDecision[] = [];
  for (const b of builders) {
    try {
      const d = b(data);
      if (d) decisions.push(d);
    } catch (err) {
      console.warn(`[AI CEO] Decision builder ${b.name} failed:`, err);
    }
  }

  // Sort by priority (critical first) then by financial impact (desc)
  const priorityRank: Record<DecisionPriority, number> = {
    critical: 0, high: 1, medium: 2, low: 3,
  };
  return decisions.sort((a, b) => {
    if (priorityRank[a.priority] !== priorityRank[b.priority]) {
      return priorityRank[a.priority] - priorityRank[b.priority];
    }
    return Math.abs(b.financialImpact) - Math.abs(a.financialImpact);
  });
}

// ─── Auto-approve benign decisions (notify-only) ─────────────────────────────

export function autoApproveBenign(decisions: ExecutiveDecision[]): ExecutiveDecision[] {
  return decisions.map((d) => {
    if (d.status === 'pending' && isAutoApprovable(d)) {
      return { ...d, status: 'auto_approved' as const };
    }
    return d;
  });
}
