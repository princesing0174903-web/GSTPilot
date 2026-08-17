// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Intelligence Module: Scenario Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// Safe "what-if" simulation engine. Projects the cash / revenue / receivables /
// GST-liability / runway impact of a hypothetical business event.
//
// PRINCIPLES:
//   1. NEVER modifies real records. NEVER writes to the database. NEVER calls
//      any mutating tool. This is PURE COMPUTATION.
//   2. ALWAYS labels output as SIMULATION (`isSimulation: true`).
//   3. ALWAYS includes the standard warning:
//        "⚠️ SIMULATION — This is a what-if analysis. No real records were
//         changed. Do not act on this without verifying the assumptions."
//   4. ALWAYS lists every assumption made.
//   5. ALWAYS cites an evidenceId from ctx.evidenceIndex.
//   6. Reads from the UnifiedOracleContext — does NOT re-fetch data.
// ═══════════════════════════════════════════════════════════════════════════════

import type { UnifiedOracleContext } from '../context/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScenarioInput {
  kind:
    | 'collections_improve'
    | 'revenue_drops'
    | 'gst_liability_increases'
    | 'large_customer_late'
    | 'expense_increase'
    | 'custom';
  /** The magnitude of the change, e.g. 0.15 = +15%, -0.10 = -10%. */
  magnitude: number;
  /** Optional horizon in months. Defaults to 1. */
  horizonMonths?: number;
  /** Optional custom label. */
  label?: string;
}

