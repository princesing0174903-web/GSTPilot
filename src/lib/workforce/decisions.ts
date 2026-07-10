// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI WORKFORCE™ — CROSS-DEPARTMENT DECISION ENGINE™
//
// Departments cooperate automatically. When a real business trigger is detected
// in the WorkforceDataView (overdue invoices, GST pending, runway < 90d, vendor
// dependency, etc.), the engine proposes a multi-step cross-department decision
// with role-based approval flow. Only proposed when the trigger actually exists.
//
// Pure server-side TypeScript. Never throws. No mock triggers.
//
// Tagline: "GSTPilot AI Workforce™ — Don't just use AI. Build an AI Company."
// ═══════════════════════════════════════════════════════════════════════════════

import type { WorkforceDataView } from './data';
import { formatINR } from './data';
import type {
  CrossDepartmentDecision,
  CrossDecisionStep,
  EmployeeRole,
} from './types';

// ─── Safe wrapper (never throws) ──────────────────────────────────────────────

function safeBuild<T>(label: string, fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch (err) {
    console.warn(`[AI Workforce] Cross-decision builder "${label}" failed:`, err);
    return fallback;
  }
}

// ─── Deterministic ID helper ─────────────────────────────────────────────────
// Same trigger → same ID across dashboard refreshes (so approvals persist).

function hashId(prefix: string, key: string): string {
  try {
    const b64 = Buffer.from(key, 'utf-8').toString('base64');
    return `${prefix}-${b64.replace(/=+$/, '').slice(0, 12)}`;
  } catch {
    let h = 0;
    for (let i = 0; i < key.length; i++) {
      h = ((h << 5) - h + key.charCodeAt(i)) | 0;
    }
    return `${prefix}-${Math.abs(h).toString(36).slice(0, 12)}`;
  }
}

// ─── Format helper ────────────────────────────────────────────────────────────

function inr(n: number): string {
  return formatINR(n || 0);
}

// ─── Confidence scoring (based on data quality + risk) ────────────────────────
// 0-100. Higher = more data backing the decision.

function computeConfidence(data: WorkforceDataView): number {
  let score = 50; // base
  if (data.hasLiveData) score += 15;
  if (data.data.totalRecords > 50) score += 10;
  if (data.data.forecastConfidence > 50) score += 10;
  if (data.technology.activeIntegrations > 0) score += 5;
  // Lower confidence if risk is high
  if (data.risk.overallRiskScore > 60) score -= 10;
  if (data.risk.overallRiskScore > 80) score -= 10;
  return Math.max(20, Math.min(95, Math.round(score)));
}

// ─── Step builder ─────────────────────────────────────────────────────────────

type StepSpec = {
  role: EmployeeRole;
  action: string;
  approvalType: 'review' | 'approve' | 'execute' | 'notify';
};

function buildSteps(specs: StepSpec[]): CrossDecisionStep[] {
  return specs.map((s, idx) => ({
    order: idx + 1,
    role: s.role,
    action: s.action,
    approvalType: s.approvalType,
    status: 'pending' as const,
  }));
}

// ─── Decision builder ─────────────────────────────────────────────────────────

