// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Health Score Calculator (DELEGATES TO CANONICAL SNAPSHOT ENGINE)
//
// This file is kept ONLY for backward compatibility with the legacy
// financial-engine/ pipeline (consumed by financial-engine/businessSnapshot.ts).
//
// The ACTUAL health score is computed by the canonical engine in
// `src/lib/business/snapshot.ts` — `computeHealthScore(input: BusinessSnapshotInput)`.
// This wrapper builds a BusinessSnapshotInput from the in-memory FinancialData
// bundle (so no extra Prisma round-trip) and delegates to the canonical engine.
//
// The legacy HealthScoreResult shape (score / grade / label / components) is
// preserved for callers that read it. `score` and `label` come straight from
// the canonical engine. The `components` field is populated from the canonical
// engine's per-factor scores (keyed to the closest legacy component name).
// ═══════════════════════════════════════════════════════════════════════════════

import type { FinancialData, InvoiceRow, PaymentRow } from './types';
import {
  computeHealthScore,
  type BusinessSnapshotInput,
} from '@/lib/business/snapshot';

export interface HealthScoreResult {
  score: number;          // 0–100 (from canonical engine)
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  label: string;          // from canonical engine
  components: {
    collections: number;    // 0–100
    profitability: number;  // 0–100
    compliance: number;     // 0–100
    cashPosition: number;   // 0–100
    overdueControl: number; // 0–100
  };
}

/**
 * Calculate the business health score by DELEGATING to the canonical engine.
 *
 * Builds a {@link BusinessSnapshotInput} from the in-memory FinancialData and
 * passes it to `computeHealthScore` from `@/lib/business/snapshot`. This keeps
 * a single source of truth for the scoring formula while preserving the legacy
 * function signature.
 */
export function calculateHealth(data: FinancialData): HealthScoreResult {
  const { invoices, purchaseBills, expenses, bankAccounts, gstrFilings, payments } = data;

  const hasData =
    invoices.length > 0 ||
    purchaseBills.length > 0 ||
    expenses.length > 0 ||
    bankAccounts.length > 0;

  if (!hasData) {
    return {
      score: 0,
      grade: 'F',
      label: 'No Data',
      components: {
        collections: 0,
        profitability: 0,
        compliance: 0,
        cashPosition: 0,
        overdueControl: 0,
      },
    };
  }

  const input = buildCanonicalInputFromFinancialData(data);
  const result = computeHealthScore(input);

  // Map canonical factor scores → legacy component buckets.
  const factorScore = (key: string): number =>
    result.factors.find((f) => f.key === key)?.score ?? 0;

  const components = {
    collections: factorScore('collection_rate'),
    profitability: factorScore('revenue_trend'),
    compliance: factorScore('compliance_status'),
    cashPosition: factorScore('cash_balance'),
    overdueControl: factorScore('overdue_invoices'),
  };

  const score = result.score;
  const grade: 'A' | 'B' | 'C' | 'D' | 'F' =
    score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';

  return { score, grade, label: result.label, components };
}

// ─── Helpers (build canonical input from in-memory rows) ─────────────────────

/** Build a BusinessSnapshotInput from the legacy FinancialData bundle.
 *
 * Exported so the sibling `calculateRisk.ts` can reuse the exact same input
 * shape (single source of truth for what feeds the canonical engines).
 */
