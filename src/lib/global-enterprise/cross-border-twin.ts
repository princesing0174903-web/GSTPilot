// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Global Enterprise Operating System™
// Cross-Border Digital Twin™ — Simulates opening a new country, acquiring a company,
// hiring globally, currency shocks, tax changes, economic downturns, supply chain
// disruptions, and expansion strategies. Predicts revenue/profit/risk/compliance/ROI.
// Founder & Owner: Prince Singh. Built on REAL production data (consolidation + treasury).
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getCountry } from './registry';
import { convertToBase, getFxRate, todayISO } from './currency';
import { getConsolidationReport, currentPeriod } from './consolidation';
import { getComplianceStatus } from './compliance';
import { getPayrollStructure } from './registry';
import { cacheGet, cacheSet, TTL_PRESETS, buildKey } from './cache';
import type {
  CrossBorderScenarioType,
  CrossBorderScenarioParameters,
  CrossBorderProjection,
  CrossBorderSimulationResult,
} from './types';

// ─── Scenario metadata ───────────────────────────────────────────────────────

export const SCENARIO_META: Record<
  CrossBorderScenarioType,
  { label: string; description: string; defaultMagnitude: number; defaultHorizon: number }
> = {
  open_country: {
    label: 'Open New Country',
    description: 'Establish a new legal entity and start operations in a target country.',
    defaultMagnitude: 0,
    defaultHorizon: 12,
  },
  acquire_company: {
    label: 'Acquire Company',
    description: 'Acquire a target company (revenue & employees absorbed).',
    defaultMagnitude: 100,
    defaultHorizon: 12,
  },
  hire_global: {
    label: 'Hire Globally',
    description: 'Hire employees in a target country at a given role band.',
    defaultMagnitude: 0,
    defaultHorizon: 6,
  },
  currency_shock: {
    label: 'Currency Shock',
    description: 'Simulate FX rate movement (e.g. +10% = INR strengthens).',
    defaultMagnitude: 10,
    defaultHorizon: 6,
  },
  tax_change: {
    label: 'Tax Rate Change',
    description: 'Simulate a change in the country tax rate (e.g. +5% = rates up 5pp).',
    defaultMagnitude: 5,
    defaultHorizon: 12,
  },
  downturn: {
    label: 'Economic Downturn',
    description: 'Simulate recessionary pressure reducing demand.',
    defaultMagnitude: -15,
    defaultHorizon: 12,
  },
  supply_disruption: {
    label: 'Supply Chain Disruption',
    description: 'Simulate supply chain disruption increasing costs and delaying revenue.',
    defaultMagnitude: 20,
    defaultHorizon: 6,
  },
  expansion: {
    label: 'Expansion Strategy',
    description: 'Organic expansion — new product line, new branch, new market segment.',
    defaultMagnitude: 25,
    defaultHorizon: 12,
  },
};

export const SCENARIO_TYPES = Object.keys(SCENARIO_META) as CrossBorderScenarioType[];

// ─── Baseline snapshot (from REAL consolidation) ─────────────────────────────

export interface BaselineSnapshot {
  monthlyRevenueBase: number;
  monthlyExpenseBase: number;
  monthlyProfitBase: number;
  monthlyTaxBase: number;
  monthlyPayrollBase: number;
  cashBalanceBase: number;
  entityCount: number;
  countryCount: number;
  primaryCurrency: string;
  avgComplianceScore: number;
  asOfDate: string;
  source: 'real' | 'fallback';
}