export interface ScenarioResult {
  kind: ScenarioInput['kind'];
  label: string;
  /** ALWAYS true — this is a what-if, not real. */
  isSimulation: true;
  baseline: {
    cash: number;
    revenue: number;
    receivables: number;
    gstLiability: number;
    runwayMonths: number;
  };
  projected: {
    cash: number;
    revenue: number;
    receivables: number;
    gstLiability: number;
    runwayMonths: number;
  };
  delta: {
    cash: number;
    revenue: number;
    receivables: number;
    gstLiability: number;
    runwayMonths: number;
  };
  /** Human-readable explanation, e.g. "If collections improve 15%, your cash position would increase by ₹X and your runway would extend from 4.2 to 5.3 months." */
  narrative: string;
  assumptions: string[];
  evidenceId: string;
  warning: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Standard warning emitted on every scenario result. Never varies. */
export const SCENARIO_WARNING =
  '⚠️ SIMULATION — This is a what-if analysis. No real records were changed. Do not act on this without verifying the assumptions.';

/** Sentinel for "infinite runway" (no burn detected). Keeps the value JSON-serialisable. */
const INFINITE_RUNWAY_SENTINEL = 999;

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Run a what-if scenario. PURE COMPUTATION — no DB writes, no side effects.
 *
 * @param ctx      The fully-built UnifiedOracleContext.
 * @param scenario What to simulate.
 * @returns        A ScenarioResult with baseline, projected, delta, narrative,
 *                 assumptions, and the standard simulation warning.
 */
export function runScenario(
  ctx: UnifiedOracleContext,
  scenario: ScenarioInput,
): ScenarioResult {
  const horizon = scenario.horizonMonths && scenario.horizonMonths > 0
    ? Math.min(12, Math.floor(scenario.horizonMonths))
    : 1;
  const magnitude = Number.isFinite(scenario.magnitude) ? scenario.magnitude : 0;

  const baseline = computeBaseline(ctx);
  const evidenceId = pickEvidenceId(ctx, 'invoices-fy', 'banking');

  switch (scenario.kind) {
    case 'collections_improve':       return runCollectionsImprove(ctx, scenario, baseline, horizon, evidenceId);
    case 'revenue_drops':             return runRevenueDrops(ctx, scenario, baseline, horizon, evidenceId);
    case 'gst_liability_increases':   return runGstLiabilityIncreases(ctx, scenario, baseline, horizon, evidenceId);
    case 'large_customer_late':       return runLargeCustomerLate(ctx, scenario, baseline, horizon, evidenceId);
    case 'expense_increase':          return runExpenseIncrease(ctx, scenario, baseline, horizon, evidenceId);
    case 'custom':                    return runCustom(ctx, scenario, baseline, horizon, evidenceId);
  }
}

// ─── Baseline computation ─────────────────────────────────────────────────────

function computeBaseline(ctx: UnifiedOracleContext): ScenarioResult['baseline'] {
  return {
    cash: ctx.cashFlow.currentBalance,
    revenue: ctx.revenue.trend.thisMonth > 0
      ? ctx.revenue.trend.thisMonth
      : ctx.revenue.invoicedRevenue,
    receivables: ctx.invoices.outstanding,
    gstLiability: ctx.gst.liability,
    runwayMonths: finiteRunway(ctx.cashFlow.runwayMonths),
  };
}

/**
 * Convert the context's runwayMonths (which may be Infinity) into a finite,
 * JSON-serialisable number. Uses INFINITE_RUNWAY_SENTINEL for infinite runway.
 */
function finiteRunway(r: number): number {
  if (!Number.isFinite(r)) return INFINITE_RUNWAY_SENTINEL;
  if (r < 0) return 0;
  if (r > INFINITE_RUNWAY_SENTINEL) return INFINITE_RUNWAY_SENTINEL;
  return r;
}

/**
 * Compute monthly burn from baseline cash + baseline runway.
 * Returns 0 when runway is effectively infinite (no burn).
 */
function monthlyBurnFromBaseline(baseline: ScenarioResult['baseline']): number {
  if (baseline.runwayMonths >= INFINITE_RUNWAY_SENTINEL) return 0;
  if (baseline.runwayMonths <= 0) return 0;
  return baseline.cash / baseline.runwayMonths;
}

/** Recompute runway given a projected cash position + monthly burn. */
function recomputeRunway(cash: number, monthlyBurn: number): number {
  if (cash <= 0) return 0;
  if (monthlyBurn <= 0) return INFINITE_RUNWAY_SENTINEL;
  const r = cash / monthlyBurn;
  return finiteRunway(r);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  const rounded = Math.round(n);
  return `₹${rounded.toLocaleString('en-IN')}`;
}

function fmtRunway(r: number): string {
  if (r >= INFINITE_RUNWAY_SENTINEL) return '∞ (no burn)';
  return `${r.toFixed(1)} months`;
}

function defaultLabel(kind: ScenarioInput['kind'], magnitude: number): string {
  const pct = `${Math.abs(magnitude * 100).toFixed(0)}%`;
  switch (kind) {
    case 'collections_improve':     return `Collections improve by ${pct}`;
    case 'revenue_drops':           return `Revenue drops by ${pct}`;
    case 'gst_liability_increases': return `GST liability increases by ${pct}`;
    case 'large_customer_late':     return `Top customer pays 30 days late`;
    case 'expense_increase':        return `Expenses increase by ${pct}`;
    case 'custom':                  return `Custom what-if (magnitude ${magnitude.toFixed(2)})`;
  }
}

function buildResult(
  kind: ScenarioInput['kind'],
  label: string,
  baseline: ScenarioResult['baseline'],
  projected: ScenarioResult['projected'],
  narrative: string,
  assumptions: string[],
  evidenceId: string,
): ScenarioResult {
  const delta = {
    cash: projected.cash - baseline.cash,
    revenue: projected.revenue - baseline.revenue,
    receivables: projected.receivables - baseline.receivables,
    gstLiability: projected.gstLiability - baseline.gstLiability,
    runwayMonths: projected.runwayMonths - baseline.runwayMonths,
  };
  return {
    kind,
    label,
    isSimulation: true,
    baseline,
    projected,
    delta,
    narrative,
    assumptions,
    evidenceId,
    warning: SCENARIO_WARNING,
  };
}

// ─── 1. Collections improve ───────────────────────────────────────────────────
// If collections improve by `magnitude` (e.g. 15%), receivables drop by that
// fraction, cash increases by the collected amount, runway extends.

function runCollectionsImprove(
  ctx: UnifiedOracleContext,
  scenario: ScenarioInput,
  baseline: ScenarioResult['baseline'],
  horizon: number,
  evidenceId: string,
): ScenarioResult {
  const magnitude = scenario.magnitude;
  const collectedAmount = baseline.receivables * magnitude;
  const burn = monthlyBurnFromBaseline(baseline);

  const projected: ScenarioResult['projected'] = {
    cash: baseline.cash + collectedAmount,
    revenue: baseline.revenue, // same invoices, just faster collection
    receivables: Math.max(0, baseline.receivables - collectedAmount),
    gstLiability: baseline.gstLiability, // no GST impact
    runwayMonths: recomputeRunway(baseline.cash + collectedAmount, burn),
  };

  const label = scenario.label ?? defaultLabel('collections_improve', magnitude);
  const direction = magnitude >= 0 ? 'improve' : 'worsen';
  const cashDirection = magnitude >= 0 ? 'increase' : 'decrease';
  const runwayDirection = projected.runwayMonths >= baseline.runwayMonths ? 'extend' : 'shrink';

  const narrative = `If collections ${direction} by ${Math.abs(magnitude * 100).toFixed(0)}%, your cash position would ${cashDirection} by ${inr(Math.abs(collectedAmount))} and your runway would ${runwayDirection} from ${fmtRunway(baseline.runwayMonths)} to ${fmtRunway(projected.runwayMonths)}.`;

  const assumptions = [
    `Magnitude: ${(magnitude * 100).toFixed(1)}% (${magnitude >= 0 ? 'improvement' : 'worsening'}).`,
    `Collected amount: ${inr(collectedAmount)} = receivables (${inr(baseline.receivables)}) × ${magnitude.toFixed(2)}.`,
    `Receivables drop from ${inr(baseline.receivables)} to ${inr(projected.receivables)}.`,
    `Revenue is unchanged — the same invoices are billed, only the collection timing shifts.`,
    `GST liability is unchanged — collections do not affect GST (output tax is recognised on invoice, not collection).`,
    `Horizon: ${horizon} month${horizon === 1 ? '' : 's'} (applied as a one-time step; sustained improvement would compound).`,
    'Assumes the collected cash arrives within the horizon and is not offset by new outflows.',
  ];

  return buildResult('collections_improve', label, baseline, projected, narrative, assumptions, evidenceId);
}

// ─── 2. Revenue drops ─────────────────────────────────────────────────────────
// If revenue drops by `magnitude`, next-month revenue forecast drops, cash drops
// proportionally, runway shrinks.

function runRevenueDrops(
  ctx: UnifiedOracleContext,
  scenario: ScenarioInput,
  baseline: ScenarioResult['baseline'],
  horizon: number,
  evidenceId: string,
): ScenarioResult {
  const magnitude = scenario.magnitude; // expected negative for a drop
  const revenueDelta = baseline.revenue * magnitude;
  const cashDelta = revenueDelta; // cash tracks revenue proportionally
  const receivablesDelta = baseline.receivables * magnitude; // less new revenue = less new receivables
  const gstDelta = baseline.gstLiability * magnitude; // less revenue = less output tax
  const burn = monthlyBurnFromBaseline(baseline);

  const projected: ScenarioResult['projected'] = {
    cash: baseline.cash + cashDelta,
    revenue: Math.max(0, baseline.revenue + revenueDelta),
    receivables: Math.max(0, baseline.receivables + receivablesDelta),
    gstLiability: Math.max(0, baseline.gstLiability + gstDelta),
    runwayMonths: recomputeRunway(baseline.cash + cashDelta, burn),
  };

  const label = scenario.label ?? defaultLabel('revenue_drops', magnitude);
  const direction = magnitude >= 0 ? 'increase' : 'drop';
  const cashDirection = cashDelta >= 0 ? 'increase' : 'decrease';
  const runwayDirection = projected.runwayMonths >= baseline.runwayMonths ? 'extend' : 'shrink';

  const narrative = `If revenue ${direction}s by ${Math.abs(magnitude * 100).toFixed(0)}%, your monthly revenue would move from ${inr(baseline.revenue)} to ${inr(projected.revenue)}, your cash position would ${cashDirection} by ${inr(Math.abs(cashDelta))}, and your runway would ${runwayDirection} from ${fmtRunway(baseline.runwayMonths)} to ${fmtRunway(projected.runwayMonths)}.`;

  const assumptions = [
    `Magnitude: ${(magnitude * 100).toFixed(1)}% (${magnitude >= 0 ? 'increase' : 'decrease'}).`,
    `Revenue delta: ${inr(revenueDelta)} = monthly revenue (${inr(baseline.revenue)}) × ${magnitude.toFixed(2)}.`,
    `Cash delta: ${inr(cashDelta)} — assumes the revenue change flows directly to cash (no collection lag in this scenario).`,
    `Receivables delta: ${inr(receivablesDelta)} — new receivables grow/shrink proportionally with revenue.`,
    `GST liability delta: ${inr(gstDelta)} — output tax scales with revenue at the current effective rate.`,
    `Horizon: ${horizon} month${horizon === 1 ? '' : 's'} (applied as a sustained change to monthly run-rate).`,
    'Does not model cost cuts that might accompany a revenue drop (e.g. reduced variable spend).',
  ];

  return buildResult('revenue_drops', label, baseline, projected, narrative, assumptions, evidenceId);
}

// ─── 3. GST liability increases ───────────────────────────────────────────────
// If GST liability increases by `magnitude`, cash drops by the increase, runway shrinks.

function runGstLiabilityIncreases(
  ctx: UnifiedOracleContext,
  scenario: ScenarioInput,
  baseline: ScenarioResult['baseline'],
  horizon: number,
  evidenceId: string,
): ScenarioResult {
  const magnitude = scenario.magnitude;
  const gstDelta = baseline.gstLiability * magnitude;
  const cashDelta = -gstDelta; // more GST = less cash
  const burn = monthlyBurnFromBaseline(baseline);

  const projected: ScenarioResult['projected'] = {
    cash: baseline.cash + cashDelta,
    revenue: baseline.revenue, // revenue unchanged
    receivables: baseline.receivables, // receivables unchanged
    gstLiability: Math.max(0, baseline.gstLiability + gstDelta),
    runwayMonths: recomputeRunway(baseline.cash + cashDelta, burn),
  };

  const label = scenario.label ?? defaultLabel('gst_liability_increases', magnitude);
  const cashDirection = cashDelta >= 0 ? 'increase' : 'decrease';
  const runwayDirection = projected.runwayMonths >= baseline.runwayMonths ? 'extend' : 'shrink';

  const narrative = `If GST liability ${magnitude >= 0 ? 'increases' : 'decreases'} by ${Math.abs(magnitude * 100).toFixed(0)}%, your GST obligation would move from ${inr(baseline.gstLiability)} to ${inr(projected.gstLiability)} — a ${inr(Math.abs(gstDelta))} change that ${cashDirection === 'increase' ? 'adds to' : 'reduces'} cash and ${runwayDirection === 'extend' ? 'extends' : 'shrinks'} your runway from ${fmtRunway(baseline.runwayMonths)} to ${fmtRunway(projected.runwayMonths)}.`;

  const assumptions = [
    `Magnitude: ${(magnitude * 100).toFixed(1)}% (${magnitude >= 0 ? 'increase' : 'decrease'}).`,
    `GST delta: ${inr(gstDelta)} = current liability (${inr(baseline.gstLiability)}) × ${magnitude.toFixed(2)}.`,
    `Cash delta: ${inr(cashDelta)} — the additional GST is paid out of cash.`,
    `Revenue and receivables are unchanged — this scenario isolates the GST impact only.`,
    `Horizon: ${horizon} month${horizon === 1 ? '' : 's'} (applied as a one-time step).`,
    'Does not model ITC adjustments — if the liability increase comes from denied ITC, the cash impact is the same but the underlying cause differs.',
  ];

  return buildResult('gst_liability_increases', label, baseline, projected, narrative, assumptions, evidenceId);
}

// ─── 4. Large customer late (top customer delays 30 days) ─────────────────────
// The top customer's revenue is delayed by 30 days. Cash drops by that amount
// for the month, receivables increase.

function runLargeCustomerLate(
  ctx: UnifiedOracleContext,
  scenario: ScenarioInput,
  baseline: ScenarioResult['baseline'],
  horizon: number,
  evidenceId: string,
): ScenarioResult {
  const topCustomer = ctx.customers.topCustomers[0];
  const customerName = topCustomer?.name ?? '(no top customer)';
  const monthsInSeries = Math.max(1, ctx.revenue.monthlySeries.length);
  // Monthly revenue from the top customer = FY total ÷ months in series.
  // This is the natural "30-day delay" interpretation.
  const topCustomerMonthlyRevenue = topCustomer ? topCustomer.revenue / monthsInSeries : 0;
  const delayedAmount = topCustomerMonthlyRevenue;
  const burn = monthlyBurnFromBaseline(baseline);

  const projected: ScenarioResult['projected'] = {
    cash: baseline.cash - delayedAmount,
    revenue: baseline.revenue, // revenue is still recognised on invoice
    receivables: baseline.receivables + delayedAmount, // not collected → still receivable
    gstLiability: baseline.gstLiability, // GST already recognised on invoice
    runwayMonths: recomputeRunway(baseline.cash - delayedAmount, burn),
  };

  const label = scenario.label ?? defaultLabel('large_customer_late', scenario.magnitude);
  const runwayDirection = projected.runwayMonths >= baseline.runwayMonths ? 'extend' : 'shrink';

  const narrative = topCustomer
    ? `If your top customer ${customerName} delays payment by 30 days, your cash would drop by ${inr(delayedAmount)} (their monthly revenue), your receivables would rise to ${inr(projected.receivables)}, and your runway would ${runwayDirection} from ${fmtRunway(baseline.runwayMonths)} to ${fmtRunway(projected.runwayMonths)}.`
    : `No top customer data available — scenario has no measurable impact. Connect customers and invoices to enable this analysis.`;

  const assumptions = [
    `Top customer: ${customerName}.`,
    `Monthly revenue from top customer: ${inr(topCustomerMonthlyRevenue)} = FY-to-date revenue (${inr(topCustomer?.revenue ?? 0)}) ÷ ${monthsInSeries} months in history.`,
    `Cash drops by ${inr(delayedAmount)} (one month of top-customer revenue delayed).`,
    `Receivables increase by ${inr(delayedAmount)} (the uncollected amount remains on the books).`,
    `Revenue and GST liability are unchanged — both are recognised on invoice date, not collection date.`,
    `Horizon: ${horizon} month${horizon === 1 ? '' : 's'} (the delay is modelled as a single 30-day shift).`,
    'Assumes the top customer eventually pays — this is a timing shift, not a default.',
  ];

  return buildResult('large_customer_late', label, baseline, projected, narrative, assumptions, evidenceId);
}

// ─── 5. Expense increase ──────────────────────────────────────────────────────
// Expenses increase by `magnitude`. Cash drops, runway shrinks.

function runExpenseIncrease(
  ctx: UnifiedOracleContext,
  scenario: ScenarioInput,
  baseline: ScenarioResult['baseline'],
  horizon: number,
  evidenceId: string,
): ScenarioResult {
  const magnitude = scenario.magnitude;
  const monthlyExp = monthlyExpenses(ctx);
  const expenseDelta = monthlyExp * magnitude; // extra monthly burn
  const burn = monthlyBurnFromBaseline(baseline);
  const newBurn = Math.max(0, burn + expenseDelta);

  const projected: ScenarioResult['projected'] = {
    cash: baseline.cash - expenseDelta, // one month of extra burn
    revenue: baseline.revenue, // revenue unchanged
    receivables: baseline.receivables, // receivables unchanged
    gstLiability: baseline.gstLiability, // GST unchanged (expenses don't directly affect output tax)
    runwayMonths: recomputeRunway(baseline.cash, newBurn),
  };

  const label = scenario.label ?? defaultLabel('expense_increase', magnitude);
  const cashDirection = expenseDelta >= 0 ? 'decrease' : 'increase';
  const runwayDirection = projected.runwayMonths >= baseline.runwayMonths ? 'extend' : 'shrink';

  const narrative = `If expenses ${magnitude >= 0 ? 'increase' : 'decrease'} by ${Math.abs(magnitude * 100).toFixed(0)}%, your monthly expense run-rate would move by ${inr(Math.abs(expenseDelta))}, cash would ${cashDirection} by ${inr(Math.abs(expenseDelta))} over the month, and your runway would ${runwayDirection} from ${fmtRunway(baseline.runwayMonths)} to ${fmtRunway(projected.runwayMonths)}.`;

  const assumptions = [
    `Magnitude: ${(magnitude * 100).toFixed(1)}% (${magnitude >= 0 ? 'increase' : 'decrease'}).`,
    `Current monthly expenses: ${inr(monthlyExp)} (derived from ${ctx.expenses.trend.thisMonth > 0 ? 'this month' : 'FY total ÷ months in history'}).`,
    `Extra monthly burn: ${inr(expenseDelta)} = monthly expenses × ${magnitude.toFixed(2)}.`,
    `Cash drops by ${inr(Math.abs(expenseDelta))} over the horizon (one month of extra burn).`,
    `Runway recomputed at the new burn rate (${inr(newBurn)}/month).`,
    `Revenue, receivables, and GST liability are unchanged — this scenario isolates the expense impact only.`,
    `Horizon: ${horizon} month${horizon === 1 ? '' : 's'} (applied as a sustained change to monthly burn).`,
    'Does not model second-order effects (e.g. higher revenue from increased marketing spend).',
  ];

  return buildResult('expense_increase', label, baseline, projected, narrative, assumptions, evidenceId);
}

// ─── 6. Custom ────────────────────────────────────────────────────────────────
// Apply a custom multiplier to cash/revenue/receivables.

function runCustom(
  ctx: UnifiedOracleContext,
  scenario: ScenarioInput,
  baseline: ScenarioResult['baseline'],
  horizon: number,
  evidenceId: string,
): ScenarioResult {
  const m = scenario.magnitude; // treated as a direct multiplier on each metric
  const burn = monthlyBurnFromBaseline(baseline);

  const projected: ScenarioResult['projected'] = {
    cash: baseline.cash * (1 + m),
    revenue: baseline.revenue * (1 + m),
    receivables: baseline.receivables * (1 + m),
    gstLiability: baseline.gstLiability * (1 + m),
    runwayMonths: recomputeRunway(baseline.cash * (1 + m), burn),
  };

  const label = scenario.label ?? defaultLabel('custom', m);
  const cashDirection = m >= 0 ? 'increase' : 'decrease';
  const runwayDirection = projected.runwayMonths >= baseline.runwayMonths ? 'extend' : 'shrink';

  const narrative = `Custom scenario (magnitude ${m.toFixed(2)}): cash ${cashDirection}s by ${inr(Math.abs(baseline.cash * m))}, revenue moves to ${inr(projected.revenue)}, receivables to ${inr(projected.receivables)}, GST liability to ${inr(projected.gstLiability)}, and runway ${runwayDirection}s from ${fmtRunway(baseline.runwayMonths)} to ${fmtRunway(projected.runwayMonths)}.`;

  const assumptions = [
    `Magnitude: ${m.toFixed(2)} (applied as a uniform multiplier on cash, revenue, receivables, and GST liability).`,
    `Cash: ${inr(baseline.cash)} → ${inr(projected.cash)} (delta ${inr(baseline.cash * m)}).`,
    `Revenue: ${inr(baseline.revenue)} → ${inr(projected.revenue)} (delta ${inr(baseline.revenue * m)}).`,
    `Receivables: ${inr(baseline.receivables)} → ${inr(projected.receivables)} (delta ${inr(baseline.receivables * m)}).`,
    `GST liability: ${inr(baseline.gstLiability)} → ${inr(projected.gstLiability)} (delta ${inr(baseline.gstLiability * m)}).`,
    `Runway recomputed at the original burn rate (${inr(burn)}/month).`,
    `Horizon: ${horizon} month${horizon === 1 ? '' : 's'}.`,
    'The custom scenario applies a uniform multiplier — for non-uniform shocks, run multiple scenarios.',
  ];

  return buildResult('custom', label, baseline, projected, narrative, assumptions, evidenceId);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derive a monthly expense figure from the context. Prefers the trend's
 * thisMonth value when populated; falls back to FY total ÷ months in the
 * monthly revenue series.
 */
function monthlyExpenses(ctx: UnifiedOracleContext): number {
  if (ctx.expenses.trend.thisMonth > 0) return ctx.expenses.trend.thisMonth;
  const months = Math.max(1, ctx.revenue.monthlySeries.length);
  return ctx.expenses.total / months;
}
