// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Shared Service Layer: Payments
// ═══════════════════════════════════════════════════════════════════════════════
//
// Canonical record/refund/markPaid logic for payments. Both /api/payments and
// the Oracle recordPayment/refundPayment/markInvoicePaid actions call THESE
// functions so invoice balance recomputation, audit logs, graph events,
// timeline events, and activity logs fire identically.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { graphEvents } from '@/lib/graph/live-update';
import { emitCollectionNode } from '@/lib/graph/auto-emit';
import { emitTimelineEvent } from '@/lib/timeline/emit';
import type { Actor, ServiceResult } from './types';

export interface RecordPaymentInput {
  clientId?: string;
  partyName: string;
  partyType: 'customer' | 'vendor';
  amount: number;
  paymentDate: string;
  paymentMode: string;
  referenceNo?: string;
  invoiceId?: string;
  purchaseBillId?: string;
  notes?: string;
}

export interface PaymentRecord {
  id: string;
  clientId: string | null;
  invoiceId: string | null;
  partyName: string;
  partyType: string;
  amount: number;
  paymentDate: string;
  paymentMode: string;
  referenceNo: string | null;
  status: string;
  reconciled: boolean;
  notes: string | null;
}

function toRecord(p: any): PaymentRecord {
  return {
    id: p.id,
    clientId: p.clientId ?? null,
    invoiceId: p.invoiceId ?? null,
    partyName: p.partyName,
    partyType: p.partyType,
    amount: p.amount ?? 0,
    paymentDate: p.paymentDate,
    paymentMode: p.paymentMode,
    referenceNo: p.referenceNo ?? null,
    status: p.status ?? 'completed',
    reconciled: p.reconciled ?? false,
    notes: p.notes ?? null,
  };
}

/**
 * Record a payment and reconcile against an invoice (recomputes paid/balance/
 * status) when invoiceId is supplied. Returns the payment + whether the
 * referenced invoice transitioned to fully-paid.
 */
