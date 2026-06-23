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

// ─── Workflow Recipe — declarative spec for each seed workflow ────────────────
// `currentStep` is the 0-based index of the step currently in_progress (or the
// last completed step if status='completed'). For idle workflows it stays at 0
// but no step is marked in_progress (see buildSteps below).
interface WorkflowRecipe {
  type: WorkflowType;
  status: WorkflowStatus;
  currentStep: number;
  context: Record<string, unknown> | null;
  triggerOverride: string | null; // override the template trigger when seeding context differs
  hoursAgoStarted: number | null; // null = not yet started (idle)
  hoursAgoCompleted: number | null; // null = not yet completed
  hoursAgoCreated: number;
}

const SEED_WORKFLOW_RECIPE: WorkflowRecipe[] = [
  // 1. collection_recovery — running — Verma Industries ₹4,50,000 at step 2
  //    (detect ✓, WhatsApp ✓, email statement in progress, escalation pending)
  {
    type: 'collection_recovery',
    status: 'running',
    currentStep: 2,
    triggerOverride: 'Invoice INV-2025-0172 overdue 32 days (Verma Industries LLP, ₹4,50,000)',
    context: {
      clientId: 'client_005',
      clientName: 'Verma Industries LLP',
      invoiceNumber: 'INV-2025-0172',
      amount: 450000,
      overdueDays: 32,
      dso: 62,
    },
    hoursAgoStarted: 48,
    hoursAgoCompleted: null,
    hoursAgoCreated: 50,
  },
  // 2. gst_filing — completed — Sharma Enterprises LLP, December 2025 period (ARN generated)
  {
    type: 'gst_filing',
    status: 'completed',
    currentStep: 4, // last step index (filed + ARN)
    triggerOverride: 'GSTR-3B due 20th January 2026 (Sharma Enterprises LLP)',
    context: {
      clientId: 'client_001',
      clientName: 'Sharma Enterprises LLP',
      period: 'December 2025',
      returnType: 'GSTR-3B',
      arn: 'ARN-26012025-XYZ123',
      netLiability: 210000,
    },
    hoursAgoStarted: 192,
    hoursAgoCompleted: 168,
    hoursAgoCreated: 200,
  },
  // 3. cash_crisis — running — triggered by 12-day runway forecast (just started, step 0)
  {
    type: 'cash_crisis',
    status: 'running',
    currentStep: 0,
    triggerOverride: '13-week forecast: 12 days to cash shortfall',
    context: {
      currentBankBalance: 1840000,
      projectedOutflows: 2840000,
      deficit: 1000000,
      runwayDays: 12,
      bankAccount: 'HDFC Current — xxxx4821',
    },
    hoursAgoStarted: 4,
    hoursAgoCompleted: null,
    hoursAgoCreated: 5,
  },
  // 4. onboarding — completed — Nair Traders onboarded (Kerala, 14 days ago)
  {
    type: 'onboarding',
    status: 'completed',
    currentStep: 5,
    triggerOverride: 'New client engagement: Nair Traders (Kochi, Kerala)',
    context: {
      clientId: 'client_007',
      clientName: 'Nair Traders',
      gstin: '32ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      engagementType: 'Monthly retainer + GST filing',
    },
    hoursAgoStarted: 336,
    hoursAgoCompleted: 264,
    hoursAgoCreated: 340,
  },
  // 5. tds_filing — paused — Q3 FY 2025-26 awaiting 26AS reconciliation (challan step paused)
  {
    type: 'tds_filing',
    status: 'paused',
    currentStep: 2,
    triggerOverride: 'Q3 FY 2025-26 TDS due 31st January 2026',
    context: {
      quarter: 'Q3 FY 2025-26',
      totalTDS: 340000,
      sections: { '194C': 210000, '194J': 95000, '194I': 35000 },
      challan: 'ITNS-281',
      returnForm: '26Q',
      pausedReason: 'Awaiting 26AS reconciliation from TRACES',
    },
    hoursAgoStarted: 120,
    hoursAgoCompleted: null,
    hoursAgoCreated: 130,
  },
  // 6. payroll_run — running — January 2026 for 18 employees at approval step
  {
    type: 'payroll_run',
    status: 'running',
    currentStep: 2,
    triggerOverride: 'January 2026 payroll cycle (18 employees)',
    context: {
      period: 'January 2026',
      employeeCount: 18,
      grossPay: 842000,
      netPay: 727800,
      pfDeduction: 71200,
      tdsDeduction: 40600,
      ptDeduction: 2400,
      payDate: '2026-01-31',
    },
    hoursAgoStarted: 6,
    hoursAgoCompleted: null,
    hoursAgoCreated: 7,
  },
  // 7. gst_filing — running — Verma Industries LLP, January 2026 at download_2b step
  {
    type: 'gst_filing',
    status: 'running',
    currentStep: 1,
    triggerOverride: 'GSTR-3B due 20th February 2026 (Verma Industries LLP)',
    context: {
      clientId: 'client_005',
      clientName: 'Verma Industries LLP',
      period: 'January 2026',
      returnType: 'GSTR-3B',
    },
    hoursAgoStarted: 3,
    hoursAgoCompleted: null,
    hoursAgoCreated: 4,
  },
  // 8. collection_recovery — idle — pre-staged for Reddy Suppliers (will trigger next week)
  {
    type: 'collection_recovery',
    status: 'idle',
    currentStep: 0,
    triggerOverride: null, // idle workflow has no trigger yet
    context: {
      clientId: 'client_006',
      clientName: 'Reddy Suppliers',
      amount: 280000,
      willTriggerOn: '2026-02-01',
      note: 'Pre-staged; awaiting 60-day overdue threshold',
    },
    hoursAgoStarted: null,
    hoursAgoCompleted: null,
    hoursAgoCreated: 1,
  },
];

