'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI SOFTWARE FACTORY™ — Self-Building Software Ecosystem
//
// Think it. Build it. Deploy it. Scale it.
//
// Oracle™ + 10 AI Dev Employees collaborate to design, generate, test, deploy,
// monitor & continuously improve enterprise applications from natural language.
// Every value is derived from REAL connected business data.
//
// Sections:
//   1. Natural Language App Builder™ (prompt → full project)
//   2. Enterprise Observability™ (live KPIs)
//   3. AI Collaborative Development™ (10 dev employees + pipeline)
//   4. Projects (generated apps with build/test/deploy/release/rollback actions)
//   5. Builds · Deployments · Releases · Reviews (pipeline activity)
//   6. Enterprise Component Library™
//   7. App Templates
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu, GitBranch, Rocket, FlaskConical, ShieldCheck, Package,
  Boxes, FileCode2, Terminal, Brain, Sparkles, Loader2, Play,
  CheckCircle2, XCircle, AlertTriangle, Clock, ArrowRight,
  Send, RefreshCw, ExternalLink, Layers, Zap, Activity,
  Wrench, Palette, Database, Server, GitPullRequest,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { FACTORY_TAGLINE } from '@/lib/software-factory/types';
import type {
  FactoryDashboard, Project, BuildRecord, Deployment, Release,
  CodeReview, DevEmployee, CollaborationPipeline, AppType,
} from '@/lib/software-factory/types';
import { DEV_EMPLOYEE_DEFS, PIPELINE_ORDER } from '@/lib/software-factory/employees-defs';
import { APP_TEMPLATES } from '@/lib/software-factory/templates';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function statusColor(status: string): string {
  if (['success', 'passed', 'healthy', 'live', 'released', 'approved', 'completed'].includes(status)) return 'text-emerald-400';
  if (['failed', 'unhealthy', 'rolled_back', 'blocked'].includes(status)) return 'text-red-400';
  if (['building', 'deploying', 'releasing', 'running', 'in_progress', 'pending_approval', 'queued', 'pending', 'generating', 'testing', 'reviewing', 'deploying'].includes(status)) return 'text-amber-400';
  return 'text-muted-foreground';
}

