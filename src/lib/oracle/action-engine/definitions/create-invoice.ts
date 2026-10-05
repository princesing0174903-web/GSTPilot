// ═══════════════════════════════════════════════════════════════════════════════
// Action: Create Invoice
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { findOrCreateCustomer, createInvoice as createInvoiceService } from '@/lib/services';
import {
  registerAction,
  inr,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
  type RefreshedContext,
} from '../registry';

interface InvoiceItemInput {
  name?: string;
  description?: string;
  quantity?: number;
  rate?: number;
  unitPrice?: number;
  gstRate?: number;
  hsnCode?: string;
  unit?: string;
}

export const createInvoiceAction: OracleAction = {
  name: 'createInvoice',
  displayName: 'Create Invoice',
  description: 'Create a new sales invoice for a customer with line items, GST, and due date.',
  category: 'finance',
  icon: 'FileText',
  intentKeywords: [
    'create invoice', 'generate invoice', 'make invoice', 'new invoice',
    'raise invoice', 'bill customer', 'send invoice',
  ],
  paramSchema: [
    { key: 'customerName', label: 'Customer', type: 'string', required: true, description: 'Customer name' },
    { key: 'items', label: 'Line Items', type: 'array', required: true, description: 'Array of {name, quantity, rate, gstRate}' },
    { key: 'invoiceDate', label: 'Invoice Date', type: 'date', required: false, description: 'ISO date (default: today)' },
    { key: 'dueDate', label: 'Due Date', type: 'date', required: false, description: 'ISO date (default: +15 days)' },
    { key: 'notes', label: 'Notes', type: 'string', required: false, description: 'Invoice notes' },
  ],

  async validate(args, orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    // Customer
    const customerName = String(args.customerName ?? '').trim();
    if (!customerName) {
      fields.push({ key: 'customerName', label: 'Customer', status: 'error', message: 'Customer name is required' });
      errors.push('Customer name is required.');
    } else {
      const existing = await db.client.findFirst({
        where: { firmId: orgId, tradeName: { equals: customerName } },
        select: { id: true, tradeName: true, gstin: true, state: true },
      }).catch(() => null);
      if (existing) {
        fields.push({ key: 'customerName', label: 'Customer', status: 'ok', message: `Found in your records`, resolvedValue: existing.tradeName });
        resolvedRefs.clientId = existing.id;
        resolvedRefs.clientGstin = existing.gstin;
        resolvedRefs.clientState = existing.state;
      } else {
        fields.push({ key: 'customerName', label: 'Customer', status: 'warn', message: `Will be created as a new customer`, resolvedValue: customerName });
        warnings.push(`A new customer "${customerName}" will be created.`);
      }
    }

    // Items
    const items = Array.isArray(args.items) ? args.items : [];
    if (items.length === 0) {
      fields.push({ key: 'items', label: 'Line Items', status: 'error', message: 'At least one line item is required' });
      errors.push('At least one line item is required.');
    } else {
      let totalTaxable = 0;
      let totalTax = 0;
      let allValid = true;
      for (const it of items as InvoiceItemInput[]) {
        const qty = Number(it.quantity ?? 1);
        const rate = Number(it.rate ?? it.unitPrice ?? 0);
        const gstRate = Number(it.gstRate ?? 18);
        if (!it.name && !it.description) { allValid = false; continue; }
        if (rate <= 0) { allValid = false; continue; }
        totalTaxable += qty * rate;
        totalTax += qty * rate * (gstRate / 100);
      }
      if (!allValid) {
        fields.push({ key: 'items', label: 'Line Items', status: 'error', message: 'Some items are missing name or rate' });
        errors.push('Each line item needs a name and a positive rate.');
      } else {
        const grandTotal = totalTaxable + totalTax;
        fields.push({
          key: 'items',
          label: 'Line Items',
          status: 'ok',
          message: `${items.length} item(s), taxable ${inr(totalTaxable)}, GST ${inr(totalTax)}`,
          resolvedValue: inr(grandTotal),
        });
        resolvedRefs.computedTaxable = totalTaxable;
        resolvedRefs.computedTax = totalTax;
        resolvedRefs.computedTotal = grandTotal;
      }
    }

    // Dates
    const today = new Date().toISOString().slice(0, 10);
    const invoiceDate = args.invoiceDate ? String(args.invoiceDate) : today;
    const dueDate = args.dueDate
      ? String(args.dueDate)
      : new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
    fields.push({ key: 'invoiceDate', label: 'Invoice Date', status: 'ok', resolvedValue: invoiceDate });
    fields.push({ key: 'dueDate', label: 'Due Date', status: 'ok', resolvedValue: dueDate });

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const customerName = String(args.customerName ?? '').trim() || '—';
    const items = Array.isArray(args.items) ? args.items : [];
    const refs = validation.resolvedRefs ?? {};
    const taxable = refs.computedTaxable ?? 0;
    const tax = refs.computedTax ?? 0;
    const total = refs.computedTotal ?? 0;
    const itemSummary = items.length === 0
      ? 'No items'
      : items.map((it: InvoiceItemInput) => `${it.name ?? 'Item'} ×${Number(it.quantity ?? 1)} @ ${inr(Number(it.rate ?? 0))}`).join('; ');
    const invoiceDate = args.invoiceDate ? String(args.invoiceDate) : new Date().toISOString().slice(0, 10);
    const dueDate = args.dueDate ? String(args.dueDate) : new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
    return {
      title: `Create invoice for ${customerName}`,
      fields: [
        { label: 'Customer', value: customerName, emphasize: true },
        { label: 'Items', value: itemSummary },
        { label: 'Taxable Value', value: inr(taxable) },
        { label: 'GST', value: inr(tax) },
        { label: 'Total', value: inr(total), emphasize: true },
        { label: 'Invoice Date', value: invoiceDate },
        { label: 'Due Date', value: dueDate },
      ],
      note: validation.warnings.length > 0 ? validation.warnings.join(' ') : undefined,
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    const customerName = String(args.customerName ?? '').trim();
    const items = Array.isArray(args.items) ? args.items : [];

    // Find-or-create the customer via the service layer (full side effects:
    // audit log + graph event + timeline event + activity log).
    const clientResult = await findOrCreateCustomer(
      orgId,
      customerName,
      {
        gstin: args.customerGstin ? String(args.customerGstin) : undefined,
        email: args.customerEmail ? String(args.customerEmail) : undefined,
      },
      { userId: ctx.userId, userName: ctx.userId },
    );
    if (!('data' in clientResult) || !clientResult.data) {
      return { ok: false, summary: `Failed to resolve customer "${customerName}". ${('error' in clientResult ? clientResult.error : 'Database error.')}` };
    }
    const client = clientResult.data;

    // Build line items for the service (and for the confirmation card table)
    const invoiceItems = items.map((it: InvoiceItemInput) => ({
      description: String(it.name ?? it.description ?? 'Item'),
      hsnCode: it.hsnCode ? String(it.hsnCode) : undefined,
      quantity: Number(it.quantity ?? 1),
      unitPrice: Number(it.rate ?? it.unitPrice ?? 0),
      gstRate: Number(it.gstRate ?? 18),
    }));

    const now = new Date();
    const invoiceDateStr = args.invoiceDate ? String(args.invoiceDate) : now.toISOString().slice(0, 10);
    const dueDateStr = args.dueDate
      ? String(args.dueDate)
      : new Date(now.getTime() + 15 * 86400000).toISOString().slice(0, 10);

    // Create the invoice via the service layer (full side effects: audit log +
    // graph event + timeline event + activity log + line-item rows).
    const result = await createInvoiceService(
      orgId,
      {
        clientId: client.id,
        customerName,
        buyerGstin: client.gstin,
        sellerGstin: 'LOCAL-SELLER',
        date: invoiceDateStr,
        dueDate: dueDateStr,
        items: invoiceItems,
        notes: args.notes ? String(args.notes) : undefined,
        persistLineItems: true,
      },
      { userId: ctx.userId, userName: ctx.userId },
    );

    if (!result.ok || !result.data) {
      return { ok: false, summary: `Failed to create invoice for ${customerName}. ${result.error ?? 'Database error.'}` };
    }

    const inv = result.data;
    const totalAmount = inv.totalAmount;

    return {
      ok: true,
      summary: `✅ Created invoice **${inv.invoiceNumber}** for ${customerName}. Total: ${inr(totalAmount)}. Due: ${inv.dueDate}. Status: ${inv.status}. You can review and send it from the Invoices page.`,
      data: { invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, totalAmount, customerName, items: invoiceItems, clientId: client.id },
      artifacts: [{
        kind: 'table',
        title: `Invoice ${inv.invoiceNumber}`,
        columns: ['Item', 'Qty', 'Rate', 'GST %', 'Amount'],
        rows: invoiceItems.map(it => ({
          Item: it.description,
          Qty: it.quantity,
          Rate: inr(it.unitPrice),
          'GST %': it.gstRate + '%',
          Amount: inr(it.quantity * it.unitPrice * (1 + it.gstRate / 100)),
        })),
      }],
      followUp: { label: 'Send this invoice', prompt: `Send invoice ${inv.invoiceNumber} to ${customerName} via email` },
      viewIn: { label: 'View in Invoices', href: '/invoices' },
    };
  },

  async refreshContext(result, orgId): Promise<RefreshedContext> {
    // Default refresh + the newly created invoice at the top of the list
    const { defaultRefreshContext } = await import('../engine');
    const ctx = await defaultRefreshContext(orgId);
    return ctx;
  },
};

// Auto-register
registerAction(createInvoiceAction);
