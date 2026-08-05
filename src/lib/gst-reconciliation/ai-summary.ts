// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — AI Reconciliation Summary (CFO Report)
// ═══════════════════════════════════════════════════════════════════════════════
//
// After every reconciliation, Oracle generates a CFO-grade report:
//
//   • Missing invoices (count + total value)
//   • Duplicate invoices (count + total value)
//   • Wrong GST values (count + total value)
//   • Estimated ITC blocked (₹)
//   • Expected recovery (₹, what we expect to recover after fixes)
//   • Risk Level (low | medium | high | critical)
//   • Top issues list (top 5 by impact)
//   • Executive summary (2-3 sentence narrative)
//
// This report is one-click PDF-exportable.
// Pure functions, no side effects.
// ═══════════════════════════════════════════════════════════════════════════════

import type { MatchStatus } from './match-engine';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface TopIssue {
  label: string;
  count: number;
  itcAtRisk: number;
  recommendation: string;
}

export interface AIReconciliationSummary {
  // Counts
  missingInvoices: number;
  duplicateInvoices: number;
  wrongGSTValues: number;
  dateMismatches: number;
  gstinMismatches: number;
  // Financials
  estimatedITCBlocked: number;
  expectedRecovery: number;
  safeITC: number;
  // Risk
  riskLevel: RiskLevel;
  riskScore: number; // 0-100
  // Confidence
  avgConfidence: number;
  matchPercent: number;
  // Narrative
  executiveSummary: string;
  topIssues: TopIssue[];
  // Action items
  actionItems: string[];
  // Metadata
  generatedAt: string;
}

interface MatchRowLite {
  status: MatchStatus;
  itcAtRisk: number;
  booksTaxableValue: number;
  gstr2bTaxableValue: number;
  confidence: number;
}

interface SummaryInput {
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
  avgConfidence: number;
}

