'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 16 · MODULE 15
// PLATFORM INTELLIGENCE™
//
//   AI Monitors Performance · Scaling · Security · Costs · Reliability ·
//   Developer Experience
//
// An always-on autonomous AI that observes the entire VEYRO platform across
// six dimensions and takes corrective action without human intervention —
// 640 autonomous actions / 24h, $848K cost savings MTD, weighted-avg health
// 95.2% (Optimal). Last human override: 14 days ago.
//
// All data sourced deterministically from src/lib/global-cloud/data.ts.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowUpRight, BrainCircuit, Cpu, Bot, Gauge, Activity, Zap,
  ShieldCheck, Server, Banknote, Code2, TrendingUp, TrendingDown, Sparkles,
  User, Clock, CheckCircle2, AlertTriangle, AlertOctagon, type LucideIcon,
} from 'lucide-react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  INTELLIGENCE_DIMENSIONS, AI_ACTIONS,
  ACCENT_CLASSES, ACCENT_HEX, fmt, type Accent,
} from '@/lib/global-cloud/data';
import type { IntelligenceDimension } from '@/lib/global-cloud/data';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

// ─── Dimension icon resolver ──────────────────────────────────────────────────
const DIMENSION_ICONS: Record<string, LucideIcon> = {
  'Performance':            Activity,
  'Scaling':                TrendingUp,
  'Security':               ShieldCheck,
  'Costs':                  Banknote,
  'Reliability':            Server,
  'Developer Experience':   Code2,
};

// ─── Status styling ───────────────────────────────────────────────────────────
const STATUS_STYLES: Record<
  IntelligenceDimension['status'],
  { chip: string; dot: string; icon: LucideIcon; label: string }
