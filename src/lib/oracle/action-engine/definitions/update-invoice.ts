// ═══════════════════════════════════════════════════════════════════════════════
// Action: Update Invoice
// ═══════════════════════════════════════════════════════════════════════════════
//
// Uses the shared service layer (src/lib/services/invoices.ts → updateInvoice)
// so the update performs the EXACT same Prisma write + audit log + graph event
// invalidation + timeline event as the /api/invoices PUT route.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { updateInvoice as updateInvoiceService } from '@/lib/services';
import {
  registerAction,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
} from '../registry';

export const updateInvoiceAction: OracleAction = {
  name: 'updateInvoice',
  displayName: 'Update Invoice',
  description: 'Update an invoice\'s mutable fields (due date, notes, status, payment status).',
  category: 'finance',
  icon: 'FileText',
  intentKeywords: [
    'update invoice', 'edit invoice', 'modify invoice', 'change invoice', 'revise invoice',
  ],
  paramSchema: [
    { key: 'id', label: 'Invoice ID', type: 'string', required: false, description: 'Invoice id' },
    { key: 'invoiceNumber', label: 'Invoice Number', type: 'string', required: false, description: 'e.g. INV-2024-001 — resolved to id if id is omitted' },
    { key: 'dueDate', label: 'Due Date', type: 'date', required: false, description: 'ISO date YYYY-MM-DD' },
    { key: 'notes', label: 'Notes', type: 'string', required: false, description: 'Invoice notes' },
    { key: 'status', label: 'Status', type: 'enum', required: false, options: ['draft', 'issued', 'cancelled'], description: 'Invoice lifecycle status' },
    { key: 'paymentStatus', label: 'Payment Status', type: 'enum', required: false, options: ['unpaid', 'partial', 'paid'], description: 'Payment status' },
  ],

  async validate(args, orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    const id = String(args.id ?? '').trim();
    const invoiceNumber = String(args.invoiceNumber ?? '').trim();

    let invoice: { id: string; invoiceNumber: string; totalAmount: number; balanceAmount: number; status: string; paymentStatus: string } | null = null;

    if (id) {
      invoice = await db.invoice.findFirst({
        where: { id, client: { firmId: orgId } },
        select: { id: true, invoiceNumber: true, totalAmount: true, balanceAmount: true, status: true, paymentStatus: true },
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
        select: { id: true, invoiceNumber: true, totalAmount: true, balanceAmount: true, status: true, paymentStatus: true },
      }).catch(() => null);
      if (!invoice) {
        fields.push({ key: 'invoiceNumber', label: 'Invoice Number', status: 'error', message: 'Invoice not found in your tenant' });
        errors.push(`No invoice "${invoiceNumber}" was found in your tenant.`);
      } else {
        fields.push({ key: 'invoiceNumber', label: 'Invoice Number', status: 'ok', message: 'Resolved', resolvedValue: `${invoice.invoiceNumber} (${invoice.id})` });
      }
    } else {
      fields.push({ key: 'id', label: 'Invoice ID', status: 'error', message: 'Either id or invoiceNumber is required' });
      errors.push('Provide either the invoice id or invoice number to update.');
    }

    if (invoice) {
      resolvedRefs.invoiceId = invoice.id;
      resolvedRefs.invoiceNumber = invoice.invoiceNumber;
    }

    // Collect requested updates
    const updates: Record<string, unknown> = {};
    if (args.dueDate !== undefined) {
      updates.dueDate = String(args.dueDate) || null;
      fields.push({ key: 'dueDate', label: 'Due Date', status: 'ok', resolvedValue: String(args.dueDate) || '(cleared)' });
    }
    if (args.notes !== undefined) {
      updates.notes = String(args.notes) || null;
      fields.push({ key: 'notes', label: 'Notes', status: 'ok', resolvedValue: String(args.notes) || '(cleared)' });
    }
    if (args.status !== undefined) {
      const status = String(args.status);
      if (!['draft', 'issued', 'cancelled'].includes(status)) {
        fields.push({ key: 'status', label: 'Status', status: 'warn', message: 'Unknown status — ignored', resolvedValue: status });
        warnings.push(`Unknown invoice status "${status}" — will be ignored.`);
      } else {
        updates.status = status;
        fields.push({ key: 'status', label: 'Status', status: 'ok', resolvedValue: status });
      }
    }
    if (args.paymentStatus !== undefined) {
      const ps = String(args.paymentStatus);
      if (!['unpaid', 'partial', 'paid'].includes(ps)) {
        fields.push({ key: 'paymentStatus', label: 'Payment Status', status: 'warn', message: 'Unknown status — ignored', resolvedValue: ps });
        warnings.push(`Unknown payment status "${ps}" — will be ignored.`);
      } else {
        updates.paymentStatus = ps;
        fields.push({ key: 'paymentStatus', label: 'Payment Status', status: 'ok', resolvedValue: ps });
      }
    }

    if (Object.keys(updates).length === 0 && errors.length === 0) {
      warnings.push('No updatable fields were supplied — nothing to change.');
    }

    resolvedRefs.updates = updates;
    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const invoiceNumber = refs.invoiceNumber ?? String(args.invoiceNumber ?? args.id ?? '—');
    const updates: Record<string, unknown> = refs.updates ?? {};
    const changed: string[] = [];
    if (updates.dueDate !== undefined) changed.push(`due date → ${updates.dueDate || '(cleared)'}`);
    if (updates.notes !== undefined) changed.push(`notes → ${updates.notes || '(cleared)'}`);
    if (updates.status !== undefined) changed.push(`status → ${updates.status}`);
    if (updates.paymentStatus !== undefined) changed.push(`payment status → ${updates.paymentStatus}`);
    const changeSummary = changed.length > 0 ? changed.join('; ') : 'no changes';
    return {
      title: `Update invoice ${invoiceNumber}`,
      fields: [
        { label: 'Invoice', value: invoiceNumber, emphasize: true },
        { label: 'Changes', value: changeSummary },
      ],
      note: validation.warnings.length > 0 ? validation.warnings.join(' ') : undefined,
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    // Resolve the invoice id (re-lookup if only invoiceNumber was supplied).
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
      return { ok: false, summary: 'Failed to update invoice — could not resolve the invoice. Provide the id or invoice number.' };
    }

    const updates: Record<string, unknown> = {};
    if (args.dueDate !== undefined) updates.dueDate = String(args.dueDate) || null;
    if (args.notes !== undefined) updates.notes = String(args.notes) || null;
    if (args.status !== undefined && ['draft', 'issued', 'cancelled'].includes(String(args.status))) updates.status = String(args.status);
    if (args.paymentStatus !== undefined && ['unpaid', 'partial', 'paid'].includes(String(args.paymentStatus))) updates.paymentStatus = String(args.paymentStatus);

    const result = await updateInvoiceService(
      orgId,
      id,
      updates,
      { userId: ctx.userId, userName: ctx.userId },
    );

    if (!result.ok || !result.data) {
      return { ok: false, summary: `Failed to update invoice. ${result.error ?? 'Database error.'}` };
    }

    const inv = result.data;
    return {
      ok: true,
      summary: `✅ Updated invoice **${inv.invoiceNumber}** (status: ${inv.status}, payment: ${inv.paymentStatus}).`,
      data: { id: inv.id, invoiceNumber: inv.invoiceNumber, status: inv.status, paymentStatus: inv.paymentStatus, dueDate: inv.dueDate },
      viewIn: { label: 'View in Invoices', href: '/invoices' },
    };
  },
};

registerAction(updateInvoiceAction);
