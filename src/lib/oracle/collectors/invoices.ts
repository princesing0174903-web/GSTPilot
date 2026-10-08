// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Intelligence Engine — Invoices Collector
//
// Reads the firm's real invoice / purchase-bill / expense / payment data from
// Prisma and computes aggregate receivables & payables totals that downstream
// analyzers (cashflow, receivables) consume.
//
// Graceful contract: if the tables are empty, returns an empty InvoicesData
// with connected=false — never throws.
// ═══════════════════════════════════════════════════════════════════════════════

import 'server-only';

import { db } from '@/lib/db';
import type {
  Collector,
  CollectorContext,
  CollectorResult,
  ExpenseSummary,
  InvoiceSummary,
  InvoicesData,
  PaymentSummary,
  PurchaseBillSummary,
} from '../types';

function emptyData(): InvoicesData {
  return {
    invoices: [],
    purchaseBills: [],
    expenses: [],
    payments: [],
    totals: {
      salesOutstanding: 0,
      purchaseOutstanding: 0,
      overdueAmount: 0,
      expenseThisMonth: 0,
      collectedThisMonth: 0,
    },
  };
}

function startOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isThisMonth(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  const d = new Date(t);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export const invoicesCollector: Collector<InvoicesData> = {
  id: 'invoices',
  label: 'Invoices & Payments',
  async collect(ctx: CollectorContext): Promise<CollectorResult<InvoicesData>> {
    const collectedAt = new Date().toISOString();

    try {
      // Cap the read at 500 rows per table to keep the briefing fast. Analyzers
      // operate on the summary totals; the per-row arrays are for evidence.
      const [invoiceRows, purchaseRows, expenseRows, paymentRows] = await Promise.all([
        db.invoice.findMany({ take: 500, orderBy: { createdAt: 'desc' } }).catch(() => []),
        db.purchaseBill.findMany({ take: 500, orderBy: { createdAt: 'desc' } }).catch(() => []),
        db.expense.findMany({ take: 500, orderBy: { createdAt: 'desc' } }).catch(() => []),
        db.payment.findMany({ take: 500, orderBy: { createdAt: 'desc' } }).catch(() => []),
      ]);

      const invoices: InvoiceSummary[] = invoiceRows.map((r) => ({
        id: r.id,
        invoiceNumber: r.invoiceNumber,
        clientId: r.clientId,
        buyerName: r.buyerName,
        invoiceDate: r.invoiceDate,
        dueDate: r.dueDate ?? null,
        totalAmount: r.totalAmount,
        paidAmount: r.paidAmount,
        balanceAmount: r.balanceAmount,
        paymentStatus: r.paymentStatus,
        status: r.status,
        riskLevel: r.riskLevel,
        riskScore: r.riskScore,
      }));

      const purchaseBills: PurchaseBillSummary[] = purchaseRows.map((r) => ({
        id: r.id,
        vendorName: r.vendorName,
        invoiceNo: r.invoiceNo,
        invoiceDate: r.invoiceDate,
        dueDate: r.dueDate ?? null,
        totalAmount: r.totalAmount,
        paidAmount: r.paidAmount,
        balanceAmount: r.balanceAmount,
        paymentStatus: r.paymentStatus,
        status: r.status,
      }));

      const expenses: ExpenseSummary[] = expenseRows.map((r) => ({
        id: r.id,
        category: r.category,
        vendor: r.vendor,
        amount: r.amount,
        gst: r.gst,
        gstClaimable: r.gstClaimable,
        date: r.date,
        status: r.status,
      }));

      const payments: PaymentSummary[] = paymentRows.map((r) => ({
        id: r.id,
        partyName: r.partyName,
        partyType: r.partyType,
        amount: r.amount,
        paymentDate: r.paymentDate,
        paymentMode: r.paymentMode,
        status: r.status,
        invoiceId: r.invoiceId,
      }));

      // ── Aggregate totals ─────────────────────────────────────────────────
      const salesOutstanding = invoices.reduce((s, i) => s + (i.balanceAmount || 0), 0);
      const purchaseOutstanding = purchaseBills.reduce((s, p) => s + (p.balanceAmount || 0), 0);

      const now = Date.now();
      const overdueAmount = invoices
        .filter((i) => {
          if (!i.dueDate) return i.paymentStatus === 'overdue';
          const due = Date.parse(i.dueDate);
          return !Number.isNaN(due) && due < now && i.paymentStatus !== 'paid';
        })
        .reduce((s, i) => s + (i.balanceAmount || 0), 0);

      const expenseThisMonth = expenses
        .filter((e) => isThisMonth(e.date))
        .reduce((s, e) => s + (e.amount || 0), 0);

      const collectedThisMonth = payments
        .filter((p) => p.partyType === 'customer' && isThisMonth(p.paymentDate) && p.status === 'completed')
        .reduce((s, p) => s + (p.amount || 0), 0);

      const data: InvoicesData = {
        invoices,
        purchaseBills,
        expenses,
        payments,
        totals: {
          salesOutstanding,
          purchaseOutstanding,
          overdueAmount,
          expenseThisMonth,
          collectedThisMonth,
        },
      };

      const totalRecords = invoices.length + purchaseBills.length + expenses.length + payments.length;
      return {
        source: 'invoices',
        connected: totalRecords > 0,
        recordCount: totalRecords,
        data,
        collectedAt,
      };
    } catch (err) {
      return {
        source: 'invoices',
        connected: false,
        recordCount: 0,
        data: emptyData(),
        error: err instanceof Error ? err.message : 'Invoices collector failed.',
        collectedAt,
      };
    }
  },
};
