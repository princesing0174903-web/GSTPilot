// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Enterprise Insight Feed™
// Phase 7 — Subsystem 9
// ═══════════════════════════════════════════════════════════════════════════════
//
// Daily Oracle feed delivering:
//   • Top risks              • GST updates
//   • Top opportunities      • Market alerts
//   • Industry news          • Competitor trends
//   • Recommended actions    • AI summaries
//
// The feed is built by merging:
//   • Today's market signals (Global Market Intelligence™)
//   • Today's recommendations (Global Recommendation Engine™)
//   • Today's predictions (Predictive Intelligence™)
//   • Industry contribution trends (Global Business Data Cloud™)
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db'
import { getMarketIntelligenceReport } from './market-intelligence'
import { generateRecommendations } from './recommendation-engine'
import { generateIndustryPredictions } from './predictive-engine'
import {
  INDUSTRY_LABELS,
  type FeedCategory,
  type InsightFeedItem,
  type InsightFeedReport,
  type IndustryKey,
} from './types'
import { currentDate, currentPeriod, isSampleSafe } from './privacy'

// ─── Generate Daily Insight Feed ─────────────────────────────────────────────

/**
 * Build today's Enterprise Insight Feed.
 * Idempotent — if feed items already exist for today, returns them.
 *
 * @param industry Optional industry scope (defaults to 'professional_services')
 * @param orgFingerprintHash Optional org fingerprint for personalized recommendations
 */
export async function generateInsightFeed(
  industry: IndustryKey = 'professional_services',
  orgFingerprintHash?: string | null,
): Promise<InsightFeedReport> {
  const today = currentDate()

  // Check if feed already generated for today
  const existing = await db.insightFeedItem.findMany({
    where: { feedDate: today },
    orderBy: [{ priority: 'desc' }, { generatedAt: 'desc' }],
    take: 50,
  })

  let items: InsightFeedItem[]

  if (existing.length > 0) {
    items = existing.map((it) => ({
      id: it.id,
      feedDate: it.feedDate,
      category: it.category as FeedCategory,
      priority: it.priority as InsightFeedItem['priority'],
      headline: it.headline,
      summary: it.summary,
      impact: (it.impact as InsightFeedItem['impact']) || undefined,
      affectedIndustries: safeParseArr(it.affectedIndustries) as IndustryKey[],
      recommendedAction: it.recommendedAction || undefined,
      evidenceCount: it.evidenceCount,
      generatedAt: it.generatedAt.toISOString(),
    }))
  } else {
    items = await buildAndPersistFeed(today, industry, orgFingerprintHash)
  }

  // Categorize
  const topRisks = items
    .filter((i) => i.category === 'top_risk' || (i.impact === 'negative' && i.priority === 'high'))
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))
    .slice(0, 5)
  const topOpportunities = items
    .filter((i) => i.category === 'top_opportunity' || (i.impact === 'positive' && i.priority === 'high'))
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))
    .slice(0, 5)

  const aiSummary = buildAiSummary(items, industry)

  return {
    feedDate: today,
    items,
    topRisks,
    topOpportunities,
    aiSummary,
  }
}

// ─── Build & Persist Feed ─────────────────────────────────────────────────────

