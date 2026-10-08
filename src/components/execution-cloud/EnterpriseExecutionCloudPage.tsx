'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — ENTERPRISE EXECUTION CLOUD™ (MISSION CONTROL)
// The world's first Enterprise Execution Cloud. One pipeline for every module.
// Think. Plan. Execute. Observe. Improve. Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs';
import {
  Collapsible, CollapsibleTrigger, CollapsibleContent,
} from '@/components/ui/collapsible';
import {
  Activity, AlertTriangle, BarChart3, Clock, Cpu, Globe, GitBranch,
  Network, Play, RotateCcw, Settings, Shield, Zap, Sparkles, RefreshCw,
  Loader2, AlertCircle, CheckCircle2, ChevronRight, ChevronDown,
  MapPin, Server, Layers, Gauge, TrendingUp, TrendingDown, Hash,
  CalendarClock, Workflow, Users, Boxes, CircleDot, Building2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  ExecutionDashboard, TimelineEntry, ExecutionModule, ExecutionStatus,
  ExecutionPriority, WorkerType, WorkerStatus, QueueSummary,
  AlertType, AlertSeverity, TaskEdgeRelation,
} from '@/lib/execution-cloud/types';
import { MODULE_META } from '@/lib/execution-cloud/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const FOUNDER = 'Prince Singh';
const TITLE = 'Enterprise Execution Cloud™';
const SUBTITLE = 'MISSION CONTROL — Think. Plan. Execute. Observe. Improve.';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inr = (n: number): string => {
  if (!Number.isFinite(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
};

const fmtMs = (ms: number): string => {
  if (!Number.isFinite(ms) || ms <= 0) return '0ms';
  if (ms < 1_000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
};

const fmtPct = (n: number, decimals = 1): string => `${n.toFixed(decimals)}%`;

const timeAgo = (iso: string | null): string => {
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

const fmtTime = (iso: string | null): string => {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  return new Date(t).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
};

// ─── Status badge colours ────────────────────────────────────────────────────

const STATUS_STYLES: Record<ExecutionStatus, string> = {
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  running: 'bg-cyan-100 text-cyan-700 border-cyan-200 animate-pulse',
  queued: 'bg-slate-100 text-slate-700 border-slate-200',
  failed: 'bg-rose-100 text-rose-700 border-rose-200',
  awaiting_approval: 'bg-amber-100 text-amber-700 border-amber-200',
  cancelled: 'bg-zinc-100 text-zinc-700 border-zinc-200',
};

function StatusBadge({ status }: { status: ExecutionStatus }) {
  return (
    <Badge variant="outline" className={cn('text-[10px] font-medium border', STATUS_STYLES[status])}>
      {status.replace('_', ' ')}
    </Badge>
  );
}

function ModuleBadge({ module }: { module: ExecutionModule }) {
  const meta = MODULE_META[module];
  if (!meta) return <Badge variant="outline" className="text-[10px]">{module}</Badge>;
  return (
    <Badge variant="outline" className={cn('text-[10px] font-medium', meta.color, 'border-current/20 bg-current/5')}>
      <span className="mr-1">{meta.icon}</span>{meta.label}
    </Badge>
  );
}

const PRIORITY_STYLES: Record<ExecutionPriority, string> = {
  critical: 'text-rose-700 bg-rose-50 border-rose-200',
  high: 'text-amber-700 bg-amber-50 border-amber-200',
  normal: 'text-slate-700 bg-slate-50 border-slate-200',
  low: 'text-zinc-600 bg-zinc-50 border-zinc-200',
  deferred: 'text-violet-700 bg-violet-50 border-violet-200',
};

function PriorityBadge({ priority }: { priority: ExecutionPriority }) {
  return (
    <Badge variant="outline" className={cn('text-[9px] uppercase tracking-wide', PRIORITY_STYLES[priority])}>
      {priority}
    </Badge>
  );
}

const SEVERITY_STYLES: Record<AlertSeverity, string> = {
  critical: 'bg-rose-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-amber-500 text-white',
  low: 'bg-slate-400 text-white',
};

const WORKER_STATUS_STYLES: Record<WorkerStatus, string> = {
  idle: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  busy: 'bg-cyan-100 text-cyan-700 border-cyan-200 animate-pulse',
  offline: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  draining: 'bg-amber-100 text-amber-700 border-amber-200',
};

const HEALTH_STYLES: Record<string, { label: string; classes: string }> = {
  healthy: { label: 'Healthy', classes: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  degraded: { label: 'Degraded', classes: 'bg-amber-100 text-amber-700 border-amber-200' },
  critical: { label: 'Critical', classes: 'bg-rose-100 text-rose-700 border-rose-200 animate-pulse' },
};

// ─── KPI Card (matches GlobalEnterpriseDashboard aesthetic) ──────────────────

type KpiColor = 'violet' | 'fuchsia' | 'emerald' | 'amber' | 'orange' | 'cyan' | 'rose' | 'slate' | 'purple' | 'teal';

const KPI_COLORS: Record<KpiColor, string> = {
  violet: 'from-violet-500 to-violet-600',
  fuchsia: 'from-fuchsia-500 to-fuchsia-600',
  emerald: 'from-emerald-500 to-emerald-600',
  amber: 'from-amber-500 to-amber-600',
  orange: 'from-orange-500 to-orange-600',
  cyan: 'from-cyan-500 to-cyan-600',
  rose: 'from-rose-500 to-rose-600',
  slate: 'from-slate-500 to-slate-600',
  purple: 'from-purple-500 to-purple-600',
  teal: 'from-teal-500 to-teal-600',
};

function KPICard({
  icon: Icon, label, value, sub, color = 'violet',
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  color?: KpiColor;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className={cn('h-9 w-9 rounded-lg bg-gradient-to-br flex items-center justify-center', KPI_COLORS[color])}>
            <Icon className="h-4 w-4 text-white" />
          </div>
          {sub && <span className="text-[10px] text-muted-foreground truncate max-w-[60%] text-right">{sub}</span>}
        </div>
        <div className="text-xl font-bold tracking-tight">{value}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{label}</div>
      </CardContent>
    </Card>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin mb-3 text-violet-500" />
      <p className="text-sm">{label}…</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <AlertCircle className="h-8 w-8 mb-3 text-rose-500" />
      <p className="text-sm text-rose-600 mb-3 max-w-md text-center">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Retry
        </Button>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-12 flex flex-col items-center text-center">
        <div className="h-12 w-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mb-3">
          <Icon className="h-6 w-6 text-violet-600" />
        </div>
        <h3 className="text-sm font-semibold mb-1">{title}</h3>
        <p className="text-xs text-muted-foreground max-w-md">{description}</p>
      </CardContent>
    </Card>
  );
}

function ScrollContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('max-h-96 overflow-y-auto pr-1 -mr-1', className)}>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function EnterpriseExecutionCloudPage() {
  const [data, setData] = useState<ExecutionDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const load = useCallback(async () => {
    setRefreshing(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/execution/dashboard');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Failed to load');
      setData(json.data as ExecutionDashboard);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 15s
  useEffect(() => {
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  // ─── Render helpers ──────────────────────────────────────────────────────

  const systemHealth = data?.liveMap?.systemHealth ?? 'healthy';
  const healthMeta = HEALTH_STYLES[systemHealth] ?? HEALTH_STYLES.healthy;
  const totalJobs = data?.totals?.totalJobs ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex flex-col">
      {/* ═══════ Header (sticky) ═══════ */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-500 rounded-xl blur-md opacity-60" />
                <div className="relative h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-500 flex items-center justify-center">
                  <Network className="h-7 w-7 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
                  {TITLE}
                  <Badge variant="secondary" className="text-[10px]">Phase 10</Badge>
                </h1>
                <p className="text-xs text-muted-foreground">{SUBTITLE}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn('text-[10px] font-semibold border', healthMeta.classes)}
              >
                <CircleDot className="h-3 w-3 mr-1" />
                {healthMeta.label}
              </Badge>
              <Button size="sm" variant="outline" onClick={load} disabled={refreshing}>
                <RefreshCw className={cn('h-3.5 w-3.5 mr-1', refreshing && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <Shield className="h-3 w-3 text-violet-500" />
            <span>RBAC · Audit logging · Approval workflows · Rate limiting · SHA-256 actor signing</span>
            <span className="text-muted-foreground/60">·</span>
            <span>22 modules · 14 subsystems · 1 unified pipeline</span>
            <span className="text-muted-foreground/60">·</span>
            <span>Founded, developed & owned by <strong className="text-foreground">{FOUNDER}</strong></span>
          </div>
        </div>
      </header>

      {/* ═══════ Main Content ═══════ */}
      <main className="container mx-auto px-4 py-6 flex-1">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1 h-auto p-1">
            <TabsTrigger value="overview" className="text-xs"><Gauge className="h-3.5 w-3.5 mr-1" />Overview</TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs"><Clock className="h-3.5 w-3.5 mr-1" />Timeline</TabsTrigger>
            <TabsTrigger value="taskgraph" className="text-xs"><GitBranch className="h-3.5 w-3.5 mr-1" />Task Graph</TabsTrigger>
            <TabsTrigger value="queues" className="text-xs"><Server className="h-3.5 w-3.5 mr-1" />Queues & Workers</TabsTrigger>
            <TabsTrigger value="observe" className="text-xs"><Activity className="h-3.5 w-3.5 mr-1" />Observability</TabsTrigger>
            <TabsTrigger value="map" className="text-xs"><Globe className="h-3.5 w-3.5 mr-1" />Map & Analytics</TabsTrigger>
          </TabsList>

          {/* ═══════ 1. OVERVIEW ═══════ */}
          <TabsContent value="overview" className="space-y-6">
            {loading && !data ? <LoadingState label="Loading Mission Control dashboard" />
              : error ? <ErrorState message={error} onRetry={load} />
              : !data ? <ErrorState message="No dashboard payload returned" onRetry={load} />
              : totalJobs === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  title="Enterprise Execution Cloud is in setup phase"
                  description="The unified pipeline has no jobs yet. As your 22 modules emit actions — AI Executive briefs, autonomous runs, GSTR filings, dev builds, automations, payments — they will materialise here as ExecutionJobs. VEYRO AI narrative will then read the real stream."
                />
              ) : (
                <motion.div
                  className="space-y-6"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {/* Oracle narrative banner */}
                  <Card className="overflow-hidden border-violet-500/30 bg-gradient-to-br from-violet-500/5 via-fuchsia-500/5 to-amber-500/5">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-500 flex items-center justify-center flex-shrink-0">
                          <Sparkles className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold">Execution Oracle™</span>
                            <Badge variant="outline" className="text-[10px]">
                              <Clock className="h-2.5 w-2.5 mr-1" />
                              {timeAgo(data.updatedAt)}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">{data.totals.totalJobs.toLocaleString('en-IN')} jobs</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{data.oracleNarrative}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* KPI Row 1 — Pipeline health */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <KPICard icon={Boxes} label="Total Jobs" value={data.totals.totalJobs.toLocaleString('en-IN')} color="violet" />
                    <KPICard icon={Play} label="Running" value={data.totals.running} sub="live" color="cyan" />
                    <KPICard icon={CheckCircle2} label="Completed" value={data.totals.completed.toLocaleString('en-IN')} color="emerald" />
                    <KPICard icon={AlertTriangle} label="Failed" value={data.totals.failed} color="rose" />
                    <KPICard icon={TrendingUp} label="Success Rate" value={fmtPct(data.analytics.successRate)} color="teal" />
                    <KPICard icon={Clock} label="Avg Duration" value={fmtMs(data.analytics.avgDurationMs)} color="amber" />
                  </div>

                  {/* KPI Row 2 — Scale & cost */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <KPICard icon={Layers} label="Queue Size" value={data.observability.queueSize} sub="queued" color="slate" />
                    <KPICard icon={Server} label="Workers Online" value={`${data.workers.active}/${data.workers.total}`} sub={`${fmtPct(data.workers.avgUtilizationPct, 0)} util`} color="purple" />
                    <KPICard icon={AlertCircle} label="Open Alerts" value={data.alerts.open} sub={`${data.alerts.critical} critical`} color="orange" />
                    <KPICard icon={Zap} label="Throughput/min" value={data.analytics.throughput.perMin.toFixed(1)} color="fuchsia" />
                    <KPICard icon={Cpu} label="AI Cost" value={inr(data.analytics.aiCost)} sub="period" color="amber" />
                    <KPICard icon={TrendingUp} label="ROI" value={fmtPct(data.analytics.roi)} color="emerald" />
                  </div>

                  {/* byModule + byPriority + byStatus */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* byModule bar list */}
                    <Card className="lg:col-span-2">
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2"><Boxes className="h-4 w-4" />Jobs by Module</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {data.byModule.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-8 text-center">No module activity yet.</p>
                        ) : (
                          <ScrollContainer>
                            <div className="space-y-2">
                              {(() => {
                                const max = Math.max(...data.byModule.map((m) => m.jobs), 1);
                                return data.byModule
                                  .slice()
                                  .sort((a, b) => b.jobs - a.jobs)
                                  .map((m) => {
                                    const meta = MODULE_META[m.module];
                                    const pct = (m.jobs / max) * 100;
                                    return (
                                      <div key={m.module} className="space-y-1">
                                        <div className="flex items-center justify-between text-xs">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <span>{meta?.icon}</span>
                                            <span className="font-medium truncate">{m.label}</span>
                                            <Badge variant="outline" className={cn('text-[9px]', meta?.color)}>{fmtPct(m.successRate, 0)}</Badge>
                                          </div>
                                          <span className="text-muted-foreground tabular-nums">{m.jobs.toLocaleString('en-IN')} · {fmtMs(m.avgDurationMs)}</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                          <motion.div
                                            className={cn('h-full rounded-full', meta?.accent ?? 'bg-violet-500')}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${pct}%` }}
                                            transition={{ duration: 0.4 }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  });
                              })()}
                            </div>
                          </ScrollContainer>
                        )}
                      </CardContent>
                    </Card>

                    {/* byPriority */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2"><Hash className="h-4 w-4" />Priority Distribution</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {(Object.entries(data.byPriority) as [ExecutionPriority, number][])
                            .sort((a, b) => ['critical', 'high', 'normal', 'low', 'deferred'].indexOf(a[0]) - ['critical', 'high', 'normal', 'low', 'deferred'].indexOf(b[0]))
                            .map(([p, n]) => (
                              <div key={p} className="flex items-center justify-between text-xs">
                                <PriorityBadge priority={p} />
                                <span className="tabular-nums font-medium">{n.toLocaleString('en-IN')}</span>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* byStatus donut-ish breakdown */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" />Status Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {(Object.entries(data.byStatus) as [ExecutionStatus, number][]).map(([s, n]) => {
                          const total = data.totals.totalJobs || 1;
                          const pct = (n / total) * 100;
                          return (
                            <div key={s} className="p-3 rounded-lg border bg-card space-y-2">
                              <div className="flex items-center justify-between">
                                <StatusBadge status={s} />
                                <span className="text-xs font-bold tabular-nums">{n.toLocaleString('en-IN')}</span>
                              </div>
                              <Progress value={pct} className="h-1.5" />
                              <div className="text-[10px] text-muted-foreground">{fmtPct(pct, 1)} of pipeline</div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
          </TabsContent>

          {/* ═══════ 2. TIMELINE ═══════ */}
          <TabsContent value="timeline" className="space-y-6">
            {loading && !data ? <LoadingState label="Loading execution timeline" />
              : error ? <ErrorState message={error} onRetry={load} />
              : !data ? <ErrorState message="No timeline data" onRetry={load} />
              : data.timeline.entries.length === 0 ? (
                <EmptyState
                  icon={Clock}
                  title="No timeline events yet"
                  description="The Execution Timeline™ materialises every job state change across all 22 modules. Once jobs start flowing through the pipeline, you will see a live, filterable chronological feed here."
                />
              ) : (
                <TimelinePanel data={data} />
              )}
          </TabsContent>

          {/* ═══════ 3. TASK GRAPH ═══════ */}
          <TabsContent value="taskgraph" className="space-y-6">
            {loading && !data ? <LoadingState label="Loading task graph" />
              : error ? <ErrorState message={error} onRetry={load} />
              : !data ? <ErrorState message="No task graph data" onRetry={load} />
              : data.taskGraph.nodes === 0 ? (
                <EmptyState
                  icon={GitBranch}
                  title="Task graph has no edges yet"
                  description="The Enterprise Task Graph™ links jobs via relations like lead_to, proposal_to, payment_to, oracle_to. As modules chain actions — a lead converting through proposal → invoice → payment → GST → accounting — edges will materialise here."
                />
              ) : (
                <TaskGraphPanel data={data} />
              )}
          </TabsContent>

          {/* ═══════ 4. QUEUES & WORKERS ═══════ */}
          <TabsContent value="queues" className="space-y-6">
            {loading && !data ? <LoadingState label="Loading queues & workers" />
              : error ? <ErrorState message={error} onRetry={load} />
              : !data ? <ErrorState message="No queue data" onRetry={load} />
              : data.queues.length === 0 && data.workers.roster.length === 0 && data.schedules.length === 0 ? (
                <EmptyState
                  icon={Server}
                  title="No workers, queues or schedules registered"
                  description="The Smart Execution Queue™, Enterprise Workers™ and Enterprise Job Engine™ become live once ExecutionJob rows start flowing. Workers will be assigned, queues will populate, and schedules will trigger jobs on cron."
                />
              ) : (
                <QueuesPanel data={data} />
              )}
          </TabsContent>

          {/* ═══════ 5. OBSERVABILITY & ALERTS ═══════ */}
          <TabsContent value="observe" className="space-y-6">
            {loading && !data ? <LoadingState label="Loading observability & alerts" />
              : error ? <ErrorState message={error} onRetry={load} />
              : !data ? <ErrorState message="No observability data" onRetry={load} />
              : <ObservabilityPanel data={data} />
            }
          </TabsContent>

          {/* ═══════ 6. LIVE MAP & ANALYTICS ═══════ */}
          <TabsContent value="map" className="space-y-6">
            {loading && !data ? <LoadingState label="Loading live map & analytics" />
              : error ? <ErrorState message={error} onRetry={load} />
              : !data ? <ErrorState message="No map data" onRetry={load} />
              : <MapAnalyticsPanel data={data} />
            }
          </TabsContent>
        </Tabs>
      </main>

      {/* ═══════ Sticky Footer ═══════ */}
      <footer className="mt-auto border-t bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2 flex-wrap">
            <Shield className="h-3 w-3 text-violet-500" />
            <span>14 subsystems · 7 Prisma models · 22 modules · unified pipeline · audit-grade traceability</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Think. Plan. Execute. Observe. Improve. · Founded & owned by <strong className="text-foreground">{FOUNDER}</strong></span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB PANELS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 2. TIMELINE PANEL ───────────────────────────────────────────────────────

function categoriseEvent(entry: TimelineEntry): { label: string; icon: LucideIcon; color: string } {
  const cat = entry.type;
  if (/fail|error|cancel/i.test(cat)) return { label: 'Failure', icon: AlertTriangle, color: 'text-rose-600' };
  if (/complet|success/i.test(cat)) return { label: 'Completion', icon: CheckCircle2, color: 'text-emerald-600' };
  if (/start|run|execut/i.test(cat)) return { label: 'Execution', icon: Play, color: 'text-cyan-600' };
  if (/queue|schedul/i.test(cat)) return { label: 'Queue', icon: Layers, color: 'text-slate-600' };
  if (/approv/i.test(cat)) return { label: 'Approval', icon: Shield, color: 'text-amber-600' };
  if (/retry/i.test(cat)) return { label: 'Retry', icon: RotateCcw, color: 'text-orange-600' };
  if (/oracle|ai_/i.test(cat)) return { label: 'AI Reasoning', icon: Sparkles, color: 'text-violet-600' };
  return { label: 'Event', icon: Activity, color: 'text-muted-foreground' };
}

function TimelinePanel({ data }: { data: ExecutionDashboard }) {
  const [moduleFilter, setModuleFilter] = useState<ExecutionModule | 'all'>('all');
  const activeModules = Object.keys(data.timeline.byModule) as ExecutionModule[];

  const filtered = moduleFilter === 'all'
    ? data.timeline.entries
    : data.timeline.entries.filter((e) => e.module === moduleFilter);

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Timeline summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={Activity} label="Total Events" value={data.timeline.total.toLocaleString('en-IN')} color="violet" />
        <KPICard icon={CalendarClock} label="Today" value={data.timeline.todayCount} color="cyan" />
        <KPICard icon={Clock} label="Last 24h" value={data.timeline.last24hCount} color="amber" />
        <KPICard icon={Boxes} label="Active Modules" value={activeModules.length} color="fuchsia" />
      </div>

      {/* Module filter chips */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted-foreground mr-1">Filter:</span>
            <button
              type="button"
              onClick={() => setModuleFilter('all')}
              className={cn(
                'px-2.5 py-1 rounded-full text-[11px] border transition-colors',
                moduleFilter === 'all' ? 'bg-violet-500 text-white border-violet-500' : 'bg-card hover:bg-muted',
              )}
            >
              All ({data.timeline.total})
            </button>
            {activeModules.map((m) => {
              const meta = MODULE_META[m];
              const count = data.timeline.byModule[m] ?? 0;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModuleFilter(m)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-[11px] border transition-colors flex items-center gap-1',
                    moduleFilter === m ? 'bg-violet-500 text-white border-violet-500' : 'bg-card hover:bg-muted',
                  )}
                >
                  <span>{meta?.icon}</span>
                  <span className={cn(moduleFilter === m ? '' : meta?.color)}>{meta?.label ?? m}</span>
                  <span className="opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Timeline list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" />Execution Timeline™</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">No events for this filter.</p>
          ) : (
            <ScrollContainer>
              <div className="relative space-y-3 pl-6">
                {/* vertical line */}
                <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
                {filtered.map((e) => {
                  const cat = categoriseEvent(e);
                  const meta = MODULE_META[e.module];
                  return (
                    <div key={e.id} className="relative">
                      <div className={cn('absolute -left-5 top-1.5 h-3 w-3 rounded-full ring-2 ring-background', meta?.accent ?? 'bg-violet-500')} />
                      <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                        <cat.icon className={cn('h-4 w-4 flex-shrink-0 mt-0.5', cat.color)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <ModuleBadge module={e.module} />
                            <StatusBadge status={e.status} />
                            <Badge variant="outline" className="text-[9px]">{cat.label}</Badge>
                            <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">{fmtTime(e.timestamp)}</span>
                          </div>
                          <p className="text-xs leading-relaxed">{e.description}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1"><Hash className="h-2.5 w-2.5" />{e.type}</span>
                            <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{fmtMs(e.durationMs)}</span>
                            <span className="flex items-center gap-1"><Users className="h-2.5 w-2.5" />{e.actor ?? 'system'}</span>
                            {e.countryIso && <span className="flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{e.countryIso}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollContainer>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── 3. TASK GRAPH PANEL ─────────────────────────────────────────────────────

const RELATION_LABELS: Partial<Record<TaskEdgeRelation, string>> = {
  lead_to: 'Lead →',
  proposal_to: 'Proposal →',
  negotiation_to: 'Negotiation →',
  invoice_to: 'Invoice →',
  payment_to: 'Payment →',
  gst_to: 'GST →',
  accounting_to: 'Accounting →',
  forecast_to: 'Forecast →',
  knowledge_to: 'Knowledge →',
  graph_to: 'Graph →',
  oracle_to: 'Oracle →',
  depends_on: 'Depends on',
  triggers: 'Triggers',
  rollback_of: 'Rollback of',
};

function TaskGraphPanel({ data }: { data: ExecutionDashboard }) {
  const tg = data.taskGraph;
  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={Boxes} label="Nodes" value={tg.nodes} color="violet" />
        <KPICard icon={GitBranch} label="Edges" value={tg.edges} color="fuchsia" />
        <KPICard icon={Network} label="Top Hubs" value={tg.topHubs.length} color="cyan" />
        <KPICard icon={Workflow} label="Sample Paths" value={tg.samplePaths.length} color="amber" />
      </div>

      {/* Longest path stepper */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><GitBranch className="h-4 w-4" />Longest Path (critical chain)</CardTitle>
        </CardHeader>
        <CardContent>
          {!tg.longestPath ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No multi-step path detected yet.</p>
          ) : (
            <div className="overflow-x-auto pb-2">
              <div className="flex items-center gap-1 min-w-fit">
                {tg.longestPath.steps.map((step, i) => {
                  const meta = MODULE_META[step.module];
                  const rel = tg.longestPath?.edgeRelations[i - 1];
                  return (
                    <React.Fragment key={i}>
                      {i > 0 && (
                        <div className="flex flex-col items-center px-1 flex-shrink-0">
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          {rel && (
                            <Badge variant="outline" className="text-[9px] mt-0.5 text-muted-foreground">
                              {RELATION_LABELS[rel] ?? rel}
                            </Badge>
                          )}
                        </div>
                      )}
                      <div className="flex-shrink-0 w-44 p-3 rounded-lg border bg-card">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base">{meta?.icon}</span>
                          <ModuleBadge module={step.module} />
                        </div>
                        <p className="text-[11px] leading-tight line-clamp-2">{step.description}</p>
                        <div className="mt-2">
                          <StatusBadge status={step.status} />
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
              <div className="mt-3 text-[11px] text-muted-foreground flex items-center gap-3">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Total: {fmtMs(tg.longestPath.totalDurationMs)}</span>
                <span className="flex items-center gap-1"><Hash className="h-3 w-3" />{tg.longestPath.steps.length} steps</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top hubs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><Network className="h-4 w-4" />Top Hubs (highest degree)</CardTitle>
          </CardHeader>
          <CardContent>
            {tg.topHubs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No hub nodes yet.</p>
            ) : (
              <ScrollContainer>
                <div className="space-y-2">
                  {tg.topHubs.map((h, i) => {
                    const meta = MODULE_META[h.module];
                    return (
                      <div key={h.jobId} className="flex items-center gap-3 p-2.5 rounded-lg border bg-card">
                        <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white', meta?.accent ?? 'bg-violet-500')}>
                          #{i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <ModuleBadge module={h.module} />
                            <Badge variant="outline" className="text-[10px]">{h.degree} edges</Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{h.description}</p>
                        </div>
                        <StatusBadge status={h.status} />
                      </div>
                    );
                  })}
                </div>
              </ScrollContainer>
            )}
          </CardContent>
        </Card>

        {/* byRelation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><Hash className="h-4 w-4" />Edges by Relation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.entries(tg.byRelation) as [TaskEdgeRelation, number][])
                .filter(([, n]) => n > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([r, n]) => (
                  <div key={r} className="p-2.5 rounded-lg border bg-card">
                    <div className="text-[10px] text-muted-foreground">{RELATION_LABELS[r] ?? r}</div>
                    <div className="text-base font-bold tabular-nums">{n}</div>
                  </div>
                ))}
              {(Object.entries(tg.byRelation) as [TaskEdgeRelation, number][])
                .filter(([, n]) => n > 0).length === 0 && (
                <p className="col-span-full text-xs text-muted-foreground text-center py-6">No edges yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sample paths */}
      {tg.samplePaths.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><Workflow className="h-4 w-4" />Sample Paths</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tg.samplePaths.slice(0, 8).map((p, i) => (
                <SamplePathCollapsible key={i} path={p} index={i} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

function SamplePathCollapsible({
  path, index,
}: {
  path: ExecutionDashboard['taskGraph']['samplePaths'][number];
  index: number;
}) {
  const [open, setOpen] = useState(index === 0);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <button type="button" className="w-full text-left p-3 flex items-center gap-2 hover:bg-muted/30 transition-colors">
            <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
            <span className="text-xs font-medium">Path #{index + 1}</span>
            <Badge variant="outline" className="text-[10px]">{path.steps.length} steps</Badge>
            <Badge variant="outline" className="text-[10px]">{fmtMs(path.totalDurationMs)}</Badge>
            <span className="ml-auto text-[10px] text-muted-foreground truncate max-w-[40%]">
              {path.steps[0]?.description} → … → {path.steps[path.steps.length - 1]?.description}
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="flex flex-wrap items-center gap-1 pt-2 border-t">
              {path.steps.map((s, i) => {
                const meta = MODULE_META[s.module];
                return (
                  <React.Fragment key={i}>
                    {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                    <div className="p-2 rounded border bg-card flex flex-col gap-1 min-w-[140px] max-w-[180px]">
                      <div className="flex items-center gap-1">
                        <span>{meta?.icon}</span>
                        <span className={cn('text-[10px] font-medium', meta?.color)}>{meta?.label}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground line-clamp-2">{s.description}</p>
                      <StatusBadge status={s.status} />
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ─── 4. QUEUES & WORKERS PANEL ───────────────────────────────────────────────

function QueuesPanel({ data }: { data: ExecutionDashboard }) {
  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={Layers} label="Queues" value={data.queues.length} color="violet" />
        <KPICard icon={Server} label="Workers" value={`${data.workers.active}/${data.workers.total}`} color="cyan" />
        <KPICard icon={Gauge} label="Avg Utilisation" value={fmtPct(data.workers.avgUtilizationPct, 0)} color="amber" />
        <KPICard icon={CalendarClock} label="Schedules" value={data.schedules.length} color="fuchsia" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Queue summaries */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4" />Smart Execution Queue™</CardTitle>
          </CardHeader>
          <CardContent>
            {data.queues.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No queues registered.</p>
            ) : (
              <ScrollContainer>
                <div className="space-y-2">
                  {data.queues.map((q) => <QueueCard key={q.queueName} queue={q} />)}
                </div>
              </ScrollContainer>
            )}
          </CardContent>
        </Card>

        {/* Worker roster */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><Server className="h-4 w-4" />Enterprise Workers™</CardTitle>
          </CardHeader>
          <CardContent>
            {data.workers.roster.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No workers registered.</p>
            ) : (
              <ScrollContainer>
                <div className="space-y-2">
                  {data.workers.roster.map((w) => (
                    <div key={w.id} className="p-3 rounded-lg border bg-card">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Cpu className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs font-mono truncate">{w.workerId}</span>
                        </div>
                        <Badge variant="outline" className={cn('text-[9px] border', WORKER_STATUS_STYLES[w.status])}>
                          {w.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge variant="outline" className="text-[9px]">{w.type}</Badge>
                        {w.region && <Badge variant="outline" className="text-[9px]"><MapPin className="h-2.5 w-2.5 mr-1" />{w.region}</Badge>}
                        {w.countryIso && <Badge variant="outline" className="text-[9px]">{w.countryIso}</Badge>}
                        <Badge variant="outline" className="text-[9px]">{w.jobsCompleted} done</Badge>
                        {w.jobsFailed > 0 && <Badge variant="outline" className="text-[9px] text-rose-600">{w.jobsFailed} failed</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={w.utilizationPct} className="h-1.5 flex-1" />
                        <span className="text-[10px] tabular-nums text-muted-foreground w-12 text-right">{fmtPct(w.utilizationPct, 0)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>cap {w.capacity} · avg {fmtMs(w.avgLatencyMs)}</span>
                        <span>hb {timeAgo(w.lastHeartbeatAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Scheduled jobs table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><CalendarClock className="h-4 w-4" />Enterprise Job Engine™ — Schedules</CardTitle>
        </CardHeader>
        <CardContent>
          {data.schedules.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No scheduled jobs yet. Schedules fire ExecutionJobs on cron.</p>
          ) : (
            <ScrollContainer className="max-h-[28rem]">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left border-b text-muted-foreground">
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2 pr-3">Module</th>
                      <th className="py-2 pr-3">Cron</th>
                      <th className="py-2 pr-3">Next Run</th>
                      <th className="py-2 pr-3">Last Status</th>
                      <th className="py-2 pr-3 text-center">Enabled</th>
                      <th className="py-2 pr-3 text-right">Runs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.schedules.map((s) => {
                      const meta = MODULE_META[s.module];
                      return (
                        <tr key={s.id} className="border-b hover:bg-muted/30">
                          <td className="py-2 pr-3 font-medium">
                            <div className="truncate max-w-[200px]">{s.name}</div>
                            <div className="text-[10px] text-muted-foreground">{s.type}</div>
                          </td>
                          <td className="py-2 pr-3"><ModuleBadge module={s.module} /></td>
                          <td className="py-2 pr-3 font-mono text-[10px]">{s.cron ?? '—'}</td>
                          <td className="py-2 pr-3 text-[10px] tabular-nums">
                            <div>{fmtTime(s.nextRunAt)}</div>
                            <div className="text-muted-foreground">{timeAgo(s.nextRunAt)}</div>
                          </td>
                          <td className="py-2 pr-3">
                            {s.lastStatus ? (
                              <Badge variant="outline" className={cn(
                                'text-[9px]',
                                s.lastStatus === 'completed' && 'text-emerald-700 bg-emerald-50',
                                s.lastStatus === 'failed' && 'text-rose-700 bg-rose-50',
                                s.lastStatus === 'running' && 'text-cyan-700 bg-cyan-50',
                              )}>
                                {s.lastStatus}
                              </Badge>
                            ) : <span className="text-[10px] text-muted-foreground">—</span>}
                          </td>
                          <td className="py-2 pr-3 text-center">
                            {s.enabled ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 inline" />
                            ) : (
                              <span className="text-[10px] text-muted-foreground">off</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">{s.runsCount}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </ScrollContainer>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function QueueCard({ queue }: { queue: QueueSummary }) {
  return (
    <div className="p-3 rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-mono truncate">{queue.queueName}</span>
        <Badge variant="outline" className="text-[10px]">{queue.total} total</Badge>
      </div>
      <div className="grid grid-cols-4 gap-1 text-center mb-2">
        <div className="p-1.5 rounded bg-slate-50 dark:bg-slate-900/30">
          <div className="text-[9px] text-muted-foreground uppercase">queued</div>
          <div className="text-sm font-bold tabular-nums">{queue.queued}</div>
        </div>
        <div className="p-1.5 rounded bg-cyan-50 dark:bg-cyan-900/30">
          <div className="text-[9px] text-muted-foreground uppercase">running</div>
          <div className="text-sm font-bold tabular-nums">{queue.running}</div>
        </div>
        <div className="p-1.5 rounded bg-emerald-50 dark:bg-emerald-900/30">
          <div className="text-[9px] text-muted-foreground uppercase">done</div>
          <div className="text-sm font-bold tabular-nums">{queue.completed}</div>
        </div>
        <div className="p-1.5 rounded bg-rose-50 dark:bg-rose-900/30">
          <div className="text-[9px] text-muted-foreground uppercase">failed</div>
          <div className="text-sm font-bold tabular-nums">{queue.failed}</div>
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>avg wait {fmtMs(queue.avgWaitMs)}</span>
        <span>oldest {timeAgo(queue.oldestQueuedAt)}</span>
      </div>
    </div>
  );
}

// ─── 5. OBSERVABILITY & ALERTS PANEL ─────────────────────────────────────────

const OBSERVABILITY_METRICS: { key: keyof ExecutionDashboard['observability']; label: string; icon: LucideIcon; color: KpiColor; format?: (n: number) => string }[] = [
  { key: 'queueSize', label: 'Queue Size', icon: Layers, color: 'slate' },
  { key: 'runningJobs', label: 'Running Jobs', icon: Play, color: 'cyan' },
  { key: 'failedJobs', label: 'Failed Jobs', icon: AlertTriangle, color: 'rose' },
  { key: 'retryCount', label: 'Retries', icon: RotateCcw, color: 'orange' },
  { key: 'successRate', label: 'Success Rate', icon: CheckCircle2, color: 'emerald', format: (n) => fmtPct(n) },
  { key: 'avgAiLatencyMs', label: 'AI Latency', icon: Cpu, color: 'violet', format: fmtMs },
  { key: 'avgApiLatencyMs', label: 'API Latency', icon: Network, color: 'fuchsia', format: fmtMs },
  { key: 'avgConnectorLatencyMs', label: 'Connector Latency', icon: Boxes, color: 'amber', format: fmtMs },
  { key: 'cacheHitRatio', label: 'Cache Hit Ratio', icon: Zap, color: 'teal', format: (n) => fmtPct(n) },
  { key: 'workerUtilizationPct', label: 'Worker Utilisation', icon: Gauge, color: 'purple', format: (n) => fmtPct(n) },
  { key: 'throughputPerMin', label: 'Throughput/min', icon: TrendingUp, color: 'emerald', format: (n) => n.toFixed(1) },
  { key: 'p95DurationMs', label: 'p95 Duration', icon: Clock, color: 'rose', format: fmtMs },
];

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  workflow_failed: 'Workflow Failed',
  connector_slow: 'Connector Slow',
  ai_failure: 'AI Failure',
  job_failed: 'Job Failed',
  queue_congested: 'Queue Congested',
  missing_approval: 'Missing Approval',
  deployment_failed: 'Deployment Failed',
  payment_failed: 'Payment Failed',
  compliance_failed: 'Compliance Failed',
};

function ObservabilityPanel({ data }: { data: ExecutionDashboard }) {
  const obs = data.observability;
  const alerts = data.alerts;

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Alert summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={AlertCircle} label="Open Alerts" value={alerts.open} sub={`${alerts.critical} critical`} color="rose" />
        <KPICard icon={CheckCircle2} label="Resolved" value={alerts.total - alerts.open} color="emerald" />
        <KPICard icon={Activity} label="Queue Size" value={obs.queueSize} color="slate" />
        <KPICard icon={Gauge} label="Worker Util" value={fmtPct(obs.workerUtilizationPct, 0)} color="amber" />
      </div>

      {/* Observability metric grid (12) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" />Execution Observability™ — 12 Core Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {OBSERVABILITY_METRICS.map((m) => {
              const val = obs[m.key];
              const formatted = m.format ? m.format(val) : val.toLocaleString('en-IN');
              return (
                <div key={m.key} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className={cn('h-7 w-7 rounded-md bg-gradient-to-br flex items-center justify-center', KPI_COLORS[m.color])}>
                      <m.icon className="h-3.5 w-3.5 text-white" />
                    </div>
                  </div>
                  <div className="text-lg font-bold tabular-nums">{formatted}</div>
                  <div className="text-[10px] text-muted-foreground">{m.label}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Alerts list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Global Alert Center™
            <Badge variant="outline" className="text-[10px] ml-1">{alerts.recent.length} recent</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.recent.length === 0 ? (
            <div className="py-8 flex flex-col items-center text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
              <p className="text-sm font-medium">No active alerts — system is operating normally</p>
              <p className="text-[11px] text-muted-foreground mt-1">Auto-detected from job failures, queue congestion, connector slowdowns, AI failures, missing approvals.</p>
            </div>
          ) : (
            <ScrollContainer>
              <div className="space-y-2">
                {alerts.recent.map((a) => (
                  <div key={a.id} className="p-3 rounded-lg border bg-card">
                    <div className="flex items-start gap-3">
                      <div className={cn('h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0', SEVERITY_STYLES[a.severity])}>
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge className={cn('text-[9px] uppercase', SEVERITY_STYLES[a.severity])}>{a.severity}</Badge>
                          <Badge variant="outline" className="text-[9px]">{ALERT_TYPE_LABELS[a.type] ?? a.type}</Badge>
                          {a.moduleId && <ModuleBadge module={a.moduleId} />}
                          <Badge variant="outline" className={cn(
                            'text-[9px]',
                            a.status === 'open' && 'text-rose-600',
                            a.status === 'acknowledged' && 'text-amber-600',
                            a.status === 'resolved' && 'text-emerald-600',
                          )}>
                            {a.status}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground ml-auto">{timeAgo(a.detectedAt)}</span>
                        </div>
                        <div className="text-xs font-medium mb-0.5">{a.title}</div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{a.description}</p>
                        {a.proposedFix && (
                          <div className="mt-2 p-2 rounded bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                            <div className="flex items-center gap-1 mb-0.5">
                              <Sparkles className="h-3 w-3 text-emerald-600" />
                              <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">Oracle Proposed Fix</span>
                            </div>
                            <p className="text-[11px] text-emerald-800 dark:text-emerald-300">{a.proposedFix}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollContainer>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── 6. LIVE MAP & ANALYTICS PANEL ───────────────────────────────────────────

function MapAnalyticsPanel({ data }: { data: ExecutionDashboard }) {
  const map = data.liveMap;
  const analytics = data.analytics;
  const maxHourly = Math.max(...analytics.byHour.map((h) => h.executions), 1);

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* System health banner */}
      <Card className={cn(
        'overflow-hidden border',
        map.systemHealth === 'healthy' && 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5',
        map.systemHealth === 'degraded' && 'border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5',
        map.systemHealth === 'critical' && 'border-rose-500/30 bg-gradient-to-br from-rose-500/5 to-fuchsia-500/5',
      )}>
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                'h-11 w-11 rounded-full flex items-center justify-center',
                map.systemHealth === 'healthy' && 'bg-emerald-500',
                map.systemHealth === 'degraded' && 'bg-amber-500',
                map.systemHealth === 'critical' && 'bg-rose-500',
              )}>
                <Globe className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold">Live Execution Map™ — System {healthLabel(map.systemHealth)}</div>
                <div className="text-[11px] text-muted-foreground">
                  {map.totalActiveJobs} active jobs · {map.totalHealthyWorkers}/{map.totalWorkers} workers healthy · {map.regions.length} regions · updated {timeAgo(map.updatedAt)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(['healthy', 'degraded', 'critical'] as const).map((h) => (
                <Badge key={h} variant="outline" className={cn(
                  'text-[10px]',
                  map.systemHealth === h ? HEALTH_STYLES[h].classes : 'text-muted-foreground opacity-50',
                )}>
                  {HEALTH_STYLES[h].label}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KPICard icon={Activity} label="Total Executions" value={analytics.throughput.totalExecutions.toLocaleString('en-IN')} color="violet" />
        <KPICard icon={Zap} label="Per Hour" value={analytics.throughput.perHour.toFixed(1)} color="cyan" />
        <KPICard icon={CheckCircle2} label="Success Rate" value={fmtPct(analytics.successRate)} color="emerald" />
        <KPICard icon={Clock} label="Avg Duration" value={fmtMs(analytics.avgDurationMs)} color="amber" />
        <KPICard icon={Cpu} label="AI Cost" value={inr(analytics.aiCost)} color="fuchsia" />
        <KPICard icon={TrendingUp} label="ROI" value={fmtPct(analytics.roi)} sub={analytics.trend} color="teal" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Region cards */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4" />Regions</CardTitle>
          </CardHeader>
          <CardContent>
            {map.regions.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No regions reporting yet.</p>
            ) : (
              <ScrollContainer>
                <div className="space-y-2">
                  {map.regions.map((r) => (
                    <div key={r.region} className="p-3 rounded-lg border bg-card">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-violet-500" />
                          <span className="text-xs font-semibold">{r.region}</span>
                          <Badge variant="outline" className="text-[9px]">{r.countries.length} countries</Badge>
                        </div>
                        <Badge variant="outline" className="text-[9px]">{r.activeJobs} active</Badge>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <Progress value={r.utilizationPct} className="h-1.5 flex-1" />
                        <span className="text-[10px] tabular-nums text-muted-foreground w-12 text-right">{fmtPct(r.utilizationPct, 0)}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Workers: <span className="text-emerald-600 font-medium">{r.healthyWorkers}</span> / {r.totalWorkers} healthy
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollContainer>
            )}
          </CardContent>
        </Card>

        {/* Module node grid */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><Boxes className="h-4 w-4" />Module Nodes ({map.modules.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {map.modules.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No module nodes registered.</p>
            ) : (
              <ScrollContainer>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {map.modules.map((n) => {
                    const meta = n.label ? Object.values(MODULE_META).find((m) => m.label === n.label || m.id === n.label) : null;
                    return (
                      <div key={n.id} className="p-2.5 rounded-lg border bg-card">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={cn(
                            'h-2 w-2 rounded-full',
                            n.status === 'healthy' && 'bg-emerald-500',
                            n.status === 'busy' && 'bg-cyan-500 animate-pulse',
                            n.status === 'degraded' && 'bg-amber-500',
                            n.status === 'down' && 'bg-rose-500',
                          )} />
                          <span className="text-[11px] font-medium truncate">{meta?.icon} {n.label}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          <span className="tabular-nums font-semibold text-foreground">{n.activeJobs}</span> active jobs
                        </div>
                        <Badge variant="outline" className="text-[9px] mt-1">{n.status}</Badge>
                      </div>
                    );
                  })}
                </div>
              </ScrollContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Failure causes + Cost breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Failure causes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" />Failure Causes</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.failureCauses.length === 0 ? (
              <div className="py-6 flex flex-col items-center text-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-500 mb-2" />
                <p className="text-xs text-muted-foreground">No failure causes recorded — pipeline is healthy.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {analytics.failureCauses.slice(0, 8).map((c, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate font-medium">{c.cause}</span>
                      <span className="text-muted-foreground tabular-nums">{c.count} · {fmtPct(c.pct, 0)}</span>
                    </div>
                    <Progress value={c.pct} className="h-1.5" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cost breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" />Cost & Savings (₹)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              <CostTile label="AI Cost" value={inr(analytics.aiCost)} icon={Cpu} color="violet" />
              <CostTile label="Connector Cost" value={inr(analytics.connectorCost)} icon={Boxes} color="amber" />
              <CostTile label="Cost / Execution" value={inr(analytics.costPerExecution)} icon={Hash} color="slate" />
              <CostTile label="Productivity Gains" value={inr(analytics.productivityGains)} icon={TrendingUp} color="emerald" />
              <CostTile label="Automation Savings" value={inr(analytics.automationSavings)} icon={Zap} color="teal" />
              <CostTile label="ROI" value={fmtPct(analytics.roi)} icon={Sparkles} color="fuchsia" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* byModule table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Boxes className="h-4 w-4" />Analytics by Module</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.byModule.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No per-module analytics yet.</p>
          ) : (
            <ScrollContainer className="max-h-[24rem]">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left border-b text-muted-foreground">
                      <th className="py-2 pr-3">Module</th>
                      <th className="py-2 pr-3 text-right">Executions</th>
                      <th className="py-2 pr-3 text-right">Success</th>
                      <th className="py-2 pr-3 text-right">Avg Dur</th>
                      <th className="py-2 pr-3 text-right">Cost</th>
                      <th className="py-2 pr-3 text-right">Savings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.byModule
                      .slice()
                      .sort((a, b) => b.executions - a.executions)
                      .map((m) => {
                        const meta = MODULE_META[m.module];
                        return (
                          <tr key={m.module} className="border-b hover:bg-muted/30">
                            <td className="py-2 pr-3">
                              <span className={cn('text-xs font-medium', meta?.color)}>{meta?.icon} {meta?.label ?? m.module}</span>
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums">{m.executions.toLocaleString('en-IN')}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">
                              <span className={cn(
                                'font-medium',
                                m.successRate >= 90 ? 'text-emerald-600' : m.successRate >= 70 ? 'text-amber-600' : 'text-rose-600',
                              )}>
                                {fmtPct(m.successRate, 0)}
                              </span>
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums">{fmtMs(m.avgDurationMs)}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{inr(m.cost)}</td>
                            <td className="py-2 pr-3 text-right tabular-nums text-emerald-600">{inr(m.savings)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </ScrollContainer>
          )}
        </CardContent>
      </Card>

      {/* byHour mini bar chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" />Executions per Hour (last 24h)</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.byHour.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No hourly data yet.</p>
          ) : (
            <div className="flex items-end gap-1 h-32">
              {analytics.byHour.map((h, i) => {
                const height = (h.executions / maxHourly) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                      {h.executions}
                    </div>
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 transition-colors min-h-[2px]"
                      style={{ height: `${height}%` }}
                      title={`${h.hour}: ${h.executions} executions, ${fmtPct(h.successRate, 0)} success`}
                    />
                    <div className="text-[8px] text-muted-foreground tabular-nums">{h.hour.split(':')[0] ?? h.hour}</div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function healthLabel(s: string): string {
  return HEALTH_STYLES[s]?.label ?? s;
}

function CostTile({ label, value, icon: Icon, color }: { label: string; value: string; icon: LucideIcon; color: KpiColor }) {
  return (
    <div className="p-3 rounded-lg border bg-card">
      <div className="flex items-center justify-between mb-2">
        <div className={cn('h-7 w-7 rounded-md bg-gradient-to-br flex items-center justify-center', KPI_COLORS[color])}>
          <Icon className="h-3.5 w-3.5 text-white" />
        </div>
      </div>
      <div className="text-base font-bold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
