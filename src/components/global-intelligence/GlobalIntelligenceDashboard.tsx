'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT GLOBAL DATA INTELLIGENCE CLOUD™ — WORLD BUSINESS BRAIN
//
// Learn From Every Business. Empower Every Business.
//
// 11 Interconnected Subsystems:
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

import { useEffect, useState, useCallback } from 'react';
import {
  Globe, Brain, Shield, ShieldCheck, Lock, Network, TrendingUp, TrendingDown,
  Sparkles, Loader2, RefreshCw, Activity, AlertTriangle, Lightbulb, Target,
  Gauge, BarChart3, FileText, Cpu, Database,
  Zap, EyeOff, Layers, GitBranch, ChevronRight,
  Receipt, Server, type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ─── Types (mirror of src/lib/intelligence/types.ts) ──────────────────────────

interface OrgFingerprint { hash: string; industry: string; region: string; sizeBand: string }

interface BenchmarkComparison {
  metric: string; label: string; yourValue: number | null; percentile: number | null;
  band: { p10: number; p25: number; p50: number; p75: number; p90: number; mean: number; stddev: number; sampleSize: number };
  verdict: 'top_quartile' | 'above_average' | 'average' | 'below_average' | 'bottom_quartile' | 'insufficient_data';
  insight: string;
}

interface IndustryBenchmarkReport {
  industry: string; industryLabel: string; asOfPeriod: string; sampleSize: number;
  comparisons: BenchmarkComparison[]; overallPercentile: number | null; oracleNarrative: string;
}

interface MarketSignal {
  id: string; category: string; headline: string; summary: string;
  impact: 'positive' | 'neutral' | 'negative'; impactScore: number;
  affectedIndustries: string[]; affectedRegions: string[];
  source: string; effectiveDate: string | null; createdAt: string;
}

interface MarketIntelligenceReport {
  asOfDate: string; signals: MarketSignal[];
  economicOutlook: string; gstOutlook: string;
  industryOutlook: Record<string, string>;
  opportunitiesCount: number; risksCount: number; oracleSummary: string;
}

interface PredictionDriver { name: string; contributionPct: number; direction: 'positive' | 'negative' | 'neutral' }

interface Prediction {
  id: string; predictionType: string; industry: string; asOfDate: string;
  horizonDays: number; predictedValue: number;
  confidenceLower: number; confidenceUpper: number; confidencePct: number;
  drivers: PredictionDriver[]; methodology: string; narrative: string;
}

interface KnowledgeGraphNode {
  id: string; kind: string; label: string; industry?: string; region?: string; weight: number;
}

interface KnowledgeGraphEdge {
  id: string; source: KnowledgeGraphNode; target: KnowledgeGraphNode;
  relation: string; strength: number; evidence: number;
}

interface KnowledgeGraphReport {
  asOfDate: string; nodeCount: number; edgeCount: number;
  topNodes: KnowledgeGraphNode[]; topEdges: KnowledgeGraphEdge[];
  industryClusters: Array<{ industry: string; nodeCount: number; edgeCount: number }>;
  oracleSummary: string;
}

interface Recommendation {
  id: string; industry: string; category: string; title: string;
  description: string; rationale: string;
  expectedImpact: number; expectedImpactUnit: string; confidencePct: number;
  evidence: Array<{ label: string; value: string }>;
  relatedIndustries: string[]; status: string; createdAt: string;
}

interface RecommendationReport {
  asOfDate: string; recommendations: Recommendation[];
  totalPotentialImpactInr: number; oracleSummary: string;
}

interface InsightFeedItem {
  id: string; feedDate: string; category: string; priority: string;
  headline: string; summary: string; impact?: string;
  affectedIndustries: string[]; recommendedAction?: string;
  evidenceCount: number; generatedAt: string;
}

interface InsightFeedReport {
  feedDate: string; items: InsightFeedItem[];
  topRisks: InsightFeedItem[]; topOpportunities: InsightFeedItem[];
  aiSummary: string;
}

interface IntelligenceDashboardBundle {
  generatedAt: string; orgFingerprint: OrgFingerprint | null;
  globalOrgCount: number; industriesCovered: number;
  predictionsActive: number; recommendationsActive: number; signalsActive: number;
  benchmarkSummary: { comparisonsCount: number; overallPercentile: number | null; topInsight: string };
  marketSummary: { outlook: string; topSignal: string; opportunities: number; risks: number };
  predictionSummary: { topPrediction: string; confidencePct: number };
  recommendationSummary: { topRecommendation: string; potentialImpactInr: number };
  knowledgeSummary: { nodeCount: number; edgeCount: number; topCluster: string };
  feedSummary: { todayItems: number; topPriority: string };
  oracleNarrative: string;
}

interface AnalyzeResponse {
  question: string; intent: string; industry: string; answer: string;
  benchmarks: BenchmarkComparison[]; predictions: Prediction[];
  recommendations: Recommendation[]; relatedSignals: MarketSignal[];
  relatedKnowledge: KnowledgeGraphNode[];
  confidencePct: number; generatedAt: string;
}

interface SimulateResponse {
  scenario: string; industry: string;
  inputs: Record<string, number>;
  outputs: { projectedRevenue: number; projectedProfit: number; projectedCashFlow: number; projectedGstLiability: number; projectedRiskScore: number; projectedComplianceScore: number };
  industryBenchmarkImpact: { projectedPercentile: number; currentPercentile: number; deltaPct: number };
  verdict: 'proceed' | 'caution' | 'avoid';
  rationale: string; generatedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FOUNDER = 'Prince Singh'
const TAGLINE = 'Global Data Intelligence Cloud™'
const SUBTAGLINE = 'Learn From Every Business. Empower Every Business.'

const INDUSTRIES = [
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'retail', label: 'Retail' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'construction', label: 'Construction' },
  { value: 'education', label: 'Education' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'it', label: 'IT & Software' },
  { value: 'ecommerce', label: 'E-Commerce' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'finance', label: 'Finance' },
]

const VERDICT_COLORS: Record<string, string> = {
  top_quartile: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  above_average: 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30',
  average: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  below_average: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
  bottom_quartile: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  insufficient_data: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
  normal: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  low: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
}

const IMPACT_COLORS: Record<string, string> = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  neutral: 'text-slate-600 dark:text-slate-400',
  negative: 'text-red-600 dark:text-red-400',
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function GlobalIntelligenceDashboardPage() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedIndustry, setSelectedIndustry] = useState('professional_services')
  const [contribute, setContribute] = useState(true)

  const [bundle, setBundle] = useState<IntelligenceDashboardBundle | null>(null)
  const [benchmarks, setBenchmarks] = useState<IndustryBenchmarkReport | null>(null)
  const [market, setMarket] = useState<MarketIntelligenceReport | null>(null)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [recommendations, setRecommendations] = useState<RecommendationReport | null>(null)
  const [knowledge, setKnowledge] = useState<KnowledgeGraphReport | null>(null)
  const [feed, setFeed] = useState<InsightFeedReport | null>(null)

  const [analyzeQuestion, setAnalyzeQuestion] = useState('')
  const [analyzeResponse, setAnalyzeResponse] = useState<AnalyzeResponse | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  const [simScenario, setSimScenario] = useState('increase_prices')
  const [simMagnitude, setSimMagnitude] = useState(10)
  const [simMonths, setSimMonths] = useState(3)
  const [simResponse, setSimResponse] = useState<SimulateResponse | null>(null)
  const [simulating, setSimulating] = useState(false)

  const fetchAll = useCallback(async () => {
    setRefreshing(true)
    try {
      const params = new URLSearchParams({ industry: selectedIndustry, contribute: String(contribute) })
      const [bundleRes, benchRes, marketRes, predRes, recRes, knowRes, feedRes] = await Promise.all([
        fetch(`/api/intelligence/dashboard?${params}`),
        fetch(`/api/intelligence/benchmarks?${params}`),
        fetch('/api/intelligence/industry'),
        fetch(`/api/intelligence/predictions?${params}`),
        fetch(`/api/intelligence/recommendations?${params}`),
        fetch('/api/intelligence/knowledge?limit=30'),
        fetch(`/api/intelligence/insights?${params}`),
      ])

      const [bundleData, benchData, marketData, predData, recData, knowData, feedData] = await Promise.all([
        bundleRes.json(), benchRes.json(), marketRes.json(),
        predRes.json(), recRes.json(), knowRes.json(), feedRes.json(),
      ])

      setBundle(bundleData)
      setBenchmarks(benchData)
      setMarket(marketData)
      setPredictions(predData.predictions || [])
      setRecommendations(recData)
      setKnowledge(knowData)
      setFeed(feedData)
    } catch (err) {
      console.error('Intelligence fetch failed:', err)
      toast({ title: 'Failed to load intelligence', variant: 'destructive' })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedIndustry, contribute, toast])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const handleAnalyze = async () => {
    if (!analyzeQuestion.trim()) return
    setAnalyzing(true)
    try {
      const res = await fetch('/api/intelligence/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: analyzeQuestion, industry: selectedIndustry }),
      })
      const data = await res.json()
      setAnalyzeResponse(data)
    } catch (err) {
      console.error('analyze failed:', err)
      toast({ title: 'Analyze failed', variant: 'destructive' })
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSimulate = async () => {
    setSimulating(true)
    try {
      const res = await fetch('/api/intelligence/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: simScenario, industry: selectedIndustry,
          magnitudePct: simMagnitude, months: simMonths,
        }),
      })
      const data = await res.json()
      setSimResponse(data)
    } catch (err) {
      console.error('simulate failed:', err)
      toast({ title: 'Simulate failed', variant: 'destructive' })
    } finally {
      setSimulating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-500 rounded-xl blur-md opacity-60" />
                <div className="relative h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-500 flex items-center justify-center">
                  <Globe className="h-7 w-7 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
                  {TAGLINE}
                  <Badge variant="secondary" className="text-[10px]">Phase 7</Badge>
                </h1>
                <p className="text-xs text-muted-foreground">{SUBTAGLINE}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedIndustry} onValueChange={setSelectedIndustry}>
                <SelectTrigger className="w-[180px] sm:w-[220px] h-9">
                  <SelectValue placeholder="Industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind.value} value={ind.value}>{ind.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant={contribute ? 'default' : 'outline'}
                onClick={() => setContribute((c) => !c)}
                title="Toggle anonymized data contribution"
              >
                <Lock className="h-3.5 w-3.5 mr-1" />
                {contribute ? 'Contributing' : 'Private'}
              </Button>
              <Button size="sm" variant="outline" onClick={fetchAll} disabled={refreshing}>
                <RefreshCw className={cn('h-3.5 w-3.5 mr-1', refreshing && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            <span>Privacy-safe: anonymized + aggregated + differential privacy</span>
            <span className="text-muted-foreground/60">·</span>
            <span>Founded, developed & owned by <strong className="text-foreground">{FOUNDER}</strong></span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 flex-1">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1 h-auto p-1">
            <TabsTrigger value="overview" className="text-xs"><Gauge className="h-3.5 w-3.5 mr-1" />Overview</TabsTrigger>
            <TabsTrigger value="benchmarks" className="text-xs"><BarChart3 className="h-3.5 w-3.5 mr-1" />Benchmarks</TabsTrigger>
            <TabsTrigger value="predictions" className="text-xs"><TrendingUp className="h-3.5 w-3.5 mr-1" />Predictions</TabsTrigger>
            <TabsTrigger value="market" className="text-xs"><Activity className="h-3.5 w-3.5 mr-1" />Market</TabsTrigger>
            <TabsTrigger value="recommendations" className="text-xs"><Lightbulb className="h-3.5 w-3.5 mr-1" />Recs</TabsTrigger>
            <TabsTrigger value="knowledge" className="text-xs"><Network className="h-3.5 w-3.5 mr-1" />Graph</TabsTrigger>
            <TabsTrigger value="feed" className="text-xs"><FileText className="h-3.5 w-3.5 mr-1" />Feed</TabsTrigger>
            <TabsTrigger value="analyze" className="text-xs"><Brain className="h-3.5 w-3.5 mr-1" />Ask VEYRO AI</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {loading ? <OverviewSkeleton /> : (
              <>
                {bundle && (
                  <Card className="overflow-hidden border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 via-cyan-500/5 to-blue-500/5">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                          <Sparkles className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold">VEYRO AI Intelligence Cloud™</span>
                            <Badge variant="outline" className="text-[10px]">{bundle.generatedAt}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{bundle.oracleNarrative}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <KPICard icon={Layers} label="Anon. Orgs" value={bundle?.globalOrgCount ?? 0} color="emerald" />
                  <KPICard icon={Layers} label="Industries" value={bundle?.industriesCovered ?? 0} color="cyan" />
                  <KPICard icon={TrendingUp} label="Active Predictions" value={bundle?.predictionsActive ?? 0} color="blue" />
                  <KPICard icon={Lightbulb} label="Active Recs" value={bundle?.recommendationsActive ?? 0} color="amber" />
                  <KPICard icon={Activity} label="Market Signals" value={bundle?.signalsActive ?? 0} color="purple" />
                  <KPICard icon={Network} label="Graph Edges" value={bundle?.knowledgeSummary.edgeCount ?? 0} color="rose" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bundle && (
                    <SubsystemCard icon={BarChart3} title="Industry Benchmark Engine™" color="emerald"
                      main={bundle.benchmarkSummary.overallPercentile !== null ? `${bundle.benchmarkSummary.overallPercentile}%ile` : 'Pending'}
                      subtitle={bundle.benchmarkSummary.topInsight.slice(0, 100) + (bundle.benchmarkSummary.topInsight.length > 100 ? '…' : '')}
                      onClick={() => setActiveTab('benchmarks')} />
                  )}
                  {bundle && (
                    <SubsystemCard icon={Activity} title="Global Market Intelligence™" color="cyan"
                      main={bundle.marketSummary.outlook}
                      subtitle={bundle.marketSummary.topSignal.slice(0, 100)}
                      onClick={() => setActiveTab('market')} />
                  )}
                  {bundle && (
                    <SubsystemCard icon={TrendingUp} title="Predictive Intelligence™" color="blue"
                      main={`${bundle.predictionSummary.confidencePct.toFixed(0)}% conf`}
                      subtitle={bundle.predictionSummary.topPrediction.slice(0, 100)}
                      onClick={() => setActiveTab('predictions')} />
                  )}
                  {bundle && (
                    <SubsystemCard icon={Lightbulb} title="Global Recommendation Engine™" color="amber"
                      main={`+${bundle.recommendationSummary.potentialImpactInr}`}
                      subtitle={bundle.recommendationSummary.topRecommendation.slice(0, 100)}
                      onClick={() => setActiveTab('recommendations')} />
                  )}
                  {bundle && (
                    <SubsystemCard icon={Network} title="Cross-Company Knowledge Graph™" color="purple"
                      main={`${bundle.knowledgeSummary.nodeCount} nodes`}
                      subtitle={`Top cluster: ${bundle.knowledgeSummary.topCluster}`}
                      onClick={() => setActiveTab('knowledge')} />
                  )}
                  {bundle && (
                    <SubsystemCard icon={FileText} title="Enterprise Insight Feed™" color="rose"
                      main={`${bundle.feedSummary.todayItems} today`}
                      subtitle={bundle.feedSummary.topPriority.slice(0, 100)}
                      onClick={() => setActiveTab('feed')} />
                  )}
                </div>

                <Card className="border-emerald-500/30 bg-emerald-500/5">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-emerald-600" /><span className="font-medium">SHA-256 fingerprinting</span></div>
                      <div className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-emerald-600" /><span className="font-medium">Differential privacy (ε=1.0)</span></div>
                      <div className="flex items-center gap-1.5"><EyeOff className="h-3.5 w-3.5 text-emerald-600" /><span className="font-medium">Min sample size: 5</span></div>
                      <div className="flex items-center gap-1.5"><Database className="h-3.5 w-3.5 text-emerald-600" /><span className="font-medium">Aggregated only</span></div>
                      <div className="flex items-center gap-1.5"><Server className="h-3.5 w-3.5 text-emerald-600" /><span className="font-medium">Zero Trust + audit log</span></div>
                      <div className="flex items-center gap-1.5"><Cpu className="h-3.5 w-3.5 text-emerald-600" /><span className="font-medium">90s in-memory cache</span></div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Benchmarks Tab */}
          <TabsContent value="benchmarks" className="space-y-4">
            {loading ? <BenchmarkSkeleton /> : benchmarks && (
              <>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3 mb-2">
                      <Sparkles className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm">{benchmarks.oracleNarrative}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-3">
                      <span>Industry: <strong className="text-foreground">{benchmarks.industryLabel}</strong></span>
                      <span>Period: <strong className="text-foreground">{benchmarks.asOfPeriod}</strong></span>
                      <span>Sample: <strong className="text-foreground">{benchmarks.sampleSize} orgs</strong></span>
                      {benchmarks.overallPercentile !== null && (
                        <Badge variant="outline" className="text-xs">Overall: {benchmarks.overallPercentile}%ile</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {benchmarks.comparisons.length === 0 ? (
                    <Card className="md:col-span-2">
                      <CardContent className="p-8 text-center text-sm text-muted-foreground">
                        Contribute your data to unlock industry benchmark comparisons. As more firms contribute, percentiles will become available.
                      </CardContent>
                    </Card>
                  ) : benchmarks.comparisons.map((c) => (
                    <BenchmarkCard key={c.metric} comparison={c} />
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          {/* Predictions Tab */}
          <TabsContent value="predictions" className="space-y-4">
            {loading ? <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}</div> : (
              <>
                <Card className="border-blue-500/30 bg-blue-500/5">
                  <CardContent className="p-4 flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Predictions combine <strong className="text-foreground">Digital Twin™ simulations</strong> (org-scoped) with
                      <strong className="text-foreground"> industry-wide pattern analysis</strong> from anonymized contributions.
                    </p>
                  </CardContent>
                </Card>
                {predictions.length === 0 ? (
                  <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No active predictions. Contribute data to enable forecasting.</CardContent></Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {predictions.map((p) => <PredictionCard key={p.id} prediction={p} />)}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Market Tab */}
          <TabsContent value="market" className="space-y-4">
            {loading ? <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}</div> : market && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card><CardContent className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Economic Outlook</div><div className="text-xl font-bold capitalize mt-1">{market.economicOutlook}</div></CardContent></Card>
                  <Card><CardContent className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Opportunities</div><div className="text-xl font-bold text-emerald-600 mt-1">{market.opportunitiesCount}</div></CardContent></Card>
                  <Card><CardContent className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Risks</div><div className="text-xl font-bold text-red-600 mt-1">{market.risksCount}</div></CardContent></Card>
                  <Card><CardContent className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Active Signals</div><div className="text-xl font-bold mt-1">{market.signals.length}</div></CardContent></Card>
                </div>

                <Card className="border-cyan-500/30 bg-cyan-500/5">
                  <CardContent className="p-4 flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-cyan-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm">{market.oracleSummary}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" />Market Signals</CardTitle></CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-[600px] pr-3">
                      <div className="space-y-2">
                        {market.signals.map((sig) => <SignalRow key={sig.id} signal={sig} />)}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Recommendations Tab */}
          <TabsContent value="recommendations" className="space-y-4">
            {loading ? <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}</div> : recommendations && (
              <>
                <Card className="border-amber-500/30 bg-amber-500/5">
                  <CardContent className="p-4 flex items-start gap-3">
                    <Lightbulb className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm">{recommendations.oracleSummary}</p>
                  </CardContent>
                </Card>
                {recommendations.recommendations.length === 0 ? (
                  <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No active recommendations. As the contribution pool grows, Oracle will surface worldwide pattern recommendations.</CardContent></Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {recommendations.recommendations.map((r) => <RecommendationCard key={r.id} rec={r} />)}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Knowledge Graph Tab */}
          <TabsContent value="knowledge" className="space-y-4">
            {loading ? <Skeleton className="h-96" /> : knowledge && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card><CardContent className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Nodes</div><div className="text-xl font-bold mt-1">{knowledge.nodeCount}</div></CardContent></Card>
                  <Card><CardContent className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Edges</div><div className="text-xl font-bold mt-1">{knowledge.edgeCount}</div></CardContent></Card>
                  <Card><CardContent className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Clusters</div><div className="text-xl font-bold mt-1">{knowledge.industryClusters.length}</div></CardContent></Card>
                  <Card><CardContent className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Top Cluster</div><div className="text-sm font-bold mt-1 capitalize">{knowledge.industryClusters[0]?.industry.replace('_', ' ') || 'None'}</div></CardContent></Card>
                </div>

                <Card className="border-purple-500/30 bg-purple-500/5">
                  <CardContent className="p-4 flex items-start gap-3">
                    <Network className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm">{knowledge.oracleSummary}</p>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Top Nodes</CardTitle></CardHeader>
                    <CardContent>
                      <ScrollArea className="max-h-96 pr-3">
                        <div className="space-y-2">
                          {knowledge.topNodes.map((n) => (
                            <div key={n.id} className="flex items-center justify-between p-2 rounded-md bg-muted/40 hover:bg-muted/60">
                              <div className="flex items-center gap-2 min-w-0">
                                <Badge variant="outline" className="text-[10px] capitalize">{n.kind.replace(/([A-Z])/g, ' $1').trim()}</Badge>
                                <span className="text-sm truncate">{n.label}</span>
                              </div>
                              <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">w={n.weight.toFixed(1)}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Top Edges</CardTitle></CardHeader>
                    <CardContent>
                      <ScrollArea className="max-h-96 pr-3">
                        <div className="space-y-2">
                          {knowledge.topEdges.map((e) => (
                            <div key={e.id} className="p-2 rounded-md bg-muted/40 hover:bg-muted/60">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-medium truncate">{e.source.label}</span>
                                <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-[10px] text-purple-600 dark:text-purple-400 flex-shrink-0">{e.relation}</span>
                                <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="font-medium truncate">{e.target.label}</span>
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">strength={e.strength.toFixed(2)} · evidence={e.evidence}</div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* Insight Feed Tab */}
          <TabsContent value="feed" className="space-y-4">
            {loading ? <Skeleton className="h-96" /> : feed && (
              <>
                <Card className="border-rose-500/30 bg-rose-500/5">
                  <CardContent className="p-4 flex items-start gap-3">
                    <FileText className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Daily Oracle Feed — {feed.feedDate}</p>
                      <p className="text-xs text-muted-foreground mt-1">{feed.aiSummary}</p>
                    </div>
                  </CardContent>
                </Card>
                <ScrollArea className="max-h-[700px] pr-3">
                  <div className="space-y-2">
                    {feed.items.map((item) => <FeedItemRow key={item.id} item={item} />)}
                  </div>
                </ScrollArea>
              </>
            )}
          </TabsContent>

          {/* Analyze Tab */}
          <TabsContent value="analyze" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-4 w-4" /> Ask VEYRO AI
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="Ask VEYRO AI anything about your industry, benchmarks, predictions, or market signals..."
                  value={analyzeQuestion}
                  onChange={(e) => setAnalyzeQuestion(e.target.value)}
                  rows={3}
                />
                <div className="flex flex-wrap gap-2">
                  {['How am I performing vs similar firms?', 'Predict my revenue next quarter', 'What tax savings can I claim?', 'Recommend cost reductions', 'What are the top market risks?'].map((q) => (
                    <Button key={q} variant="outline" size="sm" className="text-xs h-7" onClick={() => setAnalyzeQuestion(q)}>
                      {q}
                    </Button>
                  ))}
                </div>
                <Button onClick={handleAnalyze} disabled={analyzing || !analyzeQuestion.trim()}>
                  {analyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Analyze
                </Button>
              </CardContent>
            </Card>

            {analyzeResponse && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Oracle's Answer</CardTitle>
                    <Badge variant="outline" className="text-xs">Confidence: {analyzeResponse.confidencePct}%</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm leading-relaxed">{analyzeResponse.answer}</div>
                  {analyzeResponse.benchmarks.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-2 uppercase">Relevant Benchmarks</div>
                      <div className="space-y-1.5">
                        {analyzeResponse.benchmarks.map((b) => (
                          <div key={b.metric} className="text-xs flex items-center justify-between p-2 rounded bg-muted/40">
                            <span>{b.label}</span>
                            <Badge variant="outline" className={cn('text-[10px]', VERDICT_COLORS[b.verdict])}>
                              {b.percentile !== null ? `${b.percentile}%ile` : 'N/A'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {analyzeResponse.predictions.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-2 uppercase">Relevant Predictions</div>
                      <div className="space-y-1.5">
                        {analyzeResponse.predictions.map((p) => (
                          <div key={p.id} className="text-xs p-2 rounded bg-muted/40">
                            <div className="font-medium capitalize">{p.predictionType.replace(/([A-Z])/g, ' $1').trim()} ({p.horizonDays}d)</div>
                            <div className="text-muted-foreground mt-0.5">{p.narrative}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {analyzeResponse.recommendations.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-2 uppercase">Recommended Actions</div>
                      <div className="space-y-1.5">
                        {analyzeResponse.recommendations.map((r) => (
                          <div key={r.id} className="text-xs p-2 rounded bg-muted/40">
                            <div className="font-medium">{r.title}</div>
                            <div className="text-muted-foreground mt-0.5">{r.description.slice(0, 150)}…</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Simulator */}
            <Card className="border-emerald-500/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <GitBranch className="h-4 w-4" /> Digital Twin™ Simulator
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Select value={simScenario} onValueChange={setSimScenario}>
                    <SelectTrigger><SelectValue placeholder="Scenario" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hire_employees">Hire Employees</SelectItem>
                      <SelectItem value="increase_prices">Increase Prices</SelectItem>
                      <SelectItem value="expand_city">Expand to New City</SelectItem>
                      <SelectItem value="launch_product">Launch New Product</SelectItem>
                      <SelectItem value="cut_costs">Cut Costs</SelectItem>
                      <SelectItem value="switch_vendor">Switch Vendor</SelectItem>
                      <SelectItem value="automate_process">Automate Process</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" placeholder="Magnitude %" value={simMagnitude} onChange={(e) => setSimMagnitude(Number(e.target.value))} />
                  <Input type="number" placeholder="Months" value={simMonths} onChange={(e) => setSimMonths(Number(e.target.value))} />
                </div>
                <Button onClick={handleSimulate} disabled={simulating}>
                  {simulating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                  Simulate
                </Button>
                {simResponse && (
                  <div className="p-3 rounded-md bg-muted/40 border text-sm space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={cn(
                        'text-xs capitalize',
                        simResponse.verdict === 'proceed' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
                        simResponse.verdict === 'caution' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
                        simResponse.verdict === 'avoid' && 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
                      )}>{simResponse.verdict}</Badge>
                      <span className="text-xs text-muted-foreground">Percentile: {simResponse.industryBenchmarkImpact.currentPercentile}% → {simResponse.industryBenchmarkImpact.projectedPercentile}% ({simResponse.industryBenchmarkImpact.deltaPct > 0 ? '+' : ''}{simResponse.industryBenchmarkImpact.deltaPct})</span>
                    </div>
                    <p className="text-xs leading-relaxed">{simResponse.rationale}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Globe className="h-3 w-3" />
              <span>{TAGLINE} — World Business Brain</span>
            </div>
            <div className="flex items-center gap-3">
              <span>12 Executive APIs</span>
              <span>·</span>
              <span>11 Subsystems</span>
              <span>·</span>
              <span>Zero mock values</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function KPICard({ icon: Icon, label, value, color }: { icon: LucideIcon; label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-600 bg-emerald-500/10',
    cyan: 'text-cyan-600 bg-cyan-500/10',
    blue: 'text-blue-600 bg-blue-500/10',
    amber: 'text-amber-600 bg-amber-500/10',
    purple: 'text-purple-600 bg-purple-500/10',
    rose: 'text-rose-600 bg-rose-500/10',
  }
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <div className={cn('h-7 w-7 rounded-md flex items-center justify-center', colorMap[color])}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase text-muted-foreground truncate">{label}</div>
            <div className="text-lg font-bold leading-tight">{value.toLocaleString('en-IN')}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SubsystemCard({ icon: Icon, title, color, main, subtitle, onClick }: { icon: LucideIcon; title: string; color: string; main: string; subtitle: string; onClick: () => void }) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
    cyan: 'text-cyan-600 bg-cyan-500/10 border-cyan-500/20',
    blue: 'text-blue-600 bg-blue-500/10 border-blue-500/20',
    amber: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
    purple: 'text-purple-600 bg-purple-500/10 border-purple-500/20',
    rose: 'text-rose-600 bg-rose-500/10 border-rose-500/20',
  }
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 border', colorMap[color])}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold truncate">{title}</div>
            <div className="text-base font-bold mt-0.5">{main}</div>
            <div className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{subtitle}</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </div>
      </CardContent>
    </Card>
  )
}

function BenchmarkCard({ comparison }: { comparison: BenchmarkComparison }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">{comparison.label}</span>
          <Badge variant="outline" className={cn('text-[10px] capitalize', VERDICT_COLORS[comparison.verdict])}>
            {comparison.verdict.replace('_', ' ')}
          </Badge>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-xs text-muted-foreground">Your value:</span>
          <span className="text-lg font-bold">{comparison.yourValue !== null ? comparison.yourValue.toFixed(1) : 'N/A'}</span>
          {comparison.percentile !== null && (
            <Badge variant="outline" className="text-[10px]">{comparison.percentile}%ile</Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{comparison.insight}</p>
        {comparison.percentile !== null && (
          <Progress value={comparison.percentile} className="h-1.5 mt-2" />
        )}
      </CardContent>
    </Card>
  )
}

function PredictionCard({ prediction }: { prediction: Prediction }) {
  const directionColor = prediction.predictedValue > 0 ? 'text-emerald-600' : 'text-red-600'
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] capitalize">{prediction.predictionType.replace(/([A-Z])/g, ' $1').trim()}</Badge>
            <span className="text-[10px] text-muted-foreground">{prediction.horizonDays}d horizon</span>
          </div>
          <Badge variant="outline" className="text-[10px]">{prediction.confidencePct.toFixed(0)}% conf</Badge>
        </div>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-xl font-bold">{prediction.predictedValue.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
          <span className={cn('text-xs font-medium', directionColor)}>
            95% CI: [{prediction.confidenceLower.toFixed(1)}, {prediction.confidenceUpper.toFixed(1)}]
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mb-2">{prediction.narrative}</p>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-[10px]">{prediction.methodology}</Badge>
          {prediction.drivers.slice(0, 2).map((d, i) => (
            <Badge key={i} variant="outline" className="text-[10px]">{d.name}</Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function SignalRow({ signal }: { signal: MarketSignal }) {
  const Icon = signal.impact === 'positive' ? TrendingUp : signal.impact === 'negative' ? TrendingDown : Activity
  return (
    <div className="p-3 rounded-md border bg-card hover:bg-accent/40 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={cn('h-4 w-4 flex-shrink-0', IMPACT_COLORS[signal.impact])} />
          <span className="text-sm font-medium">{signal.headline}</span>
        </div>
        <Badge variant="outline" className={cn('text-[10px] flex-shrink-0', IMPACT_COLORS[signal.impact])}>
          {signal.impactScore > 0 ? '+' : ''}{signal.impactScore.toFixed(0)}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed mb-2">{signal.summary}</p>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <Badge variant="outline" className="text-[10px] capitalize">{signal.category.replace('_', ' ')}</Badge>
        <span>·</span>
        <span>{signal.source}</span>
        {signal.effectiveDate && (<><span>·</span><span>{signal.effectiveDate}</span></>)}
      </div>
    </div>
  )
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Badge variant="outline" className="text-[10px] capitalize">{rec.category.replace('_', ' ')}</Badge>
          <Badge variant="outline" className="text-[10px]">{rec.confidencePct.toFixed(0)}% conf</Badge>
        </div>
        <div className="text-sm font-semibold mb-1">{rec.title}</div>
        <p className="text-xs text-muted-foreground leading-relaxed mb-2">{rec.description}</p>
        <div className="text-[11px] text-muted-foreground italic mb-2">{rec.rationale}</div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Expected impact:</span>
          <span className="font-semibold text-emerald-600">
            {rec.expectedImpact > 0 ? '+' : ''}{rec.expectedImpact} {rec.expectedImpactUnit}
          </span>
        </div>
        {rec.evidence.length > 0 && (
          <div className="mt-2 pt-2 border-t flex flex-wrap gap-1">
            {rec.evidence.slice(0, 3).map((e, i) => (
              <Badge key={i} variant="outline" className="text-[10px]">{e.label}: {e.value}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function FeedItemRow({ item }: { item: InsightFeedItem }) {
  const Icon = item.category === 'top_risk' ? AlertTriangle : item.category === 'top_opportunity' ? Lightbulb : item.category === 'gst_update' ? Receipt : item.category === 'recommended_action' ? Target : FileText
  return (
    <div className="p-3 rounded-md border bg-card hover:bg-accent/40 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={cn('h-4 w-4 flex-shrink-0', item.impact === 'positive' ? 'text-emerald-600' : item.impact === 'negative' ? 'text-red-600' : 'text-muted-foreground')} />
          <span className="text-sm font-medium">{item.headline}</span>
        </div>
        <Badge variant="outline" className={cn('text-[10px] flex-shrink-0 capitalize', PRIORITY_COLORS[item.priority])}>
          {item.priority}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed mb-2">{item.summary}</p>
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
        <Badge variant="outline" className="text-[10px] capitalize">{item.category.replace('_', ' ')}</Badge>
        {item.recommendedAction && (
          <><span>·</span><span className="italic">{item.recommendedAction}</span></>
        )}
        <span>·</span>
        <span>{item.evidenceCount} evidence</span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKELETONS
// ═══════════════════════════════════════════════════════════════════════════════

function OverviewSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-16" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
    </div>
  )
}

function BenchmarkSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-32" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
      </div>
    </div>
  )
}
