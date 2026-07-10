'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT ENTERPRISE CLOUD PLATFORM™ — GLOBAL SAAS INFRASTRUCTURE
//
// Transform GSTPilot Infinity™ from an enterprise application into a globally
// deployable SaaS platform serving thousands of organisations. Oracle™ now
// powers customers. Every organisation gets its own secure enterprise.
//
// 14 Subsystems:
//   1.  Global Multi-Tenant Platform™ (organisations + isolation)
//   2.  Organisation Management™ (orgs, subsidiaries, branches, departments)
//   3.  Enterprise Identity Cloud™ (9 auth providers, MFA, SSO)
//   4.  Subscription Platform™ (6 plans, billing cycles, trials, coupons)
//   5.  Billing Engine™ (auto-invoicing, usage, overages)
//   6.  Customer Admin Center™ (users, roles, integrations, branding)
//   7.  White Label Platform™ (custom logo, colors, domains, templates)
//   8.  Marketplace Platform™ (apps, agents, workflows, connectors, packs)
//   9.  API Platform™ (REST, GraphQL, webhooks, SDKs, OAuth, keys)
//  10.  DevOps Cloud™ (environments, blue/green, canary, CI/CD)
//  11.  Enterprise Monitoring™ (orgs, users, API, AGI, errors, uptime)
//  12.  Customer Success Center™ (adoption, health, churn, expansion)
//  13.  Security™ (RBAC, ABAC, audit, encryption, SOC2, ISO 27001)
//  14.  Performance™ (100K orgs, 10M users, 1B API/day, autoscaling, HA)
//
// Tagline: Build Once. Deploy Globally. Scale Infinitely.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe2, Building2, ShieldCheck, CreditCard, Receipt, Users2, Palette,
  Store, Code2, ServerCog, Activity, HeartHandshake, Lock, Gauge,
  RefreshCw, Sparkles, Loader2, CheckCircle2, XCircle, Clock, ArrowRight,
  Plus, UserPlus, Zap, TrendingUp, AlertTriangle, Star, Package,
  Cloud, GitBranch, Cpu, KeyRound, Webhook, BookOpen, ShieldAlert,
  TrendingDown, Crown, Rocket, Layers, Database, Server, Network,
  ChevronRight, Search, ExternalLink, type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  PLATFORM_TAGLINE,
  type PlatformDashboard, type Organization, type PlanKey,
} from '@/lib/platform/types';
import { PLATFORM_PLANS, PLAN_MAP, formatINR } from '@/lib/platform/plans';

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
  return `${Math.floor(h / 24)}d ago`;
}

function statusColor(status: string): string {
  if (['active', 'healthy', 'paid', 'installed', 'connected', 'provisioned', 'proceed'].includes(status)) return 'text-emerald-400';
  if (['trial', 'issued', 'deploying', 'provisioning', 'configured'].includes(status)) return 'text-sky-400';
  if (['past_due', 'overdue', 'unhealthy', 'at_risk', 'failed'].includes(status)) return 'text-amber-400';
  if (['cancelled', 'suspended', 'void', 'revoked', 'rolled_back', 'critical'].includes(status)) return 'text-red-400';
  return 'text-muted-foreground';
}

function planColor(plan: PlanKey): string {
  switch (plan) {
    case 'starter': return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
    case 'professional': return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
    case 'business': return 'bg-teal-500/15 text-teal-300 border-teal-500/30';
    case 'enterprise': return 'bg-violet-500/15 text-violet-300 border-violet-500/30';
    case 'enterprise_plus': return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    case 'custom': return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    default: return 'bg-white/[0.04] text-muted-foreground border-white/[0.08]';
  }
}

function healthColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-sky-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ icon: Icon, label, value, sub, accent }: { icon: LucideIcon; label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <Card className="bg-white/[0.03] border-white/[0.08] overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className={`text-xl font-bold mt-1 ${accent ?? 'text-foreground'}`}>{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
          </div>
          <div className="rounded-lg bg-white/[0.04] p-2 shrink-0">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, subtitle, accent }: { icon: LucideIcon; title: string; subtitle?: string; accent?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`rounded-lg p-2 ${accent ?? 'bg-white/[0.04]'}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Subsystem Pill ───────────────────────────────────────────────────────────

const SUBSYSTEMS: { name: string; icon: LucideIcon }[] = [
  { name: 'Multi-Tenant Platform', icon: Globe2 },
  { name: 'Organization Management', icon: Building2 },
  { name: 'Enterprise Identity', icon: ShieldCheck },
  { name: 'Subscriptions', icon: CreditCard },
  { name: 'Billing Engine', icon: Receipt },
  { name: 'Customer Admin', icon: Users2 },
  { name: 'White Label', icon: Palette },
  { name: 'Marketplace', icon: Store },
  { name: 'API Platform', icon: Code2 },
  { name: 'DevOps Cloud', icon: ServerCog },
  { name: 'Monitoring', icon: Activity },
  { name: 'Customer Success', icon: HeartHandshake },
  { name: 'Security', icon: Lock },
  { name: 'Performance', icon: Gauge },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function EnterpriseCloudPlatformPage() {
  const { toast } = useToast();
  const [dashboard, setDashboard] = useState<PlatformDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [orgSearch, setOrgSearch] = useState('');
  const [showCreateOrg, setShowCreateOrg] = useState(false);

  // Create-org form state
  const [newOrg, setNewOrg] = useState({ name: '', plan: 'professional' as PlanKey, billingCycle: 'monthly', ownerEmail: '', seats: 5, industry: 'Services' });
  const [creating, setCreating] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/platform/dashboard');
      if (!res.ok) throw new Error('Failed to load platform dashboard');
      const data: PlatformDashboard = await res.json();
      setDashboard(data);
    } catch (e) {
      toast({
        title: 'Platform dashboard unavailable',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const handleCreateOrg = useCallback(async () => {
    if (!newOrg.name || !newOrg.ownerEmail) {
      toast({ title: 'Name and owner email are required', variant: 'destructive' });
      return;
    }
    try {
      setCreating(true);
      const res = await fetch('/api/platform/create-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrg),
      });
      if (!res.ok) throw new Error('Failed to create organisation');
      const data = await res.json();
      toast({
        title: 'Organisation provisioned',
        description: `${newOrg.name} is now on a 14-day trial. AGI + devops environments provisioned.`,
      });
      setShowCreateOrg(false);
      setNewOrg({ name: '', plan: 'professional', billingCycle: 'monthly', ownerEmail: '', seats: 5, industry: 'Services' });
      loadDashboard();
    } catch (e) {
      toast({ title: 'Create failed', description: e instanceof Error ? e.message : 'Unknown', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }, [newOrg, toast, loadDashboard]);

  const handleQuickAction = useCallback(async (action: string) => {
    toast({
      title: `${action} triggered`,
      description: 'Use the Executive API endpoints to automate this at scale.',
    });
  }, [toast]);

  // ─── Loading skeleton ───────────────────────────────────────────────────────
  if (loading || !dashboard) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-96" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const h = dashboard.headline;
  const filteredOrgs = dashboard.organizations.topOrganizations.filter(
    (o) => !orgSearch || o.name.toLowerCase().includes(orgSearch.toLowerCase()) || o.slug.includes(orgSearch.toLowerCase()),
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* ═══ Header ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-sky-500/20 to-teal-500/20 p-2.5 border border-sky-500/20">
              <Cloud className="h-6 w-6 text-sky-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-sky-300 via-teal-200 to-emerald-300 bg-clip-text text-transparent">
                Enterprise Cloud Platform™
              </h1>
              <p className="text-xs text-muted-foreground">{PLATFORM_TAGLINE}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadDashboard} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreateOrg((v) => !v)}>
            <Plus className="h-4 w-4 mr-2" />
            New Organisation
          </Button>
        </div>
      </motion.div>

      {/* ═══ Subsystem Pills ═══ */}
      <div className="flex flex-wrap gap-1.5">
        {SUBSYSTEMS.map((s, i) => (
          <Badge key={s.name} variant="outline" className="bg-white/[0.02] border-white/[0.08] text-[10px] gap-1 py-1">
            <s.icon className="h-3 w-3 text-sky-400" />
            {s.name}
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
          </Badge>
        ))}
      </div>

      {/* ═══ Headline KPI Row ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard icon={Building2} label="Organisations" value={fmtNum(h.totalOrganizations)} sub={`${h.payingOrganizations} paying · ${h.trialOrganizations} trial`} accent="text-sky-300" />
        <KPICard icon={Users2} label="Total Users" value={fmtNum(h.totalUsers)} sub={`${fmtNum(h.activeUsers24h)} active 24h`} accent="text-teal-300" />
        <KPICard icon={CreditCard} label="MRR" value={fmtINR(h.mrr)} sub={`ARR ${fmtINR(h.arr)}`} accent="text-emerald-300" />
        <KPICard icon={Activity} label="API Calls Today" value={fmtNum(h.apiCallsToday)} sub={`${fmtNum(h.agiExecutionsToday)} AGI runs`} accent="text-violet-300" />
        <KPICard icon={HeartHandshake} label="Avg Health" value={`${Math.round(h.averageHealthScore)}/100`} sub={`CSAT ${h.averageSatisfaction}/5`} accent={healthColor(h.averageHealthScore)} />
        <KPICard icon={Gauge} label="Uptime" value={`${h.uptimePct}%`} sub={`${fmtNum(h.marketplaceInstalls)} marketplace installs`} accent="text-emerald-300" />
      </div>

      {/* ═══ Create-Org Inline Form ═══ */}
      <AnimatePresence>
        {showCreateOrg && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Card className="bg-sky-500/[0.04] border-sky-500/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Rocket className="h-4 w-4 text-sky-300" /> Provision a New Customer Organisation</CardTitle>
                <CardDescription>Creates an isolated tenant with AGI instance, devops environments, identity provider & 14-day trial.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <Input placeholder="Organisation name" value={newOrg.name} onChange={(e) => setNewOrg((p) => ({ ...p, name: e.target.value }))} />
                <Input placeholder="owner@email.com" value={newOrg.ownerEmail} onChange={(e) => setNewOrg((p) => ({ ...p, ownerEmail: e.target.value }))} />
                <select className="bg-background border border-input rounded-md h-9 px-3 text-sm" value={newOrg.plan} onChange={(e) => setNewOrg((p) => ({ ...p, plan: e.target.value as PlanKey }))}>
                  {PLATFORM_PLANS.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                </select>
                <select className="bg-background border border-input rounded-md h-9 px-3 text-sm" value={newOrg.billingCycle} onChange={(e) => setNewOrg((p) => ({ ...p, billingCycle: e.target.value }))}>
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual (10% off)</option>
                </select>
                <Input type="number" min={1} placeholder="Seats" value={newOrg.seats} onChange={(e) => setNewOrg((p) => ({ ...p, seats: Number(e.target.value) || 1 }))} />
                <Button onClick={handleCreateOrg} disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  {creating ? 'Provisioning…' : 'Provision'}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Tabs ═══ */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollArea className="w-full whitespace-nowrap">
          <TabsList className="inline-flex h-10">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="organizations">Organisations</TabsTrigger>
            <TabsTrigger value="identity">Identity</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="whitelabel">White Label</TabsTrigger>
            <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
            <TabsTrigger value="apis">API Platform</TabsTrigger>
            <TabsTrigger value="devops">DevOps</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
            <TabsTrigger value="success">Customer Success</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>
        </ScrollArea>

        {/* ═════════════ OVERVIEW ═════════════ */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Platform Snapshot */}
            <Card className="lg:col-span-2 bg-white/[0.03] border-white/[0.08]">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Layers className="h-4 w-4 text-sky-300" /> Platform Snapshot</CardTitle>
                <CardDescription>Global SaaS infrastructure — {dashboard.subsystemsImplemented}/{dashboard.subsystemsTotal} subsystems operational</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Countries</p>
                  <p className="text-lg font-bold text-sky-300">{dashboard.organizations.summary.countries}</p>
                </div>
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Time Zones</p>
                  <p className="text-lg font-bold text-teal-300">{dashboard.organizations.summary.timezones}</p>
                </div>
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Departments</p>
                  <p className="text-lg font-bold text-violet-300">{fmtNum(dashboard.organizations.summary.departmentsTotal)}</p>
                </div>
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Cost Centres</p>
                  <p className="text-lg font-bold text-amber-300">{fmtNum(dashboard.organizations.summary.costCentersTotal)}</p>
                </div>
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Identity Providers</p>
                  <p className="text-lg font-bold text-emerald-300">{dashboard.identity.providers.filter((p) => p.status === 'connected').length}/{dashboard.identity.providers.length}</p>
                </div>
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">API Keys</p>
                  <p className="text-lg font-bold text-sky-300">{dashboard.apiPlatform.activeKeys}</p>
                </div>
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">DevOps Envs</p>
                  <p className="text-lg font-bold text-teal-300">{dashboard.devops.totalEnvironments}</p>
                </div>
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Marketplace</p>
                  <p className="text-lg font-bold text-rose-300">{dashboard.marketplace.totalInstalls}</p>
                </div>
              </CardContent>
            </Card>

            {/* Subscription Mix */}
            <Card className="bg-white/[0.03] border-white/[0.08]">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4 text-violet-300" /> Revenue by Plan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {dashboard.subscription.byPlan.map((p) => (
                  <div key={p.plan} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{p.planName} <span className="text-muted-foreground/60">({p.organizations})</span></span>
                      <span className="font-semibold">{fmtINR(p.mrr)}/mo</span>
                    </div>
                    <Progress value={p.pct} className="h-1.5" />
                  </div>
                ))}
                <Separator className="my-2" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Trials active</span>
                  <Badge className="bg-sky-500/15 text-sky-300 border-sky-500/30">{dashboard.subscription.trials.active}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Expiring ≤7d</span>
                  <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30">{dashboard.subscription.trials.expiring7d}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Conversion rate</span>
                  <span className="font-semibold text-emerald-300">{(dashboard.subscription.trials.conversionRate * 100).toFixed(0)}%</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Organisations */}
          <Card className="bg-white/[0.03] border-white/[0.08]">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-sky-300" /> Recently Onboarded Organisations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {dashboard.organizations.recentOrganizations.slice(0, 6).map((org) => (
                  <OrgCard key={org.id} org={org} compact />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Data Sources */}
          <Card className="bg-white/[0.02] border-white/[0.06]">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4 text-muted-foreground" /> Live Data Sources ({dashboard.dataSources.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {dashboard.dataSources.map((src) => (
                  <Badge key={src} variant="outline" className="bg-white/[0.02] border-white/[0.06] text-[10px] text-muted-foreground">
                    <Database className="h-3 w-3 mr-1" />{src}
                  </Badge>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                Generated at {new Date(dashboard.generatedAt).toLocaleString('en-IN')} · Cache: 45s · Live data: {dashboard.hasLiveData ? '✓' : '✗'}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═════════════ ORGANISATIONS ═════════════ */}
        <TabsContent value="organizations" className="space-y-4 mt-4">
          <Card className="bg-white/[0.03] border-white/[0.08]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-sky-300" /> Global Multi-Tenant Platform™</CardTitle>
                  <CardDescription>{dashboard.organizations.summary.total} organisations · {dashboard.organizations.summary.parents} parent · {dashboard.organizations.summary.subsidiaries} subsidiary · {dashboard.organizations.summary.branches} branch</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-8 h-9" placeholder="Search organisations…" value={orgSearch} onChange={(e) => setOrgSearch(e.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[640px] overflow-y-auto pr-1">
                {filteredOrgs.map((org) => <OrgCard key={org.id} org={org} />)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═════════════ IDENTITY ═════════════ */}
        <TabsContent value="identity" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard icon={Users2} label="Total Users" value={fmtNum(dashboard.identity.totalUsers)} sub={`${fmtNum(dashboard.identity.activeUsers)} active 30d`} />
            <KPICard icon={ShieldCheck} label="MFA Adoption" value={`${dashboard.identity.mfaAdoptionPct.toFixed(0)}%`} accent="text-emerald-300" />
            <KPICard icon={KeyRound} label="SSO Adoption" value={`${dashboard.identity.ssoAdoptionPct.toFixed(0)}%`} accent="text-sky-300" />
            <KPICard icon={Zap} label="Passwordless" value={`${dashboard.identity.passwordlessAdoptionPct.toFixed(0)}%`} accent="text-violet-300" />
          </div>
          <Card className="bg-white/[0.03] border-white/[0.08]">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Enterprise Identity Cloud™ — 9 Auth Providers</CardTitle>
              <CardDescription>Device trust enabled · Sessions: {dashboard.identity.sessionPolicy.maxSessionHours}h max · {dashboard.identity.sessionPolicy.idleTimeoutMinutes}m idle · {dashboard.identity.sessionPolicy.concurrentSessions} concurrent</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {dashboard.identity.providers.map((p) => (
                  <div key={p.key} className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{p.label}</span>
                      <Badge variant="outline" className={`text-[10px] ${p.status === 'connected' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : p.status === 'configured' ? 'bg-sky-500/10 text-sky-300 border-sky-500/20' : 'bg-white/[0.04] text-muted-foreground border-white/[0.08]'}`}>
                        {p.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                      <span>{p.userCount} users</span>
                      {p.ssoReady && <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> SSO</span>}
                      {p.supportsMfa && <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> MFA</span>}
                      {p.supportsPasswordless && <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Passwordless</span>}
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">Last sync: {timeAgo(p.lastSyncAt)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═════════════ SUBSCRIPTIONS ═════════════ */}
        <TabsContent value="subscriptions" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 bg-white/[0.03] border-white/[0.08]">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4 text-violet-300" /> Subscription Platform™ — 6 Plans</CardTitle>
                <CardDescription>Monthly + annual billing · trials · coupons · usage billing · AI credits</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {PLATFORM_PLANS.map((p) => {
                    const live = dashboard.subscription.byPlan.find((b) => b.plan === p.key);
                    return (
                      <div key={p.key} className={`rounded-lg border p-3 ${p.recommended ? 'bg-sky-500/[0.06] border-sky-500/30' : 'bg-white/[0.02] border-white/[0.06]'}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{p.name}</span>
                          {p.recommended && <Badge className="bg-sky-500/15 text-sky-300 border-sky-500/30 text-[10px]">Recommended</Badge>}
                        </div>
                        <p className="text-lg font-bold mt-1">{formatINR(p.monthlyPrice)}<span className="text-[11px] font-normal text-muted-foreground">/mo</span></p>
                        <p className="text-[11px] text-muted-foreground">{p.seatPrice > 0 ? `+ ${formatINR(p.seatPrice)}/seat` : 'Custom pricing'}</p>
                        <Separator className="my-2" />
                        <div className="text-[11px] text-muted-foreground space-y-0.5">
                          <div>Seats: {p.limits.seats ?? '∞'} · Storage: {p.limits.storageGb}GB</div>
                          <div>API: {fmtNum(p.limits.apiCallsPerMonth)}/mo</div>
                          <div>AI: {fmtNum(p.limits.aiCreditsPerMonth)} credits/mo</div>
                        </div>
                        {live && (
                          <div className="mt-2 text-[11px] flex items-center justify-between">
                            <span className="text-muted-foreground">{live.organizations} orgs</span>
                            <span className="font-semibold text-emerald-300">{fmtINR(live.mrr)}/mo</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/[0.03] border-white/[0.08]">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-300" /> Trials & Coupons</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Active Trials</p>
                  <p className="text-2xl font-bold text-sky-300">{dashboard.subscription.trials.active}</p>
                  <p className="text-[11px] text-muted-foreground">{dashboard.subscription.trials.expiring7d} expiring ≤7d</p>
                </div>
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Conversion Rate</p>
                  <p className="text-2xl font-bold text-emerald-300">{(dashboard.subscription.trials.conversionRate * 100).toFixed(0)}%</p>
                  <p className="text-[11px] text-muted-foreground">{dashboard.subscription.trials.converted30d} converted 30d</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Billing Cycles</p>
                  {dashboard.subscription.billingCycles.map((bc) => (
                    <div key={bc.cycle} className="flex items-center justify-between text-sm">
                      <span className="capitalize">{bc.cycle}</span>
                      <span className="font-semibold">{bc.organizations} orgs</span>
                    </div>
                  ))}
                </div>
                {dashboard.subscription.coupons.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Coupons</p>
                    {dashboard.subscription.coupons.map((c) => (
                      <div key={c.code} className="flex items-center justify-between text-sm">
                        <span className="font-mono text-xs">{c.code}</span>
                        <span className="text-muted-foreground">{c.uses}× {c.discountPct}% off</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═════════════ BILLING ═════════════ */}
        <TabsContent value="billing" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <KPICard icon={TrendingUp} label="MRR" value={fmtINR(dashboard.billing.mrr)} accent="text-emerald-300" />
            <KPICard icon={TrendingUp} label="ARR" value={fmtINR(dashboard.billing.arr)} accent="text-emerald-300" />
            <KPICard icon={Receipt} label="ARPO" value={fmtINR(dashboard.billing.averageRevenuePerOrg)} sub="avg revenue / org" />
            <KPICard icon={AlertTriangle} label="Outstanding" value={fmtINR(dashboard.billing.outstanding)} sub="overdue invoices" accent="text-amber-300" />
            <KPICard icon={CheckCircle2} label="Collected 30d" value={fmtINR(dashboard.billing.collectedThisMonth)} accent="text-emerald-300" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 bg-white/[0.03] border-white/[0.08]">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4 text-sky-300" /> Billing Engine™ — Auto-Generated Invoices</CardTitle>
                <CardDescription>Seat pricing · AI tokens · API usage · storage · connectors · workflow/AGI executions · marketplace</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[480px] pr-2">
                  <div className="space-y-2">
                    {dashboard.billing.recentInvoices.map((inv) => (
                      <div key={inv.id} className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-mono font-semibold">{inv.number}</p>
                            <p className="text-[11px] text-muted-foreground">{inv.lineItems.length} line items · issued {timeAgo(inv.issuedAt)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold">{fmtINR(inv.total)}</p>
                            <Badge variant="outline" className={`text-[10px] ${inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : inv.status === 'overdue' ? 'bg-red-500/10 text-red-300 border-red-500/20' : 'bg-sky-500/10 text-sky-300 border-sky-500/20'}`}>{inv.status}</Badge>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {inv.lineItems.slice(0, 4).map((li, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] bg-white/[0.02] border-white/[0.06] text-muted-foreground">
                              {li.category}: {fmtINR(li.amount)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
            <Card className="bg-white/[0.03] border-white/[0.08]">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Gauge className="h-4 w-4 text-violet-300" /> Platform Usage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <UsageRow icon={Users2} label="Total Seats" value={fmtNum(dashboard.billing.usageBreakdown.seats)} />
                <UsageRow icon={Cpu} label="AI Credits Used" value={fmtNum(dashboard.billing.usageBreakdown.aiCreditsUsed)} />
                <UsageRow icon={Activity} label="API Calls (30d)" value={fmtNum(dashboard.billing.usageBreakdown.apiCallsMonth)} />
                <UsageRow icon={Database} label="Storage" value={`${(dashboard.billing.usageBreakdown.storageUsedMb / 1024).toFixed(1)} GB`} />
                <UsageRow icon={GitBranch} label="Workflow Runs" value={fmtNum(dashboard.billing.usageBreakdown.workflowExecutions)} />
                <UsageRow icon={Sparkles} label="AGI Executions" value={fmtNum(dashboard.billing.usageBreakdown.agiExecutions)} />
                <Separator />
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Revenue by Plan</p>
                  {dashboard.billing.revenueByPlan.map((r) => (
                    <div key={r.plan} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{r.planName} <span className="text-muted-foreground/60">({r.organizations})</span></span>
                      <span className="font-semibold text-emerald-300">{fmtINR(r.mrr)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═════════════ WHITE LABEL ═════════════ */}
        <TabsContent value="whitelabel" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <KPICard icon={Palette} label="Branded Orgs" value={dashboard.whiteLabel.brandedOrganizations} accent="text-rose-300" />
            <KPICard icon={Globe2} label="Custom Domains" value={dashboard.whiteLabel.customDomains} accent="text-sky-300" />
            <KPICard icon={Palette} label="Brand Colors" value={dashboard.whiteLabel.brandColorsApplied} accent="text-violet-300" />
            <KPICard icon={BookOpen} label="Email Templates" value={dashboard.whiteLabel.brandedEmailTemplates} accent="text-teal-300" />
            <KPICard icon={Server} label="Login + Reports" value={`${dashboard.whiteLabel.brandedLoginPage}/${dashboard.whiteLabel.brandedReports}`} accent="text-amber-300" />
          </div>
          <Card className="bg-white/[0.03] border-white/[0.08]">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4 text-rose-300" /> White Label Platform™</CardTitle>
              <CardDescription>Custom logo · brand colors · domain mapping · email templates · login/reports/PDF/mobile branding</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {dashboard.organizations.topOrganizations.filter((o) => o.branding?.primaryColor).slice(0, 8).map((org) => (
                  <div key={org.id} className="rounded-lg border border-white/[0.06] p-3 bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-md" style={{ background: org.branding.primaryColor ?? '#0ea5e9' }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{org.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{org.branding.domain ?? org.slug + '.in'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                      <div className="h-3 w-3 rounded-full" style={{ background: org.branding.primaryColor ?? '#0ea5e9' }} />
                      <div className="h-3 w-3 rounded-full" style={{ background: org.branding.accentColor ?? '#14b8a6' }} />
                      <span className="text-[10px] text-muted-foreground ml-1 font-mono">{org.branding.primaryColor ?? '#0ea5e9'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═════════════ MARKETPLACE ═════════════ */}
        <TabsContent value="marketplace" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard icon={Store} label="Listings" value={dashboard.marketplace.totalListings} accent="text-rose-300" />
            <KPICard icon={Package} label="Total Installs" value={fmtNum(dashboard.marketplace.totalInstalls)} accent="text-emerald-300" />
            <KPICard icon={Star} label="Featured" value={dashboard.marketplace.featuredApps.length} accent="text-amber-300" />
            <KPICard icon={Users2} label="Publishers" value={dashboard.marketplace.topPublishers.length} accent="text-sky-300" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 bg-white/[0.03] border-white/[0.08]">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Store className="h-4 w-4 text-rose-300" /> Marketplace Platform™ — Featured Apps</CardTitle>
                <CardDescription>Apps · AI Agents · Workflows · Templates · Dashboards · Connectors · Reports · Compliance Packs</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[480px] pr-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {dashboard.marketplace.featuredApps.map((app) => (
                      <div key={app.id} className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: app.iconColor + '22' }}>
                              <Package className="h-4 w-4" style={{ color: app.iconColor }} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{app.name}</p>
                              <p className="text-[10px] text-muted-foreground">by {app.publisher} · v{app.version}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px] capitalize bg-white/[0.02] border-white/[0.06]">{app.kind.replace('_', ' ')}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2">{app.description}</p>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="flex items-center gap-0.5 text-amber-300"><Star className="h-3 w-3 fill-current" />{app.rating}</span>
                            <span className="text-muted-foreground">{fmtNum(app.installs)} installs</span>
                          </div>
                          <span className="text-xs font-semibold">{app.price === 0 ? 'Free' : formatINR(app.price)}{app.monthlyPrice ? ` +${formatINR(app.monthlyPrice)}/mo` : ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
            <Card className="bg-white/[0.03] border-white/[0.08]">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-emerald-300" /> Installs by Kind</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {dashboard.marketplace.installsByKind.map((k) => (
                  <div key={k.kind} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-muted-foreground">{k.kind.replace('_', ' ')}</span>
                    <span className="font-semibold">{k.count}</span>
                  </div>
                ))}
                <Separator className="my-2" />
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Top Publishers</p>
                {dashboard.marketplace.topPublishers.map((p) => (
                  <div key={p.publisher} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground truncate">{p.publisher}</span>
                    <span className="text-muted-foreground/70">{p.installs} installs</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═════════════ API PLATFORM ═════════════ */}
        <TabsContent value="apis" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <KPICard icon={KeyRound} label="API Keys" value={dashboard.apiPlatform.totalKeys} sub={`${dashboard.apiPlatform.activeKeys} active`} accent="text-sky-300" />
            <KPICard icon={Activity} label="Calls (30d)" value={fmtNum(dashboard.apiPlatform.totalCalls)} accent="text-emerald-300" />
            <KPICard icon={Activity} label="Calls Today" value={fmtNum(dashboard.apiPlatform.callsToday)} accent="text-violet-300" />
            <KPICard icon={Gauge} label="Avg Latency" value={`${dashboard.apiPlatform.averageLatencyMs.toFixed(0)}ms`} accent="text-teal-300" />
            <KPICard icon={Webhook} label="Webhooks" value={dashboard.apiPlatform.webhooks.length} accent="text-rose-300" />
            <KPICard icon={BookOpen} label="SDKs" value={dashboard.apiPlatform.sdks.length} accent="text-amber-300" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 bg-white/[0.03] border-white/[0.08]">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Code2 className="h-4 w-4 text-sky-300" /> API Platform™ — Executive Endpoints</CardTitle>
                <CardDescription>REST · GraphQL · Webhooks · SDKs · OAuth · API Keys · Rate limits · Usage analytics · Playground</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[480px] pr-2">
                  <div className="space-y-1.5">
                    {dashboard.apiPlatform.endpoints.map((ep, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-md bg-white/[0.02] border border-white/[0.06] px-3 py-2">
                        <Badge variant="outline" className={`text-[10px] font-mono w-12 justify-center ${ep.method === 'GET' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : ep.method === 'POST' ? 'bg-sky-500/10 text-sky-300 border-sky-500/20' : 'bg-amber-500/10 text-amber-300 border-amber-500/20'}`}>{ep.method}</Badge>
                        <code className="text-xs flex-1 truncate">{ep.path}</code>
                        <span className="text-[11px] text-muted-foreground hidden md:inline truncate">{ep.description}</span>
                        <Badge variant="outline" className="text-[10px] bg-white/[0.02] border-white/[0.06] text-muted-foreground hidden lg:inline-flex">{ep.category}</Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
            <Card className="bg-white/[0.03] border-white/[0.08]">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Webhook className="h-4 w-4 text-rose-300" /> Webhooks & SDKs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Webhooks</p>
                  <div className="space-y-1.5">
                    {dashboard.apiPlatform.webhooks.map((w) => (
                      <div key={w.id} className="rounded-md bg-white/[0.02] border border-white/[0.06] px-2 py-1.5">
                        <div className="flex items-center justify-between">
                          <code className="text-[11px] truncate">{w.url}</code>
                          <Badge variant="outline" className={`text-[10px] ${w.status === 'active' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border-amber-500/20'}`}>{w.status}</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{w.events.join(', ')} · {w.deliveries} deliveries</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">SDKs</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {dashboard.apiPlatform.sdks.map((s) => (
                      <div key={s.language} className="rounded-md bg-white/[0.02] border border-white/[0.06] px-2 py-1.5">
                        <p className="text-xs font-medium">{s.language}</p>
                        <p className="text-[10px] text-muted-foreground">v{s.version} · {s.installs} installs</p>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">OAuth Apps</span>
                  <span className="font-semibold">{dashboard.apiPlatform.oauthApps}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Error Rate</span>
                  <span className="font-semibold text-emerald-300">{dashboard.apiPlatform.errorRatePct.toFixed(2)}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Rate Limit ({dashboard.apiPlatform.rateLimits.tier})</span>
                  <span className="font-semibold">{dashboard.apiPlatform.rateLimits.perMinute}/min · {fmtNum(dashboard.apiPlatform.rateLimits.perDay)}/day</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═════════════ DEVOPS ═════════════ */}
        <TabsContent value="devops" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <KPICard icon={Server} label="Environments" value={dashboard.devops.totalEnvironments} accent="text-sky-300" />
            <KPICard icon={CheckCircle2} label="Healthy" value={dashboard.devops.healthy} accent="text-emerald-300" />
            <KPICard icon={GitBranch} label="CI/CD Pipelines" value={dashboard.devops.ciCdPipelines} accent="text-violet-300" />
            <KPICard icon={ServerCog} label="Regions" value={dashboard.devops.regions.length} accent="text-teal-300" />
            <KPICard icon={RefreshCw} label="Rollback Ready" value={dashboard.devops.rollbackAvailable} accent="text-amber-300" />
          </div>
          <Card className="bg-white/[0.03] border-white/[0.08]">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><ServerCog className="h-4 w-4 text-violet-300" /> DevOps Cloud™ — Environments</CardTitle>
              <CardDescription>Production · staging · development · sandbox · preview · rollbacks · blue/green · canary · CI/CD</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[480px] pr-2">
                <div className="space-y-2">
                  {dashboard.devops.recentDeploys.map((env) => (
                    <div key={env.id} className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Server className={`h-4 w-4 ${statusColor(env.status)}`} />
                          <div>
                            <p className="text-sm font-medium">{env.name} <span className="text-[10px] text-muted-foreground capitalize">· {env.environmentType}</span></p>
                            <p className="text-[10px] text-muted-foreground">{env.region} · {env.version} · {env.replicas} replicas · {env.strategy.replace('_', '/')}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${env.status === 'healthy' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : env.status === 'deploying' ? 'bg-sky-500/10 text-sky-300 border-sky-500/20' : 'bg-red-500/10 text-red-300 border-red-500/20'}`}>{env.status}</Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-2 mt-2 text-[11px]">
                        <div><span className="text-muted-foreground">Uptime:</span> <span className="font-semibold text-emerald-300">{env.uptimePct.toFixed(2)}%</span></div>
                        <div><span className="text-muted-foreground">Latency:</span> <span className="font-semibold">{env.latencyMs.toFixed(0)}ms</span></div>
                        <div><span className="text-muted-foreground">Errors:</span> <span className="font-semibold">{env.errorRatePct.toFixed(2)}%</span></div>
                        <div><span className="text-muted-foreground">CPU:</span> <span className="font-semibold">{env.cpuUsagePct.toFixed(0)}%</span></div>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">Last deploy: {timeAgo(env.lastDeployAt)} by {env.lastDeployBy ?? 'system'}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═════════════ MONITORING ═════════════ */}
        <TabsContent value="monitoring" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <KPICard icon={Users2} label="Active 24h" value={fmtNum(dashboard.monitoring.activeUsers24h)} sub={`${fmtNum(dashboard.monitoring.activeUsers30d)} 30d`} accent="text-sky-300" />
            <KPICard icon={Activity} label="API Today" value={fmtNum(dashboard.monitoring.apiCallsToday)} sub={`${fmtNum(dashboard.monitoring.apiCalls30d)} 30d`} accent="text-violet-300" />
            <KPICard icon={Sparkles} label="AGI Today" value={fmtNum(dashboard.monitoring.agiExecutionsToday)} sub={`${fmtNum(dashboard.monitoring.agiExecutions30d)} 30d`} accent="text-emerald-300" />
            <KPICard icon={Gauge} label="Uptime" value={`${dashboard.monitoring.uptimePct.toFixed(2)}%`} accent="text-emerald-300" />
            <KPICard icon={Clock} label="p95 Latency" value={`${dashboard.monitoring.p95LatencyMs.toFixed(0)}ms`} accent="text-teal-300" />
            <KPICard icon={Database} label="Storage" value={`${(dashboard.monitoring.totalStorageMb / 1024).toFixed(1)} GB`} sub={`${dashboard.monitoring.activeConnectors} connectors`} accent="text-amber-300" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 bg-white/[0.03] border-white/[0.08]">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-violet-300" /> Enterprise Monitoring™ — 24h Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-0.5 h-40">
                  {dashboard.monitoring.usageByHour.slice(-24).map((h, i) => {
                    const maxApi = Math.max(...dashboard.monitoring.usageByHour.map((x) => x.apiCalls), 1);
                    const maxAgi = Math.max(...dashboard.monitoring.usageByHour.map((x) => x.agiExecutions), 1);
                    const apiH = (h.apiCalls / maxApi) * 100;
                    const agiH = (h.agiExecutions / maxAgi) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col justify-end gap-0.5 group relative">
                        <div className="bg-sky-500/40 hover:bg-sky-500/70 rounded-t-sm transition-colors" style={{ height: `${apiH}%` }} />
                        <div className="bg-violet-500/40 hover:bg-violet-500/70 rounded-t-sm transition-colors" style={{ height: `${agiH}%` }} />
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 hidden group-hover:block bg-background border border-white/[0.08] rounded-md p-2 text-[10px] whitespace-nowrap z-10">
                          <div>{h.hour}</div>
                          <div className="text-sky-300">API: {fmtNum(h.apiCalls)}</div>
                          <div className="text-violet-300">AGI: {fmtNum(h.agiExecutions)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-3 text-[11px]">
                  <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-sm bg-sky-500/60" /> API calls</span>
                  <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-sm bg-violet-500/60" /> AGI executions</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/[0.03] border-white/[0.08]">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Globe2 className="h-4 w-4 text-sky-300" /> Region Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {dashboard.monitoring.regionsHealth.map((r) => (
                  <div key={r.region} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs text-muted-foreground">{r.region}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${r.status === 'healthy' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border-amber-500/20'}`}>{r.status}</Badge>
                      <span className="font-semibold text-emerald-300">{r.uptimePct.toFixed(2)}%</span>
                    </div>
                  </div>
                ))}
                <Separator className="my-2" />
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Top Errors</p>
                {dashboard.monitoring.topErrors.slice(0, 5).map((e, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <code className="text-muted-foreground truncate">{e.error}</code>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{fmtNum(e.count)}</span>
                      <Badge variant="outline" className={`text-[10px] ${e.severity === 'critical' ? 'bg-red-500/10 text-red-300 border-red-500/20' : 'bg-amber-500/10 text-amber-300 border-amber-500/20'}`}>{e.severity}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═════════════ CUSTOMER SUCCESS ═════════════ */}
        <TabsContent value="success" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <KPICard icon={HeartHandshake} label="Avg Health" value={`${dashboard.customerSuccess.averageHealth.toFixed(0)}/100`} accent={healthColor(dashboard.customerSuccess.averageHealth)} />
            <KPICard icon={AlertTriangle} label="At Risk" value={dashboard.customerSuccess.atRisk} accent="text-amber-300" />
            <KPICard icon={TrendingUp} label="Expansion" value={dashboard.customerSuccess.expansionOpportunities} sub="opportunities" accent="text-emerald-300" />
            <KPICard icon={Star} label="Avg CSAT" value={`${dashboard.customerSuccess.averageSatisfaction.toFixed(1)}/5`} accent="text-sky-300" />
            <KPICard icon={Activity} label="Avg Adoption" value={`${dashboard.customerSuccess.adoptionAverage.toFixed(0)}%`} accent="text-violet-300" />
            <KPICard icon={Clock} label="Open Tickets" value={dashboard.customerSuccess.openTickets} accent="text-rose-300" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 bg-white/[0.03] border-white/[0.08]">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><HeartHandshake className="h-4 w-4 text-rose-300" /> Customer Success Center™ — At-Risk Organisations</CardTitle>
                <CardDescription>Adoption · health score · feature usage · churn risk · expansion · tickets · satisfaction</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-2">
                  <div className="space-y-2">
                    {dashboard.customerSuccess.topRisks.map((r, i) => (
                      <div key={i} className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{r.organizationName}</p>
                            <p className="text-[10px] text-muted-foreground">{r.plan} · MRR {fmtINR(r.mrr)} · last contact {timeAgo(r.lastContactAt)}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-bold ${healthColor(r.score)}`}>{r.score}/100</p>
                            <Badge variant="outline" className={`text-[10px] ${r.churnRisk >= 0.5 ? 'bg-red-500/10 text-red-300 border-red-500/20' : 'bg-amber-500/10 text-amber-300 border-amber-500/20'}`}>{(r.churnRisk * 100).toFixed(0)}% churn</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Progress value={r.adoptionPct} className="h-1.5 flex-1" />
                          <span className="text-[10px] text-muted-foreground">{r.adoptionPct.toFixed(0)}% adoption</span>
                        </div>
                        {r.recommendedActions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {r.recommendedActions.map((a, j) => (
                              <Badge key={j} variant="outline" className="text-[10px] bg-sky-500/10 text-sky-300 border-sky-500/20">{a}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
            <Card className="bg-white/[0.03] border-white/[0.08]">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-300" /> Oracle Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Health Distribution</p>
                {dashboard.customerSuccess.healthDistribution.map((b) => (
                  <div key={b.bucket} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{b.bucket}</span>
                    <span className="font-semibold">{b.count}</span>
                  </div>
                ))}
                <Separator className="my-2" />
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Recommended Actions</p>
                {dashboard.customerSuccess.recommendedActions.map((a, i) => (
                  <div key={i} className="rounded-md bg-white/[0.02] border border-white/[0.06] p-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium">{a.action}</p>
                      <Badge variant="outline" className={`text-[10px] ${a.priority === 'critical' ? 'bg-red-500/10 text-red-300 border-red-500/20' : a.priority === 'high' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-sky-500/10 text-sky-300 border-sky-500/20'}`}>{a.priority}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{a.impact}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═════════════ SECURITY ═════════════ */}
        <TabsContent value="security" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <KPICard icon={Lock} label="RBAC Roles" value={dashboard.security.rbacRoles} accent="text-sky-300" />
            <KPICard icon={ShieldCheck} label="ABAC Policies" value={dashboard.security.abacPolicies} accent="text-violet-300" />
            <KPICard icon={Activity} label="Audit Events 30d" value={fmtNum(dashboard.security.auditEvents30d)} sub={`${dashboard.security.criticalEvents} critical`} accent="text-emerald-300" />
            <KPICard icon={KeyRound} label="Secrets Managed" value={dashboard.security.secretsManaged} accent="text-amber-300" />
            <KPICard icon={ShieldCheck} label="SOC 2" value={`${dashboard.security.soc2Readiness}%`} sub="readiness" accent={healthColor(dashboard.security.soc2Readiness)} />
            <KPICard icon={ShieldCheck} label="ISO 27001" value={`${dashboard.security.iso27001Readiness}%`} sub="readiness" accent={healthColor(dashboard.security.iso27001Readiness)} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 bg-white/[0.03] border-white/[0.08]">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4 text-emerald-300" /> Security™ — Audit Log</CardTitle>
                <CardDescription>RBAC · ABAC · audit logs · encryption · secrets · tenant isolation · zero trust · SOC 2 · ISO 27001</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[420px] pr-2">
                  <div className="space-y-1.5">
                    {dashboard.security.recentAuditEvents.map((ev) => (
                      <div key={ev.id} className="flex items-center gap-3 rounded-md bg-white/[0.02] border border-white/[0.06] px-3 py-2">
                        <Badge variant="outline" className={`text-[10px] ${ev.severity === 'critical' ? 'bg-red-500/10 text-red-300 border-red-500/20' : ev.severity === 'warn' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-sky-500/10 text-sky-300 border-sky-500/20'}`}>{ev.severity}</Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono">{ev.action}</p>
                          <p className="text-[10px] text-muted-foreground">{ev.actor} · {ev.category}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(ev.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
            <Card className="bg-white/[0.03] border-white/[0.08]">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Security Posture</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <PostureRow label="Encryption at rest" value={dashboard.security.encryptionStatus.atRest ? 'Enabled' : 'Off'} ok={dashboard.security.encryptionStatus.atRest} />
                <PostureRow label="Encryption in transit" value={dashboard.security.encryptionStatus.inTransit ? 'Enabled' : 'Off'} ok={dashboard.security.encryptionStatus.inTransit} />
                <PostureRow label="Tenant isolation" value={dashboard.security.tenantIsolationVerified ? 'Verified' : 'Pending'} ok={dashboard.security.tenantIsolationVerified} />
                <PostureRow label="Zero Trust" value={dashboard.security.zeroTrustEnabled ? 'Enabled' : 'Off'} ok={dashboard.security.zeroTrustEnabled} />
                <PostureRow label="Key rotation" value={`${dashboard.security.encryptionStatus.keyRotationDays} days`} ok={true} />
                <Separator className="my-2" />
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">SOC 2 Readiness</p>
                  <Progress value={dashboard.security.soc2Readiness} className="h-2" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">ISO 27001 Readiness</p>
                  <Progress value={dashboard.security.iso27001Readiness} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═════════════ PERFORMANCE ═════════════ */}
        <TabsContent value="performance" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard icon={Building2} label="Organisations" value={fmtNum(dashboard.performance.current.organizations)} sub={`of ${fmtNum(dashboard.performance.targets.maxOrganizations)} cap · ${dashboard.performance.utilization.organizationsPct.toFixed(3)}%`} accent="text-sky-300" />
            <KPICard icon={Users2} label="Users" value={fmtNum(dashboard.performance.current.users)} sub={`of ${fmtNum(dashboard.performance.targets.maxUsers)} cap · ${dashboard.performance.utilization.usersPct.toFixed(4)}%`} accent="text-teal-300" />
            <KPICard icon={Activity} label="API Today" value={fmtNum(dashboard.performance.current.apiRequestsToday)} sub={`of ${fmtNum(dashboard.performance.targets.maxApiRequestsPerDay)} cap`} accent="text-violet-300" />
            <KPICard icon={Gauge} label="Uptime" value={`${dashboard.performance.current.uptimePct.toFixed(2)}%`} sub={`target ${dashboard.performance.targets.targetUptimePct}%`} accent="text-emerald-300" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 bg-white/[0.03] border-white/[0.08]">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Gauge className="h-4 w-4 text-violet-300" /> Performance™ — Capacity & Scaling</CardTitle>
                <CardDescription>Targets: 100K orgs · 10M users · 1B API/day · horizontal scaling · global CDN · regional · autoscaling · HA</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <PostureRow label="Horizontal scaling" value={dashboard.performance.scaling.horizontalScaling ? 'Enabled' : 'Off'} ok={dashboard.performance.scaling.horizontalScaling} />
                  <PostureRow label="Autoscaling" value={dashboard.performance.scaling.autoscaling ? 'Enabled' : 'Off'} ok={dashboard.performance.scaling.autoscaling} />
                  <PostureRow label="Global CDN" value={dashboard.performance.scaling.cdnEnabled ? 'Enabled' : 'Off'} ok={dashboard.performance.scaling.cdnEnabled} />
                  <PostureRow label="High availability" value={dashboard.performance.scaling.haEnabled ? 'Enabled' : 'Off'} ok={dashboard.performance.scaling.haEnabled} />
                  <div className="rounded-md bg-white/[0.02] border border-white/[0.06] px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">Regions deployed</p>
                    <p className="text-lg font-bold text-sky-300">{dashboard.performance.scaling.regionsDeployed}</p>
                  </div>
                  <div className="rounded-md bg-white/[0.02] border border-white/[0.06] px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">Total replicas</p>
                    <p className="text-lg font-bold text-emerald-300">{dashboard.performance.scaling.replicasTotal}</p>
                  </div>
                </div>
                <Separator className="my-3" />
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Regional Deployment</p>
                <div className="space-y-1.5">
                  {dashboard.performance.regionalDeployment.map((r) => (
                    <div key={r.region} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-xs text-muted-foreground">{r.region}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-300 border-emerald-500/20">{r.status}</Badge>
                        <span className="text-muted-foreground">{fmtNum(r.organizations)} orgs</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/[0.03] border-white/[0.08]">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Network className="h-4 w-4 text-sky-300" /> Capacity Utilisation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Organisations</span>
                    <span className="font-semibold">{dashboard.performance.utilization.organizationsPct.toFixed(3)}%</span>
                  </div>
                  <Progress value={Math.max(0.5, dashboard.performance.utilization.organizationsPct)} className="h-2" />
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Users</span>
                    <span className="font-semibold">{dashboard.performance.utilization.usersPct.toFixed(4)}%</span>
                  </div>
                  <Progress value={Math.max(0.5, dashboard.performance.utilization.usersPct)} className="h-2" />
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">API / day</span>
                    <span className="font-semibold">{dashboard.performance.utilization.apiPct.toFixed(5)}%</span>
                  </div>
                  <Progress value={Math.max(0.5, dashboard.performance.utilization.apiPct)} className="h-2" />
                </div>
                <Separator />
                <div className="text-center">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Headroom remaining</p>
                  <p className="text-3xl font-bold text-emerald-300">{(100 - dashboard.performance.utilization.organizationsPct).toFixed(2)}%</p>
                  <p className="text-[11px] text-muted-foreground">Room to scale to 100,000 organisations</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ═══ Footer ═══ */}
      <div className="pt-4 border-t border-white/[0.06] flex flex-col md:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <p>{PLATFORM_TAGLINE}</p>
        <p>{dashboard.subsystemsImplemented}/{dashboard.subsystemsTotal} subsystems · {dashboard.dataSources.length} live data sources · cache 45s</p>
      </div>
    </div>
  );
}

// ─── OrgCard ──────────────────────────────────────────────────────────────────

function OrgCard({ org, compact }: { org: Organization; compact?: boolean }) {
  return (
    <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3 hover:border-white/[0.12] transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: (org.branding.primaryColor ?? '#0ea5e9') + '22' }}>
            <Building2 className="h-4 w-4" style={{ color: org.branding.primaryColor ?? '#0ea5e9' }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{org.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{org.industry ?? 'Services'} · {org.country}</p>
          </div>
        </div>
        <Badge variant="outline" className={`text-[10px] capitalize shrink-0 ${planColor(org.plan)}`}>{org.plan.replace('_', ' ')}</Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]">
        <div>
          <p className="text-muted-foreground">MRR</p>
          <p className="font-semibold text-emerald-300">{fmtINR(org.monthlyRevenue)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Seats</p>
          <p className="font-semibold">{org.seatsUsed}/{org.seatsLimit}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Health</p>
          <p className={`font-semibold ${healthColor(org.healthScore)}`}>{org.healthScore}</p>
        </div>
      </div>
      {!compact && (
        <>
          <Progress value={(org.seatsUsed / Math.max(org.seatsLimit, 1)) * 100} className="h-1 mt-2" />
          <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
            <span>{org.usersCount ?? 0} users · {org.departmentsCount ?? 0} depts · {org.branchesCount ?? 0} branches</span>
            <span className={`capitalize ${statusColor(org.planStatus)}`}>{org.planStatus}</span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── UsageRow ─────────────────────────────────────────────────────────────────

function UsageRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

// ─── PostureRow ───────────────────────────────────────────────────────────────

function PostureRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`flex items-center gap-1 font-semibold ${ok ? 'text-emerald-300' : 'text-amber-300'}`}>
        {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
        {value}
      </span>
    </div>
  );
}
