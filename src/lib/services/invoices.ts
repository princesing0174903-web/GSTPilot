// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Shared Service Layer: Invoices
// ═══════════════════════════════════════════════════════════════════════════════
//
// Canonical create/update/delete/duplicate/send logic for invoices. Both
// /api/invoices and the Oracle createInvoice/updateInvoice/deleteInvoice/
// duplicateInvoice/sendInvoice actions call THESE functions so audit logs,
// graph events, timeline events, and activity logs fire identically.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import {
  calculateInvoiceTotals,
  generateInvoiceNumber,
  type InvoiceLineItem,
} from '@/lib/invoices/invoices';
import { graphEvents, invalidateGraph } from '@/lib/graph/live-update';
import { emitInvoiceNode } from '@/lib/graph/auto-emit';
import { emitTimelineEvent } from '@/lib/timeline/emit';
import type { Actor, ServiceResult } from './types';

export interface InvoiceLineItemInput {
  description?: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
}

export interface CreateInvoiceInput {
  clientId: string;
  customerName?: string;
  buyerGstin?: string;
  sellerGstin?: string;
  isInterState?: boolean;
  invoiceNumber?: string;
  date?: string;
  dueDate?: string;
  items: InvoiceLineItemInput[];
  notes?: string;
  recurring?: boolean;
  recurringCycle?: string;
  /** Optional: persist individual InvoiceItem rows (Oracle richness — the
   * /api/invoices cloud flow stores only aggregate totals, but Oracle shows
   * a line-item table in the confirmation card, so it persists the rows). */
  persistLineItems?: boolean;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  clientId: string;
  buyerName: string | null;
  buyerGstin: string | null;
  sellerGstin: string;
  invoiceDate: string;
  dueDate: string | null;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: string;
  status: string;
  sentToCustomer: boolean;
  period: string | null;
}

function toRecord(i: any): InvoiceRecord {
  return {
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    clientId: i.clientId,
    buyerName: i.buyerName ?? null,
    buyerGstin: i.buyerGstin ?? null,
    sellerGstin: i.sellerGstin ?? '',
    invoiceDate: i.invoiceDate,
    dueDate: i.dueDate ?? null,
    taxableValue: i.taxableValue ?? 0,
    cgst: i.cgst ?? 0,
    sgst: i.sgst ?? 0,
    igst: i.igst ?? 0,
    gstAmount: i.gstAmount ?? 0,
    totalAmount: i.totalAmount ?? 0,
    paidAmount: i.paidAmount ?? 0,
    balanceAmount: i.balanceAmount ?? 0,
    paymentStatus: i.paymentStatus ?? 'unpaid',
    status: i.status ?? 'draft',
    sentToCustomer: i.sentToCustomer ?? false,
    period: i.period ?? null,
  };
}

/**
 * Create an invoice (Invoice Cloud™ flow) with line items + GST computation.
 * Generates an invoice number if not supplied. Auto-derives inter-state from
 * GSTIN state codes unless explicitly provided.
 */
