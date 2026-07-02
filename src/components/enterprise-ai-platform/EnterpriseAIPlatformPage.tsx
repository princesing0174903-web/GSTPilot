'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT ENTERPRISE AI PLATFORM™ — DEVELOPER PLATFORM CONSOLE
//
// Turns GSTPilot from an enterprise application into a platform developers &
// partners can build on. 12 subsystems, all extended on REAL connected data:
//
//   1.  Enterprise App Marketplace™  — browse + install apps
//   2.  Developer Platform™         — SDKs (TS/Python/Java/Go/PHP/Ruby)
//   3.  Enterprise Extensions™      — publish private apps
//   4.  Plugin System™              — install/uninstall/version tracking
//   5.  API Gateway™                — keys, rate limits, RBAC, usage
//   6.  Webhook Engine™             — subscriptions + real delivery
//   7.  Low-Code Studio™            — forms + workflows builder
//   8.  Enterprise App Store™       — reviews, ratings, revenue
//   9.  Enterprise Tenant Platform™ — unlimited orgs/users
//  10.  Observability™              — API/plugin/SDK/dev analytics
//  11.  Security™                   — RBAC, ABAC, sandbox, signatures
//  12.  Performance™                — millions of orgs, edge, multi-region
//
// Tagline: One Platform. Unlimited Enterprise Intelligence.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store, Code2, Puzzle, Plug, KeyRound, Webhook, LayoutDashboard,
  Package, Activity, ShieldCheck, Gauge, RefreshCw, Sparkles, Loader2,
  CheckCircle2, XCircle, Clock, Plus, Star, Download, Trash2, Send,
  Play, Key, Zap, TrendingUp, Search, ExternalLink, BookOpen, Users2,
  Crown, Rocket, Layers, Database, Server, Cpu, AlertTriangle,
  ChevronRight, type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  ECOSYSTEM_TAGLINE,
  ECOSYSTEM_SUBSYSTEMS,
  type EcosystemDashboard,
  type Extension,
  type ExtensionInstall,
  type WebhookSubscription,
  type FormField,
  type WorkflowTrigger,
} from '@/lib/ecosystem/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtINR(n: number): string {
  if (!isFinite(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function fmtNum(n: number): string {
  if (n >= 10000000) return `${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString('en-IN');
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-IN');
}

// ─── Subsystem pill data ──────────────────────────────────────────────────────
const SUBSYSTEM_PILLS: { name: string; icon: LucideIcon }[] = [
  { name: 'App Marketplace', icon: Store },
  { name: 'Developer Platform', icon: Code2 },
  { name: 'Enterprise Extensions', icon: Puzzle },
  { name: 'Plugin System', icon: Plug },
  { name: 'API Gateway', icon: KeyRound },
  { name: 'Webhook Engine', icon: Webhook },
  { name: 'Low-Code Studio', icon: LayoutDashboard },
  { name: 'App Store', icon: Package },
  { name: 'Tenant Platform', icon: Users2 },
  { name: 'Observability', icon: Activity },
  { name: 'Security', icon: ShieldCheck },
  { name: 'Performance', icon: Gauge },
];

// ─── Main component ───────────────────────────────────────────────────────────
export default function EnterpriseAIPlatformPage() {
  const { toast } = useToast();
  const [dashboard, setDashboard] = useState<EcosystemDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [search, setSearch] = useState('');

  // Dialog state
  const [publishOpen, setPublishOpen] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [apiKeyOpen, setApiKeyOpen] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ecosystem/dashboard', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as EcosystemDashboard;
      setDashboard(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ─── Action helpers ────────────────────────────────────────────────────────
  async function apiPost(endpoint: string, body: unknown): Promise<{ ok: boolean; data: unknown }> {
    try {
      const res = await fetch(`/api/ecosystem/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: 'Action failed', description: (data as { error?: string }).error ?? `HTTP ${res.status}`, variant: 'destructive' });
        return { ok: false, data };
      }
      return { ok: true, data };
    } catch (e) {
      toast({ title: 'Network error', description: e instanceof Error ? e.message : 'Unknown', variant: 'destructive' });
      return { ok: false, data: null };
    }
  }

  async function handleInstall(slug: string, name: string) {
    const { ok } = await apiPost('install-extension', { extensionSlug: slug });
    if (ok) {
      toast({ title: 'Extension installed', description: `${name} is now active in your workspace.` });
      load();
    }
  }

  async function handleUninstall(slug: string, name: string) {
    const { ok } = await apiPost('uninstall-extension', { extensionSlug: slug });
    if (ok) {
      toast({ title: 'Extension uninstalled', description: `${name} was removed.` });
      load();
    }
  }

  async function handleDeleteWebhook(id: string, label: string) {
    const { ok } = await apiPost('delete-webhook', { subscriptionId: id });
    if (ok) {
      toast({ title: 'Webhook deleted', description: label });
      load();
    }
  }

  async function handleEmitEvent(eventType: string) {
    const { ok, data } = await apiPost('emit-event', { eventType, payload: { triggered: 'manual', at: new Date().toISOString() } });
    if (ok) {
      const r = data as { delivered: number; failed: number; skipped: number };
      toast({ title: 'Event emitted', description: `${eventType} — ${r.delivered} delivered, ${r.failed} failed, ${r.skipped} skipped` });
      load();
    }
  }

  async function handleRunWorkflow(id: string, title: string) {
    const { ok } = await apiPost('run-workflow', { workflowId: id });
    if (ok) {
      toast({ title: 'Workflow executed', description: title });
      load();
    }
  }

  async function handleRevokeKey(id: string, name: string) {
    const { ok } = await apiPost('revoke-api-key', { apiKeyId: id });
    if (ok) {
      toast({ title: 'API key revoked', description: name, variant: 'destructive' });
      load();
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading && !dashboard) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
          <span className="text-lg font-semibold">Loading Enterprise AI Platform™…</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl bg-slate-800/60" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <Card className="max-w-md bg-slate-900 border-red-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-300">
              <AlertTriangle className="h-5 w-5" /> Failed to load platform
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-400">{error ?? 'Unknown error'}</p>
            <Button onClick={load} variant="outline" className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const d = dashboard;
  const filteredExtensions = d.extensions.filter(
    (e) =>
      e.displayName.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.category.toLowerCase().includes(search.toLowerCase()) ||
      e.publisher.toLowerCase().includes(search.toLowerCase()),
  );
  const installedSlugs = new Set(d.myInstalls.filter((i) => i.status === 'installed').map((i) => i.extensionSlug));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* ─── Header ─── */}
      <header className="border-b border-slate-800/60 bg-slate-950/70 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-300 to-teal-200 bg-clip-text text-transparent">
                Enterprise AI Platform™
              </h1>
              <p className="text-xs text-slate-400">{ECOSYSTEM_TAGLINE}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
              <CheckCircle2 className="h-3 w-3 mr-1" /> {d.subsystemsImplemented}/{d.subsystemsTotal} subsystems
            </Badge>
            <Badge variant="outline" className="border-sky-500/40 text-sky-300">
              <Database className="h-3 w-3 mr-1" /> {d.dataSources.length} sources
            </Badge>
            <Button onClick={load} variant="outline" size="sm" disabled={loading} className="border-slate-700">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 space-y-6 pb-20">
        {/* ─── Subsystem pills ─── */}
        <div className="flex flex-wrap gap-2">
          {SUBSYSTEM_PILLS.map((p) => {
            const Icon = p.icon;
            return (
              <span
                key={p.name}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-xs text-emerald-200"
              >
                <Icon className="h-3 w-3" /> {p.name}
              </span>
            );
          })}
        </div>

        {/* ─── Headline KPIs ─── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard icon={Package} label="Extensions" value={fmtNum(d.totalExtensions)} sub={`${d.publicExtensions} public · ${d.privateExtensions} private`} accent="emerald" />
          <KpiCard icon={Download} label="Total Installs" value={fmtNum(d.totalInstalls)} sub="across all orgs" accent="teal" />
          <KpiCard icon={Webhook} label="Active Webhooks" value={fmtNum(d.activeWebhooks)} sub={`${fmtNum(d.webhooks.totalDeliveries)} deliveries`} accent="sky" />
          <KpiCard icon={KeyRound} label="API Keys" value={fmtNum(d.totalApiKeys)} sub={`${fmtNum(d.apiCallsToday)} calls today`} accent="violet" />
          <KpiCard icon={Users2} label="Developers" value={fmtNum(d.totalDevelopers)} sub={`${d.developers.certifiedCount} certified`} accent="amber" />
          <KpiCard icon={TrendingUp} label="Marketplace Revenue" value={fmtINR(d.marketplaceRevenue)} sub="rolling 30d" accent="rose" />
        </div>

        {/* ─── Tabs ─── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <ScrollArea className="w-full">
            <TabsList className="bg-slate-900/60 border border-slate-800 h-auto flex flex-nowrap p-1 gap-1">
              {[
                ['overview', 'Overview', LayoutDashboard],
                ['marketplace', 'Marketplace', Store],
                ['my-apps', 'My Extensions', Puzzle],
                ['webhooks', 'Webhooks', Webhook],
                ['api-keys', 'API Keys', KeyRound],
                ['lowcode', 'Low-Code Studio', LayoutDashboard],
                ['observability', 'Observability', Activity],
                ['developers', 'Developers', Code2],
              ].map(([v, label, Icon]) => {
                const I = Icon as LucideIcon;
                return (
                  <TabsTrigger
                    key={v as string}
                    value={v as string}
                    className="data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-200 text-slate-300 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <I className="h-3.5 w-3.5" /> {label as string}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </ScrollArea>

          {/* ─── Overview ─── */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="bg-slate-900/60 border-slate-800 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-slate-100 flex items-center gap-2">
                    <Rocket className="h-5 w-5 text-emerald-400" /> Platform Snapshot
                  </CardTitle>
                  <CardDescription className="text-slate-400">Real-time platform health, derived from {d.dataSources.length} live data sources.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <StatRow label="Extensions published" value={`${d.totalExtensions} (${d.marketplace.paidApps} paid, ${d.marketplace.freeApps} free)`} />
                  <StatRow label="Total installs (all orgs)" value={fmtNum(d.marketplace.totalInstalls)} />
                  <StatRow label="Avg rating" value={`${d.marketplace.avgRating.toFixed(2)} ★ (${d.marketplace.totalReviews} reviews)`} />
                  <StatRow label="Active webhook subscriptions" value={fmtNum(d.webhooks.activeSubscriptions)} />
                  <StatRow label="Webhook delivery success rate" value={`${d.webhooks.successRate.toFixed(1)}%`} />
                  <StatRow label="API keys (active / revoked)" value={`${d.apiGateway.activeKeys} / ${d.apiGateway.revokedKeys}`} />
                  <StatRow label="API calls today / 30d" value={`${fmtNum(d.apiCallsToday)} / ${fmtNum(d.apiCalls30d)}`} />
                  <StatRow label="Low-code forms / workflows" value={`${d.lowCodeForms} / ${d.lowCodeWorkflows}`} />
                  <StatRow label="Registered developers" value={`${d.totalDevelopers} (${d.developers.strategicCount} strategic, ${d.developers.certifiedCount} certified)`} />
                  <Separator className="bg-slate-800" />
                  <StatRow label="Sandboxed installs" value={fmtNum(d.security.sandboxedExtensions)} />
                  <StatRow label="Audit events (30d)" value={fmtNum(d.security.auditEvents30d)} />
                  <StatRow label="Tenant isolation" value={d.security.tenantIsolation ? '✓ Enforced' : '✗ Off'} />
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-slate-100 flex items-center gap-2">
                    <Crown className="h-5 w-5 text-amber-400" /> Top Categories
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {d.marketplace.topCategories.slice(0, 8).map((c) => (
                    <div key={c.category} className="flex items-center justify-between text-sm">
                      <span className="capitalize text-slate-300">{c.category}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{c.count} apps</span>
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">{fmtNum(c.installs)}</Badge>
                      </div>
                    </div>
                  ))}
                  {d.marketplace.topCategories.length === 0 && (
                    <p className="text-sm text-slate-500">No categories yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <Layers className="h-5 w-5 text-sky-400" /> Featured Extensions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {d.marketplace.featured.slice(0, 6).map((e) => (
                    <ExtensionCard key={e.id} ext={e} installed={installedSlugs.has(e.slug)} onInstall={() => handleInstall(e.slug, e.displayName)} onUninstall={() => handleUninstall(e.slug, e.displayName)} compact />
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Marketplace ─── */}
          <TabsContent value="marketplace" className="space-y-4 mt-4">
            <Card className="bg-slate-900/60 border-slate-800">
              <CardContent className="pt-4 flex flex-col md:flex-row gap-3 md:items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Search apps by name, category, publisher…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-slate-950 border-slate-700 text-slate-100"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Package className="h-4 w-4" /> {filteredExtensions.length} of {d.extensions.length} apps
                  <Badge variant="outline" className="border-amber-500/40 text-amber-300 ml-2">{fmtINR(d.marketplace.revenue)} revenue</Badge>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredExtensions.map((e) => (
                <ExtensionCard
                  key={e.id}
                  ext={e}
                  installed={installedSlugs.has(e.slug)}
                  onInstall={() => handleInstall(e.slug, e.displayName)}
                  onUninstall={() => handleUninstall(e.slug, e.displayName)}
                />
              ))}
            </div>
            {filteredExtensions.length === 0 && (
              <Card className="bg-slate-900/60 border-slate-800">
                <CardContent className="py-12 text-center text-slate-400">
                  <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  No apps match your search.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ─── My Extensions ─── */}
          <TabsContent value="my-apps" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Installed Extensions</h2>
                <p className="text-sm text-slate-400">{d.myInstalls.filter((i) => i.status === 'installed').length} active in your workspace</p>
              </div>
              <Button onClick={() => setPublishOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4 mr-2" /> Publish Private App
              </Button>
            </div>

            {d.myInstalls.length === 0 ? (
              <Card className="bg-slate-900/60 border-slate-800">
                <CardContent className="py-12 text-center text-slate-400 space-y-3">
                  <Puzzle className="h-10 w-10 mx-auto opacity-50" />
                  <p>No extensions installed yet.</p>
                  <Button variant="outline" onClick={() => setActiveTab('marketplace')} className="border-slate-700">
                    Browse Marketplace <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {d.myInstalls.map((inst) => (
                  <InstallCard key={inst.id} inst={inst} onUninstall={() => handleUninstall(inst.extensionSlug, inst.extensionName)} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── Webhooks ─── */}
          <TabsContent value="webhooks" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Webhook Subscriptions</h2>
                <p className="text-sm text-slate-400">{d.webhooks.activeSubscriptions} active · {d.webhooks.successRate.toFixed(1)}% delivery success</p>
              </div>
              <Button onClick={() => setWebhookOpen(true)} className="bg-sky-600 hover:bg-sky-700">
                <Plus className="h-4 w-4 mr-2" /> New Webhook
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base">Subscriptions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                  {d.webhooks.subscriptions.length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">No subscriptions. Create one to receive events.</p>
                  ) : (
                    d.webhooks.subscriptions.map((s) => (
                      <WebhookRow key={s.id} sub={s} onDelete={() => handleDeleteWebhook(s.id, s.label)} />
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base">Event Catalog</CardTitle>
                  <CardDescription className="text-slate-400">Fire any event to test your subscriptions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1.5 max-h-96 overflow-y-auto">
                  {d.webhooks.eventCatalog.map((ev) => (
                    <div key={ev.type} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-emerald-300">{ev.type}</code>
                          <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px]">{ev.module}</Badge>
                        </div>
                        <p className="text-xs text-slate-500 truncate">{ev.description}</p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleEmitEvent(ev.type)} className="text-sky-300 hover:text-sky-200 h-7 px-2">
                        <Send className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100 text-base">Recent Deliveries</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 max-h-80 overflow-y-auto">
                {d.webhooks.recentDeliveries.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">No deliveries yet. Emit an event to test.</p>
                ) : (
                  d.webhooks.recentDeliveries.map((dl) => (
                    <div key={dl.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        {dl.status === 'success' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                        <code className="text-emerald-300 truncate">{dl.eventType}</code>
                        <span className="text-slate-500">{timeAgo(dl.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        {dl.statusCode && <Badge variant="outline" className="border-slate-700 text-[10px]">{dl.statusCode}</Badge>}
                        {dl.responseMs != null && <span>{dl.responseMs}ms</span>}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── API Keys ─── */}
          <TabsContent value="api-keys" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">API Keys</h2>
                <p className="text-sm text-slate-400">{d.apiGateway.activeKeys} active · {d.apiGateway.revokedKeys} revoked · {fmtNum(d.apiGateway.callsToday)} calls today</p>
              </div>
              <Button onClick={() => setApiKeyOpen(true)} className="bg-violet-600 hover:bg-violet-700">
                <Plus className="h-4 w-4 mr-2" /> Create API Key
              </Button>
            </div>

            {newApiKey && (
              <Card className="bg-emerald-950/40 border-emerald-500/40">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <Key className="h-5 w-5 text-emerald-300 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-emerald-200">Your new API key — copy it now, it won&apos;t be shown again.</p>
                      <code className="block mt-2 px-3 py-2 rounded bg-slate-950 border border-emerald-500/30 text-emerald-300 text-xs break-all font-mono">{newApiKey}</code>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(newApiKey)} className="border-emerald-500/40 text-emerald-200">
                      Copy
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setNewApiKey(null)} className="text-slate-400">Dismiss</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-slate-900/60 border-slate-800">
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <MiniStat label="Error rate" value={`${d.apiGateway.errorRatePct.toFixed(2)}%`} />
                  <MiniStat label="Avg latency" value={`${Math.round(d.apiGateway.avgLatencyMs)}ms`} />
                  <MiniStat label="p95 latency" value={`${Math.round(d.apiGateway.p95LatencyMs)}ms`} />
                  <MiniStat label="Rate limit" value={`${d.apiGateway.rateLimits.perMin}/min`} />
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {d.apiGateway.authModes.map((m) => (
                    <Badge key={m} variant="outline" className="border-violet-500/40 text-violet-300">{m}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100 text-base">Your Keys</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {d.apiGateway.keys.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">No API keys yet. Create one to start building.</p>
                ) : (
                  d.apiGateway.keys.map((k) => (
                    <div key={k.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-200">{k.name}</span>
                          {k.status === 'active' ? (
                            <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 text-[10px]">active</Badge>
                          ) : (
                            <Badge variant="outline" className="border-red-500/40 text-red-300 text-[10px]">{k.status}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                          <code className="font-mono">{k.keyPrefix}…</code>
                          <span>· {fmtNum(k.callsTotal)} calls · last used {timeAgo(k.lastUsedAt)}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {k.scopes.map((s) => (
                            <Badge key={s} variant="outline" className="border-slate-700 text-slate-400 text-[10px]">{s}</Badge>
                          ))}
                        </div>
                      </div>
                      {k.status === 'active' && (
                        <Button size="sm" variant="ghost" onClick={() => handleRevokeKey(k.id, k.name)} className="text-red-300 hover:text-red-200 h-7">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Low-Code Studio ─── */}
          <TabsContent value="lowcode" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat label="Forms" value={fmtNum(d.lowCode.totalForms)} />
              <MiniStat label="Submissions" value={fmtNum(d.lowCode.totalSubmissions)} />
              <MiniStat label="Workflows" value={fmtNum(d.lowCode.totalWorkflows)} />
              <MiniStat label="Workflow runs" value={fmtNum(d.lowCode.totalRuns)} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-slate-100 text-base">Forms</CardTitle>
                  <Button size="sm" onClick={() => setFormOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 h-7">
                    <Plus className="h-3.5 w-3.5 mr-1" /> New Form
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                  {d.lowCode.forms.length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">No forms yet.</p>
                  ) : (
                    d.lowCode.forms.map((f) => (
                      <div key={f.id} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-200">{f.title}</span>
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 text-[10px]">{f.submissionsCount} submits</Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{f.schema.length} fields · /{f.slug}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-slate-100 text-base">Workflows</CardTitle>
                  <Button size="sm" onClick={() => setWorkflowOpen(true)} className="bg-sky-600 hover:bg-sky-700 h-7">
                    <Plus className="h-3.5 w-3.5 mr-1" /> New Workflow
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                  {d.lowCode.workflows.length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">No workflows yet.</p>
                  ) : (
                    d.lowCode.workflows.map((w) => (
                      <div key={w.id} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-200">{w.title}</span>
                          <Button size="sm" variant="ghost" onClick={() => handleRunWorkflow(w.id, w.title)} className="text-sky-300 hover:text-sky-200 h-6 px-2">
                            <Play className="h-3 w-3 mr-1" /> Run
                          </Button>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                          <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px]">{w.trigger}</Badge>
                          <span>{w.steps.length} steps · {w.runsCount} runs · {w.successRate.toFixed(0)}% success</span>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100 text-base">Recent Submissions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 max-h-72 overflow-y-auto">
                {d.lowCode.recentSubmissions.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">No submissions yet.</p>
                ) : (
                  d.lowCode.recentSubmissions.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <span className="text-slate-200">{s.formTitle}</span>
                        <span className="text-slate-500 ml-2">{s.submitterEmail ?? 'anonymous'}</span>
                      </div>
                      <span className="text-slate-500">{timeAgo(s.createdAt)}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Observability ─── */}
          <TabsContent value="observability" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat label="API calls today" value={fmtNum(d.observability.apiCallsToday)} />
              <MiniStat label="API calls (7d)" value={fmtNum(d.observability.apiCalls7d)} />
              <MiniStat label="Error rate" value={`${d.observability.errorRatePct.toFixed(2)}%`} />
              <MiniStat label="Avg latency" value={`${Math.round(d.observability.avgLatencyMs)}ms`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base">7-Day API Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between gap-2 h-40">
                    {d.observability.callsByDay.map((day) => {
                      const max = Math.max(1, ...d.observability.callsByDay.map((x) => x.calls));
                      const h = (day.calls / max) * 100;
                      return (
                        <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full rounded-t bg-gradient-to-t from-emerald-600 to-teal-400" style={{ height: `${Math.max(4, h)}%` }} title={`${day.calls} calls`} />
                          <span className="text-[10px] text-slate-500">{day.date.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base">Top Endpoints</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 max-h-52 overflow-y-auto">
                  {d.observability.callsByEndpoint.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4 text-center">No endpoint traffic logged yet.</p>
                  ) : (
                    d.observability.callsByEndpoint.map((e) => (
                      <div key={e.endpoint} className="flex items-center justify-between text-xs">
                        <code className="text-slate-300 truncate font-mono">{e.endpoint}</code>
                        <div className="flex items-center gap-2 text-slate-500">
                          <span>{fmtNum(e.calls)} calls</span>
                          {e.errors > 0 && <Badge variant="outline" className="border-red-500/40 text-red-300 text-[10px]">{e.errors} err</Badge>}
                          <span>{Math.round(e.avgMs)}ms</span>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base">Plugin Usage</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {d.observability.pluginUsage.map((p) => (
                    <div key={p.plugin} className="flex items-center justify-between text-sm">
                      <span className="text-slate-200">{p.plugin}</span>
                      <span className="text-slate-400">{fmtNum(p.installs)} installs</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base">SDK Activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {d.observability.sdkActivity.map((s) => (
                    <div key={s.sdk} className="flex items-center justify-between text-sm">
                      <code className="text-slate-300 font-mono">{s.sdk}</code>
                      <span className="text-slate-400">{fmtNum(s.downloads)} downloads</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100 text-base">Developer Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {d.observability.developerActivity.map((a) => (
                    <div key={a.metric} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-center">
                      <div className="text-lg font-semibold text-emerald-300">{fmtNum(a.value)}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{a.metric}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Developers ─── */}
          <TabsContent value="developers" className="space-y-4 mt-4">
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <Code2 className="h-5 w-5 text-amber-400" /> SDK Catalog
                </CardTitle>
                <CardDescription className="text-slate-400">Official SDKs across 6 languages.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {d.developers.sdks.map((s) => (
                    <div key={s.language} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-100">{s.language}</span>
                        <Badge variant="outline" className="border-amber-500/40 text-amber-300 text-[10px]">v{s.version}</Badge>
                      </div>
                      <code className="block mt-2 text-xs text-emerald-300 font-mono break-all">{s.package}</code>
                      <code className="block mt-1 text-[11px] text-slate-400 font-mono break-all">$ {s.installCommand}</code>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {s.authSupport.map((a) => (
                          <Badge key={a} variant="outline" className="border-slate-700 text-slate-400 text-[10px]">{a}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <Users2 className="h-5 w-5 text-sky-400" /> Registered Developers
                </CardTitle>
                <CardDescription className="text-slate-400">{d.developers.totalDevelopers} total · {d.developers.certifiedCount} certified · {d.developers.strategicCount} strategic · {fmtNum(d.developers.totalInstalls)} total installs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5 max-h-96 overflow-y-auto">
                {d.developers.developers.map((dev) => (
                  <div key={dev.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-200">{dev.name}</span>
                        <code className="text-xs text-slate-500">@{dev.handle}</code>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                        <span>{dev.appsPublished} apps</span>
                        <span>· {fmtNum(dev.totalInstalls)} installs</span>
                        <span>· joined {timeAgo(dev.joinedAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TierBadge tier={dev.tier} />
                      <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px]">{dev.status}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ─── Footer ─── */}
        <footer className="pt-6 mt-6 border-t border-slate-800/60 text-center text-xs text-slate-500">
          <p className="font-semibold text-slate-400">{ECOSYSTEM_TAGLINE}</p>
          <p className="mt-1">{d.subsystemsImplemented}/{d.subsystemsTotal} subsystems · {ECOSYSTEM_SUBSYSTEMS.length} specified · all values derived from {d.dataSources.length} live data sources</p>
        </footer>
      </main>

      {/* ─── Publish Extension Dialog ─── */}
      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} onDone={load} apiPost={apiPost} />

      {/* ─── Create Webhook Dialog ─── */}
      <WebhookDialog open={webhookOpen} onOpenChange={setWebhookOpen} onDone={load} apiPost={apiPost} eventCatalog={d.webhooks.eventCatalog.map((e) => e.type)} />

      {/* ─── Create Form Dialog ─── */}
      <FormDialog open={formOpen} onOpenChange={setFormOpen} onDone={load} apiPost={apiPost} />

      {/* ─── Create Workflow Dialog ─── */}
      <WorkflowDialog open={workflowOpen} onOpenChange={setWorkflowOpen} onDone={load} apiPost={apiPost} />

      {/* ─── Create API Key Dialog ─── */}
      <ApiKeyDialog
        open={apiKeyOpen}
        onOpenChange={setApiKeyOpen}
        onCreated={(full) => { setNewApiKey(full); load(); }}
        apiPost={apiPost}
      />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const ACCENT_MAP: Record<string, string> = {
  emerald: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/30 text-emerald-300',
  teal: 'from-teal-500/20 to-teal-600/5 border-teal-500/30 text-teal-300',
  sky: 'from-sky-500/20 to-sky-600/5 border-sky-500/30 text-sky-300',
  violet: 'from-violet-500/20 to-violet-600/5 border-violet-500/30 text-violet-300',
  amber: 'from-amber-500/20 to-amber-600/5 border-amber-500/30 text-amber-300',
  rose: 'from-rose-500/20 to-rose-600/5 border-rose-500/30 text-rose-300',
};

function KpiCard({ icon: Icon, label, value, sub, accent }: { icon: LucideIcon; label: string; value: string; sub: string; accent: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border bg-gradient-to-br p-4 ${ACCENT_MAP[accent] ?? ACCENT_MAP.emerald}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{label}</span>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <div className="mt-1 text-2xl font-bold text-slate-100">{value}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>
    </motion.div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
      <div className="text-lg font-semibold text-slate-100">{value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-200 font-medium text-right">{value}</span>
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const map: Record<string, string> = {
    strategic: 'border-amber-500/40 text-amber-300 bg-amber-500/10',
    certified: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10',
    partner: 'border-sky-500/40 text-sky-300 bg-sky-500/10',
    individual: 'border-slate-600 text-slate-400',
  };
  return <Badge variant="outline" className={`text-[10px] ${map[tier] ?? map.individual}`}>{tier}</Badge>;
}

function ExtensionCard({
  ext,
  installed,
  onInstall,
  onUninstall,
  compact,
}: {
  ext: Extension;
  installed: boolean;
  onInstall: () => void;
  onUninstall: () => void;
  compact?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-100 truncate">{ext.displayName}</h3>
            <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px] shrink-0">v{ext.version}</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">by {ext.publisher}</p>
        </div>
        <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 text-[10px] shrink-0 capitalize">{ext.kind}</Badge>
      </div>

      {!compact && <p className="text-sm text-slate-400 mt-2 line-clamp-2">{ext.description}</p>}

      <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
        <span className="capitalize">{ext.category}</span>
        <span className="flex items-center gap-0.5">
          <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
          {ext.ratingAvg > 0 ? ext.ratingAvg.toFixed(1) : '—'} ({ext.ratingCount})
        </span>
        <span className="flex items-center gap-0.5">
          <Download className="h-3 w-3" /> {fmtNum(ext.installCount)}
        </span>
        {ext.pricingModel !== 'free' && (
          <Badge variant="outline" className="border-amber-500/40 text-amber-300 text-[10px]">{fmtINR(ext.priceInr)}/{ext.pricingModel === 'one_time' ? 'once' : 'mo'}</Badge>
        )}
        {ext.pricingModel === 'free' && (
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 text-[10px]">Free</Badge>
        )}
      </div>

      <div className="mt-auto pt-3">
        {installed ? (
          <Button size="sm" variant="outline" onClick={onUninstall} className="w-full border-red-500/40 text-red-300 hover:bg-red-500/10 h-8">
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Uninstall
          </Button>
        ) : (
          <Button size="sm" onClick={onInstall} className="w-full bg-emerald-600 hover:bg-emerald-700 h-8">
            <Download className="h-3.5 w-3.5 mr-1.5" /> Install
          </Button>
        )}
      </div>
    </motion.div>
  );
}

function InstallCard({ inst, onUninstall }: { inst: ExtensionInstall; onUninstall: () => void }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-100 truncate">{inst.extensionName}</h3>
            <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px] shrink-0">v{inst.version}</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">installed {timeAgo(inst.createdAt)}</p>
        </div>
        <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 text-[10px] shrink-0 capitalize">{inst.status}</Badge>
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {inst.permissions.slice(0, 4).map((p) => (
          <Badge key={p} variant="outline" className="border-slate-700 text-slate-400 text-[10px]">{p}</Badge>
        ))}
        {inst.permissions.length > 4 && (
          <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px]">+{inst.permissions.length - 4}</Badge>
        )}
      </div>
      <div className="mt-3">
        <Button size="sm" variant="outline" onClick={onUninstall} className="w-full border-red-500/40 text-red-300 hover:bg-red-500/10 h-8">
          <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Uninstall
        </Button>
      </div>
    </div>
  );
}

function WebhookRow({ sub, onDelete }: { sub: WebhookSubscription; onDelete: () => void }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-200">{sub.label}</span>
        <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-300 hover:text-red-200 h-6 px-2">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
        <code className="font-mono truncate max-w-[200px]">{sub.targetUrl}</code>
      </div>
      <div className="flex items-center gap-2 mt-1 text-xs">
        {sub.status === 'active' ? (
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 text-[10px]">active</Badge>
        ) : sub.status === 'failing' ? (
          <Badge variant="outline" className="border-amber-500/40 text-amber-300 text-[10px]">failing</Badge>
        ) : (
          <Badge variant="outline" className="border-slate-600 text-slate-400 text-[10px]">{sub.status}</Badge>
        )}
        <span className="text-slate-500">{sub.deliveries} deliveries · {sub.successRate.toFixed(0)}% success</span>
      </div>
      <div className="flex flex-wrap gap-1 mt-1">
        {sub.eventTypes.slice(0, 3).map((e) => (
          <Badge key={e} variant="outline" className="border-slate-700 text-slate-400 text-[10px]">{e}</Badge>
        ))}
        {sub.eventTypes.length > 3 && (
          <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px]">+{sub.eventTypes.length - 3}</Badge>
        )}
      </div>
    </div>
  );
}

// ─── Dialogs ──────────────────────────────────────────────────────────────────
type ApiPostFn = (endpoint: string, body: unknown) => Promise<{ ok: boolean; data: unknown }>;

function PublishDialog({ open, onOpenChange, onDone, apiPost }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void; apiPost: ApiPostFn }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState('app');
  const [category, setCategory] = useState('ai');
  const [version, setVersion] = useState('1.0.0');
  const [permissions, setPermissions] = useState('read,write');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!name) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    setSubmitting(true);
    const { ok } = await apiPost('publish-extension', {
      name, displayName: name, description, kind, category, version,
      permissions: permissions.split(',').map((s) => s.trim()).filter(Boolean),
      visibility: 'private', pricingModel: 'free',
    });
    setSubmitting(false);
    if (ok) {
      toast({ title: 'Extension published', description: `${name} is now in your private app store.` });
      setName(''); setDescription(''); setPermissions('read,write'); setVersion('1.0.0');
      onOpenChange(false); onDone();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish Private App</DialogTitle>
          <DialogDescription className="text-slate-400">Add an extension to your organisation&apos;s private app store.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-slate-300">App Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Custom Tool" className="bg-slate-950 border-slate-700 mt-1" />
          </div>
          <div>
            <Label className="text-slate-300">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this app do?" className="bg-slate-950 border-slate-700 mt-1 min-h-20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-300">Kind</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger className="bg-slate-950 border-slate-700 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {['app', 'agent', 'workflow', 'dashboard', 'connector', 'template', 'report', 'compliance_pack', 'plugin'].map((k) => (
                    <SelectItem key={k} value={k} className="capitalize">{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-slate-950 border-slate-700 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {['hr', 'banking', 'crm', 'manufacturing', 'retail', 'logistics', 'healthcare', 'legal', 'tax', 'ai'].map((k) => (
                    <SelectItem key={k} value={k} className="capitalize">{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-300">Version</Label>
              <Input value={version} onChange={(e) => setVersion(e.target.value)} className="bg-slate-950 border-slate-700 mt-1" />
            </div>
            <div>
              <Label className="text-slate-300">Permissions (comma-separated)</Label>
              <Input value={permissions} onChange={(e) => setPermissions(e.target.value)} placeholder="read,write,ai:execute" className="bg-slate-950 border-slate-700 mt-1" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-700">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WebhookDialog({ open, onOpenChange, onDone, apiPost, eventCatalog }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void; apiPost: ApiPostFn; eventCatalog: string[] }) {
  const { toast } = useToast();
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>(['*']);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!label || !url) { toast({ title: 'Label and URL required', variant: 'destructive' }); return; }
    setSubmitting(true);
    const { ok } = await apiPost('create-webhook', { label, targetUrl: url, eventTypes: events });
    setSubmitting(false);
    if (ok) {
      toast({ title: 'Webhook created', description: 'A signing secret was generated.' });
      setLabel(''); setUrl(''); setEvents(['*']);
      onOpenChange(false); onDone();
    }
  }

  function toggleEvent(ev: string) {
    setEvents((cur) => {
      if (ev === '*') return cur.includes('*') ? cur.filter((e) => e !== '*') : ['*'];
      const without = cur.filter((e) => e !== '*');
      return without.includes(ev) ? without.filter((e) => e !== ev) : [...without, ev];
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg">
        <DialogHeader>
          <DialogTitle>New Webhook Subscription</DialogTitle>
          <DialogDescription className="text-slate-400">Receive real-time event deliveries with HMAC signing.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-slate-300">Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Notify Slack on invoice paid" className="bg-slate-950 border-slate-700 mt-1" />
          </div>
          <div>
            <Label className="text-slate-300">Target URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.example.com/gstpilot" className="bg-slate-950 border-slate-700 mt-1" />
          </div>
          <div>
            <Label className="text-slate-300">Events to subscribe</Label>
            <div className="mt-1 max-h-44 overflow-y-auto rounded border border-slate-700 bg-slate-950 p-2 space-y-1">
              <button onClick={() => toggleEvent('*')} className={`w-full text-left px-2 py-1 rounded text-xs ${events.includes('*') ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400'}`}>
                * (all events)
              </button>
              {eventCatalog.filter((e) => e !== '*').map((ev) => (
                <button key={ev} onClick={() => toggleEvent(ev)} className={`w-full text-left px-2 py-1 rounded text-xs ${events.includes(ev) ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400'}`}>
                  {ev}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-700">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="bg-sky-600 hover:bg-sky-700">
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormDialog({ open, onOpenChange, onDone, apiPost }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void; apiPost: ApiPostFn }) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fieldsText, setFieldsText] = useState('Name|text\nEmail|email\nMessage|textarea');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!title) { toast({ title: 'Title required', variant: 'destructive' }); return; }
    const schema: FormField[] = fieldsText
      .split('\n')
      .filter((l) => l.trim() && l.includes('|'))
      .map((l, i) => {
        const [label, type] = l.split('|').map((s) => s.trim());
        return {
          id: `f${i + 1}`,
          type: (type || 'text') as FormField['type'],
          label,
          key: label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
          required: true,
        };
      });
    setSubmitting(true);
    const { ok } = await apiPost('create-form', { title, description, schema });
    setSubmitting(false);
    if (ok) {
      toast({ title: 'Form created', description: `${schema.length} fields` });
      setTitle(''); setDescription(''); setFieldsText('Name|text\nEmail|email\nMessage|textarea');
      onOpenChange(false); onDone();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg">
        <DialogHeader>
          <DialogTitle>New Low-Code Form</DialogTitle>
          <DialogDescription className="text-slate-400">Define fields as <code className="text-emerald-300">Label|type</code> one per line.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-slate-300">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Customer Feedback" className="bg-slate-950 border-slate-700 mt-1" />
          </div>
          <div>
            <Label className="text-slate-300">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="bg-slate-950 border-slate-700 mt-1" />
          </div>
          <div>
            <Label className="text-slate-300">Fields</Label>
            <Textarea value={fieldsText} onChange={(e) => setFieldsText(e.target.value)} className="bg-slate-950 border-slate-700 mt-1 min-h-28 font-mono text-xs" />
            <p className="text-[11px] text-slate-500 mt-1">Types: text, email, number, textarea, select, checkbox, date, tel</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-700">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create Form
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkflowDialog({ open, onOpenChange, onDone, apiPost }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void; apiPost: ApiPostFn }) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [trigger, setTrigger] = useState<WorkflowTrigger>('manual');
  const [stepsText, setStepsText] = useState('action|Create record\nnotify|Send email\nai|Generate insight');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!title) { toast({ title: 'Title required', variant: 'destructive' }); return; }
    const steps = stepsText
      .split('\n')
      .filter((l) => l.trim() && l.includes('|'))
      .map((l, i) => {
        const [type, name] = l.split('|').map((s) => s.trim());
        return { id: `s${i + 1}`, type: type || 'action', name: name || `Step ${i + 1}`, config: {} };
      });
    setSubmitting(true);
    const { ok } = await apiPost('create-workflow', { title, description, trigger, steps });
    setSubmitting(false);
    if (ok) {
      toast({ title: 'Workflow created', description: `${steps.length} steps` });
      setTitle(''); setDescription(''); setTrigger('manual'); setStepsText('action|Create record\nnotify|Send email\nai|Generate insight');
      onOpenChange(false); onDone();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg">
        <DialogHeader>
          <DialogTitle>New Low-Code Workflow</DialogTitle>
          <DialogDescription className="text-slate-400">Define steps as <code className="text-emerald-300">type|name</code> one per line.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-slate-300">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lead Nurture Sequence" className="bg-slate-950 border-slate-700 mt-1" />
          </div>
          <div>
            <Label className="text-slate-300">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="bg-slate-950 border-slate-700 mt-1" />
          </div>
          <div>
            <Label className="text-slate-300">Trigger</Label>
            <Select value={trigger} onValueChange={(v) => setTrigger(v as WorkflowTrigger)}>
              <SelectTrigger className="bg-slate-950 border-slate-700 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {['manual', 'form.submitted', 'invoice.created', 'payment.received', 'gst.filed', 'lead.won', 'schedule', 'webhook'].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-slate-300">Steps</Label>
            <Textarea value={stepsText} onChange={(e) => setStepsText(e.target.value)} className="bg-slate-950 border-slate-700 mt-1 min-h-28 font-mono text-xs" />
            <p className="text-[11px] text-slate-500 mt-1">Types: action, condition, delay, notify, ai, transform</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-700">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="bg-sky-600 hover:bg-sky-700">
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create Workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApiKeyDialog({ open, onOpenChange, onCreated, apiPost }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (fullKey: string) => void; apiPost: ApiPostFn }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState('read');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!name) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    setSubmitting(true);
    const { ok, data } = await apiPost('create-api-key', {
      name,
      scopes: scopes.split(',').map((s) => s.trim()).filter(Boolean),
    });
    setSubmitting(false);
    if (ok && data && typeof data === 'object' && 'apiKey' in data) {
      const full = (data as { apiKey: { fullKey: string } }).apiKey.fullKey;
      setName(''); setScopes('read');
      onOpenChange(false);
      onCreated(full);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-md">
        <DialogHeader>
          <DialogTitle>Create API Key</DialogTitle>
          <DialogDescription className="text-slate-400">The full key will be shown once. Store it securely.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-slate-300">Key Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Production backend" className="bg-slate-950 border-slate-700 mt-1" />
          </div>
          <div>
            <Label className="text-slate-300">Scopes (comma-separated)</Label>
            <Input value={scopes} onChange={(e) => setScopes(e.target.value)} placeholder="read,write,billing" className="bg-slate-950 border-slate-700 mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-700">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="bg-violet-600 hover:bg-violet-700">
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create Key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
