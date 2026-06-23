// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Execution Engine™ — MODULE 1: Observation Engine™
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

// ─── Timestamp helpers (timeline feels live, spread across last 48h) ──────────
function isoHoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}
function isoDaysAhead(d: number): string {
  return new Date(Date.now() + d * 86400 * 1000).toISOString();
}

// ─── 16 seed events covering all 9 monitored areas (Indian SME context) ───────
export function seedBusinessEvents(): BusinessEvent[] {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
  const tomorrowDMY =
    `${String(tomorrow.getUTCDate()).padStart(2, '0')}/` +
    `${String(tomorrow.getUTCMonth() + 1).padStart(2, '0')}/` +
    `${tomorrow.getUTCFullYear()}`;

  return [
    // ── 1. GST DUE — GSTR-3B due tomorrow ──────────────────────────────────
    {
      id: 'evt_gstr3b_due_001',
      businessId: 'biz_sharma_enterprises',
      type: 'gst_due',
      source: 'gst',
      payload: {
        form: 'GSTR-3B',
        period: 'December 2025',
        dueDate: tomorrowDMY,
        dueInHours: 24,
        outputTaxLiability: 420000,
        itcAvailable: 210000,
        netPayable: 210000,
        cashLedgerBalance: 95000,
        lateFeePerDay: 50,
        interestRate: '18% p.a.',
      },
      severity: 'critical',
      status: 'open',
      createdAt: isoHoursAgo(0.5),
    },
    // ── 2. GST DUE — GSTR-2B download pending ──────────────────────────────
    {
      id: 'evt_gstr2b_download_002',
      businessId: 'biz_sharma_enterprises',
      type: 'gst_due',
      source: 'gst',
      payload: {
        form: 'GSTR-2B',
        period: 'December 2025',
        action: 'download_2b_for_itc_reconciliation',
        itcExpected: 210000,
        vendors: 24,
      },
      severity: 'high',
      status: 'open',
      createdAt: isoHoursAgo(3),
    },
    // ── 3. BANK TRANSACTION — large credit received ────────────────────────
    {
      id: 'evt_bank_credit_003',
      businessId: 'biz_sharma_enterprises',
      type: 'bank_transaction',
      source: 'banking',
      payload: {
        bank: 'HDFC Bank',
        account: 'XXXX-4821',
        mode: 'UPI',
        direction: 'credit',
        amount: 320000,
        counterparty: 'Sharma Enterprises LLP',
        utr: 'UPI-AXIS-4821-9934',
        reference: 'INV-2025-0184 final settlement',
        matched: true,
      },
      severity: 'info',
      status: 'resolved',
      createdAt: isoHoursAgo(2),
    },
    // ── 4. BANK TRANSACTION — rent debit ───────────────────────────────────
    {
      id: 'evt_bank_debit_004',
      businessId: 'biz_sharma_enterprises',
      type: 'bank_transaction',
      source: 'banking',
      payload: {
        bank: 'HDFC Bank',
        account: 'XXXX-4821',
        mode: 'NEFT',
        direction: 'debit',
        amount: 58000,
        counterparty: 'Brigade Gateway',
        reference: 'Office rent — January 2026',
        category: 'rent',
        matched: true,
      },
      severity: 'low',
      status: 'resolved',
      createdAt: isoHoursAgo(7),
    },
    // ── 5. RECEIVABLE — Verma Industries ₹18.2L overdue ────────────────────
    {
      id: 'evt_recv_overdue_005',
      businessId: 'biz_sharma_enterprises',
      type: 'receivable',
      source: 'invoice',
      payload: {
        client: 'Verma Industries LLP',
        clientId: 'cli_verma_001',
        invoiceNo: 'INV-2025-0172',
        amount: 1820000,
        overdueDays: 32,
        terms: 30,
        invoiceDate: '15/11/2025',
        dueDate: '15/12/2025',
        dso: 62,
      },
      severity: 'critical',
      status: 'open',
      createdAt: isoHoursAgo(5),
    },
    // ── 6. RECEIVABLE — aging snapshot across 11 clients ───────────────────
    {
      id: 'evt_recv_aging_006',
      businessId: 'biz_sharma_enterprises',
      type: 'receivable',
      source: 'invoice',
      payload: {
        totalOutstanding: 4280000,
        agingBuckets: {
          '0-30':  1840000,
          '31-60':  620000,
          '61-90':  980000,
          '90+':    840000,
        },
        clientCount: 11,
        averageDSO: 51,
      },
      severity: 'high',
      status: 'open',
      createdAt: isoHoursAgo(11),
    },
    // ── 7. PAYABLE — Patel & Sons ₹2.4L due in 7 days ──────────────────────
    {
      id: 'evt_payable_patel_007',
      businessId: 'biz_sharma_enterprises',
      type: 'payable',
      source: 'invoice',
      payload: {
        vendor: 'Patel & Sons Hardware',
        vendorId: 'ven_patel_001',
        billNo: 'PS-2025-1129',
        amount: 240000,
        dueInDays: 7,
        terms: 15,
        earlyPayDiscount: '2% if paid in 5 days',
      },
      severity: 'medium',
      status: 'open',
      createdAt: isoHoursAgo(9),
    },
    // ── 8. PAYABLE — HDFC MSME Loan EMI ────────────────────────────────────
    {
      id: 'evt_payable_emi_008',
      businessId: 'biz_sharma_enterprises',
      type: 'payable',
      source: 'banking',
      payload: {
        vendor: 'HDFC Bank — MSME Loan',
        description: 'EMI instalment',
        amount: 124000,
        dueInDays: 5,
        principal: 98000,
        interest: 26000,
        loanOutstanding: 1420000,
      },
      severity: 'high',
      status: 'open',
      createdAt: isoHoursAgo(14),
    },
    // ── 9. PAYROLL — January cycle for 18 employees ────────────────────────
    {
      id: 'evt_payroll_run_009',
      businessId: 'biz_sharma_enterprises',
      type: 'payroll',
      source: 'payroll',
      payload: {
        cycle: 'January 2026',
        payDate: '31/01/2026',
        employeeCount: 18,
        grossPayroll: 842000,
        pfDeduction: 71200,
        esiDeduction: 0,
        tdsDeduction: 40600,
        professionalTax: 2400,
        netPayable: 727800,
        status: 'draft',
      },
      severity: 'high',
      status: 'open',
      createdAt: isoHoursAgo(16),
    },
    // ── 10. TDS — Q3 ₹3.4L pending (26Q return) ────────────────────────────
    {
      id: 'evt_tds_q3_pending_010',
      businessId: 'biz_sharma_enterprises',
      type: 'tds',
      source: 'gst',
      payload: {
        quarter: 'Q3 FY25-26',
        returnForm: '26Q',
        dueDate: '31/01/2026',
        totalTDS: 340000,
        sections: {
          '194C': 210000, // contractor
          '194J': 95000,  // professional fees
          '194I': 35000,  // rent
        },
        challanStatus: '3 of 4 paid',
        pendingChallan: 85000,
      },
      severity: 'high',
      status: 'open',
      createdAt: isoHoursAgo(13),
    },
    // ── 11. TDS — 194J challan for Apollo Legal ────────────────────────────
    {
      id: 'evt_tds_challan_011',
      businessId: 'biz_sharma_enterprises',
      type: 'tds',
      source: 'gst',
      payload: {
        section: '194J',
        vendor: 'Apollo Legal Associates',
        amount: 28000,
        rate: '10%',
        invoiceValue: 280000,
        dueDate: '07/02/2026',
        challanType: 'ITNS-281',
      },
      severity: 'medium',
      status: 'open',
      createdAt: isoHoursAgo(20),
    },
    // ── 12. CLIENT BEHAVIOUR — Sharma pays 47 days (amber) ─────────────────
    {
      id: 'evt_behaviour_sharma_012',
      businessId: 'biz_sharma_enterprises',
      type: 'client_behaviour',
      source: 'communication',
      payload: {
        client: 'Sharma Enterprises LLP',
        clientId: 'cli_sharma_001',
        observedAvgPaymentDays: 47,
        contractualTerms: 30,
        delayPattern: '+17 days average',
        sampleSize: 12,
        confidence: 0.92,
        riskSegment: 'amber',
      },
      severity: 'medium',
      status: 'open',
      createdAt: isoHoursAgo(18),
    },
    // ── 13. CLIENT BEHAVIOUR — Mehta early-payer (green) ───────────────────
    {
      id: 'evt_behaviour_mehta_013',
      businessId: 'biz_sharma_enterprises',
      type: 'client_behaviour',
      source: 'communication',
      payload: {
        client: 'Mehta Traders',
        clientId: 'cli_mehta_001',
        observedAvgPaymentDays: 14,
        contractualTerms: 30,
        delayPattern: '-16 days (early payer)',
        sampleSize: 9,
        confidence: 0.88,
        riskSegment: 'green',
        earlyPayDiscountEligible: true,
      },
      severity: 'info',
      status: 'resolved',
      createdAt: isoHoursAgo(28),
    },
    // ── 14. CASH FLOW — shortage predicted in 12 days ──────────────────────
    {
      id: 'evt_cash_shortage_014',
      businessId: 'biz_sharma_enterprises',
      type: 'cash_flow',
      source: 'system',
      payload: {
        forecastHorizon: '13 weeks',
        currentBankBalance: 1840000,
        predictedShortageDate: isoDaysAhead(12),
        runwayDays: 11.5,
        weeklyBurn: 162000,
        expectedInflows: 980000,
        expectedOutflows: 2840000,
        netDeficit: -1860000,
      },
      severity: 'critical',
      status: 'open',
      createdAt: isoHoursAgo(1),
    },
    // ── 15. CASH FLOW — February forecast ──────────────────────────────────
    {
      id: 'evt_cash_forecast_015',
      businessId: 'biz_sharma_enterprises',
      type: 'cash_flow',
      source: 'system',
      payload: {
        month: 'February 2026',
        projectedClosing: 480000,
        inflows: 4200000,
        outflows: 3720000,
        recommendation: 'Bridge ₹14L working-capital gap via invoice discounting',
      },
      severity: 'medium',
      status: 'acknowledged',
      createdAt: isoHoursAgo(22),
    },
    // ── 16. COLLECTION RISK — Reddy Suppliers ₹2.8L, 41% default prob ──────
    {
      id: 'evt_collection_risk_016',
      businessId: 'biz_sharma_enterprises',
      type: 'collection_risk',
      source: 'invoice',
      payload: {
        client: 'Reddy Suppliers',
        clientId: 'cli_reddy_001',
        invoiceNo: 'INV-2025-0098',
        amount: 280000,
        overdueDays: 68,
        defaultProbability: 0.41,
        riskSegment: 'red',
        recoveryStage: 'escalation',
        suggestedAction: 'Issue legal notice under IBC Section 9 (MSME recovery)',
      },
      severity: 'critical',
      status: 'escalated',
      createdAt: isoHoursAgo(40),
    },
  ];
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
