// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Copilot Modes
// ═══════════════════════════════════════════════════════════════════════════════
//
// Oracle can be invoked in different "modes" — each mode shapes the system
// prompt, the tool allowlist, and the suggested follow-ups. Users can switch
// modes via the UI dropdown, or prefix their message ("CFO, what's hurting
// cash flow?").
//
// Modes are NOT separate AI agents — they're a system-prompt + tool-allowlist
// overlay on the same Oracle brain. This keeps the architecture simple while
// letting Oracle specialise its reasoning per domain.
//
// SECURITY: The mode's toolAllowlist is intersected with the user's actual
// tool permissions (see tool-permissions.ts). A mode can never grant a tool
// the user doesn't have permission to call.
// ═══════════════════════════════════════════════════════════════════════════════

export type CopilotModeId =
  | 'general'
  | 'cfo'
  | 'gst'
  | 'cash-flow'
  | 'receivables'
  | 'payables'
  | 'tax'
  | 'operations'
  | 'invoices'
  | 'customers'
  | 'banking';

export interface CopilotMode {
  id: CopilotModeId;
  label: string;
  /** Short tagline shown in the mode selector. */
  tagline: string;
  /** Lucide icon name. */
  icon: string;
  /** The system-prompt fragment injected when this mode is active. */
  systemPromptFragment: string;
  /** Tools this mode prefers (still gated by user permissions). */
  preferredTools: string[];
  /** Suggested prompts shown in the empty state. */
  suggestedPrompts: string[];
  /** Accent color class for the mode badge. */
  accentClass: string;
}

