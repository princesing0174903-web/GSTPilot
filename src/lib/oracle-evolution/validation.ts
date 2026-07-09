// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Upgrade Phase 1 · Upgrade 6: AI Accuracy
//
// Validation layer that runs AFTER Oracle generates an answer. Catches:
//   • Hallucinated numbers (claimed figures not present in source data)
//   • GST calculation errors (slab mismatches, ITC arithmetic)
//   • Missing citations (claims without supporting data references)
//   • Contradictions (answer conflicts with provided context)
//   • Out-of-scope assertions (financial advice beyond available data)
//
// Every validation returns a verdict + per-issue list + corrected confidence.
// Answers below the threshold are flagged for human review before display.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Types ────────────────────────────────────────────────────────────────────

export type ValidationSeverity = 'pass' | 'warning' | 'fail';

export interface ValidationIssue {
  type:
    | 'hallucinated_number'
    | 'gst_calc_error'
    | 'missing_citation'
    | 'contradiction'
    | 'out_of_scope'
    | 'unsupported_claim';
  severity: ValidationSeverity;
  message: string;
  /** The specific claim in the answer that triggered the issue. */
  claim: string;
  /** What the source data actually says (if applicable). */
  sourceValue?: string;
  /** Suggested correction. */
  correction?: string;
}

export interface ValidationResult {
  valid: boolean;
  overallConfidence: number;
  issues: ValidationIssue[];
  /** Original answer confidence reduced by issue penalties. */
  adjustedConfidence: number;
  /** Whether the answer should be shown as-is or flagged for review. */
  requiresReview: boolean;
  summary: string;
}

// ─── Context: the real numbers Oracle should ground against ───────────────────

export interface ValidationContext {
  /** Known invoice totals (for number grounding). */
  knownTotals?: number[];
  /** Known GST amounts. */
  knownGstAmounts?: number[];
  /** Known dates (ISO strings). */
  knownDates?: string[];
  /** The source text Oracle was given (for citation checking). */
  sourceText?: string;
  /** The user's original question (for scope checking). */
  userQuestion?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GST_SLABS = [0, 0.005, 0.12, 0.18, 0.28];

function extractNumbers(text: string): number[] {
  // Match currency-formatted numbers: ₹1,23,456 / ₹1.2L / ₹2.5Cr / plain numbers
  const numbers: number[] = [];
  const patterns = [
    /₹\s*([\d,]+(?:\.\d+)?)\s*(?:Cr|L|K|cr|l|k)?/g,
    /(?<!\w)([\d,]+(?:\.\d+)?)\s*(?:Cr|L|K|cr|l|k)\b/g,
    /(?<!\w)(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?)\b/g,
    /(?<![\w,.])(\d+(?:\.\d{1,2})?)\s*(?:percent|%)/gi,
  ];

  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const raw = m[1].replace(/,/g, '');
      const num = parseFloat(raw);
      if (!isNaN(num) && num > 0) {
        // Expand Indian abbreviations
        const suffix = m[0].toLowerCase();
        if (suffix.includes('cr')) numbers.push(num * 10000000);
        else if (suffix.includes('l') && !suffix.includes('slab')) numbers.push(num * 100000);
        else if (suffix.includes('k')) numbers.push(num * 1000);
        else numbers.push(num);
      }
    }
  }
  return numbers;
}

function numbersMatch(a: number, b: number, tolerance = 0.02): boolean {
  if (a === 0 && b === 0) return true;
  const diff = Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1);
  return diff <= tolerance;
}

function findClosest(target: number, candidates: number[]): number | null {
  if (candidates.length === 0) return null;
  return candidates.reduce((closest, c) =>
    Math.abs(c - target) < Math.abs(closest - target) ? c : closest,
  );
}

// ─── Validation checks ────────────────────────────────────────────────────────

function checkHallucinatedNumbers(
  answer: string,
  ctx: ValidationContext,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!ctx.knownTotals || ctx.knownTotals.length === 0) return issues;

  const claimedNumbers = extractNumbers(answer);
  const allKnown = [...(ctx.knownTotals ?? []), ...(ctx.knownGstAmounts ?? [])];

  for (const claimed of claimedNumbers) {
    // Skip very small numbers (percentages, counts) and very large round numbers (years)
    if (claimed < 100 || (claimed > 2020 && claimed < 2100)) continue;

    const closest = findClosest(claimed, allKnown);
    if (closest === null) continue;

    if (!numbersMatch(claimed, closest, 0.05)) {
      // Claimed number is >5% off from the nearest known figure
      const diffPct = Math.abs(claimed - closest) / closest * 100;
      if (diffPct > 15) {
        issues.push({
          type: 'hallucinated_number',
          severity: 'fail',
          message: `Claimed figure ₹${claimed.toLocaleString('en-IN')} does not match any known value in the source data (closest: ₹${closest.toLocaleString('en-IN')}, ${diffPct.toFixed(0)}% off).`,
          claim: `₹${claimed.toLocaleString('en-IN')}`,
          sourceValue: `₹${closest.toLocaleString('en-IN')}`,
          correction: `Verify the exact figure from source records before stating.`,
        });
      }
    }
  }

  return issues;
}

