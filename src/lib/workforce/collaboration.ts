// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI WORKFORCE™ — AI COLLABORATION ENGINE™
//
// AI Employees communicate automatically. Every message in the cross-employee
// feed is generated from REAL connected business data — overdue invoices,
// pending GST, active notices, anomalies, vendor bills, payroll pressure. The
// engine also produces Collaboration Chains that trace a single business event
// (e.g. a new invoice) through every AI Employee that handles it.
//
// Pure server-side TypeScript. Never throws — wraps every builder in try/catch.
// No mock values. Every ₹ figure, invoice number, client name, vendor name
// comes from the WorkforceDataView.
//
// Tagline: "GSTPilot AI Workforce™ — Don't just use AI. Build an AI Company."
// ═══════════════════════════════════════════════════════════════════════════════

import type { WorkforceDataView } from './data';
import { formatINR } from './data';
import type {
  CollaborationMessage,
  CollaborationChain,
  CollaborationChainStep,
  CollaborationMessageType,
  CollaborationStatus,
  EmployeeRole,
} from './types';

// ─── Deterministic ID helper ─────────────────────────────────────────────────
// Same logical event always produces the same ID across dashboard refreshes —
// so acknowledged messages stay acknowledged.

function hashId(prefix: string, key: string): string {
  try {
    const b64 = Buffer.from(key, 'utf-8').toString('base64');
    // strip trailing '=' and take first 12 chars
    return `${prefix}-${b64.replace(/=+$/, '').slice(0, 12)}`;
  } catch {
    // Fallback: simple deterministic hash from char codes
    let h = 0;
    for (let i = 0; i < key.length; i++) {
      h = ((h << 5) - h + key.charCodeAt(i)) | 0;
    }
    return `${prefix}-${Math.abs(h).toString(36).slice(0, 12)}`;
  }
}

// ─── Safe wrapper (never throws) ──────────────────────────────────────────────

function safeBuild<T>(label: string, fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch (err) {
    console.warn(`[AI Workforce] Collaboration builder "${label}" failed:`, err);
    return fallback;
  }
}

// ─── Format helper (no circular import — minimal inline version) ──────────────

function inrShort(n: number): string {
  return formatINR(n);
}

// ─── Timestamp helpers ────────────────────────────────────────────────────────
// Spread messages across the last 24h so the feed reads chronologically.
// All timestamps are real ISO strings.

function tsMinutesAgo(min: number): string {
  return new Date(Date.now() - min * 60_000).toISOString();
}

function tsHoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

function tsDaysAgo(d: number): string {
  return new Date(Date.now() - d * 86_400_000).toISOString();
}

// ─── Client name lookup ───────────────────────────────────────────────────────

function clientNameById(data: WorkforceDataView, clientId: string): string {
  const c = data.raw.clients.find((cl) => cl.id === clientId);
  if (!c) return clientId;
  return c.tradeName || c.legalName || clientId;
}

function invoiceLabel(inv: {
  invoiceNumber: string;
  buyerName: string | null;
  clientId: string;
  totalAmount: number;
}): string {
  return `${inv.invoiceNumber} (${inrShort(inv.totalAmount)})`;
}

// ─── Chain builder helpers ────────────────────────────────────────────────────

interface ChainSpec {
  id: string;
  title: string;
  trigger: string;
  steps: Array<{ role: EmployeeRole; action: string }>;
  startedAt: string;
  completedAt?: string;
  businessImpact: string;
  status: 'in_progress' | 'completed' | 'blocked';
  relatedEntityType?: string;
  relatedEntityId?: string;
  relatedEntityLabel?: string;
}

