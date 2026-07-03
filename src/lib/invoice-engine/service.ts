// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Invoice Engine™ — Service Layer
//
// The single entry point for all invoice operations. Every function is:
//   • Multi-tenant — filters on `organizationId`, never crosses org boundaries
//   • Atomic — invoice numbering uses a Firestore transaction so concurrent
//     creates never collide
//   • Calculated — all money fields are derived here via calculateInvoiceTotals;
//     the UI never computes totals
//   • Real-time — listInvoices supports an onSnapshot subscription
//
// Firestore collection: invoices/{invoiceId}
// Security: firestore.rules enforce org isolation server-side; we double-check
// client-side so a bug can never leak another org's invoice.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  runTransaction,
  type Unsubscribe,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  calculateInvoiceTotals,
  computeLineItem,
  computeBalanceDue,
  derivePaymentStatus,
  deriveInvoiceStatus,
} from './calculations';
import type {
  Invoice,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  InvoiceStatus,
  PaymentStatus,
  InvoiceStats,
} from './types';
import { computeInvoiceStats } from './calculations';

const COLLECTION = 'invoices';

// ─── Org guard ───────────────────────────────────────────────────────────────

function assertOrg(orgId: string | undefined | null): void {
  if (!orgId) {
    throw new Error(
      'You must belong to an organization to manage invoices.',
    );
  }
}

// ─── Timestamp conversion ────────────────────────────────────────────────────

/**
 * Convert a Firestore snapshot into a typed Invoice.
 * Timestamps become ISO strings; numbers stay numbers; arrays stay arrays.
 */
function toInvoice(id: string, raw: Record<string, unknown>): Invoice {
  const convert = (value: unknown): unknown => {
    if (value && typeof value === 'object' && 'toDate' in value) {
      return (value as { toDate: () => Date }).toDate().toISOString();
    }
    return value;
  };

  const items = Array.isArray(raw.items)
    ? (raw.items as Array<Record<string, unknown>>).map((it) => ({
        id: String(it.id ?? ''),
        description: String(it.description ?? ''),
        hsnSac: String(it.hsnSac ?? ''),
        quantity: Number(it.quantity ?? 0),
        unit: String(it.unit ?? 'NOS'),
        unitPrice: Number(it.unitPrice ?? 0),
        discount: Number(it.discount ?? 0),
        gstRate: Number(it.gstRate ?? 0),
        taxableValue: Number(it.taxableValue ?? 0),
        cgst: Number(it.cgst ?? 0),
        sgst: Number(it.sgst ?? 0),
        igst: Number(it.igst ?? 0),
        amount: Number(it.amount ?? 0),
      }))
    : [];

  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    invoiceNumber: String(raw.invoiceNumber ?? ''),
    customerId: (raw.customerId as string | null) ?? null,
    customerName: String(raw.customerName ?? ''),
    customerGstin: (raw.customerGstin as string | null) ?? null,
    customerAddress: (raw.customerAddress as string | null) ?? null,
    customerState: (raw.customerState as string | null) ?? null,
    customerStateCode: (raw.customerStateCode as string | null) ?? null,
    sellerName: String(raw.sellerName ?? ''),
    sellerGstin: String(raw.sellerGstin ?? ''),
    sellerAddress: (raw.sellerAddress as string | null) ?? null,
    sellerStateCode: (raw.sellerStateCode as string | null) ?? null,
    status: (raw.status as InvoiceStatus) ?? 'draft',
    paymentStatus: (raw.paymentStatus as PaymentStatus) ?? 'unpaid',
    invoiceDate: String(raw.invoiceDate ?? ''),
    dueDate: String(raw.dueDate ?? ''),
    items,
    subtotal: Number(raw.subtotal ?? 0),
    discount: Number(raw.discount ?? 0),
    taxableValue: Number(raw.taxableValue ?? 0),
    cgst: Number(raw.cgst ?? 0),
    sgst: Number(raw.sgst ?? 0),
    igst: Number(raw.igst ?? 0),
    cess: Number(raw.cess ?? 0),
    roundOff: Number(raw.roundOff ?? 0),
    grandTotal: Number(raw.grandTotal ?? 0),
    paidAmount: Number(raw.paidAmount ?? 0),
    balanceDue: Number(raw.balanceDue ?? 0),
    notes: (raw.notes as string | null) ?? null,
    terms: (raw.terms as string | null) ?? null,
    createdBy: raw.createdBy as Invoice['createdBy'],
    isInterState: Boolean(raw.isInterState ?? false),
    recurring: Boolean(raw.recurring ?? false),
    recurringCycle:
      (raw.recurringCycle as Invoice['recurringCycle']) ?? null,
    createdAt: convert(raw.createdAt) as string,
    updatedAt: convert(raw.updatedAt) as string,
  };
}

