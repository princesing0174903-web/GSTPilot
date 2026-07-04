// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Global Data Intelligence Cloud™ — Orchestrator
// ═══════════════════════════════════════════════════════════════════════════════
//
// Single entry point for the Executive API: /api/intelligence/dashboard
// Pulls all 11 subsystem summaries into one IntelligenceDashboardBundle.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db'
import { getGlobalOrgCount, getGlobalRecordCount, detectIndustry } from './data-cloud'
import { compareOrgToIndustry } from './benchmark-engine'
import { getMarketIntelligenceReport } from './market-intelligence'
import { generateOrgPredictions, getActivePredictionCount } from './predictive-engine'
import { generateRecommendations, getActiveRecommendationCount } from './recommendation-engine'
import { getKnowledgeGraphReport } from './knowledge-graph'
import { generateInsightFeed } from './insight-feed'
import type { IntelligenceDashboardBundle, IndustryKey, OrgFingerprint } from './types'
import { currentDate } from './privacy'
import { cached, TTL } from './cache'

export interface OrchestratorInput {
  firmId?: string
  firmState?: string
  // If true, the orchestrator will submit an anonymized contribution first
  // (extends the global pool) before reading benchmarks.
  contribute?: boolean
}

/**
 * Build the unified Intelligence Dashboard bundle.
 *
 * Pipeline:
 *   1. (Optional) Submit anonymized contribution from the firm → grows pool
 *   2. Detect firm's industry
 *   3. Compute org-specific benchmark comparisons
 *   4. Fetch market intelligence report
 *   5. Generate org-scoped predictions (Digital Twin™ integration)
 *   6. Generate personalized recommendations
 *   7. Fetch knowledge graph summary
 *   8. Fetch today's insight feed
 *   9. Bundle into IntelligenceDashboardBundle (cached 90s)
 */
export async function getIntelligenceDashboard(input: OrchestratorInput = {}): Promise<IntelligenceDashboardBundle> {
  return cached(`intelligence-dashboard-${input.firmId || 'global'}`, TTL.DASHBOARD, async () => {
    const today = currentDate()

    // 1. Optionally submit contribution
    let orgFingerprintHash: string | null = null
    let industry: IndustryKey = 'professional_services'

    if (input.firmId && input.contribute) {
      const { submitOrgContribution } = await import('./data-cloud')
      const contribution = await submitOrgContribution({
        firmId: input.firmId,
        firmState: input.firmState,
      })
      if (contribution) {
        orgFingerprintHash = contribution.fingerprint
        industry = contribution.industry
      }
    } else if (input.firmId) {
      // Even without contributing, detect industry for benchmarking
      industry = await detectIndustry(input.firmId)
    }

    // 2. Headline counts
    const [globalOrgCount, industriesCovered, predictionsActive, recommendationsActive, signalsActive] = await Promise.all([
      getGlobalOrgCount(),
      db.intelligenceContribution.groupBy({ by: ['industry'] }).then((r) => r.length),
      getActivePredictionCount(),
      getActiveRecommendationCount(),
      db.marketSignal.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
    ])

    // 3. Subsystem summaries (run in parallel)
    const [benchmarkReport, marketReport, predictions, recommendations, knowledgeReport, feedReport] = await Promise.all([
      orgFingerprintHash
        ? compareOrgToIndustry(orgFingerprintHash, industry)
        : Promise.resolve(null),
      getMarketIntelligenceReport(),
      orgFingerprintHash
        ? generateOrgPredictions(orgFingerprintHash, industry)
        : Promise.resolve([]),
      generateRecommendations(orgFingerprintHash, industry),
      getKnowledgeGraphReport(20),
      generateInsightFeed(industry, orgFingerprintHash),
    ])

    // 4. Build summaries
    const benchmarkSummary = benchmarkReport
      ? {
          comparisonsCount: benchmarkReport.comparisons.length,
          overallPercentile: benchmarkReport.overallPercentile,
          topInsight: benchmarkReport.oracleNarrative,
        }
      : {
          comparisonsCount: 0,
          overallPercentile: null,
          topInsight: 'Contribute your data to unlock benchmark comparisons.',
        }

    const marketSummary = {
      outlook: marketReport.economicOutlook,
      topSignal: marketReport.signals[0]?.headline || 'No active signals',
      opportunities: marketReport.opportunitiesCount,
      risks: marketReport.risksCount,
    }

    const predictionSummary = predictions.length > 0
      ? {
          topPrediction: predictions[0].narrative,
          confidencePct: predictions[0].confidencePct,
        }
      : {
          topPrediction: 'No active predictions yet — contribute data to enable forecasting.',
          confidencePct: 0,
        }

    const recommendationSummary = recommendations.recommendations.length > 0
      ? {
          topRecommendation: recommendations.recommendations[0].title,
          potentialImpactInr: recommendations.totalPotentialImpactInr,
        }
      : {
          topRecommendation: 'No active recommendations yet.',
          potentialImpactInr: 0,
        }

    const knowledgeSummary = {
      nodeCount: knowledgeReport.nodeCount,
      edgeCount: knowledgeReport.edgeCount,
      topCluster: knowledgeReport.industryClusters[0]?.industry || 'none',
    }

    const feedSummary = {
      todayItems: feedReport.items.length,
      topPriority: feedReport.items.find((i) => i.priority === 'critical')?.headline
        || feedReport.items.find((i) => i.priority === 'high')?.headline
        || 'No high-priority items today',
    }

    // 5. Oracle narrative
    const oracleNarrative = buildOracleNarrative({
      globalOrgCount,
      industriesCovered,
      benchmarkPercentile: benchmarkSummary.overallPercentile,
      marketOutlook: marketSummary.outlook,
      recommendationsCount: recommendations.recommendations.length,
      feedItems: feedSummary.todayItems,
    })

    return {
      generatedAt: today,
      orgFingerprint: orgFingerprintHash
        ? ({ hash: orgFingerprintHash, industry, region: 'anonymized', sizeBand: 'medium' } as OrgFingerprint)
        : null,
      globalOrgCount,
      industriesCovered,
      predictionsActive,
      recommendationsActive,
      signalsActive,
      benchmarkSummary,
      marketSummary,
      predictionSummary,
      recommendationSummary,
      knowledgeSummary,
      feedSummary,
      oracleNarrative,
    } as IntelligenceDashboardBundle
  })
}

function buildOracleNarrative(params: {
  globalOrgCount: number
  industriesCovered: number
  benchmarkPercentile: number | null
  marketOutlook: string
  recommendationsCount: number
  feedItems: number
}): string {
  let s = `Oracle is learning from ${params.globalOrgCount} anonymized organizations across ${params.industriesCovered} industries.`
  if (params.benchmarkPercentile !== null) {
    s += ` Your performance ranks at the ${params.benchmarkPercentile}%ile.`
  }
  s += ` Market outlook: ${params.marketOutlook}. ${params.recommendationsCount} active recommendations and ${params.feedItems} feed items today.`
  return s
}
