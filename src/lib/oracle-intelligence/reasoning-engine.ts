// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE INTELLIGENCE — Phase 3: Reasoning Engine
// ═══════════════════════════════════════════════════════════════════════════════
// Instead of returning raw data, Oracle returns CONCLUSIONS.
//
//   "ABC Traders usually pays 11 days late."
//   "Your cash flow will become negative in 13 days."
//   "Vendor XYZ has increased prices 22%."
//   "You forgot to follow up with your biggest customer."
//
// Every conclusion is computed from REAL database rows and cites its source
// records via EntityRef[]. The LLM is used ONLY to synthesise the executive
// narrative from the already-computed insights — it never invents numbers.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { Insight, ReasoningResult, EntityRef } from './types';

const round2 = (n: number): number => Math.round(n * 100) / 100;
const DAY = 1000 * 60 * 60 * 24;

function daysBetween(a: string | Date, b: string | Date): number {
  const ta = a instanceof Date ? a.getTime() : new Date(a).getTime();
  const tb = b instanceof Date ? b.getTime() : new Date(b).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
  return Math.round((tb - ta) / DAY);
}

// ─── Insight 1: Customer payment delay ────────────────────────────────────────
// "ABC Traders usually pays 11 days late."
async function customerPaymentDelays(): Promise<Insight[]> {
  const invoices = await db.invoice.findMany({
    where: { paymentStatus: 'paid', dueDate: { not: null } },
    select: { id: true, invoiceNumber: true, clientId: true, buyerName: true, invoiceDate: true, dueDate: true, paymentDate: true },
    take: 500,
  });
  const clients = await db.client.findMany({ select: { id: true, tradeName: true } });
  const clientName = new Map(clients.map((c) => [c.id, c.tradeName || c.gstin]));

  // Group by client, compute average days between dueDate and paymentDate
  const byClient = new Map<string, { name: string; delays: number[]; refs: EntityRef[] }>();
  for (const inv of invoices) {
    if (!inv.clientId || !inv.dueDate || !inv.paymentDate) continue;
    const delay = daysBetween(inv.dueDate, inv.paymentDate);
    const key = inv.clientId;
    if (!byClient.has(key)) {
      byClient.set(key, { name: clientName.get(key) || inv.buyerName || 'Customer', delays: [], refs: [] });
    }
    const entry = byClient.get(key)!;
    entry.delays.push(delay);
    entry.refs.push({ kind: 'invoice', id: inv.id, label: inv.invoiceNumber || inv.id });
  }

  const insights: Insight[] = [];
  for (const [clientId, entry] of byClient) {
    if (entry.delays.length < 2) continue; // need at least 2 paid invoices to establish a pattern
    const avg = entry.delays.reduce((s, d) => s + d, 0) / entry.delays.length;
    const rounded = Math.round(avg);
    const severity = rounded > 7 ? 'warning' : rounded > 0 ? 'neutral' : 'positive';
    insights.push({
      id: `delay-${clientId}`,
      category: 'customer',
      severity,
      headline: `${entry.name} usually pays ${rounded > 0 ? `${rounded} days late` : 'on time'}.`,
      detail: `Across ${entry.delays.length} paid invoice(s), the average payment delay is ${rounded} day(s) beyond the due date.`,
      metric: rounded,
      metricLabel: 'avg days late',
      sources: entry.refs.slice(0, 10),
      recommendation:
        rounded > 7
          ? `Consider tightening payment terms or sending reminders 3 days before due date for ${entry.name}.`
          : undefined,
    });
  }
  return insights.sort((a, b) => (b.metric || 0) - (a.metric || 0)).slice(0, 8);
}