export async function getBaselineSnapshot(firmId?: string): Promise<BaselineSnapshot> {
  const period = currentPeriod();
  try {
    const report = await getConsolidationReport(period, firmId);
    const monthlyRevenue = report.totalRevenue / 12 || 0;
    const monthlyExpense = report.totalExpense / 12 || 0;
    const monthlyProfit = report.totalProfit / 12 || 0;
    const monthlyTax = report.totalTax / 12 || 0;
    const monthlyPayroll = report.totalPayroll / 12 || 0;
    const cashBalance = report.totalAssets * 0.4; // approximation: 40% of assets is cash

    // Real compliance score: average across countries present in consolidation
    const countryIsos = Array.from(new Set(report.byCountry.map((c) => c.countryIso)));
    let avgComplianceScore = 75;
    if (countryIsos.length > 0) {
      const statuses = await Promise.all(
        countryIsos.map((iso) => getComplianceStatus(iso).catch(() => null))
      );
      const valid = statuses.filter((s): s is NonNullable<typeof s> => s !== null);
      if (valid.length > 0) {
        avgComplianceScore = valid.reduce((s, x) => s + x.complianceScore, 0) / valid.length;
      }
    }

    return {
      monthlyRevenueBase: monthlyRevenue,
      monthlyExpenseBase: monthlyExpense,
      monthlyProfitBase: monthlyProfit,
      monthlyTaxBase: monthlyTax,
      monthlyPayrollBase: monthlyPayroll,
      cashBalanceBase: cashBalance,
      entityCount: report.byEntity.length,
      countryCount: countryIsos.length || 1,
      primaryCurrency: 'INR',
      avgComplianceScore,
      asOfDate: todayISO(),
      source: monthlyRevenue > 0 ? 'real' : 'fallback',
    };
  } catch {
    // Fallback: empty baseline (no real data yet) — predictions still computed
    return {
      monthlyRevenueBase: 0,
      monthlyExpenseBase: 0,
      monthlyProfitBase: 0,
      monthlyTaxBase: 0,
      monthlyPayrollBase: 0,
      cashBalanceBase: 0,
      entityCount: 0,
      countryCount: 1,
      primaryCurrency: 'INR',
      avgComplianceScore: 75,
      asOfDate: todayISO(),
      source: 'fallback',
    };
  }
}

// ─── Per-scenario projection model ───────────────────────────────────────────
//
// Each scenario applies a deterministic shock to the baseline and projects month
// by month. Shocks are grounded in REAL data (consolidation, FX rates, payroll
// structures, compliance deadlines) where possible.

function linearRamp(month: number, rampMonths = 3): number {
  // Ramp from 0% to 100% impact over `rampMonths`, then stay at 100%
  return Math.min(1, month / rampMonths);
}

async function projectOpenCountry(
  baseline: BaselineSnapshot,
  params: CrossBorderScenarioParameters
): Promise<CrossBorderProjection[]> {
  const iso = params.targetCountryIso ?? 'US';
  const country = getCountry(iso);
  const months = params.monthsAhead;
  const setupCost = params.investmentAmount ?? 5_000_000; // default ₹50L setup
  // Project monthly ramp: 0%,10%,25%,50%,75%,100% over first 6 months
  const projectedPeakRevenue = baseline.monthlyRevenueBase * 0.15 + 250_000; // new country adds 15% baseline + ₹2.5L/mo floor
  const projections: CrossBorderProjection[] = [];
  for (let m = 1; m <= months; m++) {
    const ramp = linearRamp(m, 6);
    const revenueBase = projectedPeakRevenue * ramp;
    const expenseBase = (setupCost / 12) * Math.min(1, m / 3) + revenueBase * 0.7;
    const profitBase = revenueBase - expenseBase;
    const taxLiabilityBase = revenueBase > 0 ? revenueBase * 0.18 : 0; // avg 18% indirect tax
    const cashFlowBase = profitBase - taxLiabilityBase - (m === 1 ? setupCost * 0.5 : 0) - (m === 2 ? setupCost * 0.5 : 0);
    projections.push({
      month: m,
      revenueBase,
      expenseBase,
      profitBase,
      cashFlowBase,
      taxLiabilityBase,
      riskScore: 40 + (country ? 20 : 30) - (m * 2), // risk decreases as ops stabilise
      complianceScore: Math.min(95, baseline.avgComplianceScore + m),
    });
  }
  return projections;
}

