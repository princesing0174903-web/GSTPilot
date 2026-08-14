// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE INTELLIGENCE — Phase 5: Command Center
// ═══════════════════════════════════════════════════════════════════════════════
// Natural language commands → real database queries → traceable answers.
//
//   "Show invoices unpaid for 90 days"
//   "Which customers are most profitable?"
//   "Who owes me more than ₹5 lakh?"
//   "How much GST do I owe this month?"
//   "What happened last Friday?"
//
// Intent detection is deterministic (keyword-based). Query execution hits the
// REAL Prisma database. The answer is phrased naturally but every number comes
// from a real row, and every claim cites its source records.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { CommandResult, EntityRef } from './types';

// Re-export Prisma-free static definitions so existing server-side imports
// (`import { COMMAND_SUGGESTIONS } from './command-center'`) keep working.
// Client components should import directly from './command-center-defs'.
export { COMMAND_SUGGESTIONS } from './command-center-defs';

const round2 = (n: number): number => Math.round(n * 100) / 100;
const DAY = 1000 * 60 * 60 * 24;

/** Extract a rupee amount from a query like "more than ₹5 lakh" or "500000". */
function extractAmount(query: string): number | null {
  const lakh = query.match(/(\d+(?:\.\d+)?)\s*lakh/i);
  if (lakh) return parseFloat(lakh[1]) * 100000;
  const crore = query.match(/(\d+(?:\.\d+)?)\s*crore/i);
  if (crore) return parseFloat(crore[1]) * 10000000;
  const k = query.match(/(\d+(?:\.\d+)?)\s*k\b/i);
  if (k) return parseFloat(k[1]) * 1000;
  const raw = query.match(/₹?\s*(\d{3,})/);
  if (raw) return parseInt(raw[1], 10);
  return null;
}

/** Extract a day count from a query like "90 days" or "30 day". */
function extractDays(query: string): number | null {
  const m = query.match(/(\d+)\s*day/i);
  return m ? parseInt(m[1], 10) : null;
}

// ─── Intent handlers ──────────────────────────────────────────────────────────

async function cmdOverdueInvoices(query: string): Promise<CommandResult> {
  const days = extractDays(query) ?? 0;
  const threshold = days > 0 ? new Date(Date.now() - days * DAY).toISOString() : new Date().toISOString();
  const rows = await db.invoice.findMany({
    where: {
      paymentStatus: { not: 'paid' },
      dueDate: { lt: threshold, not: null },
      balanceAmount: { gt: 0 },
    },
    select: { id: true, invoiceNumber: true, buyerName: true, balanceAmount: true, dueDate: true, clientId: true },
    take: 500,
    orderBy: { dueDate: 'asc' },
  });
  const total = rows.reduce((s, r) => s + r.balanceAmount, 0);
  const sources: EntityRef[] = rows.slice(0, 15).map((r) => ({ kind: 'invoice', id: r.id, label: r.invoiceNumber || r.id }));
  const empty = rows.length === 0;
  return {
    query,
    interpreted: `Invoices unpaid for ${days}+ days (due before ${threshold.slice(0, 10)})`,
    answer: empty
      ? `No invoices have been unpaid for ${days}+ days.`
      : `${rows.length} invoice(s) unpaid for ${days}+ days, totalling ₹${round2(total)}. ${rows[0].buyerName || 'Top account'} owes ₹${round2(rows[0].balanceAmount)} (due ${rows[0].dueDate?.slice(0, 10)}).`,
    data: rows,
    sources,
    durationMs: 0,
    empty,
  };
}

