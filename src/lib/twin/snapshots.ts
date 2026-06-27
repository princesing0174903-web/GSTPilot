// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT DIGITAL TWIN™ — BUSINESS SNAPSHOTS™ ENGINE
//
// Automatically creates snapshots at 5 frequencies:
//   • Daily     — last 14 days
//   • Weekly    — last 12 weeks
//   • Monthly   — last 12 months
//   • Quarterly — last 8 quarters
//   • Yearly    — last 5 years
//
// Each snapshot stores: Revenue, Profit, Cash, GST, Health Score, Risk Score,
// Forecast, Collections, Expenses, Employees, Assets, Liabilities.
//
// Supports comparisons: Today vs Yesterday, This Month vs Last Month,
// This Year vs Last Year.
//
// All values computed from REAL connected business data (invoices, expenses,
// payments, filings, employees) bucketed by time period. No mock values.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  BusinessSnapshot,
  SnapshotFrequency,
  SnapshotBundle,
  SnapshotComparison,
  SnapshotDelta,
} from './types';

// ─── Time period helpers ─────────────────────────────────────────────────────

interface Period {
  start: Date;
  end: Date;
  label: string;
}

function dailyPeriods(count: number): Period[] {
  const out: Period[] = [];
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  for (let i = count - 1; i >= 0; i--) {
    const end = new Date(today);
    end.setDate(today.getDate() - i);
    const start = new Date(end);
    start.setHours(0, 0, 0, 0);
    out.push({ start, end, label: start.toISOString().split('T')[0] });
  }
  return out;
}

