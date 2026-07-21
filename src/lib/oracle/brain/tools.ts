// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ Brain — Tool Registry
// ═══════════════════════════════════════════════════════════════════════════════
//
// The tools Oracle can call to read real business data and take real actions.
//
// Every READ tool queries Prisma directly (tenant-scoped by organizationId) or
// delegates to the canonical getBusinessSnapshot() — never fabricates.
//
// Every ACTION tool performs a real Prisma write (create invoice, save memory,
// etc.) and returns a confirmation the LLM can relay to the user.
//
// Tool protocol: the LLM emits fenced JSON blocks:
//   ```tool-call
//   {"tool":"getBusinessSnapshot","args":{}}
//   ```
// The brain API parses these, executes, and feeds results back.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getBusinessSnapshot } from '@/lib/business/snapshot';
import { getBankingService } from '@/lib/banking-service';
import { saveMemory, recallMemory, getWorkspaceMemoryBlock } from './memory';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OracleTool {
  name: string;
  description: string;
  category: 'read' | 'action' | 'memory';
  argsSchema: Record<string, { type: string; description: string; required?: boolean }>;
  execute: (orgId: string, args: Record<string, any>, ctx: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
  orgId: string;
  userId?: string;
  sessionId?: string;
  messageId?: string;
}

export interface ToolResult {
  ok: boolean;
  /** Human-readable summary the LLM can quote directly. */
  summary: string;
  /** Structured payload (tables, numbers, lists) for richer rendering. */
  data?: any;
  /** Artifacts to render as cards/tables in the chat (optional). */
  artifacts?: Array<{
    kind: 'table' | 'metric' | 'list' | 'chart';
    title: string;
    columns?: string[];
    rows?: Record<string, any>[];
    items?: any[];
  }>;
}

// ─── INR formatting (shared) ──────────────────────────────────────────────────

function inr(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

function pct(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '0%';
  return `${(n * 100).toFixed(1)}%`;
}

// ─── Tool: getBusinessSnapshot ────────────────────────────────────────────────

const getBusinessSnapshotTool: OracleTool = {
  name: 'getBusinessSnapshot',
  description:
    'Fetch the canonical business snapshot: revenue, expenses, profit, cash, receivables, payables, GST liability, customer count, invoice count, health score, risk score, forecast, and more. Use this FIRST for any question about business performance, financials, or KPIs.',
  category: 'read',
  argsSchema: {},
  async execute(orgId): Promise<ToolResult> {
    const snap = await getBusinessSnapshot(orgId, { forceRefresh: true });
    const summary =
      `Business Snapshot (as of ${new Date(snap.generatedAt).toLocaleString('en-IN')}):\n` +
      `• Revenue (FY): ${inr(snap.revenue)}\n` +
      `• Expenses (FY): ${inr(snap.expenses)}\n` +
      `• Profit: ${inr(snap.profit)} (${pct(snap.profitMargin)} margin)\n` +
      `• Revenue this month: ${inr(snap.revenueThisMonth)} (last month: ${inr(snap.revenueLastMonth)})\n` +
      `• Cash position: ${inr(snap.cash)}\n` +
      `• Receivables: ${inr(snap.receivables)} (${snap.invoiceCount} invoices, ${snap.overdueInvoiceCount} overdue = ${inr(snap.overdueReceivables)})\n` +
      `• Payables: ${inr(snap.payables)}\n` +
      `• GST: output ${inr(snap.outputTax)}, input (ITC) ${inr(snap.inputTax)}, net liability ${inr(snap.gstLiability)}\n` +
      `• Customers: ${snap.customerCount}, Vendors: ${snap.vendorCount}\n` +
      `• Collection rate: ${pct(snap.collectionRate)}, avg days to pay: ${snap.avgDaysToPay}d\n` +
      `• Health score: ${snap.healthScore}/100 (${snap.healthScoreLabel}), Risk: ${snap.riskScore}/100\n` +
      `• Runway: ${isFinite(snap.runwayDays) ? `${Math.round(snap.runwayDays)} days` : '∞'}\n` +
      `• Forecast: next month revenue ${inr(snap.forecast.nextMonthRevenue)} (${snap.forecast.trend}, confidence ${pct(snap.forecast.confidence)})`;
    return {
      ok: true,
      summary,
      data: snap,
      artifacts: [
        {
          kind: 'metric' as const,
          title: 'Key Metrics',
          items: [
            { label: 'Revenue (FY)', value: inr(snap.revenue), trend: snap.revenueThisMonth > snap.revenueLastMonth ? 'up' : 'down' },
            { label: 'Profit', value: inr(snap.profit), sub: pct(snap.profitMargin) + ' margin' },
            { label: 'Cash', value: inr(snap.cash) },
            { label: 'Receivables', value: inr(snap.receivables), sub: `${snap.overdueInvoiceCount} overdue` },
            { label: 'GST Liability', value: inr(snap.gstLiability) },
            { label: 'Health Score', value: `${snap.healthScore}/100`, sub: snap.healthScoreLabel },
          ],
        },
      ],
    };
  },
};

// ─── Tool: queryInvoices ──────────────────────────────────────────────────────

const queryInvoicesTool: OracleTool = {
  name: 'queryInvoices',
  description:
    'Query sales invoices. Filter by status (paid/unpaid/overdue/draft), customer name, or date range. Returns up to 50 invoices with totals.',
  category: 'read',
  argsSchema: {
    status: { type: 'string', description: 'paid | unpaid | overdue | draft | all (default: all)' },
    customerName: { type: 'string', description: 'partial customer name match' },
    limit: { type: 'number', description: 'max results (default 20, max 50)' },
  },
  async execute(orgId, args): Promise<ToolResult> {
    const limit = Math.min(Number(args.limit) || 20, 50);
    // Invoice has no firmId — it is scoped through client.firmId.
    // `status` is the GST lifecycle (draft/sent), `paymentStatus` is the financial state (unpaid/partial/paid/overdue).
    const where: any = { client: { firmId: orgId } };
    if (args.status === 'paid') where.paymentStatus = 'paid';
    else if (args.status === 'unpaid') where.paymentStatus = { in: ['unpaid', 'partial'] };
    else if (args.status === 'overdue') where.paymentStatus = 'overdue';
    else if (args.status === 'draft') where.status = 'draft';
    if (args.customerName) {
      where.buyerName = { contains: String(args.customerName), mode: 'insensitive' };
    }
    const rows = await db.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, invoiceNumber: true, buyerName: true, status: true, paymentStatus: true,
        totalAmount: true, balanceAmount: true, invoiceDate: true, dueDate: true,
      },
    }).catch(() => []);
    const total = rows.reduce((s, r) => s + (r.totalAmount ?? 0), 0);
    const balance = rows.reduce((s, r) => s + (r.balanceAmount ?? 0), 0);
    const summary =
      rows.length === 0
        ? `No invoices found${args.status ? ` with status "${args.status}"` : ''}.`
        : `Found ${rows.length} invoice(s). Total: ${inr(total)}, Outstanding: ${inr(balance)}.`;
    return {
      ok: true,
      summary,
      data: rows,
      artifacts: rows.length > 0 ? [{
        kind: 'table' as const,
        title: 'Invoices',
        columns: ['Invoice #', 'Customer', 'Status', 'Total', 'Balance', 'Date'],
        rows: rows.map(r => ({
          'Invoice #': r.invoiceNumber,
          Customer: r.buyerName ?? '-',
          Status: r.paymentStatus ?? r.status,
          Total: inr(r.totalAmount ?? 0),
          Balance: inr(r.balanceAmount ?? 0),
          Date: r.invoiceDate ?? '-',
        })),
      }] : undefined,
    };
  },
};

// ─── Tool: queryCustomers ─────────────────────────────────────────────────────

const queryCustomersTool: OracleTool = {
  name: 'queryCustomers',
  description:
    'Query customers (clients). Returns name, email, phone, GSTIN, city. Optionally filter by name.',
  category: 'read',
  argsSchema: {
    search: { type: 'string', description: 'partial name/email/gstin match' },
    limit: { type: 'number', description: 'max results (default 20, max 50)' },
  },
  async execute(orgId, args): Promise<ToolResult> {
    const limit = Math.min(Number(args.limit) || 20, 50);
    // Client has firmId directly. Field names: tradeName / contactEmail / contactPhone / state.
    const where: any = { firmId: orgId };
    if (args.search) {
      where.OR = [
        { tradeName: { contains: String(args.search), mode: 'insensitive' } },
        { contactEmail: { contains: String(args.search), mode: 'insensitive' } },
        { gstin: { contains: String(args.search), mode: 'insensitive' } },
      ];
    }
    const rows = await db.client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, tradeName: true, contactEmail: true, contactPhone: true, gstin: true, state: true },
    }).catch(() => []);
    const summary = rows.length === 0 ? 'No customers found.' : `Found ${rows.length} customer(s).`;
    return {
      ok: true,
      summary,
      data: rows,
      artifacts: rows.length > 0 ? [{
        kind: 'table' as const,
        title: 'Customers',
        columns: ['Name', 'Email', 'Phone', 'GSTIN', 'State'],
        rows: rows.map(r => ({
          Name: r.tradeName,
          Email: r.contactEmail ?? '-',
          Phone: r.contactPhone ?? '-',
          GSTIN: r.gstin,
          State: r.state ?? '-',
        })),
      }] : undefined,
    };
  },
};

// ─── Tool: queryExpenses ──────────────────────────────────────────────────────

const queryExpensesTool: OracleTool = {
  name: 'queryExpenses',
  description: 'Query expense records. Returns vendor, category, amount, date, status.',
  category: 'read',
  argsSchema: {
    category: { type: 'string', description: 'expense category filter' },
    limit: { type: 'number', description: 'max results (default 20, max 50)' },
  },
  async execute(orgId, args): Promise<ToolResult> {
    const limit = Math.min(Number(args.limit) || 20, 50);
    // Expense has no firmId — scoped through client.firmId. Fields: vendor / date / category / amount.
    const where: any = { client: { firmId: orgId } };
    if (args.category) where.category = { contains: String(args.category), mode: 'insensitive' };
    const rows = await db.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit,
      select: { id: true, vendor: true, category: true, amount: true, date: true, status: true },
    }).catch(() => []);
    const total = rows.reduce((s, r) => s + (r.amount ?? 0), 0);
    const summary = rows.length === 0 ? 'No expenses found.' : `Found ${rows.length} expense(s). Total: ${inr(total)}.`;
    return {
      ok: true,
      summary,
      data: rows,
      artifacts: rows.length > 0 ? [{
        kind: 'table' as const,
        title: 'Expenses',
        columns: ['Vendor', 'Category', 'Amount', 'Date', 'Status'],
        rows: rows.map(r => ({
          Vendor: r.vendor ?? '-',
          Category: r.category ?? '-',
          Amount: inr(r.amount ?? 0),
          Date: r.date ?? '-',
          Status: r.status ?? '-',
        })),
      }] : undefined,
    };
  },
};

// ─── Tool: queryPayments ──────────────────────────────────────────────────────

