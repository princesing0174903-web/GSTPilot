// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI CFO™ Phase 1 — PROFITABILITY ENGINE
//
// Real profitability analytics from connected business data:
//   • Gross Profit / Gross Margin %
//   • Net Profit / Net Margin %
//   • Operating Margin %
//   • EBITDA (estimate)
//   • Expense Ratio %
//   • Customer Profitability (per-client profit)
//   • Vendor Cost analysis
//   • Monthly Trends (6 months)
//
// COGS = purchase bills (vendor invoices) for services delivered
// OPEX = expenses (operational spend)
// EBITDA = Gross Profit - OPEX (excludes interest, tax, depreciation, amortization)
// Net Profit = EBITDA - estimated tax (flat 25% corporate rate estimate)
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  ProfitabilityAnalytics,
  ProfitMonthlyTrend,
  CustomerProfitability,
  VendorCostRow,
} from '../types';
import type { RawCFOData, InvoiceRow, ExpenseRow, PurchaseBillRow } from './data';
import {
  now, startOfMonth, startOfLastMonth, endOfLastMonth, addDays,
  monthLabel, pctChange, trendFromPct, roundTo,
} from './data';

function revenueForRange(invoices: InvoiceRow[], from: Date, to: Date): number {
  return invoices
    .filter((i) => { const d = new Date(i.invoiceDate); return d >= from && d <= to; })
    .reduce((s, i) => s + (i.totalAmount || 0), 0);
}

function cogsForRange(purchaseBills: PurchaseBillRow[], from: Date, to: Date): number {
  // COGS = purchase bills (vendor invoices for services/goods delivered)
  return purchaseBills
    .filter((p) => { const d = new Date(p.invoiceDate); return d >= from && d <= to; })
    .reduce((s, p) => s + (p.totalAmount || 0), 0);
}

function opexForRange(expenses: ExpenseRow[], from: Date, to: Date): number {
  return expenses
    .filter((e) => { const d = new Date(e.date); return d >= from && d <= to; })
    .reduce((s, e) => s + (e.amount || 0), 0);
}

const EST_TAX_RATE = 0.25; // corporate tax estimate (New regime, < ₹400Cr turnover)

function buildMonthlyTrends(
  invoices: InvoiceRow[],
  expenses: ExpenseRow[],
  purchaseBills: PurchaseBillRow[],
): ProfitMonthlyTrend[] {
  const trends: ProfitMonthlyTrend[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now().getFullYear(), now().getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    const revenue = revenueForRange(invoices, start, end);
    const cogs = cogsForRange(purchaseBills, start, end);
    const grossProfit = revenue - cogs;
    const opex = opexForRange(expenses, start, end);
    const ebitda = grossProfit - opex;
    const tax = Math.max(0, ebitda) * EST_TAX_RATE;
    const netProfit = ebitda - tax;
    trends.push({
      month: monthLabel(d),
      revenue: Math.round(revenue),
      cogs: Math.round(cogs),
      grossProfit: Math.round(grossProfit),
      opex: Math.round(opex),
      ebitda: Math.round(ebitda),
      netProfit: Math.round(netProfit),
      grossMarginPct: revenue > 0 ? roundTo((grossProfit / revenue) * 100, 1) : 0,
      operatingMarginPct: revenue > 0 ? roundTo((ebitda / revenue) * 100, 1) : 0,
      netMarginPct: revenue > 0 ? roundTo((netProfit / revenue) * 100, 1) : 0,
      ebitdaMarginPct: revenue > 0 ? roundTo((ebitda / revenue) * 100, 1) : 0,
    });
  }
  return trends;
}

function buildCustomerProfitability(
  invoices: InvoiceRow[],
  expenses: ExpenseRow[],
  purchaseBills: PurchaseBillRow[],
): CustomerProfitability[] {
  // Per-client revenue + proportional cost allocation
  const clientRevenue = new Map<string, number>();
  for (const inv of invoices) {
    clientRevenue.set(inv.clientId, (clientRevenue.get(inv.clientId) || 0) + (inv.totalAmount || 0));
  }
  const totalRevenue = Array.from(clientRevenue.values()).reduce((s, v) => s + v, 0);

  // Allocate expenses proportionally by revenue share
  const totalOpex = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalCogs = purchaseBills.reduce((s, p) => s + (p.totalAmount || 0), 0);

  // Also pull direct client-linked costs (expenses with clientId, purchaseBills with clientId)
  const rows: CustomerProfitability[] = Array.from(clientRevenue.entries()).map(([clientId, revenue]) => {
    const share = totalRevenue > 0 ? revenue / totalRevenue : 0;
    // Allocated overhead (opex + cogs) proportional to revenue share
    const allocatedOverhead = (totalOpex + totalCogs) * share;
    // Direct costs: expenses/purchaseBills explicitly tagged to this client
    const directExpenses = expenses
      .filter((e) => e.clientId === clientId)
      .reduce((s, e) => s + (e.amount || 0), 0);
    const directPurchaseBills = purchaseBills
      .filter((p) => p.clientId === clientId)
      .reduce((s, p) => s + (p.totalAmount || 0), 0);
    const directCost = directExpenses + directPurchaseBills + allocatedOverhead * 0.5;
    const grossProfit = revenue - directCost;
    const ebitda = grossProfit - allocatedOverhead * 0.5;
    const tax = Math.max(0, ebitda) * EST_TAX_RATE;
    const netProfit = ebitda - tax;
    const client = invoices.find((i) => i.clientId === clientId);
    return {
      clientId,
      clientName: client?.buyerName || `Client ${clientId.slice(-6)}`,
      revenue: Math.round(revenue),
      directCost: Math.round(directCost),
      grossProfit: Math.round(grossProfit),
      grossMarginPct: revenue > 0 ? roundTo((grossProfit / revenue) * 100, 1) : 0,
      netProfit: Math.round(netProfit),
      profitRank: 0,
    };
  });

  // Sort by net profit and assign rank
  rows.sort((a, b) => b.netProfit - a.netProfit);
  rows.forEach((r, i) => { r.profitRank = i + 1; });

  // Return top 10 + bottom 5
  const top = rows.slice(0, 10);
  const bottom = rows.slice(-5).filter((r) => !top.includes(r));
  return [...top, ...bottom];
}

