// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE INTELLIGENCE — Phase 1: Memory Engine
// ═══════════════════════════════════════════════════════════════════════════════
// Oracle remembers everything. This module queries the REAL Prisma database and
// builds a unified memory snapshot: invoices, customers, vendors, payments,
// expenses, GST, bank, emails, TDS, and purchases — all in one place.
//
// ZERO fabrication. Every number comes from a real database row. When the
// database is empty, `empty: true` is returned so the UI shows a graceful
// empty state instead of fake analytics.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  MemoryRecord,
  MemorySnapshot,
  EntityRef,
} from './types';

const round2 = (n: number): number => Math.round(n * 100) / 100;

// ─── Individual loaders (each pulls REAL rows from one table) ─────────────────

async function loadInvoices(): Promise<MemoryRecord[]> {
  const rows = await db.invoice.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  return rows.map((r) => {
    const ref: EntityRef = {
      kind: 'invoice',
      id: r.id,
      label: r.invoiceNumber || r.id,
    };
    return {
      ref,
      category: 'invoice',
      title: `Invoice ${r.invoiceNumber}`,
      summary: `${r.invoiceType} • ${r.buyerName || r.buyerGstin || '—'} • ${r.paymentStatus}`,
      amount: r.totalAmount,
      date: r.invoiceDate || r.createdAt.toISOString(),
      status: r.paymentStatus,
      tags: [r.invoiceType, r.status, r.paymentStatus].filter(Boolean) as string[],
    };
  });
}

async function loadClients(): Promise<MemoryRecord[]> {
  const rows = await db.client.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  return rows.map((r) => {
    const ref: EntityRef = { kind: 'client', id: r.id, label: r.tradeName || r.gstin };
    return {
      ref,
      category: 'customer',
      title: r.tradeName || r.legalName || r.gstin,
      summary: `GSTIN ${r.gstin} • ${r.state || 'India'} • ${r.status}`,
      status: r.status,
      date: r.createdAt.toISOString(),
      tags: [r.entityType, r.status].filter(Boolean) as string[],
    };
  });
}

async function loadVendors(): Promise<MemoryRecord[]> {
  const rows = await db.vendor.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  return rows.map((r) => {
    const ref: EntityRef = { kind: 'vendor', id: r.id, label: r.name };
    return {
      ref,
      category: 'vendor',
      title: r.name,
      summary: `${r.gstin || 'No GSTIN'} • ${r.category || 'General'} • Outstanding ₹${r.outstanding}`,
      amount: r.outstanding,
      status: r.status,
      date: r.createdAt.toISOString(),
      tags: [r.category, r.status].filter(Boolean) as string[],
    };
  });
}

async function loadPayments(): Promise<MemoryRecord[]> {
  const rows = await db.payment.findMany({
    orderBy: { paymentDate: 'desc' },
    take: 500,
  });
  return rows.map((r) => {
    const ref: EntityRef = { kind: 'payment', id: r.id, label: `${r.partyName} • ${r.paymentMode}` };
    return {
      ref,
      category: 'payment',
      title: `${r.partyType === 'vendor' ? 'Paid to' : 'Received from'} ${r.partyName}`,
      summary: `${r.paymentMode} • ${r.referenceNo || 'No ref'} • ${r.status}`,
      amount: r.amount,
      date: r.paymentDate,
      status: r.status,
      tags: [r.partyType, r.paymentMode, r.status].filter(Boolean) as string[],
    };
  });
}

async function loadExpenses(): Promise<MemoryRecord[]> {
  const rows = await db.expense.findMany({
    orderBy: { date: 'desc' },
    take: 500,
  });
  return rows.map((r) => {
    const ref: EntityRef = { kind: 'expense', id: r.id, label: r.description || r.category };
    return {
      ref,
      category: 'expense',
      title: r.description || `${r.category} expense`,
      summary: `${r.category} • ${r.vendor || '—'} • ${r.paymentMode || '—'}`,
      amount: r.amount,
      date: r.date,
      status: r.status,
      tags: [r.category, r.paymentMode, r.gstClaimable ? 'gst-claimable' : 'non-gst'].filter(
        Boolean,
      ) as string[],
    };
  });
}

