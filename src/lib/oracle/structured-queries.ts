// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Structured Query Engine (SERVER-ONLY)
// ═══════════════════════════════════════════════════════════════════════════════
//
// The Oracle chat streams natural-language answers from the LLM, but for
// specific structured questions ("show unpaid invoices", "top customers",
// "GST payable", etc.) we ALSO return a structured data card so the user
// gets an instant, accurate, table-grade answer alongside the prose.
//
// This module is imported ONLY by server-side route handlers because it
// uses Prisma (`db`) directly. Never import from a client component.
//
// Two responsibilities:
//   1. detectQueryIntent(text)  → pattern matching, returns the query type
//   2. executeStructuredQuery(type, orgId) → runs the real Prisma queries
//      and returns a StructuredQueryResult (rows + summary + format hint).
//
// All data comes from real DB rows — never fabricates. If the DB has no
// matching rows, we return an empty result with an honest summary.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getBusinessSnapshot } from '@/lib/business/snapshot';
import type {
  StructuredQueryType,
  StructuredStatRow,
  StructuredListRow,
  StructuredTrendPoint,
  StructuredColumn,
  StructuredQueryResult,
} from '@/lib/oracle/structured-query-types';

// Re-export the types so existing callers (e.g. /api/oracle/query/route.ts)
// can keep importing them from this module without changing their imports.
export type {
  StructuredQueryType,
  StructuredStatRow,
  StructuredListRow,
  StructuredTrendPoint,
  StructuredColumn,
  StructuredQueryResult,
};

// ─── Pattern matching ─────────────────────────────────────────────────────────

interface PatternEntry {
  type: StructuredQueryType;
  patterns: RegExp[];
}

/**
 * Ordered pattern list. Order matters — the FIRST matching type wins. We put
 * `overdue_invoices` BEFORE `unpaid_invoices` so "overdue invoices" doesn't
 * accidentally match the more general unpaid pattern first. (In practice the
 * patterns don't overlap, but this guarantees correct precedence.)
 */
const PATTERNS: PatternEntry[] = [
  {
    type: 'overdue_invoices',
    patterns: [
      /overdue\s*invoice/i,
      /past\s*due/i,
      /late\s*invoice/i,
      /overdue\s*bill/i,
      /overdue\s*receivable/i,
      /delayed\s*payment/i,
    ],
  },
  {
    type: 'unpaid_invoices',
    patterns: [
      /unpaid\s*invoice/i,
      /outstanding\s*invoice/i,
      /open\s*invoice/i,
      /pending\s*invoice/i,
      /unpaid\s*bill/i,
      /uncollected/i,
      /\breceivable/i,
      /who\s+(?:has|have)\s+not\s+paid/i,
      /not\s+yet\s+paid/i,
    ],
  },
  {
    type: 'top_customers',
    patterns: [
      /top\s*customer/i,
      /best\s*customer/i,
      /largest\s*customer/i,
      /biggest\s*customer/i,
      /top\s*client/i,
      /best\s*client/i,
      /largest\s*client/i,
      /biggest\s*client/i,
      /top\s*buyer/i,
      /top\s*account/i,
      /customer\s+rank/i,
      /client\s+rank/i,
    ],
  },
  {
    type: 'gst_payable',
    patterns: [
      /gst\s*payable/i,
      /gst\s*liabilit/i,
      /gst\s*due/i,
      /how\s*much\s*gst/i,
      /net\s*gst/i,
      /output\s*tax/i,
      /input\s*tax/i,
      /\bitc\b/i,
      /gst\s*outstanding/i,
      /gst\s*owe/i,
      /gst\s*collect/i,
    ],
  },
  {
    type: 'cash_position',
    patterns: [
      /cash\s*position/i,
      /bank\s*balance/i,
      /how\s*much\s*cash/i,
      /\bliquidity\b/i,
      /available\s*balance/i,
      /cash\s*in\s*bank/i,
      /cash\s*on\s*hand/i,
      /liquid\s*fund/i,
      /\bcash\b/i,
    ],
  },
  {
    type: 'revenue_trend',
    patterns: [
      /revenue\s*trend/i,
      /revenue\s*growth/i,
      /monthly\s*growth/i,
      /sales\s*trend/i,
      /sales\s*growth/i,
      /revenue\s*forecast/i,
      /income\s*trend/i,
      /\btopline\b/i,
      /month[\s-]*over[\s-]*month/i,
      /\bmom\b/i,
      /\byoy\b/i,
    ],
  },
  {
    type: 'profit',
    patterns: [
      /\bprofit/i,
      /\bmargin/i,
      /profitab/i,
      /net\s*income/i,
      /bottom\s*line/i,
      /\bebitda\b/i,
    ],
  },
  {
    type: 'expenses',
    patterns: [
      /expense/i,
      /spending/i,
      /\bcost/i,
      /\bburn\b/i,
      /operating\s*cost/i,
      /\bopex\b/i,
      /\bcapex\b/i,
      /\bpurchase/i,
      /vendor\s*payment/i,
    ],
  },
  {
    type: 'compliance',
    patterns: [
      /compliance/i,
      /gst\s*return/i,
      /filing/i,
      /gstr-\d/i,
      /gstr\s*\d/i,
      /filed\s*return/i,
      /pending\s*return/i,
      /overdue\s*return/i,
      /\breturns\b/i,
    ],
  },
  {
    type: 'health_score',
    patterns: [
      /health\s*score/i,
      /business\s*health/i,
      /risk\s*score/i,
      /financial\s*health/i,
      /business\s*score/i,
      /\bhealth\b/i,
    ],
  },
];

