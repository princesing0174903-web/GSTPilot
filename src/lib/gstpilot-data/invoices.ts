// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Invoices Firestore Service
//
// CRUD + real-time subscription for invoice documents at:
//   organizations/GSTpilot_SAAS/invoices/{invoiceId}
//
// All money fields (subtotal, taxableValue, cgst, sgst, igst, totalTax,
// grandTotal, balanceDue, isIntraState, per-line amounts) are derived here
// via calculateInvoiceTotals(). The UI NEVER computes totals.
//
// Invoice numbering is atomic: a counter document at
//   organizations/GSTpilot_SAAS/invoices/_counter/invoiceCounter
// is incremented inside a Firestore transaction so concurrent creates
// never collide.
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
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { INVOICES_COLLECTION } from './config';
import {
  calculateInvoiceTotals,
  derivePaymentStatus,
  deriveInvoiceStatus,
} from './gst';
import type {
  Invoice,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  InvoiceStats,
  InvoiceLineItem,
  InvoiceStatus,
  PaymentStatus,
} from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COUNTER_DOC = `${INVOICES_COLLECTION}/_counter/invoiceCounter`;

function ts(v: unknown): string | null {
  if (v && typeof v === 'object' && 'toDate' in v) {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof v === 'string') return v;
  return null;
}

function toLineItem(raw: Record<string, unknown>): InvoiceLineItem {
  return {
    id: String(raw.id ?? ''),
    productId: (raw.productId as string | null) ?? null,
    description: String(raw.description ?? ''),
    hsnSac: String(raw.hsnSac ?? ''),
    quantity: Number(raw.quantity ?? 0),
    unit: (raw.unit as InvoiceLineItem['unit']) ?? 'NOS',
    unitPrice: Number(raw.unitPrice ?? 0),
    discount: Number(raw.discount ?? 0),
    gstRate: Number(raw.gstRate ?? 0),
    taxableValue: Number(raw.taxableValue ?? 0),
    cgst: Number(raw.cgst ?? 0),
    sgst: Number(raw.sgst ?? 0),
    igst: Number(raw.igst ?? 0),
    amount: Number(raw.amount ?? 0),
  };
}

