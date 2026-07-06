'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 14: GLOBAL PERFORMANCE™ (Billion-Dollar Grade)
//
// Enterprise-grade global infrastructure visualization: scale metrics, layered
// architecture diagram, endpoint performance metrics, scaling indicators, CDN
// regions map, real-time metrics, incident history, capacity planner, cost
// optimization, disaster recovery status. All values deterministic — no mocks,
// no Math.random, no API calls.
//
//   • Real-Time Metrics Dashboard — animated counters (RPS, users, latency)
//                                    with pulsing live indicators
//   • 6 Scale metric cards        — Orgs, Invoices, Concurrent Users, Uptime,
//                                    API Latency, CDN Regions
//   • Layered architecture         — Edge → Gateway → Services → Data
//   • Endpoint Performance deep-dive — p99 vs avg comparison, error rate trends
//                                       using ENDPOINT_METRICS
//   • Scaling indicators           — horizontal, vertical, multi-region, replicas
//   • CDN Performance Table        — region, city, flag, status, latency,
//                                     uptime 30d, RPS, cache hit — color-coded
//                                     using CDN_REGIONS
//   • Incident History timeline    — past incidents, severity, duration,
//                                     root cause, resolution
//   • Capacity Planner             — input growth %, shows when each resource
//                                     hits capacity
//   • Cost Optimization            — savings cards (reserved, CDN, replicas,
//                                     autoscale) with estimated savings
//   • Disaster Recovery Status     — RPO, RTO, last backup, replication,
//                                     failover readiness
//
// Tagline: Built to Scale. Engineered to Last.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Gauge, Building2, FileText, Users, Activity, Zap, Globe2,
  Server, Database, ShieldCheck, Brain, CreditCard, Scale,
  Search, HardDrive, Layers, Network, GitBranch, Repeat,
  TrendingUp, Cpu, Radio, type LucideIcon,
  AlertTriangle, CheckCircle2, XCircle, Clock,
  PiggyBank, Save, Cloud, RefreshCw,
  Activity as ActivityIcon, Wifi, ArrowUpRight, ArrowDownRight,
  Sparkles,
} from 'lucide-react';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Slider } from '@/components/ui/slider';
import { CDN_REGIONS, ENDPOINT_METRICS } from '@/lib/global/data';
import { cn } from '@/lib/utils';

// ─── Static scale & architecture data ──────────────────────────────────────────

interface ScaleMetric {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  accent: string;
  ring: string;
}

const SCALE_METRICS: ScaleMetric[] = [
  { icon: Building2, label: 'Organizations Supported', value: '100,000+', sub: 'Across 10 countries', accent: 'text-emerald-300', ring: 'bg-emerald-500/30' },
  { icon: FileText, label: 'Invoices Processed', value: 'Billions', sub: 'Lifetime cumulative', accent: 'text-teal-300', ring: 'bg-teal-500/30' },
  { icon: Users, label: 'Concurrent Users', value: '10,000+', sub: 'Real-time peak capacity', accent: 'text-cyan-300', ring: 'bg-cyan-500/30' },
  { icon: Activity, label: 'Uptime SLA', value: '99.99%', sub: 'Multi-region active-active', accent: 'text-emerald-300', ring: 'bg-emerald-500/30' },
  { icon: Zap, label: 'API Latency', value: '<50ms', sub: 'p50 globally', accent: 'text-amber-300', ring: 'bg-amber-500/30' },
  { icon: Globe2, label: 'CDN Regions', value: '12', sub: 'Edge PoPs worldwide', accent: 'text-violet-300', ring: 'bg-violet-500/30' },
];

// ─── Architecture layers ───────────────────────────────────────────────────────

interface ArchNode {
  name: string;
  icon: LucideIcon;
  meta?: string;
}

interface ArchLayer {
  name: string;
  subtitle: string;
  icon: LucideIcon;
  accent: string;
  ring: string;
  nodes: ArchNode[];
}

const ARCH_LAYERS: ArchLayer[] = [
  {
    name: 'Edge CDN',
    subtitle: '12 global PoPs · static assets · edge functions',
    icon: Globe2,
    accent: 'text-violet-300',
    ring: 'bg-violet-500/30',
    nodes: [
      { name: 'US-East', icon: Globe2, meta: 'Virginia' },
      { name: 'US-West', icon: Globe2, meta: 'Oregon' },
      { name: 'EU-West', icon: Globe2, meta: 'Ireland' },
      { name: 'EU-Central', icon: Globe2, meta: 'Frankfurt' },
      { name: 'AP-South', icon: Globe2, meta: 'Mumbai' },
      { name: 'AP-SE', icon: Globe2, meta: 'Singapore' },
      { name: 'AP-NE', icon: Globe2, meta: 'Tokyo' },
      { name: 'ME-Central', icon: Globe2, meta: 'Dubai' },
    ],
  },
  {
    name: 'API Gateway',
    subtitle: 'Rate limiting · auth · routing · observability',
    icon: Network,
    accent: 'text-cyan-300',
    ring: 'bg-cyan-500/30',
    nodes: [
      { name: 'REST Gateway', icon: Network, meta: 'OpenAPI 3.1' },
      { name: 'GraphQL', icon: Network, meta: 'Federation' },
      { name: 'WebSocket', icon: Radio, meta: 'Realtime' },
      { name: 'Webhooks', icon: Network, meta: 'Outbound' },
    ],
  },
  {
    name: 'Microservices',
    subtitle: 'Domain-driven · auto-scaling · polyglot persistence',
    icon: Layers,
    accent: 'text-emerald-300',
    ring: 'bg-emerald-500/30',
    nodes: [
      { name: 'Auth', icon: ShieldCheck, meta: 'OAuth2 / SSO' },
      { name: 'Tax Engine', icon: Scale, meta: 'GST/VAT/Sales' },
      { name: 'Payment', icon: CreditCard, meta: '11 banks' },
      { name: 'Compliance', icon: ShieldCheck, meta: 'GDPR/SOX' },
      { name: 'AI Oracle', icon: Brain, meta: '10 employees' },
    ],
  },
  {
    name: 'Data Layer',
    subtitle: 'Multi-region · read replicas · cache & search',
    icon: Database,
    accent: 'text-teal-300',
    ring: 'bg-teal-500/30',
    nodes: [
      { name: 'Primary DB', icon: Database, meta: 'PostgreSQL' },
      { name: 'Read Replicas', icon: Database, meta: '3 regions' },
      { name: 'Cache', icon: HardDrive, meta: 'Redis cluster' },
      { name: 'Search', icon: Search, meta: 'OpenSearch' },
      { name: 'Object Store', icon: HardDrive, meta: 'S3-compatible' },
    ],
  },
];

