'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Wallet,
  CalendarClock,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Clock,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  Landmark,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ProfessionalEmptyState } from '@/components/shared';
import {
  useFetch,
  fmtINR,
  fmtPct,
  fmtDate,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  buildAreaPath,
  buildLinePath,
  buildSmoothPath,
  toPoints,
} from './helpers';
import type { BankingDashboard, TransactionCategory } from '@/lib/banking-service/types';

interface DashboardData {
  ok: boolean;
  dashboard: BankingDashboard;
}

interface DashboardTabProps {
  onNavigateToTransactions?: (accountId?: string) => void;
}

// ─── KPI card meta ────────────────────────────────────────────────────────────

interface KpiDef {
  key: keyof BankingDashboard['cards'];
  label: string;
  icon: typeof Wallet;
  tone: 'emerald' | 'rose' | 'amber' | 'violet' | 'sky' | 'muted';
  isPct?: boolean;
  hint?: string;
}

const KPIS: KpiDef[] = [
  { key: 'totalBalance', label: 'Total Balance', icon: Wallet, tone: 'emerald', hint: 'Across all accounts' },
  { key: 'todaysBalance', label: "Today's Balance", icon: CalendarClock, tone: 'emerald', hint: 'Available now' },
  { key: 'cashIn', label: 'Cash In (30d)', icon: TrendingUp, tone: 'emerald' },
  { key: 'cashOut', label: 'Cash Out (30d)', icon: TrendingDown, tone: 'rose' },
  { key: 'netCashFlow', label: 'Net Cash Flow', icon: ArrowRightLeft, tone: 'violet' },
  { key: 'pendingPayments', label: 'Pending Payments', icon: Clock, tone: 'amber' },
  { key: 'upcomingReceipts', label: 'Upcoming Receipts', icon: CalendarCheck, tone: 'sky' },
  { key: 'reconciledPct', label: 'Reconciled', icon: CheckCircle2, tone: 'emerald', isPct: true },
  { key: 'unreconciledCount', label: 'Unreconciled', icon: AlertCircle, tone: 'amber' },
  { key: 'linkedAccounts', label: 'Linked Accounts', icon: Landmark, tone: 'muted' },
];

const TONE_CLASS: Record<KpiDef['tone'], { bg: string; text: string }> = {
  emerald: { bg: 'bg-emerald-100 dark:bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-300' },
  rose: { bg: 'bg-rose-100 dark:bg-rose-500/15', text: 'text-rose-600 dark:text-rose-300' },
  amber: { bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-600 dark:text-amber-300' },
  violet: { bg: 'bg-violet-100 dark:bg-violet-500/15', text: 'text-violet-600 dark:text-violet-300' },
  sky: { bg: 'bg-sky-100 dark:bg-sky-500/15', text: 'text-sky-600 dark:text-sky-300' },
  muted: { bg: 'bg-muted', text: 'text-muted-foreground' },
};

// ─── Charts ───────────────────────────────────────────────────────────────────

function CashFlowChart({ series }: { series: BankingDashboard['cashFlowSeries'] }) {
  const W = 600;
  const H = 200;
  const PAD = 28;
  if (!series || series.length === 0) return null;
  const nets = series.map((s) => s.net);
  const balances = series.map((s) => s.balance);
  const allValues = [...nets, ...balances];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;
  const zeroY = PAD + (1 - (0 - min) / range) * (H - PAD * 2);

  const netPts = nets.map((v, i) => ({
    x: PAD + (i / (nets.length - 1)) * (W - PAD * 2),
    y: PAD + (1 - (v - min) / range) * (H - PAD * 2),
    v,
  }));
  const balPts = balances.map((v, i) => ({
    x: PAD + (i / (balances.length - 1)) * (W - PAD * 2),
    y: PAD + (1 - (v - min) / range) * (H - PAD * 2),
    v,
  }));

  const netIsPositive = (nets.reduce((a, b) => a + b, 0) >= 0);
  const netColor = netIsPositive ? '#10b981' : '#f43f5e';

  // X-axis labels: show first/mid/last
  const labelIdxs = [0, Math.floor(series.length / 2), series.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Cash flow chart">
      <defs>
        <linearGradient id="cashFlowArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={netColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={netColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* zero line */}
      <line
        x1={PAD}
        y1={zeroY}
        x2={W - PAD}
        y2={zeroY}
        stroke="currentColor"
        strokeDasharray="3 3"
        className="text-muted-foreground/40"
      />
      {/* net area */}
      <path d={buildAreaPath(netPts, zeroY)} fill="url(#cashFlowArea)" />
      {/* balance line */}
      <path
        d={buildSmoothPath(balPts)}
        fill="none"
        stroke="#8b5cf6"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* net line */}
      <path
        d={buildLinePath(netPts)}
        fill="none"
        stroke={netColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* x-axis labels */}
      {labelIdxs.map((i) =>
        series[i] ? (
          <text
            key={i}
            x={netPts[i].x}
            y={H - 4}
            textAnchor="middle"
            className="fill-muted-foreground text-[9px]"
          >
            {fmtDate(series[i].date).replace(/ \d{4}$/, '')}
          </text>
        ) : null,
      )}
      {/* hover targets */}
      {netPts.map((p, i) => (
        <title key={i}>{`${fmtDate(series[i].date)}: Net ${fmtINR(series[i].net)} · Balance ${fmtINR(series[i].balance)}`}</title>
      ))}
    </svg>
  );
}