// ─── createInvoice ───────────────────────────────────────────────────────────

/**
 * Create a new invoice with server-calculated totals and an atomically
 * generated invoice number.
 *
 * The invoice number is generated inside a Firestore transaction that reads
 * all existing numbers for this org+year and picks max+1. This guarantees no
 * duplicates even under concurrent creates.
 *
 * If `input.invoiceNumber` is supplied, it's used as-is (caller takes
 * responsibility for uniqueness).
 */
export async function createInvoice(
  input: CreateInvoiceInput,
): Promise<Invoice> {
  assertOrg(input.organizationId);

  // Determine inter-state once — either explicit or derived from GSTIN state codes.
  const isInterState =
    typeof input.isInterState === 'boolean'
      ? input.isInterState
      : Boolean(
          input.sellerStateCode &&
            input.customerStateCode &&
            input.sellerStateCode !== input.customerStateCode,
        );

  // Compute line items + totals entirely on the backend.
  const items = input.items.map((it) => computeLineItem(it, isInterState));
  const totals = calculateInvoiceTotals(items, input.cess ?? 0);

  const paidAmount = 0;
  const balanceDue = computeBalanceDue(totals.grandTotal, paidAmount);
  const status: InvoiceStatus = 'draft';
  const paymentStatus = derivePaymentStatus(
    status,
    totals.grandTotal,
    paidAmount,
    input.dueDate,
  );

  // Atomic invoice-number generation inside a transaction.
  // If the caller supplied a number, skip the transaction.
  let invoiceNumber = input.invoiceNumber;
  if (!invoiceNumber) {
    // Atomic invoice-number generation via a per-org, per-year counter doc.
    // The counter lives at invoice_counters/{orgId}_{year} and is incremented
    // inside a Firestore transaction — this guarantees no two concurrent
    // creates ever receive the same number.
    const year = new Date().getFullYear();
    const counterRef = doc(
      db,
      'invoice_counters',
      `${input.organizationId}_${year}`,
    );
    invoiceNumber = await runTransaction(db, async (txn) => {
      const counterSnap = await txn.get(counterRef);
      const currentSeq =
        (counterSnap.data()?.nextSeq as number | undefined) ?? 0;
      const nextSeq = currentSeq + 1;
      if (counterSnap.exists()) {
        txn.update(counterRef, { nextSeq });
      } else {
        txn.set(counterRef, {
          organizationId: input.organizationId,
          year,
          nextSeq,
          createdAt: serverTimestamp(),
        });
      }
      return `INV-${year}-${String(nextSeq).padStart(6, '0')}`;
    });
  }

  const payload = {
    organizationId: input.organizationId,
    invoiceNumber,
    customerId: input.customerId ?? null,
    customerName: input.customerName,
    customerGstin: input.customerGstin ?? null,
    customerAddress: input.customerAddress ?? null,
    customerState: input.customerState ?? null,
    customerStateCode: input.customerStateCode ?? null,
    sellerName: input.sellerName,
    sellerGstin: input.sellerGstin,
    sellerAddress: input.sellerAddress ?? null,
    sellerStateCode: input.sellerStateCode ?? null,
    status,
    paymentStatus,
    invoiceDate: input.invoiceDate,
    dueDate: input.dueDate,
    items,
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxableValue: totals.taxableValue,
    cgst: totals.cgst,
    sgst: totals.sgst,
    igst: totals.igst,
    cess: totals.cess,
    roundOff: totals.roundOff,
    grandTotal: totals.grandTotal,
    paidAmount,
    balanceDue,
    notes: input.notes ?? null,
    terms: input.terms ?? null,
    createdBy: input.createdBy,
    isInterState,
    recurring: Boolean(input.recurring),
    recurringCycle: input.recurringCycle ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, COLLECTION), payload);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // Extremely unlikely — fall back to a client-constructed invoice.
    return {
      ...input,
      invoiceNumber: invoiceNumber!,
      id: ref.id,
      items,
      status,
      paymentStatus,
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxableValue: totals.taxableValue,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      cess: totals.cess,
      roundOff: totals.roundOff,
      grandTotal: totals.grandTotal,
      paidAmount,
      balanceDue,
      isInterState,
      recurring: Boolean(input.recurring),
      recurringCycle: input.recurringCycle ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Invoice;
  }
  return toInvoice(ref.id, snap.data() as Record<string, unknown>);
}