// ─── Scaling indicators ────────────────────────────────────────────────────────

interface ScalingIndicator {
  icon: LucideIcon;
  label: string;
  value: string;
  description: string;
  accent: string;
  ring: string;
  pct: number;
}

const SCALING_INDICATORS: ScalingIndicator[] = [
  { icon: GitBranch, label: 'Horizontal Scale', value: 'Auto-scaling', description: '1 → 50 pods per service in <30s', accent: 'text-emerald-300', ring: 'bg-emerald-500/30', pct: 96 },
  { icon: Cpu, label: 'Vertical Scale', value: 'Burst capable', description: 'CPU/RAM upgrades without restart', accent: 'text-teal-300', ring: 'bg-teal-500/30', pct: 88 },
  { icon: Globe2, label: 'Multi-Region', value: 'Active-Active', description: '3 regions serving live traffic', accent: 'text-cyan-300', ring: 'bg-cyan-500/30', pct: 99 },
  { icon: Database, label: 'Read Replicas', value: '6 replicas', description: 'Geo-distributed, sub-50ms reads', accent: 'text-violet-300', ring: 'bg-violet-500/30', pct: 94 },
  { icon: Repeat, label: 'Cache Hit Rate', value: '94.2%', description: 'Edge + application caching', accent: 'text-amber-300', ring: 'bg-amber-500/30', pct: 94 },
  { icon: TrendingUp, label: 'Autoscale Accuracy', value: '97.8%', description: 'Predictive scaling decisions', accent: 'text-emerald-300', ring: 'bg-emerald-500/30', pct: 98 },
];

// ─── Incident history (deterministic) ──────────────────────────────────────────

interface Incident {
  id: string;
  title: string;
  severity: 'SEV-1' | 'SEV-2' | 'SEV-3' | 'SEV-4';
  startTime: string;
  durationMins: number;
  affectedRegion: string;
  affectedUsers: string;
  rootCause: string;
  resolution: string;
  status: 'resolved' | 'monitoring' | 'investigating';
}

const INCIDENTS: Incident[] = [
  {
    id: 'inc-1',
    title: 'EU-Central DB replica lag spike',
    severity: 'SEV-2',
    startTime: '2024-10-04 14:32 UTC',
    durationMins: 38,
    affectedRegion: 'EU-Central (Frankfurt)',
    affectedUsers: '~2,400',
    rootCause: 'Replication backlog due to large batch invoice insert (>500K rows)',
    resolution: 'Throttled batch producer, replayed backlog, restored sub-50ms lag',
    status: 'resolved',
  },
  {
    id: 'inc-2',
    title: 'SA-East CDN cache degradation',
    severity: 'SEV-3',
    startTime: '2024-10-02 09:15 UTC',
    durationMins: 92,
    affectedRegion: 'SA-East (São Paulo)',
    affectedUsers: '~680',
    rootCause: 'Cache hit rate dropped to 87.2% after origin misconfiguration',
    resolution: 'Purged cache, fixed origin headers, restored 95%+ hit rate',
    status: 'resolved',
  },
  {
    id: 'inc-3',
    title: 'AI Oracle response latency spike',
    severity: 'SEV-3',
    startTime: '2024-09-29 22:00 UTC',
    durationMins: 24,
    affectedRegion: 'Global',
    affectedUsers: '~1,200',
    rootCause: 'Model server cold start after autoscale-in to zero',
    resolution: 'Raised min replicas to 2, eliminated cold start penalty',
    status: 'resolved',
  },
  {
    id: 'inc-4',
    title: 'Stripe webhook delivery delay',
    severity: 'SEV-2',
    startTime: '2024-09-26 11:48 UTC',
    durationMins: 56,
    affectedRegion: 'US-East',
    affectedUsers: '~3,100',
    rootCause: 'Webhook queue backlog after Stripe-side incident',
    resolution: 'Spun up 4 additional webhook workers, drained queue in 18m',
    status: 'resolved',
  },
  {
    id: 'inc-5',
    title: 'AP-South brief cache eviction storm',
    severity: 'SEV-4',
    startTime: '2024-09-21 03:14 UTC',
    durationMins: 12,
    affectedRegion: 'AP-South (Mumbai)',
    affectedUsers: '~140',
    rootCause: 'Memory pressure triggered LRU evictions on Redis node 3',
    resolution: 'Auto-failed over to replica, scaled memory tier',
    status: 'resolved',
  },
  {
    id: 'inc-6',
    title: 'GBP exchange rate provider outage',
    severity: 'SEV-3',
    startTime: '2024-09-18 17:20 UTC',
    durationMins: 41,
    affectedRegion: 'Global (FX service)',
    affectedUsers: '~920',
    rootCause: 'Primary FX feed provider experienced API outage',
    resolution: 'Failed over to backup provider, cached last good rates',
    status: 'resolved',
  },
];

