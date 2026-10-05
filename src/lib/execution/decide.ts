// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Execution Engine™ — MODULE 3: Decide (Decision Orchestration)
// Phase 8 Step 5 — Observe. Think. Decide. Execute. Confirm. Learn.
// ═══════════════════════════════════════════════════════════════════════════════
// Sits between think.ts (Decision Engine) and execute.ts (Execution Engine).
//   Decision ──▶ planAction ──▶ ActionPlan ──▶ ExecutionTask (consumed by execute.ts)
//
// Responsibilities:
//   1. Turn decisions into executable task plans (taskType + owning agent + risk).
//   2. Compute needsApproval flag from RISK_THRESHOLD + per-action overrides.
//   3. Provide a full pipeline runner (seedDecisionsForEvents) that takes raw
//      events from the Observation Engine, applies rules, and emits decisions —
//      demonstrating observe → think → decide working end-to-end.
//
// Pure TypeScript — no Prisma, no React, no 'use client'.
// Importable from both Next.js API routes (server) and React components (client).
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  AgentName,
  BusinessEvent,
  Decision,
  DecisionAction,
  ExecutionTaskType,
} from './types';
import { applyRules } from './think';

// ─── Risk threshold: tasks scoring >= 60 require human approval ───────────────
export const RISK_THRESHOLD = 60;

// ─── Action Plan: bridge between Decision and ExecutionTask ───────────────────
export interface ActionPlan {
  decisionId: string;
  taskType: ExecutionTaskType;
  agent: AgentName;
  riskScore: number;
  description: string;
  needsApproval: boolean;
}

// ─── Action → task-type / agent / risk / approval map ─────────────────────────
// Risk scores calibrated to Indian SME risk appetite:
//   • Statutory filings (GST / TDS / Payroll) always need approval (sign-off).
//   • Recovery escalations to legal carry the highest risk (brand + legal exposure).
//   • Customer-facing reminders and reports are auto-executed (low risk, high cadence).
interface ActionBlueprint {
  taskType: ExecutionTaskType;
  agent: AgentName;
  riskScore: number;
  description: string;
  needsApproval: boolean;
}

const ACTION_BLUEPRINT: Record<DecisionAction, ActionBlueprint> = {
  prepare_return: {
    taskType: 'gst_prepare',
    agent: 'gst_agent',
    riskScore: 35,
    description: 'Prepare GSTR-3B return JSON; verify ITC against GSTR-2B; validate cash ledger balance before filing.',
    needsApproval: true, // filing requires human sign-off
  },
  send_reminder: {
    taskType: 'send_whatsapp',
    agent: 'collection_agent',
    riskScore: 18,
    description: 'Send payment reminder to overdue client via WhatsApp + email; log delivery in Communication Cloud.',
    needsApproval: false,
  },
  reconcile: {
    taskType: 'bank_reconcile',
    agent: 'cfo_agent',
    riskScore: 22,
    description: 'Auto-reconcile bank movement against open invoices / payables; surface unmatched entries for review.',
    needsApproval: false,
  },
  delay_payment: {
    taskType: 'send_email',
    agent: 'cfo_agent',
    riskScore: 42,
    description: 'Schedule vendor payment via Payment Engine; capture early-pay discount or defer within terms.',
    needsApproval: true, // cash-out decision requires sign-off
  },
  forecast: {
    taskType: 'send_report',
    agent: 'cfo_agent',
    riskScore: 15,
    description: 'Generate 13-week rolling cash forecast + working-capital recommendation; dispatch to stakeholders.',
    needsApproval: false,
  },
  escalate: {
    taskType: 'send_email',
    agent: 'compliance_agent',
    riskScore: 78,
    description: 'Escalate to legal recovery; draft IBC Section 9 notice (MSME); flag for legal counsel review.',
    needsApproval: true, // legal action requires sign-off
  },
  download_2b: {
    taskType: 'download_2b',
    agent: 'gst_agent',
    riskScore: 12,
    description: 'Download GSTR-2B from GST portal; match against purchase register to unlock ITC.',
    needsApproval: false,
  },
  run_payroll: {
    taskType: 'run_payroll',
    agent: 'compliance_agent',
    riskScore: 48,
    description: 'Compute PF / ESI / TDS deductions; generate payslips; release net-pay bank file before pay-date.',
    needsApproval: true, // salary payout requires sign-off
  },
  calc_tds: {
    taskType: 'calc_tds',
    agent: 'compliance_agent',
    riskScore: 40,
    description: 'Calculate TDS section-wise (194C / 194J / 194I); generate ITNS-281 challan; prepare 26Q return.',
    needsApproval: true, // statutory deposit requires sign-off
  },
  send_invoice: {
    taskType: 'send_invoice',
    agent: 'collection_agent',
    riskScore: 14,
    description: 'Generate invoice PDF; dispatch to client via WhatsApp + email; start receivable aging clock.',
    needsApproval: false,
  },
};

// ─── Map a single decision to an executable task plan ─────────────────────────
// Returns taskType + agent + riskScore + description + needsApproval (without
// decisionId — callers compose the full ActionPlan via planAllActions).
export function planAction(decision: Decision): {
  taskType: ExecutionTaskType;
  agent: AgentName;
  riskScore: number;
  description: string;
  needsApproval: boolean;
} {
  const bp = ACTION_BLUEPRINT[decision.action];
  // Approval required if the blueprint says so OR the risk score breaches threshold.
  const needsApproval = bp.needsApproval || bp.riskScore >= RISK_THRESHOLD;
  return {
    taskType: bp.taskType,
    agent: bp.agent,
    riskScore: bp.riskScore,
    description: bp.description,
    needsApproval,
  };
}

// ─── Plan a batch of decisions into ActionPlans (one per decision) ────────────
export function planAllActions(decisions: Decision[]): ActionPlan[] {
  return decisions.map((d) => {
    const plan = planAction(d);
    return {
      decisionId: d.id,
      ...plan,
    };
  });
}

// ─── Full pipeline: observe → think → decide ──────────────────────────────────
// Takes raw BusinessEvent[] from the Observation Engine, applies the Decision
// Engine's rule logic to each event, and emits a Decision per event. This
// demonstrates the pipeline working end-to-end and is the entry-point used by
// /api/execution to materialise decisions from live observations.
export function seedDecisionsForEvents(events: BusinessEvent[]): Decision[] {
  const now = Date.now();
  return events.map((event, idx) => {
    const { reason, priority, action } = applyRules(event);
    const ts = new Date(now - (idx + 1) * 5 * 60 * 1000).toISOString();
    return {
      id: `dec_auto_${event.id}`,
      eventId: event.id,
      reason,
      priority,
      action,
      status: 'pending' as const,
      createdAt: ts,
      updatedAt: ts,
    };
  });
}