export async function createInvoice(
  orgId: string,
  input: CreateInvoiceInput,
  actor?: Actor,
): Promise<ServiceResult<InvoiceRecord>> {
  if (!input.clientId) return { ok: false, error: 'clientId is required', status: 400 };
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, error: 'At least one line item is required', status: 400 };
  }

  const sellerState = input.sellerGstin?.slice(0, 2) ?? '';
  const buyerState = input.buyerGstin?.slice(0, 2) ?? '';
  const interState =
    typeof input.isInterState === 'boolean'
      ? input.isInterState
      : Boolean(sellerState && buyerState && sellerState !== buyerState);

  const lineItems: InvoiceLineItem[] = input.items.map((it) => {
    const qty = Number(it.quantity) || 0;
    const price = Number(it.unitPrice) || 0;
    const taxable = Math.round(qty * price * 100) / 100;
    const rate = Number(it.gstRate) || 0;
    return {
      taxableValue: taxable,
      cgstRate: interState ? 0 : rate / 2,
      sgstRate: interState ? 0 : rate / 2,
      igstRate: interState ? rate : 0,
    };
  });

  const totals = calculateInvoiceTotals(lineItems);

  // Generate invoice number if not supplied
  let invoiceNumber = input.invoiceNumber;
  if (!invoiceNumber) {
    const existing = await db.invoice.findMany({
      where: { invoiceNumber: { startsWith: `INV-${new Date().getFullYear()}-` } },
      select: { invoiceNumber: true },
    }).catch(() => []);
    invoiceNumber = generateInvoiceNumber(existing.map((i) => i.invoiceNumber));
  }

  const date = input.date ?? new Date().toISOString().split('T')[0];

  const invoice = await db.invoice.create({
    data: {
      clientId: input.clientId,
      invoiceNumber,
      invoiceDate: date,
      sellerGstin: input.sellerGstin ?? '',
      buyerGstin: input.buyerGstin ?? null,
      buyerName: input.customerName ?? null,
      invoiceType: 'B2B',
      gstr1Section: 'b2b',
      taxableValue: totals.taxableValue,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      cess: 0,
      totalAmount: totals.totalAmount,
      hsnCode: null,
      reverseCharge: false,
      status: 'issued',
      matchStatus: 'unmatched',
      riskLevel: 'low',
      riskScore: 0,
      period: date.slice(0, 7),
      notes: input.notes ?? null,
      dueDate: input.dueDate ?? null,
      gstAmount: totals.gstAmount,
      paidAmount: 0,
      balanceAmount: totals.totalAmount,
      paymentStatus: 'unpaid',
      recurring: Boolean(input.recurring),
      recurringCycle: input.recurringCycle ?? null,
      sentToCustomer: false,
    },
    select: {
      id: true, invoiceNumber: true, clientId: true, buyerName: true, buyerGstin: true,
      sellerGstin: true, invoiceDate: true, dueDate: true, taxableValue: true, cgst: true,
      sgst: true, igst: true, gstAmount: true, totalAmount: true, paidAmount: true,
      balanceAmount: true, paymentStatus: true, status: true, sentToCustomer: true, period: true,
    },
  });

  // ── Side effects ──
  await db.auditLog.create({
    data: {
      clientId: input.clientId,
      action: 'Invoice Created',
      entity: 'invoice',
      entityId: invoice.id,
      details: `Invoice Cloud™ ${invoiceNumber} created for ${input.customerName ?? input.clientId} (₹${totals.totalAmount})`,
    },
  }).catch(() => {});

  graphEvents.invoiceCreated(invoice.id, invoice.invoiceNumber, totals.totalAmount, input.buyerGstin ?? undefined);
  try { await emitInvoiceNode(invoice.id); } catch { /* non-fatal */ }

  await emitTimelineEvent({
    organizationId: orgId,
    type: 'invoice.created',
    title: `Invoice ${invoiceNumber} created`,
    description: `₹${totals.totalAmount.toLocaleString('en-IN')} invoice issued for ${input.customerName ?? 'customer'}.`,
    actor,
    metadata: {
      invoiceId: invoice.id, invoiceNumber,
      customerId: input.clientId, customerName: input.customerName ?? null,
      amount: totals.totalAmount, taxableValue: totals.taxableValue,
      gstAmount: totals.gstAmount, dueDate: input.dueDate ?? null,
    },
    severity: 'info',
  });

  try {
    await db.activity.create({
      data: {
        firmId: orgId,
        type: 'invoice',
        description: `Invoice ${invoiceNumber} created for ${input.customerName ?? 'customer'} — ₹${totals.totalAmount}`,
        metadata: JSON.stringify({ invoiceId: invoice.id, invoiceNumber }),
      },
    });
  } catch { /* non-fatal */ }

  // ── Optional: persist individual InvoiceItem rows (Oracle richness) ──
  if (input.persistLineItems) {
    try {
      await db.invoiceItem.createMany({
        data: input.items.map((it, idx) => {
          const qty = Number(it.quantity) || 0;
          const price = Number(it.unitPrice) || 0;
          const taxable = Math.round(qty * price * 100) / 100;
          const rate = Number(it.gstRate) || 0;
          const tax = taxable * (rate / 100);
          return {
            invoiceId: invoice.id,
            lineNumber: idx + 1,
            description: String(it.description ?? 'Item'),
            hsnCode: it.hsnCode ? String(it.hsnCode) : null,
            quantity: qty,
            unit: 'NOS',
            unitPrice: price,
            taxableValue: taxable,
            cgstRate: interState ? 0 : rate / 2,
            sgstRate: interState ? 0 : rate / 2,
            igstRate: interState ? rate : 0,
            cessRate: 0,
            cgst: interState ? 0 : tax / 2,
            sgst: interState ? 0 : tax / 2,
            igst: interState ? tax : 0,
            cess: 0,
            totalAmount: taxable + tax,
          };
        }),
      });
    } catch (e) {
      console.warn('[services/invoices] line items not persisted (non-fatal):', (e as Error).message);
    }
  }

  return { ok: true, data: toRecord(invoice), status: 201 };
}

