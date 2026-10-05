// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Global Data Intelligence Cloud™ — Type System
// Phase 7 — World Business Brain
// ═══════════════════════════════════════════════════════════════════════════════
//
// 11 interconnected subsystems:
//   1.  Global Business Data Cloud™          — anonymized data contribution layer
//   2.  Industry Benchmark Engine™           — percentile comparison
//   3.  Global Market Intelligence™          — economic/regulatory/competitive signals
//   4.  Predictive Intelligence™             — forecasts w/ Digital Twin™ integration
//   5.  Cross-Company Knowledge Graph™       — anonymous business graph
//   6.  Global Recommendation Engine™        — worldwide pattern recommendations
//   7.  AI Industry Advisor™                 — 13 industries specialized intelligence
//   8.  Global Analytics Dashboard™          — aggregated visualization data
//   9.  Enterprise Insight Feed™             — daily Oracle feed
//   10. Executive APIs™                      — 12 production endpoints
//   11. Security™ & Performance™             — privacy + caching + audit
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 13 Supported Industries ───────────────────────────────────────────────────
export const INDUSTRY_KEYS = [
  'manufacturing',
  'retail',
  'healthcare',
  'construction',
  'education',
  'hospitality',
  'logistics',
  'professional_services',
  'it',
  'ecommerce',
  'wholesale',
  'finance',
] as const
export type IndustryKey = (typeof INDUSTRY_KEYS)[number]

export const INDUSTRY_LABELS: Record<IndustryKey, string> = {
  manufacturing: 'Manufacturing',
  retail: 'Retail',
  healthcare: 'Healthcare',
  construction: 'Construction',
  education: 'Education',
  hospitality: 'Hospitality',
  logistics: 'Logistics',
  professional_services: 'Professional Services',
  it: 'IT & Software',
  ecommerce: 'E-Commerce',
  wholesale: 'Wholesale',
  finance: 'Finance',
}

// ─── Organization Size Bands (privacy-safe buckets) ───────────────────────────
export type SizeBand = 'micro' | 'small' | 'medium' | 'large' | 'enterprise'

export const SIZE_BAND_LABELS: Record<SizeBand, string> = {
  micro: 'Micro (1-9 employees)',
  small: 'Small (10-49)',
  medium: 'Medium (50-249)',
  large: 'Large (250-999)',
  enterprise: 'Enterprise (1000+)',
}

// ─── Revenue Bands (privacy-safe) ──────────────────────────────────────────────
export type RevenueBand = '0-10L' | '10L-1Cr' | '1Cr-10Cr' | '10Cr+'

// ─── Benchmark Metrics ─────────────────────────────────────────────────────────
export const BENCHMARK_METRICS = [
  'revenue',
  'profit',
  'expenseRatio',
  'payrollRatio',
  'gstCompliance',
  'collectionDays',
  'workingCapital',
  'inventoryTurnover',
  'salesGrowth',
  'customerRetention',
  'vendorRisk',
  'healthScore',
] as const
export type BenchmarkMetric = (typeof BENCHMARK_METRICS)[number]

export const BENCHMARK_METRIC_LABELS: Record<BenchmarkMetric, string> = {
  revenue: 'Revenue',
  profit: 'Profit',
  expenseRatio: 'Expense Efficiency',
  payrollRatio: 'Payroll Efficiency',
  gstCompliance: 'GST Compliance Score',
  collectionDays: 'Collection Speed',
  workingCapital: 'Working Capital',
  inventoryTurnover: 'Inventory Turnover',
  salesGrowth: 'Sales Growth',
  customerRetention: 'Customer Retention',
  vendorRisk: 'Vendor Risk',
  healthScore: 'Business Health Score',
}

