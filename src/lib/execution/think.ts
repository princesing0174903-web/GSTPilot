// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Execution Engine™ — MODULE 2: Decision Engine™
// Phase 8 Step 5 — Observe. Think. Decide. Execute. Confirm. Learn.
// ═══════════════════════════════════════════════════════════════════════════════
// Pipeline:  Event → Rules → AI Reasoning → Priority → Action Plan
//
// applyRules() is the heart of the engine: given an event, decide what action
// to take, at what priority, and write a one-paragraph AI reason that explains
// the decision in business terms (₹ amounts, due dates, statutory exposure).
//
// Pure TypeScript — no Prisma, no React, no 'use client'.
// Importable from both Next.js API routes (server) and React components (client).
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  BusinessEvent,
  BusinessEventType,
  Decision,
  DecisionAction,
  DecisionPriority,
  DecisionSummary,
  EventSeverity,
} from './types';

// ─── Local Indian-rupee formatter (avoid cross-module imports) ────────────────
function inr(n: number): string {
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

// ─── Default rule table — event type → priority + action + default reason ─────
export interface DecisionRule {
  priority: DecisionPriority;
  action: DecisionAction;
  reason: string;
}

export const DECISION_RULES: Record<BusinessEventType, DecisionRule> = {
  gst_due: {
    priority: 'urgent',
    action: 'prepare_return',
    reason:
      'GST return window open — late fee ₹50/day + 18% p.a. interest on delayed tax applies. ' +
      'Prioritising return preparation to avoid penalty exposure and protect compliance score.',
  },
  bank_transaction: {
    priority: 'low',
    action: 'reconcile',
    reason:
      'Bank movement detected — auto-reconciling against open invoices / payables to keep books current.',
  },
  receivable: {
    priority: 'high',
    action: 'send_reminder',
    reason:
      'Receivable overdue — initiating structured collection recovery with WhatsApp + email reminders; escalate if >60 days.',
  },
  payable: {
    priority: 'high',
    action: 'delay_payment',
    reason:
      'Payable approaching due — scheduling payment via Payment Engine; capturing early-pay discount if offered while preserving runway.',
  },
  payroll: {
    priority: 'high',
    action: 'run_payroll',
    reason:
      'Payroll cycle pending — computing PF / ESI / TDS deductions and releasing net-pay bank file before statutory pay-date.',
  },
  tds: {
    priority: 'high',
    action: 'calc_tds',
    reason:
      'TDS compliance gap — depositing pending challan via ITNS-281 + preparing 26Q return before statutory due date.',
  },
  client_behaviour: {
    priority: 'medium',
    action: 'forecast',
    reason:
      'Payment-pattern shift detected — updating risk segment and adjusting 13-week cash forecast to reflect revised DSO.',
  },
  cash_flow: {
    priority: 'urgent',
    action: 'forecast',
    reason:
      'Cash shortage predicted — activating working-capital bridge (invoice discounting) and deferring non-essential capex.',
  },
  collection_risk: {
    priority: 'urgent',
    action: 'escalate',
    reason:
      'Default-probability breach — escalating to legal recovery; considering IBC Section 9 notice for MSME clients.',
  },
};

// Severity → priority modulation (critical always forces urgent).
const SEVERITY_PRIORITY: Record<EventSeverity, DecisionPriority> = {
  info:     'low',
  low:      'medium',
  medium:   'high',
  high:     'high',
  critical: 'urgent',
};

// ─── Rule Engine: Event → { reason, priority, action } ────────────────────────
// Covers all 9 event types. The reason is enriched with payload context
// (₹ amounts, due dates, statutory exposure) to read like an AI reasoning trace.
export function applyRules(event: BusinessEvent): {
  reason: string;
  priority: DecisionPriority;
  action: DecisionAction;
} {
  const rule = DECISION_RULES[event.type];
  // Critical severity always escalates to urgent; otherwise use severity-modulated priority.
  const priority: DecisionPriority =
    event.severity === 'critical' ? 'urgent' : SEVERITY_PRIORITY[event.severity];

  const p = (event.payload ?? {}) as Record<string, unknown>;
  const num = (k: string): number | null =>
    typeof p[k] === 'number' ? (p[k] as number) : null;
  const str = (k: string): string | null =>
    typeof p[k] === 'string' ? (p[k] as string) : null;

  let reason = rule.reason;

  switch (event.type) {
    case 'gst_due': {
      const form = str('form') ?? 'GST return';
      const net = num('netPayable') ?? num('outputTaxLiability');
      const dueHours = num('dueInHours');
      reason =
        `${form} due ${dueHours != null ? `in ${dueHours}h` : 'soon'}` +
        (net != null ? ` — net liability ${inr(net)}` : '') +
        `. Late fee ₹50/day + 18% p.a. interest on delayed tax applies. ` +
        `Prioritising return preparation to avoid penalty exposure and protect compliance score.`;
      break;
    }
    case 'bank_transaction': {
      const amt = num('amount');
      const dir = str('direction') ?? 'movement';
      const cp = str('counterparty') ?? 'counterparty';
      reason =
        `Bank ${dir} ${amt != null ? inr(amt) : ''} via ${str('mode') ?? 'bank'} from ${cp} detected. ` +
        `Auto-reconciling against open invoices / payables to keep books current.`;
      break;
    }
    case 'receivable': {
      const amt = num('amount') ?? num('totalOutstanding');
      const client = str('client') ?? 'client';
      const days = num('overdueDays');
      reason =
        `Receivable ${amt != null ? inr(amt) : ''} from ${client} ` +
        (days != null ? `${days} days overdue` : 'overdue') +
        `. Initiating structured collection recovery — WhatsApp + email reminders; escalate if >60 days.`;
      break;
    }
    case 'payable': {
      const amt = num('amount');
      const vendor = str('vendor') ?? 'vendor';
      const due = num('dueInDays');
      const discount = str('earlyPayDiscount');
      reason =
        `Payable ${amt != null ? inr(amt) : ''} to ${vendor} due in ${due ?? '?'} days` +
        (discount ? ` — ${discount}` : '') +
        `. Scheduling payment via Payment Engine; capturing early-pay discount if offered while preserving runway.`;
      break;
    }
    case 'payroll': {
      const cycle = str('cycle');
      const net = num('netPayable');
      const emp = num('employeeCount');
      const pf = num('pfDeduction') ?? 0;
      const tds = num('tdsDeduction') ?? 0;
      reason =
        `Payroll for ${cycle ?? 'cycle'} — ${emp ?? '?'} employees, net payable ${net != null ? inr(net) : ''} ` +
        `(PF ${inr(pf)} + TDS ${inr(tds)}). Computing deductions and releasing bank file before pay-date.`;
      break;
    }
    case 'tds': {
      const q = str('quarter') ?? str('section');
      const amt = num('totalTDS') ?? num('amount');
      const due = str('dueDate');
      reason =
        `TDS ${q != null ? `for ${q}` : 'review needed'} — ${amt != null ? inr(amt) : ''} pending` +
        (due ? `; due ${due}` : '') +
        `. Depositing challan via ITNS-281 + preparing 26Q return before statutory due date.`;
      break;
    }
    case 'client_behaviour': {
      const client = str('client') ?? 'Client';
      const avg = num('observedAvgPaymentDays');
      const terms = num('contractualTerms');
      const seg = str('riskSegment') ?? 'unclassified';
      reason =
        `${client} pays in ${avg ?? '?'} days vs ${terms ?? '?'}-day terms (segment: ${seg}). ` +
        `Updating risk segment + adjusting 13-week cash forecast to reflect revised DSO.`;
      break;
    }
    case 'cash_flow': {
      const runway = num('runwayDays');
      const deficit = num('netDeficit');
      const balance = num('currentBankBalance');
      reason =
        `Cash shortage predicted${runway != null ? ` in ${runway} days` : ''}` +
        (balance != null ? ` (bank balance ${inr(balance)})` : '') +
        (deficit != null ? ` — projected deficit ${inr(Math.abs(deficit))}` : '') +
        `. Activating invoice-discounting bridge + deferring non-essential capex.`;
      break;
    }
    case 'collection_risk': {
      const client = str('client') ?? 'Client';
      const amt = num('amount');
      const prob = num('defaultProbability');
      const stage = str('recoveryStage') ?? 'pending';
      reason =
        `${client} ${amt != null ? inr(amt) : ''} overdue ${num('overdueDays') ?? '?'} days, ` +
        `default probability ${prob != null ? `${Math.round(prob * 100)}%` : 'high'} (stage: ${stage}). ` +
        `Escalating to legal recovery; drafting IBC Section 9 notice for MSME clients.`;
      break;
    }
  }

  return { reason, priority, action: rule.action };
}

// ─── seedDecisions (no-op) ────────────────────────────────────────────────────
// Previously this function synthesised demo Decisions from a hardcoded
// recipe constant referencing fabricated clients, bank accounts, invoice
// numbers, and amounts. The export name is preserved so existing callers
// continue to compile, but it now returns `[]` so the UI renders a proper
// empty state. Real decisions come from `db.decision.findMany()` via the
// API routes.
export function seedDecisions(_events: BusinessEvent[]): Decision[] {
  return [];
}

// ─── Decision Summary — derived from decision stream ──────────────────────────
export function getDecisionSummary(decisions: Decision[]): DecisionSummary {
  const byPriority: Record<DecisionPriority, number> = {
    low: 0,
    medium: 0,
    high: 0,
    urgent: 0,
  };
  const byAction: Record<string, number> = {};

  let pending = 0;
  let approved = 0;
  let executed = 0;

  for (const d of decisions) {
    byPriority[d.priority] = (byPriority[d.priority] ?? 0) + 1;
    byAction[d.action] = (byAction[d.action] ?? 0) + 1;
    if (d.status === 'pending') pending += 1;
    else if (d.status === 'approved') approved += 1;
    else if (d.status === 'executed') executed += 1;
  }

  const recentDecisions = [...decisions]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return {
    total: decisions.length,
    pending,
    approved,
    executed,
    byPriority,
    byAction,
    recentDecisions,
  };
}
