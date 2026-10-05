// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — GST Calculation Engine
//
// Pure functions for Indian GST computation. No I/O, no side effects.
// Used by the invoice service to derive every money field server-side
// (well, client-side but in one authoritative place) so the UI NEVER
// computes totals — it only passes line items in.
//
// Rules implemented:
//   • Per-line discount (%) applied BEFORE GST.
//   • Taxable value = quantity × unitPrice × (1 − discount/100).
//   • Intra-state sale (buyer state == seller state)  → CGST + SGST (half each).
//   • Inter-state sale (different states)             → IGST (full).
//   • Rounding: 2 decimal places (rupees), no paise rounding to whole rupees.
// ═══════════════════════════════════════════════════════════════════════════════

import type { GstRate } from './config';
import type {
  InvoiceLineItem,
  CreateInvoiceInput,
  Invoice,
  InvoiceStats,
  InvoiceStatus,
} from './types';

/** Round to 2 decimals — avoids floating-point drift. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Compute a single line item's derived money fields from its inputs.
 * Returns a full InvoiceLineItem with taxableValue / cgst / sgst / igst / amount.
 */
export function computeLineItem(
  input: Omit<InvoiceLineItem, 'taxableValue' | 'cgst' | 'sgst' | 'igst' | 'amount'>,
  isIntraState: boolean,
): InvoiceLineItem {
  const { quantity, unitPrice, discount, gstRate } = input;
  const gross = quantity * unitPrice;
  const discountAmount = gross * (Math.max(0, Math.min(100, discount || 0)) / 100);
  const taxableValue = round2(gross - discountAmount);

  const gstAmount = round2(taxableValue * (gstRate / 100));
  const cgst = isIntraState ? round2(gstAmount / 2) : 0;
  const sgst = isIntraState ? round2(gstAmount - cgst) : 0;
  const igst = isIntraState ? 0 : gstAmount;
  const amount = round2(taxableValue + cgst + sgst + igst);

  return {
    ...input,
    taxableValue,
    cgst,
    sgst,
    igst,
    amount,
  };
}

/**
 * Decide whether a sale is intra-state (CGST+SGST) or inter-state (IGST).
 * Intra-state when both state codes are present AND equal.
 */
export function isIntraStateSale(
  sellerStateCode: string | null,
  customerStateCode: string | null,
): boolean {
  if (!sellerStateCode || !customerStateCode) return false;
  return sellerStateCode === customerStateCode;
}

/**
 * Compute the full invoice totals from raw create input + seller/customer
 * state codes. Returns every derived field the invoice document stores.
 */
export function calculateInvoiceTotals(input: {
  items: CreateInvoiceInput['items'];
  sellerStateCode?: string | null;
  customerStateCode?: string | null;
  paidAmount?: number;
}): {
  items: InvoiceLineItem[];
  subtotal: number;
  discount: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  grandTotal: number;
  paidAmount: number;
  balanceDue: number;
  isIntraState: boolean;
} {
  const intra = isIntraStateSale(
    input.sellerStateCode ?? null,
    input.customerStateCode ?? null,
  );

  const computedItems = input.items.map((it) =>
    computeLineItem(it, intra),
  );

  const subtotal = round2(
    computedItems.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0),
  );
  const discount = round2(
    computedItems.reduce(
      (sum, it) =>
        sum + it.quantity * it.unitPrice * ((it.discount || 0) / 100),
      0,
    ),
  );
  const taxableValue = round2(
    computedItems.reduce((sum, it) => sum + it.taxableValue, 0),
  );
  const cgst = round2(computedItems.reduce((sum, it) => sum + it.cgst, 0));
  const sgst = round2(computedItems.reduce((sum, it) => sum + it.sgst, 0));
  const igst = round2(computedItems.reduce((sum, it) => sum + it.igst, 0));
  const totalTax = round2(cgst + sgst + igst);
  const grandTotal = round2(taxableValue + totalTax);
  const paidAmount = round2(Math.max(0, input.paidAmount ?? 0));
  const balanceDue = round2(grandTotal - paidAmount);

  return {
    items: computedItems,
    subtotal,
    discount,
    taxableValue,
    cgst,
    sgst,
    igst,
    totalTax,
    grandTotal,
    paidAmount,
    balanceDue,
    isIntraState: intra,
  };
}

/** Derive payment status from paid amount vs grand total. */
export function derivePaymentStatus(
  grandTotal: number,
  paidAmount: number,
): 'unpaid' | 'partial' | 'paid' {
  if (paidAmount <= 0) return 'unpaid';
  if (paidAmount >= grandTotal) return 'paid';
  return 'partial';
}

/** Derive invoice status from payment status + due date. */
export function deriveInvoiceStatus(
  paymentStatus: 'unpaid' | 'partial' | 'paid',
  dueDate: string | null,
  currentStatus: InvoiceStatus,
): InvoiceStatus {
  if (paymentStatus === 'paid') return 'paid';
  if (currentStatus === 'cancelled') return 'cancelled';
  if (currentStatus === 'draft') return 'draft';
  if (dueDate) {
    const due = new Date(dueDate);
    const now = new Date();
    if (!Number.isNaN(due.getTime()) && due.getTime() < now.getTime()) {
      return 'overdue';
    }
  }
  if (paymentStatus === 'partial') return 'partial';
  return currentStatus === 'draft' ? 'draft' : 'sent';
}

/** Aggregate a list of invoices into summary stats. */
export function computeInvoiceStats(invoices: Invoice[]): InvoiceStats {
  const stats: InvoiceStats = {
    count: invoices.length,
    totalInvoiced: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    totalTaxCollected: 0,
    byStatus: {
      draft: 0,
      sent: 0,
      paid: 0,
      partial: 0,
      overdue: 0,
      cancelled: 0,
    },
  };
  for (const inv of invoices) {
    if (inv.status === 'cancelled') {
      stats.byStatus.cancelled++;
      continue;
    }
    stats.totalInvoiced += inv.grandTotal;
    stats.totalPaid += inv.paidAmount;
    stats.totalOutstanding += inv.balanceDue;
    stats.totalTaxCollected += inv.totalTax;
    if (inv.status in stats.byStatus) {
      stats.byStatus[inv.status as InvoiceStatus]++;
    }
  }
  stats.totalInvoiced = round2(stats.totalInvoiced);
  stats.totalPaid = round2(stats.totalPaid);
  stats.totalOutstanding = round2(stats.totalOutstanding);
  stats.totalTaxCollected = round2(stats.totalTaxCollected);
  return stats;
}

/** Validate a GSTIN (15 chars, Indian format). Returns null if valid, error msg if not. */
export function validateGstin(gstin: string | null): string | null {
  if (!gstin) return null;
  const trimmed = gstin.trim().toUpperCase();
  if (trimmed.length !== 15) {
    return 'GSTIN must be exactly 15 characters.';
  }
  const re = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!re.test(trimmed)) {
    return 'GSTIN format is invalid.';
  }
  return null;
}

/** Sanitize a GST rate to the nearest allowed value. */
export function sanitizeGstRate(rate: number): GstRate {
  const allowed: readonly number[] = [0, 0.25, 3, 5, 12, 18, 28];
  const found = allowed.find((r) => r === rate);
  if (found !== undefined) return found as GstRate;
  // Snap to nearest allowed rate.
  let nearest = allowed[0];
  let minDiff = Math.abs(rate - nearest);
  for (const r of allowed) {
    const diff = Math.abs(rate - r);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = r;
    }
  }
  return nearest as GstRate;
}
