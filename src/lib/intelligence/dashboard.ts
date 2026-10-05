// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT™ GLOBAL DATA INTELLIGENCE CLOUD™ — Global Analytics Dashboard™
//
// Assembles the complete GlobalAnalyticsDashboard object from real aggregated
// data across every subsystem: IntelligenceContribution, BenchmarkSnapshot,
// MarketIndicator, GlobalKnowledgeNode, and the market outlook module.
//
// Each section is wrapped in its own try/catch — one failing section returns
// empty arrays / zeros, NEVER blocking the whole dashboard. The market outlook
// is loaded via dynamic import so this module has no hard dependency on market.ts
// at module-load time.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { INDUSTRY_LABELS } from './types';
import type {
  GlobalAnalyticsDashboard,
  IndustryId,
  MarketIndicator,
  MarketSentiment,
  MetricType,
  OpportunityIndex,
  RegionId,
  RiskHeatmapCell,
  TrendPoint,
  TrendSeries,
} from './types';

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, v) => s + (Number(v) || 0), 0) / nums.length;
}

function clamp(n: number, lo = 0, hi = 100): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

// Build a single TrendSeries from IntelligenceContribution rows for a given metric.
// Groups by period, takes last 6 periods, computes direction + changePercent.
async function buildTrendSeries(
  metricType: string,
  label: string,
  unit: string,
): Promise<TrendSeries[]> {
  const rows: any[] = await (db as any).intelligenceContribution.findMany({
    where: { metricType },
  });
  if (rows.length === 0) return [];
  const byPeriod = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.period) continue;
    if (!byPeriod.has(r.period)) byPeriod.set(r.period, []);
    byPeriod.get(r.period)!.push(Number(r.metricValue) || 0);
  }
  if (byPeriod.size < 2) return [];
  const sorted = Array.from(byPeriod.keys()).sort();
  const last6 = sorted.slice(-6);
  const points: TrendPoint[] = last6.map((period) => ({
    period,
    value: avg(byPeriod.get(period)!),
  }));
  const first = points[0].value;
  const last = points[points.length - 1].value;
  const changePercent = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : last > 0 ? 100 : 0;
  const direction: 'up' | 'down' | 'flat' =
    changePercent > 1 ? 'up' : changePercent < -1 ? 'down' : 'flat';
  return [{ metric: metricType as MetricType, label, unit, direction, changePercent, points }];
}

// ─── Section builders ───────────────────────────────────────────────────────────
async function buildGlobalMetrics(): Promise<GlobalAnalyticsDashboard['globalMetrics']> {
  const empty: GlobalAnalyticsDashboard['globalMetrics'] = {
    totalOrganizations: 0,
    totalContributions: 0,
    industriesCovered: 0,
    regionsCovered: 0,
    avgHealthScore: 0,
    avgComplianceScore: 0,
  };
  try {
    const rows: any[] = await (db as any).intelligenceContribution.findMany();
    if (rows.length === 0) return empty;
    const firmHashes = new Set(rows.map((r) => r.contributionHash));
    const industries = new Set(rows.map((r) => r.industry));
    const regions = new Set(rows.map((r) => r.region));
    const health = rows.filter((r) => r.metricType === 'health_score').map((r) => r.metricValue);
    const compliance = rows.filter((r) => r.metricType === 'compliance').map((r) => r.metricValue);
    return {
      // totalOrganizations = distinct anonymizedFirmHash count (NOT firmId — privacy)
      totalOrganizations: firmHashes.size,
      totalContributions: rows.length,
      industriesCovered: industries.size,
      regionsCovered: regions.size,
      avgHealthScore: avg(health),
      avgComplianceScore: avg(compliance),
    };
  } catch {
    return empty;
  }
}

async function buildBenchmarkSummary(): Promise<GlobalAnalyticsDashboard['benchmarkSummary']> {
  const empty = { industriesWithBenchmarks: 0, totalSnapshots: 0, lastComputedAt: '' };
  try {
    const snaps: any[] = await (db as any).benchmarkSnapshot.findMany();
    if (snaps.length === 0) return empty;
    const industries = new Set(snaps.map((s) => s.industry));
    let latest: any = null;
    for (const s of snaps) {
      if (!latest || new Date(s.updatedAt).getTime() > new Date(latest.updatedAt).getTime()) {
        latest = s;
      }
    }
    return {
      industriesWithBenchmarks: industries.size,
      totalSnapshots: snaps.length,
      lastComputedAt: latest ? (latest.updatedAt instanceof Date ? latest.updatedAt.toISOString() : String(latest.updatedAt)) : '',
    };
  } catch {
    return empty;
  }
}

