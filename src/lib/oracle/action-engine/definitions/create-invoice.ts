// ═══════════════════════════════════════════════════════════════════════════════
// Action: Create Invoice
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import {
  registerAction,
  inr,
  findOrCreateClient,
  logActivity,
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

    // Re-find-or-create the client (defense in depth — resolved in validate but
    // execute must be self-contained).
    const client = await findOrCreateClient(orgId, customerName, {
      gstin: args.customerGstin ? String(args.customerGstin) : undefined,
      email: args.customerEmail ? String(args.customerEmail) : undefined,
    });

    // Compute line items + totals
    let taxableValue = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    const invoiceItems = items.map((it: InvoiceItemInput, idx: number) => {
      const qty = Number(it.quantity ?? 1);
      const unitPrice = Number(it.rate ?? it.unitPrice ?? 0);
      const gstRate = Number(it.gstRate ?? 18);
      const lineNet = qty * unitPrice;
      const lineTax = lineNet * (gstRate / 100);
      taxableValue += lineNet;
      cgstTotal += lineTax / 2;
      sgstTotal += lineTax / 2;
      return {
        lineNumber: idx + 1,
        description: String(it.name ?? it.description ?? 'Item'),
        hsnCode: it.hsnCode ? String(it.hsnCode) : null,
        quantity: qty,
        unit: it.unit ? String(it.unit) : 'NOS',
        unitPrice,
        taxableValue: lineNet,
        cgstRate: gstRate / 2,
        sgstRate: gstRate / 2,
        igstRate: 0,
        cessRate: 0,
        cgst: lineTax / 2,
        sgst: lineTax / 2,
        igst: 0,
        cess: 0,
        totalAmount: lineNet + lineTax,
      };
    });
    const totalAmount = taxableValue + cgstTotal + sgstTotal;
    const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
    const now = new Date();
    const invoiceDateStr = args.invoiceDate ? String(args.invoiceDate) : now.toISOString().slice(0, 10);
    const dueDateStr = args.dueDate
      ? String(args.dueDate)
      : new Date(now.getTime() + 15 * 86400000).toISOString().slice(0, 10);

    const invoice = await db.invoice.create({
      data: {
        clientId: client.id,
        invoiceNumber,
        invoiceDate: invoiceDateStr,
        sellerGstin: 'LOCAL-SELLER',
        buyerGstin: client.gstin,
        buyerName: customerName,
        invoiceType: 'B2B',
        taxableValue,
        cgst: cgstTotal,
        sgst: sgstTotal,
        igst: 0,
        cess: 0,
        totalAmount,
        status: 'draft',
        dueDate: dueDateStr,
        gstAmount: cgstTotal + sgstTotal,
        paidAmount: 0,
        balanceAmount: totalAmount,
        paymentStatus: 'unpaid',
        notes: args.notes ? String(args.notes) : null,
      },
      select: { id: true, invoiceNumber: true, totalAmount: true, dueDate: true },
    }).catch((e) => { console.error('[createInvoice] db error:', e); return null; });

    if (!invoice) {
      return { ok: false, summary: `Failed to create invoice for ${customerName}. Database error.` };
    }

    // Persist line items
    try {
      await db.invoiceItem.createMany({
        data: invoiceItems.map(it => ({
          invoiceId: invoice.id,
          lineNumber: it.lineNumber,
          description: it.description,
          hsnCode: it.hsnCode,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unitPrice,
          taxableValue: it.taxableValue,
          cgstRate: it.cgstRate,
          sgstRate: it.sgstRate,
          igstRate: it.igstRate,
          cessRate: it.cessRate,
          cgst: it.cgst,
          sgst: it.sgst,
          igst: it.igst,
          cess: it.cess,
          totalAmount: it.totalAmount,
        })),
      });
    } catch (e) {
      console.warn('[createInvoice] items not persisted:', (e as Error).message);
    }

    await logActivity(orgId, 'invoice', `Invoice ${invoice.invoiceNumber} created for ${customerName} (${inr(invoice.totalAmount)})`, { invoiceId: invoice.id, customer: customerName, total: invoice.totalAmount });

    return {
      ok: true,
      summary: `✅ Created invoice **${invoice.invoiceNumber}** for ${customerName}. Total: ${inr(invoice.totalAmount)}. Due: ${invoice.dueDate}. Status: Draft. You can review and send it from the Invoices page.`,
      data: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, totalAmount, customerName, items: invoiceItems, clientId: client.id },
      artifacts: [{
        kind: 'table',
        title: `Invoice ${invoice.invoiceNumber}`,
        columns: ['Item', 'Qty', 'Rate', 'GST %', 'Amount'],
        rows: invoiceItems.map(it => ({
          Item: it.description,
          Qty: it.quantity,
          Rate: inr(it.unitPrice),
          'GST %': (it.cgstRate + it.sgstRate) + '%',
          Amount: inr(it.totalAmount),
        })),
      }],
      followUp: { label: 'Send this invoice', prompt: `Send invoice ${invoice.invoiceNumber} to ${customerName} via email` },
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
