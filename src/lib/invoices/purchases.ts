// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Invoice Engine™ — Purchase Bill Cloud™
// Vendor invoices, ITC matching, GST split totals. Prisma-backed server module.
// ═══════════════════════════════════════════════════════════════════════════════

import type { PurchaseBillDTO, PurchaseListResult, VendorDTO } from './types';
import { db } from '@/lib/db';
import { calculatePurchaseTotals } from './purchases-utils';

// Pure utilities (Prisma-free) — re-exported so existing server-side callers
// keep compiling. Client components MUST import directly from `./purchases-utils`
// to avoid dragging Prisma into their bundle.
export {
  generatePurchaseBillNumber,
  calculatePurchaseTotals,
  matchWithGstr2b,
  getPurchaseStats,
  categorizePurchase,
  seedPurchaseBills,
  type PurchaseTotals,
  type Gstr2bEntry,
  type Gstr2bMatchResult,
  type PurchaseStatsResult,
} from './purchases-utils';

// ─── helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

// ─── DB-backed list query ──────────────────────────────────────────────────────

/** Fetches purchase bills + vendors from Prisma and maps to the list result. */
export async function getPurchaseBills(opts?: { limit?: number }): Promise<PurchaseListResult> {
  const [billRows, vendorRows] = await Promise.all([
    db.purchaseBill.findMany({
      take: opts?.limit ?? 500,
      orderBy: { createdAt: 'desc' },
    }),
    db.vendor.findMany({ take: 200 }),
  ]);

  const bills: PurchaseBillDTO[] = billRows.map((r) => ({
    id: r.id,
    billNo: r.invoiceNo,
    vendorName: r.vendorName,
    vendorGstin: r.vendorGstin ?? null,
    billDate: r.invoiceDate,
    dueDate: r.dueDate ?? null,
    taxableValue: r.taxableValue,
    cgst: r.cgst,
    sgst: r.sgst,
    igst: r.igst,
    cess: r.cess,
    gstAmount: r.gstAmount,
    total: r.totalAmount,
    paidAmount: r.paidAmount,
    balanceDue: r.balanceAmount,
    itcEligible: true,
    itcAmount: r.gstAmount,
    itcBlockReason: null,
    status: r.status,
    paymentStatus: r.paymentStatus,
    category: r.category ?? null,
  }));

  const vendors: VendorDTO[] = vendorRows.map((v) => ({
    id: v.id,
    name: v.name,
    gstin: v.gstin ?? null,
    category: v.category ?? null,
    totalBilled: v.totalBilled,
    outstanding: v.outstanding,
    status: v.status,
  }));

  const totalPurchaseValue = sum(bills.map((b) => b.total));
  const eligibleITC = sum(bills.filter((b) => b.itcEligible).map((b) => b.itcAmount));
  const blockedITC = sum(bills.filter((b) => !b.itcEligible).map((b) => b.itcAmount));
  const totalOutstanding = sum(bills.map((b) => b.balanceDue));

  return {
    bills,
    total: bills.length,
    totalPurchaseValue: round2(totalPurchaseValue),
    eligibleITC: round2(eligibleITC),
    blockedITC: round2(blockedITC),
    totalOutstanding: round2(totalOutstanding),
    vendors,
    hasLiveData: bills.length > 0,
  };
}