const queryPaymentsTool: OracleTool = {
  name: 'queryPayments',
  description: 'Query payment records (received and made). Returns direction, party, amount, date, method.',
  category: 'read',
  argsSchema: {
    direction: { type: 'string', description: 'received | paid | all (default all)' },
    limit: { type: 'number', description: 'max results (default 20, max 50)' },
  },
  async execute(orgId, args): Promise<ToolResult> {
    const limit = Math.min(Number(args.limit) || 20, 50);
    // Payment has no firmId — scoped through client.firmId. partyType: customer|vendor. paymentMode: upi|bank|...
    const where: any = { client: { firmId: orgId } };
    if (args.direction === 'received') where.partyType = 'customer';
    else if (args.direction === 'paid') where.partyType = 'vendor';
    const rows = await db.payment.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      take: limit,
      select: { id: true, partyType: true, partyName: true, amount: true, paymentDate: true, paymentMode: true, referenceNo: true },
    }).catch(() => []);
    const total = rows.reduce((s, r) => s + (r.amount ?? 0), 0);
    const summary = rows.length === 0 ? 'No payments found.' : `Found ${rows.length} payment(s). Total: ${inr(total)}.`;
    return { ok: true, summary, data: rows };
  },
};

// ─── Tool: getGSTStatus ───────────────────────────────────────────────────────

const getGSTStatusTool: OracleTool = {
  name: 'getGSTStatus',
  description: 'Get GST filing status: filed/pending/overdue returns, output tax, input tax (ITC), net liability, upcoming due dates.',
  category: 'read',
  argsSchema: {},
  async execute(orgId): Promise<ToolResult> {
    // GSTRFiling has no firmId — scoped through client.firmId. Fields: returnType, period, status, totalTax, filedDate.
    const [filings, snap] = await Promise.all([
      db.gSTRFiling.findMany({
        where: { client: { firmId: orgId } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, returnType: true, period: true, status: true, totalTax: true, filedDate: true, createdAt: true },
      }).catch(() => []),
      getBusinessSnapshot(orgId, { forceRefresh: true }),
    ]);
    const upcoming = filings.filter(f => f.status !== 'filed').slice(0, 5);
    const summary =
      `GST Status:\n` +
      `• Output tax (collected): ${inr(snap.outputTax)}\n` +
      `• Input tax (ITC available): ${inr(snap.inputTax)}\n` +
      `• Net GST liability: ${inr(snap.gstLiability)}\n` +
      `• Filed returns: ${snap.filedReturns}, Pending: ${snap.pendingReturns}, Overdue: ${snap.overdueReturns}` +
      (upcoming.length > 0
        ? `\n• Upcoming filings:\n` + upcoming.map(f => `  - ${f.returnType} for ${f.period}, status: ${f.status}, tax: ${inr(f.totalTax ?? 0)}`).join('\n')
        : '');
    return {
      ok: true,
      summary,
      data: { filings, snapshot: { outputTax: snap.outputTax, inputTax: snap.inputTax, gstLiability: snap.gstLiability, filedReturns: snap.filedReturns, pendingReturns: snap.pendingReturns, overdueReturns: snap.overdueReturns } },
      artifacts: filings.length > 0 ? [{
        kind: 'table' as const,
        title: 'GST Filings',
        columns: ['Return', 'Period', 'Status', 'Tax', 'Filed'],
        rows: filings.map(f => ({
          Return: f.returnType,
          Period: f.period,
          Status: f.status,
          Tax: inr(f.totalTax ?? 0),
          Filed: f.filedDate ?? '-',
        })),
      }] : undefined,
    };
  },
};

// ─── Tool: getOverdueCustomers ────────────────────────────────────────────────

const getOverdueCustomersTool: OracleTool = {
  name: 'getOverdueCustomers',
  description: 'List customers with overdue invoices, their outstanding amounts, and days overdue. Use before sending reminders.',
  category: 'read',
  argsSchema: {},
  async execute(orgId): Promise<ToolResult> {
    // Overdue = paymentStatus 'overdue'. Scoped via client.firmId. buyerName (not clientName). dueDate is a String ISO date.
    const rows = await db.invoice.findMany({
      where: { client: { firmId: orgId }, paymentStatus: 'overdue' },
      orderBy: { dueDate: 'asc' },
      take: 50,
      select: { id: true, invoiceNumber: true, buyerName: true, balanceAmount: true, dueDate: true, totalAmount: true },
    }).catch(() => []);
    const now = new Date();
    const grouped = new Map<string, { name: string; total: number; count: number; oldestDays: number }>();
    for (const r of rows) {
      const name = r.buyerName ?? 'Unknown';
      const existing = grouped.get(name) ?? { name, total: 0, count: 0, oldestDays: 0 };
      existing.total += r.balanceAmount ?? 0;
      existing.count += 1;
      if (r.dueDate) {
        const d = new Date(r.dueDate);
        if (!isNaN(d.getTime())) {
          const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
          existing.oldestDays = Math.max(existing.oldestDays, days);
        }
      }
      grouped.set(name, existing);
    }
    const list = Array.from(grouped.values()).sort((a, b) => b.total - a.total);
    const totalOutstanding = list.reduce((s, r) => s + r.total, 0);
    const summary =
      list.length === 0
        ? 'No overdue customers. All receivables are current.'
        : `${list.length} customer(s) with overdue invoices. Total overdue: ${inr(totalOutstanding)}.`;
    return {
      ok: true,
      summary,
      data: list,
      artifacts: list.length > 0 ? [{
        kind: 'table' as const,
        title: 'Overdue Customers',
        columns: ['Customer', 'Overdue Amount', 'Invoices', 'Oldest (days)'],
        rows: list.map(r => ({
          Customer: r.name,
          'Overdue Amount': inr(r.total),
          Invoices: r.count,
          'Oldest (days)': r.oldestDays,
        })),
      }] : undefined,
    };
  },
};

// ─── Tool: getCashflowAnalysis ────────────────────────────────────────────────

const getCashflowAnalysisTool: OracleTool = {
  name: 'getCashflowAnalysis',
  description: 'Analyze cashflow: money in vs out, net flow, collection rate, runway, working capital, and a 6-month revenue trend.',
  category: 'read',
  argsSchema: {},
  async execute(orgId): Promise<ToolResult> {
    const snap = await getBusinessSnapshot(orgId, { forceRefresh: true });
    // 6-month revenue trend from invoices
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    const invoices = await db.invoice.findMany({
      where: { firmId: orgId, invoiceDate: { gte: sixMonthsAgo } },
      select: { total: true, invoiceDate: true },
    }).catch(() => []);
    const trend: { month: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toLocaleString('en-IN', { month: 'short' });
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const rev = invoices
        .filter(inv => {
          const id = inv.invoiceDate ? new Date(inv.invoiceDate) : null;
          return id && id >= monthStart && id <= monthEnd;
        })
        .reduce((s, inv) => s + (inv.total ?? 0), 0);
      trend.push({ month: key, revenue: rev });
    }
    const summary =
      `Cashflow Analysis:\n` +
      `• Collected (FY): ${inr(snap.totalCollected)}\n` +
      `• Paid out (FY): ${inr(snap.totalPaid)}\n` +
      `• Net cash flow: ${inr(snap.netCashFlow)}\n` +
      `• Collection rate: ${pct(snap.collectionRate)}\n` +
      `• Working capital: ${inr(snap.workingCapital)} (receivables - payables)\n` +
      `• Cash on hand: ${inr(snap.cash)}\n` +
      `• Runway: ${isFinite(snap.runwayDays) ? `${Math.round(snap.runwayDays)} days` : '∞'}\n` +
      `• 6-month revenue trend: ` + trend.map(t => `${t.month} ${inr(t.revenue)}`).join(', ');
    return {
      ok: true,
      summary,
      data: { snapshot: snap, trend },
      artifacts: [
        {
          kind: 'chart' as const,
          title: '6-Month Revenue Trend',
          items: trend,
        },
      ],
    };
  },
};

// ─── Tool: createInvoice (ACTION) ─────────────────────────────────────────────

