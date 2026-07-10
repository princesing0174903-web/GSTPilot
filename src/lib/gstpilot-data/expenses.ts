// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Expenses Firestore Service
//
// CRUD + real-time subscription for expense documents at:
//   organizations/GSTpilot_SAAS/expenses/{expenseId}
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
import { EXPENSES_COLLECTION } from './config';
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

// ─── Public API ──────────────────────────────────────────────────────────────

export function subscribeExpenses(
  onData: (expenses: Expense[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, EXPENSES_COLLECTION), orderBy('date', 'desc'));
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

export async function getExpense(id: string): Promise<Expense | null> {
  const snap = await getDoc(doc(db, EXPENSES_COLLECTION, id));
  if (!snap.exists()) return null;
  return toExpense(snap.id, snap.data() as Record<string, unknown>);
}

export async function getExpensesOnce(): Promise<Expense[]> {
  try {
    const q = query(collection(db, EXPENSES_COLLECTION), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    const list: Expense[] = [];
    snap.forEach((d) => list.push(toExpense(d.id, d.data() as Record<string, unknown>)));
    return list;
  } catch {
    return [];
  }
}

export async function createExpense(input: CreateExpenseInput): Promise<Expense> {
  if (!input.description?.trim()) throw new Error('Expense description is required.');
  if (!input.amount || Number(input.amount) <= 0) {
    throw new Error('Expense amount must be greater than zero.');
  }

  const payload = buildPayload(input);
  const now = serverTimestamp();
  const ref = await addDoc(collection(db, EXPENSES_COLLECTION), {
    ...payload,
    createdAt: now,
    updatedAt: now,
  });

  const snap = await getDoc(ref);
  return toExpense(snap.id, snap.data() as Record<string, unknown>);
}

export async function updateExpense(
  id: string,
  patch: UpdateExpenseInput,
): Promise<Expense> {
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

  await updateDoc(doc(db, EXPENSES_COLLECTION, id), update);
  const snap = await getDoc(doc(db, EXPENSES_COLLECTION, id));
  return toExpense(snap.id, snap.data() as Record<string, unknown>);
}

export async function deleteExpense(id: string): Promise<void> {
  await deleteDoc(doc(db, EXPENSES_COLLECTION, id));
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
