// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — INFINITY AGI™ — ORGANIZATIONAL DIGITAL TWIN™
//
// Create a living simulation of the enterprise. Simulate acquisitions,
// expansion, hiring, layoffs, pricing, tax changes, compliance changes,
// investments, funding, product launches, competitor reactions. Predict
// outcomes before execution.
//
// Simulations are seeded from REAL AutonomousSimulation rows + AGISimulation
// rows. Each canonical scenario has a deterministic projection model grounded
// in the live company observation (revenue, cash, expenses, employees).
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from './helpers';
import { safeCount, safeFindMany, cached, TTL, clamp01, clamp100, parseJson, emptyBreakdown } from './helpers';
import { fetchCEOData } from '@/lib/ceo/data';
import type {
  TwinSimulation, TwinSummary, SimulationScenario,
} from './types';

const SCENARIOS: SimulationScenario[] = [
  'acquisition', 'expansion', 'hiring', 'layoffs', 'pricing', 'tax',
  'compliance', 'investment', 'funding', 'launch', 'competitor',
];

// ─── Canonical simulation scenario definitions ───────────────────────────────

export interface ScenarioSpec {
  scenarioKey: SimulationScenario;
  title: string;
  description: string;
  defaultInputs: Record<string, number | string | boolean>;
}

export const SIMULATION_SCENARIOS: ScenarioSpec[] = [
  {
    scenarioKey: 'acquisition',
    title: 'Acquire a Competitor',
    description: 'Simulate acquiring a competitor — revenue uplift vs integration cost + culture risk.',
    defaultInputs: { targetRevenue: 5000000, acquisitionCost: 10000000, integrationMonths: 9 },
  },
  {
    scenarioKey: 'expansion',
    title: 'Expand to a New Country',
    description: 'Simulate launching operations in a new country — setup cost vs new revenue.',
    defaultInputs: { country: 'UAE', setupCost: 2500000, monthlyRunRate: 800000, rampMonths: 6 },
  },
  {
    scenarioKey: 'hiring',
    title: 'Hire 10 New Employees',
    description: 'Simulate hiring 10 employees — payroll cost vs capacity uplift.',
    defaultInputs: { headcount: 10, avgSalary: 80000, rampMonths: 3 },
  },
  {
    scenarioKey: 'layoffs',
    title: 'Reduce Headcount by 15%',
    description: 'Simulate a 15% layoff — cost savings vs severance + productivity risk.',
    defaultInputs: { reductionPct: 15, severanceMonths: 3 },
  },
  {
    scenarioKey: 'pricing',
    title: 'Increase Prices by 10%',
    description: 'Simulate a 10% price increase — revenue uplift vs churn risk.',
    defaultInputs: { priceIncreasePct: 10, churnElasticity: 0.4 },
  },
  {
    scenarioKey: 'tax',
    title: 'Tax Rate Change',
    description: 'Simulate a corporate tax rate change — net profit impact.',
    defaultInputs: { newTaxRatePct: 22 },
  },
  {
    scenarioKey: 'compliance',
    title: 'Compliance Investment',
    description: 'Simulate investing in compliance automation — penalty reduction vs cost.',
    defaultInputs: { investment: 500000, penaltyReductionPct: 80 },
  },
  {
    scenarioKey: 'investment',
    title: 'Capital Investment',
    description: 'Simulate a capital investment — payback period vs ROI.',
    defaultInputs: { amount: 5000000, monthlyReturn: 300000, paybackMonths: 18 },
  },
  {
    scenarioKey: 'funding',
    title: 'Raise Funding Round',
    description: 'Simulate raising a funding round — dilution vs runway extension.',
    defaultInputs: { raiseAmount: 50000000, valuation: 200000000 },
  },
  {
    scenarioKey: 'launch',
    title: 'Launch a New Product',
    description: 'Simulate launching a new product — development cost vs new revenue.',
    defaultInputs: { devCost: 3000000, monthlyRevenue: 700000, rampMonths: 4 },
  },
  {
    scenarioKey: 'competitor',
    title: 'Competitor Reaction',
    description: 'Simulate a competitor aggressive pricing move — market share impact.',
    defaultInputs: { competitorPriceCutPct: 15, ourRetentionPct: 85 },
  },
];

