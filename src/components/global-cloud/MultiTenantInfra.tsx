'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 16: MULTI-TENANT CLOUD INFRASTRUCTURE
//
// 10 Regions · 142 Edge POPs · 48.4B API Calls/24h · 99.992% Uptime
//
// Real-time observability for the Global Financial Cloud™ — every region,
// edge POP, auto-scaling group, and load balancer serving 184K organizations
// across six continents.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowUp, ArrowDown, Server, MapPin, Globe2, Activity,
  Zap, Gauge, Network, Cpu, Layers, ShieldCheck, TrendingUp,
  CircleDot, Signal,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import {
  CLOUD_REGIONS, EDGE_POPS, INFRA_KPIS,
  ACCENT_CLASSES, fmtN, fmtPct, type Accent,
} from '@/lib/global-cloud/data';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

// ─── Country code → emoji flag ─────────────────────────────────────────────────
const COUNTRY_FLAG: Record<string, string> = {
  US: '🇺🇸', DE: '🇩🇪', IN: '🇮🇳', SG: '🇸🇬', AE: '🇦🇪', JP: '🇯🇵',
};

// ─── Region status mapping ────────────────────────────────────────────────────
const REGION_STATUS: Record<string, { accent: Accent; label: string; dot: string }> = {
  operational:  { accent: 'emerald', label: 'Operational', dot: 'bg-emerald-500' },
  degraded:     { accent: 'amber',   label: 'Degraded',    dot: 'bg-amber-500'   },
  maintenance:  { accent: 'violet',  label: 'Maintenance', dot: 'bg-violet-500'  },
};

// ─── Continent column labels for the world map ────────────────────────────────
const CONTINENTS: { code: 'Americas' | 'EMEA' | 'APAC'; label: string; accent: Accent }[] = [
  { code: 'Americas', label: 'Americas', accent: 'emerald' },
  { code: 'EMEA',     label: 'EMEA',     accent: 'teal'    },
  { code: 'APAC',     label: 'APAC',     accent: 'cyan'    },
];

// ─── Synthesized deterministic Auto-Scaling Groups ────────────────────────────
const AUTO_SCALING_GROUPS: {
  name: string;
  current: number;
  min: number;
  max: number;
  avgCpu: number;
  lastEvent: string;
  accent: Accent;
}[] = [
  { name: 'asg-api-gateway-ap-south',   current: 142, min: 8,   max: 400, avgCpu: 62, lastEvent: '4 min ago — scaled +12', accent: 'emerald' },
  { name: 'asg-oracle-ai-inference',    current:  84, min: 4,   max: 200, avgCpu: 78, lastEvent: '8 min ago — scaled +6',  accent: 'teal'    },
  { name: 'asg-doc-ocr-workers',        current:  56, min: 4,   max: 150, avgCpu: 44, lastEvent: '14 min ago — scaled -4', accent: 'cyan'    },
  { name: 'asg-webhook-delivery',       current:  92, min: 8,   max: 300, avgCpu: 88, lastEvent: '2 min ago — scaled +18', accent: 'amber'   },
  { name: 'asg-gst-return-filing',      current:  38, min: 4,   max: 100, avgCpu: 31, lastEvent: '22 min ago — scaled -8', accent: 'violet'  },
  { name: 'asg-bank-recon-batch',       current:  72, min: 4,   max: 250, avgCpu: 91, lastEvent: '1 min ago — scaled +24', accent: 'rose'    },
];

// ─── Load balancer stats (4 cards) ────────────────────────────────────────────
const LB_STATS: { label: string; value: string; sub: string; accent: Accent; icon: typeof Zap }[] = [
  { label: 'Total Requests Today',  value: '48.4B',     sub: 'Across 10 regions',        accent: 'emerald' as Accent, icon: Zap       },
  { label: 'Avg Response Time',     value: '124 ms',    sub: 'P95 across all regions',   accent: 'teal'    as Accent, icon: Gauge     },
  { label: 'Active Connections',    value: '1.2M',      sub: 'Live TCP connections',     accent: 'cyan'    as Accent, icon: Network   },
  { label: 'Health Check Failures', value: '0.02%',     sub: 'Within SLA tolerance',     accent: 'violet'  as Accent, icon: ShieldCheck },
];

