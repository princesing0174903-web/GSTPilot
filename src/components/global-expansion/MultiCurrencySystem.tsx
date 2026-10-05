'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 14: MULTI-CURRENCY SYSTEM™ (ENHANCED)
//
// Unified multi-currency console — live rate cards, converter, FX history chart,
// FX exposure dashboard, hedge strategy planner, risk heatmap, cash position
// by currency, and FX gain/loss attribution. Pure static data layer.
//
//   • Currency cards grid       — 9 currencies × rate, 24h change, supported badge
//   • Currency converter        — From/To/Amount → live converted value
//   • FX history chart          — 6-month trend for USD→INR/EUR/GBP/JPY
//   • FX Exposure Dashboard     — per currency exposure, hedge ratio, risk score
//   • Hedge Strategy Planner    — interactive — currency × amount × hedge % × instrument
//   • Currency Risk Heatmap     — grid of currencies × timeframes color-coded
//   • Cash Position by Currency — aggregated BANK_BALANCES per currency
//   • FX Gain/Loss Attribution  — breakdown of exchange gains/losses by currency
//
// Tagline: Every Currency. One Engine. Live Rates.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Coins, ArrowRightLeft, TrendingUp, TrendingDown, Activity,
  Gauge, Sparkles, LineChart, Radio, DollarSign, Banknote,
  Shield, PieChart, Grid3x3, Wallet, Scale, AlertTriangle,
  Layers, CalendarClock, Receipt, Landmark,
  type LucideIcon,
} from 'lucide-react';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CURRENCIES, EXCHANGE_RATE_HISTORY, convertCurrency, fmtPct, fmtUSD,
  FX_EXPOSURES, BANK_BALANCES, getCountry,
  type Currency, type FXExposure,
} from '@/lib/global/data';
import {
  FX_HEDGES, FX_FORWARD_CURVE, AR_AP_AGING, CASH_POOL,
  type FXHedge, type FXForwardPoint, type ARAPAging, type CashPoolPosition,
} from '@/lib/global/data-enterprise';

// ─── Currency Card ──────────────────────────────────────────────────────────────

function CurrencyCard({ currency, index }: { currency: Currency; index: number }) {
  const positive = currency.change24h >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: 'easeOut' as const }}
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
            transition={{ duration: 0.6, ease: 'easeOut' as const }}
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
  { key: 'usdInr', label: 'USD → INR', color: '#2563EB', glow: '#2563EB44', format: (v) => v.toFixed(2) },
  { key: 'usdEur', label: 'USD → EUR', color: '#14b8a6', glow: '#14b8a644', format: (v) => v.toFixed(3) },
  { key: 'usdGbp', label: 'USD → GBP', color: '#3B82F6', glow: '#3B82F644', format: (v) => v.toFixed(3) },
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
                  transition={{ duration: 1, ease: 'easeInOut' as const }}
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
      transition={{ duration: 0.35, ease: 'easeOut' as const }}
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

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED — FX Exposure Dashboard
// ═══════════════════════════════════════════════════════════════════════════════

function riskColor(score: number): { text: string; bg: string; ring: string; dot: string; label: string } {
  if (score >= 50) return { text: 'text-rose-300', bg: 'bg-rose-500/10', ring: 'border-rose-500/30', dot: 'bg-rose-400', label: 'High' };
  if (score >= 25) return { text: 'text-amber-300', bg: 'bg-amber-500/10', ring: 'border-amber-500/30', dot: 'bg-amber-400', label: 'Medium' };
  return { text: 'text-emerald-300', bg: 'bg-emerald-500/10', ring: 'border-emerald-500/30', dot: 'bg-emerald-400', label: 'Low' };
}

