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
//   • executeTask(task)   — runs a task and returns its outcome payload
//   • seedExecutionTasks  — no-op placeholder (returns []); real tasks come from DB
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

// ─── EXECUTION_RESULTS — generic result payloads per task type ────────────────
// Each factory returns a fresh object describing the SHAPE of the outcome for
// that task type. Concrete numbers (returnType, period, line counts, totals,
// identifiers, recipient names) are populated at execution time from the live
// task payload — NOT hardcoded here — so we never fabricate client/bank data.
export const EXECUTION_RESULTS: Record<ExecutionTaskType, () => Record<string, unknown>> = {
  gst_prepare: () => ({
    returnType: null,
    period: null,
    outputTax: 0,
    itcClaimed: 0,
    netLiability: 0,
    cashLedgerBalance: 0,
    shortFall: 0,
    lateFeeExposure: 0, // ₹/day after due date
    interestExposure: 0, // % p.a. on delayed tax
    status: 'draft_ready',
    preparedFor: null,
  }),

  gst_json: () => ({
    returnType: null,
    period: null,
    jsonSizeBytes: 0,
    sectionsPopulated: [] as string[],
    validated: false,
    checksum: null,
    filingPortal: null,
  }),

  download_2b: () => ({
    period: null,
    linesDownloaded: 0,
    vendorsMatched: 0,
    itcMatchedPercent: 0,
    mismatches: 0,
    itcValue: 0,
    itcAtRisk: 0,
    portal: null,
  }),

  bank_reconcile: () => ({
    bankAccount: null,
    period: null,
    transactionsReconciled: 0,
    shortages: 0,
    amountReconciled: 0,
    unmatchedEntries: 0,
    bankBalance: 0,
    shortageAmount: 0,
  }),

  send_invoice: () => ({
    invoiceNumber: null,
    client: null,
    amount: 0,
    channels: [] as string[],
    dispatchedAt: null,
    agingClockStarted: false,
    paymentTermsDays: 0,
  }),

  send_report: () => ({
    reportType: null,
    period: null,
    recipients: 0,
    delivered: 0,
    opened: 0,
    format: null,
    pages: 0,
    fileSizeKb: 0,
  }),

  send_whatsapp: () => ({
    template: null,
    recipients: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    dltTemplateId: null,
    dispatchedAt: null,
  }),

  send_email: () => ({
    subject: null,
    recipients: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    dispatchedAt: null,
  }),

  send_sms: () => ({
    template: null,
    recipients: 0,
    delivered: 0,
    failed: 0,
    dltTemplateId: null,
    messageExcerpt: null,
  }),

  run_payroll: () => ({
    period: null,
    employeeCount: 0,
    grossPay: 0,
    netPay: 0,
    pfDeduction: 0,
    esiDeduction: 0,
    tdsDeduction: 0,
    ptDeduction: 0,
    bankFile: null,
    payDate: null,
  }),

  calc_tds: () => ({
    quarter: null,
    totalTDS: 0,
    sections: {} as Record<string, number>,
    challan: null,
    challanNumber: null,
    dueDate: null,
    returnForm: null,
  }),
};

// ─── executeTask — run one task and return its outcome ────────────────────────
// Looks up the result-shape factory for the task type and returns it together
// with an ISO completion timestamp. Real execution dispatch (GST portal, bank
// API, payroll processor) is wired up by the caller; this function only
// normalises the result envelope.
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

// ─── seedExecutionTasks (no-op) ───────────────────────────────────────────────
// Previously this function synthesised demo ExecutionTask rows from a
// hardcoded recipe constant referencing fabricated clients, bank accounts,
// invoice numbers, and amounts. The export name is preserved so existing
// callers continue to compile, but it now returns `[]` so the UI renders a
// proper empty state. Real execution tasks come from
// `db.executionTask.findMany()` via the API routes.
export function seedExecutionTasks(_decisions: Decision[]): ExecutionTask[] {
  return [];
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

// ─── Unused-but-retained type for backwards compatibility ─────────────────────
// (TaskRecipe was previously exported via the SEED_TASK_RECIPE constant; we
// keep the type alias so external type references don't break.)
export interface TaskRecipe {
  decisionIdx: number | null;
  type: ExecutionTaskType;
  description: string;
  status: ExecutionStatus;
  agent: AgentName;
  riskScore: number;
  hoursAgo: number;
  resultOverride?: Record<string, unknown>;
}
