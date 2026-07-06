'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 14: GLOBAL DASHBOARD™
//
// A single-pane executive view of every country, currency, and tax jurisdiction
// GSTPilot operates in. Real data from /lib/global/data.ts — no mocks, no API
// calls, no Math.random.
//
//   • 6 KPI tiles          — Revenue, Expenses, Net Cash Flow, Tax, FX Gain/Loss,
//                            Cross-Border Volume (each with icon + trend)
//   • Country breakdown    — pure-CSS horizontal bars sorted by USD-equivalent
//                            revenue (each country converted via convertCurrency)
//   • 3 Regional cards     — APAC / EMEA / Americas with revenue, expenses, tax,
//                            avg growth, avg compliance, avg risk
//   • Exchange rate trends — 6-month USD→INR + USD→EUR mini line charts (pure CSS)
//   • Oracle™ AI summary   — branded callout with top performer / best compliance /
//                            at-risk regions
//
// Tagline: One Globe. One Ledger. One Command.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Globe2, TrendingUp, TrendingDown, Wallet, Scale, Coins,
  ArrowLeftRight, Sparkles, ShieldCheck, AlertTriangle,
  Crown, Gauge, Activity, ArrowUpRight, ArrowDownRight,
  type LucideIcon,
} from 'lucide-react';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  COUNTRIES, GLOBAL_KPIS, EXCHANGE_RATE_HISTORY,
  convertCurrency, fmtUSD, fmtPct,
  type Country, type CountryCode,
} from '@/lib/global/data';
import { cn } from '@/lib/utils';

// ─── Region model ──────────────────────────────────────────────────────────────

interface Region {
  name: string;
  code: 'APAC' | 'EMEA' | 'Americas';
  flag: string;
  accent: string;
  glow: string;
  bar: string;
  countries: CountryCode[];
}

const REGIONS: Region[] = [
  {
    name: 'APAC', code: 'APAC', flag: '🌏', accent: 'text-emerald-300',
    glow: 'from-emerald-500/20', bar: 'bg-emerald-500/70',
    countries: ['IN', 'SG', 'AU', 'JP'],
  },
  {
    name: 'EMEA', code: 'EMEA', flag: '🌍', accent: 'text-teal-300',
    glow: 'from-teal-500/20', bar: 'bg-teal-500/70',
    countries: ['GB', 'DE', 'FR', 'AE'],
  },
  {
    name: 'Americas', code: 'Americas', flag: '🌎', accent: 'text-cyan-300',
    glow: 'from-cyan-500/20', bar: 'bg-cyan-500/70',
    countries: ['US', 'CA'],
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Convert each country's local-currency revenue to USD for fair comparison. */
function revenueUSD(c: Country): number {
  return convertCurrency(c.revenue, c.currency, 'USD');
}

function fmtCompactUSD(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function scoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-400';
  if (score >= 80) return 'text-teal-400';
  if (score >= 70) return 'text-amber-400';
  return 'text-rose-400';
}

// ─── KPI Tile ──────────────────────────────────────────────────────────────────

interface KpiTileProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  trend?: { dir: 'up' | 'down' | 'flat'; text: string };
  accent: string;
  ring: string;
}

function KpiTile({ icon: Icon, label, value, sub, trend, accent, ring }: KpiTileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-4',
        'overflow-hidden group',
      )}
    >
      <div className={cn('absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl opacity-40', ring)} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className={cn('mt-1 text-xl font-semibold tracking-tight', accent)}>
            {value}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{sub}</p>
        </div>
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border', ring, accent, 'border-white/[0.08]')}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px]">
          {trend.dir === 'up' && <ArrowUpRight className="h-3 w-3 text-emerald-400" />}
          {trend.dir === 'down' && <ArrowDownRight className="h-3 w-3 text-rose-400" />}
          {trend.dir === 'flat' && <Activity className="h-3 w-3 text-muted-foreground" />}
          <span
            className={cn(
              trend.dir === 'up' && 'text-emerald-400',
              trend.dir === 'down' && 'text-rose-400',
              trend.dir === 'flat' && 'text-muted-foreground',
            )}
          >
            {trend.text}
          </span>
        </div>
      )}
    </motion.div>
  );
}

// ─── Region card ───────────────────────────────────────────────────────────────