function FXExposureDashboard() {
  const totals = useMemo(() => {
    const totalExposure = FX_EXPOSURES.reduce((s, e) => s + e.exposure, 0);
    const totalHedged = FX_EXPOSURES.reduce((s, e) => s + e.hedged, 0);
    const totalUnhedged = FX_EXPOSURES.reduce((s, e) => s + e.unhedged, 0);
    const avgHedge = (totalHedged / totalExposure) * 100;
    return { totalExposure, totalHedged, totalUnhedged, avgHedge };
  }, []);

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-amber-400" />
              FX Exposure Dashboard
              <Badge variant="outline" className="text-[9px] border-amber-500/30 bg-amber-500/10 text-amber-300">
                {FX_EXPOSURES.length} currencies
              </Badge>
            </CardTitle>
            <p className="text-[11px] text-zinc-500">
              Per-currency exposure, hedge ratio, risk score, 30-day volatility &amp; forward rates.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-1.5">
              <div className="text-[9px] uppercase text-zinc-500">Total Exposure</div>
              <div className="text-xs font-semibold text-emerald-300">{fmtUSD(totals.totalExposure)}</div>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-1.5">
              <div className="text-[9px] uppercase text-zinc-500">Hedged</div>
              <div className="text-xs font-semibold text-teal-300">{fmtUSD(totals.totalHedged)}</div>
            </div>
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.05] px-2.5 py-1.5">
              <div className="text-[9px] uppercase text-rose-300/80">Unhedged</div>
              <div className="text-xs font-semibold text-rose-300">{fmtUSD(totals.totalUnhedged)}</div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FX_EXPOSURES.map((fx, i) => (
            <FXExposureCard key={fx.currency} fx={fx} index={i} />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
          <span className="text-[11px] text-zinc-400">Portfolio Hedge Ratio</span>
          <div className="flex items-center gap-2">
            <div className="h-2 w-32 overflow-hidden rounded-full bg-white/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${totals.avgHedge}%` }}
                transition={{ duration: 0.6 }}
                className="h-full bg-emerald-500"
              />
            </div>
            <span className="text-[11px] font-semibold text-emerald-300">{fmtPct(totals.avgHedge)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FXExposureCard({ fx, index }: { fx: FXExposure; index: number }) {
  const r = riskColor(fx.riskScore);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      whileHover={{ y: -2 }}
      className={`rounded-xl border ${r.ring} ${r.bg} p-3`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.08] bg-black/30 text-base">
            {fx.flag}
          </div>
          <div>
            <div className="text-xs font-semibold text-zinc-100">{fx.currency}</div>
            <div className="text-[9px] text-zinc-500">{fmtUSD(fx.exposure)}</div>
          </div>
        </div>
        <Badge variant="outline" className={`text-[9px] ${r.ring} ${r.text}`}>
          <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${r.dot}`} />
          {r.label}
        </Badge>
      </div>

      <div className="mt-2.5 space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-zinc-500">Hedge Ratio</span>
          <span className="font-mono text-zinc-300">{fmtPct(fx.hedgeRatio)}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${fx.hedgeRatio}%` }}
            transition={{ duration: 0.5 }}
            className="h-full bg-emerald-500"
          />
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-[10px]">
        <div className="rounded bg-black/30 px-1.5 py-1">
          <div className="text-[9px] text-zinc-500">Hedged</div>
          <div className="text-[11px] font-semibold text-teal-300">{fmtUSD(fx.hedged)}</div>
        </div>
        <div className="rounded bg-black/30 px-1.5 py-1">
          <div className="text-[9px] text-zinc-500">Unhedged</div>
          <div className="text-[11px] font-semibold text-rose-300">{fmtUSD(fx.unhedged)}</div>
        </div>
      </div>

      <Separator className="my-2 bg-white/[0.06]" />

      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        <div>
          <div className="text-[9px] text-zinc-500">30d Volatility</div>
          <div className={`text-[11px] font-mono ${r.text}`}>{fmtPct(fx.volatility30d)}</div>
        </div>
        <div>
          <div className="text-[9px] text-zinc-500">Risk Score</div>
          <div className={`text-[11px] font-mono ${r.text}`}>{fx.riskScore}/100</div>
        </div>
        <div>
          <div className="text-[9px] text-zinc-500">Spot</div>
          <div className="text-[11px] font-mono text-zinc-300">{fx.spotRate.toFixed(4)}</div>
        </div>
        <div>
          <div className="text-[9px] text-zinc-500">Forward</div>
          <div className="text-[11px] font-mono text-cyan-300">{fx.forwardRate.toFixed(4)}</div>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[9px] text-zinc-500">
        <span>Fwd Points: <span className="font-mono text-amber-300">{fx.forwardPoints}</span></span>
        <span>Fwd Premium: <span className="font-mono text-violet-300">{(((fx.forwardRate - fx.spotRate) / fx.spotRate) * 100).toFixed(2)}%</span></span>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED — Hedge Strategy Planner
// ═══════════════════════════════════════════════════════════════════════════════

type HedgeInstrument = 'Forward' | 'Swap' | 'Option';

const INSTRUMENT_COST: Record<HedgeInstrument, number> = {
  Forward: 0.15, // 0.15% of hedged amount
  Swap: 0.25,
  Option: 0.85,
};

function HedgeStrategyPlanner() {
  const [currency, setCurrency] = useState<string>('EUR');
  const [exposure, setExposure] = useState<string>('500000');
  const [hedgePct, setHedgePct] = useState<number>(60);
  const [instrument, setInstrument] = useState<HedgeInstrument>('Forward');

  const parsedExposure = Number(exposure) || 0;
  const hedgedAmount = (parsedExposure * hedgePct) / 100;
  const unhedgedAmount = parsedExposure - hedgedAmount;
  const costRate = INSTRUMENT_COST[instrument];
  const hedgeCost = (hedgedAmount * costRate) / 100;

  // Assume a deterministic worst-case FX move of 8% (based on volatility30d for high-risk currencies)
  const worstCase = 0.08;
  const unhedgedLoss = (unhedgedAmount * worstCase) / 100 * 100; // value at risk if unhedged
  const hedgedLoss = hedgeCost; // hedge cost replaces FX volatility
  const netBenefit = unhedgedLoss - hedgedLoss;

  const fxExp = FX_EXPOSURES.find((e) => e.currency === currency);

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="h-4 w-4 text-violet-400" />
          Hedge Strategy Planner
          <Badge variant="outline" className="text-[9px] border-violet-500/30 bg-violet-500/10 text-violet-300">
            Interactive
          </Badge>
        </CardTitle>
        <p className="text-[11px] text-zinc-500">
          Pick a currency, exposure &amp; hedge ratio — compare unhedged risk vs hedged cost across instruments.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">Currency</label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-full border-white/10 bg-white/[0.02] text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-zinc-950 text-zinc-200">
                {FX_EXPOSURES.map((e) => (
                  <SelectItem key={e.currency} value={e.currency}>
                    <span className="inline-flex items-center gap-2">
                      <span>{e.flag}</span><span>{e.currency}</span>
                      <span className="text-zinc-500">· risk {e.riskScore}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">Exposure (USD)</label>
            <Input
              type="number"
              min={0}
              value={exposure}
              onChange={(e) => setExposure(e.target.value)}
              className="border-white/10 bg-white/[0.02] text-zinc-100"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">Instrument</label>
            <Select value={instrument} onValueChange={(v) => setInstrument(v as HedgeInstrument)}>
              <SelectTrigger className="w-full border-white/10 bg-white/[0.02] text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-zinc-950 text-zinc-200">
                <SelectItem value="Forward">Forward Contract ({INSTRUMENT_COST.Forward}%)</SelectItem>
                <SelectItem value="Swap">FX Swap ({INSTRUMENT_COST.Swap}%)</SelectItem>
                <SelectItem value="Option">Currency Option ({INSTRUMENT_COST.Option}%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">
              Hedge Ratio: <span className="font-mono text-emerald-300">{hedgePct}%</span>
            </label>
            <div className="pt-2">
              <Slider
                value={[hedgePct]}
                onValueChange={(v) => setHedgePct(v[0])}
                min={0}
                max={100}
                step={5}
                className="text-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Live metrics */}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
            <div className="text-[9px] uppercase tracking-wide text-zinc-500">Total Exposure</div>
            <div className="mt-0.5 text-sm font-semibold text-zinc-100">{fmtUSD(parsedExposure)}</div>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
            <div className="text-[9px] uppercase tracking-wide text-emerald-300/80">Hedged Amount</div>
            <div className="mt-0.5 text-sm font-semibold text-emerald-300">{fmtUSD(hedgedAmount)}</div>
          </div>
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.05] p-3">
            <div className="text-[9px] uppercase tracking-wide text-rose-300/80">Unhedged Amount</div>
            <div className="mt-0.5 text-sm font-semibold text-rose-300">{fmtUSD(unhedgedAmount)}</div>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] p-3">
            <div className="text-[9px] uppercase tracking-wide text-amber-300/80">Hedge Cost ({costRate}%)</div>
            <div className="mt-0.5 text-sm font-semibold text-amber-300">{fmtUSD(hedgeCost)}</div>
          </div>
        </div>

        {/* Risk vs cost comparison */}
        <Separator className="my-3 bg-white/[0.06]" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.04] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-medium text-rose-200">Unhedged Risk</span>
              <Badge variant="outline" className="text-[9px] border-rose-500/30 bg-rose-500/10 text-rose-300">
                {fxExp ? `${fmtPct(fxExp.volatility30d)} vol` : '8% scenario'}
              </Badge>
            </div>
            <div className="text-xl font-bold text-rose-300">{fmtUSD(unhedgedLoss)}</div>
            <div className="mt-1 text-[10px] text-zinc-500">
              Potential loss if FX moves against you by {fmtPct(worstCase * 100)} (worst-case scenario).
            </div>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-medium text-emerald-200">Hedged Cost</span>
              <Badge variant="outline" className="text-[9px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                {instrument}
              </Badge>
            </div>
            <div className="text-xl font-bold text-emerald-300">{fmtUSD(hedgedLoss)}</div>
            <div className="mt-1 text-[10px] text-zinc-500">
              Cost of {instrument.toLowerCase()} contract at {costRate}% of hedged notional.
            </div>
          </div>
        </div>

        <div className={`mt-3 rounded-lg border p-3 ${netBenefit > 0 ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-amber-500/30 bg-amber-500/[0.06]'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {netBenefit > 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-300" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-300" />
              )}
              <span className="text-xs font-medium text-zinc-200">
                {netBenefit > 0 ? 'Hedging is recommended' : 'Hedge cost exceeds risk — review ratio'}
              </span>
            </div>
            <span className={`text-base font-bold ${netBenefit > 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
              {netBenefit > 0 ? '+' : '-'}{fmtUSD(Math.abs(netBenefit))}
            </span>
          </div>
          <div className="mt-1 text-[10px] text-zinc-500">
            Net benefit of hedging at {hedgePct}% ratio with {instrument.toLowerCase()} vs leaving exposure unhedged.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED — Currency Risk Heatmap
// ═══════════════════════════════════════════════════════════════════════════════

function heatColor(intensity: number): { bg: string; text: string } {
  // intensity 0..1
  if (intensity >= 0.75) return { bg: 'bg-rose-500/30', text: 'text-rose-200' };
  if (intensity >= 0.5) return { bg: 'bg-amber-500/25', text: 'text-amber-200' };
  if (intensity >= 0.25) return { bg: 'bg-teal-500/20', text: 'text-teal-200' };
  return { bg: 'bg-emerald-500/15', text: 'text-emerald-200' };
}

function CurrencyRiskHeatmap() {
  const timeframes = ['30d', '60d', '90d'];
  // Compute deterministic volatility per currency per timeframe using a step multiplier
  const rows = FX_EXPOSURES.map((fx) => {
    const v30 = fx.volatility30d;
    const v60 = fx.volatility30d * 1.35; // volatility scales sub-linearly with time
    const v90 = fx.volatility30d * 1.65;
    return { currency: fx.currency, flag: fx.flag, values: [v30, v60, v90] };
  });
  const maxV = Math.max(...rows.flatMap((r) => r.values));

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Grid3x3 className="h-4 w-4 text-cyan-400" />
          Currency Risk Heatmap
          <Badge variant="outline" className="text-[9px] border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
            {FX_EXPOSURES.length} × {timeframes.length}
          </Badge>
        </CardTitle>
        <p className="text-[11px] text-zinc-500">
          Projected volatility per currency across 30/60/90-day horizons — color-coded by risk intensity.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Currency</TableHead>
                {timeframes.map((tf) => (
                  <TableHead key={tf} className="text-center text-[10px] uppercase tracking-wider text-zinc-500">
                    {tf}
                  </TableHead>
                ))}
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Avg</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const avg = row.values.reduce((s, v) => s + v, 0) / row.values.length;
                return (
                  <TableRow key={row.currency} className="border-white/[0.04] hover:bg-white/[0.02]">
                    <TableCell className="py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{row.flag}</span>
                        <span className="text-xs font-medium text-zinc-200">{row.currency}</span>
                      </div>
                    </TableCell>
                    {row.values.map((v, i) => {
                      const intensity = maxV > 0 ? v / maxV : 0;
                      const c = heatColor(intensity);
                      return (
                        <TableCell key={i} className="text-center">
                          <div className={`mx-auto inline-flex h-9 w-16 items-center justify-center rounded-md border border-white/[0.04] ${c.bg}`}>
                            <span className={`text-[11px] font-mono font-semibold ${c.text}`}>{v.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right">
                      <span className="text-[11px] font-mono text-cyan-300">{avg.toFixed(2)}%</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm bg-emerald-500/30" /> Low (&lt; 25%)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm bg-teal-500/30" /> Moderate
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm bg-amber-500/30" /> Elevated
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm bg-rose-500/30" /> High (&ge; 75%)
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED — Cash Position by Currency
// ═══════════════════════════════════════════════════════════════════════════════

function CashPositionByCurrency() {
  const rows = useMemo(() => {
    const map = new Map<string, { balance: number; balanceUSD: number; available: number; pending: number }>();
    for (const b of BANK_BALANCES) {
      const cur = map.get(b.currency) ?? { balance: 0, balanceUSD: 0, available: 0, pending: 0 };
      cur.balance += b.balance;
      cur.balanceUSD += b.balanceUSD;
      cur.available += b.available;
      cur.pending += b.pending;
      map.set(b.currency, cur);
    }
    return Array.from(map.entries())
      .map(([currency, v]) => ({
        currency,
        flag: CURRENCIES.find((c) => c.code === currency)?.flag ?? '🏳️',
        name: CURRENCIES.find((c) => c.code === currency)?.name ?? currency,
        ...v,
      }))
      .sort((a, b) => b.balanceUSD - a.balanceUSD);
  }, []);

  const total = rows.reduce((s, r) => s + r.balanceUSD, 0);
  const totalAvailable = rows.reduce((s, r) => s + r.available, 0);
  const totalPending = rows.reduce((s, r) => s + r.pending, 0);

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-emerald-400" />
              Cash Position by Currency
              <Badge variant="outline" className="text-[9px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                {rows.length} currencies
              </Badge>
            </CardTitle>
            <p className="text-[11px] text-zinc-500">
              Aggregated bank balances per currency across all connected institutions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[9px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              Total: {fmtUSD(total)}
            </Badge>
            <Badge variant="outline" className="text-[9px] border-teal-500/30 bg-teal-500/10 text-teal-300">
              Available: {fmtUSD(totalAvailable)}
            </Badge>
            <Badge variant="outline" className="text-[9px] border-amber-500/30 bg-amber-500/10 text-amber-300">
              Pending: {fmtUSD(totalPending)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[420px] pr-2">
          <div className="space-y-2">
            {rows.map((r, i) => {
              const sharePct = total > 0 ? (r.balanceUSD / total) * 100 : 0;
              return (
                <motion.div
                  key={r.currency}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.03 }}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md border border-white/[0.08] bg-black/30 text-base">
                        {r.flag}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-zinc-100">{r.currency}</div>
                        <div className="text-[10px] text-zinc-500">{r.name}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-emerald-300">{fmtUSD(r.balanceUSD)}</div>
                      <div className="text-[10px] font-mono text-zinc-500">{r.currency} {r.balance.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-zinc-500">Portfolio share</span>
                      <span className="font-mono text-zinc-300">{fmtPct(sharePct)}</span>
                    </div>
                    <Progress value={sharePct} className="h-1.5 bg-white/5" />
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px]">
                    <div className="rounded bg-black/30 px-1.5 py-1">
                      <div className="text-[9px] text-zinc-500">Available</div>
                      <div className="text-[11px] font-semibold text-emerald-300">{fmtUSD(r.available)}</div>
                    </div>
                    <div className="rounded bg-black/30 px-1.5 py-1">
                      <div className="text-[9px] text-zinc-500">Pending</div>
                      <div className="text-[11px] font-semibold text-amber-300">{fmtUSD(r.pending)}</div>
                    </div>
                    <div className="rounded bg-black/30 px-1.5 py-1">
                      <div className="text-[9px] text-zinc-500">% Available</div>
                      <div className="text-[11px] font-semibold text-cyan-300">
                        {r.balance > 0 ? fmtPct((r.available / r.balance) * 100) : '0.0%'}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED — FX Gain/Loss Attribution
// ═══════════════════════════════════════════════════════════════════════════════

interface FxAttribution {
  currency: string;
  flag: string;
  realized: number; // realized gain/loss USD
  unrealized: number; // MTM gain/loss USD
  total: number;
  source: string;
}

const FX_ATTRIBUTIONS: FxAttribution[] = [
  { currency: 'EUR', flag: '🇪🇺', realized: 18400, unrealized: 6200, total: 24600, source: 'Receivables — DE/FR' },
  { currency: 'GBP', flag: '🇬🇧', realized: -8200, unrealized: 4100, total: -4100, source: 'Receivables — UK' },
  { currency: 'INR', flag: '🇮🇳', realized: 9600, unrealized: -2800, total: 6800, source: 'Payables — India ops' },
  { currency: 'JPY', flag: '🇯🇵', realized: -12400, unrealized: -3400, total: -15800, source: 'Vendor payments — JP' },
  { currency: 'AUD', flag: '🇦🇺', realized: 4200, unrealized: 1800, total: 6000, source: 'Receivables — AU' },
  { currency: 'CAD', flag: '🇨🇦', realized: -2400, unrealized: 1200, total: -1200, source: 'Payables — CA' },
  { currency: 'SGD', flag: '🇸🇬', realized: 5800, unrealized: 2200, total: 8000, source: 'Inter-company — SG' },
  { currency: 'AED', flag: '🇦🇪', realized: 800, unrealized: 0, total: 800, source: 'Receivables — UAE (pegged)' },
];

function FxGainLossAttribution() {
  const totalRealized = FX_ATTRIBUTIONS.reduce((s, a) => s + a.realized, 0);
  const totalUnrealized = FX_ATTRIBUTIONS.reduce((s, a) => s + a.unrealized, 0);
  const grandTotal = totalRealized + totalUnrealized;

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChart className="h-4 w-4 text-violet-400" />
              FX Gain/Loss Attribution
              <Badge variant="outline" className="text-[9px] border-violet-500/30 bg-violet-500/10 text-violet-300">
                Q3 FY24
              </Badge>
            </CardTitle>
            <p className="text-[11px] text-zinc-500">
              Realized &amp; unrealized FX gains/losses broken down by currency &amp; source.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[9px] border-amber-500/30 bg-amber-500/10 text-amber-300">
              Realized: {totalRealized >= 0 ? '+' : ''}{fmtUSD(totalRealized)}
            </Badge>
            <Badge variant="outline" className="text-[9px] border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
              Unrealized: {totalUnrealized >= 0 ? '+' : ''}{fmtUSD(totalUnrealized)}
            </Badge>
            <Badge variant="outline" className={`text-[9px] ${grandTotal >= 0 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/30 bg-rose-500/10 text-rose-300'}`}>
              Total: {grandTotal >= 0 ? '+' : ''}{fmtUSD(grandTotal)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[420px] pr-2">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Currency</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Source</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Realized</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Unrealized</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">Total</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-zinc-500">% of Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FX_ATTRIBUTIONS.map((a) => {
                const pct = grandTotal !== 0 ? (a.total / Math.abs(grandTotal)) * 100 : 0;
                return (
                  <TableRow key={a.currency} className="border-white/[0.04] hover:bg-white/[0.02]">
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{a.flag}</span>
                        <span className="text-xs font-medium text-zinc-200">{a.currency}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-[10px] text-zinc-400">{a.source}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`text-[11px] font-mono ${a.realized >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {a.realized >= 0 ? '+' : ''}{fmtUSD(a.realized)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`text-[11px] font-mono ${a.unrealized >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {a.unrealized >= 0 ? '+' : ''}{fmtUSD(a.unrealized)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`text-[11px] font-mono font-semibold ${a.total >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {a.total >= 0 ? '+' : ''}{fmtUSD(a.total)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-[11px] font-mono text-zinc-400">{pct.toFixed(1)}%</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className={`rounded-lg border p-3 ${grandTotal >= 0 ? 'border-emerald-500/20 bg-emerald-500/[0.05]' : 'border-rose-500/20 bg-rose-500/[0.05]'}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-400">Net FX P&amp;L Impact (Q3)</span>
              {grandTotal >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-300" />
              ) : (
                <TrendingDown className="h-4 w-4 text-rose-300" />
              )}
            </div>
            <div className={`mt-1 text-2xl font-bold ${grandTotal >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {grandTotal >= 0 ? '+' : ''}{fmtUSD(grandTotal)}
            </div>
            <div className="mt-1 text-[10px] text-zinc-500">
              Realized: {fmtUSD(totalRealized)} · Unrealized: {fmtUSD(totalUnrealized)}
            </div>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
            <div className="text-[11px] text-zinc-400 mb-2">Top Contributors</div>
            <div className="space-y-1.5">
              {[...FX_ATTRIBUTIONS].sort((a, b) => b.total - a.total).slice(0, 3).map((a) => (
                <div key={a.currency} className="flex items-center justify-between text-[10px]">
                  <span className="inline-flex items-center gap-1.5 text-zinc-300">
                    <span>{a.flag}</span> {a.currency}
                  </span>
                  <span className={`font-mono ${a.total >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {a.total >= 0 ? '+' : ''}{fmtUSD(a.total)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── FX Hedge Portfolio (Enterprise) ───────────────────────────────────────────

const INSTRUMENT_STYLE: Record<FXHedge['instrument'], string> = {
  Forward: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  Option: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  NDF: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  'Cross-Currency Swap': 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
};

const HEDGE_STATUS_STYLE: Record<FXHedge['status'], string> = {
  active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  matured: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400',
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
};

function FXHedgePortfolio() {
  const totalNotional = FX_HEDGES.reduce((s, h) => s + h.notionalUSD, 0);
  const activeHedges = FX_HEDGES.filter((h) => h.status === 'active');
  const avgRatio = activeHedges.length ? activeHedges.reduce((s, h) => s + h.hedgeRatio, 0) / activeHedges.length : 0;
  const avgEff = activeHedges.length ? activeHedges.reduce((s, h) => s + h.effectiveness, 0) / activeHedges.length : 0;

  const kpis = [
    { label: 'Total Notional', value: fmtUSD(totalNotional), sub: `${FX_HEDGES.length} instruments`, icon: Layers, accent: 'emerald' as const },
    { label: 'Active Hedges', value: `${activeHedges.length}`, sub: `${FX_HEDGES.length - activeHedges.length} matured/pending`, icon: Shield, accent: 'teal' as const },
    { label: 'Avg Hedge Ratio', value: fmtPct(avgRatio), sub: 'weighted across active', icon: Scale, accent: 'cyan' as const },
    { label: 'Avg Effectiveness', value: fmtPct(avgEff), sub: 'hedge accounting test', icon: Gauge, accent: 'violet' as const },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2">
              <k.icon className="h-4 w-4 text-emerald-400" />
              <span className="text-[11px] uppercase tracking-wider text-zinc-400">{k.label}</span>
            </div>
            <div className="mt-2 text-xl font-semibold text-zinc-50">{k.value}</div>
            <div className="mt-1 text-[10px] text-zinc-500">{k.sub}</div>
          </motion.div>
        ))}
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase text-zinc-500">Instrument</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500">Pair</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500">Dir</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500 text-right">Notional USD</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500 text-right">Rate</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500">Maturity</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500 text-right">Premium</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500 text-right">Hedge %</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500 text-right">Effect %</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500">Counterparty</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FX_HEDGES.map((h) => (
                <TableRow key={h.id} className="border-white/[0.04] hover:bg-white/[0.02]">
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${INSTRUMENT_STYLE[h.instrument]}`}>{h.instrument}</Badge>
                  </TableCell>
                  <TableCell className="text-[11px] font-medium text-zinc-200">{h.pair}</TableCell>
                  <TableCell className="text-[11px]">
                    <span className={h.direction === 'Buy' ? 'text-emerald-300' : 'text-amber-300'}>{h.direction}</span>
                  </TableCell>
                  <TableCell className="text-[11px] text-right font-mono text-zinc-200">{fmtUSD(h.notionalUSD)}</TableCell>
                  <TableCell className="text-[11px] text-right font-mono text-zinc-400">{h.rate.toFixed(4)}</TableCell>
                  <TableCell className="text-[11px] text-zinc-400">{h.maturity}</TableCell>
                  <TableCell className="text-[11px] text-right font-mono text-zinc-400">{h.premium > 0 ? fmtUSD(h.premium) : '—'}</TableCell>
                  <TableCell className="text-[11px] text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Progress value={h.hedgeRatio} className="h-1.5 w-10" />
                      <span className="font-mono text-zinc-300 w-8">{h.hedgeRatio}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-[11px] text-right font-mono">
                    <span className={h.effectiveness >= 95 ? 'text-emerald-300' : h.effectiveness >= 90 ? 'text-amber-300' : 'text-zinc-400'}>
                      {h.effectiveness > 0 ? `${h.effectiveness}%` : '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-[11px] text-zinc-400">{h.counterparty}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${HEDGE_STATUS_STYLE[h.status]}`}>{h.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// ─── FX Forward Curve (Enterprise) ─────────────────────────────────────────────

const TREND_ICON: Record<FXForwardPoint['trend'], string> = {
  up: 'text-emerald-300',
  down: 'text-amber-300',
  flat: 'text-zinc-400',
};

function FXForwardCurveTable() {
  const maxRate = Math.max(...FX_FORWARD_CURVE.map((f) => f.fwd1Y));

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2">
            <LineChart className="h-4 w-4 text-teal-400" />
            <span className="text-xs font-semibold text-zinc-200">FX Forward Curve — Spot vs 1M / 3M / 6M / 1Y</span>
          </div>
          <p className="mt-1 text-[10px] text-zinc-500">Forward points indicate interest rate differentials between currency pairs.</p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase text-zinc-500">Pair</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500 text-right">Spot</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500 text-right">1M Fwd</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500 text-right">3M Fwd</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500 text-right">6M Fwd</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500 text-right">1Y Fwd</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500">Trend</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500">Curve Shape</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FX_FORWARD_CURVE.map((f) => {
                const spotPct = (f.spot / maxRate) * 100;
                const y1Pct = (f.fwd1Y / maxRate) * 100;
                return (
                  <TableRow key={f.pair} className="border-white/[0.04] hover:bg-white/[0.02]">
                    <TableCell className="text-[11px] font-semibold text-zinc-100">{f.pair}</TableCell>
                    <TableCell className="text-[11px] text-right font-mono text-zinc-200">{f.spot.toFixed(4)}</TableCell>
                    <TableCell className="text-[11px] text-right font-mono text-zinc-400">{f.fwd1M.toFixed(4)}</TableCell>
                    <TableCell className="text-[11px] text-right font-mono text-zinc-400">{f.fwd3M.toFixed(4)}</TableCell>
                    <TableCell className="text-[11px] text-right font-mono text-zinc-400">{f.fwd6M.toFixed(4)}</TableCell>
                    <TableCell className="text-[11px] text-right font-mono text-emerald-300">{f.fwd1Y.toFixed(4)}</TableCell>
                    <TableCell>
                      <span className={`text-[11px] ${TREND_ICON[f.trend]}`}>
                        {f.trend === 'up' ? '▲' : f.trend === 'down' ? '▼' : '▬'} {f.trend}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <div className="h-2 rounded-sm bg-emerald-500/60" style={{ width: `${spotPct * 0.4}px` }} />
                        <div className="h-2 rounded-sm bg-teal-500/60" style={{ width: `${(y1Pct - spotPct) * 0.4}px` }} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// ─── AR/AP Aging by Country (Enterprise) ───────────────────────────────────────

function AgingCell({ amount, bucket }: { amount: number; bucket: 'current' | '30' | '60' | '90' }) {
  const colors: Record<typeof bucket, string> = {
    current: 'text-emerald-300',
    '30': 'text-amber-300',
    '60': 'text-orange-300',
    '90': 'text-red-300',
  };
  return <span className={`font-mono ${colors[bucket]}`}>{fmtUSD(amount)}</span>;
}

function ARAPAgingTable() {
  const totalAR = AR_AP_AGING.reduce((s, a) => s + a.receivablesTotal, 0);
  const totalAP = AR_AP_AGING.reduce((s, a) => s + a.payablesTotal, 0);
  const wDSO = AR_AP_AGING.reduce((s, a) => s + a.dso, 0) / AR_AP_AGING.length;
  const wDPO = AR_AP_AGING.reduce((s, a) => s + a.dpo, 0) / AR_AP_AGING.length;

  const kpis = [
    { label: 'Total Receivables', value: fmtUSD(totalAR), sub: 'across 10 countries', icon: Receipt, accent: 'emerald' as const },
    { label: 'Total Payables', value: fmtUSD(totalAP), sub: 'across 10 countries', icon: Receipt, accent: 'teal' as const },
    { label: 'Weighted DSO', value: `${wDSO.toFixed(0)} days`, sub: 'days sales outstanding', icon: CalendarClock, accent: 'cyan' as const },
    { label: 'Weighted DPO', value: `${wDPO.toFixed(0)} days`, sub: 'days payable outstanding', icon: CalendarClock, accent: 'violet' as const },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2">
              <k.icon className="h-4 w-4 text-emerald-400" />
              <span className="text-[11px] uppercase tracking-wider text-zinc-400">{k.label}</span>
            </div>
            <div className="mt-2 text-xl font-semibold text-zinc-50">{k.value}</div>
            <div className="mt-1 text-[10px] text-zinc-500">{k.sub}</div>
          </motion.div>
        ))}
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase text-zinc-500">Country</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500 text-right">AR Current</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500 text-right">AR 30d</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500 text-right">AR 60d</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500 text-right">AR 90d+</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500 text-right">AR Total</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500 text-right">AP Total</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500 text-right">DSO</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500 text-right">DPO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {AR_AP_AGING.map((a) => {
                const c = getCountry(a.countryCode);
                return (
                  <TableRow key={a.countryCode} className="border-white/[0.04] hover:bg-white/[0.02]">
                    <TableCell className="text-[11px] font-medium text-zinc-200">
                      <span className="mr-1.5">{c.flag}</span>{c.name}
                    </TableCell>
                    <TableCell className="text-[11px] text-right"><AgingCell amount={a.receivablesCurrent} bucket="current" /></TableCell>
                    <TableCell className="text-[11px] text-right"><AgingCell amount={a.receivables30} bucket="30" /></TableCell>
                    <TableCell className="text-[11px] text-right"><AgingCell amount={a.receivables60} bucket="60" /></TableCell>
                    <TableCell className="text-[11px] text-right"><AgingCell amount={a.receivables90} bucket="90" /></TableCell>
                    <TableCell className="text-[11px] text-right font-mono font-semibold text-zinc-100">{fmtUSD(a.receivablesTotal)}</TableCell>
                    <TableCell className="text-[11px] text-right font-mono text-zinc-400">{fmtUSD(a.payablesTotal)}</TableCell>
                    <TableCell className="text-[11px] text-right font-mono">
                      <span className={a.dso > 45 ? 'text-amber-300' : 'text-emerald-300'}>{a.dso}d</span>
                    </TableCell>
                    <TableCell className="text-[11px] text-right font-mono">
                      <span className={a.dpo < 45 ? 'text-amber-300' : 'text-emerald-300'}>{a.dpo}d</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// ─── Cash Pool Positions (Enterprise) ──────────────────────────────────────────

const SWEEP_STYLE: Record<CashPoolPosition['sweepStatus'], string> = {
  swept: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  manual: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400',
};

function CashPoolTable() {
  const totalPool = CASH_POOL.reduce((s, c) => s + c.balanceUSD, 0);
  const participants = CASH_POOL.filter((c) => c.accountType === 'Participant').length;
  const sweptCount = CASH_POOL.filter((c) => c.sweepStatus === 'swept').length;
  const avgRate = CASH_POOL.reduce((s, c) => s + c.interestRate, 0) / CASH_POOL.length;

  const kpis = [
    { label: 'Total Pool USD', value: fmtUSD(totalPool), sub: `${CASH_POOL.length} accounts`, icon: Landmark, accent: 'emerald' as const },
    { label: 'Participants', value: `${participants}`, sub: '1 header account', icon: Layers, accent: 'teal' as const },
    { label: 'Avg Interest', value: `${avgRate.toFixed(2)}%`, sub: 'across all accounts', icon: Gauge, accent: 'cyan' as const },
    { label: 'Sweep Automation', value: `${((sweptCount / CASH_POOL.length) * 100).toFixed(0)}%`, sub: `${sweptCount}/${CASH_POOL.length} auto-swept`, icon: Activity, accent: 'violet' as const },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2">
              <k.icon className="h-4 w-4 text-emerald-400" />
              <span className="text-[11px] uppercase tracking-wider text-zinc-400">{k.label}</span>
            </div>
            <div className="mt-2 text-xl font-semibold text-zinc-50">{k.value}</div>
            <div className="mt-1 text-[10px] text-zinc-500">{k.sub}</div>
          </motion.div>
        ))}
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase text-zinc-500">Entity</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500">Country</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500">Type</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500 text-right">Balance</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500">Currency</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500 text-right">Balance USD</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500">Sweep</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500 text-right">Rate</TableHead>
                <TableHead className="text-[10px] uppercase text-zinc-500">Last Sweep</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CASH_POOL.map((c) => {
                const country = getCountry(c.countryCode);
                const isHeader = c.accountType === 'Header';
                return (
                  <TableRow key={c.id} className={`border-white/[0.04] hover:bg-white/[0.02] ${isHeader ? 'bg-emerald-500/[0.04]' : ''}`}>
                    <TableCell className="text-[11px] font-medium text-zinc-200">{c.entity}</TableCell>
                    <TableCell className="text-[11px]"><span className="mr-1">{country.flag}</span>{country.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${isHeader ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400'}`}>
                        {c.accountType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[11px] text-right font-mono text-zinc-300">{c.balance.toLocaleString('en-US')}</TableCell>
                    <TableCell className="text-[11px] text-zinc-400">{c.currency}</TableCell>
                    <TableCell className="text-[11px] text-right font-mono font-semibold text-zinc-100">{fmtUSD(c.balanceUSD)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${SWEEP_STYLE[c.sweepStatus]}`}>{c.sweepStatus}</Badge>
                    </TableCell>
                    <TableCell className="text-[11px] text-right font-mono text-zinc-400">{c.interestRate.toFixed(2)}%</TableCell>
                    <TableCell className="text-[11px] text-zinc-500">{c.lastSweep}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function MultiCurrencySystem() {
  const [sectionTab, setSectionTab] = useState<'exposure' | 'hedge' | 'heatmap' | 'cash' | 'attrib' | 'hedges' | 'curve' | 'aging' | 'pool'>('exposure');

  const supportedCount = CURRENCIES.filter((c) => c.supported).length;
  const positiveCount = CURRENCIES.filter((c) => c.change24h > 0).length;
  const negativeCount = CURRENCIES.filter((c) => c.change24h < 0).length;
  const totalExposure = FX_EXPOSURES.reduce((s, e) => s + e.exposure, 0);

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
      icon: Shield, label: 'Total FX Exposure', value: fmtUSD(totalExposure),
      sub: `Across ${FX_EXPOSURES.length} currencies`, accent: 'violet',
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
              Live FX rates, exposure dashboard, hedge planner, risk heatmap, cash position &amp; gain/loss attribution.
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

        {/* ─── Deep Dives: tabbed enterprise sections ─────────────────────────── */}
        <section className="mt-6">
          <TooltipProvider delayDuration={200}>
            <Tabs value={sectionTab} onValueChange={(v) => setSectionTab(v as typeof sectionTab)}>
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-teal-400" />
                  <h2 className="text-sm font-semibold text-zinc-200">Treasury Deep Dives</h2>
                </div>
                <TabsList className="bg-white/[0.03] h-9 overflow-x-auto">
                  <TabsTrigger value="exposure" className="text-[11px]">
                    <Shield className="mr-1 h-3 w-3" /> FX Exposure
                  </TabsTrigger>
                  <TabsTrigger value="hedge" className="text-[11px]">
                    <Scale className="mr-1 h-3 w-3" /> Hedge Planner
                  </TabsTrigger>
                  <TabsTrigger value="heatmap" className="text-[11px]">
                    <Grid3x3 className="mr-1 h-3 w-3" /> Risk Heatmap
                  </TabsTrigger>
                  <TabsTrigger value="cash" className="text-[11px]">
                    <Wallet className="mr-1 h-3 w-3" /> Cash Position
                  </TabsTrigger>
                  <TabsTrigger value="attrib" className="text-[11px]">
                    <PieChart className="mr-1 h-3 w-3" /> Gain/Loss
                  </TabsTrigger>
                  <TabsTrigger value="hedges" className="text-[11px]">
                    <Layers className="mr-1 h-3 w-3" /> Hedge Portfolio
                  </TabsTrigger>
                  <TabsTrigger value="curve" className="text-[11px]">
                    <LineChart className="mr-1 h-3 w-3" /> Forward Curve
                  </TabsTrigger>
                  <TabsTrigger value="aging" className="text-[11px]">
                    <Receipt className="mr-1 h-3 w-3" /> AR/AP Aging
                  </TabsTrigger>
                  <TabsTrigger value="pool" className="text-[11px]">
                    <Landmark className="mr-1 h-3 w-3" /> Cash Pool
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="exposure" className="mt-0">
                <FXExposureDashboard />
              </TabsContent>
              <TabsContent value="hedge" className="mt-0">
                <HedgeStrategyPlanner />
              </TabsContent>
              <TabsContent value="heatmap" className="mt-0">
                <CurrencyRiskHeatmap />
              </TabsContent>
              <TabsContent value="cash" className="mt-0">
                <CashPositionByCurrency />
              </TabsContent>
              <TabsContent value="attrib" className="mt-0">
                <FxGainLossAttribution />
              </TabsContent>
              <TabsContent value="hedges" className="mt-0">
                <FXHedgePortfolio />
              </TabsContent>
              <TabsContent value="curve" className="mt-0">
                <FXForwardCurveTable />
              </TabsContent>
              <TabsContent value="aging" className="mt-0">
                <ARAPAgingTable />
              </TabsContent>
              <TabsContent value="pool" className="mt-0">
                <CashPoolTable />
              </TabsContent>
            </Tabs>
          </TooltipProvider>
        </section>

        {/* ─── Footer ─────────────────────────────────────────────────────────── */}
        <footer className="mt-6 flex flex-col items-center justify-between gap-2 border-t border-white/[0.06] pt-4 text-[10px] text-zinc-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <Gauge className="h-3 w-3 text-emerald-400" />
            Multi-Currency System™ · Phase 14 · {supportedCount} live rates · {FX_EXPOSURES.length} exposures · {EXCHANGE_RATE_HISTORY.length}-month history · {FX_HEDGES.length} hedges · {CASH_POOL.length} cash pool accounts · {AR_AP_AGING.length} aging jurisdictions
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-3 w-3 text-teal-400" /> Founder &amp; Owner: Prince Singh
          </div>
        </footer>
      </div>
    </div>
  );
}