async function buildRiskHeatmap(): Promise<RiskHeatmapCell[]> {
  try {
    const rows: any[] = await (db as any).intelligenceContribution.findMany();
    if (rows.length === 0) return [];
    const groups = new Map<string, { industry: string; region: string; health: number[]; compliance: number[] }>();
    for (const r of rows) {
      const key = `${r.industry}|${r.region}`;
      if (!groups.has(key)) {
        groups.set(key, { industry: r.industry, region: r.region, health: [], compliance: [] });
      }
      const g = groups.get(key)!;
      if (r.metricType === 'health_score') g.health.push(Number(r.metricValue) || 0);
      if (r.metricType === 'compliance') g.compliance.push(Number(r.metricValue) || 0);
    }
    const cells: RiskHeatmapCell[] = [];
    for (const g of groups.values()) {
      const baseValues = g.health.length > 0 ? g.health : g.compliance;
      if (baseValues.length === 0) continue;
      const avgVal = avg(baseValues);
      const riskScore = clamp(100 - avgVal);
      cells.push({
        industry: g.industry as IndustryId,
        region: g.region as RegionId,
        riskScore,
        label: `${g.industry} / ${g.region}`,
      });
    }
    return cells;
  } catch {
    return [];
  }
}

async function buildRevenueDistribution(): Promise<GlobalAnalyticsDashboard['revenueDistribution']> {
  try {
    const rows: any[] = await (db as any).intelligenceContribution.findMany({
      where: { metricType: 'revenue' },
    });
    if (rows.length === 0) return [];
    const byIndustry = new Map<string, number[]>();
    for (const r of rows) {
      if (!byIndustry.has(r.industry)) byIndustry.set(r.industry, []);
      byIndustry.get(r.industry)!.push(Number(r.metricValue) || 0);
    }
    const total = Array.from(byIndustry.values()).flat().reduce((s, v) => s + v, 0);
    if (total === 0) return [];
    const items = Array.from(byIndustry.entries()).map(([industry, vals]) => ({
      industry: industry as IndustryId,
      label: INDUSTRY_LABELS[industry as IndustryId] || industry,
      share: vals.reduce((s, v) => s + v, 0) / total,
      avgRevenue: avg(vals),
    }));
    items.sort((a, b) => b.share - a.share);
    return items.slice(0, 13);
  } catch {
    return [];
  }
}

async function buildRegionalInsights(): Promise<GlobalAnalyticsDashboard['regionalInsights']> {
  try {
    const rows: any[] = await (db as any).intelligenceContribution.findMany();
    if (rows.length === 0) return [];
    const byRegion = new Map<string, { orgs: Set<string>; health: number[]; growth: number[] }>();
    for (const r of rows) {
      if (!byRegion.has(r.region)) {
        byRegion.set(r.region, { orgs: new Set(), health: [], growth: [] });
      }
      const g = byRegion.get(r.region)!;
      g.orgs.add(r.contributionHash);
      if (r.metricType === 'health_score') g.health.push(Number(r.metricValue) || 0);
      if (r.metricType === 'revenue') g.growth.push(Number(r.metricValue) || 0);
    }
    return Array.from(byRegion.entries()).map(([region, g]) => ({
      region: region as RegionId,
      orgCount: g.orgs.size,
      avgHealth: avg(g.health),
      avgGrowth: avg(g.growth),
    }));
  } catch {
    return [];
  }
}

async function buildGstIntelligence(): Promise<GlobalAnalyticsDashboard['gstIntelligence']> {
  const empty = { avgComplianceScore: 0, topGstRisks: [] as string[], filingTrend: null as TrendSeries | null };
  try {
    const contribs: any[] = await (db as any).intelligenceContribution.findMany({
      where: { metricType: 'compliance' },
    });
    const avgCompliance = avg(contribs.map((c) => c.metricValue));

    // topGstRisks from compliance_pattern + risk_pattern nodes
    const nodes: any[] = await (db as any).globalKnowledgeNode.findMany({
      where: { nodeType: { in: ['compliance_pattern', 'risk_pattern'] } },
      orderBy: { weight: 'desc' },
      take: 10,
    });
    const topGstRisks = nodes.map((n) => n.label).filter(Boolean);

    // filingTrend TrendSeries from compliance contributions
    const trendSeries = await buildTrendSeries('compliance', 'GST Compliance Trend', 'percent');
    return {
      avgComplianceScore: avgCompliance,
      topGstRisks,
      filingTrend: trendSeries.length > 0 ? trendSeries[0] : null,
    };
  } catch {
    return empty;
  }
}

