'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 16 · MODULE 02
// ENTERPRISE API GATEWAY™ — 13 Service Domains · 478 Endpoints ·
//                              48.4B Calls/24h · 99.98% Avg Uptime
//
// Single-pane-of-glass console for all 13 GSTPilot service APIs. Each domain
// renders as a large card with latency / error-rate / uptime telemetry; a
// sortable leaderboard ranks services by p95 latency; an error-rate heatmap
// makes degraded services instantly visible.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, ArrowDownRight, ArrowUpRight, ChevronRight,
  Network, Activity, Zap, ShieldCheck, AlertTriangle, Server, Clock,
  type LucideIcon,
  Receipt, FileText, BookOpen, Boxes, Users, UserCog, Wallet, Package,
  BarChart3, Landmark, Brain, FolderOpen,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  SERVICE_APIS, ACCENT_CLASSES, fmtN, type Accent,
} from '@/lib/global-cloud/data';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

// ─── Icon resolver keyed by data file `icon` strings ──────────────────────────
const ICONS: Record<string, LucideIcon> = {
  'receipt':       Receipt,
  'file-text':     FileText,
  'book-open':     BookOpen,
  'boxes':         Boxes,
  'users':         Users,
  'user-cog':      UserCog,
  'wallet':        Wallet,
  'package':       Package,
  'bar-chart-3':   BarChart3,
  'landmark':      Landmark,
  'brain':         Brain,
  'shield-check':  ShieldCheck,
  'folder-open':   FolderOpen,
};

// ─── Status badge config ──────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  operational: {
    label: 'Operational',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  degraded: {
    label: 'Degraded',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
  maintenance: {
    label: 'Maintenance',
    className: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
  },
};

// ─── KPI tiles (deterministic headline values) ────────────────────────────────
const KPIS: { label: string; value: string; sub: string; accent: Accent; icon: LucideIcon }[] = [
  { label: 'Service Domains', value: '13',    sub: 'Unified gateway',     accent: 'teal',   icon: Network },
  { label: 'Endpoints',       value: '478',   sub: 'REST + GraphQL',      accent: 'cyan',   icon: Server },
  { label: 'Calls (24h)',     value: '48.4B', sub: 'Peak 6.2M req/s',     accent: 'emerald',icon: Activity },
  { label: 'Avg Error Rate',  value: '0.04%', sub: 'Rolling 24h window',  accent: 'violet', icon: AlertTriangle },
];