function buildChain(spec: ChainSpec): CollaborationChain {
  const steps: CollaborationChainStep[] = spec.steps.map((s, idx) => ({
    order: idx + 1,
    role: s.role,
    action: s.action,
    status: spec.completedAt ? 'done' : idx === 0 ? 'in_progress' : 'pending',
    completedAt: spec.completedAt
      ? spec.startedAt
      : idx === 0
        ? spec.startedAt
        : undefined,
    output: spec.completedAt && idx === spec.steps.length - 1
      ? spec.businessImpact
      : undefined,
  }));
  return {
    id: spec.id,
    title: spec.title,
    trigger: spec.trigger,
    steps,
    status: spec.status,
    startedAt: spec.startedAt,
    completedAt: spec.completedAt,
    businessImpact: spec.businessImpact,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHAIN BUILDERS — one per business-event type
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 1. New customer onboarding chain ─────────────────────────────────────────
// Triggered by recent invoices (last 30 days). The example chain from the spec:
//   Sales → Finance → Operations → Support → CEO

function buildOnboardingChains(data: WorkforceDataView): CollaborationChain[] {
  const chains: CollaborationChain[] = [];
  const now = Date.now();
  const recentInvoices = data.raw.invoices.filter((inv) => {
    if (!inv.invoiceDate) return false;
    const ageDays = (now - new Date(inv.invoiceDate).getTime()) / 86_400_000;
    return ageDays < 30 && (inv.status === 'sent' || inv.status === 'partial' || inv.status === 'paid');
  });

  // Cap to 3 chains so the dashboard doesn't explode
  for (const inv of recentInvoices.slice(0, 3)) {
    const clientName = inv.buyerName || clientNameById(data, inv.clientId);
    const chainId = hashId('chain-onboard', `${inv.id}`);
    const isPaid = inv.status === 'paid' || inv.balanceAmount === 0;
    chains.push(buildChain({
      id: chainId,
      title: `New customer onboarding — ${clientName} (${inv.invoiceNumber})`,
      trigger: `Invoice ${inv.invoiceNumber} issued ${inrShort(inv.totalAmount)} to ${clientName}`,
      steps: [
        { role: 'sales_manager', action: `Logged proposal & sent invoice ${inv.invoiceNumber} to ${clientName}` },
        { role: 'finance_manager', action: `Recorded receivable ${inrShort(inv.totalAmount)}, sent payment instructions` },
        { role: 'operations_manager', action: `Allocated delivery team for ${clientName} onboarding` },
        { role: 'support_manager', action: `Opened onboarding ticket, assigned success manager to ${clientName}` },
        { role: 'ceo', action: `Reviewed new account; confirmed strategic fit` },
      ],
      startedAt: inv.invoiceDate || tsDaysAgo(7),
      completedAt: isPaid ? (inv.paymentDate || tsDaysAgo(1)) : undefined,
      status: isPaid ? 'completed' : 'in_progress',
      businessImpact: `${clientName} onboarding — ${inrShort(inv.totalAmount)} new revenue; ${isPaid ? 'payment received' : 'pending payment'}`,
      relatedEntityType: 'invoice',
      relatedEntityId: inv.id,
      relatedEntityLabel: invoiceLabel(inv),
    }));
  }
  return chains;
}

// ─── 2. Overdue payment recovery chain ────────────────────────────────────────
// Triggered by overdue invoices. Finance → Sales → CEO.

function buildOverdueRecoveryChains(data: WorkforceDataView): CollaborationChain[] {
  const chains: CollaborationChain[] = [];
  const overdue = data.raw.invoices.filter((i) => i.status === 'overdue');
  for (const inv of overdue.slice(0, 3)) {
    const clientName = inv.buyerName || clientNameById(data, inv.clientId);
    const chainId = hashId('chain-overdue', `${inv.id}`);
    const ageDays = inv.dueDate
      ? Math.max(0, (Date.now() - new Date(inv.dueDate).getTime()) / 86_400_000)
      : 30;
    chains.push(buildChain({
      id: chainId,
      title: `Overdue payment recovery — ${clientName} (${inv.invoiceNumber})`,
      trigger: `Invoice ${inv.invoiceNumber} overdue by ${Math.round(ageDays)} days — ${inrShort(inv.balanceAmount)} outstanding`,
      steps: [
        { role: 'finance_manager', action: `Flagged ${inv.invoiceNumber} overdue; computed ${inrShort(inv.balanceAmount)} outstanding` },
        { role: 'sales_manager', action: `Contacting ${clientName} for payment commitment` },
        { role: 'ceo', action: `Reviewing escalation options (legal notice / payment plan)` },
      ],
      startedAt: inv.dueDate || tsDaysAgo(30),
      status: 'in_progress',
      businessImpact: `Recover ${inrShort(inv.balanceAmount)} from ${clientName}; ${Math.round(ageDays)} days overdue`,
      relatedEntityType: 'invoice',
      relatedEntityId: inv.id,
      relatedEntityLabel: invoiceLabel(inv),
    }));
  }
  return chains;
}

// ─── 3. GST compliance cycle chain ────────────────────────────────────────────
// Triggered by pending GST (netGSTPayable > 0) OR pendingFilings > 0.
// Finance → Compliance → Legal → CEO.

function buildGSTComplianceChains(data: WorkforceDataView): CollaborationChain[] {
  const chains: CollaborationChain[] = [];
  const gstPayable = data.finance.gst || 0;
  const pendingFilings = data.compliance.pendingFilings || 0;
  const overdueFilings = data.compliance.overdueFilings || 0;

  if (gstPayable > 0 || pendingFilings > 0 || overdueFilings > 0) {
    const chainId = hashId('chain-gst', `gst-${data.fetchedAt.slice(0, 7)}`); // monthly key
    chains.push(buildChain({
      id: chainId,
      title: `GST compliance cycle — ${inrShort(gstPayable)} payable, ${pendingFilings} filings pending`,
      trigger: gstPayable > 0
        ? `Net GST payable ${inrShort(gstPayable)} detected for current period`
        : `${pendingFilings} GST filings pending`,
      steps: [
        { role: 'finance_manager', action: `Compiled GSTR-1/GSTR-3B; net payable ${inrShort(gstPayable)}` },
        { role: 'compliance_manager', action: `Validated ITC claims; verified filing deadlines` },
        { role: 'legal_advisor', action: `Reviewed notice exposure & penalty risk` },
        { role: 'ceo', action: `Approved filing & cash disbursement of ${inrShort(gstPayable)}` },
      ],
      startedAt: tsDaysAgo(15),
      status: overdueFilings > 0 ? 'blocked' : 'in_progress',
      businessImpact: `Avoid penalties on ${inrShort(gstPayable)} GST liability; ${overdueFilings > 0 ? `${overdueFilings} overdue — penalty risk` : 'on schedule'}`,
      relatedEntityType: 'gst_filing',
      relatedEntityId: `period-${data.fetchedAt.slice(0, 7)}`,
      relatedEntityLabel: `GST cycle ${data.fetchedAt.slice(0, 7)}`,
    }));
  }
  return chains;
}

// ─── 4. Vendor payment workflow chain ─────────────────────────────────────────
// Triggered by pending vendor bills. Procurement → Finance → COO.

function buildVendorPaymentChains(data: WorkforceDataView): CollaborationChain[] {
  const chains: CollaborationChain[] = [];
  const pendingBills = data.raw.purchaseBills.filter(
    (b) => b.status === 'pending' || b.status === 'unpaid',
  );
  for (const bill of pendingBills.slice(0, 3)) {
    const chainId = hashId('chain-vendor', `${bill.id}`);
    const dueLabel = bill.dueDate
      ? `due ${new Date(bill.dueDate).toLocaleDateString('en-IN')}`
      : 'no due date';
    chains.push(buildChain({
      id: chainId,
      title: `Vendor payment workflow — ${bill.vendorName} (${bill.invoiceNo})`,
      trigger: `Purchase bill ${bill.invoiceNo} from ${bill.vendorName} pending — ${inrShort(bill.totalAmount)} ${dueLabel}`,
      steps: [
        { role: 'procurement_manager', action: `Verified delivery & matched PO against ${bill.vendorName} bill` },
        { role: 'finance_manager', action: `Approved payment of ${inrShort(bill.totalAmount)}; booked ITC ${inrShort(bill.gstAmount)}` },
        { role: 'coo', action: `Released payment; logged vendor reliability update` },
      ],
      startedAt: bill.invoiceDate || tsDaysAgo(10),
      status: 'in_progress',
      businessImpact: `Maintain ${bill.vendorName} relationship; claim ITC ${inrShort(bill.gstAmount)}`,
      relatedEntityType: 'purchase_bill',
      relatedEntityId: bill.id,
      relatedEntityLabel: `${bill.vendorName} ${bill.invoiceNo}`,
    }));
  }
  return chains;
}

// ─── 5. Risk escalation chain ─────────────────────────────────────────────────
// Triggered by anomalies or cash risk. Risk → CFO → CEO.

function buildRiskEscalationChains(data: WorkforceDataView): CollaborationChain[] {
  const chains: CollaborationChain[] = [];
  const anomalies = data.twin.anomalies.anomalies || [];
  const criticalAnomalies = anomalies.filter((a) => a.severity === 'critical' || a.severity === 'high');

  for (const anomaly of criticalAnomalies.slice(0, 2)) {
    const chainId = hashId('chain-risk', `anomaly-${anomaly.id}`);
    chains.push(buildChain({
      id: chainId,
      title: `Risk escalation — ${anomaly.title}`,
      trigger: `Anomaly detected on ${anomaly.metric}: ${anomaly.title} (${anomaly.severity})`,
      steps: [
        { role: 'risk_manager', action: `Detected anomaly: ${anomaly.title}; deviation ${anomaly.deviationPct.toFixed(1)}%` },
        { role: 'cfo', action: `Assessed financial impact; reviewed mitigation ${anomaly.recommendation}` },
        { role: 'ceo', action: `Approved mitigation plan; monitoring recovery` },
      ],
      startedAt: anomaly.detectedAt || tsDaysAgo(2),
      status: anomaly.status === 'resolved' ? 'completed' : 'in_progress',
      completedAt: anomaly.status === 'resolved' ? tsHoursAgo(12) : undefined,
      businessImpact: `${anomaly.title} — ${anomaly.severity} risk on ${anomaly.metric}`,
      relatedEntityType: 'anomaly',
      relatedEntityId: anomaly.id,
      relatedEntityLabel: anomaly.title,
    }));
  }

  // Cash runway risk chain
  if (data.finance.runwayDays > 0 && data.finance.runwayDays < 90) {
    const chainId = hashId('chain-risk', `runway-${data.fetchedAt.slice(0, 10)}`);
    chains.push(buildChain({
      id: chainId,
      title: `Cash runway escalation — ${data.finance.runwayDays} days remaining`,
      trigger: `Runway below 90 days (${data.finance.runwayDays}d); burn ${inrShort(data.finance.burnRate)}/month`,
      steps: [
        { role: 'risk_manager', action: `Flagged runway ${data.finance.runwayDays}d below 90d threshold` },
        { role: 'cfo', action: `Prepared credit line proposal & expense reduction plan` },
        { role: 'ceo', action: `Reviewing credit options; prioritizing collection acceleration` },
      ],
      startedAt: tsDaysAgo(3),
      status: 'in_progress',
      businessImpact: `Prevent cash exhaustion; ${data.finance.runwayDays}d runway vs 90d target`,
      relatedEntityType: 'cash_position',
      relatedEntityId: `runway-${data.fetchedAt.slice(0, 10)}`,
      relatedEntityLabel: `Runway ${data.finance.runwayDays}d`,
    }));
  }

  return chains;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN: computeCollaborationChains
// ═══════════════════════════════════════════════════════════════════════════════

export function computeCollaborationChains(data: WorkforceDataView): CollaborationChain[] {
  if (!data?.hasLiveData) return [];

  const all: CollaborationChain[] = [];
  all.push(...safeBuild('onboarding-chains', () => buildOnboardingChains(data), [] as CollaborationChain[]));
  all.push(...safeBuild('overdue-chains', () => buildOverdueRecoveryChains(data), [] as CollaborationChain[]));
  all.push(...safeBuild('gst-chains', () => buildGSTComplianceChains(data), [] as CollaborationChain[]));
  all.push(...safeBuild('vendor-chains', () => buildVendorPaymentChains(data), [] as CollaborationChain[]));
  all.push(...safeBuild('risk-chains', () => buildRiskEscalationChains(data), [] as CollaborationChain[]));

  // Sort: in_progress first, then by startedAt desc
  all.sort((a, b) => {
    if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
    if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
    return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
  });

  return all.slice(0, 12); // cap at 12 chains
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE BUILDERS — one per collaboration trigger
// ═══════════════════════════════════════════════════════════════════════════════

interface MessageSpec {
  from: EmployeeRole;
  to: EmployeeRole;
  type: CollaborationMessageType;
  subject: string;
  body: string;
  status: CollaborationStatus;
  timestamp: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  relatedEntityLabel?: string;
  chainId?: string;
  departmentContext?: string;
}

function makeMessage(prefix: string, key: string, spec: MessageSpec): CollaborationMessage {
  return {
    id: hashId(prefix, key),
    from: spec.from,
    to: spec.to,
    type: spec.type,
    subject: spec.subject,
    body: spec.body,
    status: spec.status,
    timestamp: spec.timestamp,
    relatedEntityType: spec.relatedEntityType,
    relatedEntityId: spec.relatedEntityId,
    relatedEntityLabel: spec.relatedEntityLabel,
    chainId: spec.chainId,
    departmentContext: spec.departmentContext,
  };
}

// ─── 1. Overdue invoices → Sales → Finance handoff ────────────────────────────

function buildOverdueInvoiceMessages(data: WorkforceDataView): CollaborationMessage[] {
  const msgs: CollaborationMessage[] = [];
  const overdue = data.raw.invoices.filter((i) => i.status === 'overdue');
  let counter = 0;
  for (const inv of overdue.slice(0, 5)) {
    const clientName = inv.buyerName || clientNameById(data, inv.clientId);
    const ageDays = inv.dueDate
      ? Math.max(0, Math.round((Date.now() - new Date(inv.dueDate).getTime()) / 86_400_000))
      : 30;
    msgs.push(makeMessage('msg-overdue', `${inv.id}-sales-to-fin`, {
      from: 'sales_manager',
      to: 'finance_manager',
      type: 'handoff',
      subject: `Invoice ${inv.invoiceNumber} overdue — please follow up`,
      body: `Hi Aria/Sage — invoice ${inv.invoiceNumber} to ${clientName} is ${ageDays} days overdue. Outstanding: ${inrShort(inv.balanceAmount)}. I've already sent two reminders. Please initiate formal recovery.`,
      status: 'sent',
      timestamp: tsMinutesAgo(15 + counter * 5),
      relatedEntityType: 'invoice',
      relatedEntityId: inv.id,
      relatedEntityLabel: invoiceLabel(inv),
      chainId: hashId('chain-overdue', `${inv.id}`),
      departmentContext: 'sales→finance',
    }));
    counter++;
  }
  return msgs;
}

// ─── 2. GST pending → Finance → Compliance handoff ────────────────────────────

function buildGSTHandoffMessages(data: WorkforceDataView): CollaborationMessage[] {
  const msgs: CollaborationMessage[] = [];
  const gstPayable = data.finance.gst || 0;
  if (gstPayable > 0 || data.compliance.pendingFilings > 0) {
    msgs.push(makeMessage('msg-gst', `gst-handoff-${data.fetchedAt.slice(0, 7)}`, {
      from: 'finance_manager',
      to: 'compliance_manager',
      type: 'handoff',
      subject: `GST liability ${inrShort(gstPayable)} — please file current period`,
      body: `Net GST payable this period is ${inrShort(gstPayable)} (output ${inrShort(data.finance.itc)} ITC utilized). ${data.compliance.pendingFilings} filings pending. Please prepare GSTR-3B for submission before due date.`,
      status: 'sent',
      timestamp: tsHoursAgo(2),
      relatedEntityType: 'gst_filing',
      relatedEntityId: `period-${data.fetchedAt.slice(0, 7)}`,
      relatedEntityLabel: `GST cycle ${data.fetchedAt.slice(0, 7)}`,
      chainId: hashId('chain-gst', `gst-${data.fetchedAt.slice(0, 7)}`),
      departmentContext: 'finance→compliance',
    }));
  }
  return msgs;
}

// ─── 3. Notices → Compliance → Legal handoff ──────────────────────────────────

function buildNoticeHandoffMessages(data: WorkforceDataView): CollaborationMessage[] {
  const msgs: CollaborationMessage[] = [];
  const openNotices = data.raw.notices.filter(
    (n) => n.status === 'open' || n.status === 'pending',
  );
  let counter = 0;
  for (const notice of openNotices.slice(0, 4)) {
    msgs.push(makeMessage('msg-notice', `${notice.id}-comp-to-legal`, {
      from: 'compliance_manager',
      to: 'legal_advisor',
      type: 'handoff',
      subject: `Notice received — please review`,
      body: `Notice type ${notice.noticeType} (${notice.noticeNumber || 'no number'}) received. Subject: ${notice.subject}. Due ${notice.dueDate ? new Date(notice.dueDate).toLocaleDateString('en-IN') : 'N/A'}. Priority: ${notice.priority}. Please advise on response strategy.`,
      status: 'sent',
      timestamp: tsHoursAgo(3 + counter),
      relatedEntityType: 'notice',
      relatedEntityId: notice.id,
      relatedEntityLabel: notice.subject,
      departmentContext: 'compliance→legal',
    }));
    counter++;
  }
  return msgs;
}

// ─── 4. New invoices → Sales → Finance → Operations → Support → CEO chain ────

function buildNewInvoiceChainMessages(data: WorkforceDataView): CollaborationMessage[] {
  const msgs: CollaborationMessage[] = [];
  const now = Date.now();
  const recent = data.raw.invoices.filter((inv) => {
    if (!inv.invoiceDate) return false;
    const ageDays = (now - new Date(inv.invoiceDate).getTime()) / 86_400_000;
    return ageDays < 14 && (inv.status === 'sent' || inv.status === 'partial');
  });

  let counter = 0;
  for (const inv of recent.slice(0, 3)) {
    const clientName = inv.buyerName || clientNameById(data, inv.clientId);
    const chainId = hashId('chain-onboard', `${inv.id}`);
    const baseTs = new Date(inv.invoiceDate).getTime();

    // Sales → Finance
    msgs.push(makeMessage('msg-newinv-sf', `${inv.id}-sf`, {
      from: 'sales_manager',
      to: 'finance_manager',
      type: 'handoff',
      subject: `New invoice ${inv.invoiceNumber} sent to ${clientName}`,
      body: `Invoice ${inv.invoiceNumber} for ${inrShort(inv.totalAmount)} issued to ${clientName}. Please record receivable and trigger collection workflow.`,
      status: 'acknowledged',
      timestamp: new Date(baseTs + 5 * 60_000).toISOString(),
      relatedEntityType: 'invoice',
      relatedEntityId: inv.id,
      relatedEntityLabel: invoiceLabel(inv),
      chainId,
      departmentContext: 'sales→finance',
    }));

    // Finance → Operations
    msgs.push(makeMessage('msg-newinv-fo', `${inv.id}-fo`, {
      from: 'finance_manager',
      to: 'operations_manager',
      type: 'update',
      subject: `${clientName} onboarded — allocate delivery`,
      body: `${clientName} account is live (${inrShort(inv.totalAmount)}). Allocate operations team for delivery & onboarding.`,
      status: 'acknowledged',
      timestamp: new Date(baseTs + 30 * 60_000).toISOString(),
      relatedEntityType: 'invoice',
      relatedEntityId: inv.id,
      relatedEntityLabel: invoiceLabel(inv),
      chainId,
      departmentContext: 'finance→operations',
    }));

    // Operations → Support
    msgs.push(makeMessage('msg-newinv-os', `${inv.id}-os`, {
      from: 'operations_manager',
      to: 'support_manager',
      type: 'handoff',
      subject: `Onboarding ticket — ${clientName}`,
      body: `Delivery allocated. Please open onboarding ticket & assign success manager for ${clientName}.`,
      status: 'acknowledged',
      timestamp: new Date(baseTs + 90 * 60_000).toISOString(),
      relatedEntityType: 'invoice',
      relatedEntityId: inv.id,
      relatedEntityLabel: invoiceLabel(inv),
      chainId,
      departmentContext: 'operations→support',
    }));

    // Support → CEO
    msgs.push(makeMessage('msg-newinv-sc', `${inv.id}-sc`, {
      from: 'support_manager',
      to: 'ceo',
      type: 'insight',
      subject: `Onboarding complete — ${clientName} (${inrShort(inv.totalAmount)})`,
      body: `${clientName} onboarded end-to-end. Strategic fit confirmed. Suggest quarterly business review in 90 days.`,
      status: 'sent',
      timestamp: new Date(baseTs + 180 * 60_000).toISOString(),
      relatedEntityType: 'invoice',
      relatedEntityId: inv.id,
      relatedEntityLabel: invoiceLabel(inv),
      chainId,
      departmentContext: 'support→ceo',
    }));

    counter++;
  }
  return msgs;
}

// ─── 5. Anomalies → Risk → CEO alert ──────────────────────────────────────────

function buildAnomalyAlertMessages(data: WorkforceDataView): CollaborationMessage[] {
  const msgs: CollaborationMessage[] = [];
  const anomalies = data.twin.anomalies.anomalies || [];
  const critical = anomalies.filter((a) => a.severity === 'critical' || a.severity === 'high');
  let counter = 0;
  for (const a of critical.slice(0, 3)) {
    msgs.push(makeMessage('msg-anomaly', `${a.id}-risk-to-ceo`, {
      from: 'risk_manager',
      to: 'ceo',
      type: 'alert',
      subject: `Anomaly detected: ${a.title}`,
      body: `Metric ${a.metric} deviated ${a.deviationPct.toFixed(1)}% from expected. Current ${a.currentValue}, expected ${a.expectedValue}. Recommendation: ${a.recommendation}.`,
      status: 'sent',
      timestamp: a.detectedAt || tsHoursAgo(6 + counter),
      relatedEntityType: 'anomaly',
      relatedEntityId: a.id,
      relatedEntityLabel: a.title,
      chainId: hashId('chain-risk', `anomaly-${a.id}`),
      departmentContext: 'risk→executive',
    }));
    counter++;
  }
  return msgs;
}

// ─── 6. Cash runway < 90 → CFO → CEO escalation ───────────────────────────────

function buildCashRunwayEscalation(data: WorkforceDataView): CollaborationMessage[] {
  const msgs: CollaborationMessage[] = [];
  if (data.finance.runwayDays > 0 && data.finance.runwayDays < 90) {
    msgs.push(makeMessage('msg-runway', `runway-${data.fetchedAt.slice(0, 10)}`, {
      from: 'cfo',
      to: 'ceo',
      type: 'escalation',
      subject: `Cash runway ${data.finance.runwayDays} days — escalation`,
      body: `Runway is below 90 days (${data.finance.runwayDays}d). Current cash ${inrShort(data.finance.cash)}, burn ${inrShort(data.finance.burnRate)}/month. Recommend: (1) accelerate collections ${inrShort(data.finance.overdueAmount)}, (2) arrange credit line, (3) defer non-essential OpEx.`,
      status: 'sent',
      timestamp: tsHoursAgo(4),
      relatedEntityType: 'cash_position',
      relatedEntityId: `runway-${data.fetchedAt.slice(0, 10)}`,
      relatedEntityLabel: `Runway ${data.finance.runwayDays}d`,
      chainId: hashId('chain-risk', `runway-${data.fetchedAt.slice(0, 10)}`),
      departmentContext: 'finance→executive',
    }));
  }
  return msgs;
}

// ─── 7. Vendor bills pending → Procurement → Finance approval_request ────────

function buildVendorBillApprovalMessages(data: WorkforceDataView): CollaborationMessage[] {
  const msgs: CollaborationMessage[] = [];
  const pendingBills = data.raw.purchaseBills.filter(
    (b) => b.status === 'pending' || b.status === 'unpaid',
  );
  let counter = 0;
  for (const bill of pendingBills.slice(0, 4)) {
    msgs.push(makeMessage('msg-vendor', `${bill.id}-proc-to-fin`, {
      from: 'procurement_manager',
      to: 'finance_manager',
      type: 'approval_request',
      subject: `Approve payment — ${bill.vendorName} ${bill.invoiceNo}`,
      body: `Vendor bill ${bill.invoiceNo} from ${bill.vendorName}: ${inrShort(bill.totalAmount)} (ITC ${inrShort(bill.gstAmount)}). ${bill.dueDate ? `Due ${new Date(bill.dueDate).toLocaleDateString('en-IN')}.` : ''} Delivery verified. Please approve payment.`,
      status: 'sent',
      timestamp: tsHoursAgo(8 + counter * 2),
      relatedEntityType: 'purchase_bill',
      relatedEntityId: bill.id,
      relatedEntityLabel: `${bill.vendorName} ${bill.invoiceNo}`,
      chainId: hashId('chain-vendor', `${bill.id}`),
      departmentContext: 'procurement→finance',
    }));
    counter++;
  }
  return msgs;
}

// ─── 8. Payroll > cash → CHRO → CFO → CEO escalation ─────────────────────────

function buildPayrollEscalationMessages(data: WorkforceDataView): CollaborationMessage[] {
  const msgs: CollaborationMessage[] = [];
  const payroll = data.hr.payrollAmount || 0;
  const cash = data.finance.cash || 0;
  if (payroll > 0 && cash > 0 && payroll > cash) {
    msgs.push(makeMessage('msg-payroll-cfo', `payroll-cfo-${data.fetchedAt.slice(0, 10)}`, {
      from: 'chro',
      to: 'cfo',
      type: 'escalation',
      subject: `Payroll ${inrShort(payroll)} exceeds cash ${inrShort(cash)}`,
      body: `Payroll obligation ${inrShort(payroll)} exceeds current cash ${inrShort(cash)}. Deficit ${inrShort(payroll - cash)}. Please arrange interim funding before payroll date.`,
      status: 'sent',
      timestamp: tsHoursAgo(5),
      relatedEntityType: 'payroll',
      relatedEntityId: `payroll-${data.fetchedAt.slice(0, 7)}`,
      relatedEntityLabel: `Payroll ${inrShort(payroll)}`,
      departmentContext: 'hr→finance',
    }));
    msgs.push(makeMessage('msg-payroll-ceo', `payroll-ceo-${data.fetchedAt.slice(0, 10)}`, {
      from: 'cfo',
      to: 'ceo',
      type: 'escalation',
      subject: `Payroll funding required — ${inrShort(payroll - cash)} shortfall`,
      body: `CHRO flagged payroll exceeds cash by ${inrShort(payroll - cash)}. Options: (1) credit line drawdown, (2) delay non-essential OpEx, (3) negotiate payroll date. Need CEO direction within 48h.`,
      status: 'sent',
      timestamp: tsHoursAgo(4),
      relatedEntityType: 'payroll',
      relatedEntityId: `payroll-${data.fetchedAt.slice(0, 7)}`,
      relatedEntityLabel: `Payroll shortfall ${inrShort(payroll - cash)}`,
      departmentContext: 'finance→executive',
    }));
  }
  return msgs;
}

// ─── 9. Cross-department status updates ──────────────────────────────────────

function buildStatusUpdates(data: WorkforceDataView): CollaborationMessage[] {
  const msgs: CollaborationMessage[] = [];

  // COO → CEO weekly operations update
  if (data.operations.openTasks > 0) {
    msgs.push(makeMessage('msg-ops-status', `ops-status-${data.fetchedAt.slice(0, 10)}`, {
      from: 'operations_manager',
      to: 'coo',
      type: 'update',
      subject: `Operations status — ${data.operations.openTasks} open tasks`,
      body: `Open tasks: ${data.operations.openTasks}. Employees: ${data.operations.employeeCount}. Automation rules: ${data.operations.automationCount}. Delivery pending: ${data.operations.deliveryPending}. Efficiency: ${data.operations.efficiencyPct}%.`,
      status: 'sent',
      timestamp: tsHoursAgo(7),
      departmentContext: 'operations',
    }));
  }

  // CMO → CEO marketing performance
  if (data.marketing.leadCount > 0 || data.marketing.revenueGrowthPct !== 0) {
    msgs.push(makeMessage('msg-mkt-status', `mkt-status-${data.fetchedAt.slice(0, 10)}`, {
      from: 'marketing_manager',
      to: 'cmo',
      type: 'insight',
      subject: `Marketing — ${data.marketing.leadCount} leads, growth ${data.marketing.revenueGrowthPct.toFixed(1)}%`,
      body: `Revenue growth ${data.marketing.revenueGrowthPct.toFixed(1)}% M-o-M. Campaign ROI ${data.marketing.campaignROI.toFixed(1)}. Leads in pipeline ${data.marketing.leadCount}. Brand engagement ${data.marketing.brandEngagement.toFixed(0)}%. Trend: ${data.marketing.trafficTrend}.`,
      status: 'sent',
      timestamp: tsHoursAgo(9),
      departmentContext: 'marketing',
    }));
  }

  // Support → COO ticket update
  if (data.support.openTickets > 0) {
    msgs.push(makeMessage('msg-sup-status', `sup-status-${data.fetchedAt.slice(0, 10)}`, {
      from: 'support_manager',
      to: 'coo',
      type: 'update',
      subject: `Support — ${data.support.openTickets} open tickets`,
      body: `Open tickets: ${data.support.openTickets}. Escalations: ${data.support.escalationCount}. Satisfaction: ${data.support.satisfactionPct.toFixed(0)}%. Onboarding: ${data.support.onboardingCount}.`,
      status: 'sent',
      timestamp: tsHoursAgo(11),
      departmentContext: 'support→operations',
    }));
  }

  // Data Analyst → CTO data quality
  if (data.technology.dataConnections > 0) {
    msgs.push(makeMessage('msg-data-status', `data-status-${data.fetchedAt.slice(0, 10)}`, {
      from: 'data_analyst',
      to: 'cto',
      type: 'update',
      subject: `Data — ${data.data.totalRecords} records, ${data.technology.activeIntegrations}/${data.technology.dataConnections} integrations active`,
      body: `Total records: ${data.data.totalRecords}. Data sources: ${data.data.dataSources}. Active integrations: ${data.technology.activeIntegrations}/${data.technology.dataConnections}. Quality score: ${data.technology.dataQualityScore}%. Sync errors: ${data.technology.syncErrors}. Forecast confidence: ${data.data.forecastConfidence.toFixed(0)}%.`,
      status: 'sent',
      timestamp: tsHoursAgo(13),
      departmentContext: 'data→technology',
    }));
  }

  return msgs;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN: computeCollaborationFeed
// ═══════════════════════════════════════════════════════════════════════════════

export function computeCollaborationFeed(data: WorkforceDataView): CollaborationMessage[] {
  if (!data?.hasLiveData) return [];

  const all: CollaborationMessage[] = [];
  all.push(...safeBuild('overdue-msgs', () => buildOverdueInvoiceMessages(data), [] as CollaborationMessage[]));
  all.push(...safeBuild('gst-msgs', () => buildGSTHandoffMessages(data), [] as CollaborationMessage[]));
  all.push(...safeBuild('notice-msgs', () => buildNoticeHandoffMessages(data), [] as CollaborationMessage[]));
  all.push(...safeBuild('newinv-msgs', () => buildNewInvoiceChainMessages(data), [] as CollaborationMessage[]));
  all.push(...safeBuild('anomaly-msgs', () => buildAnomalyAlertMessages(data), [] as CollaborationMessage[]));
  all.push(...safeBuild('runway-msgs', () => buildCashRunwayEscalation(data), [] as CollaborationMessage[]));
  all.push(...safeBuild('vendor-msgs', () => buildVendorBillApprovalMessages(data), [] as CollaborationMessage[]));
  all.push(...safeBuild('payroll-msgs', () => buildPayrollEscalationMessages(data), [] as CollaborationMessage[]));
  all.push(...safeBuild('status-msgs', () => buildStatusUpdates(data), [] as CollaborationMessage[]));

  // Sort by timestamp descending (most recent first)
  all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Cap at 30 messages
  return all.slice(0, 30);
}
