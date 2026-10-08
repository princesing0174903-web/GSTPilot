// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Smart Conversation Titles
//
// Generates premium, enterprise-grade conversation titles from the user's first
// message — e.g. "GST Analysis – ABC Traders" or "Cash Runway Forecast" instead
// of the generic "New conversation".
//
// Pure functions, no React, no side effects. Safe to call from store or UI.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Intent categories Oracle recognizes. Each has a display label and a set of
 * regex patterns used to detect the user's intent from their first message.
 */
interface TitleIntent {
  key: string;
  label: string;
  patterns: RegExp[];
  /** Optional extractor that pulls a subject (e.g. a vendor name) from the message. */
  extractSubject?: (msg: string) => string | null;
}

const TITLE_INTENTS: TitleIntent[] = [
  {
    key: 'gst',
    label: 'GST Analysis',
    patterns: [
      /\bgst\b/i, /\bgstr\b/i, /\bitc\b/i, /input\s+tax/i, /output\s+tax/i,
      /tax\s+liability/i, /tax\s+credit/i, /\breturn\s+filing/i, /gstr-\d/i,
    ],
    extractSubject: (msg) => extractEntityName(msg),
  },
  {
    key: 'invoice',
    label: 'Invoice Review',
    patterns: [/invoice/i, /e-invoice/i, /einvoice/i, /billed/i, /billing/i],
    extractSubject: (msg) => extractEntityName(msg),
  },
  {
    key: 'cashflow',
    label: 'Cash Flow Forecast',
    patterns: [/cash\s+flow/i, /cash\s+runway/i, /liquidity/i, /burn\s+rate/i, /runway/i],
  },
  {
    key: 'revenue',
    label: 'Revenue Analysis',
    patterns: [/revenue/i, /\bsales\b/i, /top\s+line/i, /mrr/i, /arr\b/i, /income/i],
  },
  {
    key: 'profit',
    label: 'Profitability Review',
    patterns: [/profit/i, /margin/i, /bottom\s+line/i, /ebitda/i, /p&l/i, /pnl/i],
  },
  {
    key: 'vendor',
    label: 'Vendor Analysis',
    patterns: [/vendor/i, /supplier/i, /payable/i, /creditor/i],
    extractSubject: (msg) => extractEntityName(msg),
  },
  {
    key: 'customer',
    label: 'Customer Insights',
    patterns: [/customer/i, /client/i, /receivable/i, /debtor/i, /collection/i],
    extractSubject: (msg) => extractEntityName(msg),
  },
  {
    key: 'compliance',
    label: 'Compliance Check',
    patterns: [/compliance/i, /notice/i, /deadline/i, /penalty/i, /audit/i, /reconcil/i, /due\s+date/i],
  },
  {
    key: 'risk',
    label: 'Risk Assessment',
    patterns: [/risk/i, /fraud/i, /exposure/i, /vulnerab/i, /flag/i],
  },
  {
    key: 'forecast',
    label: 'Business Forecast',
    patterns: [/forecast/i, /predict/i, /projection/i, /next\s+quarter/i, /next\s+month/i, /upcoming/i],
  },
  {
    key: 'benchmark',
    label: 'Industry Benchmark',
    patterns: [/benchmark/i, /industry\s+average/i, /peer\s+comparison/i, /compare/i],
  },
  {
    key: 'reconcile',
    label: 'Reconciliation',
    patterns: [/reconcil/i, /match\s+transactions/i, /books\s+match/i],
  },
  {
    key: 'strategy',
    label: 'Business Growth Strategy',
    patterns: [/growth\s+strategy/i, /expand/i, /scale/i, /strategy/i, /plan/i, /roadmap/i],
  },
  {
    key: 'tax',
    label: 'Tax Planning',
    patterns: [/tax\s+plan/i, /tax\s+optim/i, /tax\s+sav/i, /tds/i, /advance\s+tax/i],
  },
  {
    key: 'expense',
    label: 'Expense Analysis',
    patterns: [/expense/i, /spend/i, /cost\s+cut/i, /overspend/i, /burn/i],
  },
];

/**
 * Try to extract a business / entity name from the message. Looks for patterns
 * like "for ABC Traders", "of XYZ Ltd", quoted names, or Capitalized Multi-Word
 * sequences that look like company names.
 */
function extractEntityName(msg: string): string | null {
  // "for ABC Traders" / "of XYZ Pvt Ltd" / "about Acme Inc"
  const m = msg.match(/\b(?:for|of|about|from|with)\s+([A-Z][A-Za-z0-9&'.\-]+(?:\s+[A-Z][A-Za-z0-9&'.\-]+){0,3})/);
  if (m && m[1] && m[1].length >= 3) {
    return cleanEntity(m[1]);
  }
  // Quoted name: "ABC Traders"
  const q = msg.match(/["'`]([A-Z][A-Za-z0-9&'.\- ]{2,40})["'`]/);
  if (q && q[1]) return cleanEntity(q[1]);
  // Capitalized company-suffix pattern: "ABC Traders Pvt Ltd"
  const c = msg.match(/\b([A-Z][A-Za-z0-9&'.\-]+(?:\s+[A-Z][A-Za-z0-9&'.\-]+){1,3}\s+(?:Pvt|Private|Ltd|Limited|Inc|LLC|Corp|Co|Company|Enterprises|Traders|Services|Solutions))\b/);
  if (c && c[1]) return cleanEntity(c[1]);
  return null;
}

function cleanEntity(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  if (cleaned.length > 40) return cleaned.slice(0, 37).trimEnd() + '…';
  return cleaned;
}

/**
 * Generate a smart conversation title from the user's first message.
 *
 * Returns a title like:
 *   "GST Analysis – ABC Traders"
 *   "Cash Flow Forecast"
 *   "Vendor Analysis – Acme Suppliers"
 *
 * Falls back to a cleaned truncation of the message if no intent is detected.
 */
export function generateSmartTitle(firstMessage: string): string {
  const msg = (firstMessage || '').trim();
  if (!msg) return 'New conversation';

  for (const intent of TITLE_INTENTS) {
    if (intent.patterns.some((p) => p.test(msg))) {
      const subject = intent.extractSubject?.(msg);
      if (subject) {
        return `${intent.label} – ${subject}`;
      }
      return intent.label;
    }
  }

  // Fallback: clean + truncate the message itself
  const clean = msg
    .replace(/^(can you|could you|please|hey|hi|oracle|tell me|show me|give me|what|how|why|when|is|are|do|does)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return 'New conversation';
  if (clean.length <= 48) return capitalize(clean);
  return capitalize(clean.slice(0, 45).trimEnd()) + '…';
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Detect the topical category for a message — used for the sidebar filter.
 * Mirrors the store's inferCategory but richer.
 */
export function detectCategory(msg: string): 'gst' | 'business' | 'compliance' | 'finance' | 'general' {
  const t = (msg || '').toLowerCase();
  if (/\bgst\b|gstr|itc|input tax|output tax|return|filing|tax liability|tax credit/.test(t)) return 'gst';
  if (/invoice|customer|client|receivable|payable|vendor|payment|collection/.test(t)) return 'business';
  if (/compliance|notice|deadline|due date|penalty|audit|reconcil/.test(t)) return 'compliance';
  if (/cash|profit|revenue|expense|budget|flow|runway|forecast|p&l|balance sheet/.test(t)) return 'finance';
  return 'general';
}
