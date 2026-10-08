// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI CFO™ Phase 1 — EXPENSE ENGINE
//
// Real expense analytics from connected Expense + PurchaseBill data:
//   • Categorize: Payroll, GST, Rent, Utilities, Software, Marketing, Travel,
//                 Professional Fees, Subscriptions, Other
//   • Month-over-month comparison
//   • Top vendors by spend
//   • Recurring vs one-time expenses
//   • Monthly trends (6 months)
//
// The engine normalizes the free-form Expense.category field into the 10
// standardized Phase 1 categories.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ExpenseAnalytics, ExpenseCategory, ExpenseCategoryBreakdown } from '../types';
import type { RawCFOData, ExpenseRow } from './data';
import {
  now, startOfMonth, startOfLastMonth, endOfLastMonth, addDays,
  monthLabel, pctChange, trendFromPct, roundTo,
} from './data';

// Normalize free-form category strings to one of the 10 Phase 1 categories
const CATEGORY_MAP: Record<ExpenseCategory, string[]> = {
  payroll: ['salary', 'salaries', 'payroll', 'wages', 'staff', 'employee', 'compensation', 'bonus'],
  gst: ['gst', 'tax', 'gst payment', 'tax payment', 'tds', 'income tax'],
  rent: ['rent', 'lease', 'office rent', 'premises'],
  utilities: ['utility', 'utilities', 'electricity', 'water', 'internet', 'phone', 'broadband', 'gas'],
  software: ['software', 'saas', 'subscription', 'license', 'app', 'tool', 'cloud', 'hosting', 'server'],
  marketing: ['marketing', 'advertising', 'ads', 'promotion', 'campaign', 'social media', 'seo', 'branding'],
  travel: ['travel', 'conveyance', 'fuel', 'cab', 'flight', 'hotel', 'transport'],
  professional_fees: ['professional', 'consulting', 'legal', 'audit', 'ca', 'accounting', 'advisor', 'fee'],
  subscriptions: ['subscription', 'membership', 'recurring', 'monthly plan'],
  other: [],
};

function normalizeCategory(raw: string): ExpenseCategory {
  const r = (raw || '').toLowerCase().trim();
  if (!r) return 'other';
  for (const cat of Object.keys(CATEGORY_MAP) as ExpenseCategory[]) {
    if (cat === 'other') continue;
    const keywords = CATEGORY_MAP[cat];
    if (keywords.some((kw) => r.includes(kw))) return cat;
  }
  return 'other';
}

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  payroll: 'Payroll & Salaries',
  gst: 'GST & Tax Payments',
  rent: 'Office Rent',
  utilities: 'Utilities',
  software: 'Software & SaaS',
  marketing: 'Marketing & Ads',
  travel: 'Travel & Conveyance',
  professional_fees: 'Professional Fees',
  subscriptions: 'Subscriptions',
  other: 'Other',
};

function expensesForRange(expenses: ExpenseRow[], from: Date, to: Date): ExpenseRow[] {
  return expenses.filter((e) => {
    const d = new Date(e.date);
    return d >= from && d <= to;
  });
}

