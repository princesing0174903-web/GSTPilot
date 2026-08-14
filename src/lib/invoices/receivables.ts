// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Invoice Engine™ — Receivables Cloud™
// Aging buckets, collection forecasting, automated reminder scheduling.
// Prisma-backed server module.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ReceivableDTO, ReceivablesListResult, ReceivablesAgingBucket, ReceivableRisk } from './types';
import { db } from '@/lib/db';
import { daysOverdue } from './invoices-utils';

// Pure utilities (Prisma-free) — re-exported so existing server-side callers
// keep compiling. Client components MUST import directly from `./receivables-utils`
// to avoid dragging Prisma into their bundle.
export {
  AGING_BUCKETS,
  computeAging,
  getReceivablesSummary,
  detectOverdue,
  scheduleReminders,
  forecastCollections,
  collectionRate,
  type ReminderScheduleItem,
  type CollectionForecast,
} from './receivables-utils';

// ─── helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

// ─── DB-backed list query ──────────────────────────────────────────────────────

/** Fetches outstanding invoices from Prisma and builds the receivables list. */
export async function getReceivables(opts?: { limit?: number }): Promise<ReceivablesListResult> {
  const rows = await db.invoice.findMany({
    take: opts?.limit ?? 500,
    orderBy: { createdAt: 'desc' },
  });
  const receivables: ReceivableDTO[] = rows
    .filter((r) => r.paymentStatus !== 'paid' && r.status !== 'cancelled' && r.status !== 'draft')
    .map((r) => {
      const dOverdue = r.dueDate ? daysOverdue(r.dueDate) : 0;
      const balance = r.balanceAmount;
      const riskLevel = dOverdue > 60 ? 'high' : dOverdue > 30 ? 'medium' : 'low';
      const collectionProbability = dOverdue > 90 ? 0.3 : dOverdue > 60 ? 0.5 : dOverdue > 30 ? 0.7 : 0.9;
      return {
        id: r.id,
        invoiceId: r.id,
        customerName: r.buyerName ?? 'Unknown',
        invoiceNo: r.invoiceNumber,
        invoiceDate: r.invoiceDate,
        dueDate: r.dueDate ?? null,
        totalAmount: r.totalAmount,
        paidAmount: r.paidAmount,
        balanceDue: r.balanceAmount,
        daysOverdue: dOverdue,
        riskLevel,
        collectionProbability,
        expectedAmount: round2(balance * collectionProbability),
        status: r.paymentStatus,
      };
    });

  const totalOutstanding = sum(receivables.map((r) => r.balanceDue));
  const totalExpected = sum(receivables.map((r) => r.expectedAmount));
  const overdueItems = receivables.filter((r) => r.daysOverdue > 0);
  const overdueCount = overdueItems.length;
  const overdueAmount = sum(overdueItems.map((r) => r.balanceDue));
  const avgDaysOverdue = overdueItems.length > 0
    ? Math.round(sum(overdueItems.map((r) => r.daysOverdue)) / overdueItems.length)
    : 0;
  const collectionEfficiencyPct = totalOutstanding > 0
    ? Math.round((totalExpected / totalOutstanding) * 100)
    : 0;

  // Aging buckets
  const agingDefs = [
    { label: 'Current', min: 0, max: 0 },
    { label: '1-30', min: 1, max: 30 },
    { label: '31-60', min: 31, max: 60 },
    { label: '61-90', min: 61, max: 90 },
    { label: '90+', min: 91, max: 9999 },
  ];
  const byAging: ReceivablesAgingBucket[] = agingDefs.map((b) => {
    const items = receivables.filter((r) => r.daysOverdue >= b.min && r.daysOverdue <= b.max);
    const amount = sum(items.map((r) => r.balanceDue));
    return {
      label: b.label,
      count: items.length,
      amount: round2(amount),
      expectedCollection: round2(amount * 0.85),
    };
  });

  const overallRisk = overdueCount > 5 ? 'high' : overdueCount > 0 ? 'medium' : 'low';

  return {
    receivables,
    total: receivables.length,
    totalOutstanding: round2(totalOutstanding),
    totalExpected: round2(totalExpected),
    collectionEfficiencyPct,
    overdueCount,
    overdueAmount: round2(overdueAmount),
    avgDaysOverdue,
    riskLevel: overallRisk,
    byAging,
    hasLiveData: receivables.length > 0,
  };
}

// ─── Reminder dispatch (DB-backed) ──────────────────────────────────────────────

export interface ReminderResult {
  id: string;
  customerName: string;
  invoiceNo: string;
  balanceDue: number;
  daysOverdue: number;
  reminderCount: number;
  channel: 'whatsapp' | 'email' | 'sms';
  status: string;
}

export interface BulkReminderResult {
  sent: number;
  totalAmount: number;
  channels: { whatsapp: number; email: number; sms: number };
}

/**
 * Sends a single receivable reminder by writing a CommunicationLog row and
 * returning the updated receivable DTO with the running reminder count for
 * that invoice (counted from prior CommunicationLog entries tagged with the
 * invoiceId in `metadata`).
 */
