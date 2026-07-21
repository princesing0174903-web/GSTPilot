// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Workflow Engine: Pre-built Templates
// ═══════════════════════════════════════════════════════════════════════════════
//
// Pre-built workflow templates that chain existing Action Engine actions into
// complete business tasks. Each template is a factory: given the args the LLM
// extracted from the user's message, it returns a fully-formed WorkflowPlan.
//
// Every step references a REGISTERED Action Engine action — no business logic is
// duplicated here. The executor calls executeAndRefresh() for each step, which
// runs the same validate → execute → refresh pipeline as a single-action
// confirmation. Audit logs, graph events, timeline events, and activity logs
// all fire identically to a UI button click.
//
// Template variables in step.args (e.g. `{{createInvoice.data.invoiceId}}`) are
// resolved by the executor against prior step outputs before each step runs.
//
// Templates cover the five canonical workflow categories from the spec:
//   SALES   — create customer → create invoice → generate PDF → email → reminder
//   PAYMENT — record payment → update invoice status → update receivables → refresh
//   GST     — validate invoices → generate GSTR-1 → show summary → (file: future)
//   CRM     — add lead → schedule follow-up → create reminder → update pipeline
//   REPORTS — generate report → export PDF → save document → email report
// ═══════════════════════════════════════════════════════════════════════════════

