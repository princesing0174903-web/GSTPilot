// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Invoice Engine™ — Expense Cloud™
// Operational spend tracking, auto-categorization, GST claimability detection.
// Prisma-backed server module.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ExpenseDTO, ExpenseListResult, ExpenseCategoryBreakdown } from './types';
import { db } from '@/lib/db';
import { currentMonth, lastMonth } from './types';

// Pure utilities (Prisma-free) — re-exported so existing server-side callers
// keep compiling. Client components MUST import directly from `./expenses-utils`
// to avoid dragging Prisma into their bundle.
export {
  EXPENSE_CATEGORIES,
  detectGstClaimable,
  autoCategorize,
  getExpenseStats,
  seedExpenses,
  type ExpenseCategoryMeta,
  type GstClaimableResult,
  type ExpenseStatsResult,
} from './expenses-utils';

// ─── helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

// ─── DB-backed list query ──────────────────────────────────────────────────────

/** Fetches expenses from Prisma and maps them to the ExpenseDTO shape. */
export async function getExpenses(opts?: { limit?: number }): Promise<ExpenseListResult> {
  const rows = await db.expense.findMany({
    take: opts?.limit ?? 500,
    orderBy: { date: 'desc' },
  });
  const expenses: ExpenseDTO[] = rows.map((r) => ({
    id: r.id,
    category: r.category ?? 'Miscellaneous',
    description: r.description ?? null,
    vendor: r.vendor ?? null,
    amount: r.amount,
    gst: r.gst,
    gstClaimable: r.gstClaimable,
    date: r.date,
    paymentMode: r.paymentMode ?? null,
    status: r.status,
    recurring: false,
  }));
  const totalAmount = sum(expenses.map((e) => e.amount));
  const thisMonth = currentMonth();
  const lastMonthStr = lastMonth();
  const thisMonthTotal = sum(expenses.filter((e) => e.date.slice(0, 7) === thisMonth).map((e) => e.amount));
  const lastMonthTotal = sum(expenses.filter((e) => e.date.slice(0, 7) === lastMonthStr).map((e) => e.amount));
  const changePct = lastMonthTotal > 0
    ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100)
    : thisMonthTotal > 0 ? 100 : 0;

  // Category breakdown
  const catMap = new Map<string, { total: number; count: number }>();
  for (const e of expenses) {
    const cur = catMap.get(e.category) ?? { total: 0, count: 0 };
    cur.total += e.amount;
    cur.count += 1;
    catMap.set(e.category, cur);
  }
  const byCategory: ExpenseCategoryBreakdown[] = Array.from(catMap.entries()).map(([label, v]) => ({
    label,
    total: round2(v.total),
    count: v.count,
    changePct: 0,
  }));

  return {
    expenses,
    total: expenses.length,
    totalAmount: round2(totalAmount),
    thisMonthTotal: round2(thisMonthTotal),
    lastMonthTotal: round2(lastMonthTotal),
    changePct,
    recurringCount: expenses.filter((e) => e.recurring).length,
    byCategory,
    hasLiveData: expenses.length > 0,
  };
}