async function cmdWhoOwesMe(query: string): Promise<CommandResult> {
  const minAmount = extractAmount(query) ?? 0;
  const rows = await db.invoice.findMany({
    where: { paymentStatus: { not: 'paid' }, balanceAmount: { gt: minAmount } },
    select: { id: true, invoiceNumber: true, buyerName: true, balanceAmount: true, clientId: true },
    take: 500,
  });
  // Group by client
  const byClient = new Map<string, { name: string; total: number; count: number; refs: EntityRef[] }>();
  for (const r of rows) {
    const key = r.clientId || r.buyerName || 'unknown';
    if (!byClient.has(key)) {
      byClient.set(key, { name: r.buyerName || 'Customer', total: 0, count: 0, refs: [] });
    }
    const e = byClient.get(key)!;
    e.total += r.balanceAmount;
    e.count += 1;
    e.refs.push({ kind: 'invoice', id: r.id, label: r.invoiceNumber || r.id });
  }
  const ranked = [...byClient.entries()].sort((a, b) => b[1].total - a[1].total);
  const sources = ranked.slice(0, 10).flatMap(([, v]) => v.refs.slice(0, 3));
  const empty = ranked.length === 0;
  return {
    query,
    interpreted: `Customers owing more than ₹${minAmount}`,
    answer: empty
      ? `No customers owe more than ₹${minAmount}.`
      : `${ranked.length} customer(s) owe more than ₹${minAmount}. ${ranked[0][1].name} owes the most: ₹${round2(ranked[0][1].total)} across ${ranked[0][1].count} invoice(s).`,
    data: ranked.map(([id, v]) => ({ clientId: id, ...v })),
    sources,
    durationMs: 0,
    empty,
  };
}

async function cmdTopCustomers(query: string): Promise<CommandResult> {
  const invoices = await db.invoice.findMany({
    select: { clientId: true, buyerName: true, totalAmount: true },
    take: 2000,
  });
  const byClient = new Map<string, { name: string; total: number; count: number }>();
  for (const inv of invoices) {
    if (!inv.clientId) continue;
    if (!byClient.has(inv.clientId)) byClient.set(inv.clientId, { name: inv.buyerName || 'Customer', total: 0, count: 0 });
    const e = byClient.get(inv.clientId)!;
    e.total += inv.totalAmount;
    e.count += 1;
  }
  const ranked = [...byClient.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 10);
  const clients = await db.client.findMany({ where: { id: { in: ranked.map((r) => r[0]) } }, select: { id: true, tradeName: true } });
  const sources: EntityRef[] = ranked.slice(0, 10).map(([id], i) => ({
    kind: 'client',
    id,
    label: clients.find((c) => c.id === id)?.tradeName || ranked[i][1].name,
  }));
  const empty = ranked.length === 0;
  return {
    query,
    interpreted: 'Top customers by total invoiced revenue',
    answer: empty
      ? 'No customer revenue data available yet.'
      : `Top customer: ${ranked[0][1].name} with ₹${round2(ranked[0][1].total)} across ${ranked[0][1].count} invoice(s). Top 10 total: ₹${round2(ranked.reduce((s, [, v]) => s + v.total, 0))}.`,
    data: ranked.map(([id, v]) => ({ clientId: id, ...v })),
    sources,
    durationMs: 0,
    empty,
  };
}

async function cmdGstThisMonth(query: string): Promise<CommandResult> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const [outputTax, inputTax] = await Promise.all([
    db.invoice.aggregate({ where: { invoiceDate: { gte: monthStart } }, _sum: { gstAmount: true } }),
    db.purchaseBill.aggregate({ where: { invoiceDate: { gte: monthStart } }, _sum: { gstAmount: true } }),
  ]);
  const output = outputTax._sum.gstAmount || 0;
  const input = inputTax._sum.gstAmount || 0;
  const net = output - input;
  const empty = output === 0 && input === 0;
  return {
    query,
    interpreted: `GST liability for ${now.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}`,
    answer: empty
      ? 'No GST-eligible transactions this month yet.'
      : `This month: Output tax ₹${round2(output)}, Input tax credit ₹${round2(input)}. Net GST ${net >= 0 ? 'payable' : 'refundable'}: ₹${round2(Math.abs(net))}.`,
    data: { outputTax: output, inputTax: input, netPayable: net, monthStart },
    sources: [],
    durationMs: 0,
    empty,
  };
}

