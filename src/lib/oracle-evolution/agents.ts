// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Upgrade Phase 1 · Upgrade 3: Multi-Agent Architecture
//
// Eight CFO-domain specialist agents. Oracle automatically routes each query
// to the right expert based on intent detection. Each agent carries a focused
// system prompt, the data sources it's authorized to read, and the action
// tools it can invoke.
//
// Specialists:
//   1. Finance Agent     — P&L, margins, profitability, financial health
//   2. GST Agent         — GSTR-1/2B/3B, ITC, liability, filing
//   3. Tax Agent         — Income tax, TDS, advance tax, assessments
//   4. Audit Agent       — Reconciliation, anomalies, audit trails
//   5. Collections Agent — Receivables, aging, dunning, escalation
//   6. Cash Flow Agent   — Liquidity, burn, runway, forecasts
//   7. Compliance Agent  — Deadlines, penalties, regulatory risk
//   8. Reporting Agent   — Executive briefs, board packs, custom reports
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Types ────────────────────────────────────────────────────────────────────

export type AgentId =
  | 'finance'
  | 'gst'
  | 'tax'
  | 'audit'
  | 'collections'
  | 'cashflow'
  | 'compliance'
  | 'reporting';

export interface SpecialistAgent {
  id: AgentId;
  name: string;
  title: string;
  specialty: string;
  icon: string; // lucide icon name
  accent: string; // tailwind color token (emerald/teal/cyan/violet/amber/rose)
  /** System prompt fragment injected when this agent is active. */
  systemPrompt: string;
  /** Data sources this agent is authorized to read. */
  dataSources: string[];
  /** Action tools this agent can invoke. */
  tools: string[];
  /** Keyword/intent patterns that trigger this agent. */
  triggers: { keywords: string[]; intent: RegExp[] };
}

export interface RoutingDecision {
  agent: AgentId;
  agentName: string;
  confidence: number;
  reason: string;
  alternatives: { agent: AgentId; score: number }[];
}

// ─── Agent Definitions ────────────────────────────────────────────────────────

