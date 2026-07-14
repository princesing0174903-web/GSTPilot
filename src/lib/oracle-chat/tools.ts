// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE CHAT — Tool Registry (REAL DATA ONLY)
// ═══════════════════════════════════════════════════════════════════════════════
// Every tool reads directly from the Prisma database. ZERO fabrication.
// If a table is empty, the tool returns recordCount: 0 and the agent is
// instructed to say "I don't have enough business data to answer that."
//
// Tools are pure async functions: (query) => Promise<ToolResult>
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { ToolResult, ToolName, SourceRef } from './types';

const round2 = (n: number): number => Math.round(n * 100) / 100;

function inr(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n || 0));
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

// ─── Tool: memory_snapshot ────────────────────────────────────────────────────
async function memorySnapshot(): Promise<ToolResult> {
  const start = Date.now();
  const [
    invoiceAgg, expenseAgg, payableAgg, bankAgg, tdsAgg, gstAgg,
    payRecvAgg, paySentAgg, clientCount, vendorCount, invoiceCount,
  ] = await Promise.all([
    db.invoice.aggregate({ _sum: { totalAmount: true, paidAmount: true, balanceAmount: true, gstAmount: true }, _count: true }),
    db.expense.aggregate({ _sum: { amount: true, gst: true }, _count: true }),
    db.purchaseBill.aggregate({ _sum: { balanceAmount: true, gstAmount: true }, _count: true }),
    db.bankAccount.aggregate({ _sum: { balance: true }, _count: true }),
    db.tDSRecord.aggregate({ _sum: { tdsAmount: true }, _count: true }),
    db.gSTReturn.aggregate({ _sum: { totalTax: true, totalITC: true }, _count: true }),
    db.payment.aggregate({ where: { partyType: 'customer' }, _sum: { amount: true } }),
    db.payment.aggregate({ where: { partyType: 'vendor' }, _sum: { amount: true } }),
    db.client.count(),
    db.vendor.count(),
    db.invoice.count(),
  ]);

  const nowIso = new Date().toISOString();
  const overdueRows = await db.invoice.findMany({
    where: { paymentStatus: { not: 'paid' }, dueDate: { lt: nowIso, not: null }, balanceAmount: { gt: 0 } },
    select: { balanceAmount: true },
  });
  const totalOverdue = overdueRows.reduce((s, r) => s + r.balanceAmount, 0);

  const summary = JSON.stringify({
    totalRecords: invoiceAgg._count + expenseAgg._count + clientCount + vendorCount,
    financials: {
      totalSalesInvoiced: inr(invoiceAgg._sum.totalAmount || 0),
      totalCollected: inr(invoiceAgg._sum.paidAmount || 0),
      totalOutstanding: inr(invoiceAgg._sum.balanceAmount || 0),
      totalOverdue: inr(totalOverdue),
      totalExpenses: inr(expenseAgg._sum.amount || 0),
      totalGstCollected: inr(invoiceAgg._sum.gstAmount || 0),
      totalGstPaid_ITC: inr(gstAgg._sum.totalITC || 0),
      totalPayables: inr(payableAgg._sum.balanceAmount || 0),
      totalBankBalance: inr(bankAgg._sum.balance || 0),
      totalTdsDeducted: inr(tdsAgg._sum.tdsAmount || 0),
      totalPaymentsReceived: inr(payRecvAgg._sum.amount || 0),
      totalPaymentsSent: inr(paySentAgg._sum.amount || 0),
    },
    counts: {
      invoices: invoiceAgg._count,
      clients: clientCount,
      vendors: vendorCount,
      expenses: expenseAgg._count,
      purchaseBills: payableAgg._count,
      bankAccounts: bankAgg._count,
      gstReturns: gstAgg._count,
      tdsRecords: tdsAgg._count,
    },
    empty: invoiceCount === 0 && clientCount === 0 && vendorCount === 0,
  });

  return {
    name: 'memory_snapshot',
    label: 'Company Memory Snapshot',
    recordCount: invoiceAgg._count + clientCount + vendorCount,
    summary,
    sources: [],
    durationMs: Date.now() - start,
  };
}

// ─── Tool: search_invoices ────────────────────────────────────────────────────
async function searchInvoices(q: string): Promise<ToolResult> {
  const start = Date.now();
  const where: Record<string, unknown> = {};
  const num = Number(q.replace(/[^0-9.]/g, ''));
  if (q.match(/overdue/i)) {
    const nowIso = new Date().toISOString();
    where.AND = [
      { paymentStatus: { not: 'paid' } },
      { dueDate: { lt: nowIso, not: null } },
      { balanceAmount: { gt: 0 } },
    ];
  } else if (q.match(/unpaid|outstanding|receivable/i)) {
    where.paymentStatus = { in: ['unpaid', 'partial'] };
  } else if (q.match(/paid/i)) {
    where.paymentStatus = 'paid';
  } else if (num > 0 && q.match(/₹|rs|rupee|amount|more than|greater|above/i)) {
    where.totalAmount = { gte: num };
  }
  const rows = await db.invoice.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { client: { select: { tradeName: true, gstin: true } } },
  });
  const sources: SourceRef[] = rows.map((r) => ({
    kind: 'invoice' as const,
    id: r.id,
    label: `${r.invoiceNumber} • ${r.buyerName || r.client?.tradeName || '—'}`,
    amount: round2(r.totalAmount),
    date: r.invoiceDate,
    status: r.paymentStatus,
  }));
  const summary = JSON.stringify(rows.slice(0, 25).map((r) => ({
    no: r.invoiceNumber,
    buyer: r.buyerName || r.client?.tradeName || null,
    total: round2(r.totalAmount),
    balance: round2(r.balanceAmount),
    status: r.paymentStatus,
    date: r.invoiceDate,
    due: r.dueDate,
    type: r.invoiceType,
  })));
  return {
    name: 'search_invoices',
    label: 'Search Invoices',
    recordCount: rows.length,
    summary,
    sources,
    durationMs: Date.now() - start,
  };
}