/**
 * Update an invoice's mutable fields. Recomputes nothing — caller supplies
 * final values. Returns 404 if not found.
 */
export async function updateInvoice(
  orgId: string,
  id: string,
  updates: Record<string, unknown>,
  actor?: Actor,
): Promise<ServiceResult<InvoiceRecord>> {
  if (!id) return { ok: false, error: 'Invoice id is required', status: 400 };

  const existing = await db.invoice.findUnique({ where: { id } }).catch(() => null);
  if (!existing) return { ok: false, error: 'Invoice not found', status: 404 };

  const clean = { ...updates };
  delete clean.id;
  delete clean.createdAt;
  delete clean.updatedAt;

  const invoice = await db.invoice.update({
    where: { id },
    data: clean,
    select: {
      id: true, invoiceNumber: true, clientId: true, buyerName: true, buyerGstin: true,
      sellerGstin: true, invoiceDate: true, dueDate: true, taxableValue: true, cgst: true,
      sgst: true, igst: true, gstAmount: true, totalAmount: true, paidAmount: true,
      balanceAmount: true, paymentStatus: true, status: true, sentToCustomer: true, period: true,
    },
  });

  await db.auditLog.create({
    data: {
      clientId: invoice.clientId,
      action: 'Invoice Updated',
      entity: 'invoice',
      entityId: invoice.id,
      details: `Invoice ${invoice.invoiceNumber} updated`,
    },
  }).catch(() => {});

  invalidateGraph();

  await emitTimelineEvent({
    organizationId: orgId,
    type: 'invoice.updated',
    title: `Invoice ${invoice.invoiceNumber} updated`,
    description: `Invoice ${invoice.invoiceNumber} details were modified.`,
    actor,
    metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
    severity: 'info',
  });

  return { ok: true, data: toRecord(invoice) };
}

/**
 * Delete an invoice. Audit log written BEFORE deletion. Returns 404 if not found.
 */
export async function deleteInvoice(
  orgId: string,
  id: string,
  actor?: Actor,
): Promise<ServiceResult<{ id: string; invoiceNumber: string; clientId: string }>> {
  if (!id) return { ok: false, error: 'Invoice id is required', status: 400 };

  const existing = await db.invoice.findUnique({ where: { id }, include: { client: true } }).catch(() => null);
  if (!existing) return { ok: false, error: 'Invoice not found', status: 404 };

  await db.auditLog.create({
    data: {
      clientId: existing.clientId,
      action: 'Invoice Deleted',
      entity: 'invoice',
      entityId: id,
      details: `Invoice ${existing.invoiceNumber} deleted for ${existing.client?.tradeName ?? existing.clientId}`,
    },
  }).catch(() => {});

  await db.invoice.delete({ where: { id } });

  invalidateGraph();

  await emitTimelineEvent({
    organizationId: orgId,
    type: 'invoice.deleted',
    title: `Invoice ${existing.invoiceNumber} deleted`,
    description: `Invoice ${existing.invoiceNumber} (₹${existing.totalAmount ?? 0}) was removed.`,
    actor,
    metadata: { invoiceId: id, invoiceNumber: existing.invoiceNumber },
    severity: 'warning',
  });

  return { ok: true, data: { id, invoiceNumber: existing.invoiceNumber, clientId: existing.clientId } };
}

/**
 * Duplicate an invoice — copies all line-item + financial fields with a new
 * invoice number and resets payment status to unpaid. Returns the new invoice.
 */
