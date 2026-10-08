// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Real Invoice Engine™ — Calculations & Numbering
//
// Pure functions — no Firestore, no side-effects. The service layer calls
// these to derive every money field. The UI NEVER computes totals.
//
// Indian GST rules:
//   • Intra-state (same state): CGST + SGST, each = gstRate / 2
//   • Inter-state (different state): IGST = gstRate
//   • Round-off adjusts the grand total to the nearest rupee
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  Invoice,
  InvoiceLineItem,
  InvoiceStatus,
  InvoiceTotals,
  PaymentStatus,
  InvoiceStats,
} from './types';

// ─── Rounding helpers ────────────────────────────────────────────────────────

/** Round to 2 decimal places (handles floating-point drift). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ─── Line-item computation ───────────────────────────────────────────────────

/**
 * Compute a single line item's tax fields from the raw inputs.
 * Returns a fully-populated InvoiceLineItem ready for storage.
 */
export function computeLineItem(
  input: {
    id?: string;
    description: string;
    hsnSac: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    discount?: number;
    gstRate: number;
  },
  isInterState: boolean,
): InvoiceLineItem {
  const qty = Math.max(0, Number(input.quantity) || 0);
  const price = Math.max(0, Number(input.unitPrice) || 0);
  const discount = Math.max(0, Number(input.discount) || 0);
  const rate = Math.max(0, Number(input.gstRate) || 0);

  const taxableValue = round2(qty * price - discount);

  const cgstRate = isInterState ? 0 : rate / 2;
  const sgstRate = isInterState ? 0 : rate / 2;
  const igstRate = isInterState ? rate : 0;

  const cgst = round2((taxableValue * cgstRate) / 100);
  const sgst = round2((taxableValue * sgstRate) / 100);
  const igst = round2((taxableValue * igstRate) / 100);
  const amount = round2(taxableValue + cgst + sgst + igst);

  return {
    id: input.id || generateLineItemId(),
    description: input.description,
    hsnSac: input.hsnSac,
    quantity: qty,
    unit: input.unit,
    unitPrice: round2(price),
    discount: round2(discount),
    gstRate: rate,
    taxableValue,
    cgst,
    sgst,
    igst,
    amount,
  };
}

/**
 * Aggregate all line items into invoice-level totals.
 *
 * subtotal      = Σ (qty × unitPrice)          [before discount]
 * discount      = Σ line.discount
 * taxableValue  = Σ line.taxableValue          [after discount]
 * cgst/sgst/igst= Σ line.cgst / sgst / igst
 * cess          = caller-supplied (0 by default)
 * roundOff      = rounded(grandTotalRaw) − grandTotalRaw
 * grandTotal    = taxableValue + cgst + sgst + igst + cess + roundOff
 */
export function calculateInvoiceTotals(
  items: InvoiceLineItem[],
  cess: number = 0,
): InvoiceTotals {
  let subtotal = 0;
  let discount = 0;
  let taxableValue = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  for (const it of items) {
    subtotal += it.quantity * it.unitPrice;
    discount += it.discount;
    taxableValue += it.taxableValue;
    cgst += it.cgst;
    sgst += it.sgst;
    igst += it.igst;
  }

  const cessRounded = round2(cess);
  const grandTotalRaw = round2(taxableValue + cgst + sgst + igst + cessRounded);
  const grandTotalRounded = Math.round(grandTotalRaw); // nearest rupee
  const roundOff = round2(grandTotalRounded - grandTotalRaw);

  return {
    subtotal: round2(subtotal),
    discount: round2(discount),
    taxableValue: round2(taxableValue),
    cgst: round2(cgst),
    sgst: round2(sgst),
    igst: round2(igst),
    cess: cessRounded,
    roundOff,
    grandTotal: grandTotalRounded,
  };
}

// ─── Balance & payment-status derivation ─────────────────────────────────────

/** Balance due = max(0, grandTotal − paidAmount). */
export function computeBalanceDue(
  grandTotal: number,
  paidAmount: number,
): number {
  return round2(Math.max(0, grandTotal - Math.max(0, paidAmount)));
}

/**
 * Derive the payment status from money + dates.
 *
 *   cancelled  → 'cancelled'
 *   paidAmount ≥ grandTotal (>0) → 'paid'
 *   dueDate < today && balance > 0 → 'overdue'
 *   paidAmount > 0 → 'partial'
 *   otherwise → 'unpaid'
 */
export function derivePaymentStatus(
  status: InvoiceStatus,
  grandTotal: number,
  paidAmount: number,
  dueDate: string,
): PaymentStatus {
  if (status === 'cancelled') return 'cancelled';
  if (grandTotal > 0 && paidAmount >= grandTotal) return 'paid';
  if (isOverdue(dueDate, paidAmount, grandTotal)) return 'overdue';
  if (paidAmount > 0) return 'partial';
  return 'unpaid';
}

/**
 * Derive the lifecycle status from payment state.
 * Called after markInvoicePaid / cancelInvoice / when dueDate passes.
 */
