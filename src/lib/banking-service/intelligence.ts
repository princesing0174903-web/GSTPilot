// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Service — Oracle Banking Intelligence: Question Matching
// ═══════════════════════════════════════════════════════════════════════════════
//
// Pure helper that classifies a free-text banking question into one of eight
// canonical kinds (or `generic`). The MockBankingProvider.answerQuestion()
// dispatches on the returned `kind` to compute a structured answer.
//
// Patterns are case-insensitive and intentionally loose — users phrase these
// in many ways ("how much money do i have", "what's my balance", "cash
// position?"). We use a small set of high-precision regexes; ambiguity falls
// through to `generic` which always returns a useful summary (never "I don't
// know").
// ═══════════════════════════════════════════════════════════════════════════════

export type BankingQuestionKind =
  | 'total_balance'
  | 'this_month_expenses'
  | 'unpaid_invoices'
  | 'cash_next_week'
  | 'cash_flow_decreasing'
  | 'suspicious_transactions'
  | 'largest_expenses'
  | 'late_payers'
  | 'generic';

export interface MatchedQuestion {
  kind: BankingQuestionKind;
  /** Short label rendered in the answer card (e.g. "Total cash position"). */
  label: string;
}

interface Rule {
  kind: BankingQuestionKind;
  label: string;
  /** Match if any regex in `patterns` matches (case-insensitive). */
  patterns: RegExp[];
}

// Order matters: more specific patterns are evaluated FIRST so they win
// over the broader `total_balance` patterns (e.g. "how much cash will I have
// next week" must hit `cash_next_week`, not the generic "how much cash ... have"
// pattern under `total_balance`).
const RULES: Rule[] = [
  {
    kind: 'cash_next_week',
    label: 'Cash position next week',
    patterns: [
      /how much cash.*next week/i,
      /cash.* (will i have|projected).*(next week|7 days|week)/i,
      /\bbalance.*next week\b/i,
      /\bcash.*next 7 days\b/i,
      /\bforecast.*week\b/i,
      /\bnext 7 days\b.*\bcash\b/i,
    ],
  },
  {
    kind: 'this_month_expenses',
    label: "This month's expenses",
    patterns: [
      /\bthis month'?s? expenses\b/i,
      /\bshow this month.*expense/i,
      /\bexpense.*this month\b/i,
      /\bspending.*this month\b/i,
      /\bhow much.*spent.*this month\b/i,
    ],
  },
  {
    kind: 'unpaid_invoices',
    label: 'Unpaid invoices',
    patterns: [
      /\bwhich invoices are (unpaid|outstanding|pending)\b/i,
      /\b(unpaid|outstanding|overdue) invoices?\b/i,
      /\binvoices? (not yet |awaiting )?paid\b/i,
      /\bwho (hasn't|has not|owes|has not yet) paid\b/i,
    ],
  },
  {
    kind: 'cash_flow_decreasing',
    label: 'Why is cash flow decreasing?',
    patterns: [
      /why is cash flow (decreasing|dropping|falling|declining)/i,
      /\bcash flow.*down\b/i,
      /why.*cash.*declin/i,
      /why.*balance.*decreas/i,
    ],
  },
  {
    kind: 'suspicious_transactions',
    label: 'Suspicious transactions',
    patterns: [
      /\bsuspicious\b/i,
      /\banomal/i,
      /\bunusual (transactions|charges|payments)\b/i,
      /\bflagged transactions\b/i,
      /\bfraud\b/i,
    ],
  },
  {
    kind: 'largest_expenses',
    label: 'Largest expenses',
    patterns: [
      /\blargest expenses\b/i,
      /\bbiggest (spends?|expenses|payments|transactions)\b/i,
      /\btop expenses\b/i,
      /\btop (10|ten) (debits?|expenses|payments)\b/i,
      /\bmost expensive\b/i,
    ],
  },
  {
    kind: 'late_payers',
    label: 'Customers who pay late',
    patterns: [
      /which customer.*pays? late/i,
      /\blate payers?\b/i,
      /\bwho pays? late\b/i,
      /\bcustomers? with (delayed|late) payments?\b/i,
      /\baverage.*delay.*payment\b/i,
      /\bpayment delay\b/i,
    ],
  },
  {
    // Evaluated LAST — `total_balance` is the broadest bucket and would
    // swallow more specific queries if it were checked earlier. Patterns are
    // intentionally strict: they require an explicit "balance" / "cash
    // position" phrase rather than just "how much cash ... have", so that
    // forward-looking questions fall through to `cash_next_week`.
    kind: 'total_balance',
    label: 'Total cash position',
    patterns: [
      /\b(total|current|overall) (bank )?balance\b/i,
      /\bcash position\b/i,
      /\bmy balance\b/i,
      /how much (money|funds) (do i have|in my|in the)/i,
      /\bwhat.*balance\b/i,
    ],
  },
];

/**
 * Classify a free-text banking question. Returns the first matching rule's
 * `kind` + `label`, or `generic` with a sensible default label.
 */
export function matchQuestion(rawQuestion: string): MatchedQuestion {
  const q = String(rawQuestion ?? '').trim();
  if (!q) return { kind: 'generic', label: 'Banking summary' };

  for (const rule of RULES) {
    if (rule.patterns.some((re) => re.test(q))) {
      return { kind: rule.kind, label: rule.label };
    }
  }
  return { kind: 'generic', label: 'Banking summary' };
}