// ─── getInvoice ──────────────────────────────────────────────────────────────

/**
 * Fetch a single invoice by id, scoped to `organizationId`.
 * Returns `null` when the invoice doesn't exist OR belongs to another org.
 */
export async function getInvoice(
  id: string,
  organizationId: string,
): Promise<Invoice | null> {
  assertOrg(organizationId);
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;
  // Tenant guard — double-check client-side even though rules enforce it.
  if (data.organizationId !== organizationId) return null;
  return toInvoice(id, data);
}

// ─── listInvoices ────────────────────────────────────────────────────────────

/**
 * List all invoices for an organization, optionally filtered by status.
 * Ordered by `createdAt` descending (newest first).
 */
export async function listInvoices(
  organizationId: string,
  options?: {
    status?: InvoiceStatus;
    customerId?: string;
    paymentStatus?: PaymentStatus;
  },
): Promise<Invoice[]> {
  assertOrg(organizationId);

  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
  ];
  if (options?.status) {
    constraints.unshift(where('status', '==', options.status));
  }
  if (options?.paymentStatus) {
    constraints.unshift(where('paymentStatus', '==', options.paymentStatus));
  }
  if (options?.customerId) {
    constraints.unshift(where('customerId', '==', options.customerId));
  }

  const snap = await getDocs(query(collection(db, COLLECTION), ...constraints));
  return snap.docs.map((d) =>
    toInvoice(d.id, d.data() as Record<string, unknown>),
  );
}

// ─── updateInvoice ───────────────────────────────────────────────────────────

/**
 * Update an existing invoice. When `items` or tax-affecting fields change,
 * all totals are recomputed on the backend.
 *
 * `organizationId` is immutable. `createdAt` is never overwritten.
 */
export async function updateInvoice(
  id: string,
  organizationId: string,
  patch: UpdateInvoiceInput,
): Promise<Invoice> {
  assertOrg(organizationId);

  const existing = await getInvoice(id, organizationId);
  if (!existing) {
    throw new Error('Invoice not found in your workspace.');
  }

  const update: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  // Copy through simple fields.
  const simpleFields: Array<keyof UpdateInvoiceInput> = [
    'customerId',
    'customerName',
    'customerGstin',
    'customerAddress',
    'customerState',
    'customerStateCode',
    'sellerName',
    'sellerGstin',
    'sellerAddress',
    'sellerStateCode',
    'invoiceDate',
    'dueDate',
    'notes',
    'terms',
    'status',
    'recurring',
    'recurringCycle',
  ];
  for (const f of simpleFields) {
    if (patch[f] !== undefined) {
      update[f] = patch[f];
    }
  }

  // Recompute totals when items, inter-state, or cess change.
  const needsRecompute =
    patch.items !== undefined ||
    patch.isInterState !== undefined ||
    patch.cess !== undefined;

  if (needsRecompute) {
    const isInterState =
      patch.isInterState !== undefined ? patch.isInterState : existing.isInterState;
    const items = patch.items
      ? patch.items.map((it) => computeLineItem(it, isInterState))
      : existing.items;
    const cess = patch.cess !== undefined ? patch.cess : existing.cess;
    const totals = calculateInvoiceTotals(items, cess);
    const balanceDue = computeBalanceDue(totals.grandTotal, existing.paidAmount);
    const status: InvoiceStatus =
      patch.status !== undefined ? patch.status : existing.status;
    const paymentStatus = derivePaymentStatus(
      status,
      totals.grandTotal,
      existing.paidAmount,
      patch.dueDate ?? existing.dueDate,
    );

    Object.assign(update, {
      items,
      isInterState,
      cess: totals.cess,
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxableValue: totals.taxableValue,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      roundOff: totals.roundOff,
      grandTotal: totals.grandTotal,
      balanceDue,
      paymentStatus,
      status: deriveInvoiceStatus(status, paymentStatus),
    });
  } else if (patch.status !== undefined || patch.dueDate !== undefined) {
    // Status or due date changed without items — re-derive payment status.
    const status: InvoiceStatus =
      patch.status !== undefined ? patch.status : existing.status;
    const dueDate = patch.dueDate ?? existing.dueDate;
    const paymentStatus = derivePaymentStatus(
      status,
      existing.grandTotal,
      existing.paidAmount,
      dueDate,
    );
    update.paymentStatus = paymentStatus;
    update.status = deriveInvoiceStatus(status, paymentStatus);
  }

  await updateDoc(doc(db, COLLECTION, id), update);

  const updated = await getDoc(doc(db, COLLECTION, id));
  if (!updated.exists()) {
    throw new Error('Invoice could not be re-read after update.');
  }
  return toInvoice(id, updated.data() as Record<string, unknown>);
}

