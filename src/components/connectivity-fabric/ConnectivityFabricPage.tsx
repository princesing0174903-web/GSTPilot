'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT GLOBAL CONNECTIVITY FABRIC™ — UNIVERSAL BUSINESS NETWORK
//
// The Universal Business Connectivity Platform.
// Connect Everything. Synchronize Everything. Automate Everything.
//
// Every external service, bank, government portal, ERP, CRM, communication
// platform, payment gateway, cloud provider, accounting software, logistics
// network, AI provider, and enterprise application becomes part of one unified
// Business Graph — all backed by REAL connected production data.
//
// Sections:
//   1. Executive KPI Row (12 live metrics)
//   2. Universal Connector Catalog (200+ real connectors across 18 categories)
//   3. Installed Connectors (install / authenticate / test / sync / uninstall)
//   4. Connectivity Health Center (latency, reliability, expiry, freshness)
//   5. Event Stream (Invoice Paid, GST Filed, Payment Received, …)
//   6. Universal Data Synchronization (15 entities, real record counts)
//   7. Connector Logs (audit-grade execution log)
//   8. Marketplace (developers publish, orgs install, reviews, licensing)
//   9. Document Intelligence (auto-extract structured data)
//  10. Security Posture (OAuth, mTLS, Zero Trust, token rotation)
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Globe, Plug, PlugZap, Shield, Activity, Database, Webhook, RefreshCw,
  Server, Cloud, Cpu, Landmark, FileText, MessageCircle, Banknote, Truck,
  ShoppingBag, BarChart3, Code2, Users, Wallet, Search, Star, Download,
  CheckCircle2, XCircle, Clock, AlertTriangle, Loader2, Zap, Key, Lock,
  RotateCw, Eye, EyeOff, Plus, Trash2, Send, ChevronRight, Boxes,
  FileSearch, GitBranch, Layers, type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  CATEGORY_LABELS,
  type ConnectorCategory,
  type ConnectivityDashboard,
  type InstalledConnector,
  type ConnectorHealth,
  type ConnectorEventRecord,
  type ConnectorLogRecord,
  type SyncJobRecord,
  type MarketplaceListing,
  type DocumentIntelligenceResult,
  type ConnectorDefinition,
} from '@/lib/connectivity/types';
import { CONNECTOR_CATALOG, listByCategory, TOTAL_CATALOG_CONNECTORS } from '@/lib/connectivity/registry';

// ─── Helpers ──────────────────────────────────────────────────────────────────────
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
  if (['active', 'success', 'completed', 'healthy', 'in_sync', 'info'].includes(status)) return 'text-emerald-400';
  if (['error', 'failed', 'down', 'expired', 'revoked', 'critical', 'out_of_sync', 'cancelled'].includes(status)) return 'text-red-400';
  if (['syncing', 'running', 'queued', 'partial', 'degraded', 'warn', 'medium', 'high', 'expiring_soon'].includes(status)) return 'text-amber-400';
  if (['inactive', 'low', 'never_synced'].includes(status)) return 'text-muted-foreground';
  return 'text-muted-foreground';
}

function severityBadge(sev: string): string {
  if (sev === 'critical') return 'bg-red-500/15 text-red-300 border-red-500/30';
  if (sev === 'high') return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
  if (sev === 'medium') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  if (sev === 'low') return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
  return 'bg-white/[0.04] text-muted-foreground border-white/[0.08]';
}

function levelColor(level: string): string {
  if (level === 'critical') return 'text-red-400';
  if (level === 'error') return 'text-red-400';
  if (level === 'warn') return 'text-amber-400';
  if (level === 'info') return 'text-sky-400';
  return 'text-muted-foreground';
}

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// ─── Category icons ──────────────────────────────────────────────────────────────
const CATEGORY_ICONS: Record<ConnectorCategory, LucideIcon> = {
  banking: Landmark,
  government: FileText,
  communication: MessageCircle,
  cloud: Cloud,
  erp: Boxes,
  crm: Users,
  accounting: BarChart3,
  ai: Cpu,
  payments: Wallet,
  storage: Database,
  ecommerce: ShoppingBag,
  logistics: Truck,
  iot: Activity,
  pos: Banknote,
  analytics: BarChart3,
  devtools: Code2,
  hrms: Users,
  payroll: Wallet,
};