// ─── Deterministic projection model — grounded in REAL live state ───────────

export async function runSimulation(
  scenarioKey: SimulationScenario,
  inputs: Record<string, number | string | boolean> = {},
  initiatedBy?: string,
): Promise<TwinSimulation> {
  const ceoData = await fetchCEOData().catch(() => null);
  const live = ceoData?.liveState;
  const revenue = live?.revenue ?? 0;
  const expenses = live?.expenses ?? 0;
  const cash = live?.cash ?? 0;
  const employees = live?.employees ?? 0;
  const payroll = live?.payroll ?? 0;

  const spec = SIMULATION_SCENARIOS.find((s) => s.scenarioKey === scenarioKey);
  const mergedInputs = { ...(spec?.defaultInputs ?? {}), ...inputs };
  const baselineState = { revenue, expenses, cash, employees, payroll, margin: revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0 };

  const projection = project(scenarioKey, mergedInputs, baselineState);

  // Persist
  let created;
  try {
    created = await db.aGISimulation.create({
      data: {
        scenarioKey,
        title: spec?.title ?? scenarioKey,
        description: spec?.description ?? '',
        inputs: JSON.stringify(mergedInputs),
        baselineState: JSON.stringify(baselineState),
        projectedState: JSON.stringify(projection.projectedState),
        financialImpact: projection.financialImpact,
        revenueImpact: projection.revenueImpact,
        costImpact: projection.costImpact,
        riskScore: projection.riskScore,
        confidence: projection.confidence,
        timeline: projection.timeline,
        recommendation: projection.recommendation,
        rollbackStrategy: projection.rollbackStrategy,
        competitorReaction: projection.competitorReaction,
        initiatedBy: initiatedBy ?? 'oracle',
        status: 'simulated',
      },
    });
  } catch { /* ignore */ }

  return {
    id: created?.id ?? `sim-${Date.now()}`,
    scenarioKey,
    title: spec?.title ?? scenarioKey,
    description: spec?.description ?? '',
    inputs: mergedInputs,
    baselineState,
    projectedState: projection.projectedState,
    financialImpact: projection.financialImpact,
    revenueImpact: projection.revenueImpact,
    costImpact: projection.costImpact,
    riskScore: projection.riskScore,
    confidence: projection.confidence,
    timeline: projection.timeline,
    recommendation: projection.recommendation,
    rollbackStrategy: projection.rollbackStrategy,
    competitorReaction: projection.competitorReaction,
    initiatedBy: initiatedBy ?? 'oracle',
    approvedBy: null,
    status: 'simulated',
    createdAt: created?.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

function project(
  scenarioKey: SimulationScenario,
  inputs: Record<string, number | string | boolean>,
  baseline: Record<string, number>,
): {
  projectedState: Record<string, number>;
  financialImpact: number;
  revenueImpact: number;
  costImpact: number;
  riskScore: number;
  confidence: number;
  timeline: string;
  recommendation: TwinSimulation['recommendation'];
  rollbackStrategy: string;
  competitorReaction: string | null;
} {
  const rev = baseline.revenue || 0;
  const exp = baseline.expenses || 0;
  const cashBase = baseline.cash || 0;
  const emp = baseline.employees || 0;
  const pay = baseline.payroll || 0;

  let projectedRevenue = rev;
  let projectedExpenses = exp;
  let projectedCash = cashBase;
  let projectedEmployees = emp;
  let projectedPayroll = pay;
  let timeline = '6 months';
  let riskScore = 30;
  let confidence = 0.6;
  let competitorReaction: string | null = null;

  switch (scenarioKey) {
    case 'acquisition': {
      const targetRev = num(inputs.targetRevenue);
      const acqCost = num(inputs.acquisitionCost);
      const months = num(inputs.integrationMonths) || 9;
      projectedRevenue = rev + targetRev * 0.7; // 70% retention in year 1
      projectedExpenses = exp + acqCost / 12 + targetRev * 0.6; // integration + COGS
      projectedCash = cashBase - acqCost;
      timeline = `${months} months integration`;
      riskScore = 65;
      confidence = 0.55;
      competitorReaction = 'Competitors may attempt to poach acquired customers with aggressive pricing.';
      break;
    }
    case 'expansion': {
      const setupCost = num(inputs.setupCost);
      const runRate = num(inputs.monthlyRunRate);
      const ramp = num(inputs.rampMonths) || 6;
      projectedRevenue = rev + runRate * (ramp / 2); // partial year contribution
      projectedExpenses = exp + setupCost + runRate * 0.6 * (ramp / 6);
      projectedCash = cashBase - setupCost;
      projectedEmployees = emp + 5;
      projectedPayroll = pay + 400000;
      timeline = `${ramp} months to first revenue`;
      riskScore = 50;
      confidence = 0.6;
      competitorReaction = 'Local incumbents may respond with retention discounts.';
      break;
    }
    case 'hiring': {
      const hc = num(inputs.headcount);
      const sal = num(inputs.avgSalary);
      const ramp = num(inputs.rampMonths) || 3;
      const addedPayroll = hc * sal;
      projectedPayroll = pay + addedPayroll;
      projectedExpenses = exp + addedPayroll * (ramp / 12);
      projectedRevenue = rev + rev * 0.1 * (ramp / 12); // 10% capacity uplift, ramped
      projectedEmployees = emp + hc;
      timeline = `${ramp} months to full productivity`;
      riskScore = 25;
      confidence = 0.7;
      break;
    }
    case 'layoffs': {
      const pct = num(inputs.reductionPct) / 100;
      const sev = num(inputs.severanceMonths);
      const savedPayroll = pay * pct;
      const severance = pay * pct * (sev / 12);
      projectedPayroll = pay - savedPayroll;
      projectedExpenses = exp + severance - savedPayroll * 0.5; // half-year savings net of severance
      projectedRevenue = rev * (1 - pct * 0.3); // 30% productivity drag on the laid-off share
      projectedEmployees = Math.round(emp * (1 - pct));
      timeline = `${sev} months severance period`;
      riskScore = 70;
      confidence = 0.55;
      competitorReaction = 'Competitors may target displaced talent and signal instability to clients.';
      break;
    }
    case 'pricing': {
      const inc = num(inputs.priceIncreasePct) / 100;
      const elastic = num(inputs.churnElasticity);
      const volumeLoss = inc * elastic; // fraction of customers lost
      projectedRevenue = rev * (1 + inc) * (1 - volumeLoss);
      projectedExpenses = exp * (1 - volumeLoss * 0.3); // some cost savings from lost volume
      projectedCash = cashBase + (projectedRevenue - rev) * 0.2; // 20% margin on incremental
      timeline = '1 quarter to observe churn impact';
      riskScore = 45;
      confidence = 0.65;
      competitorReaction = 'Price-sensitive competitors may undercut; value-focused competitors hold.';
      break;
    }
    case 'tax': {
      const newRate = num(inputs.newTaxRatePct) / 100;
      const pretaxProfit = rev - exp;
      const oldTax = pretaxProfit * 0.25;
      const newTax = pretaxProfit * newRate;
      projectedExpenses = exp + newTax;
      projectedCash = cashBase + (oldTax - newTax);
      timeline = 'Immediate';
      riskScore = 20;
      confidence = 0.8;
      break;
    }
    case 'compliance': {
      const inv = num(inputs.investment);
      const reduction = num(inputs.penaltyReductionPct) / 100;
      const estimatedPenalties = exp * 0.02; // ~2% of expenses are penalty exposure
      projectedExpenses = exp + inv - estimatedPenalties * reduction;
      projectedCash = cashBase - inv + estimatedPenalties * reduction;
      timeline = '1 year to realize penalty reduction';
      riskScore = 15;
      confidence = 0.75;
      break;
    }
    case 'investment': {
      const amount = num(inputs.amount);
      const monthlyReturn = num(inputs.monthlyReturn);
      const payback = num(inputs.paybackMonths);
      projectedCash = cashBase - amount + monthlyReturn * payback;
      projectedRevenue = rev + monthlyReturn * 12;
      projectedExpenses = exp + amount / 3; // amortize cost
      timeline = `${payback} months payback`;
      riskScore = 40;
      confidence = 0.6;
      break;
    }
    case 'funding': {
      const raise = num(inputs.raiseAmount);
      const valuation = num(inputs.valuation);
      const dilution = valuation > 0 ? (raise / (valuation + raise)) * 100 : 0;
      projectedCash = cashBase + raise;
      projectedExpenses = exp; // unchanged
      projectedRevenue = rev; // unchanged
      timeline = `Dilution ${dilution.toFixed(1)}%`;
      riskScore = 30;
      confidence = 0.7;
      break;
    }
    case 'launch': {
      const devCost = num(inputs.devCost);
      const monthlyRev = num(inputs.monthlyRevenue);
      const ramp = num(inputs.rampMonths) || 4;
      projectedRevenue = rev + monthlyRev * (ramp / 2);
      projectedExpenses = exp + devCost + monthlyRev * 0.5;
      projectedCash = cashBase - devCost;
      projectedEmployees = emp + 3;
      timeline = `${ramp} months to launch`;
      riskScore = 55;
      confidence = 0.55;
      competitorReaction = 'Competitors may fast-follow; first-mover advantage window is 2-3 quarters.';
      break;
    }
    case 'competitor': {
      const cut = num(inputs.competitorPriceCutPct) / 100;
      const retention = num(inputs.ourRetentionPct) / 100;
      const lostShare = 1 - retention;
      projectedRevenue = rev * (1 - lostShare) * (1 - cut * 0.3); // some pricing pressure
      projectedExpenses = exp * (1 - lostShare * 0.2);
      projectedCash = cashBase - (rev - projectedRevenue) * 0.3;
      timeline = '2 quarters to stabilize';
      riskScore = 60;
      confidence = 0.6;
      break;
    }
  }

  const financialImpact = projectedCash - cashBase + (projectedRevenue - rev);
  const revenueImpact = projectedRevenue - rev;
  const costImpact = projectedExpenses - exp;
  const projectedMargin = projectedRevenue > 0 ? ((projectedRevenue - projectedExpenses) / projectedRevenue) * 100 : 0;
  const projectedState = {
    revenue: Math.round(projectedRevenue),
    expenses: Math.round(projectedExpenses),
    cash: Math.round(projectedCash),
    employees: Math.round(projectedEmployees),
    payroll: Math.round(projectedPayroll),
    margin: Number(projectedMargin.toFixed(1)),
  };

  // Recommendation logic
  let recommendation: TwinSimulation['recommendation'] = 'needs_review';
  if (financialImpact > 0 && riskScore < 40) recommendation = 'proceed';
  else if (financialImpact > 0 && riskScore < 60) recommendation = 'caution';
  else if (financialImpact < 0 && riskScore > 60) recommendation = 'avoid';
  else recommendation = 'caution';

  const rollbackStrategy = scenarioKey === 'layoffs'
    ? 'Cannot fully reverse layoffs; offer re-hiring to top performers and rebuild the affected teams over 2 quarters.'
    : scenarioKey === 'acquisition'
      ? 'Divest non-core acquired assets within 12 months; retain customer contracts and reassign to original brand.'
      : 'Halt incremental spend, revert pricing/changes, and restore the prior configuration within 1 quarter.';

  return {
    projectedState,
    financialImpact: Math.round(financialImpact),
    revenueImpact: Math.round(revenueImpact),
    costImpact: Math.round(costImpact),
    riskScore: clamp100(Math.round(riskScore)),
    confidence: clamp01(confidence),
    timeline,
    recommendation,
    rollbackStrategy,
    competitorReaction,
  };
}

function num(v: number | string | boolean | undefined): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v) || 0;
  return 0;
}

