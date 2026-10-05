// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI CEO™ — AUTONOMOUS WORKFLOW ENGINE™
//
// Pre-approved workflow templates that Oracle executes once a decision is
// approved. Every workflow is:
//   • Non-destructive (all 8 templates)
//   • Step-by-step documented
//   • Role-gated
//   • Time-estimated
//
// 8 workflow types:
//   send_reminder, generate_invoice, schedule_meeting, create_follow_up,
//   generate_report, send_proposal, create_quotation, assign_task
//
// `executeWorkflow` simulates execution: returns 'completed' for benign
// workflows, 'awaiting_approval' for those that need an approval cycle.
// Real execution (sending emails, generating PDFs) is wired by the
// integration layer after approval.
//
// Tagline: GSTPilot AI CEO™ — Run Your Business. Not Your Software.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  AutonomousWorkflow,
  WorkflowType,
  WorkflowExecutionResult,
} from './types';
import type { CEODataView } from './data';

// ─── Workflow templates (8 types, all non-destructive) ───────────────────────

export const WORKFLOW_TEMPLATES: AutonomousWorkflow[] = [
  {
    type: 'send_reminder',
    label: 'Send Payment Reminder',
    description: 'Send a polite, branded payment-reminder email to a client with an invoice attached and a payment link.',
    destructive: false,
    steps: [
      'Load invoice + client context from the Business Graph',
      'Compose reminder email with invoice PDF + UPI/payment link',
      'Send via the connected email channel (Gmail/Outlook)',
      'Log activity to the timeline and mark reminder-sent timestamp',
    ],
    requiresApproval: 'none',
    requiresRole: 'employee',
    estimatedMinutes: 2,
  },
  {
    type: 'generate_invoice',
    label: 'Generate Invoice',
    description: 'Auto-generate a GST-compliant invoice from a recurring template or a delivered-work record.',
    destructive: false,
    steps: [
      'Load invoice template or work-delivery record',
      'Compute taxable value, CGST/SGST/IGST, and total',
      'Generate invoice PDF with GSTIN, HSN/SAC, and QR code',
      'Persist to DB and notify the client over email',
    ],
    requiresApproval: 'notify',
    requiresRole: 'employee',
    estimatedMinutes: 3,
  },
  {
    type: 'schedule_meeting',
    label: 'Schedule Meeting',
    description: 'Send a calendar invite to a client for a quarterly review, demo, or check-in.',
    destructive: false,
    steps: [
      'Find a 30-min slot in the next 7 days',
      'Send calendar invite via the connected calendar',
      'Send a WhatsApp / email heads-up to the client',
      'Create a follow-up task in the task engine',
    ],
    requiresApproval: 'none',
    requiresRole: 'employee',
    estimatedMinutes: 2,
  },
  {
    type: 'create_follow_up',
    label: 'Create Follow-Up Task',
    description: 'Create a follow-up task assigned to the right agent based on a recent event (lead, inquiry, meeting).',
    destructive: false,
    steps: [
      'Identify the follow-up subject and owner',
      'Set deadline based on event type (inquiry → 1d, lead → 3d, meeting → 7d)',
      'Create task in the Autonomous Task Engine',
      'Notify the assigned owner',
    ],
    requiresApproval: 'none',
    requiresRole: 'employee',
    estimatedMinutes: 1,
  },
  {
    type: 'generate_report',
    label: 'Generate Report',
    description: 'Compile a structured business report (board, GST, finance, collections) as a PDF.',
    destructive: false,
    steps: [
      'Pull the latest CEODataView snapshot',
      'Run the relevant report builder (board-report, finance, GST)',
      'Render the report as PDF using the PDF skill',
      'Store in the reports library and notify stakeholders',
    ],
    requiresApproval: 'none',
    requiresRole: 'employee',
    estimatedMinutes: 5,
  },
  {
    type: 'send_proposal',
    label: 'Send Proposal',
    description: 'Send a sales proposal to a lead or existing client with scope, pricing, and T&Cs.',
    destructive: false,
    steps: [
      'Load the lead/client profile and past interactions',
      'Generate proposal scope, pricing, and timeline',
      'Render proposal PDF with branding',
      'Email proposal and create follow-up task',
    ],
    requiresApproval: 'manager',
    requiresRole: 'manager',
    estimatedMinutes: 10,
  },
  {
    type: 'create_quotation',
    label: 'Create Quotation',
    description: 'Generate a formal quotation in response to a customer inquiry, with line items and GST.',
    destructive: false,
    steps: [
      'Parse the customer inquiry to extract requirements',
      'Compute line items, HSN/SAC, GST, and total',
      'Generate quotation PDF with validity period',
      'Email quotation and track open status',
    ],
    requiresApproval: 'none',
    requiresRole: 'employee',
    estimatedMinutes: 5,
  },
  {
    type: 'assign_task',
    label: 'Assign Task',
    description: 'Assign an existing task to a specific team member or AI agent with a deadline and priority.',
    destructive: false,
    steps: [
      'Load the task context from the task engine',
      'Resolve the right owner based on task type and team availability',
      'Set deadline and priority',
      'Notify the assignee and log to timeline',
    ],
    requiresApproval: 'none',
    requiresRole: 'employee',
    estimatedMinutes: 1,
  },
];

// ─── Template lookup ─────────────────────────────────────────────────────────

