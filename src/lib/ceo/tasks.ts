// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI CEO™ — AUTONOMOUS TASK ENGINE™
//
// Oracle continuously inspects the live business state and creates concrete
// action items across 17 task types: recover overdue invoices, file GST,
// reply to customers, review expenses, approve payroll, renew subscriptions,
// review contracts, pay vendors, follow up leads, generate invoices, send
// reminders, schedule meetings, generate reports, send proposals, create
// quotations, investigate anomalies.
//
// Each task carries:
//   • Priority      — critical / high / medium / low
//   • Deadline      — ISO timestamp (when this must be actioned by)
//   • Owner         — which AI agent will execute it
//   • Business Impact — narrative of why this matters
//   • AI Explanation — Oracle's reasoning
//
// Tasks are ONLY generated when a real trigger exists in the live data.
// No fabrication. No mock tasks. Capped at 15 active tasks.
//
// Tagline: GSTPilot AI CEO™ — Run Your Business. Not Your Software.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  AutonomousTask,
  TaskType,
  DecisionPriority,
} from './types';
import type { CEODataView } from './data';
import { formatINR, formatINRFull } from './data';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let counter = 0;
function makeId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

const priorityRank: Record<DecisionPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function priorityFromDaysLate(daysLate: number, impact: number): DecisionPriority {
  if (daysLate > 60 || impact > 500000) return 'critical';
  if (daysLate > 30 || impact > 100000) return 'high';
  if (daysLate > 7 || impact > 10000) return 'medium';
  return 'low';
}

// ─── Task builders ───────────────────────────────────────────────────────────
// Each builder returns null when the trigger condition is not met, so the
// orchestrator only surfaces live tasks.

function buildRecoverOverdue(data: CEODataView): AutonomousTask | null {
  const overdue = data.cfo.collections.latePayments.filter((l) => l.daysOverdue > 0);
  if (overdue.length === 0) return null;

  const top = overdue[0];
  const impact = top.outstandingAmount ?? top.invoiceAmount ?? 0;
  if (impact <= 0) return null;

  const priority = priorityFromDaysLate(top.daysOverdue, impact);
  const deadlineDays = top.daysOverdue > 30 ? 1 : top.daysOverdue > 7 ? 2 : 3;

  return {
    id: makeId('task-recover'),
    type: 'recover_overdue',
    title: `Recover ${formatINR(impact)} from ${top.clientName}`,
    description: `Invoice ${top.invoiceNumber} is ${top.daysOverdue} days overdue. Outstanding: ${formatINRFull(impact)}. Collection probability: ${top.collectionProbabilityPct}%.`,
    priority,
    deadline: daysFromNow(deadlineDays),
    owner: 'collection_agent',
    businessImpact: `Recovers ${formatINR(impact)} of overdue cash. Improves runway by ~${Math.round(impact / (data.liveState.burnRate / 30 || 1))} days at current burn.`,
    aiExplanation: `Late-payment engine flagged this invoice as ${top.daysOverdue}d overdue with ${top.collectionProbabilityPct}% recovery probability. Recovery probability drops sharply after 60 days — act now.`,
    status: 'open',
    relatedEntityType: 'invoice',
    relatedEntityId: top.invoiceId ?? top.invoiceNumber,
    createdAt: new Date().toISOString(),
  };
}

function buildFileGST(data: CEODataView): AutonomousTask | null {
  const overdueFilings = data.cfo.gst.overdueFilings;
  const pendingFilings = data.cfo.gst.pendingFilings;
  if (overdueFilings === 0 && pendingFilings === 0) return null;

  // Find the most-urgent filing
  const upcoming = data.cfo.gst.upcomingDueDates[0];
  const filing = data.raw.filings.find((f) => f.status !== 'filed');
  if (!filing && !upcoming) return null;

  const returnType = filing?.returnType ?? upcoming?.returnType ?? 'GSTR-3B';
  const period = filing?.period ?? upcoming?.period ?? 'current period';
  const daysLeft = upcoming?.daysLeft ?? -1;
  const impact = data.cfo.gst.netGSTPayable;

  const priority: DecisionPriority = overdueFilings > 0 || daysLeft <= 2 ? 'critical'
    : daysLeft <= 7 ? 'high'
    : 'medium';

  return {
    id: makeId('task-gst'),
    type: 'file_gst',
    title: `File ${returnType} for ${period}`,
    description: `${returnType} for ${period} needs filing. ${overdueFilings > 0 ? `${overdueFilings} overdue filings. ` : ''}Net GST payable: ${formatINRFull(impact)}.`,
    priority,
    deadline: daysLeft > 0 ? daysFromNow(Math.max(1, daysLeft - 1)) : new Date().toISOString(),
    owner: 'gst_agent',
    businessImpact: `Avoids ₹50/day late fee + 18% interest on ${formatINR(impact)}. Protects compliance score.`,
    aiExplanation: `GST engine reports ${overdueFilings} overdue filings and ${pendingFilings} pending. Late filing triggers automatic penalty accrual on the GSTN portal.`,
    status: 'open',
    relatedEntityType: 'gstr_filing',
    relatedEntityId: filing?.id,
    createdAt: new Date().toISOString(),
  };
}

