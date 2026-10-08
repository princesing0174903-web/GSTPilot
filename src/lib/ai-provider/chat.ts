// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Oracle™ & AI CFO™ — Oracle Chat Engine
//
// A PURE, CLIENT-SAFE function that answers natural-language business questions
// using the REAL BusinessContext. NEVER fabricates data — every answer cites
// the real metrics that informed it, recorded in `dataUsed`.
//
// Intent detection (deterministic keyword matching):
//   • revenue / sales / income      → context.revenue
//   • expense / spending / cost     → context.expenses
//   • profit / margin / bottom line → context.profit
//   • gst / tax / liability         → context.gst
//   • bank / balance / cash         → context.banking + context.cashFlow
//   • owe / receivable / debtor     → context.outstanding.receivables + topDebtors
//   • payable / vendor / supplier   → context.outstanding.payables
//   • invoice / bill                → context.invoices
//   • overdue / late / delayed      → context.invoices.overdue + customers.overdue
//   • deadline / due / file         → context.deadlines
//   • customer / client             → context.customers
//   • who paid most / top customer  → topDebtors (proxy)
//   • score / health                → derived from context
//
// Pure & deterministic — given the same question + context, always returns the
// same answer. The MockAIProvider delegates to this; future LLM providers can
// use this as the retrieval layer and let the LLM phrase the answer.
// ═══════════════════════════════════════════════════════════════════════════════

import type { BusinessContext, ChatResponse } from './types';
import { formatINR, formatPercent, periodLabel } from './knowledge';

// ─── Intent detection ─────────────────────────────────────────────────────────

type Intent =
  | 'revenue'
  | 'expenses'
  | 'profit'
  | 'gst_liability'
  | 'gst_filing'
  | 'bank_balance'
  | 'cash_flow'
  | 'receivables'
  | 'payables'
  | 'overdue'
  | 'invoices'
  | 'deadlines'
  | 'top_debtor'
  | 'top_customer'
  | 'customers'
  | 'business_score'
  | 'summary'
  | 'unknown';

const INTENT_KEYWORDS: Record<Intent, string[]> = {
  revenue: ['revenue', 'sales', 'income', 'turnover', 'earning', 'top line', 'topline'],
  expenses: ['expense', 'spending', 'cost', 'expenditure', 'burn', 'spend'],
  profit: ['profit', 'margin', 'bottom line', 'bottomline', 'net income', 'surplus'],
  gst_liability: ['gst liability', 'gst payable', 'how much gst', 'gst owe', 'tax liability', 'output tax'],
  gst_filing: ['file gst', 'gst return', 'gstr', 'gst filing', 'file return', 'filing status', 'gst due'],
  bank_balance: ['bank balance', 'today balance', 'current balance', 'how much in bank', 'bank account'],
  cash_flow: ['cash flow', 'cashflow', 'cash position', 'liquidity', 'runway', 'burn rate'],
  receivables: ['receivable', 'owed', 'owing', 'debtor', 'outstanding', 'who owes', 'money owed', 'collect'],
  payables: ['payable', 'vendor', 'supplier', 'bill to pay', 'owe vendor', 'pay suppliers', 'bills due'],
  overdue: ['overdue', 'late', 'delayed', 'past due', 'missed'],
  invoices: ['invoice', 'bill', 'pending invoice', 'unpaid invoice', 'draft'],
  deadlines: ['deadline', 'due date', 'upcoming', 'what due', 'what is due', 'next filing', 'due soon'],
  top_debtor: ['who owes', 'top debtor', 'biggest debtor', 'largest outstanding', 'most owed'],
  top_customer: ['who paid most', 'top customer', 'best customer', 'biggest customer', 'highest paying'],
  customers: ['customer', 'client', 'how many customer', 'how many client'],
  business_score: ['business score', 'health score', 'how is my business', 'how is business doing', 'business health'],
  summary: ['summary', 'overview', 'brief', 'how am i doing', 'status', 'how are things', 'what should i', 'prioritize', 'priority'],
  unknown: [],
};

function detectIntent(question: string): Intent {
  const q = question.toLowerCase().trim();
  // Check specific multi-word intents first (order matters).
  const orderedIntents: Intent[] = [
    'gst_liability', 'gst_filing', 'bank_balance', 'cash_flow',
    'top_debtor', 'top_customer', 'business_score', 'receivables',
    'payables', 'overdue', 'deadlines', 'invoices', 'customers',
    'revenue', 'expenses', 'profit', 'summary',
  ];
  for (const intent of orderedIntents) {
    const keywords = INTENT_KEYWORDS[intent];
    if (keywords.some((kw) => q.includes(kw))) return intent;
  }
  return 'unknown';
}