const TEMPLATE_BY_TYPE: Record<WorkflowType, AutonomousWorkflow> = WORKFLOW_TEMPLATES.reduce(
  (acc, t) => {
    acc[t.type] = t;
    return acc;
  },
  {} as Record<WorkflowType, AutonomousWorkflow>,
);

// ─── Executor ────────────────────────────────────────────────────────────────

/**
 * Execute (or queue for approval) a workflow tied to an approved decision.
 *
 * - Benign workflows (requiresApproval === 'none') complete immediately with
 *   simulated outputs (real side-effects are wired by the integration layer).
 * - Anything that requires manager / cfo / ceo sign-off returns
 *   'awaiting_approval' so the approval flow can collect sign-offs first.
 */
export async function executeWorkflow(
  type: WorkflowType,
  decisionId: string,
  data: CEODataView,
): Promise<WorkflowExecutionResult> {
  const template = TEMPLATE_BY_TYPE[type];
  const startedAt = new Date().toISOString();

  if (!template) {
    return {
      workflowType: type,
      decisionId,
      status: 'failed',
      message: `Unknown workflow type: ${type}`,
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }

  // Any workflow requiring more than 'none' / 'notify' must go through approval
  const requiresApproval = template.requiresApproval !== 'none' && template.requiresApproval !== 'notify';

  try {
    if (requiresApproval) {
      return {
        workflowType: type,
        decisionId,
        status: 'awaiting_approval',
        message: `Workflow "${template.label}" requires ${template.requiresApproval} approval before execution. The approval flow will trigger this workflow automatically once signed off.`,
        startedAt,
        outputs: {
          requiresApproval: template.requiresApproval,
          requiresRole: template.requiresRole,
          estimatedMinutes: template.estimatedMinutes,
          steps: template.steps,
        },
      };
    }

    // Benign workflow — simulate completion with descriptive outputs.
    const outputs = buildSimulatedOutputs(type, data);
    return {
      workflowType: type,
      decisionId,
      status: 'completed',
      message: `Workflow "${template.label}" executed successfully. ${template.estimatedMinutes} min estimated. ${outputs.summary ?? ''}`.trim(),
      startedAt,
      completedAt: new Date().toISOString(),
      outputs,
    };
  } catch (err) {
    return {
      workflowType: type,
      decisionId,
      status: 'failed',
      message: `Workflow execution failed: ${err instanceof Error ? err.message : String(err)}`,
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }
}

// ─── Per-workflow simulated outputs ──────────────────────────────────────────

function buildSimulatedOutputs(
  type: WorkflowType,
  data: CEODataView,
): Record<string, unknown> & { summary?: string } {
  switch (type) {
    case 'send_reminder': {
      const top = data.cfo.collections.latePayments[0] ?? null;
      return {
        summary: top
          ? `Reminder queued for ${top.clientName} (invoice ${top.invoiceNumber}).`
          : 'No overdue invoices found; reminder skipped.',
        recipient: top?.clientName ?? null,
        invoiceNumber: top?.invoiceNumber ?? null,
        channel: 'email',
      };
    }
    case 'generate_invoice': {
      const recurring = data.raw.invoices.find((i) => i.recurring);
      return {
        summary: recurring
          ? `Invoice generated for ${recurring.buyerName ?? 'client'} (${recurring.invoiceNumber} template).`
          : 'No recurring template; invoice skipped.',
        invoiceNumber: recurring?.invoiceNumber ?? null,
        amount: recurring?.totalAmount ?? 0,
      };
    }
    case 'schedule_meeting': {
      const topClient = data.cfo.revenue.topClients[0] ?? null;
      return {
        summary: topClient
          ? `Calendar invite queued for ${topClient.name}.`
          : 'No client identified for meeting.',
        attendee: topClient?.name ?? null,
        durationMinutes: 30,
      };
    }
    case 'create_follow_up': {
      const count = data.raw.syncedRecords.filter(
        (r) => r.sourceType === 'whatsapp_msg' || r.sourceType === 'email',
      ).length;
      return {
        summary: `${count} follow-up task(s) created for unhandled inquiries.`,
        taskCount: count,
        owner: 'oracle',
      };
    }
    case 'generate_report': {
      return {
        summary: 'Board report compiled from live CFO + Twin snapshot.',
        reportType: 'board',
        period: new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
        healthScore: data.liveState.healthScore,
      };
    }
    case 'send_proposal': {
      const target = data.cfo.revenue.byClient.find((c) => c.trend === 'down');
      return {
        summary: target
          ? `Proposal queued for ${target.clientName}.`
          : 'No declining client identified; proposal skipped.',
        recipient: target?.clientName ?? null,
        proposalType: 'expansion',
      };
    }
    case 'create_quotation': {
      const inquiry = data.raw.syncedRecords.find(
        (r) => (r.sourceType === 'whatsapp_msg' || r.sourceType === 'email') && r.amount && r.amount > 0,
      );
      return {
        summary: inquiry
          ? `Quotation generated for inquiry "${inquiry.title ?? ''}" (${inquiry.amount}).`
          : 'No qualified inquiry found; quotation skipped.',
        inquiryId: inquiry?.id ?? null,
        amount: inquiry?.amount ?? 0,
      };
    }
    case 'assign_task': {
      const overdueCount = data.cfo.collections.overdueCount;
      return {
        summary: `Task routed to collection_agent for ${overdueCount} overdue invoice(s).`,
        assignedTo: 'collection_agent',
        taskCount: overdueCount,
      };
    }
    default:
      return { summary: 'Workflow executed.' };
  }
}