/**
 * Detect a structured-query intent from free text.
 *
 * Returns the StructuredQueryType if a strong pattern match is found, or null
 * if the message is conversational (no structured data card needed).
 *
 * The match is deliberately conservative: a phrase like "what's my GST payable?"
 * matches; "how does GST work?" does not (no `payable|liabilit|due|owe|collect`).
 */
export function detectQueryIntent(text: string): StructuredQueryType | null {
  if (!text || typeof text !== 'string' || text.trim().length === 0) return null;
  const normalized = text.toLowerCase();
  for (const { type, patterns } of PATTERNS) {
    if (patterns.some((p) => p.test(normalized))) return type;
  }
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Compact INR formatter — ₹X.YZ L / Cr / K, falls back to grouped ₹. */
function inr(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

/** Group digits (no symbol) — used for invoice counts etc. */
function num(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '0';
  return Math.round(n).toLocaleString('en-IN');
}

/** Format a percentage with 1 decimal. */
function pct(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '0%';
  return `${n.toFixed(1)}%`;
}

/** Parse the Invoice.dueDate (string) → Date, or null. */
function parseDueDate(raw: string | null | undefined): Date | null {
  if (!raw || typeof raw !== 'string') return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/** Whole days between two dates (a - b). Negative if a < b. */
function dayDiff(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000));
}

/** Pretty-print an ISO date string as "DD Mon YYYY". */
function prettyDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Per-type executors ───────────────────────────────────────────────────────

interface InvoiceWithClient {
  id: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  dueDate: string | null;
  totalAmount: number;
  balanceAmount: number;
  paidAmount: number;
  paymentStatus: string;
  client: { tradeName: string; legalName: string | null } | null;
}

async function executeUnpaidInvoices(orgId: string): Promise<StructuredQueryResult> {
  const now = new Date();
  const invoices = (await db.invoice.findMany({
    where: { client: { firmId: orgId }, balanceAmount: { gt: 0 } },
    take: 20,
    orderBy: { createdAt: 'desc' },
    include: { client: { select: { tradeName: true, legalName: true } } },
  })) as InvoiceWithClient[];

  const columns: StructuredColumn[] = [
    { key: 'invoiceNumber', label: 'Invoice #', align: 'left' },
    { key: 'clientName', label: 'Customer', align: 'left' },
    { key: 'totalAmount', label: 'Total', align: 'right', format: 'currency' },
    { key: 'balance', label: 'Balance Due', align: 'right', format: 'currency' },
    { key: 'dueDate', label: 'Due Date', align: 'left', format: 'date' },
    { key: 'daysOverdue', label: 'Days Overdue', align: 'right', format: 'badge' },
    { key: 'paymentStatus', label: 'Status', align: 'left', format: 'badge' },
  ];

  const rows = invoices.map((inv) => {
    const due = parseDueDate(inv.dueDate);
    const daysOverdue = due && due < now && inv.balanceAmount > 0 ? dayDiff(now, due) : 0;
    return {
      invoiceNumber: inv.invoiceNumber,
      clientName: inv.client?.tradeName || inv.client?.legalName || 'Unknown',
      totalAmount: inv.totalAmount,
      balance: inv.balanceAmount,
      dueDate: inv.dueDate,
      daysOverdue,
      paymentStatus: inv.paymentStatus,
    };
  });

  const totalBalance = rows.reduce((sum, r) => sum + (r.balance as number), 0);
  const overdueCount = rows.filter((r) => (r.daysOverdue as number) > 0).length;

  return {
    type: 'unpaid_invoices',
    title: 'Unpaid Invoices',
    format: 'table',
    summary:
      rows.length === 0
        ? 'No unpaid invoices — all receivables are collected.'
        : `${rows.length} unpaid invoice${rows.length === 1 ? '' : 's'} totalling ${inr(
            totalBalance,
          )}. ${overdueCount} are past their due date.`,
    generatedAt: now.toISOString(),
    columns,
    rows,
  };
}

async function executeOverdueInvoices(orgId: string): Promise<StructuredQueryResult> {
  const now = new Date();
  // We fetch all invoices with a balance, then filter/sort by overdue days
  // in JS (Invoice.dueDate is a string, so a DB-level date compare is brittle).
  const invoices = (await db.invoice.findMany({
    where: { client: { firmId: orgId }, balanceAmount: { gt: 0 } },
    take: 100,
    orderBy: { createdAt: 'desc' },
    include: { client: { select: { tradeName: true, legalName: true } } },
  })) as InvoiceWithClient[];

  const overdue = invoices
    .map((inv) => {
      const due = parseDueDate(inv.dueDate);
      const daysOverdue = due && due < now ? dayDiff(now, due) : 0;
      return { inv, due, daysOverdue };
    })
    .filter((r) => r.daysOverdue > 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .slice(0, 20);

  const columns: StructuredColumn[] = [
    { key: 'invoiceNumber', label: 'Invoice #', align: 'left' },
    { key: 'clientName', label: 'Customer', align: 'left' },
    { key: 'totalAmount', label: 'Total', align: 'right', format: 'currency' },
    { key: 'balance', label: 'Balance Due', align: 'right', format: 'currency' },
    { key: 'dueDate', label: 'Due Date', align: 'left', format: 'date' },
    { key: 'daysOverdue', label: 'Days Overdue', align: 'right', format: 'badge' },
    { key: 'paymentStatus', label: 'Status', align: 'left', format: 'badge' },
  ];

  const rows = overdue.map(({ inv, due, daysOverdue }) => ({
    invoiceNumber: inv.invoiceNumber,
    clientName: inv.client?.tradeName || inv.client?.legalName || 'Unknown',
    totalAmount: inv.totalAmount,
    balance: inv.balanceAmount,
    dueDate: inv.dueDate,
    daysOverdue,
    paymentStatus: due && due < now ? 'overdue' : inv.paymentStatus,
  }));

  const totalOverdue = rows.reduce((sum, r) => sum + (r.balance as number), 0);
  const avgDaysOverdue =
    rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + (r.daysOverdue as number), 0) / rows.length)
      : 0;

  return {
    type: 'overdue_invoices',
    title: 'Overdue Invoices',
    format: 'table',
    summary:
      rows.length === 0
        ? 'No overdue invoices — every receivable is on or before its due date.'
        : `${rows.length} overdue invoice${rows.length === 1 ? '' : 's'} totalling ${inr(
            totalOverdue,
          )}. Average ${avgDaysOverdue} days past due.`,
    generatedAt: now.toISOString(),
    columns,
    rows,
  };
}

