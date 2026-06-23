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

// ─── Seed data: 10 mock payments ──────────────────────────────────────────────

const PAYMENT_SEED: Array<Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    clientId: 'seed-client-1',
    invoiceId: 'seed-inv-1',
    purchaseBillId: null,
    partyName: 'Infosys Limited',
    partyType: 'customer',
    amount: 531000,
    paymentDate: '2025-04-28',
    paymentMode: 'bank',
    referenceNo: 'UTR123456789012',
    status: 'completed',
    reconciled: true,
    notes: 'Annual retainer settlement',
  },
  {
    clientId: 'seed-client-1',
    invoiceId: 'seed-inv-2',
    purchaseBillId: null,
    partyName: 'Tata Consultancy Services',
    partyType: 'customer',
    amount: 200000,
    paymentDate: '2025-05-30',
    paymentMode: 'upi',
    referenceNo: 'UPI-9988776655',
    status: 'completed',
    reconciled: true,
    notes: 'First installment — INV-2025-002',
  },
  {
    clientId: 'seed-client-1',
    invoiceId: null,
    purchaseBillId: 'seed-pb-1',
    partyName: 'Tata Communications Ltd',
    partyType: 'vendor',
    amount: 171100,
    paymentDate: '2025-05-12',
    paymentMode: 'bank',
    referenceNo: 'NEFT-223344556',
    status: 'completed',
    reconciled: true,
    notes: 'MPLS lease payment',
  },
  {
    clientId: 'seed-client-1',
    invoiceId: 'seed-inv-4',
    purchaseBillId: null,
    partyName: 'Zoho Corporation Pvt Ltd',
    partyType: 'customer',
    amount: 112100,
    paymentDate: '2025-08-01',
    paymentMode: 'bank',
    referenceNo: 'UTR998877665544',
    status: 'completed',
    reconciled: true,
    notes: 'SaaS integration — full settlement',
  },
  {
    clientId: 'seed-client-1',
    invoiceId: null,
    purchaseBillId: 'seed-pb-2',
    partyName: 'Reliance Jio Infocomm',
    partyType: 'vendor',
    amount: 45430,
    paymentDate: '2025-06-04',
    paymentMode: 'upi',
    referenceNo: 'UPI-5566778899',
    status: 'completed',
    reconciled: true,
    notes: 'Internet leased line',
  },
  {
    clientId: 'seed-client-1',
    invoiceId: null,
    purchaseBillId: 'seed-pb-4',
    partyName: 'Amazon Web Services India',
    partyType: 'vendor',
    amount: 108560,
    paymentDate: '2025-07-31',
    paymentMode: 'card',
    referenceNo: 'CARD-4321',
    status: 'completed',
    reconciled: true,
    notes: 'AWS July consumption',
  },
  {
    clientId: 'seed-client-2',
    invoiceId: 'seed-inv-6',
    purchaseBillId: null,
    partyName: 'Bharti Airtel Limited',
    partyType: 'customer',
    amount: 750000,
    paymentDate: '2025-09-20',
    paymentMode: 'bank',
    referenceNo: 'UTR556677889900',
    status: 'completed',
    reconciled: true,
    notes: '50% advance — managed services',
  },
  {
    clientId: 'seed-client-2',
    invoiceId: null,
    purchaseBillId: 'seed-pb-6',
    partyName: 'Tata Steel Ltd',
    partyType: 'vendor',
    amount: 2183000,
    paymentDate: '2025-10-09',
    paymentMode: 'bank',
    referenceNo: 'RTGS-889900112233',
    status: 'completed',
    reconciled: true,
    notes: 'Steel coils procurement',
  },
  {
    clientId: 'seed-client-1',
    invoiceId: 'seed-inv-10',
    purchaseBillId: null,
    partyName: 'Zoho Corporation Pvt Ltd',
    partyType: 'customer',
    amount: 92040,
    paymentDate: '2026-02-25',
    paymentMode: 'upi',
    referenceNo: 'UPI-1122334455',
    status: 'completed',
    reconciled: true,
    notes: 'Feature add-on early settlement',
  },
  {
    clientId: 'seed-client-1',
    invoiceId: null,
    purchaseBillId: 'seed-pb-9',
    partyName: 'Tata Power Ltd',
    partyType: 'vendor',
    amount: 92512,
    paymentDate: '2025-12-28',
    paymentMode: 'bank',
    referenceNo: 'NEFT-998877665',
    status: 'completed',
    reconciled: true,
    notes: 'December electricity bill',
  },
];

export function seedPayments(): Payment[] {
  const nowIso = new Date().toISOString();
  return PAYMENT_SEED.map((row, idx) => ({
    ...row,
    id: `seed-pay-${idx + 1}`,
    createdAt: nowIso,
    updatedAt: nowIso,
  }));
}

// ─── helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
