// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Intent Classifier
// ═══════════════════════════════════════════════════════════════════════════════
//
// Classifies the user's question into an IntentId using keyword matching.
// This is FAST (no LLM call) and DETERMINISTIC — it decides which tools to run
// before the LLM is even invoked.
//
// The classifier also maps each intent to the set of tools Oracle must execute
// to gather REAL data. "How is my business?" → 8 tools run in parallel.
// ═══════════════════════════════════════════════════════════════════════════════

import type { IntentId } from './types';

interface IntentRule {
  id: IntentId;
  /** Regex tested against the lowercased question. */
  patterns: RegExp[];
  /** Tools to run for this intent. */
  tools: string[];
}

// ─── Intent rules (ordered — first match wins) ────────────────────────────────

const RULES: IntentRule[] = [
  {
    id: 'business_overview',
    patterns: [
      /\bhow is my business\b/, /\bhow'?s my business\b/, /\bbusiness (overview|summary|health|status|performance)\b/,
      /\boverall (health|status|performance|picture)\b/, /\bbusiness doing\b/, /\bgive me (a )?brief/,
      /\brun my business\b/, /\bbusiness (review|snapshot|report)\b/, /\bhow are we doing\b/,
      /\bstate of (my|the) business\b/, /\bbusiness update\b/,
    ],
    // "How is my business?" → call EVERYTHING in parallel.
    tools: ['snapshot', 'invoices', 'customers', 'gst', 'collections', 'banking', 'compliance', 'forecast'],
  },
  {
    id: 'revenue',
    patterns: [
      /\brevenue\b/, /\bsales\b/, /\btop line\b/, /\bincome\b/, /\bturnover\b/,
      /\bhow much.*sell/, /\bhow much.*sold/, /\bmoney.*com/, /\bearn/,
    ],
    tools: ['snapshot', 'invoices', 'customers', 'forecast'],
  },
  {
    id: 'cash',
    patterns: [
      /\bcash\b/, /\bcash (flow|position|balance|runway)\b/, /\bbank balance\b/,
      /\bliquidity\b/, /\bhow much.*cash\b/, /\bmoney in.*bank\b/, /\brunway\b/,
      /\bburn rate\b/, /\bworking capital\b/,
    ],
    tools: ['snapshot', 'banking', 'collections', 'forecast'],
  },
  {
    id: 'gst',
    patterns: [
      /\bgst\b/, /\bgstr\b/, /\bitc\b/, /\binput tax\b/, /\boutput tax\b/,
      /\btax liability\b/, /\btax credit\b/, /\bgst (return|filing|payable|mismatch|notice)\b/,
      /\breconcil/, /\b2a\b/, /\b2b\b/,
    ],
    tools: ['snapshot', 'gst', 'invoices', 'compliance'],
  },
  {
    id: 'customers',
    patterns: [
      /\bcustomer\b/, /\bclient\b/, /\bbuyer\b/, /\btop (customer|client)\b/,
      /\brisky (customer|client)\b/, /\bcustomer (risk|concentration|health)\b/,
      /\bwho owes\b/, /\baccounts receivable\b/,
    ],
    tools: ['snapshot', 'customers', 'invoices', 'collections'],
  },
  {
    id: 'invoices',
    patterns: [
      /\binvoice\b/, /\bbill\b/, /\bunpaid invoice\b/, /\boverdue invoice\b/,
      /\bcreate invoice\b/, /\bsend invoice\b/, /\binvoicing\b/,
    ],
    tools: ['snapshot', 'invoices', 'customers'],
  },
  {
    id: 'collections',
    patterns: [
      /\bcollect/, /\bpayment\b/, /\breceivable\b/, /\bremind/, /\bfollow.?up\b/,
      /\bwho hasn'?t paid\b/, /\boutstanding\b/, /\bdues\b/, /\bsettle/,
      /\bchase\b/, /\bdelayed payment\b/,
    ],
    tools: ['snapshot', 'collections', 'invoices', 'customers'],
  },
  {
    id: 'compliance',
    patterns: [
      /\bcompliance\b/, /\bdeadline\b/, /\bdue date\b/, /\bpenalty\b/, /\baudit\b/,
      /\bnotice\b/, /\bfiling\b/, /\boverdue return\b/, /\bregulatory\b/,
      /\bstatutory\b/, /\bgstr.?1\b/, /\bgstr.?3b\b/,
    ],
    tools: ['snapshot', 'compliance', 'gst'],
  },
  {
    id: 'forecast',
    patterns: [
      /\bforecast/, /\bpredict/, /\bprojection\b/, /\boutlook\b/, /\bnext month\b/,
      /\bnext quarter\b/, /\bupcoming\b/, /\bfuture\b/, /\bexpected\b/,
      /\bcash flow projection\b/, /\brevenue projection\b/,
    ],
    tools: ['snapshot', 'forecast', 'collections', 'expenses'],
  },
  {
    id: 'expenses',
    patterns: [
      /\bexpense\b/, /\bspending\b/, /\bcost\b/, /\bburn\b/, /\bvendor\b/,
      /\bpurchase\b/, /\bpayable\b/, /\boperating cost\b/, /\boverhead\b/,
    ],
    tools: ['snapshot', 'expenses', 'banking'],
  },
  {
    id: 'profit',
    patterns: [
      /\bprofit\b/, /\bmargin\b/, /\bbottom line\b/, /\bp&l\b/, /\bpnl\b/,
      /\bloss\b/, /\bprofitability\b/, /\bearnings\b/,
    ],
    tools: ['snapshot', 'expenses', 'invoices'],
  },
  {
    id: 'risk',
    patterns: [
      /\brisk\b/, /\bdanger\b/, /\bexposure\b/, /\bvulnerable\b/, /\bthreat\b/,
      /\bwhat could go wrong\b/, /\bdownside\b/, /\bconcentration risk\b/,
    ],
    tools: ['snapshot', 'customers', 'gst', 'compliance', 'collections'],
  },
  {
    id: 'banking',
    patterns: [
      /\bbank/, /\baccount balance\b/, /\btransaction\b/, /\bupi\b/, /\bneft\b/,
      /\brtgs\b/, /\bbank (statement|feed|sync)\b/,
    ],
    tools: ['snapshot', 'banking', 'collections'],
  },
  {
    id: 'report',
    patterns: [
      /\breport\b/, /\bgenerate.*report\b/, /\bmonthly report\b/, /\bsummary report\b/,
      /\bexport\b/, /\bdownload\b/, /\bbusiness report\b/, /\bcfo report\b/,
      /\bboard report\b/, /\bmanagement report\b/,
    ],
    tools: ['snapshot', 'invoices', 'expenses', 'gst', 'collections', 'compliance', 'forecast'],
  },
];

// ─── Public API ───────────────────────────────────────────────────────────────

/** Classify a user question into an intent. Returns 'general' if no match. */
export function classifyIntent(question: string): IntentId {
  const q = (question || '').toLowerCase().trim();
  if (!q) return 'general';
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(q))) return rule.id;
  }
  return 'general';
}

/** Get the list of tools to run for a given intent. */
export function getToolsForIntent(intent: IntentId): string[] {
  const rule = RULES.find((r) => r.id === intent);
  return rule ? rule.tools : ['snapshot'];
}

/** Human-readable label for an intent (shown in the UI trace). */
export function intentLabel(intent: IntentId): string {
  const labels: Record<IntentId, string> = {
    business_overview: 'Business Overview',
    revenue: 'Revenue Analysis',
    cash: 'Cash Position',
    gst: 'GST & Tax',
    customers: 'Customer Intelligence',
    invoices: 'Invoice Review',
    collections: 'Collection Analysis',
    compliance: 'Compliance Check',
    forecast: 'Forecasting',
    expenses: 'Expense Analysis',
    profit: 'Profitability',
    risk: 'Risk Assessment',
    banking: 'Banking',
    report: 'Report Generation',
    general: 'General Query',
  };
  return labels[intent] ?? 'General Query';
}
