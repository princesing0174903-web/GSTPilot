// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Expenses Firestore Service
//
// CRUD + real-time subscription for expense documents at:
//   organizations/{organizationId}/expenses/{expenseId}
//
// ORG-SCOPED (MULTI-TENANT):
//   Every function accepts an `organizationId` parameter (from OrgContext).
//   The Firestore path is built dynamically — NEVER hardcoded.
//   If organizationId is null/empty, functions return empty results
//   (honest empty state) instead of writing to a fallback path.
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
import {
  orgCollectionPath,
  orgDocPath,
  EXPENSES_SUB,
} from './config';
import type {
  Expense,
  CreateExpenseInput,
  UpdateExpenseInput,
  ExpenseStats,
  ExpenseCategory,
  PaymentMode,
  ExpenseStatus,
} from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Office',
  'Travel',
  'Salary',
  'Marketing',
  'Rent',
  'Utilities',
  'Software',
  'Miscellaneous',
];

const PAYMENT_MODES: PaymentMode[] = ['cash', 'upi', 'bank', 'card', 'cheque', 'other'];

const EXPENSE_STATUSES: ExpenseStatus[] = ['recorded', 'billed', 'paid'];

function normalizeCategory(v: unknown): ExpenseCategory {
  const s = String(v ?? 'Miscellaneous') as ExpenseCategory;
  return EXPENSE_CATEGORIES.includes(s) ? s : 'Miscellaneous';
}

function normalizePaymentMode(v: unknown): PaymentMode {
  const s = String(v ?? 'other') as PaymentMode;
  return PAYMENT_MODES.includes(s) ? s : 'other';
}

function normalizeStatus(v: unknown): ExpenseStatus {
  const s = String(v ?? 'recorded') as ExpenseStatus;
  return EXPENSE_STATUSES.includes(s) ? s : 'recorded';
}