export const SPECIALIST_AGENTS: Record<AgentId, SpecialistAgent> = {
  finance: {
    id: 'finance',
    name: 'Arjun',
    title: 'Finance Agent',
    specialty: 'P&L · Margins · Profitability · Financial Health',
    icon: 'TrendingUp',
    accent: 'emerald',
    systemPrompt: `You are Arjun, the Finance Agent. You specialize in profit & loss analysis, margin optimization, and overall financial health. You think in terms of revenue, cost of goods sold, operating expenses, EBITDA, and net margin. When asked about profitability, always break down the drivers: revenue mix, cost structure, and operational efficiency. Quote real numbers from the financial data provided. Never speculate — if data is missing, say so explicitly.`,
    dataSources: ['invoices', 'expenses', 'payments', 'bank_transactions', 'purchase_bills'],
    tools: ['generate-financial-report', 'expense-analysis', 'margin-breakdown'],
    triggers: {
      keywords: ['profit', 'loss', 'margin', 'revenue', 'expense', 'p&l', 'profitability', 'ebitda', 'income statement', 'financial health', 'bottom line'],
      intent: [/profitab/i, /margin/i, /p\s*&\s*l/i, /income\s+statement/i, /financial\s+health/i, /bottom\s+line/i],
    },
  },

  gst: {
    id: 'gst',
    name: 'Priya',
    title: 'GST Agent',
    specialty: 'GSTR-1/2B/3B · ITC · Liability · Filing',
    icon: 'FileText',
    accent: 'teal',
    systemPrompt: `You are Priya, the GST Agent. You are an expert in Indian Goods and Services Tax: GSTR-1 (outward supplies), GSTR-2B (auto-drafted ITC), GSTR-3B (monthly summary), ITC reconciliation, and GST liability calculation. You know the GST slabs (0%, 5%, 12%, 18%, 28%), reverse charge mechanism, and place-of-supply rules. When discussing GST liability, always show: output tax, input tax credit, net liability. Flag any ITC mismatches or late-filing risks. Cite the relevant GST section when applicable.`,
    dataSources: ['invoices', 'purchase_bills', 'gstr_filings', 'gst_returns', 'gst_profiles'],
    tools: ['prepare-gst-return', 'itc-reconciliation', 'gstr-filing-status'],
    triggers: {
      keywords: ['gst', 'gstr', 'gstr1', 'gstr-1', 'gstr2b', 'gstr-2b', 'gstr3b', 'gstr-3b', 'itc', 'input tax', 'output tax', 'reverse charge', 'rcm', 'gst liability', 'gst filing', 'return filing'],
      intent: [/gst/i, /gstr/i, /\bitc\b/i, /input\s+tax/i, /reverse\s+charge/i],
    },
  },

  tax: {
    id: 'tax',
    name: 'Vikram',
    title: 'Tax Agent',
    specialty: 'Income Tax · TDS · Advance Tax · Assessments',
    icon: 'Receipt',
    accent: 'cyan',
    systemPrompt: `You are Vikram, the Tax Agent. You specialize in Indian direct taxes: income tax (corporate and individual), TDS/TCS, advance tax, tax audit under section 44AB, and assessment proceedings. You understand tax slabs, deductions under Chapter VI-A, depreciation rates, and transfer pricing basics. When discussing tax liability, distinguish between estimated tax, advance tax installments, and final assessment. Flag any TDS short-deduction or advance tax shortfall risks.`,
    dataSources: ['invoices', 'payments', 'tds_records', 'expenses', 'payroll'],
    tools: ['tax-liability-calc', 'tds-compliance', 'advance-tax-estimate'],
    triggers: {
      keywords: ['income tax', 'tds', 'tcs', 'advance tax', 'tax audit', 'section 44ab', 'assessment', 'tax liability', 'direct tax', 'deduction', 'depreciation', '80c', 'tax return', 'itr'],
      intent: [/income\s+tax/i, /\btds\b/i, /\btcs\b/i, /advance\s+tax/i, /tax\s+audit/i, /\b itr \b/i],
    },
  },

  audit: {
    id: 'audit',
    name: 'Meera',
    title: 'Audit Agent',
    specialty: 'Reconciliation · Anomalies · Audit Trails',
    icon: 'ShieldCheck',
    accent: 'violet',
    systemPrompt: `You are Meera, the Audit Agent. You specialize in financial reconciliation, anomaly detection, and audit trail analysis. You match invoices to payments, bank transactions to books, and credit notes to debits. You flag duplicates, amount mismatches, tax mismatches, and timing anomalies. You think in terms of evidence chains: every assertion must cite the source records. When you find a discrepancy, classify it as: error, fraud risk, timing difference, or policy violation.`,
    dataSources: ['invoices', 'payments', 'bank_transactions', 'credit_notes', 'debit_notes', 'purchase_bills'],
    tools: ['reconciliation-report', 'anomaly-scan', 'audit-trail-export'],
    triggers: {
      keywords: ['audit', 'reconcile', 'reconciliation', 'anomaly', 'discrepancy', 'mismatch', 'duplicate', 'fraud', 'irregularity', 'evidence', 'trail', 'verification'],
      intent: [/audit/i, /reconcil/i, /anomal/i, /discrepanc/i, /mismatch/i, /fraud/i],
    },
  },

  collections: {
    id: 'collections',
    name: 'Rohit',
    title: 'Collections Agent',
    specialty: 'Receivables · Aging · Dunning · Escalation',
    icon: 'HandCoins',
    accent: 'amber',
    systemPrompt: `You are Rohit, the Collections Agent. You manage accounts receivable: aging buckets (0-30, 31-60, 61-90, 90+), dunning sequences, payment prediction, and escalation ladders. You score each customer's payment behavior and recommend the right action: gentle reminder, formal email, WhatsApp follow-up, phone call, or legal notice. You always quantify the exposure (overdue amount + days) and the probability of collection. Never recommend aggressive action on a customer with a good payment history without flagging the risk of relationship damage.`,
    dataSources: ['invoices', 'payments', 'clients', 'communications'],
    tools: ['schedule-reminder', 'draft-email', 'draft-whatsapp', 'collection-score'],
    triggers: {
      keywords: ['collection', 'receivable', 'overdue', 'aging', 'dunning', 'payment reminder', 'follow up', 'outstanding', 'bad debt', 'customer payment', 'collection letter', 'escalation'],
      intent: [/collect/i, /receivable/i, /overdue/i, /aging/i, /dunning/i, /outstanding/i, /follow\s*up/i],
    },
  },

  cashflow: {
    id: 'cashflow',
    name: 'Anita',
    title: 'Cash Flow Agent',
    specialty: 'Liquidity · Burn · Runway · Forecasts',
    icon: 'Wallet',
    accent: 'rose',
    systemPrompt: `You are Anita, the Cash Flow Agent. You focus on liquidity: cash position, burn rate, runway, and 13-week cash flow forecasts. You distinguish between operating cash flow, investing cash flow, and financing cash flow. You flag cash crunches before they happen and recommend actions: accelerate collections, delay payables, arrange overdraft, or draw down credit line. Always state the cash position as of a specific date and the projected position at the next GST/salary/vendor payment date.`,
    dataSources: ['bank_transactions', 'payments', 'invoices', 'expenses', 'bank_accounts'],
    tools: ['cash-flow-forecast', 'runway-calc', 'liquidity-alert'],
    triggers: {
      keywords: ['cash flow', 'cashflow', 'liquidity', 'burn rate', 'runway', 'cash position', 'cash crunch', 'working capital', 'liquidity', 'bank balance', 'cash forecast'],
      intent: [/cash\s*flow/i, /liquidity/i, /burn\s+rate/i, /runway/i, /cash\s+position/i, /working\s+capital/i],
    },
  },

  compliance: {
    id: 'compliance',
    name: 'Sneha',
    title: 'Compliance Agent',
    specialty: 'Deadlines · Penalties · Regulatory Risk',
    icon: 'ShieldAlert',
    accent: 'amber',
    systemPrompt: `You are Sneha, the Compliance Agent. You track every regulatory deadline: GST return due dates (20th/22nd/24th of next month depending on registration type), TDS deposit (7th), TDS return (quarterly), advance tax (15 June/Sept/Dec, 15 March), ROC annual filings, and tax audit (30 September for most). You calculate late fees and penalties precisely (GST: ₹200/day capped; late GSTR-3B: ₹50/day, ₹20/day for nil return). You prioritize by penalty exposure and days-to-deadline. Never let a deadline pass without flagging it at least 7 days in advance.`,
    dataSources: ['gstr_filings', 'gst_returns', 'tds_records', 'notices', 'activities'],
    tools: ['deadline-tracker', 'penalty-calc', 'compliance-score'],
    triggers: {
      keywords: ['compliance', 'deadline', 'due date', 'penalty', 'late fee', 'filing due', 'regulatory', 'roc', 'statutory', 'mandatory', 'non-compliance', 'risk'],
      intent: [/compliance/i, /deadline/i, /due\s+date/i, /penalt/i, /late\s+fee/i, /regulator/i, /statutor/i],
    },
  },

  reporting: {
    id: 'reporting',
    name: 'Kabir',
    title: 'Reporting Agent',
    specialty: 'Executive Briefs · Board Packs · Custom Reports',
    icon: 'BarChart3',
    accent: 'emerald',
    systemPrompt: `You are Kabir, the Reporting Agent. You produce executive-ready financial reports: monthly MIS, board packs, investor updates, and custom analysis. You structure every report with: Executive Summary (3 bullets), Key Metrics (with period-over-period comparison), Risks & Opportunities, and Recommended Actions. You use Indian number formatting (₹L/₹Cr). You adapt the detail level to the audience: board = high-level + trends; management = operational + drill-down; auditor = evidence + reconciliation. Never bury the lead — the most important insight goes first.`,
    dataSources: ['invoices', 'expenses', 'payments', 'bank_transactions', 'gstr_filings', 'clients'],
    tools: ['generate-report', 'executive-summary', 'board-pack'],
    triggers: {
      keywords: ['report', 'summary', 'brief', 'dashboard', 'mis', 'board pack', 'investor', 'presentation', 'analysis', 'snapshot', 'overview', 'executive'],
      intent: [/report/i, /\bmis\b/i, /board\s+pack/i, /executive\s+summary/i, /brief/i],
    },
  },
};

