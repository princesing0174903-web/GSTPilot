// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Invoice Engine™ — Payment Execution Engine
// Record, reconcile, and analyze customer/vendor payments. Pure TypeScript.
// ═══════════════════════════════════════════════════════════════════════════════

import type { InvoiceCloudInvoice, Payment } from './types';

// ─── Record payment ───────────────────────────────────────────────────────────

export interface RecordPaymentParams {
  invoiceId?: string;
  purchaseBillId?: string;
  partyName: string;
  partyType: 'customer' | 'vendor';
  amount: number;
  paymentMode: string;
  referenceNo?: string;
}

export type NewPayment = Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Builds a new Payment entity ready for insertion. Defaults: status 'completed',
 * reconciled false, paymentDate today (ISO), clientId null.
 */
export function recordPayment(params: RecordPaymentParams): NewPayment {
  return {
    clientId: null,
    invoiceId: params.invoiceId ?? null,
    purchaseBillId: params.purchaseBillId ?? null,
    partyName: params.partyName,
    partyType: params.partyType,
    amount: round2(params.amount),
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMode: params.paymentMode,
    referenceNo: params.referenceNo ?? null,
    status: 'completed',
    reconciled: false,
    notes: null,
  };
}

// ─── Auto-reconciliation ──────────────────────────────────────────────────────

export interface ReconcileResult {
  matched: boolean;
  matchedInvoiceId?: string;
  confidence: number; // 0-1
}

/**
 * Attempts to auto-match a payment against outstanding sales invoices by
 * amount and fuzzy party-name match. Scoring: exact amount (+0.6), amount
 * within ₹50 (+0.45), party name contains payment.partyName (case-insensitive,
 * +0.35) or vice versa (+0.25). Threshold for match: confidence ≥ 0.7.
 */
export function autoReconcile(payment: Payment, invoices: InvoiceCloudInvoice[]): ReconcileResult {
  let best: ReconcileResult = { matched: false, confidence: 0 };
  const payeeLower = payment.partyName.toLowerCase();
  for (const inv of invoices) {
    if (inv.paymentStatus === 'paid') continue;
    let score = 0;
    if (Math.abs(payment.amount - inv.balanceAmount) <= 0.5) score += 0.6;
    else if (Math.abs(payment.amount - inv.totalAmount) <= 50) score += 0.45;
    const buyer = (inv.buyerName ?? '').toLowerCase();
    if (buyer && payeeLower && (buyer.includes(payeeLower) || payeeLower.includes(buyer))) {
      score += 0.35;
    } else if (buyer && payeeLower && buyer.slice(0, 5) === payeeLower.slice(0, 5)) {
      score += 0.25;
    }
    if (score > best.confidence) {
      best = { matched: score >= 0.7, matchedInvoiceId: score >= 0.7 ? inv.id : undefined, confidence: round2(score) };
    }
  }
  return best;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface PaymentStatsResult {
  totalInflow: number;
  totalOutflow: number;
  netFlow: number;
  byMode: Record<string, number>;
}

export function getPaymentStats(payments: Payment[]): PaymentStatsResult {
  let totalInflow = 0;
  let totalOutflow = 0;
  const byMode: Record<string, number> = {};
  for (const p of payments) {
    byMode[p.paymentMode] = round2((byMode[p.paymentMode] ?? 0) + p.amount);
    if (p.partyType === 'customer') totalInflow += p.amount;
    else totalOutflow += p.amount;
  }
  return {
    totalInflow: round2(totalInflow),
    totalOutflow: round2(totalOutflow),
    netFlow: round2(totalInflow - totalOutflow),
    byMode,
  };
}

// ─── Seed data ───────────────────────────────────────────────────────────────
// Mock/demo payment seed data has been REMOVED. Firestore is the only source
// of truth for payments: organizations/GSTpilot_SAAS/payments (see
// @/lib/gstpilot-data). This function is retained for backward-compatible
// imports but returns an empty array — no fabricated records.

export function seedPayments(): Payment[] {
  return [];
}

// ─── helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