export async function recordPayment(
  orgId: string,
  input: RecordPaymentInput,
  actor?: Actor,
): Promise<ServiceResult<PaymentRecord & { invoiceNowPaid?: boolean; paidInvoiceNumber?: string | null }>> {
  if (!input.partyName || !input.partyType || input.amount === undefined || !input.paymentDate || !input.paymentMode) {
    return { ok: false, error: 'partyName, partyType, amount, paymentDate and paymentMode are required', status: 400 };
  }

  const paymentAmount = Number(input.amount) || 0;

  const payment = await db.payment.create({
    data: {
      clientId: input.clientId ?? null,
      invoiceId: input.invoiceId ?? null,
      purchaseBillId: input.purchaseBillId ?? null,
      partyName: input.partyName,
      partyType: input.partyType,
      amount: paymentAmount,
      paymentDate: input.paymentDate,
      paymentMode: input.paymentMode,
      referenceNo: input.referenceNo ?? null,
      status: 'completed',
      reconciled: false,
      notes: input.notes ?? null,
    },
    select: {
      id: true, clientId: true, invoiceId: true, partyName: true, partyType: true,
      amount: true, paymentDate: true, paymentMode: true, referenceNo: true,
      status: true, reconciled: true, notes: true,
    },
  });

  // Reconcile against invoice
  let invoiceNowPaid = false;
  let paidInvoiceNumber: string | null = null;
  let paidInvoiceTotal = 0;
  if (input.invoiceId) {
    const invoice = await db.invoice.findUnique({ where: { id: input.invoiceId } }).catch(() => null);
    if (invoice) {
      const newPaid = (invoice.paidAmount ?? 0) + paymentAmount;
      const total = invoice.totalAmount ?? 0;
      const balance = Math.max(0, total - newPaid);
      let paymentStatus = 'unpaid';
      if (balance <= 0) paymentStatus = 'paid';
      else if (newPaid > 0) paymentStatus = 'partial';
      await db.invoice.update({
        where: { id: input.invoiceId },
        data: {
          paidAmount: newPaid,
          balanceAmount: balance,
          paymentStatus,
          paymentDate: paymentStatus === 'paid' ? input.paymentDate : invoice.paymentDate,
          paymentMode: input.paymentMode ?? invoice.paymentMode,
        },
      }).catch(() => {});
      if (paymentStatus === 'paid') {
        graphEvents.invoicePaid(invoice.id, invoice.invoiceNumber, paymentAmount);
        invoiceNowPaid = true;
        paidInvoiceNumber = invoice.invoiceNumber;
        paidInvoiceTotal = total;
      }
    }
  }

  await db.auditLog.create({
    data: {
      clientId: input.clientId ?? null,
      action: 'Payment Recorded',
      entity: 'payment',
      entityId: payment.id,
      details: `${input.partyType === 'vendor' ? 'Vendor' : 'Customer'} payment ₹${paymentAmount} — ${input.partyName}${input.invoiceId ? ` (invoice ${input.invoiceId})` : ''}`,
    },
  }).catch(() => {});

  if (input.partyType === 'vendor') {
    graphEvents.paymentMade(payment.id, input.partyName, paymentAmount);
  } else {
    graphEvents.paymentReceived(payment.id, input.partyName, paymentAmount);
  }
  try { await emitCollectionNode(payment.id); } catch { /* non-fatal */ }

  const isCustomerPayment = input.partyType !== 'vendor';
  if (isCustomerPayment) {
    await emitTimelineEvent({
      organizationId: orgId,
      type: 'payment.received',
      title: `Payment ₹${paymentAmount.toLocaleString('en-IN')} received`,
      description: `${input.partyName} paid via ${input.paymentMode}${input.invoiceId ? ` — against invoice${paidInvoiceNumber ? ` ${paidInvoiceNumber}` : ''}` : ''}.${input.referenceNo ? ` Ref: ${input.referenceNo}.` : ''}`,
      actor,
      metadata: {
        paymentId: payment.id, amount: paymentAmount, partyName: input.partyName,
        partyType: input.partyType, paymentMode: input.paymentMode,
        paymentDate: input.paymentDate, referenceNo: input.referenceNo ?? null,
        invoiceId: input.invoiceId ?? null, invoiceNumber: paidInvoiceNumber,
        clientId: input.clientId ?? null,
      },
      severity: 'success',
    });
  }
  if (invoiceNowPaid && paidInvoiceNumber) {
    await emitTimelineEvent({
      organizationId: orgId,
      type: 'invoice.paid',
      title: `Invoice ${paidInvoiceNumber} paid`,
      description: `Invoice ${paidInvoiceNumber} (${paidInvoiceTotal > 0 ? `₹${paidInvoiceTotal.toLocaleString('en-IN')}` : 'fully settled'}) cleared by ${input.partyName}.`,
      actor,
      metadata: {
        invoiceId: input.invoiceId!, invoiceNumber: paidInvoiceNumber,
        amount: paidInvoiceTotal, paymentId: payment.id, partyName: input.partyName,
        paymentMode: input.paymentMode, paymentDate: input.paymentDate,
      },
      severity: 'success',
    });
  }

  try {
    await db.activity.create({
      data: {
        firmId: orgId,
        type: 'payment',
        description: `${input.partyType === 'vendor' ? 'Vendor' : 'Customer'} payment ₹${paymentAmount} — ${input.partyName}`,
        metadata: JSON.stringify({ paymentId: payment.id, invoiceId: input.invoiceId ?? null }),
      },
    });
  } catch { /* non-fatal */ }

  return { ok: true, data: { ...toRecord(payment), invoiceNowPaid, paidInvoiceNumber }, status: 201 };
}

/**
 * Mark an invoice as fully paid in one step. Creates a payment record for the
 * outstanding balance and flips the invoice to paymentStatus=paid. Useful for
 * "mark this invoice as paid" commands.
 */
export async function markInvoicePaid(
  orgId: string,
  invoiceId: string,
  paymentMode: string,
  paymentDate?: string,
  referenceNo?: string,
  actor?: Actor,
): Promise<ServiceResult<PaymentRecord>> {
  if (!invoiceId) return { ok: false, error: 'invoiceId is required', status: 400 };
  if (!paymentMode) return { ok: false, error: 'paymentMode is required', status: 400 };

  const invoice = await db.invoice.findUnique({ where: { id: invoiceId }, include: { client: true } }).catch(() => null);
  if (!invoice) return { ok: false, error: 'Invoice not found', status: 404 };

  const balance = invoice.balanceAmount ?? invoice.totalAmount ?? 0;
  if (balance <= 0) {
    return { ok: false, error: `Invoice ${invoice.invoiceNumber} has no outstanding balance`, status: 400 };
  }

  const date = paymentDate ?? new Date().toISOString().split('T')[0];
  const partyName = invoice.client?.tradeName ?? invoice.buyerName ?? 'Customer';

  const result = await recordPayment(
    orgId,
    {
      clientId: invoice.clientId,
      partyName,
      partyType: 'customer',
      amount: balance,
      paymentDate: date,
      paymentMode,
      referenceNo,
      invoiceId,
    },
    actor,
  );

  if (!result.ok || !result.data) {
    return { ok: false, error: result.error ?? 'Failed to record payment', status: result.status ?? 500 };
  }

  // Strip the extra fields — caller just wants the payment record
  const { invoiceNowPaid: _i, paidInvoiceNumber: _p, ...payment } = result.data;
  return { ok: true, data: payment, status: 201 };
}