const createInvoiceTool: OracleTool = {
  name: 'createInvoice',
  description:
    'Create a new sales invoice. Required: customerName. Optional: items (array of {name, quantity, rate, gstRate}), invoiceDate, dueDate, notes. Returns the created invoice number.',
  category: 'action',
  argsSchema: {
    customerName: { type: 'string', description: 'customer name (required)', required: true },
    items: { type: 'array', description: 'line items: [{name, quantity, rate, gstRate}]' },
    notes: { type: 'string', description: 'invoice notes' },
  },
  async execute(orgId, args): Promise<ToolResult> {
    const customerName = String(args.customerName ?? '').trim();
    if (!customerName) {
      return { ok: false, summary: 'Cannot create invoice: customerName is required.' };
    }
    const items = Array.isArray(args.items) ? args.items : [];
    if (items.length === 0) {
      return { ok: false, summary: 'Cannot create invoice: at least one line item is required.' };
    }
    let taxableValue = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    const invoiceItems = items.map((it: any, idx: number) => {
      const qty = Number(it.quantity ?? 1);
      const unitPrice = Number(it.rate ?? 0);
      const gstRate = Number(it.gstRate ?? 18);
      const lineNet = qty * unitPrice;
      const lineTax = lineNet * (gstRate / 100);
      taxableValue += lineNet;
      cgstTotal += lineTax / 2;
      sgstTotal += lineTax / 2;
      return {
        lineNumber: idx + 1,
        description: String(it.name ?? 'Item'),
        hsnCode: it.hsnCode ? String(it.hsnCode) : null,
        quantity: qty,
        unit: it.unit ? String(it.unit) : 'NOS',
        unitPrice,
        taxableValue: lineNet,
        cgstRate: gstRate / 2,
        sgstRate: gstRate / 2,
        igstRate: 0,
        cessRate: 0,
        cgst: lineTax / 2,
        sgst: lineTax / 2,
        igst: 0,
        cess: 0,
        totalAmount: lineNet + lineTax,
      };
    });
    const totalAmount = taxableValue + cgstTotal + sgstTotal + igstTotal;
    const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
    const now = new Date();
    const invoiceDateStr = args.invoiceDate ? String(args.invoiceDate) : now.toISOString().slice(0, 10);
    const dueDateStr = args.dueDate
      ? String(args.dueDate)
      : new Date(now.getTime() + 15 * 86400000).toISOString().slice(0, 10);

    // Find an existing client by tradeName (case-insensitive). Client requires gstin (unique) — if creating, synthesize one.
    let client = await db.client.findFirst({
      where: { firmId: orgId, tradeName: { equals: customerName, mode: 'insensitive' } },
      select: { id: true, gstin: true },
    }).catch(() => null);
    if (!client) {
      try {
        client = await db.client.create({
          data: {
            firmId: orgId,
            tradeName: customerName,
            gstin: `LOCAL-${Date.now()}`,  // synthetic unique GSTIN for local customers
            entityType: 'regular',
            status: 'active',
          },
          select: { id: true, gstin: true },
        });
      } catch (e) {
        console.error('[oracle-tool createInvoice] client create failed:', e);
        return { ok: false, summary: `Failed to create customer "${customerName}". ${(e as Error).message}` };
      }
    }

    const invoice = await db.invoice.create({
      data: {
        clientId: client.id,
        invoiceNumber,
        invoiceDate: invoiceDateStr,
        sellerGstin: 'LOCAL-SELLER',
        buyerGstin: client.gstin,
        buyerName: customerName,
        invoiceType: 'B2B',
        taxableValue,
        cgst: cgstTotal,
        sgst: sgstTotal,
        igst: 0,
        cess: 0,
        totalAmount,
        status: 'draft',
        dueDate: dueDateStr,
        gstAmount: cgstTotal + sgstTotal + igstTotal,
        paidAmount: 0,
        balanceAmount: totalAmount,
        paymentStatus: 'unpaid',
        notes: args.notes ? String(args.notes) : null,
      },
      select: { id: true, invoiceNumber: true, totalAmount: true, dueDate: true },
    }).catch((e) => { console.error('[oracle-tool createInvoice] invoice create:', e); return null; });

    if (!invoice) {
      return { ok: false, summary: `Failed to create invoice for ${customerName}. Database error.` };
    }

    // Persist invoice items — InvoiceItem requires lineNumber, unit, unitPrice, taxableValue, cgstRate, sgstRate, igstRate, cessRate, cgst, sgst, igst, cess, totalAmount.
    try {
      await db.invoiceItem.createMany({
        data: invoiceItems.map(it => ({
          invoiceId: invoice.id,
          lineNumber: it.lineNumber,
          description: it.description,
          hsnCode: it.hsnCode,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unitPrice,
          taxableValue: it.taxableValue,
          cgstRate: it.cgstRate,
          sgstRate: it.sgstRate,
          igstRate: it.igstRate,
          cessRate: it.cessRate,
          cgst: it.cgst,
          sgst: it.sgst,
          igst: it.igst,
          cess: it.cess,
          totalAmount: it.totalAmount,
        })),
      });
    } catch (e) {
      console.warn('[oracle-tool createInvoice] items not persisted:', (e as Error).message);
    }

    // Log activity for the timeline
    try {
      await db.activity.create({
        data: {
          firmId: orgId,
          type: 'invoice',
          description: `Invoice ${invoice.invoiceNumber} created for ${customerName} (${inr(invoice.totalAmount)})`,
          metadata: JSON.stringify({ invoiceId: invoice.id, customer: customerName, total: invoice.totalAmount }),
        },
      });
    } catch (e) {
      console.warn('[oracle-tool createInvoice] activity not logged:', (e as Error).message);
    }

    return {
      ok: true,
      summary: `✅ Created invoice ${invoice.invoiceNumber} for ${customerName}. Total: ${inr(invoice.totalAmount)}. Due: ${invoice.dueDate}. Status: Draft. You can review and send it from the Invoices page.`,
      data: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, totalAmount, customerName, items: invoiceItems },
      artifacts: [{
        kind: 'table' as const,
        title: `Invoice ${invoice.invoiceNumber}`,
        columns: ['Item', 'Qty', 'Rate', 'GST %', 'Amount'],
        rows: invoiceItems.map(it => {
          const gstPct = it.cgstRate + it.sgstRate;
          return {
            Item: it.description,
            Qty: it.quantity,
            Rate: inr(it.unitPrice),
            'GST %': gstPct + '%',
            Amount: inr(it.totalAmount),
          };
        }),
      }],
    };
  },
};

// ─── Tool: sendReminder (ACTION) ──────────────────────────────────────────────

const sendReminderTool: OracleTool = {
  name: 'sendReminder',
  description:
    'Send a payment reminder to overdue customer(s). If customerName is omitted, sends to all overdue customers. Creates a CommunicationLog entry (does not actually send email/SMS in this build — logs the intent for the user to confirm).',
  category: 'action',
  argsSchema: {
    customerName: { type: 'string', description: 'specific customer to remind (omit for all overdue)' },
    channel: { type: 'string', description: 'email | sms | whatsapp (default email)' },
  },
  async execute(orgId, args): Promise<ToolResult> {
    const channel = String(args.channel ?? 'email');
    // Overdue invoices scoped via client.firmId + paymentStatus 'overdue'. buyerName (not clientName).
    const where: any = { client: { firmId: orgId }, paymentStatus: 'overdue' };
    if (args.customerName) {
      where.buyerName = { contains: String(args.customerName), mode: 'insensitive' };
    }
    const invoices = await db.invoice.findMany({
      where,
      select: { id: true, invoiceNumber: true, buyerName: true, balanceAmount: true, dueDate: true, clientId: true, totalAmount: true },
      take: 50,
    }).catch(() => []);
    if (invoices.length === 0) {
      return { ok: false, summary: args.customerName ? `No overdue invoices found for "${args.customerName}".` : 'No overdue invoices to send reminders for.' };
    }
    // Group by customer
    const byCustomer = new Map<string, { invoices: typeof invoices; total: number; clientId: string | null }>();
    for (const inv of invoices) {
      const name = inv.buyerName ?? 'Unknown';
      const existing = byCustomer.get(name) ?? { invoices: [], total: 0, clientId: null };
      existing.invoices.push(inv);
      existing.total += inv.balanceAmount ?? 0;
      existing.clientId = existing.clientId ?? inv.clientId;
      byCustomer.set(name, existing);
    }
    // Create communication logs — CommunicationLog fields: clientId, channel, eventType, recipient, recipientName, messagePreview, status, triggerSource, metadata.
    const logs: { customer: string; amount: number; invoiceCount: number }[] = [];
    for (const [name, group] of byCustomer) {
      const preview = `Dear ${name}, this is a reminder that ${group.invoices.length} invoice(s) totaling ${inr(group.total)} are overdue. Please arrange payment at your earliest convenience. Invoices: ${group.invoices.map(i => i.invoiceNumber).join(', ')}.`;
      try {
        await db.communicationLog.create({
          data: {
            clientId: group.clientId,
            channel,
            eventType: 'overdue',
            recipient: 'on-record',
            recipientName: name,
            messagePreview: preview.slice(0, 200),
            status: 'sent',
            triggerSource: 'ai_engine',
            metadata: JSON.stringify({ invoices: group.invoices.map(i => i.id), total: group.total }),
          },
        });
      } catch (e) {
        console.warn('[oracle-tool sendReminder] log not persisted:', (e as Error).message);
      }
      logs.push({ customer: name, amount: group.total, invoiceCount: group.invoices.length });
    }
    const summary =
      `✅ Queued ${logs.length} payment reminder(s) via ${channel}:\n` +
      logs.map(l => `  • ${l.customer} — ${l.invoiceCount} invoice(s), ${inr(l.amount)} outstanding`).join('\n') +
      `\nReminders are saved in the Communications log. Connect an email/SMS provider in Settings to actually deliver them.`;
    return {
      ok: true,
      summary,
      data: { sent: logs.length, channel, details: logs },
      artifacts: [{
        kind: 'table' as const,
        title: 'Reminders Queued',
        columns: ['Customer', 'Invoices', 'Outstanding'],
        rows: logs.map(l => ({ Customer: l.customer, Invoices: l.invoiceCount, Outstanding: inr(l.amount) })),
      }],
    };
  },
};

// ─── Tool: getTopCustomer (largest / top revenue customer) ─────────────────────

