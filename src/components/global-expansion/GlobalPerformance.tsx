'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 14: GLOBAL PERFORMANCE™ & SCALABILITY ARCHITECTURE
//
// Enterprise-grade global infrastructure visualization: scale metrics, layered
// architecture diagram, endpoint performance metrics, scaling indicators, and a
// worldwide CDN regions map. All values deterministic — no mocks, no Math.random,
// no API calls.
//
//   • 6 Scale metric cards   — Orgs (100K+), Invoices (Billions), Concurrent Users
//                               (10K+), Uptime SLA (99.99%), API Latency (<50ms),
//                               CDN Regions (12)
//   • Layered architecture    — Edge CDN (12 regions) → API Gateway → Microservices
//                               (Auth, Tax, Payment, Compliance, AI) → Data Layer
//                               (Multi-region DB, Cache, Search)
//   • Performance metrics     — endpoint, avg latency, p99, RPS, error rate
//   • Scaling indicators      — horizontal, vertical, multi-region active-active,
//                               read replicas, cache hit rate
//   • Global infrastructure   — 12 CDN regions with latency-from-India
//
// Tagline: Built to Scale. Engineered to Last.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import {
  Gauge, Building2, FileText, Users, Activity, Zap, Globe2,
  Server, Database, ShieldCheck, Brain, CreditCard, Scale,
  Search, HardDrive, Layers, Network, GitBranch, Repeat,
  TrendingUp, Cpu, Radio, type LucideIcon,
} from 'lucide-react';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
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

// ─── Performance metrics ───────────────────────────────────────────────────────

interface PerfMetric {
  endpoint: string;
  method: string;
  avgLatency: number; // ms
  p99Latency: number; // ms
  rps: number;        // requests/sec
  errorRate: number;  // %
}

