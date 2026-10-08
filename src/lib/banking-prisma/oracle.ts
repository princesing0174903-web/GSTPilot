// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Module™ — Oracle AI Insights Engine (TASK 12)
//
// Deterministic heuristics for banking intelligence. SERVER-ONLY.
// NO LLM in the engine layer — every insight is computed from DB state using
// transparent, auditable rules. (An LLM may later paraphrase the `insight` /
// `reasoning` strings for the UI, but the underlying numbers are deterministic.)
//
// Architecture:
//   ┌─────────────────────────────────────────────────────────────────────────┐
//   │  API Routes (/api/banking/oracle)                                       │
//   ├─────────────────────────────────────────────────────────────────────────┤
//   │  This Engine (src/lib/banking-prisma/oracle.ts)                         │
//   │  • getBankingOracleInsights(orgId) → BankingOracleInsights (10 sections)│
//   │      1. cashFlowAnalysis     — burn rate, runway, health score          │
//   │      2. largeWithdrawals     — debit > 3x avg or > ₹1L (top 10)         │
//   │      3. duplicatePayments    — same amount+counterparty within 7d       │
//   │      4. gstPaymentReadiness  — this month's GST liability vs balance    │
//   │      5. collectionEfficiency — overdue %, avg collection days           │
//   │      6. unmatchedTransactions — count + amount by type                  │
//   │      7. lateCollections      — top 5 overdue invoices                   │
//   │      8. fraudIndicators      — denylist / structuring / anonymous credit│
//   │      9. nextMonthPrediction  — 3-mo avg inflow/outflow → projected bal  │
//   │     10. recommendations      — 3-5 prioritised actions                  │
//   ├─────────────────────────────────────────────────────────────────────────┤
//   │  Prisma (SQLite)  ←  BankAccount, BankTransaction,                     │
//   │                       Invoice (via Client.firmId)                       │
//   └─────────────────────────────────────────────────────────────────────────┘
//
// Invoice scoping:
//   The Invoice model has NO direct `organizationId` field. It is scoped via
//   `client.firmId === organizationId`. Confirmed in prisma/schema.prisma:
//     model Invoice { clientId String; client Client @relation(...); ... }
//     model Client  { firmId String?; invoices Invoice[]; ... }
//
// Invoice field names (verified against schema.prisma):
//   • invoiceDate   — String (ISO date "YYYY-MM-DD"), NOT DateTime
//   • dueDate       — String? (ISO date "YYYY-MM-DD" or null)
//   • totalAmount   — Float (grand total)
//   • balanceAmount — Float (outstanding)
//   • cgst/sgst/igst/cess — Float (tax components)
//   • status        — String (draft|sent|paid|cancelled|archived|...)
//   • paymentDate   — String? (ISO date when fully paid, or null)
//   • updatedAt     — DateTime (fallback for avgCollectionDays)
//
// BankTransaction field names:
//   • date          — DateTime (Prisma filter accepts Date objects)
//   • amount        — Float (always positive; `type` gives direction)
//   • type          — String ("credit" | "debit")
//   • category      — String? (nullable!)
//   • counterparty  — String? (nullable!)
//   • matched       — Boolean
//
// Multi-tenant: every BankAccount/BankTransaction query filters on
// `organizationId`. Every Invoice query filters on `client.firmId`.
//
// Empty-data contract:
//   Every section returns zeros / empty arrays / sensible defaults — NEVER
//   throws. An org with no accounts/txns/invoices yields:
//     • cashFlowAnalysis.score = 100 (no outflow, no risk) — see scoring rules
//     • largeWithdrawals = [], duplicatePayments = [], lateCollections = []
//     • gstPaymentReadiness.shortfall = 0, ready = true (no liability)
//     • collectionEfficiency.rate = 1.0 (no outstanding)
//     • recommendations = [{ priority:'low', action:'Banking operations healthy' }]
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { BankingOracleInsights } from './types';

// ─── Local helpers (mirrored from reports.ts / cashflow.ts) ───────────────────