export default function MultiTenantInfra() {
  const { setCurrentView } = useApp();

  // ─── Edge POPs sorted by requests/sec desc ──────────────────────────────────
  const sortedEdgePops = useMemo(
    () => [...EDGE_POPS].sort((a, b) => b.requestsPerSec - a.requestsPerSec),
    [],
  );

  // ─── Group regions by continent for the world map ───────────────────────────
  const regionsByContinent = useMemo(() => {
    const groups: Record<'Americas' | 'EMEA' | 'APAC', typeof CLOUD_REGIONS> = {
      Americas: [], EMEA: [], APAC: [],
    };
    CLOUD_REGIONS.forEach((r) => {
      groups[r.continent as 'Americas' | 'EMEA' | 'APAC'].push(r);
    });
    return groups;
  }, []);

  const totalOrgs = CLOUD_REGIONS.reduce((a, r) => a + r.orgs, 0);
  const totalApiCalls = CLOUD_REGIONS.reduce((a, r) => a + r.apiCalls24h, 0);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

        {/* ─── HEADER ─────────────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8"
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
          </div>

          <div className="relative z-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                    <Server className="mr-1.5 h-3 w-3" />
                    Phase 16 · Module 12
                  </Badge>
                  <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                    <Globe2 className="mr-1.5 h-3 w-3" />
                    Multi-AZ · Multi-Region
                  </Badge>
                </div>
                <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                  Multi-Tenant Cloud Infrastructure
                  <span className="ml-2 bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">™</span>
                </h1>
                <p className="mt-2 text-sm text-white/55">
                  10 Regions · 142 Edge POPs · 48.4B API Calls/24h · 99.992% Uptime
                </p>
              </div>
              <Button
                onClick={() => setCurrentView('global-financial-cloud')}
                variant="outline"
                size="sm"
                className="border-white/15 bg-white/[0.02] text-white hover:bg-white/[0.06]"
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back to Cloud Hub
              </Button>
            </div>

            {/* KPI tiles 6-up */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {INFRA_KPIS.map((kpi, i) => {
                const a = ACCENT_CLASSES[kpi.accent];
                const isPositive = kpi.trend >= 0;
                return (
                  <motion.div
                    key={kpi.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 + i * 0.03 }}
                    className={cn('rounded-2xl border p-4', a.border, a.bg)}
                  >
                    <div className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                      {kpi.label}
                    </div>
                    <div className={cn('mt-1 text-xl font-bold sm:text-2xl', a.text)}>{kpi.value}</div>
                    <div className="mt-0.5 text-[10px] text-white/40">{kpi.sub}</div>
                    <div className="mt-1.5 flex items-center gap-1 text-[10px]">
                      {isPositive ? (
                        <ArrowUp className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-emerald-400" />
                      )}
                      <span className="text-emerald-400">{fmtPct(kpi.trend)}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* ─── WORLD REGIONS GRID ────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                <Globe2 className="h-4 w-4 text-emerald-300" />
                Cloud Regions
                <span className="ml-1 text-xs font-normal text-white/40">
                  ({CLOUD_REGIONS.length} active regions · {fmtN(totalOrgs)} orgs · {fmtN(totalApiCalls)} calls/24h)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {CLOUD_REGIONS.map((r, idx) => {
                  const a = ACCENT_CLASSES[r.accent];
                  const st = REGION_STATUS[r.status];
                  const sa = ACCENT_CLASSES[st.accent];
                  return (
                    <motion.div
                      key={r.code}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.04 + idx * 0.03 }}
                      className={cn('relative overflow-hidden rounded-2xl border p-4', a.border, a.bg)}
                    >
                      {/* Top row: region code + status dot */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className={cn('h-4 w-4', a.text)} />
                          <div>
                            <div className="font-mono text-sm font-semibold text-white">{r.code}</div>
                            <div className="text-[11px] text-white/60">{r.name}</div>
                          </div>
                        </div>
                        <Badge variant="outline" className={cn('shrink-0', sa.border, sa.bg, sa.text)}>
                          <span className={cn('mr-1 inline-block h-1.5 w-1.5 rounded-full', st.dot)} />
                          {st.label}
                        </Badge>
                      </div>

                      <Separator className="my-3 bg-white/[0.06]" />

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-[9px] uppercase tracking-wide text-white/40">Continent</div>
                          <div className="mt-0.5 text-xs font-semibold text-white/80">{r.continent}</div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase tracking-wide text-white/40">Orgs</div>
                          <div className={cn('mt-0.5 text-xs font-bold', a.text)}>{fmtN(r.orgs)}</div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase tracking-wide text-white/40">p95</div>
                          <div className="mt-0.5 text-xs font-bold text-white">{r.p95Ms}ms</div>
                        </div>
                      </div>

                      {/* Bottom API calls / 24h */}
                      <div className="mt-3 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1 text-white/50">
                          <Activity className="h-3 w-3" />
                          <span>API calls / 24h</span>
                        </div>
                        <span className={cn('font-mono font-semibold', a.text)}>
                          {fmtN(r.apiCalls24h)}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── REGION HEALTH MAP ─────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                <CircleDot className="h-4 w-4 text-teal-300" />
                Region Health Map
                <span className="ml-1 text-xs font-normal text-white/40">
                  (Live status · {CLOUD_REGIONS.filter(r => r.status === 'operational').length} of {CLOUD_REGIONS.length} operational)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {CONTINENTS.map((c, idx) => {
                  const a = ACCENT_CLASSES[c.accent];
                  const regions = regionsByContinent[c.code];
                  return (
                    <motion.div
                      key={c.code}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.05 + idx * 0.06 }}
                      className={cn('rounded-2xl border p-4', a.border, a.bg)}
                    >
                      <div className="flex items-center justify-between">
                        <div className={cn('text-sm font-bold uppercase tracking-wider', a.text)}>
                          {c.label}
                        </div>
                        <Badge variant="outline" className={cn(a.border, a.text)}>
                          {regions.length} regions
                        </Badge>
                      </div>

                      <Separator className="my-3 bg-white/[0.06]" />

                      <div className="space-y-2.5">
                        {regions.map((r) => {
                          const st = REGION_STATUS[r.status];
                          return (
                            <div key={r.code} className="flex items-center gap-2.5">
                              <span className={cn('h-2 w-2 shrink-0 rounded-full', st.dot)} />
                              <div className="min-w-0 flex-1">
                                <div className="font-mono text-xs text-white">{r.code}</div>
                                <div className="text-[10px] text-white/40">{r.name}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-mono text-[10px] text-white/70">
                                  {fmtN(r.apiCalls24h)}
                                </div>
                                <div className="text-[9px] text-white/30">calls/24h</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── EDGE POPs TABLE ───────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                <Signal className="h-4 w-4 text-cyan-300" />
                Edge POPs · CDN Cache
                <span className="ml-1 text-xs font-normal text-white/40">
                  (Top {EDGE_POPS.length} by requests/sec · sorted descending)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.06] hover:bg-transparent">
                    <TableHead className="text-white/50">City</TableHead>
                    <TableHead className="text-white/50">Country</TableHead>
                    <TableHead className="text-white/50">Cache Hit Ratio</TableHead>
                    <TableHead className="text-right text-white/50">Requests / sec</TableHead>
                    <TableHead className="text-right text-white/50">Egress (Mbps)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedEdgePops.map((p) => {
                    const a = ACCENT_CLASSES[p.accent];
                    const flag = COUNTRY_FLAG[p.country] ?? '🏳️';
                    const hitColor = p.cacheHitRatio >= 95 ? 'text-emerald-300' :
                      p.cacheHitRatio >= 92 ? 'text-amber-300' : 'text-rose-300';
                    const hitBar = p.cacheHitRatio >= 95 ? 'bg-emerald-500' :
                      p.cacheHitRatio >= 92 ? 'bg-amber-500' : 'bg-rose-500';
                    return (
                      <TableRow key={p.city} className="border-white/[0.06] hover:bg-white/[0.02]">
                        <TableCell className="py-3 font-medium text-white">{p.city}</TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg leading-none">{flag}</span>
                            <span className="font-mono text-xs text-white/60">{p.country}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-28 overflow-hidden rounded-full bg-black/40">
                              <div
                                className={cn('h-full rounded-full', hitBar)}
                                style={{ width: `${p.cacheHitRatio}%` }}
                              />
                            </div>
                            <span className={cn('font-mono text-xs font-semibold', hitColor)}>
                              {p.cacheHitRatio.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className={cn('py-3 text-right font-mono text-sm font-semibold', a.text)}>
                          {fmtN(p.requestsPerSec)}
                        </TableCell>
                        <TableCell className="py-3 text-right font-mono text-sm text-white/70">
                          {fmtN(p.egressMbps)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── AUTO-SCALING VISUALIZATION ────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                <Cpu className="h-4 w-4 text-violet-300" />
                Auto-Scaling Groups
                <span className="ml-1 text-xs font-normal text-white/40">
                  ({AUTO_SCALING_GROUPS.length} active ASGs · live CPU monitoring)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {AUTO_SCALING_GROUPS.map((asg, idx) => {
                  const a = ACCENT_CLASSES[asg.accent];
                  const isNearLimit = asg.avgCpu >= 85 || asg.current >= asg.max * 0.8;
                  const cpuColor = asg.avgCpu >= 85 ? 'bg-rose-500' :
                    asg.avgCpu >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
                  const cpuText = asg.avgCpu >= 85 ? 'text-rose-300' :
                    asg.avgCpu >= 70 ? 'text-amber-300' : 'text-emerald-300';
                  return (
                    <motion.div
                      key={asg.name}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.05 + idx * 0.04 }}
                      className={cn(
                        'relative overflow-hidden rounded-2xl border p-4',
                        isNearLimit ? 'border-amber-500/30 bg-amber-500/[0.06]' : cn(a.border, a.bg),
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-mono text-xs font-semibold text-white">{asg.name}</div>
                          <div className="mt-0.5 text-[10px] text-white/50">
                            Scale range {asg.min}–{asg.max}
                          </div>
                        </div>
                        {isNearLimit && (
                          <Badge variant="outline" className="shrink-0 border-amber-500/40 bg-amber-500/10 text-amber-300">
                            Near limit
                          </Badge>
                        )}
                      </div>

                      {/* Instances + CPU */}
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-[9px] uppercase tracking-wide text-white/40">Instances</div>
                          <div className={cn('text-2xl font-bold', a.text)}>{asg.current}</div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase tracking-wide text-white/40">Avg CPU</div>
                          <div className={cn('text-2xl font-bold', cpuText)}>{asg.avgCpu}%</div>
                        </div>
                      </div>

                      {/* CPU bar */}
                      <div className="mt-2">
                        <div className="h-2 overflow-hidden rounded-full bg-black/40">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${asg.avgCpu}%` }}
                            transition={{ duration: 0.6, delay: 0.2 + idx * 0.04 }}
                            className={cn('h-full rounded-full', cpuColor)}
                          />
                        </div>
                      </div>

                      <Separator className="my-3 bg-white/[0.06]" />

                      {/* Last scale event */}
                      <div className="flex items-center gap-1.5 text-[10px] text-white/50">
                        <Layers className="h-3 w-3" />
                        <span>Last event: {asg.lastEvent}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── LOAD BALANCER STATS ───────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                <Network className="h-4 w-4 text-amber-300" />
                Load Balancer Stats
                <span className="ml-1 text-xs font-normal text-white/40">
                  (Global tier-1 LB · live metrics)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {LB_STATS.map((s, idx) => {
                  const a = ACCENT_CLASSES[s.accent];
                  const Icon = s.icon;
                  return (
                    <motion.div
                      key={s.label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.05 + idx * 0.05 }}
                      className={cn('rounded-2xl border p-5', a.border, a.bg)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                          {s.label}
                        </div>
                        <Icon className={cn('h-4 w-4', a.text)} />
                      </div>
                      <div className={cn('mt-2 text-3xl font-bold', a.text)}>{s.value}</div>
                      <div className="mt-1 text-[10px] text-white/40">{s.sub}</div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── TAGLINE ──────────────────────────────────────────────────── */}
        <div className="mt-6 flex items-center justify-center gap-2 text-center">
          <TrendingUp className="h-3.5 w-3.5 text-white/30" />
          <p className="text-[11px] text-white/40">
            One Cloud. Ten Regions. 142 Edges. Infinite Scale. — VEYRO™
          </p>
        </div>
      </div>
    </div>
  );
}