interface DecisionSpec {
  id: string;
  title: string;
  description: string;
  initiatedBy: EmployeeRole;
  trigger: string;
  financialImpact: number;
  businessImpact: string;
  steps: StepSpec[];
  confidence: number;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

function buildDecision(spec: DecisionSpec): CrossDepartmentDecision {
  return {
    id: spec.id,
    title: spec.title,
    description: spec.description,
    initiatedBy: spec.initiatedBy,
    trigger: spec.trigger,
    financialImpact: spec.financialImpact,
    businessImpact: spec.businessImpact,
    steps: buildSteps(spec.steps),
    currentStepIndex: 0,
    status: 'proposed',
    confidence: spec.confidence,
    createdAt: new Date().toISOString(),
    relatedEntityType: spec.relatedEntityType,
    relatedEntityId: spec.relatedEntityId,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DECISION BUILDERS — one per trigger scenario
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 1. Discount approval ────────────────────────────────────────────────────
// Sales AI proposes discount on sent/partial invoices → Finance approves margin
// → CEO approves policy → CRM updates → Automation emails customer.
// Trigger: there exist sent/partial invoices (potential discount scenarios).

function buildDiscountDecision(data: WorkforceDataView): CrossDepartmentDecision | null {
  const candidates = data.raw.invoices.filter(
    (i) => i.status === 'sent' || i.status === 'partial',
  );
  if (candidates.length === 0) return null;

  // Pick the largest outstanding invoice as the discount candidate
  const inv = candidates
    .slice()
    .sort((a, b) => (b.balanceAmount || b.totalAmount) - (a.balanceAmount || a.totalAmount))[0];
  const clientName = inv.buyerName || (data.raw.clients.find((c) => c.id === inv.clientId)?.tradeName) || inv.clientId;
  const outstanding = inv.balanceAmount || inv.totalAmount;
  const discountPct = 5; // standard early-payment discount
  const discountAmount = Math.round(outstanding * (discountPct / 100));
  const netRealized = outstanding - discountAmount;

  return buildDecision({
    id: hashId('xd-discount', `${inv.id}-discount-${discountPct}`),
    title: `Offer ${discountPct}% early-payment discount to ${clientName} (${inv.invoiceNumber})`,
    description: `Propose ${discountPct}% discount (${inr(discountAmount)}) on outstanding ${inr(outstanding)} to ${clientName} in exchange for payment within 7 days. Net realized: ${inr(netRealized)}. Improves cash conversion and reduces overdue risk.`,
    initiatedBy: 'sales_manager',
    trigger: `${candidates.length} sent/partial invoices outstanding; top candidate ${inv.invoiceNumber} (${inr(outstanding)}) for ${clientName}`,
    financialImpact: -discountAmount, // cost of discount
    businessImpact: `Accelerate collection of ${inr(outstanding)}; net cost ${inr(discountAmount)}; customer goodwill + reduced overdue risk`,
    confidence: computeConfidence(data),
    steps: [
      { role: 'sales_manager', action: `Propose ${discountPct}% discount (${inr(discountAmount)}) on ${inv.invoiceNumber} to ${clientName}`, approvalType: 'review' },
      { role: 'finance_manager', action: `Verify margin impact: ${inr(discountAmount)} cost vs ${inr(outstanding)} receivable — net ${inr(netRealized)} realized`, approvalType: 'approve' },
      { role: 'ceo', action: `Approve discount policy for ${clientName} (${discountPct}% for early payment)`, approvalType: 'approve' },
      { role: 'sales_manager', action: `Update CRM proposal with revised terms; notify ${clientName}`, approvalType: 'execute' },
      { role: 'customer_success', action: `Email customer with updated invoice terms & 7-day payment window`, approvalType: 'execute' },
    ],
    relatedEntityType: 'invoice',
    relatedEntityId: inv.id,
  });
}

// ─── 2. Large expense approval ───────────────────────────────────────────────
// Operations AI proposes large expense → CFO approves budget → CEO approves →
// Finance Manager executes.
// Trigger: monthly expenses exceed ₹100K threshold.

function buildLargeExpenseDecision(data: WorkforceDataView): CrossDepartmentDecision | null {
  const monthlyExpenses = data.finance.expenses || 0;
  const threshold = 100000; // ₹1L
  if (monthlyExpenses < threshold) return null;

  // Find the top expense category as the proposed cut/optimization target
  const topCategory = data.cfo.expenses.byCategory?.[0];
  const categoryName = topCategory?.category || 'Operations';
  const categoryAmount = topCategory?.amount || monthlyExpenses;
  const proposedReduction = Math.round(categoryAmount * 0.1); // 10% reduction target

  return buildDecision({
    id: hashId('xd-expense', `expense-${categoryName}-${data.fetchedAt.slice(0, 7)}`),
    title: `Reduce "${categoryName}" expense by ${inr(proposedReduction)} (10% of ${inr(categoryAmount)})`,
    description: `Monthly expenses at ${inr(monthlyExpenses)} exceed ${inr(threshold)} threshold. Operations proposes 10% reduction in "${categoryName}" category (${inr(categoryAmount)} → ${inr(categoryAmount - proposedReduction)}). Requires budget reallocation approval.`,
    initiatedBy: 'operations_manager',
    trigger: `Monthly expenses ${inr(monthlyExpenses)} exceed ${inr(threshold)} threshold; top category "${categoryName}" at ${inr(categoryAmount)}`,
    financialImpact: proposedReduction, // savings
    businessImpact: `Save ${inr(proposedReduction)}/month (${inr(proposedReduction * 12)}/year); improve margin by ${((proposedReduction / Math.max(data.finance.revenue, 1)) * 100).toFixed(1)}%`,
    confidence: computeConfidence(data),
    steps: [
      { role: 'operations_manager', action: `Propose 10% reduction in "${categoryName}" expense (save ${inr(proposedReduction)}/month)`, approvalType: 'review' },
      { role: 'cfo', action: `Approve budget reallocation; verify no operational impact`, approvalType: 'approve' },
      { role: 'ceo', action: `Approve strategic expense reduction initiative`, approvalType: 'approve' },
      { role: 'finance_manager', action: `Execute revised budget; track monthly savings against ${inr(proposedReduction)} target`, approvalType: 'execute' },
    ],
    relatedEntityType: 'expense_category',
    relatedEntityId: categoryName,
  });
}

// ─── 3. Credit line decision ─────────────────────────────────────────────────
// CFO proposes credit line → Risk AI assesses → CEO approves → Finance Manager
// executes.
// Trigger: runway < 90 days.

function buildCreditLineDecision(data: WorkforceDataView): CrossDepartmentDecision | null {
  const runway = data.finance.runwayDays || 0;
  if (runway <= 0 || runway >= 90) return null;

  // Recommended credit line = 3 months of burn or ₹10L whichever is greater
  const monthlyBurn = data.finance.burnRate || 0;
  const creditLine = Math.max(1000000, monthlyBurn * 3);

  return buildDecision({
    id: hashId('xd-credit', `credit-line-${data.fetchedAt.slice(0, 10)}`),
    title: `Arrange credit line of ${inr(creditLine)} to extend runway from ${runway}d`,
    description: `Runway at ${runway} days is below 90d threshold. Cash ${inr(data.finance.cash)}, monthly burn ${inr(monthlyBurn)}. Propose credit line of ${inr(creditLine)} (3 months of burn) to extend runway to ~${runway + Math.round((creditLine / Math.max(monthlyBurn, 1)) * 30)} days.`,
    initiatedBy: 'cfo',
    trigger: `Cash runway ${runway}d below 90d threshold; cash ${inr(data.finance.cash)}, burn ${inr(monthlyBurn)}/month`,
    financialImpact: creditLine, // financing secured
    businessImpact: `Extend runway from ${runway}d to ${Math.round(runway + (creditLine / Math.max(monthlyBurn, 1)) * 30)}d; prevent cash exhaustion`,
    confidence: computeConfidence(data),
    steps: [
      { role: 'cfo', action: `Propose credit line of ${inr(creditLine)} (3x monthly burn)`, approvalType: 'review' },
      { role: 'risk_manager', action: `Assess debt service capacity & covenant risk; recommend terms`, approvalType: 'review' },
      { role: 'ceo', action: `Approve credit facility application & authorize banking discussions`, approvalType: 'approve' },
      { role: 'finance_manager', action: `Execute facility documentation & drawdown when needed`, approvalType: 'execute' },
    ],
    relatedEntityType: 'cash_position',
    relatedEntityId: `runway-${data.fetchedAt.slice(0, 10)}`,
  });
}

// ─── 4. New hire approval ────────────────────────────────────────────────────
// CHRO proposes hire → COO approves headcount → CFO approves budget → CEO
// approves.
// Trigger: headcount = 0 OR (openTasks > employees * 5 i.e. workload overload).

function buildNewHireDecision(data: WorkforceDataView): CrossDepartmentDecision | null {
  const headcount = data.hr.headcount || 0;
  const openTasks = data.operations.openTasks || 0;
  const workloadPerPerson = headcount > 0 ? openTasks / headcount : 999;

  if (headcount > 0 && workloadPerPerson < 5) return null; // not overloaded

  const hiresNeeded = headcount === 0 ? 1 : Math.ceil(workloadPerPerson / 5) - 1;
  const avgSalary = 50000; // mid-range salary assumption
  const totalCost = hiresNeeded * avgSalary * 12;
  const reason = headcount === 0
    ? `No employees on record — first hire needed`
    : `Workload overload: ${openTasks} open tasks / ${headcount} employees = ${workloadPerPerson.toFixed(1)} tasks/person (above 5 threshold)`;

  return buildDecision({
    id: hashId('xd-hire', `hire-${hiresNeeded}-${data.fetchedAt.slice(0, 7)}`),
    title: `Approve ${hiresNeeded} new hire${hiresNeeded > 1 ? 's' : ''} to balance workload`,
    description: `${reason}. Propose hiring ${hiresNeeded} new employee${hiresNeeded > 1 ? 's' : ''} at avg salary ${inr(avgSalary)}/month. Annual cost: ${inr(totalCost)}. Reduces workload to ~${Math.round(openTasks / Math.max(headcount + hiresNeeded, 1))} tasks/person.`,
    initiatedBy: 'chro',
    trigger: reason,
    financialImpact: -totalCost, // annual cost
    businessImpact: `Reduce workload from ${workloadPerPerson.toFixed(1)} to ${Math.round(openTasks / Math.max(headcount + hiresNeeded, 1))} tasks/person; prevent burnout & delivery delays`,
    confidence: computeConfidence(data),
    steps: [
      { role: 'chro', action: `Propose ${hiresNeeded} new hire(s) at ${inr(avgSalary)}/month each`, approvalType: 'review' },
      { role: 'coo', action: `Approve headcount expansion; verify operational need`, approvalType: 'approve' },
      { role: 'cfo', action: `Approve budget of ${inr(totalCost)}/year for new hire(s)`, approvalType: 'approve' },
      { role: 'ceo', action: `Final approval for team expansion`, approvalType: 'approve' },
      { role: 'chro', action: `Open requisition; start recruitment`, approvalType: 'execute' },
    ],
    relatedEntityType: 'headcount',
    relatedEntityId: `hire-${data.fetchedAt.slice(0, 7)}`,
  });
}

// ─── 5. Vendor onboarding ────────────────────────────────────────────────────
// Procurement proposes new vendor → Finance approves terms → Legal reviews
// contract → COO approves.
// Trigger: single vendor dependency (vendorCount === 1) OR top vendor > 60% spend.

function buildVendorOnboardingDecision(data: WorkforceDataView): CrossDepartmentDecision | null {
  const vendorCount = data.procurement.vendorCount || 0;
  const topVendors = data.procurement.topVendors || [];
  const totalSpend = topVendors.reduce((s, v) => s + (v.amount || 0), 0);
  const topVendorShare = totalSpend > 0 && topVendors[0]
    ? (topVendors[0].amount / totalSpend) * 100
    : 0;

  if (vendorCount > 1 && topVendorShare < 60) return null;

  const topVendorName = topVendors[0]?.name || 'primary vendor';
  const trigger = vendorCount <= 1
    ? `Single vendor dependency — only ${vendorCount} vendor(s) on record`
    : `Top vendor "${topVendorName}" accounts for ${topVendorShare.toFixed(0)}% of total vendor spend (above 60% threshold)`;

  return buildDecision({
    id: hashId('xd-vendor', `vendor-onboard-${data.fetchedAt.slice(0, 7)}`),
    title: `Onboard backup vendor to reduce dependency on ${topVendorName}`,
    description: `${trigger}. Propose onboarding a secondary vendor to diversify supply chain risk. Top vendor "${topVendorName}" at ${inr(topVendors[0]?.amount || 0)} annual spend.`,
    initiatedBy: 'procurement_manager',
    trigger,
    financialImpact: 0, // no immediate impact; risk mitigation
    businessImpact: `Reduce vendor concentration risk; ensure supply continuity; potential cost savings via competitive quotes`,
    confidence: computeConfidence(data),
    steps: [
      { role: 'procurement_manager', action: `Identify & shortlist 2-3 backup vendors for "${topVendorName}" category`, approvalType: 'review' },
      { role: 'finance_manager', action: `Approve vendor payment terms & credit limits`, approvalType: 'approve' },
      { role: 'legal_advisor', action: `Review vendor contract; verify compliance & IP clauses`, approvalType: 'review' },
      { role: 'coo', action: `Approve new vendor onboarding; authorize first purchase order`, approvalType: 'approve' },
    ],
    relatedEntityType: 'vendor',
    relatedEntityId: topVendorName,
  });
}

// ─── 6. GST filing approval ──────────────────────────────────────────────────
// Compliance proposes GST filing → CFO approves → Finance Manager executes.
// Trigger: GST payable > 0.

function buildGSTFilingDecision(data: WorkforceDataView): CrossDepartmentDecision | null {
  const gstPayable = data.finance.gst || 0;
  if (gstPayable <= 0) return null;

  return buildDecision({
    id: hashId('xd-gst', `gst-file-${data.fetchedAt.slice(0, 7)}`),
    title: `File GST return & disburse ${inr(gstPayable)} payable`,
    description: `Net GST payable of ${inr(gstPayable)} for current period. Compliance has prepared GSTR-3B; needs CFO budget approval & Finance Manager execution to file & disburse before due date.`,
    initiatedBy: 'compliance_manager',
    trigger: `Net GST payable ${inr(gstPayable)} detected for current period`,
    financialImpact: -gstPayable, // cash outflow
    businessImpact: `Avoid late filing penalties (~₹200/day + interest at 18% p.a.); maintain compliance score`,
    confidence: computeConfidence(data),
    steps: [
      { role: 'compliance_manager', action: `Prepare GSTR-3B with net payable ${inr(gstPayable)}`, approvalType: 'review' },
      { role: 'cfo', action: `Approve cash disbursement of ${inr(gstPayable)} for GST payment`, approvalType: 'approve' },
      { role: 'finance_manager', action: `Execute GST filing & bank payment of ${inr(gstPayable)}`, approvalType: 'execute' },
    ],
    relatedEntityType: 'gst_filing',
    relatedEntityId: `period-${data.fetchedAt.slice(0, 7)}`,
  });
}

// ─── 7. Client escalation ────────────────────────────────────────────────────
// Support escalates → Sales reviews → CEO approves resolution.
// Trigger: active notices OR support escalations exist.

function buildClientEscalationDecision(data: WorkforceDataView): CrossDepartmentDecision | null {
  const escalations = data.support.escalationCount || 0;
  const notices = data.raw.notices.filter(
    (n) => n.status === 'open' || n.status === 'pending',
  );
  if (escalations === 0 && notices.length === 0) return null;

  // Pick the highest-priority notice/escalation
  const topNotice = notices
    .slice()
    .sort((a, b) => {
      const rank = (p: string) => (p === 'critical' ? 4 : p === 'high' ? 3 : p === 'medium' ? 2 : 1);
      return rank(b.priority) - rank(a.priority);
    })[0];

  const subject = topNotice?.subject || 'Customer escalation';
  const clientId = topNotice?.clientId || 'unknown';
  const clientName = data.raw.clients.find((c) => c.id === clientId)?.tradeName || clientId;

  return buildDecision({
    id: hashId('xd-escalation', `escalation-${topNotice?.id || 'support'}`),
    title: `Resolve ${topNotice ? 'notice' : 'escalation'}: ${subject} (${clientName})`,
    description: `${topNotice ? `Active notice ${topNotice.noticeType} from ${clientName}` : `${escalations} customer escalations open`}. Requires cross-functional resolution: Support owns communication, Sales reviews account impact, CEO approves resolution strategy. Priority: ${topNotice?.priority || 'high'}.`,
    initiatedBy: 'support_manager',
    trigger: topNotice
      ? `Active notice "${subject}" from ${clientName} (priority ${topNotice.priority})`
      : `${escalations} customer escalations open`,
    financialImpact: 0, // mitigation, not direct cost
    businessImpact: `Prevent client churn; resolve ${topNotice ? 'statutory notice' : 'customer escalation'}; protect ${clientName} relationship`,
    confidence: computeConfidence(data),
    steps: [
      { role: 'support_manager', action: `Escalate "${subject}" for ${clientName} with full context`, approvalType: 'review' },
      { role: 'sales_manager', action: `Review account impact & client relationship; recommend response`, approvalType: 'review' },
      { role: 'legal_advisor', action: topNotice ? `Draft response to notice; ensure statutory compliance` : `Review escalation; advise on legal exposure`, approvalType: 'review' },
      { role: 'ceo', action: `Approve resolution strategy & customer communication`, approvalType: 'approve' },
      { role: 'support_manager', action: `Execute resolution; communicate outcome to ${clientName}`, approvalType: 'execute' },
    ],
    relatedEntityType: topNotice ? 'notice' : 'escalation',
    relatedEntityId: topNotice?.id || `escalations-${data.fetchedAt.slice(0, 10)}`,
  });
}

// ─── 8. Vendor payment approval ──────────────────────────────────────────────
// (Bonus decision — derived from pending bills, complements discount decision)
// Procurement → Finance → COO. Triggered when pending bills exist.

function buildVendorPaymentDecision(data: WorkforceDataView): CrossDepartmentDecision | null {
  const pendingBills = data.raw.purchaseBills.filter(
    (b) => b.status === 'pending' || b.status === 'unpaid',
  );
  if (pendingBills.length === 0) return null;

  const topBill = pendingBills
    .slice()
    .sort((a, b) => b.totalAmount - a.totalAmount)[0];
  const itcClaimable = topBill.gstAmount || 0;

  return buildDecision({
    id: hashId('xd-vendorpay', `vendorpay-${topBill.id}`),
    title: `Approve vendor payment — ${topBill.vendorName} ${topBill.invoiceNo} (${inr(topBill.totalAmount)})`,
    description: `Vendor bill ${topBill.invoiceNo} from ${topBill.vendorName} pending payment of ${inr(topBill.totalAmount)}. ITC of ${inr(itcClaimable)} claimable on payment. Delivery verified by Procurement.`,
    initiatedBy: 'procurement_manager',
    trigger: `Vendor bill ${topBill.invoiceNo} from ${topBill.vendorName} pending — ${inr(topBill.totalAmount)}`,
    financialImpact: -topBill.totalAmount, // cash outflow
    businessImpact: `Maintain ${topBill.vendorName} relationship; claim ITC ${inr(itcClaimable)}; avoid late payment penalties`,
    confidence: computeConfidence(data),
    steps: [
      { role: 'procurement_manager', action: `Verify delivery & PO match for ${topBill.invoiceNo}`, approvalType: 'review' },
      { role: 'finance_manager', action: `Approve payment of ${inr(topBill.totalAmount)}; book ITC ${inr(itcClaimable)}`, approvalType: 'approve' },
      { role: 'coo', action: `Release payment; update vendor reliability score`, approvalType: 'execute' },
    ],
    relatedEntityType: 'purchase_bill',
    relatedEntityId: topBill.id,
  });
}

// ─── 9. Collection recovery decision ─────────────────────────────────────────
// (Bonus decision — derived from overdue invoices, complements discount decision)
// Finance → Sales → CEO. Triggered when overdue invoices exist.

function buildCollectionRecoveryDecision(data: WorkforceDataView): CrossDepartmentDecision | null {
  const overdue = data.raw.invoices.filter((i) => i.status === 'overdue');
  if (overdue.length === 0) return null;

  const topOverdue = overdue.slice().sort((a, b) => b.balanceAmount - a.balanceAmount)[0];
  const clientName = topOverdue.buyerName || (data.raw.clients.find((c) => c.id === topOverdue.clientId)?.tradeName) || topOverdue.clientId;
  const ageDays = topOverdue.dueDate
    ? Math.max(0, Math.round((Date.now() - new Date(topOverdue.dueDate).getTime()) / 86_400_000))
    : 30;

  return buildDecision({
    id: hashId('xd-collection', `collection-${topOverdue.id}`),
    title: `Recover ${inr(topOverdue.balanceAmount)} overdue from ${clientName} (${topOverdue.invoiceNumber})`,
    description: `Invoice ${topOverdue.invoiceNumber} to ${clientName} is ${ageDays} days overdue. Outstanding: ${inr(topOverdue.balanceAmount)}. Propose escalated recovery: formal notice → payment plan → legal action if no response in 7 days.`,
    initiatedBy: 'finance_manager',
    trigger: `Invoice ${topOverdue.invoiceNumber} overdue ${ageDays} days — ${inr(topOverdue.balanceAmount)} outstanding`,
    financialImpact: topOverdue.balanceAmount, // recovery
    businessImpact: `Recover ${inr(topOverdue.balanceAmount)} cash; reduce overdue A/R; prevent bad debt provisioning`,
    confidence: computeConfidence(data),
    steps: [
      { role: 'finance_manager', action: `Issue formal recovery notice to ${clientName} for ${topOverdue.invoiceNumber}`, approvalType: 'review' },
      { role: 'sales_manager', action: `Contact ${clientName} directly; negotiate payment plan if needed`, approvalType: 'review' },
      { role: 'ceo', action: `Approve escalation strategy: payment plan or legal action`, approvalType: 'approve' },
      { role: 'legal_advisor', action: `Prepare legal notice if no response within 7 days`, approvalType: 'notify' },
    ],
    relatedEntityType: 'invoice',
    relatedEntityId: topOverdue.id,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN: computeCrossDecisions — returns all triggered decisions
// ═══════════════════════════════════════════════════════════════════════════════

export function computeCrossDecisions(data: WorkforceDataView): CrossDepartmentDecision[] {
  if (!data?.hasLiveData) return [];

  const decisions: (CrossDepartmentDecision | null)[] = [
    safeBuild('discount', () => buildDiscountDecision(data), null),
    safeBuild('expense', () => buildLargeExpenseDecision(data), null),
    safeBuild('credit', () => buildCreditLineDecision(data), null),
    safeBuild('hire', () => buildNewHireDecision(data), null),
    safeBuild('vendor', () => buildVendorOnboardingDecision(data), null),
    safeBuild('gst', () => buildGSTFilingDecision(data), null),
    safeBuild('escalation', () => buildClientEscalationDecision(data), null),
    safeBuild('vendorpay', () => buildVendorPaymentDecision(data), null),
    safeBuild('collection', () => buildCollectionRecoveryDecision(data), null),
  ];

  // Filter out nulls (trigger not met)
  const active = decisions.filter((d): d is CrossDepartmentDecision => d !== null);

  // Sort: highest financial impact (absolute) first
  active.sort((a, b) => Math.abs(b.financialImpact) - Math.abs(a.financialImpact));

  return active.slice(0, 12); // cap at 12 decisions
}
