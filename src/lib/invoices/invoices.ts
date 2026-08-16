// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Invoice Engine™ — Sales Invoice Cloud™
// Create, Number, Total, Track, Collect. Prisma-backed server module.
// ═══════════════════════════════════════════════════════════════════════════════

import type { InvoiceDTO, InvoiceListResult, CreateInvoiceInput, SendChannel } from './types';
import { db } from '@/lib/db';
import { generateInvoiceNumber, calculateInvoiceTotals } from './invoices-utils';

// Pure utilities (Prisma-free) — re-exported so existing server-side callers
// keep compiling. Client components MUST import directly from `./invoices-utils`
// to avoid dragging Prisma into their bundle.
export {
  generateInvoiceNumber,
  calculateInvoiceTotals,
  computeBalance,
  derivePaymentStatus,
  isOverdue,
  daysOverdue,
  daysToDue,
  formatInvoiceCurrency,
  getInvoiceStats,
  filterInvoicesByStatus,
  sortInvoicesByDate,
  seedInvoices,
  type InvoiceLineItem,
  type InvoiceTotals,
  type InvoiceStatsResult,
} from './invoices-utils';

// ─── DB-backed list query ──────────────────────────────────────────────────────

/** Fetches sales invoices from Prisma and maps them to the InvoiceDTO shape.
 *
 * SECURITY: `firmId` is REQUIRED. When omitted, returns an empty result rather
 * than leaking every invoice across every tenant platform-wide. The caller
 * (an API route) is responsible for resolving the org scope via
 * `requireOrgMembership` before invoking this function. */
export async function getInvoices(opts?: { limit?: number; firmId?: string }): Promise<InvoiceListResult> {
  // No org scope → no data. Prevents cross-tenant leakage.
  if (!opts?.firmId) {
    return {
      invoices: [],
      total: 0,
      totalRevenue: 0,
      totalPaid: 0,
      totalOutstanding: 0,
      totalOverdue: 0,
      hasLiveData: false,
    };
  }
  const rows = await db.invoice.findMany({
    where: { client: { firmId: opts.firmId } },
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

/** Fetches a single invoice by ID from Prisma and maps it to InvoiceDTO.
 *
 * SECURITY: when `firmId` is supplied, the invoice is only returned if its
 * client.firmId matches — otherwise null (treated as "not found" so the
 * caller can return a 404 without revealing the invoice's existence). */
export async function getInvoice(id: string, firmId?: string): Promise<InvoiceDTO | null> {
  const r = await db.invoice.findUnique({
    where: { id },
    include: firmId ? { client: { select: { firmId: true } } } : undefined,
  });
  if (!r) return null;
  // Org scope check — prevents cross-tenant reads via this engine function.
  if (firmId && ('client' in r) && r.client && r.client.firmId !== firmId) return null;
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
  // Look up client for buyer details + firmId (for org-scoped invoice numbering)
  const client = await db.client.findUnique({ where: { id: input.clientId } });

  // Generate invoice number — ORG-SCOPED so two tenants can both have INV-2025-001.
  // Falls back to a global query only when the client has no firmId (legacy).
  const yearPrefix = `INV-${new Date().getFullYear()}-`;
  const existing = await db.invoice.findMany({
    where: client?.firmId
      ? { invoiceNumber: { startsWith: yearPrefix }, client: { firmId: client.firmId } }
      : { invoiceNumber: { startsWith: yearPrefix } },
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

/**
 * @deprecated Use the `/api/invoices/pdf` route instead — it is read-only and
 * does NOT mutate invoice state. This engine helper is retained only for
 * backward compatibility with callers that import from the engine directly.
 * It no longer flips `sentToCustomer`/`status` (generating a preview must
 * never mutate financial state). */
export async function generatePaymentLink(id: string): Promise<{
  invoice: InvoiceDTO;
  pdfUrl: string;
  paymentLink: string;
}> {
  const r = await db.invoice.findUnique({ where: { id } });
  if (!r) throw new Error('Invoice not found');
  // READ-ONLY — no state mutation. Call POST /api/invoices/send to mark sent.
  const invoice = mapInvoice(r);
  const amt = r.balanceAmount || r.totalAmount;
  const paymentLink = `upi://pay?pa=business@upi&pn=Business&tr=${invoice.invoiceNo}&am=${amt}&cu=INR`;
  const pdfUrl = `/api/invoices/${id}/pdf`;
  return { invoice, pdfUrl, paymentLink };
}

/** @deprecated Alias for `generatePaymentLink` — use `/api/invoices/pdf` route. */
export async function generatePdf(id: string): Promise<{
  invoice: InvoiceDTO;
  pdfUrl: string;
  paymentLink: string;
}> {
  return generatePaymentLink(id);
}

/**
 * @deprecated Use `/api/invoices/send` instead. This engine helper is retained
 * for backward compatibility but NO LONGER mutates state — it only validates
 * the invoice exists. The real send (with email/WhatsApp dispatch + Gmail
 * integration check) lives in the API route + services layer. */
export async function sendInvoice(id: string, channel: SendChannel): Promise<InvoiceDTO> {
  const r = await db.invoice.findUnique({ where: { id } });
  if (!r) throw new Error('Invoice not found');
  // READ-ONLY — the API route handles the actual send + audit + dispatch.
  void channel;
  return mapInvoice(r);
}

// ─── helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}
