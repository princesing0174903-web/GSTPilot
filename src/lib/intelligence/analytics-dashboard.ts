// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Global Analytics Dashboard™ — Data Layer
// Phase 7 — Subsystem 8
// ═══════════════════════════════════════════════════════════════════════════════
//
// Aggregated visualization data for:
//   • Industry benchmarks      • Hiring trends
//   • Growth trends            • Compliance trends
//   • Risk heatmaps            • GST intelligence
//   • Revenue distribution     • Economic outlook
//   • Regional insights        • Opportunity index
//
// Everything updates automatically — backed by REAL anonymized contributions.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db'
import { getMarketIntelligenceReport } from './market-intelligence'
import { getActivePredictionCount } from './predictive-engine'
import { getActiveRecommendationCount } from './recommendation-engine'
import {
  INDUSTRY_KEYS,
  INDUSTRY_LABELS,
  type GlobalAnalyticsDashboard,
  type IndustryGrowthTrend,
  type IndustryKey,
  type OpportunityIndex,
  type RegionalInsight,
  type RiskHeatmapCell,
  type RevenueBand,
  type ComplianceTrend,
} from './types'
import { currentDate, currentPeriod, isSampleSafe } from './privacy'
import { cached, TTL } from './cache'

// ─── Build Global Analytics Dashboard ────────────────────────────────────────

/**
 * Build the complete Global Analytics Dashboard bundle.
 * Cached for 90s to support high-frequency dashboard polling.
 */
