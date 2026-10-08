'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — GLOBAL DATA INTELLIGENCE CLOUD™ (UNIFIED ENTERPRISE DATA BRAIN)
// Every Data Point. One Enterprise Brain. Founder & Owner: Prince Singh.
// One connected enterprise dataset powering every Oracle™ + AI Executive decision.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PremiumPageLoader } from '@/components/ui/premium-loading';
import { Input } from '@/components/ui/input';
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs';
import {
  Collapsible, CollapsibleTrigger, CollapsibleContent,
} from '@/components/ui/collapsible';
import {
  Database, Network, GitBranch, Workflow, Boxes, ShieldCheck,
  Search as SearchIcon, Sparkles, BarChart3, TrendingUp, Lock,
  Activity, BrainCircuit, RefreshCw, Loader2, AlertCircle,
  CheckCircle2, ChevronRight, ChevronDown, Play, Wrench,
  HardDrive, Zap, Layers, Globe, Eye, Clock, Cpu, FileSearch,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { DataIntelligenceDashboard, DataCatalogEntry, DataLineageEvent,
  DataPipelineRun, MasterDataRecord, DataQualityIssue, DataDiscoveryInsight,
  DataAnalyticsSnapshot, PredictiveForecast, DataGovernancePolicy,
  DataObservabilityMetric, DataKnowledgeSynthesis, EnterpriseSearchHit } from '@/lib/data-intelligence/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const FOUNDER = 'Prince Singh';
const TITLE = 'Global Data Intelligence Cloud™';
const SUBTITLE = 'UNIFIED ENTERPRISE DATA BRAIN — Every Data Point. One Enterprise Brain.';
const PHASE_TAG = 'Phase 12';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inr = (n: number): string => {
  if (!Number.isFinite(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
};

const bytes = (n: number): string => {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(2)} GB`;
  if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
};

const timeAgo = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  const diff = Date.now() - t;
  if (diff < 0) return 'just now';
  const s = Math.floor(diff / 1_000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

const scoreColor = (score: number): string => {
  if (score >= 90) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (score >= 75) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-rose-700 bg-rose-50 border-rose-200';
};

const severityColor = (s: string): string => {
  switch (s) {
    case 'critical': return 'bg-rose-100 text-rose-700 border-rose-200';
    case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'low': return 'bg-sky-100 text-sky-700 border-sky-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

const statusColor = (s: string): string => {
  switch (s) {
    case 'healthy': case 'completed': case 'active': case 'acknowledged':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'warning': case 'running': case 'retrying': case 'new':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'critical': case 'failed': case 'down':
      return 'bg-rose-100 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

const sensitivityColor = (s: string): string => {
  switch (s) {
    case 'pii': case 'restricted': return 'bg-rose-100 text-rose-700 border-rose-200';
    case 'financial': case 'confidential': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'internal': return 'bg-sky-100 text-sky-700 border-sky-200';
    case 'public': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KpiProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}

function KpiCard({ icon: Icon, label, value, sub, accent = 'from-violet-500 to-fuchsia-500' }: KpiProps) {
  return (
    <Card className="relative overflow-hidden border-slate-200 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums truncate">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-slate-500 truncate">{sub}</p>}
          </div>
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow', accent)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-400">
      <Icon className="h-8 w-8" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DataIntelligenceCloudPage() {
  const [dashboard, setDashboard] = useState<DataIntelligenceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'keyword' | 'semantic' | 'hybrid'>('hybrid');
  const [searchResults, setSearchResults] = useState<EnterpriseSearchHit[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [repairing, setRepairing] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [catalogFilter, setCatalogFilter] = useState<string>('all');

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/data/dashboard');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.ok) setDashboard(data.dashboard);
      else throw new Error(data.error || 'Failed to load dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchDashboard(); }, [fetchDashboard]);

  // ─── Search handler ────────────────────────────────────────────────────────
  const runSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/data/search?q=${encodeURIComponent(searchQuery)}&mode=${searchMode}&limit=50`);
      const data = await res.json();
      if (data.ok) {
        setSearchResults(data.result?.hits ?? []);
        setSearchTotal(data.result?.totalHits ?? 0);
      }
    } catch { /* ignore */ } finally {
      setSearching(false);
    }
  }, [searchQuery, searchMode]);

  // ─── Discovery handler ─────────────────────────────────────────────────────
  const runDiscovery = useCallback(async () => {
    setDiscovering(true);
    try {
      await fetch('/api/data/discover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      await fetchDashboard();
    } finally {
      setDiscovering(false);
    }
  }, [fetchDashboard]);

  // ─── Repair handler ────────────────────────────────────────────────────────
  const repairIssue = useCallback(async (issueId: string) => {
    setRepairing(issueId);
    try {
      await fetch('/api/data/repair', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId }),
      });
      await fetchDashboard();
    } finally {
      setRepairing(null);
    }
  }, [fetchDashboard]);

  // ─── Derived data ──────────────────────────────────────────────────────────
  const filteredCatalog = useMemo(() => {
    if (!dashboard) return [];
    if (catalogFilter === 'all') return dashboard.catalog.recentEntries;
    return dashboard.catalog.recentEntries.filter((e) => e.domain === catalogFilter);
  }, [dashboard, catalogFilter]);

  const domains = useMemo(() => {
    if (!dashboard) return [];
    return Object.keys(dashboard.catalog.byDomain).sort();
  }, [dashboard]);

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading && !dashboard) {
    return <PremiumPageLoader label="Connecting enterprise data fabric…" />;
  }

  if (error && !dashboard) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-rose-600">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchDashboard}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30">
      {/* ─── Header ─── */}
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-600 text-white shadow-lg">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{TITLE}</h1>
                  <Badge variant="outline" className="border-violet-200 bg-violet-50 text-[10px] font-semibold text-violet-700">{PHASE_TAG}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{SUBTITLE}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-slate-200 bg-white text-[11px] text-slate-600">
                <span className="mr-1 text-violet-600">●</span> {dashboard.fabric.connectedModules} modules connected
              </Badge>
              <Button variant="outline" size="sm" onClick={fetchDashboard} disabled={loading}>
                <RefreshCw className={cn('mr-2 h-3.5 w-3.5', loading && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Founded, developed &amp; owned by <span className="font-semibold text-slate-600">{FOUNDER}</span> · Generated {timeAgo(dashboard.generatedAt)}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        {/* ─── KPI Strip ─── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          <KpiCard icon={Network} label="Data Fabric" value={dashboard.fabric.connectedModules} sub={`${dashboard.fabric.totalDatasets} datasets`} accent="from-violet-500 to-fuchsia-500" />
          <KpiCard icon={Database} label="Total Records" value={dashboard.fabric.totalRecords.toLocaleString('en-IN')} sub={bytes(dashboard.fabric.totalSizeBytes)} accent="from-fuchsia-500 to-pink-500" />
          <KpiCard icon={GitBranch} label="Lineage Events" value={dashboard.lineage.totalEvents.toLocaleString('en-IN')} sub={`${dashboard.lineage.replayableCount} replayable`} accent="from-pink-500 to-rose-500" />
          <KpiCard icon={Workflow} label="Pipeline Runs" value={dashboard.pipelines.totalRuns.toLocaleString('en-IN')} sub={`${dashboard.pipelines.activeRuns} active`} accent="from-amber-500 to-orange-500" />
          <KpiCard icon={Boxes} label="Master Records" value={dashboard.masterData.totalGoldenRecords.toLocaleString('en-IN')} sub={`${dashboard.masterData.duplicatesMerged} merged`} accent="from-emerald-500 to-teal-500" />
          <KpiCard icon={ShieldCheck} label="Quality Score" value={dashboard.quality.avgQualityScore} sub={`${dashboard.quality.openIssues} open issues`} accent={dashboard.quality.avgQualityScore >= 90 ? 'from-emerald-500 to-teal-500' : 'from-amber-500 to-orange-500'} />
          <KpiCard icon={SearchIcon} label="Search Index" value={dashboard.search.indexedRecords.toLocaleString('en-IN')} sub={`${Object.keys(dashboard.search.byRecordType).length} record types`} accent="from-sky-500 to-blue-500" />
          <KpiCard icon={Sparkles} label="AI Discoveries" value={dashboard.discovery.totalInsights.toLocaleString('en-IN')} sub={`${dashboard.discovery.newInsights} new · ${inr(dashboard.discovery.totalImpactINR)} impact`} accent="from-indigo-500 to-violet-500" />
          <KpiCard icon={BarChart3} label="Analytics" value={dashboard.analytics.totalSnapshots.toLocaleString('en-IN')} sub={`${Object.keys(dashboard.analytics.byType).length} analytics types`} accent="from-cyan-500 to-sky-500" />
          <KpiCard icon={TrendingUp} label="Predictions" value={dashboard.predictions.totalForecasts.toLocaleString('en-IN')} sub={`${(dashboard.predictions.avgConfidence * 100).toFixed(0)}% avg confidence`} accent="from-teal-500 to-emerald-500" />
          <KpiCard icon={Lock} label="Governance" value={dashboard.governance.totalPolicies.toLocaleString('en-IN')} sub={`${dashboard.governance.complianceFrameworks.length} frameworks · ${dashboard.governance.coveragePct}% coverage`} accent="from-slate-600 to-slate-800" />
          <KpiCard icon={Activity} label="Observability" value={`${dashboard.observability.healthScore}%`} sub={`${dashboard.observability.criticalDatasets} critical datasets`} accent={dashboard.observability.healthScore >= 80 ? 'from-emerald-500 to-teal-500' : 'from-rose-500 to-red-500'} />
        </div>

        {/* ─── Tabs ─── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <div className="overflow-x-auto">
            <TabsList className="flex h-auto w-max gap-1 bg-slate-100 p-1">
              <TabsTrigger value="overview" className="data-[state=active]:bg-white"><Network className="mr-1.5 h-3.5 w-3.5" />Overview</TabsTrigger>
              <TabsTrigger value="catalog" className="data-[state=active]:bg-white"><Database className="mr-1.5 h-3.5 w-3.5" />Catalog</TabsTrigger>
              <TabsTrigger value="lineage" className="data-[state=active]:bg-white"><GitBranch className="mr-1.5 h-3.5 w-3.5" />Lineage</TabsTrigger>
              <TabsTrigger value="pipelines" className="data-[state=active]:bg-white"><Workflow className="mr-1.5 h-3.5 w-3.5" />Pipelines</TabsTrigger>
              <TabsTrigger value="master" className="data-[state=active]:bg-white"><Boxes className="mr-1.5 h-3.5 w-3.5" />Master Data</TabsTrigger>
              <TabsTrigger value="quality" className="data-[state=active]:bg-white"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />Quality</TabsTrigger>
              <TabsTrigger value="search" className="data-[state=active]:bg-white"><SearchIcon className="mr-1.5 h-3.5 w-3.5" />Search</TabsTrigger>
              <TabsTrigger value="discovery" className="data-[state=active]:bg-white"><Sparkles className="mr-1.5 h-3.5 w-3.5" />Discovery</TabsTrigger>
              <TabsTrigger value="analytics" className="data-[state=active]:bg-white"><BarChart3 className="mr-1.5 h-3.5 w-3.5" />Analytics</TabsTrigger>
              <TabsTrigger value="predictions" className="data-[state=active]:bg-white"><TrendingUp className="mr-1.5 h-3.5 w-3.5" />Predictions</TabsTrigger>
              <TabsTrigger value="governance" className="data-[state=active]:bg-white"><Lock className="mr-1.5 h-3.5 w-3.5" />Governance</TabsTrigger>
              <TabsTrigger value="observability" className="data-[state=active]:bg-white"><Activity className="mr-1.5 h-3.5 w-3.5" />Observability</TabsTrigger>
              <TabsTrigger value="synthesis" className="data-[state=active]:bg-white"><BrainCircuit className="mr-1.5 h-3.5 w-3.5" />Synthesis</TabsTrigger>
            </TabsList>
          </div>

          {/* ─── Overview Tab ─── */}
          <TabsContent value="overview" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Fabric Connection Graph */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm"><Network className="h-4 w-4 text-violet-600" />Enterprise Data Fabric™ — Connected Modules</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {dashboard.fabric.connectionGraph.map((m) => (
                      <div key={m.module} className="rounded-lg border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-3">
                        <p className="truncate text-xs font-semibold capitalize text-slate-700">{m.module.replace(/_/g, ' ')}</p>
                        <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">{m.datasets}</p>
                        <p className="text-[10px] text-slate-500">{m.records.toLocaleString('en-IN')} records</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Catalog by Domain */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm"><Layers className="h-4 w-4 text-fuchsia-600" />Catalog by Domain</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(dashboard.catalog.byDomain).sort((a, b) => b[1] - a[1]).map(([domain, count]) => (
                    <div key={domain} className="flex items-center justify-between">
                      <span className="text-xs capitalize text-slate-600">{domain}</span>
                      <Badge variant="secondary" className="text-[10px]">{count}</Badge>
                    </div>
                  ))}
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Avg Quality</span>
                      <Badge className={cn('border', scoreColor(dashboard.catalog.avgQualityScore))}>{dashboard.catalog.avgQualityScore}/100</Badge>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span className="text-slate-500">Stale Datasets</span>
                      <Badge variant="outline" className={dashboard.catalog.staleDatasets > 0 ? 'border-amber-200 text-amber-700' : 'border-emerald-200 text-emerald-700'}>{dashboard.catalog.staleDatasets}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Synthesis preview */}
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm"><BrainCircuit className="h-4 w-4 text-indigo-600" />AI Knowledge Synthesis™ — Executive Intelligence</CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard.synthesis.recentSummaries.length === 0 ? (
                  <EmptyState icon={BrainCircuit} message="No synthesized knowledge yet." />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {dashboard.synthesis.recentSummaries.slice(0, 4).map((s) => (
                      <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-slate-800">{s.title}</p>
                          <Badge variant="outline" className="shrink-0 text-[10px] uppercase">{s.audience}</Badge>
                        </div>
                        <p className="mt-1 line-clamp-3 text-xs text-slate-600">{s.summary}</p>
                        {s.keyPoints.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {s.keyPoints.slice(0, 3).map((k, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-500">
                                <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-violet-500" />
                                <span className="line-clamp-1">{k}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Catalog Tab ─── */}
          <TabsContent value="catalog" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-sm"><Database className="h-4 w-4 text-violet-600" />Universal Data Catalog™ — {dashboard.catalog.totalDatasets} Datasets</CardTitle>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant={catalogFilter === 'all' ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setCatalogFilter('all')}>All</Button>
                    {domains.map((d) => (
                      <Button key={d} size="sm" variant={catalogFilter === d ? 'default' : 'outline'} className="h-7 text-xs capitalize" onClick={() => setCatalogFilter(d)}>{d}</Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-[600px] overflow-y-auto pr-1">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-white text-[11px] uppercase text-slate-500">
                      <tr className="border-b border-slate-200">
                        <th className="py-2 pr-2 font-semibold">Dataset</th>
                        <th className="px-2 font-semibold">Domain</th>
                        <th className="px-2 font-semibold">Source</th>
                        <th className="px-2 text-right font-semibold">Records</th>
                        <th className="px-2 font-semibold">Sensitivity</th>
                        <th className="px-2 text-right font-semibold">Quality</th>
                        <th className="pl-2 font-semibold">Freshness</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCatalog.map((e: DataCatalogEntry) => (
                        <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 pr-2">
                            <p className="font-medium text-slate-800">{e.datasetName}</p>
                            <p className="text-[10px] text-slate-400">{e.datasetKey}</p>
                          </td>
                          <td className="px-2"><Badge variant="outline" className="text-[10px] capitalize">{e.domain}</Badge></td>
                          <td className="px-2 text-xs text-slate-500">{e.sourceSystem.replace(/_/g, ' ')}</td>
                          <td className="px-2 text-right tabular-nums text-slate-700">{e.recordCount.toLocaleString('en-IN')}</td>
                          <td className="px-2"><Badge className={cn('border text-[10px]', sensitivityColor(e.sensitivity))}>{e.sensitivity}</Badge></td>
                          <td className="px-2 text-right"><Badge className={cn('border text-[10px]', scoreColor(e.qualityScore))}>{e.qualityScore}</Badge></td>
                          <td className="pl-2 text-[11px] text-slate-500">{e.freshnessLagMin > 1440 ? `${Math.floor(e.freshnessLagMin / 1440)}d lag` : e.freshnessLagMin > 60 ? `${Math.floor(e.freshnessLagMin / 60)}h lag` : `${e.freshnessLagMin}m`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Lineage Tab ─── */}
          <TabsContent value="lineage" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm"><GitBranch className="h-4 w-4 text-pink-600" />Data Lineage™ — {dashboard.lineage.totalEvents} Events · {dashboard.lineage.replayableCount} Replayable</CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard.lineage.recentEvents.length === 0 ? (
                  <EmptyState icon={GitBranch} message="No lineage events recorded yet." />
                ) : (
                  <div className="max-h-[600px] space-y-2 overflow-y-auto pr-1">
                    {dashboard.lineage.recentEvents.map((ev: DataLineageEvent) => (
                      <div key={ev.id} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] uppercase">{ev.eventType.replace(/_/g, ' ')}</Badge>
                            <Badge variant="secondary" className="text-[10px]">{ev.actorType}</Badge>
                          </div>
                          <span className="text-[11px] text-slate-400">{timeAgo(ev.occurredAt)}</span>
                        </div>
                        <p className="mt-1.5 text-sm text-slate-700">{ev.action}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">Dataset: <span className="font-mono">{ev.datasetKey}</span></p>
                        {ev.replayToken && (
                          <Button size="sm" variant="ghost" className="mt-1 h-6 text-[11px] text-violet-600" onClick={async () => {
                            const res = await fetch(`/api/data/lineage?replay=${ev.replayToken}`);
                            const d = await res.json();
                            if (d.ok) {
                              console.info('Replay snapshot:', d.replay?.snapshot ?? {});
                              toast.info('Snapshot replayed', { description: 'See browser console for full snapshot data.' });
                            }
                          }}>
                            <Play className="mr-1 h-3 w-3" /> Replay
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Pipelines Tab ─── */}
          <TabsContent value="pipelines" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-4">
              <KpiCard icon={CheckCircle2} label="Completed Today" value={dashboard.pipelines.completedToday} accent="from-emerald-500 to-teal-500" />
              <KpiCard icon={AlertCircle} label="Failed Today" value={dashboard.pipelines.failedToday} accent="from-rose-500 to-red-500" />
              <KpiCard icon={Zap} label="Records Ingested" value={dashboard.pipelines.totalRecordsIngested.toLocaleString('en-IN')} accent="from-amber-500 to-orange-500" />
              <KpiCard icon={Clock} label="Avg Latency" value={`${dashboard.pipelines.avgLatencyMs}ms`} accent="from-sky-500 to-blue-500" />
            </div>
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm"><Workflow className="h-4 w-4 text-amber-600" />Real-Time Data Pipeline™ — Recent Runs</CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard.pipelines.recentRuns.length === 0 ? (
                  <EmptyState icon={Workflow} message="No pipeline runs yet." />
                ) : (
                  <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
                    {dashboard.pipelines.recentRuns.map((r: DataPipelineRun) => (
                      <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge className={cn('border text-[10px]', statusColor(r.status))}>{r.status}</Badge>
                            <span className="text-sm font-medium text-slate-800">{r.pipelineName}</span>
                          </div>
                          <span className="text-[11px] text-slate-400">{timeAgo(r.startedAt)}</span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-slate-500">
                          <span><strong className="text-slate-700">{r.pipelineType}</strong></span>
                          <span>Source: {r.source}</span>
                          <span>In: <strong className="text-slate-700">{r.recordsIn.toLocaleString('en-IN')}</strong></span>
                          <span>Out: <strong className="text-emerald-700">{r.recordsOut.toLocaleString('en-IN')}</strong></span>
                          {r.recordsRejected > 0 && <span className="text-rose-600">Rejected: {r.recordsRejected}</span>}
                          <span>{r.latencyMs}ms</span>
                        </div>
                        {r.errorMessage && <p className="mt-1 text-[11px] text-rose-600">{r.errorMessage}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Master Data Tab ─── */}
          <TabsContent value="master" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <KpiCard icon={Boxes} label="Golden Records" value={dashboard.masterData.totalGoldenRecords} accent="from-emerald-500 to-teal-500" />
              <KpiCard icon={Layers} label="Duplicates Merged" value={dashboard.masterData.duplicatesMerged} accent="from-amber-500 to-orange-500" />
              <KpiCard icon={CheckCircle2} label="Avg Confidence" value={`${dashboard.masterData.avgConfidence.toFixed(1)}%`} accent="from-sky-500 to-blue-500" />
            </div>
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm"><Boxes className="h-4 w-4 text-emerald-600" />Master Data Management™ — Golden Records</CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard.masterData.recentRecords.length === 0 ? (
                  <EmptyState icon={Boxes} message="No master records yet." />
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {dashboard.masterData.recentRecords.map((r: MasterDataRecord) => (
                      <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className="text-[10px] capitalize">{r.entityType}</Badge>
                          <Badge className={cn('border text-[10px]', scoreColor(r.confidenceScore))}>{r.confidenceScore}%</Badge>
                        </div>
                        <p className="mt-1.5 truncate text-sm font-medium text-slate-800">{r.displayName}</p>
                        <p className="text-[11px] text-slate-400">{r.entityKey}</p>
                        {r.duplicateCount > 0 && <p className="mt-0.5 text-[10px] text-amber-600">{r.duplicateCount} duplicates merged</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Quality Tab ─── */}
          <TabsContent value="quality" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-4">
              <KpiCard icon={ShieldCheck} label="Total Issues" value={dashboard.quality.totalIssues} accent="from-violet-500 to-fuchsia-500" />
              <KpiCard icon={AlertCircle} label="Open Issues" value={dashboard.quality.openIssues} accent="from-rose-500 to-red-500" />
              <KpiCard icon={Activity} label="Quality Score" value={dashboard.quality.avgQualityScore} accent={dashboard.quality.avgQualityScore >= 90 ? 'from-emerald-500 to-teal-500' : 'from-amber-500 to-orange-500'} />
              <div className="flex items-end">
                <Button variant="outline" size="sm" onClick={async () => { await fetch('/api/data/quality?scan=true'); await fetchDashboard(); }} className="w-full">
                  <RefreshCw className="mr-2 h-3.5 w-3.5" /> Run Quality Scan
                </Button>
              </div>
            </div>
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4 text-violet-600" />Enterprise Data Quality Engine™ — Detected Issues</CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard.quality.recentIssues.length === 0 ? (
                  <EmptyState icon={CheckCircle2} message="No data quality issues detected. All clean!" />
                ) : (
                  <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
                    {dashboard.quality.recentIssues.map((issue: DataQualityIssue) => (
                      <div key={issue.id} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge className={cn('border text-[10px]', severityColor(issue.severity))}>{issue.severity}</Badge>
                            <Badge variant="outline" className="text-[10px]">{issue.category.replace(/_/g, ' ')}</Badge>
                          </div>
                          <span className="text-[11px] text-slate-400">{timeAgo(issue.detectedAt)}</span>
                        </div>
                        <p className="mt-1.5 text-sm font-medium text-slate-800">{issue.title}</p>
                        <p className="mt-0.5 text-xs text-slate-600">{issue.description}</p>
                        {issue.amount != null && issue.amount > 0 && <p className="mt-0.5 text-[11px] text-slate-500">Impact: {inr(issue.amount)}</p>}
                        {issue.suggestedFix && (
                          <div className="mt-2 flex items-center justify-between gap-2 rounded bg-slate-50 px-2 py-1">
                            <p className="text-[11px] text-slate-600"><Wrench className="mr-1 inline h-3 w-3 text-violet-500" />{issue.suggestedFix}</p>
                            <Button size="sm" variant="ghost" className="h-6 text-[11px] text-violet-600" disabled={repairing === issue.id} onClick={() => repairIssue(issue.id)}>
                              {repairing === issue.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Repair'}
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Search Tab ─── */}
          <TabsContent value="search" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm"><SearchIcon className="h-4 w-4 text-sky-600" />Enterprise Search™ — {dashboard.search.indexedRecords.toLocaleString('en-IN')} Indexed Records</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    placeholder="Search invoices, clients, employees, payments, emails, memories…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
                    className="flex-1"
                  />
                  <select value={searchMode} onChange={(e) => setSearchMode(e.target.value as typeof searchMode)} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm">
                    <option value="hybrid">Hybrid</option>
                    <option value="keyword">Keyword</option>
                    <option value="semantic">Semantic</option>
                  </select>
                  <Button onClick={runSearch} disabled={searching || !searchQuery.trim()}>
                    {searching ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <SearchIcon className="mr-2 h-3.5 w-3.5" />}
                    Search
                  </Button>
                </div>
                <div className="mt-4">
                  {searchResults.length === 0 ? (
                    <EmptyState icon={FileSearch} message={searchQuery ? 'No results. Try a different query.' : 'Search across every enterprise dataset — invoices, clients, employees, payments, emails, AI memories, graph nodes.'} />
                  ) : (
                    <>
                      <p className="mb-2 text-xs text-slate-500">{searchTotal.toLocaleString('en-IN')} results for &ldquo;{searchQuery}&rdquo;</p>
                      <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
                        {searchResults.map((hit) => (
                          <div key={hit.recordKey} className="rounded-lg border border-slate-200 bg-white p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] capitalize">{hit.recordType.replace(/_/g, ' ')}</Badge>
                                <Badge variant="secondary" className="text-[10px]">{hit.sourceSystem}</Badge>
                              </div>
                              <Badge className="border border-violet-200 bg-violet-50 text-[10px] text-violet-700">{(hit.score * 100).toFixed(0)}% match</Badge>
                            </div>
                            <p className="mt-1.5 text-sm font-medium text-slate-800">{hit.title}</p>
                            {hit.snippet && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{hit.snippet}</p>}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Discovery Tab ─── */}
          <TabsContent value="discovery" className="mt-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-slate-600">{dashboard.discovery.totalInsights} insights · {dashboard.discovery.newInsights} new · {inr(dashboard.discovery.totalImpactINR)} total impact</p>
              <Button variant="outline" size="sm" onClick={runDiscovery} disabled={discovering}>
                {discovering ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />}
                Run AI Discovery
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                {dashboard.discovery.recentInsights.length === 0 ? (
                  <EmptyState icon={Sparkles} message="No AI discoveries yet. Click 'Run AI Discovery' to scan for patterns." />
                ) : (
                  <div className="max-h-[600px] space-y-2 overflow-y-auto p-4">
                    {dashboard.discovery.recentInsights.map((ins: DataDiscoveryInsight) => (
                      <div key={ins.id} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] capitalize">{ins.discoveryType.replace(/_/g, ' ')}</Badge>
                            <Badge className={cn('border text-[10px]', ins.impactDirection === 'positive' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : ins.impactDirection === 'negative' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-700')}>{ins.impactDirection}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">{(ins.confidence * 100).toFixed(0)}% conf</Badge>
                            <span className="text-[11px] text-slate-400">{timeAgo(ins.detectedAt)}</span>
                          </div>
                        </div>
                        <p className="mt-1.5 text-sm font-medium text-slate-800">{ins.title}</p>
                        <p className="mt-0.5 text-xs text-slate-600">{ins.description}</p>
                        {ins.impactMagnitude > 0 && <p className="mt-0.5 text-[11px] font-semibold text-violet-700">Impact: {inr(ins.impactMagnitude)}</p>}
                        {ins.recommendedAction && <p className="mt-1 text-[11px] text-slate-500"><Zap className="mr-1 inline h-3 w-3 text-amber-500" />{ins.recommendedAction}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Analytics Tab ─── */}
          <TabsContent value="analytics" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm"><BarChart3 className="h-4 w-4 text-cyan-600" />Enterprise Analytics Engine™ — Latest Snapshots</CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard.analytics.latestSnapshots.length === 0 ? (
                  <EmptyState icon={BarChart3} message="No analytics computed yet." />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {dashboard.analytics.latestSnapshots.map((snap: DataAnalyticsSnapshot) => (
                      <div key={snap.id} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className="text-[10px] capitalize">{snap.analyticsType}</Badge>
                          <Badge variant="secondary" className="text-[10px]">{snap.period}</Badge>
                        </div>
                        <div className="mt-2 space-y-1">
                          {Object.entries(snap.metrics).slice(0, 5).map(([k, v]) => (
                            <div key={k} className="flex items-center justify-between text-xs">
                              <span className="text-slate-500">{k}</span>
                              <span className="font-semibold tabular-nums text-slate-800">{typeof v === 'number' && (k.includes('amount') || k.includes('total') || k.includes('revenue') || k.includes('cost') || k.includes('salary') || k.includes('value') || k.includes('profit')) ? inr(v) : v.toLocaleString('en-IN')}</span>
                            </div>
                          ))}
                        </div>
                        {snap.trendDelta !== 0 && (
                          <p className="mt-2 text-[11px]"><span className={snap.trendDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{snap.trendDelta >= 0 ? '▲' : '▼'} {Math.abs(snap.trendDelta).toFixed(1)}%</span> <span className="text-slate-400">vs prior period</span></p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Predictions Tab ─── */}
          <TabsContent value="predictions" className="mt-4">
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <KpiCard icon={TrendingUp} label="Total Forecasts" value={dashboard.predictions.totalForecasts} accent="from-teal-500 to-emerald-500" />
              <KpiCard icon={Activity} label="Avg Confidence" value={`${(dashboard.predictions.avgConfidence * 100).toFixed(0)}%`} accent="from-sky-500 to-blue-500" />
              <KpiCard icon={Clock} label="Horizons" value={Object.keys(dashboard.predictions.byHorizon).length} accent="from-violet-500 to-fuchsia-500" />
            </div>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm"><TrendingUp className="h-4 w-4 text-teal-600" />Predictive Data Engine™ — Active Forecasts</CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard.predictions.activeForecasts.length === 0 ? (
                  <EmptyState icon={TrendingUp} message="No forecasts generated yet." />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {dashboard.predictions.activeForecasts.map((f: PredictiveForecast) => (
                      <div key={f.id} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className="text-[10px] capitalize">{f.forecastType.replace(/_/g, ' ')}</Badge>
                          <Badge variant="secondary" className="text-[10px]">{f.horizon}</Badge>
                        </div>
                        <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{inr(f.predictedValue)}</p>
                        <p className="text-[11px] text-slate-500">Baseline: {inr(f.baselineValue)} · <span className={f.changePct >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{f.changePct >= 0 ? '+' : ''}{f.changePct.toFixed(1)}%</span></p>
                        <div className="mt-1.5 flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Range: {inr(f.confidenceLow)} – {inr(f.confidenceHigh)}</span>
                          <Badge className={cn('border text-[10px]', scoreColor(f.confidenceScore * 100))}>{(f.confidenceScore * 100).toFixed(0)}% conf</Badge>
                        </div>
                        {f.narrative && <p className="mt-1.5 text-[11px] text-slate-500">{f.narrative}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Governance Tab ─── */}
          <TabsContent value="governance" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <KpiCard icon={Lock} label="Total Policies" value={dashboard.governance.totalPolicies} accent="from-slate-600 to-slate-800" />
              <KpiCard icon={CheckCircle2} label="Coverage" value={`${dashboard.governance.coveragePct}%`} accent="from-emerald-500 to-teal-500" />
              <KpiCard icon={ShieldCheck} label="Frameworks" value={dashboard.governance.complianceFrameworks.length} sub={dashboard.governance.complianceFrameworks.join(', ').toUpperCase() || 'None'} accent="from-violet-500 to-fuchsia-500" />
            </div>
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm"><Lock className="h-4 w-4 text-slate-700" />Data Governance™ — Policies</CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard.governance.totalPolicies === 0 ? (
                  <EmptyState icon={Lock} message="No governance policies yet." />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {Object.entries(dashboard.governance.byType).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] uppercase">{type}</Badge>
                          <span className="text-sm capitalize text-slate-700">{type.replace(/_/g, ' ')}</span>
                        </div>
                        <Badge variant="secondary" className="text-[10px]">{count} {count === 1 ? 'policy' : 'policies'}</Badge>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="mb-2 text-xs font-semibold text-slate-600">Sensitivity Distribution</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(dashboard.governance.bySensitivity).map(([s, count]) => (
                      <Badge key={s} className={cn('border text-[10px]', sensitivityColor(s))}>{s}: {count}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Observability Tab ─── */}
          <TabsContent value="observability" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-4">
              <KpiCard icon={Activity} label="Health Score" value={`${dashboard.observability.healthScore}%`} accent={dashboard.observability.healthScore >= 80 ? 'from-emerald-500 to-teal-500' : 'from-rose-500 to-red-500'} />
              <KpiCard icon={CheckCircle2} label="Healthy" value={dashboard.observability.byStatus.healthy ?? 0} accent="from-emerald-500 to-teal-500" />
              <KpiCard icon={AlertCircle} label="Warning" value={dashboard.observability.byStatus.warning ?? 0} accent="from-amber-500 to-orange-500" />
              <KpiCard icon={AlertCircle} label="Critical" value={dashboard.observability.byStatus.critical ?? 0} accent="from-rose-500 to-red-500" />
            </div>
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm"><Activity className="h-4 w-4 text-rose-600" />Data Observability™ — Recent Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard.observability.recentMetrics.length === 0 ? (
                  <EmptyState icon={Activity} message="No observability metrics yet." />
                ) : (
                  <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
                    {dashboard.observability.recentMetrics.map((m: DataObservabilityMetric) => (
                      <div key={m.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-center gap-2">
                          <Badge className={cn('border text-[10px]', statusColor(m.status))}>{m.status}</Badge>
                          <div>
                            <p className="text-sm font-medium text-slate-800">{m.metricType.replace(/_/g, ' ')}</p>
                            <p className="text-[11px] text-slate-400">{m.datasetKey}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold tabular-nums text-slate-700">{m.metricValue.toFixed(1)} <span className="text-[10px] text-slate-400">{m.metricUnit}</span></p>
                          <p className="text-[10px] text-slate-400">{timeAgo(m.measuredAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Synthesis Tab ─── */}
          <TabsContent value="synthesis" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm"><BrainCircuit className="h-4 w-4 text-indigo-600" />AI Knowledge Synthesis™ — Executive Intelligence</CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard.synthesis.recentSummaries.length === 0 ? (
                  <EmptyState icon={BrainCircuit} message="No synthesized knowledge yet." />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {dashboard.synthesis.recentSummaries.map((s: DataKnowledgeSynthesis) => (
                      <Collapsible key={s.id}>
                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] capitalize">{s.synthesisType.replace(/_/g, ' ')}</Badge>
                              <Badge variant="secondary" className="text-[10px] uppercase">{s.audience}</Badge>
                            </div>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><ChevronDown className="h-3.5 w-3.5" /></Button>
                            </CollapsibleTrigger>
                          </div>
                          <p className="mt-1.5 text-sm font-semibold text-slate-800">{s.title}</p>
                          <p className="mt-1 text-xs text-slate-600">{s.summary}</p>
                          <CollapsibleContent>
                            <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                              {s.keyPoints.map((k, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                                  <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-violet-500" />
                                  <span>{k}</span>
                                </li>
                              ))}
                            </ul>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
