'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT™ GLOBAL DATA INTELLIGENCE CLOUD™ — World Business Brain Command Center
// "Learn From Every Business. Empower Every Business."
//
// 10-tab command center exposing the entire Global Data Intelligence Cloud™ backend.
// Every value is derived from REAL production data via /api/intelligence/* endpoints.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Globe2, Database, Trophy, TrendingUp, TrendingDown, Minus, Brain, Lightbulb,
  Network, Newspaper, Shield, AlertTriangle, CheckCircle2, XCircle, Sparkles,
  Loader2, RefreshCw, Play, Zap, Target, Activity, BarChart3, Factory, Store,
  HeartPulse, HardHat, GraduationCap, BedDouble, Truck, Briefcase, Cpu,
  ShoppingCart, Package, Landmark, ArrowUp, ArrowDown, Eye, Building2,
  PieChart, LineChart, Flame, TrendingUp as TrendUpIcon, Clock,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

import type {
  IntelligenceDashboard, GlobalAnalyticsDashboard, BenchmarkPercentile,
  BenchmarkSnapshot, MarketIndicator, PredictionRecord, GlobalRecommendation,
  InsightFeedItem, InsightFeedSummary, KnowledgeGraph, IndustryAdvisorReport,
  IndustryProfile, AnalysisResult, SimulationResult, FeedItemType, FeedSeverity,
  MarketSentiment, IndustryId, PredictionType, PredictionHorizon,
} from '@/lib/intelligence/types';
import {
  ALL_INDUSTRIES, INDUSTRY_LABELS, BENCHMARK_METRIC_LABELS,
  RECOMMENDATION_CATEGORY_LABELS,
} from '@/lib/intelligence/types';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmtINR = (n: number) => {
  if (!n || n === 0) return '₹0';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
};

const fmtNum = (n: number, digits = 1) =>
  n === 0 ? '0' : n.toLocaleString('en-IN', { maximumFractionDigits: digits });

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
};

const sentimentColor = (s: MarketSentiment) =>
  s === 'positive' ? 'text-emerald-600 dark:text-emerald-400' :
  s === 'negative' ? 'text-rose-600 dark:text-rose-400' :
  'text-slate-600 dark:text-slate-400';

const sentimentBg = (s: MarketSentiment) =>
  s === 'positive' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' :
  s === 'negative' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' :
  'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';

const sentimentDot = (s: MarketSentiment) =>
  s === 'positive' ? 'bg-emerald-500' :
  s === 'negative' ? 'bg-rose-500' : 'bg-slate-400';

const severityBg = (s: FeedSeverity) =>
  s === 'critical' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' :
  s === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' :
  s === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
  s === 'low' ? 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300' :
  'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';

const confidenceColor = (c: number) =>
  c >= 80 ? 'bg-emerald-500' : c >= 60 ? 'bg-amber-500' : 'bg-rose-500';

const ConfidenceBar = ({ value, max = 100 }: { value: number; max?: number }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
      <div
        className={`h-full rounded-full ${confidenceColor(value)} transition-all`}
        style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
      />
    </div>
    <span className="text-xs font-mono font-semibold tabular-nums w-10 text-right">{value}</span>
  </div>
);

const LoadingBlock = ({ label }: { label: string }) => (
  <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
    <Loader2 className="h-4 w-4 animate-spin" />
    <span className="text-sm">{label}…</span>
  </div>
);

