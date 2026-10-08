// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Real Invoice Engine™ — Module 9: Invoice Analytics
// Revenue, top clients, collection efficiency, gross margin, expense ratio, profitability.
// Deterministic. Reads from Prisma. No LLM.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import {
  type AnalyticsResult,
  type TopClient,
  type MonthlyRevenue,
  type InvoiceListResult,
  type PurchaseListResult,
  type ExpenseListResult,
  type ReceivablesListResult,
  type PayrollListResult,
  currentMonth,
  lastMonth,
  monthLabel,
  inrShort,
} from './types';

// ─── Get last N months as YYYY-MM strings ─────────────────────────────────────

function lastNMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const dd = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(dd.toISOString().slice(0, 7));
  }
  return out;
}

// ─── Compute analytics ────────────────────────────────────────────────────────

export async function getAnalytics(deps?: {
  invoices?: InvoiceListResult;
  purchases?: PurchaseListResult;
  expenses?: ExpenseListResult;
  receivables?: ReceivablesListResult;
  payroll?: PayrollListResult;
}): Promise<AnalyticsResult> {
  // Use provided deps or fetch from DB
  const invoicesFromDeps = deps?.invoices;
  const invoiceRows = invoicesFromDeps
    ? null
    : await db.invoice.findMany({
        include: {
          client: { select: { tradeName: true, id: true } },
          payments: { select: { amount: true, status: true } },
        },
      });

  const expensesFromDeps = deps?.expenses;
  const expenseRows = expensesFromDeps ? null : await db.expense.findMany({ select: { date: true, amount: true, category: true } });

  const purchasesFromDeps = deps?.purchases;
  const purchaseRows = purchasesFromDeps
    ? null
    : await db.purchaseBill.findMany({ select: { taxableValue: true, itcAmount: true, billDate: true } });

  const payroll = deps?.payroll?.currentMonthPayroll;

  // Revenue calculations
  const totalRevenue = invoicesFromDeps
    ? invoicesFromDeps.totalRevenue
    : (invoiceRows?.reduce((s, i) => s + (i.totalAmount ?? 0), 0) ?? 0);
  const thisMonth = currentMonth();
  const lastMonthStr = lastMonth();

  const monthRevenue = (m: string) => {
    if (invoicesFromDeps) {
      return invoicesFromDeps.invoices.filter((i) => i.invoiceDate.slice(0, 7) === m).reduce((s, i) => s + i.total, 0);
    }
    if (invoiceRows) {
      return invoiceRows.filter((i) => i.invoiceDate.slice(0, 7) === m).reduce((s, i) => s + i.totalAmount, 0);
    }
    return 0;
  };

  const revenueThisMonth = monthRevenue(thisMonth);
  const revenueLastMonth = monthRevenue(lastMonthStr);
  const revenueGrowthPct =
    revenueLastMonth > 0
      ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100)
      : revenueThisMonth > 0
        ? 100
        : 0;

  // Expenses
  const totalExpenses = expensesFromDeps
    ? expensesFromDeps.totalAmount
    : (expenseRows?.reduce((s, e) => s + (e.amount ?? 0), 0) ?? 0);

  const monthExpenses = (m: string) => {
    if (expensesFromDeps) {
      return expensesFromDeps.expenses.filter((e) => e.date.slice(0, 7) === m).reduce((s, e) => s + e.amount, 0);
    }
    if (expenseRows) {
      return expenseRows.filter((e) => e.date.slice(0, 7) === m).reduce((s, e) => s + e.amount, 0);
    }
    return 0;
  };

  // Profitability
  const grossMargin = totalRevenue - totalExpenses;
  const grossMarginPct = totalRevenue > 0 ? Math.round((grossMargin / totalRevenue) * 100) : 0;
  const payrollCost = payroll?.totalCost ?? 0;
  const netProfit = grossMargin - payrollCost;
  const netMarginPct = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;
  const expenseRatioPct = totalRevenue > 0 ? Math.round((totalExpenses / totalRevenue) * 100) : 0;

  // Collections
  const collectionEfficiencyPct = deps?.receivables?.collectionEfficiencyPct ?? 0;
  const avgCollectionDays = deps?.receivables?.avgDaysOverdue ?? 0;

  // Top clients (by revenue)
  const clientMap = new Map<string, { name: string; count: number; revenue: number; collected: number; outstanding: number }>();
  if (invoicesFromDeps) {
    for (const inv of invoicesFromDeps.invoices) {
      const cur = clientMap.get(inv.clientId) ?? {
        name: inv.clientName,
        count: 0,
        revenue: 0,
        collected: 0,
        outstanding: 0,
      };
      cur.count += 1;
      cur.revenue += inv.total;
      cur.collected += inv.paidAmount;
      cur.outstanding += inv.balanceDue;
      clientMap.set(inv.clientId, cur);
    }
  } else if (invoiceRows) {
    for (const inv of invoiceRows) {
      const key = inv.clientId;
      const cur = clientMap.get(key) ?? {
        name: inv.client?.tradeName ?? 'Unknown',
        count: 0,
        revenue: 0,
        collected: 0,
        outstanding: 0,
      };
      cur.count += 1;
      cur.revenue += inv.totalAmount;
      cur.collected += inv.payments?.filter((p) => p.status === 'success' || p.status === 'reconciled').reduce((s, p) => s + p.amount, 0) ?? 0;
      clientMap.set(key, cur);
    }
  }

  const topClients: TopClient[] = Array.from(clientMap.values())
    .map((c) => ({
      clientId: '',
      clientName: c.name,
      invoiceCount: c.count,
      totalRevenue: Math.round(c.revenue * 100) / 100,
      totalCollected: Math.round(c.collected * 100) / 100,
      outstanding: Math.round(c.outstanding * 100) / 100,
      pctOfRevenue: totalRevenue > 0 ? Math.round((c.revenue / totalRevenue) * 100) : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 10);

  // Monthly trend (last 6 months)
  const months = lastNMonths(6);
  const monthlyTrend: MonthlyRevenue[] = months.map((m) => {
    const revenue = monthRevenue(m);
    const collected = 0; // would need payment data
    const expensesM = monthExpenses(m);
    const profit = revenue - expensesM;
    return {
      month: monthLabel(m),
      revenue: Math.round(revenue * 100) / 100,
      collected,
      expenses: Math.round(expensesM * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      marginPct: revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
    };
  });

  // Counts
  const totalInvoices = invoicesFromDeps?.total ?? invoiceRows?.length ?? 0;
  const paidInvoices = invoicesFromDeps?.invoices.filter((i) => i.status === 'paid').length ?? 0;
  const overdueInvoices = invoicesFromDeps?.invoices.filter((i) => i.status === 'overdue').length ?? 0;
  const totalPurchaseValue = purchasesFromDeps?.totalPurchaseValue ?? (purchaseRows?.reduce((s, p) => s + (p.taxableValue ?? 0), 0) ?? 0);
  const totalITC = purchasesFromDeps?.totalITC ?? (purchaseRows?.reduce((s, p) => s + (p.itcAmount ?? 0), 0) ?? 0);
  const totalPayrollCost = payroll?.totalCost ?? 0;

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    revenueThisMonth: Math.round(revenueThisMonth * 100) / 100,
    revenueLastMonth: Math.round(revenueLastMonth * 100) / 100,
    revenueGrowthPct,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    grossMargin: Math.round(grossMargin * 100) / 100,
    grossMarginPct,
    netProfit: Math.round(netProfit * 100) / 100,
    netMarginPct,
    expenseRatioPct,
    collectionEfficiencyPct,
    avgCollectionDays,
    topClients,
    monthlyTrend,
    totalInvoices,
    paidInvoices,
    overdueInvoices,
    totalPurchaseValue: Math.round(totalPurchaseValue * 100) / 100,
    totalITC: Math.round(totalITC * 100) / 100,
    totalPayrollCost: Math.round(totalPayrollCost * 100) / 100,
    hasLiveData: totalInvoices > 0 || totalExpenses > 0 || totalPayrollCost > 0,
  };
}

// ─── Quick stats summary ───────────────────────────────────────────────────────

export function analyticsStatsSummary(a: AnalyticsResult) {
  return {
    growthDirection: a.revenueGrowthPct >= 0 ? 'up' : 'down',
    profitDirection: a.netProfit >= 0 ? 'profit' : 'loss',
    topClientName: a.topClients[0]?.clientName ?? '—',
    topClientPct: a.topClients[0]?.pctOfRevenue ?? 0,
    formatted: {
      totalRevenue: inrShort(a.totalRevenue),
      revenueThisMonth: inrShort(a.revenueThisMonth),
      grossMargin: inrShort(a.grossMargin),
      netProfit: inrShort(a.netProfit),
      totalExpenses: inrShort(a.totalExpenses),
      totalITC: inrShort(a.totalITC),
      totalPayrollCost: inrShort(a.totalPayrollCost),
    },
  };
}
