// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Invoice Engine™ — Payables Cloud™
// Vendor payables summary, prioritized payment scheduling, cash allocation.
// Prisma-backed server module.
// ═══════════════════════════════════════════════════════════════════════════════

import type { PayableDTO, PayablesListResult } from './types';
import { db } from '@/lib/db';

// Pure utilities (Prisma-free) — re-exported so existing server-side callers
// keep compiling. Client components MUST import directly from `./payables-utils`
// to avoid dragging Prisma into their bundle.
export {
  getPayablesSummary,
  dueThisWeek,
  dueNextWeek,
  prioritizePayments,
  cashAllocationPlan,
  type PaymentPriority,
  type CashAllocation,
} from './payables-utils';

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

// ─── Payment actions (DB-backed) ──────────────────────────────────────────────

export interface PayableActionResult {
  id: string;
  vendorName: string;
  billNo: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: string;
  status: string;
  scheduledDate?: string | null;
}

/**
 * Records a vendor payment against a purchase bill: increments paidAmount,
 * recomputes balanceAmount, and flips paymentStatus to 'paid' (or 'partial').
 * Also writes a Payment row (partyType='vendor') for the audit trail.
 */
export async function payPayable(
  id: string,
  amount: number,
  mode: 'upi' | 'bank' | 'rtgs' | 'neft' | 'imps' = 'bank',
  referenceNo?: string,
): Promise<PayableActionResult> {
  const bill = await db.purchaseBill.findUnique({ where: { id } });
  if (!bill) throw new Error(`Purchase bill ${id} not found`);

  const payAmount = Math.max(0, round2(amount));
  const newPaid = round2(bill.paidAmount + payAmount);
  const newBalance = round2(Math.max(0, bill.totalAmount - newPaid));
  const paymentStatus = newBalance <= 0.01 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';
  const status = newBalance <= 0.01 ? 'paid' : newPaid > 0 ? 'partial' : bill.status;

  const updated = await db.purchaseBill.update({
    where: { id },
    data: {
      paidAmount: newPaid,
      balanceAmount: newBalance,
      paymentStatus,
      status,
    },
  });

  // Audit-trail Payment row (vendor side).
  try {
    await db.payment.create({
      data: {
        partyName: bill.vendorName,
        partyType: 'vendor',
        amount: payAmount,
        paymentDate: new Date().toISOString(),
        paymentMode: mode,
        referenceNo: referenceNo ?? null,
        purchaseBillId: bill.id,
        status: 'completed',
        reconciled: false,
      },
    });
  } catch {
    // Payment write is best-effort; the payable itself is already updated.
  }

  return {
    id: updated.id,
    vendorName: updated.vendorName,
    billNo: updated.invoiceNo,
    totalAmount: round2(updated.totalAmount),
    paidAmount: round2(updated.paidAmount),
    balanceAmount: round2(updated.balanceAmount),
    paymentStatus: updated.paymentStatus,
    status: updated.status,
  };
}

/**
 * Schedules a vendor payment for a future date. The PurchaseBill model has no
 * dedicated scheduledDate column, so the chosen date is recorded in `notes`
 * using a structured marker that the UI can parse without a schema migration.
 */
export async function schedulePayment(
  id: string,
  scheduledDate: string,
): Promise<PayableActionResult> {
  const bill = await db.purchaseBill.findUnique({ where: { id } });
  if (!bill) throw new Error(`Purchase bill ${id} not found`);

  const marker = `[SCHEDULED:${scheduledDate}]`;
  const existingNotes = bill.notes ?? '';
  const cleaned = existingNotes.replace(/\[SCHEDULED:[^\]]*\]/g, '').trim();
  const notes = `${marker} ${cleaned}`.trim();

  const updated = await db.purchaseBill.update({
    where: { id },
    data: { notes },
  });

  return {
    id: updated.id,
    vendorName: updated.vendorName,
    billNo: updated.invoiceNo,
    totalAmount: round2(updated.totalAmount),
    paidAmount: round2(updated.paidAmount),
    balanceAmount: round2(updated.balanceAmount),
    paymentStatus: updated.paymentStatus,
    status: updated.status,
    scheduledDate,
  };
}
