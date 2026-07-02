// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Execution Engine™ — MODULE 5: Workflow Engine™
// Phase 8 Step 5 — Observe. Think. Decide. Execute. Confirm. Learn.
// ═══════════════════════════════════════════════════════════════════════════════
// Multi-step playbooks for the 6 recurring Indian SME / CA firm scenarios:
//
//   • collection_recovery  — Invoice overdue → WhatsApp → Email → Escalation → Recovery
//   • gst_filing           — Due date → Download 2B → Prepare → Approval → File
//   • cash_crisis          — Shortage → Collections → Delay Payables → Forecast → Recommend
//   • onboarding           — Intake → Verify → Setup → Migrate → Kickoff → Activate
//   • tds_filing           — Compute → Reconcile 26AS → Challan → Approve → File 26Q
//   • payroll_run          — Lock → Compute → Approve → Disburse
//
// Exports:
//   • WORKFLOW_TEMPLATES  — 6 playbook definitions (name, trigger, steps)
//   • seedWorkflows       — 8 demo workflows across all 6 types & 4 statuses
//   • getWorkflowSummary  — totals + running/completed/paused + byType + active
//   • startWorkflow       — factory: spin up a running Workflow from a template
//   • advanceWorkflow     — pure: mark current step complete, advance to next
//
// Pure TypeScript — no Prisma, no React, no 'use client'.
// Importable from both Next.js API routes (server) and React components (client).
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  AgentName,
  Workflow,
  WorkflowStatus,
  WorkflowStep,
  WorkflowSummary,
  WorkflowType,
} from './types';

// ─── Template step builder — keeps WORKFLOW_TEMPLATES terse & readable ────────
function tpl(stage: string, action: string, agent: AgentName | null): WorkflowStep {
  return { stage, action, agent, status: 'pending' };
}

// ─── WORKFLOW_TEMPLATES — the 6 playbook definitions ──────────────────────────
// Each template is a declarative spec: name + trigger + ordered steps. Templates
// are immutable blueprints — `startWorkflow` clones them into a fresh Workflow
// instance at runtime. All seed steps start as 'pending'; startWorkflow marks
// step 0 as 'in_progress' when materialising a new running instance.
export const WORKFLOW_TEMPLATES: Record<
  WorkflowType,
  { name: string; trigger: string; steps: WorkflowStep[] }
> = {
  collection_recovery: {
    name: 'Collection Recovery',
    trigger: 'Invoice overdue by 30+ days',
    steps: [
      tpl('detect', 'Identify overdue invoices', 'collection_agent'),
      tpl('remind', 'Send WhatsApp reminder', 'collection_agent'),
      tpl('email', 'Send formal email statement', 'collection_agent'),
      tpl('escalate', 'Escalate to legal notice (IBC Sec 9 for MSME)', 'collection_agent'),
      tpl('recover', 'Recover dues + update receivable ledger', 'collection_agent'),
    ],
  },

  gst_filing: {
    name: 'GST Filing',
    trigger: 'GSTR-1/3B due date approaching (T-7 days)',
    steps: [
      tpl('track_due', 'Track GST due date in compliance calendar', 'gst_agent'),
      tpl('download_2b', 'Download GSTR-2B from GST portal', 'gst_agent'),
      tpl('prepare', 'Prepare return + reconcile ITC against 2B', 'gst_agent'),
      tpl('approve', 'CA sign-off on draft return', 'gst_agent'),
      tpl('file', 'File return on GST portal + generate ARN', 'gst_agent'),
    ],
  },

  cash_crisis: {
    name: 'Cash Crisis Management',
    trigger: '13-week forecast predicts runway < 15 days',
    steps: [
      tpl('detect', 'Detect cash shortage from 13-week forecast', 'cfo_agent'),
      tpl('collect', 'Accelerate collections from overdue clients', 'collection_agent'),
      tpl('delay', 'Delay non-critical payables within terms', 'cfo_agent'),
      tpl('forecast', 'Re-forecast cash position post-actions', 'cfo_agent'),
      tpl('recommend', 'Recommend working-capital action to CFO', 'cfo_agent'),
    ],
  },

  onboarding: {
    name: 'Client Onboarding',
    trigger: 'New client engagement signed',
    steps: [
      tpl('intake', 'Collect KYC documents (PAN, Aadhaar, GSTIN, COI)', 'compliance_agent'),
      tpl('verify', 'Verify GSTIN/PAN/Aadhaar on government portals', 'compliance_agent'),
      tpl('setup', 'Configure compliance calendar + tax profile', 'gst_agent'),
      tpl('migrate', 'Migrate historical books + opening balances', 'cfo_agent'),
      tpl('kickoff', 'Schedule kickoff meeting with client', 'compliance_agent'),
      tpl('activate', 'Activate client in dashboard + send welcome kit', 'compliance_agent'),
    ],
  },

  tds_filing: {
    name: 'TDS Filing',
    trigger: 'Quarter-end TDS return due (26Q/24Q)',
    steps: [
      tpl('compute', 'Compute TDS section-wise (194C/194J/194I/194H)', 'compliance_agent'),
      tpl('reconcile', 'Reconcile against 26AS from TRACES', 'compliance_agent'),
      tpl('challan', 'Generate ITNS-281 challan + deposit', 'compliance_agent'),
      tpl('approve', 'CA sign-off on 26Q return', 'compliance_agent'),
      tpl('file', 'File 26Q return on TRACES portal', 'compliance_agent'),
    ],
  },

  payroll_run: {
    name: 'Payroll Run',
    trigger: 'Monthly payroll cycle (last working day)',
    steps: [
      tpl('lock', 'Lock attendance + leave records', 'compliance_agent'),
      tpl('compute', 'Compute PF/ESI/TDS/PT deductions', 'compliance_agent'),
      tpl('approve', 'Approve payroll + partner sign-off', 'compliance_agent'),
      tpl('disburse', 'Release net-pay bank file (NEFT)', 'compliance_agent'),
    ],
  },
};