function IncomeExpenseChart({ data }: { data: BankingDashboard['incomeVsExpense'] }) {
  const W = 600;
  const H = 200;
  const PAD = 28;
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.flatMap((d) => [d.income, d.expense]), 1);
  const groupW = (W - PAD * 2) / data.length;
  const barW = Math.min(18, groupW * 0.35);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Income vs expense chart">
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const y = PAD + t * (H - PAD * 2);
        const val = max * (1 - t);
        return (
          <g key={i}>
            <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="currentColor" className="text-muted-foreground/15" />
            <text x={2} y={y + 3} className="fill-muted-foreground text-[8px]">
              {fmtINR(val)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const cx = PAD + i * groupW + groupW / 2;
        const incomeH = (d.income / max) * (H - PAD * 2);
        const expenseH = (d.expense / max) * (H - PAD * 2);
        return (
          <g key={i}>
            <rect
              x={cx - barW - 2}
              y={H - PAD - incomeH}
              width={barW}
              height={incomeH}
              fill="#10b981"
              rx={2}
            >
              <title>{`${d.date}: Income ${fmtINR(d.income)}`}</title>
            </rect>
            <rect
              x={cx + 2}
              y={H - PAD - expenseH}
              width={barW}
              height={expenseH}
              fill="#f59e0b"
              rx={2}
            >
              <title>{`${d.date}: Expense ${fmtINR(d.expense)}`}</title>
            </rect>
            <text x={cx} y={H - 4} textAnchor="middle" className="fill-muted-foreground text-[9px]">
              {d.date}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function MonthlyTrendChart({ data }: { data: BankingDashboard['monthlyTrend'] }) {
  const W = 600;
  const H = 180;
  const PAD = 28;
  if (!data || data.length === 0) return null;
  const values = data.map((d) => d.net);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;
  const zeroY = PAD + (1 - (0 - min) / range) * (H - PAD * 2);
  const pts = toPoints(values, { w: W, h: H, padding: PAD });
  const labelIdxs = [0, Math.floor(data.length / 2), data.length - 1];
  const isPositive = values.reduce((a, b) => a + b, 0) >= 0;
  const lineColor = isPositive ? '#10b981' : '#f43f5e';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Monthly trend chart">
      <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} stroke="currentColor" strokeDasharray="3 3" className="text-muted-foreground/40" />
      <path d={buildSmoothPath(pts)} fill="none" stroke={lineColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill={lineColor}>
          <title>{`${data[i].month}: Net ${fmtINR(data[i].net)}`}</title>
        </circle>
      ))}
      {labelIdxs.map((i) =>
        data[i] ? (
          <text key={i} x={pts[i].x} y={H - 4} textAnchor="middle" className="fill-muted-foreground text-[9px]">
            {data[i].month}
          </text>
        ) : null,
      )}
    </svg>
  );
}

