// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Runway & Forecast Calculator
//
// Runway = Cash / Monthly Burn Rate
// Forecast = Linear projection from 6-month revenue trend
//
// This is the ONLY place where runway and forecast are calculated.
// ═══════════════════════════════════════════════════════════════════════════════

import type { FinancialData } from './types';
import { calculateRevenue, calculateRevenueTrend } from './calculateRevenue';
import { calculateExpenses, calculateExpensesForPeriod } from './calculateExpenses';
import { calculateCash } from './calculateCash';
import { calculateProfit } from './calculateProfit';

export interface RunwayResult {
  monthsRemaining: number | null; // null = infinite (profitable) or cannot calculate
  monthlyBurnRate: number;
  isProfitable: boolean;
}

export interface ForecastResult {
  nextMonthRevenue: number;
  nextMonthExpenses: number;
  projectedCash: number;
  confidence: number; // 0–100
}

/**
 * Calculates cash runway — how many months the business can operate
 * at the current burn rate before running out of cash.
 *
 * Returns null for monthsRemaining when:
 *   - The business is profitable (runway is infinite)
 *   - There is no expense data to calculate burn rate
 *   - There is no cash (runway is 0)
 */
export function calculateRunway(data: FinancialData): RunwayResult {
  const { invoices, purchaseBills, expenses, bankAccounts } = data;

  const profit = calculateProfit(invoices, purchaseBills, expenses);
  const cash = calculateCash(bankAccounts);
  const exp = calculateExpenses(purchaseBills, expenses);

  const isProfitable = profit.netProfit > 0;

  // Monthly burn = annual expenses / 12
  const monthlyBurnRate = round2(exp.total / 12);

  if (isProfitable) {
    return {
      monthsRemaining: null, // infinite
      monthlyBurnRate,
      isProfitable: true,
    };
  }

  if (monthlyBurnRate <= 0) {
    return {
      monthsRemaining: null, // cannot calculate
      monthlyBurnRate: 0,
      isProfitable: false,
    };
  }

  if (cash.bankBalance <= 0) {
    return {
      monthsRemaining: 0,
      monthlyBurnRate,
      isProfitable: false,
    };
  }

  const months = Math.floor(cash.bankBalance / monthlyBurnRate);

  return {
    monthsRemaining: months,
    monthlyBurnRate,
    isProfitable: false,
  };
}

/**
 * Calculates next-month forecast from historical trends.
 *
 * Uses a simple linear projection from the last 6 months of data.
 * Confidence is based on data volume (more historical data = higher confidence).
 */
export function calculateForecast(data: FinancialData): ForecastResult {
  const { invoices, purchaseBills, expenses, bankAccounts } = data;

  const revenueTrend = calculateRevenueTrend(invoices, 6);
  const cash = calculateCash(bankAccounts);

  // ── Revenue forecast: average of last 3 months, or linear trend ──
  const recentRevenue = revenueTrend.slice(-3);
  const avgRecentRevenue = recentRevenue.length > 0
    ? recentRevenue.reduce((s, p) => s + p.revenue, 0) / recentRevenue.length
    : 0;

  // Simple linear trend: if revenue is increasing, project slightly higher
  let nextMonthRevenue = avgRecentRevenue;
  if (revenueTrend.length >= 2) {
    const first = revenueTrend[0].revenue;
    const last = revenueTrend[revenueTrend.length - 1].revenue;
    const trend = (last - first) / revenueTrend.length;
    nextMonthRevenue = last + trend;
  }
  nextMonthRevenue = Math.max(0, nextMonthRevenue);

  // ── Expense forecast: average of last 3 months ──
  const now = new Date();
  const periods: string[] = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const recentExpenses = periods.map(p => calculateExpensesForPeriod(purchaseBills, expenses, p));
  const nextMonthExpenses = recentExpenses.length > 0
    ? recentExpenses.reduce((s, e) => s + e, 0) / recentExpenses.length
    : 0;

  // ── Projected cash ──
  const projectedCash = round2(cash.bankBalance + nextMonthRevenue - nextMonthExpenses);

  // ── Confidence: based on data volume ──
  let confidence = 0;
  const dataPoints = invoices.length + purchaseBills.length + expenses.length;
  if (dataPoints > 0) {
    confidence = Math.min(100, Math.round((dataPoints / 50) * 100));
    // Higher confidence if we have multiple months of data
    if (revenueTrend.filter(p => p.revenue > 0).length >= 3) {
      confidence = Math.max(confidence, 60);
    }
  }

  return {
    nextMonthRevenue: round2(nextMonthRevenue),
    nextMonthExpenses: round2(nextMonthExpenses),
    projectedCash,
    confidence,
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
