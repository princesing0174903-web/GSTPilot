// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Execution Engine™ — MODULE 4: Approval Engine™
// Phase 8 Step 5 — Observe. Think. Decide. Execute. Confirm. Learn.
// ═══════════════════════════════════════════════════════════════════════════════
// Workflow:  Task → Risk Score → Need Approval? → Yes (ask user) / No (execute)
//
// Sits between execute.ts (task materialiser) and the human-in-the-loop UI:
//   • Any task with riskScore >= RISK_THRESHOLD (60) requires sign-off
//   • Plus per-type overrides from ACTION_BLUEPRINT (decide.ts) — statutory
//     filings, payroll, TDS, large payments, legal escalations always need
//     approval regardless of numeric score
//
// Exports:
//   • RISK_THRESHOLD      — re-exported from decide.ts (60)
//   • needsApproval(task) — numeric threshold check
//   • assessRisk(task)    — type-aware risk reason + decision
//   • createApproval(task)— factory for a new pending Approval
//   • seedApprovals       — 7 demo approvals (pending/approved/rejected/auto)
//   • getApprovalSummary  — totals + pending list + risk threshold
//
// Pure TypeScript — no Prisma, no React, no 'use client'.
// Importable from both Next.js API routes (server) and React components (client).
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  Approval,
  ApprovalSummary,
  ExecutionTask,
  ExecutionTaskType,
} from './types';
import { RISK_THRESHOLD } from './decide';

// Re-export so consumers can import the threshold from either decide.ts or here.
export { RISK_THRESHOLD };

// ─── Indian Rupee grouping (local helper — avoids cross-module imports) ───────
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

// ─── Per-task-type statutory approval overrides ──────────────────────────────
// These task types ALWAYS require approval regardless of numeric risk score
// (mirror of ACTION_BLUEPRINT.needsApproval in decide.ts).
const STATUTORY_APPROVAL_TYPES: ReadonlySet<ExecutionTaskType> = new Set([
  'gst_prepare', // filing requires sign-off
  'gst_json',    // JSON is the filing payload
  'run_payroll', // salary disbursement
  'calc_tds',    // statutory TDS deposit
]);

// ─── needsApproval — numeric threshold gate ──────────────────────────────────
// Returns true when a task's risk score crosses the RISK_THRESHOLD (60).
// Note: this does NOT account for statutory overrides — those are flagged by
// ACTION_BLUEPRINT.needsApproval upstream in decide.ts. For the full picture
// (threshold OR statutory), use assessRisk().
export function needsApproval(task: ExecutionTask): boolean {
  return task.riskScore >= RISK_THRESHOLD;
}

// ─── pickAmount — extract the most relevant ₹ amount from a task result ──────
// Used by assessRisk() to enrich the reason with ₹ context. Falls back to null
// when no amount-like field is present (e.g. a queued task with result = null).
function pickAmount(result: Record<string, unknown> | null): number | null {
  if (!result) return null;
  const candidates = [
    'netLiability',
    'netPay',
    'totalTDS',
    'amount',
    'amountReconciled',
    'grossPay',
    'outputTax',
    'itcValue',
  ];
  for (const k of candidates) {
    if (typeof result[k] === 'number') return result[k] as number;
  }
  return null;
}

// ─── deriveRiskReason — type-aware human-readable risk explanation ───────────
function deriveRiskReason(task: ExecutionTask): string {
  const amt = pickAmount(task.result);
  const isLargePayment = amt != null && amt >= 100_000;

  switch (task.type) {
    case 'gst_prepare':
      return `Tax filing with net liability${amt != null ? ` ${inr(amt)}` : ''} — statutory sign-off required`;
    case 'gst_json':
      return `Return JSON payload generation — filing artefact, sign-off required`;
    case 'run_payroll':
      return `Payroll disbursement${amt != null ? ` of ${inr(amt)}` : ''} — salary payout requires sign-off`;
    case 'calc_tds':
      return `Statutory TDS deposit${amt != null ? ` of ${inr(amt)}` : ''} — challan sign-off required`;
    case 'bank_reconcile':
      return 'Bank reconciliation — internal bookkeeping task (no sign-off)';
    case 'send_invoice':
      return `Customer invoice dispatch${amt != null ? ` ${inr(amt)}` : ''} — low-risk customer outreach`;
    case 'send_whatsapp':
    case 'send_email':
    case 'send_sms':
      return isLargePayment
        ? `Payment exceeds ₹1L threshold${amt != null ? ` (${inr(amt)})` : ''} — requires sign-off`
        : 'Customer communication — low-risk outreach (no sign-off)';
    case 'send_report':
      return 'Stakeholder report dispatch — informational (no sign-off)';
    case 'download_2b':
      return 'GST portal read-only data fetch — no financial impact';
    default:
      return 'General execution task';
  }
}

// ─── assessRisk — full risk assessment with reason + approval flag ───────────
// Approval is required when EITHER the numeric threshold is breached OR the
// task type is in the statutory-override set (filings, payroll, TDS).
export function assessRisk(task: ExecutionTask): {
  risk: number;
  reason: string;
  needsApproval: boolean;
} {
  const thresholdBreached = task.riskScore >= RISK_THRESHOLD;
  const statutoryOverride = STATUTORY_APPROVAL_TYPES.has(task.type);
  return {
    risk: task.riskScore,
    reason: deriveRiskReason(task),
    needsApproval: thresholdBreached || statutoryOverride,
  };
}

// ─── createApproval — factory for a new pending Approval from a task ─────────
export function createApproval(task: ExecutionTask): Approval {
  const now = new Date().toISOString();
  const { reason, needsApproval: approvalNeeded } = assessRisk(task);
  const fullReason = approvalNeeded
    ? `${task.description} — ${reason}`
    : `Auto-approved: ${reason}`;
  return {
    id: `appr_${task.id}_${Date.now()}`,
    taskId: task.id,
    risk: task.riskScore,
    status: approvalNeeded ? 'pending' : 'auto_approved',
    reason: fullReason,
    approvedBy: null,
    approvedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── seedApprovals (no-op) ────────────────────────────────────────────────────
// Previously this function synthesised demo Approvals from a hardcoded
// recipe constant referencing fabricated clients, bank accounts, and
// amounts. The export name is preserved so existing callers continue to
// compile, but it now returns `[]` so the UI renders a proper empty state.
// Real approvals come from `db.approval.findMany()` via the API routes.
export function seedApprovals(_tasks: ExecutionTask[]): Approval[] {
  return [];
}

// ─── getApprovalSummary — derive rollup metrics from an approval stream ──────
// Returns counts by status, the list of pending approvals (oldest first so
// the most urgent surfaces at the top), and the configured risk threshold.
export function getApprovalSummary(approvals: Approval[]): ApprovalSummary {
  let pending = 0;
  let approved = 0;
  let rejected = 0;
  let autoApproved = 0;

  for (const a of approvals) {
    switch (a.status) {
      case 'pending':
        pending += 1;
        break;
      case 'approved':
        approved += 1;
        break;
      case 'rejected':
        rejected += 1;
        break;
      case 'auto_approved':
        autoApproved += 1;
        break;
      case 'expired':
        // Counted in total but not in primary buckets.
        break;
    }
  }

  const pendingApprovals = approvals
    .filter((a) => a.status === 'pending')
    .sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  return {
    total: approvals.length,
    pending,
    approved,
    rejected,
    autoApproved,
    pendingApprovals,
    riskThreshold: RISK_THRESHOLD,
  };
}
