'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 14: GLOBAL DASHBOARD™ (Billion-Dollar Grade)
//
// A single-pane executive view of every country, currency, and tax jurisdiction
// GSTPilot operates in. Real data from /lib/global/data.ts — no mocks, no API
// calls, no Math.random.
//
//   • Executive Scorecard    — 8 compact KPIs with sparkline indicators
//   • 6 KPI tiles             — Revenue, Expenses, Net Cash Flow, Tax, FX Gain/Loss,
//                               Cross-Border Volume (each with icon + trend)
//   • Country breakdown       — pure-CSS horizontal bars sorted by USD-equivalent
//                               revenue with click-to-drill-down detail panel
//   • Country detail dialog   — full financial breakdown for selected country:
//                               revenue, expenses, tax, growth, compliance, risk,
//                               top vendors, filing deadlines, regulatory changes
//   • Regional drill-down     — 3 expandable region cards (APAC/EMEA/Americas)
//                               with countries within, each with mini-stats
//   • Currency Exposure       — bubble visualization sized by exposure & risk score
//   • Cash Position Waterfall — collections → FX conversion → fees → net inflow
//   • Tax Jurisdiction Heatmap— grid of countries × tax types with intensity by rate
//   • Exchange rate trends    — 6-month USD→INR + USD→EUR mini line charts
//   • Oracle™ AI summary      — branded callout with recommendations
//
// Tagline: One Globe. One Ledger. One Command.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe2, TrendingUp, TrendingDown, Wallet, Scale, Coins,
  ArrowLeftRight, Sparkles, ShieldCheck, AlertTriangle,
  Crown, Gauge, Activity, ArrowUpRight, ArrowDownRight,
  ChevronDown, ChevronRight, X, Building2, CalendarClock,
  Banknote, Layers, PieChart, Flame, Droplets, type LucideIcon,
  Building, Users, HandCoins, Landmark, ShieldCheck as ShieldIcon,
  FileCheck, Briefcase, Handshake, PiggyBank, BarChart3, FileText,
  TrendingUp as TrendUp, Receipt, Timer, ClipboardCheck,
} from 'lucide-react';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  COUNTRIES, GLOBAL_KPIS, EXCHANGE_RATE_HISTORY,
  REGIONAL_DATA, FX_EXPOSURES, BANK_BALANCES, VENDORS,
  FILING_DEADLINES, TAX_POSITIONS, REGULATORY_CHANGES,
  convertCurrency, fmtUSD, fmtPct, getCountry,
  type Country, type CountryCode,
} from '@/lib/global/data';
import {
  REVENUE_SEGMENTS, ENTERPRISE_KPIS,
  CONSOLIDATED_ASSETS, CONSOLIDATED_LIABILITIES,
  type RevenueSegment, type ConsolidatedBalance,
} from '@/lib/global/data-enterprise';
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

// Sparkline helper — deterministic values passed in, normalized to bars.
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  return (
    <div className="flex items-end gap-[2px] h-6 w-[60px]">
      {values.map((v, i) => {
        const h = 18 + ((v - min) / range) * 80;
        return (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            animate={{ height: `${h}%` }}
            transition={{ duration: 0.4, delay: i * 0.03 }}
            className={cn('flex-1 rounded-t-sm', color)}
          />
        );
      })}
    </div>
  );
}

// ─── Executive Scorecard ───────────────────────────────────────────────────────

interface ExecKpi {
  label: string;
  value: string;
  delta: string;
  dir: 'up' | 'down' | 'flat';
  spark: number[];
  accent: string;
  bar: string;
}

