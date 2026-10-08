// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Execution Engine™ — MODULE 1: Observation Engine™
// Phase 8 Step 5 — Observe. Think. Decide. Execute. Confirm. Learn.
// ═══════════════════════════════════════════════════════════════════════════════
// Monitors 9 business-signal classes for Indian SMEs / CA firms:
//   GST due dates • Bank transactions • Receivables • Payables • Payroll •
//   TDS compliance • Client behaviour • Cash flow • Collection risk
//
// Pure TypeScript — no Prisma, no React, no 'use client'.
// Importable from both Next.js API routes (server) and React components (client).
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  BusinessEvent,
  BusinessEventType,
  EventSeverity,
  ObservationSummary,
  DetectedIssue,
} from './types';

// ─── Indian Rupee grouping (₹1,23,456 — not Western 1,23,456) ─────────────────
export function formatInr(n: number): string {
  const neg = n < 0;
  const abs = Math.abs(Math.round(n));
  const digits = abs.toString();
  let grouped: string;
  if (digits.length <= 3) {
    grouped = digits;
  } else {
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3);
    grouped = `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`;
  }
  return `${neg ? '-' : ''}₹${grouped}`;
}

// Local alias to keep this file dependency-free of sibling engine modules.
const inr = formatInr;

// ─── The 9 monitored business-signal classes ──────────────────────────────────
export interface BusinessEventTypeMeta {
  type: BusinessEventType;
  label: string;
  icon: string;
  description: string;
}

export const BUSINESS_EVENT_TYPES: BusinessEventTypeMeta[] = [
  { type: 'gst_due',            label: 'GST Due Dates',     icon: 'calendar-clock',    description: 'GSTR-1 / 3B / 2B filing windows + late-fee exposure' },
  { type: 'bank_transaction',   label: 'Bank Transactions', icon: 'banknote',          description: 'Live UPI / NEFT / RTGS credits & debits across linked accounts' },
  { type: 'receivable',         label: 'Receivables',       icon: 'arrow-down-circle', description: 'Outstanding client invoices + aging buckets' },
  { type: 'payable',            label: 'Payables',          icon: 'arrow-up-circle',   description: 'Vendor bills + statutory payouts due' },
  { type: 'payroll',            label: 'Payroll',           icon: 'users',             description: 'Monthly salary run + PF / ESI / TDS deductions' },
  { type: 'tds',                label: 'TDS Compliance',    icon: 'receipt',           description: 'Section 194C / 194J / 194I withholding + challan timelines' },
  { type: 'client_behaviour',   label: 'Client Behaviour',  icon: 'user-check',        description: 'Payment-pattern learning + risk segmentation' },
  { type: 'cash_flow',          label: 'Cash Flow',         icon: 'trending-up',       description: '13-week rolling cash forecast + runway prediction' },
  { type: 'collection_risk',    label: 'Collection Risk',   icon: 'alert-triangle',    description: 'Default-probability scoring on overdue receivables' },
];

const EVENT_TYPES: BusinessEventType[] = [
  'gst_due', 'bank_transaction', 'receivable', 'payable', 'payroll',
  'tds', 'client_behaviour', 'cash_flow', 'collection_risk',
];

const SEVERITIES: EventSeverity[] = ['info', 'low', 'medium', 'high', 'critical'];

// ─── seedBusinessEvents (no-op) ──────────────────────────────────────────────
// Previously this function synthesised demo BusinessEvent rows from a
// hardcoded inline array referencing fabricated clients, bank accounts,
// invoice numbers, and amounts. The export name is preserved so existing
// callers continue to compile, but it now returns `[]` so the UI renders a
// proper empty state. Real business events come from
// `db.businessEvent.findMany()` via the API routes (or are detected at
// runtime by detectEvents / detectIssues below).
export function seedBusinessEvents(): BusinessEvent[] {
  return [];
}


