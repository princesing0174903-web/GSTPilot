// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Payments Firestore Service
//
// CRUD + real-time subscription for payment documents at:
//   organizations/GSTpilot_SAAS/payments/{paymentId}
//
// When a payment is created and linked to an invoice (partyType === 'customer'
// with invoiceId, status 'completed'), the linked invoice's paidAmount,
// balanceDue, paymentStatus and status are automatically updated via the
// invoices service — so the outstanding balance is always recalculated.
//
// Firestore is the ONLY source of truth. No mock data, no localStorage.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PAYMENTS_COLLECTION } from './config';
import { getInvoice, updateInvoice } from './invoices';
import type {
  Payment,
  CreatePaymentInput,
  UpdatePaymentInput,
  PaymentStats,
  PartyType,
  PaymentMode,
  PaymentTxStatus,
} from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PAYMENT_MODES: PaymentMode[] = ['cash', 'upi', 'bank', 'card', 'cheque', 'other'];
const PAYMENT_STATUSES: PaymentTxStatus[] = ['completed', 'pending', 'failed'];
const PARTY_TYPES: PartyType[] = ['customer', 'vendor'];

function normalizePaymentMode(v: unknown): PaymentMode {
  const s = String(v ?? 'other') as PaymentMode;
  return PAYMENT_MODES.includes(s) ? s : 'other';
}

function normalizePaymentStatus(v: unknown): PaymentTxStatus {
  const s = String(v ?? 'completed') as PaymentTxStatus;
  return PAYMENT_STATUSES.includes(s) ? s : 'completed';
}

function normalizePartyType(v: unknown): PartyType {
  const s = String(v ?? 'customer') as PartyType;
  return PARTY_TYPES.includes(s) ? s : 'customer';
}