// ─── buildSteps — clone a template's steps and apply currentStep + status ─────
// Materialises the per-step status array based on workflow status:
//   • idle       → all pending (workflow not yet started)
//   • completed  → all completed (terminal state)
//   • running    → 0..currentStep-1 completed, currentStep in_progress, rest pending
//   • paused     → same as running (the in_progress step is just paused)
//   • aborted    → all steps marked as their current state (we don't change them)
function buildSteps(
  type: WorkflowType,
  currentStep: number,
  status: WorkflowStatus,
): WorkflowStep[] {
  const base = WORKFLOW_TEMPLATES[type].steps;
  if (status === 'idle') {
    return base.map((s) => ({ ...s, status: 'pending' as const }));
  }
  if (status === 'completed') {
    return base.map((s) => ({ ...s, status: 'completed' as const }));
  }
  // running / paused — mark prior steps completed, current in_progress, rest pending.
  return base.map((s, i) => {
    if (i < currentStep) return { ...s, status: 'completed' as const };
    if (i === currentStep) return { ...s, status: 'in_progress' as const };
    return { ...s, status: 'pending' as const };
  });
}

// ─── seedWorkflows — materialise 8 demo workflows across the 6 types ──────────
// Mix of statuses: running (4), completed (2), paused (1), idle (1). Each recipe
// is converted into a fully-populated Workflow with cloned steps + ISO timestamps.
export function seedWorkflows(): Workflow[] {
  const now = Date.now();
  return SEED_WORKFLOW_RECIPE.map((r, idx) => {
    const template = WORKFLOW_TEMPLATES[r.type];
    const steps = buildSteps(r.type, r.currentStep, r.status);
    const createdAt = new Date(now - r.hoursAgoCreated * 3600 * 1000).toISOString();
    const startedAt =
      r.hoursAgoStarted != null
        ? new Date(now - r.hoursAgoStarted * 3600 * 1000).toISOString()
        : null;
    const completedAt =
      r.hoursAgoCompleted != null
        ? new Date(now - r.hoursAgoCompleted * 3600 * 1000).toISOString()
        : null;
    return {
      id: `wf_${String(idx + 1).padStart(3, '0')}`,
      name: template.name,
      type: r.type,
      trigger: r.triggerOverride ?? template.trigger,
      steps,
      currentStep: r.currentStep,
      status: r.status,
      context: r.context,
      startedAt,
      completedAt,
      createdAt,
      updatedAt: completedAt ?? startedAt ?? createdAt,
    } satisfies Workflow;
  });
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