// ─── deleteInvoice ───────────────────────────────────────────────────────────

/**
 * Delete an invoice permanently. Read-first guard prevents cross-org deletion.
 */
export async function deleteInvoice(
  id: string,
  organizationId: string,
): Promise<void> {
  assertOrg(organizationId);
  const existing = await getInvoice(id, organizationId);
  if (!existing) {
    // Idempotent — already gone.
    return;
  }
  await deleteDoc(doc(db, COLLECTION, id));
}

// ─── duplicateInvoice ────────────────────────────────────────────────────────

/**
 * Create a copy of an invoice with a new number, reset status to 'draft',
 * and zero out paidAmount. The duplicate gets a fresh `createdAt`.
 */
export async function duplicateInvoice(
  sourceId: string,
  organizationId: string,
  createdBy: Invoice['createdBy'],
): Promise<Invoice> {
  assertOrg(organizationId);
  const source = await getInvoice(sourceId, organizationId);
  if (!source) {
    throw new Error('Invoice not found in your workspace.');
  }

  return createInvoice({
    organizationId,
    customerId: source.customerId,
    customerName: source.customerName,
    customerGstin: source.customerGstin,
    customerAddress: source.customerAddress,
    customerState: source.customerState,
    customerStateCode: source.customerStateCode,
    sellerName: source.sellerName,
    sellerGstin: source.sellerGstin,
    sellerAddress: source.sellerAddress,
    sellerStateCode: source.sellerStateCode,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: source.dueDate,
    items: source.items.map((it) => ({
      description: it.description,
      hsnSac: it.hsnSac,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: it.unitPrice,
      discount: it.discount,
      gstRate: it.gstRate,
    })),
    isInterState: source.isInterState,
    cess: source.cess,
    notes: source.notes,
    terms: source.terms,
    recurring: source.recurring,
    recurringCycle: source.recurringCycle,
    createdBy,
  });
}

// ─── markInvoicePaid ─────────────────────────────────────────────────────────

/**
 * Record a payment against an invoice. Sets paidAmount (optionally partial),
 * recomputes balanceDue, and derives the new payment + lifecycle status.
 *
 * Pass `amount = grandTotal` (or omit amount) to mark fully paid.
 */
export async function markInvoicePaid(
  id: string,
  organizationId: string,
  amount?: number,
): Promise<Invoice> {
  assertOrg(organizationId);
  const existing = await getInvoice(id, organizationId);
  if (!existing) {
    throw new Error('Invoice not found in your workspace.');
  }
  if (existing.status === 'cancelled') {
    throw new Error('Cannot mark a cancelled invoice as paid.');
  }

  const paidAmount =
    amount !== undefined
      ? Math.min(existing.grandTotal, existing.paidAmount + Math.max(0, amount))
      : existing.grandTotal;

  const balanceDue = computeBalanceDue(existing.grandTotal, paidAmount);
  const paymentStatus = derivePaymentStatus(
    existing.status === 'draft' ? 'sent' : existing.status,
    existing.grandTotal,
    paidAmount,
    existing.dueDate,
  );
  const status = deriveInvoiceStatus(
    existing.status === 'draft' ? 'sent' : existing.status,
    paymentStatus,
  );

  await updateDoc(doc(db, COLLECTION, id), {
    paidAmount,
    balanceDue,
    paymentStatus,
    status,
    updatedAt: serverTimestamp(),
  });

  const updated = await getDoc(doc(db, COLLECTION, id));
  return toInvoice(id, updated.data() as Record<string, unknown>);
}

// ─── cancelInvoice ───────────────────────────────────────────────────────────

/**
 * Cancel an invoice. Sets status + paymentStatus to 'cancelled'.
 * The invoice is preserved for audit — never deleted.
 */
