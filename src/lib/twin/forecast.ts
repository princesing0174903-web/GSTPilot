// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT DIGITAL TWIN™ — FORECAST ENGINE
//
// Forward-looking projections for 6 metrics across multiple horizons:
//   Revenue, Cash Flow, Profit, GST Liability, Expenses, Collections.
//
// Uses historical trends (last 3-6 months) to project 7d/30d/90d/365d with
// confidence scores based on data completeness and volatility.
// ═══════════════════════════════════════════════════════════════════════════════

import { fetchRawCFOData, startOfMonth, startOfLastMonth, endOfLastMonth, addMonths } from '@/lib/cfo/phase1/data';
import type { TwinForecast } from './types';

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function volatility(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = avg(nums);
  const variance = nums.reduce((s, n) => s + Math.pow(n - m, 2), 0) / nums.length;
  return Math.sqrt(variance);
}

function confidenceFromVolatility(nums: number[], base = 75): number {
  if (nums.length === 0) return 40;
  const m = avg(nums);
  if (m === 0) return 45;
  const vol = volatility(nums);
  const cv = vol / Math.abs(m); // coefficient of variation
  // Lower CV = higher confidence
  const penalty = Math.min(35, cv * 100);
  return Math.max(45, Math.min(90, Math.round(base - penalty)));
}

export async function computeTwinForecast(): Promise<TwinForecast> {
  const data = await fetchRawCFOData();
  const today = new Date();

  // Build last 6 months of revenue + expenses + collections + gst
  const monthlyRevenue: number[] = [];
  const monthlyExpenses: number[] = [];
  const monthlyCollections: number[] = [];
  const monthlyGst: number[] = [];

  for (let i = 5; i >= 1; i--) {
    const mStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const mEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0, 23, 59, 59, 999);
    monthlyRevenue.push(data.invoices
      .filter((inv) => { const d = new Date(inv.invoiceDate); return d >= mStart && d <= mEnd; })
      .reduce((s, inv) => s + (inv.totalAmount || 0), 0));
    monthlyExpenses.push(data.expenses
      .filter((e) => { const d = new Date(e.date); return d >= mStart && d <= mEnd; })
      .reduce((s, e) => s + (e.amount || 0), 0));
    monthlyCollections.push(data.payments
      .filter((p) => { const d = new Date(p.paymentDate); return d >= mStart && d <= mEnd && p.partyType === 'customer'; })
      .reduce((s, p) => s + (p.amount || 0), 0));
    monthlyGst.push(data.invoices
      .filter((inv) => { const d = new Date(inv.invoiceDate); return d >= mStart && d <= mEnd; })
      .reduce((s, inv) => s + (inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0) + (inv.cess || 0), 0));
  }

  // This month (partial)
  const mStart = startOfMonth();
  const thisMonthRevenue = data.invoices
    .filter((inv) => new Date(inv.invoiceDate) >= mStart)
    .reduce((s, inv) => s + (inv.totalAmount || 0), 0);
  const thisMonthExpenses = data.expenses
    .filter((e) => new Date(e.date) >= mStart)
    .reduce((s, e) => s + (e.amount || 0), 0);
  const thisMonthCollections = data.payments
    .filter((p) => new Date(p.paymentDate) >= mStart && p.partyType === 'customer')
    .reduce((s, p) => s + (p.amount || 0), 0);
  const thisMonthGst = data.invoices
    .filter((inv) => new Date(inv.invoiceDate) >= mStart)
    .reduce((s, inv) => s + (inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0) + (inv.cess || 0), 0);

  // Trend: average MoM growth rate
  const revenueGrowthRates: number[] = [];
  for (let i = 1; i < monthlyRevenue.length; i++) {
    if (monthlyRevenue[i - 1] > 0) {
      revenueGrowthRates.push((monthlyRevenue[i] - monthlyRevenue[i - 1]) / monthlyRevenue[i - 1]);
    }
  }
  const avgRevenueGrowth = revenueGrowthRates.length > 0 ? avg(revenueGrowthRates) : 0;

  // Project: use last month's value × growth rate, scaled by horizon
  const lastMonthRev = monthlyRevenue[monthlyRevenue.length - 1] || thisMonthRevenue;
  const lastMonthExp = monthlyExpenses[monthlyExpenses.length - 1] || thisMonthExpenses;
  const lastMonthColl = monthlyCollections[monthlyCollections.length - 1] || thisMonthCollections;
  const lastMonthGst = monthlyGst[monthlyGst.length - 1] || thisMonthGst;
  const lastMonthProfit = lastMonthRev - lastMonthExp;

  const dailyRevenue = lastMonthRev / 30;
  const dailyExpenses = lastMonthExp / 30;
  const dailyCollections = lastMonthColl / 30;

  const revenueConfidence = confidenceFromVolatility(monthlyRevenue);
  const expenseConfidence = confidenceFromVolatility(monthlyExpenses, 70);
  const collectionConfidence = confidenceFromVolatility(monthlyCollections, 70);
  const gstConfidence = confidenceFromVolatility(monthlyGst, 65);

  // GST: next filing = this month's liability, next 30d = projected
  const nextFilingGst = thisMonthGst;

  return {
    revenue: {
      sevenDay: Math.round(dailyRevenue * 7 * (1 + avgRevenueGrowth / 4)),
      thirtyDay: Math.round(lastMonthRev * (1 + avgRevenueGrowth)),
      ninetyDay: Math.round(lastMonthRev * 3 * (1 + avgRevenueGrowth * 2)),
      yearEnd: Math.round(lastMonthRev * (12 - today.getMonth()) * (1 + avgRevenueGrowth)),
      confidencePct: revenueConfidence,
    },
    cashFlow: {
      sevenDay: Math.round((dailyCollections - dailyExpenses) * 7),
      thirtyDay: Math.round((lastMonthColl - lastMonthExp) * (1 + avgRevenueGrowth / 2)),
      ninetyDay: Math.round((lastMonthColl - lastMonthExp) * 3),
      yearEnd: Math.round((lastMonthColl - lastMonthExp) * (12 - today.getMonth())),
      confidencePct: Math.round((revenueConfidence + collectionConfidence) / 2),
    },
    profit: {
      sevenDay: Math.round((dailyRevenue - dailyExpenses) * 7),
      thirtyDay: Math.round(lastMonthProfit * (1 + avgRevenueGrowth)),
      ninetyDay: Math.round(lastMonthProfit * 3 * (1 + avgRevenueGrowth * 2)),
      yearEnd: Math.round(lastMonthProfit * (12 - today.getMonth())),
      confidencePct: revenueConfidence,
    },
    gstLiability: {
      nextFiling: Math.round(nextFilingGst),
      next30d: Math.round(lastMonthGst * (1 + avgRevenueGrowth)),
      confidencePct: gstConfidence,
    },
    expenses: {
      thirtyDay: Math.round(lastMonthExp * (1 + avgRevenueGrowth / 3)),
      ninetyDay: Math.round(lastMonthExp * 3),
      confidencePct: expenseConfidence,
    },
    collections: {
      thirtyDay: Math.round(lastMonthColl * (1 + avgRevenueGrowth / 2)),
      ninetyDay: Math.round(lastMonthColl * 3),
      confidencePct: collectionConfidence,
    },
    overallConfidencePct: Math.round((revenueConfidence + expenseConfidence + collectionConfidence + gstConfidence) / 4),
    generatedAt: new Date().toISOString(),
  };
}

// ─── Unused imports guard (kept for future period queries) ───────────────────
void startOfLastMonth; void endOfLastMonth; void addMonths;