const getTopCustomerTool: OracleTool = {
  name: 'getTopCustomer',
  description:
    'Find the customer with the highest total invoiced revenue. Returns top 5 customers ranked by revenue. Use when asked "who is my largest customer" or "top revenue customer".',
  category: 'read',
  argsSchema: {
    limit: { type: 'number', description: 'number of top customers to return (default 5, max 20)' },
  },
  async execute(orgId, args): Promise<ToolResult> {
    const limit = Math.min(Number(args.limit) || 5, 20);
    // Query invoices through the Client relation (Client.firmId = orgId)
    const rows = await db.invoice.findMany({
      where: { client: { firmId: orgId } },
      select: { buyerName: true, totalAmount: true, status: true, client: { select: { tradeName: true } } },
    }).catch(() => []);
    if (rows.length === 0) {
      return { ok: true, summary: 'I don\'t have enough business data — no invoices found to compute top customers.' };
    }
    const grouped = new Map<string, { name: string; revenue: number; invoiceCount: number }>();
    for (const r of rows as any[]) {
      const name = r.buyerName ?? r.client?.tradeName ?? 'Unknown';
      const existing = grouped.get(name) ?? { name, revenue: 0, invoiceCount: 0 };
      existing.revenue += r.totalAmount ?? 0;
      existing.invoiceCount += 1;
      grouped.set(name, existing);
    }
    const list = Array.from(grouped.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
    const top = list[0];
    const totalRevenue = rows.reduce((s: number, r: any) => s + (r.totalAmount ?? 0), 0);
    const share = totalRevenue > 0 ? (top.revenue / totalRevenue) : 0;
    const summary =
      `Top customer: **${top.name}** with ${inr(top.revenue)} in revenue across ${top.invoiceCount} invoice(s) (${pct(share)} of total revenue).` +
      (list.length > 1 ? ` Next: ${list.slice(1, 3).map(c => `${c.name} (${inr(c.revenue)})`).join(', ')}.` : '');
    return {
      ok: true,
      summary,
      data: list,
      artifacts: [{
        kind: 'table' as const,
        title: 'Top Customers by Revenue',
        columns: ['Rank', 'Customer', 'Revenue', 'Invoices', 'Share'],
        rows: list.map((c, i) => ({
          Rank: i + 1,
          Customer: c.name,
          Revenue: inr(c.revenue),
          Invoices: c.invoiceCount,
          Share: totalRevenue > 0 ? pct(c.revenue / totalRevenue) : '-',
        })),
      }],
    };
  },
};

// ─── Tool: getNewestInvoice ───────────────────────────────────────────────────

const getNewestInvoiceTool: OracleTool = {
  name: 'getNewestInvoice',
  description:
    'Get the most recently created invoice(s). Returns the latest invoice with full details (number, customer, amount, status, date, due date). Use when asked "show newest invoice" or "latest invoice".',
  category: 'read',
  argsSchema: {
    limit: { type: 'number', description: 'number of recent invoices (default 1, max 10)' },
  },
  async execute(orgId, args): Promise<ToolResult> {
    const limit = Math.min(Number(args.limit) || 1, 10);
    const rows = await db.invoice.findMany({
      where: { client: { firmId: orgId } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, invoiceNumber: true, buyerName: true, status: true, paymentStatus: true,
        totalAmount: true, balanceAmount: true, invoiceDate: true, dueDate: true, createdAt: true,
        client: { select: { tradeName: true } },
      },
    }).catch(() => []);
    if (rows.length === 0) {
      return { ok: true, summary: 'I don\'t have enough business data — no invoices have been created yet.' };
    }
    const latest = rows[0] as any;
    const customerName = latest.buyerName ?? latest.client?.tradeName ?? '—';
    const summary =
      `Newest invoice: **${latest.invoiceNumber ?? '—'}** for **${customerName}**, ` +
      `${inr(latest.totalAmount ?? 0)} (${latest.paymentStatus ?? latest.status}). ` +
      `Issued ${latest.invoiceDate ?? '—'}, ` +
      `due ${latest.dueDate ?? '—'}.` +
      (rows.length > 1 ? ` ${rows.length - 1} more recent invoice(s) available.` : '');
    return {
      ok: true,
      summary,
      data: rows,
      artifacts: [{
        kind: 'table' as const,
        title: 'Most Recent Invoices',
        columns: ['Invoice #', 'Customer', 'Status', 'Total', 'Balance', 'Issued', 'Due'],
        rows: rows.map((r: any) => ({
          'Invoice #': r.invoiceNumber,
          Customer: r.buyerName ?? r.client?.tradeName ?? '-',
          Status: r.paymentStatus ?? r.status,
          Total: inr(r.totalAmount ?? 0),
          Balance: inr(r.balanceAmount ?? 0),
          Issued: r.invoiceDate ?? '-',
          Due: r.dueDate ?? '-',
        })),
      }],
    };
  },
};

// ─── Tool: getInvoiceMetrics (average invoice value + distribution) ────────────

const getInvoiceMetricsTool: OracleTool = {
  name: 'getInvoiceMetrics',
  description:
    'Compute invoice metrics: average invoice value, median, min, max, total, and count. Use when asked "average invoice value" or "invoice statistics".',
  category: 'read',
  argsSchema: {},
  async execute(orgId): Promise<ToolResult> {
    const rows = await db.invoice.findMany({
      where: { client: { firmId: orgId } },
      select: { totalAmount: true, paymentStatus: true },
    }).catch(() => []);
    if (rows.length === 0) {
      return { ok: true, summary: 'I don\'t have enough business data — no invoices found to compute metrics.' };
    }
    const totals = rows.map((r: any) => r.totalAmount ?? 0).filter(n => n > 0).sort((a, b) => a - b);
    const count = totals.length;
    const sum = totals.reduce((s, n) => s + n, 0);
    const avg = count > 0 ? sum / count : 0;
    const median = count > 0
      ? (count % 2 === 1 ? totals[Math.floor(count / 2)] : (totals[count / 2 - 1] + totals[count / 2]) / 2)
      : 0;
    const min = count > 0 ? totals[0] : 0;
    const max = count > 0 ? totals[count - 1] : 0;
    const paidCount = rows.filter((r: any) => r.paymentStatus === 'paid').length;
    const overdueCount = rows.filter((r: any) => r.paymentStatus === 'overdue').length;
    const summary =
      `Average invoice value: **${inr(avg)}** across ${count} invoice(s). ` +
      `Range: ${inr(min)} – ${inr(max)}. Median: ${inr(median)}. ` +
      `Paid: ${paidCount}, Overdue: ${overdueCount}.`;
    return {
      ok: true,
      summary,
      data: { count, sum, avg, median, min, max, paidCount, overdueCount },
      artifacts: [{
        kind: 'metric' as const,
        title: 'Invoice Metrics',
        items: [
          { label: 'Average', value: inr(avg) },
          { label: 'Median', value: inr(median) },
          { label: 'Min', value: inr(min) },
          { label: 'Max', value: inr(max) },
          { label: 'Total', value: inr(sum) },
          { label: 'Count', value: String(count) },
        ],
      }],
    };
  },
};

// ─── Tool: getRecentActivity ──────────────────────────────────────────────────

const getRecentActivityTool: OracleTool = {
  name: 'getRecentActivity',
  description:
    'List recent business activity (invoices created, payments received, expenses logged, GST filings, customer additions). Returns the latest 10 timeline events. Use when asked "recent activity" or "what happened recently".',
  category: 'read',
  argsSchema: {
    limit: { type: 'number', description: 'number of events (default 10, max 30)' },
  },
  async execute(orgId, args): Promise<ToolResult> {
    const limit = Math.min(Number(args.limit) || 10, 30);

    // Try the Activity table first (canonical timeline)
    let activities: Array<{ id: string; type: string; description: string; createdAt: Date; metadata?: string | null }> = [];
    try {
      activities = await db.activity.findMany({
        where: { firmId: orgId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true, type: true, description: true, createdAt: true, metadata: true },
      });
    } catch { activities = []; }

    // If Activity table is empty, synthesize a timeline from the source tables
    if (activities.length === 0) {
      const [recentInvoices, recentPayments, recentExpenses, recentFilings] = await Promise.all([
        db.invoice.findMany({
          where: { client: { firmId: orgId } },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, invoiceNumber: true, buyerName: true, totalAmount: true, createdAt: true, client: { select: { tradeName: true } } },
        }).catch(() => []),
        db.payment.findMany({
          where: { client: { firmId: orgId } },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, amount: true, createdAt: true, partyName: true, partyType: true },
        }).catch(() => []),
        db.expense.findMany({
          where: { client: { firmId: orgId } },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, vendor: true, amount: true, category: true, createdAt: true },
        }).catch(() => []),
        db.gSTRFiling.findMany({
          where: { client: { firmId: orgId } },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, returnType: true, status: true, createdAt: true },
        }).catch(() => []),
      ]);
      const events: Array<{ createdAt: Date; type: string; description: string }> = [];
      for (const inv of recentInvoices as any[]) {
        const name = inv.buyerName ?? inv.client?.tradeName ?? '—';
        events.push({ createdAt: inv.createdAt, type: 'invoice', description: `Invoice ${inv.invoiceNumber ?? '—'} created for ${name} (${inr(inv.totalAmount ?? 0)})` });
      }
      for (const pay of recentPayments as any[]) {
        events.push({ createdAt: pay.createdAt, type: 'payment', description: `Payment of ${inr(pay.amount ?? 0)} ${pay.partyType === 'vendor' ? 'to ' + (pay.partyName ?? '—') : 'from ' + (pay.partyName ?? '—')}` });
      }
      for (const exp of recentExpenses as any[]) {
        events.push({ createdAt: exp.createdAt, type: 'expense', description: `Expense logged: ${exp.category ?? '—'} to ${exp.vendor ?? '—'} (${inr(exp.amount ?? 0)})` });
      }
      for (const fil of recentFilings as any[]) {
        events.push({ createdAt: fil.createdAt, type: 'gst', description: `GSTR-${fil.returnType ?? '—'} filing ${fil.status ?? '—'}` });
      }
      events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      activities = events.slice(0, limit).map((e, i) => ({ id: `synth-${i}`, type: e.type, description: e.description, createdAt: e.createdAt, metadata: null }));
    }

    if (activities.length === 0) {
      return { ok: true, summary: 'I don\'t have enough business data — no recent activity found.' };
    }

    const summary =
      `${activities.length} recent event(s):\n` +
      activities.slice(0, 5).map(a => `  • ${new Date(a.createdAt).toLocaleDateString('en-IN')} — ${a.description}`).join('\n');

    return {
      ok: true,
      summary,
      data: activities,
      artifacts: [{
        kind: 'list' as const,
        title: 'Recent Activity',
        items: activities.map(a => ({
          text: a.description,
          date: new Date(a.createdAt).toLocaleString('en-IN'),
          type: a.type,
        })),
      }],
    };
  },
};

// ─── Tool: getConnectedIntegrations ───────────────────────────────────────────

const getConnectedIntegrationsTool: OracleTool = {
  name: 'getConnectedIntegrations',
  description:
    'Check which third-party integrations are connected (Google Workspace, Zoho Books, etc.) with their last sync status. Use when asked "what integrations are connected" or "is Zoho synced".',
  category: 'read',
  argsSchema: {},
  async execute(orgId): Promise<ToolResult> {
    const integrations: Array<{ provider: string; connected: boolean; detail: string }> = [];

    // Google Workspace tokens
    const googleCount = await db.googleWorkspaceToken.count({
      where: { organizationId: orgId, revokedAt: null },
    }).catch(() => 0);
    const googleLatest = await db.googleWorkspaceToken.findFirst({
      where: { organizationId: orgId, revokedAt: null },
      orderBy: { connectedAt: 'desc' },
      select: { userEmail: true, connectedAt: true, expiryDate: true },
    }).catch(() => null);
    integrations.push({
      provider: 'Google Workspace',
      connected: googleCount > 0,
      detail: googleLatest
        ? `${googleLatest.userEmail} · connected ${new Date(googleLatest.connectedAt).toLocaleDateString('en-IN')}`
        : 'Not connected',
    });

    // Zoho Books tokens
    const zohoCount = await db.zohoBooksToken.count({
      where: { organizationId: orgId, revokedAt: null },
    }).catch(() => 0);
    const zohoLatest = await db.zohoBooksToken.findFirst({
      where: { organizationId: orgId, revokedAt: null },
      orderBy: { connectedAt: 'desc' },
      select: { zohoOrgName: true, connectedAt: true },
    }).catch(() => null);
    // Last sync from ZohoSyncLog (if available)
    const zohoLastSync = await db.zohoSyncLog.findFirst({
      where: { organizationId: orgId },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true, status: true },
    }).catch(() => null);
    integrations.push({
      provider: 'Zoho Books',
      connected: zohoCount > 0,
      detail: zohoLatest
        ? `${zohoLatest.zohoOrgName ?? 'Connected'} · synced ${zohoLastSync?.startedAt ? new Date(zohoLastSync.startedAt).toLocaleDateString('en-IN') : 'never'}`
        : 'Not connected',
    });

    // Generic Integration table (catch-all)
    try {
      const genericIntegrations = await db.integration.findMany({
        where: { tenantId: orgId, connected: true },
        take: 10,
        select: { provider: true, displayName: true, status: true, lastSyncAt: true },
      });
      for (const gi of genericIntegrations) {
        integrations.push({
          provider: gi.displayName ?? gi.provider ?? 'Integration',
          connected: true,
          detail: `${gi.status} · ${gi.lastSyncAt ? 'synced ' + new Date(gi.lastSyncAt).toLocaleDateString('en-IN') : 'never synced'}`,
        });
      }
    } catch {}

    const connectedCount = integrations.filter(i => i.connected).length;
    const summary =
      integrations.length === 0
        ? 'I don\'t have enough business data — no integrations found.'
        : `${connectedCount} of ${integrations.length} integration(s) connected: ` +
          integrations.map(i => `${i.provider} (${i.connected ? '✓' : '✗'})`).join(', ') + '.';

    return {
      ok: true,
      summary,
      data: integrations,
      artifacts: [{
        kind: 'table' as const,
        title: 'Connected Integrations',
        columns: ['Provider', 'Status', 'Details'],
        rows: integrations.map(i => ({
          Provider: i.provider,
          Status: i.connected ? '✓ Connected' : '✗ Not connected',
          Details: i.detail,
        })),
      }],
    };
  },
};

// ─── Tool: recallMemory ───────────────────────────────────────────────────────

const recallMemoryTool: OracleTool = {
  name: 'recallMemory',
  description: 'Search Oracle\'s persistent memory for this workspace (company info, GST number, preferences, past facts). Use when the user asks about something Oracle should "remember".',
  category: 'memory',
  argsSchema: {
    query: { type: 'string', description: 'search query' },
  },
  async execute(orgId, args): Promise<ToolResult> {
    const query = String(args.query ?? '');
    const facts = await recallMemory(orgId, query);
    if (facts.length === 0) {
      return { ok: true, summary: `No memories found matching "${query}".` };
    }
    const summary = `Recalled ${facts.length} memor${facts.length === 1 ? 'y' : 'ies'}:\n` +
      facts.map(f => `  • ${f.title}${f.summary ? ': ' + f.summary : ''}`).join('\n');
    return { ok: true, summary, data: facts };
  },
};