async function executeTopCustomers(orgId: string): Promise<StructuredQueryResult> {
  const invoices = (await db.invoice.findMany({
    where: { client: { firmId: orgId } },
    select: {
      totalAmount: true,
      balanceAmount: true,
      client: { select: { tradeName: true, legalName: true } },
    },
  })) as Array<{
    totalAmount: number;
    balanceAmount: number;
    client: { tradeName: string; legalName: string | null } | null;
  }>;

  const byClient = new Map<
    string,
    { name: string; totalInvoiced: number; invoiceCount: number; outstanding: number }
  >();
  for (const inv of invoices) {
    const name = inv.client?.tradeName || inv.client?.legalName || 'Unknown';
    const cur = byClient.get(name) ?? {
      name,
      totalInvoiced: 0,
      invoiceCount: 0,
      outstanding: 0,
    };
    cur.totalInvoiced += inv.totalAmount;
    cur.invoiceCount += 1;
    cur.outstanding += inv.balanceAmount;
    byClient.set(name, cur);
  }
  const top = [...byClient.values()].sort((a, b) => b.totalInvoiced - a.totalInvoiced).slice(0, 5);

  const columns: StructuredColumn[] = [
    { key: 'rank', label: '#', align: 'right', format: 'number' },
    { key: 'clientName', label: 'Customer', align: 'left' },
    { key: 'totalInvoiced', label: 'Total Invoiced', align: 'right', format: 'currency' },
    { key: 'invoiceCount', label: 'Invoices', align: 'right', format: 'number' },
    { key: 'outstanding', label: 'Outstanding', align: 'right', format: 'currency' },
  ];
  const rows = top.map((c, i) => ({
    rank: i + 1,
    clientName: c.name,
    totalInvoiced: c.totalInvoiced,
    invoiceCount: c.invoiceCount,
    outstanding: c.outstanding,
  }));

  const topTotal = top.reduce((s, c) => s + c.totalInvoiced, 0);
  return {
    type: 'top_customers',
    title: 'Top Customers',
    format: 'table',
    summary:
      top.length === 0
        ? 'No customer data yet — connect data sources or create invoices to see rankings.'
        : `Top ${top.length} customers by revenue total ${inr(
            topTotal,
          )}. ${top[0]?.name ?? '—'} leads with ${inr(top[0]?.totalInvoiced ?? 0)}.`,
    generatedAt: new Date().toISOString(),
    columns,
    rows,
  };
}

