// ═══════════════════════════════════════════════════════════════════════════════
// Action: Refund Payment
// ═══════════════════════════════════════════════════════════════════════════════
//
// Uses the shared service layer (src/lib/services/payments.ts → refundPayment)
// so the refund performs the EXACT same payment record (negative direction) +
// linked invoice balance adjustment + audit log + graph event + timeline event
// + activity log as a UI-driven refund.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { refundPayment as refundPaymentService } from '@/lib/services';
import {
  registerAction,
  inr,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
} from '../registry';

export const refundPaymentAction: OracleAction = {
  name: 'refundPayment',
  displayName: 'Refund Payment',
  description: 'Issue a refund for an existing payment — creates a refund payment record and adjusts the linked invoice balance back up.',
  category: 'finance',
  icon: 'IndianRupee',
  intentKeywords: [
    'refund payment', 'issue refund', 'refund', 'reverse payment', 'return payment',
  ],
  paramSchema: [
    { key: 'paymentId', label: 'Payment ID', type: 'string', required: false, description: 'Original payment id' },
    { key: 'referenceNo', label: 'Reference No', type: 'string', required: false, description: 'Original payment reference number — resolved to paymentId if paymentId is omitted' },
    { key: 'reason', label: 'Reason', type: 'string', required: false, description: 'Refund reason / note' },
  ],

  async validate(args, orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    const paymentId = String(args.paymentId ?? '').trim();
    const referenceNo = String(args.referenceNo ?? '').trim();

    let payment: { id: string; partyName: string; partyType: string; amount: number; paymentMode: string; invoiceId: string | null; referenceNo: string | null; client: { firmId: string | null } | null } | null = null;

    if (paymentId) {
      payment = await db.payment.findFirst({
        where: { id: paymentId, client: { firmId: orgId } },
        select: { id: true, partyName: true, partyType: true, amount: true, paymentMode: true, invoiceId: true, referenceNo: true, client: { select: { firmId: true } } },
      }).catch(() => null);
      if (!payment) {
        fields.push({ key: 'paymentId', label: 'Payment ID', status: 'error', message: 'Payment not found in your tenant' });
        errors.push(`Payment "${paymentId}" was not found in your tenant.`);
      } else {
        fields.push({ key: 'paymentId', label: 'Payment ID', status: 'ok', message: 'Found', resolvedValue: `${payment.partyName} — ${inr(payment.amount)}` });
      }
    } else if (referenceNo) {
      payment = await db.payment.findFirst({
        where: { referenceNo, client: { firmId: orgId } },
        select: { id: true, partyName: true, partyType: true, amount: true, paymentMode: true, invoiceId: true, referenceNo: true, client: { select: { firmId: true } } },
      }).catch(() => null);
      if (!payment) {
        fields.push({ key: 'referenceNo', label: 'Reference No', status: 'error', message: 'No payment with that reference in your tenant' });
        errors.push(`No payment with reference "${referenceNo}" was found in your tenant.`);
      } else {
        fields.push({ key: 'referenceNo', label: 'Reference No', status: 'ok', message: 'Resolved', resolvedValue: `${payment.partyName} — ${inr(payment.amount)}` });
      }
    } else {
      fields.push({ key: 'paymentId', label: 'Payment ID', status: 'error', message: 'Either paymentId or referenceNo is required' });
      errors.push('Provide either the payment id or reference number to refund.');
    }

    if (payment) {
      resolvedRefs.paymentId = payment.id;
      resolvedRefs.partyName = payment.partyName;
      resolvedRefs.partyType = payment.partyType;
      resolvedRefs.amount = payment.amount ?? 0;
      resolvedRefs.paymentMode = payment.paymentMode;
      resolvedRefs.invoiceId = payment.invoiceId;
    }

    if (args.reason) {
      fields.push({ key: 'reason', label: 'Reason', status: 'ok', resolvedValue: String(args.reason) });
    }

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const partyName = refs.partyName ?? '—';
    const partyType = refs.partyType ?? '—';
    const amount = Number(refs.amount ?? 0);
    const paymentMode = refs.paymentMode ?? '—';
    const invoiceLinked = refs.invoiceId ? 'Yes — balance will be adjusted back up' : 'No';
    const fields: ActionPreview['fields'] = [
      { label: 'Original Payment', value: `${partyName} (${partyType})`, emphasize: true },
      { label: 'Refund Amount', value: inr(amount), emphasize: true },
      { label: 'Original Mode', value: paymentMode },
      { label: 'Linked Invoice', value: invoiceLinked },
    ];
    if (args.reason) fields.push({ label: 'Reason', value: String(args.reason) });
    return {
      title: `Refund ${inr(amount)} to ${partyName}`,
      fields,
      note: '⚠️ This creates a refund payment record and adjusts the linked invoice balance back up if the original payment was applied to an invoice.',
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    let paymentId = String(args.paymentId ?? '').trim();
    if (!paymentId) {
      const referenceNo = String(args.referenceNo ?? '').trim();
      if (referenceNo) {
        const found = await db.payment.findFirst({
          where: { referenceNo, client: { firmId: orgId } },
          select: { id: true },
        }).catch(() => null);
        if (found) paymentId = found.id;
      }
    }
    if (!paymentId) {
      return { ok: false, summary: 'Failed to issue refund — could not resolve the payment. Provide the paymentId or referenceNo.' };
    }

    const reason = args.reason ? String(args.reason) : undefined;

    const result = await refundPaymentService(
      orgId,
      paymentId,
      reason,
      { userId: ctx.userId, userName: ctx.userId },
    );

    if (!result.ok || !result.data) {
      return { ok: false, summary: `Failed to issue refund. ${result.error ?? 'Database error.'}` };
    }

    const refund = result.data;
    return {
      ok: true,
      summary: `✅ Refunded ${inr(refund.amount)} to **${refund.partyName}** (via ${refund.paymentMode}).`,
      data: { refundId: refund.id, originalPaymentId: paymentId, amount: refund.amount, partyName: refund.partyName, referenceNo: refund.referenceNo },
      viewIn: { label: 'View in Banking', href: '/banking' },
    };
  },
};

registerAction(refundPaymentAction);