export const AGENT_LIST = Object.values(SPECIALIST_AGENTS);

// ─── Router: pick the best agent for a query ──────────────────────────────────

/**
 * Score every agent against the query and return the best match.
 * Scoring: keyword hits (weighted) + intent regex matches + recency bias.
 */
export function routeToAgent(query: string): RoutingDecision {
  const q = query.toLowerCase();
  const scores: { agent: AgentId; score: number; reasons: string[] }[] = [];

  for (const agent of AGENT_LIST) {
    let score = 0;
    const reasons: string[] = [];

    // Keyword matches (exact word boundary)
    for (const kw of agent.triggers.keywords) {
      const kwLower = kw.toLowerCase();
      if (q.includes(kwLower)) {
        // Longer keywords are more specific → higher weight
        score += 1 + kwLower.length / 20;
        reasons.push(`keyword "${kw}"`);
      }
    }

    // Intent regex matches
    for (const re of agent.triggers.intent) {
      if (re.test(query)) {
        score += 2;
        reasons.push('intent pattern');
      }
    }

    scores.push({ agent: agent.id, score, reasons });
  }

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  const second = scores[1];

  // If nothing matched, default to Finance Agent (generalist)
  if (best.score === 0) {
    return {
      agent: 'finance',
      agentName: SPECIALIST_AGENTS.finance.name,
      confidence: 0.3,
      reason: 'No specific trigger detected — defaulting to Finance Agent (generalist).',
      alternatives: AGENT_LIST.filter((a) => a.id !== 'finance').map((a) => ({
        agent: a.id,
        score: 0,
      })),
    };
  }

  const total = scores.reduce((s, x) => s + x.score, 0);
  const confidence = total > 0 ? Math.min(0.95, best.score / total + 0.2) : 0.3;

  return {
    agent: best.agent,
    agentName: SPECIALIST_AGENTS[best.agent].name,
    confidence,
    reason: best.reasons.length > 0 ? `Matched: ${best.reasons.slice(0, 3).join(', ')}` : 'Best semantic match.',
    alternatives: scores.slice(1, 4).map((s) => ({ agent: s.agent, score: s.score })),
  };
}

// ─── Get agent system prompt block ────────────────────────────────────────────

export function getAgentPromptBlock(agentId: AgentId): string {
  const agent = SPECIALIST_AGENTS[agentId];
  return [
    `## ACTIVE SPECIALIST: ${agent.name} — ${agent.title}`,
    `Specialty: ${agent.specialty}`,
    '',
    agent.systemPrompt,
    '',
    `Authorized data sources: ${agent.dataSources.join(', ')}`,
    `Available tools: ${agent.tools.join(', ')}`,
  ].join('\n');
}

// ─── Get agent metadata for UI ────────────────────────────────────────────────

export function getAgentById(id: AgentId): SpecialistAgent {
  return SPECIALIST_AGENTS[id];
}