function fmtINR(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/**
 * Determine risk level from ITC at risk as a % of total ITC.
 *
 *   < 5%   → low
 *   5-15%  → medium
 *   15-30% → high
 *   > 30%  → critical
 */
function riskFromPercentage(itcAtRisk: number, totalITC: number): { level: RiskLevel; score: number } {
  if (totalITC <= 0) return { level: 'low', score: 0 };
  const pct = (itcAtRisk / totalITC) * 100;
  if (pct < 5) return { level: 'low', score: Math.round(pct * 4) };
  if (pct < 15) return { level: 'medium', score: Math.round(20 + (pct - 5) * 4) };
  if (pct < 30) return { level: 'high', score: Math.round(60 + (pct - 15) * 2) };
  return { level: 'critical', score: Math.min(100, Math.round(90 + (pct - 30) * 0.5)) };
}

/**
 * Generate the AI reconciliation summary (CFO report) from run data + matches.
 */
export function generateAISummary(
  summary: SummaryInput,
  matches: MatchRowLite[],
): AIReconciliationSummary {
  // ── Count by status ──
  let missingInBooks = 0;
  let missingIn2B = 0;
  let duplicates = 0;
  let valueMismatch = 0;
  let taxMismatch = 0;
  let dateMismatch = 0;
  let gstinMismatch = 0;
  let valueMismatchITC = 0;
  let taxMismatchITC = 0;
  let dateMismatchITC = 0;
  let gstinMismatchITC = 0;
  let missingInBooksITC = 0;
  let missingIn2BITC = 0;

  for (const m of matches) {
    switch (m.status) {
      case 'missing_in_books':
        missingInBooks++;
        missingInBooksITC += m.itcAtRisk;
        break;
      case 'missing_in_gstr2b':
        missingIn2B++;
        missingIn2BITC += m.itcAtRisk;
        break;
      case 'duplicate':
        duplicates++;
        break;
      case 'value_mismatch':
        valueMismatch++;
        valueMismatchITC += m.itcAtRisk;
        break;
      case 'tax_mismatch':
        taxMismatch++;
        taxMismatchITC += m.itcAtRisk;
        break;
      case 'date_mismatch':
        dateMismatch++;
        dateMismatchITC += m.itcAtRisk;
        break;
      case 'gstin_mismatch':
        gstinMismatch++;
        gstinMismatchITC += m.itcAtRisk;
        break;
    }
  }

  const missingInvoices = missingInBooks + missingIn2B;
  const wrongGSTValues = valueMismatch + taxMismatch;
  const estimatedITCBlocked = summary.potentialITCLoss;
  const safeITC = summary.totalMatchedTax;
  const totalITC = safeITC + estimatedITCBlocked;

  // Expected recovery = ITC from missing_in_books (recoverable once recorded)
  // + 70% of value/tax mismatches (usually recoverable after supplier amendment)
  // + 50% of date mismatches (depends on FY)
  // + 30% of gstin mismatches (often recoverable)
  // + 80% of missing_in_gstr2b (recoverable once supplier files)
  const expectedRecovery = Math.round(
    missingInBooksITC * 0.95 +
    missingIn2BITC * 0.80 +
    valueMismatchITC * 0.70 +
    taxMismatchITC * 0.70 +
    dateMismatchITC * 0.50 +
    gstinMismatchITC * 0.30,
  );

  // ── Risk ──
  const { level: riskLevel, score: riskScore } = riskFromPercentage(estimatedITCBlocked, totalITC);

  // ── Top issues (by ITC impact) ──
  const topIssues: TopIssue[] = [];
  if (missingIn2B > 0) {
    topIssues.push({
      label: 'Missing in GSTR-2B (supplier not filed)',
      count: missingIn2B,
      itcAtRisk: missingIn2BITC,
      recommendation: 'Follow up with suppliers before next GSTR-1 deadline (11th of next month).',
    });
  }
  if (missingInBooks > 0) {
    topIssues.push({
      label: 'Missing in Books (unrecorded purchases)',
      count: missingInBooks,
      itcAtRisk: missingInBooksITC,
      recommendation: 'Locate original invoices and record in purchase register immediately.',
    });
  }
  if (valueMismatch > 0) {
    topIssues.push({
      label: 'Value mismatches (taxable value differs)',
      count: valueMismatch,
      itcAtRisk: valueMismatchITC,
      recommendation: 'Email suppliers to amend GSTR-1 with correct taxable values.',
    });
  }
  if (taxMismatch > 0) {
    topIssues.push({
      label: 'Tax component mismatches (CGST/SGST/IGST)',
      count: taxMismatch,
      itcAtRisk: taxMismatchITC,
      recommendation: 'Confirm correct GST rate with suppliers. Request GSTR-1 amendments.',
    });
  }
  if (gstinMismatch > 0) {
    topIssues.push({
      label: 'GSTIN mismatches (potential fraud)',
      count: gstinMismatch,
      itcAtRisk: gstinMismatchITC,
      recommendation: 'Verify supplier GSTINs immediately. Raise dispute on GST portal if fraudulent.',
    });
  }
  if (dateMismatch > 0) {
    topIssues.push({
      label: 'Date mismatches (ITC timing risk)',
      count: dateMismatch,
      itcAtRisk: dateMismatchITC,
      recommendation: 'Confirm correct dates. Watch for Section 16(4) time-bar if cross-FY.',
    });
  }
  if (duplicates > 0) {
    topIssues.push({
      label: 'Duplicate invoices',
      count: duplicates,
      itcAtRisk: 0,
      recommendation: 'Reverse duplicate entries. Never claim ITC twice on the same invoice.',
    });
  }
  topIssues.sort((a, b) => b.itcAtRisk - a.itcAtRisk);

  // ── Action items ──
  const actionItems: string[] = [];
  if (missingIn2B > 0) actionItems.push(`Contact ${missingIn2B} supplier(s) who haven't filed GSTR-1`);
  if (missingInBooks > 0) actionItems.push(`Record ${missingInBooks} missing purchase invoice(s) in Books`);
  if (valueMismatch + taxMismatch > 0) actionItems.push(`Resolve ${valueMismatch + taxMismatch} value/tax mismatch(es) with suppliers`);
  if (gstinMismatch > 0) actionItems.push(`Verify ${gstinMismatch} GSTIN mismatch(es) — possible fraud`);
  if (duplicates > 0) actionItems.push(`Reverse ${duplicates} duplicate invoice(s)`);
  if (dateMismatch > 0) actionItems.push(`Confirm ${dateMismatch} invoice date(s) — check Section 16(4) timing`);
  if (actionItems.length === 0) actionItems.push('All invoices reconciled. No action required.');

  // ── Executive summary ──
  const riskEmoji = riskLevel === 'critical' ? 'Critical' : riskLevel === 'high' ? 'High' : riskLevel === 'medium' ? 'Medium' : 'Low';
  const summary_text = `Your reconciliation found ${missingInvoices} missing invoice${missingInvoices !== 1 ? 's' : ''}, ${duplicates} duplicate${duplicates !== 1 ? 's' : ''}, and ${wrongGSTValues} wrong GST value${wrongGSTValues !== 1 ? 's' : ''}. Estimated ITC blocked: ${fmtINR(estimatedITCBlocked)}. Expected recovery after fixes: ${fmtINR(expectedRecovery)}. Risk Level: ${riskEmoji}.`;

  return {
    missingInvoices,
    duplicateInvoices: duplicates,
    wrongGSTValues,
    dateMismatches: dateMismatch,
    gstinMismatches: gstinMismatch,
    estimatedITCBlocked,
    expectedRecovery,
    safeITC,
    riskLevel,
    riskScore,
    avgConfidence: summary.avgConfidence,
    matchPercent: summary.matchPercent,
    executiveSummary: summary_text,
    topIssues: topIssues.slice(0, 5),
    actionItems,
    generatedAt: new Date().toISOString(),
  };
}
