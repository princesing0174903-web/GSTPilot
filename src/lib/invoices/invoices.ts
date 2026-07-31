// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Invoice Engine™ — Sales Invoice Cloud™
// Create, Number, Total, Track, Collect. Pure TypeScript, no Prisma, no Next.
// ═══════════════════════════════════════════════════════════════════════════════

import type { InvoiceCloudInvoice, InvoiceStatus, PaymentStatus, InvoiceDTO, InvoiceListResult, CreateInvoiceInput, SendChannel } from './types';
import { db } from '@/lib/db';

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

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

// ─── DB-backed list query ──────────────────────────────────────────────────────

/** Fetches sales invoices from Prisma and maps them to the InvoiceDTO shape. */
export async function getInvoices(opts?: { limit?: number }): Promise<InvoiceListResult> {
  const rows = await db.invoice.findMany({
    take: opts?.limit ?? 500,
    orderBy: { createdAt: 'desc' },
  });
  const invoices: InvoiceDTO[] = rows.map((r) => ({
    id: r.id,
    clientId: r.clientId,
    invoiceNo: r.invoiceNumber,
    clientName: r.buyerName ?? 'Unknown',
    invoiceDate: r.invoiceDate,
    dueDate: r.dueDate,
    taxableValue: r.taxableValue,
    cgst: r.cgst,
    sgst: r.sgst,
    igst: r.igst,
    cess: r.cess,
    gstAmount: r.gstAmount,
    total: r.totalAmount,
    paidAmount: r.paidAmount,
    balanceDue: r.balanceAmount,
    status: r.status,
    paymentStatus: r.paymentStatus,
    paymentMode: r.paymentMode,
    recurring: r.recurring,
  }));
  const totalRevenue = sum(invoices.map((i) => i.total));
  const totalPaid = sum(invoices.map((i) => i.paidAmount));
  const totalOutstanding = sum(invoices.map((i) => i.balanceDue));
  const totalOverdue = sum(
    invoices.filter((i) => i.paymentStatus === 'overdue').map((i) => i.balanceDue),
  );
  return {
    invoices,
    total: invoices.length,
    totalRevenue: round2(totalRevenue),
    totalPaid: round2(totalPaid),
    totalOutstanding: round2(totalOutstanding),
    totalOverdue: round2(totalOverdue),
    hasLiveData: invoices.length > 0,
  };
}

/** Fetches a single invoice by ID from Prisma and maps it to InvoiceDTO. */
export async function getInvoice(id: string): Promise<InvoiceDTO | null> {
  const r = await db.invoice.findUnique({ where: { id } });
  if (!r) return null;
  return {
    id: r.id,
    clientId: r.clientId,
    invoiceNo: r.invoiceNumber,
    clientName: r.buyerName ?? 'Unknown',
    invoiceDate: r.invoiceDate,
    dueDate: r.dueDate,
    taxableValue: r.taxableValue,
    cgst: r.cgst,
    sgst: r.sgst,
    igst: r.igst,
    cess: r.cess,
    gstAmount: r.gstAmount,
    total: r.totalAmount,
    paidAmount: r.paidAmount,
    balanceDue: r.balanceAmount,
    status: r.status,
    paymentStatus: r.paymentStatus,
    paymentMode: r.paymentMode,
    recurring: r.recurring,
  };
}

// ─── Invoice creation + actions ────────────────────────────────────────────────

/** Maps a Prisma invoice row to the InvoiceDTO shape. */
function mapInvoice(r: {
  id: string; clientId: string; invoiceNumber: string; buyerName: string | null;
  invoiceDate: string; dueDate: string | null; taxableValue: number;
  cgst: number; sgst: number; igst: number; cess: number; gstAmount: number;
  totalAmount: number; paidAmount: number; balanceAmount: number;
  status: string; paymentStatus: string; paymentMode: string | null;
  recurring: boolean;
}): InvoiceDTO {
  return {
    id: r.id,
    clientId: r.clientId,
    invoiceNo: r.invoiceNumber,
    clientName: r.buyerName ?? 'Unknown',
    invoiceDate: r.invoiceDate,
    dueDate: r.dueDate,
    taxableValue: r.taxableValue,
    cgst: r.cgst,
    sgst: r.sgst,
    igst: r.igst,
    cess: r.cess,
    gstAmount: r.gstAmount,
    total: r.totalAmount,
    paidAmount: r.paidAmount,
    balanceDue: r.balanceAmount,
    status: r.status,
    paymentStatus: r.paymentStatus,
    paymentMode: r.paymentMode,
    recurring: r.recurring,
  };
}

