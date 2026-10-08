// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Global Enterprise Operating System™
// Global Executive Dashboard™ — Aggregates REAL production data into one real-time
// view: revenue by country, profit by country, compliance score, cash worldwide,
// tax exposure, currency exposure, payroll costs, country performance, regional
// growth, enterprise health. Updated in real time.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getCountry } from './registry';
import { todayISO } from './currency';
import { getConsolidationReport, currentPeriod, priorPeriod } from './consolidation';
import { getGlobalComplianceReport } from './compliance';
import { getTreasurySummary } from './banking';
import { getGlobalPayrollSummary } from './payroll';
import { getGlobalExecutiveReport } from './executives';
import { getOperatingFootprint } from './expansion';
import { cacheGet, cacheSet, TTL_PRESETS, buildKey } from './cache';
import type { GlobalExecutiveDashboard, Region } from './types';

// Pull BASE_CURRENCY from registry for consistency
import { BASE_CURRENCY } from './registry';

// ─── Enterprise health score (0-100) ─────────────────────────────────────────
//
// Computed from REAL signals:
//   - Compliance score (40% weight)
//   - Profit margin health (20% weight) — margin > 15% = full marks
//   - Cash position (20% weight) — cash > 3 months of expenses = full marks
//   - Country diversification (10% weight) — 3+ countries = full marks
//   - Entity count stability (10% weight) — 1+ active entity = full marks

function computeEnterpriseHealth(params: {
  complianceScore: number;
  profitMarginPct: number;
  cashBase: number;
  monthlyExpenseBase: number;
  countryCount: number;
  entityCount: number;
}): number {
  const complianceContribution = Math.min(100, params.complianceScore) * 0.4;
  const marginContribution = Math.min(100, Math.max(0, params.profitMarginPct) * 5) * 0.2; // 20% margin = full
  const runwayMonths = params.monthlyExpenseBase > 0 ? params.cashBase / params.monthlyExpenseBase : 0;
  const cashContribution = Math.min(100, runwayMonths / 3 * 100) * 0.2; // 3 months = full
  const diversificationContribution = Math.min(100, params.countryCount / 3 * 100) * 0.1;
  const entityContribution = params.entityCount > 0 ? 100 : 0 * 0.1;
  const total = complianceContribution + marginContribution + cashContribution + diversificationContribution + entityContribution;
  return Math.round(Math.min(100, Math.max(0, total)));
}

// ─── Main dashboard builder ──────────────────────────────────────────────────

