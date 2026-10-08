'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 16 · MODULE 14
// GLOBAL FINANCIAL NETWORK™
//
//   4.82M Connected Orgs · $48.4B Network GMV · 184M Shared Docs
//
// A secure peer-to-peer network where 4.82M organizations transact directly —
// sharing invoices, POs, payments, approvals and documents — without an
// intermediary. Supports vendor collaboration, customer collaboration, bank
// reconciliation and direct government filing.
//
// All data sourced deterministically from src/lib/global-cloud/data.ts.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowUpRight, Share2, Network as NetworkIcon, Building2, Landmark,
  Briefcase, Banknote, FileText, Receipt, CreditCard, FileCheck, Users,
  CheckCircle2, Clock, Mail, TrendingUp, Zap, Activity, Globe2, Workflow,
  GitBranch, Handshake, type LucideIcon,
} from 'lucide-react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import {
  ORG_CONNECTIONS, SHARED_RESOURCES, NETWORK_KPIS,
  ACCENT_CLASSES, ACCENT_HEX, fmt, type Accent,
} from '@/lib/global-cloud/data';
import type { OrgConnection, SharedResource } from '@/lib/global-cloud/data';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

// ─── Org type styling ─────────────────────────────────────────────────────────
const ORG_TYPE_STYLES: Record<
  OrgConnection['type'],
  { chip: string; dot: string; hex: string; icon: LucideIcon }
