// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Execution Engine™ — MODULE 4: Approval Engine™
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
  ApprovalStatus,
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

// ─── Approval Recipe — declarative spec for each seed approval ───────────────
interface ApprovalRecipe {
  taskIdx: number;       // 0-based index into the tasks array passed to seedApprovals
  status: ApprovalStatus;
  reason: string;
  approvedBy: string | null;
  hoursAgo: number;
  approvedHoursAgo: number | null; // when status is approved/rejected
}

const SEED_APPROVAL_RECIPE: ApprovalRecipe[] = [
  // 1. GSTR-3B filing for Sharma Enterprises — pending sign-off
  {
    taskIdx: 1,
    status: 'pending',
    reason:
      'GSTR-3B filing requires approval — net liability ₹2,10,000 (output ₹4,20,000 − ITC ₹1,84,000). ' +
      'Cash ledger short by ₹1,15,000 — must be funded before filing.',
    approvedBy: null,
    hoursAgo: 6,
    approvedHoursAgo: null,
  },
  // 2. Payroll payout for January 2026 — pending sign-off
  {
    taskIdx: 4,
    status: 'pending',
    reason:
      'Payroll payout ₹7,27,800 for 18 employees requires sign-off — PF ₹71,200 + TDS ₹40,600 + PT ₹2,400 deducted. ' +
      'Bank file (neft_jan2026.csv) ready for release on pay-date 31/01.',
    approvedBy: null,
    hoursAgo: 4.5,
    approvedHoursAgo: null,
  },
  // 3. Q3 TDS deposit — approved by CA
  {
    taskIdx: 8,
    status: 'approved',
    reason:
      'TDS Q3 deposit ₹3,40,000 approved — 194C ₹2,10,000 + 194J ₹95,000 + 194I ₹35,000. ' +
      'Challan ITNS-281 generated (CHN-2026-0117). 26Q return due 31/01.',
    approvedBy: 'CA Anil Mehta',
    hoursAgo: 3,
    approvedHoursAgo: 2.5,
  },
  // 4. Vendor payment to Reddy Suppliers — rejected (legal hold)
  {
    taskIdx: 13,
    status: 'rejected',
    reason:
      'Vendor payment ₹3,40,000 to Reddy Suppliers requires sign-off — REJECTED. ' +
      'Account is 68 days overdue (default probability 41%); payment held pending IBC Section 9 notice.',
    approvedBy: 'CFO Priya Sharma',
    hoursAgo: 2.5,
    approvedHoursAgo: 2,
  },
  // 5. Low-value GSTR-1 filing — auto-approved (below threshold)
  {
    taskIdx: 11,
    status: 'auto_approved',
    reason:
      'GSTR-1 filing auto-approved — net liability ₹12,000 below ₹50,000 auto-approve threshold. ' +
      'No human sign-off required per firm policy.',
    approvedBy: 'rule:low_value_filing',
    hoursAgo: 0.5,
    approvedHoursAgo: 0.5,
  },
  // 6. HDFC MSME loan EMI — approved by CFO
  {
    taskIdx: 5,
    status: 'approved',
    reason:
      'HDFC MSME Loan EMI ₹1,24,000 (₹98K principal + ₹26K interest) — approved. ' +
      'NEFT scheduled to avoid bounce charges + credit-score impact.',
    approvedBy: 'CFO Priya Sharma',
    hoursAgo: 8,
    approvedHoursAgo: 7.5,
  },
  // 7. Legal escalation to IBC — pending sign-off (highest risk)
  {
    taskIdx: 14,
    status: 'pending',
    reason:
      'Legal escalation to IBC Section 9 (MSME recovery) — Reddy Suppliers ₹2,80,000 overdue 68 days. ' +
      'Draft notice prepared; requires partner sign-off before dispatch to NCLT.',
    approvedBy: null,
    hoursAgo: 1,
    approvedHoursAgo: null,
  },
];

// ─── seedApprovals — materialise 7 demo Approvals against a task stream ──────
// Each recipe references a task positionally; if the task at that index doesn't
// exist (e.g. caller passed fewer tasks), the recipe is skipped gracefully.
export function seedApprovals(tasks: ExecutionTask[]): Approval[] {
  const now = Date.now();
  const approvals: Approval[] = [];

  let counter = 0;
  for (const r of SEED_APPROVAL_RECIPE) {
    const task = tasks[r.taskIdx];
    if (!task) continue; // graceful skip if task index out of range
    counter += 1;
    const createdAt = new Date(now - r.hoursAgo * 3600 * 1000).toISOString();
    const approvedAt =
      r.approvedHoursAgo != null
        ? new Date(now - r.approvedHoursAgo * 3600 * 1000).toISOString()
        : null;
    const updatedAt = approvedAt ?? createdAt;

    approvals.push({
      id: `appr_${String(counter).padStart(3, '0')}`,
      taskId: task.id,
      risk: task.riskScore,
      status: r.status,
      reason: r.reason,
      approvedBy: r.approvedBy,
      approvedAt,
      createdAt,
      updatedAt,
    } satisfies Approval);
  }

  return approvals;
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
