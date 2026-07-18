// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Financial Engine (helper calculators for the Snapshot)
// ═══════════════════════════════════════════════════════════════════════════════
//
// This file exposes the small pure-function calculators that the canonical
// Business Snapshot (`./snapshot.ts`) uses to derive Collection Rate, Working
// Capital, Runway, GST Liability, and Forecast from the raw aggregate values.
//
// The canonical Health Score (8 weighted factors) and Risk Score (5 additive
// triggers) LIVE in `./snapshot.ts` — see `computeHealthScore` and
// `computeRiskScore` there. The duplicate `computeHealthScore` /
// `computeRiskScore` functions that USED to live in this file (different
// formula: 5-factor weighted + 4-factor additive) were DEAD CODE — zero
// imports across the codebase (verified via grep) — and have been removed to
// prevent future drift. See task FIX-DUP-1 in worklog.md.
//
// If you need a Health Score or Risk Score, call `getBusinessSnapshot(orgId)`
// and read `.healthScore` / `.riskScore` / `.healthScoreFactors` /
// `.riskScoreFactors` — NEVER re-implement the formula here.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FinancialEngineResult {
  healthScore: number;       // 0-100 composite business health (sourced from snapshot.ts)
  riskScore: number;         // 0-100 (higher = riskier) (sourced from snapshot.ts)
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

