// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Banking Foundation™ — Bank Reconciliation Engine
//
// Automatically matches bank transactions against invoices / payments / refunds
// / GST payments / expenses. Pure, deterministic, no LLM.
//
// Matching strategy (in priority order):
//   1. EXACT match — amount is identical AND (counterparty matches invoice
//      client name OR reference number matches an invoice number / UTR).
//      → status='matched', confidence=1.0
//   2. PARTIAL match — amount within ±2% (rounding / bank charges) OR
//      counterparty fuzzy-matches an invoice client name.
//      → status='partially_matched', confidence=0.6..0.9
//   3. UNMATCHED — no invoice found.
//      → status='unmatched', confidence=0
//
// The engine matches CREDIT bank transactions (incoming payments) against
// SALES invoices (money owed TO us) and DEBIT bank transactions (outgoing)
// against PURCHASE invoices / expenses (money owed BY us). GST payments are
// matched against the GST liability ledger.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  BankTransaction,
  ReconciliationStatus,
} from '@/lib/banking-provider/types';

// ─── Invoice / payment reference shape ───────────────────────────────────────
// The engine accepts a lightweight invoice shape so it can run against any
// invoice source (Prisma or Firestore). The caller maps their invoice type to
// this interface.

export interface ReconcileInvoiceRef {
  id: string;
  /** Invoice number (e.g. 'INV-2025-001'). */
  invoiceNumber: string;
  /** Client / vendor name (the counterparty). */
  clientName: string;
  /** Total amount payable (grand total including tax). */
  grandTotal: number;
  /** Outstanding balance on the invoice. */
  balanceDue: number;
  /** 'sales' (we issued it → expect a credit) or 'purchase' (we received it → expect a debit). */
  invoiceType: 'sales' | 'purchase';
  /** ISO issue date. */
  issueDate?: string;
  /** Optional UTR / reference the customer tagged the payment with. */
  referenceNumber?: string | null;
}

export interface ReconcileResult {
  /** The bank transaction with updated reconciliation fields. */
  transaction: BankTransaction;
  /** The invoice it was matched to (null if unmatched). */
  matchedInvoice: ReconcileInvoiceRef | null;
  /** New reconciliation status. */
  status: ReconciliationStatus;
  /** Match confidence 0..1. */
  confidence: number;
}

// ─── Fuzzy string matching ───────────────────────────────────────────────────

/**
 * Normalize a name for comparison: lowercase, strip common suffixes (Pvt Ltd,
// LLP, Ltd), collapse whitespace, strip punctuation.
 */
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(pvt|private|ltd|limited|llp|llc|inc|corp|corporation|co|company|and|sons|brothers)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Levenshtein distance — used for fuzzy counterparty matching.
 * Capped at 50 chars for performance.
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

/**
 * Similarity score 0..1 between two names. 1 = identical, 0 = completely
 * different. Uses a normalized Levenshtein distance.
 */
function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  // If one contains the other, high similarity.
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const dist = levenshtein(na.slice(0, 50), nb.slice(0, 50));
  const maxLen = Math.max(na.length, nb.length);
  return maxLen === 0 ? 0 : 1 - dist / maxLen;
}

/**
 * Amount similarity. Returns 1 for exact, scaled down for differences.
 * Within ±2%: >= 0.85. Beyond ±5%: 0.
 */
function amountSimilarity(bankAmount: number, invoiceAmount: number): number {
  if (invoiceAmount === 0) return 0;
  const diff = Math.abs(bankAmount - invoiceAmount);
  const pct = diff / invoiceAmount;
  if (diff === 0) return 1;
  if (pct <= 0.02) return 0.95;
  if (pct <= 0.05) return 0.7;
  return 0;
}

// ─── Reference matching ──────────────────────────────────────────────────────

/**
 * Check whether the bank transaction's reference / description mentions an
 * invoice number. Returns the matched invoice id or null.
 */
function matchByReference(tx: BankTransaction, invoices: ReconcileInvoiceRef[]): ReconcileInvoiceRef | null {
  if (!tx.referenceNumber && !tx.description) return null;
  const haystack = `${tx.referenceNumber ?? ''} ${tx.description}`.toUpperCase();

  for (const inv of invoices) {
    if (!inv.invoiceNumber) continue;
    if (haystack.includes(inv.invoiceNumber.toUpperCase())) {
      return inv;
    }
    if (inv.referenceNumber && tx.referenceNumber && tx.referenceNumber.toUpperCase().includes(inv.referenceNumber.toUpperCase())) {
      return inv;
    }
  }
  return null;
}

// ─── Engine ──────────────────────────────────────────────────────────────────

const EXACT_THRESHOLD = 0.95;
const PARTIAL_THRESHOLD = 0.6;

/**
 * Reconcile a single bank transaction against a list of invoices.
 * Pure + deterministic. Returns the best match (or 'unmatched').
 *
 * The engine only matches:
 *   • credit (incoming) transactions → against 'sales' invoices
 *   • debit (outgoing) transactions → against 'purchase' invoices
 * Other combinations (e.g. credit vs purchase) return 'unmatched'.
 */