function CategoryBreakdownChart({ data }: { data: BankingDashboard['categoryBreakdown'] }) {
  if (!data || data.length === 0) return null;
  const top = data.slice(0, 8);
  const max = top[0]?.amount || 1;

  return (
    <div className="space-y-2">
      {top.map((d) => {
        const color = CATEGORY_COLORS[d.category as TransactionCategory] || '#94a3b8';
        const pct = (d.amount / max) * 100;
        return (
          <div key={d.category} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
                {CATEGORY_LABELS[d.category as TransactionCategory] || d.category}
              </span>
              <span className="text-muted-foreground">
                {fmtINR(d.amount)} · {d.pct.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ background: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Tab component ────────────────────────────────────────────────────────────

export function DashboardTab({ onNavigateToTransactions }: DashboardTabProps) {
  const { data, loading, error, refetch } = useFetch<DashboardData>('/api/banking-intel/dashboard');

  if (loading) return <DashboardSkeleton />;
  if (error || !data?.dashboard) {
    return (
      <Card>
        <CardContent className="py-10">
          <ProfessionalEmptyState
            icon={AlertCircle}
            title="Couldn't load dashboard"
            description={error || 'Unknown error'}
            accent="rose"
            action={{ label: 'Retry', onClick: refetch, icon: RefreshCw }}
          />
        </CardContent>
      </Card>
    );
  }

  const cards = data.dashboard.cards;

  return (
    <div className="space-y-6">
      {/* ─── KPI grid ─── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {KPIS.map((kpi, i) => {
          const value = cards[kpi.key];
          const Icon = kpi.icon;
          const tone = TONE_CLASS[kpi.tone];
          return (
            <motion.div
              key={kpi.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.02 }}
            >
              <Card className="overflow-hidden">
                <CardContent className="space-y-2 py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{kpi.label}</span>
                    <span className={`flex h-7 w-7 items-center justify-center rounded-md ${tone.bg}`}>
                      <Icon className={`h-4 w-4 ${tone.text}`} />
                    </span>
                  </div>
                  <div className="text-xl font-semibold tracking-tight">
                    {kpi.isPct ? fmtPct(value) : kpi.key === 'unreconciledCount' || kpi.key === 'linkedAccounts' ? value : fmtINR(value)}
                  </div>
                  {kpi.hint && <div className="text-[10px] text-muted-foreground">{kpi.hint}</div>}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* ─── Charts ─── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>Cash Flow (last 30 days)</span>
              <div className="flex items-center gap-3 text-[10px] font-normal text-muted-foreground">
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Net Flow</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-violet-500" /> Balance</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.dashboard.cashFlowSeries?.length ? (
              <CashFlowChart series={data.dashboard.cashFlowSeries} />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">No data yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>Income vs Expense (6 months)</span>
              <div className="flex items-center gap-3 text-[10px] font-normal text-muted-foreground">
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Income</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> Expense</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.dashboard.incomeVsExpense?.length ? (
              <IncomeExpenseChart data={data.dashboard.incomeVsExpense} />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">No data yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Trend (6 months)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.dashboard.monthlyTrend?.length ? (
              <MonthlyTrendChart data={data.dashboard.monthlyTrend} />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">No data yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Category Breakdown (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.dashboard.categoryBreakdown?.length ? (
              <CategoryBreakdownChart data={data.dashboard.categoryBreakdown} />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">No data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Quick actions ─── */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <p className="text-sm font-medium">Need to reconcile?</p>
            <p className="text-xs text-muted-foreground">
              {cards.unreconciledCount} transactions awaiting match
            </p>
          </div>
          <Button size="sm" onClick={() => onNavigateToTransactions?.()}>
            View Transactions
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default DashboardTab;
