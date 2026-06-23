// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Execution Engine™ — MODULE 3: Autonomous Execution Engine™
// Phase 8 Step 5 — Observe. Think. Decide. Execute. Confirm. Learn.
// ═══════════════════════════════════════════════════════════════════════════════
// Receives ActionPlans from decide.ts and runs them through specialised agents:
//
//   gst_agent         → GST portal ops (prepare returns, generate JSON, fetch 2B)
//   cfo_agent         → Banking reconciliation + cash-flow reports
//   collection_agent  → Invoices + WhatsApp / SMS / Email reminders to clients
//   compliance_agent  → Payroll + TDS + statutory deposits
//
// Key exports:
//   • EXECUTION_RESULTS   — factory map of result-payload generators per task type
//   • executeTask(task)   — simulates execution + returns realistic result payload
//   • seedExecutionTasks  — 14 demo tasks spanning all 11 task types & 5 statuses
//   • getExecutionSummary — totals, by-agent / by-type breakdowns, success rate
//
// Pure TypeScript — no Prisma, no React, no 'use client'.
// Importable from both Next.js API routes (server) and React components (client).
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  AgentName,
  Decision,
  ExecutionStatus,
  ExecutionSummary,
  ExecutionTask,
  ExecutionTaskType,
} from './types';

// ─── Indian Rupee grouping (₹1,23,456 — not Western 1,23,456) ─────────────────
// Local helper (no cross-module import) to keep this file dependency-light.
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

// ─── EXECUTION_RESULTS — realistic result payloads per task type ──────────────
// Each factory returns a fresh object simulating the outcome of running that task
// type against live Indian SME data. Numbers reflect real-world magnitudes
// (GSTR-2B line counts, payroll deductions, TDS sections, etc.).
export const EXECUTION_RESULTS: Record<ExecutionTaskType, () => Record<string, unknown>> = {
  gst_prepare: () => ({
    returnType: 'GSTR-3B',
    period: 'December 2025',
    outputTax: 420000,
    itcClaimed: 184000,
    netLiability: 210000,
    cashLedgerBalance: 95000,
    shortFall: 115000,
    lateFeeExposure: 50, // ₹/day after due date
    interestExposure: 18, // % p.a. on delayed tax
    status: 'draft_ready',
    preparedFor: 'Sharma Enterprises LLP',
  }),

  gst_json: () => ({
    returnType: 'GSTR-3B',
    period: 'December 2025',
    jsonSizeBytes: 184_213,
    sectionsPopulated: ['3.1', '3.2', '4', '5'],
    validated: true,
    checksum: 'sha256:a1b2c3d4e5f6',
    filingPortal: 'GST Portal (api.gst.gov.in)',
  }),

  download_2b: () => ({
    period: 'December 2025',
    linesDownloaded: 2847,
    vendorsMatched: 24,
    itcMatchedPercent: 92.4,
    mismatches: 38,
    itcValue: 210000,
    itcAtRisk: 16000, // ITC value tied up in mismatched lines
    portal: 'GST Portal',
  }),

  bank_reconcile: () => ({
    bankAccount: 'HDFC Current — xxxx4821',
    period: 'January 2026 (MTD)',
    transactionsReconciled: 1240,
    shortages: 1,
    amountReconciled: 1840000,
    unmatchedEntries: 12,
    bankBalance: 1840000,
    shortageAmount: 24000,
  }),

  send_invoice: () => ({
    invoiceNumber: 'INV-2026-0042',
    client: 'Sharma Enterprises LLP',
    amount: 320000,
    channels: ['WhatsApp', 'Email'],
    dispatchedAt: new Date().toISOString(),
    agingClockStarted: true,
    paymentTermsDays: 30,
  }),

  send_report: () => ({
    reportType: '13-Week Rolling Cash Forecast',
    period: 'Wk-04 to Wk-17 FY26',
    recipients: 4,
    delivered: 4,
    opened: 3,
    format: 'PDF',
    pages: 18,
    fileSizeKb: 842,
  }),

  send_whatsapp: () => ({
    template: 'payment_reminder_v3',
    recipients: 12,
    delivered: 11,
    read: 4,
    failed: 1,
    dltTemplateId: 'DLT-1007-4521',
    dispatchedAt: new Date().toISOString(),
  }),

  send_email: () => ({
    subject: 'GSTR-3B Filing — Approval Required (Net Liability ₹2,10,000)',
    recipients: 8,
    delivered: 8,
    opened: 5,
    clicked: 2,
    bounced: 0,
    dispatchedAt: new Date().toISOString(),
  }),

  send_sms: () => ({
    template: 'gst_due_alert',
    recipients: 24,
    delivered: 23,
    failed: 1,
    dltTemplateId: 'DLT-1007-9931',
    messageExcerpt: 'GSTR-3B due tomorrow. Net liability ₹2,10,000. Reply YES to authorise filing.',
  }),

  run_payroll: () => ({
    period: 'January 2026',
    employeeCount: 18,
    grossPay: 842000,
    netPay: 727800,
    pfDeduction: 71200,
    esiDeduction: 0,
    tdsDeduction: 40600,
    ptDeduction: 2400,
    bankFile: 'neft_jan2026.csv',
    payDate: '2026-01-31',
  }),

  calc_tds: () => ({
    quarter: 'Q3 FY 2025-26',
    totalTDS: 340000,
    sections: {
      '194C': 210000, // Contractor
      '194J': 95000,  // Professional fees
      '194I': 35000,  // Rent
    },
    challan: 'ITNS-281',
    challanNumber: 'CHN-2026-0117',
    dueDate: '2026-01-31',
    returnForm: '26Q',
  }),
};

