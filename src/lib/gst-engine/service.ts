// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO GST Return Engine™ — Service Layer
//
// The single entry point for all GST transaction operations. Every function is:
//   • Multi-tenant — filters on `organizationId`, never crosses org boundaries
//   • Real-time — subscribeToTransactions exposes an onSnapshot subscription
//   • Invoice-linked — syncInvoiceToTransaction upserts a GSTTransaction
//     whenever an invoice is created/updated, so summaries always reflect the
//     latest source-of-truth invoice data
//   • Period-aware — supports filtering by `filingPeriod` (YYYY-MM) or
//     `financialYear` (FY2024-25) for return preparation
//
// Firestore collection: gst_transactions/{transactionId}
// Security: firestore.rules enforce org isolation server-side; we double-check
// client-side so a bug can never leak another org's GST data.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as limitClause,
  serverTimestamp,
  onSnapshot,
  writeBatch,
  type Unsubscribe,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { calculateInvoiceGST } from './calculations';
import type {
  GSTTransaction,
  GSTTransactionType,
} from './types';
import type { Invoice } from '@/lib/invoice-engine/types';

// ─── Collection names ────────────────────────────────────────────────────────

export const GST_COLLECTIONS = {
  TRANSACTIONS: 'gst_transactions',
} as const;

const COLLECTION = GST_COLLECTIONS.TRANSACTIONS;

// ─── Org guard ───────────────────────────────────────────────────────────────

function assertOrg(orgId: string | undefined | null): void {
  if (!orgId) {
    throw new Error(
      'You must belong to an organization to manage GST transactions.',
    );
  }
}

// ─── Timestamp conversion ────────────────────────────────────────────────────

/**
 * Convert a Firestore snapshot into a typed GSTTransaction.
 * Timestamps become ISO strings; numbers stay numbers; booleans stay booleans.
 */
export function toTransaction(
  id: string,
  raw: Record<string, unknown>,
): GSTTransaction {
  const convert = (value: unknown): unknown => {
    if (value && typeof value === 'object' && 'toDate' in value) {
      return (value as { toDate: () => Date }).toDate().toISOString();
    }
    return value;
  };

  const createdByRaw = (raw.createdBy as Record<string, unknown> | null) ?? {
    uid: '',
    name: '',
    email: '',
  };

  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    invoiceId: String(raw.invoiceId ?? ''),
    customerId: (raw.customerId as string | null) ?? null,
    customerName: String(raw.customerName ?? ''),
    customerGstin: (raw.customerGstin as string | null) ?? null,
    customerStateCode: (raw.customerStateCode as string | null) ?? null,
    sellerGstin: String(raw.sellerGstin ?? ''),
    sellerStateCode: (raw.sellerStateCode as string | null) ?? null,
    invoiceNumber: String(raw.invoiceNumber ?? ''),
    invoiceDate: String(raw.invoiceDate ?? ''),

    transactionType: (raw.transactionType as GSTTransactionType) ?? 'sales',
    invoiceType: (raw.invoiceType as GSTTransaction['invoiceType']) ?? 'b2b',
    isInterState: Boolean(raw.isInterState ?? false),

    gstRate: Number(raw.gstRate ?? 0),
    taxableValue: Number(raw.taxableValue ?? 0),
    cgst: Number(raw.cgst ?? 0),
    sgst: Number(raw.sgst ?? 0),
    igst: Number(raw.igst ?? 0),
    cess: Number(raw.cess ?? 0),
    totalTax: Number(raw.totalTax ?? 0),
    grandTotal: Number(raw.grandTotal ?? 0),

    itcEligible: Boolean(raw.itcEligible ?? false),
    reverseCharge: Boolean(raw.reverseCharge ?? false),
    composition: Boolean(raw.composition ?? false),

    filingPeriod: String(raw.filingPeriod ?? ''),
    financialYear: String(raw.financialYear ?? ''),

    status: (raw.status as GSTTransaction['status']) ?? 'draft',

    createdBy: {
      uid: String(createdByRaw.uid ?? ''),
      name: String(createdByRaw.name ?? ''),
      email: String(createdByRaw.email ?? ''),
    },
    createdAt: convert(raw.createdAt) as string,
    updatedAt: convert(raw.updatedAt) as string,
  };
}

// ─── Strip server-managed fields from a patch ────────────────────────────────

/**
 * Returns a shallow copy of `patch` with `id`, `organizationId`, and
 * `createdAt` removed — these are immutable / server-managed.
 */
function sanitizePatch<T extends Record<string, unknown>>(patch: T): Partial<T> {
  const { id: _id, organizationId: _org, createdAt: _ca, ...rest } = patch;
  void _id;
  void _org;
  void _ca;
  return rest as Partial<T>;
}