async function executeGstPayable(orgId: string): Promise<StructuredQueryResult> {
  const s = await getBusinessSnapshot(orgId);
  const stats: StructuredStatRow[] = [
    {
      label: 'GST Collected (Output Tax)',
      value: inr(s.outputTax),
      hint: 'Total GST charged on sales invoices',
    },
    {
      label: 'ITC Available (Input Tax)',
      value: inr(s.inputTax),
      hint: 'GST paid on purchases, claimable as credit',
    },
    {
      label: 'Net GST Payable',
      value: inr(s.gstLiability),
      hint: 'Output Tax − Input Tax',
      tone: s.gstLiability > 0 ? 'warning' : 'success',
    },
    {
      label: 'Pending Returns',
      value: num(s.pendingReturns),
      hint: `${s.overdueReturns} overdue`,
      tone: s.overdueReturns > 0 ? 'danger' : s.pendingReturns > 0 ? 'warning' : 'success',
    },
  ];

  return {
    type: 'gst_payable',
    title: 'GST Position',
    format: 'number',
    summary: `Net GST payable is ${inr(s.gstLiability)} (output ${inr(
      s.outputTax,
    )} − ITC ${inr(s.inputTax)}). ${s.pendingReturns} return${s.pendingReturns === 1 ? '' : 's'} pending, ${s.overdueReturns} overdue.`,
    generatedAt: new Date().toISOString(),
    stats,
  };
}

