// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Command Simulator™
//
// Before executing any command, Oracle simulates:
//   financial impact, operational impact, compliance impact, legal impact,
//   risk impact, AI confidence, expected ROI, rollback strategy.
// Nothing executes blindly. Every simulation is grounded in the REAL live
// observation (revenue, cash, payroll, GST, compliance) via fetchCEOData.
// Persisted to CommandSimulation for auditability.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { db, cached, safeFindMany, TTL, countBy, parseJson } from './helpers';
import { fetchCEOData } from '@/lib/ceo/data';
import type {
  CommandSimulation, SimulationSummary, SimulationRecommendation,
} from './types';

// ─── Pure static definitions (re-exported from simulator-defs for client-safe imports) ─
// Client components should import SIMULATION_SCENARIOS from
// '@/lib/command-network/simulator-defs' to avoid pulling @prisma/client into the bundle.
export { SIMULATION_SCENARIOS } from './simulator-defs';

// ─── Map a CommandSimulation Prisma row → CommandSimulation ──────────────────
function mapSimulation(row: {
  id: string; scenario: string; title: string; description: string; commandType: string;
  parameters: string; baseline: string; financialImpact: number; operationalImpact: number;
  complianceImpact: string; legalImpact: string; riskScore: number; expectedROI: number;
  confidence: number; recommendation: string; rollbackStrategy: string | null;
  relatedDecisionId: string | null; approvedBy: string | null; status: string;
  createdAt: Date; updatedAt: Date;
}): CommandSimulation {
  return {
    id: row.id,
    scenario: row.scenario,
    title: row.title,
    description: row.description,
    commandType: row.commandType,
    parameters: parseJson<Record<string, unknown>>(row.parameters, {}),
    baseline: parseJson<Record<string, unknown>>(row.baseline, {}),
    financialImpact: row.financialImpact,
    operationalImpact: row.operationalImpact,
    complianceImpact: row.complianceImpact,
    legalImpact: row.legalImpact,
    riskScore: row.riskScore,
    expectedROI: row.expectedROI,
    confidence: row.confidence,
    recommendation: row.recommendation as SimulationRecommendation,
    rollbackStrategy: row.rollbackStrategy,
    relatedDecisionId: row.relatedDecisionId,
    approvedBy: row.approvedBy,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Get recent simulations (live from CommandSimulation). */
export async function getSimulations(limit = 20): Promise<CommandSimulation[]> {
  return cached<CommandSimulation[]>(`cn:simulations:${limit}`, TTL.SHORT, async () => {
    const rows = await safeFindMany(() =>
      db.commandSimulation.findMany({ orderBy: { createdAt: 'desc' }, take: limit }),
    );
    return rows.map(mapSimulation);
  });
}

/** Simulation summary — aggregated from real CommandSimulation rows. */
export async function getSimulationSummary(): Promise<SimulationSummary> {
  return cached<SimulationSummary>('cn:simulations:summary', TTL.SHORT, async () => {
    const rows = await safeFindMany(() => db.commandSimulation.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }));
    const avgConfidence = rows.length > 0
      ? Math.round((rows.reduce((s, r) => s + r.confidence, 0) / rows.length) * 100) / 100
      : 0;
    const avgROI = rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + r.expectedROI, 0) / rows.length)
      : 0;
    return {
      totalSimulations: rows.length,
      byRecommendation: countBy(rows, (r) => r.recommendation),
      byCommandType: countBy(rows, (r) => r.commandType),
      avgConfidence,
      avgROI,
      proceedCount: rows.filter((r) => r.recommendation === 'proceed').length,
      avoidCount: rows.filter((r) => r.recommendation === 'avoid').length,
    };
  });
}

/**
 * Run a simulation against the REAL live enterprise state. Computes financial,
 * operational, compliance, legal, risk impacts + ROI + confidence + recommendation.
 */