// ─── executeTask — simulate running one task and return its outcome ───────────
// In production this would dispatch to the appropriate agent runner; for the
// Phase 8 Step 5 build it returns a deterministic, realistic result payload
// looked up from EXECUTION_RESULTS plus an ISO completion timestamp.
export function executeTask(task: ExecutionTask): {
  status: ExecutionStatus;
  result: Record<string, unknown>;
  completedAt: string;
} {
  const factory = EXECUTION_RESULTS[task.type];
  const result = factory ? factory() : { executed: true, taskType: task.type };
  return {
    status: 'completed',
    result,
    completedAt: new Date().toISOString(),
  };
}

// ─── Task Recipe — declarative spec for each seed task ────────────────────────
// Links to a decision positionally (decisionIdx) when available; otherwise the
// task runs ad-hoc with decisionId = null. Risk scores mirror ACTION_BLUEPRINT
// in decide.ts so the approval gating stays consistent.
interface TaskRecipe {
  decisionIdx: number | null;
  type: ExecutionTaskType;
  description: string;
  status: ExecutionStatus;
  agent: AgentName;
  riskScore: number;
  hoursAgo: number;
  // Override the EXECUTION_RESULTS payload for tasks whose outcome differs from
  // the default factory (e.g. a failed task shouldn't report success numbers).
  resultOverride?: Record<string, unknown>;
}