// ─── KPI Card ────────────────────────────────────────────────────────────────────
function KPICard({ icon: Icon, label, value, sub, accent }: {
  icon: LucideIcon; label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <Card className="bg-white/[0.03] border-white/[0.08] overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className={`text-xl font-bold mt-1 ${accent ?? 'text-foreground'}`}>{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
          </div>
          <div className="shrink-0 rounded-lg bg-white/[0.04] p-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────────
export default function ConnectivityFabricPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<ConnectivityDashboard | null>(null);
  const [tab, setTab] = useState('catalog');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<ConnectorCategory | 'all'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/connectivity');
      if (res.ok) {
        const data = await res.json();
        setDashboard(data);
      }
    } catch (err) {
      console.warn('[Connectivity] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30_000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  // ─── Actions ─────────────────────────────────────────────────────────────────
  const handleInstall = async (def: ConnectorDefinition) => {
    setActionLoading(`install-${def.key}`);
    try {
      const res = await fetch('/api/connectivity/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectorKey: def.key, displayName: def.name }),
      });
      const result = await res.json();
      toast({
        title: result.success ? 'Connector installed' : 'Install failed',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
      if (result.success) fetchDashboard();
    } catch (err) {
      toast({ title: 'Install failed', description: String(err), variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleAuthenticate = async (connectorId: string) => {
    setActionLoading(`auth-${connectorId}`);
    try {
      const res = await fetch('/api/connectivity/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectorId }),
      });
      const result = await res.json();
      toast({
        title: result.success ? 'Authenticated' : 'Authentication failed',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
      if (result.success) fetchDashboard();
    } catch (err) {
      toast({ title: 'Authentication failed', description: String(err), variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleTest = async (connectorId: string) => {
    setActionLoading(`test-${connectorId}`);
    try {
      const res = await fetch('/api/connectivity/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectorId }),
      });
      const result = await res.json();
      toast({
        title: result.success ? 'Test passed' : 'Test failed',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
      if (result.success) fetchDashboard();
    } catch (err) {
      toast({ title: 'Test failed', description: String(err), variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSync = async (connectorId: string) => {
    setActionLoading(`sync-${connectorId}`);
    try {
      const res = await fetch('/api/connectivity/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectorId, trigger: 'manual' }),
      });
      const result = await res.json();
      toast({
        title: result.success ? 'Sync completed' : 'Sync failed',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
      if (result.success) fetchDashboard();
    } catch (err) {
      toast({ title: 'Sync failed', description: String(err), variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUninstall = async (connectorId: string, provider: string) => {
    if (!confirm(`Uninstall ${provider}? All credentials will be revoked.`)) return;
    setActionLoading(`uninstall-${connectorId}`);
    try {
      const res = await fetch('/api/connectivity/uninstall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectorId }),
      });
      const result = await res.json();
      toast({
        title: result.success ? 'Uninstalled' : 'Uninstall failed',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
      if (result.success) fetchDashboard();
    } catch (err) {
      toast({ title: 'Uninstall failed', description: String(err), variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Derived state ───────────────────────────────────────────────────────────
  const installedKeys = new Set((dashboard?.installed ?? []).map((i) => i.connectorKey));
  const filteredCatalog = CONNECTOR_CATALOG.filter((c) => {
    if (activeCategory !== 'all' && c.category !== activeCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.provider.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
    }
    return true;
  });

  // ─── Render ──────────────────────────────────────────────────────────────────
  if (loading || !dashboard) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-12 w-2/3" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 min-h-screen">
      {/* ─── Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-gradient-to-br from-emerald-500/20 to-sky-500/20 p-2">
                <Globe className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight">Global Connectivity Fabric™</h1>
                <p className="text-xs md:text-sm text-muted-foreground">{dashboard.tagline}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-emerald-300 border-emerald-500/30 bg-emerald-500/10">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {fmt(dashboard.totalAvailableConnectors)} connectors
            </Badge>
            <Badge variant="outline" className="text-sky-300 border-sky-500/30 bg-sky-500/10">
              <Activity className="h-3 w-3 mr-1" />
              {dashboard.activeConnectors} active
            </Badge>
            <Button size="sm" variant="outline" onClick={fetchDashboard}>
              <RefreshCw className="h-3 w-3 mr-1" /> Refresh
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">{dashboard.subtagline} — {dashboard.founder}</p>
      </motion.div>

      {/* ─── KPI Row ─── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
      >
        <KPICard icon={Plug} label="Total Connectors" value={fmt(dashboard.totalAvailableConnectors)} sub="in catalog" accent="text-emerald-400" />
        <KPICard icon={PlugZap} label="Installed" value={dashboard.totalInstalled} sub={`${dashboard.activeConnectors} active`} accent="text-sky-400" />
        <KPICard icon={Zap} label="API Calls 24h" value={fmt(dashboard.totalApiCalls24h)} sub="real requests" accent="text-violet-400" />
        <KPICard icon={Webhook} label="Events 24h" value={fmt(dashboard.totalEvents24h)} sub="Oracle reacts" accent="text-amber-400" />
        <KPICard icon={RefreshCw} label="Syncs 24h" value={fmt(dashboard.totalSyncs24h)} sub="auto + manual" accent="text-pink-400" />
        <KPICard icon={Database} label="Total Records" value={fmt(dashboard.totalRecords)} sub="synced" accent="text-cyan-400" />
        <KPICard icon={Activity} label="Avg Reliability" value={`${dashboard.avgReliability}%`} sub="rolling" accent="text-emerald-400" />
        <KPICard icon={Clock} label="Avg Latency" value={`${dashboard.avgLatencyMs}ms`} sub="API calls" accent="text-sky-400" />
        <KPICard icon={AlertTriangle} label="Failing" value={dashboard.failingConnectors} sub="need attention" accent={dashboard.failingConnectors > 0 ? 'text-red-400' : 'text-emerald-400'} />
        <KPICard icon={Shield} label="Security Score" value={`${dashboard.security.securityScore}/100`} sub="Zero Trust" accent={dashboard.security.securityScore >= 80 ? 'text-emerald-400' : 'text-amber-400'} />
        <KPICard icon={Star} label="Marketplace" value={fmt(dashboard.marketplaceListings)} sub={`${fmt(dashboard.marketplaceInstalls)} installs`} accent="text-violet-400" />
        <KPICard icon={FileSearch} label="Docs Processed" value={fmt(dashboard.documentIntelligence.length)} sub="auto-extracted" accent="text-pink-400" />
      </motion.div>

      {/* ─── Tabs ─── */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="bg-white/[0.03] border border-white/[0.08] h-auto p-1 flex flex-wrap gap-1">
          <TabsTrigger value="catalog" className="text-[11px] md:text-xs">Catalog</TabsTrigger>
          <TabsTrigger value="installed" className="text-[11px] md:text-xs">Installed ({dashboard.totalInstalled})</TabsTrigger>
          <TabsTrigger value="health" className="text-[11px] md:text-xs">Health</TabsTrigger>
          <TabsTrigger value="events" className="text-[11px] md:text-xs">Events</TabsTrigger>
          <TabsTrigger value="sync" className="text-[11px] md:text-xs">Sync</TabsTrigger>
          <TabsTrigger value="logs" className="text-[11px] md:text-xs">Logs</TabsTrigger>
          <TabsTrigger value="marketplace" className="text-[11px] md:text-xs">Marketplace</TabsTrigger>
          <TabsTrigger value="docs" className="text-[11px] md:text-xs">Doc Intelligence</TabsTrigger>
          <TabsTrigger value="security" className="text-[11px] md:text-xs">Security</TabsTrigger>
        </TabsList>

        {/* ─── Catalog Tab ─── */}
        <TabsContent value="catalog" className="space-y-3">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search 130+ connectors — SBI, GSTN, Salesforce, OpenAI, Razorpay, AWS…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white/[0.03] border-white/[0.08]"
              />
            </div>
            <select
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value as ConnectorCategory | 'all')}
              className="bg-white/[0.03] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-foreground"
            >
              <option value="all">All Categories</option>
              {(Object.entries(CATEGORY_LABELS) as [ConnectorCategory, string][]).map(([cat, label]) => (
                <option key={cat} value={cat}>{label}</option>
              ))}
            </select>
          </div>

          {/* Category quick-stats */}
          <div className="grid grid-cols-2 md:grid-cols-6 lg:grid-cols-9 gap-2">
            {dashboard.categoryStats.filter((c) => c.available > 0).map((c) => {
              const Icon = CATEGORY_ICONS[c.category];
              return (
                <button
                  key={c.category}
                  onClick={() => setActiveCategory(activeCategory === c.category ? 'all' : c.category)}
                  className={`p-2.5 rounded-lg border text-left transition-colors ${activeCategory === c.category ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'}`}
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground mb-1" />
                  <p className="text-[10px] text-muted-foreground truncate">{c.label.replace('™', '').replace('Connectors', '').trim()}</p>
                  <p className="text-sm font-bold">{c.available}</p>
                </button>
              );
            })}
          </div>

          {/* Connector grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCatalog.map((def) => {
              const Icon = CATEGORY_ICONS[def.category];
              const isInstalled = installedKeys.has(def.key);
              return (
                <Card key={def.key} className="bg-white/[0.03] border-white/[0.08] hover:border-white/[0.16] transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-white/[0.04] p-2 shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-sm truncate">{def.name}</p>
                          {def.certified && (
                            <Badge variant="outline" className="text-[9px] py-0 h-4 border-emerald-500/30 text-emerald-300">CERTIFIED</Badge>
                          )}
                          {def.realTime && (
                            <Badge variant="outline" className="text-[9px] py-0 h-4 border-sky-500/30 text-sky-300">REALTIME</Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{def.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {def.capabilities.slice(0, 4).map((cap, i) => (
                            <Badge key={i} variant="secondary" className="text-[9px] font-normal py-0 h-4">{cap}</Badge>
                          ))}
                          {def.capabilities.length > 4 && (
                            <Badge variant="secondary" className="text-[9px] font-normal py-0 h-4">+{def.capabilities.length - 4}</Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>{def.authMethods.join(' / ')}</span>
                            <span>·</span>
                            <span>{def.regions.join(',')}</span>
                          </div>
                          {isInstalled ? (
                            <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-300 py-0 h-5">
                              <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Installed
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px]"
                              disabled={actionLoading === `install-${def.key}`}
                              onClick={() => handleInstall(def)}
                            >
                              {actionLoading === `install-${def.key}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
                              Install
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {filteredCatalog.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No connectors match your search.</p>
            </div>
          )}
        </TabsContent>

        {/* ─── Installed Tab ─── */}
        <TabsContent value="installed" className="space-y-3">
          {dashboard.installed.length === 0 ? (
            <Card className="bg-white/[0.03] border-white/[0.08]">
              <CardContent className="p-12 text-center">
                <Plug className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">No connectors installed yet.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setTab('catalog')}>
                  Browse Catalog →
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {dashboard.installed.map((conn) => (
                <InstalledConnectorCard
                  key={conn.id}
                  conn={conn}
                  actionLoading={actionLoading}
                  onAuthenticate={handleAuthenticate}
                  onTest={handleTest}
                  onSync={handleSync}
                  onUninstall={handleUninstall}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Health Tab ─── */}
        <TabsContent value="health" className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPICard icon={CheckCircle2} label="Healthy" value={dashboard.health.healthy} accent="text-emerald-400" />
            <KPICard icon={AlertTriangle} label="Degraded" value={dashboard.health.degraded} accent="text-amber-400" />
            <KPICard icon={XCircle} label="Down" value={dashboard.health.down} accent="text-red-400" />
            <KPICard icon={Key} label="Expired" value={dashboard.health.expired} accent="text-red-400" />
            <KPICard icon={Clock} label="Expiring <7d" value={dashboard.health.expiringSoon} accent="text-amber-400" />
            <KPICard icon={Activity} label="Failures 24h" value={dashboard.health.totalFailures24h} accent="text-orange-400" />
          </div>

          {dashboard.health.topIssues.length > 0 && (
            <Card className="bg-white/[0.03] border-white/[0.08]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" /> Top Issues
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {dashboard.health.topIssues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-3 p-2 rounded-md bg-white/[0.02]">
                    <Badge variant="outline" className={severityBadge(issue.severity)}>{issue.severity}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">{issue.provider} <span className="text-muted-foreground">· {issue.connectorKey}</span></p>
                      <p className="text-[11px] text-muted-foreground">{issue.issue}</p>
                      <p className="text-[11px] text-sky-300 mt-0.5">→ {issue.recommendation}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="bg-white/[0.03] border-white/[0.08]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Per-Connector Health</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-96">
                <div className="space-y-2">
                  {dashboard.health.connectors.map((h) => (
                    <HealthRow key={h.connectorId} h={h} />
                  ))}
                  {dashboard.health.connectors.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">No installed connectors to monitor.</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Events Tab ─── */}
        <TabsContent value="events" className="space-y-3">
          <Card className="bg-white/[0.03] border-white/[0.08]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Webhook className="h-4 w-4 text-amber-400" /> Live Event Stream
                <Badge variant="outline" className="text-[10px] ml-auto">{fmt(dashboard.totalEvents24h)} events 24h</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[600px]">
                <div className="space-y-2">
                  {dashboard.recentEvents.map((ev) => (
                    <EventRow key={ev.id} ev={ev} />
                  ))}
                  {dashboard.recentEvents.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">No events yet. Install a connector and trigger a sync.</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Sync Tab ─── */}
        <TabsContent value="sync" className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard icon={CheckCircle2} label="In Sync" value={dashboard.syncReport.inSync} accent="text-emerald-400" />
            <KPICard icon={AlertTriangle} label="Partial" value={dashboard.syncReport.partial} accent="text-amber-400" />
            <KPICard icon={XCircle} label="Out of Sync" value={dashboard.syncReport.outOfSync} accent="text-red-400" />
            <KPICard icon={Database} label="Total Records" value={fmt(dashboard.syncReport.totalRecords)} accent="text-sky-400" />
          </div>

          <Card className="bg-white/[0.03] border-white/[0.08]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-emerald-400" /> Universal Data Synchronization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-96">
                <div className="space-y-2">
                  {dashboard.syncReport.entities.map((e) => (
                    <div key={e.entity} className="flex items-center gap-3 p-2 rounded-md bg-white/[0.02]">
                      <div className="shrink-0">
                        <Badge variant="outline" className={severityBadge(
                          e.status === 'in_sync' ? 'low' :
                          e.status === 'partial' ? 'medium' :
                          e.status === 'out_of_sync' ? 'high' : 'info'
                        )}>
                          {e.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold capitalize">{e.entity.replace(/_/g, ' ')}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {fmt(e.totalRecords)} records · {e.sourceConnectors.slice(0, 3).join(', ')}
                          {e.sourceConnectors.length > 3 && ` +${e.sourceConnectors.length - 3}`}
                        </p>
                      </div>
                      <div className="text-right text-[10px] text-muted-foreground">
                        {e.lastSyncedAt ? (
                          <>
                            <p>{timeAgo(e.lastSyncedAt)}</p>
                            <p>{e.freshnessHours !== null ? `${e.freshnessHours}h fresh` : ''}</p>
                          </>
                        ) : (
                          <span>never</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="bg-white/[0.03] border-white/[0.08]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Recent Sync Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-72">
                <div className="space-y-2">
                  {dashboard.recentSyncJobs.map((job) => (
                    <SyncJobRow key={job.id} job={job} />
                  ))}
                  {dashboard.recentSyncJobs.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">No sync jobs yet.</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Logs Tab ─── */}
        <TabsContent value="logs" className="space-y-3">
          <Card className="bg-white/[0.03] border-white/[0.08]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-sky-400" /> Audit-Grade Execution Log
                <Badge variant="outline" className="text-[10px] ml-auto">{fmt(dashboard.totalApiCalls24h)} calls 24h</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[600px]">
                <div className="space-y-1.5">
                  {dashboard.recentLogs.map((log) => (
                    <LogRow key={log.id} log={log} />
                  ))}
                  {dashboard.recentLogs.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">No logs yet.</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Marketplace Tab ─── */}
        <TabsContent value="marketplace" className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard icon={Star} label="Listings" value={fmt(dashboard.marketplaceListings)} accent="text-violet-400" />
            <KPICard icon={Download} label="Total Installs" value={fmt(dashboard.marketplaceInstalls)} accent="text-emerald-400" />
            <KPICard icon={CheckCircle2} label="Certified" value={fmt(dashboard.marketplaceListings)} sub="GSTPilot verified" accent="text-sky-400" />
            <KPICard icon={Users} label="Developers" value="—" sub="publishing" accent="text-amber-400" />
          </div>

          <Card className="bg-white/[0.03] border-white/[0.08]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-400" /> Top Marketplace Connectors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {dashboard.topMarketplace.map((m) => (
                  <MarketplaceCard key={m.id} m={m} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/[0.03] border-white/[0.08]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">All Listings ({dashboard.marketplace.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-96">
                <div className="space-y-2">
                  {dashboard.marketplace.map((m) => (
                    <MarketplaceRow key={m.id} m={m} onInstall={(def) => handleInstall(def)} />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Document Intelligence Tab ─── */}
        <TabsContent value="docs" className="space-y-3">
          <Card className="bg-white/[0.03] border-white/[0.08]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileSearch className="h-4 w-4 text-pink-400" /> Document Intelligence
                <Badge variant="outline" className="text-[10px] ml-auto">{dashboard.documentIntelligence.length} processed</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[600px]">
                <div className="space-y-2">
                  {dashboard.documentIntelligence.map((doc) => (
                    <DocumentCard key={doc.documentId} doc={doc} />
                  ))}
                  {dashboard.documentIntelligence.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">No documents processed yet.</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Security Tab ─── */}
        <TabsContent value="security" className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard icon={Shield} label="Security Score" value={`${dashboard.security.securityScore}/100`} accent={dashboard.security.securityScore >= 80 ? 'text-emerald-400' : 'text-amber-400'} />
            <KPICard icon={Lock} label="OAuth2" value={dashboard.security.oauth2Connections} sub="OIDC included" accent="text-sky-400" />
            <KPICard icon={Key} label="API Keys" value={dashboard.security.apiKeyConnections} accent="text-amber-400" />
            <KPICard icon={Shield} label="mTLS/Cert" value={dashboard.security.mtlsConnections} accent="text-emerald-400" />
            <KPICard icon={RotateCw} label="Token Rotation" value={dashboard.security.tokenRotationEnabled} sub={`${dashboard.security.tokenRotationDisabled} disabled`} accent="text-violet-400" />
            <KPICard icon={Clock} label="Expiring 7d" value={dashboard.security.expiringTokens7d} accent="text-amber-400" />
            <KPICard icon={XCircle} label="Expired Tokens" value={dashboard.security.expiredTokens} accent="text-red-400" />
            <KPICard icon={Webhook} label="Webhooks Verified" value={dashboard.security.webhookVerified} sub={`${dashboard.security.webhookUnverified} unverified`} accent="text-sky-400" />
          </div>

          <Card className="bg-white/[0.03] border-white/[0.08]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-400" /> Zero-Trust Security Posture
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <SecurityRow label="Zero Trust enforced" value={dashboard.security.zeroTrustEnforced} />
              <SecurityRow label="Organization isolation" value={dashboard.security.orgIsolationEnforced} />
              <SecurityRow label="Audit logging" value={dashboard.security.auditLogEnabled} />
              <SecurityRow label="Encryption at rest & in transit" value={dashboard.security.encryptionEnabled} />
              <SecurityRow label="Certificate validation" value={dashboard.security.certificateValidation} />
              <div className="flex items-center justify-between p-2 rounded-md bg-white/[0.02] mt-2">
                <span className="text-xs text-muted-foreground">Total audit events (24h)</span>
                <span className="text-sm font-semibold">{fmt(dashboard.security.totalAuditEvents)}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Footer ─── */}
      <div className="text-center text-[11px] text-muted-foreground pt-4 pb-6">
        <p>{dashboard.founder}</p>
        <p className="mt-1">Connect Everything · Synchronize Everything · Automate Everything</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════════

function InstalledConnectorCard({ conn, actionLoading, onAuthenticate, onTest, onSync, onUninstall }: {
  conn: InstalledConnector;
  actionLoading: string | null;
  onAuthenticate: (id: string) => void;
  onTest: (id: string) => void;
  onSync: (id: string) => void;
  onUninstall: (id: string, provider: string) => void;
}) {
  const Icon = CATEGORY_ICONS[conn.category];
  return (
    <Card className="bg-white/[0.03] border-white/[0.08]">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-white/[0.04] p-2 shrink-0">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm truncate">{conn.displayName}</p>
              <Badge variant="outline" className={`text-[9px] py-0 h-4 ${conn.status === 'active' ? 'border-emerald-500/30 text-emerald-300' : conn.status === 'expired' || conn.status === 'error' ? 'border-red-500/30 text-red-300' : 'border-amber-500/30 text-amber-300'}`}>
                {conn.status.toUpperCase()}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {conn.provider} · {conn.authMethod} · {conn.syncInterval}
              {conn.identifier && ` · ${conn.identifier}`}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[11px]">
              <div>
                <p className="text-muted-foreground text-[10px]">Events</p>
                <p className="font-semibold">{fmt(conn.eventCount)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px]">Logs</p>
                <p className="font-semibold">{fmt(conn.logCount)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px]">Sync Jobs</p>
                <p className="font-semibold">{fmt(conn.syncJobCount)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px]">Reliability</p>
                <p className="font-semibold text-emerald-400">{conn.reliabilityPct.toFixed(0)}%</p>
              </div>
            </div>

            {conn.lastError && (
              <p className="text-[10px] text-red-400 mt-2 truncate">⚠ {conn.lastError}</p>
            )}

            {conn.lastSyncAt && (
              <p className="text-[10px] text-muted-foreground mt-2">
                Last sync: {timeAgo(conn.lastSyncAt)} · Latency: {conn.apiLatencyMs}ms
              </p>
            )}

            <div className="flex flex-wrap gap-1.5 mt-3">
              {conn.status !== 'active' && (
                <Button
                  size="sm" variant="outline" className="h-7 text-[11px]"
                  disabled={actionLoading === `auth-${conn.id}`}
                  onClick={() => onAuthenticate(conn.id)}
                >
                  {actionLoading === `auth-${conn.id}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Key className="h-3 w-3 mr-1" />}
                  Authenticate
                </Button>
              )}
              <Button
                size="sm" variant="outline" className="h-7 text-[11px]"
                disabled={actionLoading === `test-${conn.id}`}
                onClick={() => onTest(conn.id)}
              >
                {actionLoading === `test-${conn.id}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Zap className="h-3 w-3 mr-1" />}
                Test
              </Button>
              <Button
                size="sm" variant="outline" className="h-7 text-[11px]"
                disabled={actionLoading === `sync-${conn.id}` || conn.status !== 'active'}
                onClick={() => onSync(conn.id)}
              >
                {actionLoading === `sync-${conn.id}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                Sync
              </Button>
              <Button
                size="sm" variant="outline" className="h-7 text-[11px] text-red-300 border-red-500/30 hover:bg-red-500/10"
                disabled={actionLoading === `uninstall-${conn.id}`}
                onClick={() => onUninstall(conn.id, conn.provider)}
              >
                <Trash2 className="h-3 w-3 mr-1" /> Uninstall
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HealthRow({ h }: { h: ConnectorHealth }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-md bg-white/[0.02]">
      <div className="shrink-0 w-12">
        <div className="relative h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 ${h.healthScore >= 85 ? 'bg-emerald-500' : h.healthScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${h.healthScore}%` }}
          />
        </div>
        <p className="text-[10px] text-center mt-0.5 font-semibold">{h.healthScore}</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold">{h.provider}</p>
        <p className="text-[10px] text-muted-foreground">
          {h.status} · {h.apiLatencyMs}ms · {h.reliabilityPct.toFixed(0)}% reliable · {h.dataFreshnessHours !== null ? `${h.dataFreshnessHours}h fresh` : 'never synced'}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {h.credentialExpired && <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-300 py-0 h-4">EXPIRED</Badge>}
        {h.credentialExpiringSoon && <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-300 py-0 h-4">EXPIRING</Badge>}
        {!h.webhookHealthy && <Badge variant="outline" className="text-[9px] border-orange-500/30 text-orange-300 py-0 h-4">WEBHOOK</Badge>}
      </div>
      {h.recommendation && (
        <p className="text-[10px] text-sky-300 max-w-xs truncate hidden md:block">→ {h.recommendation}</p>
      )}
    </div>
  );
}

function EventRow({ ev }: { ev: ConnectorEventRecord }) {
  return (
    <div className="flex items-start gap-3 p-2 rounded-md bg-white/[0.02]">
      <Badge variant="outline" className={severityBadge(ev.severity)}>{ev.severity}</Badge>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs font-semibold">{ev.title}</p>
          <Badge variant="secondary" className="text-[9px] font-normal py-0 h-4">{ev.type}</Badge>
        </div>
        {ev.description && <p className="text-[11px] text-muted-foreground mt-0.5">{ev.description}</p>}
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {ev.provider} · {timeAgo(ev.createdAt)}
          {ev.reaction && <span className="text-emerald-400 ml-1">· {ev.reaction.replace(/_/g, ' ')}</span>}
        </p>
      </div>
    </div>
  );
}

function SyncJobRow({ job }: { job: SyncJobRecord }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-md bg-white/[0.02]">
      <Badge variant="outline" className={`text-[9px] py-0 h-4 ${job.status === 'success' ? 'border-emerald-500/30 text-emerald-300' : job.status === 'failed' ? 'border-red-500/30 text-red-300' : 'border-amber-500/30 text-amber-300'}`}>
        {job.status.toUpperCase()}
      </Badge>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold">{job.provider}</p>
        <p className="text-[10px] text-muted-foreground">
          {fmt(job.recordsSynced)}/{fmt(job.recordsTotal)} records · {job.trigger} · {job.durationMs}ms · {timeAgo(job.createdAt)}
        </p>
        {job.errorMessage && <p className="text-[10px] text-red-400 mt-0.5">⚠ {job.errorMessage}</p>}
      </div>
    </div>
  );
}

function LogRow({ log }: { log: ConnectorLogRecord }) {
  return (
    <div className="flex items-start gap-2 p-2 rounded-md bg-white/[0.02]">
      <Badge variant="outline" className={`text-[9px] py-0 h-4 ${log.level === 'error' || log.level === 'critical' ? 'border-red-500/30 text-red-300' : log.level === 'warn' ? 'border-amber-500/30 text-amber-300' : 'border-sky-500/30 text-sky-300'}`}>
        {log.level.toUpperCase()}
      </Badge>
      <div className="flex-1 min-w-0">
        <p className="text-xs">
          <span className="font-semibold">{log.provider}</span>
          <span className="text-muted-foreground"> · {log.action}</span>
          {log.statusCode && <span className="text-muted-foreground"> · {log.statusCode}</span>}
          <span className="text-muted-foreground"> · {log.durationMs}ms</span>
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{log.message}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(log.createdAt)}</p>
      </div>
    </div>
  );
}

function MarketplaceCard({ m }: { m: MarketplaceListing }) {
  return (
    <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{m.name}</p>
          <p className="text-[10px] text-muted-foreground">{m.developerName} · v{m.version}</p>
        </div>
        <div className="flex items-center gap-1 text-[10px]">
          <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
          <span className="font-semibold">{m.rating.toFixed(1)}</span>
        </div>
      </div>
      {m.tagline && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{m.tagline}</p>}
      <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
        <span>{fmt(m.activeInstalls)} installs</span>
        <Badge variant="outline" className={`text-[9px] py-0 h-4 ${m.certification === 'certified' ? 'border-emerald-500/30 text-emerald-300' : 'border-sky-500/30 text-sky-300'}`}>
          {m.certification.toUpperCase()}
        </Badge>
      </div>
    </div>
  );
}

function MarketplaceRow({ m, onInstall }: { m: MarketplaceListing; onInstall: (def: ConnectorDefinition) => void }) {
  // Find matching catalog connector for direct install
  const catalogMatch = CONNECTOR_CATALOG.find((c) => c.provider === m.provider);
  return (
    <div className="flex items-center gap-3 p-2 rounded-md bg-white/[0.02]">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs font-semibold">{m.name}</p>
          <Badge variant="outline" className="text-[9px] py-0 h-4">{m.category}</Badge>
          {m.certification === 'certified' && (
            <Badge variant="outline" className="text-[9px] py-0 h-4 border-emerald-500/30 text-emerald-300">CERTIFIED</Badge>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {m.developerName} · v{m.version} · ★ {m.rating.toFixed(1)} ({m.reviewCount} reviews) · {fmt(m.installCount)} installs · {m.pricingModel}
        </p>
      </div>
      {catalogMatch && (
        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => onInstall(catalogMatch)}>
          <Plus className="h-3 w-3 mr-1" /> Install
        </Button>
      )}
    </div>
  );
}

function DocumentCard({ doc }: { doc: DocumentIntelligenceResult }) {
  return (
    <div className="p-3 rounded-md bg-white/[0.02]">
      <div className="flex items-start gap-3">
        <FileText className="h-4 w-4 text-pink-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-semibold truncate">{doc.fileName}</p>
            <Badge variant="outline" className="text-[9px] py-0 h-4">{doc.kind.replace(/_/g, ' ')}</Badge>
            <Badge variant="outline" className={`text-[9px] py-0 h-4 ${doc.confidence >= 80 ? 'border-emerald-500/30 text-emerald-300' : doc.confidence >= 60 ? 'border-amber-500/30 text-amber-300' : 'border-red-500/30 text-red-300'}`}>
              {doc.confidence}% confidence
            </Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 text-[10px]">
            <div>
              <p className="text-muted-foreground">Size</p>
              <p className="font-semibold">{fmtBytes(doc.sizeBytes)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">MIME</p>
              <p className="font-semibold truncate">{doc.mimeType ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Linked</p>
              <p className="font-semibold truncate">{doc.linkedClientName ?? doc.linkedInvoiceNumber ?? '—'}</p>
            </div>
          </div>
          {doc.suggestedActions.length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/[0.06]">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Suggested Actions</p>
              <div className="flex flex-wrap gap-1">
                {doc.suggestedActions.map((a, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] font-normal">{a}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SecurityRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-md bg-white/[0.02]">
      <span className="text-xs text-muted-foreground">{label}</span>
      {value ? (
        <Badge variant="outline" className="border-emerald-500/30 text-emerald-300 text-[10px]">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Enabled
        </Badge>
      ) : (
        <Badge variant="outline" className="border-red-500/30 text-red-300 text-[10px]">
          <XCircle className="h-3 w-3 mr-1" /> Disabled
        </Badge>
      )}
    </div>
  );
}