export const COPILOT_MODES: Record<CopilotModeId, CopilotMode> = {
  general: {
    id: 'general',
    label: 'General',
    tagline: 'All-purpose Oracle — ask anything',
    icon: 'Sparkles',
    systemPromptFragment: `You are in GENERAL mode. Help with any question across finance, GST, operations, and compliance. Switch modes if the user asks a specialised question.`,
    preferredTools: ['getBusinessSnapshot', 'queryInvoices', 'queryCustomers', 'getGSTStatus'],
    suggestedPrompts: [
      "What's the state of my business?",
      'Show me today\'s priorities',
      'What needs my attention?',
    ],
    accentClass: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  },
  cfo: {
    id: 'cfo',
    label: 'CFO',
    tagline: 'Financial strategy & cash flow',
    icon: 'TrendingUp',
    systemPromptFragment: `You are in CFO mode. Reason like a Chief Financial Officer. Focus on profitability, cash flow, runway, financial risk, and strategic decisions. Always connect numbers to business impact. When you see a trend, explain the cause and the implication. Cite the source for every financial claim.`,
    preferredTools: ['getBusinessSnapshot', 'getCashflowAnalysis', 'forecastCashFlow', 'getTopCustomer'],
    suggestedPrompts: [
      "CFO, what's hurting cash flow?",
      'How is my runway looking?',
      'Why did revenue change this month?',
      'What\'s my biggest financial risk?',
    ],
    accentClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  gst: {
    id: 'gst',
    label: 'GST',
    tagline: 'GST compliance & ITC',
    icon: 'Receipt',
    systemPromptFragment: `You are in GST mode. Focus on GST compliance — output tax, input tax credit (ITC), GSTR-2B reconciliation, mismatches, filing status, and ITC at risk. Be precise about periods and amounts. If GSP is not connected, say so and refuse to claim live GST exposure. Always label DEMO/SANDBOX GST data as such.`,
    preferredTools: ['getGSTStatus', 'getPendingFilings', 'prepareGstr3b'],
    suggestedPrompts: [
      'GST, what ITC is at risk?',
      'Show me GSTR-2B mismatches',
      'What returns are due this month?',
      'How much GST do I owe?',
    ],
    accentClass: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  'cash-flow': {
    id: 'cash-flow',
    label: 'Cash Flow',
    tagline: 'Inflows, outflows & runway',
    icon: 'Wallet',
    systemPromptFragment: `You are in CASH FLOW mode. Focus on cash position, inflows, outflows, runway, and burn rate. Distinguish between real bank balances and payment-flow estimates. If banking is sandbox, say so. Forecast where useful but always cite assumptions and confidence.`,
    preferredTools: ['getCashflowAnalysis', 'getBankAccounts', 'forecastCashFlow'],
    suggestedPrompts: [
      'Where did cash go this week?',
      'How long will my cash last?',
      'What\'s my monthly burn?',
      'Compare this month\'s cash flow to last',
    ],
    accentClass: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  },
  receivables: {
    id: 'receivables',
    label: 'Receivables',
    tagline: 'Collections & overdue',
    icon: 'ArrowDownToLine',
    systemPromptFragment: `You are in RECEIVABLES mode. Focus on outstanding invoices, overdue balances, collection priorities, and customer payment behaviour. Always lead with the most actionable insight — who to chase today. Suggest reminder actions for high-risk overdue invoices.`,
    preferredTools: ['getOverdueCustomers', 'queryInvoices', 'sendReminder'],
    suggestedPrompts: [
      'Receivables, who should I chase today?',
      'Show me overdue invoices by aging',
      'Who owes me the most?',
      'Draft a reminder for my top overdue customer',
    ],
    accentClass: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  payables: {
    id: 'payables',
    label: 'Payables',
    tagline: 'Supplier bills & dues',
    icon: 'ArrowUpFromLine',
    systemPromptFragment: `You are in PAYABLES mode. Focus on supplier bills, overdue payables, supplier GST compliance, and payment scheduling. Flag suppliers with GST mismatches that put ITC at risk.`,
    preferredTools: ['queryExpenses', 'getGSTStatus'],
    suggestedPrompts: [
      'What do I owe suppliers?',
      'Which suppliers are overdue?',
      'Show supplier GST compliance',
      'Which bills are due this week?',
    ],
    accentClass: 'bg-rose-100 text-rose-700 border-rose-200',
  },
  tax: {
    id: 'tax',
    label: 'Tax',
    tagline: 'Tax planning & exposure',
    icon: 'Calculator',
    systemPromptFragment: `You are in TAX mode. Focus on overall tax exposure — GST liability, ITC position, advance tax, TDS, and tax planning. Be conservative. If data is insufficient for a tax position, say so explicitly. Never invent tax advice — cite the relevant section/circular if known.`,
    preferredTools: ['getGSTStatus', 'getBusinessSnapshot'],
    suggestedPrompts: [
      'What\'s my tax exposure this quarter?',
      'How much advance tax should I pay?',
      'Show me my ITC position',
    ],
    accentClass: 'bg-violet-100 text-violet-700 border-violet-200',
  },
  operations: {
    id: 'operations',
    label: 'Operations',
    tagline: 'Day-to-day workflows',
    icon: 'Settings',
    systemPromptFragment: `You are in OPERATIONS mode. Focus on day-to-day business operations — invoices to raise, payments to record, expenses to categorise, reconciliations to complete. Be action-oriented.`,
    preferredTools: ['createInvoice', 'createExpense', 'createPayment', 'reconcileTransactions'],
    suggestedPrompts: [
      'What operations are pending today?',
      'Help me record an expense',
      'What needs reconciliation?',
    ],
    accentClass: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  invoices: {
    id: 'invoices',
    label: 'Invoices',
    tagline: 'Billing & invoicing',
    icon: 'FileText',
    systemPromptFragment: `You are in INVOICES mode. Focus on invoices — creation, status, aging, duplicates, and anomalies. When the user asks "why is this invoice unpaid?", investigate the customer\'s payment behaviour and the invoice terms.`,
    preferredTools: ['queryInvoices', 'getNewestInvoice', 'getInvoiceMetrics', 'createInvoice'],
    suggestedPrompts: [
      'Invoice, why is INV-123 still unpaid?',
      'Show me my newest invoices',
      'What\'s my average invoice value?',
      'Help me create an invoice',
    ],
    accentClass: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  },
  customers: {
    id: 'customers',
    label: 'Customers',
    tagline: 'Customer insights',
    icon: 'Users',
    systemPromptFragment: `You are in CUSTOMERS mode. Focus on customer behaviour — concentration, payment patterns, top customers, and churn risk. When discussing a customer, cite their revenue share and payment history.`,
    preferredTools: ['queryCustomers', 'getTopCustomer', 'getOverdueCustomers'],
    suggestedPrompts: [
      'Customers, who owes me the most?',
      'Show customer concentration',
      'Who are my top 5 customers?',
      'Which customers are consistently late payers?',
    ],
    accentClass: 'bg-pink-100 text-pink-700 border-pink-200',
  },
  banking: {
    id: 'banking',
    label: 'Banking',
    tagline: 'Accounts & transactions',
    icon: 'Landmark',
    systemPromptFragment: `You are in BANKING mode. Focus on bank accounts, transactions, categorization, and reconciliation. ALWAYS label sandbox bank data as "BANKING SANDBOX" — never present it as live. If banking is not connected, say so.`,
    preferredTools: ['getBankAccounts', 'getBankingIntelligence', 'categorizeTransactions', 'reconcileTransactions'],
    suggestedPrompts: [
      'Banking, where did cash go this week?',
      'Show me recent transactions',
      'What\'s my bank balance?',
      'Help me reconcile transactions',
    ],
    accentClass: 'bg-teal-100 text-teal-700 border-teal-200',
  },
};

/** Parse a mode prefix from the user's message, e.g. "CFO, what's hurting cash flow?". */
export function parseModePrefix(message: string): { mode: CopilotModeId; strippedMessage: string } {
  const m = message.match(/^\s*(cfo|gst|cash[\s-]?flow|receivables?|payables?|tax|ops?|operations|invoices?|customers?|banking)\s*[,:\-—]\s*(.*)$/i);
  if (!m) return { mode: 'general', strippedMessage: message };
  const raw = m[1].toLowerCase().replace(/\s/g, '-').replace(/s$/, '');
  const map: Record<string, CopilotModeId> = {
    cfo: 'cfo', gst: 'gst', 'cash-flow': 'cash-flow', cashflow: 'cash-flow',
    receivable: 'receivables', receivables: 'receivables',
    payable: 'payables', payables: 'payables',
    tax: 'tax', op: 'operations', ops: 'operations', operations: 'operations',
    invoice: 'invoices', invoices: 'invoices',
    customer: 'customers', customers: 'customers',
    banking: 'banking',
  };
  const mode = map[raw] ?? 'general';
  return { mode, strippedMessage: m[2].trim() || message };
}

/** Get the active mode's tool allowlist (to be intersected with user permissions). */
export function getModeToolAllowlist(mode: CopilotModeId): Set<string> {
  return new Set(COPILOT_MODES[mode].preferredTools);
}

/** List all modes for the UI selector. */
export function listModes(): CopilotMode[] {
  return Object.values(COPILOT_MODES);
}