// ─── Observation Summary — derived from event stream ──────────────────────────
export function getObservationSummary(events: BusinessEvent[]): ObservationSummary {
  const byType = {} as Record<BusinessEventType, number>;
  const bySeverity = {} as Record<EventSeverity, number>;
  for (const t of EVENT_TYPES) byType[t] = 0;
  for (const s of SEVERITIES) bySeverity[s] = 0;

  let openEvents = 0;
  let criticalEvents = 0;
  let highSeverityEvents = 0;

  for (const e of events) {
    byType[e.type] = (byType[e.type] ?? 0) + 1;
    bySeverity[e.severity] = (bySeverity[e.severity] ?? 0) + 1;
    if (e.status === 'open' || e.status === 'escalated') openEvents += 1;
    if (e.severity === 'critical') criticalEvents += 1;
    if (e.severity === 'high') highSeverityEvents += 1;
  }

  const recentEvents = [...events]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  // Detected issues are derived from high+critical events (the signals worth acting on).
  const detectedIssues: DetectedIssue[] = events
    .filter((e) => e.severity === 'high' || e.severity === 'critical')
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .map(deriveIssue);

  return {
    totalEvents: events.length,
    openEvents,
    criticalEvents,
    highSeverityEvents,
    byType,
    bySeverity,
    recentEvents,
    detectedIssues,
  };
}

function severityRank(s: EventSeverity): number {
  return { info: 0, low: 1, medium: 2, high: 3, critical: 4 }[s] ?? 0;
}