function toExpense(id: string, raw: Record<string, unknown>): Expense {
  const ts = (v: unknown): string | null => {
    if (v && typeof v === 'object' && 'toDate' in v) {
      return (v as { toDate: () => Date }).toDate().toISOString();
    }
    if (typeof v === 'string') return v;
    return null;
  };
  return {
    id,
    vendorId: (raw.vendorId as string | null) ?? null,
    vendorName: String(raw.vendorName ?? ''),
    category: normalizeCategory(raw.category),
    description: String(raw.description ?? ''),
    amount: Number(raw.amount ?? 0),
    gst: Number(raw.gst ?? 0),
    gstClaimable: Boolean(raw.gstClaimable ?? false),
    date: String(raw.date ?? new Date().toISOString().slice(0, 10)),
    paymentMode: normalizePaymentMode(raw.paymentMode),
    status: normalizeStatus(raw.status),
    referenceNo: (raw.referenceNo as string | null) ?? null,
    notes: (raw.notes as string | null) ?? null,
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

function buildPayload(input: CreateExpenseInput) {
  const amount = Math.max(0, Number(input.amount ?? 0));
  const gst = Math.max(0, Number(input.gst ?? 0));
  return {
    vendorId: input.vendorId?.trim() || null,
    vendorName: input.vendorName?.trim() || '',
    category: input.category ?? 'Miscellaneous',
    description: input.description.trim(),
    amount,
    gst,
    gstClaimable: input.gstClaimable ?? gst > 0,
    date: input.date || new Date().toISOString().slice(0, 10),
    paymentMode: input.paymentMode ?? 'other',
    status: input.status ?? 'recorded',
    referenceNo: input.referenceNo?.trim() || null,
    notes: input.notes?.trim() || null,
  };
}

/** No-op unsubscribe — returned when organizationId is null (preview mode). */
const noopUnsubscribe: Unsubscribe = () => {};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Subscribe to ALL expenses in real-time (onSnapshot) for the given org.
 *
 * If `organizationId` is null/empty (preview mode / no org), calls onData([])
 * immediately and returns a no-op unsubscribe — does NOT touch Firestore.
 */
export function subscribeExpenses(
  organizationId: string | null | undefined,
  onData: (expenses: Expense[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = orgCollectionPath(organizationId, EXPENSES_SUB);
  if (!path) {
    onData([]);
    return noopUnsubscribe;
  }

  const q = query(collection(db, path), orderBy('date', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const list: Expense[] = [];
      snap.forEach((d) => list.push(toExpense(d.id, d.data() as Record<string, unknown>)));
      onData(list);
    },
    (err) => onError?.(err as Error),
  );
}

/** Fetch a single expense by id (one-shot). */
export async function getExpense(
  organizationId: string | null | undefined,
  id: string,
): Promise<Expense | null> {
  const path = orgDocPath(organizationId, EXPENSES_SUB, id);
  if (!path) return null;
  const snap = await getDoc(doc(db, path));
  if (!snap.exists()) return null;
  return toExpense(snap.id, snap.data() as Record<string, unknown>);
}

/**
 * Fetch ALL expenses in one shot (server-side / API-route friendly).
 * Returns an empty array on permission-denied / unavailable / no org.
 */
export async function getExpensesOnce(
  organizationId: string | null | undefined,
): Promise<Expense[]> {
  const path = orgCollectionPath(organizationId, EXPENSES_SUB);
  if (!path) return [];
  try {
    const q = query(collection(db, path), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    const list: Expense[] = [];
    snap.forEach((d) => list.push(toExpense(d.id, d.data() as Record<string, unknown>)));
    return list;
  } catch {
    return [];
  }
}

/**
 * Create a new expense in the given org's subcollection.
 * Throws on validation errors. Returns the created Expense.
 *
 * If organizationId is null/empty, throws a friendly error — the caller
 * must resolve the org context before creating.
 */
export async function createExpense(
  organizationId: string | null | undefined,
  input: CreateExpenseInput,
): Promise<Expense> {
  const path = orgCollectionPath(organizationId, EXPENSES_SUB);
  if (!path) {
    throw new Error(
      'Unable to save expense.\n\nReason: No organization is currently selected. ' +
      'Please sign in and select an organization, then try again.',
    );
  }

  if (!input.description?.trim()) throw new Error('Expense description is required.');
  if (!input.amount || Number(input.amount) <= 0) {
    throw new Error('Expense amount must be greater than zero.');
  }

  const payload = buildPayload(input);
  const now = serverTimestamp();
  const ref = await addDoc(collection(db, path), {
    ...payload,
    createdAt: now,
    updatedAt: now,
  });

  const snap = await getDoc(ref);
  return toExpense(snap.id, snap.data() as Record<string, unknown>);
}

/** Update an existing expense. */
export async function updateExpense(
  organizationId: string | null | undefined,
  id: string,
  patch: UpdateExpenseInput,
): Promise<Expense> {
  const path = orgDocPath(organizationId, EXPENSES_SUB, id);
  if (!path) {
    throw new Error(
      'Unable to update expense.\n\nReason: No organization is currently selected.',
    );
  }

  const update: Record<string, unknown> = {};
  const built = buildPayload({
    description: patch.description ?? '__NOOP__',
    amount: patch.amount ?? 0,
    ...patch,
  } as CreateExpenseInput);
  if (patch.vendorId !== undefined) update.vendorId = built.vendorId;
  if (patch.vendorName !== undefined) update.vendorName = built.vendorName;
  if (patch.category !== undefined) update.category = built.category;
  if (patch.description !== undefined) update.description = built.description;
  if (patch.amount !== undefined) update.amount = built.amount;
  if (patch.gst !== undefined) update.gst = built.gst;
  if (patch.gstClaimable !== undefined) update.gstClaimable = built.gstClaimable;
  if (patch.date !== undefined) update.date = built.date;
  if (patch.paymentMode !== undefined) update.paymentMode = built.paymentMode;
  if (patch.status !== undefined) update.status = built.status;
  if (patch.referenceNo !== undefined) update.referenceNo = built.referenceNo;
  if (patch.notes !== undefined) update.notes = built.notes;
  update.updatedAt = serverTimestamp();

  await updateDoc(doc(db, path), update);
  const snap = await getDoc(doc(db, path));
  return toExpense(snap.id, snap.data() as Record<string, unknown>);
}

/** Permanently delete an expense. */
export async function deleteExpense(
  organizationId: string | null | undefined,
  id: string,
): Promise<void> {
  const path = orgDocPath(organizationId, EXPENSES_SUB, id);
  if (!path) {
    throw new Error(
      'Unable to delete expense.\n\nReason: No organization is currently selected.',
    );
  }
  await deleteDoc(doc(db, path));
}

// ─── Search + stats ──────────────────────────────────────────────────────────

export function searchExpenses(expenses: Expense[], queryText: string): Expense[] {
  const q = queryText.trim().toLowerCase();
  if (!q) return expenses;
  return expenses.filter((e) =>
    [e.vendorName, e.description, e.category, e.referenceNo, e.paymentMode, e.status]
      .filter(Boolean)
      .some((field) => (field as string).toLowerCase().includes(q)),
  );
}

export function computeExpenseStatsLocal(expenses: Expense[]): ExpenseStats {
  const stats: ExpenseStats = {
    count: expenses.length,
    totalAmount: 0,
    totalGst: 0,
    claimableGst: 0,
  };
  for (const e of expenses) {
    stats.totalAmount += e.amount;
    stats.totalGst += e.gst;
    if (e.gstClaimable) stats.claimableGst += e.gst;
  }
  stats.totalAmount = Math.round(stats.totalAmount * 100) / 100;
  stats.totalGst = Math.round(stats.totalGst * 100) / 100;
  stats.claimableGst = Math.round(stats.claimableGst * 100) / 100;
  return stats;
}