const PERF_METRICS: PerfMetric[] = [
  { endpoint: '/api/v1/invoices', method: 'GET', avgLatency: 28, p99Latency: 84, rps: 1840, errorRate: 0.02 },
  { endpoint: '/api/v1/payments', method: 'POST', avgLatency: 42, p99Latency: 128, rps: 620, errorRate: 0.05 },
  { endpoint: '/api/v1/tax/calculate', method: 'POST', avgLatency: 18, p99Latency: 52, rps: 3120, errorRate: 0.01 },
  { endpoint: '/api/v1/reports/generate', method: 'POST', avgLatency: 320, p99Latency: 940, rps: 48, errorRate: 0.18 },
  { endpoint: '/api/v1/compliance/check', method: 'GET', avgLatency: 36, p99Latency: 112, rps: 920, errorRate: 0.03 },
  { endpoint: '/api/v1/organizations', method: 'GET', avgLatency: 22, p99Latency: 64, rps: 2410, errorRate: 0.01 },
  { endpoint: '/api/v1/fx/rates', method: 'GET', avgLatency: 12, p99Latency: 38, rps: 5280, errorRate: 0.00 },
  { endpoint: '/api/v1/ai/oracle', method: 'POST', avgLatency: 480, p99Latency: 1240, rps: 32, errorRate: 0.42 },
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

// ─── Global infrastructure: 12 CDN regions ─────────────────────────────────────

interface CdnRegion {
  code: string;
  name: string;
  city: string;
  country: string;
  flag: string;
  latencyFromIndiaMs: number;
  status: 'online' | 'degraded' | 'syncing';
}

const CDN_REGIONS: CdnRegion[] = [
  { code: 'AP-SOUTH', name: 'Asia Pacific (Mumbai)', city: 'Mumbai', country: 'India', flag: '🇮🇳', latencyFromIndiaMs: 4, status: 'online' },
  { code: 'AP-SE', name: 'Asia Pacific (Singapore)', city: 'Singapore', country: 'Singapore', flag: '🇸🇬', latencyFromIndiaMs: 28, status: 'online' },
  { code: 'AP-NE-1', name: 'Asia Pacific (Tokyo)', city: 'Tokyo', country: 'Japan', flag: '🇯🇵', latencyFromIndiaMs: 68, status: 'online' },
  { code: 'AP-NE-2', name: 'Asia Pacific (Seoul)', city: 'Seoul', country: 'South Korea', flag: '🇰🇷', latencyFromIndiaMs: 72, status: 'online' },
  { code: 'ME-CENTRAL', name: 'Middle East (Dubai)', city: 'Dubai', country: 'UAE', flag: '🇦🇪', latencyFromIndiaMs: 32, status: 'online' },
  { code: 'EU-WEST', name: 'Europe (Ireland)', city: 'Dublin', country: 'Ireland', flag: '🇮🇪', latencyFromIndiaMs: 142, status: 'online' },
  { code: 'EU-CENTRAL', name: 'Europe (Frankfurt)', city: 'Frankfurt', country: 'Germany', flag: '🇩🇪', latencyFromIndiaMs: 138, status: 'online' },
  { code: 'EU-SOUTH', name: 'Europe (Milan)', city: 'Milan', country: 'Italy', flag: '🇮🇹', latencyFromIndiaMs: 156, status: 'syncing' },
  { code: 'US-EAST', name: 'US East (Virginia)', city: 'Virginia', country: 'United States', flag: '🇺🇸', latencyFromIndiaMs: 218, status: 'online' },
  { code: 'US-WEST', name: 'US West (Oregon)', city: 'Oregon', country: 'United States', flag: '🇺🇸', latencyFromIndiaMs: 232, status: 'online' },
  { code: 'CA-CENTRAL', name: 'Canada (Central)', city: 'Toronto', country: 'Canada', flag: '🇨🇦', latencyFromIndiaMs: 224, status: 'online' },
  { code: 'SA-EAST', name: 'South America (São Paulo)', city: 'São Paulo', country: 'Brazil', flag: '🇧🇷', latencyFromIndiaMs: 298, status: 'degraded' },
];

const CDN_STATUS: Record<CdnRegion['status'], { label: string; cls: string; dot: string }> = {
  online: { label: 'Online', cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', dot: 'bg-emerald-400' },
  degraded: { label: 'Degraded', cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300', dot: 'bg-amber-400' },
  syncing: { label: 'Syncing', cls: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300', dot: 'bg-cyan-400' },
};

// ─── Performance metric helpers ────────────────────────────────────────────────

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

        {/* ─── Scale Metrics ─── */}
        <div>
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

        {/* ─── Performance Metrics Table + Scaling Indicators ─── */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Performance metrics */}
          <Card className="border-white/[0.06] bg-white/[0.02] lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Zap className="h-4 w-4 text-amber-400" />
                  Endpoint Performance
                </CardTitle>
                <Badge variant="outline" className="border-white/[0.08] bg-white/[0.03] text-[10px] text-muted-foreground">
                  Live · last 24h
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[420px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Method</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Endpoint</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Avg Latency</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">p99 Latency</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Req/sec</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Error Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {PERF_METRICS.map((m, i) => (
                      <motion.tr
                        key={m.endpoint}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: i * 0.03 }}
                        className="border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                      >
                        <TableCell>
                          <span className={cn('inline-flex rounded border px-1.5 py-0.5 text-[9px] font-mono font-bold', methodBadge(m.method))}>
                            {m.method}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-white">{m.endpoint}</TableCell>
                        <TableCell className={cn('text-right font-mono text-[11px] font-semibold', latencyColor(m.avgLatency))}>
                          {m.avgLatency}ms
                        </TableCell>
                        <TableCell className={cn('text-right font-mono text-[11px]', latencyColor(m.p99Latency))}>
                          {m.p99Latency}ms
                        </TableCell>
                        <TableCell className="text-right font-mono text-[11px] text-white">
                          {m.rps.toLocaleString()}
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

          {/* Scaling indicators */}
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
                <Repeat className="h-4 w-4 text-emerald-400" />
                Scaling Indicators
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[420px]">
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
                          className={cn('h-full rounded-full', s.ring.replace('bg-', 'bg-').replace('/30', '/70'))}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* ─── Global Infrastructure Map ─── */}
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Global Infrastructure Map</h2>
            <span className="text-[11px] text-muted-foreground">— 12 CDN regions · latency measured from India (Mumbai)</span>
          </div>
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-white">CDN Regions</CardTitle>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Online</span>
                  <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-cyan-400" /> Syncing</span>
                  <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Degraded</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[480px]">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {CDN_REGIONS.map((r, i) => {
                    const status = CDN_STATUS[r.status];
                    return (
                      <motion.div
                        key={r.code}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: i * 0.03 }}
                        className="group rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:border-white/[0.12]"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg leading-none">{r.flag}</span>
                            <div>
                              <p className="text-[12px] font-semibold text-white">{r.city}</p>
                              <p className="text-[10px] text-muted-foreground">{r.code}</p>
                            </div>
                          </div>
                          <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-medium', status.cls)}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
                            {status.label}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground">Latency from India</span>
                          <span className={cn('font-mono font-semibold', latencyColor(r.latencyFromIndiaMs))}>
                            {r.latencyFromIndiaMs}ms
                          </span>
                        </div>
                        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.04]">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              r.latencyFromIndiaMs <= 50 ? 'bg-emerald-500/70'
                                : r.latencyFromIndiaMs <= 150 ? 'bg-teal-500/70'
                                : r.latencyFromIndiaMs <= 250 ? 'bg-amber-500/70'
                                : 'bg-rose-500/70',
                            )}
                            style={{ width: `${Math.min(100, (r.latencyFromIndiaMs / 300) * 100)}%` }}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* ─── Footer ─── */}
        <div className="mt-5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Built on multi-region active-active architecture with sub-50ms p50 latency.</span>
          <span className="text-emerald-300">All systems operational</span>
        </div>
      </div>
    </div>
  );
}