export function deriveInvoiceStatus(
  currentStatus: InvoiceStatus,
  paymentStatus: PaymentStatus,
): InvoiceStatus {
  if (currentStatus === 'cancelled') return 'cancelled';
  if (paymentStatus === 'paid') return 'paid';
  if (paymentStatus === 'partial') return 'partially_paid';
  if (paymentStatus === 'overdue') return 'overdue';
  // unpaid — keep the current status (draft or sent) unless it's already paid/partial
  if (currentStatus === 'paid' || currentStatus === 'partially_paid') {
    return 'sent';
  }
  return currentStatus;
}

/** True when the due date has passed and the invoice isn't fully paid. */
export function isOverdue(
  dueDate: string,
  paidAmount: number,
  grandTotal: number,
): boolean {
  if (paidAmount >= grandTotal) return false;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

/** Days between today and the due date (negative = overdue). */
export function daysToDue(dueDate: string): number {
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** Days past the due date (0 if not overdue). */
export function daysOverdue(dueDate: string): number {
  const d = daysToDue(dueDate);
  return d < 0 ? Math.abs(d) : 0;
}

// ─── Invoice number generator ────────────────────────────────────────────────

/**
 * Generate the next invoice number in the `INV-YYYY-NNNNNN` sequence.
 *
 * Format: INV-2026-000001
 * Rules:
 *   • Sequential — parses the highest existing suffix and increments by 1
 *   • Organization-specific — the caller passes only this org's numbers
 *   • Never duplicates — the service layer uses a Firestore transaction to
 *     guarantee atomicity, so concurrent creates never collide
 *
 * The sequence resets to 000001 when the year rolls over.
 */
export function generateInvoiceNumber(
  existing: string[],
  prefix: string = 'INV',
  padLength: number = 6,
): string {
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
  return `${fyPrefix}${String(next).padStart(padLength, '0')}`;
}

// ─── Stats aggregation ───────────────────────────────────────────────────────

/**
 * Compute aggregate stats from a list of invoices.
 * Used by the dashboard and reports pages.
 *
 *   totalRevenue      = Σ grandTotal (excludes draft + cancelled)
 *   totalCollected    = Σ paidAmount (excludes cancelled)
 *   totalOutstanding  = Σ balanceDue (excludes draft + cancelled)
 *   totalOverdue      = Σ balanceDue where paymentStatus === 'overdue'
 *   totalTaxCollected = Σ (cgst + sgst + igst + cess) (excludes draft + cancelled)
 */
export function computeInvoiceStats(invoices: Invoice[]): InvoiceStats {
  const byStatus: Record<InvoiceStatus, number> = {
    draft: 0,
    sent: 0,
    partially_paid: 0,
    paid: 0,
    overdue: 0,
    cancelled: 0,
  };
  const byPaymentStatus: Record<PaymentStatus, number> = {
    unpaid: 0,
    partial: 0,
    paid: 0,
    overdue: 0,
    cancelled: 0,
  };

  let totalRevenue = 0;
  let totalCollected = 0;
  let totalOutstanding = 0;
  let totalOverdue = 0;
  let totalTaxCollected = 0;

  for (const inv of invoices) {
    byStatus[inv.status] = (byStatus[inv.status] || 0) + 1;
    byPaymentStatus[inv.paymentStatus] = (byPaymentStatus[inv.paymentStatus] || 0) + 1;

    if (inv.status === 'cancelled') continue;

    if (inv.status !== 'draft') {
      totalRevenue += inv.grandTotal;
      totalTaxCollected += inv.cgst + inv.sgst + inv.igst + inv.cess;
    }

    totalCollected += inv.paidAmount;

    if (inv.status !== 'draft') {
      totalOutstanding += inv.balanceDue;
    }

    if (inv.paymentStatus === 'overdue') {
      totalOverdue += inv.balanceDue;
    }
  }

  return {
    count: invoices.length,
    totalRevenue: round2(totalRevenue),
    totalCollected: round2(totalCollected),
    totalOutstanding: round2(totalOutstanding),
    totalOverdue: round2(totalOverdue),
    totalTaxCollected: round2(totalTaxCollected),
    byStatus,
    byPaymentStatus,
  };
}

// ─── Currency formatting (Indian numbering system) ───────────────────────────

/**
 * Format an amount in Indian numbering with the ₹ symbol.
 * e.g. 123456 → "₹1,23,456"
 */
export function formatInvoiceCurrency(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(abs);
  return `${sign}₹${formatted}`;
}

/** Format with 2 decimal places — used in PDFs and detailed tables. */
export function formatInvoiceCurrencyDetailed(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return `${sign}₹${formatted}`;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

let lineItemCounter = 0;

/** Generate a stable-ish id for line items (unique within a session). */
function generateLineItemId(): string {
  lineItemCounter += 1;
  return `li_${Date.now().toString(36)}_${lineItemCounter.toString(36)}`;
}