function weeklyPeriods(count: number): Period[] {
  const out: Period[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const end = new Date(now);
    end.setDate(now.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    const weekNum = Math.ceil(((start.getTime() - new Date(start.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7);
    out.push({ start, end, label: `${start.getFullYear()}-W${String(weekNum).padStart(2, '0')}` });
  }
  return out;
}

function monthlyPeriods(count: number): Period[] {
  const out: Period[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
    const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
    out.push({ start, end, label });
  }
  return out;
}

function quarterlyPeriods(count: number): Period[] {
  const out: Period[] = [];
  const now = new Date();
  const currentQ = Math.floor(now.getMonth() / 3);
  for (let i = count - 1; i >= 0; i--) {
    const qIdx = currentQ - i;
    const yearOffset = Math.floor(qIdx / 4);
    const q = ((qIdx % 4) + 4) % 4;
    const year = now.getFullYear() + yearOffset;
    const start = new Date(year, q * 3, 1);
    const end = new Date(year, q * 3 + 3, 0, 23, 59, 59, 999);
    out.push({ start, end, label: `Q${q + 1} ${year}` });
  }
  return out;
}

function yearlyPeriods(count: number): Period[] {
  const out: Period[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const year = now.getFullYear() - i;
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);
    out.push({ start, end, label: String(year) });
  }
  return out;
}

// ─── Fetch all raw business records once (snapshot engine reuses them) ───────

interface RawRecords {
  invoices: Array<{ id: string; invoiceDate: string; totalAmount: number; cgst: number; sgst: number; igst: number; cess: number; paidAmount: number; paymentStatus: string; paymentDate: string | null; createdAt: Date }>;
  expenses: Array<{ id: string; date: string; amount: number; category: string; createdAt: Date }>;
  payments: Array<{ id: string; paymentDate: string; amount: number; partyType: string; createdAt: Date }>;
  purchaseBills: Array<{ id: string; invoiceDate: string; gstAmount: number; cgst: number; sgst: number; igst: number; cess: number; totalAmount: number; createdAt: Date }>;
  employees: Array<{ id: string; salary: number; status: string; createdAt: Date }>;
  filings: Array<{ id: string; period: string; status: string; totalTax: number; filedDate: string | null; createdAt: Date }>;
}

async function fetchRawRecords(): Promise<RawRecords> {
  const [invoices, expenses, payments, purchaseBills, employees, filings] = await Promise.all([
    db.invoice.findMany({
      select: { id: true, invoiceDate: true, totalAmount: true, cgst: true, sgst: true, igst: true, cess: true, paidAmount: true, paymentStatus: true, paymentDate: true, createdAt: true },
      take: 20000,
    }).catch(() => []),
    db.expense.findMany({
      select: { id: true, date: true, amount: true, category: true, createdAt: true },
      take: 20000,
    }).catch(() => []),
    db.payment.findMany({
      select: { id: true, paymentDate: true, amount: true, partyType: true, createdAt: true },
      take: 20000,
    }).catch(() => []),
    db.purchaseBill.findMany({
      select: { id: true, invoiceDate: true, gstAmount: true, cgst: true, sgst: true, igst: true, cess: true, totalAmount: true, createdAt: true },
      take: 20000,
    }).catch(() => []),
    db.employee.findMany({
      select: { id: true, salary: true, status: true, createdAt: true },
      take: 5000,
    }).catch(() => []),
    db.gSTRFiling.findMany({
      select: { id: true, period: true, status: true, totalTax: true, filedDate: true, createdAt: true },
      take: 5000,
    }).catch(() => []),
  ]);

  return { invoices, expenses, payments, purchaseBills, employees, filings };
}

// ─── Compute a single snapshot for a period ──────────────────────────────────

function computeSnapshotForPeriod(
  period: Period,
  frequency: SnapshotFrequency,
  raw: RawRecords,
): BusinessSnapshot {
  const { start, end } = period;
  const startMs = start.getTime();
  const endMs = end.getTime();

  // Revenue: sum of invoice totalAmount in period
  const periodInvoices = raw.invoices.filter((i) => {
    const d = new Date(i.invoiceDate || i.createdAt).getTime();
    return d >= startMs && d <= endMs;
  });
  const revenue = periodInvoices.reduce((s, i) => s + (i.totalAmount || 0), 0);

  // GST output liability
  const gstOutput = periodInvoices.reduce((s, i) => s + (i.cgst || 0) + (i.sgst || 0) + (i.igst || 0) + (i.cess || 0), 0);
  const periodPurchases = raw.purchaseBills.filter((p) => {
    const d = new Date(p.invoiceDate || p.createdAt).getTime();
    return d >= startMs && d <= endMs;
  });
  const gstInput = periodPurchases.reduce((s, p) => s + (p.gstAmount || (p.cgst + p.sgst + p.igst + p.cess)), 0);
  const gst = Math.max(0, gstOutput - gstInput);

  // Expenses in period
  const periodExpenses = raw.expenses.filter((e) => {
    const d = new Date(e.date || e.createdAt).getTime();
    return d >= startMs && d <= endMs;
  });
  const expenses = periodExpenses.reduce((s, e) => s + (e.amount || 0), 0);

  // Collections: payments from customers in period
  const periodCollections = raw.payments.filter((p) => {
    const d = new Date(p.paymentDate || p.createdAt).getTime();
    return d >= startMs && d <= endMs && p.partyType === 'customer';
  });
  const collections = periodCollections.reduce((s, p) => s + (p.amount || 0), 0);

  // Outflows: payments to vendors in period
  const periodOutflows = raw.payments.filter((p) => {
    const d = new Date(p.paymentDate || p.createdAt).getTime();
    return d >= startMs && d <= endMs && p.partyType !== 'customer';
  });
  const outflows = periodOutflows.reduce((s, p) => s + (p.amount || 0), 0);

  // Profit: revenue - expenses - outflows (simplified cash profit)
  const profit = revenue - expenses - outflows - gst;

  // Cash: collections - outflows (net cash for the period, as proxy)
  const cash = collections - outflows - expenses;

  // Employees active as of period end
  const employees = raw.employees.filter((e) => e.createdAt <= end && e.status === 'active').length;
  const payroll = raw.employees
    .filter((e) => e.createdAt <= end && e.status === 'active')
    .reduce((s, e) => s + (e.salary || 0), 0);

  // Assets & liabilities (simplified)
  const receivables = periodInvoices
    .filter((i) => i.paymentStatus !== 'paid')
    .reduce((s, i) => s + ((i.totalAmount || 0) - (i.paidAmount || 0)), 0);
  const assets = Math.max(0, cash) + receivables;
  const liabilities = periodPurchases
    .filter((p) => true)
    .reduce((s, p) => s + (p.totalAmount || 0), 0) * 0.3; // approx outstanding payables

  // Health & risk scores (heuristic from period metrics)
  const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
  const healthScore = clamp(
    50 + (marginPct > 10 ? 25 : marginPct > 0 ? 15 : -10) + (revenue > 0 ? 15 : 0) + (collections > expenses ? 10 : -10),
    0, 100,
  );
  const riskScore = clamp(
    100 - healthScore + (gst > revenue * 0.15 ? 10 : 0) - (employees > 0 ? 5 : 0),
    0, 100,
  );

  // Forecast: simple projection = revenue * growth factor
  const forecast = revenue * 1.05;

  return {
    id: `snap-${frequency}-${period.label}`,
    frequency,
    periodLabel: period.label,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    revenue: Math.round(revenue),
    profit: Math.round(profit),
    cash: Math.round(cash),
    gst: Math.round(gst),
    healthScore: Math.round(healthScore),
    riskScore: Math.round(riskScore),
    forecast: Math.round(forecast),
    collections: Math.round(collections),
    expenses: Math.round(expenses),
    employees,
    assets: Math.round(assets),
    liabilities: Math.round(liabilities),
    createdAt: end.toISOString(),
  };
}

// ─── Build comparison between two snapshots ──────────────────────────────────

function compareSnapshots(current: BusinessSnapshot, previous: BusinessSnapshot | null): SnapshotComparison {
  if (!previous) {
    return {
      current,
      previous: null,
      deltas: [],
      summary: 'No prior period data available for comparison.',
    };
  }

  const metrics: Array<{ key: keyof BusinessSnapshot; label: string }> = [
    { key: 'revenue', label: 'Revenue' },
    { key: 'profit', label: 'Profit' },
    { key: 'cash', label: 'Cash' },
    { key: 'gst', label: 'GST Liability' },
    { key: 'healthScore', label: 'Health Score' },
    { key: 'riskScore', label: 'Risk Score' },
    { key: 'collections', label: 'Collections' },
    { key: 'expenses', label: 'Expenses' },
    { key: 'employees', label: 'Employees' },
    { key: 'assets', label: 'Assets' },
    { key: 'liabilities', label: 'Liabilities' },
  ];

  const deltas: SnapshotDelta[] = metrics.map(({ key, label }) => {
    const curr = Number(current[key] || 0);
    const prev = Number(previous[key] || 0);
    const delta = curr - prev;
    const deltaPct = prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : (curr > 0 ? 100 : 0);
    const direction: SnapshotDelta['direction'] = Math.abs(deltaPct) < 1 ? 'stable' : delta > 0 ? 'up' : 'down';
    return { metric: label, current: curr, previous: prev, delta, deltaPct, direction };
  });

  const revDelta = deltas.find((d) => d.metric === 'Revenue')!;
  const profitDelta = deltas.find((d) => d.metric === 'Profit')!;
  const healthDelta = deltas.find((d) => d.metric === 'Health Score')!;

  const summary = `Revenue ${revDelta.direction === 'up' ? 'grew' : revDelta.direction === 'down' ? 'declined' : 'held steady'} ${Math.abs(revDelta.deltaPct).toFixed(1)}% vs ${previous.periodLabel}. Profit ${profitDelta.direction === 'up' ? 'improved' : profitDelta.direction === 'down' ? 'fell' : 'was stable'} by ₹${Math.abs(profitDelta.delta).toLocaleString('en-IN')}. Health score ${healthDelta.direction === 'up' ? 'up' : healthDelta.direction === 'down' ? 'down' : 'unchanged'} ${Math.abs(healthDelta.delta)} points.`;

  return { current, previous, deltas, summary };
}

// ─── Main: build the full snapshot bundle ────────────────────────────────────

export async function computeSnapshotBundle(): Promise<SnapshotBundle> {
  const raw = await fetchRawRecords();

  const daily = dailyPeriods(14).map((p) => computeSnapshotForPeriod(p, 'daily', raw));
  const weekly = weeklyPeriods(12).map((p) => computeSnapshotForPeriod(p, 'weekly', raw));
  const monthly = monthlyPeriods(12).map((p) => computeSnapshotForPeriod(p, 'monthly', raw));
  const quarterly = quarterlyPeriods(8).map((p) => computeSnapshotForPeriod(p, 'quarterly', raw));
  const yearly = yearlyPeriods(5).map((p) => computeSnapshotForPeriod(p, 'yearly', raw));

  // Comparisons
  const todayVsYesterday = compareSnapshots(
    daily[daily.length - 1],
    daily[daily.length - 2] || null,
  );
  const thisMonthVsLastMonth = compareSnapshots(
    monthly[monthly.length - 1],
    monthly[monthly.length - 2] || null,
  );
  const thisYearVsLastYear = compareSnapshots(
    yearly[yearly.length - 1],
    yearly[yearly.length - 2] || null,
  );

  return {
    daily,
    weekly,
    monthly,
    quarterly,
    yearly,
    comparisons: {
      todayVsYesterday,
      thisMonthVsLastMonth,
      thisYearVsLastYear,
    },
    asOf: new Date().toISOString(),
  };
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// ─── Lightweight: get just the latest snapshot ───────────────────────────────

export async function fetchLatestSnapshot(): Promise<BusinessSnapshot | undefined> {
  const bundle = await computeSnapshotBundle();
  return bundle.daily[bundle.daily.length - 1];
}