// ─── Answer builders (each references REAL context data) ──────────────────────

interface AnswerParts {
  answer: string;
  sources: string[];
  metrics: { label: string; value: string }[];
  confidence: 'high' | 'medium' | 'low';
}

function answerRevenue(ctx: BusinessContext): AnswerParts {
  const parts: string[] = [];
  parts.push(
    `Your revenue for ${periodLabel(ctx.period)} is ${formatINR(ctx.revenue.current)} across ${ctx.revenue.invoiceCount} invoice${ctx.revenue.invoiceCount === 1 ? '' : 's'}.`,
  );
  if (ctx.revenue.previous > 0) {
    parts.push(`That's ${formatPercent(ctx.revenue.changePercent)} compared to ${formatINR(ctx.revenue.previous)} last month.`);
  }
  return {
    answer: parts.join(' '),
    sources: ['Invoices (sales, current period)'],
    metrics: [
      { label: 'Current revenue', value: formatINR(ctx.revenue.current) },
      { label: 'Previous revenue', value: formatINR(ctx.revenue.previous) },
      { label: 'Change', value: formatPercent(ctx.revenue.changePercent) },
      { label: 'Invoices', value: String(ctx.revenue.invoiceCount) },
    ],
    confidence: ctx.revenue.invoiceCount > 0 ? 'high' : 'medium',
  };
}

function answerExpenses(ctx: BusinessContext): AnswerParts {
  const parts: string[] = [];
  parts.push(`Your expenses for ${periodLabel(ctx.period)} are ${formatINR(ctx.expenses.current)}.`);
  if (ctx.expenses.previous > 0) {
    parts.push(`That's ${formatPercent(ctx.expenses.changePercent)} vs ${formatINR(ctx.expenses.previous)} last period.`);
  }
  if (ctx.expenses.topCategories.length > 0) {
    const top = ctx.expenses.topCategories[0];
    parts.push(`Top spending: ${top.label} at ${formatINR(top.amount)}.`);
  }
  return {
    answer: parts.join(' '),
    sources: ['Invoices (purchase, current period)'],
    metrics: [
      { label: 'Current expenses', value: formatINR(ctx.expenses.current) },
      { label: 'Previous expenses', value: formatINR(ctx.expenses.previous) },
      { label: 'Change', value: formatPercent(ctx.expenses.changePercent) },
    ],
    confidence: ctx.expenses.current > 0 ? 'high' : 'medium',
  };
}

function answerProfit(ctx: BusinessContext): AnswerParts {
  const profit = ctx.profit.current;
  const margin = (ctx.profit.margin * 100).toFixed(1);
  return {
    answer: `Your profit for ${periodLabel(ctx.period)} is ${formatINR(profit)}, a ${margin}% margin (revenue ${formatINR(ctx.revenue.current)} − expenses ${formatINR(ctx.expenses.current)}).`,
    sources: ['Invoices (sales + purchase, current period)'],
    metrics: [
      { label: 'Profit', value: formatINR(profit) },
      { label: 'Margin', value: `${margin}%` },
      { label: 'Revenue', value: formatINR(ctx.revenue.current) },
      { label: 'Expenses', value: formatINR(ctx.expenses.current) },
    ],
    confidence: ctx.revenue.invoiceCount > 0 ? 'high' : 'medium',
  };
}

