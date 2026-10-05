// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Oracle Autonomous Actions — Static registry (Prisma-free)
// ═══════════════════════════════════════════════════════════════════════════════
// Static metadata + dryRun + executor function bodies for the Oracle action
// registry. This module is intentionally Prisma-free so it can be safely
// imported by client components. The Prisma-backed `createDoc` helper is
// injected at server-module load via `_createDocHolder` (see
// `./oracle-actions`). Client components never invoke executors — they POST
// to `/api/oracle/action` which routes through `executeOracleAction`.
// ═══════════════════════════════════════════════════════════════════════════════

import { COLLECTIONS } from '@/lib/firestore-schema';

export type OracleActionPermission = 'admin' | 'manager' | 'staff' | 'auto';

export interface OracleActionInputField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'select' | 'boolean' | 'textarea';
  required?: boolean;
  options?: { label: string; value: string }[];
  placeholder?: string;
}

export interface OracleAction {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  category: 'invoicing' | 'gst' | 'banking' | 'collections' | 'communication' | 'reporting' | 'tasks';
  permission: OracleActionPermission;
  inputSchema: OracleActionInputField[];
  executor: (input: Record<string, unknown>, ctx: ActionContext) => Promise<unknown>;
  dryRun: (input: Record<string, unknown>, ctx: ActionContext) => unknown;
}

export interface ActionContext {
  organizationId: string;
  userId: string;
  userEmail: string;
}

export interface ActionResult {
  success: boolean;
  output?: unknown;
  auditId: string;
  error?: string;
}

// ─── createDoc injection point ────────────────────────────────────────────────
// The executor function bodies below call `createDoc(...)` which writes to the
// DB. The real implementation is registered by `./oracle-actions` (server-only,
// imports Prisma) at module load. Until then, calls throw — but client
// components never invoke executors, so this is safe.
export type CreateDocFn = (
  collection: string,
  id: string,
  data: Record<string, unknown>,
) => Promise<void>;

export const _createDocHolder: { fn: CreateDocFn | null } = { fn: null };

async function createDoc(
  collection: string,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (!_createDocHolder.fn) {
    throw new Error('oracle-actions-defs: createDoc not registered (server module not loaded)');
  }
  await _createDocHolder.fn(collection, id, data);
}

// ─── The Action Registry ─────────────────────────────────────────────────────

