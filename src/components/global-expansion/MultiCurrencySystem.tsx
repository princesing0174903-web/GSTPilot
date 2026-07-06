'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 14: MULTI-CURRENCY SYSTEM™
//
// Unified multi-currency console — live rate cards across 9 currencies, an
// interactive currency converter, and a 6-month exchange rate trend chart.
// Pure static data layer (no API, no Math.random).
//
//   • Currency cards grid   — 9 currencies × rate, 24h change, supported badge
//   • Currency converter    — From/To/Amount → live converted value
//   • FX history chart      — 6-month trend for USD→INR/EUR/GBP/JPY
//
// Tagline: Every Currency. One Engine. Live Rates.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Coins, ArrowRightLeft, TrendingUp, TrendingDown, Activity,
  Gauge, Sparkles, LineChart, Radio, DollarSign, Banknote,
  type LucideIcon,
} from 'lucide-react';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  CURRENCIES, EXCHANGE_RATE_HISTORY, convertCurrency, fmtPct, type Currency,
} from '@/lib/global/data';

// ─── Currency Card ──────────────────────────────────────────────────────────────

function CurrencyCard({ currency, index }: { currency: Currency; index: number }) {
  const positive = currency.change24h >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: 'easeOut' }}
      whileHover={{ y: -3 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm hover:border-emerald-500/30 transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-black/30 text-xl">
            {currency.flag}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-zinc-100">{currency.code}</span>
              <span className="text-xs text-zinc-500">{currency.symbol}</span>
            </div>
            <div className="truncate text-[10px] text-zinc-500">{currency.name}</div>
          </div>
        </div>
        {currency.supported ? (
          <Badge variant="outline" className="shrink-0 text-[9px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" /> Supported
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0 text-[9px] border-zinc-500/30 bg-zinc-500/10 text-zinc-400">
            Disabled
          </Badge>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-black/30 px-2.5 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-zinc-500">Rate (USD)</div>
          <div className="text-sm font-semibold text-emerald-300">
            {currency.rateToUSD < 0.01
              ? currency.rateToUSD.toFixed(5)
              : currency.rateToUSD.toFixed(4)}
          </div>
        </div>
        <div className="rounded-lg bg-black/30 px-2.5 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-zinc-500">24h Change</div>
          <div
            className={`text-sm font-semibold inline-flex items-center gap-0.5 ${
              positive ? 'text-emerald-300' : 'text-rose-300'
            }`}
          >
            {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {positive ? '+' : ''}{fmtPct(currency.change24h)}
          </div>
        </div>
      </div>

      {/* Mini rate visualization */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[9px] text-zinc-500">
          <span>1 {currency.code}</span>
          <span>= ${currency.rateToUSD < 0.01 ? currency.rateToUSD.toFixed(5) : currency.rateToUSD.toFixed(4)}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(Math.max(currency.rateToUSD * 100, 4), 100)}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className={`h-full ${positive ? 'bg-emerald-500' : 'bg-rose-400'}`}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Currency Converter ─────────────────────────────────────────────────────────

function CurrencyConverter() {
  const [from, setFrom] = useState<string>('USD');
  const [to, setTo] = useState<string>('INR');
  const [amount, setAmount] = useState<string>('1000');

  const parsedAmount = Number(amount) || 0;
  const converted = useMemo(
    () => convertCurrency(parsedAmount, from, to),
    [parsedAmount, from, to],
  );

  const fromCur = CURRENCIES.find((c) => c.code === from);
  const toCur = CURRENCIES.find((c) => c.code === to);
  const midRate = useMemo(
    () => (fromCur && toCur ? fromCur.rateToUSD / toCur.rateToUSD : 0),
    [fromCur, toCur],
  );

  function swap() {
    setFrom(to);
    setTo(from);
  }

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ArrowRightLeft className="h-4 w-4 text-emerald-400" />
          Currency Converter
          <Badge variant="outline" className="text-[9px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            Mid-market
          </Badge>
        </CardTitle>
        <p className="text-[11px] text-zinc-500">
          Convert between any supported currency at live mid-market rates.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          {/* From */}
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">From</label>
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger className="w-full border-white/10 bg-white/[0.02] text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-zinc-950 text-zinc-200">
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    <span className="inline-flex items-center gap-2">
                      <span>{c.flag}</span>
                      <span>{c.code}</span>
                      <span className="text-zinc-500">· {c.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-2 border-white/10 bg-white/[0.02] text-lg font-semibold text-zinc-100 placeholder:text-zinc-600"
              placeholder="0.00"
            />
          </div>

          {/* Swap button */}
          <div className="flex justify-center pb-1">
            <Button
              onClick={swap}
              size="icon"
              variant="outline"
              className="rounded-full border-emerald-500/30 bg-emerald-500/5 text-emerald-300 hover:bg-emerald-500/15 hover:text-emerald-200"
              aria-label="Swap currencies"
            >
              <ArrowRightLeft className="h-4 w-4" />
            </Button>
          </div>

          {/* To */}
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">To</label>
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger className="w-full border-white/10 bg-white/[0.02] text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-zinc-950 text-zinc-200">
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    <span className="inline-flex items-center gap-2">
                      <span>{c.flag}</span>
                      <span>{c.code}</span>
                      <span className="text-zinc-500">· {c.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="mt-2 flex h-10 items-center rounded-md border border-emerald-500/20 bg-emerald-500/[0.05] px-3 text-lg font-semibold text-emerald-300">
              {toCur?.symbol}{converted.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
        </div>

        {/* Mid-market rate display */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
            <div className="text-[9px] uppercase tracking-wide text-zinc-500">Mid-Market Rate</div>
            <div className="mt-1 text-sm font-semibold text-cyan-300">
              1 {from} = {midRate.toFixed(midRate < 0.01 ? 5 : 4)} {to}
            </div>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
            <div className="text-[9px] uppercase tracking-wide text-zinc-500">Inverse Rate</div>
            <div className="mt-1 text-sm font-semibold text-teal-300">
              1 {to} = {(1 / (midRate || 1)).toFixed(midRate > 100 ? 5 : 4)} {from}
            </div>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
            <div className="text-[9px] uppercase tracking-wide text-zinc-500">USD Equivalent</div>
            <div className="mt-1 text-sm font-semibold text-emerald-300">
              ${((fromCur?.rateToUSD ?? 0) * parsedAmount).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Exchange Rate History Chart ────────────────────────────────────────────────

interface TrendSeries {
  key: 'usdInr' | 'usdEur' | 'usdGbp' | 'usdJpy';
  label: string;
  color: string;
  glow: string;
  format: (v: number) => string;
}

const TREND_SERIES: TrendSeries[] = [
  { key: 'usdInr', label: 'USD → INR', color: '#10b981', glow: '#10b98144', format: (v) => v.toFixed(2) },
  { key: 'usdEur', label: 'USD → EUR', color: '#14b8a6', glow: '#14b8a644', format: (v) => v.toFixed(3) },
  { key: 'usdGbp', label: 'USD → GBP', color: '#06b6d4', glow: '#06b6d444', format: (v) => v.toFixed(3) },
  { key: 'usdJpy', label: 'USD → JPY', color: '#a78bfa', glow: '#a78bfa44', format: (v) => v.toFixed(1) },
];

function ExchangeRateChart() {
  // Build SVG line chart — normalize each series to 0..1 within its own min/max
  const months = EXCHANGE_RATE_HISTORY.map((d) => d.month);

  const seriesStats = TREND_SERIES.map((s) => {
    const values = EXCHANGE_RATE_HISTORY.map((d) => d[s.key]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return { ...s, values, min, max, range };
  });

  // Chart geometry
  const W = 720;
  const H = 280;
  const padL = 48;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const stepX = innerW / (months.length - 1);

  function pointFor(value: number, min: number, range: number, i: number) {
    const x = padL + stepX * i;
    const yNorm = (value - min) / range; // 0..1
    const y = padT + innerH - yNorm * innerH;
    return { x, y };
  }

  function pathFor(s: (typeof seriesStats)[number]) {
    return s.values
      .map((v, i) => {
        const { x, y } = pointFor(v, s.min, s.range, i);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  function areaFor(s: (typeof seriesStats)[number]) {
    const first = pointFor(s.values[0], s.min, s.range, 0);
    const last = pointFor(s.values[s.values.length - 1], s.min, s.range, s.values.length - 1);
    return `${pathFor(s)} L${last.x.toFixed(1)},${(padT + innerH).toFixed(1)} L${first.x.toFixed(1)},${(padT + innerH).toFixed(1)} Z`;
  }

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <LineChart className="h-4 w-4 text-emerald-400" />
              Exchange Rate History
            </CardTitle>
            <p className="text-[11px] text-zinc-500">
              6-month trend · Apr — Sep · each series normalized to its own min/max range.
            </p>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3">
            {seriesStats.map((s) => (
              <div key={s.key} className="inline-flex items-center gap-1.5 text-[11px]">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                <span className="text-zinc-300">{s.label}</span>
                <span className="font-mono text-zinc-500">
                  {s.format(s.values[s.values.length - 1])}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            style={{ minWidth: 640 }}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const y = padT + t * innerH;
              return (
                <g key={t}>
                  <line
                    x1={padL} y1={y} x2={W - padR} y2={y}
                    stroke="rgba(255,255,255,0.06)" strokeWidth={1}
                  />
                </g>
              );
            })}

            {/* X axis labels (months) */}
            {months.map((m, i) => {
              const x = padL + stepX * i;
              return (
                <text
                  key={m}
                  x={x}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize={11}
                  fill="rgba(161,161,170,0.8)"
                  fontFamily="ui-monospace, monospace"
                >
                  {m}
                </text>
              );
            })}

            {/* Series areas + lines */}
            {seriesStats.map((s) => (
              <g key={s.key}>
                <motion.path
                  d={areaFor(s)}
                  fill={s.glow}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6 }}
                />
                <motion.path
                  d={pathFor(s)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1, ease: 'easeInOut' }}
                />
                {/* Dots */}
                {s.values.map((v, i) => {
                  const { x, y } = pointFor(v, s.min, s.range, i);
                  return (
                    <motion.circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={3}
                      fill="#0a0a0a"
                      stroke={s.color}
                      strokeWidth={2}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.6 + i * 0.06, duration: 0.2 }}
                    />
                  );
                })}
              </g>
            ))}
          </svg>
        </div>

        {/* Stats grid below chart */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {seriesStats.map((s) => {
            const first = s.values[0];
            const last = s.values[s.values.length - 1];
            const delta = last - first;
            const pct = (delta / first) * 100;
            const positive = delta >= 0;
            return (
              <div key={s.key} className="rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
                  {s.label}
                </div>
                <div className="mt-1 text-sm font-semibold text-zinc-100">
                  {s.format(last)}
                </div>
                <div className={`text-[10px] inline-flex items-center gap-0.5 ${
                  positive ? 'text-emerald-300' : 'text-rose-300'
                }`}>
                  {positive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                  {positive ? '+' : ''}{pct.toFixed(2)}% · 6mo
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── KPI Tile ───────────────────────────────────────────────────────────────────

interface KpiTileProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  accent: 'emerald' | 'teal' | 'cyan' | 'violet';
}

const ACCENT_RING: Record<KpiTileProps['accent'], string> = {
  emerald: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  teal: 'text-teal-300 bg-teal-500/10 border-teal-500/20',
  cyan: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  violet: 'text-violet-300 bg-violet-500/10 border-violet-500/20',
};

function KpiTile({ icon: Icon, label, value, sub, accent }: KpiTileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm"
    >
      <div className="flex items-center gap-2">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${ACCENT_RING[accent]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[11px] uppercase tracking-wider text-zinc-400">{label}</span>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50">{value}</div>
      <div className="mt-1 text-[11px] text-zinc-500">{sub}</div>
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function MultiCurrencySystem() {
  const supportedCount = CURRENCIES.filter((c) => c.supported).length;
  const positiveCount = CURRENCIES.filter((c) => c.change24h > 0).length;
  const negativeCount = CURRENCIES.filter((c) => c.change24h < 0).length;

  const KPI_TILES: KpiTileProps[] = [
    {
      icon: Coins, label: 'Active Currencies', value: String(supportedCount),
      sub: 'Across 10 jurisdictions', accent: 'emerald',
    },
    {
      icon: TrendingUp, label: 'Gaining vs USD', value: String(positiveCount),
      sub: '24h change positive', accent: 'teal',
    },
    {
      icon: TrendingDown, label: 'Losing vs USD', value: String(negativeCount),
      sub: '24h change negative', accent: 'cyan',
    },
    {
      icon: DollarSign, label: 'Base Currency', value: 'USD',
      sub: 'Mid-market reference', accent: 'violet',
    },
  ];

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-20 h-80 w-80 rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute top-1/3 -right-20 h-96 w-96 rounded-full bg-teal-500/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {/* ─── Header ─────────────────────────────────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between"
        >
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-[10px] uppercase tracking-wider text-emerald-300">
              <Gauge className="h-3 w-3" /> Phase 14 · Global Expansion
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Multi-Currency System<span className="text-emerald-400">™</span>
            </h1>
            <p className="text-sm text-zinc-400">
              Live FX rates, multi-currency conversion & historical trends across {supportedCount} world currencies.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              <span className="relative mr-1.5 inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <Radio className="mr-1 h-3 w-3" /> Live Rates
            </Badge>
            <Badge variant="outline" className="border-teal-500/30 bg-teal-500/10 text-teal-300">
              <Activity className="mr-1 h-3 w-3" /> Updated 2s ago
            </Badge>
          </div>
        </motion.header>

        {/* ─── KPI Row ────────────────────────────────────────────────────────── */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {KPI_TILES.map((t) => <KpiTile key={t.label} {...t} />)}
        </section>

        {/* ─── Currency Cards Grid ────────────────────────────────────────────── */}
        <section className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <Banknote className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-zinc-200">Currency Cards</h2>
            <Badge variant="outline" className="text-[10px] border-white/10 bg-white/[0.02] text-zinc-400">
              {CURRENCIES.length} currencies
            </Badge>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {CURRENCIES.map((c, i) => <CurrencyCard key={c.code} currency={c} index={i} />)}
            </AnimatePresence>
          </div>
        </section>

        {/* ─── Converter + Chart ──────────────────────────────────────────────── */}
        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CurrencyConverter />
          <ExchangeRateChart />
        </section>

        {/* ─── Footer ─────────────────────────────────────────────────────────── */}
        <footer className="mt-6 flex flex-col items-center justify-between gap-2 border-t border-white/[0.06] pt-4 text-[10px] text-zinc-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <Gauge className="h-3 w-3 text-emerald-400" />
            Multi-Currency System™ · Phase 14 · {supportedCount} live rates · {EXCHANGE_RATE_HISTORY.length}-month history
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-3 w-3 text-teal-400" /> Founder & Owner: Prince Singh
          </div>
        </footer>
      </div>
    </div>
  );
}