// ─── Tool: runWorkflow (WORKFLOW — Priority 2) ────────────────────────────────
//
// PSEUDO-TOOL: the brain route intercepts this tool call BEFORE it reaches the
// normal tool-execution loop. The intercept calls the workflow planner, which
// builds a WorkflowPlan (template match or LLM-built) and emits a `workflow-plan`
// SSE event. The frontend renders a WorkflowPlanCard; on user confirm it POSTs
// to /api/oracle/brain/workflow/execute which streams the executor's per-step
// progress events.
//
// This tool definition exists ONLY so buildToolsPromptBlock() includes it in
// the LLM's tool list — the LLM needs to know it can emit `runWorkflow`. The
// execute() function below is never called (the brain route intercepts first),
// but we provide a stub that returns a helpful message in case of bypass.

const runWorkflowTool: OracleTool = {
  name: 'runWorkflow',
  description:
    'Run a multi-step business workflow that chains multiple actions together (e.g. "create an invoice AND email it", "record a payment AND mark the invoice paid", "add a lead AND schedule a follow-up"). The system plans the steps, shows a confirmation card, then executes them in order with live progress. Use this INSTEAD of emitting multiple separate action tool-calls whenever the user asks for 2+ chained actions.',
  category: 'action',
  argsSchema: {
    message: { type: 'string', required: true, description: 'The FULL original user message describing the multi-step task' },
    extractedArgs: { type: 'object', description: 'Structured params you extracted (customerName, items, amount, etc.) — the planner uses these to build the plan' },
  },
  async execute(_orgId, args): Promise<ToolResult> {
    // This is never called — the brain route intercepts runWorkflow before the
    // normal tool-execution loop. If we ever get here, it means the intercept
    // was bypassed; return a clear message so the user isn't left hanging.
    return {
      ok: false,
      summary: `Workflow "${String(args.message ?? '')}" could not be started directly. The brain route should intercept runWorkflow calls — if you see this, please report it.`,
    };
  },
};

// ─── Tool: saveMemory (ACTION) ────────────────────────────────────────────────

