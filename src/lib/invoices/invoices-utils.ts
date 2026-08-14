// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Invoice Engine™ — Sales Invoice Cloud™ (Prisma-free utils)
// ═══════════════════════════════════════════════════════════════════════════════
// Pure utility functions extracted out of `./invoices` so client components
// (InvoiceCloudPage) can render UI without dragging Prisma into their bundle.
// The Prisma-backed queries (getInvoices, getInvoice, createInvoice,
// generatePaymentLink, generatePdf, sendInvoice) live in `./invoices`
// (server-only) and re-export the pure functions from here.
//
// ZERO imports from `@/lib/db` or `@prisma/client`. Pure TypeScript only.
// ═══════════════════════════════════════════════════════════════════════════════

import type { InvoiceCloudInvoice, InvoiceStatus, PaymentStatus } from './types';

// ─── Numbering ─────────────────────────────────────────────────────────────────

/**
 * Generates the next invoice number in the "INV-YYYY-NNN" sequence by parsing
 * the highest existing numeric suffix and incrementing it. Year is current FY.
 */
export function generateInvoiceNumber(existing: string[], prefix = 'INV'): string {
  const year = new Date().getFullYear();
  const fyPrefix = `${prefix}-${year}-`;
  let maxSeq = 0;
  for (const num of existing) {
    if (!num || !num.startsWith(fyPrefix)) continue;
    const tail = num.slice(fyPrefix.length);
    const n = parseInt(tail, 10);
    if (!Number.isNaN(n) && n > maxSeq) maxSeq = n;
  }
  const next = maxSeq + 1;
  return `${fyPrefix}${String(next).padStart(3, '0')}`;
}

// ─── Totals & GST ──────────────────────────────────────────────────────────────

export interface InvoiceLineItem {
  taxableValue: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cessRate?: number;
}

export interface InvoiceTotals {
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  gstAmount: number;
  totalAmount: number;
}

/**
 * Aggregates a list of line items into GST-split totals. Either CGST+SGST
 * (intra-state) or IGST (inter-state) is populated depending on the rates set
 * per line. CESS is computed when cessRate > 0.
 *
 * The optional second argument is the raw API line items (with discount +
 * cessRate) — when supplied, we recompute per-line cess from the gross taxable
 * value so the totals match exactly what's persisted to InvoiceItem rows.
 */
export function calculateInvoiceTotals(
  items: InvoiceLineItem[],
  rawItems?: Array<{ discount?: number; cessRate?: number; quantity?: number; unitPrice?: number }>,
): InvoiceTotals {
  let taxableValue = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let cess = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    taxableValue += it.taxableValue;
    cgst += (it.taxableValue * it.cgstRate) / 100;
    sgst += (it.taxableValue * it.sgstRate) / 100;
    igst += (it.taxableValue * it.igstRate) / 100;
    const cessRate = it.cessRate ?? rawItems?.[i]?.cessRate ?? 0;
    cess += (it.taxableValue * Number(cessRate) || 0) / 100;
  }
  const gstAmount = round2(cgst + sgst + igst);
  const cessRound = round2(cess);
  return {
    taxableValue: round2(taxableValue),
    cgst: round2(cgst),
    sgst: round2(sgst),
    igst: round2(igst),
    cess: cessRound,
    gstAmount,
    totalAmount: round2(taxableValue + gstAmount + cessRound),
  };
}

export function computeBalance(paidAmount: number, totalAmount: number): number {
  return round2(Math.max(0, totalAmount - paidAmount));
}

// ─── Status derivation ─────────────────────────────────────────────────────────

export function derivePaymentStatus(
  paidAmount: number,
  totalAmount: number,
  dueDate?: string,
): PaymentStatus {
  if (paidAmount >= totalAmount && totalAmount > 0) return 'paid';
  if (dueDate && isOverdue(dueDate, paidAmount, totalAmount)) return 'overdue';
  if (paidAmount > 0) return 'partial';
  return 'unpaid';
}

export function isOverdue(dueDate: string, paidAmount: number, totalAmount: number): boolean {
  if (paidAmount >= totalAmount) return false;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < Date.now();
}

export function daysOverdue(dueDate: string): number {
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return 0;
  const diff = Date.now() - due.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return days > 0 ? days : 0;
}

export function daysToDue(dueDate: string): number {
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return 0;
  const diff = due.getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days;
}

// ─── Indian currency formatting ────────────────────────────────────────────────

/**
 * Formats an amount in Indian numbering with the ₹ symbol — e.g. 123456 → "₹1,23,456".
 */
export function formatInvoiceCurrency(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);
  const formatted = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(abs);
  return `${sign}₹${formatted}`;
}

// ─── Stats & filters ───────────────────────────────────────────────────────────

export interface InvoiceStatsResult {
  total: number;
  paid: number;
  outstanding: number;
  overdue: number;
  draftCount: number;
}

export function getInvoiceStats(invoices: InvoiceCloudInvoice[]): InvoiceStatsResult {
  let total = 0;
  let paid = 0;
  let outstanding = 0;
  let overdue = 0;
  let draftCount = 0;
  for (const inv of invoices) {
    total += inv.totalAmount;
    if (inv.status === 'draft') draftCount += 1;
    if (inv.paymentStatus === 'paid') paid += inv.paidAmount;
    if (inv.paymentStatus !== 'paid' && inv.status !== 'cancelled' && inv.status !== 'draft') {
      outstanding += inv.balanceAmount;
    }
    if (inv.paymentStatus === 'overdue' || isOverdue(inv.dueDate ?? '', inv.paidAmount, inv.totalAmount)) {
      overdue += inv.balanceAmount;
    }
  }
  return {
    total: round2(total),
    paid: round2(paid),
    outstanding: round2(outstanding),
    overdue: round2(overdue),
    draftCount,
  };
}

export function filterInvoicesByStatus(
  invoices: InvoiceCloudInvoice[],
  status: InvoiceStatus,
): InvoiceCloudInvoice[] {
  return invoices.filter((i) => i.status === status);
}

export function sortInvoicesByDate(
  invoices: InvoiceCloudInvoice[],
  dir: 'asc' | 'desc' = 'desc',
): InvoiceCloudInvoice[] {
  const sorted = [...invoices].sort((a, b) => {
    const da = new Date(a.invoiceDate).getTime();
    const db = new Date(b.invoiceDate).getTime();
    return dir === 'asc' ? da - db : db - da;
  });
  return sorted;
}

// ─── Seed placeholder (no-op) ─────────────────────────────────────────────────
// Previously this module shipped 12 hardcoded sales invoices attributed to
// fake Indian enterprise buyers. The export name is preserved so existing
// callers continue to compile, but it now returns `[]` so the UI renders a
// proper empty state. Real invoices come from `db.invoice.findMany()` via
// the API routes.

export function seedInvoices(): InvoiceCloudInvoice[] {
  return [];
}

// ─── helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