async function projectAcquireCompany(
  baseline: BaselineSnapshot,
  params: CrossBorderScenarioParameters
): Promise<CrossBorderProjection[]> {
  const iso = params.targetCountryIso ?? 'IN';
  const months = params.monthsAhead;
  const acquireCost = params.investmentAmount ?? 50_000_000; // ₹5Cr default acquisition
  // Target adds 30% to revenue & 25% to expenses (post-synergy)
  const revenueUplift = baseline.monthlyRevenueBase * 0.3;
  const expenseUplift = baseline.monthlyExpenseBase * 0.25;
  const projections: CrossBorderProjection[] = [];
  for (let m = 1; m <= months; m++) {
    const ramp = linearRamp(m, 4);
    const revenueBase = baseline.monthlyRevenueBase + revenueUplift * ramp;
    const expenseBase = baseline.monthlyExpenseBase + expenseUplift * ramp;
    const profitBase = revenueBase - expenseBase;
    const taxLiabilityBase = revenueBase > 0 ? revenueBase * 0.18 : 0;
    const cashFlowBase = profitBase - taxLiabilityBase - (m === 1 ? acquireCost : 0);
    projections.push({
      month: m,
      revenueBase,
      expenseBase,
      profitBase,
      cashFlowBase,
      taxLiabilityBase,
      riskScore: 55 - m * 2, // integration risk reduces over time
      complianceScore: Math.min(95, baseline.avgComplianceScore - 5 + m),
    });
  }
  return projections;
}

async function projectHireGlobal(
  baseline: BaselineSnapshot,
  params: CrossBorderScenarioParameters
): Promise<CrossBorderProjection[]> {
  const iso = params.hireCountryIso ?? params.targetCountryIso ?? 'IN';
  const structure = getPayrollStructure(iso);
  const headcount = params.hireCount ?? 5;
  const band = params.hireRoleBand ?? 'mid';
  // Estimate monthly salary per band (in local currency, then convert)
  const bandSalaryLocal: Record<string, number> = {
    junior: structure?.minWageMonthly ? structure.minWageMonthly * 1.2 : 25000,
    mid: structure?.minWageMonthly ? structure.minWageMonthly * 3 : 80000,
    senior: structure?.minWageMonthly ? structure.minWageMonthly * 6 : 200000,
    executive: structure?.minWageMonthly ? structure.minWageMonthly * 12 : 500000,
  };
  const grossPerHeadLocal = bandSalaryLocal[band];
  // Employer burden: social security + medicare + retirement + 10% overhead
  const employerBurdenPct = structure
    ? structure.socialSecurityEmployerPct + structure.medicareEmployerPct + structure.retirementEmployerPct + 10
    : 15;
  const perHeadCostLocal = grossPerHeadLocal * (1 + employerBurdenPct / 100);
  // Convert to INR base
  let perHeadCostBase = perHeadCostLocal;
  if (structure && structure.currencyCode !== 'INR') {
    try {
      const fx = await getFxRate(structure.currencyCode);
      perHeadCostBase = perHeadCostLocal * fx.inverseRate;
    } catch {
      perHeadCostBase = perHeadCostLocal * 80; // fallback
    }
  }
  const addedMonthlyPayroll = perHeadCostBase * headcount;
  // Hiring ramps productivity over 3 months
  const productivityGainPerHead = perHeadCostBase * 1.5; // each head generates 1.5x cost in revenue
  const months = params.monthsAhead;
  const projections: CrossBorderProjection[] = [];
  for (let m = 1; m <= months; m++) {
    const ramp = linearRamp(m, 3);
    const addedRevenue = productivityGainPerHead * headcount * ramp;
    const revenueBase = baseline.monthlyRevenueBase + addedRevenue;
    const expenseBase = baseline.monthlyExpenseBase + addedMonthlyPayroll;
    const profitBase = revenueBase - expenseBase;
    const taxLiabilityBase = revenueBase > 0 ? revenueBase * 0.18 : 0;
    const cashFlowBase = profitBase - taxLiabilityBase;
    projections.push({
      month: m,
      revenueBase,
      expenseBase,
      profitBase,
      cashFlowBase,
      taxLiabilityBase,
      riskScore: 30 + (m < 3 ? 15 : 0), // onboarding risk early
      complianceScore: Math.min(95, baseline.avgComplianceScore + 2),
    });
  }
  return projections;
}

