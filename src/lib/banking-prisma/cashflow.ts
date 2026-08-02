// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Module™ — Cash Flow Analytics Engine (TASK 12)
//
// Daily/period cash-flow aggregation + snapshot persistence. SERVER-ONLY.
//
// Architecture:
//   ┌─────────────────────────────────────────────────────────────┐
//   │  API Routes (/api/banking/cashflow/*)                       │
//   ├─────────────────────────────────────────────────────────────┤
//   │  This Engine (src/lib/banking-prisma/cashflow.ts)           │
//   │  • Aggregates BankTransaction rows by day                   │
//   │  • Computes openingBalance + running closingBalance per day │
//   │  • Persists a CashFlowSnapshot row per day (cache layer)    │
//   │  • getCashFlowSnapshot reads the cache for fast dashboards  │
//   │  • recordCashFlowSnapshot is the background refresh entry   │
//   ├─────────────────────────────────────────────────────────────┤
//   │  Prisma (SQLite)  ←  BankTransaction, BankAccount,          │
//   │                       CashFlowSnapshot                      │
//   └─────────────────────────────────────────────────────────────┘
//
// Opening-balance derivation:
//   openingBalance = currentTotalBalance - sumOfNetFlowsInRange
//   (i.e. the balance at the start of `startDate`, derived from today's
//    closing balance minus everything that happened in the window).
//
// Closing-balance derivation:
//   Walk forward day-by-day: closing[i] = opening + Σ net[0..i].
//   For the last day, closing === currentTotalBalance (by construction).
//
// Multi-tenant: every query filters on `organizationId`. Every snapshot
// row carries `organizationId` for tenant isolation.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { CashFlowPoint, CashFlowResult, ReportPeriod } from './types';

// ─── Local date helpers (service.ts keeps these private — re-implement) ──────

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

// YYYY-MM-DD key for grouping by calendar day.
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const PERIOD_DAYS: Record<'7d' | '30d' | '90d' | '1y', number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

type SnapshotRow = {
  date: Date;
  openingBalance: number;
  closingBalance: number;
  totalInflow: number;
  totalOutflow: number;
  netFlow: number;
  creditCount: number;
  debitCount: number;
};

function toPoint(row: SnapshotRow): CashFlowPoint {
  return {
    date: startOfDay(row.date).toISOString(),
    inflow: round2(row.totalInflow),
    outflow: round2(row.totalOutflow),
    net: round2(row.netFlow),
    closingBalance: round2(row.closingBalance),
  };
}

async function getTotalBalance(organizationId: string): Promise<number> {
  const accounts = await db.bankAccount.findMany({
    where: { organizationId },
    select: { balance: true },
  });
  return accounts.reduce((s, a) => s + (a.balance || 0), 0);
}

