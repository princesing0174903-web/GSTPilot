// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Real Banking Foundation™ — Auto-Reconciliation Engine
//
// Matches bank_transactions (from connected bank accounts) against the firm's
// book entries (invoices, payments, expenses) using a transparent, deterministic
// scoring algorithm. NO LLM, NO Math.random — every match is reproducible and
// explainable.
//
// MATCHING SIGNALS (per candidate book entry):
//   • Exact amount    — bankAmount === bookAmount (float-safe within ₹0.005)
//   • Rounding amount — |diff| ≤ ₹1 (bank charges / rounding)
//   • Near amount     — |diff %| ≤ 2%
//   • Reference match — UTR / cheque no / narration contains an invoice number
//                        OR the bank referenceNo matches the payment.referenceNo
//   • Date proximity  — txn date within ±7 days (close) or ±14 days (near)
//                        of the book entry date
//   • Name similarity — normalized Levenshtein between bank counterparty
//                        (extracted from description) and invoice buyer / payment
//                        party / expense vendor
//
// CONFIDENCE TIERS:
//   • 'exact'   (≥0.90) — auto-match eligible IF unique
//                          triggers: exactAmount+refMatch | exactAmount+dateClose
//                                    | roundingAmount+dateClose
//   • 'strong'  (0.80–0.89) — manual review (single strong signal)
//                              triggers: exactAmount only | refMatch only |
//                                        roundingAmount+dateNear
//   • 'weak'    (0.70–0.79) — manual review (multiple weaker signals)
//                              triggers: nearAmount+nameSim+dateNear |
//                                        nearAmount+strongNameSim
//   • < 0.70    — not a candidate
//
// DISAMBIGUATION (CRITICAL):
//   • If 2+ book entries are tier='exact' for the same bank txn → needs review
//   • If 2+ bank txns match the same book entry at tier='exact' → needs review
//   • Auto-match ONLY fires when the (txn, book) pair is unambiguous at tier='exact'
//
// All matches carry a `reasons: string[]` array so the UI can show the user
// EXACTLY why a match was made.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  FirestoreBankTransaction,
  FirestoreInvoice,
  FirestorePayment,
  FirestoreExpense,
} from '@/lib/firestore-schema';

// ─── Public Types ────────────────────────────────────────────────────────────

/** Kind of book entry a bank transaction can be matched against. */
export type BookEntryKind = 'invoice' | 'payment' | 'expense';

/**
 * Normalized view of any book-side record (invoice / payment / expense).
 * The matching engine only consumes this shape so it stays source-agnostic.
 */
export interface BookEntry {
  id: string;
  kind: BookEntryKind;
  /** ISO date string (invoiceDate / paymentDate / expense date). */
  date: string;
  /** Total amount payable (always positive). */
  amount: number;
  /** Counterparty name (buyer / party / vendor). */
  name: string;
  /** Reference number on the book side (invoice number / UTR / payment ref). */
  reference: string | null;
  /** Optional invoice id this payment/expense is linked to. */
  linkedInvoiceId: string | null;
}

/** Confidence tier — drives auto-match eligibility. */
export type ConfidenceTier = 'exact' | 'strong' | 'weak';

/** A single (bank txn × book entry) match candidate with full explanation. */
export interface MatchCandidate {
  book: BookEntry;
  confidence: number;
  tier: ConfidenceTier;
  /** Human-readable reasons explaining WHY this match was suggested. */
  reasons: string[];
}

/** Result of attempting to match one bank transaction. */
export interface MatchResult {
  /** The bank transaction being matched. */
  txn: FirestoreBankTransaction & { id: string };
  /** All candidate book entries (sorted desc by confidence), empty if none. */
  candidates: MatchCandidate[];
  /** The best candidate (highest confidence), null if no candidates. */
  bestMatch: MatchCandidate | null;
  /** True when the pair is unambiguous + tier='exact' → safe to auto-reconcile. */
  autoMatch: boolean;
  /** True when there are candidates but auto-match did NOT fire (manual review). */
  needsReview: boolean;
  /** True when no book entry scored above the weak threshold. */
  noCandidate: boolean;
}