// ─── Real-time subscription ──────────────────────────────────────────────────

/**
 * Subscribe to live updates for an organization's GST transactions.
 * Returns an unsubscribe function. The callback fires immediately with the
 * current set, and again whenever any transaction in the org changes.
 *
 * Filters:
 *   • period          — `filingPeriod` (YYYY-MM)
 *   • transactionType — 'sales' | 'purchase' | 'credit_note' | 'debit_note'
 *   • limitCount      — cap the result set (default 500)
 *
 * Ordered by `invoiceDate` descending (newest first).
 */
export function subscribeToTransactions(
  orgId: string,
  callback: (txns: GSTTransaction[]) => void,
  options?: {
    onError?: (err: Error) => void;
    period?: string;
    transactionType?: GSTTransactionType;
    limitCount?: number;
  },
): Unsubscribe {
  assertOrg(orgId);

  const constraints: QueryConstraint[] = [
    where('organizationId', '==', orgId),
    orderBy('invoiceDate', 'desc'),
  ];

  if (options?.period) {
    constraints.unshift(where('filingPeriod', '==', options.period));
  }
  if (options?.transactionType) {
    constraints.unshift(where('transactionType', '==', options.transactionType));
  }

  constraints.push(limitClause(options?.limitCount ?? 500));

  const q = query(collection(db, COLLECTION), ...constraints);
  return onSnapshot(
    q,
    (snap) => {
      const txns = snap.docs.map((d) =>
        toTransaction(d.id, d.data() as Record<string, unknown>),
      );
      callback(txns);
    },
    (error) => {
      options?.onError?.(error);
    },
  );
}

// ─── getTransaction ──────────────────────────────────────────────────────────

/**
 * Fetch a single GST transaction by id, scoped to `organizationId`.
 * Returns `null` when the transaction doesn't exist OR belongs to another org.
 */
export async function getTransaction(
  orgId: string,
  txnId: string,
): Promise<GSTTransaction | null> {
  assertOrg(orgId);
  const snap = await getDoc(doc(db, COLLECTION, txnId));
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;
  // Tenant guard — double-check client-side even though rules enforce it.
  if (data.organizationId !== orgId) return null;
  return toTransaction(txnId, data);
}

// ─── listTransactions ────────────────────────────────────────────────────────

/**
 * One-shot list of GST transactions for an organization.
 * Supports filtering by `period` (YYYY-MM) or `financialYear` (FY2024-25),
 * `transactionType`, and `limitCount`.
 */
export async function listTransactions(
  orgId: string,
  options?: {
    period?: string;
    financialYear?: string;
    transactionType?: GSTTransactionType;
    limitCount?: number;
  },
): Promise<GSTTransaction[]> {
  assertOrg(orgId);

  const constraints: QueryConstraint[] = [
    where('organizationId', '==', orgId),
    orderBy('invoiceDate', 'desc'),
  ];

  if (options?.period) {
    constraints.unshift(where('filingPeriod', '==', options.period));
  }
  if (options?.financialYear) {
    constraints.unshift(where('financialYear', '==', options.financialYear));
  }
  if (options?.transactionType) {
    constraints.unshift(where('transactionType', '==', options.transactionType));
  }

  constraints.push(limitClause(options?.limitCount ?? 500));

  const snap = await getDocs(query(collection(db, COLLECTION), ...constraints));
  return snap.docs.map((d) =>
    toTransaction(d.id, d.data() as Record<string, unknown>),
  );
}

// ─── createTransaction ───────────────────────────────────────────────────────

/**
 * Create a new GST transaction. `createdAt` and `updatedAt` are stamped
 * server-side. `organizationId` is set from the org scope.
 */
export async function createTransaction(
  orgId: string,
  data: Omit<GSTTransaction, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  assertOrg(orgId);

  const payload = {
    ...data,
    organizationId: orgId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, COLLECTION), payload);
  return ref.id;
}

// ─── updateTransaction ───────────────────────────────────────────────────────

/**
 * Update an existing GST transaction.
 *
 * `organizationId`, `id`, and `createdAt` are immutable — they are stripped
 * from the patch before writing. `updatedAt` is auto-stamped.
 */
export async function updateTransaction(
  orgId: string,
  txnId: string,
  patch: Partial<GSTTransaction>,
): Promise<void> {
  assertOrg(orgId);

  // Read-first guard prevents cross-org updates.
  const existing = await getTransaction(orgId, txnId);
  if (!existing) {
    throw new Error('GST transaction not found in your workspace.');
  }

  const sanitized = sanitizePatch(patch as Record<string, unknown>);
  await updateDoc(doc(db, COLLECTION, txnId), {
    ...sanitized,
    updatedAt: serverTimestamp(),
  });
}