function answerGstLiability(ctx: BusinessContext): AnswerParts {
  return {
    answer: `Your net GST payable for ${periodLabel(ctx.period)} is ${formatINR(ctx.gst.netPayable)} — output tax liability of ${formatINR(ctx.gst.liability)} minus input tax credit of ${formatINR(ctx.gst.itcAvailable)}.${ctx.gst.nextDueDate ? ` Payment is due by ${new Date(ctx.gst.nextDueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.` : ''}`,
    sources: ['GST transactions (sales + purchase, current period)'],
    metrics: [
      { label: 'Net GST payable', value: formatINR(ctx.gst.netPayable) },
      { label: 'Output tax', value: formatINR(ctx.gst.liability) },
      { label: 'ITC available', value: formatINR(ctx.gst.itcAvailable) },
      { label: 'Due date', value: ctx.gst.nextDueDate ? new Date(ctx.gst.nextDueDate).toLocaleDateString('en-IN') : 'Not set' },
    ],
    confidence: ctx.gst.liability > 0 || ctx.gst.itcAvailable > 0 ? 'high' : 'medium',
  };
}

function answerGstFiling(ctx: BusinessContext): AnswerParts {
  const statusLabel: Record<string, string> = {
    not_filed: 'not yet filed',
    draft: 'saved as draft',
    filed: 'filed',
    overdue: 'overdue',
  };
  const status = statusLabel[ctx.gst.filingStatus] ?? ctx.gst.filingStatus;
  return {
    answer: `Your GST return for ${periodLabel(ctx.period)} is ${status}. ${ctx.gst.pendingReturns > 0 ? `There ${ctx.gst.pendingReturns === 1 ? 'is' : 'are'} ${ctx.gst.pendingReturns} pending return${ctx.gst.pendingReturns === 1 ? '' : 's'} overall.` : 'All returns are filed.'}${ctx.gst.nextDueDate ? ` Next due date: ${new Date(ctx.gst.nextDueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.` : ''}`,
    sources: ['GST returns (current + all periods)'],
    metrics: [
      { label: 'Filing status', value: status },
      { label: 'Pending returns', value: String(ctx.gst.pendingReturns) },
      { label: 'Next due', value: ctx.gst.nextDueDate ? new Date(ctx.gst.nextDueDate).toLocaleDateString('en-IN') : 'None' },
    ],
    confidence: 'high',
  };
}

function answerBankBalance(ctx: BusinessContext): AnswerParts {
  if (!ctx.bankConnected) {
    return {
      answer: 'No bank account is connected yet. Connect your bank to see live balances and transactions.',
      sources: ['Bank connections'],
      metrics: [{ label: 'Bank connected', value: 'No' }],
      confidence: 'high',
    };
  }
  return {
    answer: `Your total bank balance is ${formatINR(ctx.banking.totalBalance)} across ${ctx.banking.connectedAccounts} account${ctx.banking.connectedAccounts === 1 ? '' : 's'}, with ${formatINR(ctx.banking.availableBalance)} available.`,
    sources: ['Bank connections + last snapshot'],
    metrics: [
      { label: 'Total balance', value: formatINR(ctx.banking.totalBalance) },
      { label: 'Available', value: formatINR(ctx.banking.availableBalance) },
      { label: 'Connected accounts', value: String(ctx.banking.connectedAccounts) },
    ],
    confidence: 'high',
  };
}

function answerCashFlow(ctx: BusinessContext): AnswerParts {
  if (!ctx.bankConnected) {
    return {
      answer: `Your net cash flow for ${periodLabel(ctx.period)} is ${formatINR(ctx.cashFlow.netInflow)} based on invoices. Connect a bank account for real-time cash flow tracking including actual inflows and outflows.`,
      sources: ['Invoices (current period)'],
      metrics: [{ label: 'Net cash flow', value: formatINR(ctx.cashFlow.netInflow) }],
      confidence: 'medium',
    };
  }
  const runway = Number.isFinite(ctx.cashFlow.runwayMonths)
    ? `${ctx.cashFlow.runwayMonths.toFixed(1)} months`
    : 'unlimited (positive cash flow)';
  return {
    answer: `Your net cash flow for ${periodLabel(ctx.period)} is ${formatINR(ctx.cashFlow.netInflow)} (incoming ${formatINR(ctx.banking.incomingPayments)} − outgoing ${formatINR(ctx.banking.outgoingPayments)}). At the current burn rate of ${formatINR(ctx.cashFlow.burnRate)}/month, your runway is ${runway}.`,
    sources: ['Bank transactions (current period)'],
    metrics: [
      { label: 'Net cash flow', value: formatINR(ctx.cashFlow.netInflow) },
      { label: 'Incoming', value: formatINR(ctx.banking.incomingPayments) },
      { label: 'Outgoing', value: formatINR(ctx.banking.outgoingPayments) },
      { label: 'Burn rate', value: `${formatINR(ctx.cashFlow.burnRate)}/mo` },
      { label: 'Runway', value: runway },
    ],
    confidence: 'high',
  };
}

function answerReceivables(ctx: BusinessContext): AnswerParts {
  const parts: string[] = [];
  parts.push(`You're owed ${formatINR(ctx.outstanding.receivables)} across ${ctx.invoices.pending} pending invoice${ctx.invoices.pending === 1 ? '' : 's'}.`);
  if (ctx.invoices.overdue > 0) {
    parts.push(`${formatINR(ctx.invoices.overdueValue)} is overdue across ${ctx.invoices.overdue} invoice${ctx.invoices.overdue === 1 ? '' : 's'}.`);
  }
  if (ctx.customers.topDebtors.length > 0) {
    const top = ctx.customers.topDebtors.slice(0, 3);
    parts.push(`Top debtors: ${top.map((d) => `${d.name} (${formatINR(d.amount)})`).join(', ')}.`);
  }
  return {
    answer: parts.join(' '),
    sources: ['Invoices (unpaid) + clients'],
    metrics: [
      { label: 'Total receivables', value: formatINR(ctx.outstanding.receivables) },
      { label: 'Pending invoices', value: String(ctx.invoices.pending) },
      { label: 'Overdue invoices', value: String(ctx.invoices.overdue) },
      { label: 'Overdue value', value: formatINR(ctx.invoices.overdueValue) },
    ],
    confidence: ctx.invoices.total > 0 ? 'high' : 'medium',
  };
}

function answerPayables(ctx: BusinessContext): AnswerParts {
  return {
    answer: `You owe ${formatINR(ctx.outstanding.payables)} to vendors/suppliers. Net working capital position (receivables − payables) is ${formatINR(ctx.outstanding.net)}.`,
    sources: ['Invoices (purchase, unpaid)'],
    metrics: [
      { label: 'Total payables', value: formatINR(ctx.outstanding.payables) },
      { label: 'Receivables', value: formatINR(ctx.outstanding.receivables) },
      { label: 'Net position', value: formatINR(ctx.outstanding.net) },
    ],
    confidence: ctx.outstanding.payables > 0 ? 'high' : 'medium',
  };
}

function answerOverdue(ctx: BusinessContext): AnswerParts {
  const parts: string[] = [];
  if (ctx.invoices.overdue > 0) {
    parts.push(`${ctx.invoices.overdue} overdue invoice${ctx.invoices.overdue === 1 ? '' : 's'} worth ${formatINR(ctx.invoices.overdueValue)}.`);
  }
  if (ctx.customers.overdue > 0) {
    parts.push(`${ctx.customers.overdue} customer${ctx.customers.overdue === 1 ? '' : 's'} have overdue invoices.`);
  }
  if (ctx.gst.filingStatus === 'overdue') {
    parts.push(`GST return for ${periodLabel(ctx.period)} is overdue.`);
  }
  if (parts.length === 0) {
    parts.push('Nothing is overdue — you\'re all caught up.');
  }
  return {
    answer: parts.join(' '),
    sources: ['Invoices + clients + GST returns'],
    metrics: [
      { label: 'Overdue invoices', value: String(ctx.invoices.overdue) },
      { label: 'Overdue value', value: formatINR(ctx.invoices.overdueValue) },
      { label: 'Overdue customers', value: String(ctx.customers.overdue) },
    ],
    confidence: 'high',
  };
}

function answerInvoices(ctx: BusinessContext): AnswerParts {
  return {
    answer: `You have ${ctx.invoices.total} invoice${ctx.invoices.total === 1 ? '' : 's'} total: ${ctx.invoices.pending} pending (${formatINR(ctx.invoices.pendingValue)}), ${ctx.invoices.overdue} overdue (${formatINR(ctx.invoices.overdueValue)}), and ${ctx.invoices.draft} draft${ctx.invoices.draft === 1 ? '' : 's'}.`,
    sources: ['Invoices (all statuses)'],
    metrics: [
      { label: 'Total invoices', value: String(ctx.invoices.total) },
      { label: 'Pending', value: String(ctx.invoices.pending) },
      { label: 'Overdue', value: String(ctx.invoices.overdue) },
      { label: 'Draft', value: String(ctx.invoices.draft) },
    ],
    confidence: 'high',
  };
}

function answerDeadlines(ctx: BusinessContext): AnswerParts {
  if (ctx.deadlines.upcoming.length === 0) {
    return {
      answer: 'No deadlines in the next 30 days. You\'re ahead of schedule.',
      sources: ['GST returns + invoices'],
      metrics: [{ label: 'Upcoming deadlines', value: '0' }],
      confidence: 'high',
    };
  }
  const list = ctx.deadlines.upcoming
    .slice(0, 5)
    .map((d) => `${d.label} in ${d.daysRemaining} day${d.daysRemaining === 1 ? '' : 's'} (${new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`)
    .join('; ');
  return {
    answer: `Upcoming deadlines: ${list}.`,
    sources: ['GST returns + invoices'],
    metrics: ctx.deadlines.upcoming.slice(0, 5).map((d) => ({
      label: d.label,
      value: `${d.daysRemaining}d`,
    })),
    confidence: 'high',
  };
}

function answerTopDebtor(ctx: BusinessContext): AnswerParts {
  if (ctx.customers.topDebtors.length === 0) {
    return {
      answer: 'No outstanding receivables — everyone has paid up.',
      sources: ['Invoices + clients'],
      metrics: [{ label: 'Debtors', value: '0' }],
      confidence: 'high',
    };
  }
  const top = ctx.customers.topDebtors[0];
  const rest = ctx.customers.topDebtors.slice(1, 5);
  const parts = [`${top.name} owes you the most: ${formatINR(top.amount)}.`];
  if (rest.length > 0) {
    parts.push(`Other top debtors: ${rest.map((d) => `${d.name} (${formatINR(d.amount)})`).join(', ')}.`);
  }
  return {
    answer: parts.join(' '),
    sources: ['Invoices (unpaid) + clients'],
    metrics: ctx.customers.topDebtors.slice(0, 5).map((d) => ({
      label: d.name,
      value: formatINR(d.amount),
    })),
    confidence: 'high',
  };
}

function answerTopCustomer(ctx: BusinessContext): AnswerParts {
  // We don't track per-customer revenue directly in the context; use the top
  // debtor as a proxy for the most active customer relationship, and be honest
  // about the limitation.
  if (ctx.customers.total === 0) {
    return {
      answer: 'No customers yet. Create your first client to start tracking revenue by customer.',
      sources: ['Clients'],
      metrics: [{ label: 'Customers', value: '0' }],
      confidence: 'high',
    };
  }
  const top = ctx.customers.topDebtors[0];
  return {
    answer: `You have ${ctx.customers.total} customer${ctx.customers.total === 1 ? '' : 's'}.${top ? ` Your most active customer relationship by outstanding value is ${top.name} (${formatINR(top.amount)} outstanding).` : ''} For a precise revenue-by-customer ranking, open the Reports page.`,
    sources: ['Clients + invoices'],
    metrics: [
      { label: 'Total customers', value: String(ctx.customers.total) },
      ...(top ? [{ label: 'Top by outstanding', value: top.name }] : []),
    ],
    confidence: 'medium',
  };
}

function answerCustomers(ctx: BusinessContext): AnswerParts {
  return {
    answer: `You have ${ctx.customers.total} customer${ctx.customers.total === 1 ? '' : 's'}${ctx.customers.overdue > 0 ? `, of which ${ctx.customers.overdue} ${ctx.customers.overdue === 1 ? 'has' : 'have'} overdue invoices` : ', none overdue'}.`,
    sources: ['Clients + invoices'],
    metrics: [
      { label: 'Total customers', value: String(ctx.customers.total) },
      { label: 'Overdue customers', value: String(ctx.customers.overdue) },
    ],
    confidence: 'high',
  };
}

function answerBusinessScore(ctx: BusinessContext): AnswerParts {
  // Derive a quick inline score (the full computation lives in scoring.ts via
  // the provider, but for chat we give a directional read).
  let score = 50;
  const reasons: string[] = [];
  if (ctx.revenue.changePercent > 10) { score += 15; reasons.push('revenue growing'); }
  if (ctx.revenue.changePercent < -10) { score -= 15; reasons.push('revenue declining'); }
  if (ctx.profit.margin > 0.1) { score += 10; reasons.push('healthy margin'); }
  if (ctx.cashFlow.netInflow < 0) { score -= 15; reasons.push('negative cash flow'); }
  if (ctx.invoices.overdue > 0) { score -= 10; reasons.push(`${ctx.invoices.overdue} overdue invoice${ctx.invoices.overdue === 1 ? '' : 's'}`); }
  if (ctx.gst.filingStatus === 'overdue') { score -= 15; reasons.push('GST filing overdue'); }
  if (ctx.gst.filingStatus === 'filed') { score += 10; reasons.push('GST filed on time'); }
  if (ctx.bankConnected) { score += 5; reasons.push('bank connected'); }
  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : 'D';
  const reason = reasons.length > 0 ? reasons.join(', ') : 'stable operations';
  return {
    answer: `Your business health is grade ${grade} (score ${score}/100) — ${reason}.`,
    sources: ['Invoices + GST + banking (composite)'],
    metrics: [
      { label: 'Business score', value: `${score}/100` },
      { label: 'Grade', value: grade },
    ],
    confidence: 'medium',
  };
}

function answerSummary(ctx: BusinessContext): AnswerParts {
  const parts: string[] = [];
  parts.push(`Here's your ${periodLabel(ctx.period)} snapshot: revenue ${formatINR(ctx.revenue.current)}${ctx.revenue.previous > 0 ? ` (${formatPercent(ctx.revenue.changePercent)} vs last month)` : ''}, expenses ${formatINR(ctx.expenses.current)}, profit ${formatINR(ctx.profit.current)}.`);
  if (ctx.outstanding.receivables > 0) {
    parts.push(`You're owed ${formatINR(ctx.outstanding.receivables)}${ctx.invoices.overdue > 0 ? ` (${formatINR(ctx.invoices.overdueValue)} overdue)` : ''}.`);
  }
  if (ctx.gst.netPayable > 0) {
    parts.push(`Net GST payable: ${formatINR(ctx.gst.netPayable)}.`);
  }
  if (ctx.bankConnected) {
    parts.push(`Bank balance: ${formatINR(ctx.banking.totalBalance)}, net cash flow ${formatINR(ctx.cashFlow.netInflow)}.`);
  }
  if (ctx.deadlines.upcoming.length > 0) {
    const next = ctx.deadlines.upcoming[0];
    parts.push(`Next deadline: ${next.label} in ${next.daysRemaining} day${next.daysRemaining === 1 ? '' : 's'}.`);
  }
  return {
    answer: parts.join(' '),
    sources: ['Invoices + GST + banking + returns'],
    metrics: [
      { label: 'Revenue', value: formatINR(ctx.revenue.current) },
      { label: 'Expenses', value: formatINR(ctx.expenses.current) },
      { label: 'Profit', value: formatINR(ctx.profit.current) },
      { label: 'Receivables', value: formatINR(ctx.outstanding.receivables) },
      { label: 'GST payable', value: formatINR(ctx.gst.netPayable) },
      ...(ctx.bankConnected ? [{ label: 'Bank balance', value: formatINR(ctx.banking.totalBalance) }] : []),
    ],
    confidence: 'high',
  };
}

// ─── Chat Engine entry point ──────────────────────────────────────────────────

/**
 * Answer a natural-language business question using the REAL BusinessContext.
 * NEVER fabricates data — every answer cites the real metrics used.
 */
export function answerQuestionWithContext(
  question: string,
  context: BusinessContext,
): ChatResponse {
  const intent = detectIntent(question);
  let parts: AnswerParts;

  switch (intent) {
    case 'revenue': parts = answerRevenue(context); break;
    case 'expenses': parts = answerExpenses(context); break;
    case 'profit': parts = answerProfit(context); break;
    case 'gst_liability': parts = answerGstLiability(context); break;
    case 'gst_filing': parts = answerGstFiling(context); break;
    case 'bank_balance': parts = answerBankBalance(context); break;
    case 'cash_flow': parts = answerCashFlow(context); break;
    case 'receivables': parts = answerReceivables(context); break;
    case 'payables': parts = answerPayables(context); break;
    case 'overdue': parts = answerOverdue(context); break;
    case 'invoices': parts = answerInvoices(context); break;
    case 'deadlines': parts = answerDeadlines(context); break;
    case 'top_debtor': parts = answerTopDebtor(context); break;
    case 'top_customer': parts = answerTopCustomer(context); break;
    case 'customers': parts = answerCustomers(context); break;
    case 'business_score': parts = answerBusinessScore(context); break;
    case 'summary': parts = answerSummary(context); break;
    default:
      parts = {
        answer: `I can answer questions about your revenue, expenses, profit, GST, bank balance, cash flow, receivables, payables, overdue invoices, deadlines, and customers. For example: "How much revenue this month?", "How much GST do I owe?", or "Who owes me money?" — all answered using your live business data.`,
        sources: [],
        metrics: [],
        confidence: 'low',
      };
  }

  return {
    answer: parts.answer,
    sources: parts.sources,
    confidence: parts.confidence,
    dataUsed: {
      summary: parts.sources.length > 0
        ? `Answered using: ${parts.sources.join(', ')}.`
        : 'Insufficient data to answer precisely.',
      metrics: parts.metrics,
    },
  };
}

/** Re-export for diagnostics. */
export { detectIntent, INTENT_KEYWORDS };
export type { Intent };