// ─── Knowledge Graph Node Kinds ────────────────────────────────────────────────
export const KNOWLEDGE_NODE_KINDS = [
  'industry',
  'product',
  'region',
  'businessModel',
  'customerBehavior',
  'vendorBehavior',
  'growthPattern',
  'riskPattern',
  'compliancePattern',
] as const
export type KnowledgeNodeKind = (typeof KNOWLEDGE_NODE_KINDS)[number]

export const KNOWLEDGE_EDGE_RELATIONS = [
  'grows_with',
  'competes_with',
  'supplies_to',
  'risk_correlates',
  'compliance_correlates',
  'customer_overlaps',
  'growth_correlates',
] as const
export type KnowledgeEdgeRelation = (typeof KNOWLEDGE_EDGE_RELATIONS)[number]

// ─── Market Signal Categories ──────────────────────────────────────────────────
export const MARKET_SIGNAL_CATEGORIES = [
  'industry_trend',
  'economic_indicator',
  'inflation',
  'interest_rate',
  'gst_change',
  'tax_notification',
  'competitor',
  'hiring_demand',
  'market_opportunity',
  'supply_chain_risk',
  'commodity',
  'exchange_rate',
] as const
export type MarketSignalCategory = (typeof MARKET_SIGNAL_CATEGORIES)[number]

// ─── Prediction Types ──────────────────────────────────────────────────────────
export const PREDICTION_TYPES = [
  'revenue',
  'profit',
  'cashFlow',
  'gstLiability',
  'hiringDemand',
  'inventoryDemand',
  'collections',
  'customerChurn',
  'vendorRisk',
  'complianceRisk',
  'taxSavings',
  'growthOpportunity',
] as const
export type PredictionType = (typeof PREDICTION_TYPES)[number]

// ─── Recommendation Categories ─────────────────────────────────────────────────
export const RECOMMENDATION_CATEGORIES = [
  'tax_savings',
  'cost_reduction',
  'hiring',
  'expansion',
  'pricing',
  'collections',
  'marketing',
  'inventory',
  'automation',
  'software_adoption',
  'banking',
] as const
export type RecommendationCategory = (typeof RECOMMENDATION_CATEGORIES)[number]

// ─── Insight Feed Categories ───────────────────────────────────────────────────
export const FEED_CATEGORIES = [
  'top_risk',
  'top_opportunity',
  'industry_news',
  'gst_update',
  'market_alert',
  'competitor_trend',
  'recommended_action',
  'ai_summary',
] as const
export type FeedCategory = (typeof FEED_CATEGORIES)[number]

// ═══════════════════════════════════════════════════════════════════════════════
// CORE STRUCTURES
// ═══════════════════════════════════════════════════════════════════════════════

export interface OrgFingerprint {
  hash: string                              // irreversible SHA-256 of firmId + salt
  industry: IndustryKey
  region: string                            // anonymized region bucket
  sizeBand: SizeBand
}

export interface PercentileBreakdown {
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
  mean: number
  stddev: number
  sampleSize: number
}

export interface BenchmarkComparison {
  metric: BenchmarkMetric
  label: string
  yourValue: number | null
  percentile: number | null                  // 0-100 — "you perform better than X%"
  band: PercentileBreakdown
  verdict: 'top_quartile' | 'above_average' | 'average' | 'below_average' | 'bottom_quartile' | 'insufficient_data'
  insight: string
}

export interface IndustryBenchmarkReport {
  industry: IndustryKey
  industryLabel: string
  asOfPeriod: string
  sampleSize: number
  comparisons: BenchmarkComparison[]
  overallPercentile: number | null
  oracleNarrative: string                    // "You are performing better than 82% of similar companies."
}

export interface MarketSignal {
  id: string
  category: MarketSignalCategory
  headline: string
  summary: string
  impact: 'positive' | 'neutral' | 'negative'
  impactScore: number                        // -100 to +100
  affectedIndustries: IndustryKey[]
  affectedRegions: string[]
  source: string
  effectiveDate: string | null
  createdAt: string
}

