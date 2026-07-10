// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Invoice Engine™ — Payables Cloud™
// Vendor payables summary, prioritized payment scheduling, cash allocation.
// Pure TypeScript.
// ═══════════════════════════════════════════════════════════════════════════════

import type { PayablesSummary, PurchaseBill, PayableDTO, PayablesListResult } from './types';
import { db } from '@/lib/db';

// ─── Summary ──────────────────────────────────────────────────────────────────

export function getPayablesSummary(bills: PurchaseBill[]): PayablesSummary {
  let totalPayable = 0;
  let totalOverdue = 0;
  let dueThisWeekTotal = 0;
  let dueNextWeekTotal = 0;

  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  for (const b of bills) {
    if (b.paymentStatus === 'paid') continue;
    totalPayable += b.balanceAmount;
    if (b.dueDate) {
      const dueTs = new Date(b.dueDate).getTime();
      if (dueTs < now) totalOverdue += b.balanceAmount;
      if (dueTs >= now && dueTs <= now + weekMs) dueThisWeekTotal += b.balanceAmount;
      if (dueTs > now + weekMs && dueTs <= now + 2 * weekMs) dueNextWeekTotal += b.balanceAmount;
    }
  }

  return {
    totalPayable: round2(totalPayable),
    totalOverdue: round2(totalOverdue),
    dueThisWeek: round2(dueThisWeekTotal),
    dueNextWeek: round2(dueNextWeekTotal),
  };
}

// ─── Due-soon filters ─────────────────────────────────────────────────────────

export function dueThisWeek(bills: PurchaseBill[]): PurchaseBill[] {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  return bills.filter((b) => {
    if (b.paymentStatus === 'paid' || !b.dueDate) return false;
    const dueTs = new Date(b.dueDate).getTime();
    return dueTs >= now && dueTs <= now + weekMs;
  });
}

export function dueNextWeek(bills: PurchaseBill[]): PurchaseBill[] {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  return bills.filter((b) => {
    if (b.paymentStatus === 'paid' || !b.dueDate) return false;
    const dueTs = new Date(b.dueDate).getTime();
    return dueTs > now + weekMs && dueTs <= now + 2 * weekMs;
  });
}

// ─── Payment prioritization ───────────────────────────────────────────────────

export interface PaymentPriority {
  billId: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Assigns a payment priority to each unpaid bill:
 *   - overdue            → high    (past due date)
 *   - due within 7 days  → high
 *   - due within 14 days → medium
 *   - otherwise          → low
 */
export function prioritizePayments(bills: PurchaseBill[]): PaymentPriority[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  return bills
    .filter((b) => b.paymentStatus !== 'paid' && b.balanceAmount > 0)
    .map((b) => {
      const dueTs = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const daysToDue = Math.round((dueTs - now) / dayMs);
      if (daysToDue <= 0) {
        return {
          billId: b.id,
          priority: 'high' as const,
          reason: `Overdue by ${Math.abs(daysToDue)} day(s)`,
        };
      }
      if (daysToDue <= 7) {
        return {
          billId: b.id,
          priority: 'high' as const,
          reason: `Due in ${daysToDue} day(s)`,
        };
      }
      if (daysToDue <= 14) {
        return {
          billId: b.id,
          priority: 'medium' as const,
          reason: `Due in ${daysToDue} day(s)`,
        };
      }
      return {
        billId: b.id,
        priority: 'low' as const,
        reason: `Due in ${daysToDue} day(s)`,
      };
    });
}

// ─── Cash allocation ──────────────────────────────────────────────────────────

export interface CashAllocation {
  billId: string;
  allocated: number;
  status: 'full' | 'partial' | 'skip';
}

/**
 * Allocates available cash to unpaid bills in priority order: overdue first,
 * then due-soonest first. Each bill is fully paid before moving on; the last
 * bill may receive a partial allocation if cash runs out.
 */
export function cashAllocationPlan(bills: PurchaseBill[], availableCash: number): CashAllocation[] {
  const priorities = prioritizePayments(bills);
  const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...bills]
    .filter((b) => b.paymentStatus !== 'paid' && b.balanceAmount > 0)
    .sort((a, b) => {
      const pa = priorities.find((p) => p.billId === a.id);
      const pb = priorities.find((p) => p.billId === b.id);
      const ra = pa ? priorityRank[pa.priority] : 3;
      const rb = pb ? priorityRank[pb.priority] : 3;
      if (ra !== rb) return ra - rb;
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return da - db;
    });

  let remaining = Math.max(0, availableCash);
  const allocations: CashAllocation[] = [];
  for (const b of sorted) {
    if (remaining <= 0) {
      allocations.push({ billId: b.id, allocated: 0, status: 'skip' });
      continue;
    }
    const needed = b.balanceAmount;
    if (remaining >= needed) {
      allocations.push({ billId: b.id, allocated: round2(needed), status: 'full' });
      remaining = round2(remaining - needed);
    } else {
      allocations.push({ billId: b.id, allocated: round2(remaining), status: 'partial' });
      remaining = 0;
    }
  }
  return allocations;
}

// ─── helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

// ─── DB-backed list query ──────────────────────────────────────────────────────

/** Fetches unpaid purchase bills from Prisma and builds the payables list. */
export async function getPayables(opts?: { limit?: number }): Promise<PayablesListResult> {
  const rows = await db.purchaseBill.findMany({
    take: opts?.limit ?? 500,
    orderBy: { createdAt: 'desc' },
  });
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const payables: PayableDTO[] = rows
    .filter((r) => r.paymentStatus !== 'paid' && r.balanceAmount > 0)
    .map((r) => {
      const dueTs = r.dueDate ? new Date(r.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const daysUntilDue = Math.round((dueTs - now) / dayMs);
      const priority = daysUntilDue <= 0 ? 'high' : daysUntilDue <= 7 ? 'high' : daysUntilDue <= 14 ? 'medium' : 'low';
      const priorityScore = Math.max(0, Math.min(100, 100 - Math.max(0, daysUntilDue)));
      return {
        id: r.id,
        vendorName: r.vendorName,
        billNo: r.invoiceNo,
        billDate: r.invoiceDate,
        dueDate: r.dueDate ?? null,
        totalAmount: r.totalAmount,
        paidAmount: r.paidAmount,
        balanceDue: r.balanceAmount,
        daysUntilDue,
        priority,
        priorityScore,
        status: r.status,
      };
    });

  const totalDue = sum(payables.map((p) => p.balanceDue));
  const dueIn7Days = sum(payables.filter((p) => p.daysUntilDue >= 0 && p.daysUntilDue <= 7).map((p) => p.balanceDue));
  const dueIn30Days = sum(payables.filter((p) => p.daysUntilDue >= 0 && p.daysUntilDue <= 30).map((p) => p.balanceDue));
  const overdueAmount = sum(payables.filter((p) => p.daysUntilDue < 0).map((p) => p.balanceDue));
  const avgPriorityScore = payables.length > 0
    ? Math.round(sum(payables.map((p) => p.priorityScore)) / payables.length)
    : 0;

  return {
    payables,
    total: payables.length,
    totalDue: round2(totalDue),
    dueIn7Days: round2(dueIn7Days),
    dueIn30Days: round2(dueIn30Days),
    overdueAmount: round2(overdueAmount),
    scheduledCount: 0,
    avgPriorityScore,
    hasLiveData: payables.length > 0,
  };
}