/**
 * Issue a refund for a payment. Creates a new payment record with negative
 * amount (or a vendor payment for refunds) and adjusts the linked invoice's
 * balance back up if applicable. Returns the refund payment record.
 */
export async function refundPayment(
  orgId: string,
  paymentId: string,
  reason?: string,
  actor?: Actor,
): Promise<ServiceResult<PaymentRecord>> {
  if (!paymentId) return { ok: false, error: 'paymentId is required', status: 400 };

  const original = await db.payment.findUnique({ where: { id: paymentId } }).catch(() => null);
  if (!original) return { ok: false, error: 'Payment not found', status: 404 };

  const refund = await db.payment.create({
    data: {
      clientId: original.clientId ?? null,
      invoiceId: original.invoiceId ?? null,
      partyName: original.partyName,
      partyType: original.partyType === 'vendor' ? 'customer' : 'vendor',
      amount: original.amount,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMode: original.paymentMode,
      referenceNo: `REFUND-${original.referenceNo ?? original.id.slice(-6)}`,
      status: 'completed',
      reconciled: false,
      notes: `Refund of payment ${original.id}${reason ? ` — ${reason}` : ''}`,
    },
    select: {
      id: true, clientId: true, invoiceId: true, partyName: true, partyType: true,
      amount: true, paymentDate: true, paymentMode: true, referenceNo: true,
      status: true, reconciled: true, notes: true,
    },
  });

  // If the original payment was linked to an invoice, recompute the invoice
  // balance (the refund increases the outstanding amount).
  if (original.invoiceId) {
    const invoice = await db.invoice.findUnique({ where: { id: original.invoiceId } }).catch(() => null);
    if (invoice) {
      const newPaid = Math.max(0, (invoice.paidAmount ?? 0) - original.amount);
      const total = invoice.totalAmount ?? 0;
      const balance = Math.max(0, total - newPaid);
      let paymentStatus = 'unpaid';
      if (balance <= 0) paymentStatus = 'paid';
      else if (newPaid > 0) paymentStatus = 'partial';
      await db.invoice.update({
        where: { id: original.invoiceId },
        data: { paidAmount: newPaid, balanceAmount: balance, paymentStatus },
      }).catch(() => {});
    }
  }

  await db.auditLog.create({
    data: {
      clientId: original.clientId ?? null,
      action: 'Payment Refunded',
      entity: 'payment',
      entityId: refund.id,
      details: `Refund ₹${original.amount} issued for payment ${original.id} — ${original.partyName}${reason ? ` (${reason})` : ''}`,
    },
  }).catch(() => {});

  graphEvents.paymentMade(refund.id, refund.partyName, refund.amount);

  await emitTimelineEvent({
    organizationId: orgId,
    type: 'payment.refunded',
    title: `Refund ₹${original.amount.toLocaleString('en-IN')} issued`,
    description: `Refund to ${original.partyName}${original.invoiceId ? ` (invoice adjusted)` : ''}${reason ? ` — ${reason}` : ''}.`,
    actor,
    metadata: {
      refundId: refund.id, originalPaymentId: original.id, amount: original.amount,
      partyName: original.partyName, invoiceId: original.invoiceId ?? null, reason: reason ?? null,
    },
    severity: 'warning',
  });

  try {
    await db.activity.create({
      data: {
        firmId: orgId,
        type: 'payment',
        description: `Refund ₹${original.amount} issued to ${original.partyName}`,
        metadata: JSON.stringify({ refundId: refund.id, originalPaymentId: original.id }),
      },
    });
  } catch { /* non-fatal */ }

  return { ok: true, data: toRecord(refund), status: 201 };
}