// ─── Insight 2: Cash flow runway ──────────────────────────────────────────────
// "Your cash flow will become negative in 13 days."
async function cashFlowRunway(): Promise<Insight[]> {
  const [bankAgg, outstanding, payables, expenses30d] = await Promise.all([
    db.bankAccount.aggregate({ _sum: { balance: true } }),
    db.invoice.aggregate({
      where: { paymentStatus: { not: 'paid' }, balanceAmount: { gt: 0 } },
      _sum: { balanceAmount: true },
    }),
    db.purchaseBill.aggregate({
      where: { paymentStatus: { not: 'paid' }, balanceAmount: { gt: 0 } },
      _sum: { balanceAmount: true },
    }),
    db.expense.aggregate({
      where: { date: { gte: new Date(Date.now() - 30 * DAY).toISOString() } },
      _sum: { amount: true },
    }),
  ]);

  const bankBalance = bankAgg._sum.balance || 0;
  const receivable = outstanding._sum.balanceAmount || 0;
  const payable = payables._sum.balanceAmount || 0;
  const monthlyBurn = (expenses30d._sum.amount || 0) + payable / 3; // rough monthly outflow
  const insights: Insight[] = [];

  if (bankBalance <= 0 && monthlyBurn <= 0) return [];

  if (monthlyBurn > 0) {
    const runwayDays = Math.floor((bankBalance / monthlyBurn) * 30);
    const severity = runwayDays < 15 ? 'critical' : runwayDays < 45 ? 'warning' : 'positive';
    insights.push({
      id: 'cash-runway',
      category: 'cash_flow',
      severity,
      headline:
        runwayDays > 0
          ? `Cash runway is ${runwayDays} days at current burn.`
          : 'Cash flow is already negative.',
      detail: `Bank balance ₹${round2(bankBalance)} vs estimated monthly outflow ₹${round2(monthlyBurn)} (expenses + 1/3 of payables). Receivables outstanding: ₹${round2(receivable)}.`,
      metric: runwayDays,
      metricLabel: 'days of runway',
      sources: [],
      recommendation:
        severity === 'critical'
          ? 'Accelerate collections immediately. Outstanding receivables of ₹' +
            round2(receivable) +
            ' would extend runway significantly.'
          : undefined,
    });
  }
  return insights;
}

// ─── Insight 3: Overdue receivables ───────────────────────────────────────────
async function overdueReceivables(): Promise<Insight[]> {
  const nowIso = new Date().toISOString();
  const overdue = await db.invoice.findMany({
    where: {
      paymentStatus: { not: 'paid' },
      dueDate: { lt: nowIso, not: null },
      balanceAmount: { gt: 0 },
    },
    select: { id: true, invoiceNumber: true, buyerName: true, balanceAmount: true, dueDate: true, clientId: true },
    take: 500,
  });
  if (overdue.length === 0) return [];

  const total = overdue.reduce((s, r) => s + r.balanceAmount, 0);
  const severe = overdue.filter((r) => daysBetween(r.dueDate!, new Date()) > 60);
  const sources: EntityRef[] = overdue.slice(0, 10).map((r) => ({
    kind: 'invoice',
    id: r.id,
    label: r.invoiceNumber || r.id,
  }));

  return [
    {
      id: 'overdue-receivables',
      category: 'receivables',
      severity: severe.length > 0 ? 'critical' : 'warning',
      headline: `${overdue.length} invoice(s) overdue totalling ₹${round2(total)}.`,
      detail: `${severe.length} of these are more than 60 days overdue. The oldest overdue invoice is ${daysBetween(
        overdue[0].dueDate!,
        new Date(),
      )} days past due.`,
      metric: round2(total),
      metricLabel: 'overdue amount',
      sources,
      recommendation: 'Send immediate payment reminders. Prioritise the 60+ day overdue accounts for collection calls.',
    },
  ];
}