> = {
  Customer:   { chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', dot: 'bg-emerald-500', hex: ACCENT_HEX.emerald, icon: Building2   },
  Vendor:     { chip: 'border-teal-500/30 bg-teal-500/10 text-teal-300',           dot: 'bg-teal-500',    hex: ACCENT_HEX.teal,    icon: Briefcase   },
  Partner:    { chip: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',           dot: 'bg-cyan-500',    hex: ACCENT_HEX.cyan,    icon: Handshake   },
  Bank:       { chip: 'border-violet-500/30 bg-violet-500/10 text-violet-300',     dot: 'bg-violet-500',  hex: ACCENT_HEX.violet,  icon: Landmark    },
  Government: { chip: 'border-amber-500/30 bg-amber-500/10 text-amber-300',        dot: 'bg-amber-500',   hex: ACCENT_HEX.amber,   icon: Banknote    },
};

// ─── Org connection status styling ────────────────────────────────────────────
const CONN_STATUS: Record<OrgConnection['status'], { chip: string; icon: LucideIcon }> = {
  active:  { chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', icon: CheckCircle2 },
  pending: { chip: 'border-amber-500/30 bg-amber-500/10 text-amber-300',       icon: Clock        },
  invited: { chip: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',          icon: Mail         },
};

// ─── Shared resource type icon resolver ───────────────────────────────────────
const RESOURCE_ICONS: Record<SharedResource['type'], LucideIcon> = {
  'Invoice':          Receipt,
  'PO':               FileCheck,
  'Payment':          CreditCard,
  'Approval':         FileCheck,
  'Document':         FileText,
  'Vendor Collab':    Briefcase,
  'Customer Collab':  Building2,
};

// ─── Network breakdown (deterministic, curated split of 4.82M orgs) ───────────
const NETWORK_BREAKDOWN: { type: OrgConnection['type']; pct: number; count: string; accent: Accent }[] = [
  { type: 'Customer',   pct: 42, count: '2.02M', accent: 'emerald' },
  { type: 'Vendor',     pct: 28, count: '1.35M', accent: 'teal'    },
  { type: 'Partner',    pct: 14, count: '674K',  accent: 'cyan'    },
  { type: 'Bank',       pct:  8, count: '385K',  accent: 'violet'  },
  { type: 'Government', pct:  8, count: '385K',  accent: 'amber'   },
];

// ─── Network activity stat cards ─────────────────────────────────────────────
const ACTIVITY_STATS: {
  label: string; value: string; sub: string; accent: Accent;
  spark: number[]; icon: LucideIcon;
}[] = [
  { label: 'Invoices Shared Today', value: '184K',  sub: '+22.8% vs avg day',    accent: 'emerald', icon: Receipt,    spark: [42, 56, 48, 72, 84, 92, 108, 124, 142, 168, 184] },
  { label: 'Payments Routed Today', value: '92K',   sub: '+14.6% vs avg day',    accent: 'cyan',    icon: CreditCard, spark: [28, 32, 40, 38, 52, 60, 64, 72, 78, 86, 92]    },
  { label: 'Approvals Pending',     value: '1,240', sub: 'Avg SLA 4.2 hrs',      accent: 'amber',   icon: Clock,      spark: [640, 720, 980, 1240, 1180, 1040, 920, 880, 940, 1080, 1240] },
];

// ─── SVG mini sparkline ───────────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 120, h = 32;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-90">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill={color} fillOpacity="0.12" stroke="none" />
      <circle cx={(w).toFixed(1)} cy={(h - ((data[data.length - 1] - min) / range) * h).toFixed(1)} r="2" fill={color} />
    </svg>
  );
}

// ─── Network visualization: 8 org nodes around a central hub ──────────────────
// Uses polar coordinates; positions are deterministic (no Math.random).
const NODE_RADIUS = 175;
const CENTER = { x: 250, y: 250 };
function nodePosition(i: number, total: number) {
  const angle = (i / total) * Math.PI * 2 - Math.PI / 2; // start at top
  return {
    x: CENTER.x + Math.cos(angle) * NODE_RADIUS,
    y: CENTER.y + Math.sin(angle) * NODE_RADIUS,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function GlobalFinancialNetwork() {
  const { setCurrentView } = useApp();

  const totalSharedDocs = useMemo(
    () => ORG_CONNECTIONS.reduce((s, o) => s + o.sharedDocs, 0), [],
  );
  const totalSharedInvoices = useMemo(
    () => ORG_CONNECTIONS.reduce((s, o) => s + o.sharedInvoices, 0), [],
  );
  const totalSharedPayments = useMemo(
    () => ORG_CONNECTIONS.reduce((s, o) => s + o.sharedPayments, 0), [],
  );
  const activeConnections = ORG_CONNECTIONS.filter(o => o.status === 'active').length;

  // Donut gradient segments
  const donutStops: { color: string; pct: number }[] = NETWORK_BREAKDOWN.reduce<
    { color: string; pct: number }[]
  >((acc, seg) => {
    const prev = acc.length === 0 ? 0 : acc[acc.length - 1].pct;
    acc.push({ color: ACCENT_HEX[seg.accent], pct: prev + seg.pct });
    return acc;
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

        {/* ═════════════════════ HEADER ═════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8"
        >
          <div className="pointer-events-none absolute inset-0 -z-0">
            <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-teal-500/10 blur-3xl" />
            <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
          </div>

          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentView('global-financial-cloud')}
                className="border-white/10 bg-white/[0.02] text-white/70 hover:bg-white/[0.05] hover:text-white"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Hub
              </Button>
              <Badge variant="outline" className="border-teal-500/30 bg-teal-500/10 text-teal-300">
                <Share2 className="mr-1.5 h-3 w-3" />
                Phase 16 · Module 14
              </Badge>
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                4.82M Orgs Online
              </Badge>
            </div>

            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              Global Financial Network
              <span className="ml-2 bg-gradient-to-r from-teal-300 via-emerald-300 to-cyan-300 bg-clip-text text-transparent">™</span>
            </h1>
            <p className="mt-2 text-sm text-white/60 sm:text-base">
              4.82M Connected Orgs · $48.4B Network GMV · 184M Shared Docs
            </p>

            {/* 6 KPI tiles */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {NETWORK_KPIS.map((k, i) => {
                const a = ACCENT_CLASSES[k.accent];
                const positive = k.trend >= 0;
                return (
                  <motion.div
                    key={k.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 + i * 0.04 }}
                    className={cn('rounded-2xl border p-3 sm:p-4', a.border, a.bg)}
                  >
                    <div className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                      {k.label}
                    </div>
                    <div className={cn('mt-1 text-xl font-bold sm:text-2xl', a.text)}>
                      {k.value}
                    </div>
                    <div className={cn(
                      'mt-0.5 flex items-center gap-1 text-[10px]',
                      positive ? 'text-emerald-300/80' : 'text-rose-300/80',
                    )}>
                      <TrendingUp className={cn('h-3 w-3', !positive && 'rotate-180')} />
                      {positive ? '+' : ''}{k.trend.toFixed(1)}%
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* ═════════════════════ NETWORK VISUALIZATION ═════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base text-white">
                    <NetworkIcon className="h-4 w-4 text-teal-300" />
                    Live Network Topology
                  </CardTitle>
                  <CardDescription className="text-xs text-white/50">
                    Central VEYRO Network hub · {ORG_CONNECTIONS.length} direct connections shown · 4.82M total orgs in network
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(Object.keys(ORG_TYPE_STYLES) as OrgConnection['type'][]).map(t => {
                    const s = ORG_TYPE_STYLES[t];
                    const TIcon = s.icon;
                    return (
                      <span
                        key={t}
                        className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]', s.chip)}
                      >
                        <TIcon className="h-3 w-3" />
                        {t}
                      </span>
                    );
                  })}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative mx-auto aspect-square w-full max-w-2xl">
                <svg viewBox="0 0 500 500" className="absolute inset-0 h-full w-full">
                  {/* Background rings */}
                  <circle cx={CENTER.x} cy={CENTER.y} r={NODE_RADIUS} fill="none" stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4" />
                  <circle cx={CENTER.x} cy={CENTER.y} r={NODE_RADIUS * 0.66} fill="none" stroke="rgba(255,255,255,0.03)" strokeDasharray="2 4" />
                  <circle cx={CENTER.x} cy={CENTER.y} r={NODE_RADIUS * 0.33} fill="none" stroke="rgba(255,255,255,0.03)" strokeDasharray="2 4" />

                  {/* Connection lines from hub to each org */}
                  {ORG_CONNECTIONS.map((o, i) => {
                    const pos = nodePosition(i, ORG_CONNECTIONS.length);
                    const s = ORG_TYPE_STYLES[o.type];
                    const isActive = o.status === 'active';
                    return (
                      <g key={`line-${o.name}`}>
                        <line
                          x1={CENTER.x} y1={CENTER.y} x2={pos.x} y2={pos.y}
                          stroke={s.hex}
                          strokeOpacity={isActive ? 0.45 : 0.18}
                          strokeWidth={isActive ? 1.5 : 1}
                          strokeDasharray={isActive ? '0' : '4 4'}
                        />
                        {/* Pulsing packet along the line */}
                        {isActive && (
                          <circle r="2.5" fill={s.hex}>
                            <animateMotion
                              dur="2.6s"
                              begin={`${i * 0.3}s`}
                              repeatCount="indefinite"
                              path={`M ${CENTER.x} ${CENTER.y} L ${pos.x} ${pos.y}`}
                            />
                          </circle>
                        )}
                      </g>
                    );
                  })}

                  {/* Central hub node — large glowing emerald */}
                  <circle cx={CENTER.x} cy={CENTER.y} r="46" fill="rgba(37,99,235,0.18)" />
                  <circle cx={CENTER.x} cy={CENTER.y} r="38" fill="rgba(37,99,235,0.28)" />
                  <circle cx={CENTER.x} cy={CENTER.y} r="30" fill={ACCENT_HEX.emerald}>
                    <animate attributeName="r" values="30;32;30" dur="2.4s" repeatCount="indefinite" />
                  </circle>
                  <text x={CENTER.x} y={CENTER.y - 4} textAnchor="middle" fontSize="9" fill="white" fontWeight="700">
                    VEYRO
                  </text>
                  <text x={CENTER.x} y={CENTER.y + 8} textAnchor="middle" fontSize="8" fill="white" fillOpacity="0.8">
                    Network
                  </text>

                  {/* Org nodes */}
                  {ORG_CONNECTIONS.map((o, i) => {
                    const pos = nodePosition(i, ORG_CONNECTIONS.length);
                    const s = ORG_TYPE_STYLES[o.type];
                    const isActive = o.status === 'active';
                    const labelOffsetY = pos.y < CENTER.y ? -34 : 38;
                    return (
                      <g key={`node-${o.name}`}>
                        {/* Glow */}
                        <circle cx={pos.x} cy={pos.y} r="22" fill={s.hex} fillOpacity="0.15" />
                        <circle
                          cx={pos.x} cy={pos.y} r="14"
                          fill={isActive ? s.hex : 'rgba(255,255,255,0.04)'}
                          fillOpacity={isActive ? 0.85 : 0.4}
                          stroke={s.hex}
                          strokeWidth="1.5"
                        />
                        {/* Type icon (use simple shapes since lucide can't render inside SVG easily) */}
                        <text x={pos.x} y={pos.y + 3} textAnchor="middle" fontSize="9" fontWeight="700" fill="white">
                          {o.type.charAt(0)}
                        </text>
                        {/* Org name label */}
                        <text x={pos.x} y={pos.y + labelOffsetY} textAnchor="middle" fontSize="9" fill="white" fillOpacity="0.85" fontWeight="500">
                          {o.name.length > 22 ? o.name.slice(0, 20) + '…' : o.name}
                        </text>
                        <text x={pos.x} y={pos.y + labelOffsetY + (pos.y < CENTER.y ? 10 : -10)} textAnchor="middle" fontSize="7" fill={s.hex} fillOpacity="0.9">
                          {o.type} · {o.status}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              <Separator className="my-4 bg-white/[0.06]" />

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-white/40">Direct Connections</div>
                  <div className="mt-1 text-xl font-bold text-teal-300">{ORG_CONNECTIONS.length}</div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-white/40">Active</div>
                  <div className="mt-1 text-xl font-bold text-emerald-300">{activeConnections}</div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-white/40">Shared Docs (top 8)</div>
                  <div className="mt-1 text-xl font-bold text-cyan-300">{totalSharedDocs}</div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-white/40">Network Reach</div>
                  <div className="mt-1 text-xl font-bold text-violet-300">4.82M</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ═════════════════════ ORG CONNECTIONS TABLE ═════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base text-white">
                    <Building2 className="h-4 w-4 text-teal-300" />
                    Direct Organization Connections
                  </CardTitle>
                  <CardDescription className="text-xs text-white/50">
                    {ORG_CONNECTIONS.length} high-volume counterparties · sorted by engagement
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/60">
                  <Users className="mr-1.5 h-3 w-3" />
                  {activeConnections} active · {ORG_CONNECTIONS.length - activeConnections} pending
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead className="text-white/50">Organization</TableHead>
                      <TableHead className="text-white/50">Type</TableHead>
                      <TableHead className="text-white/50">GSTIN</TableHead>
                      <TableHead className="text-right text-white/50">Docs</TableHead>
                      <TableHead className="text-right text-white/50">Invoices</TableHead>
                      <TableHead className="text-right text-white/50">Payments</TableHead>
                      <TableHead className="text-white/50">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ORG_CONNECTIONS.map((o, i) => {
                      const s = ORG_TYPE_STYLES[o.type];
                      const TIcon = s.icon;
                      const st = CONN_STATUS[o.status];
                      const SIcon = st.icon;
                      return (
                        <TableRow
                          key={i}
                          className="border-white/[0.04] transition-colors hover:bg-white/[0.03]"
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg border', s.chip)}>
                                <TIcon className="h-3.5 w-3.5" />
                              </div>
                              <span className="text-xs font-medium text-white">{o.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('px-1.5 py-0 text-[10px]', s.chip)}>
                              {o.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-[11px] text-cyan-300/80">
                            {o.gstin}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-white/80">
                            {o.sharedDocs}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-white/80">
                            {o.sharedInvoices.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-white/80">
                            {o.sharedPayments.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('px-1.5 py-0 text-[10px]', st.chip)}>
                              <SIcon className="mr-1 h-3 w-3" />
                              {o.status}
                            </Badge>
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

        {/* ═════════════════════ NETWORK ACTIVITY STATS ═════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mt-6"
        >
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Network Activity (24h)</h2>
              <p className="text-xs text-white/50">Real-time throughput across the network</p>
            </div>
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Streaming
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {ACTIVITY_STATS.map((stat, i) => {
              const a = ACCENT_CLASSES[stat.accent];
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 + i * 0.04 }}
                >
                  <Card className={cn('h-full border bg-white/[0.02]', a.border)}>
                    <CardContent>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-white/50">{stat.label}</div>
                          <div className={cn('mt-1 text-3xl font-bold', a.text)}>{stat.value}</div>
                          <div className="mt-0.5 text-[11px] text-white/40">{stat.sub}</div>
                        </div>
                        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl border', a.border, a.bg)}>
                          <Icon className={cn('h-5 w-5', a.text)} />
                        </div>
                      </div>
                      <div className="mt-3 flex items-end justify-between">
                        <div className="text-[10px] text-white/40">11-hour trend</div>
                        <Sparkline data={stat.spark} color={ACCENT_HEX[stat.accent]} />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ═════════════════════ SHARED RESOURCES FEED ═════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-6"
        >
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Shared Resources Feed</h2>
              <p className="text-xs text-white/50">
                Latest {SHARED_RESOURCES.length} peer-shared artifacts across the network
              </p>
            </div>
            <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/60">
              <Workflow className="mr-1.5 h-3 w-3" />
              {totalSharedInvoices.toLocaleString()} invoices · {totalSharedPayments.toLocaleString()} payments
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SHARED_RESOURCES.map((r, i) => {
              const a = ACCENT_CLASSES[r.accent];
              const Icon = RESOURCE_ICONS[r.type];
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.04 + i * 0.025 }}
                >
                  <Card className={cn('h-full border bg-white/[0.02] transition-colors hover:bg-white/[0.04]', a.border)}>
                    <CardContent className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl border', a.border, a.bg)}>
                          <Icon className={cn('h-5 w-5', a.text)} />
                        </div>
                        <Badge variant="outline" className={cn('px-1.5 py-0 text-[10px]', a.border, a.bg, a.text)}>
                          {r.type}
                        </Badge>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{r.counterparty}</div>
                        <div className="mt-0.5 text-[11px] text-white/50">{r.status}</div>
                      </div>
                      <Separator className="bg-white/[0.06]" />
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-white/40">Amount</div>
                          <div className={cn('mt-0.5 font-mono text-sm font-semibold', r.amount > 0 ? a.text : 'text-white/40')}>
                            {r.amount > 0 ? fmt(r.amount) : '—'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-wider text-white/40">Updated</div>
                          <div className="mt-0.5 font-mono text-[11px] text-white/60">{r.updated}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ═════════════════════ CONNECTION TYPES BREAKDOWN ═════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-white">
                <GitBranch className="h-4 w-4 text-cyan-300" />
                Connection Type Breakdown
              </CardTitle>
              <CardDescription className="text-xs text-white/50">
                Distribution of 4.82M organizations by relationship type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Donut */}
                <div className="flex items-center justify-center">
                  <div className="relative h-64 w-64">
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: `conic-gradient(${
                          donutStops.map((s, i) => {
                            const prev = i === 0 ? 0 : donutStops[i - 1].pct;
                            return `${s.color} ${prev}% ${s.pct}%`;
                          }).join(', ')
                        })`,
                      }}
                    />
                    <div className="absolute inset-8 rounded-full bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center">
                      <div className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                        Total Orgs
                      </div>
                      <div className="mt-1 text-3xl font-bold text-white">4.82M</div>
                      <div className="mt-1 text-[11px] text-white/40">across 5 types</div>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="space-y-2.5">
                  {NETWORK_BREAKDOWN.map(seg => {
                    const a = ACCENT_CLASSES[seg.accent];
                    return (
                      <div
                        key={seg.type}
                        className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: ACCENT_HEX[seg.accent] }}
                          />
                          <div>
                            <div className={cn('text-sm font-medium', a.text)}>{seg.type}</div>
                            <div className="text-[10px] text-white/40">{seg.count} organizations</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="hidden h-2 w-24 overflow-hidden rounded-full bg-white/[0.06] sm:block">
                            <div
                              className={cn('h-full rounded-full', a.bar)}
                              style={{ width: `${seg.pct}%` }}
                            />
                          </div>
                          <span className="font-mono text-sm font-semibold text-white">{seg.pct}%</span>
                        </div>
                      </div>
                    );
                  })}

                  <div className="mt-3 flex items-start gap-3 rounded-xl border border-teal-500/20 bg-teal-500/5 p-3">
                    <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
                    <p className="text-xs leading-relaxed text-white/70">
                      <span className="font-medium text-teal-300">Network effect:</span> Each new organization
                      joins a graph of <span className="font-mono text-white/90">4.82M</span> potential
                      counterparties — average acceptance time is just{' '}
                      <span className="font-mono text-white/90">4.2 hrs</span>, down{' '}
                      <span className="text-emerald-300">12.4%</span> MoM.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ═════════════════════ BOTTOM CTA ═════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-6"
        >
          <Card className="border-teal-500/20 bg-gradient-to-br from-teal-500/[0.06] via-emerald-500/[0.03] to-transparent">
            <CardContent className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-teal-500/30 bg-teal-500/10">
                  <Zap className="h-5 w-5 text-teal-300" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">
                    Network GMV (30d): <span className="text-teal-300">$48.4B</span>
                  </div>
                  <div className="mt-0.5 text-xs text-white/60">
                    4.82M organizations · 184M shared invoices · 92M shared payments · 98.6% dispute SLA
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => setCurrentView('global-financial-cloud')}
                className="border-teal-500/30 bg-teal-500/10 text-teal-300 hover:bg-teal-500/20"
              >
                Back to Hub
                <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        </motion.section>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between text-[10px] text-white/30">
          <span className="font-mono">global-financial-network · module 14 · phase 16</span>
          <span className="flex items-center gap-1.5">
            <Activity className="h-3 w-3" />
            Network health: <span className="text-emerald-400">Operational</span>
          </span>
        </div>
      </div>
    </div>
  );
}
