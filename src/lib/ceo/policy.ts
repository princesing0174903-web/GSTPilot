// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI CEO™ — ROLE-BASED SECURITY POLICY
//
// Every autonomous action requires policy validation. CEO / CFO / Manager /
// Employee / Auditor roles have escalating authority. Destructive actions
// (loan, payroll, large payments) require higher approval than benign ones
// (send reminder, schedule meeting).
//
// Tagline: VEYRO AI CEO™ — Run Your Business. Not Your Software.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  ExecutiveRole,
  ApprovalRequirement,
  DecisionRisk,
  DecisionType,
  ExecutiveDecision,
} from './types';

// ─── Role hierarchy (higher index = more authority) ──────────────────────────

export const ROLE_HIERARCHY: Record<ExecutiveRole, number> = {
  auditor: 1,
  employee: 2,
  manager: 3,
  cfo: 4,
  ceo: 5,
};

// ─── Approval requirement per role ───────────────────────────────────────────
// Maps an ApprovalRequirement → the minimum role that can satisfy it.

export const APPROVAL_ROLE_MIN: Record<ApprovalRequirement, ExecutiveRole> = {
  none: 'employee',
  notify: 'employee',
  manager: 'manager',
  cfo: 'cfo',
  ceo: 'ceo',
  board: 'ceo', // board-level → still needs CEO sign-off in single-tenant mode
};

// ─── Decision risk policy ────────────────────────────────────────────────────
// Each decision type has a base risk + minimum approval requirement + whether
// it's destructive. Tuned to be conservative — when in doubt, escalate.

export interface DecisionPolicy {
  type: DecisionType;
  baseRisk: DecisionRisk;
  defaultApproval: ApprovalRequirement;
  destructive: boolean;            // requires extra sign-off
  financialThresholds?: {
    // Auto-escalate approval if impact exceeds these thresholds (₹)
    managerLimit: number;          // above this → needs cfo
    cfoLimit: number;              // above this → needs ceo
  };
}

const POLICIES: Record<DecisionType, DecisionPolicy> = {
  // ── Collection & client (low risk, manager-approved for larger amounts) ──
  recover_payment:           { type: 'recover_payment',           baseRisk: 'low',      defaultApproval: 'manager', destructive: false, financialThresholds: { managerLimit: 100000, cfoLimit: 1000000 } },
  remind_client:             { type: 'remind_client',             baseRisk: 'low',      defaultApproval: 'none',    destructive: false },
  follow_up_lead:            { type: 'follow_up_lead',            baseRisk: 'low',      defaultApproval: 'none',    destructive: false },
  reply_customer:            { type: 'reply_customer',            baseRisk: 'low',      defaultApproval: 'none',    destructive: false },
  schedule_meeting:          { type: 'schedule_meeting',          baseRisk: 'low',      defaultApproval: 'none',    destructive: false },

  // ── Pricing / marketing (medium risk — affects revenue & brand) ──
  increase_prices:           { type: 'increase_prices',           baseRisk: 'medium',   defaultApproval: 'cfo',     destructive: false },
  pause_marketing:           { type: 'pause_marketing',           baseRisk: 'medium',   defaultApproval: 'manager', destructive: false },
  increase_marketing:        { type: 'increase_marketing',        baseRisk: 'medium',   defaultApproval: 'manager', destructive: false, financialThresholds: { managerLimit: 50000, cfoLimit: 500000 } },

  // ── Expenses / purchases (medium-high risk — affects cash) ──
  reduce_expenses:           { type: 'reduce_expenses',           baseRisk: 'low',      defaultApproval: 'manager', destructive: false },
  delay_purchase:            { type: 'delay_purchase',            baseRisk: 'low',      defaultApproval: 'manager', destructive: false },
  review_expense:            { type: 'review_expense',            baseRisk: 'low',      defaultApproval: 'manager', destructive: false },
  pay_vendor:                { type: 'pay_vendor',                baseRisk: 'medium',   defaultApproval: 'manager', destructive: true,  financialThresholds: { managerLimit: 50000, cfoLimit: 500000 } },
  renew_subscription:        { type: 'renew_subscription',        baseRisk: 'low',      defaultApproval: 'manager', destructive: false },
  review_contract:           { type: 'review_contract',           baseRisk: 'low',      defaultApproval: 'manager', destructive: false },

  // ── GST / compliance (medium risk — legal exposure) ──
  pay_gst:                   { type: 'pay_gst',                   baseRisk: 'medium',   defaultApproval: 'manager', destructive: true,  financialThresholds: { managerLimit: 100000, cfoLimit: 1000000 } },
  claim_itc:                 { type: 'claim_itc',                 baseRisk: 'low',      defaultApproval: 'manager', destructive: false },
  file_overdue_return:       { type: 'file_overdue_return',       baseRisk: 'high',     defaultApproval: 'cfo',     destructive: false },
  review_compliance:         { type: 'review_compliance',         baseRisk: 'low',      defaultApproval: 'manager', destructive: false },

  // ── People (high risk — affects burn & culture) ──
  hire_employees:            { type: 'hire_employees',            baseRisk: 'high',     defaultApproval: 'ceo',     destructive: false },
  delay_hiring:              { type: 'delay_hiring',              baseRisk: 'low',      defaultApproval: 'manager', destructive: false },
  approve_payroll:           { type: 'approve_payroll',           baseRisk: 'high',     defaultApproval: 'cfo',     destructive: true },

  // ── Capital structure (critical risk — affects leverage) ──
  suggest_loan:              { type: 'suggest_loan',              baseRisk: 'high',     defaultApproval: 'ceo',     destructive: true },
  repay_loan:                { type: 'repay_loan',                baseRisk: 'high',     defaultApproval: 'cfo',     destructive: true,  financialThresholds: { managerLimit: 50000, cfoLimit: 1000000 } },
  optimize_cash:             { type: 'optimize_cash',             baseRisk: 'medium',   defaultApproval: 'cfo',     destructive: false },

  // ── Strategic (medium risk — long-term direction) ──
  reduce_vendor_dependency:  { type: 'reduce_vendor_dependency',  baseRisk: 'medium',   defaultApproval: 'cfo',     destructive: false },
  improve_collections:       { type: 'improve_collections',       baseRisk: 'low',      defaultApproval: 'manager', destructive: false },
  improve_profitability:     { type: 'improve_profitability',     baseRisk: 'medium',   defaultApproval: 'cfo',     destructive: false },
  improve_runway:            { type: 'improve_runway',            baseRisk: 'medium',   defaultApproval: 'cfo',     destructive: false },

  // ── Investigation / generation (low risk) ──
  investigate_anomaly:       { type: 'investigate_anomaly',       baseRisk: 'low',      defaultApproval: 'manager', destructive: false },
  create_quotation:          { type: 'create_quotation',          baseRisk: 'low',      defaultApproval: 'none',    destructive: false },
};

