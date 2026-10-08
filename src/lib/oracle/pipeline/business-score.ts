// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Business Score Engine (PROMPT 5)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Always calculates 8 dimensions of business health + an overall score:
//   1. Revenue Score        — sales volume & momentum
//   2. Profitability Score  — margin & profit
//   3. Liquidity Score      — cash, runway, working capital
//   4. Compliance Score     — GST filings, notices, deadlines
//   5. Customer Health      — concentration, risk distribution
//   6. Risk Score           — inverted (low risk = high score)
//   7. Growth Score         — MoM momentum, forecast trend
//   8. Overall Business Health — weighted composite
//
// Every score is computed DETERMINISTICALLY from real Prisma data. The LLM
// never sets scores. Each component carries a grade + reason.
// ═══════════════════════════════════════════════════════════════════════════════

import 'server-only';
import type { BusinessScorecard, ScoreComponent } from './types';
import type { BusinessSnapshot } from '@/lib/business/snapshot';

/** Map a 0-100 score to a letter grade. */
function grade(score: number): ScoreComponent['grade'] {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 30) return 'Poor';
  return 'Critical';
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Compute the full business scorecard from a real snapshot. */
export function computeBusinessScorecard(snap: BusinessSnapshot | null): BusinessScorecard | null {
  if (!snap) return null;

  // ─── 1. Revenue Score ──────────────────────────────────────────────────────
  // Strong if revenue > ₹5L, decent > ₹1L, weak otherwise. Boost for MoM growth.
  const revBase = snap.revenue >= 500000 ? 85
    : snap.revenue >= 100000 ? 65
    : snap.revenue > 0 ? 45
    : 20;
  const growth = snap.revenueLastMonth > 0
    ? (snap.revenueThisMonth - snap.revenueLastMonth) / snap.revenueLastMonth
    : 0;
  const revenue: ScoreComponent = {
    key: 'revenue',
    label: 'Revenue',
    score: clamp(revBase + growth * 30),
    grade: 'Fair',
    reason: `${snap.revenueThisMonth > 0 ? `₹${(snap.revenueThisMonth / 1000).toFixed(1)}K this month` : 'no sales this month'}${growth !== 0 ? ` · ${growth >= 0 ? '+' : ''}${(growth * 100).toFixed(1)}% MoM` : ''}`,
  };
  revenue.grade = grade(revenue.score);

  // ─── 2. Profitability Score ────────────────────────────────────────────────
  const margin = snap.profitMargin;
  const profitability: ScoreComponent = {
    key: 'profitability',
    label: 'Profitability',
    score: clamp(
      margin >= 0.4 ? 90
      : margin >= 0.2 ? 75
      : margin >= 0.1 ? 60
      : margin >= 0 ? 45
      : 25
    ),
    grade: 'Fair',
    reason: `${(margin * 100).toFixed(1)}% net margin · profit ₹${(snap.profit / 1000).toFixed(1)}K`,
  };
  profitability.grade = grade(profitability.score);

  // ─── 3. Liquidity Score ────────────────────────────────────────────────────
  // Cash position + runway. Runway < 30 days is critical.
  const runway = snap.runwayDays;
  const cashScore = snap.cash > 0 ? 60 : 20;
  const runwayScore = !isFinite(runway) ? 90
    : runway >= 180 ? 95
    : runway >= 90 ? 80
    : runway >= 60 ? 65
    : runway >= 30 ? 50
    : runway >= 15 ? 30
    : 15;
  const liquidity: ScoreComponent = {
    key: 'liquidity',
    label: 'Liquidity',
    score: clamp(Math.round(cashScore * 0.4 + runwayScore * 0.6)),
    grade: 'Fair',
    reason: `₹${(snap.cash / 1000).toFixed(1)}K cash · ${isFinite(runway) ? `${runway}d runway` : '∞ runway'} · WC ₹${(snap.workingCapital / 1000).toFixed(1)}K`,
  };
  liquidity.grade = grade(liquidity.score);

  // ─── 4. Compliance Score ───────────────────────────────────────────────────
  const totalReturns = snap.filedReturns + snap.pendingReturns;
  const filedRatio = totalReturns > 0 ? snap.filedReturns / totalReturns : 1;
  const compliance: ScoreComponent = {
    key: 'compliance',
    label: 'Compliance',
    score: clamp(
      snap.overdueReturns > 0 ? 25
      : filedRatio >= 1 ? 95
      : filedRatio >= 0.7 ? 70
      : filedRatio >= 0.4 ? 50
      : 30
    ),
    grade: 'Fair',
    reason: `${snap.filedReturns}/${totalReturns} returns filed · ${snap.overdueReturns} overdue`,
  };
  compliance.grade = grade(compliance.score);

  // ─── 5. Customer Health ────────────────────────────────────────────────────
  // Penalize high concentration (>30% from one customer) and risky customers.
  const concentration = snap.topCustomerShare;
  const concentrationScore = concentration <= 0.15 ? 90
    : concentration <= 0.30 ? 70
    : concentration <= 0.50 ? 50
    : 30;
  const customerHealth: ScoreComponent = {
    key: 'customerHealth',
    label: 'Customer Health',
    score: clamp(concentrationScore),
    grade: 'Fair',
    reason: `${snap.customerCount} customers · top customer ${(concentration * 100).toFixed(1)}% of revenue`,
  };
  customerHealth.grade = grade(customerHealth.score);

  // ─── 6. Risk Score (inverted — high risk = low score) ──────────────────────
  const risk: ScoreComponent = {
    key: 'risk',
    label: 'Risk Resilience',
    score: clamp(100 - snap.riskScore),
    grade: 'Fair',
    reason: `composite risk index ${snap.riskScore}/100`,
  };
  risk.grade = grade(risk.score);

  // ─── 7. Growth Score ───────────────────────────────────────────────────────
  const growthScore = growth >= 0.25 ? 90
    : growth >= 0.10 ? 80
    : growth >= 0.03 ? 70
    : growth >= -0.05 ? 55
    : growth >= -0.15 ? 40
    : 25;
  const trendBoost = snap.forecast.trend === 'up' ? 5 : snap.forecast.trend === 'down' ? -5 : 0;
  const growthComp: ScoreComponent = {
    key: 'growth',
    label: 'Growth',
    score: clamp(growthScore + trendBoost),
    grade: 'Fair',
    reason: `${growth >= 0 ? '+' : ''}${(growth * 100).toFixed(1)}% MoM · forecast ${snap.forecast.trend} (${(snap.forecast.confidence * 100).toFixed(0)}% conf)`,
  };
  growthComp.grade = grade(growthComp.score);

  // ─── 8. Overall Business Health (weighted composite) ───────────────────────
  // Weights chosen to reflect CFO priorities: liquidity + profitability dominate.
  const weights = {
    revenue: 0.15,
    profitability: 0.20,
    liquidity: 0.20,
    compliance: 0.15,
    customerHealth: 0.10,
    risk: 0.10,
    growth: 0.10,
  };
  const overallScore = Math.round(
    revenue.score * weights.revenue +
    profitability.score * weights.profitability +
    liquidity.score * weights.liquidity +
    compliance.score * weights.compliance +
    customerHealth.score * weights.customerHealth +
    risk.score * weights.risk +
    growthComp.score * weights.growth
  );
  const overall: ScoreComponent = {
    key: 'overall',
    label: 'Overall Business Health',
    score: clamp(overallScore),
    grade: 'Fair',
    reason: `composite of 7 dimensions · health ${snap.healthScore}/100`,
  };
  overall.grade = grade(overall.score);

  return {
    revenue,
    profitability,
    liquidity,
    compliance,
    customerHealth,
    risk,
    growth: growthComp,
    overall,
  };
}
