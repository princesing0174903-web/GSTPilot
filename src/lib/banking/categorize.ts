// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Real Banking Foundation™ — Transaction Categorization Engine
//
// Automatically assigns a TransactionCategory to every bank transaction based
// on its description, amount, type (credit/debit), and counterparty. This is a
// PURE, deterministic, keyword-driven engine — no LLM, no external calls.
//
// The engine is intentionally over-explained: each category has a ranked list
// of keyword patterns. The first match wins. If no pattern matches, the
// transaction falls back to 'other'.
//
// Used by:
//   • MockBankProvider — to categorize generated transactions
//   • The sync orchestrator — to (re)categorize transactions after fetching
//   • The useBanking hook — to recompute summaries in real time
//
// Categories (12):
//   sales, purchase, gst, salary, rent, utilities, loan, interest, transfer,
//   investment, cash_withdrawal, other
// ═══════════════════════════════════════════════════════════════════════════════

import type { BankTransactionType, TransactionCategory } from '@/lib/banking-provider/types';

// ─── Category metadata ───────────────────────────────────────────────────────

export const ALL_CATEGORIES: TransactionCategory[] = [
  'sales',
  'purchase',
  'gst',
  'salary',
  'rent',
  'utilities',
  'loan',
  'interest',
  'transfer',
  'investment',
  'cash_withdrawal',
  'other',
];

/** Human-readable labels for each category (for UI display). */
export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  sales: 'Sales / Customer Payment',
  purchase: 'Purchase / Vendor Payment',
  gst: 'GST Payment / Refund',
  salary: 'Salary',
  rent: 'Rent',
  utilities: 'Utilities',
  loan: 'Loan / EMI',
  interest: 'Interest',
  transfer: 'Transfer',
  investment: 'Investment',
  cash_withdrawal: 'Cash Withdrawal',
  other: 'Other',
};

/** Tailwind-friendly tone per category (for badges / chips). */
export const CATEGORY_TONES: Record<TransactionCategory, string> = {
  sales: 'emerald',
  purchase: 'amber',
  gst: 'violet',
  salary: 'cyan',
  rent: 'orange',
  utilities: 'sky',
  loan: 'rose',
  interest: 'teal',
  transfer: 'slate',
  investment: 'indigo',
  cash_withdrawal: 'zinc',
  other: 'gray',
};

// ─── Pattern definitions ─────────────────────────────────────────────────────
// Each category has a list of regex patterns. The engine tests the normalized
// description against each pattern in order; the first matching category wins.
// Order matters: more specific patterns (gst, salary) come before generic ones
// (purchase, transfer).

interface CategoryPattern {
  category: TransactionCategory;
  patterns: RegExp[];
  /** Restrict to a transaction direction (optional). */
  type?: BankTransactionType;
}

const PATTERNS: CategoryPattern[] = [
  // GST — must come before purchase (GST payments look like vendor payments).
  {
    category: 'gst',
    patterns: [
      /\bgst\b/i,
      /\bcgst\b/i,
      /\bsgst\b/i,
      /\bigst\b/i,
      /tax\s*payment/i,
      /goods\s*and\s*services\s*tax/i,
      /cin\d/i, // CIN = Common Identification Number (GST challan)
      /challan/i,
    ],
  },
  // Salary — very specific keyword.
  {
    category: 'salary',
    patterns: [
      /\bsalary\b/i,
      /\bpayroll\b/i,
      /\bwages\b/i,
      /salary\s*credit/i,
    ],
    type: 'credit',
  },
  // Rent.
  {
    category: 'rent',
    patterns: [
      /\brent\b/i,
      /lease\s*payment/i,
    ],
  },
  // Utilities — electricity, internet, phone, water, gas.
  {
    category: 'utilities',
    patterns: [
      /electric/i,
      /power\s*bill/i,
      /adani\s*electric/i,
      /tata\s*power/i,
      /water\s*bill/i,
      /broadband/i,
      /internet\s*bill/i,
      /airtel/i,
      /jio/i,
      /reliance\s*jio/i,
      /bsnl/i,
      /vodafone/i,
      /mobile\s*bill/i,
      /phone\s*bill/i,
      /dth/i,
    ],
  },
  // Loan — EMI, principal, interest on loan.
  {
    category: 'loan',
    patterns: [
      /\bemi\b/i,
      /loan\s*repay/i,
      /loan\s*a?c\b/i,
      /principal\s*repay/i,
      /home\s*loan/i,
      /car\s*loan/i,
      /personal\s*loan/i,
      /auto\s*loan/i,
    ],
  },
  // Interest — received or paid (but not loan EMI).
  {
    category: 'interest',
    patterns: [
      /interest\s*credit/i,
      /interest\s*paid/i,
      /interest\s*(?:on\s*)?(?:fd|rd|savings)/i,
      /savings\s*interest/i,
      /fd\s*interest/i,
      /int\s*credited/i,
    ],
  },
  // Cash withdrawal — ATM.
  {
    category: 'cash_withdrawal',
    patterns: [
      /atm\s*(?:withdrawal|cash)/i,
      /cash\s*withdraw/i,
      /atm\s*dr/i,
      /nw\s*atm/i,
      /cw\s*dr/i,
    ],
    type: 'debit',
  },
  // Investment — mutual funds, FD, equity.
  {
    category: 'investment',
    patterns: [
      /mutual\s*fund/i,
      /\bmf\s*(?:invest|purchase)/i,
      /sip\s*debit/i,
      /equity\s*purchase/i,
      /stock\s*purchase/i,
      /fd\s*(?:deposit|open)/i,
      /rd\s*deposit/i,
      /demat/i,
      /zerodha/i,
      /groww/i,
      /upstox/i,
      /nps\s*contribution/i,
      /ppf\s*deposit/i,
    ],
    type: 'debit',
  },
  // Sales — incoming customer payment (NEFT/UPI/RTGS credit from a known customer).
  {
    category: 'sales',
    patterns: [
      /neft\s*cr/i,
      /rtgs\s*cr/i,
      /imps\s*cr/i,
      /upi\s*cr/i,
      /payment\s*received/i,
      /invoice\s*payment/i,
      /customer\s*payment/i,
      /received\s*from/i,
    ],
    type: 'credit',
  },
  // Purchase — outgoing vendor payment.
  {
    category: 'purchase',
    patterns: [
      /neft\s*dr/i,
      /rtgs\s*dr/i,
      /imps\s*dr/i,
      /upi\s*dr/i,
      /vendor\s*payment/i,
      /supplier\s*payment/i,
      /bill\s*payment/i,
      /paid\s*to/i,
      /purchase/i,
    ],
    type: 'debit',
  },
  // Transfer — internal / inter-account.
  {
    category: 'transfer',
    patterns: [
      /transfer\s*to\s*(?:own|self)/i,
      /internal\s*transfer/i,
      /inter\s*account/i,
      /self\s*transfer/i,
      /to\s*\/\s*from\s*(?:own|linked)/i,
    ],
  },
];

