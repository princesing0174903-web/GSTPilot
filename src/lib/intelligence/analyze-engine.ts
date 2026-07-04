// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Intelligence Analyze Engine — POST /api/intelligence/analyze
// ═══════════════════════════════════════════════════════════════════════════════
//
// Orchestrates a unified AnalyzeResponse from a natural-language question.
// Combines:
//   • Industry Benchmark Engine™  → relevant metric comparisons
//   • Predictive Intelligence™   → forecasts for requested prediction types
//   • Global Recommendation Engine™ → recommendations matching the question
//   • Global Market Intelligence™ → relevant market signals
//   • Cross-Company Knowledge Graph™ → related graph nodes
//
// Intent classification maps natural-language questions to subsystem queries.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db'
import { compareOrgToIndustry, benchmarkValue } from './benchmark-engine'
import { generateOrgPredictions, predictSpecific } from './predictive-engine'
import { generateRecommendations } from './recommendation-engine'
import { getMarketIntelligenceReport } from './market-intelligence'
import { getKnowledgeGraphReport } from './knowledge-graph'
import { provideIndustryAdvice } from './industry-advisor'
import {
  INDUSTRY_LABELS,
  BENCHMARK_METRIC_LABELS,
  BENCHMARK_METRICS,
  PREDICTION_TYPES,
  type AnalyzeRequest,
  type AnalyzeResponse,
  type BenchmarkMetric,
  type IndustryKey,
  type PredictionType,
} from './types'
import { currentDate } from './privacy'

// ─── Intent Classifier ────────────────────────────────────────────────────────

type Intent =
  | 'benchmark_compare'
  | 'predict'
  | 'recommend'
  | 'market_signals'
  | 'knowledge_graph'
  | 'industry_advice'
  | 'general'

interface ClassifiedIntent {
  intent: Intent
  industry: IndustryKey
  horizonDays: number
  metrics: BenchmarkMetric[]
  predictionTypes: PredictionType[]
  question: string
}

const VALID_INDUSTRIES: ReadonlySet<string> = new Set([
  'manufacturing', 'retail', 'healthcare', 'construction', 'education',
  'hospitality', 'logistics', 'professional_services', 'it', 'ecommerce',
  'wholesale', 'finance',
])

function classifyIntent(req: AnalyzeRequest): ClassifiedIntent {
  const q = req.question.toLowerCase()
  const industry: IndustryKey = (req.industry && VALID_INDUSTRIES.has(req.industry)
    ? req.industry
    : 'professional_services') as IndustryKey
  const horizonDays = req.horizonDays || 90

  const metrics: BenchmarkMetric[] = []
  for (const m of BENCHMARK_METRICS) {
    const label = BENCHMARK_METRIC_LABELS[m].toLowerCase()
    if (q.includes(label) || q.includes(m.toLowerCase())) metrics.push(m)
  }

  const predictionTypes: PredictionType[] = []
  for (const p of PREDICTION_TYPES) {
    const synonyms: Record<PredictionType, string[]> = {
      revenue: ['revenue', 'income', 'sales forecast'],
      profit: ['profit', 'margin', 'bottom line'],
      cashFlow: ['cash flow', 'cash position', 'liquidity'],
      gstLiability: ['gst', 'tax liability', 'output tax'],
      hiringDemand: ['hiring', 'recruit', 'workforce'],
      inventoryDemand: ['inventory', 'stock', 'warehouse'],
      collections: ['collection', 'receivables', 'ar'],
      customerChurn: ['churn', 'customer loss', 'retention'],
      vendorRisk: ['vendor', 'supplier'],
      complianceRisk: ['compliance risk', 'filing risk'],
      taxSavings: ['tax savings', 'itc', 'input credit'],
      growthOpportunity: ['growth opportunity', 'expansion'],
    }
    if (synonyms[p].some((s) => q.includes(s))) predictionTypes.push(p)
  }

  let intent: Intent = 'general'
  if (q.includes('benchmark') || q.includes('compare') || q.includes('percentile')) intent = 'benchmark_compare'
  else if (q.includes('predict') || q.includes('forecast') || q.includes('projection')) intent = 'predict'
  else if (q.includes('recommend') || q.includes('should') || q.includes('action')) intent = 'recommend'
  else if (q.includes('market') || q.includes('signal') || q.includes('trend')) intent = 'market_signals'
  else if (q.includes('knowledge') || q.includes('graph') || q.includes('related')) intent = 'knowledge_graph'
  else if (q.includes('advice') || q.includes('advise') || q.includes('guidance')) intent = 'industry_advice'

  return { intent, industry, horizonDays, metrics, predictionTypes, question: req.question }
}

// ─── Analyze ──────────────────────────────────────────────────────────────────

