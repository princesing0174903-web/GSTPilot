// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — GST Reconciliation Match Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// Pure functions that compare purchase invoices (from Books) against GSTR-2B
// records (from a GSP). Classifies every record into one of:
//
//   • perfect_match      — GSTIN + invoice no + date + all values match
//   • value_mismatch     — GSTIN + invoice no match, taxable value differs
//   • tax_mismatch       — GSTIN + invoice no match, tax components differ
//   • date_mismatch      — GSTIN + invoice no match, date differs
//   • gstin_mismatch     — invoice no matches but supplier GSTIN differs
//   • missing_in_books   — exists in GSTR-2B, not in Books
//   • missing_in_gstr2b  — exists in Books, not in GSTR-2B
//   • duplicate          — same invoice appears 2+ times on one side
//
// Includes fuzzy matching for invoice number formatting differences (e.g.
// "INV/2026/001" vs "INV-2026-001") and small rounding differences (₹0.50).
//
// This module is PURE — no Prisma, no Firebase, no side effects. The API
// route is responsible for persistence.
// ═══════════════════════════════════════════════════════════════════════════════

import type { GSTR2BRecord } from './types';

// ─── Types ───────────────────────────────────────────────────────────────────

/** A purchase invoice from Books (GSTPilot or Zoho). Normalized shape. */
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

export interface MatchResult {
  booksInvoice: BooksInvoice | null;
  gstr2bRecord: GSTR2BRecord | null;
  status: MatchStatus;
  /** 0-1 fuzzy match confidence. */
  confidence: number;
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
}

// ─── Normalization + Fuzzy helpers ────────────────────────────────────────────

/**
 * Normalize an invoice number for fuzzy comparison.
 * Strips punctuation, lowercases, removes common prefixes/suffixes.
 * "INV/2026/001" → "inv2026001"
 * "INV-2026-001" → "inv2026001"
 * "Invoice #2026-001" → "invoice2026001"
 */
export function normalizeInvoiceNo(raw: string): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/^(inv|invoice|bill|po|grn)+/, (m) => m) // keep one prefix
    .trim();
}

/**
 * Levenshtein distance for very short strings (invoice numbers).
 * Used to catch OCR / manual-entry typos like "INV-2026-001" vs "INV-2026-010".
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/**
 * Fuzzy invoice number match — returns 0-1 confidence.
 * 1.0 = exact, 0.95 = normalized match, 0.85+ = 1-char typo, <0.7 = different.
 */
export function fuzzyInvoiceMatch(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const na = normalizeInvoiceNo(a);
  const nb = normalizeInvoiceNo(b);
  if (na === nb) return 0.95;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 0;
  const similarity = 1 - dist / maxLen;
  // Require at least 85% similarity to consider it a fuzzy match
  if (similarity >= 0.85) return similarity;
  return 0;
}

/** Allow ₹1 rounding difference per field. */
const VALUE_TOLERANCE = 1.0;

