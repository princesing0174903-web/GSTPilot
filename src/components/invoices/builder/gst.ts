// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Invoice Builder · Pure GST math + helpers
//
// All math is pure (no React, no side effects) so the components can memoize
// aggressively. The inter-state decision is the only thing that varies the
// output: when interState === true, IGST carries the full GST amount; when
// false, CGST + SGST split it 50/50.
// ═══════════════════════════════════════════════════════════════════════════════

import type { LineItem } from './types';

// ─── Numeric helpers ─────────────────────────────────────────────────────────

export const NUMBER = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const clampNonNeg = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

// ─── Date helpers ────────────────────────────────────────────────────────────

export const todayISO = (): string => new Date().toISOString().slice(0, 10);

export const addDaysISO = (iso: string, days: number): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return todayISO();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Generate a placeholder invoice number: INV-YYYY-#### */
export function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INV-${year}-${rand}`;
}

// ─── GSTIN helpers ───────────────────────────────────────────────────────────

/** Extract the 2-digit state code from a GSTIN (first 2 chars). Returns '' if
 *  the GSTIN is too short or starts with non-digits. */
export function stateCodeFromGstin(gstin: string | null | undefined): string {
  if (!gstin) return '';
  const m = /^(\d{2})/.exec(gstin.trim());
  return m ? m[1] : '';
}

/** Decide inter-state vs intra-state supply from seller + buyer GSTINs.
 *  Returns true if IGST applies (different states), false for CGST+SGST.
 *  Defaults to intra-state when either side is missing. */
export function isInterStateSupply(
  sellerGstin: string | null | undefined,
  buyerGstin: string | null | undefined,
): boolean {
  const sellerState = stateCodeFromGstin(sellerGstin);
  const buyerState = stateCodeFromGstin(buyerGstin);
  if (!sellerState || !buyerState) return false;
  return sellerState !== buyerState;
}

// ─── Line-item math ──────────────────────────────────────────────────────────

/** Compute per-line GST math. Pure function — no side effects. */
export function computeLineItem(
  item: Pick<
    LineItem,
    'quantity' | 'unitPrice' | 'discountPct' | 'gstRate' | 'cessRate'
  >,
  interState: boolean,
): { taxableValue: number; cgst: number; sgst: number; igst: number; cess: number; total: number } {
  const qty = clampNonNeg(NUMBER(item.quantity));
  const rate = clampNonNeg(NUMBER(item.unitPrice));
  const disc = clampNonNeg(NUMBER(item.discountPct));
  const gstPct = clampNonNeg(NUMBER(item.gstRate));
  const cessPct = clampNonNeg(NUMBER(item.cessRate));

  const taxableValue = round2(qty * rate * (1 - disc / 100));
  const gstAmount = round2((taxableValue * gstPct) / 100);
  const cess = round2((taxableValue * cessPct) / 100);

  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  if (interState) {
    igst = gstAmount;
  } else {
    cgst = round2(gstAmount / 2);
    sgst = round2(gstAmount - cgst);
  }
  const total = round2(taxableValue + cgst + sgst + igst + cess);
  return { taxableValue, cgst, sgst, igst, cess, total };
}

/** Aggregate all line items into invoice-level totals. */
export function computeTotals(
  items: Array<Pick<LineItem, 'taxableValue' | 'cgst' | 'sgst' | 'igst' | 'cess' | 'total'>>,
): {
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  roundOff: number;
  total: number;
} {
  let subtotal = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let cess = 0;
  for (const it of items) {
    subtotal += NUMBER(it.taxableValue);
    cgst += NUMBER(it.cgst);
    sgst += NUMBER(it.sgst);
    igst += NUMBER(it.igst);
    cess += NUMBER(it.cess);
  }
  subtotal = round2(subtotal);
  cgst = round2(cgst);
  sgst = round2(sgst);
  igst = round2(igst);
  cess = round2(cess);
  const exactTotal = subtotal + cgst + sgst + igst + cess;
  const total = Math.round(exactTotal);
  const roundOff = round2(total - exactTotal);
  return { subtotal, cgst, sgst, igst, cess, roundOff, total };
}

// ─── Line-item factory ───────────────────────────────────────────────────────

let __lineKeyCounter = 0;

export function makeEmptyLineItem(): LineItem {
  __lineKeyCounter += 1;
  return {
    key: `line-${Date.now().toString(36)}-${__lineKeyCounter}`,
    description: '',
    hsnCode: '',
    quantity: 1,
    unit: 'NOS',
    unitPrice: 0,
    discountPct: 0,
    gstRate: 18,
    cessRate: 0,
    taxableValue: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    cess: 0,
    total: 0,
  };
}

/** Mint a fresh unique key (used by duplicate). */
export function nextLineKey(): string {
  __lineKeyCounter += 1;
  return `line-${Date.now().toString(36)}-${__lineKeyCounter}`;
}

/** Derive a LineItem from an existing invoice line (for Edit mode). */
export function lineItemFromApiItem(
  it: {
    description?: string | null;
    hsnCode?: string | null;
    quantity?: number;
    unit?: string | null;
    unitPrice?: number;
    taxableValue?: number;
    cgstRate?: number;
    sgstRate?: number;
    igstRate?: number;
    cessRate?: number;
    cgst?: number;
    sgst?: number;
    igst?: number;
    cess?: number;
    totalAmount?: number;
  },
  interState: boolean,
): LineItem {
  __lineKeyCounter += 1;
  // FIX (B5): gstRate is the GST slab (CGST+SGST or IGST) — it must NOT
  // include cessRate. Previously this summed all four rates, which caused
  // CESS to be double-counted when the line was re-computed by
  // computeLineItem (cess was baked into gstRate AND applied via cessRate).
  const gstRate = NUMBER(it.cgstRate) + NUMBER(it.sgstRate) + NUMBER(it.igstRate);
  const base: LineItem = {
    key: `line-${Date.now().toString(36)}-${__lineKeyCounter}`,
    description: it.description ?? '',
    hsnCode: it.hsnCode ?? '',
    quantity: NUMBER(it.quantity) || 1,
    unit: (it.unit as LineItem['unit']) || 'NOS',
    unitPrice: NUMBER(it.unitPrice),
    discountPct: 0,
    gstRate,
    cessRate: NUMBER(it.cessRate),
    taxableValue: NUMBER(it.taxableValue),
    cgst: NUMBER(it.cgst),
    sgst: NUMBER(it.sgst),
    igst: NUMBER(it.igst),
    cess: NUMBER(it.cess),
    total: NUMBER(it.totalAmount),
  };
  const c = computeLineItem(base, interState);
  return { ...base, ...c };
}

// ─── Misc UI helpers ─────────────────────────────────────────────────────────

/** Risk pill color logic from a numeric health score (0-100). */
export function healthTone(score: number): { label: string; className: string } {
  if (score >= 80) return { label: 'Healthy', className: 'bg-blue-500/15 text-blue-300 border-blue-500/30' };
  if (score >= 60) return { label: 'Fair', className: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
  if (score >= 40) return { label: 'Watch', className: 'bg-orange-500/15 text-orange-300 border-orange-500/30' };
  return { label: 'Risk', className: 'bg-red-500/15 text-red-300 border-red-500/30' };
}

/** Format an ISO date (yyyy-mm-dd) as e.g. "12 Aug 2025". */
export function formatHumanDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