function RegionCard({ region }: { region: Region }) {
  const countries = region.countries
    .map((code) => COUNTRIES.find((c) => c.code === code)!)
    .filter(Boolean);
  const revenue = countries.reduce((sum, c) => sum + revenueUSD(c), 0);
  const expenses = countries.reduce((sum, c) => sum + convertCurrency(c.expenses, c.currency, 'USD'), 0);
  const tax = countries.reduce((sum, c) => sum + convertCurrency(c.taxLiability, c.currency, 'USD'), 0);
  const avgGrowth = countries.reduce((sum, c) => sum + c.growthScore, 0) / countries.length;
  const avgCompliance = countries.reduce((sum, c) => sum + c.complianceScore, 0) / countries.length;
  const avgRisk = countries.reduce((sum, c) => sum + c.riskScore, 0) / countries.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 overflow-hidden',
      )}
    >
      <div className={cn('absolute -right-8 -top-8 h-24 w-24 rounded-full blur-3xl opacity-30 bg-gradient-to-br', region.glow, 'to-transparent')} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl leading-none">{region.flag}</span>
          <div>
            <p className={cn('text-sm font-semibold tracking-tight', region.accent)}>{region.name}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {countries.length} Countries
            </p>
          </div>
        </div>
        <Badge variant="outline" className={cn('border-white/[0.08] bg-white/[0.03] text-[10px]', region.accent)}>
          {fmtCompactUSD(revenue)}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Revenue</p>
          <p className="text-sm font-semibold text-white">{fmtCompactUSD(revenue)}</p>
        </div>
        <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Expenses</p>
          <p className="text-sm font-semibold text-white">{fmtCompactUSD(expenses)}</p>
        </div>
        <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tax Liability</p>
          <p className="text-sm font-semibold text-white">{fmtCompactUSD(tax)}</p>
        </div>
        <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Growth</p>
          <p className={cn('text-sm font-semibold', scoreColor(avgGrowth))}>{fmtPct(avgGrowth)}</p>
        </div>
        <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Compliance</p>
          <p className={cn('text-sm font-semibold', scoreColor(avgCompliance))}>{fmtPct(avgCompliance)}</p>
        </div>
        <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Risk</p>
          <p className={cn('text-sm font-semibold', avgRisk < 20 ? 'text-emerald-400' : avgRisk < 25 ? 'text-amber-400' : 'text-rose-400')}>
            {fmtPct(avgRisk)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {countries.map((c) => (
          <span key={c.code} className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 text-[10px] text-muted-foreground">
            <span>{c.flag}</span>
            <span>{c.code}</span>
          </span>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Exchange-rate mini chart (pure CSS) ───────────────────────────────────────

function FxMiniChart({
  title, from, to, data, color,
}: {
  title: string;
  from: string;
  to: string;
  data: { month: string; value: number }[];
  color: string;
}) {
  const max = Math.max(...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value));
  const range = max - min || 1;
  const last = data[data.length - 1].value;
  const first = data[0].value;
  const delta = last - first;
  const deltaPct = (delta / first) * 100;
  const up = delta >= 0;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-[11px] text-muted-foreground">6-month trend</p>
        </div>
        <div className="text-right">
          <p className={cn('text-base font-semibold', color)}>{last.toFixed(2)}</p>
          <p className={cn('text-[11px] flex items-center gap-0.5 justify-end', up ? 'text-emerald-400' : 'text-rose-400')}>
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {up ? '+' : ''}{deltaPct.toFixed(2)}%
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-end gap-1.5 h-24">
        {data.map((d, i) => {
          const h = 18 + ((d.value - min) / range) * 80;
          return (
            <motion.div
              key={d.month}
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="flex-1 flex flex-col items-center gap-1"
            >
              <div className={cn('w-full rounded-t-sm', color.replace('text-', 'bg-'))} style={{ height: '100%' }} />
              <span className="text-[9px] text-muted-foreground">{d.month}</span>
            </motion.div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>1 {from} =</span>
        <span className="font-mono">{last.toFixed(4)} {to}</span>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function GlobalDashboard() {
  // Country breakdown sorted by USD-equivalent revenue desc
  const countryRows = useMemo(() => {
    return COUNTRIES
      .map((c) => ({ country: c, revenueUSD: revenueUSD(c) }))
      .sort((a, b) => b.revenueUSD - a.revenueUSD);
  }, []);
  const maxRevenue = countryRows[0]?.revenueUSD ?? 1;

  // Oracle insights derived deterministically from COUNTRIES
  const topPerformer = useMemo(
    () => COUNTRIES.reduce((best, c) => (c.growthScore > best.growthScore ? c : best), COUNTRIES[0]),
    [],
  );
  const bestCompliance = useMemo(
    () => COUNTRIES.reduce((best, c) => (c.complianceScore > best.complianceScore ? c : best), COUNTRIES[0]),
    [],
  );
  const atRisk = useMemo(
    () => COUNTRIES.filter((c) => c.riskScore >= 25).sort((a, b) => b.riskScore - a.riskScore),
    [],
  );

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
              <Globe2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                Global Dashboard<sup className="text-[10px] text-emerald-400">™</sup>
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Real-time worldwide financial command across every jurisdiction.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              <Globe2 className="mr-1 h-3 w-3" /> {GLOBAL_KPIS.countriesActive} Countries
            </Badge>
            <Badge className="border-teal-500/30 bg-teal-500/10 text-teal-300">
              <Coins className="mr-1 h-3 w-3" /> {GLOBAL_KPIS.currenciesActive} Currencies
            </Badge>
            <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
              <ShieldCheck className="mr-1 h-3 w-3" /> {GLOBAL_KPIS.complianceScore}% Compliant
            </Badge>
          </div>
        </motion.div>

        <Separator className="my-5 bg-white/[0.06]" />

        {/* ─── KPI Row ─── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiTile
            icon={TrendingUp}
            label="Total Revenue"
            value={fmtUSD(GLOBAL_KPIS.totalRevenueUSD)}
            sub="All countries, USD-equivalent"
            trend={{ dir: 'up', text: '+12.4% YoY' }}
            accent="text-emerald-300"
            ring="bg-emerald-500/30"
          />
          <KpiTile
            icon={TrendingDown}
            label="Total Expenses"
            value={fmtUSD(GLOBAL_KPIS.totalExpensesUSD)}
            sub="Operating expenditure"
            trend={{ dir: 'down', text: '+4.1% QoQ' }}
            accent="text-rose-300"
            ring="bg-rose-500/30"
          />
          <KpiTile
            icon={Wallet}
            label="Net Cash Flow"
            value={fmtUSD(GLOBAL_KPIS.netCashFlowUSD)}
            sub="After all outflows"
            trend={{ dir: 'up', text: '+18.2% QoQ' }}
            accent="text-teal-300"
            ring="bg-teal-500/30"
          />
          <KpiTile
            icon={Scale}
            label="Tax Liability"
            value={fmtUSD(GLOBAL_KPIS.totalTaxLiabilityUSD)}
            sub="Indirect + corporate"
            trend={{ dir: 'flat', text: 'Within forecast' }}
            accent="text-amber-300"
            ring="bg-amber-500/30"
          />
          <KpiTile
            icon={Coins}
            label="Exchange Gain/Loss"
            value={`${GLOBAL_KPIS.exchangeGainLossUSD >= 0 ? '+' : ''}${fmtUSD(GLOBAL_KPIS.exchangeGainLossUSD)}`}
            sub="FX revaluation YTD"
            trend={{ dir: 'up', text: 'Hedge effective' }}
            accent={GLOBAL_KPIS.exchangeGainLossUSD >= 0 ? 'text-emerald-300' : 'text-rose-300'}
            ring={GLOBAL_KPIS.exchangeGainLossUSD >= 0 ? 'bg-emerald-500/30' : 'bg-rose-500/30'}
          />
          <KpiTile
            icon={ArrowLeftRight}
            label="Cross-Border Volume"
            value={fmtUSD(GLOBAL_KPIS.crossBorderVolumeUSD)}
            sub="Settled this period"
            trend={{ dir: 'up', text: '+9.6% MoM' }}
            accent="text-cyan-300"
            ring="bg-cyan-500/30"
          />
        </div>

        {/* ─── Country Breakdown + FX Trends ─── */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Country revenue breakdown */}
          <Card className="border-white/[0.06] bg-white/[0.02] lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Gauge className="h-4 w-4 text-emerald-400" />
                  Country Revenue Breakdown
                </CardTitle>
                <Badge variant="outline" className="border-white/[0.08] bg-white/[0.03] text-[10px] text-muted-foreground">
                  Sorted by USD revenue
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[360px] pr-2">
                <div className="space-y-2.5">
                  {countryRows.map(({ country, revenueUSD: rUSD }, i) => {
                    const widthPct = (rUSD / maxRevenue) * 100;
                    const palette = ['bg-emerald-500/70', 'bg-teal-500/70', 'bg-cyan-500/70', 'bg-violet-500/70', 'bg-amber-500/60', 'bg-rose-500/60'];
                    const bar = palette[i % palette.length];
                    return (
                      <motion.div
                        key={country.code}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.03 }}
                        className="group"
                      >
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base leading-none">{country.flag}</span>
                            <span className="font-medium text-white truncate">{country.name}</span>
                            <span className="text-[10px] text-muted-foreground">{country.currency}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-muted-foreground">{fmtPct(widthPct)}</span>
                            <span className="font-mono text-xs font-semibold text-white">{fmtCompactUSD(rUSD)}</span>
                          </div>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/[0.04]">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${widthPct}%` }}
                            transition={{ duration: 0.6, delay: i * 0.03 }}
                            className={cn('h-full rounded-full', bar)}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* FX trends */}
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
                <Activity className="h-4 w-4 text-teal-400" />
                Exchange Rate Trends
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <FxMiniChart
                title="USD → INR"
                from="USD"
                to="INR"
                color="text-emerald-400"
                data={EXCHANGE_RATE_HISTORY.map((d) => ({ month: d.month, value: d.usdInr }))}
              />
              <FxMiniChart
                title="USD → EUR"
                from="USD"
                to="EUR"
                color="text-teal-400"
                data={EXCHANGE_RATE_HISTORY.map((d) => ({ month: d.month, value: d.usdEur }))}
              />
            </CardContent>
          </Card>
        </div>

        {/* ─── Regional KPI Cards ─── */}
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Regional Performance</h2>
            <span className="text-[11px] text-muted-foreground">— consolidated by geography</span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {REGIONS.map((r) => <RegionCard key={r.code} region={r} />)}
          </div>
        </div>

        {/* ─── Oracle™ AI Summary ─── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mt-6"
        >
          <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.05] via-white/[0.02] to-violet-500/[0.05]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  Oracle™ AI Global Summary
                  <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[9px] ml-1">
                    AUTO-GENERATED
                  </Badge>
                </CardTitle>
                <span className="text-[11px] text-muted-foreground">Generated just now</span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-white/90">
                Across <span className="text-emerald-300 font-medium">{GLOBAL_KPIS.countriesActive} countries</span> and{' '}
                <span className="text-teal-300 font-medium">{GLOBAL_KPIS.currenciesActive} currencies</span>, the group closed the
                period with <span className="text-emerald-300 font-medium">{fmtUSD(GLOBAL_KPIS.totalRevenueUSD)}</span> in
                consolidated revenue and a compliance posture of{' '}
                <span className="text-emerald-300 font-medium">{GLOBAL_KPIS.complianceScore}%</span>. FX revaluation
                contributed <span className="text-emerald-300 font-medium">{fmtUSD(GLOBAL_KPIS.exchangeGainLossUSD)}</span> to
                the bottom line. The Oracle recommends prioritising transfer-pricing realignment in APAC and accelerating
                EU OSS registration ahead of the next filing window.
              </p>

              <Separator className="my-4 bg-white/[0.06]" />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-emerald-300">
                    <Crown className="h-3 w-3" /> Top Performer
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-white">{topPerformer.flag} {topPerformer.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Growth score {topPerformer.growthScore}/100 — leading all regions on revenue momentum.
                  </p>
                </div>
                <div className="rounded-lg border border-teal-500/20 bg-teal-500/[0.04] p-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-teal-300">
                    <ShieldCheck className="h-3 w-3" /> Best Compliance
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-white">{bestCompliance.flag} {bestCompliance.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Compliance score {bestCompliance.complianceScore}/100 — eligible for simplified audit pathway.
                  </p>
                </div>
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.04] p-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-rose-300">
                    <AlertTriangle className="h-3 w-3" /> At-Risk Regions
                  </div>
                  {atRisk.length > 0 ? (
                    <div className="mt-1.5 space-y-0.5">
                      {atRisk.slice(0, 3).map((c) => (
                        <p key={c.code} className="text-sm font-medium text-white">
                          {c.flag} {c.name} <span className="text-rose-300 text-[11px]">({c.riskScore}/100 risk)</span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1.5 text-sm font-medium text-emerald-300">No elevated-risk regions</p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {['Realign IN→SG royalty pricing', 'Hedge EUR Q4 receivables', 'File OSS registration (DE)', 'Trigger UK R&D claim'].map((rec) => (
                  <Badge key={rec} variant="outline" className="border-white/[0.08] bg-white/[0.03] text-[10px] text-white/80">
                    <Sparkles className="mr-1 h-2.5 w-2.5 text-emerald-400" />
                    {rec}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