function valuesClose(a: number, b: number, tolerance = VALUE_TOLERANCE): boolean {
  return Math.abs(a - b) <= tolerance;
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

/** GSTIN comparison — case-insensitive, no whitespace. */
function normalizeGSTIN(g?: string): string {
  if (!g) return '';
  return g.toUpperCase().replace(/\s+/g, '').trim();
}

// ─── Duplicate detection ─────────────────────────────────────────────────────

/**
 * Detect duplicate invoices within a single side (Books or GSTR-2B).
 * Returns a Set of invoice keys that appear 2+ times.
 */
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

// ─── Core match function ─────────────────────────────────────────────────────

/**
 * Compare a single Books invoice against a single GSTR-2B record.
 * Assumes the caller has already determined these are candidate matches
 * (same supplier GSTIN + similar invoice number).
 */
function comparePair(
  book: BooksInvoice,
  rec: GSTR2BRecord,
): MatchResult {
  const mismatchReasons: MismatchField[] = [];
  let status: MatchStatus = 'perfect_match';
  let confidence = 1;

  // ── GSTIN ──
  const bookGstin = normalizeGSTIN(book.supplierGSTIN);
  const recGstin = normalizeGSTIN(rec.supplierGSTIN);
  if (bookGstin !== recGstin) {
    status = 'gstin_mismatch';
    mismatchReasons.push({
      field: 'supplierGSTIN',
      booksValue: book.supplierGSTIN,
      gstr2bValue: rec.supplierGSTIN,
    });
    confidence = 0.5;
  }

  // ── Invoice number (fuzzy) ──
  const invoiceConf = fuzzyInvoiceMatch(book.invoiceNo, rec.invoiceNo);
  if (invoiceConf < 0.95) {
    // Different invoice number — not the same invoice
    return {
      booksInvoice: book,
      gstr2bRecord: rec,
      status: 'missing_in_books', // placeholder; caller decides
      confidence: 0,
      mismatchReasons: [],
      itcAtRisk: 0,
    };
  }
  confidence = Math.min(confidence, invoiceConf);

  // ── Date ──
  const bookDate = normalizeDate(book.invoiceDate);
  const recDate = normalizeDate(rec.invoiceDate);
  if (bookDate !== recDate) {
    if (status === 'perfect_match') status = 'date_mismatch';
    mismatchReasons.push({
      field: 'invoiceDate',
      booksValue: book.invoiceDate,
      gstr2bValue: rec.invoiceDate,
    });
    confidence = Math.min(confidence, 0.85);
  }

  // ── Taxable value ──
  if (!valuesClose(book.taxableValue, rec.taxableValue)) {
    if (status === 'perfect_match') status = 'value_mismatch';
    mismatchReasons.push({
      field: 'taxableValue',
      booksValue: book.taxableValue,
      gstr2bValue: rec.taxableValue,
      delta: Math.round((book.taxableValue - rec.taxableValue) * 100) / 100,
    });
    confidence = Math.min(confidence, 0.7);
  }

  // ── Tax components ──
  const taxFields: Array<{ field: string; book: number; rec: number }> = [
    { field: 'cgst', book: book.cgst, rec: rec.cgst },
    { field: 'sgst', book: book.sgst, rec: rec.sgst },
    { field: 'igst', book: book.igst, rec: rec.igst },
    { field: 'cess', book: book.cess, rec: rec.cess },
  ];
  let taxMismatch = false;
  for (const t of taxFields) {
    if (!valuesClose(t.book, t.rec)) {
      taxMismatch = true;
      mismatchReasons.push({
        field: t.field,
        booksValue: t.book,
        gstr2bValue: t.rec,
        delta: Math.round((t.book - t.rec) * 100) / 100,
      });
    }
  }
  if (taxMismatch && status === 'perfect_match') {
    status = 'tax_mismatch';
    confidence = Math.min(confidence, 0.75);
  }

  // ── ITC at risk ──
  // For mismatches, the ITC claimed in books may be reversed by GSTN.
  // We estimate ITC at risk as the tax declared in Books (what we claimed).
  const itcAtRisk =
    status === 'perfect_match'
      ? 0
      : Math.round((book.cgst + book.sgst + book.igst + book.cess) * 100) / 100;

  return {
    booksInvoice: book,
    gstr2bRecord: rec,
    status,
    confidence: Math.round(confidence * 100) / 100,
    mismatchReasons,
    itcAtRisk,
  };
}

// ─── Main reconciliation function ────────────────────────────────────────────

/**
 * Reconcile Books invoices against GSTR-2B records.
 *
 * Algorithm:
 *   1. Detect duplicates on each side.
 *   2. Build a candidate map: for each Books invoice, find the best-matching
 *      GSTR-2B record (same GSTIN + fuzzy invoice number).
 *   3. Compare each matched pair.
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

    // Find the best candidate by fuzzy invoice number
    let best: { rec: GSTR2BRecord; conf: number } | null = null;
    for (const rec of candidates) {
      // Skip records already matched to another book invoice
      const recKey = `${normalizeGSTIN(rec.supplierGSTIN)}|${normalizeInvoiceNo(rec.invoiceNo)}`;
      if (matchedGstr2bIds.has(recKey) && !gstr2bDupes.has(recKey)) continue;

      const conf = fuzzyInvoiceMatch(book.invoiceNo, rec.invoiceNo);
      if (conf >= 0.85 && (!best || conf > best.conf)) {
        best = { rec, conf };
      }
    }

    if (best) {
      const recKey = `${normalizeGSTIN(best.rec.supplierGSTIN)}|${normalizeInvoiceNo(best.rec.invoiceNo)}`;
      matchedGstr2bIds.add(recKey);

      const result = comparePair(book, best.rec);

      // Override confidence with the fuzzy match confidence
      result.confidence = Math.max(result.confidence, best.conf);

      // If it's a duplicate, override status
      if (isDuplicate || gstr2bDupes.has(recKey)) {
        result.status = 'duplicate';
      }

      results.push(result);
    } else {
      // No GSTR-2B match — missing in GSTR-2B
      const isDuplicateOnBooks = isDuplicate;
      results.push({
        booksInvoice: book,
        gstr2bRecord: null,
        status: isDuplicateOnBooks ? 'duplicate' : 'missing_in_gstr2b',
        confidence: 0,
        mismatchReasons: [],
        itcAtRisk: isDuplicateOnBooks ? 0 : Math.round((book.cgst + book.sgst + book.igst + book.cess) * 100) / 100,
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

  for (const r of results) {
    byStatus[r.status]++;
    if (r.itcAtRisk > 0) potentialITCLoss += r.itcAtRisk;
    if (r.booksInvoice) totalTaxableValue += r.booksInvoice.taxableValue;
    if (r.status === 'perfect_match' && r.booksInvoice) {
      totalMatchedTax += r.booksInvoice.cgst + r.booksInvoice.sgst + r.booksInvoice.igst + r.booksInvoice.cess;
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

  return {
    totalBooks: books.length,
    total2B: gstr2b.length,
    matched,
    unmatched,
    missingInBooks,
    missingIn2B,
    duplicates,
    matchPercent: Math.round(matchPercent * 100) / 100,
    potentialITCLoss: Math.round(potentialITCLoss * 100) / 100,
    totalTaxableValue: Math.round(totalTaxableValue * 100) / 100,
    totalMatchedTax: Math.round(totalMatchedTax * 100) / 100,
    byStatus,
  };
}
