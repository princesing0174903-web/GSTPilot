// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AUTONOMOUS ENTERPRISE™ — DIGITAL TWIN SIMULATOR 2.0
//
// Before executing major decisions Oracle creates multiple simulations:
// hire 5 employees, increase prices, expand city, launch product, acquire
// company, open office, raise funding. Each predicts revenue, profit, cash
// flow, GST, risk, hiring, compliance and ROI from the REAL baseline.
//
// Persisted to AutonomousSimulation; baseline snapshot comes from the live
// company observation.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  CompanyObservation,
  SimulationParameters,
  SimulationPrediction,
  SimulationScenario,
  StrategySimulation,
} from './types';
import { SCENARIO_META } from './simulator-defs';

// Re-export Prisma-free scenario metadata so existing server-side imports
// (`import { SCENARIO_META } from './simulator'`) keep working. Client
// components should import directly from './simulator-defs'.
export { SCENARIO_META } from './simulator-defs';

// ─── Run a simulation (deterministic model on the real baseline) ─────────────

export async function runSimulation(
  scenario: SimulationScenario,
  params: SimulationParameters,
  obs: CompanyObservation,
): Promise<StrategySimulation> {
  const meta = SCENARIO_META[scenario];
  const baseline: Record<string, number> = {
    revenue: obs.revenue,
    profit: obs.profit || obs.revenue * 0.12,
    cash: obs.cash,
    expenses: obs.expenses,
    gst: obs.gst,
    payroll: obs.payroll,
    employees: obs.employees,
    runwayDays: obs.runwayDays,
    healthScore: obs.healthScore,
  };

  const predictions = compute(scenario, params, obs);
  const confidence = computeConfidence(scenario, obs);
  const recommendation = recommend(predictions, scenario);

  const sim: StrategySimulation = {
    id: `sim_${scenario}_${Date.now()}`,
    scenario,
    title: meta.title,
    description: meta.description,
    parameters: params,
    baseline,
    predictions,
    confidence,
    recommendation,
    status: 'completed',
    createdAt: new Date().toISOString(),
  };

  // Persist
  try {
    const row = await db.autonomousSimulation.create({
      data: {
        scenario,
        title: meta.title,
        description: meta.description,
        parameters: JSON.stringify(params),
        baseline: JSON.stringify(baseline),
        predictions: JSON.stringify(predictions),
        confidence,
        recommendation,
        status: 'completed',
      },
    });
    sim.id = row.id;
  } catch (err) {
    console.warn('[Autonomous] persist simulation failed:', err);
  }

  return sim;
}

// ─── Load recent simulations ──────────────────────────────────────────────────

