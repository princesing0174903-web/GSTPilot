'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 16: ENTERPRISE BILLING PLATFORM
//
// Subscriptions · Usage · Marketplace · Partner · API · Developer · Enterprise Contracts
//
// Single source of truth for every dollar flowing through the Global Financial
// Cloud™ — subscription tiers, usage-based metering, marketplace revenue share,
// and Fortune-500 enterprise contracts.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, CreditCard, TrendingUp, TrendingDown, DollarSign, Building2,
  Store, Layers, Activity, Sparkles, Crown, Check, AlertTriangle,
  ShieldCheck, Users,
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
  SUBSCRIPTION_PLANS, USAGE_BILLABLES, MARKETPLACE_REVENUE, ENTERPRISE_CONTRACTS,
  ACCENT_CLASSES, fmt, fmtN, fmtPct, type Accent,
} from '@/lib/global-cloud/data';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

// ─── Header KPI tiles ──────────────────────────────────────────────────────────
const HEADER_KPIS = [
  { label: 'MRR',              value: '$24.6M', sub: '+12.4% MoM', accent: 'emerald' as Accent, icon: DollarSign },
  { label: 'ARR',              value: '$295M',  sub: '+18.2% YoY', accent: 'teal'    as Accent, icon: TrendingUp },
  { label: 'Customers',        value: '349K',   sub: '+8.4K new',  accent: 'cyan'    as Accent, icon: Users },
  { label: 'Avg Churn',        value: '1.8%',   sub: '-0.3% MoM',  accent: 'violet'  as Accent, icon: TrendingDown },
];

// ─── Enterprise contract status badge mapping ─────────────────────────────────
const CONTRACT_STATUS: Record<string, { accent: Accent; label: string }> = {
  active:    { accent: 'emerald', label: 'Active'    },
  renewing:  { accent: 'amber',   label: 'Renewing'  },
  expiring:  { accent: 'rose',    label: 'Expiring'  },
};

// ─── Revenue mix breakdown (deterministic percentages summing to 100%) ────────
const REVENUE_MIX = [
  { label: 'Subscriptions',       pct: 62, accent: 'emerald' as Accent, hex: '#2563EB' },
  { label: 'Usage-based',         pct: 18, accent: 'teal'    as Accent, hex: '#3B82F6' },
  { label: 'Marketplace',         pct: 12, accent: 'cyan'    as Accent, hex: '#3B82F6' },
  { label: 'Enterprise Contracts', pct:  8, accent: 'violet'  as Accent, hex: '#8b5cf6' },
];

