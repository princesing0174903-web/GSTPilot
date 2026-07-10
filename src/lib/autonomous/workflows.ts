// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AUTONOMOUS ENTERPRISE™ — AUTONOMOUS WORKFLOWS
//
// AI chains together actions automatically with no manual intervention:
//   Lead → Qualification → Proposal → Follow-up → Negotiation → Invoice →
//   Payment → GST → Accounting → Reporting → Knowledge update → Business
//   Graph update.
//
// Templates are real definitions; active workflows are loaded from the
// persisted Workflow model.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { AutonomousWorkflow, WorkflowTemplate, WorkflowStep } from './types';

// ─── Workflow templates (the autonomous action chains) ───────────────────────

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    type: 'lead_to_cash',
    name: 'Lead → Cash → Knowledge (Full Autonomous)',
    trigger: 'New lead arrives in CRM',
    description:
      'Lead → Qualification → Proposal → Follow-up → Negotiation → Invoice → Payment → GST → Accounting → Reporting → Knowledge update → Business Graph update.',
    steps: [
      { stage: 'Qualification', action: 'Score & qualify lead', agent: 'cro', automated: true },
      { stage: 'Proposal', action: 'Generate tailored proposal', agent: 'operations', automated: true },
      { stage: 'Follow-up', action: 'Schedule + send follow-up', agent: 'operations', automated: true },
      { stage: 'Negotiation', action: 'Draft revised terms', agent: 'cro', automated: false },
      { stage: 'Invoice', action: 'Generate invoice', agent: 'operations', automated: true },
      { stage: 'Payment', action: 'Send reminders + reconcile', agent: 'collection_agent', automated: true },
      { stage: 'GST', action: 'File GSTR-1 + claim ITC', agent: 'gst_agent', automated: true },
      { stage: 'Accounting', action: 'Post to ledger', agent: 'cfo_agent', automated: true },
      { stage: 'Reporting', action: 'Update executive dashboards', agent: 'reporting_agent', automated: true },
      { stage: 'Knowledge', action: 'Persist to Enterprise Memory', agent: 'oracle', automated: true },
      { stage: 'Business Graph', action: 'Update nodes + edges', agent: 'oracle', automated: true },
    ],
  },
  {
    type: 'collection_recovery',
    name: 'Collection Recovery (Autonomous)',
    trigger: 'Invoice overdue by 1 day',
    description:
      'Reminder email → WhatsApp → SMS → Call schedule → Escalation → Legal notice prep.',
    steps: [
      { stage: 'Reminder', action: 'Send email reminder', agent: 'collection_agent', automated: true },
      { stage: 'WhatsApp', action: 'Send WhatsApp follow-up', agent: 'collection_agent', automated: true },
      { stage: 'SMS', action: 'Send SMS nudge', agent: 'collection_agent', automated: true },
      { stage: 'Call', action: 'Schedule recovery call', agent: 'operations', automated: false },
      { stage: 'Escalation', action: 'Escalate to CFO', agent: 'cfo_agent', automated: true },
      { stage: 'Legal', action: 'Prepare legal notice', agent: 'legal', automated: false },
    ],
  },
  {
    type: 'gst_filing',
    name: 'GST Filing (Autonomous)',
    trigger: 'GSTR due date approaching',
    description:
      'Download 2B → Reconcile 2A/2B → Prepare GSTR-1 → Prepare GSTR-3B → Generate challan → File → Pay → Update audit log.',
    steps: [
      { stage: '2B', action: 'Download GSTR-2B', agent: 'gst_agent', automated: true },
      { stage: 'Reconcile', action: 'Reconcile 2A/2B', agent: 'gst_agent', automated: true },
      { stage: 'GSTR-1', action: 'Prepare GSTR-1', agent: 'gst_agent', automated: true },
      { stage: 'GSTR-3B', action: 'Prepare GSTR-3B', agent: 'gst_agent', automated: true },
      { stage: 'Challan', action: 'Generate payment challan', agent: 'gst_agent', automated: true },
      { stage: 'File', action: 'File return', agent: 'gst_agent', automated: true },
      { stage: 'Pay', action: 'Pay liability', agent: 'cfo_agent', automated: true },
      { stage: 'Audit', action: 'Update audit log', agent: 'oracle', automated: true },
    ],
  },
  {
    type: 'cash_crisis',
    name: 'Cash Crisis Response (Autonomous)',
    trigger: 'Runway drops below 21 days',
    description:
      'Freeze spend → Accelerate collections → Delay payables → Draw credit line → Notify executives.',
    steps: [
      { stage: 'Freeze', action: 'Freeze non-essential spend', agent: 'cfo_agent', automated: true },
      { stage: 'Accelerate', action: 'Launch collection workflow', agent: 'collection_agent', automated: true },
      { stage: 'Delay', action: 'Delay non-critical payables', agent: 'cfo_agent', automated: true },
      { stage: 'Credit', action: 'Draw on credit line', agent: 'cfo_agent', automated: false },
      { stage: 'Notify', action: 'Notify CEO + board', agent: 'oracle', automated: true },
    ],
  },
  {
    type: 'payroll_run',
    name: 'Payroll Run (Autonomous)',
    trigger: 'Last business day of month',
    description:
      'Validate attendance → Compute payroll → Approve → Disburse → File PF/ESI → Update books.',
    steps: [
      { stage: 'Attendance', action: 'Validate attendance', agent: 'hr', automated: true },
      { stage: 'Compute', action: 'Compute payroll', agent: 'hr', automated: true },
      { stage: 'Approve', action: 'CFO approval', agent: 'cfo_agent', automated: false },
      { stage: 'Disburse', action: 'Disburse salaries', agent: 'cfo_agent', automated: true },
      { stage: 'PF/ESI', action: 'File PF/ESI returns', agent: 'hr', automated: true },
      { stage: 'Books', action: 'Update accounting', agent: 'cfo_agent', automated: true },
    ],
  },
  {
    type: 'vendor_onboarding',
    name: 'Vendor Onboarding (Autonomous)',
    trigger: 'New vendor added',
    description:
      'KYC → Contract → First PO → Goods receipt → Invoice → 3-way match → Payment.',
    steps: [
      { stage: 'KYC', action: 'Vendor KYC verification', agent: 'legal', automated: true },
      { stage: 'Contract', action: 'Generate contract', agent: 'legal', automated: true },
      { stage: 'PO', action: 'Raise purchase order', agent: 'coo', automated: true },
      { stage: 'Receipt', action: 'Goods receipt', agent: 'coo', automated: false },
      { stage: 'Invoice', action: 'Receive invoice', agent: 'cfo_agent', automated: true },
      { stage: 'Match', action: '3-way match', agent: 'cfo_agent', automated: true },
      { stage: 'Pay', action: 'Schedule payment', agent: 'cfo_agent', automated: true },
    ],
  },
];