export async function getGlobalAnalyticsDashboard(): Promise<GlobalAnalyticsDashboard> {
  return cached('global-analytics-dashboard', TTL.DASHBOARD, async () => {
    const today = currentDate()
    const period = currentPeriod()

    // 1. Headline counts
    const [globalOrgCount, globalRecordCount, industriesCovered, regionsCovered, predictionsActive, recommendationsActive] = await Promise.all([
      db.intelligenceContribution.groupBy({ by: ['orgFingerprint'], _count: { _all: true } }).then((r) => r.length),
      db.intelligenceContribution.count(),
      db.intelligenceContribution.groupBy({ by: ['industry'] }).then((r) => r.length),
      db.intelligenceContribution.groupBy({ by: ['region'] }).then((r) => r.length),
      getActivePredictionCount(),
      getActiveRecommendationCount(),
    ])

    // 2. Industry benchmarks (aggregate per industry)
    const industryBenchmarks = await Promise.all(
      INDUSTRY_KEYS.map(async (ind) => {
        const contributions = await db.intelligenceContribution.findMany({
          where: { industry: ind, asOfPeriod: period },
          select: { healthScore: true, revenueTrendPct: true },
        })
        const sampleSize = contributions.length
        const avgHealth = sampleSize > 0 ? avg(contributions.map((c) => c.healthScore)) : 0
        const sortedGrowth = contributions.map((c) => c.revenueTrendPct).sort((a, b) => a - b)
        const medianGrowth = sortedGrowth.length > 0 ? median(sortedGrowth) : 0
        return {
          industry: ind,
          label: INDUSTRY_LABELS[ind],
          sampleSize,
          avgHealth: round2(avgHealth),
          medianGrowthPct: round2(medianGrowth),
        }
      }),
    )

    // 3. Growth trends (per industry)
    const growthTrends: IndustryGrowthTrend[] = industryBenchmarks
      .filter((b) => b.sampleSize >= 5)
      .map((b) => ({
        industry: b.industry,
        industryLabel: b.label,
        growthPct: b.medianGrowthPct,
        sampleSize: b.sampleSize,
        trend: b.medianGrowthPct > 10 ? 'accelerating' as const : b.medianGrowthPct > 0 ? 'steady' as const : 'declining' as const,
      }))

    // 4. Risk heatmap (industry × region)
    const heatmapRaw = await db.intelligenceContribution.groupBy({
      by: ['industry', 'region'],
      where: { asOfPeriod: period },
      _avg: { vendorRiskScore: true, healthScore: true },
      _count: { _all: true },
    })
    const riskHeatmap: RiskHeatmapCell[] = heatmapRaw
      .filter((h) => h._count._all >= 3)
      .map((h) => ({
        industry: h.industry as IndustryKey,
        region: h.region,
        riskScore: round2(100 - (h._avg.healthScore || 50)),
        sampleSize: h._count._all,
      }))
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 30)

    // 5. Revenue distribution
    const revenueBands = await db.intelligenceContribution.groupBy({
      by: ['revenueBand'],
      where: { asOfPeriod: period },
      _count: { _all: true },
    })
    const totalBandCount = revenueBands.reduce((s, r) => s + r._count._all, 0) || 1
    const revenueDistribution = (['0-10L', '10L-1Cr', '1Cr-10Cr', '10Cr+'] as RevenueBand[]).map((band) => {
      const entry = revenueBands.find((r) => r.revenueBand === band)
      const orgCount = entry?._count._all || 0
      return {
        band,
        sharePct: round2((orgCount / totalBandCount) * 100),
        orgCount,
      }
    })

    // 6. Regional insights
    const regionalRaw = await db.intelligenceContribution.groupBy({
      by: ['region'],
      where: { asOfPeriod: period },
      _avg: { healthScore: true, revenueTrendPct: true },
      _count: { _all: true },
    })
    const regionalInsights: RegionalInsight[] = await Promise.all(
      regionalRaw
        .filter((r) => r._count._all >= 3)
        .map(async (r) => {
          const topIndustryRow = await db.intelligenceContribution.groupBy({
            by: ['industry'],
            where: { region: r.region, asOfPeriod: period },
            _count: { _all: true },
            orderBy: { _count: { industry: 'desc' } },
            take: 1,
          })
          return {
            region: r.region,
            orgCount: r._count._all,
            avgHealthScore: round2(r._avg.healthScore || 0),
            topIndustry: (topIndustryRow[0]?.industry as IndustryKey) || 'professional_services',
            avgGrowthPct: round2(r._avg.revenueTrendPct || 0),
          }
        }),
    )
    regionalInsights.sort((a, b) => b.orgCount - a.orgCount)

    // 7. Hiring trends
    const hiringTrends = await Promise.all(
      INDUSTRY_KEYS.map(async (ind) => {
        const contributions = await db.intelligenceContribution.findMany({
          where: { industry: ind, asOfPeriod: period },
          select: { hiringTrendPct: true },
        })
        return {
          industry: ind,
          label: INDUSTRY_LABELS[ind],
          hiringTrendPct: contributions.length > 0 ? round2(avg(contributions.map((c) => c.hiringTrendPct))) : 0,
          sampleSize: contributions.length,
        }
      }),
    )

    // 8. Compliance trends (per industry for current period)
    const complianceTrends: ComplianceTrend[] = await Promise.all(
      INDUSTRY_KEYS.map(async (ind) => {
        const contributions = await db.intelligenceContribution.findMany({
          where: { industry: ind, asOfPeriod: period },
          select: { complianceScore: true },
        })
        return {
          industry: ind,
          period,
          avgComplianceScore: contributions.length > 0 ? round2(avg(contributions.map((c) => c.complianceScore))) : 0,
          sampleSize: contributions.length,
        }
      }),
    )

    // 9. GST intelligence
    const allCompliance = await db.intelligenceContribution.findMany({
      where: { asOfPeriod: period },
      select: { industry: true, complianceScore: true },
    })
    const avgCompliance = allCompliance.length > 0 ? round2(avg(allCompliance.map((c) => c.complianceScore))) : 0
    const gstByIndustry = INDUSTRY_KEYS.map((ind) => ({
      industry: ind,
      avg: avg(allCompliance.filter((c) => c.industry === ind).map((c) => c.complianceScore)),
    })).sort((a, b) => a.avg - b.avg)
    const topRiskIndustries = gstByIndustry.slice(0, 3).map((g) => g.industry as IndustryKey)
    const marketReport = await getMarketIntelligenceReport()
    const recentGstSignals = marketReport.signals.filter((s) => s.category === 'gst_change' || s.category === 'tax_notification').slice(0, 5)

    // 10. Opportunity index (per industry)
    const opportunityIndex: OpportunityIndex[] = industryBenchmarks
      .filter((b) => b.sampleSize >= 5)
      .map((b) => {
        const signals = marketReport.signals.filter((s) => s.affectedIndustries.includes(b.industry))
        const positiveBoost = signals.filter((s) => s.impact === 'positive').reduce((s, x) => s + x.impactScore, 0)
        const negativeDrag = signals.filter((s) => s.impact === 'negative').reduce((s, x) => s + Math.abs(x.impactScore), 0)
        const growthBonus = Math.max(0, b.medianGrowthPct) * 2
        const healthBonus = (b.avgHealth - 50) * 0.5
        const index = Math.max(0, Math.min(100, 50 + positiveBoost - negativeDrag + growthBonus + healthBonus))
        const sigStrs: string[] = []
        if (b.medianGrowthPct > 10) sigStrs.push('Strong growth trend')
        if (b.avgHealth > 60) sigStrs.push('Healthy sector')
        if (positiveBoost > 30) sigStrs.push('Positive market signals')
        if (negativeDrag > 30) sigStrs.push('Elevated risk signals')
        if (sigStrs.length === 0) sigStrs.push('Stable conditions')
        return {
          industry: b.industry,
          industryLabel: b.label,
          index: round2(index),
          signals: sigStrs,
        }
      })
      .sort((a, b) => b.index - a.index)

    // 11. Oracle narrative
    const oracleNarrative = buildOracleNarrative({
      globalOrgCount,
      industriesCovered,
      regionsCovered,
      avgCompliance,
      opportunityCount: opportunityIndex.filter((o) => o.index > 60).length,
      riskCount: riskHeatmap.filter((r) => r.riskScore > 60).length,
    })

    return {
      asOfDate: today,
      globalOrgCount,
      globalRecordCount,
      industriesCovered,
      regionsCovered,
      industryBenchmarks: industryBenchmarks.filter((b) => b.sampleSize > 0),
      growthTrends,
      riskHeatmap,
      revenueDistribution,
      regionalInsights,
      hiringTrends: hiringTrends.filter((h) => h.sampleSize > 0),
      complianceTrends: complianceTrends.filter((c) => c.sampleSize > 0),
      gstIntelligence: {
        avgCompliance,
        topRiskIndustries,
        recentGstSignals,
      },
      economicOutlook: marketReport.economicOutlook,
      opportunityIndex,
      activePredictionCount: predictionsActive,
      activeRecommendationCount: recommendationsActive,
      oracleNarrative,
    }
  })
}

// ─── Oracle Narrative Builder ────────────────────────────────────────────────

function buildOracleNarrative(params: {
  globalOrgCount: number
  industriesCovered: number
  regionsCovered: number
  avgCompliance: number
  opportunityCount: number
  riskCount: number
}): string {
  if (params.globalOrgCount === 0) {
    return 'The Global Data Intelligence Cloud is online but awaiting first contributions. As organizations contribute anonymized intelligence, Oracle will surface worldwide patterns here.'
  }
  return `Oracle is learning from ${params.globalOrgCount} anonymized organizations across ${params.industriesCovered} industries and ${params.regionsCovered} regions. Average compliance score is ${params.avgCompliance.toFixed(0)}/100. Currently tracking ${params.opportunityCount} high-opportunity industries and ${params.riskCount} elevated-risk hotspots.`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avg(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function median(sortedAsc: number[]): number {
  if (sortedAsc.length === 0) return 0
  const mid = Math.floor(sortedAsc.length / 2)
  return sortedAsc.length % 2 === 0 ? (sortedAsc[mid - 1] + sortedAsc[mid]) / 2 : sortedAsc[mid]
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