export const ORACLE_ACTIONS: OracleAction[] = [
  {
    id: 'create-invoice',
    name: 'Create Invoice',
    description: 'Draft a new sales invoice in the invoices collection.',
    icon: 'FileText',
    category: 'invoicing',
    permission: 'manager',
    inputSchema: [
      { key: 'clientId', label: 'Client', type: 'string', required: true, placeholder: 'Client ID' },
      { key: 'invoiceNumber', label: 'Invoice Number', type: 'string', required: true },
      { key: 'totalAmount', label: 'Total Amount (₹)', type: 'number', required: true },
      { key: 'taxableValue', label: 'Taxable Value (₹)', type: 'number', required: true },
    ],
    dryRun: (input) => ({
      preview: {
        collection: 'invoices',
        clientId: input.clientId,
        invoiceNumber: input.invoiceNumber,
        totalAmount: input.totalAmount,
        status: 'draft',
        message: 'Would create a draft invoice ready for review.',
      },
    }),
    executor: async (input, ctx) => {
      const id = `inv_${Date.now()}`;
      await createDoc(COLLECTIONS.INVOICES, id, {
        invoiceId: id,
        firmId: null,
        organizationId: ctx.organizationId,
        clientId: input.clientId,
        documentId: null,
        invoiceNumber: input.invoiceNumber ?? `INV-${Date.now()}`,
        invoiceDate: new Date().toISOString().slice(0, 10),
        sellerGstin: '',
        buyerGstin: null,
        buyerName: null,
        invoiceType: 'sales',
        gstr1Section: 'b2b',
        taxableValue: Number(input.taxableValue ?? 0),
        cgst: 0, sgst: 0, igst: 0, cess: 0,
        totalAmount: Number(input.totalAmount ?? 0),
        hsnCode: null, reverseCharge: false, placeOfSupply: null,
        status: 'draft', matchStatus: 'unmatched', riskLevel: 'low', riskScore: 0,
        aiExplanation: 'Created by Oracle Autonomous Action', notes: null, period: null,
      });
      return { invoiceId: id, message: 'Invoice created as draft.' };
    },
  },
  {
    id: 'generate-report',
    name: 'Generate Report',
    description: 'Create a generated business report entry (e.g. P&L, AR aging).',
    icon: 'BarChart3',
    category: 'reporting',
    permission: 'staff',
    inputSchema: [
      { key: 'reportType', label: 'Report Type', type: 'select', required: true, options: [
        { label: 'Profit & Loss', value: 'pnl' },
        { label: 'Balance Sheet', value: 'balance_sheet' },
        { label: 'AR Aging', value: 'ar_aging' },
        { label: 'GST Summary', value: 'gst_summary' },
      ] },
      { key: 'period', label: 'Period (MM-YYYY)', type: 'string', required: true },
    ],
    dryRun: (input) => ({ preview: { reportType: input.reportType, period: input.period, status: 'draft' } }),
    executor: async (input, ctx) => {
      const id = `rpt_${Date.now()}`;
      await createDoc(COLLECTIONS.REPORTS, id, {
        reportId: id,
        firmId: null,
        organizationId: ctx.organizationId,
        clientId: null,
        reportType: input.reportType,
        period: input.period,
        status: 'draft',
        generatedBy: 'oracle',
        payload: null,
      });
      return { reportId: id, message: 'Report draft generated.' };
    },
  },
  {
    id: 'schedule-reminder',
    name: 'Schedule Reminder',
    description: 'Create a scheduled reminder task with a due date.',
    icon: 'Bell',
    category: 'tasks',
    permission: 'staff',
    inputSchema: [
      { key: 'title', label: 'Title', type: 'string', required: true },
      { key: 'dueDate', label: 'Due Date', type: 'date', required: true },
      { key: 'priority', label: 'Priority', type: 'select', options: [
        { label: 'Low', value: 'low' }, { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' }, { label: 'Critical', value: 'critical' },
      ] },
    ],
    dryRun: (input) => ({ preview: { title: input.title, dueDate: input.dueDate, priority: input.priority } }),
    executor: async (input, ctx) => {
      const id = `task_${Date.now()}`;
      await createDoc(COLLECTIONS.TASKS, id, {
        taskId: id,
        firmId: null,
        organizationId: ctx.organizationId,
        title: input.title,
        description: 'Scheduled by Oracle Autonomous Action',
        status: 'open',
        priority: input.priority ?? 'medium',
        assignedTo: null,
        clientId: null,
        dueDate: input.dueDate,
        tags: ['oracle', 'reminder'],
      });
      return { taskId: id, message: 'Reminder task scheduled.' };
    },
  },
  {
    id: 'prepare-gst-return',
    name: 'Prepare GST Return',
    description: 'Create a draft GSTR-1 or GSTR-3B return for a client.',
    icon: 'Receipt',
    category: 'gst',
    permission: 'manager',
    inputSchema: [
      { key: 'clientId', label: 'Client ID', type: 'string', required: true },
      { key: 'returnType', label: 'Return Type', type: 'select', required: true, options: [
        { label: 'GSTR-1', value: 'GSTR-1' }, { label: 'GSTR-3B', value: 'GSTR-3B' },
      ] },
      { key: 'period', label: 'Period (MM-YYYY)', type: 'string', required: true },
    ],
    dryRun: (input) => ({ preview: { returnType: input.returnType, period: input.period, status: 'draft' } }),
    executor: async (input, ctx) => {
      const id = `ret_${Date.now()}`;
      await createDoc(COLLECTIONS.RETURNS, id, {
        returnId: id,
        firmId: null,
        organizationId: ctx.organizationId,
        clientId: input.clientId,
        returnType: input.returnType,
        period: input.period,
        financialYear: '',
        status: 'draft',
        filedDate: null,
        acknowledgmentNumber: null,
        totalInvoices: 0, readyForFiling: 0, issuesFound: 0, criticalErrors: 0, warnings: 0,
        totalTaxableValue: 0, totalTax: 0, jsonPayload: null,
        assignedTo: null, reviewedBy: null,
      });
      return { returnId: id, message: 'GST return draft prepared.' };
    },
  },
  {
    id: 'generate-reconciliation-report',
    name: 'Generate Reconciliation Report',
    description: 'Create a reconciliation run record (e.g. GSTR-2B vs Purchase Register).',
    icon: 'GitCompareArrows',
    category: 'banking',
    permission: 'staff',
    inputSchema: [
      { key: 'clientId', label: 'Client ID', type: 'string', required: true },
      { key: 'period', label: 'Period', type: 'string', required: true },
      { key: 'sources', label: 'Sources', type: 'string', required: true, placeholder: 'GSTR-2B vs Purchase Register' },
    ],
    dryRun: (input) => ({ preview: { period: input.period, sources: input.sources } }),
    executor: async (input, ctx) => {
      const id = `recon_${Date.now()}`;
      await createDoc(COLLECTIONS.RECONCILIATIONS, id, {
        reconId: id,
        firmId: null,
        organizationId: ctx.organizationId,
        clientId: input.clientId,
        period: input.period,
        sources: input.sources,
        status: 'running',
        totalRecords: 0, matched: 0, unmatched: 0, partialMatches: 0, highRisk: 0, gstDifference: 0,
        mismatches: [],
        runBy: 'oracle',
      });
      return { reconId: id, message: 'Reconciliation run started.' };
    },
  },
  {
    id: 'create-payment-link',
    name: 'Create Payment Link',
    description: 'Generate a payment link record for an invoice.',
    icon: 'CreditCard',
    category: 'collections',
    permission: 'staff',
    inputSchema: [
      { key: 'clientId', label: 'Client ID', type: 'string', required: true },
      { key: 'invoiceId', label: 'Invoice ID', type: 'string', required: true },
      { key: 'amount', label: 'Amount (₹)', type: 'number', required: true },
    ],
    dryRun: (input) => ({ preview: { amount: input.amount, status: 'pending' } }),
    executor: async (input, ctx) => {
      const id = `pay_${Date.now()}`;
      await createDoc(COLLECTIONS.PAYMENTS, id, {
        paymentId: id,
        firmId: null,
        organizationId: ctx.organizationId,
        clientId: input.clientId,
        invoiceId: input.invoiceId,
        purchaseBillId: null,
        partyName: '',
        partyType: 'customer',
        amount: Number(input.amount ?? 0),
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentMode: 'link',
        referenceNo: `LINK-${id.slice(-6).toUpperCase()}`,
        status: 'pending',
        reconciled: false,
        notes: 'Generated by Oracle',
      });
      return { paymentId: id, linkRef: `LINK-${id.slice(-6).toUpperCase()}`, message: 'Payment link created.' };
    },
  },
  {
    id: 'assign-task',
    name: 'Assign Task',
    description: 'Create a task and assign it to a team member.',
    icon: 'UserPlus',
    category: 'tasks',
    permission: 'staff',
    inputSchema: [
      { key: 'title', label: 'Title', type: 'string', required: true },
      { key: 'assignedTo', label: 'Assignee UID', type: 'string', required: true },
      { key: 'dueDate', label: 'Due Date', type: 'date', required: true },
      { key: 'priority', label: 'Priority', type: 'select', options: [
        { label: 'Low', value: 'low' }, { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' }, { label: 'Critical', value: 'critical' },
      ] },
    ],
    dryRun: (input) => ({ preview: { title: input.title, assignedTo: input.assignedTo } }),
    executor: async (input, ctx) => {
      const id = `task_${Date.now()}`;
      await createDoc(COLLECTIONS.TASKS, id, {
        taskId: id,
        firmId: null,
        organizationId: ctx.organizationId,
        title: input.title,
        description: 'Assigned by Oracle Autonomous Action',
        status: 'open',
        priority: input.priority ?? 'medium',
        assignedTo: input.assignedTo,
        clientId: null,
        dueDate: input.dueDate,
        tags: ['oracle', 'assigned'],
      });
      return { taskId: id, message: 'Task assigned.' };
    },
  },
  {
    id: 'draft-email',
    name: 'Draft Email',
    description: 'Create a draft email communication record.',
    icon: 'Mail',
    category: 'communication',
    permission: 'auto',
    inputSchema: [
      { key: 'to', label: 'To', type: 'string', required: true },
      { key: 'subject', label: 'Subject', type: 'string', required: true },
      { key: 'body', label: 'Body', type: 'textarea', required: true },
    ],
    dryRun: (input) => ({ preview: { to: input.to, subject: input.subject, status: 'draft' } }),
    executor: async (input, ctx) => {
      const id = `comm_${Date.now()}`;
      await createDoc('communications', id, {
        commId: id,
        organizationId: ctx.organizationId,
        channel: 'email',
        direction: 'outbound',
        to: input.to,
        subject: input.subject,
        body: input.body,
        status: 'draft',
        createdBy: 'oracle',
        createdAt: new Date(),
      });
      return { commId: id, message: 'Email draft saved.' };
    },
  },
  {
    id: 'draft-whatsapp',
    name: 'Draft WhatsApp Message',
    description: 'Create a draft WhatsApp communication record.',
    icon: 'MessageCircle',
    category: 'communication',
    permission: 'auto',
    inputSchema: [
      { key: 'to', label: 'Phone', type: 'string', required: true, placeholder: '+91…' },
      { key: 'body', label: 'Message', type: 'textarea', required: true },
    ],
    dryRun: (input) => ({ preview: { to: input.to, status: 'draft' } }),
    executor: async (input, ctx) => {
      const id = `comm_${Date.now()}`;
      await createDoc('communications', id, {
        commId: id,
        organizationId: ctx.organizationId,
        channel: 'whatsapp',
        direction: 'outbound',
        to: input.to,
        body: input.body,
        status: 'draft',
        createdBy: 'oracle',
        createdAt: new Date(),
      });
      return { commId: id, message: 'WhatsApp draft saved.' };
    },
  },
  {
    id: 'generate-executive-summary',
    name: 'Generate Executive Summary',
    description: 'Create an executive summary report for leadership.',
    icon: 'Sparkles',
    category: 'reporting',
    permission: 'manager',
    inputSchema: [
      { key: 'period', label: 'Period (MM-YYYY)', type: 'string', required: true },
      { key: 'audience', label: 'Audience', type: 'select', options: [
        { label: 'CEO', value: 'ceo' }, { label: 'Board', value: 'board' }, { label: 'CA', value: 'ca' },
      ] },
    ],
    dryRun: (input) => ({ preview: { period: input.period, audience: input.audience } }),
    executor: async (input, ctx) => {
      const id = `sum_${Date.now()}`;
      await createDoc('executive_summaries', id, {
        summaryId: id,
        organizationId: ctx.organizationId,
        period: input.period,
        audience: input.audience ?? 'ceo',
        status: 'draft',
        generatedBy: 'oracle',
        createdAt: new Date(),
      });
      return { summaryId: id, message: 'Executive summary draft created.' };
    },
  },
];
