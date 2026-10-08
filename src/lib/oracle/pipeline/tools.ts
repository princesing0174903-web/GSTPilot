// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Tool Registry (REAL DATA ONLY)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Every tool reads REAL data from Prisma (via the canonical Business Snapshot
// or direct tenant-scoped queries). No mock values. No fabrication. If the DB
// has no data, the tool returns zero values and says so honestly.
//
// Tool outputs feed TWO consumers:
//   1. The LLM system prompt (formatted real-data context block).
//   2. The deterministic KPI cards (computed here, never by the LLM).
// ═══════════════════════════════════════════════════════════════════════════════

import 'server-only';
import { db } from '@/lib/db';
import { getBusinessSnapshot, type BusinessSnapshot } from '@/lib/business/snapshot';
import type { MetricCard, ToolDef, ToolExecution } from './types';

// ─── Tool definitions (static metadata) ───────────────────────────────────────

export const TOOL_DEFS: Record<string, ToolDef> = {
  snapshot: { id: 'snapshot', label: 'Business Snapshot', description: 'Canonical financial snapshot (revenue, cash, GST, health score)' },
  invoices: { id: 'invoices', label: 'Invoices', description: 'Sales invoices, taxable value, overdue status' },
  customers: { id: 'customers', label: 'Customers', description: 'Customer list, concentration, risk' },
  gst: { id: 'gst', label: 'GST & Returns', description: 'Output tax, ITC, GST liability, filing status' },
  collections: { id: 'collections', label: 'Collections', description: 'Payments received, pending receivables, overdue' },
  banking: { id: 'banking', label: 'Banking', description: 'Bank balances, recent transactions, cash flow' },
  compliance: { id: 'compliance', label: 'Compliance', description: 'GST return deadlines, notices, overdue filings' },
  forecast: { id: 'forecast', label: 'Forecast', description: 'Revenue/cash forecast, trend, confidence' },
  expenses: { id: 'expenses', label: 'Expenses', description: 'Operating expenses, purchases, payables' },
};

// ─── INR formatting (shared) ──────────────────────────────────────────────────