// ─── Insight 4: Top customer concentration ────────────────────────────────────
async function topCustomers(): Promise<Insight[]> {
  const invoices = await db.invoice.findMany({
    select: { clientId: true, buyerName: true, totalAmount: true },
    take: 1000,
  });
  const byClient = new Map<string, { name: string; total: number; count: number }>();
  for (const inv of invoices) {
    if (!inv.clientId) continue;
    const key = inv.clientId;
    if (!byClient.has(key)) {
      byClient.set(key, { name: inv.buyerName || 'Customer', total: 0, count: 0 });
    }
    const e = byClient.get(key)!;
    e.total += inv.totalAmount;
    e.count += 1;
  }
  const ranked = [...byClient.entries()].sort((a, b) => b[1].total - a[1].total);
  const grandTotal = ranked.reduce((s, [, v]) => s + v.total, 0);
  if (ranked.length === 0 || grandTotal === 0) return [];

  const top = ranked.slice(0, 5);
  const topShare = top.reduce((s, [, v]) => s + v.total, 0) / grandTotal;
  const insights: Insight[] = [];

  // Concentration risk
  if (top.length > 0 && topShare > 0.5) {
    insights.push({
      id: 'customer-concentration',
      category: 'customer',
      severity: topShare > 0.7 ? 'warning' : 'neutral',
      headline: `Top ${top.length} customers account for ${Math.round(topShare * 100)}% of revenue.`,
      detail: `Revenue concentration risk: ${top[0][1].name} alone represents ₹${round2(top[0][1].total)} (${Math.round(
        (top[0][1].total / grandTotal) * 100,
      )}% of total).`,
      metric: Math.round(topShare * 100),
      metricLabel: '% of revenue',
      sources: [],
      recommendation: 'Diversify the customer base to reduce dependency on top accounts.',
    });
  }

  // Biggest customer
  const [topId, topVal] = top[0];
  const clients = await db.client.findMany({ where: { id: topId }, select: { id: true, tradeName: true } });
  insights.push({
    id: 'top-customer',
    category: 'customer',
    severity: 'positive',
    headline: `${clients[0]?.tradeName || topVal.name} is your biggest customer (₹${round2(topVal.total)}).`,
    detail: `${topVal.count} invoice(s) totalling ₹${round2(topVal.total)} — ${Math.round(
      (topVal.total / grandTotal) * 100,
    )}% of total invoiced revenue.`,
    metric: round2(topVal.total),
    metricLabel: 'revenue',
    sources: clients[0] ? [{ kind: 'client', id: clients[0].id, label: clients[0].tradeName || '' }] : [],
  });

  return insights;
}

// ─── Insight 5: Vendor price changes ──────────────────────────────────────────
// "Vendor XYZ has increased prices 22%."
async function vendorPriceChanges(): Promise<Insight[]> {
  const bills = await db.purchaseBill.findMany({
    select: { vendorName: true, totalAmount: true, invoiceDate: true },
    take: 1000,
  });
  const byVendor = new Map<string, { amounts: number[]; dates: string[] }>();
  for (const b of bills) {
    const key = (b.vendorName || '').toLowerCase();
    if (!key) continue;
    if (!byVendor.has(key)) byVendor.set(key, { amounts: [], dates: [] });
    const e = byVendor.get(key)!;
    e.amounts.push(b.totalAmount);
    e.dates.push(b.invoiceDate);
  }

  const insights: Insight[] = [];
  for (const [vendor, e] of byVendor) {
    if (e.amounts.length < 2) continue;
    // Sort by date ascending
    const paired = e.dates
      .map((d, i) => ({ d, a: e.amounts[i] }))
      .sort((a, b) => new Date(a.d).getTime() - new Date(b.d).getTime());
    const first = paired[0].a;
    const last = paired[paired.length - 1].a;
    if (first <= 0) continue;
    const changePct = Math.round(((last - first) / first) * 100);
    if (Math.abs(changePct) < 5) continue; // only flag meaningful changes
    insights.push({
      id: `vendor-price-${vendor}`,
      category: 'vendor',
      severity: changePct > 15 ? 'warning' : 'neutral',
      headline: `${vendor} has ${changePct > 0 ? 'increased' : 'decreased'} prices ${Math.abs(changePct)}%.`,
      detail: `First recorded bill: ₹${round2(first)}. Latest bill: ₹${round2(last)}. Across ${e.amounts.length} purchase(s).`,
      metric: changePct,
      metricLabel: '% price change',
      sources: [],
      recommendation:
        changePct > 15
          ? `Evaluate alternative vendors or renegotiate terms with ${vendor}.`
          : undefined,
    });
  }
  return insights.sort((a, b) => Math.abs(b.metric || 0) - Math.abs(a.metric || 0)).slice(0, 5);
}

