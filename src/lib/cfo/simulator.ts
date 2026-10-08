// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI CFO™ — What-If Simulator (Phase 3, Module 12)
// Projects the financial impact of business changes:
//   • Revenue change (e.g. "what if revenue falls 20%?")
//   • Expense change (e.g. "what if expenses increase 15%?")
//   • Headcount change (e.g. "what if I hire 10 employees?")
//   • GST rate change (e.g. "what if GST increases 5%?")
//   • Collection improvement (e.g. "what if collections improve 10%?")
//
// Deterministic & transparent — no black-box LLM. The LLM (Oracle) uses these
// numbers when answering what-if questions conversationally.
// ═══════════════════════════════════════════════════════════════════════════════

import { generateCFOInsights } from './engine';
import type {
  WhatIfScenario,
  WhatIfResult,
  WhatIfScenarioType,
} from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function inrShort(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

const AVG_MONTHLY_SALARY = 50000; // ₹50,000 per employee per month
const MONTHS_EFFECT = 6; // project 6 months of impact for cash

// ─── Natural-language scenario parser ─────────────────────────────────────────

/**
 * Parses a natural-language what-if query into a structured scenario.
 * Returns null if the query does not match any known scenario type.
 *
 * Examples understood:
 *   "what happens if revenue falls 20%"
 *   "what if expenses increase 15%"
 *   "hire 10 employees" / "add 10 employees" / "lay off 5 employees"
 *   "what if gst increases 5%"
 *   "what if collections improve 10%"
 */
export function parseWhatIfQuery(query: string): WhatIfScenario | null {
  const q = query.toLowerCase().trim();

  // ─── Headcount change ───────────────────────────────────────────────────────
  // "hire 10 employees", "add 10 employees", "lay off 5", "fire 3 employees"
  const headcountMatch = q.match(/(?:hire|add|onboard|recruit|lay off|fire|terminate|let go)\s+(\d+)\s*(?:employees?|staff|people|workers?)/);
  if (headcountMatch) {
    const n = parseInt(headcountMatch[1], 10);
    const isLayoff = /lay off|fire|terminate|let go/.test(q);
    const delta = isLayoff ? -n : n;
    return {
      type: 'headcount_change',
      label: `${delta > 0 ? 'Hire' : 'Lay off'} ${Math.abs(delta)} ${Math.abs(delta) === 1 ? 'employee' : 'employees'}`,
      description: `${delta > 0 ? 'Adding' : 'Removing'} ${Math.abs(delta)} ${Math.abs(delta) === 1 ? 'employee' : 'employees'} at an average cost of ${inrShort(AVG_MONTHLY_SALARY)}/month each.`,
      changePct: 0,
      headcountDelta: delta,
    };
  }
  // "what if I hire 10 people"
  const hireMatch = q.match(/(?:hire|add|recruit|onboard)\s+(\d+)/);
  if (hireMatch && /employee|staff|people|worker|headcount|hire/.test(q)) {
    const n = parseInt(hireMatch[1], 10);
    return {
      type: 'headcount_change',
      label: `Hire ${n} employees`,
      description: `Adding ${n} employees at an average cost of ${inrShort(AVG_MONTHLY_SALARY)}/month each.`,
      changePct: 0,
      headcountDelta: n,
    };
  }

  // ─── Revenue change ─────────────────────────────────────────────────────────
  const revenueMatch = q.match(/(?:revenue|sales|income|turnover)\s+(?:falls?|drops?|declines?|decreases?|goes? down|reduces?|grows?|increases?|rises?|goes? up|improves?)\s*(\d+)/);
  if (revenueMatch) {
    const n = parseInt(revenueMatch[1], 10);
    const isNegative = /falls?|drops?|declines?|decreases?|goes? down|reduces?/.test(q);
    const pct = isNegative ? -n : n;
    return {
      type: 'revenue_change',
      label: `Revenue ${pct > 0 ? 'increases' : 'falls'} ${Math.abs(pct)}%`,
      description: `Simulating a ${Math.abs(pct)}% ${pct > 0 ? 'increase' : 'decrease'} in monthly revenue.`,
      changePct: pct,
    };
  }
  // "what if revenue falls 20%"
  const revenueShorthand = q.match(/(?:revenue|sales).{0,20}(\d+)\s*%/);
  if (revenueShorthand && /(fall|drop|declin|decreas|down|reduc|increas|rise|grow|up|improv)/.test(q)) {
    const n = parseInt(revenueShorthand[1], 10);
    const isNegative = /(fall|drop|declin|decreas|down|reduc)/.test(q);
    const pct = isNegative ? -n : n;
    return {
      type: 'revenue_change',
      label: `Revenue ${pct > 0 ? 'increases' : 'falls'} ${Math.abs(pct)}%`,
      description: `Simulating a ${Math.abs(pct)}% ${pct > 0 ? 'increase' : 'decrease'} in monthly revenue.`,
      changePct: pct,
    };
  }

  // ─── Expense change ─────────────────────────────────────────────────────────
  const expenseMatch = q.match(/(?:expense|cost|spend|expenditure|overhead)\s+(?:increases?|rises?|grows?|goes? up|decreases?|falls?|drops?|reduces?|goes? down)\s*(\d+)/);
  if (expenseMatch) {
    const n = parseInt(expenseMatch[1], 10);
    const isNegative = /decreases?|falls?|drops?|reduces?|goes? down/.test(q);
    const pct = isNegative ? -n : n;
    return {
      type: 'expense_change',
      label: `Expenses ${pct > 0 ? 'increase' : 'decrease'} ${Math.abs(pct)}%`,
      description: `Simulating a ${Math.abs(pct)}% ${pct > 0 ? 'increase' : 'decrease'} in monthly expenses.`,
      changePct: pct,
    };
  }

  // ─── GST change ─────────────────────────────────────────────────────────────
  const gstMatch = q.match(/(?:gst|tax\s*rate)\s+(?:increases?|rises?|goes? up|decreases?|falls?|reduces?|goes? down|changes?)\s*(\d+)/);
  if (gstMatch) {
    const n = parseInt(gstMatch[1], 10);
    const isNegative = /decreases?|falls?|reduces?|goes? down/.test(q);
    const pct = isNegative ? -n : n;
    return {
      type: 'gst_change',
      label: `GST ${pct > 0 ? 'increases' : 'decreases'} ${Math.abs(pct)}%`,
      description: `Simulating a ${Math.abs(pct)}% ${pct > 0 ? 'increase' : 'decrease'} in GST liability.`,
      changePct: pct,
    };
  }
  if (/gst\s+(?:increases?|goes? up|rises?)/.test(q)) {
    return {
      type: 'gst_change',
      label: 'GST increases 5%',
      description: 'Simulating a 5% increase in GST liability (default magnitude).',
      changePct: 5,
    };
  }

  // ─── Collection improvement ─────────────────────────────────────────────────
  const collectionMatch = q.match(/(?:collections?|receivables?|payment\s*collection)\s+(?:improves?|increases?|rises?|goes? up|worsens?|decreases?|falls?|drops?)\s*(\d+)/);
  if (collectionMatch) {
    const n = parseInt(collectionMatch[1], 10);
    const isNegative = /worsens?|decreases?|falls?|drops?/.test(q);
    const pct = isNegative ? -n : n;
    return {
      type: 'collection_improvement',
      label: `Collections ${pct > 0 ? 'improve' : 'worsen'} ${Math.abs(pct)}%`,
      description: `Simulating a ${Math.abs(pct)}% ${pct > 0 ? 'improvement' : 'decline'} in collection efficiency.`,
      changePct: pct,
    };
  }
  if (/(?:collections?|receivables?)\s+(?:improve|increase|get better|speed up)/.test(q)) {
    return {
      type: 'collection_improvement',
      label: 'Collections improve 10%',
      description: 'Simulating a 10% improvement in collection efficiency (default magnitude).',
      changePct: 10,
    };
  }

  return null;
}

// ─── Simulation engine ────────────────────────────────────────────────────────

/**
 * Runs a what-if simulation against the current CFO baseline.
 * Projects revenue, expenses, profit, cash, runway, and health score.
 */
export async function runWhatIfSimulation(
  scenario: WhatIfScenario,
): Promise<WhatIfResult> {
  const cfo = await generateCFOInsights(null);
  const d = cfo.dashboard;

  const baselineRevenue = d.revenue.thisMonth;
  const baselineExpenses = Math.max(0, d.revenue.thisMonth - d.profit.netProfit); // expenses = revenue - profit
  const baselineProfit = d.profit.netProfit;
  const baselineCash = d.cash.currentBalance;
  const baselineBurnRate = d.cash.burnRatePerDay;
  const baselineHealth = d.healthScore.overall;
  const pendingCollections = d.receivables.pendingCollections;
  const gstLiability = d.gst.liability;

  let projectedRevenue = baselineRevenue;
  let projectedExpenses = baselineExpenses;
  let projectedCash = baselineCash;
  let healthImpact = 0;
  let verdictParts: string[] = [];
  let recommendation = '';

  switch (scenario.type) {
    case 'revenue_change': {
      const mul = 1 + scenario.changePct / 100;
      projectedRevenue = Math.round(baselineRevenue * mul);
      // Profit scales with revenue (assuming variable costs scale too, but fixed costs don't)
      const variableCostRatio = baselineRevenue > 0 ? baselineExpenses * 0.6 / baselineRevenue : 0.6;
      const newVariableCosts = projectedRevenue * variableCostRatio;
      const fixedCosts = baselineExpenses * 0.4;
      projectedExpenses = Math.round(newVariableCosts + fixedCosts);
      const deltaProfit = projectedRevenue - projectedExpenses - baselineProfit;
      projectedCash = Math.round(baselineCash + deltaProfit * MONTHS_EFFECT);
      healthImpact = scenario.changePct > 0
        ? Math.min(15, scenario.changePct * 0.5)
        : Math.max(-20, scenario.changePct * 0.6);
      verdictParts.push(
        `Revenue ${scenario.changePct > 0 ? 'increasing' : 'falling'} ${Math.abs(scenario.changePct)}% would change monthly revenue to ${inrShort(projectedRevenue)}.`,
      );
      if (deltaProfit < 0) {
        verdictParts.push(`Monthly profit would ${deltaProfit < -baselineProfit * 0.5 ? 'drop significantly' : 'decrease'} by ${inrShort(Math.abs(deltaProfit))}.`);
      } else {
        verdictParts.push(`Monthly profit would increase by ${inrShort(deltaProfit)}.`);
      }
      recommendation = scenario.changePct < 0
        ? `Consider reducing variable costs by ${Math.abs(scenario.changePct)}% or accelerating collections to offset the revenue decline.`
        : 'Reinvest the additional profit into growth initiatives or maintain it as a cash buffer.';
      break;
    }

    case 'expense_change': {
      const mul = 1 + scenario.changePct / 100;
      projectedExpenses = Math.round(baselineExpenses * mul);
      const deltaProfit = baselineRevenue - projectedExpenses - baselineProfit;
      projectedCash = Math.round(baselineCash + deltaProfit * MONTHS_EFFECT);
      healthImpact = scenario.changePct > 0
        ? Math.max(-15, -scenario.changePct * 0.4)
        : Math.min(12, Math.abs(scenario.changePct) * 0.4);
      verdictParts.push(
        `Expenses ${scenario.changePct > 0 ? 'increasing' : 'decreasing'} ${Math.abs(scenario.changePct)}% would change monthly spend to ${inrShort(projectedExpenses)}.`,
      );
      verdictParts.push(`Monthly profit would ${deltaProfit >= 0 ? 'increase' : 'decrease'} by ${inrShort(Math.abs(deltaProfit))}.`);
      recommendation = scenario.changePct > 0
        ? 'Review expense categories to find efficiencies, or verify the spending drives proportional revenue growth.'
        : 'Excellent — redirect the savings to strengthen your cash reserve or invest in growth.';
      break;
    }

    case 'headcount_change': {
      const delta = scenario.headcountDelta || 0;
      const monthlyCostDelta = delta * AVG_MONTHLY_SALARY;
      const annualCostDelta = monthlyCostDelta * 12;
      projectedExpenses = Math.round(baselineExpenses + monthlyCostDelta);
      const deltaProfit = -monthlyCostDelta;
      projectedCash = Math.round(baselineCash + deltaProfit * MONTHS_EFFECT);
      healthImpact = delta > 0
        ? Math.max(-10, -delta * 0.8)
        : Math.min(8, delta * -0.5);
      verdictParts.push(
        `${delta > 0 ? 'Hiring' : 'Laying off'} ${Math.abs(delta)} ${Math.abs(delta) === 1 ? 'employee' : 'employees'} would ${delta > 0 ? 'add' : 'save'} ${inrShort(Math.abs(monthlyCostDelta))}/month (${inrShort(Math.abs(annualCostDelta))}/year).`,
      );
      verdictParts.push(`Over ${MONTHS_EFFECT} months, cash impact: ${delta > 0 ? '-' : '+'}${inrShort(Math.abs(deltaProfit * MONTHS_EFFECT))}.`);
      recommendation = delta > 0
        ? `Ensure the new hires generate at least ${inrShort(monthlyCostDelta * 1.2)} in additional monthly revenue to justify their cost (1.2x productivity threshold).`
        : 'Use the savings to strengthen runway, but verify the layoff doesn\'t disrupt critical operations.';
      break;
    }

    case 'gst_change': {
      const newGstLiability = Math.round(gstLiability * (1 + scenario.changePct / 100));
      const gstDelta = newGstLiability - gstLiability;
      // GST increase reduces cash (more liability); GST decrease frees cash
      projectedCash = Math.round(baselineCash - gstDelta * 3); // 3 months effect
      projectedExpenses = Math.round(baselineExpenses + gstDelta);
      const deltaProfit = -gstDelta;
      healthImpact = scenario.changePct > 0
        ? Math.max(-12, -scenario.changePct * 0.5)
        : Math.min(8, Math.abs(scenario.changePct) * 0.4);
      verdictParts.push(
        `GST ${scenario.changePct > 0 ? 'increasing' : 'decreasing'} ${Math.abs(scenario.changePct)}% would change your liability to ${inrShort(newGstLiability)} (${gstDelta >= 0 ? '+' : '-'}${inrShort(Math.abs(gstDelta))}).`,
      );
      verdictParts.push(`3-month cash impact: ${gstDelta > 0 ? '-' : '+'}${inrShort(Math.abs(gstDelta * 3))}.`);
      recommendation = scenario.changePct > 0
        ? 'Maximize ITC claims and review your pricing strategy to pass through the increased tax burden where possible.'
        : 'Use the reduced liability to accelerate growth investments or build a tax reserve.';
      break;
    }

    case 'collection_improvement': {
      const recovered = Math.round(pendingCollections * (scenario.changePct / 100));
      projectedCash = Math.round(baselineCash + recovered);
      const deltaProfit = recovered; // collections improve cash directly
      healthImpact = scenario.changePct > 0
        ? Math.min(14, scenario.changePct * 0.5)
        : Math.max(-10, scenario.changePct * 0.4);
      verdictParts.push(
        `Collections ${scenario.changePct > 0 ? 'improving' : 'worsening'} ${Math.abs(scenario.changePct)}% would ${scenario.changePct > 0 ? 'recover' : 'lose'} ${inrShort(Math.abs(recovered))} in ${scenario.changePct > 0 ? 'additional' : 'overdue'} cash.`,
      );
      verdictParts.push(`Cash position becomes ${inrShort(projectedCash)}.`);
      recommendation = scenario.changePct > 0
        ? 'Send payment reminders to your top 5 overdue clients, offer a 2% early-payment discount, and consider payment links via WhatsApp.'
        : 'Urgently review your credit policy — deteriorating collections threaten your cash runway.';
      break;
    }

    default:
      return emptyResult(scenario, 'Unknown scenario type.');
  }

  const projectedProfit = projectedRevenue - projectedExpenses;
  const deltaRevenue = projectedRevenue - baselineRevenue;
  const deltaProfit = projectedProfit - baselineProfit;
  const deltaCash = projectedCash - baselineCash;
  const projectedHealthScore = clamp(Math.round(baselineHealth + healthImpact), 0, 100);
  const deltaHealthScore = projectedHealthScore - baselineHealth;

  // Runway: if burn rate is 0 or unknown, assume 30 days baseline
  const effectiveBurn = baselineBurnRate > 0 ? baselineBurnRate : (baselineExpenses / 30);
  const projectedRunwayDays = effectiveBurn > 0
    ? Math.round(projectedCash / effectiveBurn)
    : 365;

  const confidencePct = cfo.hasLiveData
    ? (cfo.clientCount > 10 ? 82 : cfo.clientCount > 3 ? 68 : 55)
    : 30;

  const verdict = verdictParts.join(' ');

  return {
    scenario,
    projectedRevenue,
    projectedExpenses,
    projectedProfit,
    projectedCash,
    projectedRunwayDays,
    projectedHealthScore,
    deltaRevenue,
    deltaProfit,
    deltaCash,
    deltaHealthScore,
    verdict,
    recommendation,
    confidencePct,
  };
}

// ─── No-data fallback ──────────────────────────────────────────────────────────

function emptyResult(scenario: WhatIfScenario, note: string): WhatIfResult {
  return {
    scenario,
    projectedRevenue: 0,
    projectedExpenses: 0,
    projectedProfit: 0,
    projectedCash: 0,
    projectedRunwayDays: 0,
    projectedHealthScore: 0,
    deltaRevenue: 0,
    deltaProfit: 0,
    deltaCash: 0,
    deltaHealthScore: 0,
    verdict: note || 'Connect your business data to run accurate simulations.',
    recommendation: 'Add clients, invoices, and expenses to unlock what-if analysis.',
    confidencePct: 0,
  };
}

// ─── Preset scenarios (for the UI quick-select) ────────────────────────────────

export const WHAT_IF_PRESETS: WhatIfScenario[] = [
  {
    type: 'revenue_change',
    label: 'Revenue falls 20%',
    description: 'Stress test: what happens if revenue drops by 20%?',
    changePct: -20,
  },
  {
    type: 'revenue_change',
    label: 'Revenue grows 30%',
    description: 'Growth scenario: what if revenue increases 30%?',
    changePct: 30,
  },
  {
    type: 'expense_change',
    label: 'Expenses increase 15%',
    description: 'Cost pressure: what if expenses rise 15%?',
    changePct: 15,
  },
  {
    type: 'headcount_change',
    label: 'Hire 10 employees',
    description: 'Team expansion: what if you add 10 employees?',
    changePct: 0,
    headcountDelta: 10,
  },
  {
    type: 'gst_change',
    label: 'GST increases 5%',
    description: 'Tax impact: what if GST liability rises 5%?',
    changePct: 5,
  },
  {
    type: 'collection_improvement',
    label: 'Collections improve 10%',
    description: 'Recovery boost: what if collections improve 10%?',
    changePct: 10,
  },
];

export type { WhatIfScenario, WhatIfResult, WhatIfScenarioType } from './types';