function toInvoice(id: string, raw: Record<string, unknown>): Invoice {
  const items = Array.isArray(raw.items)
    ? (raw.items as Array<Record<string, unknown>>).map(toLineItem)
    : [];
  return {
    id,
    invoiceNumber: String(raw.invoiceNumber ?? ''),
    status: (raw.status as InvoiceStatus) ?? 'draft',
    paymentStatus: (raw.paymentStatus as PaymentStatus) ?? 'unpaid',
    customerId: (raw.customerId as string | null) ?? null,
    customerName: String(raw.customerName ?? ''),
    customerGstin: (raw.customerGstin as string | null) ?? null,
    customerAddress: (raw.customerAddress as string | null) ?? null,
    customerState: (raw.customerState as string | null) ?? null,
    customerStateCode: (raw.customerStateCode as string | null) ?? null,
    sellerName: String(raw.sellerName ?? ''),
    sellerGstin: (raw.sellerGstin as string | null) ?? null,
    sellerAddress: (raw.sellerAddress as string | null) ?? null,
    sellerStateCode: (raw.sellerStateCode as string | null) ?? null,
    invoiceDate: String(raw.invoiceDate ?? new Date().toISOString().slice(0, 10)),
    dueDate: (raw.dueDate as string | null) ?? null,
    items,
    subtotal: Number(raw.subtotal ?? 0),
    discount: Number(raw.discount ?? 0),
    taxableValue: Number(raw.taxableValue ?? 0),
    cgst: Number(raw.cgst ?? 0),
    sgst: Number(raw.sgst ?? 0),
    igst: Number(raw.igst ?? 0),
    totalTax: Number(raw.totalTax ?? 0),
    grandTotal: Number(raw.grandTotal ?? 0),
    paidAmount: Number(raw.paidAmount ?? 0),
    balanceDue: Number(raw.balanceDue ?? 0),
    isIntraState: Boolean(raw.isIntraState ?? false),
    notes: (raw.notes as string | null) ?? null,
    privateNotes: (raw.privateNotes as string | null) ?? null,
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

/**
 * Atomically generate the next invoice number.
 * Format: INV-YYYY-NNNN  (e.g. INV-2025-0001).
 * Uses a Firestore transaction on a counter document so concurrent
 * creates never produce duplicate numbers.
 */
async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const counterRef = doc(db, COUNTER_DOC);

  const seq = await runTransaction(db, async (txn) => {
    const counterSnap = await txn.get(counterRef);
    const yearKey = `y${year}`;
    const data = (counterSnap.data() ?? {}) as Record<string, unknown>;
    // Reset sequence if the year rolled over.
    const storedYear = Number(data.year ?? year);
    const current = storedYear === year ? Number(data[yearKey] ?? 0) : 0;
    const next = current + 1;
    txn.set(
      counterRef,
      { year, [yearKey]: next, updatedAt: serverTimestamp() },
      { merge: true },
    );
    return next;
  });

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Subscribe to ALL invoices in real-time (onSnapshot), newest first.
 */
export function subscribeInvoices(
  onData: (invoices: Invoice[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, INVOICES_COLLECTION),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: Invoice[] = [];
      snap.forEach((d) => {
        const raw = d.data() as Record<string, unknown>;
        // Skip the counter document (it lives in the same collection).
        if (d.id === '_counter') return;
        list.push(toInvoice(d.id, raw));
      });
      onData(list);
    },
    (err) => onError?.(err as Error),
  );
}

/** Fetch a single invoice by id. */
export async function getInvoice(id: string): Promise<Invoice | null> {
  const snap = await getDoc(doc(db, INVOICES_COLLECTION, id));
  if (!snap.exists()) return null;
  return toInvoice(snap.id, snap.data() as Record<string, unknown>);
}

/**
 * Fetch ALL invoices in one shot (server-side / API-route friendly).
 * Skips the internal `_counter` document. Returns an empty array on
 * permission-denied / unavailable (preview mode).
 */
export async function getInvoicesOnce(): Promise<Invoice[]> {
  try {
    const q = query(collection(db, INVOICES_COLLECTION), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const list: Invoice[] = [];
    snap.forEach((d) => {
      if (d.id === '_counter') return;
      list.push(toInvoice(d.id, d.data() as Record<string, unknown>));
    });
    return list;
  } catch {
    return [];
  }
}

/**
 * Create a new invoice.
 *  • Generates the invoice number atomically.
 *  • Computes ALL money fields server-side via calculateInvoiceTotals.
 *  • Derives isIntraState from seller/customer state codes.
 *  • Derives paymentStatus + invoice status.
 */
export async function createInvoice(
  input: CreateInvoiceInput,
): Promise<Invoice> {
  if (!input.sellerName?.trim()) {
    throw new Error('Seller name is required.');
  }
  if (!input.items || input.items.length === 0) {
    throw new Error('At least one line item is required.');
  }

  const totals = calculateInvoiceTotals({
    items: input.items,
    sellerStateCode: input.sellerStateCode ?? null,
    customerStateCode: input.customerStateCode ?? null,
    paidAmount: 0,
  });

  const paymentStatus: PaymentStatus = 'unpaid';
  const status: InvoiceStatus = 'draft';
  const invoiceNumber = await nextInvoiceNumber();
  const today = new Date().toISOString().slice(0, 10);

  const payload = {
    invoiceNumber,
    status,
    paymentStatus,
    customerId: input.customerId ?? null,
    customerName: input.customerName?.trim() || 'Walk-in Customer',
    customerGstin: input.customerGstin?.trim().toUpperCase() || null,
    customerAddress: input.customerAddress?.trim() || null,
    customerState: input.customerState?.trim() || null,
    customerStateCode: input.customerStateCode?.trim() || null,
    sellerName: input.sellerName.trim(),
    sellerGstin: input.sellerGstin?.trim().toUpperCase() || null,
    sellerAddress: input.sellerAddress?.trim() || null,
    sellerStateCode: input.sellerStateCode?.trim() || null,
    invoiceDate: input.invoiceDate || today,
    dueDate: input.dueDate ?? null,
    items: totals.items,
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxableValue: totals.taxableValue,
    cgst: totals.cgst,
    sgst: totals.sgst,
    igst: totals.igst,
    totalTax: totals.totalTax,
    grandTotal: totals.grandTotal,
    paidAmount: 0,
    balanceDue: totals.grandTotal,
    isIntraState: totals.isIntraState,
    notes: input.notes?.trim() || null,
    privateNotes: input.privateNotes?.trim() || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, INVOICES_COLLECTION), payload);
  const snap = await getDoc(ref);
  return toInvoice(snap.id, snap.data() as Record<string, unknown>);
}

/**
 * Update an invoice. When items or state codes change, ALL totals are
 * recomputed. Status + paymentStatus are re-derived from the new totals.
 */
export async function updateInvoice(
  id: string,
  patch: UpdateInvoiceInput,
): Promise<Invoice> {
  const existing = await getInvoice(id);
  if (!existing) throw new Error('Invoice not found.');
  if (existing.status === 'cancelled') {
    throw new Error('Cancelled invoices cannot be edited.');
  }

  const update: Record<string, unknown> = { updatedAt: serverTimestamp() };

  // Merge scalar fields that were provided.
  if (patch.customerId !== undefined) update.customerId = patch.customerId;
  if (patch.customerName !== undefined) update.customerName = patch.customerName?.trim() || 'Walk-in Customer';
  if (patch.customerGstin !== undefined) update.customerGstin = patch.customerGstin?.trim().toUpperCase() || null;
  if (patch.customerAddress !== undefined) update.customerAddress = patch.customerAddress?.trim() || null;
  if (patch.customerState !== undefined) update.customerState = patch.customerState?.trim() || null;
  if (patch.customerStateCode !== undefined) update.customerStateCode = patch.customerStateCode?.trim() || null;
  if (patch.sellerName !== undefined) update.sellerName = patch.sellerName.trim();
  if (patch.sellerGstin !== undefined) update.sellerGstin = patch.sellerGstin?.trim().toUpperCase() || null;
  if (patch.sellerAddress !== undefined) update.sellerAddress = patch.sellerAddress?.trim() || null;
  if (patch.sellerStateCode !== undefined) update.sellerStateCode = patch.sellerStateCode?.trim() || null;
  if (patch.invoiceDate !== undefined) update.invoiceDate = patch.invoiceDate;
  if (patch.dueDate !== undefined) update.dueDate = patch.dueDate;
  if (patch.notes !== undefined) update.notes = patch.notes?.trim() || null;
  if (patch.privateNotes !== undefined) update.privateNotes = patch.privateNotes?.trim() || null;

  // Recompute totals if items OR state codes changed.
  const itemsChanged = patch.items !== undefined;
  const stateChanged =
    patch.sellerStateCode !== undefined || patch.customerStateCode !== undefined;
  const paidChanged = patch.paidAmount !== undefined;

  if (itemsChanged || stateChanged) {
    const items = patch.items ?? existing.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      description: it.description,
      hsnSac: it.hsnSac,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: it.unitPrice,
      discount: it.discount,
      gstRate: it.gstRate,
    }));
    const sellerStateCode = patch.sellerStateCode ?? existing.sellerStateCode;
    const customerStateCode = patch.customerStateCode ?? existing.customerStateCode;
    const totals = calculateInvoiceTotals({
      items,
      sellerStateCode,
      customerStateCode,
      paidAmount: paidChanged ? (patch.paidAmount ?? 0) : existing.paidAmount,
    });
    Object.assign(update, {
      items: totals.items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxableValue: totals.taxableValue,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      totalTax: totals.totalTax,
      grandTotal: totals.grandTotal,
      paidAmount: totals.paidAmount,
      balanceDue: totals.balanceDue,
      isIntraState: totals.isIntraState,
    });
    // Re-derive status fields unless caller forced them.
    if (patch.status === undefined) {
      const newPaid = totals.paidAmount;
      const ps = derivePaymentStatus(totals.grandTotal, newPaid);
      if (patch.paymentStatus === undefined) update.paymentStatus = ps;
      update.status = deriveInvoiceStatus(
        ps,
        patch.dueDate ?? existing.dueDate,
        existing.status,
      );
    }
  } else if (paidChanged) {
    const paidAmount = Math.max(0, Number(patch.paidAmount ?? 0));
    const ps = derivePaymentStatus(existing.grandTotal, paidAmount);
    update.paidAmount = paidAmount;
    update.balanceDue = Math.round((existing.grandTotal - paidAmount) * 100) / 100;
    if (patch.paymentStatus === undefined) update.paymentStatus = ps;
    if (patch.status === undefined) {
      update.status = deriveInvoiceStatus(ps, existing.dueDate, existing.status);
    }
  } else if (patch.status !== undefined) {
    update.status = patch.status;
  }
  if (patch.paymentStatus !== undefined) {
    update.paymentStatus = patch.paymentStatus;
  }

  await updateDoc(doc(db, INVOICES_COLLECTION, id), update);
  const snap = await getDoc(doc(db, INVOICES_COLLECTION, id));
  return toInvoice(snap.id, snap.data() as Record<string, unknown>);
}

