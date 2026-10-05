// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — GLOBAL COMPLIANCE CLOUD™ — Subsystem 4: DIGITAL TWIN™
// Predict impact before execution: GST/tax/penalty/interest/cash-flow/audit
// probability/compliance-score delta/regulatory risk. Persists snapshot to
// db.complianceTwinSnapshot. Oracle narrative picks the safest path.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  ComplianceTwinResult,
  RegulatoryRisk,
  FilingType,
  FilingSummary,
} from './types';
import { getRegulationById, getRegulations } from './regulation-graph';
import { getRisksForFiling } from './risk-engine-helpers';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseISO(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function daysLate(dueDate: string | null | undefined, reference?: Date): number {
  const due = parseISO(dueDate);
  if (!due) return 0;
  const ref = reference ?? new Date();
  return Math.max(0, Math.ceil((ref.getTime() - due.getTime()) / MS_PER_DAY));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function classifyRisk(prob: number): RegulatoryRisk {
  if (prob >= 0.75) return 'critical';
  if (prob >= 0.5) return 'high';
  if (prob >= 0.25) return 'medium';
  return 'low';
}

// ─── Real-data gatherers ────────────────────────────────────────────────────

interface FilingContext {
  filingType: FilingType;
  countryIso: string;
  period: string;
  dueDate: string | null;
  summary: FilingSummary;
  entityId?: string;
}

async function gatherFilingContext(
  filingId: string,
): Promise<FilingContext | null> {
  try {
    const filing = await db.complianceFiling.findUnique({ where: { id: filingId } });
    if (!filing) return null;
    return {
      filingType: filing.filingType as FilingType,
      countryIso: filing.countryIso,
      period: filing.period,
      dueDate: filing.dueDate?.toISOString() ?? null,
      entityId: filing.entityId ?? undefined,
      summary: safeParseSummary(filing.summary),
    };
  } catch {
    return null;
  }
}

function safeParseSummary(s: string): FilingSummary {
  try {
    return JSON.parse(s) as FilingSummary;
  } catch {
    return {};
  }
}

// Look up applicable regulation to get interestRatePct.
async function findInterestRate(
  filingType: FilingType,
  countryIso: string,
): Promise<number> {
  try {
    const regulations = await getRegulations({ countryIso });
    // Match by type — gstr1/gstr3b/gstr9/gstr2b_reconcile → gst; itr → income_tax; etc.
    const typeMap: Record<string, string> = {
      gstr1: 'gst', gstr3b: 'gst', gstr9: 'gst', gstr2b_reconcile: 'gst',
      itr: 'income_tax',
      tds_24q: 'tds', tds_26q: 'tds', tds_27q: 'tds',
      epf_ecn: 'epfo', esi_return: 'esic', pt_return: 'payroll',
      mca_aoc4: 'mca', mca_mgt7: 'mca', mca_dir3: 'mca',
      rbi_furnish: 'rbi',
      payroll_return: 'payroll',
      corp_filing: 'corporate_filing',
      audit_report: 'companies_act',
    };
    const desiredType = typeMap[filingType];
    const matched = regulations.find((r) => r.regulationType === desiredType);
    if (matched) return matched.interestRatePct;
  } catch {
    // fall through to default
  }
  return filingType.startsWith('gstr') ? 18 : 12; // CGST 18%, IT 12% defaults
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface SimulationParams {
  filingType: FilingType;
  countryIso: string;
  period: string;
  dueDate?: string;
  summary?: FilingSummary;
  scenario?: string;
  daysLateOverride?: number;
}

export async function simulateFiling(filingId: string): Promise<ComplianceTwinResult> {
  const ctx = await gatherFilingContext(filingId);
  if (!ctx) {
    throw new Error(`Filing not found: ${filingId}`);
  }
  return simulateScenario(
    ctx.filingType === 'gstr3b' ? 'file_gstr3b' : `file_${ctx.filingType}`,
    {
      filingType: ctx.filingType,
      countryIso: ctx.countryIso,
      period: ctx.period,
      dueDate: ctx.dueDate ?? undefined,
      summary: ctx.summary,
    },
    filingId,
  );
}

export async function simulateScenario(
  scenario: string,
  params: SimulationParams,
  filingId?: string,
): Promise<ComplianceTwinResult> {
  const interestRatePct = await findInterestRate(params.filingType, params.countryIso);
  const totalLiability = typeof params.summary?.totalLiability === 'number'
    ? params.summary.totalLiability
    : 0;
  const taxPayable = typeof params.summary?.taxPayable === 'number'
    ? params.summary.taxPayable
    : totalLiability;

  const lateDays = params.daysLateOverride
    ?? daysLate(params.dueDate);

  // Penalty estimate: ₹50/day per late filing for GST, ₹200/day cap ₹5,000 for GSTR-3B.
  // For non-GST filings, use 0.5% of turnover-style penalty (capped at liability).
  const isGst = params.filingType.startsWith('gstr');
  const penaltyEstimate = isGst
    ? Math.min(5000, lateDays * 50)
    : Math.min(totalLiability * 0.005 + lateDays * 100, Math.max(totalLiability * 0.1, 10000));

  // Interest estimate: (interestRatePct% × liability × lateDays / 365)
  const interestEstimate = (totalLiability * interestRatePct * lateDays) / (365 * 100);

  // GST impact: late filing exposes the entity to ITC reversal (GSTR-2B block) —
  // assume 5% of total ITC claimed becomes at-risk if filing is >7 days late.
  const itcClaimed = typeof params.summary?.itcClaimed === 'number'
    ? params.summary.itcClaimed
    : 0;
  const gstImpact = isGst && lateDays > 7 ? itcClaimed * 0.05 : 0;

  // Tax impact: liability that crystallises as tax-payable-now if filing late.
  const taxImpact = taxPayable + interestEstimate + penaltyEstimate;

  // Cash-flow effect: liquidity strain = tax payable + penalty + interest - refund available.
  const totalRefund = typeof params.summary?.totalRefund === 'number'
    ? params.summary.totalRefund
    : 0;
  const cashFlowEffect = taxImpact - totalRefund;

  // Audit probability: based on risk count for this filing + amount variance.
  const riskCount = filingId ? await getRisksForFiling(filingId) : 0;
  const amountVariance = totalLiability > 1_000_000 ? 0.2 : totalLiability > 100_000 ? 0.1 : 0.05;
  const auditProbability = clamp(
    0.1 + riskCount * 0.08 + amountVariance + (lateDays > 30 ? 0.15 : 0),
    0,
    0.95,
  );

  // Compliance score delta: -2 per late day (max -25) + -1 per risk.
  const complianceScoreDelta = clamp(
    -(Math.min(25, lateDays * 2) + riskCount * 1),
    -50,
    0,
  );

  const regulatoryRisk = classifyRisk(auditProbability);

  // Recommendation — Oracle picks the safest path narrative.
  const recommendation = buildRecommendation({
    scenario,
    filingType: params.filingType,
    lateDays,
    totalLiability,
    penaltyEstimate,
    interestEstimate,
    auditProbability,
    regulatoryRisk,
  });

  // Persist snapshot.
  let snapshotId = '';
  try {
    const snap = await db.complianceTwinSnapshot.create({
      data: {
        filingId: filingId ?? null,
        scenario,
        gstImpact,
        taxImpact,
        penaltyEstimate,
        interestEstimate,
        cashFlowEffect,
        auditProbability,
        complianceScoreDelta,
        regulatoryRisk,
        recommendation,
      },
    });
    snapshotId = snap.id;
  } catch {
    // non-fatal — return result anyway
  }

  const now = new Date().toISOString();
  return {
    id: snapshotId,
    filingId,
    scenario,
    gstImpact: Math.round(gstImpact * 100) / 100,
    taxImpact: Math.round(taxImpact * 100) / 100,
    penaltyEstimate: Math.round(penaltyEstimate * 100) / 100,
    interestEstimate: Math.round(interestEstimate * 100) / 100,
    cashFlowEffect: Math.round(cashFlowEffect * 100) / 100,
    auditProbability: Math.round(auditProbability * 1000) / 1000,
    complianceScoreDelta,
    regulatoryRisk,
    recommendation,
    simulatedAt: now,
    createdAt: now,
  };
}

interface RecommendationCtx {
  scenario: string;
  filingType: FilingType;
  lateDays: number;
  totalLiability: number;
  penaltyEstimate: number;
  interestEstimate: number;
  auditProbability: number;
  regulatoryRisk: RegulatoryRisk;
}

function buildRecommendation(ctx: RecommendationCtx): string {
  const parts: string[] = [];
  parts.push(
    `Oracle simulation of "${ctx.scenario}" for ${ctx.filingType}:`,
  );
  if (ctx.lateDays === 0) {
    parts.push(
      `Filing on time avoids all penalties. Estimated tax payable ₹${ctx.totalLiability.toFixed(2)}. Audit probability ${(ctx.auditProbability * 100).toFixed(1)}%.`,
    );
    parts.push('Recommendation: Submit immediately — this is the safest path.');
  } else {
    parts.push(
      `${ctx.lateDays} days late → penalty ₹${ctx.penaltyEstimate.toFixed(2)} + interest ₹${ctx.interestEstimate.toFixed(2)}.`,
    );
    parts.push(
      `Audit probability ${(ctx.auditProbability * 100).toFixed(1)}% (${ctx.regulatoryRisk} risk).`,
    );
    if (ctx.regulatoryRisk === 'critical' || ctx.auditProbability >= 0.7) {
      parts.push(
        'Recommendation: File immediately + pay full liability + engage auditor for damage control. Do NOT defer further.',
      );
    } else if (ctx.regulatoryRisk === 'high') {
      parts.push(
        'Recommendation: File today; pay liability + penalty + interest in single challan; document reason for delay (sick leave, technical issue) for abatement request.',
      );
    } else {
      parts.push(
        'Recommendation: File now to halt accrual; pay statutory liability immediately; settle penalty+interest within 7 days to avoid escalation.',
      );
    }
  }
  return parts.join(' ');
}

// Re-export for engine consumption
export { getRegulationById };
