// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — GST Reconciliation Match Engine v2
// ═══════════════════════════════════════════════════════════════════════════════
//
// Smart Match Engine v2 — Weighted Confidence Scoring
//
// Instead of binary matched/unmatched, every comparison now produces a 0-100
// confidence score across 8 dimensions:
//
//   • GSTIN match          (weight: 25) — exact / normalized / mismatch
//   • Invoice # similarity (weight: 20) — Levenshtein-based fuzzy match
//   • Invoice date diff    (weight: 15) — 0 days = 1.0, decays to 0 at 30+ days
//   • Taxable value diff   (weight: 15) — within ₹1 = 1.0, decays with delta
//   • CGST tolerance       (weight:  6)
//   • SGST tolerance       (weight:  6)
//   • IGST tolerance       (weight:  6)
//   • CESS tolerance       (weight:  7)
//
// Final confidence = Σ (score × weight) / Σ weights
//
// Classifications remain the same 8-way system, but now they carry a real
// confidence number that drives UI color (green ≥85%, yellow 60-84%, red <60%).
//
// This module is PURE — no Prisma, no Firebase, no side effects.
// ═══════════════════════════════════════════════════════════════════════════════

import type { GSTR2BRecord } from './types';

// ─── Types ───────────────────────────────────────────────────────────────────

/** A purchase invoice from Books (GSTpilot or Zoho). Normalized shape. */
export interface BooksInvoice {
  id: string;
  invoiceNo: string;
  invoiceDate?: string;
  supplierGSTIN: string;
  supplierName?: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  total: number;
}

export type MatchStatus =
  | 'perfect_match'
  | 'value_mismatch'
  | 'tax_mismatch'
  | 'date_mismatch'
  | 'gstin_mismatch'
  | 'missing_in_books'
  | 'missing_in_gstr2b'
  | 'duplicate';

export interface MismatchField {
  field: string;
  booksValue?: string | number;
  gstr2bValue?: string | number;
  delta?: number;
}

/**
 * Per-field confidence breakdown (0-1 each).
 * Drives the confidence bars + AI explanations.
 */
export interface ScoreBreakdown {
  gstin: number;
  invoiceNo: number;
  date: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
}

export interface MatchResult {
  booksInvoice: BooksInvoice | null;
  gstr2bRecord: GSTR2BRecord | null;
  status: MatchStatus;
  /** 0-1 weighted confidence (v2). */
  confidence: number;
  /** Per-field 0-1 scores (v2). */
  scoreBreakdown: ScoreBreakdown;
  mismatchReasons: MismatchField[];
  /** ITC at risk if this invoice is not reconciled. */
  itcAtRisk: number;
}

export interface ReconciliationSummary {
  totalBooks: number;
  total2B: number;
  matched: number;
  unmatched: number;
  missingInBooks: number;
  missingIn2B: number;
  duplicates: number;
  matchPercent: number;
  potentialITCLoss: number;
  totalTaxableValue: number;
  totalMatchedTax: number;
  byStatus: Record<MatchStatus, number>;
  /** v2 — confidence distribution */
  confidenceBuckets: { high: number; medium: number; low: number };
  /** v2 — average confidence across matched pairs */
  avgConfidence: number;
}

// ─── Weights ─────────────────────────────────────────────────────────────────

const WEIGHTS = {
  gstin: 25,
  invoiceNo: 20,
  date: 15,
  taxable: 15,
  cgst: 6,
  sgst: 6,
  igst: 6,
  cess: 7,
} as const;

const TOTAL_WEIGHT =
  WEIGHTS.gstin + WEIGHTS.invoiceNo + WEIGHTS.date + WEIGHTS.taxable +
  WEIGHTS.cgst + WEIGHTS.sgst + WEIGHTS.igst + WEIGHTS.cess; // = 100

// ─── Normalization + Fuzzy helpers ────────────────────────────────────────────

export function normalizeInvoiceNo(raw: string): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/** Levenshtein distance (iterative DP, O(m*n)). */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * Fuzzy invoice-number similarity — returns 0-1.
 * 1.00 = exact match
 * 0.97 = normalized match (punctuation differs)
 * 0.85+ = 1-char typo
 * <0.70 = different invoice
 */
