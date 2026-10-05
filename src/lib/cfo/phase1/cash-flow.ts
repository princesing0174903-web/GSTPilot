// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI CFO™ Phase 1 — CASH FLOW ENGINE
//
// Real cash flow analytics from connected business data:
//   • Current cash position (bank + cash from synced bank transactions + payments)
//   • Daily / monthly burn rate
//   • Runway days + date cash runs out
//   • 7d / 30d / 90d / 365d projections
//   • "Why is cash decreasing?" root-cause explanations
//
// Cash position is computed from REAL inflows (customer payments) and outflows
// (vendor payments + expenses) recorded in the Payment + Expense tables, plus
// any bank transactions synced via the Bank connector.
// ═══════════════════════════════════════════════════════════════════════════════

import type { CashFlowAnalytics, CashFlowProjection } from '../types';
import type { RawCFOData, PaymentRow, ExpenseRow } from './data';
import {
  now, startOfMonth, addDays, startOfLastMonth, endOfLastMonth,
  pctChange, trendFromPct, roundTo, ymd,
} from './data';

function inflowForRange(payments: PaymentRow[], from: Date, to: Date): number {
  return payments
    .filter((p) => {
      if (p.partyType !== 'customer') return false;
      const d = new Date(p.paymentDate);
      return d >= from && d <= to && (p.status === 'completed' || p.status === 'reconciled');
    })
    .reduce((s, p) => s + (p.amount || 0), 0);
}

function outflowForRange(payments: PaymentRow[], expenses: ExpenseRow[], from: Date, to: Date): number {
  const vendorOut = payments
    .filter((p) => {
      if (p.partyType !== 'vendor') return false;
      const d = new Date(p.paymentDate);
      return d >= from && d <= to && (p.status === 'completed' || p.status === 'reconciled');
    })
    .reduce((s, p) => s + (p.amount || 0), 0);
  const expenseOut = expenses
    .filter((e) => {
      const d = new Date(e.date);
      return d >= from && d <= to;
    })
    .reduce((s, e) => s + (e.amount || 0), 0);
  return vendorOut + expenseOut;
}

// Parse bank synced records for additional cash context
function parseBankTransactions(data: RawCFOData): { balance: number; last30Inflow: number; last30Outflow: number } {
  let balance = 0;
  let last30Inflow = 0;
  let last30Outflow = 0;
  const today = now();
  const thirtyDaysAgo = addDays(today, -30);

  for (const rec of data.syncedRecords) {
    if (rec.sourceType !== 'bank_tx') continue;
    try {
      const payload = rec.rawData ? JSON.parse(rec.rawData) : {};
      if (payload.balance && typeof payload.balance === 'number') {
        balance = Math.max(balance, payload.balance);
      }
      const txDate = rec.date ? new Date(rec.date) : (payload.date ? new Date(payload.date) : null);
      const amount = Number(rec.amount ?? payload.amount ?? 0);
      if (txDate && txDate >= thirtyDaysAgo && txDate <= today) {
        if (amount > 0) last30Inflow += amount;
        else last30Outflow += Math.abs(amount);
      }
    } catch {
      // ignore malformed payloads
    }
  }
  return { balance, last30Inflow, last30Outflow };
}