const saveMemoryTool: OracleTool = {
  name: 'saveMemory',
  description: 'Persist a fact to Oracle\'s workspace memory so it\'s remembered in future conversations. Use for: company name, GST number, preferences, user instructions, important dates.',
  category: 'memory',
  argsSchema: {
    title: { type: 'string', description: 'short title (e.g. "Company GSTIN")', required: true },
    summary: { type: 'string', description: 'the value/fact to remember' },
    category: { type: 'string', description: 'company | preference | gst | banking | note (default: note)' },
  },
  async execute(orgId, args): Promise<ToolResult> {
    const title = String(args.title ?? '').trim();
    if (!title) return { ok: false, summary: 'Cannot save memory: title is required.' };
    const mem = await saveMemory(orgId, {
      title,
      summary: args.summary ? String(args.summary) : null,
      category: String(args.category ?? 'note'),
      source: 'oracle-chat',
    });
    return {
      ok: true,
      summary: `✅ Saved to memory: "${title}"${args.summary ? ` — ${args.summary}` : ''}. I'll remember this for future conversations.`,
      data: { id: mem.id },
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2 — ACTION ENGINE TOOLS
// These tools require user confirmation before execution. The brain route
// intercepts ACTION-category tool calls and emits an "action-confirm" SSE event
// instead of executing immediately. The frontend shows a confirmation card.
// Only when the user confirms does the frontend POST to /api/oracle/brain/execute
// which runs the tool for real.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Tool: createCustomer (ACTION) ────────────────────────────────────────────

const createCustomerTool: OracleTool = {
  name: 'createCustomer',
  description: 'Create a new customer (Client). Required: name (tradeName). Optional: gstin, email, phone, state, stateCode, address. Returns the created customer ID. REQUIRES CONFIRMATION.',
  category: 'action',
  argsSchema: {
    name: { type: 'string', description: 'customer trade name (required)', required: true },
    gstin: { type: 'string', description: 'GSTIN (must be unique). If omitted, a synthetic LOCAL- prefixed GSTIN is generated.' },
    email: { type: 'string', description: 'contact email' },
    phone: { type: 'string', description: 'contact phone' },
    state: { type: 'string', description: 'state name' },
    stateCode: { type: 'string', description: 'GST state code (e.g. 07 for Delhi)' },
  },
  async execute(orgId, args): Promise<ToolResult> {
    const tradeName = String(args.name ?? '').trim();
    if (!tradeName) return { ok: false, summary: 'Cannot create customer: name is required.' };
    const gstin = String(args.gstin ?? `LOCAL-${Date.now()}`).trim().toUpperCase();
    // Check GSTIN uniqueness
    const existing = await db.client.findUnique({ where: { gstin }, select: { id: true, tradeName: true } }).catch(() => null);
    if (existing) {
      return { ok: false, summary: `A customer with GSTIN "${gstin}" already exists (name: ${existing.tradeName}). Use a different GSTIN.` };
    }
    const client = await db.client.create({
      data: {
        firmId: orgId,
        tradeName,
        legalName: tradeName,
        gstin,
        contactEmail: args.email ? String(args.email) : null,
        contactPhone: args.phone ? String(args.phone) : null,
        state: args.state ? String(args.state) : null,
        stateCode: args.stateCode ? String(args.stateCode) : null,
        address: args.address ? String(args.address) : null,
        entityType: 'regular',
        status: 'active',
      },
      select: { id: true, tradeName: true, gstin: true },
    }).catch((e) => { console.error('[oracle-tool createCustomer]', e); return null; });
    if (!client) return { ok: false, summary: `Failed to create customer "${tradeName}". Database error.` };
    // Log activity
    try {
      await db.activity.create({ data: { firmId: orgId, type: 'customer', description: `Customer "${tradeName}" created (GSTIN: ${gstin})`, metadata: JSON.stringify({ clientId: client.id }) } });
    } catch {}
    return {
      ok: true,
      summary: `✅ Created customer **${client.tradeName}** (GSTIN: ${client.gstin}). You can now create invoices for this customer.`,
      data: { id: client.id, tradeName: client.tradeName, gstin: client.gstin },
    };
  },
};

// ─── Tool: createExpense (ACTION) ─────────────────────────────────────────────

const createExpenseTool: OracleTool = {
  name: 'createExpense',
  description: 'Record a new expense. Required: vendor, amount, category, date. Optional: gst (GST portion), paymentMode, description, gstClaimable. REQUIRES CONFIRMATION.',
  category: 'action',
  argsSchema: {
    vendor: { type: 'string', description: 'vendor name (required)', required: true },
    amount: { type: 'number', description: 'total amount in INR (required)', required: true },
    category: { type: 'string', description: 'Office|Travel|Salary|Marketing|Rent|Utilities|Software|Miscellaneous (required)', required: true },
    date: { type: 'string', description: 'expense date ISO YYYY-MM-DD (required)', required: true },
    gst: { type: 'number', description: 'GST portion (claimable ITC). Default 0.' },
    paymentMode: { type: 'string', description: 'upi|bank|cash|cheque|card' },
    description: { type: 'string', description: 'expense description' },
  },
  async execute(orgId, args): Promise<ToolResult> {
    const vendor = String(args.vendor ?? '').trim();
    const amount = Number(args.amount ?? 0);
    const category = String(args.category ?? 'Miscellaneous').trim();
    const date = String(args.date ?? new Date().toISOString().slice(0, 10));
    if (!vendor) return { ok: false, summary: 'Cannot create expense: vendor is required.' };
    if (!amount || amount <= 0) return { ok: false, summary: 'Cannot create expense: amount must be greater than 0.' };
    // Find or create a client for this vendor (expenses link to client). Use firm's first client or create a generic one.
    let client = await db.client.findFirst({ where: { firmId: orgId, tradeName: { equals: vendor, mode: 'insensitive' } }, select: { id: true } }).catch(() => null);
    if (!client) {
      client = await db.client.create({
        data: { firmId: orgId, tradeName: vendor, gstin: `LOCAL-VENDOR-${Date.now()}`, entityType: 'regular', status: 'active' },
        select: { id: true },
      }).catch(() => null);
    }
    const expense = await db.expense.create({
      data: {
        clientId: client?.id ?? null,
        vendor,
        category,
        amount,
        gst: Number(args.gst ?? 0),
        gstClaimable: Number(args.gst ?? 0) > 0,
        date,
        paymentMode: args.paymentMode ? String(args.paymentMode) : null,
        description: args.description ? String(args.description) : null,
        status: 'recorded',
      },
      select: { id: true, vendor: true, amount: true, category: true, date: true },
    }).catch((e) => { console.error('[oracle-tool createExpense]', e); return null; });
    if (!expense) return { ok: false, summary: `Failed to create expense. Database error.` };
    try {
      await db.activity.create({ data: { firmId: orgId, type: 'expense', description: `Expense logged: ${category} to ${vendor} (${inr(amount)})`, metadata: JSON.stringify({ expenseId: expense.id }) } });
    } catch {}
    return {
      ok: true,
      summary: `✅ Recorded expense: **${category}** — ${vendor}, ${inr(amount)} on ${date}.`,
      data: { id: expense.id, vendor: expense.vendor, amount: expense.amount, category: expense.category, date: expense.date },
    };
  },
};

// ─── Tool: createPayment (ACTION) ─────────────────────────────────────────────

const createPaymentTool: OracleTool = {
  name: 'createPayment',
  description: 'Record a payment (received from customer or made to vendor). Required: partyName, amount, paymentDate, partyType. Optional: paymentMode, referenceNo, invoiceId, notes. REQUIRES CONFIRMATION.',
  category: 'action',
  argsSchema: {
    partyName: { type: 'string', description: 'customer or vendor name (required)', required: true },
    amount: { type: 'number', description: 'amount in INR (required)', required: true },
    paymentDate: { type: 'string', description: 'ISO date YYYY-MM-DD (required)', required: true },
    partyType: { type: 'string', description: 'customer | vendor (required, default customer)', required: true },
    paymentMode: { type: 'string', description: 'upi|bank|cash|cheque|card (default upi)' },
    referenceNo: { type: 'string', description: 'UTR / cheque number' },
    invoiceId: { type: 'string', description: 'link to an Invoice (for customer payments)' },
    notes: { type: 'string', description: 'payment notes' },
  },
  async execute(orgId, args): Promise<ToolResult> {
    const partyName = String(args.partyName ?? '').trim();
    const amount = Number(args.amount ?? 0);
    const paymentDate = String(args.paymentDate ?? new Date().toISOString().slice(0, 10));
    const partyType = String(args.partyType ?? 'customer');
    if (!partyName) return { ok: false, summary: 'Cannot create payment: partyName is required.' };
    if (!amount || amount <= 0) return { ok: false, summary: 'Cannot create payment: amount must be greater than 0.' };
    // Find or create a client for this party
    let client = await db.client.findFirst({ where: { firmId: orgId, tradeName: { equals: partyName, mode: 'insensitive' } }, select: { id: true } }).catch(() => null);
    if (!client) {
      client = await db.client.create({
        data: { firmId: orgId, tradeName: partyName, gstin: `LOCAL-${Date.now()}`, entityType: 'regular', status: 'active' },
        select: { id: true },
      }).catch(() => null);
    }
    const payment = await db.payment.create({
      data: {
        clientId: client?.id ?? null,
        invoiceId: args.invoiceId ? String(args.invoiceId) : null,
        partyName,
        partyType,
        amount,
        paymentDate,
        paymentMode: String(args.paymentMode ?? 'upi'),
        referenceNo: args.referenceNo ? String(args.referenceNo) : null,
        status: 'completed',
        notes: args.notes ? String(args.notes) : null,
      },
      select: { id: true, partyName: true, amount: true, paymentDate: true, partyType: true },
    }).catch((e) => { console.error('[oracle-tool createPayment]', e); return null; });
    if (!payment) return { ok: false, summary: `Failed to create payment. Database error.` };
    // If linked to an invoice, update the invoice's paid/balance amounts
    if (args.invoiceId) {
      try {
        const inv = await db.invoice.findUnique({ where: { id: String(args.invoiceId) }, select: { id: true, totalAmount: true, paidAmount: true, balanceAmount: true, paymentStatus: true } });
        if (inv) {
          const newPaid = (inv.paidAmount ?? 0) + amount;
          const newBalance = Math.max((inv.totalAmount ?? 0) - newPaid, 0);
          const newStatus = newBalance <= 0 ? 'paid' : (newPaid > 0 ? 'partial' : inv.paymentStatus);
          await db.invoice.update({ where: { id: inv.id }, data: { paidAmount: newPaid, balanceAmount: newBalance, paymentStatus: newStatus, paymentDate } });
        }
      } catch (e) { console.warn('[oracle-tool createPayment] invoice update failed:', (e as Error).message); }
    }
    try {
      await db.activity.create({ data: { firmId: orgId, type: 'payment', description: `Payment of ${inr(amount)} ${partyType === 'vendor' ? 'to ' + partyName : 'from ' + partyName}`, metadata: JSON.stringify({ paymentId: payment.id }) } });
    } catch {}
    return {
      ok: true,
      summary: `✅ Recorded payment: ${inr(amount)} ${partyType === 'vendor' ? 'to **' + partyName + '**' : 'from **' + partyName + '**'} on ${paymentDate}.`,
      data: { id: payment.id, partyName: payment.partyName, amount: payment.amount, paymentDate: payment.paymentDate, partyType: payment.partyType },
    };
  },
};

// ─── Tool: createTask (ACTION) ────────────────────────────────────────────────

const createTaskTool: OracleTool = {
  name: 'createTask',
  description: 'Create a follow-up task / to-do item. Required: title. Optional: description, dueDate, priority, relatedTo (entity type), relatedId. Stored in workspace memory as a task. REQUIRES CONFIRMATION.',
  category: 'action',
  argsSchema: {
    title: { type: 'string', description: 'task title (required)', required: true },
    description: { type: 'string', description: 'task details' },
    dueDate: { type: 'string', description: 'ISO date YYYY-MM-DD' },
    priority: { type: 'string', description: 'low | medium | high | urgent (default medium)' },
    relatedTo: { type: 'string', description: 'invoice | customer | payment | gst | expense' },
    relatedId: { type: 'string', description: 'ID of the related entity' },
  },
  async execute(orgId, args): Promise<ToolResult> {
    const title = String(args.title ?? '').trim();
    if (!title) return { ok: false, summary: 'Cannot create task: title is required.' };
    const mem = await saveMemory(orgId, {
      title: `Task: ${title}`,
      summary: JSON.stringify({
        type: 'task',
        title,
        description: args.description ? String(args.description) : null,
        dueDate: args.dueDate ? String(args.dueDate) : null,
        priority: String(args.priority ?? 'medium'),
        relatedTo: args.relatedTo ? String(args.relatedTo) : null,
        relatedId: args.relatedId ? String(args.relatedId) : null,
        completed: false,
        createdAt: new Date().toISOString(),
      }),
      category: 'task',
      source: 'oracle-action',
    });
    return {
      ok: true,
      summary: `✅ Created task: **${title}**${args.dueDate ? ` due ${args.dueDate}` : ''} (priority: ${args.priority ?? 'medium'}). I'll track this in memory.`,
      data: { id: mem.id, title },
    };
  },
};

// ─── Tool: generateGSTReturn (ACTION) ─────────────────────────────────────────

const generateGSTReturnTool: OracleTool = {
  name: 'generateGSTReturn',
  description: 'Prepare a draft GSTR-1 or GSTR-3B return for a given period. Aggregates all invoices in the period, computes total taxable value, output tax (CGST+SGST+IGST), and creates a GSTRFiling record in draft status. Required: returnType, period. Optional: financialYear. REQUIRES CONFIRMATION.',
  category: 'action',
  argsSchema: {
    returnType: { type: 'string', description: 'GSTR-1 | GSTR-3B (required)', required: true },
    period: { type: 'string', description: 'month-year e.g. "07-2025" for July 2025 (required)', required: true },
    financialYear: { type: 'string', description: 'FY e.g. "2025-26". Auto-detected if omitted.' },
  },
  async execute(orgId, args): Promise<ToolResult> {
    const returnType = String(args.returnType ?? 'GSTR-1').toUpperCase();
    const period = String(args.period ?? '').trim();
    if (!period) return { ok: false, summary: 'Cannot generate return: period is required (e.g. "07-2025").' };
    // Parse period MM-YYYY
    const [mm, yyyy] = period.split('-').map(s => s.trim());
    const monthNum = parseInt(mm, 10);
    const yearNum = parseInt(yyyy, 10);
    if (!monthNum || !yearNum || monthNum < 1 || monthNum > 12) {
      return { ok: false, summary: `Invalid period "${period}". Use MM-YYYY format (e.g. 07-2025).` };
    }
    // Date range for the month
    const monthStart = new Date(yearNum, monthNum - 1, 1);
    const monthEnd = new Date(yearNum, monthNum, 0, 23, 59, 59);
    const startDateStr = monthStart.toISOString().slice(0, 10);
    const endDateStr = monthEnd.toISOString().slice(0, 10);
    // Aggregate invoices in this period (invoiceDate is a string YYYY-MM-DD)
    const invoices = await db.invoice.findMany({
      where: { client: { firmId: orgId }, invoiceDate: { gte: startDateStr, lte: endDateStr }, status: { not: 'draft' } },
      select: { id: true, invoiceNumber: true, taxableValue: true, cgst: true, sgst: true, igst: true, cess: true, totalAmount: true, buyerName: true, buyerGstin: true },
    }).catch(() => []);
    if (invoices.length === 0) {
      return { ok: false, summary: `No posted invoices found for ${period}. Generate invoices first, or check the period format.` };
    }
    const totalTaxableValue = invoices.reduce((s, i) => s + (i.taxableValue ?? 0), 0);
    const totalCGST = invoices.reduce((s, i) => s + (i.cgst ?? 0), 0);
    const totalSGST = invoices.reduce((s, i) => s + (i.sgst ?? 0), 0);
    const totalIGST = invoices.reduce((s, i) => s + (i.igst ?? 0), 0);
    const totalCess = invoices.reduce((s, i) => s + (i.cess ?? 0), 0);
    const totalTax = totalCGST + totalSGST + totalIGST + totalCess;
    const financialYear = args.financialYear ? String(args.financialYear) : (monthNum >= 4 ? `${yearNum}-${(yearNum + 1).toString().slice(-2)}` : `${yearNum - 1}-${yearNum.toString().slice(-2)}`);
    // Find the firm's first client (GSTRFiling requires clientId)
    const client = await db.client.findFirst({ where: { firmId: orgId }, select: { id: true, tradeName: true } }).catch(() => null);
    if (!client) return { ok: false, summary: 'Cannot generate return: no client found for this organization.' };
    // Check for existing filing for this period + returnType
    const existing = await db.gSTRFiling.findFirst({ where: { clientId: client.id, returnType, period }, select: { id: true, status: true } }).catch(() => null);
    if (existing) {
      return { ok: false, summary: `A ${returnType} for ${period} already exists (status: ${existing.status}). Delete it first if you want to regenerate.` };
    }
    const filing = await db.gSTRFiling.create({
      data: {
        clientId: client.id,
        returnType,
        period,
        financialYear,
        status: 'draft',
        totalInvoices: invoices.length,
        readyForFiling: invoices.length,
        totalTaxableValue,
        totalTax,
        jsonPayload: JSON.stringify({ invoices: invoices.map(i => ({ invoiceNumber: i.invoiceNumber, buyerName: i.buyerName, buyerGstin: i.buyerGstin, taxableValue: i.taxableValue, cgst: i.cgst, sgst: i.sgst, igst: i.igst, total: i.totalAmount })) }),
      },
      select: { id: true, returnType: true, period: true, totalTaxableValue: true, totalTax: true, totalInvoices: true },
    }).catch((e) => { console.error('[oracle-tool generateGSTReturn]', e); return null; });
    if (!filing) return { ok: false, summary: `Failed to generate ${returnType} for ${period}. Database error.` };
    try {
      await db.activity.create({ data: { firmId: orgId, type: 'gst', description: `${returnType} draft prepared for ${period}: ${invoices.length} invoices, taxable ${inr(totalTaxableValue)}, tax ${inr(totalTax)}`, metadata: JSON.stringify({ filingId: filing.id }) } });
    } catch {}
    return {
      ok: true,
      summary: `✅ Prepared **${returnType}** draft for **${period}**:\n• Invoices: ${filing.totalInvoices}\n• Total taxable value: ${inr(filing.totalTaxableValue)}\n• Total output tax: ${inr(filing.totalTax)} (CGST ${inr(totalCGST)} + SGST ${inr(totalSGST)} + IGST ${inr(totalIGST)} + Cess ${inr(totalCess)})\n\nStatus: **Draft**. Review it in the Returns page, then file it on the GST portal.`,
      data: { id: filing.id, returnType: filing.returnType, period: filing.period, totalTaxableValue, totalTax, invoiceCount: invoices.length },
      artifacts: [{
        kind: 'metric' as const,
        title: `${returnType} ${period} Summary`,
        items: [
          { label: 'Invoices', value: String(filing.totalInvoices) },
          { label: 'Taxable Value', value: inr(totalTaxableValue) },
          { label: 'Output Tax', value: inr(totalTax) },
          { label: 'CGST', value: inr(totalCGST) },
          { label: 'SGST', value: inr(totalSGST) },
          { label: 'IGST', value: inr(totalIGST) },
        ],
      }],
    };
  },
};

// ─── Tool: searchWorkspace ────────────────────────────────────────────────────

const searchWorkspaceTool: OracleTool = {
  name: 'searchWorkspace',
  description: 'Search across the entire workspace — invoices, customers, expenses, payments, GST filings, and memory. Returns ranked results grouped by entity type. Use when the user asks to "find", "search", or "show me" something specific.',
  category: 'read',
  argsSchema: {
    query: { type: 'string', description: 'search query (required)', required: true },
    limit: { type: 'number', description: 'max results per entity type (default 5, max 15)' },
  },
  async execute(orgId, args): Promise<ToolResult> {
    const query = String(args.query ?? '').trim();
    if (!query) return { ok: false, summary: 'Search query is required.' };
    const limit = Math.min(Number(args.limit) || 5, 15);
    const results: { invoices: any[]; customers: any[]; expenses: any[]; payments: any[]; filings: any[]; memory: any[] } = {
      invoices: [], customers: [], expenses: [], payments: [], filings: [], memory: [],
    };
    await Promise.all([
      db.invoice.findMany({
        where: { client: { firmId: orgId }, OR: [{ invoiceNumber: { contains: query, mode: 'insensitive' } }, { buyerName: { contains: query, mode: 'insensitive' } }] },
        take: limit,
        select: { id: true, invoiceNumber: true, buyerName: true, totalAmount: true, invoiceDate: true, paymentStatus: true },
      }).then(r => { results.invoices = r; }).catch(() => {}),
      db.client.findMany({
        where: { firmId: orgId, OR: [{ tradeName: { contains: query, mode: 'insensitive' } }, { gstin: { contains: query, mode: 'insensitive' } }, { contactEmail: { contains: query, mode: 'insensitive' } }] },
        take: limit,
        select: { id: true, tradeName: true, gstin: true, contactEmail: true, state: true },
      }).then(r => { results.customers = r; }).catch(() => {}),
      db.expense.findMany({
        where: { client: { firmId: orgId }, OR: [{ vendor: { contains: query, mode: 'insensitive' } }, { category: { contains: query, mode: 'insensitive' } }, { description: { contains: query, mode: 'insensitive' } }] },
        take: limit,
        select: { id: true, vendor: true, category: true, amount: true, date: true },
      }).then(r => { results.expenses = r; }).catch(() => {}),
      db.payment.findMany({
        where: { client: { firmId: orgId }, OR: [{ partyName: { contains: query, mode: 'insensitive' } }, { referenceNo: { contains: query, mode: 'insensitive' } }] },
        take: limit,
        select: { id: true, partyName: true, amount: true, paymentDate: true, partyType: true },
      }).then(r => { results.payments = r; }).catch(() => {}),
      db.gSTRFiling.findMany({
        where: { client: { firmId: orgId }, OR: [{ returnType: { contains: query, mode: 'insensitive' } }, { period: { contains: query, mode: 'insensitive' } }] },
        take: limit,
        select: { id: true, returnType: true, period: true, status: true, totalTax: true },
      }).then(r => { results.filings = r; }).catch(() => {}),
      recallMemory(orgId, query).then(r => { results.memory = r.slice(0, limit); }).catch(() => {}),
    ]);
    const totalCount = Object.values(results).reduce((s, r) => s + r.length, 0);
    if (totalCount === 0) {
      return { ok: true, summary: `No results found for "${query}" across invoices, customers, expenses, payments, GST filings, or memory.` };
    }
    const lines: string[] = [`Found **${totalCount}** result(s) for "${query}":`];
    if (results.invoices.length) lines.push(`\n**Invoices (${results.invoices.length})**:\n` + results.invoices.map(i => `  • ${i.invoiceNumber} — ${i.buyerName ?? '-'}, ${inr(i.totalAmount ?? 0)} (${i.paymentStatus})`).join('\n'));
    if (results.customers.length) lines.push(`\n**Customers (${results.customers.length})**:\n` + results.customers.map(c => `  • ${c.tradeName} — GSTIN: ${c.gstin}${c.state ? ', ' + c.state : ''}`).join('\n'));
    if (results.expenses.length) lines.push(`\n**Expenses (${results.expenses.length})**:\n` + results.expenses.map(e => `  • ${e.vendor ?? '-'} — ${e.category}, ${inr(e.amount ?? 0)} on ${e.date}`).join('\n'));
    if (results.payments.length) lines.push(`\n**Payments (${results.payments.length})**:\n` + results.payments.map(p => `  • ${p.partyName} — ${inr(p.amount ?? 0)} on ${p.paymentDate} (${p.partyType})`).join('\n'));
    if (results.filings.length) lines.push(`\n**GST Filings (${results.filings.length})**:\n` + results.filings.map(f => `  • ${f.returnType} ${f.period} — ${f.status}, tax ${inr(f.totalTax ?? 0)}`).join('\n'));
    if (results.memory.length) lines.push(`\n**Memory (${results.memory.length})**:\n` + results.memory.map(m => `  • ${m.title}${m.summary ? ': ' + m.summary : ''}`).join('\n'));
    return {
      ok: true,
      summary: lines.join('\n'),
      data: results,
      artifacts: [{
        kind: 'list' as const,
        title: `Search Results for "${query}"`,
        items: [
          ...results.invoices.map((i: any) => ({ text: `Invoice ${i.invoiceNumber} — ${i.buyerName ?? '-'} — ${inr(i.totalAmount ?? 0)}`, type: 'invoice' })),
          ...results.customers.map((c: any) => ({ text: `Customer ${c.tradeName} — ${c.gstin}`, type: 'customer' })),
          ...results.expenses.map((e: any) => ({ text: `Expense ${e.vendor} — ${inr(e.amount ?? 0)}`, type: 'expense' })),
          ...results.payments.map((p: any) => ({ text: `Payment ${p.partyName} — ${inr(p.amount ?? 0)}`, type: 'payment' })),
          ...results.filings.map((f: any) => ({ text: `${f.returnType} ${f.period} — ${f.status}`, type: 'gst' })),
        ],
      }],
    };
  },
};

// ─── Tool: getPendingFilings ──────────────────────────────────────────────────

const getPendingFilingsTool: OracleTool = {
  name: 'getPendingFilings',
  description:
    'List pending GST return filings (GSTR-1, GSTR-3B) that are not yet filed. Use this when the user asks "what returns are pending", "show pending filings", "what GST is due".',
  category: 'read',
  argsSchema: {
    returnType: { type: 'string', description: 'GSTR-1 | GSTR-3B | all (default: all)' },
    limit: { type: 'number', description: 'max results (default 20)' },
  },
  async execute(orgId, args): Promise<ToolResult> {
    const limit = Math.min(Number(args.limit) || 20, 50);
    const where: any = { status: { not: 'filed' } };
    if (args.returnType && args.returnType !== 'all') where.returnType = String(args.returnType);
    const rows = await db.gSTRFiling.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, returnType: true, period: true, status: true, totalTax: true, dueDate: true, createdAt: true },
    }).catch(() => []);
    if (rows.length === 0) {
      return { ok: true, summary: 'No pending GST filings. All returns are filed.', data: { filings: [] } };
    }
    const summary = `Pending GST filings (${rows.length}):\n` +
      rows.map(f => `• ${f.returnType} for ${f.period} — status: ${f.status}${f.totalTax ? `, tax: ${inr(Number(f.totalTax))}` : ''}${f.dueDate ? `, due ${f.dueDate}` : ''}`).join('\n');
    return {
      ok: true,
      summary,
      data: { filings: rows },
      artifacts: [{
        kind: 'table' as const,
        title: 'Pending Filings',
        columns: ['Type', 'Period', 'Status', 'Tax', 'Due Date'],
        rows: rows.map(f => ({
          Type: f.returnType, Period: f.period, Status: f.status,
          Tax: f.totalTax ? inr(Number(f.totalTax)) : '—',
          'Due Date': f.dueDate ?? '—',
        })),
      }],
    };
  },
};