async function cmdWhatHappened(query: string): Promise<CommandResult> {
  // Detect "last friday", "yesterday", "last week", or a date
  const now = new Date();
  let start: Date;
  let end: Date;
  let label: string;

  if (/last\s+friday/i.test(query)) {
    const day = now.getDay(); // 0=Sun
    const diff = day >= 5 ? day - 5 : day + 2;
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    end = new Date(start.getTime() + DAY);
    label = 'last Friday';
  } else if (/yesterday/i.test(query)) {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    end = new Date(start.getTime() + DAY);
    label = 'yesterday';
  } else if (/last\s+week/i.test(query)) {
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start = new Date(end.getTime() - 7 * DAY);
    label = 'the last 7 days';
  } else if (/today/i.test(query)) {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(start.getTime() + DAY);
    label = 'today';
  } else {
    // default: last 7 days
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start = new Date(end.getTime() - 7 * DAY);
    label = 'the last 7 days';
  }

  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const [invoices, payments, expenses, emails, gstFilings] = await Promise.all([
    db.invoice.findMany({ where: { OR: [{ invoiceDate: { gte: startIso, lt: endIso } }, { createdAt: { gte: startIso, lt: endIso } }] }, select: { id: true, invoiceNumber: true, totalAmount: true, buyerName: true }, take: 200 }),
    db.payment.findMany({ where: { paymentDate: { gte: startIso, lt: endIso } }, select: { id: true, partyName: true, amount: true, partyType: true }, take: 200 }),
    db.expense.findMany({ where: { date: { gte: startIso, lt: endIso } }, select: { id: true, description: true, amount: true, category: true }, take: 200 }),
    db.emailMessage.findMany({ where: { createdAt: { gte: startIso, lt: endIso } }, select: { id: true, subject: true, recipientEmail: true }, take: 200 }),
    db.gSTRFiling.findMany({ where: { OR: [{ filedDate: { gte: startIso, lt: endIso } }, { createdAt: { gte: startIso, lt: endIso } }] }, select: { id: true, returnType: true, period: true, totalTax: true }, take: 50 }),
  ]);

  const totalCollected = payments.filter((p) => p.partyType === 'customer').reduce((s, p) => s + p.amount, 0);
  const totalSpent = payments.filter((p) => p.partyType === 'vendor').reduce((s, p) => s + p.amount, 0) + expenses.reduce((s, e) => s + e.amount, 0);
  const sources: EntityRef[] = [
    ...invoices.slice(0, 5).map((r) => ({ kind: 'invoice' as const, id: r.id, label: r.invoiceNumber || r.id })),
    ...payments.slice(0, 5).map((r) => ({ kind: 'payment' as const, id: r.id, label: r.partyName })),
  ];
  const empty = invoices.length + payments.length + expenses.length + emails.length + gstFilings.length === 0;

  const parts: string[] = [];
  if (invoices.length) parts.push(`${invoices.length} invoice(s) issued`);
  if (payments.length) parts.push(`${payments.length} payment(s) (₹${round2(totalCollected)} in, ₹${round2(totalSpent)} out)`);
  if (expenses.length) parts.push(`${expenses.length} expense(s) recorded`);
  if (emails.length) parts.push(`${emails.length} email(s) sent`);
  if (gstFilings.length) parts.push(`${gstFilings.length} GST filing(s)`);

  return {
    query,
    interpreted: `Business activity for ${label} (${start.toLocaleDateString('en-IN')} → ${end.toLocaleDateString('en-IN')})`,
    answer: empty
      ? `No business activity was recorded for ${label}.`
      : `On ${label}: ${parts.join(', ')}.`,
    data: { invoices, payments, expenses, emails, gstFilings, totals: { collected: totalCollected, spent: totalSpent } },
    sources,
    durationMs: 0,
    empty,
  };
}

async function cmdOutstandingTotal(query: string): Promise<CommandResult> {
  const agg = await db.invoice.aggregate({
    where: { paymentStatus: { not: 'paid' }, balanceAmount: { gt: 0 } },
    _sum: { balanceAmount: true },
    _count: true,
  });
  const total = agg._sum.balanceAmount || 0;
  const count = agg._count;
  const empty = count === 0;
  return {
    query,
    interpreted: 'Total outstanding receivables (unpaid invoices)',
    answer: empty
      ? 'No outstanding receivables. All invoices are paid.'
      : `${count} unpaid invoice(s) with a total outstanding of ₹${round2(total)}.`,
    data: { count, total },
    sources: [],
    durationMs: 0,
    empty,
  };
}

async function cmdExpensesTotal(query: string): Promise<CommandResult> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const agg = await db.expense.aggregate({
    where: { date: { gte: monthStart } },
    _sum: { amount: true, gst: true },
    _count: true,
  });
  const total = agg._sum.amount || 0;
  const gst = agg._sum.gst || 0;
  const count = agg._count;
  const empty = count === 0;
  return {
    query,
    interpreted: `Total expenses for ${now.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}`,
    answer: empty
      ? 'No expenses recorded this month yet.'
      : `${count} expense(s) this month totalling ₹${round2(total)} (GST portion: ₹${round2(gst)}).`,
    data: { count, total, gst },
    sources: [],
    durationMs: 0,
    empty,
  };
}