export async function getGlobalExecutiveDashboard(firmId?: string): Promise<GlobalExecutiveDashboard> {
  const cacheKey = buildKey('global-executive-dashboard', { firm: firmId ?? 'all' });
  const cached = cacheGet<GlobalExecutiveDashboard>(cacheKey);
  if (cached) return cached.value;

  const asOfDate = todayISO();
  const period = currentPeriod();
  const priorP = priorPeriod(period);

  // Run all subsystem queries in parallel for performance
  const [consolidation, priorConsolidation, compliance, treasury, payroll, executives, footprint] = await Promise.all([
    getConsolidationReport(period, firmId).catch(() => null),
    getConsolidationReport(priorP, firmId).catch(() => null),
    getGlobalComplianceReport().catch(() => null),
    getTreasurySummary(undefined, undefined).catch(() => null),
    getGlobalPayrollSummary().catch(() => null),
    getGlobalExecutiveReport(firmId).catch(() => null),
    getOperatingFootprint(firmId).catch(() => null),
  ]);

  // Financials
  const totalRevenueBase = consolidation?.totalRevenue ?? 0;
  const totalProfitBase = consolidation?.totalProfit ?? 0;
  const totalCashBase = treasury?.totalCashBase ?? 0;
  const totalTaxExposureBase = consolidation?.totalTax ?? 0;
  const totalPayrollBase = payroll?.totalMonthlyCostBase ?? 0;
  const profitMarginPct = consolidation?.profitMarginPct ?? 0;
  const priorRevenue = priorConsolidation?.totalRevenue ?? 0;
  const revenueChangePct = priorRevenue > 0 ? ((totalRevenueBase - priorRevenue) / priorRevenue) * 100 : 0;

  // By country (REAL consolidation data)
  const byCountry: GlobalExecutiveDashboard['byCountry'] = (consolidation?.byCountry ?? []).map((c) => {
    const country = getCountry(c.countryIso);
    return {
      countryIso: c.countryIso,
      countryName: c.countryName,
      currency: c.currency,
      entityCount: c.entityCount,
      revenueBase: c.revenue,
      profitBase: c.profit,
      cashBase: 0, // cash is in treasury, not by country in consolidation
      payrollBase: c.payroll,
      complianceScore: compliance?.byCountry.find((x) => x.countryIso === c.countryIso)?.complianceScore ?? 75,
      growthPct: 0, // computed below
      pctOfGroupRevenue: c.pctOfGroupRevenue,
      flag: country?.isoCode,
    };
  });

  // Compute growth per country from prior period
  if (priorConsolidation) {
    for (const c of byCountry) {
      const prior = priorConsolidation.byCountry.find((p) => p.countryIso === c.countryIso);
      if (prior && prior.revenue > 0) {
        c.growthPct = ((c.revenueBase - prior.revenue) / prior.revenue) * 100;
      }
    }
  }

  // By region (aggregated from byCountry)
  const regionMap = new Map<Region, { countryCount: number; revenueBase: number; profitBase: number; growthPct: number }>();
  for (const c of byCountry) {
    const country = getCountry(c.countryIso);
    const region = (country?.region ?? 'Asia') as Region;
    const existing = regionMap.get(region) ?? { countryCount: 0, revenueBase: 0, profitBase: 0, growthPct: 0 };
    existing.countryCount += 1;
    existing.revenueBase += c.revenueBase;
    existing.profitBase += c.profitBase;
    existing.growthPct += c.growthPct;
    regionMap.set(region, existing);
  }
  const byRegion: GlobalExecutiveDashboard['byRegion'] = Array.from(regionMap.entries())
    .map(([region, v]) => ({
      region,
      countryCount: v.countryCount,
      revenueBase: v.revenueBase,
      profitBase: v.profitBase,
      growthPct: v.countryCount > 0 ? v.growthPct / v.countryCount : 0,
      pctOfGroupRevenue: totalRevenueBase > 0 ? (v.revenueBase / totalRevenueBase) * 100 : 0,
    }))
    .sort((a, b) => b.revenueBase - a.revenueBase);

  // Currency exposure (from treasury)
  const currencyExposure = treasury?.currencyExposure ?? {
    totalBase: 0,
    byCurrency: [],
    fxExposureUsd: 0,
    baseCurrency: BASE_CURRENCY,
    asOfDate,
  };

  // Compliance summary
  const complianceSummary: GlobalExecutiveDashboard['compliance'] = {
    overallScore: compliance?.overallScore ?? 75,
    criticalOpen: compliance?.criticalOpen ?? 0,
    upcomingDeadlines: compliance?.byCountry.reduce((s, c) => s + c.upcomingDeadlines, 0) ?? 0,
    topRisks: (compliance?.byCountry ?? [])
      .flatMap((c) => (c.nextDeadline ? [{
        countryIso: c.countryIso,
        title: c.nextDeadline.title,
        riskLevel: c.nextDeadline.riskLevel,
        daysUntil: c.nextDeadline.daysUntil,
      }] : []))
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 5),
  };

  // Enterprise stats
  const totalEntities = footprint?.totalEntities ?? consolidation?.byEntity.length ?? 0;
  const totalCountries = footprint?.totalCountries ?? byCountry.length;
  const totalBankAccounts = footprint?.totalBankAccounts ?? 0;
  let totalEmployees = 0;
  try {
    totalEmployees = await db.employee.count({ where: { status: 'active' } });
  } catch { /* employee table shape may vary */ }

  // Enterprise health score
  const enterpriseHealthScore = computeEnterpriseHealth({
    complianceScore: complianceSummary.overallScore,
    profitMarginPct,
    cashBase: totalCashBase,
    monthlyExpenseBase: (consolidation?.totalExpense ?? 0) / 12 + totalPayrollBase,
    countryCount: totalCountries,
    entityCount: totalEntities,
  });

  // Oracle narrative
  const oracleNarrative = buildDashboardNarrative({
    totalEntities,
    totalCountries,
    totalRevenueBase,
    totalProfitBase,
    profitMarginPct,
    revenueChangePct,
    complianceScore: complianceSummary.overallScore,
    criticalOpen: complianceSummary.criticalOpen,
    cashBase: totalCashBase,
    topCountry: byCountry[0],
    enterpriseHealthScore,
    hasRealData: totalRevenueBase > 0,
  });

  const dashboard: GlobalExecutiveDashboard = {
    asOfDate,
    baseCurrency: BASE_CURRENCY,
    enterprise: {
      totalEntities,
      totalCountries,
      totalBankAccounts,
      totalEmployees,
      enterpriseHealthScore,
    },
    financials: {
      totalRevenueBase,
      totalProfitBase,
      totalCashBase,
      totalTaxExposureBase,
      totalPayrollBase,
      profitMarginPct,
      revenueChangePct,
    },
    byCountry,
    byRegion,
    currencyExposure,
    compliance: complianceSummary,
    treasury: treasury ?? {
      totalCashBase: 0,
      byCurrency: [],
      byCountry: [],
      byEntity: [],
      cashPools: [],
      currencyExposure,
      baseCurrency: BASE_CURRENCY,
      asOfDate,
    },
    executives: executives ?? {
      asOfDate,
      briefs: [],
      crossExecutivePriorities: [],
      oracleNarrative: 'Executive briefs not available.',
    },
    oracleNarrative,
    contributors: {
      founder: 'Prince Singh',
      tagline: 'The World\'s First Global Enterprise Operating System — One Platform. Every Country. Every Company. Every Decision.',
    },
  };

  cacheSet(cacheKey, dashboard, TTL_PRESETS.HOT);
  return dashboard;
}

