'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 16 · MODULE 04
// GLOBAL INTEGRATION HUB™ — 23 Native Integrations · 20 Connected ·
//                              3.4M Records Synced
//
// Centralized control plane for every native VEYRO integration: ERP, CRM,
// Payments, Banking, Communication, Productivity, Government and Commerce.
// Includes category filtering, per-integration cards with sync telemetry, a
// connection-status breakdown and a live sync-activity timeline.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ChevronRight, Plug, ArrowRightLeft, ArrowDownToLine,
  ArrowUpFromLine, RefreshCw, CheckCircle2, Clock, Database, Activity,
  Link2, Link2Off, Zap, Server, Boxes, Users, CreditCard, Landmark,
  MessageSquare, Briefcase, Building2, ShoppingCart, type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  INTEGRATIONS, ACCENT_CLASSES, fmtN, type Accent,
} from '@/lib/global-cloud/data';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

// ─── Category icon & filter metadata ──────────────────────────────────────────
type Category = 'All' | 'ERP' | 'CRM' | 'Payments' | 'Banking' | 'Communication' | 'Productivity' | 'Government' | 'Commerce';

const CATEGORY_META: Record<Category, { icon: LucideIcon; accent: Accent }> = {
  All:           { icon: Plug,           accent: 'violet'  },
  ERP:           { icon: Boxes,          accent: 'emerald' },
  CRM:           { icon: Users,          accent: 'teal'    },
  Payments:      { icon: CreditCard,     accent: 'cyan'    },
  Banking:       { icon: Landmark,       accent: 'amber'   },
  Communication: { icon: MessageSquare,  accent: 'rose'    },
  Productivity:  { icon: Briefcase,      accent: 'violet'  },
  Government:    { icon: Building2,      accent: 'emerald' },
  Commerce:      { icon: ShoppingCart,   accent: 'teal'    },
};

// ─── Status badge config ──────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  connected:    { label: 'Connected',    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
  available:    { label: 'Available',    className: 'border-zinc-400/30    bg-zinc-400/10    text-zinc-200'    },
  'coming-soon':{ label: 'Coming Soon',  className: 'border-amber-500/30   bg-amber-500/10   text-amber-300'   },
};