async function buildEconomicOutlook(): Promise<GlobalAnalyticsDashboard['economicOutlook']> {
  const fallback = {
    sentiment: 'neutral' as MarketSentiment,
    keyIndicators: [] as MarketIndicator[],
    summary: 'Market data unavailable.',
  };
  try {
    const mod = await import('./market').catch(() => ({
      getMarketOutlook: async () => ({
        sentiment: 'neutral' as MarketSentiment,
        summary: 'Market outlook engine unavailable.',
        indicators: [] as MarketIndicator[],
      }),
    }));
    const outlook = await mod.getMarketOutlook();
    return {
      sentiment: outlook.sentiment,
      keyIndicators: (outlook.indicators || []).slice(0, 5),
      summary: outlook.summary,
    };
  } catch {
    return fallback;
  }
}

async function buildOpportunityIndex(): Promise<OpportunityIndex[]> {
  try {
    // Aggregate per-industry averages
    const rows: any[] = await (db as any).intelligenceContribution.findMany();
    if (rows.length === 0) return [];
    const byIndustry = new Map<string, { health: number[]; compliance: number[]; growth: number[] }>();
    for (const r of rows) {
      if (!byIndustry.has(r.industry)) {
        byIndustry.set(r.industry, { health: [], compliance: [], growth: [] });
      }
      const g = byIndustry.get(r.industry)!;
      if (r.metricType === 'health_score') g.health.push(Number(r.metricValue) || 0);
      if (r.metricType === 'compliance') g.compliance.push(Number(r.metricValue) || 0);
      if (r.metricType === 'revenue') g.growth.push(Number(r.metricValue) || 0);
    }
    // Opportunity drivers from growth_pattern nodes
    const oppNodes: any[] = await (db as any).globalKnowledgeNode.findMany({
      where: { nodeType: 'growth_pattern' },
      orderBy: { weight: 'desc' },
    });
    const driversByIndustry = new Map<string, string[]>();
    for (const n of oppNodes) {
      const key = n.industry || 'other';
      if (!driversByIndustry.has(key)) driversByIndustry.set(key, []);
      if (driversByIndustry.get(key)!.length < 4) {
        driversByIndustry.get(key)!.push(n.label);
      }
    }
    const items: OpportunityIndex[] = [];
    for (const [industry, g] of byIndustry) {
      const health = avg(g.health);
      const compliance = avg(g.compliance);
      const growth = avg(g.growth);
      // score = health*0.4 + compliance*0.3 + (growth*5)*0.3 — growth is a percent already, multiplied to scale
      const score = clamp(health * 0.4 + compliance * 0.3 + clamp(growth * 5) * 0.3);
      items.push({
        industry: industry as IndustryId,
        label: INDUSTRY_LABELS[industry as IndustryId] || industry,
        score,
        drivers: driversByIndustry.get(industry) || driversByIndustry.get('other') || [],
      });
    }
    items.sort((a, b) => b.score - a.score);
    return items.slice(0, 13);
  } catch {
    return [];
  }
}

// ─── getGlobalAnalyticsDashboard ────────────────────────────────────────────────
export async function getGlobalAnalyticsDashboard(): Promise<GlobalAnalyticsDashboard> {
  const generatedAt = new Date().toISOString();

  // Run independent sections concurrently; each catches its own errors.
  const [
    globalMetrics,
    benchmarkSummary,
    growthTrendsArr,
    riskHeatmap,
    revenueDistribution,
    regionalInsights,
    hiringTrendsArr,
    complianceTrendsArr,
    gstIntelligence,
    economicOutlook,
    opportunityIndex,
  ] = await Promise.all([
    buildGlobalMetrics(),
    buildBenchmarkSummary(),
    buildTrendSeries('revenue', 'Revenue Growth', 'inr'),
    buildRiskHeatmap(),
    buildRevenueDistribution(),
    buildRegionalInsights(),
    buildTrendSeries('hiring', 'Hiring Trend', 'count'),
    buildTrendSeries('compliance', 'Compliance Trend', 'percent'),
    buildGstIntelligence(),
    buildEconomicOutlook(),
    buildOpportunityIndex(),
  ]);

  return {
    generatedAt,
    globalMetrics,
    benchmarkSummary,
    growthTrends: growthTrendsArr,
    riskHeatmap,
    revenueDistribution,
    regionalInsights,
    hiringTrends: hiringTrendsArr,
    complianceTrends: complianceTrendsArr,
    gstIntelligence,
    economicOutlook,
    opportunityIndex,
  };
}