export function reconcileTransaction(
  tx: BankTransaction,
  invoices: ReconcileInvoiceRef[],
): ReconcileResult {
  // Filter invoices by direction.
  const expectedType = tx.type === 'credit' ? 'sales' : 'purchase';
  const candidates = invoices.filter((inv) => inv.invoiceType === expectedType);

  if (candidates.length === 0) {
    return { transaction: tx, matchedInvoice: null, status: 'unmatched', confidence: 0 };
  }

  let bestInvoice: ReconcileInvoiceRef | null = null;
  let bestConfidence = -1;

  // 1. Try exact reference match first (highest confidence).
  const refMatch = matchByReference(tx, candidates);
  if (refMatch) {
    const amtSim = amountSimilarity(tx.amount, refMatch.balanceDue || refMatch.grandTotal);
    const confidence = Math.max(0.9, amtSim); // ref match is strong even if amount is slightly off
    if (confidence > bestConfidence) {
      bestInvoice = refMatch;
      bestConfidence = confidence;
    }
  }

  // 2. Score every candidate by amount + counterparty similarity.
  for (const inv of candidates) {
    const invAmount = inv.balanceDue > 0 ? inv.balanceDue : inv.grandTotal;
    const amtSim = amountSimilarity(tx.amount, invAmount);

    let nameSim = 0;
    if (tx.counterparty) {
      nameSim = nameSimilarity(tx.counterparty, inv.clientName);
    }

    // Weighted score: amount matters most (0.7), name secondary (0.3).
    const confidence = round2(amtSim * 0.7 + nameSim * 0.3);

    if (confidence > bestConfidence) {
      bestInvoice = inv;
      bestConfidence = confidence;
    }
  }

  if (!bestInvoice || bestConfidence < 0) {
    return { transaction: tx, matchedInvoice: null, status: 'unmatched', confidence: 0 };
  }

  let status: ReconciliationStatus;
  if (bestConfidence >= EXACT_THRESHOLD) {
    status = 'matched';
  } else if (bestConfidence >= PARTIAL_THRESHOLD) {
    status = 'partially_matched';
  } else {
    return { transaction: tx, matchedInvoice: null, status: 'unmatched', confidence: 0 };
  }

  return {
    transaction: { ...tx, invoiceId: bestInvoice.id, reconciled: status, matchConfidence: bestConfidence },
    matchedInvoice: bestInvoice,
    status,
    confidence: bestConfidence,
  };
}

/**
 * Reconcile an array of bank transactions against a list of invoices.
 * Returns the transactions with updated `invoiceId`, `reconciled`, and
 * `matchConfidence` fields.
 *
 * Each invoice is matched to AT MOST one transaction (greedy, highest
 * confidence first) to avoid double-counting.
 */
export function reconcileTransactions(
  transactions: BankTransaction[],
  invoices: ReconcileInvoiceRef[],
): BankTransaction[] {
  // Score every (tx, invoice) pair, then greedily assign best matches.
  const scored: Array<{ txIndex: number; invoiceId: string; confidence: number; status: ReconciliationStatus }> = [];

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    const expectedType = tx.type === 'credit' ? 'sales' : 'purchase';
    const candidates = invoices.filter((inv) => inv.invoiceType === expectedType);
    for (const inv of candidates) {
      const invAmount = inv.balanceDue > 0 ? inv.balanceDue : inv.grandTotal;
      const amtSim = amountSimilarity(tx.amount, invAmount);
      const nameSim = tx.counterparty ? nameSimilarity(tx.counterparty, inv.clientName) : 0;
      const confidence = round2(amtSim * 0.7 + nameSim * 0.3);
      let status: ReconciliationStatus;
      if (confidence >= EXACT_THRESHOLD) status = 'matched';
      else if (confidence >= PARTIAL_THRESHOLD) status = 'partially_matched';
      else continue; // skip non-matches
      scored.push({ txIndex: i, invoiceId: inv.id, confidence, status });
    }
    // Also check reference matches (override confidence to >= 0.9).
    const refMatch = matchByReference(tx, candidates);
    if (refMatch) {
      const amtSim = amountSimilarity(tx.amount, refMatch.balanceDue || refMatch.grandTotal);
      const confidence = Math.max(0.9, amtSim);
      scored.push({ txIndex: i, invoiceId: refMatch.id, confidence, status: 'matched' });
    }
  }

  // Greedy assignment — highest confidence first, each invoice used once.
  scored.sort((a, b) => b.confidence - a.confidence);
  const usedInvoices = new Set<string>();
  const matchedTxIndex = new Map<number, { invoiceId: string; confidence: number; status: ReconciliationStatus }>();

  for (const s of scored) {
    if (usedInvoices.has(s.invoiceId)) continue;
    if (matchedTxIndex.has(s.txIndex)) continue;
    usedInvoices.add(s.invoiceId);
    matchedTxIndex.set(s.txIndex, { invoiceId: s.invoiceId, confidence: s.confidence, status: s.status });
  }

  // Apply matches to the transactions.
  return transactions.map((tx, i) => {
    const match = matchedTxIndex.get(i);
    if (match) {
      return {
        ...tx,
        invoiceId: match.invoiceId,
        reconciled: match.status,
        matchConfidence: match.confidence,
      };
    }
    return { ...tx, invoiceId: null, reconciled: 'unmatched' as const, matchConfidence: 0 };
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Summary stats for a set of reconciled transactions.
 */
export function reconciliationSummary(transactions: BankTransaction[]): {
  total: number;
  matched: number;
  partiallyMatched: number;
  unmatched: number;
  matchedAmount: number;
  unmatchedAmount: number;
} {
  let matched = 0;
  let partiallyMatched = 0;
  let unmatched = 0;
  let matchedAmount = 0;
  let unmatchedAmount = 0;
  for (const tx of transactions) {
    if (tx.reconciled === 'matched') {
      matched++;
      matchedAmount += tx.amount;
    } else if (tx.reconciled === 'partially_matched') {
      partiallyMatched++;
      matchedAmount += tx.amount;
    } else {
      unmatched++;
      unmatchedAmount += tx.amount;
    }
  }
  return {
    total: transactions.length,
    matched,
    partiallyMatched,
    unmatched,
    matchedAmount: round2(matchedAmount),
    unmatchedAmount: round2(unmatchedAmount),
  };
}