async function executeCashPosition(orgId: string): Promise<StructuredQueryResult> {
  const s = await getBusinessSnapshot(orgId);
  const bankAccounts = await db.bankAccount
    .findMany({
      where: { status: 'connected' },
      select: { bankName: true, accountMasked: true, balance: true, availableBalance: true },
      orderBy: { balance: 'desc' },
      take: 10,
    })
    .catch(() => []);

  const stats: StructuredStatRow[] = [
    { label: 'Total Cash Position', value: inr(s.cash), hint: 'Bank balances + net payment flow' },
    { label: 'Net Cash Flow (FY)', value: inr(s.netCashFlow), hint: 'Collected − Paid this FY' },
    { label: 'Working Capital', value: inr(s.workingCapital), hint: 'Receivables − Payables' },
    {
      label: 'Runway',
      value: s.runwayDays === Infinity ? '∞' : `${Math.round(s.runwayDays)} days`,
      hint: 'Cash ÷ monthly burn',
      tone:
        s.runwayDays === Infinity
          ? 'success'
          : s.runwayDays < 60
            ? 'danger'
            : s.runwayDays < 120
              ? 'warning'
              : 'success',
    },
  ];

  // If we have live bank accounts, show them as a list beneath the stats.
  const items: StructuredListRow[] = bankAccounts.map((acc) => ({
    label: `${acc.bankName} • ${acc.accountMasked}`,
    value: inr(acc.balance),
  }));

  return {
    type: 'cash_position',
    title: 'Cash Position',
    format: items.length > 0 ? 'list' : 'number',
    summary: `Total cash position is ${inr(s.cash)}. Working capital ${inr(
      s.workingCapital,
    )}. Runway ${
      s.runwayDays === Infinity ? 'is unlimited (no burn)' : `~${Math.round(s.runwayDays)} days`
    }.`,
    generatedAt: new Date().toISOString(),
    stats,
    items: items.length > 0 ? items : undefined,
  };
}

async function executeRevenueTrend(orgId: string): Promise<StructuredQueryResult> {
  const s = await getBusinessSnapshot(orgId);
  // Build a 6-month revenue trend by grouping invoices by YYYY-MM.
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const invoices = await db.invoice.findMany({
    where: {
      client: { firmId: orgId },
      // invoiceDate is a string ("YYYY-MM-DD" or ISO) — filter in JS below for safety.
    },
    select: { invoiceDate: true, totalAmount: true },
  });

  const buckets = new Map<string, number>();
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.set(key, 0);
  }
  for (const inv of invoices) {
    if (!inv.invoiceDate) continue;
    const d = new Date(inv.invoiceDate);
    if (isNaN(d.getTime())) continue;
    if (d < sixMonthsAgo) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + inv.totalAmount);
    }
  }
  const trend: StructuredTrendPoint[] = [...buckets.entries()].map(([key, value]) => {
    const [y, m] = key.split('-');
    const label = new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-IN', {
      month: 'short',
    });
    return { label, value };
  });

  // MoM growth (last month vs prior month)
  const lastTwo = trend.slice(-2);
  let momPct = 0;
  if (lastTwo.length === 2 && lastTwo[0].value > 0) {
    momPct = ((lastTwo[1].value - lastTwo[0].value) / lastTwo[0].value) * 100;
  }

  const trendDirection: 'up' | 'down' | 'flat' =
    Math.abs(momPct) < 1 ? 'flat' : momPct > 0 ? 'up' : 'down';

  const stats: StructuredStatRow[] = [
    { label: 'Revenue (FY)', value: inr(s.revenue), hint: `${num(s.invoiceCount)} invoices` },
    {
      label: 'Next Month Forecast',
      value: inr(s.forecast.nextMonthRevenue),
      hint: `${pct(s.forecast.confidence * 100)} confidence`,
    },
    {
      label: 'MoM Growth',
      value: `${momPct >= 0 ? '+' : ''}${momPct.toFixed(1)}%`,
      tone: momPct > 0 ? 'success' : momPct < 0 ? 'danger' : 'default',
    },
  ];

  return {
    type: 'revenue_trend',
    title: 'Revenue Trend',
    format: 'chart',
    summary: `Revenue this FY is ${inr(s.revenue)} across ${num(
      s.invoiceCount,
    )} invoices. MoM growth is ${momPct >= 0 ? '+' : ''}${momPct.toFixed(1)}% (${trendDirection}). Next-month forecast: ${inr(
      s.forecast.nextMonthRevenue,
    )} (${pct(s.forecast.confidence * 100)} confidence).`,
    generatedAt: new Date().toISOString(),
    trend,
    trendDirection,
    stats,
  };
}

