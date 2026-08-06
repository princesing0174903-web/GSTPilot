'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Wallet,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ProfessionalEmptyState } from '@/components/shared';
import {
  useFetch,
  fmtINR,
  fmtINRFull,
  fmtPct,
  fmtDate,
  isoDay,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  buildAreaPath,
  buildSmoothPath,
  buildDonutArc,
  SCROLLBAR_CLASS,
} from './helpers';
import type {
  CashFlowSummary,
  CashFlowPoint,
  TransactionCategory,
  BankingAccount,
} from '@/lib/banking-service/types';

interface CashFlowResponse {
  ok: boolean;
  cashflow: CashFlowSummary;
}
interface AccountsResponse {
  ok: boolean;
  accounts: BankingAccount[];
}

// ─── Default date range (last 30 days) ────────────────────────────────────────

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 30);
  return { from: isoDay(from), to: isoDay(to) };
}

function previousRange(from: string, to: string): { from: string; to: string } {
  const f = new Date(from);
  const t = new Date(to);
  const days = Math.max(1, Math.round((t.getTime() - f.getTime()) / 86_400_000));
  const prevTo = new Date(f.getTime() - 86_400_000);
  const prevFrom = new Date(prevTo.getTime() - days * 86_400_000);
  return { from: isoDay(prevFrom), to: isoDay(prevTo) };
}

// ─── Charts ───────────────────────────────────────────────────────────────────

function FlowChart({ series }: { series: CashFlowPoint[] }) {
  const W = 700;
  const H = 240;
  const PAD = 32;
  if (!series || series.length === 0) return null;
  const inflows = series.map((s) => s.inflow);
  const outflows = series.map((s) => s.outflow);
  const balances = series.map((s) => s.balance);
  const maxFlow = Math.max(...inflows, ...outflows, 1);
  const minBal = Math.min(...balances);
  const maxBal = Math.max(...balances);
  const balRange = maxBal - minBal || 1;

  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;

  const inPts = inflows.map((v, i) => ({
    x: PAD + (i / (inflows.length - 1)) * innerW,
    y: PAD + (1 - v / maxFlow) * innerH,
    v,
  }));
  const outPts = outflows.map((v, i) => ({
    x: PAD + (i / (outflows.length - 1)) * innerW,
    y: PAD + (1 - v / maxFlow) * innerH,
    v,
  }));
  const balPts = balances.map((v, i) => ({
    x: PAD + (i / (balances.length - 1)) * innerW,
    y: PAD + (1 - (v - minBal) / balRange) * innerH,
    v,
  }));

  const labelIdxs = [0, Math.floor(series.length / 2), series.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Cash flow chart">
      <defs>
        <linearGradient id="inflowArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="outflowArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* inflow area */}
      <path d={buildAreaPath(inPts, H - PAD)} fill="url(#inflowArea)" />
      {/* outflow area */}
      <path d={buildAreaPath(outPts, H - PAD)} fill="url(#outflowArea)" />
      {/* balance line */}
      <path d={buildSmoothPath(balPts)} fill="none" stroke="#06b6d4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* x-axis */}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="currentColor" className="text-muted-foreground/30" />
      {labelIdxs.map((i) =>
        series[i] ? (
          <text key={i} x={inPts[i].x} y={H - 4} textAnchor="middle" className="fill-muted-foreground text-[9px]">
            {fmtDate(series[i].date).replace(/ \d{4}$/, '')}
          </text>
        ) : null,
      )}
      {/* y-axis labels */}
      <text x={4} y={PAD + 4} className="fill-muted-foreground text-[9px]">{fmtINR(maxFlow)}</text>
      <text x={4} y={H - PAD} className="fill-muted-foreground text-[9px]">0</text>
      <text x={4} y={PAD + 12} className="fill-muted-foreground text-[9px]" />
      <text x={W - 28} y={PAD + 4} className="fill-cyan-500 text-[9px]">{fmtINR(maxBal)}</text>
      <text x={W - 28} y={H - PAD} className="fill-cyan-500 text-[9px]">{fmtINR(minBal)}</text>
      {/* hover markers */}
      {inPts.map((p, i) => (
        <title key={`i-${i}`}>{`${fmtDate(series[i].date)}: In ${fmtINR(series[i].inflow)} · Out ${fmtINR(series[i].outflow)} · Bal ${fmtINR(series[i].balance)}`}</title>
      ))}
    </svg>
  );
}

