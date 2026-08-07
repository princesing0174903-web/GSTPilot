'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Module™ — Reports Dashboard (Premium Edition)
//
// A premium reports dashboard for the Banking Module:
//
//   • Period selector tabs (Daily / Weekly / Monthly / Quarterly / Yearly)
//   • Summary cards row: Total Inflow (emerald), Total Outflow (red),
//     Net Flow (emerald/red), Opening Balance, Closing Balance, Collection Rate %
//   • Top Expenses section: horizontal bar chart of top 5 categories
//   • Top Customers section: horizontal bar chart of top 5 counterparties
//   • Outstanding section: total amount + count + collection-rate gauge
//   • Category breakdown table: all categories with inflow / outflow / count / net
//   • Export to CSV (parent-controlled via onExport)
//
// Loading state: skeleton placeholders. Empty state: "No data for this period".
//
// Design tokens: pure-black GSTPilot theme. Cards: `glass-surface rounded-2xl
// border border-white/[0.06]`. Primary emerald — NO indigo/blue.
// ═══════════════════════════════════════════════════════════════════════════════

import * as React from 'react';
import { memo, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Landmark,
  Gauge,
  Download,
  Receipt,
  Users,
  AlertCircle,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { BankingReport, ReportPeriod } from '@/lib/banking-prisma/types';
import { formatINR } from '@/components/banking/BankingKpiCards';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BankingReportsProps {
  report: BankingReport | null;
  loading?: boolean;
  onPeriodChange: (period: ReportPeriod) => void;
  onExport?: () => void;
}

// ─── Period config ────────────────────────────────────────────────────────────

const PERIODS: Array<{ value: ReportPeriod; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n);
}

function formatDateRange(start: string, end: string): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  return `${fmt(start)} → ${fmt(end)}`;
}

function formatPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

// ─── Summary card ─────────────────────────────────────────────────────────────

type SummaryTone = 'success' | 'danger' | 'info' | 'neutral';

interface SummaryCardConfig {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: SummaryTone;
  hint?: string;
}

const SUMMARY_TONES: Record<SummaryTone, { chip: string; text: string; bar: string }> = {
  success: {
    chip: 'bg-blue-500/10 border-blue-500/20',
    text: 'text-blue-300',
    bar: 'bg-blue-500',
  },
  danger: {
    chip: 'bg-red-500/10 border-red-500/20',
    text: 'text-red-300',
    bar: 'bg-red-500',
  },
  info: {
    chip: 'bg-cyan-500/10 border-cyan-500/20',
    text: 'text-cyan-300',
    bar: 'bg-cyan-500',
  },
  neutral: {
    chip: 'bg-white/[0.04] border-white/[0.08]',
    text: 'text-zinc-200',
    bar: 'bg-white/40',
  },
};

