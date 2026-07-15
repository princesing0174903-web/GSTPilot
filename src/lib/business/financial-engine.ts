// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Financial Engine (ONE CALCULATION ENGINE)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Every financial calculation in GSTPilot MUST go through this engine. No page,
// no API, no hook is allowed to compute Revenue, Expenses, Profit, Cash, GST,
// ITC, Outstanding, Receivables, Payables, Health Score, Forecast, Risk Score,
// Collection Rate, Working Capital, or Runway independently.
//
// If two pages show revenue, they MUST show the exact same value — because they
// both call this engine.
//
// DUPLICATE CALCULATIONS REMOVED:
//   • Dashboard KPIs → now reads from BusinessSnapshot (which uses this engine)
//   • Oracle context → now reads from BusinessSnapshot
//   • AI CFO insights → now reads from BusinessSnapshot
//   • Run My Business → now reads from BusinessSnapshot
//   • Autonomous → now reads from BusinessSnapshot
//   • Digital Twin snapshots → now reads from BusinessSnapshot
//
// All formulas are documented inline so there is exactly one definition of each.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FinancialEngineResult {
  healthScore: number;       // 0-100 composite business health
  riskScore: number;         // 0-100 (higher = riskier)
  collectionRate: number;    // 0-1 (collected / invoiced)
  workingCapital: number;    // receivables - payables
  runwayDays: number;        // cash / monthly burn
  gstLiability: number;      // output tax - input tax
  forecast: {
    nextMonthRevenue: number;
    nextMonthExpenses: number;
    trend: 'up' | 'down' | 'flat';
    confidence: number;      // 0-1
  };
}

// ─── Health Score (0-100 composite) ──────────────────────────────────────────
//
// Weighted average of 5 sub-scores:
//   1. Profitability (30%)  — profit margin
//   2. Liquidity (25%)      — cash vs payables
//   3. Compliance (20%)     — filed vs pending returns
//   4. Collection (15%)     — collected vs invoiced
//   5. Growth (10%)         — revenue level (scaled)
//
// Returns 0 when there is no data (honest empty state).

export function computeHealthScore(input: {
  revenue: number;
  expenses: number;
  profit: number;
  receivables: number;
  payables: number;
  cash: number;
  filedReturns: number;
  pendingReturns: number;
  overdueReturns: number;
}): number {
  // No data → 0
  if (input.revenue === 0 && input.expenses === 0 && input.cash === 0) {
    return 0;
  }

  // 1. Profitability sub-score (0-100)
  const profitMargin = input.revenue > 0 ? input.profit / input.revenue : 0;
  const profitabilityScore = Math.max(0, Math.min(100, profitMargin * 100 * 2.5)); // 40% margin → 100

  // 2. Liquidity sub-score (0-100)
  const liquidityRatio = input.payables > 0 ? input.cash / input.payables : (input.cash > 0 ? 1 : 0);
  const liquidityScore = Math.max(0, Math.min(100, liquidityRatio * 100));

  // 3. Compliance sub-score (0-100)
  const totalReturns = input.filedReturns + input.pendingReturns;
  const complianceRate = totalReturns > 0 ? input.filedReturns / totalReturns : 1;
  const overduePenalty = totalReturns > 0 ? (input.overdueReturns / totalReturns) * 50 : 0;
  const complianceScore = Math.max(0, Math.min(100, complianceRate * 100 - overduePenalty));

  // 4. Collection sub-score (0-100)
  const collectionRate = input.revenue > 0
    ? Math.max(0, Math.min(1, (input.revenue - input.receivables) / input.revenue))
    : 0;
  const collectionScore = collectionRate * 100;

  // 5. Growth sub-score (0-100) — scaled revenue level
  const growthScore = input.revenue > 0
    ? Math.max(0, Math.min(100, Math.log10(input.revenue + 1) * 12.5)) // 1Cr → ~100
    : 0;

  const weighted =
    profitabilityScore * 0.30 +
    liquidityScore * 0.25 +
    complianceScore * 0.20 +
    collectionScore * 0.15 +
    growthScore * 0.10;

  return Math.round(Math.max(0, Math.min(100, weighted)));
}

// ─── Risk Score (0-100, higher = riskier) ────────────────────────────────────
//
// Inverse of health, weighted toward cash flow risk and overdue compliance.