async function loadPurchaseBills(): Promise<MemoryRecord[]> {
  const rows = await db.purchaseBill.findMany({
    orderBy: { invoiceDate: 'desc' },
    take: 500,
  });
  return rows.map((r) => {
    const ref: EntityRef = { kind: 'purchaseBill', id: r.id, label: `${r.vendorName} • ${r.invoiceNo}` };
    return {
      ref,
      category: 'purchase',
      title: `Purchase from ${r.vendorName}`,
      summary: `Bill ${r.invoiceNo} • ${r.paymentStatus} • Balance ₹${r.balanceAmount}`,
      amount: r.totalAmount,
      date: r.invoiceDate,
      status: r.paymentStatus,
      tags: [r.category, r.paymentStatus].filter(Boolean) as string[],
    };
  });
}

async function loadGstReturns(): Promise<MemoryRecord[]> {
  const rows = await db.gSTReturn.findMany({
    orderBy: { period: 'desc' },
    take: 200,
  });
  return rows.map((r) => {
    const ref: EntityRef = { kind: 'gstReturn', id: r.id, label: `${r.type} • ${r.period}` };
    return {
      ref,
      category: 'gst',
      title: `${r.type} — ${r.period}`,
      summary: `GSTIN ${r.gstin} • ${r.status} • Tax ₹${r.totalTax} • ITC ₹${r.totalITC}`,
      amount: r.totalTax,
      date: r.filedAt?.toISOString() || r.createdAt.toISOString(),
      status: r.status,
      tags: [r.type, r.status].filter(Boolean) as string[],
    };
  });
}

async function loadGstFilings(): Promise<MemoryRecord[]> {
  const rows = await db.gSTRFiling.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return rows.map((r) => {
    const ref: EntityRef = { kind: 'gstFiling', id: r.id, label: `${r.returnType} • ${r.period}` };
    return {
      ref,
      category: 'gst',
      title: `${r.returnType} Filing — ${r.period}`,
      summary: `${r.totalInvoices} invoices • Tax ₹${r.totalTax} • ${r.status}`,
      amount: r.totalTax,
      date: r.filedDate || r.createdAt.toISOString(),
      status: r.status,
      tags: [r.returnType, r.status].filter(Boolean) as string[],
    };
  });
}

async function loadBankAccounts(): Promise<MemoryRecord[]> {
  const rows = await db.bankAccount.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return rows.map((r) => {
    const ref: EntityRef = { kind: 'bankAccount', id: r.id, label: `${r.bankName} ••${r.accountMasked}` };
    return {
      ref,
      category: 'bank',
      title: `${r.bankName} ••${r.accountMasked}`,
      summary: `${r.accountType} • Balance ₹${r.balance} • ${r.status}`,
      amount: r.balance,
      status: r.status,
      date: r.lastSyncAt?.toISOString() || r.createdAt.toISOString(),
      tags: [r.accountType, r.status].filter(Boolean) as string[],
    };
  });
}

async function loadBankTransactions(): Promise<MemoryRecord[]> {
  const rows = await db.bankTransaction.findMany({
    orderBy: { date: 'desc' },
    take: 500,
  });
  return rows.map((r) => {
    const ref: EntityRef = { kind: 'bankTransaction', id: r.id, label: r.description };
    return {
      ref,
      category: 'bank',
      title: `${r.type === 'credit' ? 'Credit' : 'Debit'} • ${r.description}`,
      summary: `${r.category || 'Uncategorised'} • ${r.matched ? 'Reconciled' : 'Unreconciled'}`,
      amount: r.amount,
      date: r.date.toISOString(),
      status: r.matched ? 'reconciled' : 'unreconciled',
      tags: [r.type, r.category, r.matched ? 'matched' : 'unmatched'].filter(Boolean) as string[],
    };
  });
}

async function loadEmails(): Promise<MemoryRecord[]> {
  const rows = await db.emailMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  return rows.map((r) => {
    const ref: EntityRef = { kind: 'email', id: r.id, label: r.subject };
    return {
      ref,
      category: 'email',
      title: r.subject,
      summary: `To ${r.recipientEmail} • ${r.category} • ${r.status}`,
      date: r.sentAt?.toISOString() || r.createdAt.toISOString(),
      status: r.status,
      tags: [r.category, r.status].filter(Boolean) as string[],
    };
  });
}

async function loadTds(): Promise<MemoryRecord[]> {
  const rows = await db.tDSRecord.findMany({
    orderBy: { date: 'desc' },
    take: 500,
  });
  return rows.map((r) => {
    const ref: EntityRef = { kind: 'tds', id: r.id, label: `${r.section} • ${r.deducteeName}` };
    return {
      ref,
      category: 'tds',
      title: `TDS ${r.section} — ${r.deducteeName}`,
      summary: `Payment ₹${r.paymentAmount} • TDS ₹${r.tdsAmount} • ${r.status}`,
      amount: r.tdsAmount,
      date: r.date,
      status: r.status,
      tags: [r.section, r.quarter, r.status].filter(Boolean) as string[],
    };
  });
}