function ExecutiveScorecard() {
  const kpis: ExecKpi[] = [
    {
      label: 'Revenue',
      value: fmtCompactUSD(GLOBAL_KPIS.totalRevenueUSD),
      delta: '+12.4%',
      dir: 'up',
      spark: [3.8, 4.1, 4.0, 4.4, 4.7, 5.1, 5.68],
      accent: 'text-emerald-300',
      bar: 'bg-emerald-400',
    },
    {
      label: 'Net Margin',
      value: fmtPct(((GLOBAL_KPIS.netCashFlowUSD / GLOBAL_KPIS.totalRevenueUSD) * 100)),
      delta: '+2.1pp',
      dir: 'up',
      spark: [22, 23, 24, 23.5, 25, 26, 27],
      accent: 'text-teal-300',
      bar: 'bg-teal-400',
    },
    {
      label: 'Tax Burden',
      value: fmtPct((GLOBAL_KPIS.totalTaxLiabilityUSD / GLOBAL_KPIS.totalRevenueUSD) * 100),
      delta: '-0.8pp',
      dir: 'down',
      spark: [16.5, 16.2, 15.9, 15.4, 15.2, 14.9, 14.8],
      accent: 'text-amber-300',
      bar: 'bg-amber-400',
    },
    {
      label: 'Compliance',
      value: `${GLOBAL_KPIS.complianceScore}%`,
      delta: '+1.4pp',
      dir: 'up',
      spark: [86, 88, 89, 90, 90, 91, 91],
      accent: 'text-emerald-300',
      bar: 'bg-emerald-400',
    },
    {
      label: 'FX Gain/Loss',
      value: `+${fmtCompactUSD(GLOBAL_KPIS.exchangeGainLossUSD)}`,
      delta: '+8.2%',
      dir: 'up',
      spark: [12, 18, 24, 28, 32, 38, 42.8],
      accent: 'text-cyan-300',
      bar: 'bg-cyan-400',
    },
    {
      label: 'Cross-Border',
      value: fmtCompactUSD(GLOBAL_KPIS.crossBorderVolumeUSD),
      delta: '+9.6%',
      dir: 'up',
      spark: [380, 420, 460, 490, 530, 560, 594],
      accent: 'text-violet-300',
      bar: 'bg-violet-400',
    },
    {
      label: 'Active Countries',
      value: `${GLOBAL_KPIS.countriesActive}`,
      delta: '+1',
      dir: 'up',
      spark: [7, 8, 8, 9, 9, 10, 10],
      accent: 'text-emerald-300',
      bar: 'bg-emerald-400',
    },
    {
      label: 'Avg Growth',
      value: `${GLOBAL_KPIS.avgGrowthScore}`,
      delta: '+3',
      dir: 'up',
      spark: [70, 72, 73, 75, 76, 77, 78],
      accent: 'text-teal-300',
      bar: 'bg-teal-400',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-emerald-500/[0.04] via-white/[0.02] to-violet-500/[0.04] p-3 sm:p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-amber-300" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
            Executive Scorecard
          </h3>
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[9px] text-emerald-300">
            LIVE
          </Badge>
        </div>
        <span className="text-[10px] text-muted-foreground">Q3 FY24 · Consolidated</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: i * 0.03 }}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5"
          >
            <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground truncate">
              {k.label}
            </p>
            <p className={cn('mt-0.5 text-sm font-bold tracking-tight', k.accent)}>
              {k.value}
            </p>
            <div className="mt-1 flex items-center justify-between gap-1">
              <span className={cn(
                'text-[9px] flex items-center gap-0.5',
                k.dir === 'up' && 'text-emerald-400',
                k.dir === 'down' && 'text-rose-400',
                k.dir === 'flat' && 'text-muted-foreground',
              )}>
                {k.dir === 'up' && <ArrowUpRight className="h-2.5 w-2.5" />}
                {k.dir === 'down' && <ArrowDownRight className="h-2.5 w-2.5" />}
                {k.dir === 'flat' && <Activity className="h-2.5 w-2.5" />}
                {k.delta}
              </span>
              <Sparkline values={k.spark} color={k.bar} />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
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

// ─── Region card with drill-down ───────────────────────────────────────────────

function RegionCard({ region, expanded, onToggle }: {
  region: Region;
  expanded: boolean;
  onToggle: () => void;
}) {
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
        'relative rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden',
        expanded && 'ring-1 ring-emerald-500/20',
      )}
    >
      <div className={cn('absolute -right-8 -top-8 h-24 w-24 rounded-full blur-3xl opacity-30 bg-gradient-to-br', region.glow, 'to-transparent')} />
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-4 hover:bg-white/[0.02] transition-colors"
      >
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
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn('border-white/[0.08] bg-white/[0.03] text-[10px]', region.accent)}>
              {fmtCompactUSD(revenue)}
            </Badge>
            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
          </div>
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
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden border-t border-white/[0.06]"
          >
            <div className="p-4 space-y-2.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                Country drill-down
              </p>
              {countries.map((c) => {
                const cRev = revenueUSD(c);
                return (
                  <div
                    key={c.code}
                    className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{c.flag}</span>
                        <div>
                          <p className="text-xs font-medium text-white">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground">{c.currency} · {c.taxSystem}</p>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-semibold text-white">
                        {fmtCompactUSD(cRev)}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px]">
                      <div className="rounded border border-white/[0.04] bg-white/[0.02] px-1.5 py-1">
                        <p className="text-muted-foreground">Growth</p>
                        <p className={cn('font-semibold', scoreColor(c.growthScore))}>{c.growthScore}</p>
                      </div>
                      <div className="rounded border border-white/[0.04] bg-white/[0.02] px-1.5 py-1">
                        <p className="text-muted-foreground">Compliance</p>
                        <p className={cn('font-semibold', scoreColor(c.complianceScore))}>{c.complianceScore}</p>
                      </div>
                      <div className="rounded border border-white/[0.04] bg-white/[0.02] px-1.5 py-1">
                        <p className="text-muted-foreground">Risk</p>
                        <p className={cn('font-semibold', c.riskScore < 20 ? 'text-emerald-400' : c.riskScore < 25 ? 'text-amber-400' : 'text-rose-400')}>{c.riskScore}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Country detail dialog ─────────────────────────────────────────────────────

function CountryDetailDialog({ country, onClose }: {
  country: Country | null;
  onClose: () => void;
}) {
  const taxPosition = useMemo(
    () => country ? TAX_POSITIONS.find((t) => t.country === country.code) : null,
    [country],
  );
  const countryFilings = useMemo(
    () => country ? FILING_DEADLINES.filter((f) => f.country === country.code) : [],
    [country],
  );
  const countryVendors = useMemo(
    () => country ? VENDORS.filter((v) => v.country === country.code).sort((a, b) => b.totalSpend - a.totalSpend) : [],
    [country],
  );
  const regulatory = useMemo(
    () => country ? REGULATORY_CHANGES.filter((r) => r.country === country.code || (country.code === 'DE' && r.country === 'EU')) : [],
    [country],
  );

  return (
    <Dialog open={!!country} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden border-white/[0.08] bg-background p-0">
        {country && (
          <>
            <DialogHeader className="px-5 pt-5 pb-3 border-b border-white/[0.06]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl leading-none">{country.flag}</span>
                  <div>
                    <DialogTitle className="text-white text-lg">
                      {country.name} — Financial Breakdown
                    </DialogTitle>
                    <DialogDescription className="text-[11px]">
                      {country.currency} · {country.taxSystem} · {country.timezone}
                    </DialogDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-white"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogHeader>

            <ScrollArea className="max-h-[calc(90vh-100px)]">
              <div className="p-5 space-y-4">
                {/* Top financials grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-300">Revenue</p>
                    <p className="text-sm font-semibold text-white">{fmtCompactUSD(revenueUSD(country))}</p>
                  </div>
                  <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.04] p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-rose-300">Expenses</p>
                    <p className="text-sm font-semibold text-white">{fmtCompactUSD(convertCurrency(country.expenses, country.currency, 'USD'))}</p>
                  </div>
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-amber-300">Tax Liability</p>
                    <p className="text-sm font-semibold text-white">{fmtCompactUSD(convertCurrency(country.taxLiability, country.currency, 'USD'))}</p>
                  </div>
                  <div className="rounded-lg border border-teal-500/20 bg-teal-500/[0.04] p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-teal-300">Net Margin</p>
                    <p className="text-sm font-semibold text-white">
                      {fmtPct(((revenueUSD(country) - convertCurrency(country.expenses, country.currency, 'USD')) / revenueUSD(country)) * 100)}
                    </p>
                  </div>
                </div>

                {/* Score strip */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Growth</p>
                      <TrendingUp className="h-3 w-3 text-emerald-400" />
                    </div>
                    <p className={cn('text-base font-bold', scoreColor(country.growthScore))}>{country.growthScore}/100</p>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/[0.04]">
                      <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${country.growthScore}%` }} />
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Compliance</p>
                      <ShieldCheck className="h-3 w-3 text-teal-400" />
                    </div>
                    <p className={cn('text-base font-bold', scoreColor(country.complianceScore))}>{country.complianceScore}/100</p>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/[0.04]">
                      <div className="h-full rounded-full bg-teal-500/70" style={{ width: `${country.complianceScore}%` }} />
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Risk</p>
                      <AlertTriangle className="h-3 w-3 text-amber-400" />
                    </div>
                    <p className={cn('text-base font-bold', country.riskScore < 20 ? 'text-emerald-400' : country.riskScore < 25 ? 'text-amber-400' : 'text-rose-400')}>{country.riskScore}/100</p>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/[0.04]">
                      <div className="h-full rounded-full bg-amber-500/70" style={{ width: `${country.riskScore}%` }} />
                    </div>
                  </div>
                </div>

                {/* Tax rates & system */}
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Scale className="h-3.5 w-3.5 text-amber-400" />
                    <p className="text-xs font-semibold text-white">Tax Profile</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                    <div><p className="text-muted-foreground text-[10px]">{country.primaryTaxName}</p><p className="font-semibold text-white">{country.taxRate}%</p></div>
                    <div><p className="text-muted-foreground text-[10px]">Corporate</p><p className="font-semibold text-white">{country.corporateTaxRate}%</p></div>
                    <div><p className="text-muted-foreground text-[10px]">Payroll</p><p className="font-semibold text-white">{country.payrollTaxRate}%</p></div>
                    <div><p className="text-muted-foreground text-[10px]">Import Duty</p><p className="font-semibold text-white">{country.importDuty}%</p></div>
                    <div><p className="text-muted-foreground text-[10px]">Export Duty</p><p className="font-semibold text-white">{country.exportDuty}%</p></div>
                  </div>
                  {taxPosition && (
                    <div className="mt-3 pt-3 border-t border-white/[0.06] grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div><p className="text-muted-foreground text-[10px]">Entity</p><p className="font-medium text-white truncate" title={taxPosition.entity}>{taxPosition.entity}</p></div>
                      <div><p className="text-muted-foreground text-[10px]">Effective Rate</p><p className="font-semibold text-amber-300">{taxPosition.effectiveRate}%</p></div>
                      <div><p className="text-muted-foreground text-[10px]">Loss Carryforward</p><p className="font-semibold text-white">{fmtCompactUSD(taxPosition.lossCarryforward)}</p></div>
                      <div><p className="text-muted-foreground text-[10px]">Tax Credits</p><p className="font-semibold text-emerald-300">{fmtCompactUSD(taxPosition.taxCredits)}</p></div>
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-white/[0.06]">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Compliance Bodies</p>
                    <div className="flex flex-wrap gap-1">
                      {country.complianceBodies.map((b) => (
                        <Badge key={b} variant="outline" className="border-white/[0.08] bg-white/[0.03] text-[9px] text-white/80">
                          {b}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Filing deadlines */}
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarClock className="h-3.5 w-3.5 text-cyan-400" />
                    <p className="text-xs font-semibold text-white">Upcoming Filings ({countryFilings.length})</p>
                  </div>
                  <div className="space-y-1.5">
                    {countryFilings.length > 0 ? countryFilings.map((f) => (
                      <div key={f.id} className="flex items-center justify-between rounded border border-white/[0.04] bg-white/[0.02] px-2.5 py-1.5 text-[11px]">
                        <div>
                          <p className="font-medium text-white">{f.form}</p>
                          <p className="text-[10px] text-muted-foreground">{f.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">Due {f.dueDate}</span>
                          <Badge variant="outline" className={cn(
                            'text-[9px] border',
                            f.priority === 'critical' && 'border-rose-500/30 bg-rose-500/10 text-rose-300',
                            f.priority === 'high' && 'border-amber-500/30 bg-amber-500/10 text-amber-300',
                            f.priority === 'medium' && 'border-teal-500/30 bg-teal-500/10 text-teal-300',
                            f.priority === 'low' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
                          )}>
                            {f.daysLeft}d
                          </Badge>
                        </div>
                      </div>
                    )) : (
                      <p className="text-[11px] text-muted-foreground">No filings scheduled</p>
                    )}
                  </div>
                </div>

                {/* Top vendors */}
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-3.5 w-3.5 text-violet-400" />
                    <p className="text-xs font-semibold text-white">Top Vendors ({countryVendors.length})</p>
                  </div>
                  <div className="space-y-1.5">
                    {countryVendors.length > 0 ? countryVendors.slice(0, 4).map((v) => (
                      <div key={v.id} className="flex items-center justify-between rounded border border-white/[0.04] bg-white/[0.02] px-2.5 py-1.5 text-[11px]">
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">{v.name}</p>
                          <p className="text-[10px] text-muted-foreground">{v.category} · ⭐ {v.rating} · {v.paymentTerms}</p>
                        </div>
                        <span className="font-mono font-semibold text-emerald-300">{fmtCompactUSD(v.totalSpend)}</span>
                      </div>
                    )) : (
                      <p className="text-[11px] text-muted-foreground">No vendors in this country</p>
                    )}
                  </div>
                </div>

                {/* Regulatory changes */}
                {regulatory.length > 0 && (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                      <p className="text-xs font-semibold text-white">Regulatory Alerts ({regulatory.length})</p>
                    </div>
                    <div className="space-y-1.5">
                      {regulatory.map((r) => (
                        <div key={r.id} className="rounded border border-white/[0.04] bg-white/[0.02] px-2.5 py-1.5 text-[11px]">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-white">{r.title}</p>
                            <Badge variant="outline" className={cn(
                              'text-[9px] border',
                              r.impact === 'high' && 'border-rose-500/30 bg-rose-500/10 text-rose-300',
                              r.impact === 'medium' && 'border-amber-500/30 bg-amber-500/10 text-amber-300',
                              r.impact === 'low' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
                            )}>
                              {r.impact} impact
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{r.description}</p>
                          <p className="text-[10px] text-amber-300 mt-0.5">Effective {r.effectiveDate}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Currency Exposure Bubble View ─────────────────────────────────────────────

function CurrencyExposureBubbles() {
  const maxExposure = Math.max(...FX_EXPOSURES.map((f) => f.exposure));
  // Position bubble: x = risk score (0-100), y = volatility (0-100)
  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
            <Droplets className="h-4 w-4 text-cyan-400" />
            Currency Exposure Map
          </CardTitle>
          <Badge variant="outline" className="border-white/[0.08] bg-white/[0.03] text-[10px] text-muted-foreground">
            Bubble = exposure · Position = risk × volatility
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative h-64 w-full overflow-hidden rounded-lg border border-white/[0.06] bg-gradient-to-br from-emerald-500/[0.02] via-transparent to-rose-500/[0.02]">
          {/* Grid lines */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-1/4 left-0 right-0 h-px bg-white/[0.04]" />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/[0.04]" />
            <div className="absolute top-3/4 left-0 right-0 h-px bg-white/[0.04]" />
            <div className="absolute left-1/4 top-0 bottom-0 w-px bg-white/[0.04]" />
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/[0.04]" />
            <div className="absolute left-3/4 top-0 bottom-0 w-px bg-white/[0.04]" />
          </div>
          {/* Axis labels */}
          <div className="absolute bottom-1 left-2 text-[9px] text-muted-foreground">Low Risk →</div>
          <div className="absolute bottom-1 right-2 text-[9px] text-muted-foreground">← High Risk</div>
          <div className="absolute top-1 left-2 text-[9px] text-muted-foreground">↑ High Volatility</div>
          <div className="absolute top-1 right-2 text-[9px] text-muted-foreground">Low Vol ↓</div>

          {FX_EXPOSURES.map((fx, i) => {
            const size = 30 + (fx.exposure / maxExposure) * 60;
            const left = (fx.riskScore / 60) * 80 + 8; // risk 0-60 mapped to 8-88%
            const top = 88 - (fx.volatility30d / 10) * 70; // vol 0-10 mapped to top 18-88%
            const isHigh = fx.riskScore >= 40;
            return (
              <motion.div
                key={fx.currency}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                whileHover={{ scale: 1.1 }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center rounded-full border-2 cursor-pointer group"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  width: `${size}px`,
                  height: `${size}px`,
                  borderColor: isHigh ? 'rgba(244, 63, 94, 0.6)' : 'rgba(37,99,235, 0.6)',
                  background: isHigh ? 'rgba(244, 63, 94, 0.12)' : 'rgba(37,99,235, 0.12)',
                }}
                title={`${fx.currency} · ${fmtCompactUSD(fx.exposure)} exposure · ${fx.hedgeRatio}% hedged`}
              >
                <span className="text-sm leading-none">{fx.flag}</span>
                <span className="text-[9px] font-semibold text-white">{fx.currency}</span>
                {/* Tooltip */}
                <div className="absolute z-10 -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/[0.08] bg-background px-2 py-1 text-[9px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <p className="font-semibold text-white">{fx.currency} · {fmtCompactUSD(fx.exposure)}</p>
                  <p className="text-muted-foreground">Hedge: {fx.hedgeRatio}% · Risk: {fx.riskScore}/100</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Exposure list below */}
        <ScrollArea className="max-h-32 mt-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {FX_EXPOSURES.slice(0, 8).map((fx) => (
              <div key={fx.currency} className="rounded border border-white/[0.04] bg-white/[0.02] px-2 py-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-white">{fx.flag} {fx.currency}</span>
                  <span className={cn(
                    'text-[9px] font-semibold',
                    fx.hedgeRatio >= 60 ? 'text-emerald-400' : fx.hedgeRatio >= 30 ? 'text-amber-400' : 'text-rose-400',
                  )}>{fx.hedgeRatio}% hedged</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{fmtCompactUSD(fx.exposure)} exposure</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── Cash Position Waterfall ───────────────────────────────────────────────────

function CashPositionWaterfall() {
  // Deterministic waterfall values
  const steps = [
    { label: 'Opening Balance', value: 4_820_000, type: 'start' as const, color: 'bg-slate-500/70' },
    { label: 'Customer Collections', value: 1_840_000, type: 'in' as const, color: 'bg-emerald-500/70' },
    { label: 'FX Revaluation Gain', value: 42_800, type: 'in' as const, color: 'bg-teal-500/70' },
    { label: 'Cross-Border Inflows', value: 184_000, type: 'in' as const, color: 'bg-cyan-500/70' },
    { label: 'Vendor Payments', value: -1_240_000, type: 'out' as const, color: 'bg-rose-500/70' },
    { label: 'Tax Outflows', value: -384_000, type: 'out' as const, color: 'bg-amber-500/70' },
    { label: 'FX Conversion Fees', value: -28_400, type: 'out' as const, color: 'bg-violet-500/70' },
    { label: 'Banking Charges', value: -14_200, type: 'out' as const, color: 'bg-rose-500/60' },
    { label: 'Net Inflow', value: 0, type: 'net' as const, color: 'bg-emerald-500/90' },
  ];
  const total = steps.slice(1, -1).reduce((s, x) => s + x.value, 0);
  steps[steps.length - 1].value = total;
  const finalBalance = steps[0].value + total;
  const maxAbs = Math.max(...steps.map((s) => Math.abs(s.value)));
  const maxWidth = 100; // percent

  // For waterfall, we need cumulative positioning
  let cumulative = steps[0].value;
  const bars = steps.map((s, i) => {
    if (i === 0) {
      return { ...s, start: 0, end: s.value };
    }
    if (s.type === 'net') {
      return { ...s, start: 0, end: finalBalance };
    }
    const isPositive = s.value >= 0;
    const start = isPositive ? cumulative : cumulative + s.value;
    const end = isPositive ? cumulative + s.value : cumulative;
    cumulative += s.value;
    return { ...s, start, end };
  });

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
            <PieChart className="h-4 w-4 text-emerald-400" />
            Cash Position Waterfall
          </CardTitle>
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-300">
            Closing: {fmtCompactUSD(finalBalance)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {bars.map((b, i) => {
            const widthPct = (Math.abs(b.end - b.start) / maxAbs) * maxWidth;
            const startPct = (b.start / (finalBalance || 1)) * 100;
            const isPos = b.value >= 0;
            return (
              <motion.div
                key={b.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="group"
              >
                <div className="flex items-center justify-between text-[11px] mb-0.5">
                  <span className="text-muted-foreground">{b.label}</span>
                  <span className={cn(
                    'font-mono font-semibold',
                    b.type === 'start' && 'text-slate-300',
                    b.type === 'in' && 'text-emerald-300',
                    b.type === 'out' && 'text-rose-300',
                    b.type === 'net' && 'text-emerald-400',
                  )}>
                    {b.type === 'start' || b.type === 'net' ? '' : isPos ? '+' : ''}{fmtCompactUSD(b.value)}
                  </span>
                </div>
                <div className="relative h-5 w-full overflow-hidden rounded bg-white/[0.04]">
                  {b.type === 'start' || b.type === 'net' ? (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPct}%` }}
                      transition={{ duration: 0.5, delay: i * 0.05 }}
                      className={cn('h-full rounded', b.color)}
                    />
                  ) : (
                    <motion.div
                      initial={{ width: 0, left: `${startPct}%` }}
                      animate={{ width: `${widthPct}%`, left: `${startPct}%` }}
                      transition={{ duration: 0.5, delay: i * 0.05 }}
                      className={cn('absolute h-full rounded', b.color)}
                    />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-white/[0.06] grid grid-cols-3 gap-2 text-[10px]">
          <div>
            <p className="text-muted-foreground">Total Inflows</p>
            <p className="font-semibold text-emerald-300">{fmtCompactUSD(1840000 + 42800 + 184000)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Total Outflows</p>
            <p className="font-semibold text-rose-300">{fmtCompactUSD(1240000 + 384000 + 28400 + 14200)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Net Change</p>
            <p className={cn('font-semibold', total >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
              {total >= 0 ? '+' : ''}{fmtCompactUSD(total)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Tax Jurisdiction Heatmap ──────────────────────────────────────────────────

function TaxJurisdictionHeatmap() {
  const taxTypes = [
    { key: 'taxRate', label: 'Indirect' },
    { key: 'corporateTaxRate', label: 'Corporate' },
    { key: 'payrollTaxRate', label: 'Payroll' },
    { key: 'importDuty', label: 'Import' },
    { key: 'exportDuty', label: 'Export' },
  ] as const;

  // Find max per column for intensity
  const maxByType: Record<string, number> = {};
  for (const t of taxTypes) {
    maxByType[t.key] = Math.max(...COUNTRIES.map((c) => c[t.key]));
  }

  function colorFor(rate: number, max: number): string {
    if (rate === 0) return 'bg-white/[0.02] text-muted-foreground';
    const intensity = rate / max;
    if (intensity >= 0.8) return 'bg-rose-500/40 text-white';
    if (intensity >= 0.6) return 'bg-rose-500/30 text-white';
    if (intensity >= 0.4) return 'bg-amber-500/30 text-white';
    if (intensity >= 0.2) return 'bg-teal-500/30 text-white';
    return 'bg-emerald-500/20 text-white';
  }

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
            <Flame className="h-4 w-4 text-amber-400" />
            Tax Jurisdiction Heatmap
          </CardTitle>
          <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
            <span>Low</span>
            <div className="flex gap-0.5">
              <span className="h-2 w-3 rounded-sm bg-emerald-500/20" />
              <span className="h-2 w-3 rounded-sm bg-teal-500/30" />
              <span className="h-2 w-3 rounded-sm bg-amber-500/30" />
              <span className="h-2 w-3 rounded-sm bg-rose-500/30" />
              <span className="h-2 w-3 rounded-sm bg-rose-500/40" />
            </div>
            <span>High</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[420px]">
          <div className="min-w-[640px]">
            {/* Header row */}
            <div className="grid grid-cols-[140px_repeat(5,1fr)] gap-1 mb-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-end pb-1">
                Country
              </div>
              {taxTypes.map((t) => (
                <div key={t.key} className="text-[10px] uppercase tracking-wider text-muted-foreground text-center pb-1">
                  {t.label}
                </div>
              ))}
            </div>
            {/* Country rows */}
            {COUNTRIES.map((c, i) => (
              <motion.div
                key={c.code}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.03 }}
                className="grid grid-cols-[140px_repeat(5,1fr)] gap-1 mb-1 items-center"
              >
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-white pr-2">
                  <span>{c.flag}</span>
                  <span className="truncate">{c.code}</span>
                  <span className="text-[9px] text-muted-foreground truncate">{c.taxSystem}</span>
                </div>
                {taxTypes.map((t) => {
                  const rate = c[t.key];
                  const color = colorFor(rate, maxByType[t.key]);
                  return (
                    <div
                      key={t.key}
                      className={cn(
                        'rounded text-center py-1.5 text-[11px] font-mono font-semibold border border-white/[0.04]',
                        color,
                      )}
                      title={`${c.name} ${t.label}: ${rate}%`}
                    >
                      {rate}%
                    </div>
                  );
                })}
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
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

// ─── Bank balances snapshot ────────────────────────────────────────────────────

function BankBalancesStrip() {
  const total = BANK_BALANCES.reduce((s, b) => s + b.balanceUSD, 0);
  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
            <Banknote className="h-4 w-4 text-emerald-400" />
            Cash Position by Bank
          </CardTitle>
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-300">
            Total: {fmtCompactUSD(total)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[200px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {BANK_BALANCES.map((b, i) => (
              <motion.div
                key={`${b.bankId}-${b.accountNumber}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.02 }}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{b.currency === 'USD' ? '🇺🇸' : b.currency === 'GBP' ? '🇬🇧' : b.currency === 'EUR' ? '🇪🇺' : b.currency === 'INR' ? '🇮🇳' : b.currency === 'SGD' ? '🇸🇬' : '🌍'}</span>
                    <div>
                      <p className="text-[11px] font-medium text-white">{b.bankName}</p>
                      <p className="text-[9px] text-muted-foreground">{b.accountType} · {b.accountNumber}</p>
                    </div>
                  </div>
                  <span className="text-[9px] text-muted-foreground">{b.lastSync}</span>
                </div>
                <div className="mt-1.5 flex items-end justify-between">
                  <span className="font-mono text-sm font-semibold text-emerald-300">{fmtCompactUSD(b.balanceUSD)}</span>
                  <span className="text-[9px] text-muted-foreground">{b.currency}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[9px]">
                  <span className="text-muted-foreground">Avail: <span className="text-white">{fmtCompactUSD(b.available)}</span></span>
                  <span className="text-muted-foreground">Pending: <span className="text-amber-300">{fmtCompactUSD(b.pending)}</span></span>
                </div>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── Revenue Segments Breakdown ───────────────────────────────────────────────

const SEGMENT_BAR_COLOR: Record<string, string> = {
  emerald: 'bg-emerald-500',
  teal: 'bg-teal-500',
  cyan: 'bg-cyan-500',
  violet: 'bg-violet-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
};

const SEGMENT_BADGE_COLOR: Record<string, string> = {
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  teal: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  cyan: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  violet: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  rose: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

function RevenueSegmentsBreakdown() {
  const totalFY = useMemo(
    () => REVENUE_SEGMENTS.reduce((s, r) => s + r.fyTotal, 0),
    [],
  );

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
            <PieChart className="h-4 w-4 text-violet-400" />
            Revenue Segments Breakdown
          </CardTitle>
          <Badge variant="outline" className="border-violet-500/30 bg-violet-500/10 text-[10px] text-violet-300">
            FY Total: {fmtCompactUSD(totalFY)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stacked bar chart */}
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Composition</div>
          <div className="h-6 rounded-md overflow-hidden flex bg-black/40">
            {REVENUE_SEGMENTS.map((s, i) => {
              const pct = (s.fyTotal / totalFY) * 100;
              const color = SEGMENT_BAR_COLOR[s.color] ?? 'bg-zinc-500';
              return (
                <motion.div
                  key={s.segment}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, delay: i * 0.05 }}
                  className={cn('h-full', color)}
                  title={`${s.segment}: ${pct.toFixed(1)}%`}
                />
              );
            })}
          </div>
          <div className="mt-2 flex items-center gap-2 flex-wrap text-[10px]">
            {REVENUE_SEGMENTS.map((s) => (
              <span key={s.segment} className="flex items-center gap-1 text-zinc-400">
                <span className={cn('inline-block h-2 w-2 rounded-sm', SEGMENT_BAR_COLOR[s.color] ?? 'bg-zinc-500')} />
                <span className="truncate max-w-[140px]">{s.segment}</span>
                <span className="text-zinc-500 tabular-nums">{((s.fyTotal / totalFY) * 100).toFixed(1)}%</span>
              </span>
            ))}
          </div>
        </div>

        <Separator className="my-3 bg-white/[0.06]" />

        {/* Segments table */}
        <div className="rounded-lg border border-white/[0.06] overflow-hidden">
          <ScrollArea className="max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.06] hover:bg-transparent">
                  <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Segment</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 text-right">Q1</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 text-right">Q2</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 text-right">Q3</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 text-right">Q4</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 text-right">FY Total</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 text-right">YoY</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 w-32">Gross Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {REVENUE_SEGMENTS.map((s) => {
                  const color = SEGMENT_BADGE_COLOR[s.color] ?? 'border-white/[0.06] bg-white/[0.02] text-zinc-300';
                  const bar = SEGMENT_BAR_COLOR[s.color] ?? 'bg-zinc-500';
                  const isGrowthPositive = s.yoyGrowth >= 0;
                  return (
                    <TableRow key={s.segment} className="border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className={cn('inline-block h-2 w-2 rounded-sm', bar)} />
                          <span className="text-[12px] font-medium text-zinc-100">{s.segment}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-[10px] text-zinc-300 text-right tabular-nums">{fmtCompactUSD(s.q1)}</TableCell>
                      <TableCell className="text-[10px] text-zinc-300 text-right tabular-nums">{fmtCompactUSD(s.q2)}</TableCell>
                      <TableCell className="text-[10px] text-zinc-300 text-right tabular-nums">{fmtCompactUSD(s.q3)}</TableCell>
                      <TableCell className="text-[10px] text-zinc-300 text-right tabular-nums">{fmtCompactUSD(s.q4)}</TableCell>
                      <TableCell className="text-[11px] text-zinc-100 text-right tabular-nums font-semibold">
                        {fmtCompactUSD(s.fyTotal)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={`text-[9px] ${isGrowthPositive ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/30 bg-rose-500/10 text-rose-400'}`}>
                          {isGrowthPositive ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                          {isGrowthPositive ? '+' : ''}{s.yoyGrowth}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-black/40 overflow-hidden min-w-[60px]">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${s.grossMargin}%` }}
                              transition={{ duration: 0.6 }}
                              className={cn('h-full', bar)}
                            />
                          </div>
                          <span className="text-[10px] text-zinc-300 tabular-nums w-8 text-right">{s.grossMargin}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* Totals row */}
                <TableRow className="border-emerald-500/20 bg-emerald-500/[0.04]">
                  <TableCell className="text-[11px] font-semibold text-emerald-300">Total FY</TableCell>
                  <TableCell colSpan={4} />
                  <TableCell className="text-[12px] font-bold text-emerald-300 text-right tabular-nums">
                    {fmtCompactUSD(totalFY)}
                  </TableCell>
                  <TableCell colSpan={2} className="text-[10px] text-zinc-500 text-right">
                    {REVENUE_SEGMENTS.length} segments · blended
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Enterprise KPI Grid ───────────────────────────────────────────────────────

interface EnterpriseKpi {
  label: string;
  value: string;
  sub: string;
  icon: LucideIcon;
  accent: string;
  ring: string;
}

function EnterpriseKpiGrid() {
  const kpis: EnterpriseKpi[] = [
    { label: 'Total Entities', value: String(ENTERPRISE_KPIS.totalEntities), sub: 'Across 10 countries', icon: Building, accent: 'text-emerald-300', ring: 'bg-emerald-500/30' },
    { label: 'Total Headcount', value: ENTERPRISE_KPIS.totalHeadcount.toLocaleString('en-US'), sub: 'Consolidated FTE', icon: Users, accent: 'text-teal-300', ring: 'bg-teal-500/30' },
    { label: 'Total Revenue', value: fmtCompactUSD(ENTERPRISE_KPIS.totalRevenueUSD), sub: 'USD-equivalent', icon: TrendingUp, accent: 'text-emerald-300', ring: 'bg-emerald-500/30' },
    { label: 'Total Assets', value: fmtCompactUSD(ENTERPRISE_KPIS.totalAssetsUSD), sub: 'Consolidated', icon: Landmark, accent: 'text-cyan-300', ring: 'bg-cyan-500/30' },
    { label: 'Total Equity', value: fmtCompactUSD(ENTERPRISE_KPIS.totalEquityUSD), sub: 'Shareholder funds', icon: Wallet, accent: 'text-violet-300', ring: 'bg-violet-500/30' },
    { label: 'Hedge Notional', value: fmtCompactUSD(ENTERPRISE_KPIS.totalHedgeNotionalUSD), sub: 'FX hedging book', icon: ShieldCheck, accent: 'text-amber-300', ring: 'bg-amber-500/30' },
    { label: 'Intercompany Loans', value: fmtCompactUSD(ENTERPRISE_KPIS.totalIntercompanyLoansUSD), sub: 'Net financing', icon: HandCoins, accent: 'text-rose-300', ring: 'bg-rose-500/30' },
    { label: 'Tax Credits', value: fmtCompactUSD(ENTERPRISE_KPIS.totalTaxCreditsUSD), sub: 'R&D + SEZ + export', icon: FileCheck, accent: 'text-emerald-300', ring: 'bg-emerald-500/30' },
    { label: 'Insurance Coverage', value: fmtCompactUSD(ENTERPRISE_KPIS.totalInsuranceCoverageUSD), sub: 'D&O + Cyber + Property', icon: ShieldCheck, accent: 'text-teal-300', ring: 'bg-teal-500/30' },
    { label: 'Cash Pool', value: fmtCompactUSD(ENTERPRISE_KPIS.totalCashPoolUSD), sub: 'Singapore Treasury header', icon: PiggyBank, accent: 'text-cyan-300', ring: 'bg-cyan-500/30' },
    { label: 'Net Income', value: fmtCompactUSD(ENTERPRISE_KPIS.consolidatedNetIncomeUSD), sub: 'Consolidated FY', icon: BarChart3, accent: 'text-emerald-300', ring: 'bg-emerald-500/30' },
    { label: 'Effective Tax Rate', value: `${ENTERPRISE_KPIS.effectiveTaxRate}%`, sub: 'Blended global', icon: Scale, accent: 'text-amber-300', ring: 'bg-amber-500/30' },
    { label: 'Weighted DSO', value: `${ENTERPRISE_KPIS.weightedDSO} days`, sub: 'Days Sales Outstanding', icon: Timer, accent: 'text-violet-300', ring: 'bg-violet-500/30' },
    { label: 'Weighted DPO', value: `${ENTERPRISE_KPIS.weightedDPO} days`, sub: 'Days Payable Outstanding', icon: Receipt, accent: 'text-cyan-300', ring: 'bg-cyan-500/30' },
    { label: 'Hedging Effectiveness', value: `${ENTERPRISE_KPIS.hedgingEffectiveness}%`, sub: 'Hedge accounting test', icon: Gauge, accent: 'text-emerald-300', ring: 'bg-emerald-500/30' },
    { label: 'Audit Findings', value: String(ENTERPRISE_KPIS.auditFindings), sub: 'Open / monitoring', icon: ClipboardCheck, accent: 'text-amber-300', ring: 'bg-amber-500/30' },
    { label: 'Pending Reports', value: String(ENTERPRISE_KPIS.pendingRegulatoryReports), sub: 'Regulatory filings', icon: FileText, accent: 'text-rose-300', ring: 'bg-rose-500/30' },
  ];

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
            <Gauge className="h-4 w-4 text-emerald-400" />
            Enterprise KPI Grid
          </CardTitle>
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-300">
            {kpis.length} consolidated KPIs
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
          {kpis.map((k, i) => {
            const Icon = k.icon;
            return (
              <motion.div
                key={k.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.02 }}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 hover:border-white/[0.14] transition-all"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', k.ring)}>
                    <Icon className={cn('h-3 w-3', k.accent)} />
                  </div>
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 leading-tight">{k.label}</span>
                </div>
                <div className={cn('text-sm font-semibold tabular-nums truncate', k.accent)} title={k.value}>{k.value}</div>
                <div className="text-[9px] text-zinc-500 truncate" title={k.sub}>{k.sub}</div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Consolidated Balance Sheet ────────────────────────────────────────────────

const ASSET_CATEGORY_COLOR: Record<string, string> = {
  'Cash & Equivalents': 'border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-300',
  'Accounts Receivable': 'border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-300',
  'Inventory': 'border-teal-500/20 bg-teal-500/[0.04] text-teal-300',
  'Prepaid Expenses': 'border-teal-500/20 bg-teal-500/[0.04] text-teal-300',
  'Property, Plant & Equipment': 'border-cyan-500/20 bg-cyan-500/[0.04] text-cyan-300',
  'Intangible Assets': 'border-cyan-500/20 bg-cyan-500/[0.04] text-cyan-300',
  'Intercompany Receivables': 'border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-300',
  'Deferred Tax Assets': 'border-teal-500/20 bg-teal-500/[0.04] text-teal-300',
};

const LIABILITY_CATEGORY_COLOR: Record<string, string> = {
  'Accounts Payable': 'border-amber-500/20 bg-amber-500/[0.04] text-amber-300',
  'Accrued Expenses': 'border-amber-500/20 bg-amber-500/[0.04] text-amber-300',
  'Deferred Revenue': 'border-rose-500/20 bg-rose-500/[0.04] text-rose-300',
  'Short-Term Debt': 'border-rose-500/20 bg-rose-500/[0.04] text-rose-300',
  'Intercompany Payables': 'border-amber-500/20 bg-amber-500/[0.04] text-amber-300',
  'Long-Term Debt': 'border-rose-500/20 bg-rose-500/[0.04] text-rose-300',
  'Deferred Tax Liabilities': 'border-amber-500/20 bg-amber-500/[0.04] text-amber-300',
  'Lease Liabilities': 'border-rose-500/20 bg-rose-500/[0.04] text-rose-300',
};

function BalanceSheetTable({
  title,
  data,
  accentText,
  type,
}: {
  title: string;
  data: ConsolidatedBalance[];
  accentText: string;
  type: 'asset' | 'liability';
}) {
  const totalUSD = data.reduce((s, d) => s + d.totalUSD, 0);
  const grandTotalInr = data.reduce((s, d) => s + d.inr, 0);
  const grandTotalUsd = data.reduce((s, d) => s + d.usd, 0);
  const grandTotalEur = data.reduce((s, d) => s + d.eur, 0);
  const grandTotalGbp = data.reduce((s, d) => s + d.gbp, 0);
  const grandTotalOther = data.reduce((s, d) => s + d.other, 0);

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
            <span className={cn('inline-block h-2 w-2 rounded-full', type === 'asset' ? 'bg-emerald-400' : 'bg-rose-400')} />
            {title}
          </CardTitle>
          <Badge variant="outline" className={`text-[10px] ${type === 'asset' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/30 bg-rose-500/10 text-rose-300'}`}>
            Total: {fmtCompactUSD(totalUSD)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-white/[0.06] overflow-hidden">
          <ScrollArea className="max-h-[460px]">
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.06] hover:bg-transparent">
                  <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Category</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 text-right">INR</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 text-right">USD</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 text-right">EUR</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 text-right">GBP</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 text-right">Other</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 text-right">Total USD</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 w-16 text-right">% of Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => {
                  const color = type === 'asset'
                    ? (ASSET_CATEGORY_COLOR[row.category] ?? 'border-white/[0.06] bg-white/[0.02] text-zinc-300')
                    : (LIABILITY_CATEGORY_COLOR[row.category] ?? 'border-white/[0.06] bg-white/[0.02] text-zinc-300');
                  return (
                    <TableRow key={row.category} className="border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                      <TableCell>
                        <span className={`text-[11px] font-medium px-2 py-1 rounded-md border ${color}`}>{row.category}</span>
                      </TableCell>
                      <TableCell className="text-[10px] text-zinc-400 text-right tabular-nums">{(row.inr / 100000).toFixed(1)}L</TableCell>
                      <TableCell className="text-[10px] text-zinc-300 text-right tabular-nums">{fmtCompactUSD(row.usd)}</TableCell>
                      <TableCell className="text-[10px] text-zinc-400 text-right tabular-nums">{fmtCompactUSD(row.eur)}</TableCell>
                      <TableCell className="text-[10px] text-zinc-400 text-right tabular-nums">{fmtCompactUSD(row.gbp)}</TableCell>
                      <TableCell className="text-[10px] text-zinc-500 text-right tabular-nums">{fmtCompactUSD(row.other)}</TableCell>
                      <TableCell className="text-[11px] text-zinc-100 text-right tabular-nums font-semibold">{fmtCompactUSD(row.totalUSD)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 justify-end">
                          <div className="h-1.5 w-10 rounded-full bg-black/40 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${row.pctOfTotal * 2}%` }}
                              transition={{ duration: 0.5 }}
                              className={cn('h-full', type === 'asset' ? 'bg-emerald-500' : 'bg-rose-500')}
                            />
                          </div>
                          <span className={cn('text-[10px] tabular-nums w-8 text-right', accentText)}>{row.pctOfTotal.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* Totals row */}
                <TableRow className={type === 'asset' ? 'border-emerald-500/20 bg-emerald-500/[0.06]' : 'border-rose-500/20 bg-rose-500/[0.06]'}>
                  <TableCell className="text-[11px] font-semibold text-zinc-100">Total</TableCell>
                  <TableCell className="text-[10px] text-zinc-300 text-right tabular-nums">{(grandTotalInr / 100000).toFixed(1)}L</TableCell>
                  <TableCell className={cn('text-[11px] text-right tabular-nums font-bold', accentText)}>{fmtCompactUSD(grandTotalUsd)}</TableCell>
                  <TableCell className="text-[10px] text-zinc-300 text-right tabular-nums">{fmtCompactUSD(grandTotalEur)}</TableCell>
                  <TableCell className="text-[10px] text-zinc-300 text-right tabular-nums">{fmtCompactUSD(grandTotalGbp)}</TableCell>
                  <TableCell className="text-[10px] text-zinc-400 text-right tabular-nums">{fmtCompactUSD(grandTotalOther)}</TableCell>
                  <TableCell className={cn('text-[12px] text-right tabular-nums font-bold', accentText)}>{fmtCompactUSD(totalUSD)}</TableCell>
                  <TableCell className={cn('text-[10px] text-right tabular-nums', accentText)}>100.0%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

function ConsolidatedBalanceSheet() {
  const totalAssets = CONSOLIDATED_ASSETS.reduce((s, d) => s + d.totalUSD, 0);
  const totalLiabilities = CONSOLIDATED_LIABILITIES.reduce((s, d) => s + d.totalUSD, 0);
  const equity = totalAssets - totalLiabilities;

  return (
    <div className="space-y-4">
      {/* Balance summary */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
              <Landmark className="h-4 w-4 text-cyan-400" />
              Consolidated Balance Sheet
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                Assets: {fmtCompactUSD(totalAssets)}
              </Badge>
              <Badge variant="outline" className="text-[10px] border-rose-500/30 bg-rose-500/10 text-rose-300">
                Liabilities: {fmtCompactUSD(totalLiabilities)}
              </Badge>
              <Badge variant="outline" className="text-[10px] border-violet-500/30 bg-violet-500/10 text-violet-300">
                Net Equity: {fmtCompactUSD(equity)}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BalanceSheetTable
          title="Consolidated Assets"
          data={CONSOLIDATED_ASSETS}
          accentText="text-emerald-300"
          type="asset"
        />
        <BalanceSheetTable
          title="Consolidated Liabilities"
          data={CONSOLIDATED_LIABILITIES}
          accentText="text-rose-300"
          type="liability"
        />
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function GlobalDashboard() {
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [expandedRegion, setExpandedRegion] = useState<string | null>('APAC');

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

        {/* ─── Executive Scorecard ─── */}
        <ExecutiveScorecard />

        {/* ─── KPI Row ─── */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
                  <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-[9px] text-cyan-300 ml-1">
                    Click to drill down
                  </Badge>
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
                      <motion.button
                        key={country.code}
                        type="button"
                        onClick={() => setSelectedCountry(country)}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.03 }}
                        whileHover={{ scale: 1.005 }}
                        className="group w-full text-left"
                      >
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base leading-none">{country.flag}</span>
                            <span className="font-medium text-white truncate group-hover:text-emerald-300 transition-colors">{country.name}</span>
                            <span className="text-[10px] text-muted-foreground">{country.currency}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-muted-foreground">{fmtPct(widthPct)}</span>
                            <span className="font-mono text-xs font-semibold text-white">{fmtCompactUSD(rUSD)}</span>
                            <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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
                      </motion.button>
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

        {/* ─── Cash Position Waterfall + Currency Bubbles ─── */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CashPositionWaterfall />
          <CurrencyExposureBubbles />
        </div>

        {/* ─── Bank Balances Strip ─── */}
        <div className="mt-6">
          <BankBalancesStrip />
        </div>

        {/* ─── Regional KPI Cards with drill-down ─── */}
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Regional Performance</h2>
            <span className="text-[11px] text-muted-foreground">— click to expand country breakdown</span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {REGIONS.map((r) => (
              <RegionCard
                key={r.code}
                region={r}
                expanded={expandedRegion === r.code}
                onToggle={() => setExpandedRegion(expandedRegion === r.code ? null : r.code)}
              />
            ))}
          </div>
        </div>

        {/* ─── Tax Jurisdiction Heatmap ─── */}
        <div className="mt-6">
          <TaxJurisdictionHeatmap />
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

        {/* ─── Revenue Segments Breakdown ─── */}
        <div className="mt-6">
          <RevenueSegmentsBreakdown />
        </div>

        {/* ─── Enterprise KPI Grid ─── */}
        <div className="mt-6">
          <EnterpriseKpiGrid />
        </div>

        {/* ─── Consolidated Balance Sheet ─── */}
        <div className="mt-6">
          <ConsolidatedBalanceSheet />
        </div>

        {/* ─── Footer ─── */}
        <div className="mt-6 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Layers className="h-3 w-3" /> One Globe. One Ledger. One Command.
          </span>
          <span className="text-emerald-300">All systems operational</span>
        </div>
      </div>

      {/* ─── Country Detail Dialog ─── */}
      <CountryDetailDialog
        country={selectedCountry}
        onClose={() => setSelectedCountry(null)}
      />
    </div>
  );
}