const DAY_MS = 86_400_000;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// YYYY-MM-DD — used for invoiceDate/dueDate (String columns) range comparison.
// ISO date strings compare lexicographically == chronologically, so a string
// gte/lte works correctly.
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ₹-formatted integer string for human-readable insights/recommendations.
function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. cashFlowAnalysis — burn rate, runway, health score
// ═══════════════════════════════════════════════════════════════════════════════

interface CashFlowAnalysis {
  health: 'excellent' | 'good' | 'fair' | 'poor';
  score: number;
  insight: string;
  avgDailyBurn: number;
  runwayDays: number;
}

async function computeCashFlow(
  organizationId: string,
  availableBalance: number,
  reconciliationRate: number,
): Promise<CashFlowAnalysis> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);

  const txns = await db.bankTransaction.findMany({
    where: {
      organizationId,
      date: { gte: thirtyDaysAgo, lte: now },
    },
    select: { amount: true, type: true },
  });

  let inflow = 0;
  let outflow = 0;
  for (const t of txns) {
    const amt = Math.abs(t.amount);
    if (t.type === 'credit') inflow += amt;
    else if (t.type === 'debit') outflow += amt;
  }

  const avgDailyBurn = round2(outflow / 30);
  const runwayDays = avgDailyBurn > 0 ? Math.floor(availableBalance / avgDailyBurn) : 999;

  // Score: start at 50, apply +/- adjustments, clamp 0-100.
  let score = 50;
  if (inflow >= outflow) score += 20;
  if (runwayDays > 90) score += 15;
  if (reconciliationRate > 0.7) score += 15;
  if (runwayDays < 30) score -= 20;
  if (outflow > 1.5 * inflow) score -= 15;
  score = Math.max(0, Math.min(100, score));

  const health: CashFlowAnalysis['health'] =
    score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor';

  // Human-readable insight.
  const healthAdj: Record<CashFlowAnalysis['health'], string> = {
    excellent: 'Excellent',
    good: 'Healthy',
    fair: 'Stable',
    poor: 'Critical',
  };

  let insight: string;
  if (outflow === 0 && inflow === 0) {
    insight = `No transaction activity in the last 30 days. Available balance ${inr(availableBalance)}.`;
  } else if (outflow === 0) {
    insight = `${healthAdj[health]} cash position with ${runwayDays}-day runway. Inflow ${inr(inflow)} with no outflow recorded.`;
  } else {
    const pctDiff = Math.round(((inflow - outflow) / outflow) * 100);
    const direction = inflow >= outflow ? 'exceeds' : 'below';
    insight = `${healthAdj[health]} cash position with ${runwayDays}-day runway. Inflow ${direction} outflow by ${Math.abs(pctDiff)}%.`;
  }

  return {
    health,
    score,
    insight,
    avgDailyBurn,
    runwayDays,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. largeWithdrawals — debits > 3x avg OR > ₹1L (top 10 by amount desc)
// ═══════════════════════════════════════════════════════════════════════════════

interface LargeWithdrawal {
  transactionId: string;
  date: string;
  amount: number;
  counterparty: string | null;
  description: string;
  severity: 'info' | 'warning' | 'critical';
}

async function computeLargeWithdrawals(
  organizationId: string,
): Promise<LargeWithdrawal[]> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);

  const debits = await db.bankTransaction.findMany({
    where: {
      organizationId,
      type: 'debit',
      date: { gte: thirtyDaysAgo, lte: now },
    },
    select: {
      id: true,
      date: true,
      amount: true,
      counterparty: true,
      description: true,
    },
  });

  if (debits.length === 0) return [];

  const totalDebit = debits.reduce((s, t) => s + Math.abs(t.amount), 0);
  const avgDebit = totalDebit / debits.length;

  const flagged: LargeWithdrawal[] = [];
  for (const t of debits) {
    const amt = Math.abs(t.amount);
    const isLarge = amt > 3 * avgDebit || amt > 100_000;
    if (!isLarge) continue;

    let severity: LargeWithdrawal['severity'];
    if (amt > 5 * avgDebit || amt > 500_000) {
      severity = 'critical';
    } else if (amt > 3 * avgDebit || amt > 100_000) {
      severity = 'warning';
    } else {
      severity = 'info';
    }

    flagged.push({
      transactionId: t.id,
      date: t.date.toISOString(),
      amount: round2(amt),
      counterparty: t.counterparty,
      description: t.description,
      severity,
    });
  }

  flagged.sort((a, b) => b.amount - a.amount);
  return flagged.slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. duplicatePayments — same (amount+counterparty+type) within a 7-day window
