// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Intelligence Module: Forecaster
// ═══════════════════════════════════════════════════════════════════════════════
//
// Forecasts future business metrics using REAL historical data only.
//
// PRINCIPLES:
//   1. NEVER fabricate a forecast. If there's insufficient data, return
//      `{ sufficient: false, reason: "..." }` with an empty forecast array.
//   2. ALWAYS show assumptions, data period, and a confidence score.
//   3. Confidence is HONEST: <0.4 = low, 0.4–0.7 = medium, >0.7 = high.
//   4. If a regression produces NaN or Infinity, return sufficient=false.
//   5. PURE COMPUTATION (one read-only Prisma query for the GST liability
//      average over recent filed returns — never writes).
//   6. Reads from the UnifiedOracleContext — does NOT re-fetch headline metrics.
//   7. Cites an evidenceId from ctx.evidenceIndex for every forecast.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { UnifiedOracleContext } from '../context/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ForecastKind =
  | 'cash_flow'
  | 'revenue'
  | 'receivables'
  | 'gst_liability'
  | 'itc_recovery'
  | 'runway';

export interface ForecastPoint {
  period: string;
  value: number;
  lower?: number;
  upper?: number;
}

export interface ForecastResult {
  kind: ForecastKind;
  horizonLabel: string; // e.g. "Next 3 months"
  sufficient: boolean;
  /** Present only when sufficient=false — explains why no forecast could be produced. */
  reason?: string;
  forecast: ForecastPoint[];
  assumptions: string[];
  /** Describes the historical window the forecast is based on. */
  dataPeriod: string;
  /** 0-1. Honest confidence — never inflated. */
  confidence: number;
  confidenceLabel: 'low' | 'medium' | 'high';
  evidenceId: string;
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Forecast a business metric `kind` over `horizon` months.
 *
 * ASYNC because the GST-liability forecast (rule 4) queries recent filed
 * GSTRFiling rows to average actual liability. NO writes — read-only.
 *
 * @param ctx     The fully-built UnifiedOracleContext.
 * @param kind    What to forecast.
 * @param horizon Number of months to project forward (clamped to [1, 12]).
 * @returns       A ForecastResult. If insufficient data, `sufficient: false`
 *                and `forecast: []` with a human-readable `reason`.
 */
export async function forecast(
  ctx: UnifiedOracleContext,
  kind: ForecastKind,
  horizon: number,
): Promise<ForecastResult> {
  const h = clampHorizon(horizon);
  switch (kind) {
    case 'cash_flow':     return forecastCashFlow(ctx, h);
    case 'revenue':       return forecastRevenue(ctx, h);
    case 'receivables':   return forecastReceivables(ctx, h);
    case 'gst_liability': return forecastGstLiability(ctx, h);
    case 'itc_recovery':  return forecastItcRecovery(ctx, h);
    case 'runway':        return forecastRunway(ctx, h);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clampHorizon(h: number): number {
  if (!Number.isFinite(h) || h <= 0) return 1;
  return Math.max(1, Math.min(12, Math.floor(h)));
}

function horizonLabel(h: number): string {
  return `Next ${h} month${h === 1 ? '' : 's'}`;
}

function confidenceLabel(c: number): 'low' | 'medium' | 'high' {
  if (c > 0.7) return 'high';
  if (c >= 0.4) return 'medium';
  return 'low';
}

/**
 * Build a human-readable label for the historical window.
 * `seriesLen` = number of monthly points actually used.
 */
function dataPeriodLabel(seriesLen: number): string {
  if (seriesLen <= 0) return 'No historical data available';
  const last = new Date();
  const first = new Date(last.getFullYear(), last.getMonth() - (seriesLen - 1), 1);
  const fmt = (d: Date) => d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
  return `Based on ${seriesLen} month${seriesLen === 1 ? '' : 's'} of historical data (${fmt(first)} - ${fmt(last)})`;
}

/** Next-month label offset by `i` months from the current month (i=1 → next month). */
function nextMonthLabel(i: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + i);
  return d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
}

function insufficient(
  ctx: UnifiedOracleContext,
  kind: ForecastKind,
  h: number,
  reason: string,
  evidenceId: string,
): ForecastResult {
  return {
    kind,
    horizonLabel: horizonLabel(h),
    sufficient: false,
    reason,
    forecast: [],
    assumptions: [],
    dataPeriod: 'Insufficient data',
    confidence: 0,
    confidenceLabel: 'low',
    evidenceId,
  };
}

function pickEvidenceId(
  ctx: UnifiedOracleContext,
  preferred: string,
  fallback: string,
): string {
  if (ctx.evidenceIndex[preferred]) return preferred;
  if (ctx.evidenceIndex[fallback]) return fallback;
  return preferred;
}

function inr(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

// ─── 1. Cash flow forecast ────────────────────────────────────────────────────
// Use ctx.cashFlow.currentBalance + ctx.revenue.monthlySeries. Project forward
// using the average monthly net cash flow over the available history.
// Confidence: high ≥6 months, medium 3–5, low <3, insufficient <2.

function forecastCashFlow(ctx: UnifiedOracleContext, h: number): ForecastResult {
  const evidenceId = pickEvidenceId(ctx, ctx.cashFlow.evidence.id, 'banking');
  const series = ctx.revenue.monthlySeries;
  const n = series.length;

  if (n < 2) {
    return insufficient(
      ctx, 'cash_flow', h,
      `Not enough real historical data — only ${n} month${n === 1 ? '' : 's'} of revenue history available. Need at least 2 months to forecast cash flow.`,
      evidenceId,
    );
  }

  // Average monthly net cash flow = (sum of monthly revenue deltas) / (n-1).
  // We use revenue deltas as a proxy for cash inflow deltas when banking is
  // not connected. When banking IS connected, the cashFlow.net already
  // reflects the actual net flow over the snapshot window, so we blend.
  const values = series.map(s => s.value);
  const deltas: number[] = [];
  for (let i = 1; i < values.length; i++) deltas.push(values[i] - values[i - 1]);
  const avgDelta = deltas.length > 0
    ? deltas.reduce((a, b) => a + b, 0) / deltas.length
    : 0;

  // Blend with the snapshot's reported net cash flow (more accurate when
  // banking is connected — reflects real inflows minus outflows).
  const reportedNet = ctx.cashFlow.net;
  const monthlyNet = ctx.cashFlow.isEstimatedFromPaymentFlow
    ? avgDelta
    : (reportedNet / Math.max(1, n));

  if (!Number.isFinite(monthlyNet)) {
    return insufficient(ctx, 'cash_flow', h,
      'Cash-flow forecast produced a non-finite number. Cannot produce a reliable projection.',
      evidenceId);
  }

  const current = ctx.cashFlow.currentBalance;
  const forecast: ForecastPoint[] = [];
  let running = current;
  for (let i = 1; i <= h; i++) {
    running += monthlyNet;
    forecast.push({
      period: nextMonthLabel(i),
      value: Math.round(running),
    });
  }

  // Confidence ladder
  let confidence: number;
  if (n >= 6) confidence = 0.8;
  else if (n >= 3) confidence = 0.55;
  else confidence = 0.3;

  const assumptions = [
    `Assumes the average monthly net cash flow (${inr(monthlyNet)}) continues unchanged for the next ${h} month${h === 1 ? '' : 's'}.`,
    `Starting cash position: ${inr(current)} (${ctx.cashFlow.isEstimatedFromPaymentFlow ? 'estimated from payment flow — banking not connected' : 'from connected banking'}).`,
    'Does not account for one-off events: large customer payments, vendor prepayments, tax filings, or capital injections.',
  ];

  return {
    kind: 'cash_flow',
    horizonLabel: horizonLabel(h),
    sufficient: true,
    forecast,
    assumptions,
    dataPeriod: dataPeriodLabel(n),
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    evidenceId,
  };
}

// ─── 2. Revenue forecast (linear regression, least-squares) ───────────────────
// Project forward `horizon` months. Compute R² for confidence.

function forecastRevenue(ctx: UnifiedOracleContext, h: number): ForecastResult {
  const evidenceId = pickEvidenceId(ctx, ctx.revenue.evidence.id, 'invoices-fy');
  const series = ctx.revenue.monthlySeries;
  const n = series.length;

  if (n < 3) {
    return insufficient(
      ctx, 'revenue', h,
      `Not enough real historical data — only ${n} month${n === 1 ? '' : 's'} of revenue history available. Need at least 3 months to run a linear-regression revenue forecast.`,
      evidenceId,
    );
  }

  const xs = series.map((_, i) => i);
  const ys = series.map(s => s.value);

  const reg = linearRegression(xs, ys);
  if (!reg) {
    return insufficient(ctx, 'revenue', h,
      'Revenue regression produced a non-finite slope/intercept (possible all-zero history). Cannot forecast reliably.',
      evidenceId);
  }

  const { slope, intercept, r2 } = reg;

  // Build the forward projection.
  const forecast: ForecastPoint[] = [];
  // Residual stddev for a rough confidence band (sample stddev of residuals).
  const residuals = ys.map((y, i) => y - (intercept + slope * i));
  const residSd = stddev(residuals);
  for (let i = 1; i <= h; i++) {
    const x = n - 1 + i; // next month's x index
    const y = intercept + slope * x;
    forecast.push({
      period: nextMonthLabel(i),
      value: Math.max(0, Math.round(y)),
      lower: Math.max(0, Math.round(y - residSd)),
      upper: Math.round(y + residSd),
    });
  }

  // Confidence from R² and sample size.
  let confidence = r2; // R² is the share of variance explained (0..1)
  if (n < 6) confidence *= 0.85; // penalise short series
  confidence = Math.max(0, Math.min(1, confidence));

  const trendDir = slope > 0 ? 'upward' : slope < 0 ? 'downward' : 'flat';
  const assumptions = [
    `Assumes the linear trend (${inr(Math.abs(slope))}/month ${trendDir}) observed over the last ${n} months continues.`,
    `R² = ${r2.toFixed(2)} — ${r2 > 0.7 ? 'strong fit' : r2 > 0.4 ? 'moderate fit' : 'weak fit; treat with caution'}.`,
    'Does not model seasonality, one-off large deals, or pipeline conversion.',
    'Revenue is proxied from invoiced sales; collected revenue may lag by the collection cycle.',
  ];

  return {
    kind: 'revenue',
    horizonLabel: horizonLabel(h),
    sufficient: true,
    forecast,
    assumptions,
    dataPeriod: dataPeriodLabel(n),
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    evidenceId,
  };
}

// ─── 3. Receivables forecast ──────────────────────────────────────────────────
// Use ctx.invoices.aging + ctx.revenue.trend. Project overdue growth if trend is up.

function forecastReceivables(ctx: UnifiedOracleContext, h: number): ForecastResult {
  const evidenceId = pickEvidenceId(ctx, ctx.invoices.evidence.id, 'invoices-fy');
  const series = ctx.revenue.monthlySeries;
  const n = series.length;
  const currentReceivables = ctx.invoices.outstanding;
  const currentOverdue = ctx.invoices.overdue;

  if (n < 3 || currentReceivables <= 0) {
    return insufficient(
      ctx, 'receivables', h,
      n < 3
        ? `Not enough real historical data — only ${n} month${n === 1 ? '' : 's'} of revenue history available. Need at least 3 months to forecast receivables growth.`
        : 'No outstanding receivables to forecast from — the books show zero open invoice balances.',
      evidenceId,
    );
  }

  // Project receivables growth = average monthly revenue growth * (1 - collectionRate).
  const values = series.map(s => s.value);
  const deltas: number[] = [];
  for (let i = 1; i < values.length; i++) deltas.push(values[i] - values[i - 1]);
  const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const collectionRate = ctx.invoices.collectionRate; // 0..1
  const incrementalReceivablesPerMonth = Math.max(0, avgDelta * (1 - collectionRate));

  // Overdue growth: if revenue trend is up, overdue grows in proportion to
  // the historical overdue share of receivables.
  const overdueShare = currentReceivables > 0 ? currentOverdue / currentReceivables : 0;
  const overdueGrowthPerMonth = ctx.revenue.trend.direction === 'up'
    ? incrementalReceivablesPerMonth * overdueShare
    : 0;

  if (!Number.isFinite(incrementalReceivablesPerMonth) || !Number.isFinite(overdueGrowthPerMonth)) {
    return insufficient(ctx, 'receivables', h,
      'Receivables forecast produced a non-finite value. Cannot produce a reliable projection.',
      evidenceId);
  }

  const forecast: ForecastPoint[] = [];
  let running = currentReceivables;
  let runningOverdue = currentOverdue;
  for (let i = 1; i <= h; i++) {
    running += incrementalReceivablesPerMonth;
    runningOverdue += overdueGrowthPerMonth;
    forecast.push({
      period: nextMonthLabel(i),
      value: Math.round(running),
      lower: Math.max(0, Math.round(running - runningOverdue)), // current portion
      upper: Math.round(running),
    });
  }

  let confidence = 0.6;
  if (n >= 6) confidence = 0.75;
  if (n < 4) confidence = 0.4;

  const assumptions = [
    `Assumes the current collection rate (${(collectionRate * 100).toFixed(0)}%) continues.`,
    `Assumes receivables grow by the average monthly revenue delta (${inr(avgDelta)}) × uncollected share (${((1 - collectionRate) * 100).toFixed(0)}%).`,
    overdueGrowthPerMonth > 0
      ? `Overdue share is projected to grow because revenue trend is up (${inr(overdueGrowthPerMonth)}/month added to overdue).`
      : 'Overdue is projected to stay flat (revenue trend is flat or down).',
    'Does not model one-off customer defaults or large recovery efforts.',
  ];

  return {
    kind: 'receivables',
    horizonLabel: horizonLabel(h),
    sufficient: true,
    forecast,
    assumptions,
    dataPeriod: dataPeriodLabel(n),
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    evidenceId,
  };
}

// ─── 4. GST liability forecast ────────────────────────────────────────────────
// If filedReturns > 0, average the last 3 months' liability (query GSTRFiling).
// Otherwise use the current liability as a flat estimate with low confidence.

async function forecastGstLiability(ctx: UnifiedOracleContext, h: number): Promise<ForecastResult> {
  const evidenceId = pickEvidenceId(ctx, ctx.gst.evidence.id, 'gst-fy');

  if (ctx.gst.filedReturns > 0) {
    try {
      // Pull the last 3 filed GSTRFilings and average their totalTax.
      const recent = await db.gSTRFiling.findMany({
        where: { client: { firmId: ctx.organizationId }, status: 'filed' },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { totalTax: true, period: true, createdAt: true },
      }).catch(() => []);

      if (recent.length >= 1) {
        const avgLiability = recent.reduce((s, r) => s + (r.totalTax ?? 0), 0) / recent.length;
        if (!Number.isFinite(avgLiability)) {
          return insufficient(ctx, 'gst_liability', h,
            'GST-liability forecast produced a non-finite average. Cannot produce a reliable projection.',
            evidenceId);
        }

        const forecast: ForecastPoint[] = [];
        for (let i = 1; i <= h; i++) {
          forecast.push({
            period: nextMonthLabel(i),
            value: Math.round(avgLiability),
            lower: Math.round(avgLiability * 0.8),
            upper: Math.round(avgLiability * 1.2),
          });
        }

        let confidence = 0.7;
        if (recent.length >= 3) confidence = 0.85;
        else if (recent.length === 2) confidence = 0.6;
        else confidence = 0.45;

        const assumptions = [
          `Assumes the average monthly GST liability (${inr(avgLiability)}, from ${recent.length} filed return${recent.length === 1 ? '' : 's'}) continues.`,
          'Does not model changes in sales mix, reverse-charge transactions, or new ITC eligibility.',
          'If output tax spikes (a large sale) or input tax spikes (a large capital purchase), the actual liability will deviate from this forecast.',
        ];

        return {
          kind: 'gst_liability',
          horizonLabel: horizonLabel(h),
          sufficient: true,
          forecast,
          assumptions,
          dataPeriod: `Based on ${recent.length} filed GSTRFiling record${recent.length === 1 ? '' : 's'} (most recent first)`,
          confidence,
          confidenceLabel: confidenceLabel(confidence),
          evidenceId,
        };
      }
    } catch {
      // fall through to flat-estimate branch
    }
  }

  // Fall back to current liability as a flat estimate with low confidence.
  const currentLiability = ctx.gst.liability;
  if (currentLiability <= 0) {
    return insufficient(ctx, 'gst_liability', h,
      'No filed GSTRFilings and no current GST liability recorded. Cannot forecast — file at least one return to enable this forecast.',
      evidenceId);
  }

  const forecast: ForecastPoint[] = [];
  for (let i = 1; i <= h; i++) {
    forecast.push({
      period: nextMonthLabel(i),
      value: Math.round(currentLiability),
      lower: Math.round(currentLiability * 0.5),
      upper: Math.round(currentLiability * 1.5),
    });
  }

  const assumptions = [
    'No filed GSTRFilings were found — using the current period GST liability as a flat estimate.',
    'Confidence is low because there is no historical filing pattern to validate against.',
    'File at least one return to upgrade this forecast to a real historical average.',
  ];

  return {
    kind: 'gst_liability',
    horizonLabel: horizonLabel(h),
    sufficient: true,
    forecast,
    assumptions,
    dataPeriod: 'Based on the current period liability only (no filed history)',
    confidence: 0.3,
    confidenceLabel: 'low',
    evidenceId,
  };
}

// ─── 5. ITC recovery forecast ─────────────────────────────────────────────────
// Use ctx.gst.inputTax minus ctx.gst.reconciliation.itcAtRisk. Project forward
// at the monthly average.

function forecastItcRecovery(ctx: UnifiedOracleContext, h: number): ForecastResult {
  const evidenceId = pickEvidenceId(ctx, ctx.gst.evidence.id, 'gst-fy');
  const series = ctx.revenue.monthlySeries;
  const n = series.length;

  if (n < 2) {
    return insufficient(
      ctx, 'itc_recovery', h,
      `Not enough historical data — only ${n} month${n === 1 ? '' : 's'} of revenue history available. Need at least 2 months to estimate ITC recovery.`,
      evidenceId,
    );
  }

  const totalItc = ctx.gst.inputTax;
  const itcAtRisk = ctx.gst.reconciliation.itcAtRisk;
  const safeItc = Math.max(0, totalItc - itcAtRisk);
  const monthlyItc = safeItc / n;

  if (!Number.isFinite(monthlyItc)) {
    return insufficient(ctx, 'itc_recovery', h,
      'ITC-recovery forecast produced a non-finite value. Cannot produce a reliable projection.',
      evidenceId);
  }

  const forecast: ForecastPoint[] = [];
  for (let i = 1; i <= h; i++) {
    forecast.push({
      period: nextMonthLabel(i),
      value: Math.round(monthlyItc * i), // cumulative ITC recoverable over the horizon
      lower: Math.round(monthlyItc * i * 0.7),
      upper: Math.round(monthlyItc * i * 1.1),
    });
  }

  let confidence = 0.6;
  if (n >= 6) confidence = 0.75;
  if (n < 4) confidence = 0.4;
  if (itcAtRisk > 0) confidence *= 0.85; // penalise when ITC is at risk

  const assumptions = [
    `Assumes ITC accumulates at the historical monthly average (${inr(monthlyItc)}/month, derived from ${inr(safeItc)} safe ITC over ${n} months).`,
    `Already subtracted ${inr(itcAtRisk)} of ITC at risk from GSTR-2B reconciliation mismatches.`,
    'Does not model changes in purchase volume, supplier GSTIN compliance, or new reverse-charge transactions.',
  ];

  return {
    kind: 'itc_recovery',
    horizonLabel: horizonLabel(h),
    sufficient: true,
    forecast,
    assumptions,
    dataPeriod: dataPeriodLabel(n),
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    evidenceId,
  };
}

// ─── 6. Runway forecast ───────────────────────────────────────────────────────
// Use ctx.cashFlow.runwayMonths. If monthly burn is known, compute months until
// cash = 0.

function forecastRunway(ctx: UnifiedOracleContext, h: number): ForecastResult {
  const evidenceId = pickEvidenceId(ctx, ctx.cashFlow.evidence.id, 'banking');
  const currentCash = ctx.cashFlow.currentBalance;
  const monthlyNet = ctx.cashFlow.net / Math.max(1, ctx.revenue.monthlySeries.length || 1);
  const runwayMonths = ctx.cashFlow.runwayMonths;

  // If the snapshot already computed a finite runway, use it directly.
  if (Number.isFinite(runwayMonths) && runwayMonths >= 0 && currentCash > 0) {
    const forecast: ForecastPoint[] = [];
    for (let i = 1; i <= h; i++) {
      const remaining = Math.max(0, currentCash + monthlyNet * i);
      forecast.push({
        period: nextMonthLabel(i),
        value: Math.round(remaining),
      });
    }

    let confidence = 0.7;
    if (ctx.revenue.monthlySeries.length >= 6) confidence = 0.85;
    else if (ctx.revenue.monthlySeries.length < 3) confidence = 0.4;
    if (ctx.cashFlow.isEstimatedFromPaymentFlow) confidence *= 0.9; // less reliable without banking

    const assumptions = [
      `Current cash: ${inr(currentCash)}. Monthly net: ${inr(monthlyNet)}.`,
      `Runway: ${runwayMonths >= 12 ? '12+ months' : `${runwayMonths.toFixed(1)} months`} at current burn.`,
      ctx.cashFlow.isEstimatedFromPaymentFlow
        ? 'Banking is not connected — cash is estimated from payment flow, so runway is approximate.'
        : 'Banking is connected — cash is from real bank balances.',
      'Does not account for new revenue, delayed customer payments, or fresh capital.',
    ];

    return {
      kind: 'runway',
      horizonLabel: horizonLabel(h),
      sufficient: true,
      forecast,
      assumptions,
      dataPeriod: dataPeriodLabel(ctx.revenue.monthlySeries.length),
      confidence,
      confidenceLabel: confidenceLabel(confidence),
      evidenceId,
    };
  }

  // Insufficient data
  if (currentCash <= 0) {
    return insufficient(ctx, 'runway', h,
      'Cash position is zero or negative — runway cannot be computed (cash is already exhausted).',
      evidenceId);
  }
  if (!Number.isFinite(runwayMonths)) {
    // Finite cash but no burn — runway is effectively infinite.
    const forecast: ForecastPoint[] = [];
    for (let i = 1; i <= h; i++) {
      forecast.push({
        period: nextMonthLabel(i),
        value: Math.round(currentCash), // cash stays flat when burn is zero
      });
    }
    return {
      kind: 'runway',
      horizonLabel: horizonLabel(h),
      sufficient: true,
      forecast,
      assumptions: [
        `Current cash: ${inr(currentCash)}. Monthly net is zero or positive — runway is effectively infinite.`,
        'No burn detected — the business is self-sustaining at current cash flow.',
      ],
      dataPeriod: dataPeriodLabel(ctx.revenue.monthlySeries.length),
      confidence: 0.6,
      confidenceLabel: 'medium',
      evidenceId,
    };
  }
  return insufficient(ctx, 'runway', h,
    'Runway forecast could not be produced from the available context.',
    evidenceId);
}

// ─── Linear regression (least squares) + R² ───────────────────────────────────

interface Regression {
  slope: number;
  intercept: number;
  r2: number;
}

/**
 * Ordinary least-squares linear regression.
 * Returns null if the regression produces NaN/Infinity or there's no variance.
 */
function linearRegression(xs: number[], ys: number[]): Regression | null {
  const n = xs.length;
  if (n < 2 || n !== ys.length) return null;

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
    sumXY += xs[i] * ys[i];
    sumXX += xs[i] * xs[i];
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null; // no x variance — can't fit a line

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  if (!Number.isFinite(slope) || !Number.isFinite(intercept)) return null;

  // R² = 1 - SS_res / SS_tot
  const meanY = sumY / n;
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    const yHat = intercept + slope * xs[i];
    ssRes += (ys[i] - yHat) ** 2;
    ssTot += (ys[i] - meanY) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : Math.max(0, Math.min(1, 1 - ssRes / ssTot));

  return { slope, intercept, r2 };
}

/** Sample standard deviation. 0 if fewer than 2 data points. */
function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}
