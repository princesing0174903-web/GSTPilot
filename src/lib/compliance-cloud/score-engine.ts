// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — GLOBAL COMPLIANCE CLOUD™ — Subsystem 7: SCORE ENGINE™
// Global Compliance Score™ — weighted avg of tax/payroll/corporate/banking/legal
// dimensions. Starts at 100; subtracts per open risk (critical -25, high -12,
// medium -5, low -2) and per upcoming critical deadline (-10). Persisted to
// db.complianceScore. Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  ComplianceScoreRecord,
  ScoreScopeType,
  RiskSeverity,
  RiskType,
  RegulationType,
} from './types';
import { getGlobalDeadlines } from './deadline-engine';
import { getRegulations } from './regulation-graph';

// ─── Severity weights ───────────────────────────────────────────────────────

const SEVERITY_WEIGHT: Record<RiskSeverity, number> = {
  critical: 25,
  high: 12,
  medium: 5,
  low: 2,
};

// Map risk type → compliance dimension.
const RISK_TYPE_TO_DIMENSION: Record<RiskType, 'tax' | 'payroll' | 'corporate' | 'banking' | 'legal'> = {
  late_filing: 'tax',
  missing_invoice: 'tax',
  gst_mismatch: 'tax',
  cash_anomaly: 'banking',
  payroll_inconsistency: 'payroll',
  banking_violation: 'banking',
  audit_risk: 'legal',
  director_compliance: 'corporate',
  vendor_compliance: 'legal',
  tds_shortfall: 'tax',
  epfo_gap: 'payroll',
  esi_gap: 'payroll',
  mca_default: 'corporate',
  rbi_breach: 'banking',
};

// Map regulation type → dimension (for upcoming-deadline impact).
const REG_TYPE_TO_DIMENSION: Record<string, 'tax' | 'payroll' | 'corporate' | 'banking' | 'legal'> = {
  gst: 'tax',
  income_tax: 'tax',
  tds: 'tax',
  payroll: 'payroll',
  epfo: 'payroll',
  esic: 'payroll',
  mca: 'corporate',
  rbi: 'banking',
  companies_act: 'corporate',
  labour_law: 'payroll',
  corporate_filing: 'corporate',
  banking: 'banking',
  privacy: 'legal',
  // Legacy registry strings
  gst_return: 'tax',
  vat_return: 'tax',
  tax_filing: 'tax',
  audit: 'legal',
  corporate: 'corporate',
  financial_reporting: 'corporate',
};

interface DimensionScore {
  tax: number;
  payroll: number;
  corporate: number;
  banking: number;
  legal: number;
}