// ─── Sortable column config ───────────────────────────────────────────────────
type SortKey = 'domain' | 'endpoints' | 'calls24h' | 'p95Ms' | 'errorRate' | 'uptime';

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function EnterpriseAPIGateway() {
  const { setCurrentView } = useApp();
  const [sortKey, setSortKey] = useState<SortKey>('p95Ms');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const back = () => setCurrentView('global-financial-cloud');

  // ─── Derived metrics ───────────────────────────────────────────────────────
  const totalCalls = useMemo(
    () => SERVICE_APIS.reduce((s, x) => s + x.calls24h, 0),
    [],
  );
  const totalEndpoints = useMemo(
    () => SERVICE_APIS.reduce((s, x) => s + x.endpoints, 0),
    [],
  );
  const avgUptime = useMemo(
    () => SERVICE_APIS.reduce((s, x) => s + x.uptime, 0) / SERVICE_APIS.length,
    [],
  );
  const avgP95 = useMemo(
    () => Math.round(SERVICE_APIS.reduce((s, x) => s + x.p95Ms, 0) / SERVICE_APIS.length),
    [],
  );
  const operationalCount = SERVICE_APIS.filter(s => s.status === 'operational').length;
  const degradedCount = SERVICE_APIS.filter(s => s.status === 'degraded').length;

  const maxErrorRate = useMemo(
    () => Math.max(...SERVICE_APIS.map(s => s.errorRate)),
    [],
  );

  const sortedLeaderboard = useMemo(() => {
    const list = [...SERVICE_APIS];
    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const av = a[sortKey]; const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return list;
  }, [sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sortIcon = (key: SortKey) => {
    if (key !== sortKey) return null;
    return sortDir === 'asc'
      ? <ArrowUpRight className="ml-1 inline h-3 w-3 text-emerald-300" />
      : <ArrowDownRight className="ml-1 inline h-3 w-3 text-amber-300" />;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

        {/* ─── HEADER ─────────────────────────────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8"
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl" />
            <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
          </div>

          <div className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                onClick={back}
                variant="outline"
                className="border-white/[0.08] bg-white/[0.02] text-white/70 hover:bg-white/[0.04] hover:text-white"
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back to Hub
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-teal-500/30 bg-teal-500/10 text-teal-300">
                  <Network className="mr-1 h-3 w-3" /> Module 02
                </Badge>
                <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                  <ShieldCheck className="mr-1 h-3 w-3" /> {operationalCount} operational · {degradedCount} degraded
                </Badge>
                <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                  <Zap className="mr-1 h-3 w-3" /> 99.98% SLA
                </Badge>
              </div>
            </div>

            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              Enterprise API Gateway
              <span className="ml-2 bg-gradient-to-r from-teal-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">™</span>
            </h1>
            <p className="mt-2 max-w-4xl text-sm leading-relaxed text-white/55 sm:text-base">
              13 Service Domains · 478 Endpoints · 48.4B Calls/24h · 99.98% Avg Uptime
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {KPIS.map((k, i) => {
                const a = ACCENT_CLASSES[k.accent];
                const Icon = k.icon;
                return (
                  <motion.div
                    key={k.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 + i * 0.04 }}
                    className={cn('rounded-2xl border p-4', a.border, a.bg)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-medium uppercase tracking-wider text-white/50">{k.label}</div>
                      <Icon className={cn('h-4 w-4', a.text)} />
                    </div>
                    <div className={cn('mt-1.5 text-2xl font-bold', a.text)}>{k.value}</div>
                    <div className="mt-0.5 text-[10px] text-white/40">{k.sub}</div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.header>

        {/* ─── SECONDARY STRIP ───────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {[
            { label: 'Total endpoints', value: String(totalEndpoints), accent: 'cyan' as Accent },
            { label: 'Calls / 24h',     value: fmtN(totalCalls),        accent: 'emerald' as Accent },
            { label: 'Avg p95',         value: `${avgP95}ms`,           accent: 'teal' as Accent },
            { label: 'Avg uptime',      value: `${avgUptime.toFixed(2)}%`, accent: 'violet' as Accent },
          ].map(s => {
            const a = ACCENT_CLASSES[s.accent];
            return (
              <div
                key={s.label}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <div className="text-[10px] uppercase tracking-wider text-white/40">{s.label}</div>
                <div className={cn('mt-1 text-lg font-bold', a.text)}>{s.value}</div>
              </div>
            );
          })}
        </motion.div>

        {/* ─── SERVICE API CARDS GRID ───────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          className="mt-6"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-teal-300" />
              <h2 className="text-base font-semibold text-white">Service Domains</h2>
              <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                {SERVICE_APIS.length} services
              </Badge>
            </div>
            <span className="text-xs text-white/40">Click any card to explore endpoints</span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {SERVICE_APIS.map((svc, i) => {
              const a = ACCENT_CLASSES[svc.accent];
              const Icon = ICONS[svc.icon] ?? Server;
              const status = STATUS_BADGE[svc.status];
              const latencyClass =
                svc.p95Ms < 100 ? 'text-emerald-300' :
                svc.p95Ms < 200 ? 'text-amber-300'   :
                                  'text-rose-300';
              return (
                <motion.div
                  key={svc.domain}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
                >
                  <Card
                    className={cn(
                      'group border-white/[0.06] bg-white/[0.02] transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.12]',
                      a.glow,
                    )}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl border', a.border, a.bg)}>
                            <Icon className={cn('h-5 w-5', a.text)} />
                          </div>
                          <div>
                            <CardTitle className="text-base text-white">{svc.domain}</CardTitle>
                            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/50">
                              <span>{svc.endpoints} endpoints</span>
                              <Separator orientation="vertical" className="h-3 bg-white/10" />
                              <span className="font-mono">{svc.auth}</span>
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className={status.className}>{status.label}</Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                      {/* Calls / 24h hero number */}
                      <div className="mb-3 flex items-end justify-between">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-white/40">Calls / 24h</div>
                          <div className={cn('mt-0.5 text-2xl font-bold', a.text)}>{fmtN(svc.calls24h)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-wider text-white/40">Uptime</div>
                          <div className="mt-0.5 font-mono text-sm font-semibold text-emerald-300">{svc.uptime.toFixed(2)}%</div>
                        </div>
                      </div>

                      {/* Three KPI tiles */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-lg border border-white/[0.06] bg-black/30 p-2">
                          <div className="text-[9px] uppercase tracking-wider text-white/40">P95</div>
                          <div className={cn('mt-0.5 font-mono text-xs font-semibold', latencyClass)}>{svc.p95Ms}ms</div>
                        </div>
                        <div className="rounded-lg border border-white/[0.06] bg-black/30 p-2">
                          <div className="text-[9px] uppercase tracking-wider text-white/40">Err Rate</div>
                          <div className="mt-0.5 font-mono text-xs font-semibold text-rose-300">{svc.errorRate.toFixed(2)}%</div>
                        </div>
                        <div className="rounded-lg border border-white/[0.06] bg-black/30 p-2">
                          <div className="text-[9px] uppercase tracking-wider text-white/40">P99</div>
                          <div className="mt-0.5 font-mono text-xs font-semibold text-white/70">{Math.round(svc.p95Ms * 2.4)}ms</div>
                        </div>
                      </div>

                      {/* Top endpoints chips */}
                      <Separator className="my-3 bg-white/[0.06]" />
                      <div className="text-[10px] uppercase tracking-wider text-white/40">Top endpoints</div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {svc.topEndpoints.map(ep => (
                          <span
                            key={ep}
                            className="inline-flex items-center rounded border border-white/[0.08] bg-white/[0.02] px-1.5 py-0.5 font-mono text-[10px] text-cyan-300"
                          >
                            {ep}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ─── LATENCY LEADERBOARD ─────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.3 }}
          className="mt-8"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-cyan-300" />
              <h2 className="text-base font-semibold text-white">Latency Leaderboard</h2>
              <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                Sorted by p95 {sortDir === 'asc' ? '↑' : '↓'}
              </Badge>
            </div>
            <span className="text-xs text-white/40">Click any column header to sort</span>
          </div>

          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-0">
              <ScrollArea className="max-h-[28rem]">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-black/80 backdrop-blur">
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead>
                        <button
                          onClick={() => toggleSort('domain')}
                          className="inline-flex items-center text-xs uppercase tracking-wider text-white/50 hover:text-white"
                        >
                          Service {sortIcon('domain')}
                        </button>
                      </TableHead>
                      <TableHead className="text-right">
                        <button
                          onClick={() => toggleSort('endpoints')}
                          className="inline-flex items-center text-xs uppercase tracking-wider text-white/50 hover:text-white"
                        >
                          Endpoints {sortIcon('endpoints')}
                        </button>
                      </TableHead>
                      <TableHead className="text-right">
                        <button
                          onClick={() => toggleSort('calls24h')}
                          className="inline-flex items-center text-xs uppercase tracking-wider text-white/50 hover:text-white"
                        >
                          Calls / 24h {sortIcon('calls24h')}
                        </button>
                      </TableHead>
                      <TableHead className="text-right">
                        <button
                          onClick={() => toggleSort('p95Ms')}
                          className="inline-flex items-center text-xs uppercase tracking-wider text-white/50 hover:text-white"
                        >
                          P95 (ms) {sortIcon('p95Ms')}
                        </button>
                      </TableHead>
                      <TableHead className="text-right">
                        <button
                          onClick={() => toggleSort('errorRate')}
                          className="inline-flex items-center text-xs uppercase tracking-wider text-white/50 hover:text-white"
                        >
                          Error Rate {sortIcon('errorRate')}
                        </button>
                      </TableHead>
                      <TableHead className="text-right">
                        <button
                          onClick={() => toggleSort('uptime')}
                          className="inline-flex items-center text-xs uppercase tracking-wider text-white/50 hover:text-white"
                        >
                          Uptime {sortIcon('uptime')}
                        </button>
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-white/50">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedLeaderboard.map((svc, i) => {
                      const a = ACCENT_CLASSES[svc.accent];
                      const Icon = ICONS[svc.icon] ?? Server;
                      const status = STATUS_BADGE[svc.status];
                      const latencyClass =
                        svc.p95Ms < 100 ? 'text-emerald-300' :
                        svc.p95Ms < 200 ? 'text-amber-300'   :
                                          'text-rose-300';
                      return (
                        <TableRow key={svc.domain} className="border-white/[0.04] hover:bg-white/[0.02]">
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <span className={cn(
                                'flex h-7 w-7 items-center justify-center rounded-md border text-[10px] font-bold',
                                a.border, a.bg, a.text,
                              )}>
                                {String(i + 1).padStart(2, '0')}
                              </span>
                              <Icon className={cn('h-4 w-4', a.text)} />
                              <span className="text-xs font-medium text-white">{svc.domain}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-white/60">{svc.endpoints}</TableCell>
                          <TableCell className="text-right font-mono text-xs text-white/70">{fmtN(svc.calls24h)}</TableCell>
                          <TableCell className={cn('text-right font-mono text-xs font-semibold', latencyClass)}>{svc.p95Ms}ms</TableCell>
                          <TableCell className="text-right font-mono text-xs text-rose-300">{svc.errorRate.toFixed(2)}%</TableCell>
                          <TableCell className="text-right font-mono text-xs text-emerald-300">{svc.uptime.toFixed(2)}%</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={status.className}>{status.label}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── ERROR RATE HEATMAP ──────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.4 }}
          className="mt-8"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-300" />
              <h2 className="text-base font-semibold text-white">Error Rate Heatmap</h2>
              <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-300">
                Max {maxErrorRate.toFixed(2)}%
              </Badge>
            </div>
            <span className="text-xs text-white/40">Bar width proportional to error rate · rose = degraded</span>
          </div>

          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-2.5">
                {[...SERVICE_APIS]
                  .sort((a, b) => b.errorRate - a.errorRate)
                  .map((svc, i) => {
                    const widthPct = Math.min((svc.errorRate / maxErrorRate) * 100, 100);
                    const isHighest = svc.errorRate === maxErrorRate;
                    return (
                      <div key={svc.domain} className="grid grid-cols-[140px_1fr_60px] items-center gap-3 sm:grid-cols-[180px_1fr_70px]">
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-mono text-[10px] text-white/30">{String(i + 1).padStart(2, '0')}</span>
                          <span className="truncate text-xs font-medium text-white/80">{svc.domain}</span>
                        </div>
                        <div className="relative h-6 overflow-hidden rounded-md border border-white/[0.06] bg-black/40">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${widthPct}%` }}
                            transition={{ duration: 0.6, delay: 0.05 + i * 0.03, ease: 'easeOut' }}
                            className={cn(
                              'flex h-full items-center justify-end rounded-md px-2',
                              isHighest ? 'bg-gradient-to-r from-rose-600 to-rose-400' : 'bg-gradient-to-r from-rose-500/80 to-rose-400/60',
                            )}
                          >
                            {widthPct > 12 && (
                              <span className="font-mono text-[9px] font-semibold text-white">{(svc.errorRate * 1000).toFixed(0)} ppm</span>
                            )}
                          </motion.div>
                          {/* Faint threshold line at 0.05% */}
                          <div
                            className="absolute top-0 h-full border-l border-dashed border-amber-400/40"
                            style={{ left: `${(0.05 / maxErrorRate) * 100}%` }}
                            title="0.05% SLO threshold"
                          />
                        </div>
                        <div className="text-right font-mono text-xs">
                          <span className={cn('font-semibold', isHighest ? 'text-rose-300' : 'text-white/60')}>
                            {svc.errorRate.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <Separator className="my-4 bg-white/[0.06]" />
              <div className="flex flex-wrap items-center justify-between gap-3 text-[11px]">
                <div className="flex items-center gap-3 text-white/50">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-gradient-to-r from-rose-600 to-rose-400" />
                    Highest error rate
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-gradient-to-r from-rose-500/80 to-rose-400/60" />
                    Within SLO
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-3 border-l border-dashed border-amber-400/60" />
                    0.05% SLO threshold
                  </span>
                </div>
                <div className="font-mono text-white/40">
                  Error budget remaining: <span className="text-emerald-300">94.2%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── FOOTER ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
        >
          <div className="flex items-center gap-2 text-xs text-white/50">
            <Activity className="h-3.5 w-3.5 text-teal-300" />
            <span>Gateway version <span className="font-mono text-white/70">v4.12.0</span></span>
            <Separator orientation="vertical" className="mx-1 h-3 bg-white/10" />
            <Clock className="h-3.5 w-3.5 text-cyan-300" />
            <span>Rolling 24h window · refreshed every 30s</span>
          </div>
          <Button
            onClick={back}
            variant="ghost"
            className="h-7 text-xs text-white/50 hover:bg-white/[0.04] hover:text-white"
          >
            Back to Global Financial Cloud™
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