export interface MarketIntelligenceReport {
  asOfDate: string
  signals: MarketSignal[]
  economicOutlook: 'strong' | 'stable' | 'cautious' | 'weak'
  gstOutlook: string
  industryOutlook: Record<IndustryKey, 'strong' | 'stable' | 'cautious' | 'weak'>
  opportunitiesCount: number
  risksCount: number
  oracleSummary: string
}

export interface PredictionDriver {
  name: string
  contributionPct: number                    // -100 to +100
  direction: 'positive' | 'negative' | 'neutral'
}

export interface Prediction {
  id: string
  predictionType: PredictionType
  industry: IndustryKey
  asOfDate: string
  horizonDays: number
  predictedValue: number
  confidenceLower: number
  confidenceUpper: number
  confidencePct: number
  drivers: PredictionDriver[]
  methodology: string
  twinScenarioId?: string
  narrative: string
}

export interface KnowledgeGraphNode {
  id: string
  kind: KnowledgeNodeKind
  label: string
  industry?: string
  region?: string
  weight: number
  metadata: Record<string, unknown>
}

export interface KnowledgeGraphEdge {
  id: string
  source: KnowledgeGraphNode
  target: KnowledgeGraphNode
  relation: KnowledgeEdgeRelation
  strength: number
  evidence: number
}

export interface KnowledgeGraphReport {
  asOfDate: string
  nodeCount: number
  edgeCount: number
  topNodes: KnowledgeGraphNode[]
  topEdges: KnowledgeGraphEdge[]
  industryClusters: Array<{ industry: IndustryKey; nodeCount: number; edgeCount: number }>
  oracleSummary: string
}

export interface Recommendation {
  id: string
  industry: IndustryKey
  category: RecommendationCategory
  title: string
  description: string
  rationale: string
  expectedImpact: number
  expectedImpactUnit: 'inr' | 'pct' | 'days'
  confidencePct: number
  evidence: Array<{ label: string; value: string }>
  relatedIndustries: IndustryKey[]
  status: 'active' | 'snoozed' | 'applied' | 'dismissed'
  createdAt: string
}

export interface RecommendationReport {
  asOfDate: string
  recommendations: Recommendation[]
  totalPotentialImpactInr: number
  oracleSummary: string
}

export interface IndustryAdvisorAdvice {
  sessionId: string
  industry: IndustryKey
  industryLabel: string
  question: string
  adviceSummary: string
  keyActions: string[]
  benchmarks: Partial<Record<BenchmarkMetric, { yourValue: number | null; percentile: number | null; insight: string }>>
  riskFlags: string[]
  opportunities: string[]
  confidencePct: number
  relatedSignals: MarketSignal[]
  oracleClosing: string
}

export interface InsightFeedItem {
  id: string
  feedDate: string
  category: FeedCategory
  priority: 'low' | 'normal' | 'high' | 'critical'
  headline: string
  summary: string
  impact?: 'positive' | 'neutral' | 'negative'
  affectedIndustries: IndustryKey[]
  recommendedAction?: string
  evidenceCount: number
  generatedAt: string
}

export interface InsightFeedReport {
  feedDate: string
  items: InsightFeedItem[]
  topRisks: InsightFeedItem[]
  topOpportunities: InsightFeedItem[]
  aiSummary: string
}

// ─── Global Analytics Dashboard ────────────────────────────────────────────────
export interface IndustryGrowthTrend {
  industry: IndustryKey
  industryLabel: string
  growthPct: number                          // weighted avg from contributions
  sampleSize: number
  trend: 'accelerating' | 'steady' | 'declining'
}

export interface RiskHeatmapCell {
  industry: IndustryKey
  region: string
  riskScore: number                          // 0-100
  sampleSize: number
}

export interface RegionalInsight {
  region: string
  orgCount: number
  avgHealthScore: number
  topIndustry: IndustryKey
  avgGrowthPct: number
}