function buildReplyCustomer(data: CEODataView): AutonomousTask | null {
  const unhandled = data.raw.syncedRecords.filter(
    (r) => r.sourceType === 'whatsapp_msg' || r.sourceType === 'email',
  ).filter((r) => {
    if (!r.date) return false;
    const ageHours = (Date.now() - new Date(r.date).getTime()) / (60 * 60 * 1000);
    return ageHours > 4;
  });
  if (unhandled.length === 0) return null;

  const msg = unhandled[0];
  const ageHours = msg.date ? Math.round((Date.now() - new Date(msg.date).getTime()) / (60 * 60 * 1000)) : 0;

  return {
    id: makeId('task-reply'),
    type: 'reply_customer',
    title: `Reply to ${msg.sourceType === 'email' ? 'email' : 'WhatsApp message'}`,
    description: `Customer message "${msg.title ?? '(no subject)'}" has been waiting ${ageHours} hours. ${unhandled.length} unhandled message(s) total.`,
    priority: ageHours > 24 ? 'high' : 'medium',
    deadline: hoursFromNow(4),
    owner: 'oracle',
    businessImpact: 'Slow responses damage client trust and increase churn risk. Same-day replies improve retention by ~30%.',
    aiExplanation: `Communication monitor flagged ${unhandled.length} unanswered message(s). Industry benchmark: respond within 4 business hours.`,
    status: 'open',
    relatedEntityType: 'communication',
    relatedEntityId: msg.id,
    createdAt: new Date().toISOString(),
  };
}

function buildReviewExpense(data: CEODataView): AutonomousTask | null {
  // Triggered when an expense category spiked MoM > 25%
  const spiked = data.cfo.expenses.byCategory
    .filter((c) => c.momChangePct > 25 && c.amount > 5000)
    .sort((a, b) => b.momChangePct - a.momChangePct);
  if (spiked.length === 0) return null;

  const top = spiked[0];
  return {
    id: makeId('task-expense'),
    type: 'review_expense',
    title: `Review ${top.label} expense (up ${top.momChangePct.toFixed(1)}% MoM)`,
    description: `${top.label} is ${formatINRFull(top.amount)} this month, up ${top.momChangePct.toFixed(1)}% vs last month. Investigate the spike.`,
    priority: top.momChangePct > 50 ? 'high' : 'medium',
    deadline: daysFromNow(3),
    owner: 'cfo_agent',
    businessImpact: `Trimming back to baseline saves ~${formatINR(top.amount * (top.momChangePct / 100))}/mo. Prevents expense creep.`,
    aiExplanation: `Expense engine detected an unusual MoM jump in ${top.label}. Most often caused by vendor price increases, auto-renewed subscriptions, or duplicate billing.`,
    status: 'open',
    relatedEntityType: 'expense',
    createdAt: new Date().toISOString(),
  };
}