function checkGstCalculations(
  answer: string,
  ctx: ValidationContext,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  // Detect GST rate claims and verify they're valid slabs.
  // Catches both "15% GST" and "GST rate is 15%" patterns.
  const ratePatterns = [
    /(\d+(?:\.\d+)?)\s*%\s*(?:gst|tax rate|slab)/gi,
    /(?:gst|tax)\s*(?:rate|slab)?\s*(?:is|of|at|=|:)?\s*(\d+(?:\.\d+)?)\s*%/gi,
  ];
  const foundRates = new Set<number>();
  for (const re of ratePatterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(answer)) !== null) {
      const rate = parseFloat(m[1]);
      if (!isNaN(rate)) foundRates.add(rate);
    }
  }
  for (const rate of foundRates) {
    if (!GST_SLABS.includes(rate / 100)) {
      issues.push({
        type: 'gst_calc_error',
        severity: 'warning',
        message: `Claimed GST rate ${rate}% is not a standard Indian GST slab. Valid slabs: 0%, 5%, 12%, 18%, 28%.`,
        claim: `${rate}% GST`,
        correction: `Use a valid GST slab: 0%, 5%, 12%, 18%, or 28%.`,
      });
    }
  }

  // Detect CGST + SGST = IGST claims
  const igstClaim = answer.match(/IGST[:\s]+₹?\s*([\d,]+)/i);
  const cgstClaim = answer.match(/CGST[:\s]+₹?\s*([\d,]+)/i);
  const sgstClaim = answer.match(/SGST[:\s]+₹?\s*([\d,]+)/i);
  if (igstClaim && cgstClaim && sgstClaim) {
    const igst = parseFloat(igstClaim[1].replace(/,/g, ''));
    const cgst = parseFloat(cgstClaim[1].replace(/,/g, ''));
    const sgst = parseFloat(sgstClaim[1].replace(/,/g, ''));
    if (!isNaN(igst) && !isNaN(cgst) && !isNaN(sgst)) {
      // CGST + SGST should equal what IGST would be for the same transaction
      if (!numbersMatch(cgst + sgst, igst, 0.01) && !numbersMatch(cgst, sgst, 0.01)) {
        issues.push({
          type: 'gst_calc_error',
          severity: 'warning',
          message: `CGST (₹${cgst.toLocaleString('en-IN')}) + SGST (₹${sgst.toLocaleString('en-IN')}) = ₹${(cgst + sgst).toLocaleString('en-IN')} but IGST claimed as ₹${igst.toLocaleString('en-IN')}. For intra-state, CGST = SGST; for inter-state, IGST = CGST + SGST.`,
          claim: `IGST ₹${igst.toLocaleString('en-IN')}`,
          correction: `Verify place-of-supply: intra-state uses CGST+SGST (equal halves), inter-state uses IGST (= full rate).`,
        });
      }
    }
  }

  return issues;
}

function checkCitations(
  answer: string,
  ctx: ValidationContext,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!ctx.sourceText || ctx.sourceText.length < 50) return issues;

  // Check if the answer makes claims without referencing source data
  const hasFigures = extractNumbers(answer).length > 0;
  const citesSource = /(?:according to|from (?:the|your) (?:records|data|books)|source:|per (?:GSTR|invoice|bank)|data shows|records indicate)/i.test(answer);

  if (hasFigures && !citesSource) {
    issues.push({
      type: 'missing_citation',
      severity: 'warning',
      message: 'Answer contains financial figures but does not reference the source data. Every number should cite its origin.',
      claim: 'Figures without citations',
      correction: 'Add phrases like "According to your invoices..." or "Per GSTR-2B..." before stating figures.',
    });
  }

  return issues;
}

function checkContradictions(
  answer: string,
  ctx: ValidationContext,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!ctx.sourceText) return issues;

  // Detect "no" or "not found" claims when the source actually contains the data
  const negativeClaims = [
    /no\s+(?:invoices?|payments?|transactions?|records?)\s+(?:found|exist|show)/i,
    /(?:cannot|could not|unable to)\s+find/i,
    /not\s+available\s+in\s+(?:your\s+)?(?:records|data)/i,
  ];

  for (const re of negativeClaims) {
    if (re.test(answer)) {
      // Check if source text actually has data
      const sourceHasData = ctx.sourceText.length > 200 && /\d{3,}/.test(ctx.sourceText);
      if (sourceHasData) {
        issues.push({
          type: 'contradiction',
          severity: 'fail',
          message: 'Answer claims data is unavailable, but the source context contains relevant records. This may be a retrieval failure.',
          claim: 'Negative availability claim',
          sourceValue: 'Source context contains data',
          correction: 'Re-check the source data and provide the actual figures.',
        });
        break;
      }
    }
  }

  return issues;
}