export async function duplicateInvoice(
  orgId: string,
  id: string,
  actor?: Actor,
): Promise<ServiceResult<InvoiceRecord>> {
  if (!id) return { ok: false, error: 'Invoice id is required', status: 400 };

  const src = await db.invoice.findUnique({ where: { id } }).catch(() => null);
  if (!src) return { ok: false, error: 'Invoice not found', status: 404 };

  const existingNums = await db.invoice.findMany({
    where: { invoiceNumber: { startsWith: `INV-${new Date().getFullYear()}-` } },
    select: { invoiceNumber: true },
  }).catch(() => []);
  const newNumber = generateInvoiceNumber(existingNums.map((i) => i.invoiceNumber));

  const dup = await db.invoice.create({
    data: {
      clientId: src.clientId,
      invoiceNumber: newNumber,
      invoiceDate: new Date().toISOString().split('T')[0],
      sellerGstin: src.sellerGstin,
      buyerGstin: src.buyerGstin,
      buyerName: src.buyerName,
      invoiceType: src.invoiceType,
      gstr1Section: src.gstr1Section,
      taxableValue: src.taxableValue,
      cgst: src.cgst,
      sgst: src.sgst,
      igst: src.igst,
      cess: src.cess,
      totalAmount: src.totalAmount,
      hsnCode: src.hsnCode,
      reverseCharge: src.reverseCharge,
      status: 'draft',
      matchStatus: 'unmatched',
      riskLevel: 'low',
      riskScore: 0,
      period: new Date().toISOString().slice(0, 7),
      notes: src.notes,
      dueDate: src.dueDate,
      gstAmount: src.gstAmount,
      paidAmount: 0,
      balanceAmount: src.totalAmount,
      paymentStatus: 'unpaid',
      recurring: false,
      recurringCycle: null,
      sentToCustomer: false,
    },
    select: {
      id: true, invoiceNumber: true, clientId: true, buyerName: true, buyerGstin: true,
      sellerGstin: true, invoiceDate: true, dueDate: true, taxableValue: true, cgst: true,
      sgst: true, igst: true, gstAmount: true, totalAmount: true, paidAmount: true,
      balanceAmount: true, paymentStatus: true, status: true, sentToCustomer: true, period: true,
    },
  });

  await db.auditLog.create({
    data: {
      clientId: src.clientId,
      action: 'Invoice Duplicated',
      entity: 'invoice',
      entityId: dup.id,
      details: `Invoice ${newNumber} created as a duplicate of ${src.invoiceNumber}`,
    },
  }).catch(() => {});

  graphEvents.invoiceCreated(dup.id, dup.invoiceNumber, dup.totalAmount, dup.buyerGstin ?? undefined);
  try { await emitInvoiceNode(dup.id); } catch { /* non-fatal */ }

  await emitTimelineEvent({
    organizationId: orgId,
    type: 'invoice.created',
    title: `Invoice ${newNumber} created (duplicate)`,
    description: `Duplicated from ${src.invoiceNumber} — ₹${dup.totalAmount ?? 0}.`,
    actor,
    metadata: { invoiceId: dup.id, invoiceNumber: newNumber, sourceInvoiceId: id, sourceInvoiceNumber: src.invoiceNumber },
    severity: 'info',
  });

  return { ok: true, data: toRecord(dup), status: 201 };
}

/**
 * Mark an invoice as sent to the customer (sets sentToCustomer=true, status=issued).
 * This is the "send invoice" action — in production it would also trigger an
 * email; here we record the sent state + timeline event. The Oracle sendInvoice
 * action uses this.
 */
export async function sendInvoice(
  orgId: string,
  id: string,
  channel: 'email' | 'whatsapp' | 'sms' = 'email',
  actor?: Actor,
): Promise<ServiceResult<InvoiceRecord>> {
  if (!id) return { ok: false, error: 'Invoice id is required', status: 400 };

  const existing = await db.invoice.findUnique({ where: { id }, include: { client: true } }).catch(() => null);
  if (!existing) return { ok: false, error: 'Invoice not found', status: 404 };

  const invoice = await db.invoice.update({
    where: { id },
    data: { sentToCustomer: true, status: 'issued' },
    select: {
      id: true, invoiceNumber: true, clientId: true, buyerName: true, buyerGstin: true,
      sellerGstin: true, invoiceDate: true, dueDate: true, taxableValue: true, cgst: true,
      sgst: true, igst: true, gstAmount: true, totalAmount: true, paidAmount: true,
      balanceAmount: true, paymentStatus: true, status: true, sentToCustomer: true, period: true,
    },
  });

  await db.auditLog.create({
    data: {
      clientId: invoice.clientId,
      action: 'Invoice Sent',
      entity: 'invoice',
      entityId: invoice.id,
      details: `Invoice ${invoice.invoiceNumber} sent to customer via ${channel}`,
    },
  }).catch(() => {});

  await emitTimelineEvent({
    organizationId: orgId,
    type: 'invoice.sent',
    title: `Invoice ${invoice.invoiceNumber} sent`,
    description: `Invoice ${invoice.invoiceNumber} (₹${invoice.totalAmount ?? 0}) sent to ${existing.client?.tradeName ?? invoice.buyerName ?? 'customer'} via ${channel}.`,
    actor,
    metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, channel, amount: invoice.totalAmount },
    severity: 'info',
  });

  try {
    await db.activity.create({
      data: {
        firmId: orgId,
        type: 'invoice',
        description: `Invoice ${invoice.invoiceNumber} sent to customer via ${channel}`,
        metadata: JSON.stringify({ invoiceId: invoice.id, channel }),
      },
    });
  } catch { /* non-fatal */ }

  return { ok: true, data: toRecord(invoice) };
}