// ═══════════════════════════════════════════════════════════════════════════════

interface DuplicatePayment {
  amount: number;
  count: number;
  counterparty: string | null;
  dates: string[];
  totalExposure: number;
}

async function computeDuplicatePayments(
  organizationId: string,
): Promise<DuplicatePayment[]> {
  const now = new Date();
  // Look back 90 days — enough to catch recent duplicates without scanning history.
  const ninetyDaysAgo = new Date(now.getTime() - 90 * DAY_MS);

  const debits = await db.bankTransaction.findMany({
    where: {
      organizationId,
      type: 'debit',
      date: { gte: ninetyDaysAgo, lte: now },
    },
    select: {
      id: true,
      amount: true,
      counterparty: true,
      date: true,
    },
  });

  // Group by (rounded amount + counterparty + type).
  type Entry = { id: string; amount: number; counterparty: string | null; date: Date };
  const groups = new Map<string, Entry[]>();

  for (const t of debits) {
    const amt = round2(Math.abs(t.amount));
    const key = `${amt}|${t.counterparty || ''}|debit`;
    const arr = groups.get(key);
    const entry: Entry = { id: t.id, amount: amt, counterparty: t.counterparty, date: t.date };
    if (arr) {
      arr.push(entry);
    } else {
      groups.set(key, [entry]);
    }
  }

  const duplicates: DuplicatePayment[] = [];

  for (const entries of groups.values()) {
    if (entries.length < 2) continue;

    // Sort ascending by date for the sliding-window scan.
    const sorted = entries.slice().sort((a, b) => a.date.getTime() - b.date.getTime());

    // Find the densest 7-day window (most entries within any 7-day span).
    let bestStart = 0;
    let bestCount = 1;
    for (let i = 0; i < sorted.length; i++) {
      let j = i;
      while (
        j < sorted.length &&
        sorted[j].date.getTime() - sorted[i].date.getTime() <= 7 * DAY_MS
      ) {
        j++;
      }
      const count = j - i;
      if (count > bestCount) {
        bestCount = count;
        bestStart = i;
      }
    }

    if (bestCount >= 2) {
      const grp = sorted.slice(bestStart, bestStart + bestCount);
      duplicates.push({
        amount: grp[0].amount,
        count: grp.length,
        counterparty: grp[0].counterparty,
        dates: grp.map((g) => g.date.toISOString()),
        totalExposure: round2(grp[0].amount * grp.length),
      });
    }
  }

  duplicates.sort((a, b) => b.totalExposure - a.totalExposure);
  return duplicates;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. gstPaymentReadiness — this month's GST liability vs available balance
// ═══════════════════════════════════════════════════════════════════════════════

interface GstPaymentReadiness {
  ready: boolean;
  nextDueDate: string | null;
  estimatedLiability: number;
  availableBalance: number;
  shortfall: number;
}

async function computeGstReadiness(
  organizationId: string,
  availableBalance: number,
): Promise<GstPaymentReadiness> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartISO = toISODate(monthStart);
  const nowISO = toISODate(now);

  // Invoices issued this month that haven't been paid or cancelled.
  const invoices = await db.invoice.findMany({
    where: {
      client: { firmId: organizationId },
      invoiceDate: { gte: monthStartISO, lte: nowISO },
      status: { notIn: ['paid', 'cancelled'] },
    },
    select: { cgst: true, sgst: true, igst: true },
  });

  let liability = 0;
  for (const inv of invoices) {
    liability += (inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0);
  }

  const estimatedLiability = round2(liability);
  const ready = availableBalance >= estimatedLiability;
  const shortfall = round2(Math.max(0, estimatedLiability - availableBalance));

  // 20th of next month — GST filing due date.
  const nextDue = new Date(now.getFullYear(), now.getMonth() + 1, 20);
  const nextDueDate = nextDue.toISOString();

  return {
    ready,
    nextDueDate,
    estimatedLiability,
    availableBalance: round2(availableBalance),
    shortfall,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. collectionEfficiency — overdue %, avg collection days
// ═══════════════════════════════════════════════════════════════════════════════

interface CollectionEfficiency {
  rate: number;
  avgCollectionDays: number;
  totalOutstanding: number;
  overdueAmount: number;
}

async function computeCollectionEfficiency(
  organizationId: string,
): Promise<CollectionEfficiency> {
  const now = new Date();

  // Open invoices with outstanding balance.
  const openInvoices = await db.invoice.findMany({
    where: {
      client: { firmId: organizationId },
      status: { notIn: ['paid', 'cancelled'] },
      balanceAmount: { gt: 0 },
    },
    select: { balanceAmount: true, dueDate: true },
  });

  let totalOutstanding = 0;
  let overdueAmount = 0;
  for (const inv of openInvoices) {
    const bal = Math.abs(inv.balanceAmount || 0);
    totalOutstanding += bal;
    if (inv.dueDate) {
      const due = new Date(inv.dueDate);
      if (!isNaN(due.getTime()) && due.getTime() < now.getTime()) {
        overdueAmount += bal;
      }
    }
  }

  const rate =
    totalOutstanding > 0
      ? round2((totalOutstanding - overdueAmount) / totalOutstanding)
      : 1.0;

  // Avg collection days — from paid invoices (paymentDate preferred, updatedAt fallback).
  const paidInvoices = await db.invoice.findMany({
    where: {
      client: { firmId: organizationId },
      status: 'paid',
    },
    select: { invoiceDate: true, paymentDate: true, updatedAt: true },
  });

  let avgCollectionDays = 30; // default terms
  if (paidInvoices.length > 0) {
    let totalDays = 0;
    let count = 0;
    for (const inv of paidInvoices) {
      const issue = new Date(inv.invoiceDate);
      const paid = inv.paymentDate ? new Date(inv.paymentDate) : inv.updatedAt;
      if (
        !isNaN(issue.getTime()) &&
        !isNaN(paid.getTime()) &&
        paid.getTime() >= issue.getTime()
      ) {
        totalDays += Math.floor((paid.getTime() - issue.getTime()) / DAY_MS);
        count++;
      }
    }
    if (count > 0) avgCollectionDays = Math.round(totalDays / count);
  }

  return {
    rate,
    avgCollectionDays,
    totalOutstanding: round2(totalOutstanding),
    overdueAmount: round2(overdueAmount),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. unmatchedTransactions — count + total amount, broken down by type
// ═══════════════════════════════════════════════════════════════════════════════

interface UnmatchedTransactions {
  count: number;
  totalAmount: number;
  byType: { credit: number; debit: number };
}

async function computeUnmatchedTransactions(
  organizationId: string,
): Promise<UnmatchedTransactions> {
  const unmatched = await db.bankTransaction.findMany({
    where: {
      organizationId,
      matched: false,
    },
    select: { amount: true, type: true },
  });

  let creditCount = 0;
  let debitCount = 0;
  let totalAmount = 0;
  for (const t of unmatched) {
    const amt = Math.abs(t.amount);
    totalAmount += amt;
    if (t.type === 'credit') creditCount++;
    else if (t.type === 'debit') debitCount++;
  }

  return {
    count: unmatched.length,
    totalAmount: round2(totalAmount),
    byType: { credit: creditCount, debit: debitCount },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. lateCollections — top 5 overdue invoices (by daysOverdue desc)
// ═══════════════════════════════════════════════════════════════════════════════

interface LateCollection {
  invoiceNumber: string;
  clientName: string;
  amount: number;
  daysOverdue: number;
}

async function computeLateCollections(
  organizationId: string,
): Promise<LateCollection[]> {
  const now = new Date();
  const nowISO = toISODate(now);

  const overdueInvoices = await db.invoice.findMany({
    where: {
      client: { firmId: organizationId },
      dueDate: { lt: nowISO },
      balanceAmount: { gt: 0 },
      status: { notIn: ['paid', 'cancelled'] },
    },
    select: {
      invoiceNumber: true,
      balanceAmount: true,
      dueDate: true,
      client: { select: { tradeName: true, legalName: true } },
    },
  });

  const result: LateCollection[] = [];
  for (const inv of overdueInvoices) {
    if (!inv.dueDate) continue;
    const due = new Date(inv.dueDate);
    if (isNaN(due.getTime())) continue;

    const daysOverdue = Math.floor((now.getTime() - due.getTime()) / DAY_MS);
    if (daysOverdue <= 0) continue;

    const clientName =
      inv.client?.tradeName || inv.client?.legalName || 'Unknown Client';

    result.push({
      invoiceNumber: inv.invoiceNumber,
      clientName,
      amount: round2(Math.abs(inv.balanceAmount || 0)),
      daysOverdue,
    });
  }

  result.sort((a, b) => b.daysOverdue - a.daysOverdue);
  return result.slice(0, 5);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. fraudIndicators — denylist / structuring / anonymous credit / large cash
// ═══════════════════════════════════════════════════════════════════════════════

interface FraudIndicator {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  description: string;
  transactionId?: string;
}

async function computeFraudIndicators(
  organizationId: string,
): Promise<FraudIndicator[]> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);

  const txns = await db.bankTransaction.findMany({
    where: {
      organizationId,
      date: { gte: thirtyDaysAgo, lte: now },
    },
    select: {
      id: true,
      amount: true,
      type: true,
      counterparty: true,
      description: true,
      matched: true,
      date: true,
    },
  });

  const indicators: FraudIndicator[] = [];

  const denylist = /lottery|crypto|gambling|casino|bet/i;
  const genericCash = /\b(cash|atm)\b/i;

  // Track same-day transactions in the ₹40k–₹49k band (structuring pattern).
  const dayBelowThreshold = new Map<
    string,
    { count: number; total: number }
  >();

  for (const t of txns) {
    const amt = Math.abs(t.amount);
    const cp = (t.counterparty || '').toLowerCase();
    const desc = (t.description || '').toLowerCase();

    // Critical: counterparty matching denylist pattern.
    if (denylist.test(cp)) {
      indicators.push({
        type: 'denylist_counterparty',
        severity: 'critical',
        description: `Transaction with counterparty matching denylist pattern: "${t.counterparty || t.description}"`,
        transactionId: t.id,
      });
      continue; // don't double-flag the same txn
    }

    // Warning: round amounts > ₹50k with generic cash/ATM descriptions.
    if (amt > 50_000 && genericCash.test(desc)) {
      indicators.push({
        type: 'large_cash_transaction',
        severity: 'warning',
        description: `Large ${inr(amt)} cash/ATM transaction: "${t.description}"`,
        transactionId: t.id,
      });
    }

    // Warning: unmatched credit > ₹1L with no counterparty.
    if (t.type === 'credit' && !t.matched && amt > 100_000 && !t.counterparty) {
      indicators.push({
        type: 'unmatched_anonymous_credit',
        severity: 'warning',
        description: `Unmatched credit of ${inr(amt)} with no counterparty identified`,
        transactionId: t.id,
      });
    }

    // Accumulate ₹40k–₹49k band per day for structuring detection.
    if (amt > 40_000 && amt < 49_000) {
      const dayKey = toISODate(t.date);
      const entry = dayBelowThreshold.get(dayKey) || { count: 0, total: 0 };
      entry.count++;
      entry.total += amt;
      dayBelowThreshold.set(dayKey, entry);
    }
  }

  // Multiple small txns just below ₹49k reporting threshold on the same day.
  for (const [dayKey, entry] of dayBelowThreshold) {
    if (entry.count >= 3) {
      indicators.push({
        type: 'structuring_pattern',
        severity: 'warning',
        description: `${entry.count} transactions just below ₹49k reporting threshold on ${dayKey} totaling ${inr(entry.total)}`,
      });
    }
  }

  return indicators;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. nextMonthPrediction — 3-mo avg inflow/outflow → projected balance
// ═══════════════════════════════════════════════════════════════════════════════

interface NextMonthPrediction {
  predictedBalance: number;
  confidence: number;
  expectedInflow: number;
  expectedOutflow: number;
  reasoning: string;
}

async function computeNextMonthPrediction(
  organizationId: string,
  currentBalance: number,
): Promise<NextMonthPrediction> {
  const now = new Date();
  // Look back 3 calendar months for monthly inflow/outflow.
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

  const txns = await db.bankTransaction.findMany({
    where: {
      organizationId,
      date: { gte: threeMonthsAgo, lte: now },
    },
    select: { amount: true, type: true, date: true },
  });

  // Group by calendar month (YYYY-M).
  const monthly = new Map<string, { inflow: number; outflow: number }>();
  for (const t of txns) {
    const d = t.date;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const m = monthly.get(key) || { inflow: 0, outflow: 0 };
    const amt = Math.abs(t.amount);
    if (t.type === 'credit') m.inflow += amt;
    else if (t.type === 'debit') m.outflow += amt;
    monthly.set(key, m);
  }

  const monthsData = Array.from(monthly.values());
  const monthCount = monthsData.length;

  let expectedInflow = 0;
  let expectedOutflow = 0;

  if (monthCount >= 3) {
    // Last 3 months average.
    const last3 = monthsData.slice(-3);
    expectedInflow = last3.reduce((s, m) => s + m.inflow, 0) / 3;
    expectedOutflow = last3.reduce((s, m) => s + m.outflow, 0) / 3;
  } else if (monthCount >= 1) {
    // <3 months of data — use last month's value.
    const last = monthsData[monthsData.length - 1];
    expectedInflow = last.inflow;
    expectedOutflow = last.outflow;
  }

  // Confidence: 0.7 if 3+ months, 0.5 if 1-2 months, 0.3 if less.
  const confidence =
    monthCount >= 3 ? 0.7 : monthCount >= 1 ? 0.5 : 0.3;

  const predictedBalance = round2(
    currentBalance + expectedInflow - expectedOutflow,
  );
  const inflowR = round2(expectedInflow);
  const outflowR = round2(expectedOutflow);

  const monthLabel =
    monthCount >= 3
      ? '3-month'
      : monthCount >= 1
        ? `${monthCount}-month`
        : 'no';

  const reasoning = `Based on ${monthLabel} average inflow of ${inr(inflowR)} and outflow of ${inr(outflowR)}, projected balance is ${inr(predictedBalance)}.`;

  return {
    predictedBalance,
    confidence: round2(confidence),
    expectedInflow: inflowR,
    expectedOutflow: outflowR,
    reasoning,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10. recommendations — 3-5 prioritised actions derived from above sections
// ═══════════════════════════════════════════════════════════════════════════════

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  action: string;
  impact: string;
}

interface RecommendationInput {
  reconciliationRate: number;
  unmatchedCount: number;
  unmatchedAmount: number;
  runwayDays: number;
  overdueAmount: number;
  duplicatePayments: DuplicatePayment[];
  gstShortfall: number;
  gstLiability: number;
  gstNextDueDate: string | null;
  fraudIndicators: FraudIndicator[];
}

function buildRecommendations(input: RecommendationInput): Recommendation[] {
  const recs: Recommendation[] = [];

  // High: low reconciliation rate.
  if (input.reconciliationRate < 0.7 && input.unmatchedCount > 0) {
    recs.push({
      priority: 'high',
      action: 'Run bank reconciliation',
      impact: `${input.unmatchedCount} unmatched transactions worth ${inr(input.unmatchedAmount)} need matching`,
    });
  }

  // High: short runway.
  if (input.runwayDays < 60) {
    recs.push({
      priority: 'high',
      action: 'Improve collections',
      impact: `Cash runway is only ${input.runwayDays} days. Follow up on ${inr(input.overdueAmount)} overdue invoices.`,
    });
  }

  // Medium: duplicate payments detected.
  if (input.duplicatePayments.length > 0) {
    const totalDup = input.duplicatePayments.reduce(
      (s, d) => s + d.totalExposure,
      0,
    );
    const dupCount = input.duplicatePayments.reduce(
      (s, d) => s + d.count,
      0,
    );
    recs.push({
      priority: 'medium',
      action: 'Review duplicate payments',
      impact: `${dupCount} potential duplicate payments totaling ${inr(totalDup)} detected`,
    });
  }

  // High: GST shortfall.
  if (input.gstShortfall > 0) {
    const dueStr = input.gstNextDueDate
      ? new Date(input.gstNextDueDate).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : 'soon';
    recs.push({
      priority: 'high',
      action: 'Prepare for GST payment',
      impact: `${inr(input.gstLiability)} GST liability due on ${dueStr}, ${inr(input.gstShortfall)} shortfall in available balance`,
    });
  }

  // High: critical fraud indicators.
  const criticalFraud = input.fraudIndicators.filter(
    (f) => f.severity === 'critical',
  ).length;
  if (criticalFraud > 0) {
    recs.push({
      priority: 'high',
      action: 'Investigate suspicious transactions',
      impact: `${criticalFraud} critical fraud indicator${criticalFraud === 1 ? '' : 's'} detected`,
    });
  }

  // Default: all good.
  if (recs.length === 0) {
    recs.push({
      priority: 'low',
      action: 'Banking operations healthy',
      impact: 'No immediate action required',
    });
  }

  // Spec: 3-5 recommendations. If we somehow generated more, truncate to 5.
  return recs.slice(0, 5);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT — getBankingOracleInsights
// ═══════════════════════════════════════════════════════════════════════════════

export async function getBankingOracleInsights(
  organizationId: string,
): Promise<BankingOracleInsights> {
  // Phase 1: accounts + matched count (parallel — no dependencies).
  const [accounts, matchedCount] = await Promise.all([
    db.bankAccount.findMany({
      where: { organizationId },
      select: { balance: true, availableBalance: true },
    }),
    db.bankTransaction.count({
      where: { organizationId, matched: true },
    }),
  ]);

  const totalBalance = round2(
    accounts.reduce((s, a) => s + (a.balance || 0), 0),
  );
  const totalAvailable = round2(
    accounts.reduce((s, a) => s + (a.availableBalance || 0), 0),
  );

  // Phase 2: all independent section computations in parallel.
  const [
    unmatched,
    largeWithdrawals,
    duplicatePayments,
    gst,
    collection,
    lateCollections,
    fraud,
    prediction,
  ] = await Promise.all([
    computeUnmatchedTransactions(organizationId),
    computeLargeWithdrawals(organizationId),
    computeDuplicatePayments(organizationId),
    computeGstReadiness(organizationId, totalAvailable),
    computeCollectionEfficiency(organizationId),
    computeLateCollections(organizationId),
    computeFraudIndicators(organizationId),
    computeNextMonthPrediction(organizationId, totalBalance),
  ]);

  // Reconciliation rate derived from matched count + unmatched count.
  const totalCount = matchedCount + unmatched.count;
  const reconciliationRate =
    totalCount > 0 ? matchedCount / totalCount : 1.0;

  // Phase 3: cash flow (needs reconciliationRate).
  const cashFlow = await computeCashFlow(
    organizationId,
    totalAvailable,
    reconciliationRate,
  );

  // Phase 4: recommendations (synthesises all of the above).
  const recommendations = buildRecommendations({
    reconciliationRate,
    unmatchedCount: unmatched.count,
    unmatchedAmount: unmatched.totalAmount,
    runwayDays: cashFlow.runwayDays,
    overdueAmount: collection.overdueAmount,
    duplicatePayments,
    gstShortfall: gst.shortfall,
    gstLiability: gst.estimatedLiability,
    gstNextDueDate: gst.nextDueDate,
    fraudIndicators: fraud,
  });

  return {
    cashFlowAnalysis: cashFlow,
    largeWithdrawals,
    duplicatePayments,
    gstPaymentReadiness: gst,
    collectionEfficiency: collection,
    unmatchedTransactions: unmatched,
    lateCollections,
    fraudIndicators: fraud,
    nextMonthPrediction: prediction,
    recommendations,
  };
}