function statusBg(status: string): string {
  if (['success', 'passed', 'healthy', 'live', 'released', 'approved', 'completed'].includes(status)) return 'bg-emerald-500/10 border-emerald-500/20';
  if (['failed', 'unhealthy', 'rolled_back', 'blocked'].includes(status)) return 'bg-red-500/10 border-red-500/20';
  if (['building', 'deploying', 'releasing', 'running', 'in_progress', 'pending_approval', 'queued', 'pending', 'generating', 'testing', 'reviewing'].includes(status)) return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-white/[0.03] border-white/[0.08]';
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function fmtNum(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString('en-IN');
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ icon: Icon, label, value, sub, accent }: { icon: LucideIcon; label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <Card className="glass-surface border-white/[0.06]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 ${accent || 'text-muted-foreground'}`} />
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</div>
        {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function AISoftwareFactoryPage() {
  const { toast } = useToast();
  const [dashboard, setDashboard] = useState<FactoryDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<{ message: string; project: Project; pipeline: CollaborationPipeline } | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dev/dashboard');
      const json = await res.json();
      if (json.ok) setDashboard(json.dashboard);
    } catch (err) {
      console.error('dashboard load failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleGenerate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setGenerating(true);
    setGenResult(null);
    try {
      const res = await fetch('/api/dev/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed }),
      });
      const json = await res.json();
      if (json.ok) {
        setGenResult({ message: json.message, project: json.project, pipeline: json.pipeline });
        toast({ title: 'Project generated', description: json.message });
        setPrompt('');
        loadDashboard();
        setActiveTab('projects');
      } else {
        toast({ title: 'Generation failed', description: json.error, variant: 'destructive' });
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Generation failed', description: 'Network error', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  }, [prompt, toast, loadDashboard]);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 pb-28 pt-4 md:px-6 md:pb-12">
      {/* ─── Hero ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-5"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl accent-gradient shadow-lg shadow-emerald-500/20">
            <Cpu className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              AI Software Factory<span className="accent-text">™</span>
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Think it. Build it. Deploy it. Scale it.
            </p>
          </div>
          <Badge variant="outline" className="ml-auto gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            {dashboard ? `${dashboard.totals.activeProjects} active projects` : 'loading…'}
          </Badge>
        </div>
      </motion.div>

      {/* ─── Natural Language App Builder ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="mb-5"
      >
        <Card className="glass-surface-strong border-white/[0.08]">
          <CardContent className="p-4 md:p-5">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 accent-text" />
              <h2 className="text-sm font-semibold text-foreground">Natural Language App Builder™</h2>
              <span className="text-[11px] text-muted-foreground">— Oracle™ generates complete enterprise software</span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
                placeholder="e.g. Build a CRM, Create Hospital Management, Generate Manufacturing ERP…"
                className="flex-1 border-white/[0.08] bg-white/[0.03] text-sm"
                disabled={generating}
              />
              <Button
                onClick={handleGenerate}
                disabled={generating || !prompt.trim()}
                className="accent-gradient shrink-0 gap-2 text-white shadow-lg shadow-emerald-500/20"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {generating ? 'Generating…' : 'Generate App'}
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {APP_TEMPLATES.slice(0, 6).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setPrompt(t.examplePrompt)}
                  disabled={generating}
                  className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground disabled:opacity-50"
                >
                  {t.examplePrompt}
                </button>
              ))}
            </div>
            <AnimatePresence>
              {genResult && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 overflow-hidden"
                >
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground">{genResult.project.name}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{genResult.message}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge variant="outline" className="gap-1 border-white/10 text-[10px]">
                            <FileCode2 className="h-3 w-3" /> {genResult.project.fileCount} files
                          </Badge>
                          <Badge variant="outline" className="gap-1 border-white/10 text-[10px]">
                            <Layers className="h-3 w-3" /> {fmtNum(genResult.project.lineCount)} LOC
                          </Badge>
                          <Badge variant="outline" className="gap-1 border-white/10 text-[10px]">
                            <Database className="h-3 w-3" /> {genResult.project.modules.tables.length} tables
                          </Badge>
                          <Badge variant="outline" className="gap-1 border-white/10 text-[10px]">
                            <Server className="h-3 w-3" /> {genResult.project.modules.apis.length} APIs
                          </Badge>
                          <Badge variant="outline" className="gap-1 border-white/10 text-[10px]">
                            <Palette className="h-3 w-3" /> {genResult.project.modules.pages.length} pages
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── KPI Row (Enterprise Observability) ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      >
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)
        ) : dashboard ? (
          <>
            <KPICard icon={Boxes} label="Projects" value={dashboard.totals.projects} sub={`${dashboard.totals.liveProjects} live`} accent="accent-text" />
            <KPICard icon={GitBranch} label="Builds" value={dashboard.totals.builds} sub={`${dashboard.health.buildSuccessRate}% success`} accent="text-emerald-400" />
            <KPICard icon={Rocket} label="Deployments" value={dashboard.totals.deployments} sub={`${dashboard.totals.healthyDeployments} healthy`} accent="text-sky-400" />
            <KPICard icon={FlaskConical} label="Test Runs" value={dashboard.totals.testRuns} sub={`${dashboard.totals.passingTests} passing`} accent="text-amber-400" />
            <KPICard icon={Package} label="Releases" value={dashboard.totals.releases} sub={`${dashboard.totals.releasedToProd} to prod`} accent="text-violet-400" />
            <KPICard icon={ShieldCheck} label="Reviews" value={dashboard.totals.reviews} sub={`${dashboard.totals.openReviews} open`} accent="text-rose-400" />
          </>
        ) : null}
      </motion.div>

      {/* ─── Tabs ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="mb-4 overflow-x-auto">
          <TabsList className="glass-surface inline-flex h-10 w-auto gap-1 rounded-xl border-white/[0.06] p-1">
            <TabsTrigger value="overview" className="gap-1.5 text-xs"><Activity className="h-3.5 w-3.5" />Overview</TabsTrigger>
            <TabsTrigger value="projects" className="gap-1.5 text-xs"><Boxes className="h-3.5 w-3.5" />Projects</TabsTrigger>
            <TabsTrigger value="workforce" className="gap-1.5 text-xs"><Brain className="h-3.5 w-3.5" />AI Workforce</TabsTrigger>
            <TabsTrigger value="builds" className="gap-1.5 text-xs"><GitBranch className="h-3.5 w-3.5" />Builds</TabsTrigger>
            <TabsTrigger value="deployments" className="gap-1.5 text-xs"><Rocket className="h-3.5 w-3.5" />Deployments</TabsTrigger>
            <TabsTrigger value="releases" className="gap-1.5 text-xs"><Package className="h-3.5 w-3.5" />Releases</TabsTrigger>
            <TabsTrigger value="components" className="gap-1.5 text-xs"><Layers className="h-3.5 w-3.5" />Components</TabsTrigger>
            <TabsTrigger value="templates" className="gap-1.5 text-xs"><FileCode2 className="h-3.5 w-3.5" />Templates</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview"><OverviewTab dashboard={dashboard} loading={loading} onRefresh={loadDashboard} /></TabsContent>
        <TabsContent value="projects"><ProjectsTab /></TabsContent>
        <TabsContent value="workforce"><WorkforceTab dashboard={dashboard} loading={loading} /></TabsContent>
        <TabsContent value="builds"><BuildsTab /></TabsContent>
        <TabsContent value="deployments"><DeploymentsTab /></TabsContent>
        <TabsContent value="releases"><ReleasesTab /></TabsContent>
        <TabsContent value="components"><ComponentsTab /></TabsContent>
        <TabsContent value="templates"><TemplatesTab onPick={(p) => { setPrompt(p); setActiveTab('overview'); }} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════════════════════

function OverviewTab({ dashboard, loading, onRefresh }: { dashboard: FactoryDashboard | null; loading: boolean; onRefresh: () => void }) {
  if (loading || !dashboard) {
    return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>;
  }
  return (
    <div className="space-y-4">
      {/* Velocity + Health */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="glass-surface border-white/[0.06]">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Zap className="h-4 w-4 accent-text" />Engineering Velocity</CardTitle></CardHeader>
          <CardContent className="space-y-2 pt-0">
            <MetricRow label="Files generated" value={fmtNum(dashboard.velocity.filesGenerated)} />
            <MetricRow label="Lines of code" value={fmtNum(dashboard.velocity.linesGenerated)} />
            <MetricRow label="Avg build duration" value={fmtMs(dashboard.velocity.avgBuildDurationMs)} />
            <MetricRow label="Avg test duration" value={fmtMs(dashboard.velocity.avgTestDurationMs)} />
            <MetricRow label="Builds today" value={dashboard.velocity.buildsToday} />
            <MetricRow label="Releases this week" value={dashboard.velocity.releasesThisWeek} />
          </CardContent>
        </Card>
        <Card className="glass-surface border-white/[0.06]">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4 text-emerald-400" />System Health</CardTitle></CardHeader>
          <CardContent className="space-y-2 pt-0">
            <MetricRow label="Avg project health" value={`${dashboard.health.averageHealthScore}/100`} />
            <MetricRow label="Avg test coverage" value={`${dashboard.health.averageCoverage}%`} />
            <MetricRow label="Build success rate" value={`${dashboard.health.buildSuccessRate}%`} />
            <MetricRow label="Avg uptime" value={`${dashboard.health.averageUptime}%`} />
            <MetricRow label="Avg latency" value={`${dashboard.health.averageLatency}ms`} />
            <MetricRow label="Avg error rate" value={`${dashboard.health.averageErrorRate}%`} />
          </CardContent>
        </Card>
      </div>

      {/* Connected business data */}
      <Card className="glass-surface border-white/[0.06]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Database className="h-4 w-4 text-sky-400" />Connected Business Data
            <Badge variant="outline" className="ml-auto gap-1 border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-400">
              <span className="h-1 w-1 rounded-full bg-emerald-400" />LIVE
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <DataPill label="Clients" value={dashboard.businessData.clientCount} />
            <DataPill label="Invoices" value={dashboard.businessData.invoiceCount} />
            <DataPill label="GST Returns" value={dashboard.businessData.returnCount} />
            <DataPill label="Filed" value={dashboard.businessData.filedReturns} />
            <DataPill label="Active Clients" value={dashboard.businessData.activeClients} />
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Every generated project is tailored to this real data snapshot — table row counts, schema design, and API shape reflect your live business.
          </p>
        </CardContent>
      </Card>

      {/* Recent projects + Recent builds */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="glass-surface border-white/[0.06]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2"><Boxes className="h-4 w-4 accent-text" />Recent Projects</span>
              <Button size="sm" variant="ghost" onClick={onRefresh} className="h-7 gap-1 text-[11px]"><RefreshCw className="h-3 w-3" />Refresh</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="max-h-72">
              <div className="space-y-2 pr-2">
                {dashboard.recentProjects.length === 0 ? (
                  <EmptyState text="No projects yet. Generate your first app above." />
                ) : dashboard.recentProjects.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">{p.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{p.appType} · {p.fileCount} files · {fmtNum(p.lineCount)} LOC</p>
                    </div>
                    <Badge variant="outline" className={`shrink-0 border-white/10 text-[10px] ${statusColor(p.status)}`}>{p.status}</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        <Card className="glass-surface border-white/[0.06]">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><GitBranch className="h-4 w-4 text-emerald-400" />Recent Builds</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="max-h-72">
              <div className="space-y-2 pr-2">
                {dashboard.recentBuilds.length === 0 ? (
                  <EmptyState text="No builds yet." />
                ) : dashboard.recentBuilds.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">Build #{b.buildNumber}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{b.triggeredBy} · {fmtMs(b.durationMs)} · {b.errors} err · {b.warnings} warn</p>
                    </div>
                    <Badge variant="outline" className={`shrink-0 border-white/10 text-[10px] ${statusColor(b.status)}`}>{b.status}</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.04] py-1.5 last:border-0">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold text-foreground">{value}</span>
    </div>
  );
}

function DataPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-center">
      <div className="text-lg font-bold text-foreground">{fmtNum(value)}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="py-6 text-center text-[11px] text-muted-foreground">{text}</div>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROJECTS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function ProjectsTab() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Project | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dev/projects');
      const json = await res.json();
      if (json.ok) setProjects(json.projects);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const action = useCallback(async (endpoint: string, body: Record<string, unknown>, label: string, projectId: string) => {
    setBusy(projectId);
    try {
      const res = await fetch(`/api/dev/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.ok) {
        toast({ title: `${label} complete`, description: 'Pipeline updated.' });
        load();
      } else {
        toast({ title: `${label} failed`, description: json.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: `${label} failed`, description: 'Network error', variant: 'destructive' });
    } finally { setBusy(null); }
  }, [toast, load]);

  if (loading) {
    return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}</div>;
  }

  if (projects.length === 0) {
    return (
      <Card className="glass-surface border-white/[0.06]">
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04]"><Boxes className="h-7 w-7 text-muted-foreground" /></div>
          <div>
            <p className="text-sm font-medium text-foreground">No software projects yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Use the Natural Language App Builder above to generate your first application.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => (
        <Card key={p.id} className="glass-surface border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{p.appType} · {p.category}</p>
              </div>
              <Badge variant="outline" className={`shrink-0 border-white/10 text-[10px] ${statusColor(p.status)}`}>{p.status}</Badge>
            </div>
            <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">{p.description}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MiniStat label="Files" value={fmtNum(p.fileCount)} />
              <MiniStat label="LOC" value={fmtNum(p.lineCount)} />
              <MiniStat label="Coverage" value={`${Math.round(p.coveragePct)}%`} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge variant="outline" className="gap-1 border-white/10 text-[9px]"><Database className="h-2.5 w-2.5" />{p.modules.tables.length} tables</Badge>
              <Badge variant="outline" className="gap-1 border-white/10 text-[9px]"><Server className="h-2.5 w-2.5" />{p.modules.apis.length} APIs</Badge>
              <Badge variant="outline" className="gap-1 border-white/10 text-[9px]"><Palette className="h-2.5 w-2.5" />{p.modules.pages.length} pages</Badge>
              <Badge variant="outline" className="gap-1 border-white/10 text-[9px]"><Activity className="h-2.5 w-2.5" />{p.modules.workflows.length} workflows</Badge>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={() => setSelected(p)} className="h-7 gap-1 text-[10px]">View</Button>
              <Button size="sm" variant="outline" disabled={busy === p.id} onClick={() => action('build', { projectId: p.id }, 'Build', p.id)} className="h-7 gap-1 text-[10px]">{busy === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <GitBranch className="h-3 w-3" />}Build</Button>
              <Button size="sm" variant="outline" disabled={busy === p.id} onClick={() => action('test', { projectId: p.id }, 'Test', p.id)} className="h-7 gap-1 text-[10px]"><FlaskConical className="h-3 w-3" />Test</Button>
              <Button size="sm" variant="outline" disabled={busy === p.id} onClick={() => action('review', { projectId: p.id }, 'Review', p.id)} className="h-7 gap-1 text-[10px]"><ShieldCheck className="h-3 w-3" />Review</Button>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <Button size="sm" variant="outline" disabled={busy === p.id} onClick={() => action('deploy', { projectId: p.id, environment: 'staging' }, 'Deploy (staging)', p.id)} className="h-7 gap-1 text-[10px]"><Rocket className="h-3 w-3" />Deploy</Button>
              <Button size="sm" variant="outline" disabled={busy === p.id} onClick={() => action('release', { projectId: p.id, channel: 'canary' }, 'Release (canary)', p.id)} className="h-7 gap-1 text-[10px]"><Package className="h-3 w-3" />Release</Button>
              {p.liveUrl && <a href={p.liveUrl} target="_blank" rel="noreferrer" className="ml-auto text-[10px] text-sky-400 hover:underline">Open ↗</a>}
            </div>
          </CardContent>
        </Card>
      ))}
      <ProjectDetailSheet project={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-1.5 text-center">
      <div className="text-xs font-bold text-foreground">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function ProjectDetailSheet({ project, onClose }: { project: Project | null; onClose: () => void }) {
  if (!project) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-surface-strong w-full max-w-2xl rounded-2xl border border-white/[0.08] p-5"
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">{project.name}</h3>
            <p className="text-[11px] text-muted-foreground">{project.appType} · v{project.version} · {project.lifecycleStage}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-7 text-xs">Close</Button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">{project.description}</p>
        <div className="mb-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="mb-1 text-[11px] font-semibold text-foreground">Original prompt</p>
          <p className="text-[11px] italic text-muted-foreground">"{project.prompt}"</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Files" value={fmtNum(project.fileCount)} />
          <MiniStat label="LOC" value={fmtNum(project.lineCount)} />
          <MiniStat label="Coverage" value={`${Math.round(project.coveragePct)}%`} />
          <MiniStat label="Health" value={`${project.healthScore}/100`} />
        </div>
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold text-foreground">Tech Stack</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="border-white/10 text-[10px]">{project.stack.frontend}</Badge>
            <Badge variant="outline" className="border-white/10 text-[10px]">{project.stack.backend}</Badge>
            <Badge variant="outline" className="border-white/10 text-[10px]">{project.stack.database}</Badge>
            <Badge variant="outline" className="border-white/10 text-[10px]">{project.stack.deployment}</Badge>
          </div>
        </div>
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold text-foreground">AI Employees that built this</p>
          <div className="flex flex-wrap gap-1.5">
            {project.aiEmployees.map((eid) => {
              const def = DEV_EMPLOYEE_DEFS.find((d) => d.id === eid);
              return def ? (
                <Badge key={eid} variant="outline" className="gap-1 border-white/10 text-[10px]">
                  <span>{def.icon}</span>{def.name.replace('™', '')}
                </Badge>
              ) : null;
            })}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-foreground">Database Tables</p>
            <div className="space-y-1">
              {project.modules.tables.slice(0, 6).map((t) => (
                <div key={t.name} className="flex items-center justify-between rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1">
                  <span className="text-[10px] font-medium text-foreground">{t.name}</span>
                  <span className="text-[9px] text-muted-foreground">{t.rowCount} rows</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-foreground">API Endpoints</p>
            <div className="space-y-1">
              {project.modules.apis.slice(0, 6).map((a, i) => (
                <div key={i} className="flex items-center gap-2 rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1">
                  <Badge variant="outline" className="border-white/10 text-[8px] font-mono">{a.method}</Badge>
                  <span className="truncate text-[10px] text-muted-foreground">{a.path}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI WORKFORCE TAB (10 dev employees + collaboration pipeline)
// ═══════════════════════════════════════════════════════════════════════════════

function WorkforceTab({ dashboard, loading }: { dashboard: FactoryDashboard | null; loading: boolean }) {
  const employees: DevEmployee[] = dashboard?.employees || DEV_EMPLOYEE_DEFS.map((d) => ({
    id: d.id, name: d.name, role: d.role, specialty: d.specialty, icon: d.icon, stage: d.stage,
    responsibilities: d.responsibilities, deliverables: d.deliverables, active: true,
    projectsAssigned: 0, tasksCompleted: 0, successRate: 0,
  }));

  return (
    <div className="space-y-4">
      {/* Pipeline visualisation */}
      <Card className="glass-surface border-white/[0.06]">
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><GitPullRequest className="h-4 w-4 accent-text" />AI Collaborative Development Pipeline™</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {PIPELINE_ORDER.map((eid, idx) => {
              const def = DEV_EMPLOYEE_DEFS.find((d) => d.id === eid)!;
              return (
                <div key={eid} className="flex items-center gap-1">
                  <div className="flex flex-col items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-center" style={{ minWidth: 88 }}>
                    <span className="text-lg">{def.icon}</span>
                    <span className="text-[9px] font-medium leading-tight text-foreground">{def.name.replace('AI ', '').replace('™', '')}</span>
                    <span className="text-[8px] uppercase tracking-wider text-muted-foreground">{def.stage}</span>
                  </div>
                  {idx < PIPELINE_ORDER.length - 1 && <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />}
                </div>
              );
            })}
            <div className="flex items-center gap-1">
              <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
              <div className="flex flex-col items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 text-center" style={{ minWidth: 88 }}>
                <span className="text-lg">👑</span>
                <span className="text-[9px] font-medium leading-tight text-emerald-400">AI CEO Approval</span>
                <span className="text-[8px] uppercase tracking-wider text-emerald-400/70">production</span>
              </div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Multiple AI employees build software together — from idea to production, with AI CEO™ approval before every production release.
          </p>
        </CardContent>
      </Card>

      {/* Employee cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {employees.map((emp, i) => (
          <motion.div key={emp.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <Card className="glass-surface h-full border-white/[0.06]">
              <CardContent className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-2xl">{emp.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">{emp.name.replace('AI ', '').replace('™', '')}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{emp.specialty}</p>
                  </div>
                  {emp.active && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" />}
                </div>
                {loading ? (
                  <Skeleton className="h-16 rounded" />
                ) : (
                  <div className="space-y-1">
                    <MetricRow label="Projects" value={emp.projectsAssigned} />
                    <MetricRow label="Tasks" value={emp.tasksCompleted} />
                    <MetricRow label="Success" value={`${emp.successRate}%`} />
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  {emp.deliverables.slice(0, 2).map((d) => (
                    <Badge key={d} variant="outline" className="border-white/10 text-[9px]">{d}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUILDS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function BuildsTab() {
  const [builds, setBuilds] = useState<BuildRecord[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/dev/builds');
        const json = await res.json();
        if (json.ok) setBuilds(json.builds);
      } catch { /* */ } finally { setLoading(false); }
    })();
  }, []);
  if (loading) return <div className="grid gap-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>;
  if (builds.length === 0) return <Card className="glass-surface border-white/[0.06]"><CardContent className="p-8 text-center text-xs text-muted-foreground">No builds yet. Generate a project and trigger a build.</CardContent></Card>;
  return (
    <Card className="glass-surface border-white/[0.06]">
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><GitBranch className="h-4 w-4 text-emerald-400" />Build History</CardTitle></CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="max-h-[600px]">
          <div className="space-y-2 pr-2">
            {builds.map((b) => (
              <div key={b.id} className={`rounded-lg border p-3 ${statusBg(b.status)}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {b.status === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : b.status === 'failed' ? <XCircle className="h-4 w-4 text-red-400" /> : <Clock className="h-4 w-4 text-amber-400" />}
                    <span className="text-xs font-semibold text-foreground">Build #{b.buildNumber}</span>
                    <Badge variant="outline" className="border-white/10 text-[9px]">{b.stage}</Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(b.createdAt)}</span>
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">{b.triggeredBy} · {fmtMs(b.durationMs)} · {b.fileSizeMb}MB · {b.errors} err / {b.warnings} warn</p>
                <pre className="mt-1.5 overflow-x-auto rounded bg-black/30 p-2 text-[9px] leading-relaxed text-muted-foreground">{b.logTail}</pre>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEPLOYMENTS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function DeploymentsTab() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/dev/deployments');
        const json = await res.json();
        if (json.ok) setDeployments(json.deployments);
      } catch { /* */ } finally { setLoading(false); }
    })();
  }, []);
  if (loading) return <div className="grid gap-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>;
  if (deployments.length === 0) return <Card className="glass-surface border-white/[0.06]"><CardContent className="p-8 text-center text-xs text-muted-foreground">No deployments yet. Deploy a project from the Projects tab.</CardContent></Card>;
  return (
    <Card className="glass-surface border-white/[0.06]">
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Rocket className="h-4 w-4 text-sky-400" />Deployments</CardTitle></CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-2 sm:grid-cols-2">
          {deployments.map((d) => (
            <div key={d.id} className={`rounded-lg border p-3 ${statusBg(d.status)}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-white/10 text-[9px] uppercase">{d.environment}</Badge>
                  <span className="text-[10px] text-muted-foreground">{d.strategy}</span>
                </div>
                <Badge variant="outline" className={`border-white/10 text-[9px] ${statusColor(d.status)}`}>{d.status}</Badge>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1 text-center">
                <MiniStat label="CPU" value={`${d.cpuUsagePct.toFixed(0)}%`} />
                <MiniStat label="Mem" value={`${d.memUsageMb.toFixed(0)}MB`} />
                <MiniStat label="Latency" value={`${d.latencyMs.toFixed(0)}ms`} />
                <MiniStat label="Uptime" value={`${d.uptimePct.toFixed(2)}%`} />
              </div>
              {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] text-sky-400 hover:underline">{d.url} <ExternalLink className="h-3 w-3" /></a>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RELEASES TAB
// ═══════════════════════════════════════════════════════════════════════════════

function ReleasesTab() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/dev/releases');
        const json = await res.json();
        if (json.ok) setReleases(json.releases);
      } catch { /* */ } finally { setLoading(false); }
    })();
  }, []);
  if (loading) return <div className="grid gap-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>;
  if (releases.length === 0) return <Card className="glass-surface border-white/[0.06]"><CardContent className="p-8 text-center text-xs text-muted-foreground">No releases yet. Release a project from the Projects tab.</CardContent></Card>;
  return (
    <Card className="glass-surface border-white/[0.06]">
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Package className="h-4 w-4 text-violet-400" />Release Management</CardTitle></CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="max-h-[600px]">
          <div className="space-y-2 pr-2">
            {releases.map((r) => (
              <div key={r.id} className={`rounded-lg border p-3 ${statusBg(r.status)}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-violet-400" />
                    <span className="text-xs font-semibold text-foreground">v{r.version}</span>
                    <Badge variant="outline" className="border-white/10 text-[9px] uppercase">{r.channel}</Badge>
                    <Badge variant="outline" className="border-white/10 text-[9px]">{r.strategy}</Badge>
                    {r.rollbackOf && <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-[9px] text-amber-400">rollback</Badge>}
                  </div>
                  <Badge variant="outline" className={`border-white/10 text-[9px] ${statusColor(r.status)}`}>{r.status}</Badge>
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">{r.releaseNotes}</p>
                {r.featureFlags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {r.featureFlags.map((f) => <Badge key={f} variant="outline" className="border-white/10 text-[9px]">{f}</Badge>)}
                  </div>
                )}
                <p className="mt-1.5 text-[9px] text-muted-foreground">{r.releasedBy || 'pending'} · {r.releasedAt ? timeAgo(r.releasedAt) : timeAgo(r.createdAt)}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function ComponentsTab() {
  const [components, setComponents] = useState<Awaited<ReturnType<typeof import('@/lib/software-factory/engine').getComponents>> | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/dev/components');
        const json = await res.json();
        if (json.ok) setComponents(json.components);
      } catch { /* */ } finally { setLoading(false); }
    })();
  }, []);
  if (loading) return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>;
  if (!components || components.length === 0) {
    return (
      <Card className="glass-surface border-white/[0.06]">
        <CardContent className="p-8 text-center">
          <Layers className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Component library is populated as projects generate reusable components.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {components.map((c) => (
        <Card key={c.id} className="glass-surface border-white/[0.06]">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="border-white/10 text-[9px] uppercase">{c.kind}</Badge>
              <span className="text-[9px] text-muted-foreground">v{c.version}</span>
            </div>
            <p className="mt-2 truncate text-xs font-semibold text-foreground">{c.name}</p>
            <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{c.description}</p>
            <div className="mt-2 flex items-center justify-between text-[9px] text-muted-foreground">
              <span>{c.usageCount} uses</span>
              <span>{c.rating > 0 ? `★ ${c.rating.toFixed(1)}` : 'new'}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATES TAB
// ═══════════════════════════════════════════════════════════════════════════════

function TemplatesTab({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {APP_TEMPLATES.map((t) => (
        <Card key={t.id} className="glass-surface border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="border-white/10 text-[9px]">{t.category}</Badge>
              <span className="text-[9px] text-muted-foreground">{t.appType}</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">{t.name}</p>
            <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{t.description}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <Badge variant="outline" className="border-white/10 text-[9px]">{t.modules.pages.length} pages</Badge>
              <Badge variant="outline" className="border-white/10 text-[9px]">{t.modules.apis.length} APIs</Badge>
              <Badge variant="outline" className="border-white/10 text-[9px]">{t.modules.tables.length} tables</Badge>
            </div>
            <Button size="sm" variant="outline" onClick={() => onPick(t.examplePrompt)} className="mt-3 h-7 w-full gap-1.5 text-[10px]">
              <Sparkles className="h-3 w-3 accent-text" />Use template
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