// ─── deleteTransaction ───────────────────────────────────────────────────────

/**
 * Delete a GST transaction permanently. Read-first guard prevents
 * cross-org deletion. Idempotent — returns silently if the doc is already gone.
 */
export async function deleteTransaction(
  orgId: string,
  txnId: string,
): Promise<void> {
  assertOrg(orgId);
  const existing = await getTransaction(orgId, txnId);
  if (!existing) {
    // Idempotent — already gone.
    return;
  }
  await deleteDoc(doc(db, COLLECTION, txnId));
}

// ─── deleteTransactionsForInvoice ────────────────────────────────────────────

/**
 * Delete ALL GST transactions linked to a given invoice (org-scoped).
 * Used when an invoice is cancelled or hard-deleted — we wipe the GST
 * projection so it no longer appears in summaries or return drafts.
 *
 * Implemented as a single writeBatch for atomicity.
 */
export async function deleteTransactionsForInvoice(
  orgId: string,
  invoiceId: string,
): Promise<void> {
  assertOrg(orgId);

  const q = query(
    collection(db, COLLECTION),
    where('organizationId', '==', orgId),
    where('invoiceId', '==', invoiceId),
  );
  const snap = await getDocs(q);
  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// ─── syncInvoiceToTransaction ────────────────────────────────────────────────

/**
 * Upsert a GST transaction from an invoice.
 *
 * If a GSTTransaction already exists for `(organizationId, invoiceId)`, it is
 * updated with the recomputed GST values. Otherwise a new one is created.
 *
 * GST calculation is delegated to `calculateInvoiceGST` from `./calculations` —
 * this service never recomputes tax amounts itself.
 *
 * Returns the transaction id.
 */
export async function syncInvoiceToTransaction(
  orgId: string,
  invoice: Invoice,
  transactionType: GSTTransactionType,
): Promise<string> {
  assertOrg(orgId);

  // Run the GST engine on the invoice — returns derived fields like
  // gstRate (weighted), invoiceType (b2b/b2c_large/...), filingPeriod,
  // financialYear, itcEligible, etc.
  const calc = calculateInvoiceGST(invoice);

  // Look up any existing transaction for this (org, invoice) pair.
  const existingQ = query(
    collection(db, COLLECTION),
    where('organizationId', '==', orgId),
    where('invoiceId', '==', invoice.id),
  );
  const existingSnap = await getDocs(existingQ);
  const existingDoc = existingSnap.docs[0];

  const payload = {
    organizationId: orgId,
    invoiceId: invoice.id,
    customerId: invoice.customerId,
    customerName: invoice.customerName,
    customerGstin: invoice.customerGstin,
    customerStateCode: invoice.customerStateCode,
    sellerGstin: invoice.sellerGstin,
    sellerStateCode: invoice.sellerStateCode,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    transactionType,
    invoiceType: calc.invoiceType,
    isInterState: calc.isInterState,
    gstRate: calc.gstRate,
    taxableValue: calc.taxableValue,
    cgst: calc.cgst,
    sgst: calc.sgst,
    igst: calc.igst,
    cess: calc.cess,
    totalTax: calc.totalTax,
    grandTotal: calc.grandTotal,
    itcEligible: calc.itcEligible,
    reverseCharge: calc.reverseCharge,
    composition: calc.composition,
    filingPeriod: calc.filingPeriod,
    financialYear: calc.financialYear,
    status: 'draft' as const,
    createdBy: invoice.createdBy,
  };

  if (existingDoc) {
    // Update in place — preserve createdAt.
    await updateDoc(existingDoc.ref, {
      ...payload,
      updatedAt: serverTimestamp(),
    });
    return existingDoc.id;
  }

  // Create new.
  const ref = await addDoc(collection(db, COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// ─── getTransactionsForPeriod ────────────────────────────────────────────────

/**
 * Convenience: list all transactions for a specific filing period (YYYY-MM).
 */
export async function getTransactionsForPeriod(
  orgId: string,
  period: string,
): Promise<GSTTransaction[]> {
  return listTransactions(orgId, { period });
}

// ─── getTransactionsForFY ────────────────────────────────────────────────────

/**
 * Convenience: list all transactions for a specific financial year
 * (e.g. `FY2024-25`).
 */
export async function getTransactionsForFY(
  orgId: string,
  financialYear: string,
): Promise<GSTTransaction[]> {
  return listTransactions(orgId, { financialYear });
}