async function executeProfit(orgId: string): Promise<StructuredQueryResult> {
  const s = await getBusinessSnapshot(orgId);
  const stats: StructuredStatRow[] = [
    { label: 'Revenue (FY)', value: inr(s.revenue), hint: 'Total invoiced sales' },
    { label: 'Expenses (FY)', value: inr(s.expenses), hint: 'Purchases + operating expenses' },
    {
      label: 'Net Profit',
      value: inr(s.profit),
      hint: 'Revenue − Expenses',
      tone: s.profit > 0 ? 'success' : s.profit < 0 ? 'danger' : 'default',
    },
    {
      label: 'Profit Margin',
      value: pct(s.profitMargin * 100),
      hint: 'Profit ÷ Revenue',
      tone:
        s.profitMargin > 0.15
          ? 'success'
          : s.profitMargin > 0.05
            ? 'warning'
            : s.profitMargin <= 0
              ? 'danger'
              : 'default',
    },
  ];

  return {
    type: 'profit',
    title: 'Profitability',
    format: 'number',
    summary: `Net profit is ${inr(s.profit)} on revenue of ${inr(
      s.revenue,
    )} — a ${pct(s.profitMargin * 100)} margin.`,
    generatedAt: new Date().toISOString(),
    stats,
  };
}

async function executeExpenses(orgId: string): Promise<StructuredQueryResult> {
  const s = await getBusinessSnapshot(orgId);
  // Group native expenses by category for the breakdown.
  const byCategory = await db.expense
    .groupBy({
      by: ['category'],
      where: { client: { firmId: orgId } },
      _sum: { amount: true },
      _count: true,
    })
    .catch(() => []);

  const stats: StructuredStatRow[] = [
    { label: 'Total Expenses (FY)', value: inr(s.expenses), hint: 'Purchases + operating' },
    { label: 'Vendors', value: num(s.vendorCount), hint: 'Distinct vendors' },
    { label: 'Purchase Bills', value: num(s.billCount), hint: 'All-time' },
    { label: 'Payables (Unpaid)', value: inr(s.payables), hint: 'Outstanding to vendors' },
  ];

  const items: StructuredListRow[] = byCategory
    .sort((a, b) => (b._sum.amount ?? 0) - (a._sum.amount ?? 0))
    .slice(0, 6)
    .map((c) => ({
      label: c.category,
      value: inr(c._sum.amount ?? 0),
    }));

  return {
    type: 'expenses',
    title: 'Expenses',
    format: items.length > 0 ? 'list' : 'number',
    summary: `Total expenses this FY are ${inr(s.expenses)}. ${s.payables > 0 ? `${inr(s.payables)} is outstanding to vendors.` : 'No outstanding payables.'}`,
    generatedAt: new Date().toISOString(),
    stats,
    items: items.length > 0 ? items : undefined,
  };
}