export default function EnterpriseBilling() {
  const { setCurrentView } = useApp();

  // ─── Compute max MRR for relative bar sizing ────────────────────────────────
  const maxMrr = useMemo(
    () => Math.max(...SUBSCRIPTION_PLANS.map((p) => p.mrr)),
    [],
  );
  const totalMrr = SUBSCRIPTION_PLANS.reduce((a, p) => a + p.mrr, 0);

  // ─── Enterprise contracts sorted by ARR desc ────────────────────────────────
  const sortedContracts = useMemo(
    () => [...ENTERPRISE_CONTRACTS].sort((a, b) => b.arr - a.arr),
    [],
  );

  // ─── Revenue mix conic gradient ─────────────────────────────────────────────
  const revenueMixStops = useMemo(
    () => REVENUE_MIX.reduce<Array<typeof REVENUE_MIX[number] & { start: number; end: number }>>(
      (acc, r) => {
        const start = acc.length === 0 ? 0 : acc[acc.length - 1].end;
        return [...acc, { ...r, start, end: start + r.pct }];
      },
      [],
    ),
    [],
  );
  const conicGradient = useMemo(
    () => revenueMixStops.map((r) => `${r.hex} ${r.start}% ${r.end}%`).join(', '),
    [revenueMixStops],
  );

  const totalContractArr = sortedContracts.reduce((a, c) => a + c.arr, 0);
  const totalMarketplaceRevenue = MARKETPLACE_REVENUE.reduce((a, m) => a + m.revenue, 0);

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
                    <CreditCard className="mr-1.5 h-3 w-3" />
                    Phase 16 · Module 11
                  </Badge>
                  <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                    <ShieldCheck className="mr-1.5 h-3 w-3" />
                    SOC 2 · PCI DSS
                  </Badge>
                </div>
                <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                  Enterprise Billing
                  <span className="ml-2 bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">™</span>
                </h1>
                <p className="mt-2 text-sm text-white/55">
                  Subscriptions · Usage · Marketplace · Partner · API · Developer · Enterprise Contracts
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

            {/* Header KPI tiles */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {HEADER_KPIS.map((kpi, i) => {
                const a = ACCENT_CLASSES[kpi.accent];
                const Icon = kpi.icon;
                return (
                  <motion.div
                    key={kpi.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 + i * 0.04 }}
                    className={cn('rounded-2xl border p-4', a.border, a.bg)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                        {kpi.label}
                      </div>
                      <Icon className={cn('h-3.5 w-3.5', a.text)} />
                    </div>
                    <div className={cn('mt-1 text-2xl font-bold', a.text)}>{kpi.value}</div>
                    <div className="mt-0.5 text-[10px] text-white/40">{kpi.sub}</div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* ─── SUBSCRIPTION PLANS ────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                <Layers className="h-4 w-4 text-emerald-300" />
                Subscription Plans
                <span className="ml-1 text-xs font-normal text-white/40">
                  ({SUBSCRIPTION_PLANS.length} tiers · total MRR {fmt(totalMrr)})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {SUBSCRIPTION_PLANS.map((plan, idx) => {
                  const a = ACCENT_CLASSES[plan.accent];
                  const isEnterprise = plan.name === 'Enterprise';
                  const barPct = (plan.mrr / maxMrr) * 100;
                  return (
                    <motion.div
                      key={plan.name}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.05 + idx * 0.06 }}
                      className={cn(
                        'relative overflow-hidden rounded-2xl border p-5',
                        a.border, a.bg,
                        isEnterprise && a.glow,
                      )}
                    >
                      {isEnterprise && (
                        <div className="absolute right-3 top-3">
                          <Badge variant="outline" className={cn('border-amber-400/40 bg-amber-400/10 text-amber-300')}>
                            <Crown className="mr-1 h-3 w-3" />
                            Most Popular
                          </Badge>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg border', a.border, 'bg-black/30')}>
                          <Sparkles className={cn('h-4 w-4', a.text)} />
                        </div>
                        <div className="text-base font-bold text-white">{plan.name}</div>
                      </div>

                      <div className="mt-4">
                        <div className="text-[10px] uppercase tracking-wider text-white/40">MRR</div>
                        <div className={cn('text-2xl font-bold', a.text)}>{fmt(plan.mrr)}</div>
                      </div>

                      {/* Relative bar */}
                      <div className="mt-2">
                        <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${barPct}%` }}
                            transition={{ duration: 0.6, delay: 0.2 + idx * 0.06 }}
                            className={cn('h-full rounded-full', a.bar)}
                          />
                        </div>
                        <div className="mt-1 text-[10px] text-white/40">
                          {((plan.mrr / totalMrr) * 100).toFixed(1)}% of total MRR
                        </div>
                      </div>

                      <Separator className="my-4 bg-white/[0.06]" />

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-[9px] uppercase tracking-wide text-white/40">Customers</div>
                          <div className="mt-0.5 text-sm font-bold text-white">{fmtN(plan.customers)}</div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase tracking-wide text-white/40">Churn</div>
                          <div className="mt-0.5 text-sm font-bold text-emerald-300">{plan.churn}%</div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase tracking-wide text-white/40">Growth</div>
                          <div className="mt-0.5 text-sm font-bold text-emerald-300">+{plan.growth}%</div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── USAGE BILLABLES TABLE ─────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                <Activity className="h-4 w-4 text-teal-300" />
                Usage Billables
                <span className="ml-1 text-xs font-normal text-white/40">
                  (Metered consumption · {USAGE_BILLABLES.length} metrics tracked)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.06] hover:bg-transparent">
                    <TableHead className="text-white/50">Metric</TableHead>
                    <TableHead className="text-right text-white/50">Included</TableHead>
                    <TableHead className="text-right text-white/50">Used</TableHead>
                    <TableHead className="text-right text-white/50">Overage</TableHead>
                    <TableHead className="text-white/50">Usage %</TableHead>
                    <TableHead className="text-white/50">Rate</TableHead>
                    <TableHead className="text-right text-white/50">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {USAGE_BILLABLES.map((u) => {
                    const usagePct = (u.used / u.included) * 100;
                    const overageColor = u.overage > 0 ? 'text-rose-300' : 'text-white/40';
                    const barColor = usagePct > 100 ? 'bg-rose-500' :
                      usagePct > 80 ? 'bg-amber-500' : 'bg-emerald-500';
                    const barTextColor = usagePct > 100 ? 'text-rose-300' :
                      usagePct > 80 ? 'text-amber-300' : 'text-emerald-300';
                    return (
                      <TableRow key={u.metric} className="border-white/[0.06] hover:bg-white/[0.02]">
                        <TableCell className="py-3 font-medium text-white">{u.metric}</TableCell>
                        <TableCell className="py-3 text-right font-mono text-sm text-white/70">{fmtN(u.included)}</TableCell>
                        <TableCell className="py-3 text-right font-mono text-sm text-white">{fmtN(u.used)}</TableCell>
                        <TableCell className={cn('py-3 text-right font-mono text-sm', overageColor)}>
                          {u.overage > 0 ? fmtN(u.overage) : '—'}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-black/40">
                              <div
                                className={cn('h-full rounded-full', barColor)}
                                style={{ width: `${Math.min(usagePct, 100)}%` }}
                              />
                            </div>
                            <span className={cn('font-mono text-xs font-semibold', barTextColor)}>
                              {usagePct.toFixed(0)}%
                            </span>
                            {usagePct > 100 && (
                              <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-xs text-white/60">{u.rate}</TableCell>
                        <TableCell className="py-3 text-right font-mono text-sm font-semibold text-emerald-300">
                          {u.revenue > 0 ? fmt(u.revenue) : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── MARKETPLACE REVENUE TABLE ─────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                <Store className="h-4 w-4 text-cyan-300" />
                Marketplace Revenue Share
                <span className="ml-1 text-xs font-normal text-white/40">
                  ({MARKETPLACE_REVENUE.length} top apps · total {fmt(totalMarketplaceRevenue)})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead className="text-white/50">App</TableHead>
                      <TableHead className="text-white/50">Publisher</TableHead>
                      <TableHead className="text-right text-white/50">Total Revenue</TableHead>
                      <TableHead className="text-right text-white/50">GSTPilot Share</TableHead>
                      <TableHead className="text-right text-white/50">Publisher Share</TableHead>
                      <TableHead className="text-white/50">Split (GSTPilot / Publisher)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MARKETPLACE_REVENUE.map((m) => {
                      const a = ACCENT_CLASSES[m.accent];
                      const gstpilotPct = (m.gstpilotShare / m.revenue) * 100;
                      const publisherPct = (m.publisherShare / m.revenue) * 100;
                      return (
                        <TableRow key={m.app} className="border-white/[0.06] hover:bg-white/[0.02]">
                          <TableCell className="py-3 font-medium text-white">{m.app}</TableCell>
                          <TableCell className="py-3 text-xs text-white/60">{m.publisher}</TableCell>
                          <TableCell className="py-3 text-right font-mono text-sm font-semibold text-white">{fmt(m.revenue)}</TableCell>
                          <TableCell className="py-3 text-right font-mono text-sm text-emerald-300">{fmt(m.gstpilotShare)}</TableCell>
                          <TableCell className="py-3 text-right font-mono text-sm text-teal-300">{fmt(m.publisherShare)}</TableCell>
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-2 w-32 overflow-hidden rounded-full bg-black/40">
                                <div className="h-full bg-emerald-500" style={{ width: `${gstpilotPct}%` }} />
                                <div className="h-full bg-zinc-500" style={{ width: `${publisherPct}%` }} />
                              </div>
                              <span className="font-mono text-[10px] text-white/50">
                                {gstpilotPct.toFixed(0)}/{publisherPct.toFixed(0)}
                              </span>
                            </div>
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

        {/* ─── ENTERPRISE CONTRACTS GRID ────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                <Building2 className="h-4 w-4 text-violet-300" />
                Enterprise Contracts
                <span className="ml-1 text-xs font-normal text-white/40">
                  ({sortedContracts.length} Fortune-500 contracts · total ARR {fmt(totalContractArr)})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {sortedContracts.map((c, idx) => {
                  const a = ACCENT_CLASSES[c.accent];
                  const st = CONTRACT_STATUS[c.status];
                  const sa = ACCENT_CLASSES[st.accent];
                  return (
                    <motion.div
                      key={c.customer}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.05 + idx * 0.04 }}
                      className={cn('relative overflow-hidden rounded-2xl border p-4', a.border, a.bg)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">{c.customer}</div>
                          <div className="mt-0.5 text-[10px] text-white/50">{c.term} · {fmtN(c.seats)} seats</div>
                        </div>
                        <Badge variant="outline" className={cn('shrink-0', sa.border, sa.bg, sa.text)}>
                          {st.label}
                        </Badge>
                      </div>

                      <div className="mt-3">
                        <div className="text-[10px] uppercase tracking-wider text-white/40">Annual Contract Value</div>
                        <div className={cn('text-2xl font-bold', a.text)}>{fmt(c.arr)}</div>
                      </div>

                      <Separator className="my-3 bg-white/[0.06]" />

                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1 text-white/50">
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span>Auto-renew on</span>
                        </div>
                        <div className={cn('font-mono', a.text)}>
                          {((c.arr / totalContractArr) * 100).toFixed(1)}% of book
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── REVENUE MIX DONUT ─────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                <DollarSign className="h-4 w-4 text-emerald-300" />
                Revenue Mix · by Source
                <span className="ml-1 text-xs font-normal text-white/40">
                  (Total ARR ≈ $295M)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-around">
                {/* Donut */}
                <div className="relative h-56 w-56">
                  <div
                    className="h-full w-full rounded-full"
                    style={{ background: `conic-gradient(${conicGradient})` }}
                  />
                  <div className="absolute inset-6 flex flex-col items-center justify-center rounded-full bg-black/85 backdrop-blur-sm">
                    <div className="text-[10px] uppercase tracking-wider text-white/40">Total ARR</div>
                    <div className="text-3xl font-bold text-white">$295M</div>
                    <div className="mt-1 text-[10px] text-white/40">4 sources</div>
                  </div>
                </div>

                {/* Legend with stacked bars */}
                <div className="flex-1 space-y-3 lg:max-w-md">
                  {REVENUE_MIX.map((r, idx) => {
                    const a = ACCENT_CLASSES[r.accent];
                    return (
                      <motion.div
                        key={r.label}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: 0.1 + idx * 0.08 }}
                        className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={cn('h-3 w-3 rounded-sm', a.bar)} />
                            <span className="text-sm font-medium text-white">{r.label}</span>
                          </div>
                          <span className={cn('text-lg font-bold', a.text)}>{r.pct}%</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/40">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${r.pct}%` }}
                            transition={{ duration: 0.6, delay: 0.2 + idx * 0.08 }}
                            className={cn('h-full rounded-full', a.bar)}
                          />
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* Stacked horizontal bar */}
                  <div className="mt-4">
                    <div className="text-[10px] uppercase tracking-wider text-white/40">Cumulative view</div>
                    <div className="mt-1.5 flex h-6 overflow-hidden rounded-lg">
                      {REVENUE_MIX.map((r) => {
                        const a = ACCENT_CLASSES[r.accent];
                        return (
                          <div
                            key={r.label}
                            className={cn('flex items-center justify-center text-[10px] font-bold text-black/80', a.bar)}
                            style={{ width: `${r.pct}%` }}
                          >
                            {r.pct >= 10 ? `${r.pct}%` : ''}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── TAGLINE ──────────────────────────────────────────────────── */}
        <div className="mt-6 flex items-center justify-center gap-2 text-center">
          <CreditCard className="h-3.5 w-3.5 text-white/30" />
          <p className="text-[11px] text-white/40">
            Every dollar. Every contract. Every metered call. — GSTPilot Infinity™
          </p>
        </div>
      </div>
    </div>
  );
}