// ─── Tool: search_payments ────────────────────────────────────────────────────
async function searchPayments(q: string): Promise<ToolResult> {
  const start = Date.now();
  const where: Record<string, unknown> = {};
  if (q.match(/received|incoming|customer/i)) where.partyType = 'customer';
  else if (q.match(/sent|outgoing|vendor|paid to/i)) where.partyType = 'vendor';
  if (q.match(/pending/i)) where.status = 'pending';
  else if (q.match(/completed|success/i)) where.status = 'completed';
  const rows = await db.payment.findMany({
    where,
    orderBy: { paymentDate: 'desc' },
    take: 50,
  });
  const sources: SourceRef[] = rows.map((r) => ({
    kind: 'payment' as const,
    id: r.id,
    label: `${r.partyName} • ${r.paymentMode} • ₹${inr(r.amount)}`,
    amount: round2(r.amount),
    date: r.paymentDate,
    status: r.status,
  }));
  const summary = JSON.stringify(rows.slice(0, 25).map((r) => ({
    party: r.partyName,
    type: r.partyType,
    amount: round2(r.amount),
    mode: r.paymentMode,
    date: r.paymentDate,
    ref: r.referenceNo,
    status: r.status,
  })));
  return {
    name: 'search_payments',
    label: 'Search Payments',
    recordCount: rows.length,
    summary,
    sources,
    durationMs: Date.now() - start,
  };
}

// ─── Tool: search_customers ───────────────────────────────────────────────────
async function searchCustomers(q: string): Promise<ToolResult> {
  const start = Date.now();
  const where: Record<string, unknown> = {};
  if (q && !q.match(/all|list|show|customer/i)) {
    where.OR = [
      { tradeName: { contains: q } },
      { legalName: { contains: q } },
      { gstin: { contains: q } },
    ];
  }
  const clients = await db.client.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 });
  // Attach per-customer outstanding
  const clientIds = clients.map((c) => c.id);
  const invoices = clientIds.length
    ? await db.invoice.groupBy({
        by: ['clientId'],
        where: { clientId: { in: clientIds } },
        _sum: { totalAmount: true, balanceAmount: true },
        _count: true,
      })
    : [];
  const invMap = new Map(invoices.map((i) => [i.clientId, i]));
  const sources: SourceRef[] = clients.map((c) => ({
    kind: 'client' as const,
    id: c.id,
    label: `${c.tradeName} • ${c.gstin}`,
    status: c.status,
    date: c.createdAt.toISOString(),
  }));
  const summary = JSON.stringify(clients.slice(0, 25).map((c) => {
    const inv = invMap.get(c.id);
    return {
      name: c.tradeName,
      gstin: c.gstin,
      state: c.state,
      status: c.status,
      healthScore: c.healthScore,
      invoiceCount: inv?._count ?? 0,
      totalInvoiced: round2(inv?._sum.totalAmount ?? 0),
      outstanding: round2(inv?._sum.balanceAmount ?? 0),
    };
  }));
  return {
    name: 'search_customers',
    label: 'Search Customers',
    recordCount: clients.length,
    summary,
    sources,
    durationMs: Date.now() - start,
  };
}

// ─── Tool: search_vendors ─────────────────────────────────────────────────────
async function searchVendors(q: string): Promise<ToolResult> {
  const start = Date.now();
  const where: Record<string, unknown> = {};
  if (q && !q.match(/all|list|show|vendor/i)) {
    where.OR = [{ name: { contains: q } }, { gstin: { contains: q } }];
  }
  const rows = await db.vendor.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 });
  const sources: SourceRef[] = rows.map((r) => ({
    kind: 'vendor' as const,
    id: r.id,
    label: `${r.name} • ${r.gstin || 'No GSTIN'}`,
    amount: round2(r.outstanding),
    status: r.status,
    date: r.createdAt.toISOString(),
  }));
  const summary = JSON.stringify(rows.slice(0, 25).map((r) => ({
    name: r.name,
    gstin: r.gstin,
    category: r.category,
    outstanding: round2(r.outstanding),
    status: r.status,
  })));
  return {
    name: 'search_vendors',
    label: 'Search Vendors',
    recordCount: rows.length,
    summary,
    sources,
    durationMs: Date.now() - start,
  };
}