export interface ComplianceTrend {
  industry: IndustryKey
  period: string
  avgComplianceScore: number
  sampleSize: number
}

export interface OpportunityIndex {
  industry: IndustryKey
  industryLabel: string
  index: number                              // 0-100
  signals: string[]
}

export interface GlobalAnalyticsDashboard {
  asOfDate: string
  // Headline numbers
  globalOrgCount: number                     // anonymized count
  globalRecordCount: number                  // total anonymized records
  industriesCovered: number
  regionsCovered: number
  // Panels
  industryBenchmarks: Array<{ industry: IndustryKey; label: string; sampleSize: number; avgHealth: number; medianGrowthPct: number }>
  growthTrends: IndustryGrowthTrend[]
  riskHeatmap: RiskHeatmapCell[]
  revenueDistribution: Array<{ band: RevenueBand; sharePct: number; orgCount: number }>
  regionalInsights: RegionalInsight[]
  hiringTrends: Array<{ industry: IndustryKey; label: string; hiringTrendPct: number; sampleSize: number }>
  complianceTrends: ComplianceTrend[]
  gstIntelligence: { avgCompliance: number; topRiskIndustries: IndustryKey[]; recentGstSignals: MarketSignal[] }
  economicOutlook: 'strong' | 'stable' | 'cautious' | 'weak'
  opportunityIndex: OpportunityIndex[]
  // Live production metric
  activePredictionCount: number
  activeRecommendationCount: number
  // Oracle closing line
  oracleNarrative: string
}

// ─── Unified Bundle (for /api/intelligence/dashboard) ─────────────────────────
export interface IntelligenceDashboardBundle {
  generatedAt: string
  orgFingerprint: OrgFingerprint | null
  // Headline stats
  globalOrgCount: number
  industriesCovered: number
  predictionsActive: number
  recommendationsActive: number
  signalsActive: number
  // Subsystem summaries
  benchmarkSummary: { comparisonsCount: number; overallPercentile: number | null; topInsight: string }
  marketSummary: { outlook: string; topSignal: string; opportunities: number; risks: number }
  predictionSummary: { topPrediction: string; confidencePct: number }
  recommendationSummary: { topRecommendation: string; potentialImpactInr: number }
  knowledgeSummary: { nodeCount: number; edgeCount: number; topCluster: string }
  feedSummary: { todayItems: number; topPriority: string }
  oracleNarrative: string
}

// ─── Analyze Request/Response (POST /api/intelligence/analyze) ────────────────
export interface AnalyzeRequest {
  question: string
  industry?: IndustryKey
  horizonDays?: number
}

export interface AnalyzeResponse {
  question: string
  intent: string
  industry: IndustryKey
  answer: string
  benchmarks: BenchmarkComparison[]
  predictions: Prediction[]
  recommendations: Recommendation[]
  relatedSignals: MarketSignal[]
  relatedKnowledge: KnowledgeGraphNode[]
  confidencePct: number
  generatedAt: string
}

// ─── Simulate Request/Response (POST /api/intelligence/simulate) ──────────────
export interface SimulateRequest {
  scenario: 'hire_employees' | 'increase_prices' | 'expand_city' | 'launch_product' | 'cut_costs' | 'switch_vendor' | 'automate_process'
  industry: IndustryKey
  magnitudePct: number                       // e.g., +10% prices
  months: number                             // simulation horizon
}

export interface SimulateResponse {
  scenario: SimulateRequest['scenario']
  industry: IndustryKey
  inputs: Record<string, number>
  outputs: {
    projectedRevenue: number
    projectedProfit: number
    projectedCashFlow: number
    projectedGstLiability: number
    projectedRiskScore: number
    projectedComplianceScore: number
  }
  industryBenchmarkImpact: {
    projectedPercentile: number
    currentPercentile: number
    deltaPct: number
  }
  verdict: 'proceed' | 'caution' | 'avoid'
  rationale: string
  generatedAt: string
}