function CategoryDonut({
  title,
  data,
  totalLabel,
}: {
  title: string;
  data: Array<{ category: TransactionCategory; amount: number }>;
  totalLabel: string;
}) {
  const total = data.reduce((s, d) => s + d.amount, 0);
  if (total === 0 || data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
        <CardContent><p className="py-8 text-center text-xs text-muted-foreground">No data for this period</p></CardContent>
      </Card>
    );
  }
  const cx = 60;
  const cy = 60;
  const rOuter = 50;
  const rInner = 30;
  // Compute donut segment angles without mutating any outer variable (lint: react-hooks/immutability).
  // O(n²) over a small fixed-size array — no measurable cost.
  const segments = data.map((d, i) => {
    const pct = d.amount / total;
    const prevSum = data.slice(0, i).reduce((s, x) => s + x.amount, 0);
    const start = -Math.PI / 2 + (prevSum / total) * Math.PI * 2;
    const end = start + pct * Math.PI * 2;
    return { d, pct, start, end };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription className="text-[11px]">{totalLabel}: {fmtINR(total)}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={title}>
            {segments.map((s, i) => {
              const color = CATEGORY_COLORS[s.d.category] || '#94a3b8';
              if (s.pct >= 1) {
                // full circle (single segment)
                return (
                  <g key={i}>
                    <circle cx={cx} cy={cy} r={rOuter} fill={color} />
                    <circle cx={cx} cy={cy} r={rInner} fill="var(--color-background, #fff)" />
                    <title>{`${CATEGORY_LABELS[s.d.category]}: ${fmtINR(s.d.amount)} (${(s.pct * 100).toFixed(1)}%)`}</title>
                  </g>
                );
              }
              return (
                <path
                  key={i}
                  d={buildDonutArc(cx, cy, rInner, rOuter, s.start, s.end)}
                  fill={color}
                >
                  <title>{`${CATEGORY_LABELS[s.d.category]}: ${fmtINR(s.d.amount)} (${(s.pct * 100).toFixed(1)}%)`}</title>
                </path>
              );
            })}
          </svg>
          <div className="flex-1 space-y-1">
            {segments.slice(0, 6).map((s, i) => {
              const color = CATEGORY_COLORS[s.d.category] || '#94a3b8';
              return (
                <div key={i} className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
                    {CATEGORY_LABELS[s.d.category]}
                  </span>
                  <span className="text-muted-foreground">{(s.pct * 100).toFixed(0)}%</span>
                </div>
              );
            })}
            {segments.length > 6 && (
              <div className="text-[10px] text-muted-foreground">+{segments.length - 6} more</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function MiniStat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
  tone: 'emerald' | 'rose' | 'violet' | 'sky' | 'muted';
}) {
  const toneClass = {
    emerald: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
    rose: 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300',
    violet: 'bg-cyan-100 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-300',
    sky: 'bg-sky-100 dark:bg-sky-500/15 text-sky-600 dark:text-sky-300',
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
      </CardContent>
    </Card>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CashFlowSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

export function CashFlowTab() {
  const defaults = React.useMemo(() => defaultRange(), []);
  const [from, setFrom] = React.useState(defaults.from);
  const [to, setTo] = React.useState(defaults.to);
  const [accountId, setAccountId] = React.useState<string>('');
  const [prevRange, setPrevRange] = React.useState<{ from: string; to: string } | null>(null);

  const accountsRes = useFetch<AccountsResponse>('/api/banking-intel/accounts');
  const accounts = accountsRes.data?.accounts ?? [];

  const buildUrl = (f: string, t: string, acc: string) => {
    const p = new URLSearchParams({ from: f, to: t });
    if (acc) p.set('accountId', acc);
    return `/api/banking-intel/cashflow?${p.toString()}`;
  };

  const { data, loading, error, refetch } = useFetch<CashFlowResponse>(
    buildUrl(from, to, accountId),
    [from, to, accountId],
  );

  // Fetch previous period for comparison
  React.useEffect(() => {
    setPrevRange(previousRange(from, to));
  }, [from, to]);
  const prevRes = useFetch<CashFlowResponse>(
    prevRange ? buildUrl(prevRange.from, prevRange.to, accountId) : null,
    [prevRange?.from, prevRange?.to, accountId],
  );

  if (loading && !data) return <CashFlowSkeleton />;
  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-10">
          <ProfessionalEmptyState
            icon={AlertCircle}
            title="Couldn't load cash flow"
            description={error || 'Unknown error'}
            accent="rose"
            action={{ label: 'Retry', onClick: refetch, icon: RefreshCw }}
          />
        </CardContent>
      </Card>
    );
  }

  const cf = data.cashflow;
  const prevCf = prevRes.data?.cashflow;
  const netDelta = prevCf ? cf.netFlow - prevCf.netFlow : 0;
  const netDeltaPct = prevCf && prevCf.netFlow !== 0 ? (netDelta / Math.abs(prevCf.netFlow)) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* ─── Controls ─── */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Account</Label>
            <Select value={accountId || 'all'} onValueChange={(v) => setAccountId(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="All accounts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.bankName} {a.accountMasked}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
          </div>
          <Button variant="outline" size="sm" onClick={refetch}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <div className="ml-auto flex gap-1">
            {[
              { label: '7d', days: 7 },
              { label: '30d', days: 30 },
              { label: '90d', days: 90 },
            ].map((p) => (
              <Button
                key={p.label}
                variant="ghost"
                size="sm"
                onClick={() => {
                  const t = new Date();
                  const f = new Date();
                  f.setDate(t.getDate() - p.days);
                  setFrom(isoDay(f));
                  setTo(isoDay(t));
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── Summary ─── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <MiniStat label="Opening" value={fmtINR(cf.openingBalance)} icon={Wallet} tone="muted" />
        <MiniStat label="Inflow" value={fmtINR(cf.totalInflow)} icon={TrendingUp} tone="emerald" />
        <MiniStat label="Outflow" value={fmtINR(cf.totalOutflow)} icon={TrendingDown} tone="rose" />
        <MiniStat label="Net" value={fmtINR(cf.netFlow)} icon={ArrowRightLeft} tone="violet" />
        <MiniStat label="Closing" value={fmtINR(cf.closingBalance)} icon={Wallet} tone="sky" />
      </div>

      {/* ─── Main chart ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Daily Flow &amp; Balance</span>
            <div className="flex items-center gap-3 text-[10px] font-normal text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Inflow</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-rose-500" /> Outflow</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-cyan-500" /> Balance</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cf.series?.length ? <FlowChart series={cf.series} /> : <p className="py-12 text-center text-sm text-muted-foreground">No data for this period</p>}
        </CardContent>
      </Card>

      {/* ─── Category donuts ─── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CategoryDonut
          title="Inflow by Category"
          data={cf.inflowByCategory ?? []}
          totalLabel="Total inflow"
        />
        <CategoryDonut
          title="Outflow by Category"
          data={cf.outflowByCategory ?? []}
          totalLabel="Total outflow"
        />
      </div>

      {/* ─── Period comparison ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Period Comparison</CardTitle>
          <CardDescription className="text-xs">
            This period ({fmtDate(from)} → {fmtDate(to)}) vs previous ({prevRange ? fmtDate(prevRange.from) : '—'} → {prevRange ? fmtDate(prevRange.to) : '—'})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`max-h-[400px] overflow-y-auto rounded-md border ${SCROLLBAR_CLASS}`}>
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead className="text-[11px]">Metric</TableHead>
                  <TableHead className="text-right text-[11px]">Previous</TableHead>
                  <TableHead className="text-right text-[11px]">Current</TableHead>
                  <TableHead className="text-right text-[11px]">Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <CompareRow label="Inflow" prev={prevCf?.totalInflow} curr={cf.totalInflow} goodWhenUp />
                <CompareRow label="Outflow" prev={prevCf?.totalOutflow} curr={cf.totalOutflow} goodWhenUp={false} />
                <CompareRow label="Net flow" prev={prevCf?.netFlow} curr={cf.netFlow} goodWhenUp />
                <CompareRow label="Opening balance" prev={prevCf?.openingBalance} curr={cf.openingBalance} goodWhenUp />
                <CompareRow label="Closing balance" prev={prevCf?.closingBalance} curr={cf.closingBalance} goodWhenUp />
                <TableRow className="text-xs">
                  <TableCell className="font-medium">Net flow delta</TableCell>
                  <TableCell className="text-right text-muted-foreground">—</TableCell>
                  <TableCell className="text-right font-mono">
                    <span className={netDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                      {netDelta >= 0 ? '+' : ''}{fmtINRFull(netDelta)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={netDeltaPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                      {fmtPct(netDeltaPct)}
                    </span>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CompareRow({
  label,
  prev,
  curr,
  goodWhenUp,
}: {
  label: string;
  prev?: number;
  curr: number;
  goodWhenUp: boolean;
}) {
  const delta = prev !== undefined ? curr - prev : 0;
  const deltaPct = prev && prev !== 0 ? (delta / Math.abs(prev)) * 100 : 0;
  const positive = delta >= 0;
  const isGood = goodWhenUp ? positive : !positive;
  const color = isGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  return (
    <TableRow className="text-xs">
      <TableCell className="font-medium">{label}</TableCell>
      <TableCell className="text-right text-muted-foreground">{prev !== undefined ? fmtINRFull(prev) : '—'}</TableCell>
      <TableCell className="text-right font-mono">{fmtINRFull(curr)}</TableCell>
      <TableCell className={`text-right ${color}`}>
        {prev !== undefined ? `${delta >= 0 ? '+' : ''}${fmtINRFull(delta)} (${fmtPct(deltaPct)})` : '—'}
      </TableCell>
    </TableRow>
  );
}

export default CashFlowTab;