// Compute the period-start Date for a given reference Date + ReportPeriod.
// Used by recordCashFlowSnapshot to define the aggregation window ending on
// (and inclusive of) `ref`.
function getPeriodStart(d: Date, period: ReportPeriod): Date {
  switch (period) {
    case 'daily':
      return startOfDay(d);
    case 'weekly':
      return addDays(startOfDay(d), -6);
    case 'monthly':
      return startOfMonth(d);
    case 'quarterly':
      return startOfQuarter(d);
    case 'yearly':
      return startOfYear(d);
    default:
      return startOfDay(d);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. getCashFlow — aggregate daily cash flow for the trailing window.
// ═══════════════════════════════════════════════════════════════════════════════

export async function getCashFlow(
  organizationId: string,
  period: '7d' | '30d' | '90d' | '1y' = '30d',
): Promise<CashFlowResult> {
  const days = PERIOD_DAYS[period] ?? 30;
  const endDate = new Date();
  // startDate = N-1 days ago at start-of-day, so the window contains `days`
  // calendar days inclusive of today.
  const startDate = addDays(startOfDay(endDate), -(days - 1));

  // Fetch all org transactions in range. SQLite DateTime filtering works via
  // the ISO-string column directly.
  const txns = await db.bankTransaction.findMany({
    where: {
      organizationId,
      date: { gte: startDate, lte: endDate },
    },
    select: { amount: true, type: true, date: true },
  });

  // Aggregate by calendar day.
  const buckets = new Map<
    string,
    { inflow: number; outflow: number; credits: number; debits: number }
  >();
  for (const t of txns) {
    const key = dayKey(new Date(t.date));
    const b = buckets.get(key) ?? { inflow: 0, outflow: 0, credits: 0, debits: 0 };
    const amt = Math.abs(t.amount);
    if (t.type === 'credit') {
      b.inflow += amt;
      b.credits += 1;
    } else {
      b.outflow += amt;
      b.debits += 1;
    }
    buckets.set(key, b);
  }

  // Build the daily points list (one per day in range, oldest first).
  type DayBucket = {
    date: Date;
    inflow: number;
    outflow: number;
    credits: number;
    debits: number;
  };
  const points: DayBucket[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(startDate, i);
    const key = dayKey(day);
    const b = buckets.get(key);
    points.push({
      date: day,
      inflow: b?.inflow ?? 0,
      outflow: b?.outflow ?? 0,
      credits: b?.credits ?? 0,
      debits: b?.debits ?? 0,
    });
  }

  // openingBalance = currentTotalBalance - Σ net flows in window.
  // Rationale: today's closing balance is the sum of opening + everything that
  // happened in the window, so opening = closing - Σ net.
  const currentTotalBalance = await getTotalBalance(organizationId);
  const totalNetInRange = points.reduce((s, p) => s + (p.inflow - p.outflow), 0);
  const openingBalance = round2(currentTotalBalance - totalNetInRange);

  // Walk forward to compute closingBalance per day.
  const daily: CashFlowPoint[] = [];
  let running = openingBalance;
  for (const p of points) {
    const net = round2(p.inflow - p.outflow);
    running = round2(running + net);
    daily.push({
      date: p.date.toISOString(),
      inflow: round2(p.inflow),
      outflow: round2(p.outflow),
      net,
      closingBalance: running,
    });
  }

  // Persist one CashFlowSnapshot row per day (period='daily'). Best-effort —
  // the snapshot is a cache; failure must never break the API response.
  await persistDailySnapshots(organizationId, points, openingBalance, daily);

  const totalInflow = round2(points.reduce((s, p) => s + p.inflow, 0));
  const totalOutflow = round2(points.reduce((s, p) => s + p.outflow, 0));
  const netFlow = round2(totalInflow - totalOutflow);
  const closingBalance = running; // already rounded

  return {
    daily,
    totalInflow,
    totalOutflow,
    netFlow,
    avgDailyInflow: round2(totalInflow / days),
    avgDailyOutflow: round2(totalOutflow / days),
    openingBalance,
    closingBalance,
    period,
    hasLiveData: txns.length > 0,
  };
}

// Persist one CashFlowSnapshot row per day (period='daily'). The unique
// constraint [organizationId, date, period] makes this idempotent — repeated
// dashboard loads just refresh the same rows.
async function persistDailySnapshots(
  organizationId: string,
  points: Array<{
    date: Date;
    inflow: number;
    outflow: number;
    credits: number;
    debits: number;
  }>,
  openingBalance: number,
  daily: CashFlowPoint[],
): Promise<void> {
  try {
    let prevClosing = openingBalance;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const d = daily[i];
      const open = i === 0 ? openingBalance : prevClosing;
      const close = d.closingBalance;
      await db.cashFlowSnapshot.upsert({
        where: {
          organizationId_date_period: {
            organizationId,
            date: p.date,
            period: 'daily',
          },
        },
        update: {
          openingBalance: open,
          closingBalance: close,
          totalInflow: round2(p.inflow),
          totalOutflow: round2(p.outflow),
          netFlow: round2(p.inflow - p.outflow),
          creditCount: p.credits,
          debitCount: p.debits,
        },
        create: {
          organizationId,
          date: p.date,
          period: 'daily',
          openingBalance: open,
          closingBalance: close,
          totalInflow: round2(p.inflow),
          totalOutflow: round2(p.outflow),
          netFlow: round2(p.inflow - p.outflow),
          creditCount: p.credits,
          debitCount: p.debits,
        },
      });
      prevClosing = close;
    }
  } catch {
    // Non-fatal — snapshots are a cache, not authoritative.
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. getCashFlowSnapshot — read pre-computed snapshots for fast dashboard load.
// ═══════════════════════════════════════════════════════════════════════════════

export async function getCashFlowSnapshot(
  organizationId: string,
  period: ReportPeriod,
): Promise<CashFlowPoint[]> {
  const rows = await db.cashFlowSnapshot.findMany({
    where: { organizationId, period },
    orderBy: { date: 'asc' },
  });
  return rows.map(toPoint);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. recordCashFlowSnapshot — compute + upsert a single snapshot for a date.
// Used by background refresh (cron / job queue). Server-only.
// ═══════════════════════════════════════════════════════════════════════════════

export async function recordCashFlowSnapshot(
  organizationId: string,
  date: Date,
  period: ReportPeriod,
): Promise<void> {
  const ref = new Date(date);
  const periodStart = getPeriodStart(ref, period);
  const periodEnd = endOfDay(ref);

  // Fetch txns in the period window.
  const txns = await db.bankTransaction.findMany({
    where: {
      organizationId,
      date: { gte: periodStart, lte: periodEnd },
    },
    select: { amount: true, type: true },
  });

  let inflow = 0;
  let outflow = 0;
  let credits = 0;
  let debits = 0;
  for (const t of txns) {
    const amt = Math.abs(t.amount);
    if (t.type === 'credit') {
      inflow += amt;
      credits += 1;
    } else {
      outflow += amt;
      debits += 1;
    }
  }

  // openingBalance = currentTotalBalance - Σ net flows from periodStart to NOW.
  // Rationale: today's balance = opening(at periodStart) + everything that
  // happened since periodStart. So opening(at periodStart) = today - Σ since.
  const currentTotalBalance = await getTotalBalance(organizationId);
  const sincePeriodStartTxns = await db.bankTransaction.findMany({
    where: {
      organizationId,
      date: { gte: periodStart },
    },
    select: { amount: true, type: true },
  });
  const netSincePeriodStart = sincePeriodStartTxns.reduce(
    (s, t) => s + (t.type === 'credit' ? Math.abs(t.amount) : -Math.abs(t.amount)),
    0,
  );
  const openingBalance = round2(currentTotalBalance - netSincePeriodStart);
  const net = round2(inflow - outflow);
  const closingBalance = round2(openingBalance + net);

  try {
    await db.cashFlowSnapshot.upsert({
      where: {
        organizationId_date_period: {
          organizationId,
          date: startOfDay(ref),
          period,
        },
      },
      update: {
        openingBalance,
        closingBalance,
        totalInflow: round2(inflow),
        totalOutflow: round2(outflow),
        netFlow: net,
        creditCount: credits,
        debitCount: debits,
      },
      create: {
        organizationId,
        date: startOfDay(ref),
        period,
        openingBalance,
        closingBalance,
        totalInflow: round2(inflow),
        totalOutflow: round2(outflow),
        netFlow: net,
        creditCount: credits,
        debitCount: debits,
      },
    });
  } catch {
    // Non-fatal.
  }
}

// Export the helpers consumers (reports.ts, dashboard) may want — keep API tidy.
export { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, round2 };