// ─── Tool: search_expenses ────────────────────────────────────────────────────
async function searchExpenses(q: string): Promise<ToolResult> {
  const start = Date.now();
  const where: Record<string, unknown> = {};
  if (q.match(/salary|payroll/i)) where.category = 'Salary';
  else if (q.match(/rent/i)) where.category = 'Rent';
  else if (q.match(/travel/i)) where.category = 'Travel';
  else if (q.match(/marketing/i)) where.category = 'Marketing';
  else if (q.match(/software|saas|subscription/i)) where.category = 'Software';
  else if (q.match(/utilities|electric|internet/i)) where.category = 'Utilities';
  else if (q.match(/office/i)) where.category = 'Office';
  const rows = await db.expense.findMany({ where, orderBy: { date: 'desc' }, take: 50 });
  const sources: SourceRef[] = rows.map((r) => ({
    kind: 'expense' as const,
    id: r.id,
    label: `${r.description || r.category} • ₹${inr(r.amount)}`,
    amount: round2(r.amount),
    date: r.date,
    status: r.status,
  }));
  const summary = JSON.stringify(rows.slice(0, 25).map((r) => ({
    desc: r.description,
    category: r.category,
    vendor: r.vendor,
    amount: round2(r.amount),
    gst: round2(r.gst),
    gstClaimable: r.gstClaimable,
    date: r.date,
    mode: r.paymentMode,
  })));
  return {
    name: 'search_expenses',
    label: 'Search Expenses',
    recordCount: rows.length,
    summary,
    sources,
    durationMs: Date.now() - start,
  };
}

// ─── Tool: search_purchases ───────────────────────────────────────────────────
async function searchPurchases(q: string): Promise<ToolResult> {
  const start = Date.now();
  const where: Record<string, unknown> = {};
  if (q.match(/unpaid|outstanding|payable/i)) where.paymentStatus = { in: ['unpaid', 'partial'] };
  const rows = await db.purchaseBill.findMany({ where, orderBy: { invoiceDate: 'desc' }, take: 50 });
  const sources: SourceRef[] = rows.map((r) => ({
    kind: 'purchaseBill' as const,
    id: r.id,
    label: `${r.vendorName} • ${r.invoiceNo}`,
    amount: round2(r.totalAmount),
    date: r.invoiceDate,
    status: r.paymentStatus,
  }));
  const summary = JSON.stringify(rows.slice(0, 25).map((r) => ({
    vendor: r.vendorName,
    no: r.invoiceNo,
    total: round2(r.totalAmount),
    balance: round2(r.balanceAmount),
    gst: round2(r.gstAmount),
    status: r.paymentStatus,
    date: r.invoiceDate,
    due: r.dueDate,
  })));
  return {
    name: 'search_purchases',
    label: 'Search Purchase Bills',
    recordCount: rows.length,
    summary,
    sources,
    durationMs: Date.now() - start,
  };
}