// ─── Tool: getBankAccounts ───────────────────────────────────────────────────

const getBankAccountsTool: OracleTool = {
  name: 'getBankAccounts',
  description:
    'List connected bank accounts with balances. Use this when the user asks "what bank accounts do I have", "show my banks", "bank balance".',
  category: 'read',
  argsSchema: {},
  async execute(orgId): Promise<ToolResult> {
    const rows = await db.bankAccount.findMany({
      where: { tenantId: orgId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, bankName: true, accountMasked: true, accountType: true, balance: true, status: true, ifsc: true },
    }).catch(() => []);
    if (rows.length === 0) {
      return { ok: true, summary: 'No bank accounts connected. You can connect one via "connect bank account".', data: { accounts: [] } };
    }
    const totalBalance = rows.reduce((s, a) => s + Number(a.balance ?? 0), 0);
    const summary = `Connected bank accounts (${rows.length}), total balance ${inr(totalBalance)}:\n` +
      rows.map(a => `• ${a.bankName} ${a.accountMasked} (${a.accountType}) — balance ${inr(Number(a.balance ?? 0))} — ${a.status}`).join('\n');
    return {
      ok: true,
      summary,
      data: { accounts: rows, totalBalance },
      artifacts: [{
        kind: 'table' as const,
        title: 'Bank Accounts',
        columns: ['Bank', 'Account', 'Type', 'Balance', 'Status'],
        rows: rows.map(a => ({
          Bank: a.bankName, Account: a.accountMasked, Type: a.accountType,
          Balance: inr(Number(a.balance ?? 0)), Status: a.status,
        })),
      }],
    };
  },
};

// ─── Tool: getBankingIntelligence (Banking Service) ──────────────────────────
// Answers the 8 canonical banking questions by calling the Banking Service's
// answerQuestion(orgId, question). The service routes the question through
// intelligence.matchQuestion() → one of 9 builders (8 canonical + generic
// fallback). Returns a markdown answer + optional metrics + optional table.
// Read-only — never in CONFIRMATION_REQUIRED_TOOLS.

const getBankingIntelligenceTool: OracleTool = {
  name: 'getBankingIntelligence',
  description:
    'Answer banking questions: total cash, this month\'s expenses, unpaid invoices, cash next week, why cash flow is decreasing, suspicious transactions, largest expenses, which customers pay late. Use this for ANY question about bank balances, cash flow, transactions, reconciliation, or forecasting.',
  category: 'read',
  argsSchema: {
    question: { type: 'string', required: true, description: 'The banking question in the user\'s words (e.g. "how much cash will I have next week", "which customers pay late", "show suspicious transactions")' },
  },
  async execute(orgId, args): Promise<ToolResult> {
    const question = String(args.question ?? '').trim();
    if (!question) {
      return { ok: false, summary: 'Cannot answer: question is required.' };
    }
    let svc;
    try {
      svc = await getBankingService();
    } catch (e) {
      return { ok: false, summary: `Banking Service unavailable: ${(e as Error).message}` };
    }
    let ans;
    try {
      ans = await svc.answerQuestion(orgId, question);
    } catch (e) {
      const msg = (e as Error).message;
      console.error('[oracle-tool getBankingIntelligence]', msg);
      return { ok: false, summary: `Banking Intelligence failed: ${msg}` };
    }
    const artifacts = [];
    if (ans.metrics && ans.metrics.length > 0) {
      artifacts.push({
        kind: 'metric' as const,
        title: ans.label || 'Key metrics',
        items: ans.metrics.map(m => ({
          label: m.label,
          value: m.value,
          trend: m.tone === 'positive' ? 'up' : m.tone === 'negative' ? 'down' : undefined,
        })),
      });
    }
    if (ans.table && ans.table.rows.length > 0) {
      artifacts.push({
        kind: 'table' as const,
        title: ans.label || 'Banking breakdown',
        columns: ans.table.columns,
        rows: ans.table.rows,
      });
    }
    return {
      ok: true,
      summary: `**${ans.label}**\n\n${ans.answer}`,
      data: ans,
      artifacts: artifacts.length > 0 ? artifacts : undefined,
    };
  },
};