> = {
  optimal: { chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', dot: 'bg-emerald-500', icon: CheckCircle2,  label: 'Optimal'  },
  healthy: { chip: 'border-teal-500/30 bg-teal-500/10 text-teal-300',          dot: 'bg-teal-500',    icon: CheckCircle2,  label: 'Healthy'  },
  watch:   { chip: 'border-amber-500/30 bg-amber-500/10 text-amber-300',       dot: 'bg-amber-500',   icon: AlertTriangle, label: 'Watch'    },
  action:  { chip: 'border-rose-500/30 bg-rose-500/10 text-rose-300',          dot: 'bg-rose-500',    icon: AlertOctagon,  label: 'Action Needed' },
};

// ─── Header KPI tiles ─────────────────────────────────────────────────────────
const HEADER_KPIS: { label: string; value: string; sub: string; icon: LucideIcon; accent: Accent }[] = [
  { label: 'Dimensions Monitored', value: '6',     sub: 'AI observes every facet',     icon: BrainCircuit, accent: 'emerald' },
  { label: 'Actions / 24h',        value: '640',   sub: 'Autonomous AI decisions',     icon: Bot,          accent: 'teal'    },
  { label: 'Cost Saved MTD',       value: '$848K', sub: 'Right-sizing · migration',    icon: Banknote,     accent: 'violet'  },
  { label: 'Avg Health Score',     value: '95.2%', sub: 'Weighted across dimensions',  icon: Gauge,        accent: 'cyan'    },
];

// ─── Monthly cost savings per dimension (deterministic, curated) ──────────────
// Values curated to sum to $848K headline.
const MONTHLY_SAVINGS: { dimension: string; amount: number; accent: Accent }[] = [
  { dimension: 'Performance',         amount:  82_400, accent: 'emerald' },
  { dimension: 'Scaling',             amount: 142_000, accent: 'teal'    },
  { dimension: 'Security',            amount:      0,  accent: 'cyan'    },
  { dimension: 'Costs',               amount: 624_000, accent: 'violet'  },
  { dimension: 'Reliability',         amount:      0,  accent: 'amber'   },
  { dimension: 'Developer Experience',amount:      0,  accent: 'rose'    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function PlatformIntelligence() {
  const { setCurrentView } = useApp();

  // ─── Compute weighted avg score across dimensions ──────────────────────────
  // Use a simple average since each dimension is equally weighted in the data.
  const avgScore = useMemo(() => {
    const total = INTELLIGENCE_DIMENSIONS.reduce((s, d) => s + d.score, 0);
    return Math.round((total / INTELLIGENCE_DIMENSIONS.length) * 10) / 10;
  }, []);

  const totalActions24h = INTELLIGENCE_DIMENSIONS.reduce((s, d) => s + d.actions24h, 0);
  const totalSavingsMTD = INTELLIGENCE_DIMENSIONS.reduce((s, d) => s + d.savings, 0);

  // Overall status label per prompt rules
  const overallStatus =
    avgScore >= 95 ? 'optimal'
    : avgScore >= 90 ? 'healthy'
    : 'watch';
  const overallStatusStyle = STATUS_STYLES[overallStatus];

  // Max actions across dimensions (for bar scaling)
  const maxActions = Math.max(...INTELLIGENCE_DIMENSIONS.map(d => d.actions24h));
  const maxSavings = Math.max(...MONTHLY_SAVINGS.map(d => d.amount));

  // AI actions sorted by recency — reverse so most recent at top
  const sortedActions = useMemo(() => [...AI_ACTIONS].reverse(), []);

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
            <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />
            <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
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
              <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                <BrainCircuit className="mr-1.5 h-3 w-3" />
                Phase 16 · Module 15
              </Badge>
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Autonomous Mode Active
              </Badge>
            </div>

            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              Platform Intelligence
              <span className="ml-2 bg-gradient-to-r from-cyan-300 via-emerald-300 to-teal-300 bg-clip-text text-transparent">™</span>
            </h1>
            <p className="mt-2 text-sm text-white/60 sm:text-base">
              AI Monitors Performance · Scaling · Security · Costs · Reliability · Developer Experience
            </p>

            {/* KPI tiles */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {HEADER_KPIS.map((k, i) => {
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
                      <div className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                        {k.label}
                      </div>
                      <Icon className={cn('h-4 w-4', a.text)} />
                    </div>
                    <div className={cn('mt-1 text-2xl font-bold sm:text-3xl', a.text)}>
                      {k.value}
                    </div>
                    <div className="mt-0.5 text-[10px] text-white/40">{k.sub}</div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* ═════════════════════ AUTONOMOUS MODE INDICATOR ═════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="mt-6"
        >
          <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.08] via-teal-500/[0.04] to-transparent">
            <CardContent className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-4">
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/10">
                  <Bot className="h-7 w-7 text-emerald-300" />
                  <span className="absolute -right-1 -top-1 flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-white">
                      Autonomous Mode: <span className="text-emerald-300">ACTIVE</span>
                    </span>
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                      <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      Online
                    </Badge>
                  </div>
                  <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/70">
                    AI is currently managing <span className="font-medium text-emerald-300">6 dimensions</span>{' '}
                    autonomously. Last human override:{' '}
                    <span className="font-mono text-white/90">14 days ago</span>. The platform has
                    self-healed through <span className="font-mono text-white/90">8,920</span>{' '}
                    autonomous actions since the last intervention.
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 sm:w-56">
                <div className="grid w-full grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-white/40">Today</div>
                    <div className="mt-0.5 font-mono text-sm font-semibold text-emerald-300">640 actions</div>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-white/40">Override Rate</div>
                    <div className="mt-0.5 font-mono text-sm font-semibold text-teal-300">0.04%</div>
                  </div>
                </div>
                <div className="text-[10px] text-white/40">
                  <Clock className="mr-1 inline h-3 w-3" />
                  Mean decision time: <span className="font-mono text-white/70">2.4s</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ═════════════════════ INTELLIGENCE DIMENSIONS GRID ═════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-6"
        >
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Intelligence Dimensions</h2>
              <p className="text-xs text-white/50">
                6 dimensions · weighted-avg health {avgScore.toFixed(1)}% · {totalActions24h} autonomous actions today
              </p>
            </div>
            <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500" />
              AI Monitoring Active
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INTELLIGENCE_DIMENSIONS.map((d, i) => {
              const a = ACCENT_CLASSES[d.accent];
              const hex = ACCENT_HEX[d.accent];
              const s = STATUS_STYLES[d.status];
              const SIcon = s.icon;
              const DIcon = DIMENSION_ICONS[d.dimension] ?? Activity;
              return (
                <motion.div
                  key={d.dimension}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 + i * 0.04 }}
                >
                  <Card className={cn(
                    'relative h-full overflow-hidden border bg-white/[0.02] transition-colors hover:bg-white/[0.04]',
                    a.border,
                  )}>
                    {/* Pulsing monitoring indicator */}
                    <div className="absolute right-3 top-3 flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', a.bar)} />
                        <span className={cn('relative inline-flex h-2 w-2 rounded-full', a.bar)} />
                      </span>
                      <span className="text-[9px] uppercase tracking-wider text-white/40">Live</span>
                    </div>

                    <CardContent className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl border', a.border, a.bg)}>
                          <DIcon className={cn('h-5 w-5', a.text)} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold leading-tight text-white">
                            {d.dimension}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <Badge variant="outline" className={cn('px-1.5 py-0 text-[10px]', s.chip)}>
                              <SIcon className="mr-1 h-3 w-3" />
                              {s.label}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Score + ring gauge */}
                      <div className="flex items-center gap-4">
                        <div className="relative h-16 w-16 shrink-0">
                          <div
                            className="absolute inset-0 rounded-full"
                            style={{
                              background: `conic-gradient(from -90deg, ${hex} 0% ${d.score}%, rgba(255,255,255,0.06) ${d.score}% 100%)`,
                            }}
                          />
                          <div className="absolute inset-2 rounded-full bg-black flex items-center justify-center">
                            <span className={cn('text-base font-bold', a.text)}>{d.score}</span>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-white/50">Actions / 24h</span>
                            <span className="font-mono font-semibold text-white">{d.actions24h}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-white/50">Saved MTD</span>
                            <span className={cn('font-mono font-semibold', d.savings > 0 ? a.text : 'text-white/40')}>
                              {d.savings > 0 ? fmt(d.savings) : '—'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Insight */}
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                        <p className="text-[11px] italic leading-relaxed text-white/60">
                          &ldquo;{d.insight}&rdquo;
                        </p>
                      </div>

                      {/* Score progress bar */}
                      <div>
                        <div className="mb-1 flex items-center justify-between text-[10px] text-white/40">
                          <span>Health score</span>
                          <span className="font-mono">{d.score}/100</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className={cn('h-full rounded-full', a.bar)}
                            style={{ width: `${d.score}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ═════════════════════ OVERALL PLATFORM HEALTH ═════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base text-white">
                    <Gauge className="h-4 w-4 text-emerald-300" />
                    Overall Platform Health
                  </CardTitle>
                  <CardDescription className="text-xs text-white/50">
                    Weighted-avg score across {INTELLIGENCE_DIMENSIONS.length} dimensions · AI autonomous actions last 24h: 640
                  </CardDescription>
                </div>
                <Badge variant="outline" className={cn('px-2 py-0.5', overallStatusStyle.chip)}>
                  <overallStatusStyle.icon className="mr-1 h-3 w-3" />
                  {overallStatusStyle.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Circular gauge */}
                <div className="flex items-center justify-center">
                  <div className="relative h-56 w-56">
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: `conic-gradient(from -90deg, ${ACCENT_HEX.emerald} 0% ${avgScore}%, rgba(255,255,255,0.06) ${avgScore}% 100%)`,
                      }}
                    />
                    <div className="absolute inset-3 rounded-full bg-black/80 backdrop-blur-sm" />
                    <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full">
                      <div className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                        Health Score
                      </div>
                      <div className="mt-1 text-5xl font-bold text-emerald-300">
                        {avgScore.toFixed(1)}%
                      </div>
                      <div className="mt-1 text-xs text-white/40">
                        {overallStatusStyle.label}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dimension breakdown bars */}
                <div className="lg:col-span-2">
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] uppercase tracking-wider text-white/50">
                        Autonomous actions / 24h · by dimension
                      </div>
                      <div className="font-mono text-xs text-white/60">
                        Σ {totalActions24h}
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      {INTELLIGENCE_DIMENSIONS.map(d => {
                        const a = ACCENT_CLASSES[d.accent];
                        const pct = Math.round((d.actions24h / maxActions) * 100);
                        return (
                          <div key={d.dimension} className="flex items-center gap-3">
                            <div className="w-36 shrink-0 truncate text-[11px] text-white/70">
                              {d.dimension}
                            </div>
                            <div className="h-5 flex-1 overflow-hidden rounded-md bg-white/[0.04]">
                              <div
                                className={cn('flex h-full items-center justify-end rounded-md pr-2 text-[9px] font-mono text-black/70', a.bar)}
                                style={{ width: `${Math.max(pct, 4)}%` }}
                              >
                                {d.actions24h}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-white/50">Cost Saved</div>
                      <div className="mt-1 text-xl font-bold text-emerald-300">{fmt(totalSavingsMTD)}</div>
                      <div className="mt-0.5 text-[10px] text-white/40">MTD across 6 dims</div>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <div className="text-[10px] uppercase tracking-wider text-white/50">Override Rate</div>
                      <div className="mt-1 text-xl font-bold text-teal-300">0.04%</div>
                      <div className="mt-0.5 text-[10px] text-white/40">14 days since last</div>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <div className="text-[10px] uppercase tracking-wider text-white/50">Decisions / day</div>
                      <div className="mt-1 text-xl font-bold text-violet-300">640</div>
                      <div className="mt-0.5 text-[10px] text-white/40">Avg 2.4s each</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ═════════════════════ AI ACTIONS TIMELINE ═════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base text-white">
                    <Bot className="h-4 w-4 text-cyan-300" />
                    Autonomous AI Action Timeline
                  </CardTitle>
                  <CardDescription className="text-xs text-white/50">
                    Most recent {AI_ACTIONS.length} autonomous decisions · ordered by recency
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                  <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500" />
                  Live Feed
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[28rem] pr-3">
                <div className="relative space-y-3 pl-5">
                  {/* Vertical connecting line */}
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-cyan-500/40 via-emerald-500/30 to-transparent" />

                  {sortedActions.map((act, i) => {
                    const dim = INTELLIGENCE_DIMENSIONS.find(d => d.dimension === act.dimension);
                    const accent: Accent = dim?.accent ?? 'cyan';
                    const a = ACCENT_CLASSES[accent];
                    const hex = ACCENT_HEX[accent];
                    const DIcon = DIMENSION_ICONS[act.dimension] ?? Activity;
                    const confidenceTier =
                      act.confidence >= 95 ? 'text-emerald-300'
                      : act.confidence >= 90 ? 'text-teal-300'
                      : 'text-amber-300';
                    return (
                      <motion.div
                        key={`${act.action}-${i}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: 0.04 + i * 0.025 }}
                        className="relative"
                      >
                        {/* Timeline dot */}
                        <span
                          className="absolute -left-[18px] top-3 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-black"
                          style={{ backgroundColor: hex }}
                        />

                        <div className={cn(
                          'rounded-xl border bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04]',
                          a.border,
                        )}>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={cn('px-1.5 py-0 text-[10px]', a.border, a.bg, a.text)}>
                              <DIcon className="mr-1 h-3 w-3" />
                              {act.dimension}
                            </Badge>
                            {act.auto ? (
                              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[10px] text-emerald-300">
                                <Bot className="mr-1 h-3 w-3" />
                                Auto
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-zinc-500/30 bg-zinc-500/10 px-1.5 py-0 text-[10px] text-zinc-300">
                                <User className="mr-1 h-3 w-3" />
                                Manual
                              </Badge>
                            )}
                            <Badge variant="outline" className={cn('px-1.5 py-0 text-[10px] font-mono', 'border-white/10 bg-white/[0.02]', confidenceTier)}>
                              {act.confidence}% conf.
                            </Badge>
                            <span className="ml-auto text-[10px] text-white/40">{act.time}</span>
                          </div>
                          <div className="mt-2 text-sm text-white">
                            {act.action}
                          </div>
                          <div className="mt-1 text-[11px] italic leading-relaxed text-white/55">
                            ↳ {act.impact}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.section>

        {/* ═════════════════════ COST SAVINGS CHART ═════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base text-white">
                    <Banknote className="h-4 w-4 text-violet-300" />
                    Monthly Cost Savings by Dimension
                  </CardTitle>
                  <CardDescription className="text-xs text-white/50">
                    AI-driven savings MTD · total {fmt(totalSavingsMTD)} across 6 dimensions
                  </CardDescription>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-white/40">Total</span>
                  <span className="bg-gradient-to-r from-emerald-300 to-violet-300 bg-clip-text font-mono text-2xl font-bold text-transparent">
                    {fmt(totalSavingsMTD)}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Bar chart */}
                <div className="lg:col-span-2">
                  <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-4">
                    <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-wider text-white/40">
                      <span>Savings (USD)</span>
                      <span className="font-mono">Scale: 0 – {fmt(maxSavings)}</span>
                    </div>
                    <div className="flex h-64 items-end justify-between gap-3">
                      {MONTHLY_SAVINGS.map((s, i) => {
                        const a = ACCENT_CLASSES[s.accent];
                        const heightPct = maxSavings > 0 ? (s.amount / maxSavings) * 100 : 0;
                        return (
                          <div key={s.dimension} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                            <div className="text-[10px] font-mono text-white/60">
                              {s.amount > 0 ? fmt(s.amount) : '$0'}
                            </div>
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: `${Math.max(heightPct, 2)}%` }}
                              transition={{ duration: 0.5, delay: 0.1 + i * 0.06, ease: 'easeOut' as const }}
                              className={cn(
                                'w-full max-w-[60px] rounded-t-lg border-t border-x',
                                a.bar, a.border,
                              )}
                              style={{
                                boxShadow: s.amount > 0 ? `0 -8px 30px -10px ${ACCENT_HEX[s.accent]}` : undefined,
                                opacity: s.amount > 0 ? 1 : 0.25,
                              }}
                            />
                            <div className="mt-1 w-full text-center text-[10px] leading-tight text-white/60">
                              {s.dimension.split(' ')[0]}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-3 flex items-start gap-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
                    <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                    <p className="text-xs leading-relaxed text-white/70">
                      <span className="font-medium text-violet-300">Cost dimension dominates:</span>{' '}
                      $624K (74%) of MTD savings came from AI right-sizing 184 over-provisioned RDS
                      instances — zero performance regression observed.
                    </p>
                  </div>
                </div>

                {/* Legend / breakdown list */}
                <div className="space-y-2">
                  {MONTHLY_SAVINGS.map(s => {
                    const a = ACCENT_CLASSES[s.accent];
                    const pct = totalSavingsMTD > 0 ? (s.amount / totalSavingsMTD) * 100 : 0;
                    return (
                      <div
                        key={s.dimension}
                        className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: ACCENT_HEX[s.accent] }}
                            />
                            <span className={cn('text-xs font-medium', a.text)}>
                              {s.dimension}
                            </span>
                          </div>
                          <span className="font-mono text-xs font-semibold text-white">
                            {s.amount > 0 ? fmt(s.amount) : '—'}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                            <div
                              className={cn('h-full rounded-full', a.bar)}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="font-mono text-[10px] text-white/40">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}

                  <div className="mt-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-white/50">MTD Total</span>
                      <span className="font-mono text-base font-bold text-emerald-300">{fmt(totalSavingsMTD)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-white/40">
                      <TrendingDown className="h-3 w-3 text-emerald-300" />
                      Projected annualized: <span className="font-mono text-emerald-300">$10.2M</span>
                    </div>
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
          <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.06] via-emerald-500/[0.03] to-transparent">
            <CardContent className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10">
                  <Sparkles className="h-5 w-5 text-cyan-300" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">
                    Platform Intelligence is self-optimizing around the clock
                  </div>
                  <div className="mt-0.5 text-xs text-white/60">
                    640 autonomous actions / 24h · {fmt(totalSavingsMTD)} saved MTD · 95.2% weighted-avg health · 0.04% override rate
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => setCurrentView('global-financial-cloud')}
                className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
              >
                Back to Hub
                <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        </motion.section>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between text-[10px] text-white/30">
          <span className="font-mono">platform-intelligence · module 15 · phase 16</span>
          <span className="flex items-center gap-1.5">
            <Zap className="h-3 w-3" />
            Status: <span className="text-emerald-400">Optimal</span>
          </span>
        </div>
      </div>
    </div>
  );
}