// ─── Tool: search_gst_returns ─────────────────────────────────────────────────
async function searchGstReturns(q: string): Promise<ToolResult> {
  const start = Date.now();
  const [returns, filings] = await Promise.all([
    db.gSTReturn.findMany({ orderBy: { period: 'desc' }, take: 50 }),
    db.gSTRFiling.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);
  const sources: SourceRef[] = [
    ...returns.map((r) => ({
      kind: 'gstReturn' as const, id: r.id, label: `${r.type} • ${r.period}`,
      amount: round2(r.totalTax), date: r.filedAt?.toISOString() || r.createdAt.toISOString(), status: r.status,
    })),
    ...filings.map((r) => ({
      kind: 'gstFiling' as const, id: r.id, label: `${r.returnType} • ${r.period}`,
      amount: round2(r.totalTax), date: r.filedDate || r.createdAt.toISOString(), status: r.status,
    })),
  ];
  const summary = JSON.stringify({
    gstReturns: returns.slice(0, 20).map((r) => ({
      type: r.type, period: r.period, status: r.status,
      totalTax: round2(r.totalTax), totalITC: round2(r.totalITC),
      filedAt: r.filedAt?.toISOString(),
    })),
    gstFilings: filings.slice(0, 20).map((r) => ({
      type: r.returnType, period: r.period, status: r.status,
      invoices: r.totalInvoices, tax: round2(r.totalTax),
      filedDate: r.filedDate,
    })),
  });
  return {
    name: 'search_gst_returns',
    label: 'Search GST Returns',
    recordCount: returns.length + filings.length,
    summary,
    sources,
    durationMs: Date.now() - start,
  };
}

// ─── Tool: search_tds ─────────────────────────────────────────────────────────
async function searchTds(): Promise<ToolResult> {
  const start = Date.now();
  const rows = await db.tDSRecord.findMany({ orderBy: { date: 'desc' }, take: 50 });
  const sources: SourceRef[] = rows.map((r) => ({
    kind: 'tds' as const, id: r.id, label: `${r.section} • ${r.deducteeName}`,
    amount: round2(r.tdsAmount), date: r.date, status: r.status,
  }));
  const summary = JSON.stringify(rows.slice(0, 25).map((r) => ({
    section: r.section, deductee: r.deducteeName, pan: r.deducteePan,
    payment: round2(r.paymentAmount), tds: round2(r.tdsAmount),
    rate: r.tdsRate, quarter: r.quarter, status: r.status, date: r.date,
  })));
  return {
    name: 'search_tds',
    label: 'Search TDS Records',
    recordCount: rows.length,
    summary,
    sources,
    durationMs: Date.now() - start,
  };
}

// ─── Tool: search_emails ──────────────────────────────────────────────────────
async function searchEmails(): Promise<ToolResult> {
  const start = Date.now();
  const rows = await db.emailMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  const sources: SourceRef[] = rows.map((r) => ({
    kind: 'email' as const, id: r.id, label: r.subject,
    date: r.sentAt?.toISOString() || r.createdAt.toISOString(), status: r.status,
  }));
  const summary = JSON.stringify(rows.slice(0, 25).map((r) => ({
    subject: r.subject, to: r.recipientEmail, category: r.category,
    status: r.status, sentAt: r.sentAt?.toISOString(),
  })));
  return {
    name: 'search_emails',
    label: 'Search Emails',
    recordCount: rows.length,
    summary,
    sources,
    durationMs: Date.now() - start,
  };
}

// ─── Tool: search_bank_transactions ───────────────────────────────────────────
async function searchBankTxns(q: string): Promise<ToolResult> {
  const start = Date.now();
  const where: Record<string, unknown> = {};
  if (q.match(/credit|deposit|incoming/i)) where.type = 'credit';
  else if (q.match(/debit|withdraw|outgoing/i)) where.type = 'debit';
  const rows = await db.bankTransaction.findMany({ where, orderBy: { date: 'desc' }, take: 50 });
  const sources: SourceRef[] = rows.map((r) => ({
    kind: 'bankTransaction' as const, id: r.id, label: `${r.type} • ${r.description}`,
    amount: round2(r.amount), date: r.date.toISOString(), status: r.matched ? 'reconciled' : 'unreconciled',
  }));
  const summary = JSON.stringify(rows.slice(0, 25).map((r) => ({
    type: r.type, desc: r.description, amount: round2(r.amount),
    category: r.category, matched: r.matched, date: r.date.toISOString(),
  })));
  return {
    name: 'search_bank_transactions',
    label: 'Search Bank Transactions',
    recordCount: rows.length,
    summary,
    sources,
    durationMs: Date.now() - start,
  };
}

// ─── Tool: receivables_summary ────────────────────────────────────────────────
async function receivablesSummary(): Promise<ToolResult> {
  const start = Date.now();
  const nowIso = new Date().toISOString();
  const [all, overdue, partial, unpaid] = await Promise.all([
    db.invoice.findMany({
      where: { balanceAmount: { gt: 0 } },
      orderBy: { dueDate: 'asc' },
      take: 50,
      include: { client: { select: { tradeName: true } } },
    }),
    db.invoice.aggregate({
      where: { paymentStatus: { not: 'paid' }, dueDate: { lt: nowIso, not: null }, balanceAmount: { gt: 0 } },
      _sum: { balanceAmount: true }, _count: true,
    }),
    db.invoice.aggregate({ where: { paymentStatus: 'partial' }, _sum: { balanceAmount: true }, _count: true }),
    db.invoice.aggregate({ where: { paymentStatus: 'unpaid' }, _sum: { balanceAmount: true }, _count: true }),
  ]);
  const sources: SourceRef[] = all.slice(0, 25).map((r) => ({
    kind: 'invoice' as const, id: r.id,
    label: `${r.invoiceNumber} • ${r.buyerName || r.client?.tradeName || '—'}`,
    amount: round2(r.balanceAmount), date: r.dueDate || r.invoiceDate, status: r.paymentStatus,
  }));
  const summary = JSON.stringify({
    totals: {
      overdue: { count: overdue._count, amount: round2(overdue._sum.balanceAmount || 0) },
      partial: { count: partial._count, amount: round2(partial._sum.balanceAmount || 0) },
      unpaid: { count: unpaid._count, amount: round2(unpaid._sum.balanceAmount || 0) },
    },
    openInvoices: all.slice(0, 25).map((r) => ({
      no: r.invoiceNumber, buyer: r.buyerName || r.client?.tradeName,
      balance: round2(r.balanceAmount), due: r.dueDate, status: r.paymentStatus,
      daysOverdue: r.dueDate ? daysSince(r.dueDate) : null,
    })),
  });
  return {
    name: 'receivables_summary',
    label: 'Receivables Summary',
    recordCount: all.length,
    summary,
    sources,
    durationMs: Date.now() - start,
  };
}

// ─── Tool: payables_summary ───────────────────────────────────────────────────
async function payablesSummary(): Promise<ToolResult> {
  const start = Date.now();
  const [bills, vendorAgg] = await Promise.all([
    db.purchaseBill.findMany({
      where: { balanceAmount: { gt: 0 } },
      orderBy: { dueDate: 'asc' },
      take: 50,
    }),
    db.vendor.aggregate({ _sum: { outstanding: true }, _count: true }),
  ]);
  const sources: SourceRef[] = bills.slice(0, 25).map((r) => ({
    kind: 'purchaseBill' as const, id: r.id,
    label: `${r.vendorName} • ${r.invoiceNo}`,
    amount: round2(r.balanceAmount), date: r.dueDate || r.invoiceDate, status: r.paymentStatus,
  }));
  const summary = JSON.stringify({
    totalVendorOutstanding: round2(vendorAgg._sum.outstanding || 0),
    vendorCount: vendorAgg._count,
    openBills: bills.slice(0, 25).map((r) => ({
      vendor: r.vendorName, no: r.invoiceNo, balance: round2(r.balanceAmount),
      due: r.dueDate, status: r.paymentStatus,
    })),
  });
  return {
    name: 'payables_summary',
    label: 'Payables Summary',
    recordCount: bills.length,
    summary,
    sources,
    durationMs: Date.now() - start,
  };
}

// ─── Tool: cash_flow_summary ──────────────────────────────────────────────────
async function cashFlowSummary(): Promise<ToolResult> {
  const start = Date.now();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [bankAgg, inRecv, inSent, expensesThis, expensesLast, payroll] = await Promise.all([
    db.bankAccount.aggregate({ _sum: { balance: true } }),
    db.payment.aggregate({ where: { partyType: 'customer', paymentDate: { gte: monthStart.toISOString().slice(0, 10) } }, _sum: { amount: true } }),
    db.payment.aggregate({ where: { partyType: 'vendor', paymentDate: { gte: monthStart.toISOString().slice(0, 10) } }, _sum: { amount: true } }),
    db.expense.aggregate({ where: { date: { gte: monthStart.toISOString().slice(0, 10) } }, _sum: { amount: true } }),
    db.expense.aggregate({ where: { date: { gte: lastMonthStart.toISOString().slice(0, 10), lte: lastMonthEnd.toISOString().slice(0, 10) } }, _sum: { amount: true } }),
    db.employee.aggregate({ _sum: { netSalary: true }, _count: true }),
  ]);

  const monthlyBurn = round2((expensesThis._sum.amount || 0) + (payroll._sum.netSalary || 0) + (inSent._sum.amount || 0));
  const bankBalance = round2(bankAgg._sum.balance || 0);
  const runwayDays = monthlyBurn > 0 ? Math.floor(bankBalance / (monthlyBurn / Math.max(1, now.getDate()))) : null;

  const summary = JSON.stringify({
    bankBalance: inr(bankBalance),
    thisMonth: {
      inflow: inr(inRecv._sum.amount || 0),
      outflow: inr(inSent._sum.amount || 0),
      expenses: inr(expensesThis._sum.amount || 0),
      payroll: inr(payroll._sum.netSalary || 0),
      netCash: inr(round2((inRecv._sum.amount || 0) - monthlyBurn)),
    },
    lastMonthExpenses: inr(expensesLast._sum.amount || 0),
    monthlyBurnRate: inr(monthlyBurn),
    cashRunwayDays: runwayDays,
    employeeCount: payroll._count,
    runwayStatus: runwayDays === null ? 'unknown' : runwayDays < 30 ? 'critical' : runwayDays < 90 ? 'warning' : 'healthy',
  });

  return {
    name: 'cash_flow_summary',
    label: 'Cash Flow Summary',
    recordCount: payroll._count,
    summary,
    sources: [],
    durationMs: Date.now() - start,
  };
}

// ─── Tool: gst_liability ──────────────────────────────────────────────────────
async function gstLiability(): Promise<ToolResult> {
  const start = Date.now();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const [salesAgg, purchaseAgg, gstReturns] = await Promise.all([
    db.invoice.aggregate({ where: { invoiceDate: { gte: monthStart } }, _sum: { taxableValue: true, gstAmount: true, cgst: true, sgst: true, igst: true, totalAmount: true }, _count: true }),
    db.purchaseBill.aggregate({ where: { invoiceDate: { gte: monthStart } }, _sum: { taxableValue: true, gstAmount: true }, _count: true }),
    db.gSTReturn.findMany({ orderBy: { period: 'desc' }, take: 6 }),
  ]);
  const outputTax = round2(salesAgg._sum.gstAmount || 0);
  const inputTax = round2(purchaseAgg._sum.gstAmount || 0);
  const netLiability = round2(outputTax - inputTax);
  const summary = JSON.stringify({
    thisMonth: {
      outputTax: inr(outputTax),
      inputTax_ITC: inr(inputTax),
      netLiability: inr(netLiability),
      salesTaxable: inr(salesAgg._sum.taxableValue || 0),
      purchaseTaxable: inr(purchaseAgg._sum.taxableValue || 0),
      invoiceCount: salesAgg._count,
      billCount: purchaseAgg._count,
    },
    recentReturns: gstReturns.map((r) => ({
      type: r.type, period: r.period, status: r.status,
      tax: round2(r.totalTax), itc: round2(r.totalITC),
    })),
  });
  const sources: SourceRef[] = gstReturns.slice(0, 5).map((r) => ({
    kind: 'gstReturn' as const, id: r.id, label: `${r.type} • ${r.period}`,
    amount: round2(r.totalTax), status: r.status,
  }));
  return {
    name: 'gst_liability',
    label: 'GST Liability',
    recordCount: gstReturns.length,
    summary,
    sources,
    durationMs: Date.now() - start,
  };
}

// ─── Tool: overdue_invoices ───────────────────────────────────────────────────
async function overdueInvoices(): Promise<ToolResult> {
  const start = Date.now();
  const nowIso = new Date().toISOString();
  const rows = await db.invoice.findMany({
    where: { paymentStatus: { not: 'paid' }, dueDate: { lt: nowIso, not: null }, balanceAmount: { gt: 0 } },
    orderBy: { dueDate: 'asc' },
    take: 50,
    include: { client: { select: { tradeName: true, contactEmail: true, contactPhone: true } } },
  });
  const sources: SourceRef[] = rows.map((r) => ({
    kind: 'invoice' as const, id: r.id,
    label: `${r.invoiceNumber} • ${r.buyerName || r.client?.tradeName || '—'}`,
    amount: round2(r.balanceAmount), date: r.dueDate, status: r.paymentStatus,
  }));
  const summary = JSON.stringify(rows.slice(0, 25).map((r) => ({
    no: r.invoiceNumber, buyer: r.buyerName || r.client?.tradeName,
    email: r.client?.contactEmail, phone: r.client?.contactPhone,
    balance: round2(r.balanceAmount), total: round2(r.totalAmount),
    due: r.dueDate, daysOverdue: r.dueDate ? daysSince(r.dueDate) : null,
  })));
  return {
    name: 'overdue_invoices',
    label: 'Overdue Invoices',
    recordCount: rows.length,
    summary,
    sources,
    durationMs: Date.now() - start,
  };
}

// ─── Tool: customer_followups ─────────────────────────────────────────────────
async function customerFollowups(): Promise<ToolResult> {
  const start = Date.now();
  const nowIso = new Date().toISOString();
  // Customers with overdue or unpaid invoices needing follow-up
  const invoices = await db.invoice.findMany({
    where: { paymentStatus: { in: ['unpaid', 'partial'] }, balanceAmount: { gt: 0 } },
    orderBy: { dueDate: 'asc' },
    take: 50,
    include: { client: { select: { id: true, tradeName: true, contactEmail: true, contactPhone: true, gstin: true } } },
  });
  // Group by client
  const byClient = new Map<string, { client: typeof invoices[number]['client']; invoices: typeof invoices }>();
  for (const inv of invoices) {
    if (!inv.client) continue;
    const existing = byClient.get(inv.client.id);
    if (existing) existing.invoices.push(inv);
    else byClient.set(inv.client.id, { client: inv.client, invoices: [inv] });
  }
  const sources: SourceRef[] = invoices.slice(0, 25).map((r) => ({
    kind: 'invoice' as const, id: r.id,
    label: `${r.invoiceNumber} • ${r.client?.tradeName || '—'}`,
    amount: round2(r.balanceAmount), date: r.dueDate, status: r.paymentStatus,
  }));
  const summary = JSON.stringify({
    customersNeedingFollowup: Array.from(byClient.values()).slice(0, 20).map(({ client, invoices }) => ({
      customer: client.tradeName, gstin: client.gstin,
      email: client.contactEmail, phone: client.contactPhone,
      openInvoices: invoices.length,
      totalOutstanding: round2(invoices.reduce((s, i) => s + i.balanceAmount, 0)),
      oldestDue: invoices[0]?.dueDate,
      hasOverdue: invoices.some((i) => i.dueDate && new Date(i.dueDate) < new Date(nowIso)),
    })),
  });
  return {
    name: 'customer_followups',
    label: 'Customer Follow-ups',
    recordCount: byClient.size,
    summary,
    sources,
    durationMs: Date.now() - start,
  };
}

// ─── Tool: revenue_trend ──────────────────────────────────────────────────────
async function revenueTrend(): Promise<ToolResult> {
  const start = Date.now();
  // Last 6 months revenue + collection
  const now = new Date();
  const months: { label: string; start: string; end: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const s = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const e = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    months.push({
      label: s.toLocaleString('en-IN', { month: 'short', year: '2-digit' }),
      start: s.toISOString().slice(0, 10),
      end: e.toISOString().slice(0, 10),
    });
  }
  const data = await Promise.all(months.map(async (m) => {
    const [inv, paid] = await Promise.all([
      db.invoice.aggregate({ where: { invoiceDate: { gte: m.start, lte: m.end } }, _sum: { totalAmount: true }, _count: true }),
      db.payment.aggregate({ where: { partyType: 'customer', paymentDate: { gte: m.start, lte: m.end } }, _sum: { amount: true } }),
    ]);
    return { month: m.label, invoiced: round2(inv._sum.totalAmount || 0), collected: round2(paid._sum.amount || 0), invoiceCount: inv._count };
  }));
  const summary = JSON.stringify({ monthlyTrend: data });
  return {
    name: 'revenue_trend',
    label: 'Revenue Trend (6 months)',
    recordCount: data.reduce((s, d) => s + d.invoiceCount, 0),
    summary,
    sources: [],
    durationMs: Date.now() - start,
  };
}

// ─── Tool: expense_breakdown ──────────────────────────────────────────────────
async function expenseBreakdown(): Promise<ToolResult> {
  const start = Date.now();
  const grouped = await db.expense.groupBy({
    by: ['category'],
    _sum: { amount: true, gst: true },
    _count: true,
    orderBy: { _sum: { amount: 'desc' } },
  });
  const total = grouped.reduce((s, g) => s + (g._sum.amount || 0), 0);
  const summary = JSON.stringify({
    totalExpenses: round2(total),
    byCategory: grouped.map((g) => ({
      category: g.category,
      amount: round2(g._sum.amount || 0),
      gst: round2(g._sum.gst || 0),
      count: g._count,
      pctOfTotal: total > 0 ? Math.round(((g._sum.amount || 0) / total) * 100) : 0,
    })),
  });
  return {
    name: 'expense_breakdown',
    label: 'Expense Breakdown',
    recordCount: grouped.reduce((s, g) => s + g._count, 0),
    summary,
    sources: [],
    durationMs: Date.now() - start,
  };
}

// ─── Tool: executive_kpis ─────────────────────────────────────────────────────
async function executiveKpis(): Promise<ToolResult> {
  const start = Date.now();
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const nowIso = now.toISOString();
  const [
    rev30, coll30, exp30, outstanding, overdueAgg, bankAgg,
    activeCustomers, activeVendors, employees, gstThisMonth,
  ] = await Promise.all([
    db.invoice.aggregate({ where: { invoiceDate: { gte: d30 } }, _sum: { totalAmount: true } }),
    db.payment.aggregate({ where: { partyType: 'customer', paymentDate: { gte: d30 } }, _sum: { amount: true } }),
    db.expense.aggregate({ where: { date: { gte: d30 } }, _sum: { amount: true } }),
    db.invoice.aggregate({ _sum: { balanceAmount: true }, _count: { balanceAmount: true } }),
    db.invoice.aggregate({ where: { paymentStatus: { not: 'paid' }, dueDate: { lt: nowIso, not: null }, balanceAmount: { gt: 0 } }, _sum: { balanceAmount: true }, _count: true }),
    db.bankAccount.aggregate({ _sum: { balance: true }, _count: true }),
    db.client.count({ where: { status: 'active' } }),
    db.vendor.count({ where: { status: 'active' } }),
    db.employee.aggregate({ _sum: { netSalary: true }, _count: true }),
    db.invoice.aggregate({ where: { invoiceDate: { gte: monthStart } }, _sum: { gstAmount: true } }),
  ]);
  const monthlyBurn = round2((exp30._sum.amount || 0) + (employees._sum.netSalary || 0));
  const bankBalance = round2(bankAgg._sum.balance || 0);
  const runwayDays = monthlyBurn > 0 ? Math.floor(bankBalance / (monthlyBurn / 30)) : null;
  const summary = JSON.stringify({
    kpis: {
      revenue30d: inr(rev30._sum.totalAmount || 0),
      collected30d: inr(coll30._sum.amount || 0),
      outstandingNow: inr(outstanding._sum.balanceAmount || 0),
      overdueNow: inr(overdueAgg._sum.balanceAmount || 0),
      overdueCount: overdueAgg._count,
      expenses30d: inr(exp30._sum.amount || 0),
      gstThisMonth: inr(gstThisMonth._sum.gstAmount || 0),
      bankBalance: inr(bankBalance),
      activeCustomers, activeVendors,
      employeeCount: employees._count,
      monthlyPayroll: inr(employees._sum.netSalary || 0),
      cashRunwayDays: runwayDays,
      collectionRate: rev30._sum.totalAmount ? Math.round(((coll30._sum.amount || 0) / rev30._sum.totalAmount) * 100) : 0,
    },
  });
  return {
    name: 'executive_kpis',
    label: 'Executive KPIs',
    recordCount: activeCustomers + activeVendors + employees._count,
    summary,
    sources: [],
    durationMs: Date.now() - start,
  };
}

// ─── Tool dispatcher ──────────────────────────────────────────────────────────

export const TOOL_DEFINITIONS: Record<ToolName, { label: string; description: string; keywords: string[] }> = {
  memory_snapshot: { label: 'Company Memory Snapshot', description: 'Full company memory: totals, counts, financials across all modules', keywords: ['company', 'overview', 'summary', 'snapshot', 'memory', 'everything', 'business'] },
  search_invoices: { label: 'Search Invoices', description: 'Search invoices by status (overdue, unpaid, paid), amount, or buyer', keywords: ['invoice', 'sale', 'billed', 'receivable', 'outstanding', 'overdue', 'unpaid'] },
  search_payments: { label: 'Search Payments', description: 'Search payments received from customers or sent to vendors', keywords: ['payment', 'received', 'sent', 'collected', 'paid', 'transaction', 'utr'] },
  search_customers: { label: 'Search Customers', description: 'Search customers/clients by name, GSTIN, or list all with outstanding', keywords: ['customer', 'client', 'buyer', 'who owes', 'trade'] },
  search_vendors: { label: 'Search Vendors', description: 'Search vendors/suppliers by name or GSTIN', keywords: ['vendor', 'supplier', 'payable', 'owe to', 'seller'] },
  search_expenses: { label: 'Search Expenses', description: 'Search expenses by category (salary, rent, travel, marketing, software)', keywords: ['expense', 'spend', 'cost', 'salary', 'rent', 'travel', 'marketing', 'software', 'utilities'] },
  search_purchases: { label: 'Search Purchase Bills', description: 'Search purchase bills from vendors', keywords: ['purchase', 'bill', 'procurement', 'supplier bill'] },
  search_gst_returns: { label: 'Search GST Returns', description: 'GST returns and filings (GSTR-1, GSTR-3B) with tax and ITC', keywords: ['gst', 'return', 'filing', 'gstr', 'itc', 'input tax', 'output tax', 'liability'] },
  search_tds: { label: 'Search TDS Records', description: 'TDS deducted records by section (194C, 194J, etc.)', keywords: ['tds', 'tax deducted', '194c', '194j', 'deductee'] },
  search_emails: { label: 'Search Emails', description: 'Emails sent to customers/vendors', keywords: ['email', 'mail', 'sent', 'reminder', 'communication'] },
  search_bank_transactions: { label: 'Search Bank Transactions', description: 'Bank account transactions (credits, debits, reconciliation)', keywords: ['bank', 'transaction', 'deposit', 'withdraw', 'reconcile', 'statement'] },
  receivables_summary: { label: 'Receivables Summary', description: 'Open receivables: overdue, partial, unpaid invoices with aging', keywords: ['receivable', 'outstanding', 'owed', 'collect', 'aging', 'follow'] },
  payables_summary: { label: 'Payables Summary', description: 'Open payables to vendors with outstanding amounts', keywords: ['payable', 'owe', 'vendor outstanding', 'supplier payable'] },
  cash_flow_summary: { label: 'Cash Flow Summary', description: 'Cash position: bank balance, monthly burn, runway in days', keywords: ['cash', 'flow', 'runway', 'burn', 'bank balance', 'liquidity', 'survive'] },
  gst_liability: { label: 'GST Liability', description: 'Output tax, input tax (ITC), net GST payable this period', keywords: ['gst', 'liability', 'pay', 'output', 'input', 'itc', 'net', 'tax'] },
  overdue_invoices: { label: 'Overdue Invoices', description: 'Invoices past due date with days overdue and customer contacts', keywords: ['overdue', 'late', 'past due', 'delayed', 'unpaid'] },
  customer_followups: { label: 'Customer Follow-ups', description: 'Customers needing follow-up with open invoices and contacts', keywords: ['follow', 'followup', 'chase', 'remind', 'collect', 'call'] },
  revenue_trend: { label: 'Revenue Trend', description: '6-month revenue and collection trend', keywords: ['revenue', 'trend', 'growth', 'month', 'sales trend', 'chart'] },
  expense_breakdown: { label: 'Expense Breakdown', description: 'Expenses grouped by category with percentages', keywords: ['expense', 'breakdown', 'category', 'spend', 'where', 'distribution'] },
  executive_kpis: { label: 'Executive KPIs', description: 'All key metrics: revenue, collection, outstanding, runway, employees', keywords: ['kpi', 'metric', 'dashboard', 'health', 'score', 'performance', 'overview'] },
};

export async function executeTool(name: ToolName, query: string): Promise<ToolResult> {
  try {
    switch (name) {
      case 'memory_snapshot': return await memorySnapshot();
      case 'search_invoices': return await searchInvoices(query);
      case 'search_payments': return await searchPayments(query);
      case 'search_customers': return await searchCustomers(query);
      case 'search_vendors': return await searchVendors(query);
      case 'search_expenses': return await searchExpenses(query);
      case 'search_purchases': return await searchPurchases(query);
      case 'search_gst_returns': return await searchGstReturns(query);
      case 'search_tds': return await searchTds();
      case 'search_emails': return await searchEmails();
      case 'search_bank_transactions': return await searchBankTxns(query);
      case 'receivables_summary': return await receivablesSummary();
      case 'payables_summary': return await payablesSummary();
      case 'cash_flow_summary': return await cashFlowSummary();
      case 'gst_liability': return await gstLiability();
      case 'overdue_invoices': return await overdueInvoices();
      case 'customer_followups': return await customerFollowups();
      case 'revenue_trend': return await revenueTrend();
      case 'expense_breakdown': return await expenseBreakdown();
      case 'executive_kpis': return await executiveKpis();
      default: return { name, label: name, recordCount: 0, summary: '{}', sources: [], durationMs: 0 };
    }
  } catch (err) {
    return {
      name, label: TOOL_DEFINITIONS[name]?.label || name, recordCount: 0,
      summary: JSON.stringify({ error: err instanceof Error ? err.message : 'Tool failed' }),
      sources: [], durationMs: 0,
    };
  }
}