// ─── Load active workflows from the persisted Workflow model ─────────────────

export async function loadActiveWorkflows(limit = 8): Promise<AutonomousWorkflow[]> {
  try {
    const rows = await db.workflow.findMany({
      where: { status: { in: ['running', 'idle', 'paused', 'completed'] } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(rowToWorkflow);
  } catch (err) {
    console.warn('[Autonomous] loadActiveWorkflows failed:', err);
    return [];
  }
}

function rowToWorkflow(row: {
  id: string; name: string; type: string; trigger: string | null;
  steps: string; currentStep: number; status: string; context: string | null;
  startedAt: Date | null; completedAt: Date | null; createdAt: Date;
}): AutonomousWorkflow {
  let steps: WorkflowStep[] = [];
  let context: Record<string, unknown> | undefined;
  try {
    const raw = JSON.parse(row.steps) as Array<{
      stage: string; action: string; agent: string; automated?: boolean;
    }>;
    steps = raw.map((s, idx) => ({
      stage: s.stage,
      action: s.action,
      agent: s.agent,
      automated: s.automated ?? true,
      status: idx < row.currentStep ? 'completed' : idx === row.currentStep ? 'running' : 'pending',
    }));
  } catch { /* ignore */ }
  try {
    if (row.context) context = JSON.parse(row.context) as Record<string, unknown>;
  } catch { /* ignore */ }
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    trigger: row.trigger ?? '',
    steps,
    currentStep: row.currentStep,
    status: row.status as AutonomousWorkflow['status'],
    context,
    startedAt: row.startedAt?.toISOString(),
    completedAt: row.completedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

// ─── Start a new workflow instance from a template ───────────────────────────

export async function startWorkflow(
  templateType: string,
  context?: Record<string, unknown>,
): Promise<AutonomousWorkflow | null> {
  const template = WORKFLOW_TEMPLATES.find((t) => t.type === templateType);
  if (!template) return null;
  try {
    const row = await db.workflow.create({
      data: {
        name: template.name,
        type: template.type,
        trigger: template.trigger,
        steps: JSON.stringify(template.steps),
        currentStep: 0,
        status: 'running',
        context: context ? JSON.stringify(context) : null,
        startedAt: new Date(),
      },
    });
    return rowToWorkflow(row);
  } catch (err) {
    console.warn('[Autonomous] startWorkflow failed:', err);
    return null;
  }
}
