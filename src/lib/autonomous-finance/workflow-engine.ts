// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Workflow Automation Engine (Phase Delta · 1)
// Pure TypeScript state machine: trigger → steps (action/condition/delay/
// parallel/approval) → audited run. Persisted to Firestore `workflow_definitions`
// and `workflow_runs`. Versioned + editable. Framework-agnostic.
// ═══════════════════════════════════════════════════════════════════════════════

export type WorkflowTriggerType = 'event' | 'schedule' | 'manual';

export interface WorkflowTrigger {
  type: WorkflowTriggerType;
  /** For event triggers: e.g. 'invoice.created', 'bank.transaction.created'. */
  event?: string;
  /** For schedule triggers: cron-like description, e.g. '0 9 * * 1' (Mon 9am). */
  schedule?: string;
  /** Human label, e.g. 'Every Monday at 9 AM'. */
  scheduleLabel?: string;
}

export type StepType = 'action' | 'condition' | 'delay' | 'parallel' | 'approval';

export interface WorkflowCondition {
  /** Field path on the trigger context, e.g. 'invoice.status'. */
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains';
  /** Compared value. */
  value: string | number | boolean;
}

export interface WorkflowStep {
  id: string;
  type: StepType;
  name: string;
  /** Action identifier resolved by the runtime's action registry. */
  action?: string;
  /** Args passed to the action executor. */
  args?: Record<string, unknown>;
  /** For condition steps: the predicate. Branches to onTrue / onFalse ids. */
  condition?: WorkflowCondition;
  onTrue?: string | null;
  onFalse?: string | null;
  /** For delay steps: milliseconds to wait. */
  delayMs?: number;
  /** For parallel steps: child step ids to run concurrently. */
  parallel?: string[];
  /** For approval steps: role required to approve. */
  approvalRole?: 'admin' | 'manager' | 'staff';
  /** Next step id (null = end). */
  next?: string | null;
}

export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'archived';