async function executeCompliance(orgId: string): Promise<StructuredQueryResult> {
  const s = await getBusinessSnapshot(orgId);
  // Pull the most recent GST return filings for the table view.
  const filings = await db.gSTRFiling
    .findMany({
      where: { client: { firmId: orgId } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        returnType: true,
        period: true,
        status: true,
        filedDate: true,
        totalTax: true,
        totalInvoices: true,
      },
    })
    .catch(() => []);

  const stats: StructuredStatRow[] = [
    {
      label: 'Filed Returns',
      value: num(s.filedReturns),
      tone: s.filedReturns > 0 ? 'success' : 'default',
    },
    {
      label: 'Pending Returns',
      value: num(s.pendingReturns),
      tone: s.pendingReturns > 0 ? 'warning' : 'success',
    },
    {
      label: 'Overdue Returns',
      value: num(s.overdueReturns),
      tone: s.overdueReturns > 0 ? 'danger' : 'success',
    },
    {
      label: 'GST Liability',
      value: inr(s.gstLiability),
      tone: s.gstLiability > 0 ? 'warning' : 'success',
    },
  ];

  if (filings.length === 0) {
    return {
      type: 'compliance',
      title: 'GST Compliance',
      format: 'number',
      summary: `${s.filedReturns} filed, ${s.pendingReturns} pending, ${s.overdueReturns} overdue. Net GST liability is ${inr(s.gstLiability)}.`,
      generatedAt: new Date().toISOString(),
      stats,
    };
  }

  const columns: StructuredColumn[] = [
    { key: 'returnType', label: 'Return Type', align: 'left' },
    { key: 'period', label: 'Period', align: 'left' },
    { key: 'status', label: 'Status', align: 'left', format: 'badge' },
    { key: 'filedDate', label: 'Filed On', align: 'left', format: 'date' },
    { key: 'totalInvoices', label: 'Invoices', align: 'right', format: 'number' },
    { key: 'totalTax', label: 'Tax', align: 'right', format: 'currency' },
  ];
  const rows = filings.map((f) => ({
    returnType: f.returnType,
    period: f.period,
    status: f.status,
    filedDate: f.filedDate,
    totalInvoices: f.totalInvoices,
    totalTax: f.totalTax,
  }));

  return {
    type: 'compliance',
    title: 'GST Compliance',
    format: 'table',
    summary: `${s.filedReturns} filed, ${s.pendingReturns} pending, ${s.overdueReturns} overdue. Net GST liability is ${inr(s.gstLiability)}.`,
    generatedAt: new Date().toISOString(),
    stats,
    columns,
    rows,
  };
}

async function executeHealthScore(orgId: string): Promise<StructuredQueryResult> {
  const s = await getBusinessSnapshot(orgId);
  const healthTier =
    s.healthScore >= 80
      ? 'Excellent'
      : s.healthScore >= 65
        ? 'Healthy'
        : s.healthScore >= 50
          ? 'Fair'
          : s.healthScore >= 30
            ? 'At Risk'
            : 'Critical';

  const stats: StructuredStatRow[] = [
    {
      label: 'Health Score',
      value: `${s.healthScore}/100`,
      hint: healthTier,
      tone:
        s.healthScore >= 65 ? 'success' : s.healthScore >= 50 ? 'warning' : 'danger',
    },
    {
      label: 'Risk Score',
      value: `${s.riskScore}/100`,
      hint: 'Higher = riskier',
      tone:
        s.riskScore < 30 ? 'success' : s.riskScore < 60 ? 'warning' : 'danger',
    },
    {
      label: 'Collection Rate',
      value: pct(s.collectionRate * 100),
      hint: 'Collected ÷ Invoiced',
      tone:
        s.collectionRate >= 0.85 ? 'success' : s.collectionRate >= 0.6 ? 'warning' : 'danger',
    },
    {
      label: 'Runway',
      value: s.runwayDays === Infinity ? '∞' : `${Math.round(s.runwayDays)} days`,
      tone:
        s.runwayDays === Infinity
          ? 'success'
          : s.runwayDays < 60
            ? 'danger'
            : s.runwayDays < 120
              ? 'warning'
              : 'success',
    },
  ];

  return {
    type: 'health_score',
    title: 'Business Health',
    format: 'number',
    summary: `Business health is ${s.healthScore}/100 (${healthTier}). Risk score ${s.riskScore}/100. Collection rate ${pct(s.collectionRate * 100)}. Runway ${
      s.runwayDays === Infinity ? 'is unlimited' : `~${Math.round(s.runwayDays)} days`
    }.`,
    generatedAt: new Date().toISOString(),
    stats,
  };
}

