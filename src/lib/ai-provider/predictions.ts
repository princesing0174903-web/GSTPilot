// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Oracle™ & AI CFO™ — Predictions Engine
//
// PURE, CLIENT-SAFE functions that forecast revenue and cash flow for the
// next N months using the real BusinessContext. The Mock provider uses a
// deterministic linear-trend + moving-average model; future LLM providers
// can swap in more sophisticated models.
//
// Methodology (deterministic):
//   • Take the current + previous period values.
//   • Compute the month-over-month growth rate.
//   • Project forward applying a dampened growth rate (50% of historical
//     growth) to avoid runaway extrapolation.
//   • Build a ±15% confidence interval around each projection.
//   • Confidence (0-1) is higher when there's more historical data and lower
//     variance.
// ═══════════════════════════════════════════════════════════════════════════════

import type { BusinessContext, Insight, Prediction, PredictionPoint, Recommendation } from './types';
import { formatINR, periodLabel, periodPlus } from './knowledge';

/**
 * Predict revenue for the next N months.
 */
export function predictRevenueFromContext(context: BusinessContext, months: number): Prediction {
  const points: PredictionPoint[] = [];
  const current = context.revenue.current;
  const previous = context.revenue.previous;

  // Growth rate (dampened to 50% of historical to avoid runaway).
  let growthRate = 0;
  if (previous > 0) {
    growthRate = ((current - previous) / previous) * 0.5;
  }
  // Clamp growth to ±30% per month.
  growthRate = Math.max(-0.3, Math.min(0.3, growthRate));

  let base = current > 0 ? current : previous;
  for (let i = 1; i <= months; i++) {
    const projectedPeriod = periodPlus(context.period, i);
    base = Math.max(0, base * (1 + growthRate));
    const lower = Math.max(0, base * 0.85);
    const upper = base * 1.15;
    points.push({
      label: periodLabel(projectedPeriod),
      value: Math.round(base),
      lower: Math.round(lower),
      upper: Math.round(upper),
    });
  }

  const totalProjected = points.reduce((acc, p) => acc + p.value, 0);
  const trend = growthRate > 0.02 ? 'growing' : growthRate < -0.02 ? 'declining' : 'stable';
  const summary =
    points.length === 0
      ? 'Insufficient data to forecast revenue.'
      : `Projected revenue for the next ${months} month${months === 1 ? '' : 's'} is ${formatINR(totalProjected)} total, trending ${trend} based on the current month-over-month rate (${(growthRate * 100).toFixed(1)}%).`;

  // Confidence: higher with more historical data.
  const confidence = previous > 0 && current > 0 ? 0.75 : current > 0 ? 0.5 : 0.25;

  return {
    metric: 'revenue',
    points,
    summary,
    confidence,
    method: 'dampened-linear-trend (mock)',
  };
}

/**
 * Predict cash flow for the next N months.
 */
export function predictCashFlowFromContext(context: BusinessContext, months: number): Prediction {
  const points: PredictionPoint[] = [];
  const currentNet = context.cashFlow.netInflow;
  const burnRate = context.cashFlow.burnRate;

  // If we have banking data, project net inflow forward (assume it persists).
  // Otherwise estimate from revenue - expenses trend.
  let projectedNet: number;
  if (context.bankConnected) {
    projectedNet = currentNet;
  } else {
    // Estimate: revenue - expenses as a proxy, dampened.
    const profitTrend = context.revenue.changePercent - context.expenses.changePercent;
    projectedNet = context.profit.current * (1 + Math.max(-0.3, Math.min(0.3, profitTrend / 100)));
  }

  let cumulativeBalance = context.banking.availableBalance;
  for (let i = 1; i <= months; i++) {
    const projectedPeriod = periodPlus(context.period, i);
    cumulativeBalance += projectedNet;
    const lower = cumulativeBalance - Math.abs(projectedNet) * 0.3;
    const upper = cumulativeBalance + Math.abs(projectedNet) * 0.3;
    points.push({
      label: periodLabel(projectedPeriod),
      value: Math.round(cumulativeBalance),
      lower: Math.round(lower),
      upper: Math.round(upper),
    });
  }

  const finalBalance = points.length > 0 ? points[points.length - 1].value : cumulativeBalance;
  const trend = projectedNet > 0 ? 'improving' : projectedNet < 0 ? 'declining' : 'stable';
  const summary =
    points.length === 0
      ? 'Insufficient data to forecast cash flow.'
      : `Projected bank balance in ${months} month${months === 1 ? '' : 's'}: ${formatINR(finalBalance)}, trending ${trend}. Monthly net: ${formatINR(projectedNet)}.`;

  const confidence = context.bankConnected ? 0.7 : 0.4;

  return {
    metric: 'cashflow',
    points,
    summary,
    confidence,
    method: 'net-inflow-persistence (mock)',
  };
}

/**
 * Generate a concise executive brief from the context + insights + recs.
 */
export function generateBriefFromContext(
  context: BusinessContext,
  insights: Insight[],
  recommendations: Recommendation[],
): string {
  const parts: string[] = [];

  // One-liner business state.
  parts.push(
    `${periodLabel(context.period)}: revenue ${formatINR(context.revenue.current)}${
      context.revenue.previous > 0 ? ` (${context.revenue.changePercent >= 0 ? '+' : ''}${context.revenue.changePercent.toFixed(1)}%)` : ''
    }, profit ${formatINR(context.profit.current)}, bank ${formatINR(context.banking.totalBalance)}.`,
  );

  // Top insight (most severe).
  const topInsight = insights[0];
  if (topInsight) {
    parts.push(`Top signal: ${topInsight.title.toLowerCase()}.`);
  }

  // Top recommendation.
  const topRec = recommendations[0];
  if (topRec) {
    parts.push(`Priority: ${topRec.title}.`);
  }

  return parts.join(' ');
}