export async function sendReminder(
  id: string,
  channel: 'whatsapp' | 'email' | 'sms' = 'whatsapp',
): Promise<ReminderResult> {
  const invoice = await db.invoice.findUnique({ where: { id } });
  if (!invoice) throw new Error(`Invoice ${id} not found`);

  const dOverdue = invoice.dueDate ? daysOverdue(invoice.dueDate) : 0;
  const customerName = invoice.buyerName ?? 'Customer';
  const recipient = channel === 'email' ? '' : ''; // recipient contact not stored on Invoice
  const meta = JSON.stringify({ invoiceId: invoice.id, invoiceNo: invoice.invoiceNumber, amount: invoice.balanceAmount });

  // Count prior reminders for this invoice.
  const prior = await db.communicationLog.count({
    where: { metadata: { contains: `"invoiceId":"${invoice.id}"` } },
  });
  const reminderCount = prior + 1;

  await db.communicationLog.create({
    data: {
      channel,
      eventType: dOverdue > 0 ? 'overdue' : 'invoice_due',
      recipient: recipient || customerName,
      recipientName: customerName,
      templateName: channel === 'whatsapp' ? 'receivable_reminder_whatsapp' : channel === 'email' ? 'receivable_reminder_email' : 'receivable_reminder_sms',
      messagePreview: `Reminder #${reminderCount} for invoice ${invoice.invoiceNumber} — balance ₹${invoice.balanceAmount} (${dOverdue} days overdue).`,
      status: 'sent',
      triggerSource: 'ai_engine',
      metadata: meta,
    },
  });

  return {
    id: invoice.id,
    customerName,
    invoiceNo: invoice.invoiceNumber,
    balanceDue: round2(invoice.balanceAmount),
    daysOverdue: dOverdue,
    reminderCount,
    channel,
    status: 'sent',
  };
}

/**
 * Sends reminders to every outstanding receivable matching the filter criteria.
 * Returns aggregate counts + total outstanding amount covered.
 */
export async function sendBulkReminders(opts?: {
  minDaysOverdue?: number;
  riskLevel?: ReceivableRisk;
}): Promise<BulkReminderResult> {
  const rows = await db.invoice.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const minDays = opts?.minDaysOverdue ?? 0;

  const targets = rows
    .filter((r) => r.paymentStatus !== 'paid' && r.status !== 'cancelled' && r.status !== 'draft')
    .map((r) => {
      const dueTs = r.dueDate ? new Date(r.dueDate).getTime() : 0;
      const dOverdue = dueTs > 0 ? Math.max(0, Math.floor((now - dueTs) / dayMs)) : 0;
      const risk: ReceivableRisk = dOverdue > 60 ? 'high' : dOverdue > 30 ? 'medium' : 'low';
      return { r, dOverdue, risk };
    })
    .filter((x) => x.dOverdue >= minDays)
    .filter((x) => (opts?.riskLevel ? x.risk === opts.riskLevel : true));

  let sent = 0;
  let totalAmount = 0;
  const channels = { whatsapp: 0, email: 0, sms: 0 };

  for (const { r, dOverdue } of targets) {
    const customerName = r.buyerName ?? 'Customer';
    const meta = JSON.stringify({ invoiceId: r.id, invoiceNo: r.invoiceNumber, amount: r.balanceAmount });
    try {
      await db.communicationLog.create({
        data: {
          channel: 'whatsapp',
          eventType: dOverdue > 0 ? 'overdue' : 'invoice_due',
          recipient: customerName,
          recipientName: customerName,
          templateName: 'receivable_bulk_reminder_whatsapp',
          messagePreview: `Bulk reminder for invoice ${r.invoiceNumber} — balance ₹${r.balanceAmount}.`,
          status: 'sent',
          triggerSource: 'bulk_campaign',
          metadata: meta,
        },
      });
      sent += 1;
      totalAmount += r.balanceAmount;
      channels.whatsapp += 1;
    } catch {
      // best-effort; skip failures
    }
  }

  return { sent, totalAmount: round2(totalAmount), channels };
}

// ─── Collection recovery (DB-backed) ──────────────────────────────────────────

/**
 * Records a partial or full collection against an outstanding receivable:
 *   1. Reads the current Invoice row (totalAmount, paidAmount, buyerName).
 *   2. Computes the new paidAmount and derives the resulting paymentStatus
 *      ('paid' if balance cleared, else 'partial') and balanceAmount.
 *   3. Persists the update and returns the mapped receivable DTO so callers
 *      can read `customerName` / `status` for messaging.
 *
 * Throws Error('Receivable not found') if the invoice does not exist.
 */
export async function markCollected(
  id: string,
  amount: number,
): Promise<{
  id: string;
  customerName: string;
  status: string;
  paidAmount: number;
  balanceDue: number;
  totalAmount: number;
  [key: string]: unknown;
}> {
  const existing = await db.invoice.findUnique({ where: { id } });
  if (!existing) throw new Error('Receivable not found');

  const newPaidAmount = round2((existing.paidAmount ?? 0) + amount);
  const newBalance = round2(Math.max(0, existing.totalAmount - newPaidAmount));
  const newStatus = newBalance <= 0 ? 'paid' : 'partial';
  const newPaymentStatus = newBalance <= 0 ? 'paid' : 'partial';

  const updated = await db.invoice.update({
    where: { id },
    data: {
      paidAmount: newPaidAmount,
      balanceAmount: newBalance,
      paymentStatus: newPaymentStatus,
      paymentDate: newBalance <= 0 ? new Date().toISOString().slice(0, 10) : existing.paymentDate,
    },
  });

  const dOverdue = updated.dueDate ? daysOverdue(updated.dueDate) : 0;

  return {
    id: updated.id,
    invoiceId: updated.id,
    customerName: updated.buyerName ?? 'Unknown',
    invoiceNo: updated.invoiceNumber,
    invoiceDate: updated.invoiceDate,
    dueDate: updated.dueDate ?? null,
    totalAmount: round2(updated.totalAmount),
    paidAmount: round2(updated.paidAmount),
    balanceDue: round2(updated.balanceAmount),
    daysOverdue: dOverdue,
    status: newStatus,
  };
}