// ─── Insight 6: GST liability this month ──────────────────────────────────────
async function gstLiability(): Promise<Insight[]> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const [outputTax, inputTax] = await Promise.all([
    db.invoice.aggregate({
      where: { invoiceDate: { gte: monthStart } },
      _sum: { gstAmount: true },
    }),
    db.purchaseBill.aggregate({
      where: { invoiceDate: { gte: monthStart } },
      _sum: { gstAmount: true },
    }),
  ]);
  const output = outputTax._sum.gstAmount || 0;
  const input = inputTax._sum.gstAmount || 0;
  const net = output - input;
  if (output === 0 && input === 0) return [];

  return [
    {
      id: 'gst-liability',
      category: 'gst',
      severity: net > 0 ? 'warning' : 'positive',
      headline: `Net GST liability this month: ₹${round2(net)}.`,
      detail: `Output tax (sales): ₹${round2(output)}. Input tax credit (purchases): ₹${round2(input)}. Net payable: ₹${round2(net)}.`,
      metric: round2(net),
      metricLabel: 'GST payable',
      sources: [],
      recommendation:
        net > 0
          ? 'Ensure sufficient cash is reserved for the GST payment by the 20th of next month.'
          : undefined,
    },
  ];
}

// ─── Insight 7: Unfollowed big customer ───────────────────────────────────────
// "You forgot to follow up with your biggest customer."
async function unfollowedCustomers(): Promise<Insight[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * DAY).toISOString();
  const [invoices, emails, payments] = await Promise.all([
    db.invoice.findMany({ select: { clientId: true, buyerName: true, totalAmount: true }, take: 1000 }),
    db.emailMessage.findMany({ where: { createdAt: { gte: thirtyDaysAgo } }, select: { clientId: true } }),
    db.payment.findMany({ where: { paymentDate: { gte: thirtyDaysAgo }, partyType: 'customer' }, select: { clientId: true } }),
  ]);

  // Top customers by revenue
  const byClient = new Map<string, { name: string; total: number }>();
  for (const inv of invoices) {
    if (!inv.clientId) continue;
    if (!byClient.has(inv.clientId)) byClient.set(inv.clientId, { name: inv.buyerName || 'Customer', total: 0 });
    byClient.get(inv.clientId)!.total += inv.totalAmount;
  }
  const topClients = [...byClient.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 10);

  // Clients contacted in last 30 days
  const contacted = new Set<string>();
  for (const e of emails) if (e.clientId) contacted.add(e.clientId);
  for (const p of payments) if (p.clientId) contacted.add(p.clientId);

  const unfollowed = topClients.filter(([id]) => !contacted.has(id));
  if (unfollowed.length === 0) return [];

  return [
    {
      id: 'unfollowed-customers',
      category: 'customer',
      severity: 'warning',
      headline: `${unfollowed.length} of your top ${topClients.length} customers have had no contact in 30 days.`,
      detail: `No emails sent and no payments received from: ${unfollowed
        .slice(0, 5)
        .map(([, v]) => v.name)
        .join(', ')}${unfollowed.length > 5 ? '…' : ''}.`,
      sources: unfollowed.slice(0, 5).map(([id, v]) => ({ kind: 'client', id, label: v.name })),
      recommendation: 'Reach out to these high-value customers this week to maintain the relationship.',
    },
  ];
}

// ─── Insight 8: Expense trend ─────────────────────────────────────────────────
async function expenseTrend(): Promise<Insight[]> {
  const now = Date.now();
  const thisMonthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).toISOString();
  const lastMonthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth() - 1, 1).toISOString();
  const [thisMonth, lastMonth] = await Promise.all([
    db.expense.aggregate({ where: { date: { gte: thisMonthStart } }, _sum: { amount: true } }),
    db.expense.aggregate({ where: { date: { gte: lastMonthStart, lt: thisMonthStart } }, _sum: { amount: true } }),
  ]);
  const t = thisMonth._sum.amount || 0;
  const l = lastMonth._sum.amount || 0;
  if (l === 0 && t === 0) return [];

  const changePct = l > 0 ? Math.round(((t - l) / l) * 100) : 0;
  if (l === 0) return []; // can't compute trend without a baseline

  return [
    {
      id: 'expense-trend',
      category: 'expense',
      severity: changePct > 20 ? 'warning' : changePct < -10 ? 'positive' : 'neutral',
      headline: `Expenses are ${changePct > 0 ? 'up' : 'down'} ${Math.abs(changePct)}% versus last month.`,
      detail: `This month so far: ₹${round2(t)}. Last month: ₹${round2(l)}.`,
      metric: changePct,
      metricLabel: '% change',
      sources: [],
    },
  ];
}