// ─── Sync direction icon + label ──────────────────────────────────────────────
const SYNC_CONFIG: Record<string, { icon: LucideIcon; className: string; label: string }> = {
  'Two-way':  { icon: ArrowRightLeft, className: 'text-cyan-300',    label: 'Two-way'  },
  'Inbound':  { icon: ArrowDownToLine,className: 'text-emerald-300', label: 'Inbound'  },
  'Outbound': { icon: ArrowUpFromLine,className: 'text-violet-300',  label: 'Outbound' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function GlobalIntegrationHub() {
  const { setCurrentView } = useApp();
  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [toggling, setToggling] = useState<string | null>(null);

  const back = () => setCurrentView('global-financial-cloud');

  // ─── Derived metrics ───────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const total     = INTEGRATIONS.length;
    const connected = INTEGRATIONS.filter(i => i.status === 'connected').length;
    const available = INTEGRATIONS.filter(i => i.status === 'available').length;
    const coming    = INTEGRATIONS.filter(i => i.status === 'coming-soon').length;
    const records   = INTEGRATIONS.reduce((s, i) => s + i.records, 0);
    const categories = new Set(INTEGRATIONS.map(i => i.category)).size;
    return { total, connected, available, coming, records, categories };
  }, []);

  const filteredIntegrations = useMemo(() => {
    if (activeCategory === 'All') return INTEGRATIONS;
    return INTEGRATIONS.filter(i => i.category === activeCategory);
  }, [activeCategory]);

  // ─── Synthesized sync activity feed (last 8 events) ────────────────────────
  const syncEvents = useMemo(() => {
    // Pick connected integrations and synthesize an event per record count
    const connected = INTEGRATIONS.filter(i => i.status === 'connected' && i.records > 0);
    // Stable sort: by lastSync "freshness" — use record count as a deterministic proxy
    // (the spec says "no Date.now" — so we use the static `lastSync` strings + records as ordering keys)
    return connected
      .map((i, idx) => {
        // Deterministic "records synced in last event" = top quarter of total records
        const lastBatch = Math.max(100, Math.round(i.records / (idx + 6)));
        return {
          name: i.name,
          category: i.category,
          accent: i.accent,
          lastSync: i.lastSync,
          lastBatch,
          sync: i.sync,
        };
      })
      .slice(0, 8);
  }, []);

  // ─── KPI tiles ─────────────────────────────────────────────────────────────
  const KPIS = [
    { label: 'Native Integrations', value: String(totals.total),    sub: 'Across every domain',         accent: 'violet' as Accent, icon: Plug },
    { label: 'Connected',           value: String(totals.connected),sub: `${totals.available} available · ${totals.coming} coming`, accent: 'emerald' as Accent, icon: Link2 },
    { label: 'Categories',          value: String(totals.categories),sub: 'ERP · CRM · Payments · …',     accent: 'cyan' as Accent,    icon: Boxes },
    { label: 'Records Synced',      value: fmtN(totals.records),    sub: 'Rolling 24h window',           accent: 'teal' as Accent,    icon: Database },
  ];

  const handleToggle = (name: string) => {
    setToggling(name);
    setTimeout(() => setToggling(null), 1200);
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
            <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />
            <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl" />
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
                <Badge variant="outline" className="border-violet-500/30 bg-violet-500/10 text-violet-300">
                  <Plug className="mr-1 h-3 w-3" /> Module 04
                </Badge>
                <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> {totals.connected} live
                </Badge>
                <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                  <Zap className="mr-1 h-3 w-3" /> Realtime sync
                </Badge>
              </div>
            </div>

            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              Global Integration Hub
              <span className="ml-2 bg-gradient-to-r from-violet-300 via-emerald-300 to-teal-300 bg-clip-text text-transparent">™</span>
            </h1>
            <p className="mt-2 max-w-4xl text-sm leading-relaxed text-white/55 sm:text-base">
              23 Native Integrations · {totals.connected} Connected · {fmtN(totals.records)} Records Synced
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

        {/* ─── CONNECTION STATUS BREAKDOWN (DONUT REPLACEMENT) ───────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="mt-6"
        >
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-300" />
            <h2 className="text-base font-semibold text-white">Connection Status</h2>
            <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
              {totals.total} total
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              {
                label: 'Connected',
                value: totals.connected,
                total: totals.total,
                accent: 'emerald' as Accent,
                icon: CheckCircle2,
                desc: 'Live, two-way sync active',
              },
              {
                label: 'Available',
                value: totals.available,
                total: totals.total,
                accent: 'cyan' as Accent,
                icon: Link2,
                desc: 'Ready to connect on-demand',
              },
              {
                label: 'Coming Soon',
                value: totals.coming,
                total: totals.total,
                accent: 'amber' as Accent,
                icon: Clock,
                desc: 'In active development',
              },
            ].map((s, i) => {
              const a = ACCENT_CLASSES[s.accent];
              const Icon = s.icon;
              const pct = (s.value / s.total) * 100;
              return (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  <Card className={cn('border-white/[0.06] bg-white/[0.02]', a.border)}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-[10px] font-medium uppercase tracking-wider text-white/50">{s.label}</div>
                          <div className="mt-1 flex items-baseline gap-2">
                            <span className={cn('text-4xl font-bold', a.text)}>{s.value}</span>
                            <span className="text-sm text-white/40">/ {s.total}</span>
                          </div>
                        </div>
                        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl border', a.border, a.bg)}>
                          <Icon className={cn('h-5 w-5', a.text)} />
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] text-white/45">{s.desc}</p>
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="uppercase tracking-wider text-white/40">Share</span>
                          <span className={cn('font-mono font-semibold', a.text)}>{pct.toFixed(1)}%</span>
                        </div>
                        <Progress value={pct} className="mt-1.5 h-1.5 bg-white/[0.06]" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ─── CATEGORY FILTER TABS ─────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="mt-8"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-violet-300" />
              <h2 className="text-base font-semibold text-white">Native Integrations</h2>
              <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                {filteredIntegrations.length} shown
              </Badge>
            </div>
            <span className="text-xs text-white/40">Click a category to filter</span>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_META) as Category[]).map(cat => {
              const meta = CATEGORY_META[cat];
              const a = ACCENT_CLASSES[meta.accent];
              const count = cat === 'All'
                ? INTEGRATIONS.length
                : INTEGRATIONS.filter(i => i.category === cat).length;
              const active = activeCategory === cat;
              const Icon = meta.icon;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                    active
                      ? cn(a.border, a.bg, a.text)
                      : 'border-white/[0.08] bg-white/[0.02] text-white/55 hover:border-white/[0.14] hover:text-white',
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {cat}
                  <span className="rounded bg-black/40 px-1 py-0.5 text-[9px] text-white/50">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Integration cards grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredIntegrations.map((int, i) => {
              const a = ACCENT_CLASSES[int.accent];
              const status = STATUS_CONFIG[int.status];
              const sync = SYNC_CONFIG[int.sync];
              const SyncIcon = sync.icon;
              const catMeta = CATEGORY_META[int.category as Category];
              const CatIcon = catMeta?.icon ?? Plug;
              const isConnected = int.status === 'connected';
              return (
                <motion.div
                  key={int.name}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(i * 0.025, 0.25) }}
                >
                  <Card
                    className={cn(
                      'group border-white/[0.06] bg-white/[0.02] transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.12]',
                      a.glow,
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-xl border',
                            a.border, a.bg,
                          )}>
                            <CatIcon className={cn('h-5 w-5', a.text)} />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white">{int.name}</div>
                            <div className="mt-0.5">
                              <Badge variant="outline" className={cn('text-[9px]', a.border, a.bg, a.text)}>
                                {int.category}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className={status.className}>{status.label}</Badge>
                      </div>

                      {/* Sync direction + last sync */}
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-white/[0.06] bg-black/30 p-2">
                          <div className="text-[9px] uppercase tracking-wider text-white/40">Sync</div>
                          <div className={cn('mt-0.5 flex items-center gap-1 text-xs font-medium', sync.className)}>
                            <SyncIcon className="h-3 w-3" />
                            {sync.label}
                          </div>
                        </div>
                        <div className="rounded-lg border border-white/[0.06] bg-black/30 p-2">
                          <div className="text-[9px] uppercase tracking-wider text-white/40">Last sync</div>
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-white/70">
                            <Clock className="h-3 w-3 text-white/40" />
                            {int.lastSync}
                          </div>
                        </div>
                      </div>

                      {/* Records synced */}
                      <div className="mt-2 flex items-center justify-between rounded-lg border border-white/[0.06] bg-black/30 p-2">
                        <div className="flex items-center gap-1.5 text-[11px] text-white/50">
                          <Database className="h-3 w-3" />
                          Records synced
                        </div>
                        <span className="font-mono text-xs font-semibold text-white">{fmtN(int.records)}</span>
                      </div>

                      {/* Connect / Disconnect button */}
                      <Button
                        onClick={() => handleToggle(int.name)}
                        disabled={toggling === int.name || int.status === 'coming-soon'}
                        className={cn(
                          'mt-3 w-full text-xs',
                          isConnected
                            ? 'border border-rose-500/30 bg-rose-500/[0.06] text-rose-300 hover:bg-rose-500/15 hover:text-rose-200'
                            : int.status === 'available'
                              ? 'border border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300 hover:bg-emerald-500/15 hover:text-emerald-200'
                              : 'border border-white/[0.08] bg-white/[0.02] text-white/40',
                        )}
                        variant="outline"
                      >
                        {toggling === int.name ? (
                          <>
                            <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" />
                            {isConnected ? 'Disconnecting…' : 'Connecting…'}
                          </>
                        ) : isConnected ? (
                          <>
                            <Link2Off className="mr-1.5 h-3 w-3" />
                            Disconnect
                          </>
                        ) : int.status === 'available' ? (
                          <>
                            <Link2 className="mr-1.5 h-3 w-3" />
                            Connect
                          </>
                        ) : (
                          <>
                            <Clock className="mr-1.5 h-3 w-3" />
                            Notify Me
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {filteredIntegrations.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] p-8 text-center text-sm text-white/50">
              No integrations in this category.
            </div>
          )}
        </motion.section>

        {/* ─── SYNC ACTIVITY FEED ──────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.25 }}
          className="mt-8"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-cyan-300" />
              <h2 className="text-base font-semibold text-white">Sync Activity</h2>
              <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                Last {syncEvents.length} events
              </Badge>
            </div>
            <span className="text-xs text-white/40">Live tail · auto-refreshing</span>
          </div>

          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-0">
              <ScrollArea className="max-h-[26rem]">
                <div className="divide-y divide-white/[0.04]">
                  {syncEvents.map((ev, i) => {
                    const a = ACCENT_CLASSES[ev.accent];
                    const SyncIcon = SYNC_CONFIG[ev.sync].icon;
                    return (
                      <motion.div
                        key={`${ev.name}-${i}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: i * 0.03 }}
                        className="flex items-center gap-3 p-4 transition-colors hover:bg-white/[0.02]"
                      >
                        {/* Timeline dot + line */}
                        <div className="relative flex flex-col items-center">
                          <span className={cn('flex h-8 w-8 items-center justify-center rounded-full border', a.border, a.bg)}>
                            <SyncIcon className={cn('h-3.5 w-3.5', a.text)} />
                          </span>
                          {i < syncEvents.length - 1 && (
                            <span className="mt-1 h-6 w-px bg-white/[0.06]" />
                          )}
                        </div>

                        {/* Event body */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">{ev.name}</span>
                            <Badge variant="outline" className={cn('text-[9px]', a.border, a.bg, a.text)}>
                              {ev.category}
                            </Badge>
                          </div>
                          <div className="mt-0.5 text-[11px] text-white/55">
                            Synced <span className={cn('font-mono font-semibold', a.text)}>{fmtN(ev.lastBatch)}</span> records · {ev.sync} sync
                          </div>
                        </div>

                        {/* Timestamp */}
                        <div className="shrink-0 text-right">
                          <div className="flex items-center justify-end gap-1 text-[11px] text-white/50">
                            <Clock className="h-3 w-3" />
                            {ev.lastSync}
                          </div>
                          <div className="mt-0.5 text-[9px] uppercase tracking-wider text-white/30">Event #{String(syncEvents.length - i).padStart(3, '0')}</div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── FOOTER ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
        >
          <div className="flex items-center gap-2 text-xs text-white/50">
            <Server className="h-3.5 w-3.5 text-violet-300" />
            <span>Integration runtime <span className="font-mono text-white/70">v4.12.0</span></span>
            <Separator orientation="vertical" className="mx-1 h-3 bg-white/10" />
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
            <span>All connections healthy · 99.97% sync success</span>
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
