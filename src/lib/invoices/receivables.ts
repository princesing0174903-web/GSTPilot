// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Invoice Engine™ — Receivables Cloud™
// Aging buckets, collection forecasting, automated reminder scheduling.
// Pure TypeScript.
// ═══════════════════════════════════════════════════════════════════════════════

import type { AgingBucket, InvoiceCloudInvoice, ReceivablesSummary } from './types';
import { isOverdue, daysOverdue } from './invoices';

// ─── Aging buckets ────────────────────────────────────────────────────────────

export const AGING_BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: 'Current', min: 0, max: 0 },
  { label: '1-30', min: 1, max: 30 },
  { label: '31-60', min: 31, max: 60 },
  { label: '61-90', min: 61, max: 90 },
  { label: '90+', min: 91, max: 9999 },
];

/**
 * Buckets outstanding (non-paid) invoices by days overdue.
 * Invoices not yet overdue land in the "Current" bucket.
 */
export function computeAging(invoices: InvoiceCloudInvoice[], asOfDate?: string): AgingBucket[] {
  const asOf = asOfDate ? new Date(asOfDate).getTime() : Date.now();
  const buckets: AgingBucket[] = AGING_BUCKETS.map((b) => ({ ...b, count: 0, amount: 0 }));

  for (const inv of invoices) {
    if (inv.paymentStatus === 'paid' || inv.status === 'cancelled' || inv.status === 'draft') continue;
    if (inv.balanceAmount <= 0) continue;
    const dueTs = inv.dueDate ? new Date(inv.dueDate).getTime() : 0;
    const days = dueTs > 0 ? Math.max(0, Math.floor((asOf - dueTs) / (1000 * 60 * 60 * 24))) : 0;
    const bucket = buckets.find((b) => days >= b.min && days <= b.max) ?? buckets[0];
    bucket.count += 1;
    bucket.amount += inv.balanceAmount;
  }
  return buckets.map((b) => ({ ...b, amount: round2(b.amount) }));
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export function getReceivablesSummary(invoices: InvoiceCloudInvoice[]): ReceivablesSummary {
  let totalOutstanding = 0;
  let totalOverdue = 0;
  let totalBilled = 0;
  let totalPaid = 0;
  const payDurations: number[] = [];

  for (const inv of invoices) {
    totalBilled += inv.totalAmount;
    totalPaid += inv.paidAmount;
    if (inv.paymentStatus !== 'paid' && inv.status !== 'cancelled' && inv.status !== 'draft') {
      totalOutstanding += inv.balanceAmount;
      if (isOverdue(inv.dueDate ?? '', inv.paidAmount, inv.totalAmount)) {
        totalOverdue += inv.balanceAmount;
      }
    }
    if (inv.paymentStatus === 'paid' && inv.paymentDate && inv.dueDate) {
      const payTs = new Date(inv.paymentDate).getTime();
      const invTs = new Date(inv.invoiceDate).getTime();
      const diffDays = Math.max(0, Math.round((payTs - invTs) / (1000 * 60 * 60 * 24)));
      payDurations.push(diffDays);
    }
  }

  const avgDaysToPay = payDurations.length
    ? Math.round(payDurations.reduce((a, b) => a + b, 0) / payDurations.length)
    : 0;
  const collectionRate = totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 0;
  const forecast = totalOutstanding * 0.85; // conservative 85% collection assumption

  return {
    totalOutstanding: round2(totalOutstanding),
    totalOverdue: round2(totalOverdue),
    collectionRate: round2(collectionRate),
    avgDaysToPay,
    forecast: round2(forecast),
  };
}

// ─── Overdue detection ────────────────────────────────────────────────────────

export function detectOverdue(invoices: InvoiceCloudInvoice[]): InvoiceCloudInvoice[] {
  return invoices.filter(
    (i) => i.paymentStatus !== 'paid' && isOverdue(i.dueDate ?? '', i.paidAmount, i.totalAmount),
  );
}

// ─── Reminder scheduling ──────────────────────────────────────────────────────

export interface ReminderScheduleItem {
  invoiceId: string;
  invoiceNumber: string;
  daysOverdue: number;
  reminderType: 'gentle' | 'firm' | 'final';
  scheduledDate: string;
}

/**
 * Generates a reminder schedule for overdue invoices:
 *   1-7 days overdue  → gentle reminder (sent today)
 *   8-30 days overdue → firm reminder (sent today)
 *   31+ days overdue  → final notice (sent today)
 */
export function scheduleReminders(invoices: InvoiceCloudInvoice[]): ReminderScheduleItem[] {
  const today = new Date();
  const todayIso = today.toISOString().split('T')[0];
  const overdue = detectOverdue(invoices);
  return overdue.map((inv) => {
    const days = daysOverdue(inv.dueDate ?? '');
    let reminderType: ReminderScheduleItem['reminderType'] = 'gentle';
    if (days >= 31) reminderType = 'final';
    else if (days >= 8) reminderType = 'firm';
    return {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      daysOverdue: days,
      reminderType,
      scheduledDate: todayIso,
    };
  });
}

// ─── Collection forecast ──────────────────────────────────────────────────────

export interface CollectionForecast {
  nextWeek: number;
  nextMonth: number;
  nextQuarter: number;
}

/**
 * Projects likely collections by multiplying outstanding balances by the
 * historical collection rate. Time horizons are scaled by typical Indian B2B
 * payment cycles: next week = 20% of outstanding × rate, next month = 60%,
 * next quarter = 100%.
 */
export function forecastCollections(
  invoices: InvoiceCloudInvoice[],
  historicalCollectionRate: number,
): CollectionForecast {
  const outstanding = invoices
    .filter((i) => i.paymentStatus !== 'paid' && i.status !== 'cancelled' && i.status !== 'draft')
    .reduce((sum, i) => sum + i.balanceAmount, 0);

  const rate = Math.max(0, Math.min(1, historicalCollectionRate));
  return {
    nextWeek: round2(outstanding * 0.2 * rate),
    nextMonth: round2(outstanding * 0.6 * rate),
    nextQuarter: round2(outstanding * 1.0 * rate),
  };
}

/**
 * Collection rate = total paid / total billed (0-1 scale).
 */
export function collectionRate(invoices: InvoiceCloudInvoice[]): number {
  let billed = 0;
  let paid = 0;
  for (const inv of invoices) {
    billed += inv.totalAmount;
    paid += inv.paidAmount;
  }
  return billed > 0 ? round2(paid / billed) : 0;
}

// ─── helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