export async function runSimulation(scenarioKey: string, overrides?: Record<string, unknown>): Promise<CommandSimulation> {
  const def = SIMULATION_SCENARIOS.find((s) => s.scenario === scenarioKey);
  if (!def) throw new Error(`Unknown simulation scenario: ${scenarioKey}`);

  // Pull the REAL live observation
  const data = await fetchCEOData();
  const { liveState, cfo, twin } = data;
  const params = { ...def.parameters, ...overrides };

  const baseline = {
    revenue: liveState.revenue,
    profit: liveState.profit,
    cash: liveState.cash,
    payroll: liveState.payroll,
    employees: liveState.employees,
    gstPayable: liveState.gstPayable,
    compliance: twin.state.compliance,
    runwayDays: liveState.runwayDays,
  };

  // ── Deterministic scenario models ─────────────────────────────────────────
  let financialImpact = 0;
  let operationalImpact = 0;
  let complianceImpact: 'positive' | 'neutral' | 'negative' | 'violation' = 'neutral';
  let legalImpact: 'positive' | 'neutral' | 'negative' | 'blocking' = 'neutral';
  let riskScore = 30;
  let expectedROI = 0;
  let confidence = 0.7;
  let rollbackStrategy = 'Revert all changes within 7 days; restore prior configuration from audit trail.';
  let recommendation: SimulationRecommendation = 'needs_review';
  const notes: string[] = [];

  const headcount = (params.headcount as number) ?? 0;
  const avgCost = (params.avgCostINR as number) ?? 0;
  const priceIncreasePct = (params.priceIncreasePct as number) ?? 0;
  const costCutPct = (params.costCutPct as number) ?? 0;
  const setupCost = (params.setupCostINR as number) ?? 0;
  const devCost = (params.devCostINR as number) ?? 0;
  const marketingCost = (params.marketingINR as number) ?? 0;
  const acquisitionCost = (params.acquisitionCostINR as number) ?? 0;
  const synergyPct = (params.synergyPct as number) ?? 0;
  const amount = (params.amountINR as number) ?? 0;
  const valuation = (params.valuationINR as number) ?? 0;
  const savingsPct = (params.savingsPct as number) ?? 0;
  const extensionDays = (params.extensionDays as number) ?? 0;
  const itcRecovery = (params.itcRecoveryINR as number) ?? 0;

  switch (def.commandType) {
    case 'hire': {
      const annualCost = headcount * avgCost * 12;
      financialImpact = -annualCost;
      operationalImpact = headcount * 8; // +8% capacity per hire
      complianceImpact = 'neutral';
      legalImpact = 'neutral';
      riskScore = 35;
      expectedROI = Math.round(((liveState.revenue * 12 * 0.05 - annualCost) / annualCost) * 100);
      confidence = 0.72;
      notes.push(`Hiring ${headcount} engineers adds ₹${annualCost.toLocaleString('en-IN')} annual cost.`);
      notes.push(`Projected +${headcount * 8}% delivery capacity.`);
      recommendation = liveState.cash > annualCost / 12 * 3 ? 'proceed' : 'caution';
      break;
    }
    case 'price_change': {
      const revenueImpact = liveState.revenue * 12 * (priceIncreasePct / 100);
      const churnImpact = liveState.revenue * 12 * (priceIncreasePct / 100) * 0.15; // assume 15% churn elasticity
      financialImpact = revenueImpact - churnImpact;
      operationalImpact = 0;
      complianceImpact = 'neutral';
      legalImpact = 'neutral';
      riskScore = 45;
      expectedROI = Math.round((financialImpact / Math.max(revenueImpact, 1)) * 100);
      confidence = 0.68;
      notes.push(`10% price increase projects +₹${revenueImpact.toLocaleString('en-IN')} revenue.`);
      notes.push(`Estimated 15% churn elasticity reduces net by ₹${churnImpact.toLocaleString('en-IN')}.`);
      recommendation = priceIncreasePct <= 10 ? 'proceed' : 'caution';
      break;
    }
    case 'market_entry': {
      financialImpact = -setupCost;
      operationalImpact = 5;
      complianceImpact = 'negative';
      legalImpact = 'negative';
      riskScore = 65;
      expectedROI = Math.round(((liveState.revenue * 12 * 0.2 - setupCost) / setupCost) * 100);
      confidence = 0.55;
      notes.push(`Setting up ${params.country} entity costs ₹${setupCost.toLocaleString('en-IN')} upfront.`);
      notes.push('Requires local tax registration, banking setup and compliance calendar.');
      recommendation = liveState.cash > setupCost * 2 ? 'caution' : 'avoid';
      break;
    }
    case 'launch': {
      const totalCost = devCost + marketingCost;
      financialImpact = -totalCost;
      operationalImpact = 10;
      complianceImpact = 'neutral';
      legalImpact = 'neutral';
      riskScore = 50;
      expectedROI = Math.round(((liveState.revenue * 12 * 0.15 - totalCost) / totalCost) * 100);
      confidence = 0.6;
      notes.push(`Product launch costs ₹${totalCost.toLocaleString('en-IN')} (dev + marketing).`);
      recommendation = expectedROI > 50 ? 'proceed' : 'caution';
      break;
    }
    case 'acquire': {
      const synergyValue = liveState.revenue * 12 * (synergyPct / 100);
      financialImpact = synergyValue - acquisitionCost;
      operationalImpact = 12;
      complianceImpact = 'negative';
      legalImpact = 'blocking';
      riskScore = 75;
      expectedROI = Math.round((financialImpact / acquisitionCost) * 100);
      confidence = 0.5;
      notes.push(`Acquisition costs ₹${acquisitionCost.toLocaleString('en-IN')}; projected synergy ₹${synergyValue.toLocaleString('en-IN')}.`);
      notes.push('Requires regulatory approval (CCI) and extensive legal review.');
      recommendation = 'needs_review';
      break;
    }
    case 'cost_cut': {
      const savings = liveState.payroll * 12 * (costCutPct / 100) + (liveState.revenue - liveState.profit - liveState.payroll) * 12 * (costCutPct / 100);
      financialImpact = savings;
      operationalImpact = -costCutPct;
      complianceImpact = 'neutral';
      legalImpact = 'neutral';
      riskScore = 40;
      expectedROI = Math.round((savings / Math.max(liveState.payroll * 12, 1)) * 100);
      confidence = 0.75;
      notes.push(`Cutting ${costCutPct}% costs saves ₹${savings.toLocaleString('en-IN')}/year.`);
      notes.push(`Operational capacity may drop ${costCutPct}%.`);
      recommendation = costCutPct <= 15 ? 'proceed' : 'caution';
      break;
    }
    case 'funding': {
      financialImpact = amount;
      operationalImpact = 0;
      complianceImpact = 'positive';
      legalImpact = 'negative';
      riskScore = 55;
      expectedROI = Math.round(((amount * 3 - amount) / amount) * 100); // assume 3x return
      confidence = 0.65;
      const dilutionPct = Math.round((amount / valuation) * 100);
      notes.push(`Raising ₹${amount.toLocaleString('en-IN')} at ₹${valuation.toLocaleString('en-IN')} valuation = ${dilutionPct}% dilution.`);
      rollbackStrategy = 'No rollback — funding is irreversible once closed.';
      recommendation = 'proceed';
      break;
    }
    case 'vendor_switch': {
      const annualSpend = (liveState.revenue - liveState.profit) * 12 * 0.3;
      const savings = annualSpend * (savingsPct / 100);
      financialImpact = savings;
      operationalImpact = -5;
      complianceImpact = 'neutral';
      legalImpact = 'neutral';
      riskScore = 45;
      expectedROI = Math.round((savings / Math.max(annualSpend, 1)) * 100);
      confidence = 0.7;
      notes.push(`Switching vendor saves ₹${savings.toLocaleString('en-IN')}/year (${savingsPct}%).`);
      notes.push('Transition risk during cutover period.');
      recommendation = 'caution';
      break;
    }
    case 'payout': {
      const payables = liveState.receivables || liveState.payroll * 2;
      const cashBenefit = payables * (extensionDays / 30) * 0.0; // no interest savings in simple model, but cash flow benefit
      financialImpact = Math.round(payables * 0.02); // 2% working capital benefit
      operationalImpact = 0;
      complianceImpact = 'neutral';
      legalImpact = 'negative';
      riskScore = 50;
      expectedROI = Math.round((financialImpact / Math.max(payables, 1)) * 100);
      confidence = 0.6;
      notes.push(`Delaying payments ${extensionDays} days frees working capital.`);
      notes.push('May damage vendor relationships and trigger MSME penalties.');
      recommendation = 'caution';
      break;
    }
    case 'compliance': {
      financialImpact = itcRecovery;
      operationalImpact = 0;
      complianceImpact = 'positive';
      legalImpact = 'positive';
      riskScore = 20;
      expectedROI = Math.round((itcRecovery / Math.max(liveState.gstPayable * 12, 1)) * 100);
      confidence = 0.85;
      notes.push(`GST optimization recovers ₹${itcRecovery.toLocaleString('en-IN')} in ITC.`);
      rollbackStrategy = 'File supplementary returns if optimization reversed.';
      recommendation = 'proceed';
      break;
    }
    default:
      recommendation = 'needs_review';
  }

  const row = await db.commandSimulation.create({
    data: {
      scenario: def.scenario,
      title: def.title,
      description: def.description + (notes.length > 0 ? '\n\n' + notes.join(' ') : ''),
      commandType: def.commandType,
      parameters: JSON.stringify(params),
      baseline: JSON.stringify(baseline),
      financialImpact,
      operationalImpact,
      complianceImpact,
      legalImpact,
      riskScore,
      expectedROI,
      confidence,
      recommendation,
      rollbackStrategy,
    },
  });
  return mapSimulation(row);
}