export function computeExpenses(data: RawCFOData): ExpenseAnalytics {
  const { expenses } = data;
  const today = now();
  const mStart = startOfMonth();
  const tomorrow = addDays(today, 1);
  const lmStart = startOfLastMonth();
  const lmEnd = endOfLastMonth();

  const thisMonthExpenses = expensesForRange(expenses, mStart, tomorrow);
  const lastMonthExpenses = expensesForRange(expenses, lmStart, lmEnd);

  const totalThisMonth = thisMonthExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalLastMonth = lastMonthExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const momChangePct = roundTo(pctChange(totalThisMonth, totalLastMonth), 1);

  // ─── By Category (this month) ─────────────────────────────────────────────
  const catAgg = new Map<ExpenseCategory, { amount: number; count: number; lastMonth: number }>();
  // initialize all categories
  for (const cat of Object.keys(CATEGORY_LABELS) as ExpenseCategory[]) {
    catAgg.set(cat, { amount: 0, count: 0, lastMonth: 0 });
  }
  for (const e of thisMonthExpenses) {
    const cat = normalizeCategory(e.category);
    const agg = catAgg.get(cat)!;
    agg.amount += e.amount || 0;
    agg.count += 1;
  }
  // last month for MoM comparison
  for (const e of lastMonthExpenses) {
    const cat = normalizeCategory(e.category);
    catAgg.get(cat)!.lastMonth += e.amount || 0;
  }

  const byCategory: ExpenseCategoryBreakdown[] = Array.from(catAgg.entries())
    .map(([cat, v]) => ({
      category: cat,
      label: CATEGORY_LABELS[cat],
      amount: Math.round(v.amount),
      sharePct: totalThisMonth > 0 ? roundTo((v.amount / totalThisMonth) * 100, 1) : 0,
      invoiceCount: v.count,
      momChangePct: roundTo(pctChange(v.amount, v.lastMonth), 1),
      trend: trendFromPct(pctChange(v.amount, v.lastMonth)),
    }))
    .filter((c) => c.amount > 0 || c.invoiceCount > 0)
    .sort((a, b) => b.amount - a.amount);

  // ─── Monthly Trends (6 months) ────────────────────────────────────────────
  const monthlyTrends: Array<{ month: string; total: number; byCategory: Record<ExpenseCategory, number> }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now().getFullYear(), now().getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    const monthExps = expensesForRange(expenses, start, end);
    const byCat = {} as Record<ExpenseCategory, number>;
    for (const cat of Object.keys(CATEGORY_LABELS) as ExpenseCategory[]) byCat[cat] = 0;
    for (const e of monthExps) {
      const cat = normalizeCategory(e.category);
      byCat[cat] += e.amount || 0;
    }
    const total = monthExps.reduce((s, e) => s + (e.amount || 0), 0);
    monthlyTrends.push({
      month: monthLabel(d),
      total: Math.round(total),
      byCategory: byCat,
    });
  }

  const avgMonthly = monthlyTrends.reduce((s, m) => s + m.total, 0) / monthlyTrends.length;

  // ─── Top Vendors ──────────────────────────────────────────────────────────
  const vendorAgg = new Map<string, { amount: number; count: number }>();
  for (const e of thisMonthExpenses) {
    const v = (e.vendor || 'Unknown Vendor').trim();
    const existing = vendorAgg.get(v) || { amount: 0, count: 0 };
    existing.amount += e.amount || 0;
    existing.count += 1;
    vendorAgg.set(v, existing);
  }
  const topVendors = Array.from(vendorAgg.entries())
    .map(([vendor, v]) => ({ vendor, amount: Math.round(v.amount), count: v.count }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  // ─── Recurring vs One-time ────────────────────────────────────────────────
  // Recurring heuristic: subscription + software categories OR same vendor paid in 2+ months
  const recurringCats: ExpenseCategory[] = ['subscriptions', 'software', 'rent'];
  const recurringVendors = new Set<string>();
  // Find vendors that appear in 2+ different months
  const vendorMonths = new Map<string, Set<string>>();
  for (const e of expenses) {
    const d = new Date(e.date);
    const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
    const v = (e.vendor || '').trim();
    if (!v) continue;
    if (!vendorMonths.has(v)) vendorMonths.set(v, new Set());
    vendorMonths.get(v)!.add(monthKey);
  }
  for (const [v, months] of vendorMonths) {
    if (months.size >= 2) recurringVendors.add(v);
  }

  let recurringExpenses = 0;
  let oneTimeExpenses = 0;
  for (const e of thisMonthExpenses) {
    const cat = normalizeCategory(e.category);
    if (recurringCats.includes(cat) || recurringVendors.has((e.vendor || '').trim())) {
      recurringExpenses += e.amount || 0;
    } else {
      oneTimeExpenses += e.amount || 0;
    }
  }

  const trend = trendFromPct(momChangePct);

  return {
    totalThisMonth: Math.round(totalThisMonth),
    totalLastMonth: Math.round(totalLastMonth),
    momChangePct,
    avgMonthly: Math.round(avgMonthly),
    byCategory,
    monthlyTrends,
    topVendors,
    recurringExpenses: Math.round(recurringExpenses),
    oneTimeExpenses: Math.round(oneTimeExpenses),
    trend,
  };
}