import type { WorkflowPlan, WorkflowStep, WorkflowCategory, WorkflowRiskLevel } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genWorkflowId(): string {
  return `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Estimate total seconds from step count (each action ~3s on average). */
function estimate(steps: WorkflowStep[]): number {
  return Math.max(5, steps.length * 4);
}

// ─── Template registry type ───────────────────────────────────────────────────

export interface WorkflowTemplate {
  id: string;
  category: WorkflowCategory;
  /** Human title for the template picker. */
  name: string;
  /** What this workflow does. */
  description: string;
  /** Keywords/phrases that signal this template (regex, case-insensitive). */
  triggers: RegExp[];
  /** Does this template require user confirmation before execution? */
  requiresConfirmation: boolean;
  riskLevel: WorkflowRiskLevel;
  /** Factory: extracted args → WorkflowPlan. Returns null if args are insufficient. */
  build: (args: Record<string, any>, message: string) => WorkflowPlan | null;
  /** Validate the extracted args — returns missing required fields. */
  validateArgs?: (args: Record<string, any>) => string[];
}

// ─── 1. SALES: Create Invoice + Email + Schedule Reminder ─────────────────────

const salesInvoiceAndEmailTemplate: WorkflowTemplate = {
  id: 'sales.invoiceAndEmail',
  category: 'sales',
  name: 'Create Invoice & Email Customer',
  description: 'Create a sales invoice, email it to the customer, and schedule a payment reminder.',
  triggers: [
    /create.*invoice.*(\band\b|&|then|also).*(email|send|mail)/i,
    /invoice.*(and|&)\s*(email|send)/i,
    /send.*invoice.*to.*(customer|client)/i,
    /bill.*(and|&)\s*(email|send)/i,
  ],
  requiresConfirmation: true,
  riskLevel: 'medium',
  validateArgs(args) {
    const missing: string[] = [];
    if (!args.customerName) missing.push('customerName');
    if (!Array.isArray(args.items) || args.items.length === 0) missing.push('items');
    return missing;
  },
  build(args, message) {
    const customerName = String(args.customerName ?? '').trim();
    const items = Array.isArray(args.items) ? args.items : [];
    if (!customerName || items.length === 0) return null;

    const steps: WorkflowStep[] = [
      {
        id: 'createInvoice',
        actionName: 'createInvoice',
        label: 'Create invoice',
        description: `Create a new sales invoice for ${customerName}. (Customer is auto-created if not found.)`,
        args: {
          customerName,
          items,
          invoiceDate: args.invoiceDate,
          dueDate: args.dueDate,
          notes: args.notes,
        },
        critical: true,
        // If email fails downstream, undo the invoice creation so we don't
        // leave a draft invoice that was never sent.
        rollback: {
          actionName: 'deleteInvoice',
          args: { id: '{{createInvoice.data.invoiceId}}' },
        },
      },
      {
        id: 'sendInvoice',
        actionName: 'sendInvoice',
        label: 'Email invoice to customer',
        description: 'Mark the invoice as sent and deliver it via email.',
        args: {
          id: '{{createInvoice.data.invoiceId}}',
          channel: 'email',
        },
        critical: false, // invoice still created if email fails — report partial
      },
      {
        id: 'scheduleReminder',
        actionName: 'scheduleFollowUp',
        label: 'Schedule payment reminder',
        description: 'Create a follow-up task to remind the customer about payment.',
        args: {
          partyName: customerName,
          channel: 'email',
          daysFromNow: args.reminderDays ?? 7,
          subject: `Payment reminder — invoice {{createInvoice.data.invoiceNumber}}`,
          notes: 'Automated reminder scheduled by Oracle Workflow Engine.',
        },
        critical: false,
      },
    ];

    return {
      id: genWorkflowId(),
      templateId: 'sales.invoiceAndEmail',
      title: `Create invoice for ${customerName} and email it`,
      description: `Creates a sales invoice, emails it to ${customerName}, and schedules a payment reminder in ${args.reminderDays ?? 7} days.`,
      category: 'sales',
      steps,
      riskLevel: 'medium',
      requiresConfirmation: true,
      estimatedSeconds: estimate(steps),
      sourceMessage: message,
      createdAt: nowIso(),
    };
  },
};

// ─── 2. SALES: Quote → Invoice (lightweight) ──────────────────────────────────

const salesQuickInvoiceTemplate: WorkflowTemplate = {
  id: 'sales.quickInvoice',
  category: 'sales',
  name: 'Quick Invoice',
  description: 'Create a single-item invoice for a customer in one step.',
  triggers: [
    /\bquick\s+invoice\b/i,
    /\bsimple\s+invoice\b/i,
    /invoice\s+(?:for|to)\s+\S+\s+(?:for\s+)?₹?\s*\d/i,
  ],
  requiresConfirmation: true,
  riskLevel: 'medium',
  build(args, message) {
    const customerName = String(args.customerName ?? '').trim();
    const amount = Number(args.amount ?? 0);
    const description = String(args.description ?? args.itemName ?? 'Services');
    const gstRate = Number(args.gstRate ?? 18);
    if (!customerName || amount <= 0) return null;

    const steps: WorkflowStep[] = [
      {
        id: 'createInvoice',
        actionName: 'createInvoice',
        label: 'Create invoice',
        description: `Create a ${gstRate}% GST invoice for ${customerName}.`,
        args: {
          customerName,
          items: [{ name: description, quantity: 1, rate: amount, gstRate }],
        },
        critical: true,
        rollback: {
          actionName: 'deleteInvoice',
          args: { id: '{{createInvoice.data.invoiceId}}' },
        },
      },
    ];

    return {
      id: genWorkflowId(),
      templateId: 'sales.quickInvoice',
      title: `Create invoice for ${customerName} — ₹${amount}`,
      description: `Creates a single-item ${gstRate}% GST invoice for ${customerName}.`,
      category: 'sales',
      steps,
      riskLevel: 'medium',
      requiresConfirmation: true,
      estimatedSeconds: estimate(steps),
      sourceMessage: message,
      createdAt: nowIso(),
    };
  },
};

// ─── 3. PAYMENT: Record Payment → Mark Invoice Paid → Refresh ─────────────────

const paymentRecordAndSettleTemplate: WorkflowTemplate = {
  id: 'payment.recordAndSettle',
  category: 'payment',
  name: 'Record Payment & Settle Invoice',
  description: 'Record a customer payment, mark the linked invoice as paid, and refresh receivables.',
  triggers: [
    /record\s+\w*\s*payment.*(?:\band\b|&|then).*(?:mark|settle|paid)/i,
    /payment\s+received.*mark.*paid/i,
    /settle\s+invoice.*payment/i,
    /record\s+payment.*\band\b.*(?:mark|settle)/i,
  ],
  requiresConfirmation: true,
  riskLevel: 'medium',
  build(args, message) {
    const customerName = String(args.customerName ?? args.partyName ?? '').trim();
    const amount = Number(args.amount ?? 0);
    const invoiceNumber = String(args.invoiceNumber ?? '').trim();
    const paymentMode = String(args.paymentMode ?? args.mode ?? 'upi');
    if (!customerName || amount <= 0) return null;

    const steps: WorkflowStep[] = [
      {
        id: 'recordPayment',
        actionName: 'recordPayment',
        label: 'Record payment',
        description: `Record a ${paymentMode} payment of ₹${amount} from ${customerName}.`,
        args: {
          partyName: customerName,
          partyType: 'customer',
          amount,
          paymentMode,
          invoiceNumber: invoiceNumber || undefined,
          date: args.date,
        },
        critical: true,
      },
      {
        id: 'markInvoicePaid',
        actionName: 'markInvoicePaid',
        label: 'Mark invoice as paid',
        description: 'Update the linked invoice status to fully paid.',
        args: {
          invoiceNumber: invoiceNumber || '{{recordPayment.data.invoiceNumber}}',
          paymentMode,
          amount,
        },
        critical: false, // payment recorded even if invoice-status update fails
      },
    ];

    return {
      id: genWorkflowId(),
      templateId: 'payment.recordAndSettle',
      title: `Record payment of ₹${amount} from ${customerName} and settle invoice`,
      description: `Records the payment and marks invoice ${invoiceNumber || '(linked)'} as paid.`,
      category: 'payment',
      steps,
      riskLevel: 'medium',
      requiresConfirmation: true,
      estimatedSeconds: estimate(steps),
      sourceMessage: message,
      createdAt: nowIso(),
    };
  },
};

// ─── 4. GST: Validate + Generate GSTR-3B + Show Summary ───────────────────────

const gstPrepareFilingTemplate: WorkflowTemplate = {
  id: 'gst.prepareFiling',
  category: 'gst',
  name: 'Prepare GST Filing',
  description: 'Prepare the GSTR-3B return for the current period and show the tax liability summary.',
  triggers: [
    /prepare\s+(?:my\s+)?(?:gst|gstr|return)/i,
    /file\s+gstr/i,
    /gst\s+(?:filing|return).*prepare/i,
    /generate\s+(?:gst|gstr-?3b)/i,
  ],
  requiresConfirmation: true,
  riskLevel: 'high',
  build(args, message) {
    const period = String(args.period ?? '').trim() || new Date().toISOString().slice(0, 7); // YYYY-MM
    const steps: WorkflowStep[] = [
      {
        id: 'prepareGstr3b',
        actionName: 'prepareGstr3b',
        label: 'Prepare GSTR-3B',
        description: `Compute the GSTR-3B draft for period ${period} (output tax, ITC, net liability).`,
        args: { period },
        critical: true,
      },
      // NOTE: The actual "file return" step is intentionally NOT included —
      // GST filing is a non-reversible statutory action. Oracle prepares the
      // return and shows the summary; the user must file manually from the
      // Returns page (future: a fileGstr action with extra confirmation).
    ];

    return {
      id: genWorkflowId(),
      templateId: 'gst.prepareFiling',
      title: `Prepare GSTR-3B for ${period}`,
      description: 'Computes the GSTR-3B draft (output tax, ITC, net liability) for review. Filing is done manually from the Returns page.',
      category: 'gst',
      steps,
      riskLevel: 'high',
      requiresConfirmation: true,
      estimatedSeconds: estimate(steps),
      sourceMessage: message,
      createdAt: nowIso(),
    };
  },
};

// ─── 5. CRM: Add Lead → Schedule Follow-up → Create Task ──────────────────────

const crmNewLeadTemplate: WorkflowTemplate = {
  id: 'crm.newLeadFollowUp',
  category: 'crm',
  name: 'Add Lead & Schedule Follow-up',
  description: 'Add a new CRM lead, schedule a follow-up call, and create a reminder task.',
  triggers: [
    /add\s+(?:a\s+)?(?:new\s+)?lead.*(\band\b|&|then).*(?:follow|reminder|schedule)/i,
    /new\s+lead.*follow\s*up/i,
    /create\s+lead.*schedule/i,
  ],
  requiresConfirmation: true,
  riskLevel: 'low',
  build(args, message) {
    const leadName = String(args.name ?? args.leadName ?? args.customerName ?? '').trim();
    const source = String(args.source ?? 'website');
    const value = Number(args.value ?? 0);
    const followUpDays = Number(args.followUpDays ?? args.daysFromNow ?? 3);
    if (!leadName) return null;

    const steps: WorkflowStep[] = [
      {
        id: 'addLead',
        actionName: 'addCrmLead',
        label: 'Add CRM lead',
        description: `Create a new lead "${leadName}" from ${source}.`,
        args: {
          name: leadName,
          email: args.email,
          phone: args.phone,
          source,
          value,
          notes: args.notes,
        },
        critical: true,
        rollback: {
          actionName: 'deleteCustomer',
          args: { id: '{{addLead.data.leadId}}' },
        },
      },
      {
        id: 'scheduleFollowUp',
        actionName: 'scheduleFollowUp',
        label: 'Schedule follow-up',
        description: `Schedule a follow-up call with ${leadName} in ${followUpDays} days.`,
        args: {
          partyName: leadName,
          channel: 'call',
          daysFromNow: followUpDays,
          subject: `Follow-up call with ${leadName}`,
          notes: 'Initial follow-up scheduled by Oracle Workflow Engine.',
        },
        critical: false,
      },
      {
        id: 'createReminderTask',
        actionName: 'createTask',
        label: 'Create reminder task',
        description: 'Create a task reminder for the follow-up.',
        args: {
          title: `Follow up with ${leadName}`,
          priority: 'medium',
          dueDate: `{{scheduleFollowUp.data.dueDate}}`,
          description: 'Reminder to follow up with new lead.',
        },
        critical: false,
      },
    ];

    return {
      id: genWorkflowId(),
      templateId: 'crm.newLeadFollowUp',
      title: `Add lead ${leadName} and schedule follow-up`,
      description: `Creates the lead, schedules a follow-up in ${followUpDays} days, and creates a reminder task.`,
      category: 'crm',
      steps,
      riskLevel: 'low',
      requiresConfirmation: true,
      estimatedSeconds: estimate(steps),
      sourceMessage: message,
      createdAt: nowIso(),
    };
  },
};

// ─── 6. REPORTS: Generate + Export ────────────────────────────────────────────

const reportsGenerateAndExportTemplate: WorkflowTemplate = {
  id: 'reports.generateAndExport',
  category: 'reports',
  name: 'Generate & Export Report',
  description: 'Generate a financial report and export it as a downloadable document.',
  triggers: [
    /generate\s+.*report.*(\band\b|&|then).*(?:export|download|save)/i,
    /export\s+(?:report|p&l|profit|balance)/i,
    /download\s+(?:report|statement)/i,
  ],
  requiresConfirmation: true,
  riskLevel: 'low',
  build(args, message) {
    const reportType = String(args.reportType ?? args.type ?? 'profit_loss');
    const format = String(args.format ?? 'pdf');
    const steps: WorkflowStep[] = [
      {
        id: 'generateReport',
        actionName: 'generateReport',
        label: 'Generate report',
        description: `Generate the ${reportType} report from live business data.`,
        args: { reportType, period: args.period },
        critical: true,
      },
      {
        id: 'exportReport',
        actionName: 'exportReport',
        label: `Export as ${format.toUpperCase()}`,
        description: `Export the generated report in ${format.toUpperCase()} format.`,
        args: { reportType, format, period: args.period },
        critical: false,
      },
    ];

    return {
      id: genWorkflowId(),
      templateId: 'reports.generateAndExport',
      title: `Generate ${reportType} report and export as ${format.toUpperCase()}`,
      description: `Generates the ${reportType} report and exports it in ${format.toUpperCase()} format.`,
      category: 'reports',
      steps,
      riskLevel: 'low',
      requiresConfirmation: true,
      estimatedSeconds: estimate(steps),
      sourceMessage: message,
      createdAt: nowIso(),
    };
  },
};

// ─── 7. BANKING: Import → Categorize → Reconcile → Report ─────────────────────

const bankingImportAndReconcileTemplate: WorkflowTemplate = {
  id: 'banking.importAndReconcile',
  category: 'banking',
  name: 'Import Statement → Categorize → Reconcile → Report',
  description: 'Import a bank statement, AI-categorize every row, auto-reconcile against invoices/payments/expenses, then generate a cash report.',
  triggers: [
    /import.*statement.*reconcile/i,
    /reconcile.*import/i,
    /import.*bank.*categorize/i,
    /statement.*import.*report/i,
  ],
  requiresConfirmation: true,
  riskLevel: 'medium',
  validateArgs(args) {
    const missing: string[] = [];
    if (!args.format) missing.push('format');
    if (!args.rawContent) missing.push('rawContent');
    if (!args.accountId) missing.push('accountId');
    return missing;
  },
  build(args, message) {
    const format = String(args.format ?? '').toLowerCase();
    const rawContent = String(args.rawContent ?? '');
    const accountId = String(args.accountId ?? '').trim();
    if (!format || !rawContent || !accountId) return null;

    const steps: WorkflowStep[] = [
      {
        id: 'importStatement',
        actionName: 'importStatement',
        label: 'Import statement',
        description: `Import the ${format.toUpperCase()} statement into account ${accountId}. Oracle parses the rows and AI-categorizes each one before commit.`,
        args: { format, rawContent, accountId },
        critical: true,
      },
      {
        id: 'categorizeTransactions',
        actionName: 'categorizeTransactions',
        label: 'Categorize transactions',
        description: `Re-apply all active categorization rules across every transaction (including the {{importStatement.data.importedCount}} just imported). Existing explicit categories are preserved.`,
        args: { mode: 'rules' },
        critical: false,
      },
      {
        id: 'reconcileTransactions',
        actionName: 'reconcileTransactions',
        label: 'Reconcile all',
        description: 'Auto-reconcile every unreconciled transaction against invoices, payments, and expenses by amount + date + counterparty.',
        args: { mode: 'all' },
        critical: false,
      },
      {
        id: 'generateCashReport',
        actionName: 'generateCashReport',
        label: 'Generate cash report',
        description: 'Generate a 30-day cash report (inflow, outflow, net, top categories, reconciled %) so the user can see the impact of the import at a glance.',
        args: { period: '30d' },
        critical: false,
      },
    ];

    return {
      id: genWorkflowId(),
      templateId: 'banking.importAndReconcile',
      title: `Import ${format.toUpperCase()} statement and reconcile everything`,
      description: `Imports the statement into account ${accountId}, re-categorizes, auto-reconciles, and generates a 30-day cash report.`,
      category: 'banking',
      steps,
      riskLevel: 'medium',
      requiresConfirmation: true,
      estimatedSeconds: estimate(steps),
      sourceMessage: message,
      createdAt: nowIso(),
    };
  },
};

// ─── 8. CUSTOM: Generic multi-action (built by the LLM planner) ───────────────
// This is not a template per se — it's the shape the LLM planner emits when no
// template matches. Exported here so the planner can build a custom plan.

export function buildCustomPlan(
  title: string,
  description: string,
  steps: WorkflowStep[],
  message: string,
  riskLevel: WorkflowRiskLevel = 'medium',
): WorkflowPlan {
  return {
    id: genWorkflowId(),
    templateId: 'custom',
    title,
    description,
    category: 'custom',
    steps,
    riskLevel,
    requiresConfirmation: true,
    estimatedSeconds: estimate(steps),
    sourceMessage: message,
    createdAt: nowIso(),
  };
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  salesInvoiceAndEmailTemplate,
  salesQuickInvoiceTemplate,
  paymentRecordAndSettleTemplate,
  gstPrepareFilingTemplate,
  crmNewLeadTemplate,
  reportsGenerateAndExportTemplate,
  bankingImportAndReconcileTemplate,
];

/**
 * Try to match a user message against a known workflow template.
 * Returns the first template whose trigger regex matches, or null.
 */
export function matchTemplate(message: string): WorkflowTemplate | null {
  if (!message) return null;
  for (const tpl of WORKFLOW_TEMPLATES) {
    for (const re of tpl.triggers) {
      if (re.test(message)) return tpl;
    }
  }
  return null;
}

/** Get a template by id. */
export function getTemplate(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find(t => t.id === id);
}

/** List all template ids + names (for the UI / system prompt). */
export function listTemplateSummaries(): Array<{ id: string; name: string; description: string; category: WorkflowCategory }> {
  return WORKFLOW_TEMPLATES.map(t => ({ id: t.id, name: t.name, description: t.description, category: t.category }));
}
