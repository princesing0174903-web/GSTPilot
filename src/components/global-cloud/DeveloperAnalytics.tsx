'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 16: DEVELOPER ANALYTICS CLOUD
//
// API Usage · Errors · Latency · Revenue · Apps · Downloads · Subscriptions
//
// Real-time observability for every API call, error, SDK download and developer
// app on the GSTPilot open platform — serving 2.4M developers and 4,820 apps.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowUp, ArrowDown, BarChart3, Code2, Activity, AlertTriangle,
  Download, TrendingUp, Zap, Gauge, Boxes, Globe2, Server, Cpu, Clock,
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
  API_USAGE_SERIES, API_ERROR_TYPES, TOP_DEVELOPER_APPS, DEVELOPER_KPIS, SDKS,
  ACCENT_CLASSES, fmt, fmtN, fmtPct, type Accent,
} from '@/lib/global-cloud/data';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

// ─── Error code severity colors ────────────────────────────────────────────────
const ERROR_SEVERITY: Record<string, { accent: Accent; label: string }> = {
  '429': { accent: 'violet', label: '429' },
  '401': { accent: 'rose',   label: '401' },
  '400': { accent: 'violet', label: '400' },
  '500': { accent: 'rose',   label: '500' },
  '403': { accent: 'amber',  label: '403' },
  '404': { accent: 'teal',   label: '404' },
  '503': { accent: 'rose',   label: '503' },
};

// ─── Latency distribution buckets (deterministic, sums to 100%) ────────────────
const LATENCY_BUCKETS: { range: string; pct: number; band: 'fast' | 'medium' | 'slow' }[] = [
  { range: '0-50ms',     pct: 32.0, band: 'fast'   },
  { range: '50-100ms',   pct: 28.0, band: 'fast'   },
  { range: '100-150ms',  pct: 18.0, band: 'fast'   },
  { range: '150-200ms',  pct: 10.0, band: 'medium' },
  { range: '200-300ms',  pct:  6.0, band: 'medium' },
  { range: '300-500ms',  pct:  4.0, band: 'medium' },
  { range: '500-1000ms', pct:  1.5, band: 'slow'   },
  { range: '1000ms+',    pct:  0.5, band: 'slow'   },
];

const LATENCY_BAND_COLOR: Record<'fast' | 'medium' | 'slow', { bar: string; text: string }> = {
  fast:   { bar: 'bg-emerald-500', text: 'text-emerald-300' },
  medium: { bar: 'bg-amber-500',   text: 'text-amber-300'   },
  slow:   { bar: 'bg-rose-500',    text: 'text-rose-300'    },
};

// ─── Header KPI tiles count ────────────────────────────────────────────────────
const HEADER_KPIS_LOCAL = [
  { label: 'MRR',       value: '$24.6M', sub: '+12.4% MoM',  accent: 'emerald' as Accent },
  { label: 'ARR',       value: '$295M',  sub: '+18.2% YoY',  accent: 'teal'    as Accent },
  { label: 'Customers', value: '349K',   sub: '+8.4K new',   accent: 'cyan'    as Accent },
  { label: 'Avg Churn', value: '1.8%',   sub: '-0.3% MoM',   accent: 'violet'  as Accent },
];

