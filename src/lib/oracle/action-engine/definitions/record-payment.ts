// ═══════════════════════════════════════════════════════════════════════════════
// Action: Record Payment
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { findOrCreateCustomer, recordPayment as recordPaymentService } from '@/lib/services';
import {
  registerAction,
  inr,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
} from '../registry';

export const recordPaymentAction: OracleAction = {
  name: 'createPayment',
  displayName: 'Record Payment',
  description: 'Record a payment received from a customer or made to a vendor. Optionally link to an invoice.',
  category: 'finance',
  icon: 'IndianRupee',
  intentKeywords: [
    'record payment', 'log payment', 'received payment', 'payment received',
    'payment made', 'paid to', 'got paid', 'mark as paid', 'collect payment',
    'record receipt', 'bank deposit',
  ],
  paramSchema: [
    { key: 'partyName', label: 'Party Name', type: 'string', required: true, description: 'Customer or vendor name' },
    { key: 'amount', label: 'Amount (₹)', type: 'number', required: true, description: 'Amount in INR' },
    { key: 'paymentDate', label: 'Payment Date', type: 'date', required: true, description: 'ISO date YYYY-MM-DD' },
    { key: 'partyType', label: 'Party Type', type: 'enum', required: true, options: ['customer', 'vendor'], description: 'customer | vendor' },
    { key: 'paymentMode', label: 'Payment Mode', type: 'enum', required: false, options: ['upi', 'bank', 'cash', 'cheque', 'card'], description: 'Default: upi' },
    { key: 'referenceNo', label: 'Reference No', type: 'string', required: false, description: 'UTR / cheque number' },
    { key: 'invoiceId', label: 'Linked Invoice', type: 'string', required: false, description: 'Invoice ID (for customer payments)' },
    { key: 'notes', label: 'Notes', type: 'string', required: false, description: 'Payment notes' },
  ],

  async validate(args, orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    // Party name
    const partyName = String(args.partyName ?? '').trim();
    if (!partyName) {
      fields.push({ key: 'partyName', label: 'Party Name', status: 'error', message: 'Party name is required' });
      errors.push('Party name is required.');
    } else {
      const existing = await db.client.findFirst({
        where: { firmId: orgId, tradeName: { equals: partyName } },
        select: { id: true, tradeName: true },
      }).catch(() => null);
      if (existing) {
        fields.push({ key: 'partyName', label: 'Party Name', status: 'ok', message: 'Found in your records', resolvedValue: existing.tradeName });
        resolvedRefs.clientId = existing.id;
      } else {
        fields.push({ key: 'partyName', label: 'Party Name', status: 'warn', message: 'Will be created as a new contact', resolvedValue: partyName });
        warnings.push(`"${partyName}" is not in your customer list — a new contact will be created.`);
      }
    }

    // Amount
    const amount = Number(args.amount ?? 0);
    if (!amount || amount <= 0) {
      fields.push({ key: 'amount', label: 'Amount', status: 'error', message: 'Amount must be greater than 0' });
      errors.push('Amount must be greater than 0.');
    } else {
      fields.push({ key: 'amount', label: 'Amount', status: 'ok', resolvedValue: inr(amount) });
    }

    // Date
    const paymentDate = args.paymentDate ? String(args.paymentDate) : new Date().toISOString().slice(0, 10);
    fields.push({ key: 'paymentDate', label: 'Payment Date', status: 'ok', resolvedValue: paymentDate });

    // Party type
    const partyType = String(args.partyType ?? 'customer');
    if (!['customer', 'vendor'].includes(partyType)) {
      fields.push({ key: 'partyType', label: 'Party Type', status: 'warn', message: `Defaulting to "customer"`, resolvedValue: partyType });
      warnings.push(`Unknown party type "${partyType}" — defaulting to "customer".`);
      resolvedRefs.partyType = 'customer';
    } else {
      fields.push({ key: 'partyType', label: 'Party Type', status: 'ok', resolvedValue: partyType });
      resolvedRefs.partyType = partyType;
    }

    // Payment mode
    const paymentMode = String(args.paymentMode ?? 'upi');
    fields.push({ key: 'paymentMode', label: 'Payment Mode', status: 'ok', resolvedValue: paymentMode });

    // Linked invoice (if provided)
    if (args.invoiceId) {
      const inv = await db.invoice.findFirst({
        where: { id: String(args.invoiceId), client: { firmId: orgId } },
        select: { id: true, invoiceNumber: true, totalAmount: true, paidAmount: true, balanceAmount: true, paymentStatus: true },
      }).catch(() => null);
      if (!inv) {
        fields.push({ key: 'invoiceId', label: 'Linked Invoice', status: 'error', message: 'Invoice not found' });
        errors.push(`Invoice "${args.invoiceId}" not found in your records.`);
      } else {
        const newBalance = Math.max((inv.totalAmount ?? 0) - (inv.paidAmount ?? 0) - amount, 0);
        fields.push({
          key: 'invoiceId',
          label: 'Linked Invoice',
          status: 'ok',
          message: `Balance after this payment: ${inr(newBalance)}`,
          resolvedValue: `${inv.invoiceNumber} (was ${inr(inv.balanceAmount ?? 0)} outstanding)`,
        });
        resolvedRefs.invoiceId = inv.id;
        resolvedRefs.invoiceNumber = inv.invoiceNumber;
        resolvedRefs.invoiceOldBalance = inv.balanceAmount;
        resolvedRefs.invoiceNewBalance = newBalance;
      }
    }

    if (args.referenceNo) fields.push({ key: 'referenceNo', label: 'Reference No', status: 'ok', resolvedValue: String(args.referenceNo) });

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const partyName = String(args.partyName ?? '').trim() || '—';
    const amount = Number(args.amount ?? 0);
    const paymentDate = args.paymentDate ? String(args.paymentDate) : new Date().toISOString().slice(0, 10);
    const partyType = String(args.partyType ?? 'customer');
    const paymentMode = String(args.paymentMode ?? 'upi');
    const dir = partyType === 'vendor' ? 'to' : 'from';
    const refs = validation.resolvedRefs ?? {};
    const invoiceLine = refs.invoiceNumber ? `${refs.invoiceNumber} (balance ${inr(refs.invoiceOldBalance ?? 0)} → ${inr(refs.invoiceNewBalance ?? 0)})` : undefined;
    const fields: ActionPreview['fields'] = [
      { label: partyType === 'vendor' ? 'Vendor' : 'Customer', value: partyName, emphasize: true },
      { label: 'Amount', value: inr(amount), emphasize: true },
      { label: 'Direction', value: `${dir} ${partyName}` },
      { label: 'Date', value: paymentDate },
      { label: 'Mode', value: paymentMode },
    ];
    if (args.referenceNo) fields.push({ label: 'Reference', value: String(args.referenceNo) });
    if (invoiceLine) fields.push({ label: 'Linked Invoice', value: invoiceLine });
    return {
      title: `Record payment: ${inr(amount)} ${dir} ${partyName}`,
      fields,
      note: validation.warnings.length > 0 ? validation.warnings.join(' ') : undefined,
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    const partyName = String(args.partyName ?? '').trim();
    const amount = Number(args.amount ?? 0);
    const paymentDate = String(args.paymentDate ?? new Date().toISOString().slice(0, 10));
    const partyType = String(args.partyType ?? 'customer') === 'vendor' ? 'vendor' : 'customer';
    const paymentMode = String(args.paymentMode ?? 'upi');

    // Find-or-create the party as a Client (full side effects via service).
    const clientResult = await findOrCreateCustomer(
      orgId,
      partyName,
      {},
      { userId: ctx.userId, userName: ctx.userId },
    );
    const clientId = ('data' in clientResult && clientResult.data) ? clientResult.data.id : undefined;

    const result = await recordPaymentService(
      orgId,
      {
        clientId,
        partyName,
        partyType: partyType as 'customer' | 'vendor',
        amount,
        paymentDate,
        paymentMode,
        referenceNo: args.referenceNo ? String(args.referenceNo) : undefined,
        invoiceId: args.invoiceId ? String(args.invoiceId) : undefined,
        notes: args.notes ? String(args.notes) : undefined,
      },
      { userId: ctx.userId, userName: ctx.userId },
    );

    if (!result.ok || !result.data) {
      return { ok: false, summary: `Failed to record payment. ${result.error ?? 'Database error.'}` };
    }

    const payment = result.data;
    const invoiceUpdate: { invoiceNumber?: string; newBalance?: number; newStatus?: string } = {};
    if (payment.invoiceNowPaid && payment.paidInvoiceNumber) {
      invoiceUpdate.invoiceNumber = payment.paidInvoiceNumber;
      invoiceUpdate.newBalance = 0;
      invoiceUpdate.newStatus = 'paid';
    }

    const dir = partyType === 'vendor' ? 'to' : 'from';

    const summary = invoiceUpdate.invoiceNumber
      ? `✅ Recorded payment: ${inr(amount)} ${dir} **${partyName}** on ${paymentDate}. Linked invoice ${invoiceUpdate.invoiceNumber} updated — balance now ${inr(invoiceUpdate.newBalance ?? 0)} (status: ${invoiceUpdate.newStatus}).`
      : `✅ Recorded payment: ${inr(amount)} ${dir} **${partyName}** on ${paymentDate}.`;

    return {
      ok: true,
      summary,
      data: { id: payment.id, partyName: payment.partyName, amount: payment.amount, paymentDate: payment.paymentDate, partyType: payment.partyType, invoiceUpdate },
      artifacts: [{
        kind: 'metric',
        title: 'Payment Recorded',
        items: [
          { label: 'Amount', value: inr(amount) },
          { label: partyType === 'vendor' ? 'Vendor' : 'Customer', value: partyName },
          { label: 'Date', value: paymentDate },
          { label: 'Mode', value: paymentMode },
          ...(invoiceUpdate.invoiceNumber ? [{ label: 'Linked Invoice', value: invoiceUpdate.invoiceNumber }] : []),
          ...(invoiceUpdate.newStatus ? [{ label: 'Invoice Status', value: invoiceUpdate.newStatus }] : []),
        ],
      }],
      followUp: invoiceUpdate.newStatus === 'paid'
        ? { label: 'Send receipt', prompt: `Send a payment receipt to ${partyName} for ${inr(amount)}` }
        : { label: 'View invoice', prompt: `Show me invoice ${invoiceUpdate.invoiceNumber ?? ''}` },
      viewIn: { label: 'View in Banking', href: '/banking' },
    };
  },
};

registerAction(recordPaymentAction);
