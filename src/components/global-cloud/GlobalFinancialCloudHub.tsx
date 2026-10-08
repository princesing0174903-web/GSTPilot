'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 16: GLOBAL FINANCIAL CLOUD™ HUB
//
// The landing dashboard for the entire Phase 16 — Global Financial Cloud™
// ecosystem. Displays hero KPIs and 15 module cards that navigate to each
// sub-module of the open platform & developer ecosystem.
//
// Tagline: One Cloud. Every System. Every Developer. One Platform.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, ArrowUpRight, Cloud, Code2, Network, Store, Plug, Database,
  Radio, Workflow, BarChart3, Fingerprint, Activity, CreditCard, Server,
  ShieldCheck, Share2, BrainCircuit, Sparkles, Search, Zap, Globe2,
  TrendingUp, type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  PHASE16_MODULES, PHASE16_HERO_KPIS, ACCENT_CLASSES, type Accent,
} from '@/lib/global-cloud/data';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

// ─── Icon resolver ─────────────────────────────────────────────────────────────
const ICONS: Record<string, LucideIcon> = {
  'code-2': Code2, 'network': Network, 'store': Store, 'plug': Plug,
  'database': Database, 'radio': Radio, 'workflow': Workflow,
  'bar-chart-3': BarChart3, 'fingerprint': Fingerprint, 'activity': Activity,
  'credit-card': CreditCard, 'server': Server, 'shield-check': ShieldCheck,
  'share-2': Share2, 'brain-circuit': BrainCircuit,
};

// ─── Accent gradient backgrounds ───────────────────────────────────────────────
const ACCENT_GRADIENT: Record<Accent, string> = {
  emerald: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
  teal:    'from-teal-500/15    via-teal-500/5    to-transparent',
  cyan:    'from-cyan-500/15    via-cyan-500/5    to-transparent',
  violet:  'from-violet-500/15  via-violet-500/5  to-transparent',
  amber:   'from-amber-500/15   via-amber-500/5   to-transparent',
  rose:    'from-rose-500/15    via-rose-500/5    to-transparent',
};

const ACCENT_GLOW: Record<Accent, string> = {
  emerald: 'group-hover:shadow-[0_0_40px_-8px_rgba(37,99,235,0.45)]',
  teal:    'group-hover:shadow-[0_0_40px_-8px_rgba(20,184,166,0.45)]',
  cyan:    'group-hover:shadow-[0_0_40px_-8px_rgba(59,130,246,0.45)]',
  violet:  'group-hover:shadow-[0_0_40px_-8px_rgba(139,92,246,0.45)]',
  amber:   'group-hover:shadow-[0_0_40px_-8px_rgba(245,158,11,0.45)]',
  rose:    'group-hover:shadow-[0_0_40px_-8px_rgba(244,63,94,0.45)]',
};