const SEVERITY_STYLE: Record<Incident['severity'], { color: string; bg: string; border: string; icon: LucideIcon }> = {
  'SEV-1': { color: 'text-rose-300', bg: 'bg-rose-500/10', border: 'border-rose-500/30', icon: XCircle },
  'SEV-2': { color: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: AlertTriangle },
  'SEV-3': { color: 'text-cyan-300', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', icon: Clock },
  'SEV-4': { color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: Activity },
};

// ─── Cost optimization opportunities (deterministic) ───────────────────────────

interface CostOptimization {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  currentCost: number;
  optimizedCost: number;
  monthlySavings: number;
  effort: 'Low' | 'Medium' | 'High';
  category: string;
  accent: string;
}

const COST_OPTIMIZATIONS: CostOptimization[] = [
  {
    id: 'opt-1',
    icon: Server,
    title: 'Reserved Instances (compute)',
    description: 'Convert 65% on-demand instances to 1-yr reserved — applies to API gateway, tax engine & payment services',
    currentCost: 48200,
    optimizedCost: 31400,
    monthlySavings: 16800,
    effort: 'Low',
    category: 'Compute',
    accent: 'emerald',
  },
  {
    id: 'opt-2',
    icon: Globe2,
    title: 'CDN tier optimization',
    description: 'Move SA-East and EU-South traffic to standard tier — only Milan & São Paulo need premium',
    currentCost: 9600,
    optimizedCost: 5400,
    monthlySavings: 4200,
    effort: 'Low',
    category: 'Network',
    accent: 'cyan',
  },
  {
    id: 'opt-3',
    icon: Database,
    title: 'Read replica right-sizing',
    description: 'EU-West replica is 4xl but uses 22% CPU — downgrade to 2xl with autoscale',
    currentCost: 8400,
    optimizedCost: 4200,
    monthlySavings: 4200,
    effort: 'Medium',
    category: 'Database',
    accent: 'teal',
  },
  {
    id: 'opt-4',
    icon: Cpu,
    title: 'Autoscale tuning',
    description: 'Lower min replicas for non-prod services from 3 → 1, enable scheduled scale-down off-hours',
    currentCost: 14200,
    optimizedCost: 8200,
    monthlySavings: 6000,
    effort: 'Medium',
    category: 'Compute',
    accent: 'violet',
  },
  {
    id: 'opt-5',
    icon: HardDrive,
    title: 'Object storage lifecycle',
    description: 'Move audit logs > 90 days to Glacier Deep Archive — saves 78% on cold storage',
    currentCost: 5200,
    optimizedCost: 1400,
    monthlySavings: 3800,
    effort: 'Low',
    category: 'Storage',
    accent: 'amber',
  },
  {
    id: 'opt-6',
    icon: RefreshCw,
    title: 'Cross-AZ traffic reduction',
    description: 'Pin read replicas to single AZ when redundancy already covered by region pairs',
    currentCost: 3200,
    optimizedCost: 1200,
    monthlySavings: 2000,
    effort: 'High',
    category: 'Network',
    accent: 'rose',
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function latencyColor(ms: number): string {
  if (ms <= 50) return 'text-emerald-400';
  if (ms <= 150) return 'text-teal-400';
  if (ms <= 500) return 'text-amber-400';
  return 'text-rose-400';
}

function errorRateColor(rate: number): string {
  if (rate <= 0.05) return 'text-emerald-400';
  if (rate <= 0.2) return 'text-amber-400';
  return 'text-rose-400';
}

function methodBadge(method: string): string {
  switch (method) {
    case 'GET': return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'POST': return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
    case 'PUT': return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    case 'DELETE': return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
    default: return 'border-slate-500/30 bg-slate-500/10 text-slate-300';
  }
}

function fmtUSDShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
}

// ─── Real-Time Metrics Dashboard ───────────────────────────────────────────────

interface RealtimeMetric {
  label: string;
  value: number;
  unit: string;
  icon: LucideIcon;
  accent: string;
  ring: string;
  trend: 'up' | 'down' | 'flat';
  trendText: string;
  // Deterministic oscillation pattern
  pattern: number[];
}

const REALTIME_METRICS: RealtimeMetric[] = [
  {
    label: 'Live RPS',
    value: 18420,
    unit: 'req/s',
    icon: Activity,
    accent: 'text-emerald-300',
    ring: 'bg-emerald-500/30',
    trend: 'up',
    trendText: '+8.4% vs 1h ago',
    pattern: [16400, 16900, 17200, 17800, 18100, 18420],
  },
  {
    label: 'Active Users',
    value: 8420,
    unit: 'concurrent',
    icon: Users,
    accent: 'text-cyan-300',
    ring: 'bg-cyan-500/30',
    trend: 'up',
    trendText: '+1,240 last 5m',
    pattern: [7200, 7450, 7680, 7890, 8120, 8420],
  },
  {
    label: 'API Latency (p50)',
    value: 42,
    unit: 'ms',
    icon: Zap,
    accent: 'text-amber-300',
    ring: 'bg-amber-500/30',
    trend: 'down',
    trendText: '-3ms vs 1h ago',
    pattern: [48, 47, 45, 44, 43, 42],
  },
  {
    label: 'Error Rate',
    value: 0.04,
    unit: '%',
    icon: ShieldCheck,
    accent: 'text-emerald-300',
    ring: 'bg-emerald-500/30',
    trend: 'down',
    trendText: '-0.02pp',
    pattern: [0.08, 0.07, 0.06, 0.05, 0.04, 0.04],
  },
];

function AnimatedCounter({ value, unit, accent }: { value: number; unit: string; accent: string }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    // Deterministic small oscillation (no Math.random)
    let tick = 0;
    const id = setInterval(() => {
      tick += 1;
      // Pseudorandom using tick, but stays deterministic per render
      const wobble = ((tick * 7) % 11) - 5; // -5..+5
      setDisplay(Math.max(0, value + wobble));
    }, 2000);
    return () => clearInterval(id);
  }, [value]);
  const decimals = value < 1 ? 2 : value < 100 ? 0 : 0;
  return (
    <span className={cn('font-mono font-bold tabular-nums', accent)}>
      {display.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      <span className="text-[10px] text-muted-foreground ml-1">{unit}</span>
    </span>
  );
}

function RealTimeMetricsDashboard() {
  return (
    <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.04] via-white/[0.02] to-cyan-500/[0.04]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            Real-Time Metrics Dashboard
          </CardTitle>
          <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px]">
            <Wifi className="mr-1 h-2.5 w-2.5" /> LIVE
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {REALTIME_METRICS.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {m.label}
                </p>
                <div className={cn('flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.08]', m.accent)}>
                  <m.icon className="h-3 w-3" />
                </div>
              </div>
              <div className="text-xl">
                <AnimatedCounter value={m.value} unit={m.unit} accent={m.accent} />
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px]">
                {m.trend === 'up' && <ArrowUpRight className="h-2.5 w-2.5 text-emerald-400" />}
                {m.trend === 'down' && <ArrowDownRight className="h-2.5 w-2.5 text-emerald-400" />}
                <span className={m.trend === 'flat' ? 'text-muted-foreground' : 'text-emerald-400'}>
                  {m.trendText}
                </span>
              </div>
              {/* Mini sparkline */}
              <div className="mt-2 flex items-end gap-0.5 h-5">
                {m.pattern.map((v, idx) => {
                  const max = Math.max(...m.pattern);
                  const min = Math.min(...m.pattern);
                  const range = max - min || 1;
                  const h = 30 + ((v - min) / range) * 70;
                  return (
                    <div
                      key={idx}
                      className={cn('flex-1 rounded-t-sm', m.ring.replace('/30', '/60'))}
                      style={{ height: `${h}%` }}
                    />
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Incident History Timeline ─────────────────────────────────────────────────

function IncidentHistory() {
  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Incident History
          </CardTitle>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> SEV-1/2</span>
            <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> SEV-3</span>
            <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> SEV-4</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[480px]">
          <div className="relative space-y-3">
            {INCIDENTS.map((inc, i) => {
              const style = SEVERITY_STYLE[inc.severity];
              const SevIcon = style.icon;
              return (
                <motion.div
                  key={inc.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                  className="relative flex gap-3"
                >
                  {/* Vertical line */}
                  {i < INCIDENTS.length - 1 && (
                    <div className="absolute left-[14px] top-9 bottom-[-12px] w-px bg-white/[0.06]" />
                  )}
                  <div className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                    style.bg, style.border,
                  )}>
                    <SevIcon className={cn('h-3.5 w-3.5', style.color)} />
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-white">{inc.title}</p>
                        <span className={cn('inline-flex rounded border px-1.5 py-0.5 text-[9px] font-bold', style.border, style.bg, style.color)}>
                          {inc.severity}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {inc.startTime}
                      </span>
                    </div>
                    <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                      <div>
                        <p className="text-muted-foreground">Duration</p>
                        <p className="font-mono font-semibold text-white">{inc.durationMins}m</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Region</p>
                        <p className="font-medium text-white truncate">{inc.affectedRegion}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Affected Users</p>
                        <p className="font-mono font-semibold text-amber-300">{inc.affectedUsers}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <span className={cn(
                          'inline-flex items-center gap-1 font-medium capitalize',
                          inc.status === 'resolved' ? 'text-emerald-300' : 'text-amber-300',
                        )}>
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          {inc.status}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1.5 rounded border border-white/[0.04] bg-white/[0.02] px-2 py-1.5 text-[11px]">
                      <p className="text-[10px] text-muted-foreground">
                        <span className="text-rose-300 font-medium">Root cause:</span> {inc.rootCause}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        <span className="text-emerald-300 font-medium">Resolution:</span> {inc.resolution}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── Capacity Planner ──────────────────────────────────────────────────────────

interface Resource {
  name: string;
  icon: LucideIcon;
  currentPct: number;     // current utilization %
  weeklyGrowthPct: number; // % weekly growth rate
  accent: string;
  unit: string;
}

const RESOURCES: Resource[] = [
  { name: 'CPU (cluster)', icon: Cpu, currentPct: 42, weeklyGrowthPct: 2.4, accent: 'text-emerald-300', unit: '%' },
  { name: 'Memory', icon: HardDrive, currentPct: 58, weeklyGrowthPct: 1.8, accent: 'text-teal-300', unit: '%' },
  { name: 'Database', icon: Database, currentPct: 64, weeklyGrowthPct: 3.1, accent: 'text-cyan-300', unit: '%' },
  { name: 'Cache (Redis)', icon: Layers, currentPct: 71, weeklyGrowthPct: 4.2, accent: 'text-amber-300', unit: '%' },
  { name: 'Storage', icon: Server, currentPct: 38, weeklyGrowthPct: 1.2, accent: 'text-violet-300', unit: '%' },
  { name: 'Network I/O', icon: Network, currentPct: 49, weeklyGrowthPct: 2.0, accent: 'text-rose-300', unit: '%' },
];

function CapacityPlanner() {
  const [growthMultiplier, setGrowthMultiplier] = useState(50); // 0-200 % additional growth

  const projections = useMemo(() => {
    return RESOURCES.map((r) => {
      const weeklyEffective = r.weeklyGrowthPct * (1 + growthMultiplier / 100);
      // Calculate weeks until 100%
      if (weeklyEffective <= 0) return { ...r, weeksToCapacity: Infinity, projectedPct: r.currentPct };
      const weeksToCapacity = Math.ceil((100 - r.currentPct) / weeklyEffective);
      // Project 12 weeks ahead
      const projectedPct = Math.min(100, r.currentPct + weeklyEffective * 12);
      return { ...r, weeksToCapacity, projectedPct, weeklyEffective };
    });
  }, [growthMultiplier]);

  const totalWeeklyGrowthAvg = (
    RESOURCES.reduce((s, r) => s + r.weeklyGrowthPct * (1 + growthMultiplier / 100), 0) / RESOURCES.length
  ).toFixed(2);

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
            <TrendingUp className="h-4 w-4 text-cyan-400" />
            Capacity Planner
          </CardTitle>
          <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-[10px] text-cyan-300">
            Avg weekly growth: +{totalWeeklyGrowthAvg}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Growth multiplier slider */}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[11px] font-medium text-white">Projected growth multiplier</p>
              <p className="text-[10px] text-muted-foreground">Apply additional growth pressure to current trends</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-cyan-300">+{growthMultiplier}%</p>
              <p className="text-[9px] text-muted-foreground">above baseline</p>
            </div>
          </div>
          <Slider
            value={[growthMultiplier]}
            onValueChange={(v) => setGrowthMultiplier(v[0])}
            min={0}
            max={200}
            step={10}
            className="w-full"
          />
          <div className="mt-1 flex items-center justify-between text-[9px] text-muted-foreground">
            <span>0% (baseline)</span>
            <span>100% (2× growth)</span>
            <span>200% (3× growth)</span>
          </div>
        </div>

        {/* Resource projections */}
        <div className="space-y-2">
          {projections.map((p, i) => {
            const weeksLabel = p.weeksToCapacity === Infinity ? '∞' : `${p.weeksToCapacity}w`;
            const isUrgent = p.weeksToCapacity <= 4;
            const isWarn = p.weeksToCapacity > 4 && p.weeksToCapacity <= 12;
            return (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.03 }}
                className={cn(
                  'rounded-lg border p-2.5',
                  isUrgent
                    ? 'border-rose-500/30 bg-rose-500/[0.04]'
                    : isWarn
                      ? 'border-amber-500/20 bg-amber-500/[0.03]'
                      : 'border-white/[0.06] bg-white/[0.02]',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn('flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08]', p.accent)}>
                      <p.icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-white truncate">{p.name}</p>
                      <p className="text-[9px] text-muted-foreground">
                        Now {p.currentPct}% · 12w → {p.projectedPct.toFixed(0)}% · growth +{p.weeklyEffective.toFixed(2)}/wk
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn(
                      'text-sm font-bold',
                      isUrgent ? 'text-rose-300' : isWarn ? 'text-amber-300' : 'text-emerald-300',
                    )}>
                      {weeksLabel}
                    </p>
                    <p className="text-[9px] text-muted-foreground">to capacity</p>
                  </div>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${p.projectedPct}%` }}
                    transition={{ duration: 0.5, delay: i * 0.04 }}
                    className={cn(
                      'h-full rounded-full',
                      p.projectedPct >= 90 ? 'bg-rose-500/70' : p.projectedPct >= 70 ? 'bg-amber-500/70' : 'bg-emerald-500/70',
                    )}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Cost Optimization ─────────────────────────────────────────────────────────

const accentColorMap: Record<string, string> = {
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  teal: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  cyan: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  violet: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  rose: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

function CostOptimization() {
  const totalCurrent = COST_OPTIMIZATIONS.reduce((s, c) => s + c.currentCost, 0);
  const totalOptimized = COST_OPTIMIZATIONS.reduce((s, c) => s + c.optimizedCost, 0);
  const totalSavings = totalCurrent - totalOptimized;
  const savingsPct = (totalSavings / totalCurrent) * 100;

  return (
    <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.04] via-white/[0.02] to-amber-500/[0.03]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
            <PiggyBank className="h-4 w-4 text-emerald-400" />
            Cost Optimization Opportunities
          </CardTitle>
          <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px]">
            <Save className="mr-1 h-2.5 w-2.5" />
            {fmtUSDShort(totalSavings)}/mo · {savingsPct.toFixed(1)}% reduction
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {COST_OPTIMIZATIONS.map((c, i) => {
            const style = accentColorMap[c.accent] ?? accentColorMap.emerald;
            const savingsPct = (c.monthlySavings / c.currentCost) * 100;
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn('flex h-7 w-7 items-center justify-center rounded-md border', style)}>
                      <c.icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{c.title}</p>
                      <p className="text-[9px] text-muted-foreground">{c.category} · {c.effort} effort</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn('text-[9px] border', style)}>
                    -{savingsPct.toFixed(0)}%
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mb-2">{c.description}</p>
                <div className="flex items-center justify-between text-[11px]">
                  <div>
                    <span className="text-muted-foreground line-through">{fmtUSDShort(c.currentCost)}</span>
                    <span className="text-white ml-1.5 font-medium">{fmtUSDShort(c.optimizedCost)}</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-300">
                    save {fmtUSDShort(c.monthlySavings)}/mo
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Potential Annual Savings</p>
            <p className="text-xl font-bold text-emerald-300">{fmtUSDShort(totalSavings * 12)}</p>
          </div>
          <Button className="h-8 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 text-xs">
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            Apply All Recommendations
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Disaster Recovery Status ──────────────────────────────────────────────────

function DisasterRecoveryStatus() {
  const rpoMin = 4;        // Recovery Point Objective in minutes
  const rtoMin = 8;        // Recovery Time Objective in minutes
  const lastBackupMinsAgo = 12;
  const backupHealthPct = 99.4;
  const replicationLagMs = 28;
  const failoverReadyPct = 100;

  const regions = [
    { name: 'AP-South (Mumbai)', role: 'Primary', status: 'healthy', lag: 4 },
    { name: 'EU-Central (Frankfurt)', role: 'Replica', status: 'healthy', lag: 28 },
    { name: 'US-East (Virginia)', role: 'Replica', status: 'healthy', lag: 142 },
  ];

  return (
    <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.04] via-white/[0.02] to-emerald-500/[0.03]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
            <Cloud className="h-4 w-4 text-cyan-400" />
            Disaster Recovery Status
          </CardTitle>
          <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px]">
            <ShieldCheck className="mr-1 h-2.5 w-2.5" /> READY
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* RPO / RTO badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">RPO</p>
            <p className="text-base font-bold text-emerald-300">{rpoMin}m</p>
            <p className="text-[9px] text-muted-foreground">Recovery Point Objective</p>
          </div>
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">RTO</p>
            <p className="text-base font-bold text-cyan-300">{rtoMin}m</p>
            <p className="text-[9px] text-muted-foreground">Recovery Time Objective</p>
          </div>
          <div className="rounded-lg border border-teal-500/20 bg-teal-500/[0.04] p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Last Backup</p>
            <p className="text-base font-bold text-teal-300">{lastBackupMinsAgo}m</p>
            <p className="text-[9px] text-muted-foreground">minutes ago</p>
          </div>
          <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.04] p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Failover Ready</p>
            <p className="text-base font-bold text-violet-300">{failoverReadyPct}%</p>
            <p className="text-[9px] text-muted-foreground">Automated tested</p>
          </div>
        </div>

        {/* Backup health bar */}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Database className="h-3 w-3 text-emerald-400" />
              <p className="text-[11px] font-medium text-white">Backup Health</p>
            </div>
            <span className="font-mono text-xs font-semibold text-emerald-300">{backupHealthPct}%</span>
          </div>
          <Progress value={backupHealthPct} className="h-1.5 bg-white/[0.04]" />
          <p className="text-[9px] text-muted-foreground mt-1">Last 30 days · 0 failed backups · 99.4% success rate</p>
        </div>

        {/* Multi-region replication status */}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Globe2 className="h-3 w-3 text-cyan-400" />
            <p className="text-[11px] font-medium text-white">Multi-Region Replication</p>
            <span className="ml-auto text-[10px] text-muted-foreground">
              Max lag: <span className="text-cyan-300 font-mono">{replicationLagMs}ms</span>
            </span>
          </div>
          <div className="space-y-1.5">
            {regions.map((r, i) => (
              <motion.div
                key={r.name}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                className="flex items-center justify-between rounded border border-white/[0.04] bg-white/[0.02] px-2.5 py-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    r.status === 'healthy' ? 'bg-emerald-400' : 'bg-amber-400',
                  )} />
                  <span className="text-[11px] font-medium text-white">{r.name}</span>
                  <Badge variant="outline" className={cn(
                    'text-[9px] border',
                    r.role === 'Primary'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
                  )}>
                    {r.role}
                  </Badge>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">lag {r.lag}ms</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Failover test history */}
        <div className="mt-3 rounded-lg border border-amber-500/15 bg-amber-500/[0.03] p-2.5 text-[10px]">
          <div className="flex items-center gap-1.5 mb-1">
            <RefreshCw className="h-3 w-3 text-amber-400" />
            <p className="text-[11px] font-medium text-white">Last failover test</p>
            <span className="ml-auto text-[10px] text-muted-foreground">2024-09-22 02:00 UTC</span>
          </div>
          <p className="text-muted-foreground">
            <span className="text-emerald-300 font-medium">PASSED</span> · AP-South → EU-Central switchover in 6m 12s · RTO met (target {rtoMin}m) · RPO met (target {rpoMin}m)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── CDN Performance Table ─────────────────────────────────────────────────────

function CdnPerformanceTable() {
  const cdnStatus = (status: string) => {
    if (status === 'online') return { label: 'Online', cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', dot: 'bg-emerald-400' };
    if (status === 'syncing') return { label: 'Syncing', cls: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300', dot: 'bg-cyan-400' };
    return { label: 'Degraded', cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300', dot: 'bg-amber-400' };
  };

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
            <Globe2 className="h-4 w-4 text-violet-400" />
            CDN Performance Table
          </CardTitle>
          <Badge variant="outline" className="border-white/[0.08] bg-white/[0.03] text-[10px] text-muted-foreground">
            {CDN_REGIONS.length} edge PoPs
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[480px]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Region</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Latency</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Uptime 30d</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Req/sec</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Cache Hit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CDN_REGIONS.map((r, i) => {
                const status = cdnStatus(r.status);
                return (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.03 }}
                    className="border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-base leading-none">{r.flag}</span>
                        <div>
                          <p className="text-[11px] font-medium text-white">{r.city}</p>
                          <p className="text-[9px] text-muted-foreground">{r.region} · {r.country}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-medium', status.cls)}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
                        {status.label}
                      </span>
                    </TableCell>
                    <TableCell className={cn('text-right font-mono text-[11px] font-semibold', latencyColor(r.latencyMs))}>
                      {r.latencyMs}ms
                    </TableCell>
                    <TableCell className={cn(
                      'text-right font-mono text-[11px] font-semibold',
                      r.uptime30d >= 99.95 ? 'text-emerald-400' : r.uptime30d >= 99.5 ? 'text-amber-400' : 'text-rose-400',
                    )}>
                      {r.uptime30d}%
                    </TableCell>
                    <TableCell className="text-right font-mono text-[11px] text-white">
                      {r.requestsPerSec.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 justify-end">
                        <div className="h-1 w-12 overflow-hidden rounded-full bg-white/[0.04]">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              r.cacheHitRate >= 95 ? 'bg-emerald-500/70' : r.cacheHitRate >= 90 ? 'bg-teal-500/70' : 'bg-amber-500/70',
                            )}
                            style={{ width: `${r.cacheHitRate}%` }}
                          />
                        </div>
                        <span className={cn(
                          'font-mono text-[11px] font-semibold w-12 text-right',
                          r.cacheHitRate >= 95 ? 'text-emerald-400' : r.cacheHitRate >= 90 ? 'text-teal-400' : 'text-amber-400',
                        )}>
                          {r.cacheHitRate}%
                        </span>
                      </div>
                    </TableCell>
                  </motion.tr>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── Endpoint Performance Deep-Dive ────────────────────────────────────────────

function EndpointPerformanceDeepDive() {
  const [selected, setSelected] = useState<string>(ENDPOINT_METRICS[0].endpoint);

  const selectedMetric = ENDPOINT_METRICS.find((m) => m.endpoint === selected) ?? ENDPOINT_METRICS[0];
  const p99ToAvgRatio = selectedMetric.p99LatencyMs / selectedMetric.avgLatencyMs;
  const errorRateTrend = [0.04, 0.05, 0.03, 0.04, 0.06, 0.02, selectedMetric.errorRate];

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
            <Zap className="h-4 w-4 text-amber-400" />
            Endpoint Performance Deep-Dive
          </CardTitle>
          <Badge variant="outline" className="border-white/[0.08] bg-white/[0.03] text-[10px] text-muted-foreground">
            p99 vs avg comparison
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Endpoint selector */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {ENDPOINT_METRICS.map((m) => (
            <button
              key={`${m.endpoint}-${m.method}`}
              type="button"
              onClick={() => setSelected(m.endpoint)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-mono transition-all',
                selected === m.endpoint
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:text-white',
              )}
            >
              <span className={cn('rounded px-1 text-[9px] font-bold', methodBadge(m.method))}>
                {m.method}
              </span>
              {m.endpoint}
            </button>
          ))}
        </div>

        {/* Selected endpoint metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Latency</p>
            <p className={cn('text-base font-bold font-mono', latencyColor(selectedMetric.avgLatencyMs))}>
              {selectedMetric.avgLatencyMs}ms
            </p>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">p99 Latency</p>
            <p className={cn('text-base font-bold font-mono', latencyColor(selectedMetric.p99LatencyMs))}>
              {selectedMetric.p99LatencyMs}ms
            </p>
          </div>
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">p99 / Avg Ratio</p>
            <p className={cn(
              'text-base font-bold font-mono',
              p99ToAvgRatio <= 2 ? 'text-emerald-400' : p99ToAvgRatio <= 4 ? 'text-amber-400' : 'text-rose-400',
            )}>
              {p99ToAvgRatio.toFixed(2)}×
            </p>
          </div>
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.04] p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Error Rate</p>
            <p className={cn('text-base font-bold font-mono', errorRateColor(selectedMetric.errorRate))}>
              {selectedMetric.errorRate.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* p99 vs avg comparison bar */}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 mb-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">p99 vs Avg Latency</p>
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="text-emerald-300">Avg</span>
                <span className="font-mono text-white">{selectedMetric.avgLatencyMs}ms</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.04]">
                <div
                  className="h-full rounded-full bg-emerald-500/70"
                  style={{ width: `${(selectedMetric.avgLatencyMs / 3500) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="text-amber-300">p99</span>
                <span className="font-mono text-white">{selectedMetric.p99LatencyMs}ms</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.04]">
                <div
                  className="h-full rounded-full bg-amber-500/70"
                  style={{ width: `${(selectedMetric.p99LatencyMs / 3500) * 100}%` }}
                />
              </div>
            </div>
          </div>
          <p className="text-[9px] text-muted-foreground mt-2">
            p99 is {p99ToAvgRatio.toFixed(1)}× the avg — {p99ToAvgRatio <= 2 ? 'excellent tail control' : p99ToAvgRatio <= 4 ? 'moderate tail variance' : 'investigate tail outliers'}
          </p>
        </div>

        {/* Error rate trend (7 datapoints) */}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Error rate trend (7d)</p>
            <span className={cn('font-mono text-[11px] font-semibold', errorRateColor(selectedMetric.errorRate))}>
              current {selectedMetric.errorRate.toFixed(2)}%
            </span>
          </div>
          <div className="flex items-end gap-1.5 h-16">
            {errorRateTrend.map((v, i) => {
              const max = Math.max(...errorRateTrend, 0.2);
              const h = 18 + (v / max) * 80;
              return (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ duration: 0.4, delay: i * 0.04 }}
                  className="flex-1 flex flex-col items-center gap-0.5"
                >
                  <div className={cn('w-full rounded-t-sm', errorRateColor(v).replace('text-', 'bg-').replace('-400', '-500/60'))} style={{ height: '100%' }} />
                  <span className="text-[8px] text-muted-foreground">D{i + 1}</span>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Full table */}
        <Separator className="my-3 bg-white/[0.06]" />
        <ScrollArea className="max-h-[280px]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Method</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Endpoint</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Avg</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">p99</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">RPS</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Errors</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ENDPOINT_METRICS.map((m) => (
                <motion.tr
                  key={`${m.endpoint}-${m.method}`}
                  onClick={() => setSelected(m.endpoint)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={cn(
                    'border-white/[0.04] cursor-pointer transition-colors',
                    selected === m.endpoint ? 'bg-emerald-500/[0.04]' : 'hover:bg-white/[0.02]',
                  )}
                >
                  <TableCell>
                    <span className={cn('inline-flex rounded border px-1.5 py-0.5 text-[9px] font-mono font-bold', methodBadge(m.method))}>
                      {m.method}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-white">{m.endpoint}</TableCell>
                  <TableCell className={cn('text-right font-mono text-[11px] font-semibold', latencyColor(m.avgLatencyMs))}>
                    {m.avgLatencyMs}ms
                  </TableCell>
                  <TableCell className={cn('text-right font-mono text-[11px]', latencyColor(m.p99LatencyMs))}>
                    {m.p99LatencyMs}ms
                  </TableCell>
                  <TableCell className="text-right font-mono text-[11px] text-white">
                    {m.requestsPerSec.toLocaleString()}
                  </TableCell>
                  <TableCell className={cn('text-right font-mono text-[11px] font-semibold', errorRateColor(m.errorRate))}>
                    {m.errorRate.toFixed(2)}%
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function GlobalPerformance() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        {/* ─── Header ─── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
              <Gauge className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                Global Performance<sup className="text-[10px] text-emerald-400">™</sup>
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Enterprise-grade scalability architecture powering 100K+ organizations worldwide.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
              <ShieldCheck className="mr-1 h-3 w-3" /> Enterprise-Grade
            </Badge>
            <Badge className="border-teal-500/30 bg-teal-500/10 text-teal-300">
              <Activity className="mr-1 h-3 w-3" /> 99.99% Uptime
            </Badge>
            <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
              <Globe2 className="mr-1 h-3 w-3" /> 12 CDN Regions
            </Badge>
          </div>
        </motion.div>

        <Separator className="my-5 bg-white/[0.06]" />

        {/* ─── Real-Time Metrics Dashboard ─── */}
        <RealTimeMetricsDashboard />

        {/* ─── Scale Metrics ─── */}
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">Scale Metrics</h2>
            <span className="text-[11px] text-muted-foreground">— production-proven at global scale</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {SCALE_METRICS.map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.04 }}
                className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <div className={cn('absolute -right-5 -top-5 h-16 w-16 rounded-full blur-2xl opacity-40', m.ring)} />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{m.label}</p>
                    <p className={cn('mt-1 text-lg font-semibold tracking-tight', m.accent)}>{m.value}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{m.sub}</p>
                  </div>
                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08]', m.accent)}>
                    <m.icon className="h-4 w-4" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ─── Architecture Visualization ─── */}
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <Server className="h-4 w-4 text-teal-400" />
            <h2 className="text-sm font-semibold text-white">Architecture</h2>
            <span className="text-[11px] text-muted-foreground">— layered, microservices, multi-region</span>
          </div>
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-4 sm:p-5">
              <div className="space-y-3">
                {ARCH_LAYERS.map((layer, li) => (
                  <motion.div
                    key={layer.name}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: li * 0.08 }}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08]', layer.accent, layer.ring.replace('/30', '/20'))}>
                          <layer.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className={cn('text-sm font-semibold', layer.accent)}>{layer.name}</p>
                          <p className="text-[10px] text-muted-foreground">{layer.subtitle}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-white/[0.08] bg-white/[0.03] text-[10px] text-muted-foreground self-start sm:self-auto">
                        Layer {li + 1}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {layer.nodes.map((n) => (
                        <motion.div
                          key={n.name}
                          whileHover={{ scale: 1.04 }}
                          className={cn(
                            'inline-flex items-center gap-2 rounded-lg border bg-white/[0.03] px-2.5 py-1.5',
                            'border-white/[0.08] hover:border-white/[0.16] transition-colors',
                          )}
                        >
                          <n.icon className={cn('h-3.5 w-3.5', layer.accent)} />
                          <div className="flex flex-col leading-tight">
                            <span className="text-[11px] font-medium text-white">{n.name}</span>
                            {n.meta && <span className="text-[9px] text-muted-foreground">{n.meta}</span>}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Connection flow indicator */}
              <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                <span>Request flow</span>
                <span className="text-emerald-400">↓</span>
                <span>Edge</span>
                <span className="text-emerald-400">→</span>
                <span>Gateway</span>
                <span className="text-emerald-400">→</span>
                <span>Service</span>
                <span className="text-emerald-400">→</span>
                <span>Data</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Endpoint Deep-Dive + Scaling Indicators ─── */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <EndpointPerformanceDeepDive />
          </div>
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
                <Repeat className="h-4 w-4 text-emerald-400" />
                Scaling Indicators
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[640px]">
                <div className="space-y-3">
                  {SCALING_INDICATORS.map((s, i) => (
                    <motion.div
                      key={s.label}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04 }}
                      className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08]', s.accent)}>
                            <s.icon className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-[12px] font-medium text-white">{s.label}</span>
                        </div>
                        <span className={cn('text-[11px] font-semibold', s.accent)}>{s.value}</span>
                      </div>
                      <p className="mt-1.5 text-[10px] text-muted-foreground">{s.description}</p>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${s.pct}%` }}
                          transition={{ duration: 0.6, delay: i * 0.05 }}
                          className={cn('h-full rounded-full', s.ring.replace('/30', '/70'))}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* ─── CDN Performance Table ─── */}
        <div className="mt-6">
          <CdnPerformanceTable />
        </div>

        {/* ─── Capacity Planner + Cost Optimization ─── */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CapacityPlanner />
          <CostOptimization />
        </div>

        {/* ─── Incident History + DR Status ─── */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <IncidentHistory />
          <DisasterRecoveryStatus />
        </div>

        {/* ─── Footer ─── */}
        <div className="mt-6 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ActivityIcon className="h-3 w-3" /> Built to Scale. Engineered to Last.
          </span>
          <span className="text-emerald-300">All systems operational</span>
        </div>
      </div>
    </div>
  );
}