export default function DeveloperAnalytics() {
  const { setCurrentView } = useApp();

  // ─── Peak call hour for highlighting ────────────────────────────────────────
  const peakCalls = useMemo(
    () => Math.max(...API_USAGE_SERIES.map((s) => s.calls)),
    [],
  );
  const peakIdx = API_USAGE_SERIES.findIndex((s) => s.calls === peakCalls);

  // ─── Total SDK downloads (30d approx = weekly × 4.3) ────────────────────────
  const totalSdkDownloads = SDKS.reduce((a, s) => a + s.weeklyDownloads, 0);
  const monthlySdkDownloads = totalSdkDownloads * 4.3; // ~30 days
  const sdkBreakdown = SDKS.map((s) => ({
    ...s,
    pct: (s.weeklyDownloads / totalSdkDownloads) * 100,
  }));

  // ─── Aggregated analytics totals ────────────────────────────────────────────
  const totalCalls24h = API_USAGE_SERIES.reduce((a, s) => a + s.calls, 0);
  const totalErrors24h = API_USAGE_SERIES.reduce((a, s) => a + s.errors, 0);
  const errorRate = (totalErrors24h / totalCalls24h) * 100;

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
            <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl" />
            <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
          </div>

          <div className="relative z-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="border-teal-500/30 bg-teal-500/10 text-teal-300">
                    <BarChart3 className="mr-1.5 h-3 w-3" />
                    Phase 16 · Module 10
                  </Badge>
                  <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                    <Activity className="mr-1.5 h-3 w-3" />
                    Real-time · 2.4M developers
                  </Badge>
                </div>
                <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                  Developer Analytics
                  <span className="ml-2 bg-gradient-to-r from-teal-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">™</span>
                </h1>
                <p className="mt-2 text-sm text-white/55">
                  API Usage · Errors · Latency · Revenue · Apps · Downloads · Subscriptions
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

            {/* KPI grid 4×2 */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {DEVELOPER_KPIS.map((kpi, i) => {
                const a = ACCENT_CLASSES[kpi.accent];
                const isPositive = kpi.trend >= 0;
                return (
                  <motion.div
                    key={kpi.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 + i * 0.03 }}
                    className={cn('rounded-2xl border p-4', a.border, a.bg)}
                  >
                    <div className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                      {kpi.label}
                    </div>
                    <div className={cn('mt-1 text-2xl font-bold', a.text)}>{kpi.value}</div>
                    <div className="mt-1 flex items-center gap-1 text-[11px]">
                      {isPositive ? (
                        <ArrowUp className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-emerald-400" />
                      )}
                      <span className="text-emerald-400">{fmtPct(kpi.trend)}</span>
                      <span className="text-white/40">vs last period</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* ─── API USAGE CHART ───────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                  <BarChart3 className="h-4 w-4 text-teal-300" />
                  API Usage · 24h Volume
                  <span className="ml-1 text-xs font-normal text-white/40">
                    ({fmtN(totalCalls24h)} calls · {fmtN(totalErrors24h)} errors · {errorRate.toFixed(3)}% rate)
                  </span>
                </CardTitle>
                <div className="flex items-center gap-3 text-[11px] text-white/50">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-sm bg-teal-500" />
                    <span>Calls</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-sm bg-rose-500" />
                    <span>Errors</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-sm bg-amber-400" />
                    <span>Peak hour</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Chart */}
              <div className="flex h-64 items-end gap-2 sm:gap-3">
                {API_USAGE_SERIES.map((s, idx) => {
                  const heightPct = (s.calls / peakCalls) * 100;
                  const isPeak = idx === peakIdx;
                  const errorHeightPct = Math.max((s.errors / s.calls) * 100 * 6, 3); // amplified for visibility
                  return (
                    <motion.div
                      key={s.hour}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: `${heightPct}%` }}
                      transition={{ duration: 0.5, delay: 0.1 + idx * 0.04 }}
                      className="group relative flex h-full flex-1 flex-col justify-end"
                    >
                      {/* Tooltip */}
                      <div className="pointer-events-none absolute -top-12 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/[0.08] bg-black/95 px-2 py-1 text-[10px] text-white shadow-lg group-hover:block">
                        <div className="font-mono">{s.hour}</div>
                        <div className="text-teal-300">{fmtN(s.calls)} calls</div>
                        <div className="text-rose-300">{fmtN(s.errors)} errors</div>
                      </div>

                      {/* Bar container */}
                      <div className="relative w-full overflow-hidden rounded-t-md">
                        {/* Calls bar */}
                        <div
                          className={cn(
                            'w-full rounded-t-md transition-colors',
                            isPeak ? 'bg-amber-400' : 'bg-gradient-to-t from-teal-500/60 to-teal-400',
                          )}
                        >
                          {/* Error overlay at bottom */}
                          <div
                            className="absolute bottom-0 left-0 w-full bg-rose-500/90"
                            style={{ height: `${errorHeightPct}%` }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* X-axis labels (every 4 hours) */}
              <div className="mt-2 flex gap-2 sm:gap-3">
                {API_USAGE_SERIES.map((s, idx) => (
                  <div
                    key={s.hour}
                    className={cn(
                      'flex-1 text-center font-mono text-[10px]',
                      idx % 2 === 0 ? 'text-white/60' : 'text-white/30',
                      idx === peakIdx && 'text-amber-400 font-semibold',
                    )}
                  >
                    {s.hour}
                  </div>
                ))}
              </div>

              {/* Footer stats */}
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/40">Peak hour</div>
                  <div className="mt-0.5 text-lg font-bold text-amber-400">14:00 IST</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/40">Peak calls</div>
                  <div className="mt-0.5 text-lg font-bold text-teal-300">{fmtN(peakCalls)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/40">Avg errors/hr</div>
                  <div className="mt-0.5 text-lg font-bold text-rose-300">{fmtN(totalErrors24h / API_USAGE_SERIES.length)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/40">Healthy rate</div>
                  <div className="mt-0.5 text-lg font-bold text-emerald-300">{(100 - errorRate).toFixed(3)}%</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── ERROR TYPES TABLE ─────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                <AlertTriangle className="h-4 w-4 text-rose-300" />
                Error Types Breakdown
                <span className="ml-1 text-xs font-normal text-white/40">
                  (Top {API_ERROR_TYPES.length} HTTP errors · last 24h)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead className="w-20 text-white/50">Code</TableHead>
                      <TableHead className="text-white/50">Message</TableHead>
                      <TableHead className="text-right text-white/50">Count (24h)</TableHead>
                      <TableHead className="text-right text-white/50">Trend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {API_ERROR_TYPES.map((e) => {
                      const sev = ERROR_SEVERITY[e.code] ?? { accent: 'amber' as Accent, label: e.code };
                      const a = ACCENT_CLASSES[sev.accent];
                      const improving = e.trend < 0; // negative trend = fewer errors = good
                      return (
                        <TableRow key={e.code} className="border-white/[0.06] hover:bg-white/[0.02]">
                          <TableCell className="py-3">
                            <Badge variant="outline" className={cn('font-mono', a.border, a.bg, a.text)}>
                              {sev.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3 text-sm text-white/80">{e.message}</TableCell>
                          <TableCell className="py-3 text-right font-mono text-sm text-white">
                            {fmtN(e.count)}
                          </TableCell>
                          <TableCell className="py-3 text-right">
                            <span className={cn(
                              'inline-flex items-center gap-1 text-xs font-semibold',
                              improving ? 'text-emerald-400' : 'text-rose-400',
                            )}>
                              {improving ? (
                                <ArrowDown className="h-3 w-3" />
                              ) : (
                                <ArrowUp className="h-3 w-3" />
                              )}
                              {fmtPct(e.trend)}
                            </span>
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

        {/* ─── TOP DEVELOPER APPS ───────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                <Boxes className="h-4 w-4 text-cyan-300" />
                Top Developer Apps
                <span className="ml-1 text-xs font-normal text-white/40">
                  (Top {TOP_DEVELOPER_APPS.length} by 24h call volume)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {TOP_DEVELOPER_APPS.map((app, idx) => {
                  const a = ACCENT_CLASSES[app.accent];
                  const errorColor = app.errorRate < 0.03 ? 'text-emerald-300' :
                    app.errorRate < 0.06 ? 'text-amber-300' : 'text-rose-300';
                  const trendPositive = app.trend >= 0;
                  return (
                    <motion.div
                      key={app.name}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.05 + idx * 0.04 }}
                      className={cn('rounded-2xl border p-4', a.border, a.bg)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg border', a.border, 'bg-black/30')}>
                            <Code2 className={cn('h-4 w-4', a.text)} />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white">{app.name}</div>
                            <div className="text-[10px] text-white/50">{app.publisher}</div>
                          </div>
                        </div>
                        <span className={cn(
                          'inline-flex items-center gap-0.5 text-xs font-semibold',
                          trendPositive ? 'text-emerald-400' : 'text-rose-400',
                        )}>
                          {trendPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                          {fmtPct(app.trend)}
                        </span>
                      </div>

                      <Separator className="my-3 bg-white/[0.06]" />

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-white/40">Calls/24h</div>
                          <div className={cn('mt-0.5 text-sm font-bold', a.text)}>{fmtN(app.calls24h)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-white/40">Error rate</div>
                          <div className={cn('mt-0.5 text-sm font-bold', errorColor)}>
                            {(app.errorRate * 100).toFixed(2)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-white/40">Revenue MTD</div>
                          <div className={cn('mt-0.5 text-sm font-bold', a.text)}>{fmt(app.revenue)}</div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── LATENCY DISTRIBUTION ─────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                <Gauge className="h-4 w-4 text-violet-300" />
                Latency Distribution
                <span className="ml-1 text-xs font-normal text-white/40">
                  (P50 84ms · P95 124ms · P99 312ms)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-56 items-end gap-2 sm:gap-4">
                {LATENCY_BUCKETS.map((b, idx) => {
                  const c = LATENCY_BAND_COLOR[b.band];
                  const heightPct = (b.pct / LATENCY_BUCKETS[0].pct) * 100;
                  return (
                    <motion.div
                      key={b.range}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.1 + idx * 0.05 }}
                      className="flex h-full flex-1 flex-col items-center justify-end"
                    >
                      <div className={cn('mb-1 text-xs font-semibold', c.text)}>
                        {b.pct.toFixed(1)}%
                      </div>
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${heightPct}%` }}
                        transition={{ duration: 0.5, delay: 0.15 + idx * 0.05 }}
                        className={cn('w-full rounded-t-md', c.bar)}
                        style={{ minHeight: '4px' }}
                      />
                      <div className="mt-2 text-center font-mono text-[9px] text-white/40">
                        {b.range}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-white/[0.06] pt-4 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-sm bg-emerald-500" />
                  <span className="text-white/60">Fast (&lt;150ms) — {LATENCY_BUCKETS.filter(b => b.band === 'fast').reduce((a, b) => a + b.pct, 0).toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-sm bg-amber-500" />
                  <span className="text-white/60">Medium (150-500ms) — {LATENCY_BUCKETS.filter(b => b.band === 'medium').reduce((a, b) => a + b.pct, 0).toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-sm bg-rose-500" />
                  <span className="text-white/60">Slow (&gt;500ms) — {LATENCY_BUCKETS.filter(b => b.band === 'slow').reduce((a, b) => a + b.pct, 0).toFixed(1)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── SDK DOWNLOADS TREND ──────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                  <Download className="h-4 w-4 text-amber-300" />
                  SDK Downloads · 30-day Trend
                  <span className="ml-1 text-xs font-normal text-white/40">
                    ({SDKS.length} official SDKs)
                  </span>
                </CardTitle>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-white/40">Total 30d</div>
                    <div className="text-xl font-bold text-amber-300">{fmtN(monthlySdkDownloads)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-white/40">Weekly</div>
                    <div className="text-xl font-bold text-teal-300">{fmtN(totalSdkDownloads)}</div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {sdkBreakdown.map((sdk, idx) => {
                  const a = ACCENT_CLASSES[sdk.accent];
                  return (
                    <motion.div
                      key={sdk.language}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, delay: idx * 0.04 }}
                      className="flex items-center gap-3"
                    >
                      <div className="w-20 shrink-0 text-xs font-medium text-white">{sdk.language}</div>
                      <div className="flex-1">
                        <div className="h-6 overflow-hidden rounded-md bg-black/40">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${sdk.pct}%` }}
                            transition={{ duration: 0.5, delay: 0.15 + idx * 0.04 }}
                            className={cn('flex h-full items-center justify-end rounded-md px-2', a.bar)}
                          >
                            <span className="text-[10px] font-mono font-semibold text-black/80">
                              {sdk.pct.toFixed(1)}%
                            </span>
                          </motion.div>
                        </div>
                      </div>
                      <div className="w-20 shrink-0 text-right font-mono text-xs text-white/70">
                        {fmtN(sdk.weeklyDownloads)}/wk
                      </div>
                      <div className="hidden w-32 shrink-0 text-right font-mono text-[10px] text-white/40 sm:block">
                        v{sdk.version}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── TAGLINE ──────────────────────────────────────────────────── */}
        <div className="mt-6 flex items-center justify-center gap-2 text-center">
          <TrendingUp className="h-3.5 w-3.5 text-white/30" />
          <p className="text-[11px] text-white/40">
            Every call. Every error. Every developer. One console. — GSTPilot Infinity™
          </p>
        </div>
      </div>
    </div>
  );
}