export default function GlobalFinancialCloudHub() {
  const { setCurrentView } = useApp();
  const [query, setQuery] = useState('');
  const [hoveredModule, setHoveredModule] = useState<number | null>(null);

  // ─── Filter modules by search ──────────────────────────────────────────────
  const filteredModules = useMemo(() => {
    if (!query.trim()) return PHASE16_MODULES;
    const q = query.toLowerCase();
    return PHASE16_MODULES.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.tagline.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      String(m.number).padStart(2, '0').includes(q)
    );
  }, [query]);

  const handleOpen = (id: string) => {
    setCurrentView(id as never);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

        {/* ─── HERO ─────────────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8 lg:p-10"
        >
          {/* Gradient backdrop */}
          <div className="pointer-events-none absolute inset-0 -z-0">
            <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl" />
            <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
          </div>

          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                <Cloud className="mr-1.5 h-3 w-3" />
                Phase 16
              </Badge>
              <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                <Globe2 className="mr-1.5 h-3 w-3" />
                10 Regions · 142 Edge POPs
              </Badge>
              <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                <Zap className="mr-1.5 h-3 w-3" />
                99.992% Uptime
              </Badge>
            </div>

            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Global Financial Cloud
              <span className="ml-2 bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">™</span>
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/60 sm:text-base">
              The world&apos;s largest open financial cloud platform — connecting every bank, ERP,
              accountant, government system and enterprise through 540+ APIs, 4,820 apps,
              23 native integrations, and a real-time event mesh serving 2.4M developers.
            </p>

            {/* Hero KPIs */}
            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {PHASE16_HERO_KPIS.map((kpi, i) => {
                const a = ACCENT_CLASSES[kpi.accent];
                return (
                  <motion.div
                    key={kpi.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 + i * 0.04 }}
                    className={cn(
                      'rounded-2xl border p-3 sm:p-4',
                      a.border, a.bg,
                    )}
                  >
                    <div className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                      {kpi.label}
                    </div>
                    <div className={cn('mt-1 text-xl font-bold sm:text-2xl', a.text)}>
                      {kpi.value}
                    </div>
                    <div className="mt-0.5 text-[10px] text-white/40">{kpi.sub}</div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* ─── SEARCH + MODULE COUNT ─────────────────────────────────────── */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              The 15 Pillars of the Open Platform
            </h2>
            <p className="text-xs text-white/50">
              Click any module to enter its dedicated console.
            </p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search modules, APIs, integrations…"
              className="border-white/10 bg-white/[0.02] pl-9 text-sm text-white placeholder:text-white/40 focus:border-emerald-500/40"
            />
          </div>
        </div>

        {/* ─── MODULE GRID ───────────────────────────────────────────────── */}
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filteredModules.map((m, idx) => {
              const Icon = ICONS[m.icon] ?? Cloud;
              const a = ACCENT_CLASSES[m.accent];
              const grad = ACCENT_GRADIENT[m.accent];
              const glow = ACCENT_GLOW[m.accent];
              return (
                <motion.button
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.3, delay: Math.min(idx * 0.025, 0.3) }}
                  onClick={() => handleOpen(m.id)}
                  onMouseEnter={() => setHoveredModule(m.number)}
                  onMouseLeave={() => setHoveredModule(null)}
                  className={cn(
                    'group relative overflow-hidden rounded-2xl border bg-white/[0.02] p-5 text-left',
                    'border-white/[0.06] transition-all duration-300 hover:-translate-y-1',
                    'hover:border-white/[0.12]',
                    a.border.replace('border-', 'hover:border-'),
                    glow,
                  )}
                >
                  {/* Gradient wash */}
                  <div className={cn('pointer-events-none absolute inset-0 -z-0 bg-gradient-to-br', grad)} />

                  <div className="relative z-10">
                    {/* Header row */}
                    <div className="flex items-start justify-between">
                      <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl border', a.border, a.bg)}>
                        <Icon className={cn('h-5 w-5', a.text)} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-medium text-white/40">
                          {String(m.number).padStart(2, '0')}
                        </span>
                        <ArrowUpRight className={cn(
                          'h-4 w-4 transition-all',
                          hoveredModule === m.number ? `${a.text} translate-x-0.5 -translate-y-0.5` : 'text-white/30',
                        )} />
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="mt-4 text-base font-semibold text-white">
                      {m.name}
                    </h3>
                    <p className={cn('mt-0.5 text-[11px] font-medium leading-tight', a.text)}>
                      {m.tagline}
                    </p>

                    {/* Description */}
                    <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-white/55">
                      {m.description}
                    </p>

                    {/* Stats */}
                    <Separator className="my-4 bg-white/[0.06]" />
                    <div className="grid grid-cols-3 gap-2">
                      {m.stats.map((s) => (
                        <div key={s.label}>
                          <div className={cn('text-sm font-bold', a.text)}>{s.value}</div>
                          <div className="text-[9px] uppercase tracking-wide text-white/40">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        {/* ─── FOOTER CTA ───────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-8 overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-r from-emerald-500/[0.08] via-teal-500/[0.05] to-cyan-500/[0.08] p-6 sm:p-8"
        >
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30">
                <Sparkles className="h-5 w-5 text-emerald-300" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  Build on the Global Financial Cloud™
                </h3>
                <p className="mt-0.5 text-xs text-white/55">
                  Get a free API key, 1M calls/mo sandbox, and 8 SDKs to start building in under 5 minutes.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => handleOpen('developer-platform')}
                className="bg-emerald-500 text-black hover:bg-emerald-400"
                size="sm"
              >
                <Code2 className="mr-1.5 h-4 w-4" />
                Developer Platform
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
              <Button
                onClick={() => handleOpen('app-marketplace-cloud')}
                variant="outline"
                size="sm"
                className="border-white/15 bg-white/[0.02] text-white hover:bg-white/[0.06]"
              >
                <Store className="mr-1.5 h-4 w-4" />
                App Marketplace
              </Button>
            </div>
          </div>
        </motion.div>

        {/* ─── TAGLINE ──────────────────────────────────────────────────── */}
        <div className="mt-6 flex items-center justify-center gap-2 text-center">
          <TrendingUp className="h-3.5 w-3.5 text-white/30" />
          <p className="text-[11px] text-white/40">
            One Cloud. Every System. Every Developer. One Platform. — VEYRO™
          </p>
        </div>
      </div>
    </div>
  );
}