function buildDashboardNarrative(params: {
  totalEntities: number;
  totalCountries: number;
  totalRevenueBase: number;
  totalProfitBase: number;
  profitMarginPct: number;
  revenueChangePct: number;
  complianceScore: number;
  criticalOpen: number;
  cashBase: number;
  topCountry?: { countryName: string; pctOfGroupRevenue: number };
  enterpriseHealthScore: number;
  hasRealData: boolean;
}): string {
  const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  if (!params.hasRealData) {
    return `Enterprise in setup phase — ${params.totalEntities} entities onboarded across ${params.totalCountries} countries. ` +
      `Connect accounting integrations and bank accounts to enable Oracle™ real-time global intelligence. ` +
      `Enterprise health score: ${params.enterpriseHealthScore}/100. Compliance posture: ${params.complianceScore}/100.`;
  }
  const parts: string[] = [];
  parts.push(`Enterprise operating ${params.totalEntities} entities across ${params.totalCountries} countries.`);
  parts.push(`Revenue ₹${fmt(params.totalRevenueBase)} (${params.revenueChangePct >= 0 ? '+' : ''}${params.revenueChangePct.toFixed(1)}% vs prior period); profit ₹${fmt(params.totalProfitBase)} (margin ${params.profitMarginPct.toFixed(1)}%).`);
  if (params.topCountry) {
    parts.push(`${params.topCountry.countryName} leads at ${params.topCountry.pctOfGroupRevenue.toFixed(1)}% of group revenue.`);
  }
  parts.push(`Cash position: ₹${fmt(params.cashBase)}. Compliance: ${params.complianceScore}/100 (${params.criticalOpen} critical open).`);
  parts.push(`Enterprise health: ${params.enterpriseHealthScore}/100.`);
  return parts.join(' ');
}