/** Creates a purchase bill in Prisma from the given input and returns the DTO. */
export async function createPurchaseBill(input: {
  vendorId?: string;
  vendorName?: string;
  vendorGstin?: string | null;
  billNo: string;
  billDate?: string;
  dueDate?: string | null;
  taxableValue: number;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  category?: string | null;
  hsnCode?: string | null;
  notes?: string | null;
  clientId?: string | null;
}): Promise<PurchaseBillDTO> {
  const cgstRate = input.cgstRate ?? 0;
  const sgstRate = input.sgstRate ?? 0;
  const igstRate = input.igstRate ?? 0;
  const totals = calculatePurchaseTotals(input.taxableValue, cgstRate, sgstRate, igstRate);
  const billDate = input.billDate ?? new Date().toISOString().slice(0, 10);

  // Look up vendor if vendorId provided
  let vendorName = input.vendorName ?? 'Unknown';
  let vendorGstin = input.vendorGstin ?? null;
  if (input.vendorId) {
    const vendor = await db.vendor.findUnique({ where: { id: input.vendorId } });
    if (vendor) {
      vendorName = vendor.name;
      vendorGstin = vendor.gstin ?? null;
    }
  }

  const created = await db.purchaseBill.create({
    data: {
      clientId: input.clientId ?? null,
      vendorName,
      vendorGstin: vendorGstin ?? null,
      invoiceNo: input.billNo,
      invoiceDate: billDate,
      dueDate: input.dueDate ?? null,
      taxableValue: input.taxableValue,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      cess: 0,
      gstAmount: totals.gstAmount,
      totalAmount: totals.totalAmount,
      paidAmount: 0,
      balanceAmount: totals.totalAmount,
      status: 'recorded',
      paymentStatus: 'unpaid',
      category: input.category ?? null,
      hsnCode: input.hsnCode ?? null,
      notes: input.notes ?? null,
      ocrExtracted: false,
    },
  });

  return {
    id: created.id,
    billNo: created.invoiceNo,
    vendorName: created.vendorName,
    vendorGstin: created.vendorGstin ?? null,
    billDate: created.invoiceDate,
    dueDate: created.dueDate ?? null,
    taxableValue: created.taxableValue,
    cgst: created.cgst,
    sgst: created.sgst,
    igst: created.igst,
    cess: created.cess,
    gstAmount: created.gstAmount,
    total: created.totalAmount,
    paidAmount: created.paidAmount,
    balanceDue: created.balanceAmount,
    itcEligible: true,
    itcAmount: created.gstAmount,
    itcBlockReason: null,
    status: created.status,
    paymentStatus: created.paymentStatus,
    category: created.category ?? null,
  };
}

/** Records a payment against a purchase bill and updates its balance/status. */
export async function payPurchaseBill(
  id: string,
  amount: number,
  mode: string,
  referenceNo?: string,
): Promise<PurchaseBillDTO> {
  const existing = await db.purchaseBill.findUnique({ where: { id } });
  if (!existing) throw new Error('Purchase bill not found');

  const newPaidAmount = round2(existing.paidAmount + amount);
  const newBalance = round2(Math.max(0, existing.totalAmount - newPaidAmount));
  const newStatus = newBalance <= 0 ? 'paid' : 'partial';
  const newPaymentStatus = newBalance <= 0 ? 'paid' : 'partial';

  const updated = await db.purchaseBill.update({
    where: { id },
    data: {
      paidAmount: newPaidAmount,
      balanceAmount: newBalance,
      status: newStatus,
      paymentStatus: newPaymentStatus,
    },
  });

  // Record the payment transaction
  await db.payment.create({
    data: {
      clientId: existing.clientId ?? null,
      purchaseBillId: id,
      partyName: existing.vendorName,
      partyType: 'vendor',
      amount: round2(amount),
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMode: mode,
      referenceNo: referenceNo ?? null,
      status: 'completed',
      reconciled: false,
      notes: null,
    },
  });

  return {
    id: updated.id,
    billNo: updated.invoiceNo,
    vendorName: updated.vendorName,
    vendorGstin: updated.vendorGstin ?? null,
    billDate: updated.invoiceDate,
    dueDate: updated.dueDate ?? null,
    taxableValue: updated.taxableValue,
    cgst: updated.cgst,
    sgst: updated.sgst,
    igst: updated.igst,
    cess: updated.cess,
    gstAmount: updated.gstAmount,
    total: updated.totalAmount,
    paidAmount: updated.paidAmount,
    balanceDue: updated.balanceAmount,
    itcEligible: true,
    itcAmount: updated.gstAmount,
    itcBlockReason: null,
    status: updated.status,
    paymentStatus: updated.paymentStatus,
    category: updated.category ?? null,
  };
}