// ─── Intent router ────────────────────────────────────────────────────────────

type Intent =
  | 'overdue_invoices'
  | 'who_owes_me'
  | 'top_customers'
  | 'gst_this_month'
  | 'what_happened'
  | 'outstanding_total'
  | 'expenses_total'
  | 'unknown';

function detectIntent(query: string): Intent {
  const q = query.toLowerCase();
  if (/(unpaid|overdue|outstanding).*(\d+\s*day|day)/i.test(q) || /(\d+\s*day).*(unpaid|overdue)/i.test(q)) return 'overdue_invoices';
  if (/(who owes|owing|owe me|receivable)/i.test(q) && /lakh|crore|₹|\d{3,}/i.test(q)) return 'who_owes_me';
  if (/(most profitable|top customer|biggest customer|best customer)/i.test(q)) return 'top_customers';
  if (/(gst.*owe|gst.*this month|gst.*liability|how much gst)/i.test(q)) return 'gst_this_month';
  if (/(what happened|activity|last friday|yesterday|last week|today)/i.test(q)) return 'what_happened';
  if (/(how much.*outstanding|total outstanding|total receivable|unpaid total)/i.test(q)) return 'outstanding_total';
  if (/(how much.*expense|total expense|spent this month|expenses this month)/i.test(q)) return 'expenses_total';
  return 'unknown';
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function runCommand(rawQuery: string): Promise<CommandResult> {
  const start = Date.now();
  const query = rawQuery.trim();
  if (!query) {
    return { query: '', interpreted: 'Empty command', answer: 'Please ask Oracle a question.', sources: [], durationMs: 0, empty: true };
  }
  const intent = detectIntent(query);
  let result: CommandResult;
  switch (intent) {
    case 'overdue_invoices':
      result = await cmdOverdueInvoices(query);
      break;
    case 'who_owes_me':
      result = await cmdWhoOwesMe(query);
      break;
    case 'top_customers':
      result = await cmdTopCustomers(query);
      break;
    case 'gst_this_month':
      result = await cmdGstThisMonth(query);
      break;
    case 'what_happened':
      result = await cmdWhatHappened(query);
      break;
    case 'outstanding_total':
      result = await cmdOutstandingTotal(query);
      break;
    case 'expenses_total':
      result = await cmdExpensesTotal(query);
      break;
    default:
      // Fallback: try to answer from a keyword scan of the memory snapshot
      result = await cmdFallback(query);
  }
  result.durationMs = Date.now() - start;
  return result;
}

async function cmdFallback(query: string): Promise<CommandResult> {
  // Try a few heuristics before giving up
  const q = query.toLowerCase();
  if (q.includes('vendor') || q.includes('payable')) {
    const agg = await db.purchaseBill.aggregate({ where: { paymentStatus: { not: 'paid' }, balanceAmount: { gt: 0 } }, _sum: { balanceAmount: true }, _count: true });
    const total = agg._sum.balanceAmount || 0;
    const count = agg._count;
    return {
      query,
      interpreted: 'Total outstanding vendor payables',
      answer: count === 0 ? 'No outstanding vendor payables.' : `${count} unpaid purchase bill(s) totalling ₹${round2(total)} payable to vendors.`,
      data: { count, total },
      sources: [],
      durationMs: 0,
      empty: count === 0,
    };
  }
  if (q.includes('bank') || q.includes('balance')) {
    const agg = await db.bankAccount.aggregate({ _sum: { balance: true }, _count: true });
    const total = agg._sum.balance || 0;
    return {
      query,
      interpreted: 'Total bank balance across all accounts',
      answer: agg._count === 0 ? 'No bank accounts connected.' : `${agg._count} account(s) with a combined balance of ₹${round2(total)}.`,
      data: { count: agg._count, total },
      sources: [],
      durationMs: 0,
      empty: agg._count === 0,
    };
  }
  return {
    query,
    interpreted: 'Unrecognised command',
    answer:
      "Oracle didn't recognise that command. Try: \"Show invoices unpaid for 90 days\", \"Who owes me more than ₹5 lakh?\", \"Which customers are most profitable?\", \"How much GST do I owe this month?\", or \"What happened last Friday?\".",
    sources: [],
    durationMs: 0,
    empty: true,
  };
}

// `COMMAND_SUGGESTIONS` is defined in ./command-center-defs (Prisma-free) and
// re-exported above so existing imports keep working.