async function projectCurrencyShock(
  baseline: BaselineSnapshot,
  params: CrossBorderScenarioParameters
): Promise<CrossBorderProjection[]> {
  const months = params.monthsAhead;
  const shockPct = params.magnitudePct / 100; // +10 = INR strengthens 10%
  // If INR strengthens, exports become harder (revenue↓), imports cheaper (expense↓)
  // If INR weakens, exports easier (revenue↑), imports costlier (expense↑)
  const revenueSensitivity = 0.4; // 40% of revenue is FX-exposed
  const expenseSensitivity = 0.3;  // 30% of expense is FX-exposed
  const projections: CrossBorderProjection[] = [];
  for (let m = 1; m <= months; m++) {
    const ramp = linearRamp(m, 2);
    const revenueDelta = -baseline.monthlyRevenueBase * revenueSensitivity * shockPct * ramp;
    const expenseDelta = -baseline.monthlyExpenseBase * expenseSensitivity * shockPct * ramp;
    const revenueBase = baseline.monthlyRevenueBase + revenueDelta;
    const expenseBase = baseline.monthlyExpenseBase + expenseDelta;
    const profitBase = revenueBase - expenseBase;
    const taxLiabilityBase = revenueBase > 0 ? revenueBase * 0.18 : 0;
    const cashFlowBase = profitBase - taxLiabilityBase;
    projections.push({
      month: m,
      revenueBase,
      expenseBase,
      profitBase,
      cashFlowBase,
      taxLiabilityBase,
      riskScore: 45 + Math.abs(shockPct) * 100,
      complianceScore: baseline.avgComplianceScore,
    });
  }
  return projections;
}

async function projectTaxChange(
  baseline: BaselineSnapshot,
  params: CrossBorderScenarioParameters
): Promise<CrossBorderProjection[]> {
  const months = params.monthsAhead;
  const taxDeltaPct = params.magnitudePct; // +5 = tax rate up 5 percentage points
  const currentEffRate = baseline.monthlyRevenueBase > 0
    ? baseline.monthlyTaxBase / baseline.monthlyRevenueBase * 100
    : 18;
  const newEffRate = Math.max(0, currentEffRate + taxDeltaPct) / 100;
  const projections: CrossBorderProjection[] = [];
  for (let m = 1; m <= months; m++) {
    const revenueBase = baseline.monthlyRevenueBase * (1 - taxDeltaPct / 200); // tax↑ slightly dampens demand
    const expenseBase = baseline.monthlyExpenseBase;
    const profitBase = revenueBase - expenseBase;
    const taxLiabilityBase = revenueBase * newEffRate;
    const cashFlowBase = profitBase - taxLiabilityBase;
    projections.push({
      month: m,
      revenueBase,
      expenseBase,
      profitBase,
      cashFlowBase,
      taxLiabilityBase,
      riskScore: 35 + Math.abs(taxDeltaPct) * 2,
      complianceScore: Math.max(50, baseline.avgComplianceScore - Math.abs(taxDeltaPct)),
    });
  }
  return projections;
}

async function projectDownturn(
  baseline: BaselineSnapshot,
  params: CrossBorderScenarioParameters
): Promise<CrossBorderProjection[]> {
  const months = params.monthsAhead;
  const demandShock = params.magnitudePct / 100; // -15 = demand down 15%
  const projections: CrossBorderProjection[] = [];
  for (let m = 1; m <= months; m++) {
    const ramp = linearRamp(m, 4);
    // Worst in middle of horizon, recovery at end
    const cycleFactor = m < months / 2 ? ramp : Math.max(0.3, 1 - (m - months / 2) / (months / 2));
    const revenueBase = baseline.monthlyRevenueBase * (1 + demandShock * cycleFactor);
    const expenseBase = baseline.monthlyExpenseBase * (1 + demandShock * 0.3 * cycleFactor); // sticky expenses
    const profitBase = revenueBase - expenseBase;
    const taxLiabilityBase = revenueBase > 0 ? revenueBase * 0.18 : 0;
    const cashFlowBase = profitBase - taxLiabilityBase;
    projections.push({
      month: m,
      revenueBase,
      expenseBase,
      profitBase,
      cashFlowBase,
      taxLiabilityBase,
      riskScore: 50 + Math.abs(demandShock) * 100 * cycleFactor,
      complianceScore: Math.max(40, baseline.avgComplianceScore - 10 * cycleFactor),
    });
  }
  return projections;
}

