// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT DIGITAL TWIN™ — DECISION IMPACT ENGINE™
//
// Before any action, Oracle simulates the impact. Given a decision (hire N
// employees, open an office, increase salaries, buy equipment, take a loan,
// increase marketing, expand to a city), this engine projects the impact on:
//
//   • Cash Impact           (monthly)
//   • Profit Impact          (monthly)
//   • GST Impact             (monthly)
//   • Risk Impact            (signed delta to risk score)
//   • Working Capital Impact (signed delta)
//   • Business Health Impact (signed delta to health score)
//
// Then produces a recommendation (go | caution | hold | avoid) with a
// confidence score, reason, conditions to watch, and follow-up actions.
//
// All projections start from the REAL current business state (revenue, cash,
// expenses, payroll, runway) — never from mock values.
// ═══════════════════════════════════════════════════════════════════════════════

import { computeLiveBusinessState } from './live-state';
import { fetchRawCFOData, inrCompact } from '@/lib/cfo/phase1/data';
import type { DecisionRequest, DecisionImpact } from './types';

// ─── Monthly cost model per decision type ────────────────────────────────────

interface DecisionModel {
  monthlyCashDelta: number;        // negative = drain
  monthlyProfitDelta: number;
  monthlyGstDelta: number;
  upfrontCash: number;             // one-time cost
  workingCapitalDelta: number;
  riskDelta: number;              // signed
  healthDelta: number;            // signed
  revenueUpliftMonthly: number;   // expected new revenue
  confidence: number;             // 0-100
  conditions: string[];
  actions: string[];
}

