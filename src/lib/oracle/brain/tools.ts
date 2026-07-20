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
    const where: any = { firmId: orgId };
    if (args.status === 'paid') where.status = 'paid';
    else if (args.status === 'unpaid') where.status = { in: ['sent', 'unpaid', 'partial'] };
    else if (args.status === 'overdue') where.status = 'overdue';
    else if (args.status === 'draft') where.status = 'draft';
    if (args.customerName) {
      where.clientName = { contains: String(args.customerName), mode: 'insensitive' };
    }
    const rows = await db.invoice.findMany({
      where,
      orderBy: { invoiceDate: 'desc' },
      take: limit,
      select: {
        id: true, invoiceNumber: true, clientName: true, status: true,
        total: true, balanceAmount: true, invoiceDate: true, dueDate: true,
      },
    });
    const total = rows.reduce((s, r) => s + (r.total ?? 0), 0);
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
          Customer: r.clientName,
          Status: r.status,
          Total: inr(r.total ?? 0),
          Balance: inr(r.balanceAmount ?? 0),
          Date: r.invoiceDate ? new Date(r.invoiceDate).toLocaleDateString('en-IN') : '-',
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
    const where: any = { firmId: orgId };
    if (args.search) {
      where.OR = [
        { name: { contains: String(args.search), mode: 'insensitive' } },
        { email: { contains: String(args.search), mode: 'insensitive' } },
        { gstin: { contains: String(args.search), mode: 'insensitive' } },
      ];
    }
    const rows = await db.client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, name: true, email: true, phone: true, gstin: true, city: true },
    });
    const summary = rows.length === 0 ? 'No customers found.' : `Found ${rows.length} customer(s).`;
    return {
      ok: true,
      summary,
      data: rows,
      artifacts: rows.length > 0 ? [{
        kind: 'table' as const,
        title: 'Customers',
        columns: ['Name', 'Email', 'Phone', 'GSTIN', 'City'],
        rows: rows.map(r => ({
          Name: r.name,
          Email: r.email ?? '-',
          Phone: r.phone ?? '-',
          GSTIN: r.gstin ?? '-',
          City: r.city ?? '-',
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
    const where: any = { firmId: orgId };
    if (args.category) where.category = { contains: String(args.category), mode: 'insensitive' };
    const rows = await db.expense.findMany({
      where,
      orderBy: { expenseDate: 'desc' },
      take: limit,
      select: { id: true, vendorName: true, category: true, amount: true, expenseDate: true, status: true },
    });
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
          Vendor: r.vendorName ?? '-',
          Category: r.category ?? '-',
          Amount: inr(r.amount ?? 0),
          Date: r.expenseDate ? new Date(r.expenseDate).toLocaleDateString('en-IN') : '-',
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
    const where: any = { firmId: orgId };
    if (args.direction === 'received') where.type = 'received';
    else if (args.direction === 'paid') where.type = 'paid';
    const rows = await db.payment.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      take: limit,
      select: { id: true, type: true, partyName: true, amount: true, paymentDate: true, method: true, referenceNumber: true },
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
    const [filings, snap] = await Promise.all([
      db.gSTRFiling.findMany({
        where: { firmId: orgId },
        orderBy: { dueDate: 'desc' },
        take: 10,
        select: { id: true, returnType: true, period: true, status: true, dueDate: true, netTaxPayable: true },
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
        ? `\n• Upcoming filings:\n` + upcoming.map(f => `  - ${f.returnType} for ${f.period}, due ${f.dueDate ? new Date(f.dueDate).toLocaleDateString('en-IN') : '-'}, status: ${f.status}`).join('\n')
        : '');
    return {
      ok: true,
      summary,
      data: { filings, snapshot: { outputTax: snap.outputTax, inputTax: snap.inputTax, gstLiability: snap.gstLiability, filedReturns: snap.filedReturns, pendingReturns: snap.pendingReturns, overdueReturns: snap.overdueReturns } },
      artifacts: filings.length > 0 ? [{
        kind: 'table' as const,
        title: 'GST Filings',
        columns: ['Return', 'Period', 'Status', 'Due Date', 'Net Payable'],
        rows: filings.map(f => ({
          Return: f.returnType,
          Period: f.period,
          Status: f.status,
          'Due Date': f.dueDate ? new Date(f.dueDate).toLocaleDateString('en-IN') : '-',
          'Net Payable': inr(f.netTaxPayable ?? 0),
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
    const rows = await db.invoice.findMany({
      where: { firmId: orgId, status: 'overdue' },
      orderBy: { dueDate: 'asc' },
      take: 50,
      select: { id: true, invoiceNumber: true, clientName: true, balanceAmount: true, dueDate: true, total: true },
    });
    const now = new Date();
    const grouped = new Map<string, { name: string; total: number; count: number; oldestDays: number }>();
    for (const r of rows) {
      const name = r.clientName ?? 'Unknown';
      const existing = grouped.get(name) ?? { name, total: 0, count: 0, oldestDays: 0 };
      existing.total += r.balanceAmount ?? 0;
      existing.count += 1;
      if (r.dueDate) {
        const days = Math.floor((now.getTime() - new Date(r.dueDate).getTime()) / 86400000);
        existing.oldestDays = Math.max(existing.oldestDays, days);
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
    let subtotal = 0;
    let taxTotal = 0;
    const invoiceItems = items.map((it: any, idx: number) => {
      const qty = Number(it.quantity ?? 1);
      const rate = Number(it.rate ?? 0);
      const gstRate = Number(it.gstRate ?? 18) / 100;
      const lineNet = qty * rate;
      const lineTax = lineNet * gstRate;
      subtotal += lineNet;
      taxTotal += lineTax;
      return {
        id: `item-${idx + 1}`,
        name: String(it.name ?? 'Item'),
        quantity: qty,
        rate,
        gstRate: Number(it.gstRate ?? 18),
        taxableAmount: lineNet,
        cgst: lineTax / 2,
        sgst: lineTax / 2,
        total: lineNet + lineTax,
      };
    });
    const total = subtotal + taxTotal;
    const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
    const now = new Date();
    const dueDate = args.dueDate ? new Date(args.dueDate) : new Date(now.getTime() + 15 * 86400000);

    // Try to find an existing client by name; if not found, create one.
    let client = await db.client.findFirst({
      where: { firmId: orgId, name: { equals: customerName, mode: 'insensitive' } },
      select: { id: true },
    }).catch(() => null);
    if (!client) {
      client = await db.client.create({
        data: { firmId: orgId, name: customerName, type: 'customer' },
        select: { id: true },
      }).catch(() => null);
    }

    const invoice = await db.invoice.create({
      data: {
        firmId: orgId,
        clientId: client?.id ?? null,
        invoiceNumber,
        clientName: customerName,
        status: 'draft',
        invoiceDate: args.invoiceDate ? new Date(args.invoiceDate) : now,
        dueDate,
        subtotal,
        cgst: taxTotal / 2,
        sgst: taxTotal / 2,
        igst: 0,
        total,
        balanceAmount: total,
        notes: args.notes ? String(args.notes) : null,
      },
      select: { id: true, invoiceNumber: true, total: true, dueDate: true },
    }).catch((e) => { console.error('[oracle-tool createInvoice]', e); return null; });

    if (!invoice) {
      return { ok: false, summary: `Failed to create invoice for ${customerName}. Database error.` };
    }

    // Persist invoice items if the InvoiceItem model is available
    try {
      await db.invoiceItem.createMany({
        data: invoiceItems.map(it => ({
          invoiceId: invoice.id,
          description: it.name,
          quantity: it.quantity,
          rate: it.rate,
          amount: it.total,
          cgst: it.cgst,
          sgst: it.sgst,
        })),
      });
    } catch (e) {
      // InvoiceItem model may have a different shape — non-fatal
      console.warn('[oracle-tool createInvoice] items not persisted:', (e as Error).message);
    }

    return {
      ok: true,
      summary: `✅ Created invoice ${invoice.invoiceNumber} for ${customerName}. Total: ${inr(invoice.total)}. Due: ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}. Status: Draft. You can review and send it from the Invoices page.`,
      data: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, total, customerName, items: invoiceItems },
      artifacts: [{
        kind: 'table' as const,
        title: `Invoice ${invoice.invoiceNumber}`,
        columns: ['Item', 'Qty', 'Rate', 'GST %', 'Amount'],
        rows: invoiceItems.map(it => ({
          Item: it.name,
          Qty: it.quantity,
          Rate: inr(it.rate),
          'GST %': it.gstRate + '%',
          Amount: inr(it.total),
        })),
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
    // Fetch overdue invoices
    const where: any = { firmId: orgId, status: 'overdue' };
    if (args.customerName) {
      where.clientName = { contains: String(args.customerName), mode: 'insensitive' };
    }
    const invoices = await db.invoice.findMany({
      where,
      select: { id: true, invoiceNumber: true, clientName: true, balanceAmount: true, dueDate: true, clientId: true },
      take: 50,
    });
    if (invoices.length === 0) {
      return { ok: false, summary: args.customerName ? `No overdue invoices found for "${args.customerName}".` : 'No overdue invoices to send reminders for.' };
    }
    // Group by customer
    const byCustomer = new Map<string, { invoices: typeof invoices; total: number }>();
    for (const inv of invoices) {
      const name = inv.clientName ?? 'Unknown';
      const existing = byCustomer.get(name) ?? { invoices: [], total: 0 };
      existing.invoices.push(inv);
      existing.total += inv.balanceAmount ?? 0;
      byCustomer.set(name, existing);
    }
    // Create communication logs
    const logs: { customer: string; amount: number; invoiceCount: number }[] = [];
    for (const [name, group] of byCustomer) {
      try {
        await db.communicationLog.create({
          data: {
            firmId: orgId,
            channel,
            recipientName: name,
            recipientId: group.invoices[0]?.clientId ?? null,
            subject: `Payment Reminder — ${group.invoices.length} invoice(s) overdue`,
            body: `Dear ${name}, this is a reminder that ${group.invoices.length} invoice(s) totaling ${inr(group.total)} are overdue. Please arrange payment at your earliest convenience. Invoices: ${group.invoices.map(i => i.invoiceNumber).join(', ')}.`,
            status: 'queued',
            direction: 'outbound',
            type: 'reminder',
          },
        });
      } catch (e) {
        // CommunicationLog model may differ — non-fatal
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

// ─── Tool registry ────────────────────────────────────────────────────────────

export const ORACLE_TOOLS: OracleTool[] = [
  getBusinessSnapshotTool,
  queryInvoicesTool,
  queryCustomersTool,
  queryExpensesTool,
  queryPaymentsTool,
  getGSTStatusTool,
  getOverdueCustomersTool,
  getCashflowAnalysisTool,
  createInvoiceTool,
  sendReminderTool,
  recallMemoryTool,
  saveMemoryTool,
];

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