async function buildAndPersistFeed(
  today: string,
  industry: IndustryKey,
  orgFingerprintHash: string | null | undefined,
): Promise<InsightFeedItem[]> {
  const items: InsightFeedItem[] = []

  // 1. Market signals → feed items
  const marketReport = await getMarketIntelligenceReport()
  for (const signal of marketReport.signals) {
    const category: FeedCategory =
      signal.category === 'gst_change' ? 'gst_update' :
      signal.category === 'tax_notification' ? 'gst_update' :
      signal.category === 'competitor' ? 'competitor_trend' :
      signal.category === 'market_opportunity' ? 'top_opportunity' :
      signal.category === 'supply_chain_risk' ? 'top_risk' :
      signal.impact === 'negative' ? 'market_alert' :
      'industry_news'

    const priority: InsightFeedItem['priority'] =
      signal.impactScore <= -30 ? 'critical' :
      signal.impactScore <= -10 ? 'high' :
      signal.impactScore >= 30 ? 'high' :
      'normal'

    items.push({
      id: `feed-signal-${signal.id}`,
      feedDate: today,
      category,
      priority,
      headline: signal.headline,
      summary: signal.summary,
      impact: signal.impact,
      affectedIndustries: signal.affectedIndustries,
      recommendedAction: signal.impact === 'negative'
        ? 'Review exposure and prepare mitigation plan'
        : signal.impact === 'positive'
        ? 'Evaluate capture strategy'
        : undefined,
      evidenceCount: 1,
      generatedAt: signal.createdAt,
    })
  }

  // 2. Recommendations → recommended_action feed items
  const recReport = await generateRecommendations(orgFingerprintHash ?? null, industry)
  for (const rec of recReport.recommendations) {
    const priority: InsightFeedItem['priority'] =
      rec.confidencePct >= 85 ? 'high' :
      rec.confidencePct >= 65 ? 'normal' : 'low'

    items.push({
      id: `feed-rec-${rec.id}`,
      feedDate: today,
      category: 'recommended_action',
      priority,
      headline: rec.title,
      summary: rec.description,
      impact: rec.expectedImpact > 0 ? 'positive' : 'neutral',
      affectedIndustries: rec.relatedIndustries,
      recommendedAction: rec.description,
      evidenceCount: rec.evidence.length,
      generatedAt: rec.createdAt,
    })
  }

  // 3. Predictions → AI summary feed items
  const predictions = await generateIndustryPredictions(industry)
  for (const p of predictions) {
    if (p.confidencePct < 50) continue // skip low-confidence predictions
    const isRisk = p.predictionType === 'complianceRisk' || p.predictionType === 'vendorRisk' || p.predictionType === 'customerChurn'
    const category: FeedCategory = isRisk ? 'top_risk' : 'top_opportunity'
    const priority: InsightFeedItem['priority'] = p.confidencePct >= 80 ? 'high' : 'normal'

    items.push({
      id: `feed-pred-${p.id}`,
      feedDate: today,
      category,
      priority,
      headline: `${INDUSTRY_LABELS[industry]} ${p.predictionType} forecast: ${p.predictedValue.toFixed(1)} (${p.confidencePct.toFixed(0)}% confidence)`,
      summary: p.narrative,
      impact: isRisk ? 'negative' : 'positive',
      affectedIndustries: [industry],
      recommendedAction: isRisk ? 'Mitigation recommended' : 'Plan to capitalize',
      evidenceCount: p.drivers.length,
      generatedAt: new Date().toISOString(),
    })
  }

  // 4. Industry trend insights from contributions
  const contributions = await db.intelligenceContribution.findMany({
    where: { asOfPeriod: currentPeriod() },
    select: { industry: true, growthPatternTag: true, revenueTrendPct: true },
  })
  if (isSampleSafe(contributions.length)) {
    const byIndustry: Record<string, number[]> = {}
    for (const c of contributions) {
      if (!byIndustry[c.industry]) byIndustry[c.industry] = []
      byIndustry[c.industry].push(c.revenueTrendPct)
    }
    for (const [ind, values] of Object.entries(byIndustry)) {
      if (!isSampleSafe(values.length)) continue
      const avgTrend = values.reduce((a, b) => a + b, 0) / values.length
      if (Math.abs(avgTrend) < 5) continue
      const indKey = ind as IndustryKey
      items.push({
        id: `feed-trend-${ind}-${today}`,
        feedDate: today,
        category: 'industry_news',
        priority: 'normal',
        headline: `${INDUSTRY_LABELS[indKey] || ind} sector ${avgTrend > 0 ? 'growing' : 'contracting'} at ${avgTrend.toFixed(1)}%`,
        summary: `Anonymized aggregate of ${values.length} ${INDUSTRY_LABELS[indKey] || ind} firms indicates a ${avgTrend > 0 ? 'growth' : 'decline'} trend.`,
        impact: avgTrend > 0 ? 'positive' : 'negative',
        affectedIndustries: [indKey],
        recommendedAction: avgTrend > 10 ? 'Capitalize on tailwinds' : avgTrend < -10 ? 'Defensive positioning' : undefined,
        evidenceCount: values.length,
        generatedAt: new Date().toISOString(),
      })
    }
  }

  // 5. AI Summary feed item
  items.push({
    id: `feed-ai-summary-${today}`,
    feedDate: today,
    category: 'ai_summary',
    priority: 'high',
    headline: 'Oracle Daily AI Summary',
    summary: `Oracle analyzed ${items.length} signals today across ${INDUSTRY_LABELS[industry]} and adjacent sectors. Top priorities: ${items.filter((i) => i.priority === 'high').slice(0, 3).map((i) => i.headline).join('; ') || 'no critical signals'}.`,
    impact: 'neutral',
    affectedIndustries: [industry],
    recommendedAction: 'Review feed items and prioritize high-priority actions',
    evidenceCount: items.length,
    generatedAt: new Date().toISOString(),
  })

  // 6. Persist feed items (idempotent — only if not already persisted today)
  for (const item of items) {
    try {
      const existingItem = await db.insightFeedItem.findFirst({
        where: { feedDate: today, headline: item.headline },
        select: { id: true },
      })
      if (existingItem) continue

      await db.insightFeedItem.create({
        data: {
          feedDate: item.feedDate,
          category: item.category,
          priority: item.priority,
          headline: item.headline,
          summary: item.summary,
          impact: item.impact || null,
          affectedIndustries: JSON.stringify(item.affectedIndustries),
          recommendedAction: item.recommendedAction || null,
          evidenceCount: item.evidenceCount,
        },
      })
    } catch (err) {
      console.error('[intelligence/feed] persist failed:', err)
    }
  }

  // Sort by priority then by category
  return items.sort((a, b) => {
    const pDiff = priorityRank(b.priority) - priorityRank(a.priority)
    if (pDiff !== 0) return pDiff
    return categoryRank(a.category) - categoryRank(b.category)
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priorityRank(p: InsightFeedItem['priority']): number {
  return p === 'critical' ? 4 : p === 'high' ? 3 : p === 'normal' ? 2 : 1
}

function categoryRank(c: FeedCategory): number {
  const order: FeedCategory[] = ['top_risk', 'top_opportunity', 'market_alert', 'gst_update', 'competitor_trend', 'recommended_action', 'industry_news', 'ai_summary']
  return order.indexOf(c)
}

function buildAiSummary(items: InsightFeedItem[], industry: IndustryKey): string {
  const critical = items.filter((i) => i.priority === 'critical').length
  const high = items.filter((i) => i.priority === 'high').length
  const positive = items.filter((i) => i.impact === 'positive').length
  const negative = items.filter((i) => i.impact === 'negative').length

  return `Oracle's daily feed for ${INDUSTRY_LABELS[industry]}: ${items.length} items (${critical} critical, ${high} high priority). Sentiment: ${positive} positive vs ${negative} negative. Recommended next step: review top risks and capitalize on top opportunities.`
}

function safeParseArr(s: string | null): string[] {
  try { return s ? JSON.parse(s) : [] } catch { return [] }
}