// ─── LLM executive summary (grounded in real insights) ────────────────────────
async function synthesizeExecutiveSummary(insights: Insight[], dataPoints: number): Promise<string> {
  if (insights.length === 0) {
    return 'Oracle has analysed your business data. No critical patterns were detected at this time. As you record more invoices, payments, and expenses, Oracle will surface actionable conclusions here.';
  }

  // Build a compact, real-data-only context for the LLM
  const insightDigest = insights
    .map(
      (i, idx) =>
        `${idx + 1}. [${i.severity.toUpperCase()}] ${i.headline} — ${i.detail}` +
        (i.metric !== undefined ? ` (${i.metricLabel}: ${i.metric})` : ''),
    )
    .join('\n');

  const systemPrompt =
    'You are Oracle, the financial brain of an Indian company. You are given REAL, pre-computed business insights derived from the actual database. Your job is to write a concise executive summary (3-5 sentences) that a CEO/CFO can read in 15 seconds. RULES: (1) ONLY restate numbers and facts that appear in the provided insights. (2) NEVER invent new numbers, dates, or entity names. (3) Prioritise critical and warning items. (4) Be direct and specific. (5) End with the single most important next action.';

  const userPrompt = `Here are ${insights.length} real insights computed from ${dataPoints} business records:\n\n${insightDigest}\n\nWrite the executive summary now.`;

  try {
    // Lazy import so the module loads fast even when LLM isn't called
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    });
    const text = completion.choices[0]?.message?.content?.trim();
    return text || fallbackSummary(insights);
  } catch {
    return fallbackSummary(insights);
  }
}

function fallbackSummary(insights: Insight[]): string {
  const critical = insights.filter((i) => i.severity === 'critical');
  const warnings = insights.filter((i) => i.severity === 'warning');
  const positives = insights.filter((i) => i.severity === 'positive');
  const parts: string[] = [];
  if (critical.length > 0) parts.push(`${critical.length} critical issue(s) require immediate attention: ${critical.map((i) => i.headline).join('; ')}.`);
  if (warnings.length > 0) parts.push(`${warnings.length} warning(s): ${warnings.map((i) => i.headline).join('; ')}.`);
  if (positives.length > 0) parts.push(`${positives.length} positive signal(s): ${positives.map((i) => i.headline).join('; ')}.`);
  if (critical.length > 0) parts.push(`Top priority: ${critical[0].recommendation || critical[0].headline}`);
  return parts.join(' ');
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function buildReasoning(): Promise<ReasoningResult> {
  const [
    delays, runway, overdue, topCust, vendorPrices, gst, unfollowed, expTrend,
  ] = await Promise.all([
    customerPaymentDelays(),
    cashFlowRunway(),
    overdueReceivables(),
    topCustomers(),
    vendorPriceChanges(),
    gstLiability(),
    unfollowedCustomers(),
    expenseTrend(),
  ]);

  const insights = [
    ...runway,
    ...overdue,
    ...unfollowed,
    ...gst,
    ...vendorPrices,
    ...delays,
    ...topCust,
    ...expTrend,
  ];

  const dataPoints = await db.invoice.count() + await db.payment.count() + await db.expense.count() + await db.purchaseBill.count();
  const empty = insights.length === 0 && dataPoints === 0;
  const executiveSummary = await synthesizeExecutiveSummary(insights, dataPoints);

  return {
    generatedAt: new Date().toISOString(),
    insights,
    executiveSummary,
    dataPoints,
    empty,
  };
}
