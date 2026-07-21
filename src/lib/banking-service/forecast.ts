// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Service — Cash Flow Forecast Helpers (Pure Functions)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Pure math + narrative generation for projecting the bank balance forward.
// The MockBankingProvider (and any future provider) builds a CashFlowPoint[]
// from history, calls computeForecast(), then buildNarrative() to assemble
// the final CashFlowForecast object.
//
// Forecast model (deliberately simple — explainable, not a black box):
//
//   avgInflow    = mean(daily inflow over the last 60 days)
//   avgOutflow   = mean(daily outflow over the last 60 days)
//   dailyNet     = avgInflow - avgOutflow
//   volatilityσ  = stddev(daily net) over the same window
//
// For each future day t (1..horizon):
//   projectedBalance[t] = projectedBalance[t-1] + dailyNet
//   lowBalance[t]       = projectedBalance[t] - 1.15 * σ  (pessimistic band)
//   highBalance[t]      = projectedBalance[t] + 1.15 * σ  (optimistic band)
//
// We use ±1.15σ ≈ ±15% of the typical daily swing to form a "soft" confidence
// band. Real banking data is heavy-tailed; a 95% (±2σ) band would be too wide
// to be actionable for an SME owner.
//
//   runwayDays = first day t where projectedBalance[t] ≤ 0 (Infinity if never)
//   minBalance = min over horizon of lowBalance[t]
//   confidence = clamp(0.5 + 0.4*dataFactor - 0.3*volatilityFactor, 0.2, 0.95)
//
// Confidence rises with more historical data points (saturates at 30) and
// falls with relative volatility (σ / |avgInflow|). It's clamped to [0.2, 0.95]
// — we never claim 100% certainty about the future.
// ═══════════════════════════════════════════════════════════════════════════════

import type { CashFlowForecast, CashFlowPoint, ForecastPoint } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Stats helpers ────────────────────────────────────────────────────────────

function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── computeForecast ──────────────────────────────────────────────────────────

export interface ComputeForecastInput {
  history: CashFlowPoint[]; // historical daily series (chronological, oldest→newest)
  currentBalance: number;
  horizon: '7d' | '30d';
}

export type ComputedForecast = Omit<
  CashFlowForecast,
  'narrative' | 'risks' | 'recommendations'
>;

/**
 * Project the bank balance forward. See module header for the model.
 *
 * `history` should be the last ~60 days of CashFlowPoint (older→newer). If
 * fewer than 7 points are supplied, we still produce a forecast but with a
 * low confidence score — the caller (narrative) will flag this.
 */
export function computeForecast(opts: ComputeForecastInput): ComputedForecast {
  const { history, currentBalance, horizon } = opts;
  const horizonDays = horizon === '7d' ? 7 : 30;

  // Use up to the last 60 days of history for the baseline. The series may be
  // shorter; we handle gracefully.
  const window = history.slice(-60);

  const inflows = window.map((p) => p.inflow);
  const outflows = window.map((p) => p.outflow);
  const nets = window.map((p) => p.net);

  const avgInflow = mean(inflows);
  const avgOutflow = mean(outflows);
  const dailyNet = avgInflow - avgOutflow;
  const sigma = stddev(nets);

  // Walk forward day-by-day.
  const points: ForecastPoint[] = [];
  let balance = currentBalance;
  let minBalance = currentBalance;
  let minBalanceDate: string | undefined;
  let runwayDays = Infinity;
  let hitZero = false;

  // Start projecting from tomorrow.
  const today = new Date();
  for (let i = 1; i <= horizonDays; i++) {
    const d = new Date(today.getTime() + i * DAY_MS);
    balance += dailyNet;
    const low = balance - 1.15 * sigma;
    const high = balance + 1.15 * sigma;

    points.push({
      date: isoDate(d),
      projectedInflow: Math.max(0, avgInflow),
      projectedOutflow: Math.max(0, avgOutflow),
      projectedBalance: Math.round(balance * 100) / 100,
      lowBalance: Math.round(low * 100) / 100,
      highBalance: Math.round(high * 100) / 100,
    });

    if (low < minBalance) {
      minBalance = low;
      minBalanceDate = isoDate(d);
    }

    if (!hitZero && balance <= 0) {
      runwayDays = i;
      hitZero = true;
    }
  }

  const projectedEndBalance = balance;

  // Confidence: rises with data volume (saturates at 30 days), falls with
  // relative volatility (σ / |avgInflow|, capped at 1.0).
  const dataFactor = clamp(window.length / 30, 0, 1);
  const inflowMag = Math.max(1, Math.abs(avgInflow));
  const volatilityFactor = clamp(sigma / inflowMag, 0, 1);
  const confidence = clamp(0.5 + 0.4 * dataFactor - 0.3 * volatilityFactor, 0.2, 0.95);

  return {
    horizon,
    points,
    projectedEndBalance: Math.round(projectedEndBalance * 100) / 100,
    runwayDays,
    minBalance: Math.round(minBalance * 100) / 100,
    minBalanceDate,
    confidence: Math.round(confidence * 100) / 100,
  };
}