export function computeRiskScore(input: {
  profit: number;
  revenue: number;
  cash: number;
  payables: number;
  receivables: number;
  overdueReturns: number;
  pendingReturns: number;
}): number {
  if (input.revenue === 0 && input.payables === 0 && input.cash === 0) {
    return 0;
  }

  let risk = 0;

  // Profitability risk (0-35)
  if (input.revenue > 0) {
    const margin = input.profit / input.revenue;
    if (margin < 0) risk += 35;
    else if (margin < 0.05) risk += 25;
    else if (margin < 0.10) risk += 15;
    else if (margin < 0.20) risk += 5;
  }

  // Liquidity risk (0-30)
  if (input.payables > 0) {
    const coverage = input.cash / input.payables;
    if (coverage < 0.5) risk += 30;
    else if (coverage < 1) risk += 20;
    else if (coverage < 1.5) risk += 10;
  } else if (input.cash < 0) {
    risk += 30;
  }

  // Compliance risk (0-25)
  const totalReturns = input.pendingReturns + input.overdueReturns;
  if (totalReturns > 0) {
    risk += Math.min(25, (input.overdueReturns / totalReturns) * 25 + (input.pendingReturns / totalReturns) * 10);
  }

  // Receivables concentration risk (0-10)
  if (input.receivables > 0 && input.revenue > 0) {
    const receivableRatio = input.receivables / input.revenue;
    if (receivableRatio > 0.5) risk += 10;
    else if (receivableRatio > 0.3) risk += 5;
  }

  return Math.round(Math.max(0, Math.min(100, risk)));
}

// ─── Collection Rate (0-1) ───────────────────────────────────────────────────

export function computeCollectionRate(revenue: number, collected: number): number {
  if (revenue <= 0) return 0;
  return Math.max(0, Math.min(1, collected / revenue));
}

// ─── Working Capital ──────────────────────────────────────────────────────────

export function computeWorkingCapital(receivables: number, payables: number): number {
  return receivables - payables;
}

// ─── Runway (days) ────────────────────────────────────────────────────────────
//
// How many days the business can survive on current cash at the current monthly
// burn rate. Returns Infinity if there's no burn (no expenses). Returns 0 if
// cash is <= 0.

export function computeRunway(cash: number, monthlyExpenses: number): number {
  if (cash <= 0) return 0;
  if (monthlyExpenses <= 0) return Infinity;
  return Math.round((cash / monthlyExpenses) * 30);
}

// ─── GST Liability ────────────────────────────────────────────────────────────
//
// Net GST payable to the government = output tax (collected on sales) - input
// tax (paid on purchases, claimable as ITC). If negative, the business has a
// refund due.

export function computeGstLiability(outputTax: number, inputTax: number): number {
  return outputTax - inputTax;
}

// ─── Forecast (next-month projection) ─────────────────────────────────────────
//
// Simple linear projection: assumes next month mirrors the current run-rate.
// In a future phase, this can be upgraded to a proper ML model, but the
// interface stays the same — every page calls computeForecast().

export function computeForecast(
  revenue: number,
  expenses: number,
): FinancialEngineResult['forecast'] {
  // If no data, return zeros with flat trend
  if (revenue === 0 && expenses === 0) {
    return {
      nextMonthRevenue: 0,
      nextMonthExpenses: 0,
      trend: 'flat',
      confidence: 0,
    };
  }

  // Project: assume the FY-to-date run-rate continues.
  // Monthly average = FY total / months elapsed (min 1)
  const fyStart = new Date();
  const month = fyStart.getMonth();
  const fyStartYear = month < 3 ? fyStart.getFullYear() - 1 : fyStart.getFullYear();
  const fyStartDate = new Date(fyStartYear, 3, 1);
  const monthsElapsed = Math.max(1, Math.round(
    (Date.now() - fyStartDate.getTime()) / (30 * 24 * 60 * 60 * 1000)
  ));

  const nextMonthRevenue = Math.round(revenue / monthsElapsed);
  const nextMonthExpenses = Math.round(expenses / monthsElapsed);

  const trend: 'up' | 'down' | 'flat' =
    nextMonthRevenue > revenue / monthsElapsed * 1.05 ? 'up'
    : nextMonthRevenue < revenue / monthsElapsed * 0.95 ? 'down'
    : 'flat';

  // Confidence: higher with more data
  const confidence = Math.min(1, monthsElapsed / 6);

  return { nextMonthRevenue, nextMonthExpenses, trend, confidence };
}

// ─── Outstanding (total money owed to + by the business) ─────────────────────

export function computeOutstanding(receivables: number, payables: number): number {
  return receivables + payables;
}