function deriveIssue(e: BusinessEvent): DetectedIssue {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  const num = (k: string): number | null =>
    typeof p[k] === 'number' ? (p[k] as number) : null;
  const str = (k: string): string | null =>
    typeof p[k] === 'string' ? (p[k] as string) : null;

  switch (e.type) {
    case 'gst_due': {
      const form = str('form') ?? 'GST return';
      const net = num('netPayable') ?? num('outputTaxLiability') ?? num('itcExpected');
      const due = str('dueDate') ?? (num('dueInHours') != null ? `${num('dueInHours')}h` : 'soon');
      return {
        type: e.type,
        title: `${form} window open`,
        description:
          `${form} for ${str('period') ?? 'current period'} due ${due}` +
          (net != null ? ` — ${net >= 0 ? 'net liability' : 'net refund'} ${inr(Math.abs(net))}` : '') +
          `. Late fee ₹50/day + 18% p.a. interest on delayed tax.`,
        severity: e.severity,
        suggestedAction:
          'Prepare return immediately; verify cash ledger balance; file before due date to avoid penalty exposure.',
      };
    }
    case 'bank_transaction': {
      const amt = num('amount');
      const dir = str('direction') ?? 'movement';
      const cp = str('counterparty') ?? 'counterparty';
      return {
        type: e.type,
        title: `Bank ${dir} detected — ${amt != null ? inr(amt) : 'unknown amount'}`,
        description:
          `${dir === 'credit' ? 'Credit' : 'Debit'} ${amt != null ? inr(amt) : ''} via ` +
          `${str('mode') ?? 'bank'} from ${cp}. Reference: ${str('reference') ?? 'n/a'}.`,
        severity: e.severity,
        suggestedAction:
          'Auto-reconcile against open invoices / payables; flag if unmatched or outside expected pattern.',
      };
    }
    case 'receivable': {
      const amt = num('amount') ?? num('totalOutstanding');
      const client = str('client') ?? 'client';
      const days = num('overdueDays');
      return {
        type: e.type,
        title: `Overdue receivable — ${client}`,
        description:
          `${client} invoice ${str('invoiceNo') ?? ''} ${amt != null ? inr(amt) : ''} ` +
          (days != null ? `${days} days overdue (DSO ${num('dso') ?? '?'})` : 'overdue') + '.',
        severity: e.severity,
        suggestedAction:
          'Trigger collection recovery workflow; send WhatsApp + email reminder; escalate if >60 days.',
      };
    }
    case 'payable': {
      const amt = num('amount');
      const vendor = str('vendor') ?? 'vendor';
      const due = num('dueInDays');
      return {
        type: e.type,
        title: `Payable approaching due — ${vendor}`,
        description:
          `${vendor} bill ${amt != null ? inr(amt) : ''} due in ${due ?? '?'} days` +
          (str('earlyPayDiscount') ? ` — ${str('earlyPayDiscount')}` : '') + '.',
        severity: e.severity,
        suggestedAction:
          'Schedule payment via Payment Engine; capture early-pay discount if offered; preserve runway.',
      };
    }
    case 'payroll': {
      const cycle = str('cycle') ?? 'cycle';
      const net = num('netPayable');
      const emp = num('employeeCount');
      return {
        type: e.type,
        title: `Payroll run pending — ${cycle}`,
        description:
          `${emp ?? '?'} employees, gross ${num('grossPayroll') != null ? inr(num('grossPayroll')!) : ''}, ` +
          `net ${net != null ? inr(net) : ''}. PF ${num('pfDeduction') ?? 0} + TDS ${num('tdsDeduction') ?? 0}.`,
        severity: e.severity,
        suggestedAction:
          'Lock attendance; compute PF / ESI / TDS; release net-pay bank file before pay-date.',
      };
    }
    case 'tds': {
      const q = str('quarter') ?? str('section') ?? 'review';
      const amt = num('totalTDS') ?? num('amount');
      return {
        type: e.type,
        title: `TDS compliance gap — ${q}`,
        description:
          `${str('returnForm') ?? 'Return'} for ${q} — ${amt != null ? inr(amt) : ''} ` +
          `pending. Due: ${str('dueDate') ?? 'per schedule'}. ` +
          `Challan status: ${str('challanStatus') ?? 'unpaid'}.`,
        severity: e.severity,
        suggestedAction:
          'Deposit pending challan via ITNS-281; prepare 26Q return; file before statutory due date.',
      };
    }
    case 'client_behaviour': {
      const client = str('client') ?? 'client';
      const avg = num('observedAvgPaymentDays');
      const terms = num('contractualTerms');
      const seg = str('riskSegment') ?? 'unclassified';
      return {
        type: e.type,
        title: `Payment-pattern shift — ${client}`,
        description:
          `${client} pays in ${avg ?? '?'} days vs ${terms ?? '?'}-day terms. ` +
          `Risk segment: ${seg}. Confidence ${(num('confidence') ?? 0) * 100}%.`,
        severity: e.severity,
        suggestedAction:
          'Update risk-segment; tighten credit terms for amber/red clients; offer early-pay discount to green.',
      };
    }
    case 'cash_flow': {
      const runway = num('runwayDays');
      const deficit = num('netDeficit');
      const balance = num('currentBankBalance');
      return {
        type: e.type,
        title: 'Cash-flow stress predicted',
        description:
          `Runway ${runway != null ? `${runway} days` : 'low'}` +
          (balance != null ? ` • bank balance ${inr(balance)}` : '') +
          (deficit != null ? ` • projected deficit ${inr(Math.abs(deficit))}` : '') + '.',
        severity: e.severity,
        suggestedAction:
          'Activate invoice-discounting bridge; defer non-essential capex; alert CFO + renegotiate vendor terms.',
      };
    }
    case 'collection_risk': {
      const client = str('client') ?? 'client';
      const amt = num('amount');
      const prob = num('defaultProbability');
      const stage = str('recoveryStage') ?? 'pending';
      return {
        type: e.type,
        title: `Default-risk receivable — ${client}`,
        description:
          `${client} ${amt != null ? inr(amt) : ''} overdue ${num('overdueDays') ?? '?'} days. ` +
          `Default probability ${prob != null ? `${Math.round(prob * 100)}%` : 'high'}. ` +
          `Recovery stage: ${stage}.`,
        severity: e.severity,
        suggestedAction:
          'Escalate to legal recovery; issue IBC Section 9 notice (MSME); provision doubtful debt in books.',
      };
    }
    default:
      return {
        type: e.type,
        title: `Signal detected — ${e.type}`,
        description: 'Auto-generated issue from observation engine.',
        severity: e.severity,
        suggestedAction: 'Review event payload and decide on next action.',
      };
  }
}