export async function loadRecentSimulations(limit = 6): Promise<StrategySimulation[]> {
  try {
    const rows = await db.autonomousSimulation.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      scenario: r.scenario as SimulationScenario,
      title: r.title,
      description: r.description,
      parameters: safeParse(r.parameters, {}),
      baseline: safeParse(r.baseline, {}),
      predictions: safeParse(r.predictions, emptyPrediction()),
      confidence: r.confidence,
      recommendation: r.recommendation as StrategySimulation['recommendation'],
      status: r.status as StrategySimulation['status'],
      approvedBy: r.approvedBy ?? undefined,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (err) {
    console.warn('[Autonomous] loadRecentSimulations failed:', err);
    return [];
  }
}

// ─── The deterministic financial model (no random/mock — pure arithmetic) ────

function compute(
  scenario: SimulationScenario,
  params: SimulationParameters,
  obs: CompanyObservation,
): SimulationPrediction {
  const revenue = obs.revenue || 100000;
  const profit = obs.profit || revenue * 0.12;
  const cash = obs.cash || 0;
  const expenses = obs.expenses || revenue * 0.7;
  const gst = obs.gst || revenue * 0.05;
  const payroll = obs.payroll || expenses * 0.4;
  const employees = obs.employees || 5;

  const monthlySalary = payroll / Math.max(employees, 1);

  switch (scenario) {
    case 'hire_employees': {
      const n = params.headcount ?? 5;
      const addedPayroll = n * monthlySalary * 12;
      const addedRevenue = revenue * 0.12 * n; // each new hire lifts revenue 12%
      const newProfit = profit + addedRevenue - addedPayroll;
      return {
        revenue: revenue + addedRevenue,
        profit: newProfit,
        cashFlow: cash - addedPayroll,
        gst: gst + addedRevenue * 0.05,
        risk: n > 10 ? 65 : 35,
        hiring: n,
        compliance: obs.compliance,
        roi: addedRevenue - addedPayroll,
        roiPct: addedPayroll > 0 ? ((addedRevenue - addedPayroll) / addedPayroll) * 100 : 0,
        runwayDays: Math.round((cash - addedPayroll / 12) / Math.max(obs.burnRate, 1) * 30),
        breakEvenMonths: addedPayroll > 0 ? Math.ceil(addedPayroll / Math.max(addedRevenue / 12, 1)) : 0,
      };
    }
    case 'increase_prices': {
      const pct = (params.priceChangePct ?? 10) / 100;
      const demandDropPct = pct * 0.4; // elastic demand
      const newRevenue = revenue * (1 + pct) * (1 - demandDropPct);
      const newProfit = newRevenue - expenses;
      return {
        revenue: newRevenue,
        profit: newProfit,
        cashFlow: cash + (newProfit - profit),
        gst: newRevenue * 0.05,
        risk: pct > 0.15 ? 55 : 30,
        hiring: 0,
        compliance: obs.compliance,
        roi: newProfit - profit,
        roiPct: profit > 0 ? ((newProfit - profit) / profit) * 100 : 0,
        runwayDays: Math.round((cash + (newProfit - profit)) / Math.max(obs.burnRate, 1) * 30),
        breakEvenMonths: 0,
      };
    }
    case 'expand_city': {
      const setupCost = 800000;
      const rampRevenue = revenue * 0.2;
      const newProfit = profit + rampRevenue - setupCost / 12;
      return {
        revenue: revenue + rampRevenue,
        profit: newProfit,
        cashFlow: cash - setupCost,
        gst: gst + rampRevenue * 0.05,
        risk: 50,
        hiring: 3,
        compliance: Math.min(100, obs.compliance + 5),
        roi: rampRevenue * 12 - setupCost,
        roiPct: ((rampRevenue * 12 - setupCost) / setupCost) * 100,
        runwayDays: Math.round((cash - setupCost) / Math.max(obs.burnRate, 1) * 30),
        breakEvenMonths: Math.ceil(setupCost / Math.max(rampRevenue, 1)),
      };
    }
    case 'launch_product': {
      const buildCost = 1500000;
      const newRevenue = revenue * 0.15;
      const newProfit = profit + newRevenue - buildCost / 12;
      return {
        revenue: revenue + newRevenue,
        profit: newProfit,
        cashFlow: cash - buildCost / 12,
        gst: gst + newRevenue * 0.05,
        risk: 60,
        hiring: 2,
        compliance: obs.compliance,
        roi: newRevenue * 12 - buildCost,
        roiPct: ((newRevenue * 12 - buildCost) / buildCost) * 100,
        runwayDays: Math.round((cash - buildCost / 12) / Math.max(obs.burnRate, 1) * 30),
        breakEvenMonths: Math.ceil(buildCost / Math.max(newRevenue, 1)),
      };
    }
    case 'acquire_company': {
      const dealSize = params.fundingAmount ?? 5000000;
      const synergy = revenue * 0.3;
      const integration = dealSize * 0.15;
      const newProfit = profit + synergy - integration / 12;
      return {
        revenue: revenue + synergy,
        profit: newProfit,
        cashFlow: cash - dealSize,
        gst: gst + synergy * 0.05,
        risk: 75,
        hiring: 0,
        compliance: Math.max(0, obs.compliance - 5),
        roi: synergy * 12 - integration,
        roiPct: ((synergy * 12 - integration) / dealSize) * 100,
        runwayDays: Math.round((cash - dealSize) / Math.max(obs.burnRate, 1) * 30),
        breakEvenMonths: Math.ceil(dealSize / Math.max(synergy, 1)),
      };
    }
    case 'open_office': {
      const capex = 1200000;
      const opex = 200000;
      const enableRevenue = revenue * 0.1;
      const newProfit = profit + enableRevenue - opex;
      return {
        revenue: revenue + enableRevenue,
        profit: newProfit,
        cashFlow: cash - capex - opex,
        gst: gst + enableRevenue * 0.05,
        risk: 45,
        hiring: 4,
        compliance: obs.compliance,
        roi: enableRevenue * 12 - opex * 12 - capex,
        roiPct: ((enableRevenue * 12 - opex * 12 - capex) / (capex + opex * 12)) * 100,
        runwayDays: Math.round((cash - capex) / Math.max(obs.burnRate, 1) * 30),
        breakEvenMonths: Math.ceil(capex / Math.max(enableRevenue - opex, 1)),
      };
    }
    case 'raise_funding': {
      const raise = params.fundingAmount ?? 5000000;
      const newCash = cash + raise;
      const growthInvest = raise * 0.7;
      const newRevenue = revenue + growthInvest * 0.5;
      return {
        revenue: newRevenue,
        profit: profit - raise * 0.02, // small cost of capital
        cashFlow: newCash,
        gst: gst + (newRevenue - revenue) * 0.05,
        risk: 25,
        hiring: 5,
        compliance: obs.compliance,
        roi: (newRevenue - revenue) * 12 - raise * 0.02 * 12,
        roiPct: ((newRevenue - revenue) * 12 / raise) * 100,
        runwayDays: Math.round(newCash / Math.max(obs.burnRate, 1) * 30),
        breakEvenMonths: 0,
      };
    }
    case 'cut_costs': {
      const pct = (params.costCutPct ?? 15) / 100;
      const savings = expenses * pct;
      const newProfit = profit + savings;
      return {
        revenue,
        profit: newProfit,
        cashFlow: cash + savings,
        gst,
        risk: pct > 0.2 ? 50 : 30,
        hiring: 0,
        compliance: obs.compliance,
        roi: savings * 12,
        roiPct: (savings / expenses) * 100,
        runwayDays: Math.round((cash + savings) / Math.max(obs.burnRate - savings, 1) * 30),
        breakEvenMonths: 0,
      };
    }
    case 'delay_payment': {
      const days = params.delayDays ?? 15;
      const payables = obs.payables || expenses * 0.5;
      const benefit = (payables * days) / 30;
      return {
        revenue,
        profit,
        cashFlow: cash + benefit,
        gst,
        risk: days > 30 ? 60 : 35,
        hiring: 0,
        compliance: Math.max(0, obs.compliance - 3),
        roi: benefit,
        roiPct: payables > 0 ? (benefit / payables) * 100 : 0,
        runwayDays: Math.round((cash + benefit) / Math.max(obs.burnRate, 1) * 30),
        breakEvenMonths: 0,
      };
    }
    case 'switch_vendor': {
      const savings = expenses * 0.08;
      const switching = expenses * 0.04;
      const newProfit = profit + savings - switching;
      return {
        revenue,
        profit: newProfit,
        cashFlow: cash + savings - switching,
        gst,
        risk: 40,
        hiring: 0,
        compliance: obs.compliance,
        roi: savings * 12 - switching,
        roiPct: ((savings * 12 - switching) / switching) * 100,
        runwayDays: Math.round((cash + savings - switching) / Math.max(obs.burnRate, 1) * 30),
        breakEvenMonths: 1,
      };
    }
  }
}

function computeConfidence(scenario: SimulationScenario, obs: CompanyObservation): number {
  // Confidence is higher when we have live data; lower for irreversible moves
  const liveBoost = obs.revenue > 0 ? 0.15 : 0;
  const base: Record<SimulationScenario, number> = {
    hire_employees: 0.74, increase_prices: 0.68, expand_city: 0.6,
    launch_product: 0.58, acquire_company: 0.45, open_office: 0.66,
    raise_funding: 0.72, cut_costs: 0.78, delay_payment: 0.8, switch_vendor: 0.7,
  };
  return Math.min(0.95, base[scenario] + liveBoost);
}

function recommend(p: SimulationPrediction, scenario: SimulationScenario): StrategySimulation['recommendation'] {
  if (p.roiPct >= 25 && p.risk < 50) return 'proceed';
  if (p.roiPct >= 10 && p.risk < 65) return 'caution';
  if (scenario === 'acquire_company' && p.risk >= 70) return 'needs_review';
  if (p.roiPct < 0) return 'avoid';
  return 'needs_review';
}

function emptyPrediction(): SimulationPrediction {
  return {
    revenue: 0, profit: 0, cashFlow: 0, gst: 0, risk: 0, hiring: 0,
    compliance: 0, roi: 0, roiPct: 0, runwayDays: 0, breakEvenMonths: 0,
  };
}

function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}
