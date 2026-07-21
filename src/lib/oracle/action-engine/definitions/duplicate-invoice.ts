// ═══════════════════════════════════════════════════════════════════════════════
// Action: Duplicate Invoice
// ═══════════════════════════════════════════════════════════════════════════════
//
// Uses the shared service layer (src/lib/services/invoices.ts → duplicateInvoice)
// so the duplication performs the EXACT same Prisma write + audit log + graph
// event + timeline event as a UI-driven clone.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { duplicateInvoice as duplicateInvoiceService } from '@/lib/services';
import {
  registerAction,
  inr,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
} from '../registry';

export const duplicateInvoiceAction: OracleAction = {
  name: 'duplicateInvoice',
  displayName: 'Duplicate Invoice',
  description: 'Clone an existing invoice to a new draft with a fresh invoice number and reset payment status.',
  category: 'finance',
  icon: 'FileText',
  intentKeywords: [
    'duplicate invoice', 'copy invoice', 'clone invoice', 'repeat invoice',
  ],
  paramSchema: [
    { key: 'id', label: 'Invoice ID', type: 'string', required: false, description: 'Source invoice id' },
    { key: 'invoiceNumber', label: 'Invoice Number', type: 'string', required: false, description: 'Source invoice number — resolved to id if id is omitted' },
  ],

  async validate(args, orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    const id = String(args.id ?? '').trim();
    const invoiceNumber = String(args.invoiceNumber ?? '').trim();

    let invoice: { id: string; invoiceNumber: string; totalAmount: number; buyerName: string | null; dueDate: string | null } | null = null;

    if (id) {
      invoice = await db.invoice.findFirst({
        where: { id, client: { firmId: orgId } },
        select: { id: true, invoiceNumber: true, totalAmount: true, buyerName: true, dueDate: true },
      }).catch(() => null);
      if (!invoice) {
        fields.push({ key: 'id', label: 'Invoice ID', status: 'error', message: 'Invoice not found in your tenant' });
        errors.push(`Invoice "${id}" was not found in your tenant.`);
      } else {
        fields.push({ key: 'id', label: 'Invoice ID', status: 'ok', message: 'Found', resolvedValue: invoice.invoiceNumber });
      }
    } else if (invoiceNumber) {
      invoice = await db.invoice.findFirst({
        where: { invoiceNumber, client: { firmId: orgId } },
        select: { id: true, invoiceNumber: true, totalAmount: true, buyerName: true, dueDate: true },
      }).catch(() => null);
      if (!invoice) {
        fields.push({ key: 'invoiceNumber', label: 'Invoice Number', status: 'error', message: 'Invoice not found in your tenant' });
        errors.push(`No invoice "${invoiceNumber}" was found in your tenant.`);
      } else {
        fields.push({ key: 'invoiceNumber', label: 'Invoice Number', status: 'ok', message: 'Resolved', resolvedValue: `${invoice.invoiceNumber} (${invoice.id})` });
      }
    } else {
      fields.push({ key: 'id', label: 'Invoice ID', status: 'error', message: 'Either id or invoiceNumber is required' });
      errors.push('Provide either the invoice id or invoice number to duplicate.');
    }

    if (invoice) {
      resolvedRefs.invoiceId = invoice.id;
      resolvedRefs.invoiceNumber = invoice.invoiceNumber;
      resolvedRefs.invoiceTotal = invoice.totalAmount ?? 0;
      resolvedRefs.buyerName = invoice.buyerName;
      resolvedRefs.dueDate = invoice.dueDate;
    }

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const invoiceNumber = refs.invoiceNumber ?? String(args.invoiceNumber ?? args.id ?? '—');
    const total = Number(refs.invoiceTotal ?? 0);
    const buyer = refs.buyerName ?? '—';
    return {
      title: `Duplicate invoice ${invoiceNumber}`,
      fields: [
        { label: 'Source Invoice', value: invoiceNumber, emphasize: true },
        { label: 'Customer', value: buyer },
        { label: 'Amount', value: inr(total) },
        { label: 'New Status', value: 'draft (unpaid)' },
      ],
      note: validation.warnings.length > 0 ? validation.warnings.join(' ') : 'A new invoice will be created with a fresh invoice number, today\'s date, and a reset payment status.',
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    let id = String(args.id ?? '').trim();
    if (!id) {
      const invoiceNumber = String(args.invoiceNumber ?? '').trim();
      if (invoiceNumber) {
        const found = await db.invoice.findFirst({
          where: { invoiceNumber, client: { firmId: orgId } },
          select: { id: true },
        }).catch(() => null);
        if (found) id = found.id;
      }
    }
    if (!id) {
      return { ok: false, summary: 'Failed to duplicate invoice — could not resolve the invoice. Provide the id or invoice number.' };
    }

    const result = await duplicateInvoiceService(
      orgId,
      id,
      { userId: ctx.userId, userName: ctx.userId },
    );

    if (!result.ok || !result.data) {
      return { ok: false, summary: `Failed to duplicate invoice. ${result.error ?? 'Database error.'}` };
    }

    const dup = result.data;
    return {
      ok: true,
      summary: `✅ Duplicated invoice — new invoice **${dup.invoiceNumber}** created (${inr(dup.totalAmount)}, draft).`,
      data: { id: dup.id, invoiceNumber: dup.invoiceNumber, totalAmount: dup.totalAmount, status: dup.status, paymentStatus: dup.paymentStatus },
      followUp: { label: 'Edit the duplicate', prompt: `Update invoice ${dup.invoiceNumber} due date to next month` },
      viewIn: { label: 'View in Invoices', href: '/invoices' },
    };
  },
};

registerAction(duplicateInvoiceAction);
