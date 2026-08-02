// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Module™ — Reports Engine (TASK 12)
//
// Period-based comprehensive banking reports. SERVER-ONLY.
//
// Architecture:
//   ┌─────────────────────────────────────────────────────────────┐
//   │  API Routes (/api/banking/reports/*)                        │
//   ├─────────────────────────────────────────────────────────────┤
//   │  This Engine (src/lib/banking-prisma/reports.ts)            │
//   │  • generateReport → full BankingReport for a period         │
//   │      - inflow/outflow/net                                    │
//   │      - opening + closing balance                             │
//   │      - top expenses (debit grouped by category)             │
//   │      - top customers (credit grouped by counterparty)       │
//   │      - outstanding invoices (sum + count)                    │
//   │      - collectionRate (matched credits / invoices issued)   │
//   │      - byCategory breakdown (inflow+outflow+count)           │
//   │  • listAvailableReports → period catalog with data presence │
//   ├─────────────────────────────────────────────────────────────┤
//   │  Prisma (SQLite)  ←  BankTransaction, BankAccount,           │
//   │                       Invoice (via Client.firmId),           │
//   │                       CashFlowSnapshot                       │
//   └─────────────────────────────────────────────────────────────┘
//
// Invoice scoping:
//   The Invoice model has NO direct `organizationId` field. It is scoped via
//   `client.firmId === organizationId`. Confirmed in prisma/schema.prisma:
//     model Invoice { clientId String; client Client @relation(...); ... }
//     model Client  { firmId String?; invoices Invoice[]; ... }
//
// Invoice field names (verified against schema.prisma):
//   • invoiceDate   — String (ISO date "YYYY-MM-DD"), NOT DateTime
//   • totalAmount   — Float (the grand total; task calls this "grandTotal")
//   • balanceAmount — Float (outstanding; task calls this "balanceDue")
//   • status        — String (free-form: draft|sent|paid|cancelled|archived|...)
//
// Multi-tenant: every BankTransaction query filters on `organizationId`. Every
// Invoice query filters on `client.firmId === organizationId`.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { BankingReport, ReportPeriod } from './types';

// ─── Local date helpers (mirrored from service.ts — not exported there) ───────

