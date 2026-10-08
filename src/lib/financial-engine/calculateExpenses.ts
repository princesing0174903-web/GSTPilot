// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Expenses Calculator
//
// Total Expenses = Purchase Bills (cost of goods) + Operating Expenses
// (rent, salaries, software, travel, etc.). This is the single source of
// truth for "Expenses" across every dashboard.
// ═══════════════════════════════════════════════════════════════════════════════

import type { PurchaseBillRow, ExpenseRow } from './types';

export interface ExpensesResult {
  total: number;
  purchases: number;     // cost of goods from purchase bills
  operating: number;     // operating expenses (rent, salary, software, etc.)
  byCategory: Record<string, number>;
}

/**
 * Calculates total expenses from purchase bills and operating expenses.
 *
 * Purchase bills represent cost of goods/services procured.
 * Expenses represent operating costs (salaries, rent, software, etc.).
 *
 * @returns ExpensesResult with breakdown
 */
export function calculateExpenses(
  purchaseBills: PurchaseBillRow[],
  expenses: ExpenseRow[],
): ExpensesResult {
  let purchases = 0;
  let operating = 0;
  const byCategory: Record<string, number> = {};

  // Purchase bills = cost of goods (use taxableValue, not total, to avoid
  // double-counting GST which is handled separately as ITC)
  for (const bill of purchaseBills) {
    if (bill.status === 'cancelled') continue;
    purchases += bill.taxableValue;
  }

  // Operating expenses
  for (const exp of expenses) {
    if (exp.status === 'cancelled') continue;
    operating += exp.amount;
    const cat = exp.category || 'Miscellaneous';
    byCategory[cat] = round2((byCategory[cat] ?? 0) + exp.amount);
  }

  const total = round2(purchases + operating);

  return {
    total,
    purchases: round2(purchases),
    operating: round2(operating),
    byCategory,
  };
}

/**
 * Calculates expenses for a specific period (YYYY-MM).
 */
export function calculateExpensesForPeriod(
  purchaseBills: PurchaseBillRow[],
  expenses: ExpenseRow[],
  period: string,
): number {
  let total = 0;

  for (const bill of purchaseBills) {
    if (bill.status === 'cancelled') continue;
    const billPeriod = bill.invoiceDate?.slice(0, 7);
    if (billPeriod === period) {
      total += bill.taxableValue;
    }
  }

  for (const exp of expenses) {
    if (exp.status === 'cancelled') continue;
    const expPeriod = exp.date?.slice(0, 7);
    if (expPeriod === period) {
      total += exp.amount;
    }
  }

  return round2(total);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