const SEED_TASK_RECIPE: TaskRecipe[] = [
  // 1. GSTR-2B auto-download — completed early in the morning
  {
    decisionIdx: 1,
    type: 'download_2b',
    description: 'Downloaded GSTR-2B for December 2025 (2,847 lines across 24 vendors)',
    status: 'completed',
    agent: 'gst_agent',
    riskScore: 12,
    hoursAgo: 7.5,
  },
  // 2. GSTR-3B preparation for Sharma Enterprises LLP — awaiting approval (statutory filing)
  {
    decisionIdx: 0,
    type: 'gst_prepare',
    description: 'Prepared GSTR-3B for Sharma Enterprises LLP — net liability ₹2,10,000',
    status: 'awaiting_approval',
    agent: 'gst_agent',
    riskScore: 35,
    hoursAgo: 6.5,
  },
  // 3. Bank reconciliation — completed (auto-executed)
  {
    decisionIdx: 2,
    type: 'bank_reconcile',
    description: 'Reconciled 1,240 bank transactions against invoices & payables',
    status: 'completed',
    agent: 'cfo_agent',
    riskScore: 22,
    hoursAgo: 6,
  },
  // 4. WhatsApp reminders batch — completed (collection recovery)
  {
    decisionIdx: 3,
    type: 'send_whatsapp',
    description: 'Sent WhatsApp reminders to 12 overdue clients',
    status: 'completed',
    agent: 'collection_agent',
    riskScore: 18,
    hoursAgo: 5.5,
  },
  // 5. Payroll for January 2026 — awaiting approval (salary payout requires sign-off)
  {
    decisionIdx: 7,
    type: 'run_payroll',
    description: 'Generated payroll for 18 employees (₹7,27,800 net) — awaiting sign-off',
    status: 'awaiting_approval',
    agent: 'compliance_agent',
    riskScore: 48,
    hoursAgo: 5,
  },
  // 6. Invoice dispatch — completed (customer-facing)
  {
    decisionIdx: 9,
    type: 'send_invoice',
    description: 'Sent invoice INV-2026-0042 (₹3,20,000) to Sharma Enterprises LLP',
    status: 'completed',
    agent: 'collection_agent',
    riskScore: 14,
    hoursAgo: 4.5,
  },
  // 7. Cash forecast report — completed
  {
    decisionIdx: 4,
    type: 'send_report',
    description: 'Generated 13-week rolling cash forecast (₹18,60,000 deficit flagged)',
    status: 'completed',
    agent: 'cfo_agent',
    riskScore: 15,
    hoursAgo: 4,
  },
  // 8. GSTR-3B JSON generation — currently running
  {
    decisionIdx: 0,
    type: 'gst_json',
    description: 'Generating GSTR-3B JSON payload for Sharma Enterprises LLP',
    status: 'running',
    agent: 'gst_agent',
    riskScore: 30,
    hoursAgo: 0.25,
  },
  // 9. TDS calculation for Q3 — awaiting approval (statutory deposit)
  {
    decisionIdx: 8,
    type: 'calc_tds',
    description: 'Calculated Q3 TDS ₹3,40,000 (194C/194J/194I) — awaiting sign-off',
    status: 'awaiting_approval',
    agent: 'compliance_agent',
    riskScore: 40,
    hoursAgo: 3.5,
  },
  // 10. Approval request email to CA — queued
  {
    decisionIdx: 0,
    type: 'send_email',
    description: 'Send GSTR-3B approval request email to CA Anil Mehta',
    status: 'queued',
    agent: 'gst_agent',
    riskScore: 8,
    hoursAgo: 0.5,
  },
  // 11. GST due SMS alerts to clients — queued
  {
    decisionIdx: null,
    type: 'send_sms',
    description: 'Send GST due-date SMS alerts to 24 client contacts',
    status: 'queued',
    agent: 'collection_agent',
    riskScore: 10,
    hoursAgo: 0.4,
  },
  // 12. GSTR-3B prep for Verma Industries LLP — queued (second client)
  {
    decisionIdx: null,
    type: 'gst_prepare',
    description: 'Prepare GSTR-3B for Verma Industries LLP (output tax ₹1,84,000)',
    status: 'queued',
    agent: 'gst_agent',
    riskScore: 35,
    hoursAgo: 0.3,
  },
  // 13. HDFC bank statement reconciliation — running (second pass)
  {
    decisionIdx: null,
    type: 'bank_reconcile',
    description: 'Reconciling HDFC statement (840 transactions pending)',
    status: 'running',
    agent: 'cfo_agent',
    riskScore: 22,
    hoursAgo: 0.15,
  },
  // 14. WhatsApp reminder to Reddy Suppliers — failed (number invalid)
  {
    decisionIdx: 10,
    type: 'send_whatsapp',
    description: 'Send WhatsApp reminder to Reddy Suppliers — failed (number invalid)',
    status: 'failed',
    agent: 'collection_agent',
    riskScore: 18,
    hoursAgo: 2,
    resultOverride: {
      template: 'payment_reminder_v3',
      recipients: 1,
      delivered: 0,
      read: 0,
      failed: 1,
      failureReason: 'Invalid WhatsApp number — Reddy Suppliers contact outdated',
      dltTemplateId: 'DLT-1007-4521',
    },
  },
  // 15. Legal escalation email (IBC Section 9 notice) — awaiting approval
  {
    decisionIdx: 10,
    type: 'send_email',
    description: 'Draft IBC Section 9 notice email for Reddy Suppliers ₹2,80,000 — awaiting partner sign-off',
    status: 'awaiting_approval',
    agent: 'compliance_agent',
    riskScore: 78,
    hoursAgo: 1,
  },
];