function toPayment(id: string, raw: Record<string, unknown>): Payment {
  const ts = (v: unknown): string | null => {
    if (v && typeof v === 'object' && 'toDate' in v) {
      return (v as { toDate: () => Date }).toDate().toISOString();
    }
    if (typeof v === 'string') return v;
    return null;
  };
  return {
    id,
    partyType: normalizePartyType(raw.partyType),
    partyId: (raw.partyId as string | null) ?? null,
    partyName: String(raw.partyName ?? ''),
    invoiceId: (raw.invoiceId as string | null) ?? null,
    invoiceNumber: (raw.invoiceNumber as string | null) ?? null,
    amount: Number(raw.amount ?? 0),
    paymentDate: String(raw.paymentDate ?? new Date().toISOString().slice(0, 10)),
    paymentMode: normalizePaymentMode(raw.paymentMode),
    referenceNo: (raw.referenceNo as string | null) ?? null,
    status: normalizePaymentStatus(raw.status),
    reconciled: Boolean(raw.reconciled ?? false),
    notes: (raw.notes as string | null) ?? null,
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

function buildPayload(input: CreatePaymentInput) {
  return {
    partyType: input.partyType ?? 'customer',
    partyId: input.partyId?.trim() || null,
    partyName: input.partyName?.trim() || '',
    invoiceId: input.invoiceId?.trim() || null,
    invoiceNumber: input.invoiceNumber?.trim() || null,
    amount: Math.max(0, Number(input.amount ?? 0)),
    paymentDate: input.paymentDate || new Date().toISOString().slice(0, 10),
    paymentMode: input.paymentMode ?? 'other',
    referenceNo: input.referenceNo?.trim() || null,
    status: input.status ?? 'completed',
    reconciled: input.reconciled ?? false,
    notes: input.notes?.trim() || null,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function subscribePayments(
  onData: (payments: Payment[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, PAYMENTS_COLLECTION), orderBy('paymentDate', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const list: Payment[] = [];
      snap.forEach((d) => list.push(toPayment(d.id, d.data() as Record<string, unknown>)));
      onData(list);
    },
    (err) => onError?.(err as Error),
  );
}

export async function getPayment(id: string): Promise<Payment | null> {
  const snap = await getDoc(doc(db, PAYMENTS_COLLECTION, id));
  if (!snap.exists()) return null;
  return toPayment(snap.id, snap.data() as Record<string, unknown>);
}

export async function getPaymentsOnce(): Promise<Payment[]> {
  try {
    const q = query(collection(db, PAYMENTS_COLLECTION), orderBy('paymentDate', 'desc'));
    const snap = await getDocs(q);
    const list: Payment[] = [];
    snap.forEach((d) => list.push(toPayment(d.id, d.data() as Record<string, unknown>)));
    return list;
  } catch {
    return [];
  }
}

/**
 * Create a payment. If the payment is a completed customer payment linked to
 * an invoice, the invoice's paidAmount / balanceDue / paymentStatus / status
 * are recalculated automatically (outstanding balance updated).
 */
export async function createPayment(input: CreatePaymentInput): Promise<Payment> {
  if (!input.amount || Number(input.amount) <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }
  if (!input.partyName?.trim() && !input.partyId) {
    throw new Error('Payment party name is required.');
  }

  const payload = buildPayload(input);
  const now = serverTimestamp();
  const ref = await addDoc(collection(db, PAYMENTS_COLLECTION), {
    ...payload,
    createdAt: now,
    updatedAt: now,
  });

  // ── Auto-update the linked invoice's payment status + outstanding ──────
  if (
    payload.invoiceId &&
    payload.partyType === 'customer' &&
    payload.status === 'completed'
  ) {
    try {
      const inv = await getInvoice(payload.invoiceId);
      if (inv && inv.status !== 'cancelled') {
        const newPaid = Math.min(
          inv.grandTotal,
          Math.round((inv.paidAmount + payload.amount) * 100) / 100,
        );
        await updateInvoice(inv.id, { paidAmount: newPaid });
      }
    } catch {
      // Invoice update is best-effort — the payment record itself is saved.
    }
  }

  const snap = await getDoc(ref);
  return toPayment(snap.id, snap.data() as Record<string, unknown>);
}

export async function updatePayment(
  id: string,
  patch: UpdatePaymentInput,
): Promise<Payment> {
  const update: Record<string, unknown> = {};
  const built = buildPayload({
    partyType: patch.partyType ?? 'customer',
    amount: patch.amount ?? 0,
    partyName: patch.partyName ?? '__NOOP__',
    ...patch,
  } as CreatePaymentInput);
  if (patch.partyType !== undefined) update.partyType = built.partyType;
  if (patch.partyId !== undefined) update.partyId = built.partyId;
  if (patch.partyName !== undefined) update.partyName = built.partyName;
  if (patch.invoiceId !== undefined) update.invoiceId = built.invoiceId;
  if (patch.invoiceNumber !== undefined) update.invoiceNumber = built.invoiceNumber;
  if (patch.amount !== undefined) update.amount = built.amount;
  if (patch.paymentDate !== undefined) update.paymentDate = built.paymentDate;
  if (patch.paymentMode !== undefined) update.paymentMode = built.paymentMode;
  if (patch.referenceNo !== undefined) update.referenceNo = built.referenceNo;
  if (patch.status !== undefined) update.status = built.status;
  if (patch.reconciled !== undefined) update.reconciled = built.reconciled;
  if (patch.notes !== undefined) update.notes = built.notes;
  update.updatedAt = serverTimestamp();

  await updateDoc(doc(db, PAYMENTS_COLLECTION, id), update);
  const snap = await getDoc(doc(db, PAYMENTS_COLLECTION, id));
  return toPayment(snap.id, snap.data() as Record<string, unknown>);
}

export async function deletePayment(id: string): Promise<void> {
  await deleteDoc(doc(db, PAYMENTS_COLLECTION, id));
}

// ─── Search + stats ──────────────────────────────────────────────────────────

export function searchPayments(payments: Payment[], queryText: string): Payment[] {
  const q = queryText.trim().toLowerCase();
  if (!q) return payments;
  return payments.filter((p) =>
    [p.partyName, p.referenceNo, p.invoiceNumber, p.paymentMode, p.status, p.partyType]
      .filter(Boolean)
      .some((field) => (field as string).toLowerCase().includes(q)),
  );
}

export function computePaymentStatsLocal(payments: Payment[]): PaymentStats {
  const stats: PaymentStats = {
    count: payments.length,
    totalReceived: 0,
    totalPaidOut: 0,
    totalReconciled: 0,
  };
  for (const p of payments) {
    if (p.status !== 'completed') continue;
    if (p.partyType === 'customer') stats.totalReceived += p.amount;
    else stats.totalPaidOut += p.amount;
    if (p.reconciled) stats.totalReconciled += p.amount;
  }
  stats.totalReceived = Math.round(stats.totalReceived * 100) / 100;
  stats.totalPaidOut = Math.round(stats.totalPaidOut * 100) / 100;
  stats.totalReconciled = Math.round(stats.totalReconciled * 100) / 100;
  return stats;
}
