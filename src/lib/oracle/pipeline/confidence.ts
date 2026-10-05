// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Confidence Scoring Engine (PROMPT 5)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Every conclusion Oracle makes MUST carry a confidence score. Oracle NEVER
// invents certainty. Confidence is computed DETERMINISTICALLY from:
//   • Data volume   — more records = higher confidence
//   • Data freshness — recent data = higher confidence
//   • Variance      — stable trends = higher confidence
//   • Coverage      — more tools succeeded = higher confidence
//
// Example:
//   Revenue Growth       97%  (high volume, recent, stable)
//   GST Liability        100% (exact Prisma computation)
//   Forecast             82%  (computed from trend, moderate variance)
//   Customer Risk        91%  (real concentration data, stable)
// ═══════════════════════════════════════════════════════════════════════════════

import 'server-only';
import type { ConfidenceTag, ToolExecution } from './types';

/** Inputs that drive confidence computation. */
export interface ConfidenceInputs {
  /** Number of data records backing the conclusion. */
  recordCount: number;
  /** Was the data point computed exactly (Prisma aggregation)? */
  exact: boolean;
  /** Days since the most recent data point (0 = today). */
  daysStale: number;
  /** Trend variance (0 = perfectly stable, 1 = wild swings). */
  variance: number;
  /** How many of the requested tools succeeded (0-1). */
  toolCoverage: number;
}

/** Compute a single confidence percentage (0-100). */
export function computeConfidence(inp: ConfidenceInputs): number {
  // Exact Prisma computations start at 100; estimates start lower.
  let score = inp.exact ? 100 : 80;

  // Data volume: ramp up from 40 → 100 as record count grows.
  if (!inp.exact) {
    const volumeFactor = Math.min(1, inp.recordCount / 30); // 30+ records = full
    score = 40 + volumeFactor * 40; // 40-80
  }

  // Freshness: lose 2% per day of staleness, floor at 60.
  const freshnessPenalty = Math.min(40, inp.daysStale * 2);
  score -= freshnessPenalty;

  // Variance: high variance lowers confidence (forecast especially).
  score -= inp.variance * 25;

  // Tool coverage: if only half the tools succeeded, lower confidence.
  score *= 0.7 + 0.3 * inp.toolCoverage;

  // Clamp to [35, 100] — never claim 100% on non-exact, never below 35%.
  if (!inp.exact) score = Math.min(score, 95);
  score = Math.max(35, Math.min(100, Math.round(score)));
  return score;
}

/** Confidence rationale for display. */
export function confidenceRationale(inp: ConfidenceInputs): string {
  const parts: string[] = [];
  if (inp.exact) parts.push('computed from ledger');
  if (inp.recordCount > 0) parts.push(`${inp.recordCount} records`);
  if (inp.daysStale <= 1) parts.push('fresh data');
  else if (inp.daysStale <= 7) parts.push(`${inp.daysStale}d old`);
  else parts.push('stale data');
  if (inp.variance > 0.4) parts.push('high variance');
  else if (inp.variance < 0.15) parts.push('stable trend');
  if (inp.toolCoverage < 1) parts.push(`${Math.round(inp.toolCoverage * 100)}% source coverage`);
  return parts.join(' · ');
}

/**
 * Build the full confidence tag list for a pipeline run.
 * Each conclusion Oracle makes gets its own confidence score.
 */
export function buildConfidenceTags(
  tools: ToolExecution[],
  snapshot: {
    revenue?: number;
    revenueThisMonth?: number;
    revenueLastMonth?: number;
    gstLiability?: number;
    forecastConfidence?: number;
    topCustomerShare?: number;
    collectionRate?: number;
    invoiceCount?: number;
    customerCount?: number;
  } | null,
): ConfidenceTag[] {
  const tags: ConfidenceTag[] = [];
  const toolCoverage = tools.length > 0
    ? tools.filter((t) => t.status === 'done').length / tools.length
    : 0;

  // Revenue Growth confidence — based on volume + variance of MoM.
  if (snapshot && (snapshot.revenueThisMonth ?? 0) > 0) {
    const thisM = snapshot.revenueThisMonth ?? 0;
    const lastM = snapshot.revenueLastMonth ?? 0;
    const variance = lastM > 0 ? Math.abs((thisM - lastM) / lastM) : 0.5;
    const conf = computeConfidence({
      recordCount: snapshot.invoiceCount ?? 0,
      exact: false,
      daysStale: 0,
      variance: Math.min(1, variance),
      toolCoverage,
    });
    tags.push({
      label: 'Revenue Growth',
      confidence: conf,
      rationale: confidenceRationale({
        recordCount: snapshot.invoiceCount ?? 0,
        exact: false,
        daysStale: 0,
        variance: Math.min(1, variance),
        toolCoverage,
      }),
    });
  }

  // GST Liability confidence — exact Prisma aggregation.
  if (snapshot && (snapshot.gstLiability ?? 0) !== 0) {
    tags.push({
      label: 'GST Liability',
      confidence: 100,
      rationale: 'computed exactly from invoice tax fields',
    });
  }

  // Forecast confidence — derived from the snapshot's own forecast model.
  if (snapshot && (snapshot.forecastConfidence ?? 0) > 0) {
    const fConf = Math.round((snapshot.forecastConfidence ?? 0) * 100);
    tags.push({
      label: 'Forecast',
      confidence: Math.max(60, Math.min(90, fConf)),
      rationale: `trend model · ${snapshot.invoiceCount ?? 0} historical invoices`,
    });
  }

  // Customer Risk / concentration confidence.
  if (snapshot && (snapshot.topCustomerShare ?? 0) > 0) {
    const conf = computeConfidence({
      recordCount: snapshot.customerCount ?? 0,
      exact: true,
      daysStale: 0,
      variance: 0,
      toolCoverage,
    });
    tags.push({
      label: 'Customer Risk',
      confidence: conf,
      rationale: confidenceRationale({
        recordCount: snapshot.customerCount ?? 0,
        exact: true,
        daysStale: 0,
        variance: 0,
        toolCoverage,
      }),
    });
  }

  // Collection rate confidence.
  if (snapshot && (snapshot.collectionRate ?? 0) >= 0) {
    const conf = computeConfidence({
      recordCount: snapshot.invoiceCount ?? 0,
      exact: true,
      daysStale: 0,
      variance: 0,
      toolCoverage,
    });
    tags.push({
      label: 'Collection Rate',
      confidence: conf,
      rationale: confidenceRationale({
        recordCount: snapshot.invoiceCount ?? 0,
        exact: true,
        daysStale: 0,
        variance: 0,
        toolCoverage,
      }),
    });
  }

  return tags;
}