async function projectSupplyDisruption(
  baseline: BaselineSnapshot,
  params: CrossBorderScenarioParameters
): Promise<CrossBorderProjection[]> {
  const months = params.monthsAhead;
  const severity = params.disruptionSeverity ?? 'moderate';
  const costUpliftPct = severity === 'mild' ? 0.05 : severity === 'moderate' ? 0.15 : 0.30;
  const revenueDelayPct = severity === 'mild' ? 0.03 : severity === 'moderate' ? 0.08 : 0.20;
  const projections: CrossBorderProjection[] = [];
  for (let m = 1; m <= months; m++) {
    const ramp = Math.max(0, 1 - m / months); // disruption eases over horizon
    const revenueBase = baseline.monthlyRevenueBase * (1 - revenueDelayPct * ramp);
    const expenseBase = baseline.monthlyExpenseBase * (1 + costUpliftPct * ramp);
    const profitBase = revenueBase - expenseBase;
    const taxLiabilityBase = revenueBase > 0 ? revenueBase * 0.18 : 0;
    const cashFlowBase = profitBase - taxLiabilityBase;
    projections.push({
      month: m,
      revenueBase,
      expenseBase,
      profitBase,
      cashFlowBase,
      taxLiabilityBase,
      riskScore: 50 + costUpliftPct * 100 * ramp,
      complianceScore: baseline.avgComplianceScore,
    });
  }
  return projections;
}

async function projectExpansion(
  baseline: BaselineSnapshot,
  params: CrossBorderScenarioParameters
): Promise<CrossBorderProjection[]> {
  const months = params.monthsAhead;
  const growthPct = params.magnitudePct / 100; // +25 = 25% revenue uplift over horizon
  const investmentMonthly = (params.investmentAmount ?? 2_000_000) / 6; // ₹20L total over 6 months
  const projections: CrossBorderProjection[] = [];
  for (let m = 1; m <= months; m++) {
    const ramp = linearRamp(m, 6);
    const revenueBase = baseline.monthlyRevenueBase * (1 + growthPct * ramp);
    const expenseBase = baseline.monthlyExpenseBase * (1 + growthPct * 0.5 * ramp) + (m <= 6 ? investmentMonthly : 0);
    const profitBase = revenueBase - expenseBase;
    const taxLiabilityBase = revenueBase > 0 ? revenueBase * 0.18 : 0;
    const cashFlowBase = profitBase - taxLiabilityBase;
    projections.push({
      month: m,
      revenueBase,
      expenseBase,
      profitBase,
      cashFlowBase,
      taxLiabilityBase,
      riskScore: 30 + m * 1.5,
      complianceScore: Math.min(95, baseline.avgComplianceScore + 3),
    });
  }
  return projections;
}

// ─── Simulate ────────────────────────────────────────────────────────────────