function modelDecision(req: DecisionRequest, ctx: {
  avgSalary: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  monthlyPayroll: number;
  currentCash: number;
  runwayDays: number;
  monthlyGstLiability: number;
}): DecisionModel {
  const p = req.params;
  const baseConfidence = 70;

  switch (req.type) {
    case 'hire_employees': {
      const headcount = p.headcountDelta || 1;
      const newPayroll = headcount * ctx.avgSalary;
      const monthlyCashDelta = -newPayroll;
      // GST impact: new employees generate no GST directly, but their output may
      const monthlyGstDelta = 0;
      const monthlyProfitDelta = -newPayroll + (p.revenueUpliftPct ? ctx.monthlyRevenue * (p.revenueUpliftPct / 100) : 0);
      const riskDelta = ctx.runwayDays > 0 && ctx.runwayDays < 90 ? 8 : 3;
      const healthDelta = -Math.min(10, headcount * 2);
      const workingCapitalDelta = -newPayroll;
      const revenueUpliftMonthly = p.revenueUpliftPct ? ctx.monthlyRevenue * (p.revenueUpliftPct / 100) : 0;
      return {
        monthlyCashDelta, monthlyProfitDelta, monthlyGstDelta,
        upfrontCash: 0, workingCapitalDelta, riskDelta, healthDelta,
        revenueUpliftMonthly,
        confidence: Math.max(50, baseConfidence - (headcount > 5 ? 15 : 5)),
        conditions: [
          `Runway after hire: ~${Math.max(0, Math.floor((ctx.currentCash / Math.max(1, ctx.monthlyExpenses + newPayroll)) * 30))} days`,
          `Payroll rises from ${inrCompact(ctx.monthlyPayroll)} to ${inrCompact(ctx.monthlyPayroll + newPayroll)} (+${((newPayroll / Math.max(1, ctx.monthlyPayroll)) * 100).toFixed(1)}%)`,
        ],
        actions: [
          'Track productivity of new hires weekly for 90 days',
          'Review revenue uplift target monthly',
          'Maintain 6 months runway buffer',
        ],
      };
    }

    case 'open_office': {
      const monthlyRent = p.monthlyCost || 50000;
      const upfront = p.upfrontCost || monthlyRent * 3; // deposit
      const monthlyCashDelta = -monthlyRent;
      const monthlyProfitDelta = -monthlyRent + (p.revenueUpliftPct ? ctx.monthlyRevenue * (p.revenueUpliftPct / 100) : 0);
      // Office rent has 18% GST, claimable as ITC
      const monthlyGstDelta = -(monthlyRent * 0.18);
      const riskDelta = ctx.currentCash < upfront * 2 ? 10 : 4;
      const healthDelta = -5;
      const workingCapitalDelta = -upfront - monthlyRent;
      const revenueUpliftMonthly = p.revenueUpliftPct ? ctx.monthlyRevenue * (p.revenueUpliftPct / 100) : 0;
      return {
        monthlyCashDelta, monthlyProfitDelta, monthlyGstDelta,
        upfrontCash: upfront, workingCapitalDelta, riskDelta, healthDelta,
        revenueUpliftMonthly,
        confidence: baseConfidence - 5,
        conditions: [
          `Upfront deposit: ${inrCompact(upfront)}`,
          `Monthly rent (GST-claimable): ${inrCompact(monthlyRent)}`,
          `Break-even revenue uplift needed: ${((monthlyRent / Math.max(1, ctx.monthlyRevenue)) * 100).toFixed(1)}%`,
        ],
        actions: [
          'Negotiate 3-month rent-free period',
          'Claim 18% GST ITC on rent',
          'Set 6-month revenue uplift target',
        ],
      };
    }

    case 'increase_salaries': {
      const pct = p.salaryIncreasePct || 10;
      const additionalPayroll = ctx.monthlyPayroll * (pct / 100);
      const monthlyCashDelta = -additionalPayroll;
      const monthlyProfitDelta = -additionalPayroll;
      const monthlyGstDelta = 0;
      const riskDelta = pct > 20 ? 8 : 3;
      const healthDelta = -Math.min(8, pct / 3);
      const workingCapitalDelta = -additionalPayroll;
      return {
        monthlyCashDelta, monthlyProfitDelta, monthlyGstDelta,
        upfrontCash: 0, workingCapitalDelta, riskDelta, healthDelta,
        revenueUpliftMonthly: 0,
        confidence: baseConfidence,
        conditions: [
          `Payroll rises by ${inrCompact(additionalPayroll)}/mo (${pct}% of ${inrCompact(ctx.monthlyPayroll)})`,
          `Annual additional cost: ${inrCompact(additionalPayroll * 12)}`,
          `Runway impact: -${Math.floor((additionalPayroll / Math.max(1, ctx.monthlyExpenses)) * 30)} days`,
        ],
        actions: [
          'Tie increase to performance review',
          'Communicate clear growth path',
          'Re-evaluate in 6 months',
        ],
      };
    }

    case 'buy_equipment': {
      const cost = p.upfrontCost || p.monthlyCost || 100000;
      const isEMI = !!p.monthlyCost && !p.upfrontCost;
      const monthlyEMI = isEMI ? (p.monthlyCost || 0) : 0;
      const upfront = isEMI ? 0 : cost;
      const monthlyCashDelta = -monthlyEMI;
      const monthlyProfitDelta = -monthlyEMI - (upfront / 60); // depreciate over 5 years
      const monthlyGstDelta = -(cost * 0.18 * (isEMI ? 1 / 60 : 1)); // ITC claim
      const riskDelta = ctx.currentCash < upfront * 1.5 ? 12 : 5;
      const healthDelta = -6;
      const workingCapitalDelta = -upfront;
      return {
        monthlyCashDelta, monthlyProfitDelta, monthlyGstDelta,
        upfrontCash: upfront, workingCapitalDelta, riskDelta, healthDelta,
        revenueUpliftMonthly: p.revenueUpliftPct ? ctx.monthlyRevenue * (p.revenueUpliftPct / 100) : 0,
        confidence: baseConfidence - 10,
        conditions: [
          isEMI ? `Monthly EMI: ${inrCompact(monthlyEMI)} for 60 months` : `One-time cost: ${inrCompact(upfront)}`,
          `GST ITC claimable: ${inrCompact(cost * 0.18)}`,
          `Depreciation: ${inrCompact(cost / 60)}/mo over 5 years`,
        ],
        actions: [
          'Claim 18% GST ITC on purchase',
          'Insure equipment against damage',
          'Track ROI quarterly',
        ],
      };
    }

    case 'take_loan': {
      const principal = p.loanAmount || 500000;
      const annualRate = (p.loanInterestPct || 12) / 100;
      const months = p.loanTenureMonths || 36;
      // EMI formula
      const r = annualRate / 12;
      const emi = months > 0 && r > 0
        ? (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
        : principal / months;
      const monthlyCashDelta = principal - emi; // inflow then outflow (net first month positive)
      const monthlyProfitDelta = -emi; // interest expense
      const monthlyGstDelta = 0; // loans are not subject to GST
      const riskDelta = 10 + Math.floor(principal / 1000000);
      const healthDelta = -8;
      const workingCapitalDelta = principal; // immediate inflow
      return {
        monthlyCashDelta: -emi, // ongoing monthly outflow
        monthlyProfitDelta,
        monthlyGstDelta,
        upfrontCash: principal, // one-time inflow
        workingCapitalDelta,
        riskDelta,
        healthDelta,
        revenueUpliftMonthly: 0,
        confidence: baseConfidence - 5,
        conditions: [
          `EMI: ${inrCompact(emi)}/mo for ${months} months at ${(p.loanInterestPct || 12)}% p.a.`,
          `Total interest: ${inrCompact(emi * months - principal)}`,
          `Debt service ratio: ${((emi / Math.max(1, ctx.monthlyRevenue)) * 100).toFixed(1)}% of revenue`,
        ],
        actions: [
          'Maintain debt service ratio below 30%',
          'Use loan only for revenue-generating assets',
          'Build prepayment buffer',
        ],
      };
    }

    case 'increase_marketing': {
      const spend = p.monthlyCost || 50000;
      const upliftPct = p.revenueUpliftPct || 10;
      const upliftRevenue = ctx.monthlyRevenue * (upliftPct / 100);
      const monthlyCashDelta = -spend;
      const monthlyProfitDelta = -spend + upliftRevenue;
      const monthlyGstDelta = -(spend * 0.18); // GST on marketing services, claimable
      const riskDelta = 2;
      const healthDelta = upliftRevenue > spend ? 5 : -3;
      const workingCapitalDelta = -spend;
      return {
        monthlyCashDelta, monthlyProfitDelta, monthlyGstDelta,
        upfrontCash: 0, workingCapitalDelta, riskDelta, healthDelta,
        revenueUpliftMonthly: upliftRevenue,
        confidence: baseConfidence - 8,
        conditions: [
          `Monthly spend: ${inrCompact(spend)}`,
          `Expected revenue uplift: ${inrCompact(upliftRevenue)} (${upliftPct}%)`,
          `ROAS target: ${((upliftRevenue / Math.max(1, spend))).toFixed(2)}x`,
          `Break-even uplift needed: ${((spend / Math.max(1, ctx.monthlyRevenue)) * 100).toFixed(1)}%`,
        ],
        actions: [
          'Set 3x ROAS target',
          'A/B test channels weekly',
          'Review performance monthly',
        ],
      };
    }

    case 'expand_city': {
      const city = p.city || 'new city';
      const setupCost = p.upfrontCost || 200000;
      const monthlyOpex = p.monthlyCost || 80000;
      const upliftPct = p.revenueUpliftPct || 15;
      const upliftRevenue = ctx.monthlyRevenue * (upliftPct / 100);
      const monthlyCashDelta = -monthlyOpex;
      const monthlyProfitDelta = -monthlyOpex + upliftRevenue;
      const monthlyGstDelta = -(monthlyOpex * 0.18);
      const riskDelta = 8;
      const healthDelta = upliftRevenue > monthlyOpex ? 8 : -5;
      const workingCapitalDelta = -setupCost - monthlyOpex;
      return {
        monthlyCashDelta, monthlyProfitDelta, monthlyGstDelta,
        upfrontCash: setupCost, workingCapitalDelta, riskDelta, healthDelta,
        revenueUpliftMonthly: upliftRevenue,
        confidence: baseConfidence - 15,
        conditions: [
          `City: ${city}`,
          `Setup cost: ${inrCompact(setupCost)}`,
          `Monthly opex: ${inrCompact(monthlyOpex)}`,
          `Expected revenue uplift: ${inrCompact(upliftRevenue)} (${upliftPct}%)`,
          `Payback period: ${Math.ceil(setupCost / Math.max(1, upliftRevenue - monthlyOpex))} months`,
        ],
        actions: [
          'Validate demand with pilot for 90 days',
          'Hire local sales lead first',
          'Set 12-month break-even target',
        ],
      };
    }

    case 'custom':
    default: {
      const monthlyCost = p.monthlyCost || 0;
      const upfront = p.upfrontCost || 0;
      const upliftRevenue = p.revenueUpliftPct ? ctx.monthlyRevenue * (p.revenueUpliftPct / 100) : 0;
      return {
        monthlyCashDelta: -monthlyCost,
        monthlyProfitDelta: -monthlyCost + upliftRevenue,
        monthlyGstDelta: -(monthlyCost * 0.18),
        upfrontCash: upfront,
        workingCapitalDelta: -upfront - monthlyCost,
        riskDelta: 5,
        healthDelta: upliftRevenue > monthlyCost ? 3 : -4,
        revenueUpliftMonthly: upliftRevenue,
        confidence: baseConfidence - 20,
        conditions: [
          `Monthly cost: ${inrCompact(monthlyCost)}`,
          `Upfront cost: ${inrCompact(upfront)}`,
        ],
        actions: ['Define success metrics before starting', 'Review monthly'],
      };
    }
  }
}

// ─── Determine recommendation ────────────────────────────────────────────────

function recommend(
  model: DecisionModel,
  ctx: { currentCash: number; runwayDays: number; monthlyRevenue: number },
): { recommendation: DecisionImpact['recommendation']; reason: string } {
  const monthlyNet = model.monthlyCashDelta + model.revenueUpliftMonthly;
  const newRunway = ctx.runwayDays > 0
    ? Math.floor((ctx.currentCash - model.upfrontCash + model.revenueUpliftMonthly) / Math.max(1, Math.abs(model.monthlyCashDelta) || 1) * 30)
    : 0;

  // Critical: would push cash negative or runway below 60 days
  if (ctx.currentCash - model.upfrontCash < 0) {
    return {
      recommendation: 'avoid',
      reason: `Insufficient cash for upfront cost of ${inrCompact(model.upfrontCash)}. Current cash is ${inrCompact(ctx.currentCash)}. This decision would push the business into deficit.`,
    };
  }
  if (ctx.runwayDays > 0 && newRunway < 60 && newRunway < ctx.runwayDays) {
    return {
      recommendation: 'hold',
      reason: `Runway would drop from ${ctx.runwayDays} to ~${newRunway} days. Delay until cash position strengthens or revenue uplift is confirmed.`,
    };
  }
  // Monthly net positive + revenue uplift covers cost
  if (monthlyNet >= 0 && model.revenueUpliftMonthly > Math.abs(model.monthlyCashDelta)) {
    return {
      recommendation: 'go',
      reason: `Monthly revenue uplift (${inrCompact(model.revenueUpliftMonthly)}) exceeds cost (${inrCompact(Math.abs(model.monthlyCashDelta))}). Net positive cash flow impact. Health and risk impact acceptable.`,
    };
  }
  // Break-even within 12 months
  if (model.revenueUpliftMonthly > 0 && model.upfrontCash / Math.max(1, model.revenueUpliftMonthly + model.monthlyCashDelta) < 12) {
    return {
      recommendation: 'caution',
      reason: `Break-even in ~${Math.ceil(model.upfrontCash / Math.max(1, model.revenueUpliftMonthly + model.monthlyCashDelta))} months. Proceed with close monitoring of revenue uplift and cost control.`,
    };
  }
  return {
    recommendation: 'caution',
    reason: `Net monthly impact is ${inrCompact(monthlyNet)}. Revenue uplift does not fully offset costs in the short term. Proceed only if strategic.`,
  };
}

// ─── Main: simulate a decision ───────────────────────────────────────────────

export async function simulateDecision(req: DecisionRequest): Promise<DecisionImpact> {
  const state = await computeLiveBusinessState();
  const data = await fetchRawCFOData();

  // Compute context
  const avgSalary = data.employees.filter((e) => e.status === 'active' && e.salary > 0).length > 0
    ? data.employees.filter((e) => e.status === 'active').reduce((s, e) => s + (e.salary || 0), 0) /
      Math.max(1, data.employees.filter((e) => e.status === 'active').length)
    : 40000;

  const ctx = {
    avgSalary,
    monthlyRevenue: state.revenue,
    monthlyExpenses: state.expenses,
    monthlyPayroll: state.payroll,
    currentCash: state.cash,
    runwayDays: state.forecast ? 0 : 0, // computed below
    monthlyGstLiability: state.gstPosition,
  };

  // Get runway from state (we stored it in forecast confidence but let's compute fresh)
  const runwayDays = state.cash > 0 && state.expenses > 0
    ? Math.floor((state.cash / state.expenses) * 30)
    : 0;
  ctx.runwayDays = runwayDays;

  const model = modelDecision(req, ctx);
  const verdict = recommend(model, { currentCash: state.cash, runwayDays, monthlyRevenue: state.revenue });

  const projectedCash = state.cash - model.upfrontCash + model.revenueUpliftMonthly;
  const projectedProfit = state.profit + model.monthlyProfitDelta;
  const projectedHealthScore = Math.max(0, Math.min(100, state.healthScore + model.healthDelta));
  const projectedRiskScore = Math.max(0, Math.min(100, state.riskScore + model.riskDelta));
  const projectedRunwayDays = projectedCash > 0 && state.expenses > 0
    ? Math.floor((projectedCash / (state.expenses + Math.abs(model.monthlyCashDelta))) * 30)
    : 0;

  return {
    type: req.type,
    label: req.label,
    cashImpact: model.monthlyCashDelta,
    profitImpact: model.monthlyProfitDelta,
    gstImpact: model.monthlyGstDelta,
    riskImpact: model.riskDelta,
    workingCapitalImpact: model.workingCapitalDelta,
    healthImpact: model.healthDelta,
    projectedCash: Math.round(projectedCash),
    projectedProfit: Math.round(projectedProfit),
    projectedHealthScore: Math.round(projectedHealthScore),
    projectedRiskScore: Math.round(projectedRiskScore),
    projectedRunwayDays: Math.round(projectedRunwayDays),
    recommendation: verdict.recommendation,
    confidence: model.confidence,
    reason: verdict.reason,
    conditions: model.conditions,
    actions: model.actions,
  };
}

// ─── Pre-built decision templates (for UI quick actions) ─────────────────────

export const DECISION_TEMPLATES: DecisionRequest[] = [
  { type: 'hire_employees', label: 'Hire 5 employees', params: { headcountDelta: 5, revenueUpliftPct: 8 } },
  { type: 'open_office', label: 'Open a new office', params: { monthlyCost: 80000, upfrontCost: 240000, revenueUpliftPct: 12 } },
  { type: 'increase_salaries', label: 'Increase salaries by 15%', params: { salaryIncreasePct: 15 } },
  { type: 'buy_equipment', label: 'Buy new equipment', params: { upfrontCost: 300000, revenueUpliftPct: 5 } },
  { type: 'take_loan', label: 'Take a ₹10L business loan', params: { loanAmount: 1000000, loanInterestPct: 12, loanTenureMonths: 36 } },
  { type: 'increase_marketing', label: 'Double marketing spend', params: { monthlyCost: 100000, revenueUpliftPct: 18 } },
  { type: 'expand_city', label: 'Expand to a new city', params: { city: 'Bengaluru', upfrontCost: 500000, monthlyCost: 150000, revenueUpliftPct: 20 } },
];
