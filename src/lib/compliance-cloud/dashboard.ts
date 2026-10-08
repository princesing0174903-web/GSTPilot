// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — GLOBAL COMPLIANCE CLOUD™ — Subsystem 11: DASHBOARD™
// Unified Compliance Dashboard aggregator — overall score, totals, by-regulation,
// by-country, recentFilings, topRisks, upcomingDeadlineFeed, recentAuditEntries,
// recentRegulationUpdates, scoreBreakdown, oracleNarrative. Cached 60s.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  ComplianceDashboard,
  ComplianceFiling,
  ComplianceRisk,
  ComplianceAuditEntry,
  RegulationUpdateRecord,
  FilingType,
  RegulationType,
  PreparedBy,
} from './types';
import { getRegulations } from './regulation-graph';
import { detectRisks, getTopRisks } from './risk-engine';
import { getGlobalDeadlines, getCountryName } from './deadline-engine';
import { getAuditEntries } from './audit-cloud';
import { getRegulationUpdates } from './update-engine';
import { computeScore, getOverallScore, getScoreBreakdown } from './score-engine';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeParse<T>(s: string | null | undefined, fallback: T): T {
  try {
    if (!s) return fallback;
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function mapFilingRow(r: {
  id: string;
  filingType: string;
  title: string;
  description: string | null;
  organizationId: string | null;
  entityId: string | null;
  countryIso: string;
  period: string;
  dueDate: Date | null;
  preparedAt: Date;
  preparedBy: string;
  status: string;
  payload: string;
  summary: string;
  riskAssessment: string;
  aiRecommendation: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  submittedAt: Date | null;
  acknowledgedAt: Date | null;
  ackReference: string | null;
  errorMessage: string | null;
  auditId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ComplianceFiling {
  return {
    id: r.id,
    filingType: r.filingType as FilingType,
    title: r.title,
    description: r.description ?? undefined,
    organizationId: r.organizationId ?? undefined,
    entityId: r.entityId ?? undefined,
    countryIso: r.countryIso,
    period: r.period,
    dueDate: r.dueDate?.toISOString(),
    preparedAt: r.preparedAt.toISOString(),
    preparedBy: r.preparedBy as PreparedBy,
    status: r.status as ComplianceFiling['status'],
    payload: safeParse(r.payload, {}),
    summary: safeParse(r.summary, {}),
    riskAssessment: safeParse(r.riskAssessment, {}),
    aiRecommendation: r.aiRecommendation ?? undefined,
    approvedBy: r.approvedBy ?? undefined,
    approvedAt: r.approvedAt?.toISOString(),
    submittedAt: r.submittedAt?.toISOString(),
    acknowledgedAt: r.acknowledgedAt?.toISOString(),
    ackReference: r.ackReference ?? undefined,
    errorMessage: r.errorMessage ?? undefined,
    auditId: r.auditId ?? undefined,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

// ─── 60-second in-memory cache ──────────────────────────────────────────────

let dashboardCache: { data: ComplianceDashboard; expiresAt: number } | null = null;
const DASHBOARD_TTL_MS = 60 * 1000;

// ─── Dashboard assembler ────────────────────────────────────────────────────

export async function getComplianceDashboard(): Promise<ComplianceDashboard> {
  if (dashboardCache && Date.now() < dashboardCache.expiresAt) {
    return dashboardCache.data;
  }

  // Parallel data gathering for performance.
  const [
    regulations,
    topRisks,
    upcomingDeadlines,
    auditEntries,
    regulationUpdates,
    scoreBreakdown,
    overallScore,
  ] = await Promise.all([
    getRegulations(),
    getTopRisks(10),
    getGlobalDeadlines(30),
    getAuditEntries({ limit: 15 }),
    getRegulationUpdates({ limit: 10 }),
    getScoreBreakdown(),
    getOverallScore(),
  ]);

  // Filing counts.
  let totalFilings = 0;
  let submittedFilings = 0;
  let acknowledgedFilings = 0;
  let pendingApprovals = 0;
  let recentFilings: ComplianceFiling[] = [];

  try {
    totalFilings = await db.complianceFiling.count();
    submittedFilings = await db.complianceFiling.count({ where: { status: 'submitted' } });
    acknowledgedFilings = await db.complianceFiling.count({ where: { status: 'acknowledged' } });
    pendingApprovals = await db.complianceFiling.count({
      where: { status: { in: ['prepared', 'analyzed'] } },
    });
    const filingRows = await db.complianceFiling.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    recentFilings = filingRows.map(mapFilingRow);
  } catch {
    // skip — values stay at 0
  }

  // Risk counts.
  let openRisks = 0;
  let criticalRisks = 0;
  const allRisks = await detectRisks();
  openRisks = allRisks.filter((r) => r.status === 'open' || r.status === 'acknowledged' || r.status === 'mitigating').length;
  criticalRisks = allRisks.filter((r) => r.severity === 'critical' && r.status !== 'resolved' && r.status !== 'accepted').length;

  // byRegulationType aggregation.
  const regTypeMap = new Map<RegulationType, { count: number; riskCount: number }>();
  for (const reg of regulations) {
    const entry = regTypeMap.get(reg.regulationType) ?? { count: 0, riskCount: 0 };
    entry.count += 1;
    regTypeMap.set(reg.regulationType, entry);
  }
  for (const r of allRisks) {
    // Map risk type back to a regulation type via the seeded regulation list — approximate.
    const regTypeForRisk = mapRiskTypeToRegType(r.riskType);
    if (regTypeForRisk) {
      const entry = regTypeMap.get(regTypeForRisk) ?? { count: 0, riskCount: 0 };
      entry.riskCount += 1;
      regTypeMap.set(regTypeForRisk, entry);
    }
  }
  const byRegulationType = Array.from(regTypeMap.entries())
    .map(([type, v]) => ({ type, count: v.count, riskCount: v.riskCount }))
    .sort((a, b) => b.count - a.count);

  // byCountry aggregation — top 10 countries by score.
  const countryIsos = Array.from(new Set(regulations.map((r) => r.countryIso)));
  const byCountry: ComplianceDashboard['byCountry'] = [];
  for (const iso of countryIsos.slice(0, 20)) {
    const score = await computeScore('country', iso);
    byCountry.push({
      countryIso: iso,
      countryName: getCountryName(iso),
      score: score.overallScore,
      openRisks: score.openRisks,
      upcomingDeadlines: score.upcomingDeadlines,
    });
  }
  byCountry.sort((a, b) => a.score - b.score); // worst-score first
  const top10ByCountry = byCountry.slice(0, 10);

  // Upcoming deadline feed (top 15).
  const upcomingDeadlineFeed: ComplianceDashboard['upcomingDeadlineFeed'] = upcomingDeadlines
    .slice(0, 15)
    .map((d) => ({
      countryIso: d.countryIso,
      countryName: getCountryName(d.countryIso),
      title: d.title,
      regulationType: String(d.regulationType),
      riskLevel: d.riskLevel,
      dueDate: d.nextDueDate ?? null,
      daysUntil: d.daysUntil ?? null,
      authority: d.authority,
    }));

  // Oracle narrative.
  const oracleNarrative = buildOracleNarrative({
    overallScore,
    openRisks,
    criticalRisks,
    upcomingDeadlines: upcomingDeadlineFeed.length,
    totalFilings,
    pendingApprovals,
    submittedFilings,
    regulationCount: regulations.length,
    regulationUpdateCount: regulationUpdates.length,
  });

  const dashboard: ComplianceDashboard = {
    overallScore,
    totalRegulations: regulations.length,
    totalFilings,
    openRisks,
    criticalRisks,
    upcomingDeadlines: upcomingDeadlineFeed.length,
    pendingApprovals,
    submittedFilings,
    acknowledgedFilings,
    regulationUpdates: regulationUpdates.length,
    byRegulationType,
    byCountry: top10ByCountry,
    recentFilings,
    topRisks,
    upcomingDeadlineFeed,
    recentAuditEntries: auditEntries as ComplianceAuditEntry[],
    recentRegulationUpdates: regulationUpdates as RegulationUpdateRecord[],
    scoreBreakdown: {
      tax: scoreBreakdown.tax,
      payroll: scoreBreakdown.payroll,
      corporate: scoreBreakdown.corporate,
      banking: scoreBreakdown.banking,
      legal: scoreBreakdown.legal,
    },
    oracleNarrative,
    generatedAt: new Date().toISOString(),
  };

  dashboardCache = { data: dashboard, expiresAt: Date.now() + DASHBOARD_TTL_MS };
  return dashboard;
}

function mapRiskTypeToRegType(riskType: string): RegulationType | null {
  const m: Record<string, RegulationType> = {
    late_filing: 'gst',
    missing_invoice: 'gst',
    gst_mismatch: 'gst',
    cash_anomaly: 'banking',
    payroll_inconsistency: 'payroll',
    banking_violation: 'banking',
    audit_risk: 'companies_act',
    director_compliance: 'companies_act',
    vendor_compliance: 'companies_act',
    tds_shortfall: 'tds',
    epfo_gap: 'epfo',
    esi_gap: 'esic',
    mca_default: 'mca',
    rbi_breach: 'rbi',
  };
  return m[riskType] ?? null;
}

interface NarrativeCtx {
  overallScore: number;
  openRisks: number;
  criticalRisks: number;
  upcomingDeadlines: number;
  totalFilings: number;
  pendingApprovals: number;
  submittedFilings: number;
  regulationCount: number;
  regulationUpdateCount: number;
}

function buildOracleNarrative(ctx: NarrativeCtx): string {
  const parts: string[] = [];
  parts.push(
    `Global Compliance Cloud™ operational — overall score ${ctx.overallScore}/100 across ${ctx.regulationCount} regulations.`,
  );
  if (ctx.criticalRisks > 0) {
    parts.push(
      `${ctx.criticalRisks} critical risk${ctx.criticalRisks === 1 ? '' : 's'} demand immediate attention; ${ctx.openRisks} total open risk${ctx.openRisks === 1 ? '' : 's'}.`,
    );
  } else {
    parts.push(`No critical risks detected; ${ctx.openRisks} open risk${ctx.openRisks === 1 ? '' : 's'} monitored.`);
  }
  if (ctx.upcomingDeadlines > 0) {
    parts.push(
      `${ctx.upcomingDeadlines} upcoming deadline${ctx.upcomingDeadlines === 1 ? '' : 's'} in the next 30 days.`,
    );
  }
  if (ctx.pendingApprovals > 0) {
    parts.push(
      `${ctx.pendingApprovals} filing${ctx.pendingApprovals === 1 ? '' : 's'} awaiting approval.`,
    );
  }
  if (ctx.regulationUpdateCount > 0) {
    parts.push(
      `${ctx.regulationUpdateCount} recent regulation update${ctx.regulationUpdateCount === 1 ? '' : 's'} detected — review with Legal Counsel.`,
    );
  }
  if (ctx.overallScore >= 85) {
    parts.push('Posture: healthy. Oracle recommends maintaining current cadence.');
  } else if (ctx.overallScore >= 65) {
    parts.push('Posture: acceptable. Oracle recommends resolving open risks within 7 days.');
  } else {
    parts.push('Posture: at-risk. Oracle recommends executive review within 48 hours.');
  }
  return parts.join(' ');
}

// Allow callers to invalidate the cache (e.g., after a mutation).
export function invalidateComplianceDashboardCache(): void {
  dashboardCache = null;
}