// ─── seedExecutionTasks — materialise 15 demo ExecutionTasks ──────────────────
// Accepts the Decision[] stream from decide.ts and links tasks to decisions
// positionally (via SEED_TASK_RECIPE.decisionIdx). Tasks may also run ad-hoc
// with decisionId = null.
//
// NOTE: tasks are returned in RECIPE ORDER (not sorted) so downstream consumers
// like seedApprovals(tasks) and seedTimeline(tasks) can index into the array
// deterministically. The "most recent first" view is computed by
// getExecutionSummary().recentTasks, which sorts internally — matching the
// pattern used by think.ts's seedDecisions / getDecisionSummary.
export function seedExecutionTasks(decisions: Decision[]): ExecutionTask[] {
  const now = Date.now();
  return SEED_TASK_RECIPE.map((r, idx) => {
    const createdAt = new Date(now - r.hoursAgo * 3600 * 1000).toISOString();
    const decisionId =
      r.decisionIdx != null && decisions[r.decisionIdx]
        ? decisions[r.decisionIdx].id
        : null;

    // Timestamps depend on lifecycle state.
    let startedAt: string | null = null;
    let completedAt: string | null = null;
    if (r.status === 'completed' || r.status === 'failed') {
      startedAt = new Date(now - (r.hoursAgo + 0.05) * 3600 * 1000).toISOString();
      completedAt = new Date(now - (r.hoursAgo - 0.05) * 3600 * 1000).toISOString();
    } else if (r.status === 'running') {
      startedAt = new Date(now - r.hoursAgo * 3600 * 1000).toISOString();
    }
    // 'queued' and 'awaiting_approval' keep startedAt = null.

    // Resolve result payload — failed tasks use override, completed tasks use
    // the factory default, in-flight tasks have no result yet.
    let result: Record<string, unknown> | null = null;
    if (r.status === 'completed') {
      const factory = EXECUTION_RESULTS[r.type];
      result = r.resultOverride ?? (factory ? factory() : { executed: true });
    } else if (r.status === 'failed') {
      result = r.resultOverride ?? { failed: true, reason: 'Execution failed' };
    }

    return {
      id: `task_${String(idx + 1).padStart(3, '0')}`,
      decisionId,
      type: r.type,
      description: r.description,
      status: r.status,
      startedAt,
      completedAt,
      result,
      riskScore: r.riskScore,
      agent: r.agent,
      createdAt,
      updatedAt: completedAt ?? createdAt,
    } satisfies ExecutionTask;
  });
}

// ─── getExecutionSummary — derive rollup metrics from a task stream ───────────
// Returns counts by status, by agent, by type, plus success rate
// (completed / (completed + failed) * 100) and the 10 most recent tasks.
export function getExecutionSummary(tasks: ExecutionTask[]): ExecutionSummary {
  const byAgent: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let queued = 0;
  let running = 0;
  let completed = 0;
  let failed = 0;
  let awaitingApproval = 0;

  for (const t of tasks) {
    byAgent[t.agent ?? 'unassigned'] = (byAgent[t.agent ?? 'unassigned'] ?? 0) + 1;
    byType[t.type] = (byType[t.type] ?? 0) + 1;
    switch (t.status) {
      case 'queued':
        queued += 1;
        break;
      case 'running':
        running += 1;
        break;
      case 'completed':
        completed += 1;
        break;
      case 'failed':
        failed += 1;
        break;
      case 'awaiting_approval':
        awaitingApproval += 1;
        break;
      case 'cancelled':
        // Not counted in primary buckets — intentionally omitted.
        break;
    }
  }

  const successRate =
    completed + failed > 0
      ? Math.round((completed / (completed + failed)) * 1000) / 10
      : 0;

  const recentTasks = [...tasks]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return {
    total: tasks.length,
    queued,
    running,
    completed,
    failed,
    awaitingApproval,
    byAgent,
    byType,
    successRate,
    recentTasks,
  };
}

// ─── Re-export inr() helper for downstream consumers (descriptions, etc.) ─────
export { inr as formatExecutionInr };
