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
  // Customers with overdue, unpaid, or partially-paid invoices needing follow-up.
  // IMPORTANT: 'overdue' MUST be included — an invoice marked 'overdue' is, by
  // definition, a customer who needs follow-up. Excluding it would cause the
  // agent to falsely report "no customers need follow-up" while simultaneously
  // reporting overdue invoices (a contradiction). See Oracle UX Restructure.
  const invoices = await db.invoice.findMany({
    where: { paymentStatus: { in: ['unpaid', 'partial', 'overdue'] }, balanceAmount: { gt: 0 } },
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
  // Build summary with explicit, action-oriented fields so the LLM cannot
  // misinterpret "0 follow-ups" when overdue invoices exist.
  const customersNeedingFollowup = Array.from(byClient.values()).slice(0, 20).map(({ client, invoices }) => {
    const overdueInvs = invoices.filter((i) => i.dueDate && new Date(i.dueDate) < new Date(nowIso));
    const oldestOverdue = overdueInvs[0];
    const daysOverdue = oldestOverdue?.dueDate ? daysSince(oldestOverdue.dueDate) : null;
    return {
      customer: client.tradeName,
      gstin: client.gstin,
      email: client.contactEmail,
      phone: client.contactPhone,
      openInvoices: invoices.length,
      overdueInvoices: overdueInvs.length,
      totalOutstanding: round2(invoices.reduce((s, i) => s + i.balanceAmount, 0)),
      overdueAmount: round2(overdueInvs.reduce((s, i) => s + i.balanceAmount, 0)),
      oldestDue: invoices[0]?.dueDate,
      daysOverdue,
      needsFollowUp: true, // explicit flag — this customer is in the follow-up list
      recommendedAction: daysOverdue && daysOverdue > 60
        ? 'URGENT: Send final payment reminder + call customer today'
        : daysOverdue && daysOverdue > 0
          ? 'Send payment reminder email + follow up by phone'
          : 'Monitor — invoice approaching due date',
    };
  });
  const summary = JSON.stringify({
    totalCustomersNeedingFollowUp: customersNeedingFollowup.length,
    totalOverdueAmount: round2(customersNeedingFollowup.reduce((s, c) => s + c.overdueAmount, 0)),
    customersNeedingFollowup,
    note: customersNeedingFollowup.length === 0
      ? 'No customers currently need follow-up (no open or overdue invoices with positive balance).'
      : `${customersNeedingFollowup.length} customer(s) have open invoices. Any customer with overdueInvoices > 0 MUST be followed up — do not state "no customers need follow-up" if any entry has overdueInvoices > 0.`,
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

// ─── Tool: period_comparison (e.g. "Compare June vs July") ───────────────────
// Parses two month names from the query, aggregates real invoices / payments /
// expenses / GST for each period, and returns the deltas. ZERO fabrication —
// if either month has no data, the comparison says so.
async function periodComparison(q: string): Promise<ToolResult> {
  const start = Date.now();
  const now = new Date();
  const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const MONTHS_SHORT = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const lower = q.toLowerCase();
  const found: { name: string; idx: number }[] = [];
  for (let i = 0; i < 12; i++) {
    if (lower.includes(MONTHS[i]) || lower.includes(MONTHS_SHORT[i])) found.push({ name: MONTHS[i], idx: i });
  }
  // Also support "this month" / "last month"
  let monthAIdx = -1, monthBIdx = -1, yearA = now.getFullYear(), yearB = now.getFullYear();
  if (found.length >= 2) {
    monthAIdx = found[0].idx; monthBIdx = found[1].idx;
    // If both months are in the past relative to now, and monthB < monthA, monthB is likely next year... but for simplicity keep same year unless crossing Dec->Jan
  } else {
    // Default: this month vs last month
    monthAIdx = now.getMonth();
    monthBIdx = now.getMonth() - 1;
    if (monthBIdx < 0) { monthBIdx = 11; yearB = now.getFullYear() - 1; }
  }
  const startA = new Date(yearA, monthAIdx, 1).toISOString().slice(0, 10);
  const endA = new Date(yearA, monthAIdx + 1, 0).toISOString().slice(0, 10);
  const startB = new Date(yearB, monthBIdx, 1).toISOString().slice(0, 10);
  const endB = new Date(yearB, monthBIdx + 1, 0).toISOString().slice(0, 10);
  const labelA = new Date(yearA, monthAIdx, 15).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const labelB = new Date(yearB, monthBIdx, 15).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  const [aInv, bInv, aPay, bPay, aExp, bExp, aGst, bGst] = await Promise.all([
    db.invoice.aggregate({ where: { invoiceDate: { gte: startA, lte: endA } }, _sum: { totalAmount: true, gstAmount: true }, _count: true }),
    db.invoice.aggregate({ where: { invoiceDate: { gte: startB, lte: endB } }, _sum: { totalAmount: true, gstAmount: true }, _count: true }),
    db.payment.aggregate({ where: { partyType: 'customer', paymentDate: { gte: startA, lte: endA } }, _sum: { amount: true } }),
    db.payment.aggregate({ where: { partyType: 'customer', paymentDate: { gte: startB, lte: endB } }, _sum: { amount: true } }),
    db.expense.aggregate({ where: { date: { gte: startA, lte: endA } }, _sum: { amount: true }, _count: true }),
    db.expense.aggregate({ where: { date: { gte: startB, lte: endB } }, _sum: { amount: true }, _count: true }),
    db.invoice.aggregate({ where: { invoiceDate: { gte: startA, lte: endA } }, _sum: { gstAmount: true } }),
    db.invoice.aggregate({ where: { invoiceDate: { gte: startB, lte: endB } }, _sum: { gstAmount: true } }),
  ]);
  const aRev = round2(aInv._sum.totalAmount || 0);
  const bRev = round2(bInv._sum.totalAmount || 0);
  const aColl = round2(aPay._sum.amount || 0);
  const bColl = round2(bPay._sum.amount || 0);
  const aExpT = round2(aExp._sum.amount || 0);
  const bExpT = round2(bExp._sum.amount || 0);
  const revDelta = bRev > 0 ? round2(((aRev - bRev) / bRev) * 100) : null;
  const expDelta = bExpT > 0 ? round2(((aExpT - bExpT) / bExpT) * 100) : null;
  const summary = JSON.stringify({
    periodA: { label: labelA, start: startA, end: endA },
    periodB: { label: labelB, start: startB, end: endB },
    revenue: { a: aRev, b: bRev, deltaPct: revDelta, direction: aRev > bRev ? 'up' : aRev < bRev ? 'down' : 'flat' },
    collected: { a: aColl, b: bColl },
    expenses: { a: aExpT, b: bExpT, deltaPct: expDelta },
    gstCollected: { a: round2(aGst._sum.gstAmount || 0), b: round2(bGst._sum.gstAmount || 0) },
    invoiceCount: { a: aInv._count, b: bInv._count },
    note: (aInv._count === 0 && bInv._count === 0) ? 'No invoice data for either period — comparison cannot be made.' : null,
  });
  const sources: SourceRef[] = [];
  // cite a couple of invoices from each period
  const [aRows, bRows] = await Promise.all([
    db.invoice.findMany({ where: { invoiceDate: { gte: startA, lte: endA } }, orderBy: { invoiceDate: 'desc' }, take: 3, include: { client: { select: { tradeName: true } } } }),
    db.invoice.findMany({ where: { invoiceDate: { gte: startB, lte: endB } }, orderBy: { invoiceDate: 'desc' }, take: 3, include: { client: { select: { tradeName: true } } } }),
  ]);
  for (const r of aRows) sources.push({ kind: 'invoice', id: r.id, label: `${labelA}: ${r.invoiceNumber} • ${r.buyerName || r.client?.tradeName || '—'}`, amount: round2(r.totalAmount), date: r.invoiceDate });
  for (const r of bRows) sources.push({ kind: 'invoice', id: r.id, label: `${labelB}: ${r.invoiceNumber} • ${r.buyerName || r.client?.tradeName || '—'}`, amount: round2(r.totalAmount), date: r.invoiceDate });
  return { name: 'period_comparison', label: `Compare ${labelA} vs ${labelB}`, recordCount: aInv._count + bInv._count, summary, sources, durationMs: Date.now() - start };
}

// ─── Tool: gst_forecast (project next month's GST from real trend) ─────────────
// Uses the last 3-6 months of REAL output tax (invoices) + ITC (purchase bills)
// to project next month's net GST liability. Clearly labeled as a projection —
// the LLM is instructed to mark it as such.
async function gstForecast(): Promise<ToolResult> {
  const start = Date.now();
  const now = new Date();
  const months: { label: string; start: string; end: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const s = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const e = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    months.push({ label: s.toLocaleString('en-IN', { month: 'short', year: '2-digit' }), start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) });
  }
  const data = await Promise.all(months.map(async (m) => {
    const [out, itc] = await Promise.all([
      db.invoice.aggregate({ where: { invoiceDate: { gte: m.start, lte: m.end } }, _sum: { gstAmount: true }, _count: true }),
      db.purchaseBill.aggregate({ where: { invoiceDate: { gte: m.start, lte: m.end } }, _sum: { gstAmount: true }, _count: true }),
    ]);
    return { month: m.label, outputTax: round2(out._sum.gstAmount || 0), itc: round2(itc._sum.gstAmount || 0), net: round2((out._sum.gstAmount || 0) - (itc._sum.gstAmount || 0)), invCount: out._count, billCount: itc._count };
  }));
  // Linear projection on net liability (last 3 months weighted toward recent)
  const recent = data.slice(-3).filter((d) => d.invCount > 0 || d.billCount > 0);
  let projectedNet: number | null = null;
  let basis = 'insufficient';
  if (recent.length >= 2) {
    // simple linear regression on net over the recent points
    const xs = recent.map((_, i) => i);
    const ys = recent.map((d) => d.net);
    const n = xs.length;
    const sx = xs.reduce((a, b) => a + b, 0);
    const sy = ys.reduce((a, b) => a + b, 0);
    const sxx = xs.reduce((a, b) => a + b * b, 0);
    const sxy = xs.reduce((a, b, i) => a + b * ys[i], 0);
    const slope = n * sxy - sx * sy !== 0 && (n * sxx - sx * sx) !== 0 ? (n * sxy - sx * sy) / (n * sxx - sx * sx) : 0;
    const intercept = (sy - slope * sx) / n;
    projectedNet = round2(Math.max(0, slope * n + intercept));
    basis = `linear projection over ${recent.length} months of real net GST data`;
  } else if (recent.length === 1) {
    projectedNet = recent[0].net;
    basis = 'single month of real data (flat carry-forward)';
  }
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const summary = JSON.stringify({
    history: data,
    projection: {
      forMonth: nextMonth,
      projectedNetLiability: projectedNet,
      basis,
      warning: projectedNet === null ? 'Not enough historical GST data to project. File at least 2 months of invoices and purchase bills.' : null,
    },
  });
  return { name: 'gst_forecast', label: 'GST Forecast (next month)', recordCount: data.reduce((s, d) => s + d.invCount + d.billCount, 0), summary, sources: [], durationMs: Date.now() - start };
}

// ─── Tool: vendor_price_trends (detect vendors who increased prices) ──────────
// Groups purchase bills by vendor, compares average bill total this period vs
// last period, and flags vendors whose average increased beyond a threshold.
async function vendorPriceTrends(): Promise<ToolResult> {
  const start = Date.now();
  const now = new Date();
  const thisStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const lastEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
  const [thisBills, lastBills] = await Promise.all([
    db.purchaseBill.findMany({ where: { invoiceDate: { gte: thisStart } }, select: { vendorName: true, totalAmount: true, taxableValue: true, invoiceDate: true, invoiceNo: true } }),
    db.purchaseBill.findMany({ where: { invoiceDate: { gte: lastStart, lte: lastEnd } }, select: { vendorName: true, totalAmount: true, taxableValue: true, invoiceDate: true, invoiceNo: true } }),
  ]);
  const agg = (rows: typeof thisBills) => {
    const m = new Map<string, { count: number; total: number; taxable: number }>();
    for (const r of rows) {
      const v = r.vendorName || 'Unknown';
      const e = m.get(v) ?? { count: 0, total: 0, taxable: 0 };
      e.count++; e.total += r.totalAmount || 0; e.taxable += r.taxableValue || 0;
      m.set(v, e);
    }
    return m;
  };
  const thisMap = agg(thisBills);
  const lastMap = agg(lastBills);
  const vendors: { name: string; thisAvg: number; lastAvg: number; changePct: number | null; direction: string; thisCount: number; lastCount: number }[] = [];
  for (const [name, t] of thisMap) {
    const l = lastMap.get(name);
    const thisAvg = round2(t.total / Math.max(1, t.count));
    const lastAvg = l ? round2(l.total / Math.max(1, l.count)) : 0;
    const changePct = l && lastAvg > 0 ? round2(((thisAvg - lastAvg) / lastAvg) * 100) : null;
    vendors.push({ name, thisAvg, lastAvg, changePct, direction: changePct === null ? 'new' : changePct > 2 ? 'up' : changePct < -2 ? 'down' : 'stable', thisCount: t.count, lastCount: l?.count ?? 0 });
  }
  vendors.sort((a, b) => (b.changePct ?? -999) - (a.changePct ?? -999));
  const increased = vendors.filter((v) => v.changePct !== null && v.changePct > 5);
  const sources: SourceRef[] = [];
  for (const v of increased.slice(0, 5)) {
    const rows = await db.purchaseBill.findMany({ where: { vendorName: v.name }, orderBy: { invoiceDate: 'desc' }, take: 2, select: { id: true, invoiceNo: true, totalAmount: true, invoiceDate: true } });
    for (const r of rows) sources.push({ kind: 'purchaseBill', id: r.id, label: `${v.name} • ${r.invoiceNo}`, amount: round2(r.totalAmount), date: r.invoiceDate });
  }
  const summary = JSON.stringify({
    thisMonthStart: thisStart, lastMonthStart: lastStart,
    vendorCount: thisMap.size,
    increased: increased.map((v) => ({ vendor: v.name, thisAvg: v.thisAvg, lastAvg: v.lastAvg, changePct: v.changePct, thisCount: v.thisCount, lastCount: v.lastCount })),
    allVendors: vendors.slice(0, 20),
    note: thisBills.length === 0 && lastBills.length === 0 ? 'No purchase bill data for either period — cannot detect price trends.' : null,
  });
  return { name: 'vendor_price_trends', label: 'Vendor Price Trends', recordCount: thisBills.length + lastBills.length, summary, sources, durationMs: Date.now() - start };
}

// ─── Tool: customer_churn_risk (flag customers likely to churn) ───────────────
// Real signals: no invoice in 60/90+ days, declining invoice frequency,
// high overdue ratio, or low collection rate. Computes a deterministic risk
// score 0-100 per customer from REAL data.
async function customerChurnRisk(): Promise<ToolResult> {
  const start = Date.now();
  const now = Date.now();
  const clients = await db.client.findMany({ where: { status: 'active' }, take: 100, select: { id: true, tradeName: true, gstin: true, contactEmail: true, createdAt: true } });
  if (clients.length === 0) {
    return { name: 'customer_churn_risk', label: 'Customer Churn Risk', recordCount: 0, summary: JSON.stringify({ customers: [], note: 'No active customers in the database.' }), sources: [], durationMs: Date.now() - start };
  }
  const invoices = await db.invoice.findMany({
    where: { clientId: { in: clients.map((c) => c.id) } },
    select: { clientId: true, invoiceDate: true, totalAmount: true, balanceAmount: true, paymentStatus: true },
    orderBy: { invoiceDate: 'desc' },
  });
  const byClient = new Map<string, typeof invoices>();
  for (const inv of invoices) {
    const arr = byClient.get(inv.clientId) ?? [];
    arr.push(inv); byClient.set(inv.clientId, arr);
  }
  const results = clients.map((c) => {
    const invs = byClient.get(c.id) ?? [];
    const lastInv = invs[0];
    const daysSinceLast = lastInv?.invoiceDate ? Math.floor((now - new Date(lastInv.invoiceDate).getTime()) / 86400000) : null;
    const totalInvoiced = invs.reduce((s, i) => s + (i.totalAmount || 0), 0);
    const outstanding = invs.reduce((s, i) => s + (i.balanceAmount || 0), 0);
    const overdue = invs.filter((i) => i.paymentStatus !== 'paid' && i.invoiceDate && new Date(i.invoiceDate) < new Date(now - 30 * 86400000)).reduce((s, i) => s + (i.balanceAmount || 0), 0);
    // Risk score (deterministic, 0-100)
    let risk = 0;
    if (daysSinceLast === null) risk += 60; // never invoiced
    else if (daysSinceLast > 90) risk += 50;
    else if (daysSinceLast > 60) risk += 30;
    else if (daysSinceLast > 45) risk += 15;
    if (totalInvoiced > 0 && outstanding / totalInvoiced > 0.5) risk += 25;
    if (invs.length > 0 && invs.length < 3) risk += 10; // low engagement
    risk = Math.min(100, risk);
    return { id: c.id, name: c.tradeName, gstin: c.gstin, email: c.contactEmail, daysSinceLastInvoice: daysSinceLast, invoiceCount: invs.length, totalInvoiced: round2(totalInvoiced), outstanding: round2(outstanding), overdue: round2(overdue), riskScore: risk, riskLevel: risk >= 60 ? 'high' : risk >= 35 ? 'medium' : 'low' };
  }).sort((a, b) => b.riskScore - a.riskScore);
  const sources: SourceRef[] = results.filter((r) => r.riskScore >= 35).slice(0, 10).map((r) => ({ kind: 'client', id: r.id, label: `${r.name} • risk ${r.riskScore}/100`, status: r.riskLevel, date: clients.find((c) => c.id === r.id)?.createdAt.toISOString() }));
  const summary = JSON.stringify({
    customers: results.slice(0, 25),
    highRisk: results.filter((r) => r.riskLevel === 'high').length,
    mediumRisk: results.filter((r) => r.riskLevel === 'medium').length,
    note: clients.length === 0 ? 'No customers to assess.' : null,
  });
  return { name: 'customer_churn_risk', label: 'Customer Churn Risk', recordCount: clients.length, summary, sources, durationMs: Date.now() - start };
}

// ─── Tool: board_summary (executive board-meeting briefing material) ──────────
// Aggregates everything an executive needs for a board meeting: revenue,
// collection, top customers, overdue, cash, GST status, headcount, key risks.
async function boardSummary(): Promise<ToolResult> {
  const start = Date.now();
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
  const nowIso = now.toISOString();
  const [revThis, revLast, coll30, exp30, outstanding, overdue, bank, topClients, gstThis, gstPending, employees, vendors] = await Promise.all([
    db.invoice.aggregate({ where: { invoiceDate: { gte: monthStart } }, _sum: { totalAmount: true }, _count: true }),
    db.invoice.aggregate({ where: { invoiceDate: { gte: lastMonthStart, lte: lastMonthEnd } }, _sum: { totalAmount: true }, _count: true }),
    db.payment.aggregate({ where: { partyType: 'customer', paymentDate: { gte: d30 } }, _sum: { amount: true } }),
    db.expense.aggregate({ where: { date: { gte: d30 } }, _sum: { amount: true }, _count: true }),
    db.invoice.aggregate({ _sum: { balanceAmount: true }, _count: true }),
    db.invoice.aggregate({ where: { paymentStatus: { not: 'paid' }, dueDate: { lt: nowIso, not: null }, balanceAmount: { gt: 0 } }, _sum: { balanceAmount: true }, _count: true }),
    db.bankAccount.aggregate({ _sum: { balance: true }, _count: true }),
    db.invoice.groupBy({ by: ['clientId'], _sum: { totalAmount: true }, orderBy: { _sum: { totalAmount: 'desc' } }, take: 5 }),
    db.invoice.aggregate({ where: { invoiceDate: { gte: monthStart } }, _sum: { gstAmount: true } }),
    db.gSTReturn.count({ where: { status: { in: ['not_started', 'draft'] } } }),
    db.employee.aggregate({ _sum: { netSalary: true }, _count: true }),
    db.vendor.aggregate({ _sum: { outstanding: true }, _count: true }),
  ]);
  const topClientIds = topClients.map((t) => t.clientId).filter(Boolean);
  const topClientRows = topClientIds.length ? await db.client.findMany({ where: { id: { in: topClientIds } }, select: { id: true, tradeName: true } }) : [];
  const clientName = new Map(topClientRows.map((c) => [c.id, c.tradeName]));
  const revThisAmt = round2(revThis._sum.totalAmount || 0);
  const revLastAmt = round2(revLast._sum.totalAmount || 0);
  const revDelta = revLastAmt > 0 ? round2(((revThisAmt - revLastAmt) / revLastAmt) * 100) : null;
  const monthlyBurn = round2((exp30._sum.amount || 0) + (employees._sum.netSalary || 0));
  const bankBalance = round2(bank._sum.balance || 0);
  const runway = monthlyBurn > 0 ? Math.floor(bankBalance / (monthlyBurn / 30)) : null;
  const summary = JSON.stringify({
    asOf: now.toISOString(),
    revenue: { thisMonth: revThisAmt, lastMonth: revLastAmt, deltaPct: revDelta, invoicesThisMonth: revThis._count },
    collections: { last30d: round2(coll30._sum.amount || 0), collectionRate: revThisAmt > 0 ? Math.round(((coll30._sum.amount || 0) / revThisAmt) * 100) : 0 },
    receivables: { outstanding: round2(outstanding._sum.balanceAmount || 0), overdue: round2(overdue._sum.balanceAmount || 0), overdueCount: overdue._count, openInvoices: outstanding._count },
    cash: { bankBalance, monthlyBurn, runwayDays: runway, accountCount: bank._count },
    gst: { collectedThisMonth: round2(gstThis._sum.gstAmount || 0), pendingReturns: gstPending },
    expenses: { last30d: round2(exp30._sum.amount || 0), count: exp30._count },
    payables: { vendorOutstanding: round2(vendors._sum.outstanding || 0), vendorCount: vendors._count },
    team: { headcount: employees._count, monthlyPayroll: round2(employees._sum.netSalary || 0) },
    topCustomers: topClients.map((t, i) => ({ rank: i + 1, name: clientName.get(t.clientId) || '—', revenue: round2(t._sum.totalAmount || 0) })),
    headlineRisks: [
      ...(overdue._count > 0 ? [`${overdue._count} overdue invoices worth ₹${inr(overdue._sum.balanceAmount || 0)}`] : []),
      ...(runway !== null && runway < 60 ? [`Cash runway only ${runway} days`] : []),
      ...(gstPending > 0 ? [`${gstPending} GST return(s) not filed`] : []),
      ...(revDelta !== null && revDelta < -10 ? [`Revenue down ${Math.abs(revDelta)}% MoM`] : []),
    ],
  });
  const sources: SourceRef[] = topClientRows.map((c) => ({ kind: 'client', id: c.id, label: c.tradeName }));
  return { name: 'board_summary', label: 'Board Meeting Summary', recordCount: revThis._count + outstanding._count + employees._count, summary, sources, durationMs: Date.now() - start };
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
  period_comparison: { label: 'Period Comparison', description: 'Compare two months or periods (e.g. June vs July) — revenue, expenses, GST deltas', keywords: ['compare', 'vs', 'versus', 'june', 'july', 'this month', 'last month', 'month over', 'mom', 'qoq', 'difference', 'delta', 'change'] },
  gst_forecast: { label: 'GST Forecast', description: 'Project next month GST liability from real output-tax and ITC trends', keywords: ['predict', 'forecast', 'projection', 'next month', 'estimate gst', 'gst will', 'expected gst', 'project gst'] },
  vendor_price_trends: { label: 'Vendor Price Trends', description: 'Detect vendors whose average bill amount increased this month vs last', keywords: ['vendor', 'price', 'increase', 'raised', 'cost up', 'supplier', 'vendor cost', 'price change', 'price trend'] },
  customer_churn_risk: { label: 'Customer Churn Risk', description: 'Flag customers likely to churn (no recent invoices, high overdue, low engagement)', keywords: ['churn', 'leaving', 'at risk', 'inactive', 'lost customer', 'customer risk', 'who may', 'might leave', 'stop ordering'] },
  board_summary: { label: 'Board Meeting Summary', description: 'Executive board-meeting briefing: revenue, collections, cash, GST, team, risks', keywords: ['board', 'meeting', 'briefing', 'summary for', 'investor', 'ceo report', 'cfo report', 'stakeholder', 'presentation'] },
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
      case 'period_comparison': return await periodComparison(query);
      case 'gst_forecast': return await gstForecast();
      case 'vendor_price_trends': return await vendorPriceTrends();
      case 'customer_churn_risk': return await customerChurnRisk();
      case 'board_summary': return await boardSummary();
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