// ─── Engine ──────────────────────────────────────────────────────────────────

/**
 * Normalize a description for matching: lowercase, collapse whitespace,
 * strip leading/trailing punctuation.
 */
function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export interface CategorizeInput {
  description: string;
  type: BankTransactionType;
  amount: number;
  counterparty?: string | null;
}

/**
 * Categorize a single transaction. Pure + deterministic.
 * Returns 'other' if no pattern matches.
 */
export function categorizeTransaction(input: CategorizeInput): TransactionCategory {
  const desc = normalize(input.description);
  const counterparty = input.counterparty ? normalize(input.counterparty) : '';
  const haystack = `${desc} ${counterparty}`.trim();

  if (!haystack) return 'other';

  for (const { category, patterns, type } of PATTERNS) {
    // If the pattern is direction-restricted, skip if the tx direction doesn't match.
    if (type && type !== input.type) continue;
    for (const pattern of patterns) {
      if (pattern.test(haystack)) {
        return category;
      }
    }
  }
  return 'other';
}

/**
 * Extract a counterparty name from a bank transaction description.
 * Looks for patterns like "NEFT Cr <Name> UTR...", "UPI Cr okhdfc/<Name>", etc.
 * Returns null if no counterparty can be extracted.
 */
export function extractCounterparty(description: string): string | null {
  const desc = description.trim();

  // NEFT/RTGS/IMPS Cr/Dr <Name> UTR...
  const neftMatch = desc.match(/(?:NEFT|RTGS|IMPS)\s+(?:Cr|Dr)\s+(.+?)\s+UTR/i);
  if (neftMatch && neftMatch[1]) return neftMatch[1].trim();

  // UPI Cr/Dr <handle>/<Name>
  const upiMatch = desc.match(/UPI\s+(?:Cr|Dr)\s+\w+\/(.+)/i);
  if (upiMatch && upiMatch[1]) return upiMatch[1].trim();

  // "Received from <Name>" / "Paid to <Name>"
  const fromMatch = desc.match(/(?:received from|paid to|payment to|payment from)\s+(.+)/i);
  if (fromMatch && fromMatch[1]) {
    // Trim trailing reference numbers.
    return fromMatch[1].replace(/\s+(?:UTR|REF|CIN)\S*.*$/i, '').trim();
  }

  return null;
}

/**
 * Extract a reference number (UTR / CIN / REF) from a description.
 */
export function extractReferenceNumber(description: string): string | null {
  const match = description.match(/\b(UTR|CIN|REF|CHQ)\s*\d{6,}\b/i);
  return match ? match[0] : null;
}

/**
 * Recategorize an array of transactions in place. Useful after a sync when
 * the categorization rules may have been updated.
 */
export function recategorizeTransactions<
  T extends { description: string; type: BankTransactionType; amount: number; counterparty?: string | null; category: TransactionCategory },
>(transactions: T[]): T[] {
  for (const tx of transactions) {
    tx.category = categorizeTransaction({
      description: tx.description,
      type: tx.type,
      amount: tx.amount,
      counterparty: tx.counterparty,
    });
  }
  return transactions;
}