export async function simulateCrossBorder(
  params: CrossBorderScenarioParameters,
  firmId?: string
): Promise<CrossBorderSimulationResult> {
  const cacheKey = buildKey('cross-border-sim', {
    scenario: params.scenarioType,
    target: params.targetCountryIso ?? '_',
    horizon: params.monthsAhead,
    mag: params.magnitudePct,
    invest: params.investmentAmount ?? '_',
    hire: params.hireCount ?? '_',
    hireCountry: params.hireCountryIso ?? '_',
    band: params.hireRoleBand ?? '_',
    severity: params.disruptionSeverity ?? '_',
    firm: firmId ?? 'all',
  });
  const cached = cacheGet<CrossBorderSimulationResult>(cacheKey);
  if (cached) return cached.value;

  const baseline = await getBaselineSnapshot(firmId);
  let projections: CrossBorderProjection[];
  switch (params.scenarioType) {
    case 'open_country': projections = await projectOpenCountry(baseline, params); break;
    case 'acquire_company': projections = await projectAcquireCompany(baseline, params); break;
    case 'hire_global': projections = await projectHireGlobal(baseline, params); break;
    case 'currency_shock': projections = await projectCurrencyShock(baseline, params); break;
    case 'tax_change': projections = await projectTaxChange(baseline, params); break;
    case 'downturn': projections = await projectDownturn(baseline, params); break;
    case 'supply_disruption': projections = await projectSupplyDisruption(baseline, params); break;
    case 'expansion': projections = await projectExpansion(baseline, params); break;
    default: projections = [];
  }

  const cumulativeRevenue = projections.reduce((s, p) => s + p.revenueBase, 0);
  const cumulativeProfit = projections.reduce((s, p) => s + p.profitBase, 0);
  const cumulativeCashFlow = projections.reduce((s, p) => s + p.cashFlowBase, 0);
  const cumulativeTaxLiability = projections.reduce((s, p) => s + p.taxLiabilityBase, 0);
  const avgRiskScore = projections.length > 0
    ? projections.reduce((s, p) => s + p.riskScore, 0) / projections.length
    : 50;
  const avgComplianceScore = projections.length > 0
    ? projections.reduce((s, p) => s + p.complianceScore, 0) / projections.length
    : 75;

  // ROI = cumulative profit / total investment (or revenue gain vs baseline)
  const totalInvestment = params.investmentAmount ??
    (params.scenarioType === 'hire_global'
      ? baseline.monthlyPayrollBase * 0.5
      : params.scenarioType === 'expansion'
        ? 2_000_000
        : 0);
  const baselineCumulativeProfit = baseline.monthlyProfitBase * params.monthsAhead;
  const incrementalProfit = cumulativeProfit - baselineCumulativeProfit;
  const roiPct = totalInvestment > 0 ? (incrementalProfit / totalInvestment) * 100 : (incrementalProfit / Math.max(1, cumulativeRevenue)) * 100;

  // Payback: first month where cumulative cash flow exceeds investment
  let paybackMonths: number | null = null;
  let runningCash = 0;
  for (const p of projections) {
    runningCash += p.cashFlowBase;
    if (runningCash >= totalInvestment && totalInvestment > 0) {
      paybackMonths = p.month;
      break;
    }
  }

  // Verdict
  let verdict: 'proceed' | 'caution' | 'avoid';
  if (roiPct > 15 && avgRiskScore < 50 && avgComplianceScore >= 70) verdict = 'proceed';
  else if (roiPct < 0 || avgRiskScore > 70 || avgComplianceScore < 50) verdict = 'avoid';
  else verdict = 'caution';

  const scenarioName = SCENARIO_META[params.scenarioType].label;
  const targetCountry = params.targetCountryIso ? getCountry(params.targetCountryIso) : undefined;

  const complianceImpact: string[] = [];
  if (params.scenarioType === 'open_country' && targetCountry) {
    const status = await getComplianceStatus(targetCountry.isoCode).catch(() => null);
    if (status) {
      complianceImpact.push(`New jurisdiction: ${targetCountry.name} (${status.totalDeadlines} active deadlines)`);
      if (status.criticalOpen > 0) complianceImpact.push(`${status.criticalOpen} critical deadlines to address in first 30 days`);
    }
    complianceImpact.push(`Accounting standard: ${targetCountry.accountingStandard.toUpperCase()}`);
    complianceImpact.push(`Tax system: ${targetCountry.taxSystem.toUpperCase()}`);
  }
  if (params.scenarioType === 'tax_change') {
    complianceImpact.push(`Reconfigure tax engine: ${params.magnitudePct > 0 ? '+' : ''}${params.magnitudePct}pp change`);
    complianceImpact.push('Update invoice templates and e-filing mappings');
  }
  if (params.scenarioType === 'hire_global' && params.hireCountryIso) {
    const struct = getPayrollStructure(params.hireCountryIso);
    if (struct) complianceImpact.push(`Payroll compliance: ${struct.structureName} (${struct.payCycle})`);
  }

  const recommendedActions: string[] = [];
  if (verdict === 'proceed') {
    recommendedActions.push('Initiate execution plan with weekly milestone reviews');
    recommendedActions.push('Allocate budget and assign project owner');
    if (params.scenarioType === 'open_country') recommendedActions.push('Engage local legal counsel for entity registration');
    if (params.scenarioType === 'hire_global') recommendedActions.push('Set up country payroll and statutory benefits before start dates');
  } else if (verdict === 'caution') {
    recommendedActions.push('Conduct deeper due diligence before committing capital');
    recommendedActions.push('Start with a smaller pilot to validate assumptions');
    recommendedActions.push('Build contingency plan for risk scenarios');
  } else {
    recommendedActions.push('Do not proceed under current parameters');
    recommendedActions.push('Re-evaluate with adjusted magnitude or horizon');
    recommendedActions.push('Consider alternative strategies');
  }

  const rationale = buildRationale({
    scenarioName,
    targetCountryName: targetCountry?.name,
    cumulativeRevenue,
    cumulativeProfit,
    roiPct,
    paybackMonths,
    avgRiskScore,
    avgComplianceScore,
    verdict,
    baselineSource: baseline.source,
  });

  const result: CrossBorderSimulationResult = {
    scenarioType: params.scenarioType,
    scenarioName,
    targetCountryIso: params.targetCountryIso,
    horizonMonths: params.monthsAhead,
    projections,
    cumulativeRevenue,
    cumulativeProfit,
    cumulativeCashFlow,
    cumulativeTaxLiability,
    avgRiskScore: Math.round(avgRiskScore * 10) / 10,
    avgComplianceScore: Math.round(avgComplianceScore * 10) / 10,
    roiPct: Math.round(roiPct * 10) / 10,
    paybackMonths,
    verdict,
    rationale,
    complianceImpact,
    recommendedActions,
    methodology: `Deterministic financial model. Baseline derived from REAL consolidated revenue/expense/payroll/tax (${baseline.source === 'real' ? 'live Prisma data' : 'empty — no consolidated data yet'}). Scenario applies ${SCENARIO_META[params.scenarioType].description.toLowerCase()}`,
  };

  // Persist to DB for audit trail
  try {
    await db.crossBorderSimulation.create({
      data: {
        scenarioType: params.scenarioType,
        scenarioName,
        targetCountryIso: params.targetCountryIso ?? null,
        parameters: JSON.stringify(params),
        projections: JSON.stringify(projections),
        verdict,
        rationale,
        roiPct: result.roiPct,
        riskScore: result.avgRiskScore,
        complianceImpact: JSON.stringify(complianceImpact),
      },
    });
  } catch (err) {
    console.error('[cross-border-twin] persist failed:', err);
  }

  cacheSet(cacheKey, result, TTL_PRESETS.HOT);
  return result;
}