/** Mark an invoice as fully or partially paid. */
export async function markInvoicePaid(
  id: string,
  amount?: number,
): Promise<Invoice> {
  const existing = await getInvoice(id);
  if (!existing) throw new Error('Invoice not found.');
  const paidAmount =
    amount == null ? existing.grandTotal : Math.max(0, Math.min(amount, existing.grandTotal));
  return updateInvoice(id, { paidAmount, status: paidAmount >= existing.grandTotal ? 'paid' : 'partial' });
}

/** Cancel an invoice. */
export async function cancelInvoice(id: string): Promise<Invoice> {
  return updateInvoice(id, { status: 'cancelled' });
}

/** Permanently delete an invoice. */
export async function deleteInvoice(id: string): Promise<void> {
  await deleteDoc(doc(db, INVOICES_COLLECTION, id));
}

// ─── Search + stats ──────────────────────────────────────────────────────────

/** Free-text filter over invoice number / customer name / customer gstin. */
export function searchInvoices(
  invoices: Invoice[],
  queryText: string,
): Invoice[] {
  const q = queryText.trim().toLowerCase();
  if (!q) return invoices;
  return invoices.filter((inv) =>
    [inv.invoiceNumber, inv.customerName, inv.customerGstin]
      .filter(Boolean)
      .some((field) => (field as string).toLowerCase().includes(q)),
  );
}

/** Aggregate invoices into stats (excludes cancelled). */
export function computeInvoiceStatsLocal(invoices: Invoice[]): InvoiceStats {
  const stats: InvoiceStats = {
    count: invoices.length,
    totalInvoiced: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    totalTaxCollected: 0,
    byStatus: {
      draft: 0,
      sent: 0,
      paid: 0,
      partial: 0,
      overdue: 0,
      cancelled: 0,
    },
  };
  for (const inv of invoices) {
    stats.byStatus[inv.status] = (stats.byStatus[inv.status] ?? 0) + 1;
    if (inv.status === 'cancelled') continue;
    stats.totalInvoiced += inv.grandTotal;
    stats.totalPaid += inv.paidAmount;
    stats.totalOutstanding += inv.balanceDue;
    stats.totalTaxCollected += inv.totalTax;
  }
  stats.totalInvoiced = Math.round(stats.totalInvoiced * 100) / 100;
  stats.totalPaid = Math.round(stats.totalPaid * 100) / 100;
  stats.totalOutstanding = Math.round(stats.totalOutstanding * 100) / 100;
  stats.totalTaxCollected = Math.round(stats.totalTaxCollected * 100) / 100;
  return stats;
}