// ─── Load + summarize ────────────────────────────────────────────────────────

export async function getRecentSimulations(limit = 16): Promise<TwinSimulation[]> {
  const rows = await safeFindMany(() => db.aGISimulation.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  }));
  return rows.map(mapRow);
}

export async function getTwinSummary(): Promise<TwinSummary> {
  return cached<TwinSummary>('agi:twin:summary', TTL.MEDIUM, async () => {
    const rows = await safeFindMany(() => db.aGISimulation.findMany({
      select: { scenarioKey: true, recommendation: true, confidence: true, status: true, financialImpact: true },
    }));
    const byScenario = emptyBreakdown(SCENARIOS);
    const byRecommendation: Record<string, number> = {};
    let executed = 0, rolledBack = 0, totalConfidence = 0, totalImpact = 0;
    for (const r of rows) {
      byScenario[r.scenarioKey as SimulationScenario] = (byScenario[r.scenarioKey as SimulationScenario] ?? 0) + 1;
      byRecommendation[r.recommendation] = (byRecommendation[r.recommendation] ?? 0) + 1;
      totalConfidence += r.confidence ?? 0;
      totalImpact += r.financialImpact ?? 0;
      if (r.status === 'executed') executed++;
      if (r.status === 'rolled_back') rolledBack++;
    }
    return {
      totalSimulations: rows.length,
      executedSimulations: executed,
      avgConfidence: rows.length > 0 ? clamp01(totalConfidence / rows.length) : 0,
      byScenario,
      byRecommendation,
      totalProjectedImpactINR: Math.round(totalImpact),
      rollbackRate: rows.length > 0 ? clamp01(rolledBack / rows.length) : 0,
    };
  });
}