// ─── Public dispatcher ────────────────────────────────────────────────────────

/**
 * Execute the structured query for the given type + org.
 *
 * Always returns a StructuredQueryResult — never throws. On internal error,
 * returns a result with an empty payload and an honest "unavailable" summary.
 */
export async function executeStructuredQuery(
  type: StructuredQueryType,
  orgId: string,
): Promise<StructuredQueryResult> {
  if (!orgId) {
    return {
      type,
      title: 'Query Unavailable',
      format: 'number',
      summary: 'No organization is selected — sign in and pick an organization to run this query.',
      generatedAt: new Date().toISOString(),
      stats: [],
    };
  }
  try {
    switch (type) {
      case 'unpaid_invoices':
        return await executeUnpaidInvoices(orgId);
      case 'overdue_invoices':
        return await executeOverdueInvoices(orgId);
      case 'top_customers':
        return await executeTopCustomers(orgId);
      case 'gst_payable':
        return await executeGstPayable(orgId);
      case 'cash_position':
        return await executeCashPosition(orgId);
      case 'revenue_trend':
        return await executeRevenueTrend(orgId);
      case 'profit':
        return await executeProfit(orgId);
      case 'expenses':
        return await executeExpenses(orgId);
      case 'compliance':
        return await executeCompliance(orgId);
      case 'health_score':
        return await executeHealthScore(orgId);
      default:
        return {
          type,
          title: 'Unknown Query',
          format: 'number',
          summary: 'This query type is not implemented yet.',
          generatedAt: new Date().toISOString(),
          stats: [],
        };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[structured-queries] executeStructuredQuery(${type}) failed:`, msg);
    return {
      type,
      title: 'Query Unavailable',
      format: 'number',
      summary: `This query could not be run right now (${msg}). Please try again in a moment.`,
      generatedAt: new Date().toISOString(),
      stats: [],
    };
  }
}

/** Build a compact plain-text context block that gets injected into the LLM
 *  system prompt so the model can craft a natural-language answer using the
 *  REAL structured data we just queried. */
export function formatStructuredResultForLLM(result: StructuredQueryResult): string {
  const lines: string[] = [
    `## STRUCTURED QUERY RESULT (real data, just queried)`,
    `Query type: ${result.type}`,
    `Title: ${result.title}`,
    `Summary: ${result.summary}`,
  ];

  if (result.rows && result.rows.length > 0 && result.columns) {
    lines.push('Rows:');
    for (const row of result.rows) {
      const parts = result.columns.map((c) => {
        const v = row[c.key];
        if (v === null || v === undefined) return `${c.label}: —`;
        if (c.format === 'currency') return `${c.label}: ${inr(Number(v) || 0)}`;
        if (c.format === 'number') return `${c.label}: ${num(Number(v) || 0)}`;
        if (c.format === 'date') return `${c.label}: ${prettyDate(String(v))}`;
        return `${c.label}: ${String(v)}`;
      });
      lines.push(`  - ${parts.join(' · ')}`);
    }
  }

  if (result.stats && result.stats.length > 0) {
    lines.push('Stats:');
    for (const s of result.stats) {
      lines.push(`  - ${s.label}: ${s.value}${s.hint ? ` (${s.hint})` : ''}`);
    }
  }

  if (result.items && result.items.length > 0) {
    lines.push('Items:');
    for (const it of result.items) {
      lines.push(`  - ${it.label}: ${it.value}`);
    }
  }

  if (result.trend && result.trend.length > 0) {
    lines.push(
      `Trend (${result.trendDirection ?? 'flat'}): ` +
        result.trend.map((t) => `${t.label}=${inr(t.value)}`).join(' → '),
    );
  }

  lines.push(
    'Use these EXACT numbers in your answer. Be conversational — do not just dump the table. ' +
      'Highlight the most important figure first, then explain the key takeaways. ' +
      'A structured data card is rendered to the user above your answer, so do not repeat the table verbatim.',
  );

  return lines.join('\n');
}