// ─── seedWorkflows (no-op) ────────────────────────────────────────────────────
// Previously this function synthesised demo Workflows from a hardcoded
// recipe constant referencing fabricated clients, bank accounts, invoice
// numbers, and amounts. The export name is preserved so existing callers
// continue to compile, but it now returns `[]` so the UI renders a proper
// empty state. Real workflows come from `db.workflow.findMany()` via the
// API routes.
export function seedWorkflows(): Workflow[] {
  return [];
}

// ─── getWorkflowSummary — derive rollup metrics from a workflow stream ────────
// Returns totals, running/completed/paused counts, byType breakdown, and the
// list of activeWorkflows (everything that isn't 'idle', sorted by updatedAt desc).
export function getWorkflowSummary(workflows: Workflow[]): WorkflowSummary {
  const byType: Record<string, number> = {};
  let running = 0;
  let completed = 0;
  let paused = 0;

  for (const w of workflows) {
    byType[w.type] = (byType[w.type] ?? 0) + 1;
    switch (w.status) {
      case 'running':
        running += 1;
        break;
      case 'completed':
        completed += 1;
        break;
      case 'paused':
        paused += 1;
        break;
      // 'idle' and 'aborted' are counted in total but not in primary buckets.
    }
  }

  const activeWorkflows = workflows
    .filter((w) => w.status !== 'idle')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return {
    total: workflows.length,
    running,
    completed,
    paused,
    byType,
    activeWorkflows,
  };
}

// ─── startWorkflow — factory: spin up a fresh running Workflow from a template ─
// Clones the template's steps, marks step 0 as 'in_progress', sets status to
// 'running', and stamps startedAt + createdAt to now. Optional context bag carries
// runtime params (clientId, amount, period, etc.) for downstream steps to consume.
export function startWorkflow(
  type: WorkflowType,
  context: Record<string, unknown> | null = null,
): Workflow {
  const template = WORKFLOW_TEMPLATES[type];
  const now = new Date().toISOString();
  const steps = template.steps.map((s, i) =>
    i === 0
      ? { ...s, status: 'in_progress' as const }
      : { ...s, status: 'pending' as const },
  );
  return {
    id: `wf_live_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: template.name,
    type,
    trigger: template.trigger,
    steps,
    currentStep: 0,
    status: 'running',
    context,
    startedAt: now,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  } satisfies Workflow;
}

// ─── advanceWorkflow — pure: returns a new Workflow with the next step active ─
// Marks the current step as 'completed'. If a next step exists, marks it as
// 'in_progress' and increments currentStep. If the last step is now complete,
// sets status='completed' and stamps completedAt. Does NOT mutate the input.
//
// Terminal workflows (completed / aborted) are returned unchanged.
export function advanceWorkflow(workflow: Workflow): Workflow {
  // No-op if the workflow is already in a terminal state.
  if (workflow.status === 'completed' || workflow.status === 'aborted') {
    return workflow;
  }

  const now = new Date().toISOString();
  const { currentStep, steps } = workflow;

  // Defensive: clamp currentStep to a valid step index. Callers shouldn't pass
  // malformed state but we guard anyway to keep the function total.
  const safeStep =
    steps.length === 0 ? 0 : Math.max(0, Math.min(currentStep, steps.length - 1));

  // Mark the current step as completed (clone the array; do not mutate input).
  const newSteps = steps.map((s, i) =>
    i === safeStep ? { ...s, status: 'completed' as const } : s,
  );

  const nextStep = safeStep + 1;
  const isLast = nextStep >= steps.length;

  if (isLast) {
    return {
      ...workflow,
      steps: newSteps,
      currentStep: safeStep,
      status: 'completed',
      completedAt: now,
      updatedAt: now,
    };
  }

  // Mark the next step as in_progress.
  newSteps[nextStep] = { ...newSteps[nextStep], status: 'in_progress' as const };
  return {
    ...workflow,
    steps: newSteps,
    currentStep: nextStep,
    status: 'running',
    updatedAt: now,
  };
}
