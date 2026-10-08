'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT GLOBAL ENTERPRISE NETWORK™ — WORLD BUSINESS NETWORK CONSOLE
//
// One worldwide business graph. Every organisation becomes a node.
// 13 subsystems, all extended on REAL connected business data:
//
//   1.  Global Business Graph™        — nodes + edges across all entities
//   2.  Enterprise Network™           — connections + collaborations
//   3.  Global Supplier Network™      — verified suppliers + Oracle recos
//   4.  B2B Commerce Cloud™           — RFQs + POs + contracts
//   5.  Global Payments Network™      — multi-method + multi-currency
//   6.  Shared AI Knowledge™          — signals + trends + confidence
//   7.  Industry Benchmarking™        — p25/p50/p75/p90 percentiles
//   8.  Trust Network™                — trust scores + events + at-risk
//   9.  Global Opportunity Engine™    — funnel + potential value
//  10.  Network Observability™        — health + latency + 7d chart
//  11.  Executive APIs™               — 15 endpoints under /api/network
//  12.  Security™                     — isolation + RBAC + zero-trust
//  13.  Performance™                  — 50M orgs / 1B rels / 500M txns/day
//
// Tagline: One Network. Every Enterprise. Infinite Intelligence.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Network, Link2, ArrowLeftRight, Lightbulb, ShieldCheck, Banknote,
  RefreshCw, Sparkles, Loader2, CheckCircle2, XCircle, Clock, Plus, Star,
  Send, Zap, TrendingUp, Search, Globe, Building2, Users2, Crown, Layers,
  Database, Server, Cpu, AlertTriangle, ChevronRight, Handshake, Truck,
  Factory, Landmark, Scale, Briefcase, type LucideIcon,
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
  NETWORK_TAGLINE,
  NETWORK_SUBSYSTEMS,
  TOTAL_NETWORK_SUBSYSTEMS,
  type NetworkDashboard,
  type NetworkNode,
  type NodeType,
} from '@/lib/network/types';

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
  if (!isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `${(n / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `${(n / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `${(n / 1000).toFixed(1)}K`;
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

function trustColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

// ─── Subsystem pill data (13 subsystems) ──────────────────────────────────────
const SUBSYSTEM_PILLS: { name: string; icon: LucideIcon }[] = [
  { name: 'Global Business Graph™', icon: Network },
  { name: 'Enterprise Network™', icon: Link2 },
  { name: 'Global Supplier Network™', icon: Truck },
  { name: 'B2B Commerce Cloud™', icon: ArrowLeftRight },
  { name: 'Global Payments Network™', icon: Banknote },
  { name: 'Shared AI Knowledge™', icon: Sparkles },
  { name: 'Industry Benchmarking™', icon: Scale },
  { name: 'Trust Network™', icon: ShieldCheck },
  { name: 'Global Opportunity Engine™', icon: Lightbulb },
  { name: 'Network Observability™', icon: Server },
  { name: 'Executive APIs™', icon: Cpu },
  { name: 'Security™', icon: ShieldCheck },
  { name: 'Performance™', icon: Zap },
];

// ─── Main component ───────────────────────────────────────────────────────────
export default function GlobalEnterpriseNetworkPage() {
  const { toast } = useToast();
  const [dashboard, setDashboard] = useState<NetworkDashboard | null>(null);
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [nodeTypeFilter, setNodeTypeFilter] = useState<string>('all');

  // Dialog state
  const [connectOpen, setConnectOpen] = useState(false);
  const [rfqOpen, setRfqOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, nodesRes] = await Promise.all([
        fetch('/api/network/dashboard', { cache: 'no-store' }),
        fetch('/api/network/organizations?limit=200', { cache: 'no-store' }),
      ]);
      if (!dashRes.ok) throw new Error(`HTTP ${dashRes.status}`);
      const dashData = (await dashRes.json()) as NetworkDashboard;
      setDashboard(dashData);
      try {
        const nodesData = await nodesRes.json();
        setNodes(Array.isArray(nodesData?.organizations) ? nodesData.organizations : []);
      } catch {
        setNodes([]);
      }
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
      const res = await fetch(`/api/network/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: 'Action failed',
          description: (data as { error?: string }).error ?? `HTTP ${res.status}`,
          variant: 'destructive',
        });
        return { ok: false, data };
      }
      return { ok: true, data };
    } catch (e) {
      toast({
        title: 'Network error',
        description: e instanceof Error ? e.message : 'Unknown',
        variant: 'destructive',
      });
      return { ok: false, data: null };
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading && !dashboard) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
          <span className="text-lg font-semibold">Loading Global Enterprise Network™…</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl bg-slate-800/60" />
          ))}
        </div>
        <Skeleton className="h-12 w-full rounded-xl bg-slate-800/60" />
        <Skeleton className="h-96 w-full rounded-xl bg-slate-800/60" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <Card className="max-w-md bg-slate-900 border-red-500/40 border-white/[0.06]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-300">
              <AlertTriangle className="h-5 w-5" /> Failed to load network
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
  const bg = d.businessGraph;
  const en = d.enterpriseNetwork;
  const sup = d.suppliers;
  const com = d.commerce;
  const pay = d.payments;
  const kn = d.knowledge;
  const bm = d.benchmarking;
  const tr = d.trust;
  const op = d.opportunities;
  const ob = d.observability;
  const sec = d.security;
  const pf = d.performance;

  const verifiedNodes = d.verifiedNodes;
  const activeCollaborations = d.activeCollaborations;
  const totalTransactionValue = d.totalTransactionValue;
  const totalPotentialValue = d.totalPotentialValue;

  // Organizations tab filtering
  const filteredNodes = nodes.filter((n) => {
    if (nodeTypeFilter !== 'all' && n.nodeType !== nodeTypeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (n.legalName ?? '').toLowerCase().includes(q) ||
        (n.tradeName ?? '').toLowerCase().includes(q) ||
        (n.gstin ?? '').toLowerCase().includes(q) ||
        (n.city ?? '').toLowerCase().includes(q) ||
        (n.industry ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const TABS: Array<[string, string, LucideIcon]> = [
    ['overview', 'Overview', Globe],
    ['business-graph', 'Business Graph', Network],
    ['organizations', 'Organizations', Building2],
    ['suppliers', 'Suppliers', Truck],
    ['commerce', 'Commerce', ArrowLeftRight],
    ['payments', 'Payments', Banknote],
    ['trust', 'Trust Network', ShieldCheck],
    ['opportunities', 'Opportunities', Lightbulb],
    ['benchmarking', 'Benchmarking', Scale],
    ['knowledge', 'Knowledge', Sparkles],
    ['observability', 'Observability', Server],
    ['security', 'Security', ShieldCheck],
    ['performance', 'Performance', Zap],
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* ─── Header ─── */}
      <header className="border-b border-slate-800/60 bg-slate-950/70 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Globe className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-300 to-teal-200 bg-clip-text text-transparent">
                Global Enterprise Network™
              </h1>
              <p className="text-xs text-slate-400">
                World Business Network — One Network. Every Enterprise. Infinite Intelligence.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="border-amber-500/40 text-amber-300">
              <Crown className="h-3 w-3 mr-1" /> Founder &amp; Owner: Prince Singh
            </Badge>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
              <CheckCircle2 className="h-3 w-3 mr-1" /> {d.subsystemsImplemented}/{d.subsystemsTotal} subsystems
            </Badge>
            <Badge variant="outline" className="border-sky-500/40 text-sky-300">
              <Database className="h-3 w-3 mr-1" /> {d.dataSources.length} sources
            </Badge>
            <Button onClick={load} variant="outline" size="sm" disabled={loading} className="border-slate-700">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button onClick={() => setConnectOpen(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-2" /> Connect Organization
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 space-y-6 pb-20">
        {/* ─── Subsystem pills (13, all green-checked) ─── */}
        <ScrollArea className="w-full">
          <div className="flex flex-nowrap gap-2 pb-1">
            {SUBSYSTEM_PILLS.map((p) => {
              const Icon = p.icon;
              return (
                <span
                  key={p.name}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-xs text-emerald-200 whitespace-nowrap"
                >
                  <Icon className="h-3 w-3" /> {p.name}
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                </span>
              );
            })}
          </div>
        </ScrollArea>

        {/* ─── Headline KPIs (6 cards) ─── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard icon={Network} label="Total Nodes" value={fmtNum(d.totalNodes)} sub={`${verifiedNodes} verified`} accent="emerald" />
          <KpiCard icon={Link2} label="Total Connections" value={fmtNum(d.totalConnections)} sub={`${activeCollaborations} active`} accent="teal" />
          <KpiCard icon={ArrowLeftRight} label="Transactions (30d)" value={fmtNum(d.totalTransactions)} sub={`${fmtINR(totalTransactionValue)} value`} accent="sky" />
          <KpiCard icon={Lightbulb} label="Opportunities" value={fmtNum(d.totalOpportunities)} sub={`${fmtINR(totalPotentialValue)} potential`} accent="amber" />
          <KpiCard icon={ShieldCheck} label="Avg Trust Score" value={d.avgTrustScore.toFixed(1)} sub={`${verifiedNodes} verified nodes`} accent="violet" />
          <KpiCard icon={Banknote} label="Payments Value" value={fmtINR(d.totalPaymentValue)} sub={`${d.totalPayments} payments`} accent="rose" />
        </div>

        {/* ─── Tabs ─── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <ScrollArea className="w-full">
            <TabsList className="bg-slate-900/60 border border-slate-800 h-auto flex flex-nowrap p-1 gap-1">
              {TABS.map(([v, label, Icon]) => {
                const I = Icon;
                return (
                  <TabsTrigger
                    key={v}
                    value={v}
                    className="data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-200 text-slate-300 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <I className="h-3.5 w-3.5" /> {label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </ScrollArea>

          {/* ─── Overview ─── */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="bg-slate-900/60 border-white/[0.06] lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-slate-100 flex items-center gap-2">
                    <Globe className="h-5 w-5 text-emerald-400" /> Platform Snapshot
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {d.subsystemsImplemented}/{d.subsystemsTotal} subsystems live, derived from {d.dataSources.length} real data sources.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <StatRow label="Network tagline" value={d.tagline} />
                  <StatRow label="Subsystems implemented" value={`${d.subsystemsImplemented}/${d.subsystemsTotal}`} />
                  <StatRow label="Data sources" value={`${d.dataSources.length} live sources`} />
                  <StatRow label="Live data" value={d.hasLiveData ? '✓ Connected' : '— Pending'} />
                  <StatRow label="Generated at" value={new Date(d.generatedAt).toLocaleString('en-IN')} />
                  <Separator className="bg-slate-800" />
                  <StatRow label="Total nodes / edges" value={`${fmtNum(d.totalNodes)} / ${fmtNum(d.totalEdges)}`} />
                  <StatRow label="Connections (active)" value={`${fmtNum(d.totalConnections)} (${fmtNum(activeCollaborations)} active)`} />
                  <StatRow label="Transactions (30d)" value={`${fmtNum(d.totalTransactions)} · ${fmtINR(totalTransactionValue)}`} />
                  <StatRow label="RFQs / Payments" value={`${fmtNum(d.totalRfqs)} / ${fmtNum(d.totalPayments)}`} />
                  <StatRow label="Opportunities" value={`${fmtNum(d.totalOpportunities)} · ${fmtINR(totalPotentialValue)} potential`} />
                  <StatRow label="Avg trust score" value={`${d.avgTrustScore.toFixed(1)} / 100`} />
                  <StatRow label="Verified nodes" value={fmtNum(verifiedNodes)} />
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="text-slate-100 flex items-center gap-2">
                    <Network className="h-5 w-5 text-sky-400" /> Business Graph at a Glance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-1.5">Nodes by type</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(bg.nodesByType).map(([k, v]) => (
                        <Badge key={k} variant="outline" className="border-emerald-500/30 text-emerald-200 capitalize text-[10px]">
                          {k.replace(/_/g, ' ')} · {fmtNum(v)}
                        </Badge>
                      ))}
                      {Object.keys(bg.nodesByType).length === 0 && (
                        <p className="text-xs text-slate-500">No nodes yet.</p>
                      )}
                    </div>
                  </div>
                  <Separator className="bg-slate-800" />
                  <div>
                    <p className="text-xs text-slate-500 mb-1.5">Top industries</p>
                    <div className="space-y-1">
                      {bg.topIndustries.slice(0, 5).map((i) => (
                        <div key={i.industry} className="flex items-center justify-between text-xs">
                          <span className="text-slate-300 truncate">{i.industry}</span>
                          <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px]">{fmtNum(i.count)}</Badge>
                        </div>
                      ))}
                      {bg.topIndustries.length === 0 && <p className="text-xs text-slate-500">No industries yet.</p>}
                    </div>
                  </div>
                  <Separator className="bg-slate-800" />
                  <div>
                    <p className="text-xs text-slate-500 mb-1.5">Top regions</p>
                    <div className="space-y-1">
                      {bg.topRegions.slice(0, 5).map((r) => (
                        <div key={r.region} className="flex items-center justify-between text-xs">
                          <span className="text-slate-300 truncate">{r.region}</span>
                          <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px]">{fmtNum(r.count)}</Badge>
                        </div>
                      ))}
                      {bg.topRegions.length === 0 && <p className="text-xs text-slate-500">No regions yet.</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="text-slate-100 flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-amber-400" /> Recent Opportunities
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                  {op.topOpportunities.length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">No opportunities yet.</p>
                  ) : (
                    op.topOpportunities.slice(0, 5).map((o) => (
                      <div key={o.id} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-slate-200 truncate">{o.title}</span>
                          <Badge variant="outline" className="border-amber-500/40 text-amber-300 text-[10px] capitalize shrink-0">
                            {o.type.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between mt-1 text-xs text-slate-500">
                          <span>{o.forName}</span>
                          <span className="text-emerald-300">{fmtINR(o.potentialValue)}</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <Progress value={o.probability} className="h-1.5 bg-slate-800" />
                          <span className="text-[10px] text-slate-500">{o.probability}%</span>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="text-slate-100 flex items-center gap-2">
                    <Server className="h-5 w-5 text-emerald-400" /> Network Health
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <HealthBar label="Network health" value={ob.networkHealth} suffix="%" />
                  <HealthBar label="Supply chain health" value={ob.supplyChainHealth} suffix="%" />
                  <Separator className="bg-slate-800" />
                  <StatRow label="Network latency" value={`${ob.networkLatency.toFixed(0)} ms`} />
                  <StatRow label="Error rate" value={`${ob.errorRate.toFixed(2)}%`} />
                  <StatRow label="Transactions today" value={fmtNum(ob.transactionsToday)} />
                  <StatRow label="Transactions (30d)" value={fmtNum(ob.transactions30d)} />
                  <StatRow label="Payments flowing" value={fmtNum(ob.paymentsFlowing)} />
                  <StatRow label="Connected organizations" value={fmtNum(ob.connectedOrganizations)} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ─── Business Graph ─── */}
          <TabsContent value="business-graph" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="text-slate-100 flex items-center gap-2">
                    <Network className="h-5 w-5 text-emerald-400" /> Nodes by Type
                  </CardTitle>
                  <CardDescription className="text-slate-400">{fmtNum(d.totalNodes)} total · {fmtNum(verifiedNodes)} verified</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(bg.nodesByType).length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">No nodes yet.</p>
                  ) : (
                    Object.entries(bg.nodesByType)
                      .sort((a, b) => b[1] - a[1])
                      .map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                          <span className="text-sm text-slate-300 capitalize">{k.replace(/_/g, ' ')}</span>
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">{fmtNum(v)}</Badge>
                        </div>
                      ))
                  )}
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="text-slate-100 flex items-center gap-2">
                    <Link2 className="h-5 w-5 text-sky-400" /> Edges by Type
                  </CardTitle>
                  <CardDescription className="text-slate-400">{fmtNum(d.totalEdges)} total relationships</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(bg.edgesByType).length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">No edges yet.</p>
                  ) : (
                    Object.entries(bg.edgesByType)
                      .sort((a, b) => b[1] - a[1])
                      .map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                          <span className="text-sm text-slate-300 capitalize">{k.replace(/_/g, ' ')}</span>
                          <Badge variant="outline" className="border-sky-500/40 text-sky-300">{fmtNum(v)}</Badge>
                        </div>
                      ))
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="bg-slate-900/60 border-white/[0.06]">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <Layers className="h-5 w-5 text-teal-400" /> Network Density &amp; Value
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-400">Network density</span>
                    <span className="text-slate-200 font-medium">{bg.networkDensity.toFixed(2)}%</span>
                  </div>
                  <Progress value={Math.min(100, bg.networkDensity)} className="h-2 bg-slate-800" />
                </div>
                <Separator className="bg-slate-800" />
                <StatRow label="Total transaction value" value={fmtINR(totalTransactionValue)} />
                <StatRow label="Avg trust score" value={`${bg.avgTrustScore.toFixed(1)} / 100`} />
                <StatRow label="Total nodes / edges" value={`${fmtNum(d.totalNodes)} / ${fmtNum(d.totalEdges)}`} />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="text-slate-100 flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-amber-400" /> Top Industries
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 max-h-72 overflow-y-auto">
                  {bg.topIndustries.length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">No industries yet.</p>
                  ) : (
                    bg.topIndustries.map((i) => (
                      <div key={i.industry} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300 truncate">{i.industry}</span>
                        <Badge variant="outline" className="border-slate-700 text-slate-400">{fmtNum(i.count)} nodes</Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="text-slate-100 flex items-center gap-2">
                    <Globe className="h-5 w-5 text-violet-400" /> Top Regions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 max-h-72 overflow-y-auto">
                  {bg.topRegions.length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">No regions yet.</p>
                  ) : (
                    bg.topRegions.map((r) => (
                      <div key={r.region} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300 truncate">{r.region}</span>
                        <Badge variant="outline" className="border-slate-700 text-slate-400">{fmtNum(r.count)} nodes</Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ─── Organizations ─── */}
          <TabsContent value="organizations" className="space-y-4 mt-4">
            <Card className="bg-slate-900/60 border-white/[0.06]">
              <CardContent className="pt-4 space-y-3">
                <div className="flex flex-col md:flex-row gap-3 md:items-center">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                      placeholder="Search by name, GSTIN, city, industry…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 bg-slate-950 border-slate-700 text-slate-100"
                    />
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> {filteredNodes.length} of {nodes.length} organizations
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    ['all', 'All'],
                    ['organization', 'Organizations'],
                    ['customer', 'Customers'],
                    ['supplier', 'Suppliers'],
                    ['partner', 'Partners'],
                    ['bank', 'Banks'],
                    ['government', 'Government'],
                    ['investor', 'Investors'],
                    ['accountant', 'Accountants'],
                    ['auditor', 'Auditors'],
                    ['logistics', 'Logistics'],
                  ].map(([v, label]) => (
                    <button
                      key={v}
                      onClick={() => setNodeTypeFilter(v)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition ${
                        nodeTypeFilter === v
                          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                          : 'border-slate-700 bg-slate-950/40 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {filteredNodes.length === 0 ? (
              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardContent className="py-12 text-center text-slate-400">
                  <Building2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  No organizations match your filter.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredNodes.map((n) => (
                  <OrganizationCard key={n.id} node={n} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── Suppliers ─── */}
          <TabsContent value="suppliers" className="space-y-4 mt-4">
            <Card className="bg-slate-900/60 border-white/[0.06]">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-400" /> Oracle™ Recommendations
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {sup.oracleRecommendations.length} AI-derived supplier matches with expected savings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sup.oracleRecommendations.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">No Oracle recommendations yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {sup.oracleRecommendations.map((r, idx) => (
                      <motion.div
                        key={`${r.supplierName}-${idx}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-slate-100 truncate">{r.supplierName}</h3>
                          <Badge variant="outline" className="border-amber-500/40 text-amber-300 text-[10px] shrink-0">
                            {fmtINR(r.expectedSaving)} saved
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{r.reason}</p>
                        <div className="flex items-center gap-1 mt-2">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${i < Math.round(r.rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-700'}`}
                            />
                          ))}
                          <span className="text-xs text-slate-500 ml-1">{r.rating.toFixed(1)}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="text-slate-100 flex items-center gap-2">
                    <Crown className="h-5 w-5 text-amber-400" /> Top Suppliers
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {sup.totalSuppliers} total · {sup.verifiedSuppliers} verified · {sup.avgSupplierRating.toFixed(1)} avg rating
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                  {sup.topSuppliers.length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">No suppliers yet.</p>
                  ) : (
                    sup.topSuppliers.map((s) => (
                      <div key={s.id} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-slate-200 truncate">{s.tradeName ?? s.legalName}</span>
                          <Badge variant="outline" className={`text-[10px] ${trustColor(s.trustScore)}`}>{s.trustScore.toFixed(0)}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                          <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                          <span>{s.supplierRating.toFixed(1)}</span>
                          <span>· {(s.city ?? s.state ?? 'Unknown')}</span>
                          <span>· {fmtNum(s.employeeCount)} emp</span>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="text-slate-100 flex items-center gap-2">
                    <Layers className="h-5 w-5 text-sky-400" /> Suppliers by Category
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Avg delivery {sup.avgDeliveryDays.toFixed(1)} days · Avg payment terms {sup.avgPaymentTerms.toFixed(0)} days
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(sup.suppliersByCategory).length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">No category data yet.</p>
                  ) : (
                    Object.entries(sup.suppliersByCategory)
                      .sort((a, b) => b[1] - a[1])
                      .map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between text-sm">
                          <span className="text-slate-300 capitalize">{k.replace(/_/g, ' ')}</span>
                          <Badge variant="outline" className="border-slate-700 text-slate-400">{fmtNum(v)}</Badge>
                        </div>
                      ))
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="bg-slate-900/60 border-white/[0.06]">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <Truck className="h-5 w-5 text-emerald-400" /> Discover Suppliers
                </CardTitle>
                <CardDescription className="text-slate-400">Verified suppliers across all categories.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sup.topSuppliers.concat(nodes.filter((n) => n.nodeType === 'supplier').slice(0, 12)).slice(0, 12).map((n, idx) => (
                    <OrganizationCard key={`${n.id}-${idx}`} node={n} compact />
                  ))}
                  {sup.topSuppliers.length === 0 && nodes.filter((n) => n.nodeType === 'supplier').length === 0 && (
                    <div className="col-span-full text-center text-slate-500 py-8 text-sm">
                      No supplier nodes in the network yet.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Commerce ─── */}
          <TabsContent value="commerce" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">B2B Commerce Cloud™</h2>
                <p className="text-sm text-slate-400">{com.totalRfqs} RFQs · {com.totalPurchaseOrders} POs · {com.activeContracts} active contracts</p>
              </div>
              <Button onClick={() => setRfqOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4 mr-2" /> Create RFQ
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <MiniStat label="Total RFQs" value={fmtNum(com.totalRfqs)} />
              <MiniStat label="Open RFQs" value={fmtNum(com.openRfqs)} />
              <MiniStat label="Quotations" value={fmtNum(com.totalQuotations)} />
              <MiniStat label="Purchase Orders" value={fmtNum(com.totalPurchaseOrders)} />
              <MiniStat label="Contracts" value={fmtNum(com.totalContracts)} />
              <MiniStat label="Active Contracts" value={fmtNum(com.activeContracts)} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base">Recent RFQs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                  {com.recentRfqs.length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">No RFQs yet.</p>
                  ) : (
                    com.recentRfqs.map((r) => (
                      <div key={r.id} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-xs text-emerald-300">{r.rfqNumber}</code>
                          <Badge variant="outline" className={`text-[10px] capitalize ${rfqStatusColor(r.status)}`}>{r.status}</Badge>
                        </div>
                        <p className="text-sm text-slate-200 mt-1 truncate">{r.title}</p>
                        <div className="flex items-center justify-between mt-1 text-xs text-slate-500">
                          <span>{r.fromName} → {r.toName ?? 'Open'}</span>
                          <span>{fmtINR(r.budgetMax)} · {timeAgo(r.createdAt)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base">Recent Purchase Orders</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                  {com.recentPurchaseOrders.length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">No POs yet.</p>
                  ) : (
                    com.recentPurchaseOrders.map((p) => (
                      <div key={p.id} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-xs text-sky-300">{p.poNumber}</code>
                          <Badge variant="outline" className={`text-[10px] capitalize ${poStatusColor(p.status)}`}>{p.status}</Badge>
                        </div>
                        <p className="text-sm text-slate-200 mt-1 truncate">{p.title}</p>
                        <div className="flex items-center justify-between mt-1 text-xs text-slate-500">
                          <span>{p.fromName} → {p.toName}</span>
                          <span>{fmtINR(p.totalValue)} · {timeAgo(p.createdAt)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base">Recent Contracts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                  {com.recentContracts.length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">No contracts yet.</p>
                  ) : (
                    com.recentContracts.map((c) => (
                      <div key={c.id} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-xs text-violet-300">{c.contractNumber}</code>
                          <Badge variant="outline" className={`text-[10px] capitalize ${contractStatusColor(c.status)}`}>{c.status}</Badge>
                        </div>
                        <p className="text-sm text-slate-200 mt-1 truncate">{c.title}</p>
                        <div className="flex items-center justify-between mt-1 text-xs text-slate-500">
                          <span className="capitalize">{c.type.replace(/_/g, ' ')}</span>
                          <span>{fmtINR(c.value)} · {timeAgo(c.createdAt)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ─── Payments ─── */}
          <TabsContent value="payments" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Global Payments Network™</h2>
                <p className="text-sm text-slate-400">{pay.totalPayments} payments · {fmtINR(d.totalPaymentValue)} value</p>
              </div>
              <Button onClick={() => setPaymentOpen(true)} className="bg-rose-600 hover:bg-rose-700">
                <Send className="h-4 w-4 mr-2" /> Send Payment
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <MiniStat label="Total Payments" value={fmtNum(pay.totalPayments)} />
              <MiniStat label="Completed" value={fmtNum(pay.completedPayments)} />
              <MiniStat label="Pending" value={fmtNum(pay.pendingPayments)} />
              <MiniStat label="Failed" value={fmtNum(pay.failedPayments)} />
              <MiniStat label="Total Value" value={fmtINR(pay.totalPaymentValue)} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base">By Method</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-500 border-b border-slate-800">
                          <th className="text-left py-2 px-2">Method</th>
                          <th className="text-right py-2 px-2">Count</th>
                          <th className="text-right py-2 px-2">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(pay.byMethod).length === 0 ? (
                          <tr><td colSpan={3} className="text-center text-slate-500 py-4">No payments yet.</td></tr>
                        ) : (
                          Object.entries(pay.byMethod).map(([m, v]) => (
                            <tr key={m} className="border-b border-slate-800/60">
                              <td className="py-2 px-2 capitalize text-slate-300">{m.replace(/_/g, ' ')}</td>
                              <td className="py-2 px-2 text-right text-slate-400">{fmtNum(v.count)}</td>
                              <td className="py-2 px-2 text-right text-emerald-300">{fmtINR(v.value)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base">By Currency</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(pay.byCurrency).length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">No currency data yet.</p>
                  ) : (
                    Object.entries(pay.byCurrency).sort((a, b) => b[1] - a[1]).map(([c, v]) => (
                      <div key={c} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300 font-medium">{c}</span>
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">{fmtINR(v)}</Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base">Reconciliation Rate</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Reconciled</span>
                    <span className="text-slate-200 font-medium">{pay.reconciliationRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={pay.reconciliationRate} className="h-2 bg-slate-800" />
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base">Treasury Visibility</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Multi-currency coverage</span>
                    <span className="text-slate-200 font-medium">{pay.treasuryVisibility.toFixed(1)}%</span>
                  </div>
                  <Progress value={pay.treasuryVisibility} className="h-2 bg-slate-800" />
                </CardContent>
              </Card>
            </div>

            <Card className="bg-slate-900/60 border-white/[0.06]">
              <CardHeader>
                <CardTitle className="text-slate-100 text-base">Recent Payments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                {pay.recentPayments.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">No payments yet.</p>
                ) : (
                  pay.recentPayments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-rose-300">{p.paymentNumber}</code>
                          <Badge variant="outline" className={`text-[10px] capitalize ${paymentStatusColor(p.status)}`}>{p.status}</Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {p.fromName} → {p.toName} · <span className="capitalize">{p.method.replace(/_/g, ' ')}</span> · {timeAgo(p.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-emerald-300">{fmtINR(p.amount)}</div>
                        <div className="text-[10px] text-slate-500">{p.currency}</div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Trust Network ─── */}
          <TabsContent value="trust" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <MiniStat label="Avg Trust" value={tr.avgTrustScore.toFixed(1)} />
              <MiniStat label="Avg Compliance" value={tr.avgComplianceScore.toFixed(1)} />
              <MiniStat label="Payment Reliability" value={tr.avgPaymentReliabilityScore.toFixed(1)} />
              <MiniStat label="Supplier Rating" value={tr.avgSupplierRating.toFixed(1)} />
              <MiniStat label="Customer Rating" value={tr.avgCustomerRating.toFixed(1)} />
              <MiniStat label="AI Confidence" value={tr.avgAiConfidenceScore.toFixed(1)} />
            </div>

            <Card className="bg-slate-900/60 border-white/[0.06]">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-400" /> Trust Distribution
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {fmtNum(tr.verifiedNodes)} verified · {tr.verificationRate.toFixed(1)}% verification rate · {fmtNum(tr.totalTrustEvents)} trust events
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <HealthBar label="High trust (≥80)" value={tr.trustDistribution.high} suffix=" nodes" color="emerald" />
                <HealthBar label="Medium trust (60-79)" value={tr.trustDistribution.medium} suffix=" nodes" color="amber" />
                <HealthBar label="Low trust (<60)" value={tr.trustDistribution.low} suffix=" nodes" color="rose" />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="text-slate-100 flex items-center gap-2">
                    <Crown className="h-5 w-5 text-amber-400" /> Top Trusted Nodes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-72 overflow-y-auto">
                  {tr.topTrustedNodes.length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">No trusted nodes yet.</p>
                  ) : (
                    tr.topTrustedNodes.map((n) => (
                      <div key={n.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-slate-200 truncate block">{n.tradeName ?? n.legalName}</span>
                          <span className="text-xs text-slate-500">{n.city ?? 'Unknown'} · {n.industry ?? '—'}</span>
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${trustColor(n.trustScore)}`}>
                          <ShieldCheck className="h-3 w-3 mr-1" /> {n.trustScore.toFixed(0)}
                        </Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-red-500/20">
                <CardHeader>
                  <CardTitle className="text-slate-100 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-400" /> At-Risk Nodes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-72 overflow-y-auto">
                  {tr.atRiskNodes.length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">No at-risk nodes. Network is healthy.</p>
                  ) : (
                    tr.atRiskNodes.map((n) => (
                      <div key={n.id} className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-slate-200 truncate block">{n.tradeName ?? n.legalName}</span>
                          <span className="text-xs text-slate-500 capitalize">{n.riskLevel} risk · {n.city ?? 'Unknown'}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] text-red-300 border-red-500/40">
                          <AlertTriangle className="h-3 w-3 mr-1" /> {n.trustScore.toFixed(0)}
                        </Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="bg-slate-900/60 border-white/[0.06]">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-sky-400" /> Recent Trust Events
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-80 overflow-y-auto">
                {tr.recentTrustEvents.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">No trust events yet.</p>
                ) : (
                  tr.recentTrustEvents.map((e) => (
                    <div key={e.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] capitalize ${trustEventColor(e.eventType)}`}>
                            {e.eventType.replace(/_/g, ' ')}
                          </Badge>
                          <span className="text-slate-200 truncate">{e.nodeName}</span>
                        </div>
                        <p className="text-slate-500 mt-0.5 truncate">{e.description}</p>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className={`font-medium ${e.delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {e.delta >= 0 ? '+' : ''}{e.delta}
                        </div>
                        <div className="text-[10px] text-slate-500">{timeAgo(e.createdAt)}</div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Opportunities ─── */}
          <TabsContent value="opportunities" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat label="Discovered" value={fmtNum(op.discoveredOpportunities)} />
              <MiniStat label="Qualified" value={fmtNum(op.qualifiedOpportunities)} />
              <MiniStat label="Proposed" value={fmtNum(op.proposedOpportunities)} />
              <MiniStat label="Accepted" value={fmtNum(op.acceptedOpportunities)} />
            </div>

            <Card className="bg-slate-900/60 border-white/[0.06]">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-400" /> Opportunity Funnel &amp; Value
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {fmtNum(op.totalOpportunities)} total · {fmtINR(op.totalPotentialValue)} potential · {op.avgProbability.toFixed(1)}% avg probability
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <FunnelBar label="Discovered" value={op.discoveredOpportunities} total={op.totalOpportunities} color="sky" />
                <FunnelBar label="Qualified" value={op.qualifiedOpportunities} total={op.totalOpportunities} color="teal" />
                <FunnelBar label="Proposed" value={op.proposedOpportunities} total={op.totalOpportunities} color="amber" />
                <FunnelBar label="Accepted" value={op.acceptedOpportunities} total={op.totalOpportunities} color="emerald" />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base">By Type</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(op.byType).length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">No type data yet.</p>
                  ) : (
                    Object.entries(op.byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300 capitalize">{k.replace(/_/g, ' ')}</span>
                        <Badge variant="outline" className="border-amber-500/40 text-amber-300">{fmtNum(v)}</Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base">By Source</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(op.bySource).length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">No source data yet.</p>
                  ) : (
                    Object.entries(op.bySource).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300 capitalize">{k.replace(/_/g, ' ')}</span>
                        <Badge variant="outline" className="border-sky-500/40 text-sky-300">{fmtNum(v)}</Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="bg-slate-900/60 border-white/[0.06]">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-400" /> Top Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                {op.topOpportunities.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">No opportunities yet.</p>
                ) : (
                  op.topOpportunities.map((o) => (
                    <div key={o.id} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-200 truncate">{o.title}</span>
                        <Badge variant="outline" className="border-amber-500/40 text-amber-300 text-[10px] capitalize shrink-0">
                          {o.type.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-xs text-slate-500">
                        <span>For: {o.forName}</span>
                        <span className="text-emerald-300 font-medium">{fmtINR(o.potentialValue)}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Progress value={o.probability} className="h-1.5 bg-slate-800" />
                        <span className="text-[10px] text-slate-500 shrink-0">{o.probability}%</span>
                        <Badge variant="outline" className={`text-[10px] capitalize shrink-0 ${opportunityStatusColor(o.status)}`}>
                          {o.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Benchmarking ─── */}
          <TabsContent value="benchmarking" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <MiniStat label="Industries Covered" value={fmtNum(bm.industriesCovered)} />
              <MiniStat label="Metrics Covered" value={fmtNum(bm.metricsCovered)} />
              <MiniStat label="Total Samples" value={fmtNum(bm.totalSamples)} />
            </div>

            <Card className="bg-slate-900/60 border-white/[0.06]">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <Scale className="h-5 w-5 text-violet-400" /> Industry Benchmarks
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {fmtNum(bm.totalBenchmarks)} benchmarks across {bm.industriesCovered} industries · period 2025-Q2
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BenchmarkTable benchmarks={bm.benchmarks} industries={bm.industries} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Knowledge ─── */}
          <TabsContent value="knowledge" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <MiniStat label="Total Signals" value={fmtNum(kn.totalSignals)} />
              <MiniStat label="High Impact" value={fmtNum(kn.highImpactSignals)} />
              <MiniStat label="Avg Confidence" value={`${kn.avgConfidence.toFixed(1)}%`} />
            </div>

            <Card className="bg-slate-900/60 border-white/[0.06]">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-sky-400" /> Detected Trends
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {kn.detectedTrends.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">No trends detected yet.</p>
                ) : (
                  kn.detectedTrends.map((t, idx) => (
                    <div key={`${t.trend}-${idx}`} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-200">{t.trend}</span>
                        <Badge variant="outline" className="border-sky-500/40 text-sky-300 text-[10px]">
                          {t.confidence.toFixed(0)}% confidence
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {t.affectedIndustries.slice(0, 5).map((ind) => (
                          <Badge key={ind} variant="outline" className="border-slate-700 text-slate-400 text-[10px]">{ind}</Badge>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-900/60 border-white/[0.06]">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-emerald-400" /> Recent Signals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                {kn.recentSignals.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">No signals yet.</p>
                ) : (
                  kn.recentSignals.map((s) => (
                    <div key={s.id} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] capitalize ${signalColor(s.signal)}`}>
                          {s.signal.replace(/_/g, ' ')}
                        </Badge>
                        <span className="text-sm font-medium text-slate-200 truncate">{s.title}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{s.description}</p>
                      <div className="flex items-center justify-between mt-1.5 text-xs">
                        <div className="flex items-center gap-2">
                          {s.industry && <span className="text-slate-400">{s.industry}</span>}
                          <Badge variant="outline" className={`text-[10px] capitalize ${impactColor(s.impact)}`}>
                            {s.impact} impact
                          </Badge>
                        </div>
                        <span className="text-slate-500">{s.sourcesCount} sources</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Progress value={s.confidence} className="h-1 bg-slate-800" />
                        <span className="text-[10px] text-slate-500 shrink-0">{s.confidence.toFixed(0)}%</span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Observability ─── */}
          <TabsContent value="observability" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <MiniStat label="Connected Orgs" value={fmtNum(ob.connectedOrganizations)} />
              <MiniStat label="Active Collaborations" value={fmtNum(ob.activeCollaborations)} />
              <MiniStat label="Transactions Today" value={fmtNum(ob.transactionsToday)} />
              <MiniStat label="Transactions (30d)" value={fmtNum(ob.transactions30d)} />
              <MiniStat label="Payments Flowing" value={fmtNum(ob.paymentsFlowing)} />
              <MiniStat label="Supply Chain Health" value={`${ob.supplyChainHealth.toFixed(1)}%`} />
              <MiniStat label="Network Health" value={`${ob.networkHealth.toFixed(1)}%`} />
              <MiniStat label="Network Latency" value={`${ob.networkLatency.toFixed(0)}ms`} />
            </div>

            <Card className="bg-slate-900/60 border-white/[0.06]">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-400" /> 7-Day Transaction Volume
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between gap-2 h-40">
                  {ob.transactionsByDay.length === 0 ? (
                    <p className="text-sm text-slate-500 w-full text-center py-12">No transaction data yet.</p>
                  ) : (
                    ob.transactionsByDay.map((day) => {
                      const max = Math.max(1, ...ob.transactionsByDay.map((x) => x.count));
                      const h = (day.count / max) * 100;
                      return (
                        <div key={day.day} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full rounded-t bg-gradient-to-t from-emerald-600 to-teal-400" style={{ height: `${Math.max(4, h)}%` }} title={`${day.count} txns · ${fmtINR(day.value)}`} />
                          <span className="text-[10px] text-slate-500">{day.day.slice(5)}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base">Transactions by Type</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5">
                  {Object.entries(ob.transactionsByType).length === 0 ? (
                    <p className="text-sm text-slate-500">No data yet.</p>
                  ) : (
                    Object.entries(ob.transactionsByType).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                      <Badge key={k} variant="outline" className="border-emerald-500/30 text-emerald-200 capitalize text-[10px]">
                        {k.replace(/_/g, ' ')} · {fmtNum(v)}
                      </Badge>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base">Top Active Nodes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-52 overflow-y-auto">
                  {ob.topActiveNodes.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4 text-center">No active nodes yet.</p>
                  ) : (
                    ob.topActiveNodes.map((n) => (
                      <div key={n.nodeId} className="flex items-center justify-between text-sm">
                        <span className="text-slate-200 truncate">{n.name}</span>
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 text-[10px]">{fmtNum(n.activity)} txns</Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Network latency (avg)</span>
                    <span className="text-slate-200 font-medium">{ob.networkLatency.toFixed(0)} ms</span>
                  </div>
                  <Progress value={Math.min(100, (ob.networkLatency / 500) * 100)} className="h-2 bg-slate-800" />
                </CardContent>
              </Card>
              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Error rate</span>
                    <span className="text-slate-200 font-medium">{ob.errorRate.toFixed(2)}%</span>
                  </div>
                  <Progress value={Math.min(100, ob.errorRate)} className="h-2 bg-slate-800" />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ─── Security ─── */}
          <TabsContent value="security" className="space-y-4 mt-4">
            <Card className="bg-slate-900/60 border-white/[0.06]">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-400" /> Security Posture
                </CardTitle>
                <CardDescription className="text-slate-400">8 hardening controls — all enforced across the network.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[
                    { label: 'Organization Isolation', on: sec.organizationIsolation },
                    { label: 'RBAC', on: sec.rbacEnforced },
                    { label: 'Zero Trust', on: sec.zeroTrust },
                    { label: 'E2E Encryption', on: sec.e2eEncryption },
                    { label: 'Digital Signatures', on: sec.digitalSignatures },
                    { label: 'Audit Logs', on: sec.auditLogs },
                    { label: 'Consent Management', on: sec.consentManagement },
                    { label: 'Data Residency', on: sec.dataResidency },
                  ].map((c) => (
                    <div key={c.label} className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                      <span className="text-sm text-slate-200">{c.label}</span>
                      {c.on ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <MiniStat label="Audit Events (30d)" value={fmtNum(sec.auditEvents30d)} />
              <MiniStat label="Consent Records" value={fmtNum(sec.consentRecords)} />
              <MiniStat label="Security Score" value={`${sec.securityScore.toFixed(0)} / 100`} />
            </div>

            <Card className="bg-slate-900/60 border-white/[0.06]">
              <CardHeader>
                <CardTitle className="text-slate-100 text-base">Security Score</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Composite score (hardening + audit + consent)</span>
                  <span className="text-emerald-300 font-medium">{sec.securityScore.toFixed(0)}%</span>
                </div>
                <Progress value={sec.securityScore} className="h-2 bg-slate-800" />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Performance ─── */}
          <TabsContent value="performance" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <CapacityCard
                icon={Building2}
                label="Organizations"
                current={pf.currentOrganizations}
                target={pf.targetOrganizations}
                accent="emerald"
              />
              <CapacityCard
                icon={Link2}
                label="Relationships"
                current={pf.currentRelationships}
                target={pf.targetRelationships}
                accent="sky"
              />
              <CapacityCard
                icon={ArrowLeftRight}
                label="Daily Transactions"
                current={pf.currentDailyTransactions}
                target={pf.targetDailyTransactions}
                accent="violet"
              />
            </div>

            <Card className="bg-slate-900/60 border-white/[0.06]">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <Server className="h-5 w-5 text-emerald-400" /> Regional Deployment
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {pf.regions} active regions · multi-region {pf.multiRegion ? '✓' : '✗'} · edge sync {pf.edgeSynchronization ? '✓' : '✗'} · distributed graph {pf.distributedGraph ? '✓' : '✗'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {['ap-south-1', 'us-east-1', 'eu-west-1', 'ap-southeast-1'].map((r) => (
                    <div key={r} className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-center">
                      <Server className="h-4 w-4 text-emerald-400 mx-auto" />
                      <code className="block text-xs text-emerald-300 font-mono mt-1">{r}</code>
                      <span className="text-[10px] text-slate-500">live</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base">Multi-Region</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-2">
                  {pf.multiRegion ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-400" />
                  )}
                  <span className="text-sm text-slate-300">Active-active across {pf.regions} regions</span>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base">Edge Synchronization</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-2">
                  {pf.edgeSynchronization ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-400" />
                  )}
                  <span className="text-sm text-slate-300">Real-time edge replication</span>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base">Distributed Graph</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-2">
                  {pf.distributedGraph ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-400" />
                  )}
                  <span className="text-sm text-slate-300">Sharded graph database</span>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/60 border-white/[0.06]">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base">p95 Latency / Uptime</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <StatRow label="p95 latency" value={`${pf.p95Latency.toFixed(0)} ms`} />
                  <StatRow label="Uptime" value={`${pf.uptime.toFixed(2)}%`} />
                  <StatRow label="Utilization" value={`${pf.utilization.toFixed(6)}%`} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* ─── Footer ─── */}
        <footer className="pt-6 mt-6 border-t border-slate-800/60 text-center text-xs text-slate-500">
          <p className="font-semibold text-slate-400">{NETWORK_TAGLINE}</p>
          <p className="mt-1">{TOTAL_NETWORK_SUBSYSTEMS} subsystems · {d.dataSources.length} data sources · REAL connected business data</p>
          <p className="mt-1 text-amber-400/80">Founder &amp; Owner: Prince Singh</p>
        </footer>
      </main>

      {/* ─── Connect Organization Dialog ─── */}
      <ConnectDialog open={connectOpen} onOpenChange={setConnectOpen} onDone={load} apiPost={apiPost} />

      {/* ─── Create RFQ Dialog ─── */}
      <RfqDialog open={rfqOpen} onOpenChange={setRfqOpen} onDone={load} apiPost={apiPost} />

      {/* ─── Send Payment Dialog ─── */}
      <PaymentDialog open={paymentOpen} onOpenChange={setPaymentOpen} onDone={load} apiPost={apiPost} />
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
    <div className="rounded-lg border border-white/[0.06] bg-slate-950/40 px-3 py-2">
      <div className="text-lg font-semibold text-slate-100">{value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm gap-2">
      <span className="text-slate-400 truncate">{label}</span>
      <span className="text-slate-200 font-medium text-right truncate">{value}</span>
    </div>
  );
}

function HealthBar({ label, value, suffix = '', color }: { label: string; value: number; suffix?: string; color?: string }) {
  const colorClass = color === 'amber' ? 'bg-amber-500' : color === 'rose' ? 'bg-rose-500' : 'bg-emerald-500';
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-200 font-medium">{fmtNum(value)}{suffix}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full ${colorClass}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function FunnelBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  const colorClass =
    color === 'sky' ? 'bg-sky-500' :
    color === 'teal' ? 'bg-teal-500' :
    color === 'amber' ? 'bg-amber-500' :
    'bg-emerald-500';
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400 w-24 shrink-0">{label}</span>
      <div className="flex-1 h-6 rounded bg-slate-800 overflow-hidden relative">
        <div className={`h-full ${colorClass} flex items-center justify-end px-2`} style={{ width: `${Math.max(pct, value > 0 ? 8 : 0)}%` }}>
          <span className="text-[10px] text-white font-medium">{fmtNum(value)}</span>
        </div>
      </div>
      <span className="text-xs text-slate-500 w-12 text-right shrink-0">{pct.toFixed(0)}%</span>
    </div>
  );
}

function CapacityCard({ icon: Icon, label, current, target, accent }: { icon: LucideIcon; label: string; current: number; target: number; accent: string }) {
  const pct = target > 0 ? (current / target) * 100 : 0;
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
      <div className="mt-1 text-2xl font-bold text-slate-100">{fmtNum(current)}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">of {fmtNum(target)} target</div>
      <div className="mt-2 h-1.5 rounded-full bg-slate-800/60 overflow-hidden">
        <div className="h-full bg-current opacity-60" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="text-[10px] text-slate-500 mt-1">{pct.toFixed(pct < 1 ? 4 : 2)}% utilization</div>
    </motion.div>
  );
}

function OrganizationCard({ node, compact }: { node: NetworkNode; compact?: boolean }) {
  const nt = node.nodeType;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/[0.06] bg-slate-900/60 p-4 flex flex-col"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-100 truncate">{node.legalName}</h3>
            {node.verified && (
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 text-[10px] shrink-0">
                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Verified
              </Badge>
            )}
          </div>
          {node.tradeName && <p className="text-xs text-slate-500 mt-0.5 truncate">{node.tradeName}</p>}
        </div>
        <Badge variant="outline" className={`text-[10px] capitalize shrink-0 ${nodeTypeBadgeColor(nt)}`}>
          {nt.replace(/_/g, ' ')}
        </Badge>
      </div>

      <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
        <Building2 className="h-3 w-3" />
        <span>{[node.city, node.state].filter(Boolean).join(', ') || 'Unknown'}</span>
        {node.industry && <span>· {node.industry}</span>}
      </div>

      <div className="flex items-center justify-between mt-2 text-xs">
        <span className="text-slate-500 flex items-center gap-1">
          <ShieldCheck className={`h-3 w-3 ${trustColor(node.trustScore)}`} />
          <span className={trustColor(node.trustScore)}>{node.trustScore.toFixed(0)} trust</span>
        </span>
        <span className="text-slate-500">{fmtNum(node.employeeCount)} emp</span>
      </div>

      {!compact && (
        <>
          <Separator className="bg-slate-800 my-2" />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-slate-500">Annual Revenue</div>
              <div className="text-slate-200 font-medium">{fmtINR(node.annualRevenue)}</div>
            </div>
            <div>
              <div className="text-slate-500">Connections</div>
              <div className="text-slate-200 font-medium">{fmtNum(node.totalConnections)}</div>
            </div>
            <div>
              <div className="text-slate-500">Transactions</div>
              <div className="text-slate-200 font-medium">{fmtNum(node.totalTransactions)}</div>
            </div>
            <div>
              <div className="text-slate-500">Txn Value</div>
              <div className="text-slate-200 font-medium">{fmtINR(node.totalTransactionValue)}</div>
            </div>
          </div>
          {node.gstin && (
            <div className="mt-2 text-[10px] text-slate-500 font-mono">GSTIN: {node.gstin}</div>
          )}
        </>
      )}
    </motion.div>
  );
}

// ─── Status color helpers ─────────────────────────────────────────────────────
function rfqStatusColor(s: string): string {
  if (s === 'open') return 'border-emerald-500/40 text-emerald-300';
  if (s === 'awarded') return 'border-sky-500/40 text-sky-300';
  if (s === 'closed') return 'border-slate-600 text-slate-400';
  return 'border-red-500/40 text-red-300';
}

function poStatusColor(s: string): string {
  if (s === 'fulfilled' || s === 'accepted') return 'border-emerald-500/40 text-emerald-300';
  if (s === 'sent') return 'border-sky-500/40 text-sky-300';
  if (s === 'draft') return 'border-slate-600 text-slate-400';
  return 'border-red-500/40 text-red-300';
}

function contractStatusColor(s: string): string {
  if (s === 'active') return 'border-emerald-500/40 text-emerald-300';
  if (s === 'draft') return 'border-slate-600 text-slate-400';
  if (s === 'expired') return 'border-amber-500/40 text-amber-300';
  return 'border-red-500/40 text-red-300';
}

function paymentStatusColor(s: string): string {
  if (s === 'completed') return 'border-emerald-500/40 text-emerald-300';
  if (s === 'processing' || s === 'pending') return 'border-amber-500/40 text-amber-300';
  return 'border-red-500/40 text-red-300';
}

function opportunityStatusColor(s: string): string {
  if (s === 'accepted') return 'border-emerald-500/40 text-emerald-300';
  if (s === 'proposed') return 'border-sky-500/40 text-sky-300';
  if (s === 'qualified') return 'border-amber-500/40 text-amber-300';
  if (s === 'discovered') return 'border-slate-600 text-slate-400';
  return 'border-red-500/40 text-red-300';
}

function trustEventColor(t: string): string {
  if (t === 'verification' || t === 'compliance_update') return 'border-emerald-500/40 text-emerald-300';
  if (t === 'review' || t === 'payment_event') return 'border-sky-500/40 text-sky-300';
  if (t === 'violation') return 'border-red-500/40 text-red-300';
  return 'border-amber-500/40 text-amber-300';
}

function signalColor(s: string): string {
  const map: Record<string, string> = {
    industry_trend: 'border-sky-500/40 text-sky-300',
    best_practice: 'border-emerald-500/40 text-emerald-300',
    market_opportunity: 'border-amber-500/40 text-amber-300',
    supply_shortage: 'border-red-500/40 text-red-300',
    tax_change: 'border-violet-500/40 text-violet-300',
    economic_signal: 'border-teal-500/40 text-teal-300',
  };
  return map[s] ?? 'border-slate-600 text-slate-400';
}

function impactColor(i: string): string {
  if (i === 'high') return 'border-red-500/40 text-red-300';
  if (i === 'medium') return 'border-amber-500/40 text-amber-300';
  return 'border-slate-600 text-slate-400';
}

function nodeTypeBadgeColor(t: NodeType): string {
  const map: Record<NodeType, string> = {
    organization: 'border-emerald-500/40 text-emerald-300',
    customer: 'border-sky-500/40 text-sky-300',
    vendor: 'border-slate-600 text-slate-400',
    supplier: 'border-amber-500/40 text-amber-300',
    partner: 'border-teal-500/40 text-teal-300',
    government: 'border-violet-500/40 text-violet-300',
    bank: 'border-rose-500/40 text-rose-300',
    investor: 'border-fuchsia-500/40 text-fuchsia-300',
    accountant: 'border-cyan-500/40 text-cyan-300',
    auditor: 'border-orange-500/40 text-orange-300',
    logistics: 'border-lime-500/40 text-lime-300',
  };
  return map[t] ?? 'border-slate-600 text-slate-400';
}

// ─── Benchmark Table ──────────────────────────────────────────────────────────
function BenchmarkTable({ benchmarks, industries }: { benchmarks: NetworkDashboard['benchmarking']['benchmarks']; industries: string[] }) {
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all' ? benchmarks : benchmarks.filter((b) => b.industry === filter);

  // Group by metric, pick best sample across industries for display
  const byMetric = new Map<string, typeof benchmarks>();
  for (const b of filtered) {
    const arr = byMetric.get(b.metric) ?? [];
    arr.push(b);
    byMetric.set(b.metric, arr);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Label className="text-slate-300 text-xs">Industry:</Label>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="bg-slate-950 border-slate-700 h-8 w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all">All industries</SelectItem>
            {industries.map((i) => (
              <SelectItem key={i} value={i}>{i}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-500">{filtered.length} benchmarks</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 bg-slate-950/60 border-b border-slate-800">
              <th className="text-left py-2 px-3">Metric</th>
              <th className="text-right py-2 px-3">p25</th>
              <th className="text-right py-2 px-3">p50 (median)</th>
              <th className="text-right py-2 px-3">p75</th>
              <th className="text-right py-2 px-3">p90</th>
              <th className="text-right py-2 px-3">Sample</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-slate-500 py-6">No benchmarks available.</td>
              </tr>
            ) : (
              filtered.map((b) => {
                const p50Color = b.p50 >= 75 ? 'text-emerald-300' : b.p50 >= 50 ? 'text-amber-300' : 'text-red-300';
                return (
                  <tr key={b.id} className="border-b border-slate-800/60 hover:bg-slate-950/40">
                    <td className="py-2 px-3">
                      <div className="text-slate-200 capitalize">{b.metric.replace(/_/g, ' ')}</div>
                      <div className="text-[10px] text-slate-500">{b.industry}</div>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-400">{b.p25.toFixed(1)}</td>
                    <td className={`py-2 px-3 text-right font-semibold ${p50Color}`}>{b.p50.toFixed(1)}</td>
                    <td className="py-2 px-3 text-right text-slate-400">{b.p75.toFixed(1)}</td>
                    <td className="py-2 px-3 text-right text-slate-400">{b.p90.toFixed(1)}</td>
                    <td className="py-2 px-3 text-right text-slate-500 text-xs">{fmtNum(b.sampleSize)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Dialogs ──────────────────────────────────────────────────────────────────
type ApiPostFn = (endpoint: string, body: unknown) => Promise<{ ok: boolean; data: unknown }>;

function ConnectDialog({ open, onOpenChange, onDone, apiPost }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void; apiPost: ApiPostFn }) {
  const { toast } = useToast();
  const [toOrgName, setToOrgName] = useState('');
  const [toOrgEmail, setToOrgEmail] = useState('');
  const [relationshipType, setRelationshipType] = useState('partner');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!toOrgName || !toOrgEmail) {
      toast({ title: 'Name and email required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { ok } = await apiPost('connect', {
      toOrgId: toOrgEmail,
      fromNodeName: 'VEYRO Host',
      toNodeName: toOrgName,
      toOrgEmail,
      relationshipType,
      message,
      initiatedBy: 'founder',
    });
    setSubmitting(false);
    if (ok) {
      toast({ title: 'Connection request sent', description: `${toOrgName} has been invited to join the network.` });
      setToOrgName(''); setToOrgEmail(''); setRelationshipType('partner'); setMessage('');
      onOpenChange(false); onDone();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect Organization</DialogTitle>
          <DialogDescription className="text-slate-400">
            Invite a business to join the Global Enterprise Network™ as a connected node.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-slate-300">Organization Name</Label>
            <Input value={toOrgName} onChange={(e) => setToOrgName(e.target.value)} placeholder="Acme Industries Pvt Ltd" className="bg-slate-950 border-slate-700 mt-1" />
          </div>
          <div>
            <Label className="text-slate-300">Contact Email</Label>
            <Input value={toOrgEmail} onChange={(e) => setToOrgEmail(e.target.value)} placeholder="contact@acme.com" className="bg-slate-950 border-slate-700 mt-1" />
          </div>
          <div>
            <Label className="text-slate-300">Relationship Type</Label>
            <Select value={relationshipType} onValueChange={setRelationshipType}>
              <SelectTrigger className="bg-slate-950 border-slate-700 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {['partner', 'customer', 'vendor', 'supplier'].map((r) => (
                  <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-slate-300">Message (optional)</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Let's collaborate on…" className="bg-slate-950 border-slate-700 mt-1 min-h-20" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-700">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Send Invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RfqDialog({ open, onOpenChange, onDone, apiPost }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void; apiPost: ApiPostFn }) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('goods');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('unit');
  const [budgetMax, setBudgetMax] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!title) {
      toast({ title: 'Title required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { ok } = await apiPost('rfq', {
      fromNodeId: 'host',
      title,
      description,
      category,
      quantity: Number(quantity) || 1,
      unit,
      budgetMax: Number(budgetMax) || 0,
      currency,
      deliveryLocation,
    });
    setSubmitting(false);
    if (ok) {
      toast({ title: 'RFQ created', description: `${title} is now open for quotations.` });
      setTitle(''); setDescription(''); setCategory('goods'); setQuantity('1'); setUnit('unit');
      setBudgetMax(''); setCurrency('INR'); setDeliveryLocation('');
      onOpenChange(false); onDone();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg">
        <DialogHeader>
          <DialogTitle>Create RFQ</DialogTitle>
          <DialogDescription className="text-slate-400">
            Publish a Request for Quotation to the B2B Commerce Cloud™.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-slate-300">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Steel coils — 5 tonnes" className="bg-slate-950 border-slate-700 mt-1" />
          </div>
          <div>
            <Label className="text-slate-300">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Specifications, grade, certifications required…" className="bg-slate-950 border-slate-700 mt-1 min-h-20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-300">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-slate-950 border-slate-700 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {['goods', 'services', 'raw_materials', 'equipment', 'logistics', 'consulting'].map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">{c.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300">Quantity</Label>
              <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="bg-slate-950 border-slate-700 mt-1" />
            </div>
            <div>
              <Label className="text-slate-300">Unit</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} className="bg-slate-950 border-slate-700 mt-1" />
            </div>
            <div>
              <Label className="text-slate-300">Budget Max</Label>
              <Input type="number" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} placeholder="500000" className="bg-slate-950 border-slate-700 mt-1" />
            </div>
            <div>
              <Label className="text-slate-300">Currency</Label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} className="bg-slate-950 border-slate-700 mt-1" />
            </div>
            <div>
              <Label className="text-slate-300">Delivery Location</Label>
              <Input value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} placeholder="Mumbai, IN" className="bg-slate-950 border-slate-700 mt-1" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-700">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create RFQ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ open, onOpenChange, onDone, apiPost }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void; apiPost: ApiPostFn }) {
  const { toast } = useToast();
  const [fromNodeId, setFromNodeId] = useState('host');
  const [toNodeId, setToNodeId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [method, setMethod] = useState('domestic_transfer');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!toNodeId || !amount) {
      toast({ title: 'Recipient and amount required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { ok } = await apiPost('payment', {
      fromNodeId,
      toNodeId,
      amount: Number(amount) || 0,
      currency,
      method,
      reference,
    });
    setSubmitting(false);
    if (ok) {
      toast({ title: 'Payment initiated', description: `${fmtINR(Number(amount) || 0)} ${currency} via ${method.replace(/_/g, ' ')}` });
      setFromNodeId('host'); setToNodeId(''); setAmount(''); setCurrency('INR');
      setMethod('domestic_transfer'); setReference('');
      onOpenChange(false); onDone();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Payment</DialogTitle>
          <DialogDescription className="text-slate-400">
            Initiate a payment through the Global Payments Network™.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-300">From Node ID</Label>
              <Input value={fromNodeId} onChange={(e) => setFromNodeId(e.target.value)} className="bg-slate-950 border-slate-700 mt-1" />
            </div>
            <div>
              <Label className="text-slate-300">To Node ID</Label>
              <Input value={toNodeId} onChange={(e) => setToNodeId(e.target.value)} placeholder="node-abc123" className="bg-slate-950 border-slate-700 mt-1" />
            </div>
            <div>
              <Label className="text-slate-300">Amount</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50000" className="bg-slate-950 border-slate-700 mt-1" />
            </div>
            <div>
              <Label className="text-slate-300">Currency</Label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} className="bg-slate-950 border-slate-700 mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-slate-300">Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="bg-slate-950 border-slate-700 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {['domestic_transfer', 'international_wire', 'upi', 'rtgs', 'neft', 'imps', 'card'].map((m) => (
                  <SelectItem key={m} value={m} className="capitalize">{m.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-slate-300">Reference (optional)</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Invoice #INV-2025-001" className="bg-slate-950 border-slate-700 mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-700">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="bg-rose-600 hover:bg-rose-700">
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Send Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