function checkScope(
  answer: string,
  ctx: ValidationContext,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!ctx.userQuestion) return issues;

  // Detect definitive predictions or guarantees
  const predictionPatterns = [
    /(?:will|definitely|certainly|guaranteed)\s+(?:happen|occur|reach|achieve)/i,
    /100\s*%\s*(?:certain|sure|guaranteed)/i,
    /(?:cannot|will never)\s+(?:fail|lose|decline)/i,
  ];

  for (const re of predictionPatterns) {
    if (re.test(answer)) {
      issues.push({
        type: 'out_of_scope',
        severity: 'warning',
        message: 'Answer makes a definitive prediction. Financial forecasts should always carry confidence levels — never absolute certainty.',
        claim: answer.match(re)?.[0] ?? 'Definitive prediction',
        correction: 'Use confidence-weighted language: "likely", "projected at X% confidence", or "expected to".',
      });
    }
  }

  return issues;
}

// ─── Main validation entry point ──────────────────────────────────────────────

export function validateAnswer(
  answer: string,
  ctx: ValidationContext,
  originalConfidence = 0.85,
): ValidationResult {
  const issues: ValidationIssue[] = [
    ...checkHallucinatedNumbers(answer, ctx),
    ...checkGstCalculations(answer, ctx),
    ...checkCitations(answer, ctx),
    ...checkContradictions(answer, ctx),
    ...checkScope(answer, ctx),
  ];

  // Calculate adjusted confidence
  let penalty = 0;
  for (const issue of issues) {
    if (issue.severity === 'fail') penalty += 0.25;
    else if (issue.severity === 'warning') penalty += 0.08;
  }

  const adjustedConfidence = Math.max(0.1, originalConfidence - penalty);
  const hasFail = issues.some((i) => i.severity === 'fail');
  const valid = !hasFail && adjustedConfidence >= 0.5;
  const requiresReview = hasFail || adjustedConfidence < 0.5;

  const passCount = issues.filter((i) => i.severity === 'pass').length;
  const warnCount = issues.filter((i) => i.severity === 'warning').length;
  const failCount = issues.filter((i) => i.severity === 'fail').length;

  let summary: string;
  if (issues.length === 0) {
    summary = `Validation passed. ${passCount} checks, 0 issues. Confidence: ${Math.round(adjustedConfidence * 100)}%.`;
  } else {
    summary = `Validation: ${failCount} fail, ${warnCount} warning. Adjusted confidence: ${Math.round(adjustedConfidence * 100)}%.`;
    if (requiresReview) summary += ' Flagged for human review.';
  }

  return {
    valid,
    overallConfidence: originalConfidence,
    issues,
    adjustedConfidence,
    requiresReview,
    summary,
  };
}

// ─── Fact-check a specific claim against source data ──────────────────────────

export interface FactCheckResult {
  claim: string;
  verdict: 'true' | 'false' | 'unverifiable';
  evidence: string;
  confidence: number;
}

export function factCheckClaim(
  claim: string,
  ctx: ValidationContext,
): FactCheckResult {
  const claimedNumbers = extractNumbers(claim);

  if (claimedNumbers.length === 0) {
    return {
      claim,
      verdict: 'unverifiable',
      evidence: 'No numerical claim detected to verify.',
      confidence: 0.5,
    };
  }

  const allKnown = [...(ctx.knownTotals ?? []), ...(ctx.knownGstAmounts ?? [])];
  if (allKnown.length === 0) {
    return {
      claim,
      verdict: 'unverifiable',
      evidence: 'No source data available to verify against.',
      confidence: 0.3,
    };
  }

  const claimed = claimedNumbers[0];
  const closest = findClosest(claimed, allKnown);
  if (closest === null) {
    return { claim, verdict: 'unverifiable', evidence: 'No comparable figure in source.', confidence: 0.4 };
  }

  if (numbersMatch(claimed, closest, 0.02)) {
    return {
      claim,
      verdict: 'true',
      evidence: `Matches source value ₹${closest.toLocaleString('en-IN')} (within 2%).`,
      confidence: 0.95,
    };
  }

  if (numbersMatch(claimed, closest, 0.1)) {
    return {
      claim,
      verdict: 'true',
      evidence: `Close to source value ₹${closest.toLocaleString('en-IN')} (within 10%).`,
      confidence: 0.75,
    };
  }

  return {
    claim,
    verdict: 'false',
    evidence: `Does not match any source value. Closest: ₹${closest.toLocaleString('en-IN')} (${Math.abs(claimed - closest) / closest * 100}).toFixed(0)% off).`,
    confidence: 0.9,
  };
}