/** Aggregate result of running the engine over a batch of bank txns. */
export interface AutoReconcileResult {
  results: MatchResult[];
  autoMatched: MatchResult[];
  needsReview: MatchResult[];
  noCandidate: MatchResult[];
  /** Total bank txns passed in (including already-reconciled ones). */
  total: number;
  /** Bank txns considered for matching (excluding already-reconciled). */
  considered: number;
}

// ─── Tunable Thresholds (centralized for easy review) ────────────────────────

const AMOUNT_EPSILON = 0.005;          // float-safe "exact" comparison
const ROUNDING_TOLERANCE = 1.0;        // ±₹1
const NEAR_AMOUNT_PCT = 0.02;          // ±2 %
const DATE_CLOSE_DAYS = 7;             // ±7 days = "close"
const DATE_NEAR_DAYS = 14;             // ±14 days = "near"
const NAME_STRONG_SIM = 0.7;           // strong name-similarity threshold
const NAME_VERY_STRONG_SIM = 0.85;     // very strong name-similarity threshold
const WEAK_TIER_FLOOR = 0.70;          // below this → not a candidate

const TIER_EXACT_FLOOR = 0.90;         // ≥0.90 → tier='exact'
const TIER_STRONG_FLOOR = 0.80;        // ≥0.80 → tier='strong'

// ─── Pure String Helpers (deterministic) ─────────────────────────────────────

/**
 * Normalize a name for comparison: lowercase, strip common Indian corporate
 * suffixes (Pvt / Ltd / LLP / Inc / Co / Sons / Brothers), strip punctuation,
 * collapse whitespace.
 */