export async function cancelInvoice(
  id: string,
  organizationId: string,
): Promise<Invoice> {
  assertOrg(organizationId);
  const existing = await getInvoice(id, organizationId);
  if (!existing) {
    throw new Error('Invoice not found in your workspace.');
  }
  if (existing.status === 'paid') {
    throw new Error('Cannot cancel a paid invoice. Contact support.');
  }

  await updateDoc(doc(db, COLLECTION, id), {
    status: 'cancelled',
    paymentStatus: 'cancelled',
    updatedAt: serverTimestamp(),
  });

  const updated = await getDoc(doc(db, COLLECTION, id));
  return toInvoice(id, updated.data() as Record<string, unknown>);
}

// ─── Real-time subscription ──────────────────────────────────────────────────

/**
 * Subscribe to live updates for an organization's invoices.
 * Returns an unsubscribe function. The callback fires immediately with the
 * current set, and again whenever any invoice in the org changes.
 */
export function subscribeToInvoices(
  organizationId: string,
  callback: (invoices: Invoice[]) => void,
  options?: {
    status?: InvoiceStatus;
    customerId?: string;
    onError?: (error: Error) => void;
  },
): Unsubscribe {
  assertOrg(organizationId);

  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
  ];
  if (options?.status) {
    constraints.unshift(where('status', '==', options.status));
  }
  if (options?.customerId) {
    constraints.unshift(where('customerId', '==', options.customerId));
  }

  const q = query(collection(db, COLLECTION), ...constraints);
  return onSnapshot(
    q,
    (snap) => {
      const invoices = snap.docs.map((d) =>
        toInvoice(d.id, d.data() as Record<string, unknown>),
      );
      callback(invoices);
    },
    (error) => {
      options?.onError?.(error);
    },
  );
}

// ─── Stats ───────────────────────────────────────────────────────────────────

/**
 * Compute aggregate stats for an organization's invoices.
 * Convenience wrapper around listInvoices + computeInvoiceStats.
 */
export async function getInvoiceStats(
  organizationId: string,
): Promise<InvoiceStats> {
  assertOrg(organizationId);
  const invoices = await listInvoices(organizationId);
  return computeInvoiceStats(invoices);
}

// ─── Atomic upsert (for migrations / imports) ────────────────────────────────

/**
 * Set an invoice by explicit id (upsert). Used by import scripts.
 * Normal creates should use {@link createInvoice} which auto-generates the id.
 */
export async function setInvoice(
  id: string,
  input: CreateInvoiceInput,
): Promise<void> {
  assertOrg(input.organizationId);

  const isInterState =
    typeof input.isInterState === 'boolean'
      ? input.isInterState
      : Boolean(
          input.sellerStateCode &&
            input.customerStateCode &&
            input.sellerStateCode !== input.customerStateCode,
        );

  const items = input.items.map((it) => computeLineItem(it, isInterState));
  const totals = calculateInvoiceTotals(items, input.cess ?? 0);
  const paidAmount = 0;
  const balanceDue = computeBalanceDue(totals.grandTotal, paidAmount);
  const status: InvoiceStatus = 'draft';
  const paymentStatus = derivePaymentStatus(
    status,
    totals.grandTotal,
    paidAmount,
    input.dueDate,
  );

  await setDoc(doc(db, COLLECTION, id), {
    organizationId: input.organizationId,
    invoiceNumber: input.invoiceNumber,
    customerId: input.customerId ?? null,
    customerName: input.customerName,
    customerGstin: input.customerGstin ?? null,
    customerAddress: input.customerAddress ?? null,
    customerState: input.customerState ?? null,
    customerStateCode: input.customerStateCode ?? null,
    sellerName: input.sellerName,
    sellerGstin: input.sellerGstin,
    sellerAddress: input.sellerAddress ?? null,
    sellerStateCode: input.sellerStateCode ?? null,
    status,
    paymentStatus,
    invoiceDate: input.invoiceDate,
    dueDate: input.dueDate,
    items,
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxableValue: totals.taxableValue,
    cgst: totals.cgst,
    sgst: totals.sgst,
    igst: totals.igst,
    cess: totals.cess,
    roundOff: totals.roundOff,
    grandTotal: totals.grandTotal,
    paidAmount,
    balanceDue,
    notes: input.notes ?? null,
    terms: input.terms ?? null,
    createdBy: input.createdBy,
    isInterState,
    recurring: Boolean(input.recurring),
    recurringCycle: input.recurringCycle ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