// ─── Financial aggregation (all computed from real rows) ─────────────────────

async function computeFinancials() {
  const [
    invoiceAgg,
    expenseAgg,
    payablesAgg,
    bankAgg,
    tdsAgg,
    gstReturns,
    paymentsReceived,
    paymentsSent,
  ] = await Promise.all([
    db.invoice.aggregate({ _sum: { totalAmount: true, paidAmount: true, balanceAmount: true, gstAmount: true } }),
    db.expense.aggregate({ _sum: { amount: true, gst: true } }),
    db.purchaseBill.aggregate({ _sum: { balanceAmount: true, gstAmount: true } }),
    db.bankAccount.aggregate({ _sum: { balance: true } }),
    db.tDSRecord.aggregate({ _sum: { tdsAmount: true } }),
    db.gSTReturn.aggregate({ _sum: { totalTax: true, totalITC: true } }),
    db.payment.aggregate({ where: { partyType: 'customer' }, _sum: { amount: true } }),
    db.payment.aggregate({ where: { partyType: 'vendor' }, _sum: { amount: true } }),
  ]);

  // Overdue = invoices that are not paid and past their due date
  const nowIso = new Date().toISOString();
  const overdueInvoices = await db.invoice.findMany({
    where: {
      paymentStatus: { not: 'paid' },
      dueDate: { lt: nowIso, not: null },
      balanceAmount: { gt: 0 },
    },
    select: { balanceAmount: true },
  });
  const totalOverdue = overdueInvoices.reduce((s, r) => s + r.balanceAmount, 0);

  return {
    totalSalesInvoiced: round2(invoiceAgg._sum.totalAmount || 0),
    totalCollected: round2(invoiceAgg._sum.paidAmount || 0),
    totalOutstanding: round2(invoiceAgg._sum.balanceAmount || 0),
    totalOverdue: round2(totalOverdue),
    totalExpenses: round2(expenseAgg._sum.amount || 0),
    totalGstCollected: round2(invoiceAgg._sum.gstAmount || 0),
    totalGstPaid: round2(gstReturns._sum.totalITC || 0),
    totalPayables: round2(payablesAgg._sum.balanceAmount || 0),
    totalBankBalance: round2(bankAgg._sum.balance || 0),
    totalTdsDeducted: round2(tdsAgg._sum.tdsAmount || 0),
  };
}

// ─── Public API: buildMemorySnapshot ──────────────────────────────────────────

export async function buildMemorySnapshot(): Promise<MemorySnapshot> {
  const [
    invoices, clients, vendors, payments, expenses, purchases,
    gstReturns, gstFilings, bankAccounts, bankTxns, emails, tds,
    financials,
  ] = await Promise.all([
    loadInvoices(),
    loadClients(),
    loadVendors(),
    loadPayments(),
    loadExpenses(),
    loadPurchaseBills(),
    loadGstReturns(),
    loadGstFilings(),
    loadBankAccounts(),
    loadBankTransactions(),
    loadEmails(),
    loadTds(),
    computeFinancials(),
  ]);

  const records: MemoryRecord[] = [
    ...invoices,
    ...clients,
    ...vendors,
    ...payments,
    ...expenses,
    ...purchases,
    ...gstReturns,
    ...gstFilings,
    ...bankAccounts,
    ...bankTxns,
    ...emails,
    ...tds,
  ];

  const counts: Record<MemoryRecord['category'], number> = {
    invoice: invoices.length,
    customer: clients.length,
    vendor: vendors.length,
    payment: payments.length,
    expense: expenses.length,
    gst: gstReturns.length + gstFilings.length,
    bank: bankAccounts.length + bankTxns.length,
    email: emails.length,
    tds: tds.length,
    purchase: purchases.length,
  };

  const totalRecords = records.length;
  const empty = totalRecords === 0;

  return {
    generatedAt: new Date().toISOString(),
    counts,
    totalRecords,
    records,
    financials,
    empty,
  };
}

/** Lightweight counts + financials only (for dashboards that don't need full records). */
export async function getMemoryStats() {
  const snap = await buildMemorySnapshot();
  return {
    generatedAt: snap.generatedAt,
    counts: snap.counts,
    totalRecords: snap.totalRecords,
    financials: snap.financials,
    empty: snap.empty,
  };
}