function buildRationale(params: {
  scenarioName: string;
  targetCountryName?: string;
  cumulativeRevenue: number;
  cumulativeProfit: number;
  roiPct: number;
  paybackMonths: number | null;
  avgRiskScore: number;
  avgComplianceScore: number;
  verdict: string;
  baselineSource: string;
}): string {
  const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const parts: string[] = [];
  parts.push(`${params.scenarioName}${params.targetCountryName ? ` in ${params.targetCountryName}` : ''} over the projected horizon:`);
  parts.push(`Cumulative revenue ₹${fmt(params.cumulativeRevenue)}; cumulative profit ₹${fmt(params.cumulativeProfit)}.`);
  parts.push(`ROI ${params.roiPct.toFixed(1)}%${params.paybackMonths ? ` with payback in ${params.paybackMonths} months` : ' (no payback within horizon)'}`);
  parts.push(`Average risk score ${params.avgRiskScore.toFixed(1)}/100; compliance score ${params.avgComplianceScore.toFixed(1)}/100.`);
  parts.push(`Verdict: ${params.verdict.toUpperCase()}.`);
  if (params.baselineSource === 'fallback') {
    parts.push('Note: baseline had no consolidated data — projections use industry-typical ratios; connect real accounting data for higher-confidence predictions.');
  }
  return parts.join(' ');
}

// ─── List historical simulations ─────────────────────────────────────────────

export async function listCrossBorderSimulations(limit = 20): Promise<
  Array<{
    id: string;
    scenarioType: string;
    scenarioName: string;
    targetCountryIso: string | null;
    verdict: string;
    roiPct: number;
    riskScore: number;
    rationale: string;
    createdAt: Date;
  }>
> {
  const rows = await db.crossBorderSimulation.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
  });
  return rows.map((r) => ({
    id: r.id,
    scenarioType: r.scenarioType,
    scenarioName: r.scenarioName,
    targetCountryIso: r.targetCountryIso,
    verdict: r.verdict,
    roiPct: r.roiPct,
    riskScore: r.riskScore,
    rationale: r.rationale,
    createdAt: r.createdAt,
  }));
}
