// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Collections & Receivables Calculator
//
// Collection Rate = (Total Collected / Total Invoiced) * 100
// Receivables = Sum of outstanding invoice balances
// Payables = Sum of outstanding purchase bill balances
//
// This is the ONLY place where collections and receivables are calculated.
// ═══════════════════════════════════════════════════════════════════════════════

import type { InvoiceRow, PurchaseBillRow, PaymentRow } from './types';

export interface CollectionsResult {
  collectionRate: number;    // 0–100
  totalCollected: number;    // sum of invoice.paidAmount
  totalOutstanding: number;  // sum of invoice.balanceAmount
  totalOverdue: number;      // outstanding where due date has passed
  averageDaysToPay: number;  // average days from invoice to full payment
  invoiceCount: number;
}

export interface ReceivablesPayablesResult {
  receivables: number;       // outstanding invoice balances (money owed TO you)
  payables: number;          // outstanding purchase bill balances (money you owe)
  overdueReceivables: number;
  overduePayables: number;
}

/**
 * Calculates collection metrics from invoices and payments.
 *
 * Collection Rate = (Total Paid / Total Invoiced) * 100
 * Only counts non-draft, non-cancelled invoices.
 */
export function calculateCollections(
  invoices: InvoiceRow[],
  _payments: PaymentRow[],
): CollectionsResult {
  let totalInvoiced = 0;
  let totalCollected = 0;
  let totalOutstanding = 0;
  let totalOverdue = 0;
  let invoiceCount = 0;
  let paidInvoiceCount = 0;
  let totalDaysToPay = 0;
  const now = Date.now();

  for (const inv of invoices) {
    if (inv.status === 'draft' || inv.status === 'cancelled') continue;

    totalInvoiced += inv.totalAmount;
    totalCollected += inv.paidAmount;
    totalOutstanding += inv.balanceAmount;
    invoiceCount += 1;

    // Check overdue
    if (inv.balanceAmount > 0 && inv.dueDate) {
      const dueTime = new Date(inv.dueDate).getTime();
      if (!Number.isNaN(dueTime) && dueTime < now) {
        totalOverdue += inv.balanceAmount;
      }
    }

    // Calculate days to pay for fully paid invoices
    if (inv.paidAmount >= inv.totalAmount && inv.totalAmount > 0) {
      paidInvoiceCount += 1;
      const invDate = new Date(inv.invoiceDate).getTime();
      // Use the last update as payment date approximation
      const paidTime = inv.createdAt?.getTime?.() ?? now;
      if (!Number.isNaN(invDate)) {
        const days = Math.round((paidTime - invDate) / (1000 * 60 * 60 * 24));
        if (days >= 0) totalDaysToPay += days;
      }
    }
  }

  const collectionRate = totalInvoiced > 0
    ? round2((totalCollected / totalInvoiced) * 100)
    : 0;

  const averageDaysToPay = paidInvoiceCount > 0
    ? Math.round(totalDaysToPay / paidInvoiceCount)
    : 0;

  return {
    collectionRate,
    totalCollected: round2(totalCollected),
    totalOutstanding: round2(totalOutstanding),
    totalOverdue: round2(totalOverdue),
    averageDaysToPay,
    invoiceCount,
  };
}

/**
 * Calculates receivables (money owed to you) and payables (money you owe).
 */
export function calculateReceivablesPayables(
  invoices: InvoiceRow[],
  purchaseBills: PurchaseBillRow[],
): ReceivablesPayablesResult {
  let receivables = 0;
  let overdueReceivables = 0;
  let payables = 0;
  let overduePayables = 0;
  const now = Date.now();

  // Receivables from invoices
  for (const inv of invoices) {
    if (inv.status === 'draft' || inv.status === 'cancelled') continue;
    receivables += inv.balanceAmount;
    if (inv.balanceAmount > 0 && inv.dueDate) {
      const dueTime = new Date(inv.dueDate).getTime();
      if (!Number.isNaN(dueTime) && dueTime < now) {
        overdueReceivables += inv.balanceAmount;
      }
    }
  }

  // Payables from purchase bills
  for (const bill of purchaseBills) {
    if (bill.status === 'cancelled') continue;
    payables += bill.balanceAmount;
    if (bill.balanceAmount > 0 && bill.dueDate) {
      const dueTime = new Date(bill.dueDate).getTime();
      if (!Number.isNaN(dueTime) && dueTime < now) {
        overduePayables += bill.balanceAmount;
      }
    }
  }

  return {
    receivables: round2(receivables),
    payables: round2(payables),
    overdueReceivables: round2(overdueReceivables),
    overduePayables: round2(overduePayables),
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