function SummaryCardImpl({ cfg, index }: { cfg: SummaryCardConfig; index: number }) {
  const tone = SUMMARY_TONES[cfg.tone];
  const Icon = cfg.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: 'easeOut' }}
      className="glass-surface rounded-2xl border border-white/[0.06] p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {cfg.label}
        </span>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg border ${tone.chip}`}>
          <Icon className={`h-3.5 w-3.5 ${tone.text}`} />
        </div>
      </div>
      <p className="mt-2 text-xl font-bold tracking-tight text-foreground tabular-nums">
        {cfg.value}
      </p>
      {cfg.hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{cfg.hint}</p>}
    </motion.div>
  );
}

const SummaryCard = memo(SummaryCardImpl);

// ─── Horizontal bar chart (top N) ─────────────────────────────────────────────

interface BarItem {
  label: string;
  amount: number;
  count: number;
}

interface BarChartProps {
  items: BarItem[];
  tone: 'success' | 'danger' | 'info' | 'neutral';
  emptyMessage: string;
  valueFormatter?: (n: number) => string;
}

const BAR_TONES: Record<BarChartProps['tone'], string> = {
  success: 'from-blue-500 to-blue-400',
  danger: 'from-red-500 to-red-400',
  info: 'from-cyan-500 to-cyan-400',
  neutral: 'from-white/40 to-white/30',
};

function HorizontalBarChart({ items, tone, emptyMessage, valueFormatter }: BarChartProps) {
  const max = useMemo(
    () => items.reduce((m, i) => Math.max(m, Math.abs(i.amount)), 0),
    [items],
  );
  const fmt = valueFormatter ?? formatINR;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <BarChart3 className="h-5 w-5 text-zinc-600" />
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, idx) => {
        const pct = max > 0 ? (Math.abs(item.amount) / max) * 100 : 0;
        return (
          <motion.div
            key={`${item.label}-${idx}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: idx * 0.06, ease: 'easeOut' }}
            className="space-y-1.5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-xs font-medium text-foreground">{item.label}</span>
                <Badge
                  variant="outline"
                  className="border-white/[0.08] bg-white/[0.03] text-[11px] text-muted-foreground"
                >
                  {formatCount(item.count)}
                </Badge>
              </div>
              <span className="text-xs font-semibold text-foreground tabular-nums whitespace-nowrap">
                {fmt(item.amount)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.04]">
              <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${BAR_TONES[tone]}`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, delay: 0.1 + idx * 0.05, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Collection rate gauge ────────────────────────────────────────────────────

function CollectionGauge({ rate }: { rate: number }) {
  const tone = rate >= 80 ? 'success' : rate >= 60 ? 'warning' : 'danger';
  const toneClasses = {
    success: { stroke: '#34d399', text: 'text-blue-300' },
    warning: { stroke: '#fbbf24', text: 'text-amber-300' },
    danger: { stroke: '#f87171', text: 'text-red-300' },
  }[tone];

  // Semi-circular gauge (180°)
  const radius = 36;
  const circumference = Math.PI * radius; // half circle
  const offset = circumference * (1 - Math.min(100, Math.max(0, rate)) / 100);

  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="60" viewBox="0 0 100 60" className="overflow-visible">
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <motion.path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke={toneClasses.stroke}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
        />
      </svg>
      <div className="-mt-7 flex flex-col items-center">
        <span className={`text-xl font-bold tabular-nums ${toneClasses.text}`}>
          {formatPct(rate)}
        </span>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Collection Rate
        </span>
      </div>
    </div>
  );
}

// ─── Section card primitive ───────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  badge,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass-surface rounded-2xl border border-white/[0.06] p-4 ${className ?? ''}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Icon className="h-3.5 w-3.5 text-blue-300" />
          </div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ReportsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="glass-surface rounded-2xl border border-white/[0.06] p-4 animate-pulse"
          >
            <div className="h-2.5 w-12 rounded bg-white/[0.06]" />
            <div className="mt-3 h-5 w-20 rounded bg-white/[0.06]" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="glass-surface rounded-2xl border border-white/[0.06] p-4 animate-pulse"
          >
            <div className="h-3 w-24 rounded bg-white/[0.06]" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="space-y-1.5">
                  <div className="h-2.5 w-32 rounded bg-white/[0.06]" />
                  <div className="h-2 w-full rounded bg-white/[0.04]" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="glass-surface rounded-2xl border border-white/[0.06] p-4 animate-pulse">
        <div className="h-3 w-32 rounded bg-white/[0.06]" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }).map((_, j) => (
            <div key={j} className="h-7 w-full rounded bg-white/[0.04]" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.04] border border-white/[0.06]">
        <AlertCircle className="h-6 w-6 text-zinc-500" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">No data for this period</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Try selecting a different period or import bank statements to populate reports.
        </p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function BankingReportsImpl({
  report,
  loading = false,
  onPeriodChange,
  onExport,
}: BankingReportsProps) {
  const handlePeriodChange = useCallback(
    (value: string) => {
      onPeriodChange(value as ReportPeriod);
    },
    [onPeriodChange],
  );

  const summaryCards: SummaryCardConfig[] = useMemo(() => {
    if (!report) return [];
    const net = report.netFlow;
    return [
      {
        label: 'Total Inflow',
        value: formatINR(report.totalInflow),
        icon: ArrowDownLeft,
        tone: 'success',
        hint: 'Incoming credits',
      },
      {
        label: 'Total Outflow',
        value: formatINR(report.totalOutflow),
        icon: ArrowUpRight,
        tone: 'danger',
        hint: 'Outgoing debits',
      },
      {
        label: 'Net Flow',
        value: `${net >= 0 ? '+' : '−'}${formatINR(Math.abs(net))}`,
        icon: net >= 0 ? TrendingUp : TrendingDown,
        tone: net >= 0 ? 'success' : 'danger',
        hint: net >= 0 ? 'Surplus' : 'Deficit',
      },
      {
        label: 'Opening Balance',
        value: formatINR(report.openingBalance),
        icon: Wallet,
        tone: 'neutral',
        hint: 'Period start',
      },
      {
        label: 'Closing Balance',
        value: formatINR(report.closingBalance),
        icon: Landmark,
        tone: 'info',
        hint: 'Period end',
      },
      {
        label: 'Collection Rate',
        value: formatPct(report.collectionRate),
        icon: Gauge,
        tone: report.collectionRate >= 80 ? 'success' : report.collectionRate >= 60 ? 'neutral' : 'danger',
        hint: 'Of outstanding',
      },
    ];
  }, [report]);

  const topExpenses = useMemo(() => {
    if (!report) return [];
    return [...report.topExpenses]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((e) => ({ label: e.category, amount: e.amount, count: e.count }));
  }, [report]);

  const topCustomers = useMemo(() => {
    if (!report) return [];
    return [...report.topCustomers]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((c) => ({ label: c.counterparty, amount: c.amount, count: c.count }));
  }, [report]);

  const categoryRows = useMemo(() => {
    if (!report) return [];
    return Object.entries(report.byCategory)
      .map(([category, v]) => ({
        category,
        inflow: v.inflow,
        outflow: v.outflow,
        count: v.count,
        net: v.inflow - v.outflow,
      }))
      .sort((a, b) => Math.abs(b.inflow) + Math.abs(b.outflow) - (Math.abs(a.inflow) + Math.abs(a.outflow)));
  }, [report]);

  const currentPeriod = report?.period ?? 'monthly';

  return (
    <div className="space-y-4">
      {/* Header row: period tabs + export */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={currentPeriod} onValueChange={handlePeriodChange}>
          <TabsList className="bg-white/[0.04] border border-white/[0.06] h-auto p-1 flex-wrap">
            {PERIODS.map((p) => (
              <TabsTrigger
                key={p.value}
                value={p.value}
                className="text-xs data-[state=active]:bg-blue-500/15 data-[state=active]:text-blue-300"
              >
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          {report && (
            <Badge
              variant="outline"
              className="border-white/[0.08] bg-white/[0.02] text-[11px] text-muted-foreground"
            >
              {formatDateRange(report.startDate, report.endDate)}
            </Badge>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!report || loading}
            onClick={onExport}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Loading / empty / content */}
      {loading ? (
        <ReportsSkeleton />
      ) : !report ? (
        <EmptyState />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="space-y-4"
        >
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {summaryCards.map((cfg, i) => (
              <SummaryCard key={cfg.label} cfg={cfg} index={i} />
            ))}
          </div>

          {/* Top Expenses + Top Customers */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <SectionCard
              icon={Receipt}
              title="Top Expenses"
              badge={
                <Badge
                  variant="outline"
                  className="border-red-500/20 bg-red-500/10 text-red-300 text-[11px]"
                >
                  Top 5
                </Badge>
              }
            >
              <HorizontalBarChart
                items={topExpenses}
                tone="danger"
                emptyMessage="No expenses recorded in this period"
              />
            </SectionCard>

            <SectionCard
              icon={Users}
              title="Top Customers"
              badge={
                <Badge
                  variant="outline"
                  className="border-blue-500/20 bg-blue-500/10 text-blue-300 text-[11px]"
                >
                  Top 5
                </Badge>
              }
            >
              <HorizontalBarChart
                items={topCustomers}
                tone="success"
                emptyMessage="No customer payments in this period"
              />
            </SectionCard>
          </div>

          {/* Outstanding + Collection gauge */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <SectionCard
              icon={AlertCircle}
              title="Outstanding"
              className="lg:col-span-2"
              badge={
                <Badge
                  variant="outline"
                  className="border-amber-500/20 bg-amber-500/10 text-amber-300 text-[11px]"
                >
                  {formatCount(report.outstanding.count)} invoices
                </Badge>
              }
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Total Outstanding
                  </p>
                  <p className="mt-1 text-2xl font-bold text-amber-300 tabular-nums">
                    {formatINR(report.outstanding.total)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Across {formatCount(report.outstanding.count)} unpaid invoices
                  </p>
                </div>
                <div className="flex flex-col items-center justify-center">
                  <CollectionGauge rate={report.collectionRate} />
                </div>
              </div>
            </SectionCard>

            <SectionCard icon={Gauge} title="Period Snapshot">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Inflow
                  </span>
                  <span className="text-sm font-semibold text-blue-300 tabular-nums">
                    {formatINR(report.totalInflow)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Outflow
                  </span>
                  <span className="text-sm font-semibold text-red-300 tabular-nums">
                    {formatINR(report.totalOutflow)}
                  </span>
                </div>
                <div className="h-px bg-white/[0.06]" />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Net Flow
                  </span>
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      report.netFlow >= 0 ? 'text-blue-300' : 'text-red-300'
                    }`}
                  >
                    {report.netFlow >= 0 ? '+' : '−'}
                    {formatINR(Math.abs(report.netFlow))}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Net Change
                  </span>
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      report.closingBalance >= report.openingBalance
                        ? 'text-blue-300'
                        : 'text-red-300'
                    }`}
                  >
                    {report.closingBalance >= report.openingBalance ? '+' : '−'}
                    {formatINR(Math.abs(report.closingBalance - report.openingBalance))}
                  </span>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Category breakdown table */}
          <SectionCard
            icon={BarChart3}
            title="Category Breakdown"
            badge={
              <Badge
                variant="outline"
                className="border-white/[0.08] bg-white/[0.02] text-[11px] text-muted-foreground"
              >
                {formatCount(categoryRows.length)} categories
              </Badge>
            }
          >
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              <ScrollArea className="max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead className="h-9 text-[11px] uppercase tracking-wider text-muted-foreground">
                        Category
                      </TableHead>
                      <TableHead className="h-9 text-[11px] uppercase tracking-wider text-muted-foreground text-right">
                        Inflow
                      </TableHead>
                      <TableHead className="h-9 text-[11px] uppercase tracking-wider text-muted-foreground text-right">
                        Outflow
                      </TableHead>
                      <TableHead className="h-9 text-[11px] uppercase tracking-wider text-muted-foreground text-right">
                        Count
                      </TableHead>
                      <TableHead className="h-9 text-[11px] uppercase tracking-wider text-muted-foreground text-right">
                        Net
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryRows.length === 0 ? (
                      <TableRow className="border-white/[0.06] hover:bg-transparent">
                        <TableCell
                          colSpan={5}
                          className="py-6 text-center text-xs text-muted-foreground"
                        >
                          No category data
                        </TableCell>
                      </TableRow>
                    ) : (
                      categoryRows.map((row) => (
                        <TableRow
                          key={row.category}
                          className="border-white/[0.06] hover:bg-white/[0.02]"
                        >
                          <TableCell className="py-2.5 text-xs font-medium text-foreground capitalize">
                            {row.category.replace(/_/g, ' ')}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-blue-300 tabular-nums text-right">
                            {row.inflow > 0 ? formatINR(row.inflow) : '—'}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-red-300 tabular-nums text-right">
                            {row.outflow > 0 ? formatINR(row.outflow) : '—'}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-muted-foreground tabular-nums text-right">
                            {formatCount(row.count)}
                          </TableCell>
                          <TableCell
                            className={`py-2.5 text-xs font-semibold tabular-nums text-right ${
                              row.net >= 0 ? 'text-blue-300' : 'text-red-300'
                            }`}
                          >
                            {row.net >= 0 ? '+' : '−'}
                            {formatINR(Math.abs(row.net))}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </SectionCard>
        </motion.div>
      )}
    </div>
  );
}

export const BankingReports = memo(BankingReportsImpl);

export type { BankingReportsProps };