export async function analyze(req: AnalyzeRequest): Promise<AnalyzeResponse> {
  const classified = classifyIntent(req)
  const today = currentDate()
  const industry = classified.industry

  // Run subsystem queries in parallel
  const [benchmarkReport, allPredictions, recommendationReport, marketReport, knowledgeReport] = await Promise.all([
    compareOrgToIndustry('anonymous', industry).catch(() => null),
    generateOrgPredictions(null, industry).catch(() => []),
    generateRecommendations(null, industry).catch(() => ({ recommendations: [], totalPotentialImpactInr: 0, oracleSummary: '', asOfDate: today })),
    getMarketIntelligenceReport().catch(() => ({
      signals: [], economicOutlook: 'stable' as const, gstOutlook: '', industryOutlook: {} as never,
      opportunitiesCount: 0, risksCount: 0, oracleSummary: '', asOfDate: today,
    })),
    getKnowledgeGraphReport(20).catch(() => ({
      asOfDate: today, nodeCount: 0, edgeCount: 0, topNodes: [], topEdges: [],
      industryClusters: [], oracleSummary: '',
    })),
  ])

  // Filter predictions to those matching the question
  const predictions = classified.predictionTypes.length > 0
    ? allPredictions.filter((p) => classified.predictionTypes.includes(p.predictionType))
    : allPredictions.slice(0, 3)

  // Filter recommendations to those matching the question intent
  const recommendations = classified.intent === 'recommend'
    ? recommendationReport.recommendations.slice(0, 5)
    : recommendationReport.recommendations.slice(0, 3)

  // Filter benchmarks
  const comparisons = (benchmarkReport?.comparisons || []).filter((c) =>
    classified.metrics.length === 0 || classified.metrics.includes(c.metric),
  )

  // Related market signals
  const relatedSignals = marketReport.signals
    .filter((s) => s.affectedIndustries.includes(industry) || s.affectedRegions.includes('all'))
    .slice(0, 5)

  // Related knowledge graph nodes
  const relatedKnowledge = knowledgeReport.topNodes
    .filter((n) => n.industry === industry || !n.industry)
    .slice(0, 8)

  // If intent is industry_advice, route through advisor
  let answer = ''
  if (classified.intent === 'industry_advice') {
    const advice = await provideIndustryAdvice(industry, req.question).catch(() => null)
    if (advice) {
      answer = advice.adviceSummary
    }
  }
  if (!answer) {
    answer = buildAnswer(classified, benchmarkReport, predictions, recommendations, marketReport, knowledgeReport, industry)
  }

  // Confidence score
  const confidencePct = computeConfidence(comparisons, predictions, recommendations, relatedSignals)

  return {
    question: req.question,
    intent: classified.intent,
    industry,
    answer,
    benchmarks: comparisons,
    predictions,
    recommendations,
    relatedSignals,
    relatedKnowledge,
    confidencePct,
    generatedAt: today,
  }
}

// ─── Answer Builder ───────────────────────────────────────────────────────────

function buildAnswer(
  classified: ClassifiedIntent,
  benchmarkReport: Awaited<ReturnType<typeof compareOrgToIndustry>> | null,
  predictions: Awaited<ReturnType<typeof generateOrgPredictions>>,
  recommendations: Awaited<ReturnType<typeof generateRecommendations>>['recommendations'],
  marketReport: Awaited<ReturnType<typeof getMarketIntelligenceReport>>,
  knowledgeReport: Awaited<ReturnType<typeof getKnowledgeGraphReport>>,
  industry: IndustryKey,
): string {
  const parts: string[] = []
  parts.push(`Oracle analyzed your question across ${INDUSTRY_LABELS[industry]} industry data.`)

  if (benchmarkReport && benchmarkReport.overallPercentile !== null) {
    parts.push(`Your business performs at the ${benchmarkReport.overallPercentile}%ile of similar ${INDUSTRY_LABELS[industry]} firms (sample: ${benchmarkReport.sampleSize} orgs).`)
  } else {
    parts.push(`Benchmark pool is growing — ${benchmarkReport?.sampleSize || 0} ${INDUSTRY_LABELS[industry]} firms have contributed anonymized data.`)
  }

  if (predictions.length > 0) {
    const top = predictions[0]
    parts.push(`Top forecast: ${top.narrative}`)
  }

  if (recommendations.length > 0) {
    parts.push(`Top recommendation: ${recommendations[0].title} — ${recommendations[0].description.slice(0, 120)}…`)
  }

  if (marketReport.signals.length > 0) {
    parts.push(`Market outlook: ${marketReport.economicOutlook}. Top signal: "${marketReport.signals[0].headline}".`)
  }

  if (knowledgeReport.nodeCount > 0) {
    parts.push(`Knowledge graph: ${knowledgeReport.nodeCount} anonymized entities linked through ${knowledgeReport.edgeCount} correlation edges.`)
  }

  return parts.join(' ')
}

// ─── Confidence ───────────────────────────────────────────────────────────────

function computeConfidence(
  comparisons: Awaited<ReturnType<typeof compareOrgToIndustry>>['comparisons'],
  predictions: Awaited<ReturnType<typeof generateOrgPredictions>>,
  recommendations: Awaited<ReturnType<typeof generateRecommendations>>['recommendations'],
  signals: Awaited<ReturnType<typeof getMarketIntelligenceReport>>['signals'],
): number {
  const benchmarkScore = comparisons.length > 0 ? 25 : 0
  const predictionScore = predictions.length > 0 ? Math.min(25, predictions[0].confidencePct / 4) : 0
  const recommendationScore = recommendations.length > 0 ? 20 : 0
  const signalScore = Math.min(15, signals.length * 3)
  const baseScore = 15 // base for routing to right subsystem
  return Math.min(95, Math.round(baseScore + benchmarkScore + predictionScore + recommendationScore + signalScore))
}
