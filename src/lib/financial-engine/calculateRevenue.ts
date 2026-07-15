// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Revenue Calculator
//
// Revenue = sum of totalAmount for all issued/sent/paid invoices (excludes
// drafts and cancelled). This is the single source of truth for "Revenue"
// across every dashboard, Oracle, AI CFO, Run Business, and Home.
// ═══════════════════════════════════════════════════════════════════════════════

import type { InvoiceRow } from './types';

/**
 * Calculates total revenue from sales invoices.
 *
 * Revenue recognition rule: an invoice counts toward revenue once it is
 * issued/sent/paid. Drafts and cancelled invoices are excluded.
 *
 * @returns { total: number, count: number } — total revenue in INR and invoice count
 */
export function calculateRevenue(
  invoices: InvoiceRow[],
): { total: number; count: number } {
  let total = 0;
  let count = 0;

  for (const inv of invoices) {
    // Exclude drafts and cancelled — they are not realized revenue
    if (inv.status === 'draft' || inv.status === 'cancelled') continue;

    total += inv.totalAmount;
    count += 1;
  }

  return {
    total: round2(total),
    count,
  };
}

/**
 * Calculates revenue for a specific period (YYYY-MM).
 */
export function calculateRevenueForPeriod(
  invoices: InvoiceRow[],
  period: string,
): number {
  let total = 0;
  for (const inv of invoices) {
    if (inv.status === 'draft' || inv.status === 'cancelled') continue;
    const invPeriod = inv.invoiceDate?.slice(0, 7);
    if (invPeriod === period) {
      total += inv.totalAmount;
    }
  }
  return round2(total);
}

/**
 * Calculates month-over-month revenue trend for forecasting.
 * Returns last 6 months of revenue data points.
 */
export function calculateRevenueTrend(
  invoices: InvoiceRow[],
  monthsBack = 6,
): { period: string; revenue: number }[] {
  const now = new Date();
  const trend: { period: string; revenue: number }[] = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    trend.push({
      period,
      revenue: calculateRevenueForPeriod(invoices, period),
    });
  }

  return trend;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
