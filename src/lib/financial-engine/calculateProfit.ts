// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Profit Calculator
//
// Profit = Revenue - Expenses
// This is the ONLY place in the entire codebase where profit is calculated.
// Every page imports this function.
// ═══════════════════════════════════════════════════════════════════════════════

import type { InvoiceRow, PurchaseBillRow, ExpenseRow } from './types';
import { calculateRevenue } from './calculateRevenue';
import { calculateExpenses } from './calculateExpenses';

export interface ProfitResult {
  netProfit: number;
  margin: number; // percentage 0–100
  revenue: number;
  expenses: number;
}

/**
 * Calculates net profit and profit margin.
 *
 * Net Profit = Revenue - Expenses
 * Margin = (Net Profit / Revenue) * 100
 *
 * Returns zeros when there is no revenue (no division by zero).
 */
export function calculateProfit(
  invoices: InvoiceRow[],
  purchaseBills: PurchaseBillRow[],
  expenses: ExpenseRow[],
): ProfitResult {
  const rev = calculateRevenue(invoices);
  const exp = calculateExpenses(purchaseBills, expenses);

  const netProfit = round2(rev.total - exp.total);
  const margin = rev.total > 0 ? round2((netProfit / rev.total) * 100) : 0;

  return {
    netProfit,
    margin,
    revenue: rev.total,
    expenses: exp.total,
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
