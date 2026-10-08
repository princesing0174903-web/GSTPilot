// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Vendor (Supplier) Compliance Score Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// For every unique supplier GSTIN in a reconciliation run, compute a
// GST Compliance Score (0-100) and a list of human-readable reasons.
//
// Score is based on:
//   • Match rate (perfect matches / total invoices from this supplier)
//   • Missing-in-2B rate (supplier not filing invoices on time)
//   • Mismatch rate (value/tax/date/gstin mismatches)
//   • Duplicate rate (supplier filing the same invoice twice)
//
// Reasons flag specific issues:
//   • "Late filing"     — supplier missed GSTR-1 deadline (>50% missing in 2B)
//   • "Fake GST suspected" — GSTIN mismatches or PAN inconsistencies
//   • "Wrong values"    — frequent value/tax mismatches
//   • "Duplicate filings" — supplier filed the same invoice multiple times
//   • "Compliant"       — high match rate, no issues
//
// Pure functions, no side effects.
// ═══════════════════════════════════════════════════════════════════════════════

import type { MatchStatus } from './match-engine';

export interface VendorScore {
  gstin: string;
  name: string | null;
  score: number; // 0-100
  reasons: string[];
  invoiceCount: number;
  matched: number;
  mismatched: number;
  missingIn2B: number; // supplier didn't file
  missingInBooks: number; // you didn't record
  duplicates: number;
  totalITCAtRisk: number;
  /** Letter grade A-F for quick visual scanning. */
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  /** Trend hint for UI: improving | stable | declining | new */
  trend: 'improving' | 'stable' | 'declining' | 'new';
}

interface MatchRowLite {
  status: MatchStatus;
  booksSupplierGSTIN: string | null;
  gstr2bSupplierGSTIN: string | null;
  itcAtRisk: number;
  booksSupplierName?: string | null;
  gstr2bSupplierName?: string | null;
}

function normalizeGSTIN(g?: string): string {
  if (!g) return '';
  return g.toUpperCase().replace(/\s+/g, '').trim();
}

function gradeFor(score: number): VendorScore['grade'] {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/**
 * Compute the vendor compliance score for a single supplier.
 *
 * Scoring:
 *   Start at 100. Subtract:
 *     • 4 points per mismatched invoice (value/tax/date/gstin)
 *     • 8 points per missing-in-2B invoice (supplier didn't file)
 *     • 3 points per missing-in-books invoice (your fault, less penalty)
 *     • 10 points per duplicate (supplier-side duplicate filing)
 *   Cap at [0, 100].
 */
function scoreSupplier(rows: MatchRowLite[]): VendorScore {
  const total = rows.length;
  let matched = 0;
  let mismatched = 0;
  let missingIn2B = 0;
  let missingInBooks = 0;
  let duplicates = 0;
  let totalITCAtRisk = 0;

  for (const r of rows) {
    switch (r.status) {
      case 'perfect_match': matched++; break;
      case 'value_mismatch':
      case 'tax_mismatch':
      case 'date_mismatch':
      case 'gstin_mismatch':
        mismatched++;
        totalITCAtRisk += r.itcAtRisk;
        break;
      case 'missing_in_gstr2b':
        missingIn2B++;
        totalITCAtRisk += r.itcAtRisk;
        break;
      case 'missing_in_books':
        missingInBooks++;
        totalITCAtRisk += r.itcAtRisk;
        break;
      case 'duplicate':
        duplicates++;
        break;
    }
  }

  let score = 100;
  score -= mismatched * 4;
  score -= missingIn2B * 8;
  score -= missingInBooks * 3;
  score -= duplicates * 10;
  score = Math.max(0, Math.min(100, score));

  // Round
  score = Math.round(score);

  // Build reasons
  const reasons: string[] = [];
  const missingRate = total > 0 ? missingIn2B / total : 0;
  const mismatchRate = total > 0 ? mismatched / total : 0;
  const dupRate = total > 0 ? duplicates / total : 0;

  if (missingRate >= 0.5) {
    reasons.push(`Late filing — ${missingIn2B} of ${total} invoices not in GSTR-2B`);
  } else if (missingIn2B > 0) {
    reasons.push(`${missingIn2B} invoice${missingIn2B > 1 ? 's' : ''} missing in GSTR-2B`);
  }

  if (mismatchRate >= 0.5) {
    reasons.push(`Wrong values — ${mismatched} of ${total} invoices mismatched`);
  } else if (mismatched > 0) {
    reasons.push(`${mismatched} value/tax mismatch${mismatched > 1 ? 'es' : ''}`);
  }

  // Detect GSTIN mismatch specifically (fake GST suspicion)
  const gstinMismatchCount = rows.filter((r) => r.status === 'gstin_mismatch').length;
  if (gstinMismatchCount > 0) {
    reasons.push(`Fake GST suspected — ${gstinMismatchCount} GSTIN mismatch${gstinMismatchCount > 1 ? 'es' : ''}`);
  }

  if (dupRate >= 0.2) {
    reasons.push(`Duplicate filings — ${duplicates} duplicate invoice${duplicates > 1 ? 's' : ''}`);
  } else if (duplicates > 0) {
    reasons.push(`${duplicates} duplicate invoice${duplicates > 1 ? 's' : ''}`);
  }

  if (reasons.length === 0) {
    if (score >= 90) reasons.push('Compliant — all invoices match perfectly');
    else reasons.push('No major issues detected');
  }

  const gstin = rows[0].booksSupplierGSTIN || rows[0].gstr2bSupplierGSTIN || 'UNKNOWN';
  const name = rows[0].booksSupplierName || rows[0].gstr2bSupplierName || null;

  return {
    gstin,
    name,
    score,
    reasons,
    invoiceCount: total,
    matched,
    mismatched,
    missingIn2B,
    missingInBooks,
    duplicates,
    totalITCAtRisk: Math.round(totalITCAtRisk * 100) / 100,
    grade: gradeFor(score),
    trend: 'new', // trend is set by the caller using historical data
  };
}

/**
 * Compute vendor scores for all suppliers in a reconciliation run.
 * Returns an array sorted by score ascending (worst first — they need attention).
 */
export function computeVendorScores(matches: MatchRowLite[]): VendorScore[] {
  // Group matches by supplier GSTIN (prefer books GSTIN, fall back to GSTR-2B)
  const bySupplier = new Map<string, MatchRowLite[]>();

  for (const m of matches) {
    const gstin = normalizeGSTIN(m.booksSupplierGSTIN || m.gstr2bSupplierGSTIN || '');
    if (!gstin) continue;
    if (!bySupplier.has(gstin)) bySupplier.set(gstin, []);
    bySupplier.get(gstin)!.push(m);
  }

  const scores: VendorScore[] = [];
  for (const [gstin, rows] of bySupplier) {
    scores.push(scoreSupplier(rows));
  }

  // Sort: worst scores first (they need attention)
  scores.sort((a, b) => a.score - b.score);

  return scores;
}

/**
 * Compute a trend label by comparing current score to historical score.
 * If the supplier's previous run had a higher score, trend is 'declining'.
 * If lower, 'improving'. If within ±3 points, 'stable'. If no history, 'new'.
 */
export function applyTrend(current: VendorScore, previousScore: number | null): VendorScore {
  if (previousScore == null) return { ...current, trend: 'new' };
  const diff = current.score - previousScore;
  let trend: VendorScore['trend'] = 'stable';
  if (diff >= 5) trend = 'improving';
  else if (diff <= -5) trend = 'declining';
  return { ...current, trend };
}