function normalizeName(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/\b(pvt|private|ltd|limited|llp|llc|inc|corp|corporation|co|company|and|sons|brothers|enterprises|enterprise|india|indian)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Levenshtein edit distance. Pure, deterministic. Capped at 60 chars on each
 * side for performance (longer names rarely differ in the meaningful prefix).
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const aa = a.slice(0, 60);
  const bb = b.slice(0, 60);
  if (!aa.length) return bb.length;
  if (!bb.length) return aa.length;

  const matrix: number[][] = Array.from({ length: aa.length + 1 }, () =>
    new Array(bb.length + 1).fill(0),
  );
  for (let i = 0; i <= aa.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= bb.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= aa.length; i++) {
    for (let j = 1; j <= bb.length; j++) {
      const cost = aa[i - 1] === bb[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[aa.length][bb.length];
}

/** Name similarity 0..1 (1 = identical after normalization). */
function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return maxLen === 0 ? 0 : 1 - dist / maxLen;
}

// ─── Amount + Date + Reference Helpers ───────────────────────────────────────

interface AmountSignals {
  exact: boolean;
  rounding: boolean;
  near: boolean;
  diff: number;
  pct: number;
}

function amountSignals(bankAmount: number, bookAmount: number): AmountSignals {
  const diff = Math.abs(bankAmount - bookAmount);
  const pct = bookAmount > 0 ? diff / bookAmount : diff > 0 ? 1 : 0;
  return {
    exact: diff <= AMOUNT_EPSILON,
    rounding: diff > AMOUNT_EPSILON && diff <= ROUNDING_TOLERANCE,
    near: diff > ROUNDING_TOLERANCE && pct <= NEAR_AMOUNT_PCT,
    diff,
    pct,
  };
}

interface DateSignals {
  days: number;
  close: boolean;  // ≤7 days
  near: boolean;   // ≤14 days
}

function dateSignals(txnDate: string, bookDate: string): DateSignals {
  const t = parseDate(txnDate);
  const b = parseDate(bookDate);
  if (!t || !b) return { days: Number.POSITIVE_INFINITY, close: false, near: false };
  const ms = Math.abs(t.getTime() - b.getTime());
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  return {
    days,
    close: days <= DATE_CLOSE_DAYS,
    near: days <= DATE_NEAR_DAYS,
  };
}

/** Parse ISO or YYYY-MM-DD into a Date; returns null on invalid input. */
function parseDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Reference match — checks whether the bank txn's reference number or
 * description contains an invoice number / matches a payment's referenceNo.
 * Returns true on a hit. Deterministic, case-insensitive.
 */
function referenceMatch(
  txn: FirestoreBankTransaction & { id: string },
  book: BookEntry,
): boolean {
  const txnRef = (txn.referenceNo || '').trim().toUpperCase();
  const txnDesc = (txn.description || '').toUpperCase();
  const bookRef = (book.reference || '').trim().toUpperCase();

  if (!bookRef) return false;

  // 1. Bank reference number contains the invoice/book reference.
  if (txnRef && txnRef.includes(bookRef)) return true;
  // 2. Bank narration mentions the invoice/book reference.
  if (txnDesc && txnDesc.includes(bookRef)) return true;
  // 3. Bank reference exactly equals book reference (UTR ↔ UTR).
  if (txnRef && bookRef && txnRef === bookRef) return true;
  return false;
}

// ─── Counterparty extraction (from bank narration) ───────────────────────────

/**
 * Best-effort counterparty name extraction from a bank narration.
 * Indian bank narrations often look like:
 *   "NEFT/SHARMA TRADERS/INV-2025-001/UTR12345"
 *   "UPI/Payment/Rajesh Kumar/sharma.traders"
 *   "CHEQUE NO 123456 RAJESH TRADERS"
 * We pick the longest alphabetic token-sequence (skips NEFT/UPI/RTGS/INV- prefixes).
 */
function extractCounterparty(description: string): string {
  if (!description) return '';
  // Strip common payment-mode prefixes.
  const cleaned = description
    .replace(/\b(NEFT|RTGS|IMPS|UPI|CHEQUE|CHQ|DR|CR|TRF|TRANSFER|PAYMENT|PAID|RECD|RECEIVED|REF)\b/gi, ' ')
    .replace(/[^A-Za-z\s&.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  // Pick the longest token run (heuristic: counterparty is usually the longest name).
  const tokens = cleaned.split(' ').filter(Boolean);
  if (tokens.length === 0) return '';
  let best = tokens[0];
  for (const t of tokens) {
    if (t.length > best.length) best = t;
  }
  return best;
}

// ─── Book Entry Adapters ─────────────────────────────────────────────────────

/** Map a Firestore invoice to the engine's BookEntry shape. */
export function invoiceToBookEntry(
  inv: FirestoreInvoice & { id: string },
): BookEntry {
  return {
    id: inv.id,
    kind: 'invoice',
    date: inv.invoiceDate || '',
    amount: Number(inv.totalAmount) || 0,
    name: inv.buyerName || '',
    reference: inv.invoiceNumber || null,
    linkedInvoiceId: inv.id,
  };
}

/** Map a Firestore payment to the engine's BookEntry shape. */
export function paymentToBookEntry(
  p: FirestorePayment & { id: string },
): BookEntry {
  return {
    id: p.id,
    kind: 'payment',
    date: p.paymentDate || '',
    amount: Number(p.amount) || 0,
    name: p.partyName || '',
    reference: p.referenceNo || null,
    linkedInvoiceId: p.invoiceId || null,
  };
}

/** Map a Firestore expense to the engine's BookEntry shape. */
export function expenseToBookEntry(
  e: FirestoreExpense & { id: string },
): BookEntry {
  return {
    id: e.id,
    kind: 'expense',
    date: e.date || '',
    amount: Number(e.amount) || 0,
    name: e.vendor || e.description || '',
    reference: null, // expenses don't carry an invoice number
    linkedInvoiceId: null,
  };
}

// ─── Core: Score a single (txn × book) pair ──────────────────────────────────

/**
 * Score a single (bank txn × book entry) pair. Returns null if the pair
 * doesn't clear the weak-tier floor.
 *
 * The scoring is intentionally rule-based (not a weighted blend) so the
 * reasons are transparent: each tier corresponds to a specific combination
 * of signals, and the `reasons` array lists EXACTLY which signals fired.
 */
function scorePair(
  txn: FirestoreBankTransaction & { id: string },
  book: BookEntry,
): MatchCandidate | null {
  const txnAmount = Math.abs(Number(txn.amount) || 0);
  const bookAmount = book.amount;
  if (txnAmount <= 0 || bookAmount <= 0) return null;

  const amt = amountSignals(txnAmount, bookAmount);
  const dt = dateSignals(txn.date || '', book.date || '');
  const ref = referenceMatch(txn, book);
  const nameSim = book.name
    ? nameSimilarity(extractCounterparty(txn.description || ''), book.name)
    : 0;

  const reasons: string[] = [];
  let confidence = 0;
  let tier: ConfidenceTier | null = null;

  const fmtINR = (n: number) => '₹' + n.toFixed(2);
  const fmtPct = (n: number) => (n * 100).toFixed(1) + '%';

  // ── Tier 'exact' (≥0.90) — auto-match eligible ──
  if (amt.exact && ref) {
    confidence = 0.98;
    tier = 'exact';
    reasons.push(`Exact amount match (${fmtINR(txnAmount)})`);
    reasons.push('Reference number (UTR/cheque) matches book entry');
  } else if (amt.exact && dt.close) {
    confidence = 0.95;
    tier = 'exact';
    reasons.push(`Exact amount match (${fmtINR(txnAmount)})`);
    reasons.push(`Date within ${dt.days} day(s) of book entry date`);
  } else if (amt.rounding && dt.close) {
    confidence = 0.90;
    tier = 'exact';
    reasons.push(`Amount within ₹1 rounding tolerance (diff ${fmtINR(amt.diff)})`);
    reasons.push(`Date within ${dt.days} day(s) of book entry date`);
  }

  // ── Tier 'strong' (0.80–0.89) — manual review ──
  if (tier === null && amt.exact) {
    confidence = 0.85;
    tier = 'strong';
    reasons.push(`Exact amount match (${fmtINR(txnAmount)})`);
    if (Number.isFinite(dt.days)) {
      reasons.push(`Date diff ${dt.days} day(s) — outside ±${DATE_CLOSE_DAYS}-day window`);
    } else {
      reasons.push('Book entry date missing or invalid');
    }
  } else if (tier === null && ref) {
    confidence = 0.85;
    tier = 'strong';
    reasons.push('Reference number (UTR/cheque) matches book entry');
    if (amt.diff > AMOUNT_EPSILON) {
      reasons.push(`Amount differs by ${fmtINR(amt.diff)} — needs verification`);
    }
  } else if (tier === null && amt.rounding && dt.near) {
    confidence = 0.80;
    tier = 'strong';
    reasons.push(`Amount within ₹1 rounding tolerance (diff ${fmtINR(amt.diff)})`);
    reasons.push(`Date within ${dt.days} day(s) — close but beyond ±${DATE_CLOSE_DAYS}-day window`);
  }

  // ── Tier 'weak' (0.70–0.79) — manual review ──
  if (tier === null && amt.near && nameSim >= NAME_STRONG_SIM && dt.near) {
    confidence = 0.75;
    tier = 'weak';
    reasons.push(`Amount within 2% (diff ${fmtINR(amt.diff)}, ${fmtPct(amt.pct)})`);
    reasons.push(`Vendor/party name similarity: ${fmtPct(nameSim)}`);
    reasons.push(`Date within ${dt.days} day(s)`);
  } else if (tier === null && amt.near && nameSim >= NAME_VERY_STRONG_SIM) {
    confidence = 0.72;
    tier = 'weak';
    reasons.push(`Amount within 2% (diff ${fmtINR(amt.diff)}, ${fmtPct(amt.pct)})`);
    reasons.push(`Strong vendor/party name match: ${fmtPct(nameSim)}`);
  }

  if (tier === null || confidence < WEAK_TIER_FLOOR) return null;

  return { book, confidence, tier, reasons };
}

// ─── Disambiguation ──────────────────────────────────────────────────────────

/**
 * Find all book entries that match a single bank txn at tier='exact'.
 * Returns the candidates sorted by confidence desc.
 */
function topCandidatesForTxn(
  txn: FirestoreBankTransaction & { id: string },
  books: BookEntry[],
): MatchCandidate[] {
  const candidates: MatchCandidate[] = [];
  for (const book of books) {
    const c = scorePair(txn, book);
    if (c) candidates.push(c);
  }
  // Deterministic sort: confidence desc, then book.id asc (tiebreaker).
  candidates.sort((a, b) =>
    b.confidence !== a.confidence
      ? b.confidence - a.confidence
      : a.book.id.localeCompare(b.book.id),
  );
  return candidates;
}

/**
 * Build a map of bookEntryId → list of bank txns that match it at tier='exact'.
 * Used to detect the "1 invoice, 2 txns" ambiguity.
 */
function buildExactBookUsageMap(
  results: MatchResult[],
): Map<string, Array<{ txnId: string; confidence: number }>> {
  const map = new Map<string, Array<{ txnId: string; confidence: number }>>();
  for (const r of results) {
    for (const c of r.candidates) {
      if (c.tier === 'exact') {
        const list = map.get(c.book.id) ?? [];
        list.push({ txnId: r.txn.id, confidence: c.confidence });
        map.set(c.book.id, list);
      }
    }
  }
  return map;
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Run the auto-reconciliation engine.
 *
 * @param bankTxns   Bank transactions (already-reconciled ones are skipped).
 * @param invoices   All firm invoices (sales + purchase).
 * @param payments   All firm payments (customer + vendor).
 * @param expenses   All firm expenses.
 * @returns          AutoReconcileResult with auto-matched / needs-review /
 *                   no-candidate buckets. Each result carries full reasons.
 *
 * Pure + deterministic: same inputs → same outputs, always. Safe to call from
 * client or server.
 */
export function autoReconcile(
  bankTxns: Array<FirestoreBankTransaction & { id: string }>,
  invoices: Array<FirestoreInvoice & { id: string }>,
  payments: Array<FirestorePayment & { id: string }>,
  expenses: Array<FirestoreExpense & { id: string }>,
): AutoReconcileResult {
  // Build the book-entry pool (one combined list, since the engine is
  // source-agnostic — invoice / payment / expense all map to BookEntry).
  const books: BookEntry[] = [
    ...invoices.map(invoiceToBookEntry),
    ...payments.map(paymentToBookEntry),
    ...expenses.map(expenseToBookEntry),
  ];

  // Skip bank txns already reconciled — they're done.
  const considered = bankTxns.filter((t) => !t.reconciled);

  // Score each (txn × book) pair, collect candidates per txn.
  const results: MatchResult[] = considered.map((txn) => {
    const candidates = topCandidatesForTxn(txn, books);
    const bestMatch = candidates.length > 0 ? candidates[0] : null;
    return {
      txn,
      candidates,
      bestMatch,
      autoMatch: false,       // resolved in disambiguation pass below
      needsReview: false,
      noCandidate: candidates.length === 0,
    };
  });

  // Disambiguation pass:
  //   - A txn is auto-match eligible IFF its best candidate is tier='exact'
  //     AND no other candidate for the same txn is tier='exact' (no ambiguity)
  //     AND no other txn matches the same book entry at tier='exact'.
  const bookUsage = buildExactBookUsageMap(results);

  for (const r of results) {
    if (r.noCandidate) continue;
    const exactCandidates = r.candidates.filter((c) => c.tier === 'exact');
    const best = r.bestMatch;

    if (best && best.tier === 'exact' && exactCandidates.length === 1) {
      // Check the reverse direction: is this book entry matched by another txn?
      const usage = bookUsage.get(best.book.id) ?? [];
      const uniqueTxn = usage.length === 1 && usage[0].txnId === r.txn.id;
      if (uniqueTxn) {
        r.autoMatch = true;
      } else {
        r.needsReview = true; // 2+ txns claim the same book entry
      }
    } else if (exactCandidates.length > 1) {
      r.needsReview = true; // 2+ book entries claim the same txn
    } else if (best && (best.tier === 'strong' || best.tier === 'weak')) {
      r.needsReview = true; // single candidate but not auto-match eligible
    }
  }

  const autoMatched = results.filter((r) => r.autoMatch);
  const needsReview = results.filter((r) => r.needsReview);
  const noCandidate = results.filter((r) => r.noCandidate);

  return {
    results,
    autoMatched,
    needsReview,
    noCandidate,
    total: bankTxns.length,
    considered: considered.length,
  };
}

// ─── Convenience: format a summary string for the UI ─────────────────────────

/**
 * Build a human-readable summary string for the auto-reconcile run.
 * Used by the BankingPage toast notification.
 */
export function formatAutoReconcileSummary(result: AutoReconcileResult): string {
  const auto = result.autoMatched.length;
  const review = result.needsReview.length;
  const noMatch = result.noCandidate.length;
  if (auto === 0 && review === 0 && noMatch === 0) {
    return 'No unreconciled bank transactions to process.';
  }
  const parts: string[] = [];
  parts.push(`${auto} auto-matched`);
  parts.push(`${review} need manual review`);
  if (noMatch > 0) parts.push(`${noMatch} no match found`);
  return parts.join(' · ') + '.';
}