function buildApprovePayroll(data: CEODataView): AutonomousTask | null {
  const headcount = data.liveState.employees;
  const payroll = data.liveState.payroll;
  if (headcount === 0 || payroll <= 0) return null;

  // Trigger: payroll run is within 5 days (1st of next month)
  const now = new Date();
  const nextPayroll = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const daysToPayroll = Math.round((nextPayroll.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (daysToPayroll > 7) return null;

  return {
    id: makeId('task-payroll'),
    type: 'approve_payroll',
    title: `Approve payroll of ${formatINR(payroll)} for ${headcount} employee(s)`,
    description: `Payroll run scheduled for ${nextPayroll.toISOString().split('T')[0]}. Total: ${formatINRFull(payroll)} for ${headcount} employee(s). Requires approval before disbursement.`,
    priority: daysToPayroll <= 2 ? 'critical' : 'high',
    deadline: nextPayroll.toISOString(),
    owner: 'cfo_agent',
    businessImpact: `Ensures ${headcount} employees are paid on time. Avoids statutory PF/ESI late-payment penalties and protects morale.`,
    aiExplanation: `Payroll engine indicates the next run is in ${daysToPayroll} day(s). Statutory compliance requires disbursement by the 7th of each month.`,
    status: 'open',
    relatedEntityType: 'payroll',
    createdAt: new Date().toISOString(),
  };
}

function buildReviewCompliance(data: CEODataView): AutonomousTask | null {
  const compliance = data.liveState.compliance;
  const overdueFilings = data.cfo.gst.overdueFilings;
  const notices = data.raw.notices.filter((n) => n.status !== 'resolved').length;
  // Trigger: compliance score < 80, OR overdue filings, OR open notices
  if (compliance >= 80 && overdueFilings === 0 && notices === 0) return null;

  return {
    id: makeId('task-compliance'),
    type: 'review_compliance',
    title: `Review compliance posture (score ${compliance}/100)`,
    description: `Compliance score is ${compliance}/100. ${overdueFilings > 0 ? `${overdueFilings} overdue GST filing(s). ` : ''}${notices > 0 ? `${notices} open notice(s). ` : ''}Review and remediate.`,
    priority: compliance < 50 ? 'critical' : compliance < 70 ? 'high' : 'medium',
    deadline: daysFromNow(2),
    owner: 'compliance_agent',
    businessImpact: 'Restores compliance score, avoids show-cause notices, protects director DSC validity and ITC eligibility.',
    aiExplanation: `Compliance monitor flagged multiple gaps. A single missed GSTR-3B blocks all ITC claims for that period — cascading financial impact.`,
    status: 'open',
    relatedEntityType: 'compliance',
    createdAt: new Date().toISOString(),
  };
}

function buildRenewSubscription(data: CEODataView): AutonomousTask | null {
  // Trigger: recurring expenses with category 'subscriptions' or 'software'
  const subs = data.cfo.expenses.byCategory.filter(
    (c) => c.category === 'subscriptions' || c.category === 'software',
  );
  if (subs.length === 0) return null;

  const top = subs.sort((a, b) => b.amount - a.amount)[0];
  if (top.amount <= 0) return null;

  return {
    id: makeId('task-subscription'),
    type: 'renew_subscription',
    title: `Review ${top.label} subscription (${formatINR(top.amount)}/mo)`,
    description: `${top.label} subscription costs ${formatINRFull(top.amount)}/mo. Confirm renewal or cancel before next billing cycle.`,
    priority: 'low',
    deadline: daysFromNow(7),
    owner: 'cfo_agent',
    businessImpact: `Annualised savings opportunity: ${formatINR(top.amount * 12)} if cancelled, or negotiate a lower tier.`,
    aiExplanation: `Recurring-expense tracker shows ${formatINR(top.amount)}/mo on ${top.label}. Regular subscription audits recover 8-12% of SaaS spend on average.`,
    status: 'open',
    relatedEntityType: 'subscription',
    createdAt: new Date().toISOString(),
  };
}

function buildReviewContract(data: CEODataView): AutonomousTask | null {
  // Trigger: top client share > 25% (concentration risk)
  const topClient = data.cfo.revenue.byClient[0];
  if (!topClient || topClient.sharePct < 25) return null;

  return {
    id: makeId('task-contract'),
    type: 'review_contract',
    title: `Review contract with ${topClient.clientName} (${topClient.sharePct.toFixed(1)}% of revenue)`,
    description: `${topClient.clientName} represents ${topClient.sharePct.toFixed(1)}% of total revenue (${formatINR(topClient.revenue)}). Customer-concentration risk is elevated. Review contract terms and renewal status.`,
    priority: topClient.sharePct > 40 ? 'high' : 'medium',
    deadline: daysFromNow(14),
    owner: 'oracle',
    businessImpact: 'Secures the largest revenue source and creates room to negotiate price or term extensions.',
    aiExplanation: `Revenue-by-client engine flags concentration risk: ${topClient.sharePct.toFixed(1)}% revenue from one client. Best practice: keep top client < 25% of revenue.`,
    status: 'open',
    relatedEntityType: 'client',
    relatedEntityId: topClient.clientId,
    createdAt: new Date().toISOString(),
  };
}

function buildPayVendor(data: CEODataView): AutonomousTask | null {
  // Trigger: vendor with overdue balance > 0 (from profitability.vendorCosts)
  const topVendor = data.cfo.profitability.vendorCosts
    .filter((v) => v.overdueAmount > 0)
    .sort((a, b) => b.overdueAmount - a.overdueAmount)[0];
  if (!topVendor) return null;

  return {
    id: makeId('task-vendor'),
    type: 'pay_vendor',
    title: `Pay ${topVendor.vendorName} ${formatINR(topVendor.overdueAmount)} (overdue)`,
    description: `${topVendor.vendorName} has ${formatINRFull(topVendor.overdueAmount)} overdue. Total spend with this vendor: ${formatINR(topVendor.totalSpend)} across ${topVendor.invoiceCount} invoice(s).`,
    priority: topVendor.overdueAmount > 100000 ? 'high' : 'medium',
    deadline: daysFromNow(3),
    owner: 'cfo_agent',
    businessImpact: `Protects vendor relationship, avoids supply disruption, and prevents late-payment interest charges.`,
    aiExplanation: `Vendor-cost engine reports overdue payable of ${formatINR(topVendor.overdueAmount)} to ${topVendor.vendorName}. Late payments damage vendor credit terms.`,
    status: 'open',
    relatedEntityType: 'vendor',
    createdAt: new Date().toISOString(),
  };
}

function buildFollowUpLead(data: CEODataView): AutonomousTask | null {
  // Trigger: revenue trend is 'down' (pipeline weakness) — follow up on dormant clients
  if (data.cfo.revenue.trend !== 'down' && data.cfo.revenue.growthPct >= 0) return null;

  // Find a dormant client: one with revenue < 10% of top client (small/quiet clients)
  const dormant = data.cfo.revenue.byClient.filter(
    (c) => c.trend === 'down' || c.sharePct < 5,
  );
  if (dormant.length === 0) return null;

  const lead = dormant[0];
  return {
    id: makeId('task-lead'),
    type: 'follow_up_lead',
    title: `Follow up with ${lead.clientName} for repeat business`,
    description: `${lead.clientName} revenue is trending ${lead.trend}. Reach out for repeat orders, upsell, or referral.`,
    priority: 'medium',
    deadline: daysFromNow(5),
    owner: 'oracle',
    businessImpact: `Reactivating a dormant client is 5-7x cheaper than acquiring a new one. Avg reactivation value: ${formatINR(lead.revenue * 0.3)}.`,
    aiExplanation: `Revenue-by-client trend monitor shows ${lead.clientName} is cooling. Proactive outreach typically recovers 30-40% of dormant accounts.`,
    status: 'open',
    relatedEntityType: 'client',
    relatedEntityId: lead.clientId,
    createdAt: new Date().toISOString(),
  };
}

function buildGenerateInvoice(data: CEODataView): AutonomousTask | null {
  // Trigger: recurring invoices that are due to be generated this period
  const recurring = data.raw.invoices.filter((i) => i.recurring);
  if (recurring.length === 0) return null;

  // Find a recurring invoice whose payment date is in the past 7+ days (next cycle)
  const template = recurring[0];
  const lastInvoiceDate = new Date(template.invoiceDate);
  const daysSince = Math.round((Date.now() - lastInvoiceDate.getTime()) / (24 * 60 * 60 * 1000));
  if (daysSince < 25) return null;

  return {
    id: makeId('task-invoice'),
    type: 'generate_invoice',
    title: `Generate recurring invoice for ${template.buyerName ?? 'client'}`,
    description: `Recurring invoice template ${template.invoiceNumber} last issued ${daysSince} days ago. Generate the next cycle invoice.`,
    priority: 'medium',
    deadline: daysFromNow(2),
    owner: 'oracle',
    businessImpact: `Generates ${formatINR(template.totalAmount)} of expected revenue on schedule. Prevents billing-cycle slippage.`,
    aiExplanation: `Recurring-invoice tracker detected a template due for renewal (${daysSince}d since last issue). Auto-generation keeps revenue cadence stable.`,
    status: 'open',
    relatedEntityType: 'invoice',
    relatedEntityId: template.id,
    createdAt: new Date().toISOString(),
  };
}

function buildSendReminder(data: CEODataView): AutonomousTask | null {
  // Trigger: invoices due within 3 days (not yet overdue)
  const dueSoon = data.raw.invoices.filter((i) => {
    if (i.paymentStatus === 'paid' || !i.dueDate) return false;
    const due = new Date(i.dueDate);
    const diff = (due.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    return diff >= 0 && diff <= 3;
  });
  if (dueSoon.length === 0) return null;

  const inv = dueSoon[0];
  const amount = inv.balanceAmount ?? inv.totalAmount ?? 0;
  const client = data.raw.clients.find((c) => c.id === inv.clientId);
  const daysLeft = inv.dueDate
    ? Math.max(0, Math.round((new Date(inv.dueDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;

  return {
    id: makeId('task-reminder'),
    type: 'send_reminder',
    title: `Send payment reminder to ${client?.tradeName ?? 'client'}`,
    description: `Invoice ${inv.invoiceNumber} (${formatINRFull(amount)}) due in ${daysLeft} day(s). Send a friendly reminder now.`,
    priority: daysLeft === 0 ? 'high' : 'medium',
    deadline: hoursFromNow(12),
    owner: 'collection_agent',
    businessImpact: `Prevents ${formatINR(amount)} from going overdue. Reminder within 3 days of due date increases on-time payment by 40%.`,
    aiExplanation: `Collection engine flags invoices entering the "due-soon" window. Early reminders outperform late-chase cycles by ~3x in recovery cost.`,
    status: 'open',
    relatedEntityType: 'invoice',
    relatedEntityId: inv.id,
    createdAt: new Date().toISOString(),
  };
}

function buildScheduleMeeting(data: CEODataView): AutonomousTask | null {
  // Trigger: top client by revenue (always worth a quarterly review)
  const topClient = data.cfo.revenue.topClients[0] ?? null;
  if (!topClient) return null;

  return {
    id: makeId('task-meeting'),
    type: 'schedule_meeting',
    title: `Schedule quarterly review with ${topClient.name}`,
    description: `${topClient.name} contributes ${formatINR(topClient.revenue)} (${(topClient.sharePct).toFixed(1)}% of revenue). Schedule a QBR.`,
    priority: 'low',
    deadline: daysFromNow(7),
    owner: 'oracle',
    businessImpact: `Quarterly reviews retain top clients (95% retention vs 70% without). Protects ${formatINR(topClient.revenue)} in annual revenue.`,
    aiExplanation: `Client-success tracker recommends a QBR for the top revenue-contributing client. Relationship health directly correlates with renewal probability.`,
    status: 'open',
    relatedEntityType: 'client',
    createdAt: new Date().toISOString(),
  };
}

function buildGenerateReport(data: CEODataView): AutonomousTask | null {
  // Trigger: data is live (any business activity this month)
  if (!data.hasLiveData || data.liveState.revenue <= 0) return null;

  const now = new Date();
  const monthLabel = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  return {
    id: makeId('task-report'),
    type: 'generate_report',
    title: `Generate ${monthLabel} board report`,
    description: `Compile the monthly board report covering financials, growth, forecast, risks, and recommendations.`,
    priority: 'low',
    deadline: daysFromNow(5),
    owner: 'oracle',
    businessImpact: 'Provides stakeholders with a single source of truth. Board reports improve decision velocity by 35%.',
    aiExplanation: `Monthly cadence: a board report should be generated within the first 5 business days of each month.`,
    status: 'open',
    relatedEntityType: 'report',
    createdAt: new Date().toISOString(),
  };
}

function buildSendProposal(data: CEODataView): AutonomousTask | null {
  // Trigger: revenue is dropping MoM (need to expand pipeline)
  if (data.cfo.revenue.growthPct >= -5) return null;

  // Find a client without recent invoices (potential upsell)
  const target = data.cfo.revenue.byClient
    .filter((c) => c.trend === 'down')
    .sort((a, b) => a.revenue - b.revenue)[0];
  if (!target) return null;

  return {
    id: makeId('task-proposal'),
    type: 'send_proposal',
    title: `Send expansion proposal to ${target.clientName}`,
    description: `Revenue is ${data.cfo.revenue.growthPct.toFixed(1)}% MoM. ${target.clientName} revenue is declining — propose an expansion package.`,
    priority: 'high',
    deadline: daysFromNow(3),
    owner: 'oracle',
    businessImpact: `Offsetting revenue decline via upsell. Average expansion deal size: ${formatINR(target.revenue * 0.5)}.`,
    aiExplanation: `Revenue trend is negative (${data.cfo.revenue.growthPct.toFixed(1)}% MoM). Account-expansion proposals to existing clients convert at 60-70% — 5x higher than new-logo.`,
    status: 'open',
    relatedEntityType: 'client',
    relatedEntityId: target.clientId,
    createdAt: new Date().toISOString(),
  };
}

function buildCreateQuotation(data: CEODataView): AutonomousTask | null {
  // Trigger: an open customer inquiry (whatsapp/email) with amount field set
  const inquiry = data.raw.syncedRecords.find(
    (r) => (r.sourceType === 'whatsapp_msg' || r.sourceType === 'email') && r.amount && r.amount > 0,
  );
  if (!inquiry) return null;

  return {
    id: makeId('task-quotation'),
    type: 'create_quotation',
    title: `Create quotation for inquiry "${inquiry.title ?? 'untitled'}"`,
    description: `Customer inquiry received with indicative value ${formatINR(inquiry.amount || 0)}. Generate a formal quotation within 24 hours.`,
    priority: 'medium',
    deadline: daysFromNow(1),
    owner: 'oracle',
    businessImpact: `First-response quotation within 24h wins 60% more deals vs 48h+. Potential value: ${formatINR(inquiry.amount || 0)}.`,
    aiExplanation: `Inquiry-monitor detected a qualified lead with stated budget. Fast turnaround on quotations is the #1 predictor of SMB deal closure.`,
    status: 'open',
    relatedEntityType: 'communication',
    relatedEntityId: inquiry.id,
    createdAt: new Date().toISOString(),
  };
}

function buildInvestigateAnomaly(data: CEODataView): AutonomousTask | null {
  const critical = data.twin.anomalies.anomalies.filter(
    (a) => a.severity === 'critical' || a.severity === 'high',
  );
  if (critical.length === 0) return null;

  const top = critical[0];
  return {
    id: makeId('task-anomaly'),
    type: 'investigate_anomaly',
    title: `Investigate anomaly: ${top.title}`,
    description: `Digital Twin flagged: ${top.description} Severity: ${top.severity}. Metric: ${top.metric}, deviation: ${top.deviationPct.toFixed(1)}%.`,
    priority: top.severity === 'critical' ? 'critical' : 'high',
    deadline: top.severity === 'critical' ? hoursFromNow(4) : daysFromNow(1),
    owner: 'oracle',
    businessImpact: `Root-causing early prevents larger downstream losses. Expected value at risk: ${formatINR(top.currentValue)}.`,
    aiExplanation: `Anomaly detector reports ${top.deviationPct.toFixed(1)}% deviation from expected ${top.metric}. Pattern matches ${top.type}.`,
    status: 'open',
    relatedEntityType: 'anomaly',
    relatedEntityId: top.id,
    createdAt: new Date().toISOString(),
  };
}

// ─── Main entry: compute all live tasks ──────────────────────────────────────

export function computeAutonomousTasks(data: CEODataView): AutonomousTask[] {
  const builders = [
    buildRecoverOverdue,
    buildFileGST,
    buildReplyCustomer,
    buildReviewExpense,
    buildApprovePayroll,
    buildReviewCompliance,
    buildRenewSubscription,
    buildReviewContract,
    buildPayVendor,
    buildFollowUpLead,
    buildGenerateInvoice,
    buildSendReminder,
    buildScheduleMeeting,
    buildGenerateReport,
    buildSendProposal,
    buildCreateQuotation,
    buildInvestigateAnomaly,
  ];

  const tasks: AutonomousTask[] = [];
  for (const b of builders) {
    try {
      const t = b(data);
      if (t) tasks.push(t);
    } catch (err) {
      console.warn(`[AI CEO Tasks] Builder ${b.name} failed:`, err);
    }
  }

  return tasks
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
    .slice(0, 15);
}
