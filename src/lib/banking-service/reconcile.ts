// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Service — Reconciliation Matching Helpers (Pure Functions)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Given a banking transaction and a synthetic ledger of invoices / payments /
// expenses, find the best candidate matches. Used by:
//   - MockBankingProvider.reconcileAll() / reconcileOne() to compute matches
//   - Future Setu provider (same logic — pure, provider-agnostic)
//
// Scoring model (transparent + explainable — no opaque ML):
//   amountScore (0–1)   how close the candidate amount is to the tx amount.
//                       1.0 = exact, 0 when > 5% off (cliff).
//   dateScore   (0–1)   how close the candidate date is to the tx date.
//                       1.0 within 1 day, decays linearly to 0 at 7 days.
//   nameScore   (0–1)   token-overlap between tx.counterparty and the
//                       candidate's customer/merchant/party name.
//
//   confidence = 0.55*amountScore + 0.30*dateScore + 0.15*nameScore
//
// The weights reflect that amount is by far the strongest signal (a perfect
// amount match on the right date is almost always the same economic event),
// followed by date, with name as a tie-breaker (bank statement text is messy).
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  BankingTransaction,
  ReconcileCandidate,
  ReconcileMatchStatus,
} from './types';

// ─── Synthetic ledger ─────────────────────────────────────────────────────────

export interface LedgerInvoice {
  id: string;
  number: string;
  amount: number;
  date: string;
  customer: string;
  status?: 'paid' | 'unpaid' | 'partial' | 'overdue';
}

export interface LedgerPayment {
  id: string;
  amount: number;
  date: string;
  party: string;
  direction: 'in' | 'out';
  reference?: string;
}

export interface LedgerExpense {
  id: string;
  amount: number;
  date: string;
  vendor: string;
  category?: string;
}

export interface ReconcileLedger {
  invoices: LedgerInvoice[];
  payments: LedgerPayment[];
  expenses: LedgerExpense[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

function absAmount(tx: BankingTransaction): number {
  return Math.abs(tx.amount);
}

/**
 * Amount closeness. Returns 1.0 on exact match, decays linearly to 0 at ±5%
 * difference, then 0 beyond. The ±2% "matched" threshold used elsewhere in the
 * app sits inside this scoring curve so an exact-amount match dominates the
 * final confidence.
 */
export function amountScore(txAmount: number, candidateAmount: number): number {
  const a = Math.abs(txAmount);
  const c = Math.abs(candidateAmount);
  if (a === 0 && c === 0) return 1;
  if (a === 0 || c === 0) return 0;
  const diff = Math.abs(a - c) / Math.max(a, c);
  if (diff > 0.05) return 0;
  return 1 - diff / 0.05;
}

/**
 * Date closeness. 1.0 within 1 day, linear decay to 0 at 7 days, 0 beyond.
 */
export function dateScore(txDate: string, candidateDate: string): number {
  const t = Date.parse(txDate);
  const c = Date.parse(candidateDate);
  if (Number.isNaN(t) || Number.isNaN(c)) return 0;
  const days = Math.abs(t - c) / DAY_MS;
  if (days > 7) return 0;
  if (days <= 1) return 1;
  return 1 - (days - 1) / 6;
}

/**
 * Token-set Jaccard overlap between two name strings (0–1).
 * Lowercased, alnum tokens, deduped. Empty sets return 0.
 */
export function nameScore(a?: string, b?: string): number {
  const toks = (s?: string): Set<string> => {
    if (!s) return new Set();
    return new Set(
      s
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .filter((t) => t.length > 1),
    );
  };
  const A = toks(a);
  const B = toks(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Combine the three sub-scores into a single confidence (0–1).
 * Weights: amount 0.55, date 0.30, name 0.15.
 */
export function combineScore(amount: number, date: number, name: number): number {
  return 0.55 * amount + 0.3 * date + 0.15 * name;
}

// ─── findCandidates ───────────────────────────────────────────────────────────

/**
 * Find all candidate matches for a transaction across the synthetic ledger.
 *
 * For credits we look at invoices (incoming customer payments) + inbound
 * payments; for debits we look at expenses + outbound payments. This matches
 * the economic reality (a debit on the bank statement is an outflow we
 * reconcile against a vendor bill / expense, not against a sales invoice).
 *
 * Returns candidates sorted by confidence descending. The caller (provider)
 * decides whether the top candidate clears the matched/suggested/partial
 * threshold via classifyMatch().
 */
export function findCandidates(
  transaction: BankingTransaction,
  ledger: ReconcileLedger,
): ReconcileCandidate[] {
  const txAmount = absAmount(transaction);
  const txDate = transaction.date;
  const txParty = transaction.counterparty;
  const out: ReconcileCandidate[] = [];

  const push = (c: Omit<ReconcileCandidate, 'confidence'>, partyName?: string) => {
    const a = amountScore(txAmount, c.amount);
    const d = dateScore(txDate, c.date);
    const n = nameScore(txParty, partyName);
    const confidence = combineScore(a, d, n);
    // Drop zero-confidence candidates — they only add noise.
    if (confidence <= 0) return;
    out.push({ ...c, confidence });
  };

  if (transaction.type === 'credit') {
    // Match against invoices + inbound payments.
    for (const inv of ledger.invoices ?? []) {
      push(
        {
          kind: 'invoice',
          id: inv.id,
          label: `${inv.number} — ${inv.customer}`,
          amount: inv.amount,
          date: inv.date,
        },
        inv.customer,
      );
    }
    for (const pay of ledger.payments ?? []) {
      if (pay.direction !== 'in') continue;
      push(
        {
          kind: 'payment',
          id: pay.id,
          label: `${pay.party}${pay.reference ? ` (${pay.reference})` : ''}`,
          amount: pay.amount,
          date: pay.date,
        },
        pay.party,
      );
    }
  } else {
    // Match against expenses + outbound payments.
    for (const ex of ledger.expenses ?? []) {
      push(
        {
          kind: 'expense',
          id: ex.id,
          label: `${ex.vendor}${ex.category ? ` — ${ex.category}` : ''}`,
          amount: ex.amount,
          date: ex.date,
        },
        ex.vendor,
      );
    }
    for (const pay of ledger.payments ?? []) {
      if (pay.direction !== 'out') continue;
      push(
        {
          kind: 'payment',
          id: pay.id,
          label: `${pay.party}${pay.reference ? ` (${pay.reference})` : ''}`,
          amount: pay.amount,
          date: pay.date,
        },
        pay.party,
      );
    }
  }

  out.sort((a, b) => b.confidence - a.confidence);
  return out;
}

// ─── classifyMatch ────────────────────────────────────────────────────────────

/**
 * Bucket the best candidate's confidence into one of four statuses.
 *
 *   matched   ≥ 0.95   (essentially certain — same amount + same date)
 *   suggested 0.70–0.95 (strong candidate — surface as "we think this is X")
 *   partial   0.50–0.70 (weak candidate — show, but don't auto-link)
 *   unmatched  < 0.50   (no usable candidate — leave for manual review)
 *
 * When there are no candidates at all, status is `unmatched`.
 */
export function classifyMatch(candidates: ReconcileCandidate[]): ReconcileMatchStatus {
  if (!candidates?.length) return 'unmatched';
  const top = candidates[0].confidence;
  if (top >= 0.95) return 'matched';
  if (top >= 0.7) return 'suggested';
  if (top >= 0.5) return 'partial';
  return 'unmatched';
}
