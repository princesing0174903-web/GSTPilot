'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 16 · MODULE 03
// APP MARKETPLACE CLOUD™ — 4,820 Apps · 6.6M Installs · 1,240 Publishers ·
//                            $4.82B Marketplace GMV
//
// A full marketplace console: category-filterable app grid, featured row,
// top-publisher leaderboard, and an installs-per-category bar chart.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ChevronRight, Store, Download, Star, Users, DollarSign,
  Package, Sparkles, TrendingUp, Award, Crown, Medal, BadgeCheck,
  Search, SlidersHorizontal, ArrowUpRight, type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  MARKETPLACE_APPS, MARKETPLACE_CATEGORIES, TOP_PUBLISHERS,
  ACCENT_CLASSES, fmt, fmtN, type Accent,
} from '@/lib/global-cloud/data';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

// ─── Map singular app.category → plural MARKETPLACE_CATEGORIES.name ───────────
const SINGULAR_TO_PLURAL: Record<string, string> = {
  'App':                'Apps',
  'Extension':          'Extensions',
  'Plugin':             'Plugins',
  'AI Skill':           'AI Skills',
  'ERP Connector':      'ERP Connectors',
  'Industry Template':  'Industry Templates',
  'Automation Pack':    'Automation Packs',
};

// ─── Publisher tier badge config ──────────────────────────────────────────────
const TIER_CONFIG: Record<string, { className: string; icon: LucideIcon }> = {
  Platinum: { className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', icon: Crown },
  Gold:     { className: 'border-amber-500/30   bg-amber-500/10   text-amber-300',   icon: Award },
  Silver:   { className: 'border-zinc-400/30    bg-zinc-400/10    text-zinc-200',    icon: Medal },
  Verified: { className: 'border-cyan-500/30    bg-cyan-500/10    text-cyan-300',    icon: BadgeCheck },
};

// ─── KPI tiles ─────────────────────────────────────────────────────────────────
const KPIS: { label: string; value: string; sub: string; accent: Accent; icon: LucideIcon }[] = [
  { label: 'Apps Published',  value: '4,820',  sub: 'From 1,240 publishers',  accent: 'cyan',    icon: Store },
  { label: 'Total Installs',  value: '6.6M',   sub: '184K enterprises',       accent: 'emerald', icon: Download },
  { label: 'Publishers',      value: '1,240',  sub: 'Across 38 countries',    accent: 'teal',    icon: Users },
  { label: 'Marketplace GMV', value: '$4.82B', sub: '+22.8% YoY',             accent: 'violet',  icon: DollarSign },
];

// ─── Inline star rating ───────────────────────────────────────────────────────
function StarRow({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const sz = size === 'md' ? 'h-4 w-4' : 'h-3 w-3';
  return (
    <span className="inline-flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map(i => (
        <Star
          key={i}
          className={cn(
            sz,
            i < Math.round(rating)
              ? 'fill-amber-400 text-amber-400'
              : 'text-white/20',
          )}
        />
      ))}
      <span className={cn('ml-1 font-medium text-white/70', size === 'md' ? 'text-sm' : 'text-[11px]')}>
        {rating.toFixed(1)}
      </span>
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function AppMarketplaceCloud() {
  const { setCurrentView } = useApp();
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [query, setQuery] = useState('');

  const back = () => setCurrentView('global-financial-cloud');

  // ─── Derived data ──────────────────────────────────────────────────────────
  const featuredApps = useMemo(
    () => MARKETPLACE_APPS.filter(a => a.featured),
    [],
  );

  const filteredApps = useMemo(() => {
    let list = MARKETPLACE_APPS;
    if (activeCategory !== 'All') {
      list = list.filter(a => SINGULAR_TO_PLURAL[a.category] === activeCategory);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.publisher.toLowerCase().includes(q) ||
        a.tagline.toLowerCase().includes(q),
      );
    }
    return list;
  }, [activeCategory, query]);

  const maxCategoryInstalls = useMemo(
    () => Math.max(...MARKETPLACE_CATEGORIES.map(c => c.installs)),
    [],
  );
  const totalCategoryInstalls = useMemo(
    () => MARKETPLACE_CATEGORIES.reduce((s, c) => s + c.installs, 0),
    [],
  );

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
            <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
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
                <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                  <Store className="mr-1 h-3 w-3" /> Module 03
                </Badge>
                <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                  <TrendingUp className="mr-1 h-3 w-3" /> +22.8% YoY
                </Badge>
                <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                  <Award className="mr-1 h-3 w-3" /> 38 countries
                </Badge>
              </div>
            </div>

            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              App Marketplace Cloud
              <span className="ml-2 bg-gradient-to-r from-cyan-300 via-emerald-300 to-teal-300 bg-clip-text text-transparent">™</span>
            </h1>
            <p className="mt-2 max-w-4xl text-sm leading-relaxed text-white/55 sm:text-base">
              4,820 Apps · 6.6M Installs · 1,240 Publishers · $4.82B Marketplace GMV
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

        {/* ─── FEATURED APPS ROW ────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="mt-6"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-300" />
              <h2 className="text-base font-semibold text-white">Featured Apps</h2>
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">
                {featuredApps.length} curated
              </Badge>
            </div>
            <span className="text-xs text-white/40">Scroll horizontally to explore →</span>
          </div>

          <ScrollArea className="w-full pb-3">
            <div className="flex gap-4 px-1" style={{ width: 'max-content' }}>
              {featuredApps.map((app, i) => {
                const a = ACCENT_CLASSES[app.accent];
                return (
                  <motion.div
                    key={app.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.04 }}
                    className="w-[20rem] shrink-0"
                  >
                    <Card
                      className={cn(
                        'group border-white/[0.06] bg-white/[0.02] transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.12]',
                        a.glow,
                      )}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'flex h-12 w-12 items-center justify-center rounded-xl border',
                              a.border, a.bg,
                            )}>
                              <Package className={cn('h-6 w-6', a.text)} />
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-white">{app.name}</div>
                              <div className="text-[11px] text-white/50">{app.publisher}</div>
                            </div>
                          </div>
                          <Badge variant="outline" className={cn('shrink-0', a.border, a.bg, a.text)}>
                            {app.category}
                          </Badge>
                        </div>

                        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-white/55">
                          {app.tagline}
                        </p>

                        <Separator className="my-3 bg-white/[0.06]" />

                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <div className="text-[9px] uppercase tracking-wider text-white/40">Installs</div>
                            <div className="mt-0.5 font-mono text-sm font-semibold text-white">{fmtN(app.installs)}</div>
                          </div>
                          <div>
                            <div className="text-[9px] uppercase tracking-wider text-white/40">Rating</div>
                            <div className="mt-0.5 flex justify-center">
                              <StarRow rating={app.rating} />
                            </div>
                          </div>
                          <div>
                            <div className="text-[9px] uppercase tracking-wider text-white/40">Price</div>
                            <div className={cn('mt-0.5 text-sm font-semibold', app.price === 'Free' ? 'text-emerald-300' : 'text-white')}>
                              {app.price}
                            </div>
                          </div>
                        </div>

                        <Button
                          className={cn(
                            'mt-4 w-full border',
                            a.border, a.bg, a.text, 'hover:brightness-110',
                          )}
                          variant="outline"
                        >
                          <Download className="mr-1.5 h-3.5 w-3.5" />
                          Install
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </ScrollArea>
        </motion.section>

        {/* ─── CATEGORY FILTER + SEARCH ────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="mt-8"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-cyan-300" />
              <h2 className="text-base font-semibold text-white">All Apps</h2>
              <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                {filteredApps.length} shown
              </Badge>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search apps, publishers, tags…"
                className="border-white/10 bg-white/[0.02] pl-9 text-sm text-white placeholder:text-white/40 focus:border-cyan-500/40"
              />
            </div>
          </div>

          {/* Category chips */}
          <div className="mb-5 flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCategory('All')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                activeCategory === 'All'
                  ? 'border-white/20 bg-white/[0.06] text-white'
                  : 'border-white/[0.08] bg-white/[0.02] text-white/55 hover:border-white/[0.14] hover:text-white',
              )}
            >
              <Package className="h-3 w-3" />
              All
              <span className="rounded bg-black/40 px-1 py-0.5 text-[9px] text-white/50">{MARKETPLACE_APPS.length}</span>
            </button>
            {MARKETPLACE_CATEGORIES.map(c => {
              const a = ACCENT_CLASSES[c.accent];
              const active = activeCategory === c.name;
              return (
                <button
                  key={c.name}
                  onClick={() => setActiveCategory(active ? 'All' : c.name)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                    active
                      ? cn(a.border, a.bg, a.text)
                      : 'border-white/[0.08] bg-white/[0.02] text-white/55 hover:border-white/[0.14] hover:text-white',
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', a.bar)} />
                  {c.name}
                  <span className="rounded bg-black/40 px-1 py-0.5 text-[9px] text-white/50">{c.count}</span>
                </button>
              );
            })}
          </div>

          {/* Apps grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredApps.map((app, i) => {
              const a = ACCENT_CLASSES[app.accent];
              return (
                <motion.div
                  key={app.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.2) }}
                >
                  <Card
                    className={cn(
                      'group h-full border-white/[0.06] bg-white/[0.02] transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.12]',
                      a.glow,
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-lg border',
                            a.border, a.bg,
                          )}>
                            <Package className={cn('h-5 w-5', a.text)} />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white">{app.name}</div>
                            <div className="truncate text-[10px] text-white/50">{app.publisher}</div>
                          </div>
                        </div>
                        {app.featured && (
                          <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                        )}
                      </div>

                      <div className="mt-2.5">
                        <Badge variant="outline" className={cn('text-[9px]', a.border, a.bg, a.text)}>
                          {app.category}
                        </Badge>
                      </div>

                      <p className="mt-2.5 line-clamp-2 text-[11px] leading-relaxed text-white/55">
                        {app.tagline}
                      </p>

                      <Separator className="my-3 bg-white/[0.06]" />

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="inline-flex items-center gap-1 text-white/60">
                          <Download className="h-3 w-3" />
                          {fmtN(app.installs)}
                        </span>
                        <StarRow rating={app.rating} />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-[10px] text-white/40">{app.reviews.toLocaleString()} reviews</span>
                        <span className={cn('text-xs font-semibold', app.price === 'Free' ? 'text-emerald-300' : 'text-white')}>
                          {app.price}
                        </span>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className={cn(
                          'mt-3 w-full border text-xs',
                          a.border, a.bg, a.text, 'hover:brightness-110',
                        )}
                      >
                        <Download className="mr-1 h-3 w-3" />
                        Install
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {filteredApps.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] p-8 text-center text-sm text-white/50">
              No apps match your filters.
            </div>
          )}
        </motion.section>

        {/* ─── TOP PUBLISHERS LEADERBOARD ──────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          className="mt-8"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-violet-300" />
              <h2 className="text-base font-semibold text-white">Top Publishers</h2>
              <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                {TOP_PUBLISHERS.length} ranked
              </Badge>
            </div>
            <span className="text-xs text-white/40">By revenue contribution</span>
          </div>

          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-0">
              <ScrollArea className="max-h-[24rem]">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-black/80 backdrop-blur">
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead className="w-12 text-xs uppercase tracking-wider text-white/50">#</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-white/50">Publisher</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider text-white/50">Apps</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider text-white/50">Installs</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider text-white/50">Revenue</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-white/50">Tier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {TOP_PUBLISHERS.map((pub, i) => {
                      const tier = TIER_CONFIG[pub.tier];
                      const TierIcon = tier.icon;
                      return (
                        <TableRow key={pub.name} className="border-white/[0.04] hover:bg-white/[0.02]">
                          <TableCell>
                            <span className={cn(
                              'flex h-7 w-7 items-center justify-center rounded-md border text-[10px] font-bold',
                              i === 0
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                : i === 1
                                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                                  : i === 2
                                    ? 'border-zinc-400/30 bg-zinc-400/10 text-zinc-200'
                                    : 'border-white/[0.08] bg-white/[0.02] text-white/50',
                            )}>
                              {String(i + 1).padStart(2, '0')}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.02]">
                                <TierIcon className="h-3.5 w-3.5 text-white/60" />
                              </div>
                              <span className="text-xs font-medium text-white">{pub.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-white/70">{pub.apps}</TableCell>
                          <TableCell className="text-right font-mono text-xs text-white/70">{fmtN(pub.installs)}</TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold text-emerald-300">{fmt(pub.revenue)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('inline-flex items-center gap-1', tier.className)}>
                              <TierIcon className="h-3 w-3" />
                              {pub.tier}
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

        {/* ─── CATEGORY BREAKDOWN ──────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.3 }}
          className="mt-8"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-300" />
              <h2 className="text-base font-semibold text-white">Installs by Category</h2>
              <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                {fmtN(totalCategoryInstalls)} total installs
              </Badge>
            </div>
            <span className="text-xs text-white/40">Bar width proportional to installs</span>
          </div>

          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-3">
                {[...MARKETPLACE_CATEGORIES]
                  .sort((a, b) => b.installs - a.installs)
                  .map((c, i) => {
                    const a = ACCENT_CLASSES[c.accent];
                    const widthPct = (c.installs / maxCategoryInstalls) * 100;
                    const sharePct = (c.installs / totalCategoryInstalls) * 100;
                    return (
                      <div key={c.name} className="grid grid-cols-[140px_1fr_110px] items-center gap-3 sm:grid-cols-[200px_1fr_140px]">
                        <div className="flex items-center gap-2 truncate">
                          <span className={cn('h-2.5 w-2.5 rounded-sm', a.bar)} />
                          <span className="truncate text-xs font-medium text-white/80">{c.name}</span>
                        </div>
                        <div className="relative h-7 overflow-hidden rounded-md border border-white/[0.06] bg-black/40">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${widthPct}%` }}
                            transition={{ duration: 0.6, delay: 0.05 + i * 0.03, ease: 'easeOut' }}
                            className={cn('flex h-full items-center justify-end rounded-md px-2', a.bar)}
                          >
                            {widthPct > 15 && (
                              <span className="font-mono text-[10px] font-semibold text-black/80">
                                {fmtN(c.installs)}
                              </span>
                            )}
                          </motion.div>
                        </div>
                        <div className="text-right text-xs">
                          <span className="font-mono text-white/60">{sharePct.toFixed(1)}%</span>
                          <span className="ml-2 text-white/30">{c.count} apps</span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <Separator className="my-4 bg-white/[0.06]" />
              <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/40">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-300" />
                  <span>Top category drives <span className="text-white/70">{((MARKETPLACE_CATEGORIES[0].installs / totalCategoryInstalls) * 100).toFixed(1)}%</span> of installs</span>
                </div>
                <div className="font-mono">
                  Avg installs / app: <span className="text-emerald-300">{fmtN(totalCategoryInstalls / MARKETPLACE_CATEGORIES.reduce((s, c) => s + c.count, 0))}</span>
                </div>
              </div>
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
            <Store className="h-3.5 w-3.5 text-cyan-300" />
            <span>Marketplace commission: <span className="font-mono text-white/70">15%</span> · Payout cycle: <span className="font-mono text-white/70">Net-30</span></span>
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