export interface WorkflowDefinition {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  version: number;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  status: WorkflowStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type StepRunStatus =
  | 'pending' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'skipped';

export interface StepRun {
  stepId: string;
  stepName: string;
  stepType: StepType;
  status: StepRunStatus;
  startedAt: string | null;
  completedAt: string | null;
  output?: unknown;
  error?: string;
}

export type WorkflowRunStatus =
  | 'pending' | 'running' | 'paused' | 'completed' | 'failed';

export interface WorkflowRun {
  id: string;
  organizationId: string;
  workflowId: string;
  workflowName: string;
  workflowVersion: number;
  status: WorkflowRunStatus;
  currentStepId: string | null;
  trigger: WorkflowTrigger;
  context: Record<string, unknown>;
  steps: StepRun[];
  startedAt: string;
  completedAt: string | null;
  auditTrail: AuditEntry[];
}

export interface AuditEntry {
  ts: string;
  stepId: string;
  event: string;
  detail?: string;
}

// ─── Action registry contract (executors provided at runtime) ────────────────

export type ActionExecutor = (
  args: Record<string, unknown>,
  context: Record<string, unknown>,
) => Promise<unknown>;

export interface ActionRegistry {
  [actionId: string]: ActionExecutor;
}

// ─── Condition evaluator (safe, no eval) ─────────────────────────────────────

function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function evaluateCondition(
  cond: WorkflowCondition,
  context: Record<string, unknown>,
): boolean {
  const left = getPath(context, cond.field);
  const right = cond.value;
  switch (cond.operator) {
    case 'eq': return left === right;
    case 'neq': return left !== right;
    case 'gt': return typeof left === 'number' && typeof right === 'number' && left > right;
    case 'gte': return typeof left === 'number' && typeof right === 'number' && left >= right;
    case 'lt': return typeof left === 'number' && typeof right === 'number' && left < right;
    case 'lte': return typeof left === 'number' && typeof right === 'number' && left <= right;
    case 'contains':
      return typeof left === 'string' && typeof right === 'string' && left.includes(right);
    default: return false;
  }
}

// ─── Workflow executor (state machine) ───────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Execute a workflow definition end-to-end. Handles action, condition (branch),
 * delay (async sleep), parallel (Promise.all), and approval (pauses run).
 * Approval steps cause the run to return with status 'paused' + a
 * 'waiting_approval' step — the caller persists this and resumes via
 * `resumeWorkflow` once an approval is recorded.
 */
export async function executeWorkflow(
  def: WorkflowDefinition,
  context: Record<string, unknown>,
  registry: ActionRegistry,
): Promise<WorkflowRun> {
  const run: WorkflowRun = {
    id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    organizationId: def.organizationId,
    workflowId: def.id,
    workflowName: def.name,
    workflowVersion: def.version,
    status: 'running',
    currentStepId: def.steps[0]?.id ?? null,
    trigger: def.trigger,
    context,
    steps: def.steps.map((s) => ({
      stepId: s.id, stepName: s.name, stepType: s.type, status: 'pending',
      startedAt: null, completedAt: null,
    })),
    startedAt: nowISO(),
    completedAt: null,
    auditTrail: [{ ts: nowISO(), stepId: '', event: 'workflow_started' }],
  };

  let currentStep = def.steps.find((s) => s.id === run.currentStepId) ?? null;

  while (currentStep) {
    const stepRun = run.steps.find((sr) => sr.stepId === currentStep!.id)!;
    stepRun.status = 'running';
    stepRun.startedAt = nowISO();
    run.currentStepId = currentStep.id;
    run.auditTrail.push({ ts: nowISO(), stepId: currentStep.id, event: 'step_started' });

    try {
      if (currentStep.type === 'action' && currentStep.action) {
        const executor = registry[currentStep.action];
        if (!executor) throw new Error(`No executor registered for action "${currentStep.action}"`);
        stepRun.output = await executor(currentStep.args ?? {}, context);
        stepRun.status = 'completed';
        run.auditTrail.push({ ts: nowISO(), stepId: currentStep.id, event: 'action_executed' });
        currentStep = def.steps.find((s) => s.id === currentStep!.next) ?? null;
      } else if (currentStep.type === 'condition' && currentStep.condition) {
        const passed = evaluateCondition(currentStep.condition, context);
        stepRun.output = { conditionPassed: passed };
        stepRun.status = 'completed';
        const nextId = passed ? currentStep.onTrue : currentStep.onFalse;
        run.auditTrail.push({ ts: nowISO(), stepId: currentStep.id, event: `condition_${passed ? 'true' : 'false'}` });
        currentStep = nextId ? (def.steps.find((s) => s.id === nextId) ?? null) : null;
      } else if (currentStep.type === 'delay' && typeof currentStep.delayMs === 'number') {
        await sleep(currentStep.delayMs);
        stepRun.status = 'completed';
        run.auditTrail.push({ ts: nowISO(), stepId: currentStep.id, event: `delay_${currentStep.delayMs}ms` });
        currentStep = def.steps.find((s) => s.id === currentStep!.next) ?? null;
      } else if (currentStep.type === 'parallel' && currentStep.parallel) {
        const children = currentStep.parallel
          .map((id) => def.steps.find((s) => s.id === id))
          .filter((s): s is WorkflowStep => Boolean(s));
        await Promise.all(
          children.map(async (child) => {
            const childRun = run.steps.find((sr) => sr.stepId === child.id);
            if (!childRun) return;
            childRun.status = 'running';
            childRun.startedAt = nowISO();
            try {
              if (child.action && registry[child.action]) {
                childRun.output = await registry[child.action](child.args ?? {}, context);
              }
              childRun.status = 'completed';
              childRun.completedAt = nowISO();
            } catch (e) {
              childRun.status = 'failed';
              childRun.error = e instanceof Error ? e.message : 'parallel branch failed';
              childRun.completedAt = nowISO();
            }
          }),
        );
        stepRun.status = 'completed';
        run.auditTrail.push({ ts: nowISO(), stepId: currentStep.id, event: 'parallel_completed' });
        currentStep = def.steps.find((s) => s.id === currentStep!.next) ?? null;
      } else if (currentStep.type === 'approval') {
        stepRun.status = 'waiting_approval';
        run.status = 'paused';
        run.auditTrail.push({ ts: nowISO(), stepId: currentStep.id, event: 'approval_required' });
        return run; // pause — caller persists and resumes later
      } else {
        stepRun.status = 'skipped';
        currentStep = def.steps.find((s) => s.id === currentStep!.next) ?? null;
      }
      stepRun.completedAt = nowISO();
    } catch (e) {
      stepRun.status = 'failed';
      stepRun.error = e instanceof Error ? e.message : 'execution failed';
      stepRun.completedAt = nowISO();
      run.status = 'failed';
      run.auditTrail.push({ ts: nowISO(), stepId: currentStep.id, event: 'step_failed', detail: stepRun.error });
      run.completedAt = nowISO();
      return run;
    }
  }

  run.status = 'completed';
  run.currentStepId = null;
  run.completedAt = nowISO();
  run.auditTrail.push({ ts: nowISO(), stepId: '', event: 'workflow_completed' });
  return run;
}

// ─── Production workflow templates (versioned, editable) ─────────────────────

export const WORKFLOW_TEMPLATES: Omit<WorkflowDefinition, 'id' | 'organizationId' | 'createdBy' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Invoice Collection Pipeline',
    description: 'When an invoice is created, email the customer, wait 3 days, then escalate to WhatsApp + Oracle + a collection task if still unpaid.',
    version: 1,
    trigger: { type: 'event', event: 'invoice.created' },
    status: 'draft',
    steps: [
      { id: 's1', type: 'action', name: 'Send Invoice Email', action: 'sendEmail', args: { template: 'invoice_created' }, next: 's2' },
      { id: 's2', type: 'delay', name: 'Wait 3 Days', delayMs: 3 * 24 * 60 * 60 * 1000, next: 's3' },
      { id: 's3', type: 'condition', name: 'Still Unpaid?', condition: { field: 'invoice.status', operator: 'eq', value: 'unpaid' }, onTrue: 's4', onFalse: null },
      { id: 's4', type: 'action', name: 'Send WhatsApp Reminder', action: 'sendWhatsApp', args: { template: 'payment_reminder' }, next: 's5' },
      { id: 's5', type: 'action', name: 'Notify Oracle', action: 'notifyOracle', args: { event: 'overdue_invoice' }, next: 's6' },
      { id: 's6', type: 'action', name: 'Create Collection Task', action: 'createTask', args: { type: 'collection', priority: 'high' }, next: null },
    ],
  },
  {
    name: 'GST Return Filing Reminder',
    description: '7 days before the GST due date, start a 3-step reminder ladder (Email → WhatsApp → Oracle call).',
    version: 1,
    trigger: { type: 'schedule', schedule: '7 days before gst.due', scheduleLabel: '7 days before GST due date' },
    status: 'draft',
    steps: [
      { id: 's1', type: 'action', name: 'Send Filing Reminder Email', action: 'sendEmail', args: { template: 'gst_due_reminder' }, next: 's2' },
      { id: 's2', type: 'delay', name: 'Wait 4 Days', delayMs: 4 * 24 * 60 * 60 * 1000, next: 's3' },
      { id: 's3', type: 'action', name: 'Send WhatsApp Reminder', action: 'sendWhatsApp', args: { template: 'gst_due_urgent' }, next: 's4' },
      { id: 's4', type: 'delay', name: 'Wait 2 Days', delayMs: 2 * 24 * 60 * 60 * 1000, next: 's5' },
      { id: 's5', type: 'action', name: 'Call Oracle for Review', action: 'notifyOracle', args: { event: 'gst_filing_critical' }, next: null },
    ],
  },
  {
    name: 'Bank Auto-Reconciliation',
    description: 'When a new bank transaction arrives, attempt to match an invoice; if confidence is high, auto-reconcile and notify.',
    version: 1,
    trigger: { type: 'event', event: 'bank.transaction.created' },
    status: 'draft',
    steps: [
      { id: 's1', type: 'action', name: 'Match Invoice', action: 'matchInvoice', next: 's2' },
      { id: 's2', type: 'condition', name: 'Confidence > 90%?', condition: { field: 'match.confidence', operator: 'gte', value: 0.9 }, onTrue: 's3', onFalse: 's4' },
      { id: 's3', type: 'action', name: 'Auto-Reconcile', action: 'autoReconcile', next: 's5' },
      { id: 's4', type: 'action', name: 'Flag for Review', action: 'createTask', args: { type: 'reconciliation_review', priority: 'medium' }, next: 's5' },
      { id: 's5', type: 'action', name: 'Notify Team', action: 'sendNotification', args: { channel: 'inapp' }, next: null },
    ],
  },
  {
    name: 'Vendor Bill Approval',
    description: 'When a vendor bill over ₹1,00,000 is created, route to a manager for approval, then schedule payment and notify.',
    version: 1,
    trigger: { type: 'event', event: 'vendor.bill.created' },
    status: 'draft',
    steps: [
      { id: 's1', type: 'condition', name: 'Amount > ₹1,00,000?', condition: { field: 'bill.amount', operator: 'gt', value: 100000 }, onTrue: 's2', onFalse: 's5' },
      { id: 's2', type: 'approval', name: 'Manager Approval', approvalRole: 'manager', next: 's3' },
      { id: 's3', type: 'action', name: 'Schedule Payment', action: 'schedulePayment', next: 's4' },
      { id: 's4', type: 'action', name: 'Notify Finance Team', action: 'sendNotification', args: { channel: 'inapp' }, next: null },
      { id: 's5', type: 'action', name: 'Auto-Approve Small Bill', action: 'schedulePayment', next: null },
    ],
  },
];

// ─── Serialization helpers (Firestore-friendly) ──────────────────────────────

export function serializeWorkflow(def: WorkflowDefinition): Record<string, unknown> {
  return JSON.parse(JSON.stringify(def));
}

export function deserializeWorkflow(raw: Record<string, unknown>): WorkflowDefinition {
  return raw as unknown as WorkflowDefinition;
}
