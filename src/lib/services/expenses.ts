// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Shared Service Layer: Expenses
// ═══════════════════════════════════════════════════════════════════════════════
//
// Canonical create/update/delete logic for expenses. Both /api/expenses and
// VEYRO AI createExpense/updateExpense/deleteExpense actions call THESE
// functions so audit logs, graph events, timeline events, and activity logs
// fire identically.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { autoCategorize } from '@/lib/invoices/expenses';
import { graphEvents } from '@/lib/graph/live-update';
import { emitTimelineEvent } from '@/lib/timeline/emit';
import type { Actor, ServiceResult } from './types';

export interface CreateExpenseInput {
  clientId?: string;
  vendor?: string;
  category?: string;
  description?: string;
  amount: number;
  gst?: number;
  date: string;
  paymentMode?: string;
  notes?: string;
}

export interface ExpenseRecord {
  id: string;
  clientId: string | null;
  vendor: string | null;
  category: string;
  description: string | null;
  amount: number;
  gst: number;
  gstClaimable: boolean;
  date: string;
  paymentMode: string | null;
  status: string;
  notes: string | null;
}

function toRecord(e: any): ExpenseRecord {
  return {
    id: e.id,
    clientId: e.clientId ?? null,
    vendor: e.vendor ?? null,
    category: e.category ?? 'other',
    description: e.description ?? null,
    amount: e.amount ?? 0,
    gst: e.gst ?? 0,
    gstClaimable: e.gstClaimable ?? false,
    date: e.date,
    paymentMode: e.paymentMode ?? null,
    status: e.status ?? 'recorded',
    notes: e.notes ?? null,
  };
}

export async function createExpense(
  orgId: string,
  input: CreateExpenseInput,
  actor?: Actor,
): Promise<ServiceResult<ExpenseRecord>> {
  if (input.amount === undefined || !input.date) {
    return { ok: false, error: 'amount and date are required', status: 400 };
  }

  const finalCategory =
    input.category && typeof input.category === 'string'
      ? input.category
      : autoCategorize(String(input.description ?? ''), String(input.vendor ?? ''));

  const expense = await db.expense.create({
    data: {
      clientId: input.clientId ?? null,
      category: finalCategory,
      description: input.description ?? null,
      vendor: input.vendor ?? null,
      amount: Number(input.amount) || 0,
      gst: Number(input.gst) || 0,
      gstClaimable: (Number(input.gst) || 0) > 0,
      date: input.date,
      paymentMode: input.paymentMode ?? null,
      status: 'recorded',
      receiptUrl: null,
      ocrExtracted: false,
      notes: input.notes ?? null,
    },
    select: {
      id: true, clientId: true, vendor: true, category: true, description: true,
      amount: true, gst: true, gstClaimable: true, date: true, paymentMode: true,
      status: true, notes: true,
    },
  });

  await db.auditLog.create({
    data: {
      clientId: input.clientId ?? null,
      action: 'Expense Recorded',
      entity: 'expense',
      entityId: expense.id,
      details: `Expense ₹${expense.amount} (${finalCategory}) recorded — ${input.vendor ?? 'unknown vendor'}`,
    },
  }).catch(() => {});

  graphEvents.expenseRecorded(expense.id, input.vendor ?? 'unknown', expense.amount, finalCategory);

  await emitTimelineEvent({
    organizationId: orgId,
    type: 'expense.created',
    title: `Expense ₹${expense.amount.toLocaleString('en-IN')} recorded`,
    description: `${finalCategory}${input.vendor ? ` — ${input.vendor}` : ''}${input.description ? `: ${input.description}` : ''}.`,
    actor,
    metadata: {
      expenseId: expense.id, amount: expense.amount, gst: expense.gst,
      category: finalCategory, vendor: input.vendor ?? null, date: input.date,
      paymentMode: input.paymentMode ?? null, clientId: input.clientId ?? null,
    },
    severity: 'info',
  });

  try {
    await db.activity.create({
      data: {
        firmId: orgId,
        type: 'expense',
        description: `Expense ₹${expense.amount} (${finalCategory}) recorded — ${input.vendor ?? 'unknown vendor'}`,
        metadata: JSON.stringify({ expenseId: expense.id }),
      },
    });
  } catch { /* non-fatal */ }

  return { ok: true, data: toRecord(expense), status: 201 };
}

export async function updateExpense(
  orgId: string,
  id: string,
  updates: Record<string, unknown>,
  actor?: Actor,
): Promise<ServiceResult<ExpenseRecord>> {
  if (!id) return { ok: false, error: 'id is required', status: 400 };

  const existing = await db.expense.findUnique({ where: { id } }).catch(() => null);
  if (!existing) return { ok: false, error: 'Expense not found', status: 404 };

  const updateData: Record<string, unknown> = {};
  const allowedFields = [
    'category', 'description', 'vendor', 'amount', 'gst', 'gstClaimable',
    'date', 'paymentMode', 'status', 'receiptUrl', 'notes', 'clientId',
  ];
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      updateData[field] = field === 'amount' || field === 'gst'
        ? Number(updates[field])
        : updates[field];
    }
  }

  const expense = await db.expense.update({
    where: { id },
    data: updateData,
    select: {
      id: true, clientId: true, vendor: true, category: true, description: true,
      amount: true, gst: true, gstClaimable: true, date: true, paymentMode: true,
      status: true, notes: true,
    },
  });

  await db.auditLog.create({
    data: {
      clientId: expense.clientId,
      action: 'Expense Updated',
      entity: 'expense',
      entityId: expense.id,
      details: `Expense ₹${expense.amount} (${expense.category}) updated`,
    },
  }).catch(() => {});

  await emitTimelineEvent({
    organizationId: orgId,
    type: 'expense.updated',
    title: `Expense updated`,
    description: `${expense.category} — ₹${expense.amount.toLocaleString('en-IN')} modified.`,
    actor,
    metadata: { expenseId: expense.id, amount: expense.amount, category: expense.category },
    severity: 'info',
  });

  return { ok: true, data: toRecord(expense) };
}

export async function deleteExpense(
  orgId: string,
  id: string,
  actor?: Actor,
): Promise<ServiceResult<{ id: string; amount: number; category: string }>> {
  if (!id) return { ok: false, error: 'id is required', status: 400 };

  const existing = await db.expense.findUnique({ where: { id } }).catch(() => null);
  if (!existing) return { ok: false, error: 'Expense not found', status: 404 };

  await db.auditLog.create({
    data: {
      clientId: existing.clientId,
      action: 'Expense Deleted',
      entity: 'expense',
      entityId: existing.id,
      details: `Expense ₹${existing.amount} (${existing.category}) deleted`,
    },
  }).catch(() => {});

  await db.expense.delete({ where: { id } });

  await emitTimelineEvent({
    organizationId: orgId,
    type: 'expense.deleted',
    title: `Expense deleted`,
    description: `${existing.category} — ₹${existing.amount.toLocaleString('en-IN')} removed.`,
    actor,
    metadata: { expenseId: id, amount: existing.amount, category: existing.category },
    severity: 'warning',
  });

  return { ok: true, data: { id, amount: existing.amount, category: existing.category } };
}