function emptyDims(): DimensionScore {
  return { tax: 100, payroll: 100, corporate: 100, banking: 100, legal: 100 };
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

function mapRow(r: {
  id: string;
  scopeType: string;
  scopeId: string;
  scopeName: string;
  countryIso: string | null;
  taxScore: number;
  payrollScore: number;
  corporateScore: number;
  bankingScore: number;
  legalScore: number;
  overallScore: number;
  openRisks: number;
  criticalRisks: number;
  upcomingDeadlines: number;
  trendDelta: number;
  computedAt: Date;
  createdAt: Date;
}): ComplianceScoreRecord {
  return {
    id: r.id,
    scopeType: r.scopeType as ScoreScopeType,
    scopeId: r.scopeId,
    scopeName: r.scopeName,
    countryIso: r.countryIso ?? undefined,
    taxScore: r.taxScore,
    payrollScore: r.payrollScore,
    corporateScore: r.corporateScore,
    bankingScore: r.bankingScore,
    legalScore: r.legalScore,
    overallScore: r.overallScore,
    openRisks: r.openRisks,
    criticalRisks: r.criticalRisks,
    upcomingDeadlines: r.upcomingDeadlines,
    trendDelta: r.trendDelta,
    computedAt: r.computedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

interface ComputeInput {
  scopeType: ScoreScopeType;
  scopeId: string;
  scopeName: string;
  countryIso?: string;
}

export async function computeScore(
  scopeType: ScoreScopeType,
  scopeId: string,
): Promise<ComplianceScoreRecord> {
  // Determine scope name and country.
  let scopeName = scopeId;
  let countryIso: string | undefined;

  if (scopeType === 'country') {
    countryIso = scopeId.toUpperCase();
    scopeName = await getCountryName(countryIso);
  } else if (scopeType === 'organization') {
    try {
      const firm = await db.firm.findUnique({ where: { id: scopeId } });
      if (firm) scopeName = firm.name;
    } catch {
      // skip
    }
  } else if (scopeType === 'entity') {
    try {
      const client = await db.client.findUnique({ where: { id: scopeId } });
      if (client) {
        scopeName = client.tradeName;
      }
    } catch {
      // skip
    }
  }

  // Fetch open risks for this scope.
  const where: Record<string, unknown> = {
    status: { notIn: ['resolved', 'accepted'] },
  };
  if (scopeType === 'country') {
    where.countryIso = scopeId.toUpperCase();
  } else if (scopeType === 'organization') {
    where.organizationId = scopeId;
  } else if (scopeType === 'entity') {
    where.entityId = scopeId;
  }
  // vendor/employee scopes don't currently have explicit filters — fallback to all.

  let openRisks = 0;
  let criticalRisks = 0;
  const dims = emptyDims();
  try {
    const risks = await db.complianceRisk.findMany({ where });
    openRisks = risks.length;
    for (const r of risks) {
      const severity = r.severity as RiskSeverity;
      const weight = SEVERITY_WEIGHT[severity] ?? 2;
      const dim = RISK_TYPE_TO_DIMENSION[r.riskType as RiskType] ?? 'legal';
      dims[dim] = clamp(dims[dim] - weight);
      if (severity === 'critical') criticalRisks += 1;
    }
  } catch {
    // skip
  }

  // Upcoming deadlines (next 30 days) — count critical-risk ones for delta.
  let upcomingCritical = 0;
  let upcomingTotal = 0;
  try {
    const deadlines = await getGlobalDeadlines(30);
    upcomingTotal = deadlines.length;
    for (const d of deadlines) {
      const regTypeStr = String(d.regulationType) as RegulationType | string;
      const dim = REG_TYPE_TO_DIMENSION[regTypeStr] ?? 'legal';
      if (d.riskLevel === 'critical') {
        upcomingCritical += 1;
        dims[dim] = clamp(dims[dim] - 10);
      } else if (d.riskLevel === 'high') {
        dims[dim] = clamp(dims[dim] - 5);
      } else if (d.riskLevel === 'medium') {
        dims[dim] = clamp(dims[dim] - 2);
      }
    }
  } catch {
    // skip
  }

  // Overall: weighted avg of dimensions (tax 30%, corporate 25%, payroll 20%, banking 15%, legal 10%).
  const overallScore = clamp(Math.round(
    dims.tax * 0.30
    + dims.corporate * 0.25
    + dims.payroll * 0.20
    + dims.banking * 0.15
    + dims.legal * 0.10,
  ));

  // Trend delta: compare to previous score record for same scope.
  let trendDelta = 0;
  try {
    const previous = await db.complianceScore.findFirst({
      where: { scopeType, scopeId },
      orderBy: { computedAt: 'desc' },
    });
    if (previous) {
      trendDelta = overallScore - previous.overallScore;
    }
  } catch {
    // skip
  }

  // Persist new score record.
  let row;
  try {
    row = await db.complianceScore.create({
      data: {
        scopeType,
        scopeId,
        scopeName,
        countryIso: countryIso ?? null,
        taxScore: dims.tax,
        payrollScore: dims.payroll,
        corporateScore: dims.corporate,
        bankingScore: dims.banking,
        legalScore: dims.legal,
        overallScore,
        openRisks,
        criticalRisks,
        upcomingDeadlines: upcomingTotal,
        trendDelta,
      },
    });
  } catch {
    // Return un-persisted record if DB write fails.
    const now = new Date().toISOString();
    return {
      id: `eph-${scopeType}-${scopeId}`,
      scopeType,
      scopeId,
      scopeName,
      countryIso,
      taxScore: dims.tax,
      payrollScore: dims.payroll,
      corporateScore: dims.corporate,
      bankingScore: dims.banking,
      legalScore: dims.legal,
      overallScore,
      openRisks,
      criticalRisks,
      upcomingDeadlines: upcomingTotal,
      trendDelta,
      computedAt: now,
      createdAt: now,
    };
  }

  return mapRow(row);
}

export async function getScores(scopeType?: ScoreScopeType): Promise<ComplianceScoreRecord[]> {
  try {
    const rows = await db.complianceScore.findMany({
      where: scopeType ? { scopeType } : undefined,
      orderBy: { computedAt: 'desc' },
      take: 500,
    });
    // Dedupe by scopeId (keep most recent per scope).
    const byScope = new Map<string, ComplianceScoreRecord>();
    for (const r of rows) {
      const rec = mapRow(r);
      const key = `${rec.scopeType}:${rec.scopeId}`;
      if (!byScope.has(key)) byScope.set(key, rec);
    }
    return Array.from(byScope.values());
  } catch {
    return [];
  }
}

export async function getOverallScore(): Promise<number> {
  // Weighted avg across all country scores — fall back to per-country compute.
  try {
    const regulations = await getRegulations();
    const countryIsos = Array.from(new Set(regulations.map((r) => r.countryIso)));
    if (countryIsos.length === 0) return 100;

    const scores: number[] = [];
    for (const iso of countryIsos) {
      const score = await computeScore('country', iso);
      scores.push(score.overallScore);
    }
    if (scores.length === 0) return 100;
    return Math.round(scores.reduce((s, n) => s + n, 0) / scores.length);
  } catch {
    return 100;
  }
}

export async function getScoreBreakdown(): Promise<{
  tax: number;
  payroll: number;
  corporate: number;
  banking: number;
  legal: number;
  overall: number;
}> {
  try {
    const regulations = await getRegulations();
    const countryIsos = Array.from(new Set(regulations.map((r) => r.countryIso)));
    if (countryIsos.length === 0) {
      return { tax: 100, payroll: 100, corporate: 100, banking: 100, legal: 100, overall: 100 };
    }
    const sums = { tax: 0, payroll: 0, corporate: 0, banking: 0, legal: 0, overall: 0 };
    for (const iso of countryIsos) {
      const s = await computeScore('country', iso);
      sums.tax += s.taxScore;
      sums.payroll += s.payrollScore;
      sums.corporate += s.corporateScore;
      sums.banking += s.bankingScore;
      sums.legal += s.legalScore;
      sums.overall += s.overallScore;
    }
    const n = countryIsos.length;
    return {
      tax: Math.round(sums.tax / n),
      payroll: Math.round(sums.payroll / n),
      corporate: Math.round(sums.corporate / n),
      banking: Math.round(sums.banking / n),
      legal: Math.round(sums.legal / n),
      overall: Math.round(sums.overall / n),
    };
  } catch {
    return { tax: 100, payroll: 100, corporate: 100, banking: 100, legal: 100, overall: 100 };
  }
}

async function getCountryName(countryIso: string): Promise<string> {
  try {
    const { getCountry } = await import('@/lib/global-enterprise/registry');
    return getCountry(countryIso.toUpperCase())?.name ?? countryIso.toUpperCase();
  } catch {
    return countryIso.toUpperCase();
  }
}
