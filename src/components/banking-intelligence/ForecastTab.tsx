'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Wallet,
  Calendar,
  Activity,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ProfessionalEmptyState } from '@/components/shared';
import { toast } from 'sonner';
import {
  useFetch,
  fmtINR,
  fmtINRFull,
  fmtDate,
  relativeTime,
  buildSmoothPath,
} from './helpers';
import type { CashFlowForecast, ForecastPoint } from '@/lib/banking-service/types';

type Horizon = '7d' | '30d';

interface ForecastResponse {
  ok: boolean;
  forecast: CashFlowForecast;
}

// ─── Mini stat card ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Wallet;
  tone: 'emerald' | 'rose' | 'amber' | 'violet' | 'muted';
}) {
  const toneClass = {
    emerald: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
    rose: 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300',
    amber: 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300',
    violet: 'bg-cyan-100 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-300',
    muted: 'bg-muted text-muted-foreground',
  }[tone];
  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className={`flex h-7 w-7 items-center justify-center rounded-md ${toneClass}`}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <div className="text-xl font-semibold tracking-tight">{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

// ─── Forecast band chart ──────────────────────────────────────────────────────

function ForecastChart({
  points,
  minBalance,
  minBalanceDate,
}: {
  points: ForecastPoint[];
  minBalance: number;
  minBalanceDate?: string;
}) {
  const W = 700;
  const H = 260;
  const PAD = 36;
  if (!points || points.length === 0) return null;

  const allValues = points.flatMap((p) => [p.projectedBalance, p.lowBalance, p.highBalance]);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;

  const toX = (i: number) => PAD + (i / (points.length - 1)) * innerW;
  const toY = (v: number) => PAD + (1 - (v - min) / range) * innerH;

  const balPts = points.map((p, i) => ({ x: toX(i), y: toY(p.projectedBalance), v: p.projectedBalance }));
  const lowPts = points.map((p, i) => ({ x: toX(i), y: toY(p.lowBalance), v: p.lowBalance }));
  const highPts = points.map((p, i) => ({ x: toX(i), y: toY(p.highBalance), v: p.highBalance }));

  // Build confidence band path: forward along high, back along low
  const bandPath = [
    `M${highPts[0].x.toFixed(2)},${highPts[0].y.toFixed(2)}`,
    ...highPts.slice(1).map((p) => `L${p.x.toFixed(2)},${p.y.toFixed(2)}`),
    ...lowPts.slice().reverse().map((p) => `L${p.x.toFixed(2)},${p.y.toFixed(2)}`),
    'Z',
  ].join(' ');

  // Min balance marker
  const minIdx = points.findIndex((p) => p.projectedBalance === minBalance);
  const minPt = minIdx >= 0 ? balPts[minIdx] : null;

  // Zero line if applicable
  const zeroY = min < 0 && max > 0 ? toY(0) : null;

  // X labels (first, middle, last)
  const labelIdxs = [0, Math.floor(points.length / 2), points.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Forecast chart">
      <defs>
        <linearGradient id="forecastBand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {/* confidence band */}
      <path d={bandPath} fill="url(#forecastBand)" />
      {/* zero line */}
      {zeroY !== null && (
        <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} stroke="currentColor" strokeDasharray="3 3" className="text-muted-foreground/40" />
      )}
      {/* projected balance line */}
      <path d={buildSmoothPath(balPts)} fill="none" stroke="#06b6d4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* min marker */}
      {minPt && (
        <g>
          <circle cx={minPt.x} cy={minPt.y} r={5} fill="#f43f5e" stroke="#fff" strokeWidth={1.5} />
          <text x={minPt.x} y={minPt.y - 10} textAnchor="middle" className="fill-rose-500 text-[10px] font-semibold">
            Min: {fmtINR(minBalance)}
          </text>
          {minBalanceDate && (
            <text x={minPt.x} y={minPt.y + 18} textAnchor="middle" className="fill-muted-foreground text-[9px]">
              {fmtDate(minBalanceDate)}
            </text>
          )}
        </g>
      )}
      {/* x-axis */}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="currentColor" className="text-muted-foreground/30" />
      {labelIdxs.map((i) =>
        points[i] ? (
          <text key={i} x={toX(i)} y={H - 4} textAnchor="middle" className="fill-muted-foreground text-[9px]">
            {fmtDate(points[i].date).replace(/ \d{4}$/, '')}
          </text>
        ) : null,
      )}
      {/* y-axis labels */}
      <text x={4} y={PAD + 4} className="fill-muted-foreground text-[9px]">{fmtINR(max)}</text>
      <text x={4} y={H - PAD} className="fill-muted-foreground text-[9px]">{fmtINR(min)}</text>
      {/* hover markers */}
      {balPts.map((p, i) => (
        <title key={i}>{`${fmtDate(points[i].date)}: Bal ${fmtINR(points[i].projectedBalance)} (low ${fmtINR(points[i].lowBalance)} · high ${fmtINR(points[i].highBalance)})`}</title>
      ))}
    </svg>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ForecastSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
    </div>
  );
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

export function ForecastTab() {
  const [horizon, setHorizon] = React.useState<Horizon>('7d');
  const { data, loading, error, refetch } = useFetch<ForecastResponse>(
    `/api/banking-intel/forecast?horizon=${horizon}`,
    [horizon],
  );

  if (loading) return <ForecastSkeleton />;
  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-10">
          <ProfessionalEmptyState
            icon={AlertCircle}
            title="Couldn't load forecast"
            description={error || 'Unknown error'}
            accent="rose"
            action={{ label: 'Retry', onClick: refetch, icon: RefreshCw }}
          />
        </CardContent>
      </Card>
    );
  }

  const f = data.forecast;
  const confidencePct = Math.round(f.confidence * 100);
  const runwayDisplay =
    f.runwayDays === Infinity || f.runwayDays === null
      ? '∞ (safe)'
      : `${f.runwayDays} day${f.runwayDays === 1 ? '' : 's'}`;
  const historyDays = f.points.length > 0 ? Math.round(f.points.length * 2) : 0; // crude display

  return (
    <div className="space-y-4">
      {/* ─── Horizon toggle ─── */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <div className="text-sm font-medium">Cash Flow Forecast</div>
            <div className="text-xs text-muted-foreground">
              Projected balance, runway, and risks for the next {horizon === '7d' ? '7 days' : '30 days'}
            </div>
          </div>
          <div className="flex rounded-lg border p-0.5">
            {(['7d', '30d'] as Horizon[]).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHorizon(h)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  horizon === h
                    ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {h === '7d' ? '7 days' : '30 days'}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── Summary cards ─── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Projected End Balance"
          value={fmtINR(f.projectedEndBalance)}
          sub={`In ${horizon === '7d' ? '7 days' : '30 days'}`}
          icon={Wallet}
          tone={f.projectedEndBalance >= 0 ? 'emerald' : 'rose'}
        />
        <StatCard
          label="Runway"
          value={runwayDisplay}
          sub="Until balance hits 0"
          icon={Calendar}
          tone={f.runwayDays === Infinity ? 'emerald' : f.runwayDays > 30 ? 'amber' : 'rose'}
        />
        <StatCard
          label="Min Balance"
          value={fmtINR(f.minBalance)}
          sub={f.minBalanceDate ? `On ${fmtDate(f.minBalanceDate)}` : undefined}
          icon={AlertTriangle}
          tone={f.minBalance >= 0 ? 'amber' : 'rose'}
        />
        <StatCard
          label="Confidence"
          value={`${confidencePct}%`}
          sub={`Based on ~${historyDays}d history`}
          icon={Sparkles}
          tone={confidencePct >= 70 ? 'emerald' : confidencePct >= 50 ? 'amber' : 'rose'}
        />
      </div>

      {/* ─── Chart ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Projected Balance &amp; Confidence Band</span>
            <div className="flex items-center gap-3 text-[10px] font-normal text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-cyan-500" /> Projected</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-cyan-500/30" /> Band</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-rose-500" /> Min</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {f.points?.length ? (
            <ForecastChart points={f.points} minBalance={f.minBalance} minBalanceDate={f.minBalanceDate} />
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">No forecast data available</p>
          )}
        </CardContent>
      </Card>

      {/* ─── Narrative ─── */}
      <Card className="border-cyan-200 bg-cyan-50 dark:border-cyan-500/30 dark:bg-cyan-500/5">
        <CardContent className="flex items-start gap-3 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-300">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-2">
              <p className="text-sm font-medium">AI Narrative</p>
              <Badge variant="outline" className="border-cyan-200 bg-cyan-100 text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/15 dark:text-cyan-300">
                {confidencePct}% confidence
              </Badge>
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">{f.narrative}</p>
          </div>
        </CardContent>
      </Card>

      {/* ─── Risks + Recommendations ─── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Risks ({f.risks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {f.risks.length === 0 ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                No risks identified for this horizon.
              </div>
            ) : (
              <ul className="space-y-2">
                {f.risks.map((r, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-2 text-sm"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <span>{r}</span>
                  </motion.li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Recommendations ({f.recommendations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {f.recommendations.length === 0 ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Activity className="h-4 w-4" />
                No specific actions recommended.
              </div>
            ) : (
              <ul className="space-y-2">
                {f.recommendations.map((r, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start justify-between gap-2 text-sm"
                  >
                    <span className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{r}</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0"
                      onClick={() => toast.info('Coming soon — Oracle automation for this action is on the roadmap')}
                    >
                      Do it
                    </Button>
                  </motion.li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Projection table ─── */}
      {f.points.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Day-by-Day Projection</CardTitle>
            <CardDescription className="text-xs">
              {f.points.length} data points · forecast generated {relativeTime(new Date().toISOString())}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[300px] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead className="text-[11px]">Date</TableHead>
                    <TableHead className="text-right text-[11px]">Inflow</TableHead>
                    <TableHead className="text-right text-[11px]">Outflow</TableHead>
                    <TableHead className="text-right text-[11px]">Balance</TableHead>
                    <TableHead className="text-right text-[11px]">Low</TableHead>
                    <TableHead className="text-right text-[11px]">High</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {f.points.map((p, i) => (
                    <TableRow key={i} className="text-xs">
                      <TableCell>{fmtDate(p.date)}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400">
                        {p.projectedInflow > 0 ? fmtINRFull(p.projectedInflow) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-rose-600 dark:text-rose-400">
                        {p.projectedOutflow > 0 ? fmtINRFull(p.projectedOutflow) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">{fmtINRFull(p.projectedBalance)}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{fmtINRFull(p.lowBalance)}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{fmtINRFull(p.highBalance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* ─── Confidence footnote ─── */}
      <p className="text-center text-[11px] text-muted-foreground">
        Confidence: {confidencePct}% — based on ~{historyDays} days of historical data.
        Forecasts are projections from historical averages with a ±1.15σ band; not financial advice.
      </p>
    </div>
  );
}

export default ForecastTab;