function buildVendorCosts(purchaseBills: PurchaseBillRow[]): VendorCostRow[] {
  const agg = new Map<string, {
    vendorName: string;
    vendorGstin?: string;
    totalSpend: number;
    invoiceCount: number;
    overdueAmount: number;
  }>();

  const today = now();
  for (const pb of purchaseBills) {
    const key = pb.vendorGstin || pb.vendorName;
    const existing = agg.get(key) || {
      vendorName: pb.vendorName,
      vendorGstin: pb.vendorGstin || undefined,
      totalSpend: 0,
      invoiceCount: 0,
      overdueAmount: 0,
    };
    existing.totalSpend += pb.totalAmount || 0;
    existing.invoiceCount += 1;
    if (pb.dueDate && pb.paymentStatus !== 'paid' && new Date(pb.dueDate) < today) {
      existing.overdueAmount += pb.balanceAmount || pb.totalAmount || 0;
    }
    agg.set(key, existing);
  }

  const total = Array.from(agg.values()).reduce((s, v) => s + v.totalSpend, 0);

  return Array.from(agg.values())
    .map((v) => ({
      ...v,
      avgInvoiceValue: v.invoiceCount > 0 ? Math.round(v.totalSpend / v.invoiceCount) : 0,
      sharePct: total > 0 ? roundTo((v.totalSpend / total) * 100, 1) : 0,
      totalSpend: Math.round(v.totalSpend),
      overdueAmount: Math.round(v.overdueAmount),
    }))
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, 10);
}

export function computeProfitability(data: RawCFOData): ProfitabilityAnalytics {
  const { invoices, expenses, purchaseBills } = data;

  const mStart = startOfMonth();
  const tomorrow = addDays(mStart, 0); // Use today
  const todayStart = new Date(now().getFullYear(), now().getMonth(), now().getDate());
  const todayEnd = addDays(todayStart, 1);
  // Use current month-to-date
  const mEnd = todayEnd;

  const lmStart = startOfLastMonth();
  const lmEnd = endOfLastMonth();

  const revenue = revenueForRange(invoices, mStart, mEnd);
  const cogs = cogsForRange(purchaseBills, mStart, mEnd);
  const opex = opexForRange(expenses, mStart, mEnd);
  const grossProfit = revenue - cogs;
  const ebitda = grossProfit - opex;
  const tax = Math.max(0, ebitda) * EST_TAX_RATE;
  const netProfit = ebitda - tax;
  const totalExpenses = cogs + opex;

  const grossMarginPct = revenue > 0 ? roundTo((grossProfit / revenue) * 100, 1) : 0;
  const operatingMarginPct = revenue > 0 ? roundTo((ebitda / revenue) * 100, 1) : 0;
  const ebitdaMarginPct = operatingMarginPct;
  const netMarginPct = revenue > 0 ? roundTo((netProfit / revenue) * 100, 1) : 0;
  const expenseRatioPct = revenue > 0 ? roundTo((totalExpenses / revenue) * 100, 1) : 0;

  const monthlyTrends = buildMonthlyTrends(invoices, expenses, purchaseBills);
  const customerProfitability = buildCustomerProfitability(invoices, expenses, purchaseBills);
  const vendorCosts = buildVendorCosts(purchaseBills);

  // Trend: compare this month's net margin vs last month's
  const lastMonthRevenue = revenueForRange(invoices, lmStart, lmEnd);
  const lastMonthNet = monthlyTrends[monthlyTrends.length - 2]?.netProfit || 0;
  const trend = trendFromPct(pctChange(netProfit, lastMonthNet));

  return {
    revenue: Math.round(revenue),
    cogs: Math.round(cogs),
    grossProfit: Math.round(grossProfit),
    grossMarginPct,
    opex: Math.round(opex),
    operatingMarginPct,
    ebitda: Math.round(ebitda),
    ebitdaMarginPct,
    netProfit: Math.round(netProfit),
    netMarginPct,
    expenseRatioPct,
    monthlyTrends,
    customerProfitability,
    vendorCosts,
    trend,
  };
}