export function computeCashFlow(data: RawCFOData): CashFlowAnalytics {
  const { payments, expenses } = data;
  const today = now();
  const mStart = startOfMonth();
  const tomorrow = addDays(today, 1);
  const lmStart = startOfLastMonth();
  const lmEnd = endOfLastMonth();

  // ─── Current cash position ────────────────────────────────────────────────
  // Cash = bank balance (from synced bank tx) + net payments collected all-time
  // If no bank data, derive from cumulative collections - cumulative outflows.
  const bankInfo = parseBankTransactions(data);

  const totalInflowAllTime = payments
    .filter((p) => p.partyType === 'customer' && (p.status === 'completed' || p.status === 'reconciled'))
    .reduce((s, p) => s + (p.amount || 0), 0);
  const totalOutflowAllTime = payments
    .filter((p) => p.partyType === 'vendor' && (p.status === 'completed' || p.status === 'reconciled'))
    .reduce((s, p) => s + (p.amount || 0), 0)
    + expenses.reduce((s, e) => s + (e.amount || 0), 0);

  let currentCash: number;
  if (bankInfo.balance > 0) {
    // Trust bank balance if available
    currentCash = bankInfo.balance;
  } else {
    // Derive from payments history
    currentCash = Math.max(totalInflowAllTime - totalOutflowAllTime, 0);
  }

  // Reserve: minimum operating buffer (5% of current cash or ₹50k, whichever is smaller)
  const reserve = Math.min(currentCash * 0.05, 50000);
  const availableCash = Math.max(currentCash - reserve, 0);

  // ─── This month inflow / outflow / net ─────────────────────────────────────
  const inflowThisMonth = inflowForRange(payments, mStart, tomorrow);
  const outflowThisMonth = outflowForRange(payments, expenses, mStart, tomorrow);
  const netThisMonth = inflowThisMonth - outflowThisMonth;

  // ─── Burn rate ────────────────────────────────────────────────────────────
  // Daily burn = avg daily outflow over last 30 days
  const last30Start = addDays(today, -30);
  const last30Outflow = outflowForRange(payments, expenses, last30Start, tomorrow);
  const burnRatePerDay = Math.round(last30Outflow / 30);
  const burnRatePerMonth = burnRatePerDay * 30;

  // ─── Runway ───────────────────────────────────────────────────────────────
  let runwayDays = 0;
  let runwayDate: string | null = null;
  if (burnRatePerDay > 0) {
    runwayDays = Math.round(availableCash / burnRatePerDay);
    if (runwayDays > 0 && runwayDays <= 365) {
      runwayDate = ymd(addDays(today, runwayDays));
    } else if (runwayDays > 365) {
      runwayDays = 0; // treat as "infinite" (> 1 year)
    }
  }

  // ─── Projections: 7d / 30d / 90d / 365d ───────────────────────────────────
  // Expected inflow: based on outstanding receivables due in window + historical daily run rate
  // Expected outflow: based on burn rate * days + upcoming payables in window
  const dailyInflowRate = inflowForRange(payments, last30Start, tomorrow) / 30;

  const projectedOutstandingDue = (days: number) => {
    const cutoff = addDays(today, days);
    return data.invoices
      .filter((inv) => {
        if (!inv.dueDate) return false;
        const due = new Date(inv.dueDate);
        return due >= today && due <= cutoff && (inv.paymentStatus === 'unpaid' || inv.paymentStatus === 'partial' || inv.paymentStatus === 'overdue');
      })
      .reduce((s, inv) => s + (inv.balanceAmount || inv.totalAmount || 0), 0);
  };

  const projectedPayablesDue = (days: number) => {
    const cutoff = addDays(today, days);
    return data.purchaseBills
      .filter((pb) => {
        if (!pb.dueDate) return false;
        const due = new Date(pb.dueDate);
        return due >= today && due <= cutoff && (pb.paymentStatus === 'unpaid' || pb.paymentStatus === 'partial' || pb.paymentStatus === 'overdue');
      })
      .reduce((s, pb) => s + (pb.balanceAmount || pb.totalAmount || 0), 0);
  };

  const buildProjection = (days: number): CashFlowProjection => {
    const inflowFromRunRate = dailyInflowRate * days;
    const inflowFromReceivables = projectedOutstandingDue(days);
    const inflow = inflowFromRunRate + inflowFromReceivables;
    const outflow = burnRatePerDay * days + projectedPayablesDue(days);
    const net = inflow - outflow;
    const endingCash = currentCash + net;
    // Confidence: higher for shorter horizons, lower if no historical data
    const dataPoints = Math.min(payments.length + expenses.length, 100);
    const baseConfidence = 90 - (days / 365) * 40; // 90% at 1d, 50% at 365d
    const dataConfidence = Math.min(dataPoints / 50, 1) * 20; // up to +20% for more data
    const confidencePct = Math.max(35, Math.min(95, Math.round(baseConfidence + dataConfidence)));
    return {
      period: days === 7 ? '7d' : days === 30 ? '30d' : days === 90 ? '90d' : '365d',
      inflow: Math.round(inflow),
      outflow: Math.round(outflow),
      net: Math.round(net),
      endingCash: Math.round(endingCash),
      confidencePct,
    };
  };

  const projections = [buildProjection(7), buildProjection(30), buildProjection(90), buildProjection(365)];

  // ─── Why is cash decreasing? ──────────────────────────────────────────────
  const whyDecreasing: string[] = [];
  if (netThisMonth < 0) {
    whyDecreasing.push(`Outflows exceeded inflows by ₹${Math.round(Math.abs(netThisMonth)).toLocaleString('en-IN')} this month.`);
  }
  if (outflowThisMonth > inflowThisMonth * 1.2 && inflowThisMonth > 0) {
    whyDecreasing.push(`Monthly outflows (₹${Math.round(outflowThisMonth).toLocaleString('en-IN')}) are ${Math.round((outflowThisMonth / inflowThisMonth - 1) * 100)}% higher than inflows.`);
  }
  // Top expense categories
  const expenseByCategory = new Map<string, number>();
  for (const e of expenses) {
    const d = new Date(e.date);
    if (d >= mStart && d <= tomorrow) {
      expenseByCategory.set(e.category, (expenseByCategory.get(e.category) || 0) + (e.amount || 0));
    }
  }
  const topCat = Array.from(expenseByCategory.entries()).sort((a, b) => b[1] - a[1])[0];
  if (topCat && topCat[1] > outflowThisMonth * 0.3) {
    whyDecreasing.push(`${topCat[0]} expenses alone consumed ₹${Math.round(topCat[1]).toLocaleString('en-IN')} (${Math.round((topCat[1] / outflowThisMonth) * 100)}% of outflows).`);
  }
  // Overdue receivables impact
  const overdueReceivables = data.invoices
    .filter((i) => i.paymentStatus === 'overdue' || (i.dueDate && new Date(i.dueDate) < today && i.paymentStatus !== 'paid'))
    .reduce((s, i) => s + (i.balanceAmount || i.totalAmount || 0), 0);
  if (overdueReceivables > 0) {
    whyDecreasing.push(`₹${Math.round(overdueReceivables).toLocaleString('en-IN')} is stuck in overdue receivables — recover to improve cash.`);
  }
  // Vendor dues pressure
  const vendorOverdue = data.purchaseBills
    .filter((p) => p.dueDate && new Date(p.dueDate) < today && p.paymentStatus !== 'paid')
    .reduce((s, p) => s + (p.balanceAmount || p.totalAmount || 0), 0);
  if (vendorOverdue > 0) {
    whyDecreasing.push(`Vendor payables of ₹${Math.round(vendorOverdue).toLocaleString('en-IN')} are overdue and need to be settled.`);
  }
  if (whyDecreasing.length === 0 && netThisMonth >= 0) {
    whyDecreasing.push('Cash position is stable or improving — inflows are keeping pace with outflows.');
  }

  // ─── Trend ────────────────────────────────────────────────────────────────
  const lastMonthInflow = inflowForRange(payments, lmStart, lmEnd);
  const lastMonthOutflow = outflowForRange(payments, expenses, lmStart, lmEnd);
  const lastMonthNet = lastMonthInflow - lastMonthOutflow;
  const trend = trendFromPct(pctChange(netThisMonth, lastMonthNet));

  return {
    currentCash: Math.round(currentCash),
    availableCash: Math.round(availableCash),
    burnRatePerDay,
    burnRatePerMonth,
    runwayDays,
    runwayDate,
    inflowThisMonth: Math.round(inflowThisMonth),
    outflowThisMonth: Math.round(outflowThisMonth),
    netThisMonth: Math.round(netThisMonth),
    projections,
    whyDecreasing,
    trend,
  };
}
