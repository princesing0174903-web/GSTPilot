// ═══════════════════════════════════════════════════════════════════════════════
// Action: Delete Invoice
// ═══════════════════════════════════════════════════════════════════════════════
//
// Uses the shared service layer (src/lib/services/invoices.ts → deleteInvoice)
// so the delete performs the EXACT same audit log + graph invalidation +
// timeline event as the /api/invoices DELETE route. Hard delete — Oracle always
// asks for explicit confirmation.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { deleteInvoice as deleteInvoiceService } from '@/lib/services';
import {
  registerAction,
  inr,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
} from '../registry';

export const deleteInvoiceAction: OracleAction = {
  name: 'deleteInvoice',
  displayName: 'Delete Invoice',
  description: 'Permanently delete an invoice. Audit log is written before deletion.',
  category: 'finance',
  icon: 'FileText',
  intentKeywords: [
    'delete invoice', 'remove invoice', 'cancel invoice',
  ],
  paramSchema: [
    { key: 'id', label: 'Invoice ID', type: 'string', required: false, description: 'Invoice id' },
    { key: 'invoiceNumber', label: 'Invoice Number', type: 'string', required: false, description: 'e.g. INV-2024-001 — resolved to id if id is omitted' },
  ],

  async validate(args, orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    const id = String(args.id ?? '').trim();
    const invoiceNumber = String(args.invoiceNumber ?? '').trim();

    let invoice: { id: string; invoiceNumber: string; totalAmount: number; buyerName: string | null } | null = null;

    if (id) {
      invoice = await db.invoice.findFirst({
        where: { id, client: { firmId: orgId } },
        select: { id: true, invoiceNumber: true, totalAmount: true, buyerName: true },
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
        select: { id: true, invoiceNumber: true, totalAmount: true, buyerName: true },
      }).catch(() => null);
      if (!invoice) {
        fields.push({ key: 'invoiceNumber', label: 'Invoice Number', status: 'error', message: 'Invoice not found in your tenant' });
        errors.push(`No invoice "${invoiceNumber}" was found in your tenant.`);
      } else {
        fields.push({ key: 'invoiceNumber', label: 'Invoice Number', status: 'ok', message: 'Resolved', resolvedValue: `${invoice.invoiceNumber} (${invoice.id})` });
      }
    } else {
      fields.push({ key: 'id', label: 'Invoice ID', status: 'error', message: 'Either id or invoiceNumber is required' });
      errors.push('Provide either the invoice id or invoice number to delete.');
    }

    if (invoice) {
      resolvedRefs.invoiceId = invoice.id;
      resolvedRefs.invoiceNumber = invoice.invoiceNumber;
      resolvedRefs.invoiceTotal = invoice.totalAmount ?? 0;
      resolvedRefs.buyerName = invoice.buyerName;
    }

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const invoiceNumber = refs.invoiceNumber ?? String(args.invoiceNumber ?? args.id ?? '—');
    const total = Number(refs.invoiceTotal ?? 0);
    const buyer = refs.buyerName ?? '—';
    return {
      title: `Delete invoice ${invoiceNumber}`,
      fields: [
        { label: 'Invoice', value: invoiceNumber, emphasize: true },
        { label: 'Customer', value: buyer },
        { label: 'Amount', value: inr(total) },
      ],
      note: '⚠️ This will permanently delete the invoice. Audit logs and timeline events are preserved, but the invoice record cannot be recovered.',
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
      return { ok: false, summary: 'Failed to delete invoice — could not resolve the invoice. Provide the id or invoice number.' };
    }

    const result = await deleteInvoiceService(
      orgId,
      id,
      { userId: ctx.userId, userName: ctx.userId },
    );

    if (!result.ok || !result.data) {
      return { ok: false, summary: `Failed to delete invoice. ${result.error ?? 'Database error.'}` };
    }

    const inv = result.data;
    return {
      ok: true,
      summary: `✅ Deleted invoice **${inv.invoiceNumber}**.`,
      data: { id: inv.id, invoiceNumber: inv.invoiceNumber, clientId: inv.clientId },
      viewIn: { label: 'View in Invoices', href: '/invoices' },
    };
  },
};

registerAction(deleteInvoiceAction);