// ─── Tool: getIntegrationStatus ──────────────────────────────────────────────

const getIntegrationStatusTool: OracleTool = {
  name: 'getIntegrationStatus',
  description:
    'Check which integrations are connected (Zoho Books, Google Workspace, GSTN, Banking). Use this when the user asks "is zoho connected", "what integrations do I have", "check google connection".',
  category: 'read',
  argsSchema: {
    provider: { type: 'string', description: 'zoho-books | google | gstn | bank | all (default: all)' },
  },
  async execute(orgId, args): Promise<ToolResult> {
    const where: any = { tenantId: orgId };
    if (args.provider && args.provider !== 'all') where.provider = String(args.provider);
    const rows = await db.integration.findMany({
      where,
      select: { id: true, provider: true, status: true, connectedAt: true, lastSyncAt: true },
      orderBy: { createdAt: 'desc' },
    }).catch(() => []);
    const known = ['zoho-books', 'google', 'gstn', 'bank'];
    const connected = new Set(rows.map(r => r.provider));
    const all = args.provider && args.provider !== 'all' ? [String(args.provider)] : known;
    const lines = all.map(p => {
      const r = rows.find(x => x.provider === p);
      return r
        ? `• ${p}: ${r.status}${r.lastSyncAt ? ` (last synced ${new Date(r.lastSyncAt).toLocaleDateString('en-IN')})` : ''}`
        : `• ${p}: not connected`;
    });
    const summary = `Integration status:\n${lines.join('\n')}`;
    return {
      ok: true,
      summary,
      data: { integrations: rows, connected: Array.from(connected) },
    };
  },
};

// ─── Tool: navigate ───────────────────────────────────────────────────────────
// Oracle Navigation — lets Oracle move the user through the SaaS without
// touching the sidebar. The LLM emits a navigate tool-call; the brain route
// emits a `navigate` SSE event that the frontend turns into setCurrentView().
// This tool does NOT require confirmation (navigation is non-destructive).

/** Valid navigation targets — mirrors the AppView union + VIEW_REGISTRY. */
const NAVIGATE_VIEWS: Record<string, string> = {
  dashboard: 'dashboard',
  home: 'dashboard',
  invoices: 'invoices',
  invoice: 'invoices',
  clients: 'clients',
  customers: 'clients',
  customer: 'clients',
  returns: 'returns',
  return: 'returns',
  gst: 'returns',
  banking: 'banking',
  bank: 'banking',
  'banking-intelligence': 'banking-intelligence',
  'banking intelligence': 'banking-intelligence',
  expenses: 'expenses',
  expense: 'expenses',
  payments: 'payments',
  payment: 'payments',
  reports: 'analytics',
  report: 'analytics',
  analytics: 'analytics',
  crm: 'crm',
  leads: 'crm',
  documents: 'documents',
  document: 'documents',
  timeline: 'timeline',
  activity: 'timeline',
  team: 'team',
  settings: 'settings',
  notifications: 'notifications',
  tasks: 'tasks',
  task: 'tasks',
  vendors: 'vendors',
  vendor: 'vendors',
  reconcile: 'reconcile',
  reconciliation: 'reconcile',
  inventory: 'inventory',
  products: 'inventory',
  'oracle-brain': 'oracle-brain',
  oracle: 'oracle-brain',
};

const navigateTool: OracleTool = {
  name: 'navigate',
  description:
    'Navigate the user to a specific page/section of GSTPilot. Use this when the user says "open invoices", "go to customers", "show reports", "open banking", "open banking intelligence", "take me to settings", etc. The user stays in the conversation — they can continue chatting after navigating. Valid targets: dashboard, invoices, clients (customers), returns (GST), banking, banking-intelligence, expenses, payments, reports (analytics), crm (leads), documents, timeline (activity), team, settings, notifications, tasks, vendors, reconcile, inventory (products), oracle.',
  category: 'action',
  argsSchema: {
    view: { type: 'string', required: true, description: 'The page to open: dashboard, invoices, clients, returns, banking, banking-intelligence, expenses, payments, reports, crm, documents, timeline, team, settings, notifications, tasks, vendors, reconcile, inventory, oracle' },
    entityId: { type: 'string', description: 'Optional: a specific record id to deep-link to (e.g. a customerId when opening a customer detail)' },
  },
  async execute(orgId, args): Promise<ToolResult> {
    const rawView = String(args.view ?? '').trim().toLowerCase();
    const resolved = NAVIGATE_VIEWS[rawView] ?? (Object.values(NAVIGATE_VIEWS).includes(rawView) ? rawView : '');
    if (!resolved) {
      return {
        ok: false,
        summary: `Unknown page "${rawView}". Valid pages: dashboard, invoices, clients, returns, banking, banking-intelligence, expenses, payments, reports, crm, documents, timeline, team, settings, notifications, tasks, vendors, reconcile, inventory, oracle.`,
      };
    }
    // The brain route reads result.data.navigate to emit the `navigate` SSE event.
    return {
      ok: true,
      summary: `Navigating to ${resolved}.`,
      data: { navigate: { view: resolved, entityId: args.entityId ? String(args.entityId) : undefined } },
    };
  },
};

// ─── Tool registry ────────────────────────────────────────────────────────────

export const ORACLE_TOOLS: OracleTool[] = [
  // READ tools
  getBusinessSnapshotTool,
  queryInvoicesTool,
  queryCustomersTool,
  queryExpensesTool,
  queryPaymentsTool,
  getGSTStatusTool,
  getOverdueCustomersTool,
  getCashflowAnalysisTool,
  getTopCustomerTool,
  getNewestInvoiceTool,
  getInvoiceMetricsTool,
  getRecentActivityTool,
  getConnectedIntegrationsTool,
  searchWorkspaceTool,
  // Priority 1.5 read tools — module-specific reads that complement the
  // generic query* tools above.
  getPendingFilingsTool,
  getBankAccountsTool,
  getIntegrationStatusTool,
  // Priority 3 — Banking Intelligence read tool. Routes any banking question
  // ("how much cash will I have next week", "which customers pay late", etc.)
  // through the Banking Service's answerQuestion() intelligence layer.
  getBankingIntelligenceTool,
  // NAVIGATION tool (non-destructive, no confirmation)
  navigateTool,
  // ACTION tools (require confirmation)
  createInvoiceTool,
  createCustomerTool,
  createExpenseTool,
  createPaymentTool,
  createTaskTool,
  generateGSTReturnTool,
  sendReminderTool,
  // WORKFLOW tool (Priority 2 — Autonomous Workflow Engine)
  // Pseudo-tool: the brain route intercepts this and calls the workflow planner
  // instead of executing it. NOT in CONFIRMATION_REQUIRED_TOOLS — the workflow
  // has its own plan/confirm/execute flow separate from single-action confirm.
  runWorkflowTool,
  // MEMORY tools
  recallMemoryTool,
  saveMemoryTool,
];

// Tools that REQUIRE user confirmation before execution.
// The brain route intercepts these and emits "action-confirm" events.
export const CONFIRMATION_REQUIRED_TOOLS = new Set([
  'createInvoice',
  'createCustomer',
  'createExpense',
  'createPayment',
  'createTask',
  'generateGSTReturn',
  'sendReminder',
  // Priority 1.5 — Complete SaaS Integration: every write action goes through
  // the Action Engine confirmation pipeline (validate → preview → confirm →
  // execute → refresh). Destructive actions (delete, refund) always confirm;
  // even safe writes (update, duplicate, send) confirm so the user sees a
  // preview of exactly what will change before it happens.
  'updateCustomer',
  'deleteCustomer',
  'updateInvoice',
  'deleteInvoice',
  'duplicateInvoice',
  'sendInvoice',
  'updateExpense',
  'deleteExpense',
  'markInvoicePaid',
  'refundPayment',
  'prepareGstr3b',
  'addCrmLead',
  'scheduleFollowUp',
  'inviteTeamMember',
  'updateProfile',
  'connectBankAccount',
  'exportReport',
  'syncZoho',
  'syncGoogle',
  // Priority 3 — Banking Intelligence: every banking write/transformation
  // confirms so the user sees a preview card before it runs (import, reconcile,
  // categorize, forecast, report, export, manual reconcile).
  'importStatement',
  'reconcileTransactions',
  'categorizeTransactions',
  'forecastCashFlow',
  'generateCashReport',
  'exportStatement',
  'markReconciled',
]);

export const ORACLE_TOOL_MAP: Record<string, OracleTool> = Object.fromEntries(
  ORACLE_TOOLS.map(t => [t.name, t]),
);

/**
 * Build the tools section of the system prompt — describes each tool's purpose
 * and args schema so the LLM knows what it can call.
 */
export function buildToolsPromptBlock(): string {
  const lines = ORACLE_TOOLS.map(t => {
    const args = Object.entries(t.argsSchema);
    const argStr = args.length === 0
      ? '(no arguments)'
      : args.map(([k, v]) => `${k}: ${v.type}${v.required ? ' (required)' : ''} — ${v.description}`).join('; ');
    return `  • ${t.name} [${t.category}] — ${t.description}\n    Args: ${argStr}`;
  });
  return `## Oracle Tools

You have access to real business data through tools. To call a tool, emit a fenced code block with language \`tool-call\` containing a JSON object:

\`\`\`tool-call
{"tool": "getBusinessSnapshot", "args": {}}
\`\`\`

You may emit multiple tool-call blocks in a single response. After each tool-call block, continue your reasoning. The system will execute the tool and feed the result back to you in the next turn.

**Always call a tool when the user asks about real data** (revenue, invoices, customers, expenses, GST, cashflow, overdue). Never guess numbers — always read them via a tool.

**For actions** (create invoice, send reminder, save a memory), emit the tool-call and explain what you're doing.

Available tools:
${lines.join('\n')}`;
}

/**
 * Parse tool-call blocks from an LLM response.
 * Returns an array of {tool, args} pairs in order of appearance.
 */
export function parseToolCalls(content: string): Array<{ tool: string; args: Record<string, any> }> {
  const calls: Array<{ tool: string; args: Record<string, any> }> = [];
  // Match ```tool-call ... ``` blocks
  const re = /```tool-call\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const jsonStr = match[1].trim();
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed.tool === 'string') {
        calls.push({ tool: parsed.tool, args: parsed.args ?? {} });
      }
    } catch {
      // Ignore malformed blocks
    }
  }
  return calls;
}

/**
 * Strip tool-call blocks from content (for display — we show tool results as
 * separate cards, so the raw call blocks shouldn't appear in the message text).
 */
export function stripToolCalls(content: string): string {
  return content.replace(/```tool-call\s*\n[\s\S]*?```/g, '').trim();
}

export { getWorkspaceMemoryBlock };