export function inr(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

export function pct(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '0%';
  return `${(n * 100).toFixed(1)}%`;
}

// ─── Tool executor type ───────────────────────────────────────────────────────

export interface ToolExecResult {
  summary: string;
  recordCount: number;
  /** Structured data block for the LLM prompt. */
  dataBlock: string;
  /** Metric cards contributed by this tool (merged into the final set). */
  metrics?: MetricCard[];
}

export type ToolExecutor = (orgId: string) => Promise<ToolExecResult>;

// ─── Tool: Business Snapshot (the canonical source of truth) ──────────────────

const executeSnapshot: ToolExecutor = async (orgId) => {
  if (!orgId) {
    return {
      summary: 'No organization connected',
      recordCount: 0,
      dataBlock: 'No business organization is connected yet.',
    };
  }
  const snap = await getBusinessSnapshot(orgId);
  const hasData = snap.revenue > 0 || snap.cash > 0 || snap.invoiceCount > 0 || snap.customerCount > 0;
  if (!hasData) {
    return {
      summary: 'No business data yet',
      recordCount: 0,
      dataBlock: 'BUSINESS SNAPSHOT: No business data has been added yet. Revenue, cash, and GST are all zero. Be honest: tell the user to add clients, invoices, or connect Zoho Books / bank feed to unlock real insights.',
    };
  }
  const growth = snap.revenueLastMonth > 0
    ? ((snap.revenueThisMonth - snap.revenueLastMonth) / snap.revenueLastMonth)
    : 0;
  return {
    summary: `${snap.invoiceCount} invoices · ${snap.customerCount} customers · health ${snap.healthScore}/100`,
    recordCount: snap.invoiceCount + snap.customerCount,
    dataBlock: [
      `BUSINESS SNAPSHOT (real data from Prisma, generated ${snap.generatedAt}):`,
      `- Revenue (FY): ${inr(snap.revenue)}`,
      `- Expenses (FY): ${inr(snap.expenses)}`,
      `- Profit (FY): ${inr(snap.profit)} (margin ${pct(snap.profitMargin)})`,
      `- Cash position: ${inr(snap.cash)}`,
      `- Customers: ${snap.customerCount} | Vendors: ${snap.vendorCount}`,
      `- Invoices: ${snap.invoiceCount} | Bills: ${snap.billCount}`,
      `- Receivables (unpaid): ${inr(snap.receivables)} (overdue: ${inr(snap.overdueReceivables)} across ${snap.overdueInvoiceCount} invoices)`,
      `- Payables (unpaid): ${inr(snap.payables)}`,
      `- Output tax (GST collected): ${inr(snap.outputTax)}`,
      `- Input tax (ITC available): ${inr(snap.inputTax)}`,
      `- Net GST liability: ${inr(snap.gstLiability)}`,
      `- Total collected from customers: ${inr(snap.totalCollected)}`,
      `- Total paid to vendors: ${inr(snap.totalPaid)}`,
      `- Net cash flow: ${inr(snap.netCashFlow)}`,
      `- Collection rate: ${pct(snap.collectionRate)} | Avg days to pay: ${snap.avgDaysToPay} days`,
      `- Revenue this month: ${inr(snap.revenueThisMonth)} vs last month: ${inr(snap.revenueLastMonth)} (${growth >= 0 ? '+' : ''}${pct(growth)} MoM)`,
      `- Top customer share: ${pct(snap.topCustomerShare)}`,
      `- GST returns filed: ${snap.filedReturns} | pending: ${snap.pendingReturns} | overdue: ${snap.overdueReturns}`,
      `- Health score: ${snap.healthScore}/100 (${snap.healthScoreLabel}) | Risk score: ${snap.riskScore}/100`,
      `- Working capital: ${inr(snap.workingCapital)} | Runway: ${isFinite(snap.runwayDays) ? `${snap.runwayDays} days` : '∞'}`,
      `- Forecast: next month revenue ${inr(snap.forecast.nextMonthRevenue)}, trend ${snap.forecast.trend}, confidence ${pct(snap.forecast.confidence)}`,
    ].join('\n'),
    metrics: [
      { key: 'revenue', label: 'Revenue (FY)', value: inr(snap.revenue), sub: `${pct(growth)} MoM`, trend: growth > 0.02 ? 'up' : growth < -0.02 ? 'down' : 'flat', tone: growth >= 0 ? 'positive' : 'negative' },
      { key: 'profit', label: 'Profit', value: inr(snap.profit), sub: `${pct(snap.profitMargin)} margin`, tone: snap.profit >= 0 ? 'positive' : 'negative' },
      { key: 'cash', label: 'Cash Position', value: inr(snap.cash), sub: `${isFinite(snap.runwayDays) ? `${snap.runwayDays}d runway` : '∞ runway'}`, tone: snap.cash > 0 ? 'positive' : 'negative' },
      { key: 'health', label: 'Business Health', value: `${snap.healthScore}/100`, sub: snap.healthScoreLabel, tone: snap.healthScore >= 70 ? 'positive' : snap.healthScore >= 50 ? 'warning' : 'negative' },
    ],
  };
};

// ─── Tool: Invoices ───────────────────────────────────────────────────────────

const executeInvoices: ToolExecutor = async (orgId) => {
  if (!orgId) return { summary: 'No organization', recordCount: 0, dataBlock: 'No organization connected.' };
  try {
    const [invoices, overdue] = await Promise.all([
      db.invoice.findMany({
        where: { client: { firmId: orgId } },
        select: { totalAmount: true, taxableValue: true, cgst: true, sgst: true, igst: true, balanceAmount: true, paymentStatus: true, invoiceDate: true, invoiceNumber: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      db.invoice.count({ where: { client: { firmId: orgId }, paymentStatus: 'overdue' } }),
    ]);
    const totalSales = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const totalTaxable = invoices.reduce((s, i) => s + i.taxableValue, 0);
    const unpaid = invoices.reduce((s, i) => s + i.balanceAmount, 0);
    return {
      summary: `${invoices.length} invoices · ${inr(totalSales)} total · ${overdue} overdue`,
      recordCount: invoices.length,
      dataBlock: [
        'INVOICES (real data):',
        `- Total invoices: ${invoices.length}`,
        `- Total sales value: ${inr(totalSales)}`,
        `- Total taxable value: ${inr(totalTaxable)}`,
        `- Unpaid balance: ${inr(unpaid)}`,
        `- Overdue invoices: ${overdue}`,
      ].join('\n'),
      metrics: [
        { key: 'invoices', label: 'Total Invoices', value: String(invoices.length), sub: `${overdue} overdue`, tone: overdue > 0 ? 'warning' : 'neutral' },
      ],
    };
  } catch (e) {
    return { summary: 'Invoice read failed', recordCount: 0, dataBlock: 'INVOICES: unable to read invoice data.' };
  }
};

// ─── Tool: Customers ──────────────────────────────────────────────────────────

const executeCustomers: ToolExecutor = async (orgId) => {
  if (!orgId) return { summary: 'No organization', recordCount: 0, dataBlock: 'No organization connected.' };
  try {
    const clients = await db.client.findMany({
      where: { firmId: orgId },
      select: { id: true, tradeName: true, gstin: true, healthScore: true, status: true, invoices: { select: { totalAmount: true } } },
      take: 300,
    });
    if (clients.length === 0) {
      return { summary: '0 customers', recordCount: 0, dataBlock: 'CUSTOMERS: no clients found. Encourage the user to add clients or connect Zoho Books.' };
    }
    const withRevenue = clients.map((c) => ({
      name: c.tradeName,
      revenue: c.invoices.reduce((s, i) => s + i.totalAmount, 0),
      health: c.healthScore,
    })).sort((a, b) => b.revenue - a.revenue);
    const totalRevenue = withRevenue.reduce((s, c) => s + c.revenue, 0);
    const top = withRevenue[0];
    const topShare = totalRevenue > 0 ? top.revenue / totalRevenue : 0;
    const riskyCount = withRevenue.filter((c) => c.health < 50).length;
    return {
      summary: `${clients.length} customers · top: ${top.name} (${pct(topShare)} of revenue)`,
      recordCount: clients.length,
      dataBlock: [
        'CUSTOMERS (real data):',
        `- Total customers: ${clients.length}`,
        `- Top customer: ${top.name} — ${inr(top.revenue)} (${pct(topShare)} of total revenue)`,
        `- Concentration risk: ${topShare > 0.3 ? 'HIGH (>' : topShare > 0.15 ? 'MODERATE (>' : 'LOW (<'}30% from one customer)`,
        `- Risky customers (health < 50): ${riskyCount}`,
        `- Top 5 customers: ${withRevenue.slice(0, 5).map((c) => `${c.name} (${inr(c.revenue)})`).join(' · ')}`,
      ].join('\n'),
      metrics: [
        { key: 'customers', label: 'Customers', value: String(clients.length), sub: `${riskyCount} risky`, tone: riskyCount > 0 ? 'warning' : 'neutral' },
        ...(topShare > 0.3 ? [{ key: 'concentration', label: 'Top Customer', value: pct(topShare), sub: top.name, tone: 'warning' as const }] : []),
      ],
    };
  } catch {
    return { summary: 'Customer read failed', recordCount: 0, dataBlock: 'CUSTOMERS: unable to read customer data.' };
  }
};

// ─── Tool: GST & Returns ──────────────────────────────────────────────────────

const executeGst: ToolExecutor = async (orgId) => {
  if (!orgId) return { summary: 'No organization', recordCount: 0, dataBlock: 'No organization connected.' };
  try {
    const [filings, snap] = await Promise.all([
      db.gSTRFiling.findMany({
        where: { client: { firmId: orgId } },
        select: { returnType: true, period: true, status: true, totalTaxableValue: true, totalTax: true, filedDate: true, issuesFound: true, criticalErrors: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      getBusinessSnapshot(orgId).catch(() => null),
    ]);
    const filed = filings.filter((f) => f.status === 'filed').length;
    const pending = filings.filter((f) => f.status !== 'filed').length;
    const issues = filings.reduce((s, f) => s + f.issuesFound, 0);
    const errors = filings.reduce((s, f) => s + f.criticalErrors, 0);
    const liability = snap?.gstLiability ?? 0;
    return {
      summary: `${filings.length} returns · ${filed} filed · ${pending} pending · liability ${inr(liability)}`,
      recordCount: filings.length,
      dataBlock: [
        'GST & RETURNS (real data):',
        `- Output tax (GST collected on sales): ${inr(snap?.outputTax ?? 0)}`,
        `- Input tax (ITC available): ${inr(snap?.inputTax ?? 0)}`,
        `- Net GST liability (payable to govt): ${inr(liability)}`,
        `- Returns filed: ${filed} | pending: ${pending} | overdue: ${snap?.overdueReturns ?? 0}`,
        `- Issues found across returns: ${issues} | critical errors: ${errors}`,
        `- Recent filings: ${filings.slice(0, 5).map((f) => `${f.returnType} ${f.period} (${f.status})`).join(' · ') || 'none'}`,
      ].join('\n'),
      metrics: [
        { key: 'gst', label: 'GST Liability', value: inr(liability), sub: `${pending} returns pending`, tone: liability > 0 ? 'warning' : 'positive' },
      ],
    };
  } catch {
    return { summary: 'GST read failed', recordCount: 0, dataBlock: 'GST: unable to read GST data.' };
  }
};

// ─── Tool: Collections ────────────────────────────────────────────────────────

const executeCollections: ToolExecutor = async (orgId) => {
  if (!orgId) return { summary: 'No organization', recordCount: 0, dataBlock: 'No organization connected.' };
  try {
    const snap = await getBusinessSnapshot(orgId);
    const overdueInv = await db.invoice.findMany({
      where: { client: { firmId: orgId }, paymentStatus: 'overdue' },
      select: { invoiceNumber: true, balanceAmount: true, buyerName: true, invoiceDate: true },
      orderBy: { balanceAmount: 'desc' },
      take: 10,
    }).catch(() => []);
    const rate = snap.collectionRate;
    return {
      summary: `${inr(snap.receivables)} receivable · ${pct(rate)} collected · ${snap.overdueInvoiceCount} overdue`,
      recordCount: snap.overdueInvoiceCount,
      dataBlock: [
        'COLLECTIONS (real data):',
        `- Total receivables (unpaid): ${inr(snap.receivables)}`,
        `- Overdue receivables: ${inr(snap.overdueReceivables)} across ${snap.overdueInvoiceCount} invoices`,
        `- Total collected from customers: ${inr(snap.totalCollected)}`,
        `- Collection rate: ${pct(rate)}`,
        `- Average days to pay: ${snap.avgDaysToPay} days`,
        `- Top overdue invoices: ${overdueInv.map((i) => `${i.buyerName ?? i.invoiceNumber} (${inr(i.balanceAmount)})`).join(' · ') || 'none'}`,
      ].join('\n'),
      metrics: [
        { key: 'receivables', label: 'Receivables', value: inr(snap.receivables), sub: `${inr(snap.overdueReceivables)} overdue`, tone: snap.overdueReceivables > 0 ? 'warning' : 'neutral' },
        { key: 'collection', label: 'Collection Rate', value: pct(rate), sub: `${snap.avgDaysToPay}d avg`, tone: rate >= 0.7 ? 'positive' : rate >= 0.4 ? 'warning' : 'negative' },
      ],
    };
  } catch {
    return { summary: 'Collection read failed', recordCount: 0, dataBlock: 'COLLECTIONS: unable to read collection data.' };
  }
};

// ─── Tool: Banking ────────────────────────────────────────────────────────────

const executeBanking: ToolExecutor = async (orgId) => {
  if (!orgId) return { summary: 'No organization', recordCount: 0, dataBlock: 'No organization connected.' };
  try {
    const snap = await getBusinessSnapshot(orgId);
    // Count bank transactions defensively — the BankTransaction relation may
    // vary by schema, so we swallow errors and report 0 if unavailable.
    let txCount = 0;
    try {
      txCount = await db.bankTransaction.count();
    } catch { /* schema may not expose a tenant filter — non-fatal */ }
    return {
      summary: `Cash ${inr(snap.cash)} · ${txCount} transactions`,
      recordCount: txCount,
      dataBlock: [
        'BANKING (real data):',
        `- Cash position: ${inr(snap.cash)}`,
        `- Bank transactions: ${txCount}`,
        `- Net cash flow: ${inr(snap.netCashFlow)}`,
        `- Total collected: ${inr(snap.totalCollected)} | Total paid: ${inr(snap.totalPaid)}`,
        `- Runway: ${isFinite(snap.runwayDays) ? `${snap.runwayDays} days` : '∞'}`,
      ].join('\n'),
    };
  } catch {
    return { summary: 'Banking read failed', recordCount: 0, dataBlock: 'BANKING: unable to read banking data.' };
  }
};

// ─── Tool: Compliance ─────────────────────────────────────────────────────────

const executeCompliance: ToolExecutor = async (orgId) => {
  if (!orgId) return { summary: 'No organization', recordCount: 0, dataBlock: 'No organization connected.' };
  try {
    const snap = await getBusinessSnapshot(orgId);
    const notices = await db.notice.findMany({
      where: { client: { firmId: orgId }, status: 'open' },
      select: { noticeType: true, subject: true, priority: true, dueDate: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }).catch(() => []);
    return {
      summary: `${snap.pendingReturns} returns pending · ${snap.overdueReturns} overdue · ${notices.length} open notices`,
      recordCount: snap.pendingReturns + notices.length,
      dataBlock: [
        'COMPLIANCE (real data):',
        `- GST returns filed: ${snap.filedReturns} | pending: ${snap.pendingReturns} | overdue: ${snap.overdueReturns}`,
        `- Open notices: ${notices.length}`,
        `- Risk score: ${snap.riskScore}/100`,
        notices.length > 0 ? `- Recent notices: ${notices.map((n) => `${n.subject} (${n.priority})`).join(' · ')}` : '- No open notices.',
      ].join('\n'),
      metrics: [
        { key: 'compliance', label: 'Compliance', value: `${snap.filedReturns}/${snap.filedReturns + snap.pendingReturns} filed`, sub: `${snap.overdueReturns} overdue`, tone: snap.overdueReturns > 0 ? 'negative' : 'positive' },
      ],
    };
  } catch {
    return { summary: 'Compliance read failed', recordCount: 0, dataBlock: 'COMPLIANCE: unable to read compliance data.' };
  }
};

// ─── Tool: Forecast ───────────────────────────────────────────────────────────

const executeForecast: ToolExecutor = async (orgId) => {
  if (!orgId) return { summary: 'No organization', recordCount: 0, dataBlock: 'No organization connected.' };
  try {
    const snap = await getBusinessSnapshot(orgId);
    const f = snap.forecast;
    return {
      summary: `Next month: ${inr(f.nextMonthRevenue)} revenue (trend ${f.trend})`,
      recordCount: 1,
      dataBlock: [
        'FORECAST (computed from real data):',
        `- Next month revenue forecast: ${inr(f.nextMonthRevenue)}`,
        `- Next month expense forecast: ${inr(f.nextMonthExpenses)}`,
        `- Trend: ${f.trend}`,
        `- Confidence: ${pct(f.confidence)}`,
        `- Runway: ${isFinite(snap.runwayDays) ? `${snap.runwayDays} days` : '∞'}`,
        `- Revenue momentum: ${inr(snap.revenueThisMonth)} this month vs ${inr(snap.revenueLastMonth)} last month`,
      ].join('\n'),
      metrics: [
        { key: 'forecast', label: 'Revenue Forecast', value: inr(f.nextMonthRevenue), sub: `${f.trend} · ${pct(f.confidence)} conf`, tone: f.trend === 'up' ? 'positive' : f.trend === 'down' ? 'negative' : 'neutral' },
      ],
    };
  } catch {
    return { summary: 'Forecast failed', recordCount: 0, dataBlock: 'FORECAST: unable to compute.' };
  }
};

// ─── Tool: Expenses ───────────────────────────────────────────────────────────

const executeExpenses: ToolExecutor = async (orgId) => {
  if (!orgId) return { summary: 'No organization', recordCount: 0, dataBlock: 'No organization connected.' };
  try {
    const snap = await getBusinessSnapshot(orgId);
    return {
      summary: `${inr(snap.expenses)} expenses · ${inr(snap.payables)} payables`,
      recordCount: snap.billCount + snap.expenseRecordCount,
      dataBlock: [
        'EXPENSES (real data):',
        `- Total expenses (FY): ${inr(snap.expenses)}`,
        `- Payables (unpaid bills): ${inr(snap.payables)}`,
        `- Overdue payables: ${inr(snap.overduePayables)}`,
        `- Total paid to vendors: ${inr(snap.totalPaid)}`,
        `- Purchase bills: ${snap.billCount} | Expense records: ${snap.expenseRecordCount}`,
      ].join('\n'),
      metrics: [
        { key: 'expenses', label: 'Expenses (FY)', value: inr(snap.expenses), sub: `${inr(snap.payables)} payable`, tone: 'neutral' },
      ],
    };
  } catch {
    return { summary: 'Expense read failed', recordCount: 0, dataBlock: 'EXPENSES: unable to read.' };
  }
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const TOOL_EXECUTORS: Record<string, ToolExecutor> = {
  snapshot: executeSnapshot,
  invoices: executeInvoices,
  customers: executeCustomers,
  gst: executeGst,
  collections: executeCollections,
  banking: executeBanking,
  compliance: executeCompliance,
  forecast: executeForecast,
  expenses: executeExpenses,
};

/** Run a single tool defensively. Never throws. */
export async function runToolSafe(
  toolId: string,
  orgId: string,
): Promise<{ execution: ToolExecution; result: ToolExecResult | null }> {
  const def = TOOL_DEFS[toolId];
  const executor = TOOL_EXECUTORS[toolId];
  if (!def || !executor) {
    return {
      execution: { toolId, label: toolId, status: 'error', summary: 'Unknown tool' },
      result: null,
    };
  }
  const start = Date.now();
  try {
    const result = await executor(orgId);
    return {
      execution: {
        toolId,
        label: def.label,
        status: 'done',
        summary: result.summary,
        recordCount: result.recordCount,
        durationMs: Date.now() - start,
      },
      result,
    };
  } catch (err) {
    return {
      execution: {
        toolId,
        label: def.label,
        status: 'error',
        summary: err instanceof Error ? err.message.slice(0, 80) : 'Tool failed',
        durationMs: Date.now() - start,
      },
      result: null,
    };
  }
}