// ─── Live-data integration: scan Invoice Engine records for issues ────────────
// Pure — accepts plain objects (no Prisma types), returns DetectedIssue[].
export function detectEvents(
  invoices?: Record<string, unknown>[],
  receivables?: Record<string, unknown>[],
  payables?: Record<string, unknown>[],
): DetectedIssue[] {
  const issues: DetectedIssue[] = [];
  const now = Date.now();

  if (invoices && invoices.length > 0) {
    const overdue = invoices.filter((inv) => {
      const dueRaw = inv.dueDate as string | undefined;
      const status = inv.paymentStatus as string | undefined;
      if (!dueRaw || status === 'paid' || status === 'settled') return false;
      const dueMs = new Date(dueRaw).getTime();
      return Number.isFinite(dueMs) && dueMs < now;
    });
    if (overdue.length > 0) {
      const total = overdue.reduce(
        (s, inv) => s + Number(inv.total ?? inv.amount ?? 0),
        0,
      );
      issues.push({
        type: 'receivable',
        title: `${overdue.length} overdue sales invoice(s) detected`,
        description: `Total overdue value ${inr(total)} across ${overdue.length} invoice(s).`,
        severity: total > 500000 ? 'high' : 'medium',
        suggestedAction:
          'Trigger collection recovery workflow + send payment reminders via WhatsApp / email.',
      });
    }
  }

  if (receivables && receivables.length > 0) {
    const risky = receivables.filter((r) => {
      const days = Number(r.overdueDays ?? 0);
      return days >= 60;
    });
    if (risky.length > 0) {
      const total = risky.reduce((s, r) => s + Number(r.amount ?? 0), 0);
      issues.push({
        type: 'collection_risk',
        title: `${risky.length} receivable(s) in 60+ day bucket`,
        description: `High-risk pool totalling ${inr(total)} — escalate before books close.`,
        severity: total > 1000000 ? 'critical' : 'high',
        suggestedAction:
          'Escalate to legal recovery; consider IBC Section 9 notice for MSME clients.',
      });
    }
  }

  if (payables && payables.length > 0) {
    const dueSoon = payables.filter((p) => {
      const days = Number(p.dueInDays ?? 999);
      return days <= 7;
    });
    if (dueSoon.length > 0) {
      const total = dueSoon.reduce((s, p) => s + Number(p.amount ?? 0), 0);
      issues.push({
        type: 'payable',
        title: `${dueSoon.length} payable(s) due within 7 days`,
        description: `Vendor payouts totalling ${inr(total)} scheduled this week.`,
        severity: total > 500000 ? 'high' : 'medium',
        suggestedAction:
          'Schedule payments via Payment Engine; capture early-pay discounts where offered.',
      });
    }
  }

  return issues;
}

// ─── Lightweight scalar-issue detector (for Oracle + dashboard quick-checks) ──
export function detectIssues(opts: {
  overdueInvoices?: number;
  pendingTds?: number;
  cashRunwayDays?: number;
}): DetectedIssue[] {
  const issues: DetectedIssue[] = [];

  if (typeof opts.overdueInvoices === 'number' && opts.overdueInvoices > 0) {
    issues.push({
      type: 'receivable',
      title: `${opts.overdueInvoices} overdue invoice(s) flagged`,
      description: `${opts.overdueInvoices} client invoice(s) have crossed their due date without payment receipt.`,
      severity: opts.overdueInvoices >= 5 ? 'critical' : 'high',
      suggestedAction:
        'Trigger collection recovery workflow; send WhatsApp + email reminders; escalate after 60 days.',
    });
  }

  if (typeof opts.pendingTds === 'number' && opts.pendingTds > 0) {
    issues.push({
      type: 'tds',
      title: `TDS pending — ${inr(opts.pendingTds)} liability`,
      description: `Outstanding TDS deposit of ${inr(opts.pendingTds)}; challan ITNS-281 + 26Q return preparation required.`,
      severity: opts.pendingTds >= 200000 ? 'high' : 'medium',
      suggestedAction:
        'Generate ITNS-281 challan; deposit before statutory due date; prepare 26Q return.',
    });
  }

  if (typeof opts.cashRunwayDays === 'number' && opts.cashRunwayDays < 15) {
    issues.push({
      type: 'cash_flow',
      title: `Cash runway critical — ${opts.cashRunwayDays} day(s)`,
      description: `Predicted cash shortage in ${opts.cashRunwayDays} day(s); immediate working-capital action required.`,
      severity: opts.cashRunwayDays < 7 ? 'critical' : 'high',
      suggestedAction:
        'Activate invoice-discounting bridge; defer non-essential capex; alert CFO.',
    });
  }

  return issues;
}