// ─── buildNarrative ───────────────────────────────────────────────────────────

const fmtINR = (n: number): string => {
  // Indian-style grouping (lakh / crore). Negative numbers preserved.
  const neg = n < 0;
  const abs = Math.abs(Math.round(n));
  const s = abs.toLocaleString('en-IN');
  return `${neg ? '-' : ''}₹${s}`;
};

/**
 * Generate the human-readable narrative + risks + recommendations from the
 * computed forecast numbers. This is what surfaces in the UI as the
 * "Cash Flow Forecast" card and what the Oracle banking intelligence reads
 * aloud when the user asks "how much cash will I have next week".
 */
export function buildNarrative(
  forecast: ComputedForecast,
  currentBalance: number,
): { narrative: string; risks: string[]; recommendations: string[] } {
  const risks: string[] = [];
  const recommendations: string[] = [];

  const horizonDays = forecast.horizon === '7d' ? 7 : 30;
  const horizonLabel = forecast.horizon === '7d' ? 'next 7 days' : 'next 30 days';
  const change = forecast.projectedEndBalance - currentBalance;
  const changePct = currentBalance !== 0 ? (change / Math.abs(currentBalance)) * 100 : 0;

  // Risk: projected to dip below a sensible threshold.
  if (forecast.minBalance < currentBalance * 0.2 && forecast.minBalanceDate) {
    risks.push(
      `Projected to dip to ${fmtINR(forecast.minBalance)} on ${forecast.minBalanceDate} ` +
        `(only ~${Math.round((forecast.minBalance / Math.max(1, currentBalance)) * 100)}% of today's balance).`,
    );
  }
  if (forecast.runwayDays !== Infinity && forecast.runwayDays <= horizonDays) {
    risks.push(
      `At the current burn rate, the balance is projected to hit zero in ${forecast.runwayDays} day(s).`,
    );
  }
  if (change < 0 && Math.abs(change) > currentBalance * 0.1) {
    risks.push(
      `Net outflow of ${fmtINR(Math.abs(change))} projected over the ${horizonLabel} ` +
        `(${Math.abs(changePct).toFixed(1)}% decline).`,
    );
  }

  // Recommendations.
  if (risks.length > 0) {
    recommendations.push('Expedite collection of overdue invoices to improve inflow timing.');
    recommendations.push('Review discretionary outflows (vendor payments, capex) scheduled in this window.');
  } else if (change >= 0) {
    recommendations.push(
      `Healthy trajectory — balance projected to grow by ${fmtINR(change)} (${changePct.toFixed(1)}%). ` +
        `Consider parking surplus in a sweep FD for incremental yield.`,
    );
  } else {
    recommendations.push(
      `Mild outflow of ${fmtINR(Math.abs(change))} projected — within normal operating range.`,
    );
  }

  if (forecast.confidence < 0.5) {
    recommendations.push(
      'Forecast confidence is low — connect more bank accounts or import recent statements to improve projections.',
    );
  }

  // Compose narrative (2–4 sentences).
  const dir = change >= 0 ? 'grow' : 'decline';
  const narrativeParts: string[] = [];
  narrativeParts.push(
    `Based on the last 60 days of activity, your bank balance is projected to ${dir} from ${fmtINR(currentBalance)} to ${fmtINR(forecast.projectedEndBalance)} over the ${horizonLabel} ` +
      `(${Math.abs(changePct).toFixed(1)}% ${change >= 0 ? 'increase' : 'decrease'}).`,
  );
  if (forecast.minBalance < currentBalance * 0.5 && forecast.minBalanceDate) {
    narrativeParts.push(
      `The lowest projected point is ${fmtINR(forecast.minBalance)} around ${forecast.minBalanceDate}.`,
    );
  }
  if (forecast.runwayDays !== Infinity && forecast.runwayDays <= horizonDays) {
    narrativeParts.push(
      `At the current net burn, the balance could reach zero within ${forecast.runwayDays} day(s) — flag this for immediate collection action.`,
    );
  }
  narrativeParts.push(
    `Forecast confidence is ${(forecast.confidence * 100).toFixed(0)}% — treat the bands as guidance, not certainty.`,
  );

  return {
    narrative: narrativeParts.join(' '),
    risks,
    recommendations,
  };
}