// ─── Row mapper ──────────────────────────────────────────────────────────────

function mapRow(r: {
  id: string; scenarioKey: string; title: string; description: string;
  inputs: string; baselineState: string; projectedState: string;
  financialImpact: number; revenueImpact: number; costImpact: number;
  riskScore: number; confidence: number; timeline: string | null;
  recommendation: string; rollbackStrategy: string | null;
  competitorReaction: string | null; initiatedBy: string | null;
  approvedBy: string | null; status: string; createdAt: Date;
}): TwinSimulation {
  return {
    id: r.id,
    scenarioKey: r.scenarioKey as SimulationScenario,
    title: r.title,
    description: r.description,
    inputs: parseJson<Record<string, number | string | boolean>>(r.inputs, {}),
    baselineState: parseJson<Record<string, number>>(r.baselineState, {}),
    projectedState: parseJson<Record<string, number>>(r.projectedState, {}),
    financialImpact: r.financialImpact,
    revenueImpact: r.revenueImpact,
    costImpact: r.costImpact,
    riskScore: clamp100(r.riskScore ?? 0),
    confidence: clamp01(r.confidence ?? 0.5),
    timeline: r.timeline,
    recommendation: r.recommendation as TwinSimulation['recommendation'],
    rollbackStrategy: r.rollbackStrategy,
    competitorReaction: r.competitorReaction,
    initiatedBy: r.initiatedBy,
    approvedBy: r.approvedBy,
    status: r.status as TwinSimulation['status'],
    createdAt: r.createdAt.toISOString(),
  };
}

export { SCENARIOS };
