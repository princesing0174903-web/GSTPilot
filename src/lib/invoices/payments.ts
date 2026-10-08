// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Real Invoice Engine™ — Payment Execution Engine
// Record, reconcile, and analyze customer/vendor payments. Pure TypeScript.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Payment, PaymentDTO, PaymentListResult } from './types';
import { db } from '@/lib/db';

// ─── Pure utilities (re-exported from payments-utils for client-safe imports) ─
// These functions are Prisma-free. Client components should import them from
// '@/lib/invoices/payments-utils' to avoid pulling @prisma/client into the bundle.
export {
  recordPayment,
  autoReconcile,
  getPaymentStats,
  seedPayments,
  type RecordPaymentParams,
  type NewPayment,
  type ReconcileResult,
  type PaymentStatsResult,
} from './payments-utils';

import { round2 } from './payments-utils';

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

// ─── DB-backed list query ──────────────────────────────────────────────────────

/** Fetches payments from Prisma and maps them to the PaymentDTO shape. */
export async function getPayments(opts?: { limit?: number }): Promise<PaymentListResult> {
  const rows = await db.payment.findMany({
    take: opts?.limit ?? 500,
    orderBy: { createdAt: 'desc' },
  });
  const payments: PaymentDTO[] = rows.map((r) => ({
    id: r.id,
    direction: r.partyType === 'customer' ? 'incoming' : 'outgoing',
    customerName: r.partyType === 'customer' ? r.partyName : null,
    vendorName: r.partyType === 'vendor' ? r.partyName : null,
    amount: r.amount,
    paidAt: r.paymentDate,
    mode: r.paymentMode,
    referenceNo: r.referenceNo ?? null,
    reconciled: r.reconciled,
    status: r.status,
    invoiceId: r.invoiceId ?? null,
  }));
  const incoming = payments.filter((p) => p.direction === 'incoming');
  const outgoing = payments.filter((p) => p.direction === 'outgoing');
  const totalIncoming = sum(incoming.map((p) => p.amount));
  const totalOutgoing = sum(outgoing.map((p) => p.amount));
  const reconciledCount = payments.filter((p) => p.reconciled).length;
  const unreconciledCount = payments.length - reconciledCount;
  const reconciliationRatePct = payments.length > 0
    ? Math.round((reconciledCount / payments.length) * 100)
    : 0;
  return {
    payments,
    total: payments.length,
    totalIncoming: round2(totalIncoming),
    totalOutgoing: round2(totalOutgoing),
    incomingCount: incoming.length,
    outgoingCount: outgoing.length,
    reconciliationRatePct,
    reconciledCount,
    unreconciledCount,
    hasLiveData: payments.length > 0,
  };
}