function startOfDay(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfQuarter(d = new Date()): Date {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}

function endOfQuarter(d = new Date()): Date {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
}

function startOfYear(d = new Date()): Date {
  return new Date(d.getFullYear(), 0, 1);
}

function endOfYear(d = new Date()): Date {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// YYYY-MM-DD — used for invoiceDate (String column) range comparison.
// ISO date strings compare lexicographically == chronologically, so a string
// gte/lte works correctly.
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface DateRange {
  start: Date;
  end: Date; // inclusive (end-of-day)
}

function getPeriodRange(period: ReportPeriod, ref: Date): DateRange {
  switch (period) {
    case 'daily':
      return { start: startOfDay(ref), end: endOfDay(ref) };
    case 'weekly':
      // last 7 days ending at (and including) the reference day.
      return { start: addDays(startOfDay(ref), -6), end: endOfDay(ref) };
    case 'monthly':
      return { start: startOfMonth(ref), end: endOfMonth(ref) };
    case 'quarterly':
      return { start: startOfQuarter(ref), end: endOfQuarter(ref) };
    case 'yearly':
      return { start: startOfYear(ref), end: endOfYear(ref) };
    default:
      return { start: startOfDay(ref), end: endOfDay(ref) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. generateReport — comprehensive BankingReport for a period.
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateReport(
  organizationId: string,
  period: ReportPeriod,
  referenceDate: Date = new Date(),
): Promise<BankingReport> {
  const { start, end } = getPeriodRange(period, referenceDate);

  // Fetch all txns in [start, end] for the org.
  const txns = await db.bankTransaction.findMany({
    where: {
      organizationId,
      date: { gte: start, lte: end },
    },
    select: {
      amount: true,
      type: true,
      category: true,
      counterparty: true,
      matched: true,
      matchedInvoiceId: true,
    },
  });

  let totalInflow = 0;
  let totalOutflow = 0;
  let matchedCreditAmount = 0;

  const expensesByCat = new Map<string, { amount: number; count: number }>();
  const customersByCp = new Map<string, { amount: number; count: number }>();
  const byCategory: Record<string, { inflow: number; outflow: number; count: number }> = {};

  for (const t of txns) {
    const amt = Math.abs(t.amount);
    const cat = t.category || 'other';
    const cp = t.counterparty || '';

    if (!byCategory[cat]) {
      byCategory[cat] = { inflow: 0, outflow: 0, count: 0 };
    }
    byCategory[cat].count += 1;

    if (t.type === 'credit') {
      totalInflow += amt;
      byCategory[cat].inflow += amt;
      if (t.matched && t.matchedInvoiceId) {
        matchedCreditAmount += amt;
      }
      // Top customers — only when a counterparty is present.
      if (cp) {
        const e = customersByCp.get(cp) ?? { amount: 0, count: 0 };
        e.amount += amt;
        e.count += 1;
        customersByCp.set(cp, e);
      }
    } else {
      totalOutflow += amt;
      byCategory[cat].outflow += amt;
      const e = expensesByCat.get(cat) ?? { amount: 0, count: 0 };
      e.amount += amt;
      e.count += 1;
      expensesByCat.set(cat, e);
    }
  }

  // Round byCategory values to 2 decimals.
  for (const k of Object.keys(byCategory)) {
    byCategory[k] = {
      inflow: round2(byCategory[k].inflow),
      outflow: round2(byCategory[k].outflow),
      count: byCategory[k].count,
    };
  }

  // topExpenses — top 5 debit categories by amount.
  const topExpenses = Array.from(expensesByCat.entries())
    .map(([category, v]) => ({ category, amount: round2(v.amount), count: v.count }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // topCustomers — top 5 credit counterparties by amount.
  const topCustomers = Array.from(customersByCp.entries())
    .map(([counterparty, v]) => ({ counterparty, amount: round2(v.amount), count: v.count }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // outstanding invoices — open invoices with positive balance.
  // Invoice is scoped via `client.firmId === organizationId` (no direct orgId).
  const outstandingInvoices = await db.invoice.findMany({
    where: {
      client: { firmId: organizationId },
      status: { notIn: ['paid', 'cancelled', 'archived'] },
      balanceAmount: { gt: 0 },
    },
    select: { balanceAmount: true },
  });
  const outstanding = {
    total: round2(outstandingInvoices.reduce((s, i) => s + (i.balanceAmount || 0), 0)),
    count: outstandingInvoices.length,
  };

  // collectionRate = (matched credits in period) / (invoices issued in period).
  // Invoices issued = invoices whose invoiceDate falls within [start, end].
  // invoiceDate is a String (YYYY-MM-DD), so we compare lexicographically.
  const startISO = toISODate(start);
  const endISO = toISODate(end);
  const invoicesInPeriod = await db.invoice.findMany({
    where: {
      client: { firmId: organizationId },
      invoiceDate: { gte: startISO, lte: endISO },
    },
    select: { totalAmount: true },
  });
  const totalInvoiceAmount = invoicesInPeriod.reduce(
    (s, i) => s + (i.totalAmount || 0),
    0,
  );
  let collectionRate: number;
  if (totalInvoiceAmount === 0) {
    // No invoices issued in the period.
    //   • Credits came in but no invoices → treat as 100% (over-collected /
    //     unattributed revenue).
    //   • No credits AND no invoices → no data → 0.
    collectionRate = matchedCreditAmount > 0 ? 1.0 : 0;
  } else {
    collectionRate = Math.min(1, matchedCreditAmount / totalInvoiceAmount);
  }

  // openingBalance = currentTotalBalance - Σ net flows from `start` to NOW.
  // Rationale: today's balance = opening(at start) + everything since. So
  // opening(at start) = today - Σ since. Approximates the balance at the
  // start of the period (assuming no future-dated txns, which holds because
  // NOW is the wall-clock present).
  const accounts = await db.bankAccount.findMany({
    where: { organizationId },
    select: { balance: true },
  });
  const currentTotalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const sinceStartTxns = await db.bankTransaction.findMany({
    where: {
      organizationId,
      date: { gte: start },
    },
    select: { amount: true, type: true },
  });
  const netSinceStart = sinceStartTxns.reduce(
    (s, t) => s + (t.type === 'credit' ? Math.abs(t.amount) : -Math.abs(t.amount)),
    0,
  );
  const openingBalance = round2(currentTotalBalance - netSinceStart);

  const netFlow = round2(totalInflow - totalOutflow);
  const closingBalance = round2(openingBalance + netFlow);

  return {
    period,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    totalInflow: round2(totalInflow),
    totalOutflow: round2(totalOutflow),
    netFlow,
    openingBalance,
    closingBalance,
    topExpenses,
    topCustomers,
    outstanding,
    collectionRate: round2(collectionRate * 100) / 100,
    byCategory,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. listAvailableReports — period catalog with date ranges + data presence.
// ═══════════════════════════════════════════════════════════════════════════════

export async function listAvailableReports(
  organizationId: string,
): Promise<
  Array<{ period: ReportPeriod; startDate: string; endDate: string; available: boolean }>
> {
  const periods: ReportPeriod[] = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
  const now = new Date();
  const out: Array<{
    period: ReportPeriod;
    startDate: string;
    endDate: string;
    available: boolean;
  }> = [];

  for (const period of periods) {
    const { start, end } = getPeriodRange(period, now);
    const count = await db.bankTransaction.count({
      where: {
        organizationId,
        date: { gte: start, lte: end },
      },
    });
    out.push({
      period,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      available: count > 0,
    });
  }

  return out;
}