// All DecisionType keys are covered above.

// ─── Public API ──────────────────────────────────────────────────────────────

export function getDecisionPolicy(type: DecisionType): DecisionPolicy {
  return POLICIES[type] ?? {
    type,
    baseRisk: 'medium' as DecisionRisk,
    defaultApproval: 'manager' as ApprovalRequirement,
    destructive: false,
  };
}

/** Resolve the *effective* approval required for a specific decision instance. */
export function resolveApprovalRequirement(
  type: DecisionType,
  financialImpact: number,
): { requirement: ApprovalRequirement; requiresRole: ExecutiveRole; risk: DecisionRisk } {
  const policy = getDecisionPolicy(type);
  let requirement = policy.defaultApproval;

  // Escalate based on financial thresholds
  if (policy.financialThresholds && Math.abs(financialImpact) > policy.financialThresholds.managerLimit) {
    requirement = 'cfo';
  }
  if (policy.financialThresholds && Math.abs(financialImpact) > policy.financialThresholds.cfoLimit) {
    requirement = 'ceo';
  }

  // Destructive actions never auto-approve
  if (policy.destructive && requirement === 'none') {
    requirement = 'manager';
  }

  // Risk escalation
  let risk = policy.baseRisk;
  if (Math.abs(financialImpact) > 1000000) {
    risk = risk === 'low' ? 'medium' : risk === 'medium' ? 'high' : 'critical';
  }
  if (Math.abs(financialImpact) > 10000000) {
    risk = 'critical';
  }

  return {
    requirement,
    requiresRole: APPROVAL_ROLE_MIN[requirement],
    risk,
  };
}

/** True if `role` can satisfy `requirement`. */
export function canRoleApprove(role: ExecutiveRole, requirement: ApprovalRequirement): boolean {
  const minRole = APPROVAL_ROLE_MIN[requirement];
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];
}

/** Validate that the caller may approve this specific decision. */
export function validateApproval(
  decision: ExecutiveDecision,
  role: ExecutiveRole,
): { allowed: boolean; reason?: string } {
  if (decision.status !== 'pending') {
    return { allowed: false, reason: `Decision is already ${decision.status}.` };
  }
  if (!canRoleApprove(role, decision.approvalRequired)) {
    return {
      allowed: false,
      reason: `Role "${role}" cannot approve a "${decision.approvalRequired}" decision. Requires ${decision.requiresRole} or higher.`,
    };
  }
  return { allowed: true };
}

/** Validate that the caller may execute (i.e. approval already granted OR auto-eligible). */
export function validateExecution(
  decision: ExecutiveDecision,
  role: ExecutiveRole,
): { allowed: boolean; reason?: string } {
  if (decision.status === 'executed' || decision.status === 'executing') {
    return { allowed: false, reason: `Decision is already ${decision.status}.` };
  }
  if (decision.status === 'rejected') {
    return { allowed: false, reason: 'Decision was rejected.' };
  }
  // Need approval first (unless auto_approved or already approved)
  if (decision.status !== 'approved' && decision.status !== 'auto_approved') {
    const approvalCheck = validateApproval(decision, role);
    if (!approvalCheck.allowed) {
      return {
        allowed: false,
        reason: `Decision requires approval first. ${approvalCheck.reason ?? ''}`.trim(),
      };
    }
  }
  return { allowed: true };
}

/** True if a decision is benign enough to auto-approve (notify-only). */
export function isAutoApprovable(decision: ExecutiveDecision): boolean {
  return (
    decision.approvalRequired === 'none' &&
    !getDecisionPolicy(decision.type).destructive &&
    Math.abs(decision.financialImpact) < 10000
  );
}

/** Resolve the user's effective role. Defaults to 'employee' when unknown. */
export function resolveRole(role?: string): ExecutiveRole {
  if (!role) return 'employee';
  const r = role.toLowerCase() as ExecutiveRole;
  if (r === 'ceo' || r === 'cfo' || r === 'manager' || r === 'employee' || r === 'auditor') {
    return r;
  }
  // Map common alternative spellings
  if (r === 'admin' || r === 'owner' || r === 'founder') return 'ceo';
  if (r === 'accountant' || r === 'finance') return 'cfo';
  return 'employee';
}