/** Creates a sales invoice in Prisma from line items and returns the DTO. */
export async function createInvoice(input: CreateInvoiceInput): Promise<InvoiceDTO> {
  // Look up client for buyer details
  const client = await db.client.findUnique({ where: { id: input.clientId } });

  // Generate invoice number
  const existing = await db.invoice.findMany({
    where: { invoiceNumber: { startsWith: `INV-${new Date().getFullYear()}-` } },
    select: { invoiceNumber: true },
  });
  const invoiceNo = generateInvoiceNumber(existing.map((i) => i.invoiceNumber));

  // Calculate totals from line items (FIX 7: also persist per-line rows below).
  const items = input.items.map((it) => ({
    taxableValue: it.taxableValue,
    cgstRate: it.cgstRate ?? 0,
    sgstRate: it.sgstRate ?? 0,
    igstRate: it.igstRate ?? 0,
    cessRate: it.cessRate ?? 0,
  }));
  const totals = calculateInvoiceTotals(items, input.items);
  const today = input.invoiceDate ?? new Date().toISOString().slice(0, 10);

  // FIX 7: build InvoiceItem rows so descriptions, HSN codes, qty, unit price
  // are persisted — not just the aggregate totals on the Invoice header.
  const itemsCreate = input.items.map((it, idx) => {
    const taxable = Number(it.taxableValue) || 0;
    const cgstR = Number(it.cgstRate) ?? 0;
    const sgstR = Number(it.sgstRate) ?? 0;
    const igstR = Number(it.igstRate) ?? 0;
    const cessR = Number(it.cessRate) ?? 0;
    return {
      lineNumber: idx + 1,
      description: it.description ?? null,
      hsnCode: it.hsnCode ?? null,
      quantity: it.quantity ?? 1,
      unit: it.unit ?? 'NOS',
      unitPrice: it.unitPrice ?? 0,
      taxableValue: taxable,
      cgstRate: cgstR,
      sgstRate: sgstR,
      igstRate: igstR,
      cessRate: cessR,
      cgst: round2(taxable * cgstR / 100),
      sgst: round2(taxable * sgstR / 100),
      igst: round2(taxable * igstR / 100),
      cess: round2(taxable * cessR / 100),
      totalAmount: round2(taxable + taxable * (cgstR + sgstR + igstR + cessR) / 100),
    };
  });

  const created = await db.invoice.create({
    data: {
      clientId: input.clientId,
      invoiceNumber: invoiceNo,
      invoiceDate: today,
      sellerGstin: input.sellerGstin ?? '',
      buyerGstin: input.buyerGstin ?? client?.gstin ?? null,
      buyerName: input.buyerName ?? client?.tradeName ?? 'Unknown',
      invoiceType: input.invoiceType ?? 'B2B',
      taxableValue: totals.taxableValue,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      // FIX 7: capture cess from totals (was hardcoded 0).
      cess: totals.cess,
      gstAmount: totals.gstAmount,
      totalAmount: totals.totalAmount,
      status: 'draft',
      paymentStatus: 'unpaid',
      balanceAmount: totals.totalAmount,
      dueDate: input.dueDate ?? null,
      notes: input.notes ?? null,
      recurring: input.recurring ?? false,
      recurringCycle: input.recurringCycle ?? null,
      items: { create: itemsCreate },
    },
    include: { items: true },
  });

  return mapInvoice(created);
}

/** Generates a PDF + UPI payment link for an invoice. */
export async function generatePaymentLink(id: string): Promise<{
  invoice: InvoiceDTO;
  pdfUrl: string;
  paymentLink: string;
}> {
  const r = await db.invoice.findUnique({ where: { id } });
  if (!r) throw new Error('Invoice not found');
  // Mark as sent
  const updated = await db.invoice.update({
    where: { id },
    data: {
      sentToCustomer: true,
      sentAt: new Date().toISOString(),
      status: r.status === 'draft' ? 'sent' : r.status,
    },
  });
  const invoice = mapInvoice(updated);
  // Deterministic payment link (UPI deep link with invoice number as reference)
  const upiId = 'business@upi';
  const paymentLink = `upi://pay?pa=${upiId}&pn=Business&tr=${invoice.invoiceNo}&am=${invoice.total}&cu=INR`;
  const pdfUrl = `/api/invoices/${id}/pdf`;
  return { invoice, pdfUrl, paymentLink };
}

/** Generates a PDF for an invoice (returns the URL). */
export async function generatePdf(id: string): Promise<{
  invoice: InvoiceDTO;
  pdfUrl: string;
  paymentLink: string;
}> {
  return generatePaymentLink(id);
}

/** Sends an invoice via the specified channel (email/whatsapp/sms). */
export async function sendInvoice(id: string, channel: SendChannel): Promise<InvoiceDTO> {
  const r = await db.invoice.findUnique({ where: { id } });
  if (!r) throw new Error('Invoice not found');
  const updated = await db.invoice.update({
    where: { id },
    data: {
      sentToCustomer: true,
      sentAt: new Date().toISOString(),
      status: r.status === 'draft' ? 'sent' : r.status,
    },
  });
  // In production this would dispatch an email/WhatsApp/SMS via the
  // communication service. Here we just mark it sent and return.
  void channel;
  return mapInvoice(updated);
}