export function fuzzyInvoiceMatch(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const na = normalizeInvoiceNo(a);
  const nb = normalizeInvoiceNo(b);
  if (na === nb) return 0.97;
  if (!na || !nb) return 0;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 0;
  const similarity = 1 - dist / maxLen;
  return similarity;
}

/** GSTIN similarity — 1.0 if identical, 0.5 if same PAN (chars 2-7) but different state+entity, 0 otherwise. */
function gstinSimilarity(a: string, b: string): number {
  const na = normalizeGSTIN(a);
  const nb = normalizeGSTIN(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  // Same PAN (chars 2-7) — different branch of the same legal entity
  if (na.length >= 7 && nb.length >= 7 && na.slice(2, 7) === nb.slice(2, 7)) {
    return 0.5;
  }
  return 0;
}

/** Date similarity — 1.0 if same day, decays linearly to 0 at 30+ day gap. */
function dateSimilarity(a?: string, b?: string): number {
  const da = normalizeDate(a);
  const db = normalizeDate(b);
  if (!da || !db) return 0;
  if (da === db) return 1;
  try {
    const diffDays = Math.abs(
      Math.round((new Date(da).getTime() - new Date(db).getTime()) / 86400000),
    );
    if (diffDays <= 0) return 1;
    if (diffDays >= 30) return 0;
    return 1 - diffDays / 30;
  } catch {
    return 0;
  }
}

/**
 * Value similarity — 1.0 if equal (within ₹1), decays based on % difference.
 * For small amounts (₹1000), allow 1% tolerance. For large amounts (₹10L), allow 0.1%.
 */
function valueSimilarity(a: number, b: number): number {
  if (a === b) return 1;
  const delta = Math.abs(a - b);
  if (delta <= 1) return 1; // ₹1 rounding tolerance
  const maxVal = Math.max(Math.abs(a), Math.abs(b), 1);
  const pct = delta / maxVal;
  // 1% diff = 0.7, 5% diff = 0.3, 10%+ diff = 0
  if (pct >= 0.1) return 0;
  return Math.max(0, 1 - pct * 7);
}

/** Parse a date string (YYYY-MM-DD or ISO) to YYYY-MM-DD. */
function normalizeDate(d?: string): string {
  if (!d) return '';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    return dt.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

/** GSTIN normalization — case-insensitive, no whitespace. */
function normalizeGSTIN(g?: string): string {
  if (!g) return '';
  return g.toUpperCase().replace(/\s+/g, '').trim();
}

/** Round to 2 decimals. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Duplicate detection ─────────────────────────────────────────────────────

function findDuplicates(
  items: Array<{ invoiceNo: string; supplierGSTIN: string }>,
): Set<string> {
  const seen = new Map<string, number>();
  const dupes = new Set<string>();
  for (const it of items) {
    const key = `${normalizeGSTIN(it.supplierGSTIN)}|${normalizeInvoiceNo(it.invoiceNo)}`;
    const count = (seen.get(key) || 0) + 1;
    seen.set(key, count);
    if (count >= 2) dupes.add(key);
  }
  return dupes;
}

// ─── Empty breakdown (used for unmatched records) ────────────────────────────

const EMPTY_BREAKDOWN: ScoreBreakdown = {
  gstin: 0, invoiceNo: 0, date: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0,
};

// ─── Core compare function (v2 — weighted scoring) ───────────────────────────

function comparePair(book: BooksInvoice, rec: GSTR2BRecord): MatchResult {
  const mismatchReasons: MismatchField[] = [];
  let status: MatchStatus = 'perfect_match';

  // ── Per-field scores (0-1) ──
  const gstinScore = gstinSimilarity(book.supplierGSTIN, rec.supplierGSTIN);
  const invoiceScore = fuzzyInvoiceMatch(book.invoiceNo, rec.invoiceNo);
  const dateScore = dateSimilarity(book.invoiceDate, rec.invoiceDate);
  const taxableScore = valueSimilarity(book.taxableValue, rec.taxableValue);
  const cgstScore = valueSimilarity(book.cgst, rec.cgst);
  const sgstScore = valueSimilarity(book.sgst, rec.sgst);
  const igstScore = valueSimilarity(book.igst, rec.igst);
  const cessScore = valueSimilarity(book.cess, rec.cess);

  // ── Build mismatch reasons for each field that doesn't match ──
  if (gstinScore < 1) {
    mismatchReasons.push({
      field: 'supplierGSTIN',
      booksValue: book.supplierGSTIN,
      gstr2bValue: rec.supplierGSTIN,
    });
  }
  if (invoiceScore < 0.95) {
    mismatchReasons.push({
      field: 'invoiceNo',
      booksValue: book.invoiceNo,
      gstr2bValue: rec.invoiceNo,
    });
  }
  if (dateScore < 1) {
    mismatchReasons.push({
      field: 'invoiceDate',
      booksValue: book.invoiceDate,
      gstr2bValue: rec.invoiceDate,
    });
  }
  if (taxableScore < 1) {
    mismatchReasons.push({
      field: 'taxableValue',
      booksValue: book.taxableValue,
      gstr2bValue: rec.taxableValue,
      delta: round2(book.taxableValue - rec.taxableValue),
    });
  }
  const taxFields: Array<{ field: string; score: number; book: number; rec: number }> = [
    { field: 'cgst', score: cgstScore, book: book.cgst, rec: rec.cgst },
    { field: 'sgst', score: sgstScore, book: book.sgst, rec: rec.sgst },
    { field: 'igst', score: igstScore, book: book.igst, rec: rec.igst },
    { field: 'cess', score: cessScore, book: book.cess, rec: rec.cess },
  ];
  for (const t of taxFields) {
    if (t.score < 1) {
      mismatchReasons.push({
        field: t.field,
        booksValue: t.book,
        gstr2bValue: t.rec,
        delta: round2(t.book - t.rec),
      });
    }
  }

  // ── Classification (priority order matters) ──
  // 1. GSTIN mismatch is the most serious — different supplier entirely
  if (gstinScore < 0.5 && invoiceScore >= 0.85) {
    status = 'gstin_mismatch';
  } else if (mismatchReasons.some((m) => ['cgst', 'sgst', 'igst', 'cess'].includes(m.field))) {
    status = 'tax_mismatch';
  } else if (mismatchReasons.some((m) => m.field === 'taxableValue')) {
    status = 'value_mismatch';
  } else if (mismatchReasons.some((m) => m.field === 'invoiceDate')) {
    status = 'date_mismatch';
  } else if (gstinScore < 1) {
    status = 'gstin_mismatch';
  } else {
    status = 'perfect_match';
  }

  // ── Weighted confidence ──
  const confidence =
    (gstinScore * WEIGHTS.gstin +
      invoiceScore * WEIGHTS.invoiceNo +
      dateScore * WEIGHTS.date +
      taxableScore * WEIGHTS.taxable +
      cgstScore * WEIGHTS.cgst +
      sgstScore * WEIGHTS.sgst +
      igstScore * WEIGHTS.igst +
      cessScore * WEIGHTS.cess) / TOTAL_WEIGHT;

  // ── ITC at risk ──
  const itcAtRisk =
    status === 'perfect_match'
      ? 0
      : round2(book.cgst + book.sgst + book.igst + book.cess);

  return {
    booksInvoice: book,
    gstr2bRecord: rec,
    status,
    confidence: round2(confidence),
    scoreBreakdown: {
      gstin: round2(gstinScore),
      invoiceNo: round2(invoiceScore),
      date: round2(dateScore),
      taxable: round2(taxableScore),
      cgst: round2(cgstScore),
      sgst: round2(sgstScore),
      igst: round2(igstScore),
      cess: round2(cessScore),
    },
    mismatchReasons,
    itcAtRisk,
  };
}

// ─── Main reconciliation function ────────────────────────────────────────────

/**
 * Reconcile Books invoices against GSTR-2B records (v2 — weighted scoring).
 *
 * Algorithm:
 *   1. Detect duplicates on each side.
 *   2. For each Books invoice, find the best-matching GSTR-2B record (highest
 *      weighted confidence among candidates with same/related GSTIN + invoice
 *      number similarity ≥ 0.85).
 *   3. Compare each matched pair with weighted scoring.
 *   4. Anything unmatched on Books side → missing_in_gstr2b.
 *   5. Anything unmatched on GSTR-2B side → missing_in_books.
 *   6. Duplicates are flagged.
 *
 * Returns the full list of match results + a summary.
 */
export function reconcile(
  books: BooksInvoice[],
  gstr2b: GSTR2BRecord[],
): { results: MatchResult[]; summary: ReconciliationSummary } {
  const results: MatchResult[] = [];

  // ── Duplicate detection ──
  const bookDupes = findDuplicates(books);
  const gstr2bDupes = findDuplicates(gstr2b);

  // ── Build GSTR-2B lookup: supplierGSTIN → records ──
  const gstr2bByGstin = new Map<string, GSTR2BRecord[]>();
  for (const rec of gstr2b) {
    const g = normalizeGSTIN(rec.supplierGSTIN);
    if (!gstr2bByGstin.has(g)) gstr2bByGstin.set(g, []);
    gstr2bByGstin.get(g)!.push(rec);
  }

  // Track which GSTR-2B records were matched
  const matchedGstr2bIds = new Set<string>();

  // ── Match each Books invoice ──
  for (const book of books) {
    const bookKey = `${normalizeGSTIN(book.supplierGSTIN)}|${normalizeInvoiceNo(book.invoiceNo)}`;
    const isDuplicate = bookDupes.has(bookKey);

    const candidates = gstr2bByGstin.get(normalizeGSTIN(book.supplierGSTIN)) || [];

    // Find the best candidate by weighted confidence (v2 — no longer just invoice # fuzzy)
    let best: { rec: GSTR2BRecord; conf: number } | null = null;
    for (const rec of candidates) {
      const recKey = `${normalizeGSTIN(rec.supplierGSTIN)}|${normalizeInvoiceNo(rec.invoiceNo)}`;
      if (matchedGstr2bIds.has(recKey) && !gstr2bDupes.has(recKey)) continue;

      // Quick pre-filter: invoice number similarity must clear 0.70 to be a candidate
      const invSim = fuzzyInvoiceMatch(book.invoiceNo, rec.invoiceNo);
      if (invSim < 0.70) continue;

      // Compute full weighted confidence for ranking
      const gstinScore = gstinSimilarity(book.supplierGSTIN, rec.supplierGSTIN);
      const dateScore = dateSimilarity(book.invoiceDate, rec.invoiceDate);
      const taxableScore = valueSimilarity(book.taxableValue, rec.taxableValue);
      const cgstScore = valueSimilarity(book.cgst, rec.cgst);
      const sgstScore = valueSimilarity(book.sgst, rec.sgst);
      const igstScore = valueSimilarity(book.igst, rec.igst);
      const cessScore = valueSimilarity(book.cess, rec.cess);

      const conf =
        (gstinScore * WEIGHTS.gstin +
          invSim * WEIGHTS.invoiceNo +
          dateScore * WEIGHTS.date +
          taxableScore * WEIGHTS.taxable +
          cgstScore * WEIGHTS.cgst +
          sgstScore * WEIGHTS.sgst +
          igstScore * WEIGHTS.igst +
          cessScore * WEIGHTS.cess) / TOTAL_WEIGHT;

      if (conf >= 0.55 && (!best || conf > best.conf)) {
        best = { rec, conf };
      }
    }

    if (best) {
      const recKey = `${normalizeGSTIN(best.rec.supplierGSTIN)}|${normalizeInvoiceNo(best.rec.invoiceNo)}`;
      matchedGstr2bIds.add(recKey);

      const result = comparePair(book, best.rec);

      // If it's a duplicate, override status
      if (isDuplicate || gstr2bDupes.has(recKey)) {
        result.status = 'duplicate';
        result.itcAtRisk = 0; // duplicate ITC isn't lost, just at risk of double-claim
      }

      results.push(result);
    } else {
      // No GSTR-2B match — missing in GSTR-2B
      const itcAtRisk = isDuplicate
        ? 0
        : round2(book.cgst + book.sgst + book.igst + book.cess);
      results.push({
        booksInvoice: book,
        gstr2bRecord: null,
        status: isDuplicate ? 'duplicate' : 'missing_in_gstr2b',
        confidence: 0,
        scoreBreakdown: EMPTY_BREAKDOWN,
        mismatchReasons: [],
        itcAtRisk,
      });
    }
  }

  // ── Add missing-in-books records (GSTR-2B side) ──
  for (const rec of gstr2b) {
    const recKey = `${normalizeGSTIN(rec.supplierGSTIN)}|${normalizeInvoiceNo(rec.invoiceNo)}`;
    if (matchedGstr2bIds.has(recKey) && !gstr2bDupes.has(recKey)) continue;

    const isDuplicate = gstr2bDupes.has(recKey);
    results.push({
      booksInvoice: null,
      gstr2bRecord: rec,
      status: isDuplicate ? 'duplicate' : 'missing_in_books',
      confidence: 0,
      scoreBreakdown: EMPTY_BREAKDOWN,
      mismatchReasons: isDuplicate
        ? []
        : [{
            field: 'invoiceNo',
            gstr2bValue: rec.invoiceNo,
          }],
      itcAtRisk: isDuplicate ? 0 : rec.itcAvailable,
    });
  }

  // ── Summary ──
  const summary = buildSummary(books, gstr2b, results);

  return { results, summary };
}

// ─── Summary builder ─────────────────────────────────────────────────────────

function buildSummary(
  books: BooksInvoice[],
  gstr2b: GSTR2BRecord[],
  results: MatchResult[],
): ReconciliationSummary {
  const byStatus: Record<MatchStatus, number> = {
    perfect_match: 0,
    value_mismatch: 0,
    tax_mismatch: 0,
    date_mismatch: 0,
    gstin_mismatch: 0,
    missing_in_books: 0,
    missing_in_gstr2b: 0,
    duplicate: 0,
  };

  let potentialITCLoss = 0;
  let totalTaxableValue = 0;
  let totalMatchedTax = 0;
  let confidenceSum = 0;
  let confidenceCount = 0;
  let high = 0; // ≥0.85
  let medium = 0; // 0.60 - 0.84
  let low = 0; // < 0.60

  for (const r of results) {
    byStatus[r.status]++;
    if (r.itcAtRisk > 0) potentialITCLoss += r.itcAtRisk;
    if (r.booksInvoice) totalTaxableValue += r.booksInvoice.taxableValue;
    if (r.status === 'perfect_match' && r.booksInvoice) {
      totalMatchedTax +=
        r.booksInvoice.cgst + r.booksInvoice.sgst + r.booksInvoice.igst + r.booksInvoice.cess;
    }
    // Only count confidence for matched pairs (not missing/duplicate placeholders)
    if (r.status !== 'missing_in_books' && r.status !== 'missing_in_gstr2b' && r.status !== 'duplicate') {
      confidenceSum += r.confidence;
      confidenceCount++;
      if (r.confidence >= 0.85) high++;
      else if (r.confidence >= 0.6) medium++;
      else low++;
    }
  }

  const matched = byStatus.perfect_match;
  const unmatched =
    byStatus.value_mismatch +
    byStatus.tax_mismatch +
    byStatus.date_mismatch +
    byStatus.gstin_mismatch;
  const missingInBooks = byStatus.missing_in_books;
  const missingIn2B = byStatus.missing_in_gstr2b;
  const duplicates = byStatus.duplicate;

  const totalConsidered = matched + unmatched + missingInBooks + missingIn2B + duplicates;
  const matchPercent = totalConsidered > 0 ? (matched / totalConsidered) * 100 : 0;
  const avgConfidence = confidenceCount > 0 ? confidenceSum / confidenceCount : 0;

  return {
    totalBooks: books.length,
    total2B: gstr2b.length,
    matched,
    unmatched,
    missingInBooks,
    missingIn2B,
    duplicates,
    matchPercent: round2(matchPercent),
    potentialITCLoss: round2(potentialITCLoss),
    totalTaxableValue: round2(totalTaxableValue),
    totalMatchedTax: round2(totalMatchedTax),
    byStatus,
    confidenceBuckets: { high, medium, low },
    avgConfidence: round2(avgConfidence),
  };
}