export function buildCanonicalInputFromFinancialData(data: FinancialData): BusinessSnapshotInput {
  const { invoices, purchaseBills, expenses, bankAccounts, gstrFilings, payments } = data;

  // ── Headline financials (this FY) ──
  const revenue = sum(invoices.map((i) => i.totalAmount || 0));
  const operatingExpenses = sum(expenses.map((e) => e.amount || 0));
  const purchases = sum(purchaseBills.map((b) => b.totalAmount || 0));
  const expensesTotal = purchases + operatingExpenses;
  const receivables = sum(invoices.map((i) => i.balanceAmount || 0));
  const payables = sum(purchaseBills.map((b) => b.balanceAmount || 0));
  const cash = sum(bankAccounts.map((b) => b.balance || 0));
  const totalCollected = sum(invoices.map((i) => i.paidAmount || 0));

  // ── Compliance ──
  const filedReturns = gstrFilings.filter((g) => g.status === 'filed').length;
  const pendingReturns = gstrFilings.filter((g) => g.status !== 'filed').length;
  const overdueReturns = gstrFilings.filter(
    (g) => g.status !== 'filed' && isOverdueFiling(g.createdAt),
  ).length;

  // ── Revenue trend (current month vs previous month) ──
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const revenueThisMonth = sum(
    invoices
      .filter((i) => inDateRange(i.createdAt, thisMonthStart, now))
      .map((i) => i.totalAmount || 0),
  );
  const revenueLastMonth = sum(
    invoices
      .filter((i) => inDateRange(i.createdAt, lastMonthStart, lastMonthEnd))
      .map((i) => i.totalAmount || 0),
  );

  // ── Top customer concentration ──
  const customerRevenue = new Map<string, number>();
  for (const inv of invoices) {
    const name = inv.buyerName || inv.clientId || 'unknown';
    customerRevenue.set(name, (customerRevenue.get(name) ?? 0) + (inv.totalAmount || 0));
  }
  const topCustomerRevenue = customerRevenue.size > 0
    ? Math.max(...customerRevenue.values())
    : 0;
  const topCustomerShare = revenue > 0 ? clamp(topCustomerRevenue / revenue, 0, 1) : 0;

  // ── Overdue invoices (count + value) ──
  const nowIso = now.toISOString();
  const overdueInvoices = invoices.filter(
    (i) => i.dueDate && i.dueDate < nowIso && i.status !== 'paid' && i.paymentStatus !== 'paid',
  );
  const overdueReceivables = sum(
    overdueInvoices.map((i) => (i.balanceAmount > 0 ? i.balanceAmount : i.totalAmount) || 0),
  );
  const overdueInvoiceCount = overdueInvoices.length;

  // ── Average days to pay (from payments linked to invoices) ──
  const avgDaysToPay = computeAvgDaysToPay(invoices, payments);

  // ── Runway (months) ──
  const monthlyBurn = operatingExpenses / 12;
  const runwayMonths = monthlyBurn > 0 ? cash / monthlyBurn : (cash > 0 ? Infinity : 0);

  return {
    revenue,
    expenses: expensesTotal,
    cash,
    receivables,
    payables,
    overdueReceivables,
    overdueInvoiceCount,
    totalCollected,
    filedReturns,
    pendingReturns,
    overdueReturns,
    revenueThisMonth,
    revenueLastMonth,
    topCustomerShare,
    avgDaysToPay,
    runwayMonths,
  };
}

function computeAvgDaysToPay(invoices: InvoiceRow[], payments: PaymentRow[]): number {
  const invoiceDateById = new Map<string, string>();
  for (const inv of invoices) {
    if (inv.invoiceDate) invoiceDateById.set(inv.id, inv.invoiceDate);
  }
  const dayDiffs: number[] = [];
  for (const p of payments) {
    if (!p.invoiceId || !p.paymentDate) continue;
    const invDateStr = invoiceDateById.get(p.invoiceId);
    if (!invDateStr) continue;
    const invDate = new Date(invDateStr);
    const payDate = new Date(p.paymentDate);
    if (Number.isNaN(invDate.getTime()) || Number.isNaN(payDate.getTime())) continue;
    const diff = Math.max(0, (payDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
    dayDiffs.push(diff);
  }
  if (dayDiffs.length === 0) return 0;
  return dayDiffs.reduce((a, b) => a + b, 0) / dayDiffs.length;
}

function inDateRange(d: Date | string, from: Date, to: Date): boolean {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return false;
  return date >= from && date <= to;
}

function isOverdueFiling(createdAt: Date): boolean {
  // Mirrors the canonical snapshot: pending filings older than 20 days are overdue.
  return createdAt.getTime() < Date.now() - 20 * 24 * 60 * 60 * 1000;
}

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + (b || 0), 0);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