const Sparkline = ({ points, color = 'text-emerald-500' }: { points: number[]; color?: string }) => {
  if (!points || points.length === 0) return <span className="text-xs text-muted-foreground">No data</span>;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const w = 120;
  const h = 30;
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${h - ((p - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h} className={`inline-block ${color}`}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
};

const INDUSTRY_ICONS: Record<IndustryId, typeof Factory> = {
  manufacturing: Factory, retail: Store, healthcare: HeartPulse, construction: HardHat,
  education: GraduationCap, hospitality: BedDouble, logistics: Truck,
  professional_services: Briefcase, it: Cpu, ecommerce: ShoppingCart, wholesale: Package,
  finance: Landmark, other: Building2,
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function GlobalIntelligenceCloudPage() {
  const [dashboard, setDashboard] = useState<IntelligenceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [predictOpen, setPredictOpen] = useState(false);
  const [simulateOpen, setSimulateOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/intelligence/dashboard');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDashboard(data);
    } catch (err) {
      console.error('[Intelligence Cloud] dashboard load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 60_000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  const handleSeed = async () => {
    setSeeding(true);
    const t = toast.loading('Seeding Global Data Intelligence Cloud™ from real production data…');
    try {
      const res = await fetch('/api/intelligence/seed', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      toast.success(`Cloud seeded: ${data.contributions} contributions, ${data.market} indicators, ${data.knowledge} KG nodes, ${data.industries} industries`, { id: t });
      await loadDashboard();
    } catch (err) {
      toast.error(`Seed failed: ${err instanceof Error ? err.message : 'Unknown error'}`, { id: t });
    } finally {
      setSeeding(false);
    }
  };

  const g = dashboard?.global;
  const orgPct = dashboard?.orgPercentile;
  const outlook = dashboard?.marketOutlook;
  const preds = dashboard?.predictions ?? [];
  const recs = dashboard?.recommendations ?? [];
  const feed = dashboard?.feed;
  const knowledge = dashboard?.knowledge;
  const advisor = dashboard?.industryAdvisor;
  const security = dashboard?.security;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* ─── Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Globe2 className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Global Data Intelligence Cloud™</h1>
            <p className="text-sm text-muted-foreground">Learn From Every Business. Empower Every Business.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <Database className="h-3 w-3" />
            {g?.globalMetrics.totalOrganizations ?? 0} Orgs
          </Badge>
          <Badge variant="outline" className="gap-1.5">
            <Building2 className="h-3 w-3" />
            {g?.globalMetrics.industriesCovered ?? 0} Industries
          </Badge>
          {outlook && (
            <Badge variant="outline" className="gap-1.5">
              <span className={`h-2 w-2 rounded-full ${sentimentDot(outlook.sentiment)}`} />
              <span className={`capitalize ${sentimentColor(outlook.sentiment)}`}>{outlook.sentiment}</span>
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={handleSeed} disabled={seeding}>
            {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Seed Cloud
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAnalyzeOpen(true)}>
            <Target className="h-4 w-4" /> Analyze
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPredictOpen(true)}>
            <Brain className="h-4 w-4" /> Predict
          </Button>
          <Button size="sm" onClick={() => setSimulateOpen(true)}>
            <Zap className="h-4 w-4" /> Simulate
          </Button>
        </div>
      </motion.div>

      {/* ─── KPI Row ─── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Global Organizations</span>
              <Globe2 className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{g?.globalMetrics.totalOrganizations ?? 0}</p>
            <p className="text-xs text-muted-foreground">{g?.globalMetrics.totalContributions ?? 0} contributions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Org Percentile</span>
              <Trophy className="h-4 w-4 text-amber-500" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{orgPct?.overall ?? 50}<span className="text-sm text-muted-foreground">/100</span></p>
            <div className="mt-1"><ConfidenceBar value={orgPct?.overall ?? 50} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Market Sentiment</span>
              {outlook && (outlook.sentiment === 'positive' ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : outlook.sentiment === 'negative' ? <TrendingDown className="h-4 w-4 text-rose-500" /> : <Minus className="h-4 w-4 text-slate-400" />)}
            </div>
            <p className="mt-2 text-2xl font-bold capitalize">{outlook?.sentiment ?? '—'}</p>
            <p className="text-xs text-muted-foreground truncate">{outlook?.summary?.slice(0, 50) ?? ''}…</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Predictions</span>
              <Brain className="h-4 w-4 text-teal-500" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{preds.length}</p>
            <p className="text-xs text-muted-foreground">active forecasts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Recommendations</span>
              <Lightbulb className="h-4 w-4 text-amber-500" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{recs.length}</p>
            <p className="text-xs text-muted-foreground">active actions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Knowledge Graph</span>
              <Network className="h-4 w-4 text-cyan-500" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{knowledge?.totalNodes ?? 0}</p>
            <p className="text-xs text-muted-foreground">{knowledge?.totalEdges ?? 0} edges</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Feed Today</span>
              <Newspaper className="h-4 w-4 text-orange-500" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{feed?.totalItems ?? 0}</p>
            <p className="text-xs text-muted-foreground">{feed?.unreadCount ?? 0} unread</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Avg Health Score</span>
              <Activity className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{g?.globalMetrics.avgHealthScore?.toFixed(0) ?? 0}<span className="text-sm text-muted-foreground">/100</span></p>
            <p className="text-xs text-muted-foreground">across all orgs</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Tabs ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex w-full overflow-x-auto custom-scrollbar gap-1 h-auto p-1">
          <TabsTrigger value="overview" className="gap-1.5"><Globe2 className="h-4 w-4" /><span className="hidden sm:inline">Overview</span></TabsTrigger>
          <TabsTrigger value="benchmarks" className="gap-1.5"><Trophy className="h-4 w-4" /><span className="hidden sm:inline">Benchmarks</span></TabsTrigger>
          <TabsTrigger value="market" className="gap-1.5"><TrendingUp className="h-4 w-4" /><span className="hidden sm:inline">Market</span></TabsTrigger>
          <TabsTrigger value="predictions" className="gap-1.5"><Brain className="h-4 w-4" /><span className="hidden sm:inline">Predictions</span></TabsTrigger>
          <TabsTrigger value="recommendations" className="gap-1.5"><Lightbulb className="h-4 w-4" /><span className="hidden sm:inline">Recommendations</span></TabsTrigger>
          <TabsTrigger value="knowledge" className="gap-1.5"><Network className="h-4 w-4" /><span className="hidden sm:inline">Knowledge</span></TabsTrigger>
          <TabsTrigger value="advisor" className="gap-1.5"><Briefcase className="h-4 w-4" /><span className="hidden sm:inline">Industry Advisor</span></TabsTrigger>
          <TabsTrigger value="feed" className="gap-1.5"><Newspaper className="h-4 w-4" /><span className="hidden sm:inline">Feed</span></TabsTrigger>
          <TabsTrigger value="trends" className="gap-1.5"><BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">Trends</span></TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5"><Shield className="h-4 w-4" /><span className="hidden sm:inline">Security</span></TabsTrigger>
        </TabsList>

        {loading && !dashboard ? (
          <LoadingBlock label="Loading Global Data Intelligence Cloud" />
        ) : (
          <>
            <TabsContent value="overview"><OverviewTab dashboard={dashboard} /></TabsContent>
            <TabsContent value="benchmarks"><BenchmarksTab /></TabsContent>
            <TabsContent value="market"><MarketTab /></TabsContent>
            <TabsContent value="predictions"><PredictionsTab /></TabsContent>
            <TabsContent value="recommendations"><RecommendationsTab /></TabsContent>
            <TabsContent value="knowledge"><KnowledgeTab /></TabsContent>
            <TabsContent value="advisor"><AdvisorTab /></TabsContent>
            <TabsContent value="feed"><FeedTab /></TabsContent>
            <TabsContent value="trends"><TrendsTab dashboard={dashboard} /></TabsContent>
            <TabsContent value="security"><SecurityTab /></TabsContent>
          </>
        )}
      </Tabs>

      {/* ─── Modals ─── */}
      <AnalyzeModal open={analyzeOpen} onOpenChange={setAnalyzeOpen} />
      <PredictModal open={predictOpen} onOpenChange={setPredictOpen} />
      <SimulateModal open={simulateOpen} onOpenChange={setSimulateOpen} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: WORLD BRAIN OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════

function OverviewTab({ dashboard }: { dashboard: IntelligenceDashboard | null }) {
  const g = dashboard?.global;
  if (!g) return <LoadingBlock label="Loading overview" />;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Global Metrics */}
      <Card className="lg:col-span-1">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Globe2 className="h-4 w-4 text-primary" /> Global Metrics</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            ['Organizations', g.globalMetrics.totalOrganizations, 'count'],
            ['Contributions', g.globalMetrics.totalContributions, 'count'],
            ['Industries', g.globalMetrics.industriesCovered, 'count'],
            ['Regions', g.globalMetrics.regionsCovered, 'count'],
            ['Avg Health Score', g.globalMetrics.avgHealthScore?.toFixed(0) ?? 0, '/100'],
            ['Avg Compliance', g.globalMetrics.avgComplianceScore?.toFixed(0) ?? 0, '/100'],
          ].map(([label, val, unit]) => (
            <div key={label as string} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className="font-mono font-semibold tabular-nums">{fmtNum(val as number)}<span className="text-xs text-muted-foreground ml-1">{unit}</span></span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Economic Outlook */}
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-teal-500" /> Economic Outlook</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge className={sentimentBg(g.economicOutlook.sentiment)}>{g.economicOutlook.sentiment}</Badge>
            <span className="text-sm text-muted-foreground">{g.economicOutlook.summary}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {g.economicOutlook.keyIndicators.slice(0, 6).map((ind) => (
              <div key={ind.id} className="flex items-center justify-between rounded-lg border p-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{ind.label}</p>
                  <p className="text-xs text-muted-foreground">{ind.source} · {ind.region}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold tabular-nums">{ind.value}<span className="text-xs text-muted-foreground ml-0.5">{ind.unit}</span></span>
                  <span className={`h-2 w-2 rounded-full ${sentimentDot(ind.sentiment)}`} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Opportunity Index */}
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-emerald-500" /> Opportunity Index</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
            {g.opportunityIndex.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No opportunity data yet. Seed the cloud to populate.</p>
            ) : g.opportunityIndex.map((opp) => {
              const Icon = INDUSTRY_ICONS[opp.industry] ?? Building2;
              return (
                <div key={opp.industry} className="flex items-center gap-3 rounded-lg border p-2">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{opp.label}</p>
                    <div className="flex gap-1 flex-wrap mt-0.5">
                      {opp.drivers.slice(0, 3).map((d) => (
                        <Badge key={d} variant="secondary" className="text-[10px] py-0 px-1.5">{d}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="w-20"><ConfidenceBar value={opp.score} /></div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Risk Heatmap */}
      <Card className="lg:col-span-1">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Flame className="h-4 w-4 text-rose-500" /> Risk Heatmap</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
            {g.riskHeatmap.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No risk data yet.</p>
            ) : g.riskHeatmap.slice(0, 10).map((cell, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs flex-1 truncate">{INDUSTRY_LABELS[cell.industry]} · {cell.region}</span>
                <div className="w-16"><ConfidenceBar value={cell.riskScore} /></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: INDUSTRY BENCHMARKS
// ═══════════════════════════════════════════════════════════════════════════════

function BenchmarksTab() {
  const [industry, setIndustry] = useState<IndustryId>('professional_services');
  const [region, setRegion] = useState('global');
  const [data, setData] = useState<{
    orgPercentiles: BenchmarkPercentile[];
    orgOverallPercentile: number;
    snapshots: BenchmarkSnapshot[];
    sampleSize: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (recompute = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ industry, region });
      if (recompute) params.set('recompute', '1');
      const res = await fetch(`/api/intelligence/benchmarks?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) {
      toast.error(`Benchmarks load failed: ${err instanceof Error ? err.message : 'error'}`);
    } finally {
      setLoading(false);
    }
  }, [industry, region]);

  useEffect(() => { load(false); }, [load]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Industry</Label>
            <Select value={industry} onValueChange={(v) => setIndustry(v as IndustryId)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>{ALL_INDUSTRIES.map((id) => <SelectItem key={id} value={id}>{INDUSTRY_LABELS[id]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Region</Label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['global', 'IN', 'US', 'EU', 'APAC'].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Recompute
          </Button>
        </CardContent>
      </Card>

      {loading && !data ? <LoadingBlock label="Loading benchmarks" /> : data && (
        <>
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground mb-2">Your Overall Industry Percentile</p>
              <p className="text-5xl font-bold tabular-nums">{data.orgOverallPercentile}<span className="text-2xl text-muted-foreground">/100</span></p>
              <p className="mt-2 text-sm">
                {data.orgPercentiles.length > 0
                  ? `You are performing better than ${data.orgOverallPercentile}% of similar companies.`
                  : 'No benchmark data available yet for your metrics.'}
              </p>
              <Badge variant="outline" className="mt-2">{data.sampleSize} peer samples</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Percentile Breakdown</CardTitle></CardHeader>
            <CardContent>
              {data.orgPercentiles.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No percentile data. Contribute your metrics to build the global intelligence cloud.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Metric</TableHead><TableHead>Your Value</TableHead>
                      <TableHead>Percentile</TableHead><TableHead>p50</TableHead><TableHead>p75</TableHead>
                      <TableHead>p90</TableHead><TableHead>Peers</TableHead><TableHead>Verdict</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.orgPercentiles.map((p) => (
                      <TableRow key={p.metric}>
                        <TableCell className="font-medium">{p.label}</TableCell>
                        <TableCell className="font-mono">{fmtNum(p.orgValue)}</TableCell>
                        <TableCell><div className="w-20"><ConfidenceBar value={p.percentile} /></div></TableCell>
                        <TableCell className="font-mono text-muted-foreground">{fmtNum(p.p50)}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">{fmtNum(p.p75)}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">{fmtNum(p.p90)}</TableCell>
                        <TableCell className="font-mono">{p.sampleSize}</TableCell>
                        <TableCell>
                          {p.betterThanPeers
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            : <XCircle className="h-4 w-4 text-rose-500" />}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">All Benchmark Snapshots</CardTitle></CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto custom-scrollbar">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Industry</TableHead><TableHead>Metric</TableHead><TableHead>Period</TableHead>
                      <TableHead>p25</TableHead><TableHead>p50</TableHead><TableHead>p75</TableHead><TableHead>p90</TableHead><TableHead>N</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.snapshots.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{INDUSTRY_LABELS[s.industry as IndustryId] ?? s.industry}</TableCell>
                        <TableCell className="font-medium">{BENCHMARK_METRIC_LABELS[s.metricType as keyof typeof BENCHMARK_METRIC_LABELS] ?? s.metricType}</TableCell>
                        <TableCell className="font-mono text-xs">{s.period}</TableCell>
                        <TableCell className="font-mono">{fmtNum(s.p25)}</TableCell>
                        <TableCell className="font-mono">{fmtNum(s.p50)}</TableCell>
                        <TableCell className="font-mono">{fmtNum(s.p75)}</TableCell>
                        <TableCell className="font-mono">{fmtNum(s.p90)}</TableCell>
                        <TableCell className="font-mono">{s.sampleSize}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: MARKET INTELLIGENCE
// ═══════════════════════════════════════════════════════════════════════════════

function MarketTab() {
  const [indicators, setIndicators] = useState<MarketIndicator[]>([]);
  const [outlook, setOutlook] = useState<{ sentiment: MarketSentiment; summary: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/intelligence/trends');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setIndicators(data.marketIndicators ?? []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      {loading ? <LoadingBlock label="Loading market intelligence" /> : (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={outlook ? sentimentBg(outlook.sentiment) : ''}>{outlook?.sentiment ?? 'neutral'}</Badge>
                <span className="text-sm">{outlook?.summary ?? 'Indian economic outlook loading…'}</span>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {indicators.map((ind) => (
              <Card key={ind.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground truncate">{ind.label}</span>
                    {ind.sentiment === 'positive' ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : ind.sentiment === 'negative' ? <TrendingDown className="h-4 w-4 text-rose-500" /> : <Minus className="h-4 w-4 text-slate-400" />}
                  </div>
                  <p className="text-2xl font-bold tabular-nums">{ind.value}<span className="text-sm text-muted-foreground ml-1">{ind.unit}</span></p>
                  <div className="flex items-center gap-1 mt-2">
                    <Badge variant="secondary" className="text-[10px] py-0">{ind.source}</Badge>
                    <Badge variant="outline" className="text-[10px] py-0">{ind.region}</Badge>
                    <span className="text-[10px] text-muted-foreground ml-auto">{ind.period}</span>
                  </div>
                  {ind.impactNotes && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{ind.impactNotes}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4: PREDICTIVE INTELLIGENCE
// ═══════════════════════════════════════════════════════════════════════════════

function PredictionsTab() {
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [stats, setStats] = useState<{ total: number; avgConfidence: number; byType: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [predType, setPredType] = useState<PredictionType>('revenue');
  const [horizon, setHorizon] = useState<PredictionHorizon>('90d');
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/intelligence/predictions?limit=20');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPredictions(data.predictions ?? []);
      setStats(data.stats);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    const t = toast.loading(`Generating ${predType} prediction (${horizon})…`);
    try {
      const res = await fetch('/api/intelligence/predict', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predictionType: predType, horizon }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      toast.success(`Prediction generated: ${data.prediction.target} = ${fmtNum(data.prediction.predictedValue)} (confidence ${data.prediction.confidence}%)`, { id: t });
      await load();
    } catch (err) {
      toast.error(`Prediction failed: ${err instanceof Error ? err.message : 'error'}`, { id: t });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Prediction Type</Label>
            <Select value={predType} onValueChange={(v) => setPredType(v as PredictionType)}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['revenue','profit','cash_flow','gst_liability','hiring_demand','inventory_demand','collections','customer_churn','vendor_risk','compliance_risk','tax_savings','growth_opportunity'] as PredictionType[]).map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Horizon</Label>
            <Select value={horizon} onValueChange={(v) => setHorizon(v as PredictionHorizon)}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{(['30d','90d','180d','365d'] as PredictionHorizon[]).map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />} Generate
          </Button>
          {stats && (
            <div className="ml-auto flex gap-4 text-sm">
              <span className="text-muted-foreground">Total: <span className="font-mono font-semibold">{stats.total}</span></span>
              <span className="text-muted-foreground">Avg Confidence: <span className="font-mono font-semibold">{stats.avgConfidence?.toFixed(0)}%</span></span>
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? <LoadingBlock label="Loading predictions" /> : (
        <div className="space-y-3 max-h-700 overflow-y-auto custom-scrollbar">
          {predictions.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No predictions yet. Generate one above.</CardContent></Card>
          ) : predictions.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="capitalize">{p.predictionType.replace(/_/g, ' ')}</Badge>
                      <Badge variant="outline">{p.horizon}</Badge>
                      <Badge variant="outline">{p.method.replace(/_/g, ' ')}</Badge>
                    </div>
                    <p className="font-medium">{p.target}</p>
                    <p className="text-2xl font-bold tabular-nums mt-1">{fmtNum(p.predictedValue)}</p>
                  </div>
                  <div className="w-32 shrink-0">
                    <Label className="text-xs text-muted-foreground">Confidence</Label>
                    <div className="mt-1"><ConfidenceBar value={p.confidence} /></div>
                  </div>
                </div>
                {p.factors.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Key Factors</p>
                    {p.factors.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        {f.direction === 'positive' ? <ArrowUp className="h-3 w-3 text-emerald-500" /> : f.direction === 'negative' ? <ArrowDown className="h-3 w-3 text-rose-500" /> : <Minus className="h-3 w-3 text-slate-400" />}
                        <span className="flex-1 truncate">{f.label}</span>
                        <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${f.weight * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {p.scenarioNotes && <p className="mt-2 text-xs text-muted-foreground italic">{p.scenarioNotes}</p>}
                <p className="mt-2 text-xs text-muted-foreground">{timeAgo(p.createdAt)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 5: GLOBAL RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════════════════════

function RecommendationsTab() {
  const [recs, setRecs] = useState<GlobalRecommendation[]>([]);
  const [stats, setStats] = useState<{ total: number; active: number; actedOn: number; byCategory: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/intelligence/recommendations?limit=20');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRecs(data.recommendations ?? []);
      setStats(data.stats);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStatus = async (id: string, status: 'acknowledged' | 'acted_on' | 'dismissed') => {
    const t = toast.loading(`Updating recommendation…`);
    try {
      const res = await fetch('/api/intelligence/recommendations', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(`Recommendation ${status.replace(/_/g, ' ')}`, { id: t });
      await load();
    } catch (err) {
      toast.error(`Update failed: ${err instanceof Error ? err.message : 'error'}`, { id: t });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex gap-4 text-sm">
            <span className="text-muted-foreground">Total: <span className="font-mono font-semibold">{stats?.total ?? 0}</span></span>
            <span className="text-muted-foreground">Active: <span className="font-mono font-semibold text-emerald-600">{stats?.active ?? 0}</span></span>
            <span className="text-muted-foreground">Acted On: <span className="font-mono font-semibold">{stats?.actedOn ?? 0}</span></span>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
          </Button>
        </CardContent>
      </Card>

      {loading ? <LoadingBlock label="Loading recommendations" /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {recs.length === 0 ? (
            <Card className="md:col-span-2"><CardContent className="p-8 text-center text-sm text-muted-foreground">No active recommendations. Seed the cloud to generate insights.</CardContent></Card>
          ) : recs.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Badge variant="secondary" className="mb-1">{RECOMMENDATION_CATEGORY_LABELS[r.category]}</Badge>
                    <p className="font-medium">{r.title}</p>
                  </div>
                  <div className="w-20 shrink-0"><ConfidenceBar value={r.confidence} /></div>
                </div>
                <p className="text-sm text-muted-foreground">{r.rationale}</p>
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-2 border border-emerald-200 dark:border-emerald-900">
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Expected Benefit</p>
                  <p className="text-sm">{r.expectedBenefit}</p>
                </div>
                {r.basedOn.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Based On</p>
                    {r.basedOn.slice(0, 3).map((b, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <Badge variant="outline" className="text-[10px] py-0 shrink-0">{b.type.replace(/_/g, ' ')}</Badge>
                        <span className="text-muted-foreground">{b.label}: {b.detail}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => handleStatus(r.id, 'acknowledged')}>Acknowledge</Button>
                  <Button size="sm" variant="outline" className="text-emerald-600" onClick={() => handleStatus(r.id, 'acted_on')}>Act On</Button>
                  <Button size="sm" variant="ghost" className="text-muted-foreground ml-auto" onClick={() => handleStatus(r.id, 'dismissed')}>Dismiss</Button>
                </div>
                <p className="text-xs text-muted-foreground">{timeAgo(r.createdAt)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 6: CROSS-COMPANY KNOWLEDGE GRAPH
// ═══════════════════════════════════════════════════════════════════════════════

function KnowledgeTab() {
  const [data, setData] = useState<{
    graph: KnowledgeGraph;
    topPatterns: { risks: { label: string; weight: number }[]; growth: { label: string; weight: number }[]; compliance: { label: string; weight: number }[] };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/intelligence/knowledge?limit=200');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      {loading ? <LoadingBlock label="Loading knowledge graph" /> : data && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card><CardContent className="p-4 text-center">
              <Network className="h-6 w-6 text-cyan-500 mx-auto mb-1" />
              <p className="text-2xl font-bold">{data.graph.totalNodes}</p>
              <p className="text-xs text-muted-foreground">Total Nodes</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <Sparkles className="h-6 w-6 text-teal-500 mx-auto mb-1" />
              <p className="text-2xl font-bold">{data.graph.totalEdges}</p>
              <p className="text-xs text-muted-foreground">Total Edges</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <Building2 className="h-6 w-6 text-primary mx-auto mb-1" />
              <p className="text-2xl font-bold">{data.graph.nodes.filter(n => n.nodeType === 'industry').length}</p>
              <p className="text-xs text-muted-foreground">Industries</p>
            </CardContent></Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base text-rose-500"><AlertTriangle className="h-4 w-4" /> Top Risk Patterns</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.topPatterns.risks.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs flex-1 truncate">{p.label.replace(/_/g, ' ')}</span>
                      <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div className="h-full bg-rose-500 rounded-full" style={{ width: `${p.weight * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base text-emerald-500"><TrendingUp className="h-4 w-4" /> Top Growth Patterns</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.topPatterns.growth.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs flex-1 truncate">{p.label.replace(/_/g, ' ')}</span>
                      <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${p.weight * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base text-teal-500"><Shield className="h-4 w-4" /> Top Compliance Patterns</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.topPatterns.compliance.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs flex-1 truncate">{p.label.replace(/_/g, ' ')}</span>
                      <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div className="h-full bg-teal-500 rounded-full" style={{ width: `${p.weight * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Knowledge Nodes</CardTitle></CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto custom-scrollbar">
                <Table>
                  <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Label</TableHead><TableHead>Weight</TableHead><TableHead>Industry</TableHead><TableHead>Region</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.graph.nodes.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell><Badge variant="outline" className="text-[10px]">{n.nodeType.replace(/_/g, ' ')}</Badge></TableCell>
                        <TableCell className="font-medium">{n.label.replace(/_/g, ' ')}</TableCell>
                        <TableCell className="font-mono">{n.weight.toFixed(2)}</TableCell>
                        <TableCell className="text-xs">{n.industry ? INDUSTRY_LABELS[n.industry] ?? n.industry : '—'}</TableCell>
                        <TableCell className="text-xs">{n.region ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 7: AI INDUSTRY ADVISOR
// ═══════════════════════════════════════════════════════════════════════════════

function AdvisorTab() {
  const [industry, setIndustry] = useState<IndustryId>('professional_services');
  const [report, setReport] = useState<IndustryAdvisorReport | null>(null);
  const [profiles, setProfiles] = useState<IndustryProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/intelligence/industry?industry=${industry}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setReport(data.advisorReport);
      setProfiles(data.profiles ?? []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [industry]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Industry</Label>
            <Select value={industry} onValueChange={(v) => setIndustry(v as IndustryId)}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>{ALL_INDUSTRIES.map((id) => <SelectItem key={id} value={id}>{INDUSTRY_LABELS[id]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
          </Button>
        </CardContent>
      </Card>

      {loading ? <LoadingBlock label="Loading industry advisor" /> : report && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {([
              ['Revenue Growth', `${report.profile.avgRevenueGrowth.toFixed(1)}%`, TrendingUp],
              ['Profit Margin', `${report.profile.avgProfitMargin.toFixed(1)}%`, PieChart],
              ['Compliance', `${report.profile.avgComplianceScore.toFixed(0)}/100`, Shield],
              ['Health Score', `${report.profile.avgHealthScore.toFixed(0)}/100`, Activity],
              ['Collection Days', `${report.profile.avgCollectionDays.toFixed(0)}d`, Clock],
            ] as [string, string, typeof Factory][]).map(([label, val, Icon]) => {
              const I = Icon;
              return (
                <Card key={label}>
                  <CardContent className="p-4 text-center">
                    <I className="h-5 w-5 text-primary mx-auto mb-1" />
                    <p className="text-lg font-bold tabular-nums">{val}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base text-rose-500"><AlertTriangle className="h-4 w-4" /> Top Risks</CardTitle></CardHeader>
              <CardContent>
                {report.profile.topRisks.length === 0 ? <p className="text-sm text-muted-foreground">No risk data.</p> : (
                  <div className="space-y-2">{report.profile.topRisks.map((r, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm">{r.risk}</span>
                      <Badge className={severityBg(r.severity as FeedSeverity)}>{r.severity}</Badge>
                    </div>
                  ))}</div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base text-emerald-500"><Sparkles className="h-4 w-4" /> Top Opportunities</CardTitle></CardHeader>
              <CardContent>
                {report.profile.topOpportunities.length === 0 ? <p className="text-sm text-muted-foreground">No opportunity data.</p> : (
                  <div className="space-y-2">{report.profile.topOpportunities.map((o, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm">{o.opportunity}</span>
                      <Badge variant="outline" className="capitalize">{o.potential}</Badge>
                    </div>
                  ))}</div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Lightbulb className="h-4 w-4 text-amber-500" /> AI Insights</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {report.insights.map((ins, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{ins}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-primary" /> Recommended Actions</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {report.recommendedActions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">{i + 1}</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-primary mb-1">Peer Comparison</p>
              <p className="text-sm">{report.peerComparison}</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 8: INSIGHT FEED
// ═══════════════════════════════════════════════════════════════════════════════

function FeedTab() {
  const [items, setItems] = useState<InsightFeedItem[]>([]);
  const [summary, setSummary] = useState<InsightFeedSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/intelligence/feed?limit=30');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setSummary(data.summary);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id: string) => {
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, read: true } : it));
    await fetch('/api/intelligence/feed', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {});
  };

  return (
    <div className="space-y-4">
      {summary && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-primary">AI Summary</span>
            </div>
            <p className="text-sm">{summary.aiSummary}</p>
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              <span>{summary.totalItems} items</span>
              <span>{summary.unreadCount} unread</span>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? <LoadingBlock label="Loading insight feed" /> : (
        <div className="space-y-2 max-h-700 overflow-y-auto custom-scrollbar">
          {items.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No feed items. Seed the cloud to generate daily insights.</CardContent></Card>
          ) : items.map((item) => (
            <Card key={item.id} className={item.read ? 'opacity-60' : ''}>
              <CardContent className="p-3 flex items-start gap-3">
                <div className="flex-1 min-w-0" onClick={() => !item.read && markRead(item.id)}>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="secondary" className="text-[10px] capitalize">{item.type.replace(/_/g, ' ')}</Badge>
                    <Badge className={severityBg(item.severity)}>{item.severity}</Badge>
                    <Badge variant="outline" className="text-[10px]">{item.source}</Badge>
                    {!item.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                    <span className="text-xs text-muted-foreground ml-auto">{timeAgo(item.createdAt)}</span>
                  </div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.body}</p>
                  {item.actionable && item.actionLabel && (
                    <Button size="sm" variant="link" className="h-auto p-0 mt-1 text-xs">{item.actionLabel} →</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 9: TRENDS & ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

function TrendsTab({ dashboard }: { dashboard: IntelligenceDashboard | null }) {
  const g = dashboard?.global;
  if (!g) return <LoadingBlock label="Loading trends" />;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><LineChart className="h-4 w-4 text-emerald-500" /> Growth Trends</CardTitle></CardHeader>
          <CardContent>
            {g.growthTrends.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No growth trend data yet.</p> : g.growthTrends.map((t, i) => (
              <div key={i} className="mb-3 last:mb-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{t.label}</span>
                  {t.direction === 'up' ? <ArrowUp className="h-3 w-3 text-emerald-500" /> : t.direction === 'down' ? <ArrowDown className="h-3 w-3 text-rose-500" /> : <Minus className="h-3 w-3 text-slate-400" />}
                  <Badge variant="outline" className="text-[10px] ml-auto">{t.changePercent > 0 ? '+' : ''}{t.changePercent.toFixed(1)}%</Badge>
                </div>
                <Sparkline points={t.points.map((p) => p.value)} color={t.direction === 'up' ? 'text-emerald-500' : t.direction === 'down' ? 'text-rose-500' : 'text-slate-400'} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><PieChart className="h-4 w-4 text-teal-500" /> Revenue Distribution</CardTitle></CardHeader>
          <CardContent>
            {g.revenueDistribution.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No revenue distribution data.</p> : g.revenueDistribution.map((r, i) => (
              <div key={i} className="mb-2">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>{r.label}</span>
                  <span className="font-mono text-muted-foreground">{(r.share * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full" style={{ width: `${r.share * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Globe2 className="h-4 w-4 text-cyan-500" /> Regional Insights</CardTitle></CardHeader>
          <CardContent>
            {g.regionalInsights.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No regional data.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Region</TableHead><TableHead>Orgs</TableHead><TableHead>Avg Health</TableHead><TableHead>Avg Growth</TableHead></TableRow></TableHeader>
                <TableBody>
                  {g.regionalInsights.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.region}</TableCell>
                      <TableCell className="font-mono">{r.orgCount}</TableCell>
                      <TableCell className="font-mono">{r.avgHealth.toFixed(0)}</TableCell>
                      <TableCell className="font-mono">{r.avgGrowth.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4 text-amber-500" /> GST Intelligence</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Avg Compliance Score</span>
              <span className="font-mono font-bold">{g.gstIntelligence.avgComplianceScore.toFixed(0)}/100</span>
            </div>
            {g.gstIntelligence.topGstRisks.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Top GST Risks</p>
                <div className="flex gap-1 flex-wrap">
                  {g.gstIntelligence.topGstRisks.slice(0, 6).map((r, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">{r.replace(/_/g, ' ')}</Badge>
                  ))}
                </div>
              </div>
            )}
            {g.gstIntelligence.filingTrend && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Filing Trend</p>
                <Sparkline points={g.gstIntelligence.filingTrend.points.map((p) => p.value)} color="text-amber-500" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 10: SECURITY & AUDIT
// ═══════════════════════════════════════════════════════════════════════════════

function SecurityTab() {
  const [data, setData] = useState<{ stats: { totalQueries: number; rateLimited: number; rbacEnforced: number; auditLogged: number; anonymizedContributions: number; errors: number }; recent: { id: string; endpoint: string; method: string; statusCode: number; durationMs: number; rbacRole: string | null; errorMessage: string | null; createdAt: string }[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/intelligence/audit?limit=50');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      {loading ? <LoadingBlock label="Loading security & audit" /> : data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: 'Total Queries', val: data.stats.totalQueries, icon: Activity, color: 'text-primary' },
              { label: 'Rate Limited', val: data.stats.rateLimited, icon: AlertTriangle, color: 'text-amber-500' },
              { label: 'RBAC Enforced', val: data.stats.rbacEnforced, icon: Shield, color: 'text-emerald-500' },
              { label: 'Audit Logged', val: data.stats.auditLogged, icon: CheckCircle2, color: 'text-teal-500' },
              { label: 'Anonymized Contributions', val: data.stats.anonymizedContributions, icon: Database, color: 'text-cyan-500' },
              { label: 'Errors', val: data.stats.errors, icon: XCircle, color: 'text-rose-500' },
            ].map(({ label, val, icon: Icon, color }) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <Icon className={`h-4 w-4 ${color}`} />
                  </div>
                  <p className="text-2xl font-bold tabular-nums">{val}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Audit Log</CardTitle></CardHeader>
            <CardContent>
              <div className="max-h-600 overflow-y-auto custom-scrollbar">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Endpoint</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead><TableHead>Role</TableHead><TableHead>Error</TableHead><TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recent.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-4">No audit entries yet.</TableCell></TableRow>
                    ) : data.recent.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono text-xs">{e.endpoint}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{e.method}</Badge></TableCell>
                        <TableCell>
                          <Badge className={e.statusCode >= 500 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : e.statusCode >= 400 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'}>{e.statusCode}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{e.durationMs}ms</TableCell>
                        <TableCell className="text-xs">{e.rbacRole ?? '—'}</TableCell>
                        <TableCell className="text-xs text-rose-500 truncate max-w-32">{e.errorMessage ?? '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{timeAgo(e.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════════════════════════

function AnalyzeModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [topic, setTopic] = useState('');
  const [scope, setScope] = useState<'organization' | 'industry' | 'global'>('organization');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleAnalyze = async () => {
    if (!topic.trim()) { toast.error('Enter a topic to analyze'); return; }
    setLoading(true); setResult(null);
    try {
      const res = await fetch('/api/intelligence/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, scope }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
      toast.success('Analysis complete');
    } catch (err) {
      toast.error(`Analysis failed: ${err instanceof Error ? err.message : 'error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto custom-scrollbar">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> Deep Analysis</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Topic</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Revenue and compliance health" />
          </div>
          <div className="space-y-1">
            <Label>Scope</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="organization">Organization</SelectItem>
                <SelectItem value="industry">Industry</SelectItem>
                <SelectItem value="global">Global</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAnalyze} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Analyze
          </Button>
          {result && (
            <div className="space-y-3 mt-4">
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                <p className="text-xs font-medium text-primary mb-1">Summary</p>
                <p className="text-sm">{result.summary}</p>
                <p className="text-xs text-muted-foreground mt-1">Confidence: {result.confidence}%</p>
              </div>
              {result.keyFindings.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Key Findings</p>
                  <div className="space-y-2">
                    {result.keyFindings.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg border p-2">
                        {f.tone === 'positive' ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> : f.tone === 'warning' ? <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" /> : <Minus className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{f.label}</p>
                          <p className="text-xs text-muted-foreground">{f.detail}</p>
                          <p className="text-[10px] text-muted-foreground italic mt-0.5">{f.evidence}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PredictModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [predType, setPredType] = useState<PredictionType>('revenue');
  const [horizon, setHorizon] = useState<PredictionHorizon>('90d');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionRecord | null>(null);

  const handlePredict = async () => {
    setLoading(true); setResult(null);
    try {
      const res = await fetch('/api/intelligence/predict', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predictionType: predType, horizon }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data.prediction);
      toast.success('Prediction generated');
    } catch (err) {
      toast.error(`Prediction failed: ${err instanceof Error ? err.message : 'error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-teal-500" /> New Prediction</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Prediction Type</Label>
            <Select value={predType} onValueChange={(v) => setPredType(v as PredictionType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['revenue','profit','cash_flow','gst_liability','hiring_demand','inventory_demand','collections','customer_churn','vendor_risk','compliance_risk','tax_savings','growth_opportunity'] as PredictionType[]).map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Horizon</Label>
            <Select value={horizon} onValueChange={(v) => setHorizon(v as PredictionHorizon)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(['30d','90d','180d','365d'] as PredictionHorizon[]).map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={handlePredict} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />} Generate
          </Button>
          {result && (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{result.target}</span>
                <Badge variant="outline">{result.horizon}</Badge>
              </div>
              <p className="text-3xl font-bold tabular-nums">{fmtNum(result.predictedValue)}</p>
              <ConfidenceBar value={result.confidence} />
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">{result.method.replace(/_/g, ' ')}</Badge>
              </div>
              {result.factors.length > 0 && (
                <div className="space-y-1 pt-1">
                  {result.factors.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {f.direction === 'positive' ? <ArrowUp className="h-3 w-3 text-emerald-500" /> : f.direction === 'negative' ? <ArrowDown className="h-3 w-3 text-rose-500" /> : <Minus className="h-3 w-3 text-slate-400" />}
                      <span className="flex-1 truncate">{f.label}</span>
                      <span className="font-mono">{(f.weight * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SimulateModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [scenario, setScenario] = useState('');
  const [horizon, setHorizon] = useState<PredictionHorizon>('90d');
  const [variables, setVariables] = useState('{\n  "price_increase": 10\n}');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const handleSimulate = async () => {
    if (!scenario.trim()) { toast.error('Enter a scenario'); return; }
    let vars: Record<string, number> = {};
    try { vars = JSON.parse(variables); } catch { toast.error('Invalid JSON in variables'); return; }
    setLoading(true); setResult(null);
    try {
      const res = await fetch('/api/intelligence/simulate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario, horizon, variables: vars }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data.simulation);
      toast.success('Simulation complete');
    } catch (err) {
      toast.error(`Simulation failed: ${err instanceof Error ? err.message : 'error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto custom-scrollbar">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-amber-500" /> Scenario Simulation</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Scenario</Label>
            <Input value={scenario} onChange={(e) => setScenario(e.target.value)} placeholder="e.g. 10% price increase" />
          </div>
          <div className="space-y-1">
            <Label>Horizon</Label>
            <Select value={horizon} onValueChange={(v) => setHorizon(v as PredictionHorizon)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{(['30d','90d','180d','365d'] as PredictionHorizon[]).map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Variables (JSON)</Label>
            <Textarea value={variables} onChange={(e) => setVariables(e.target.value)} rows={4} className="font-mono text-xs" />
          </div>
          <Button onClick={handleSimulate} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Simulate
          </Button>
          {result && (
            <div className="space-y-3 mt-4">
              <div className="grid gap-2 sm:grid-cols-3">
                {[result.baseCase, result.bestCase, result.worstCase].map((sc, i) => {
                  const color = i === 0 ? 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900' : i === 1 ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950' : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950';
                  return (
                    <div key={i} className={`rounded-lg border p-3 ${color}`}>
                      <p className="text-xs font-medium mb-1">{sc.label}</p>
                      <p className="text-lg font-bold tabular-nums">{fmtINR(sc.projectedRevenue)}</p>
                      <p className="text-xs text-muted-foreground">Profit: {fmtINR(sc.projectedProfit)}</p>
                      <div className="mt-1"><ConfidenceBar value={sc.probability} /></div>
                      <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{sc.notes}</p>
                    </div>
                  );
                })}
              </div>
              {result.keyDrivers.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Key Drivers</p>
                  <div className="flex gap-1 flex-wrap">
                    {result.keyDrivers.map((d, i) => <Badge key={i} variant="outline" className="text-[10px]">{d}</Badge>)}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Confidence: {result.confidence}%</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
