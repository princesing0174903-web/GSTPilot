// ═══════════════════════════════════════════════════════════════════════════════
// Action: Mark Invoice Paid
// ═══════════════════════════════════════════════════════════════════════════════
//
// Uses the shared service layer (src/lib/services/payments.ts → markInvoicePaid)
// so the action performs the EXACT same payment record + invoice balance
// recompute + audit log + graph event + timeline event + activity log as a
// UI-driven "mark as paid".
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { markInvoicePaid as markInvoicePaidService } from '@/lib/services';
import {
  registerAction,
  inr,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
} from '../registry';

const VALID_MODES = ['upi', 'bank', 'cash', 'cheque', 'card'];

export const markInvoicePaidAction: OracleAction = {
  name: 'markInvoicePaid',
  displayName: 'Mark Invoice Paid',
  description: 'Settle an invoice in one step — creates a payment for the outstanding balance and flips the invoice to paid.',
  category: 'finance',
  icon: 'IndianRupee',
  intentKeywords: [
    'mark paid', 'mark invoice paid', 'mark as paid', 'settle invoice',
    'clear invoice', 'paid in full',
  ],
  paramSchema: [
    { key: 'id', label: 'Invoice ID', type: 'string', required: false, description: 'Invoice id' },
    { key: 'invoiceNumber', label: 'Invoice Number', type: 'string', required: false, description: 'e.g. INV-2024-001 — resolved to id if id is omitted' },
    { key: 'paymentMode', label: 'Payment Mode', type: 'enum', required: true, options: VALID_MODES, description: 'upi | bank | cash | cheque | card' },
    { key: 'paymentDate', label: 'Payment Date', type: 'date', required: false, description: 'ISO date YYYY-MM-DD (default: today)' },
    { key: 'referenceNo', label: 'Reference No', type: 'string', required: false, description: 'UTR / cheque number' },
  ],

  async validate(args, orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    const id = String(args.id ?? '').trim();
    const invoiceNumber = String(args.invoiceNumber ?? '').trim();

    let invoice: { id: string; invoiceNumber: string; totalAmount: number; paidAmount: number; balanceAmount: number; client: { tradeName: string | null } | null } | null = null;

    if (id) {
      invoice = await db.invoice.findFirst({
        where: { id, client: { firmId: orgId } },
        select: { id: true, invoiceNumber: true, totalAmount: true, paidAmount: true, balanceAmount: true, client: { select: { tradeName: true } } },
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
        select: { id: true, invoiceNumber: true, totalAmount: true, paidAmount: true, balanceAmount: true, client: { select: { tradeName: true } } },
      }).catch(() => null);
      if (!invoice) {
        fields.push({ key: 'invoiceNumber', label: 'Invoice Number', status: 'error', message: 'Invoice not found in your tenant' });
        errors.push(`No invoice "${invoiceNumber}" was found in your tenant.`);
      } else {
        fields.push({ key: 'invoiceNumber', label: 'Invoice Number', status: 'ok', message: 'Resolved', resolvedValue: `${invoice.invoiceNumber} (${invoice.id})` });
      }
    } else {
      fields.push({ key: 'id', label: 'Invoice ID', status: 'error', message: 'Either id or invoiceNumber is required' });
      errors.push('Provide either the invoice id or invoice number to mark as paid.');
    }

    if (invoice) {
      resolvedRefs.invoiceId = invoice.id;
      resolvedRefs.invoiceNumber = invoice.invoiceNumber;
      resolvedRefs.balance = invoice.balanceAmount ?? 0;
      resolvedRefs.total = invoice.totalAmount ?? 0;
      resolvedRefs.customerName = invoice.client?.tradeName ?? 'customer';

      const balance = invoice.balanceAmount ?? 0;
      if (balance <= 0) {
        fields.push({ key: 'balance', label: 'Outstanding Balance', status: 'error', message: 'Invoice is already fully paid', resolvedValue: inr(balance) });
        errors.push(`Invoice ${invoice.invoiceNumber} is already fully paid.`);
      } else {
        fields.push({ key: 'balance', label: 'Outstanding Balance', status: 'ok', message: 'Will be settled in full', resolvedValue: inr(balance) });
      }
    }

    // Payment mode (required)
    const paymentMode = String(args.paymentMode ?? '').trim();
    if (!paymentMode) {
      fields.push({ key: 'paymentMode', label: 'Payment Mode', status: 'error', message: 'Payment mode is required' });
      errors.push('Payment mode is required.');
    } else if (!VALID_MODES.includes(paymentMode)) {
      fields.push({ key: 'paymentMode', label: 'Payment Mode', status: 'error', message: `Must be one of: ${VALID_MODES.join(', ')}`, resolvedValue: paymentMode });
      errors.push(`Unknown payment mode "${paymentMode}".`);
    } else {
      fields.push({ key: 'paymentMode', label: 'Payment Mode', status: 'ok', resolvedValue: paymentMode });
      resolvedRefs.paymentMode = paymentMode;
    }

    if (args.paymentDate) {
      fields.push({ key: 'paymentDate', label: 'Payment Date', status: 'ok', resolvedValue: String(args.paymentDate) });
    }
    if (args.referenceNo) {
      fields.push({ key: 'referenceNo', label: 'Reference No', status: 'ok', resolvedValue: String(args.referenceNo) });
    }

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const invoiceNumber = refs.invoiceNumber ?? String(args.invoiceNumber ?? args.id ?? '—');
    const customerName = refs.customerName ?? '—';
    const balance = Number(refs.balance ?? 0);
    const paymentMode = refs.paymentMode ?? String(args.paymentMode ?? '—');
    const paymentDate = args.paymentDate ? String(args.paymentDate) : new Date().toISOString().slice(0, 10);
    const fields: ActionPreview['fields'] = [
      { label: 'Invoice', value: invoiceNumber, emphasize: true },
      { label: 'Customer', value: customerName },
      { label: 'Amount to Settle', value: inr(balance), emphasize: true },
      { label: 'Payment Mode', value: paymentMode },
      { label: 'Payment Date', value: paymentDate },
    ];
    if (args.referenceNo) fields.push({ label: 'Reference', value: String(args.referenceNo) });
    return {
      title: `Mark invoice ${invoiceNumber} as paid`,
      fields,
      note: validation.warnings.length > 0 ? validation.warnings.join(' ') : undefined,
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
      return { ok: false, summary: 'Failed to mark invoice as paid — could not resolve the invoice. Provide the id or invoice number.' };
    }

    const paymentMode = String(args.paymentMode ?? '').trim();
    if (!VALID_MODES.includes(paymentMode)) {
      return { ok: false, summary: `Failed to mark invoice as paid — invalid payment mode "${paymentMode}".` };
    }
    const paymentDate = args.paymentDate ? String(args.paymentDate) : undefined;
    const referenceNo = args.referenceNo ? String(args.referenceNo) : undefined;

    const result = await markInvoicePaidService(
      orgId,
      id,
      paymentMode,
      paymentDate,
      referenceNo,
      { userId: ctx.userId, userName: ctx.userId },
    );

    if (!result.ok || !result.data) {
      return { ok: false, summary: `Failed to mark invoice as paid. ${result.error ?? 'Database error.'}` };
    }

    const payment = result.data;
    return {
      ok: true,
      summary: `✅ Marked invoice as paid (${inr(payment.amount)} via ${paymentMode}).`,
      data: { invoiceId: id, paymentId: payment.id, amount: payment.amount, paymentMode, paymentDate: payment.paymentDate },
      viewIn: { label: 'View in Invoices', href: '/invoices' },
    };
  },
};

registerAction(markInvoicePaidAction);
