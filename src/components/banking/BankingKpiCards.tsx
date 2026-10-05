'use client';

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Building2,
  TrendingUp,
  TrendingDown,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { BankingDashboardSummary, CashFlowPoint } from '@/lib/banking-prisma/types';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Module™ — KPI Cards (Premium Edition)
//
// 8 KPI cards laid out in a responsive grid (2 cols mobile → 4 cols md → 8 cols xl).
// Each card carries an icon chip, label, formatted value, and one of:
//   • Mini SVG sparkline (cards 1, 3, 4, 7) — 40px tall, full-width
//   • Gauge bar (card 8 — bank health score)
//   • Subtitle text (cards 2, 5, 6)
//
// Tone system mirrors the design-system tokens: blue=success, amber=warning,
// red=danger, blue-light=info, zinc=neutral. Emerald/cyan neutralized.
//
// `computeBankingKpis(summary)` builds the 8 card configs from the dashboard
// summary so the parent can choose to render the cards via this component or
// re-implement the layout using the same configs.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Currency formatter (Indian grouping, ₹ symbol) ────────────────────────────

const inrFormatter = new Intl.NumberFormat('en-IN', {
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatINR(n: number): string {
  return `₹${inrFormatter.format(n)}`;
}

function formatCount(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n);
}

// ─── Tone system ───────────────────────────────────────────────────────────────

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface ToneConfig {
  iconColor: string;
  iconBg: string;
  sparkHex: string;
  barColor: string;
}

const TONES: Record<Tone, ToneConfig> = {
  success: {
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
    sparkHex: '#60A5FA',
    barColor: '#3B82F6',
  },
  warning: {
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/10',
    sparkHex: '#fbbf24',
    barColor: '#fbbf24',
  },
  danger: {
    iconColor: 'text-red-400',
    iconBg: 'bg-red-500/10',
    sparkHex: '#f87171',
    barColor: '#f87171',
  },
  info: {
    iconColor: 'text-blue-300',
    iconBg: 'bg-blue-500/10',
    sparkHex: '#60A5FA',
    barColor: '#60A5FA',
  },
  neutral: {
    iconColor: 'text-zinc-300',
    iconBg: 'bg-white/[0.05]',
    sparkHex: '#a1a1aa',
    barColor: '#a1a1aa',
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function pctChange(series: number[]): number {
  if (!series || series.length < 2) return 0;
  const first = series[0];
  const last = series[series.length - 1];
  if (first === 0) {
    if (last === 0) return 0;
    return last > 0 ? 100 : -100;
  }
  const pct = ((last - first) / Math.abs(first)) * 100;
  // Clamp to a sane display range so a 1000x spike doesn't render as "100000%".
  return Math.max(-999, Math.min(999, pct));
}

function extractSeries(
  trend: CashFlowPoint[] | undefined,
  field: keyof CashFlowPoint,
): number[] {
  if (!Array.isArray(trend)) return [];
  return trend
    .map((p) => p[field])
    .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
}

// ─── Mini SVG Sparkline (40px tall, full-width, non-distorting stroke) ─────────

interface MiniSparklineProps {
  data: number[];
  hex: string;
  height?: number;
}

const MiniSparkline = memo(function MiniSparkline({
  data,
  hex,
  height = 40,
}: MiniSparklineProps) {
  const reactId = React.useId();
  const gradId = `bkpi-spark-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  if (!data || data.length < 2) {
    return <div style={{ width: '100%', height }} aria-hidden />;
  }

  const width = 100; // viewBox unit; stretched horizontally via preserveAspectRatio
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pad = 3;
  const innerH = height - pad * 2;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = pad + innerH - ((v - min) / range) * innerH;
    return [x, y] as const;
  });

  const linePath = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ');
  const areaPath = `${linePath} L ${width.toFixed(2)},${height} L 0,${height} Z`;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="overflow-visible"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={hex} stopOpacity="0.35" />
          <stop offset="100%" stopColor={hex} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={hex}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
});

// ─── Gauge bar (Bank Health Score) ─────────────────────────────────────────────

interface GaugeBarProps {
  value: number;
  max?: number;
  color: string;
  delay?: number;
}

const GaugeBar = memo(function GaugeBar({
  value,
  max = 100,
  color,
  delay = 0,
}: GaugeBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Score
        </span>
        <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
          {Math.round(value)}/{max}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
    </div>
  );
});

// ─── Card config type ──────────────────────────────────────────────────────────

export interface BankingKpiCardConfig {
  key: string;
  label: string;
  value: string;
  icon: LucideIcon;
  tone: Tone;
  subtitle?: string;
  sparkline?: number[];
  gauge?: { value: number; max: number };
  trend?: { value: number; label: string };
}

// ─── Build the 8 card configs from the dashboard summary ───────────────────────

export function computeBankingKpis(
  summary: BankingDashboardSummary,
): BankingKpiCardConfig[] {
  const trend = summary.cashFlowTrend ?? [];
  const closingSeries = extractSeries(trend, 'closingBalance');
  const inflowSeries = extractSeries(trend, 'inflow');
  const outflowSeries = extractSeries(trend, 'outflow');
  const netSeries = extractSeries(trend, 'net');

  const netCashFlow =
    (summary.monthlyInflow ?? 0) - (summary.monthlyOutflow ?? 0);
  const healthScore = summary.bankHealthScore ?? 0;
  const healthTone: Tone =
    healthScore >= 80 ? 'success' : healthScore >= 60 ? 'warning' : 'danger';
  const netTone: Tone = netCashFlow >= 0 ? 'success' : 'danger';

  const closingTrend =
    closingSeries.length >= 2
      ? { value: pctChange(closingSeries), label: 'period' }
      : undefined;
  const inflowTrend =
    inflowSeries.length >= 2
      ? { value: pctChange(inflowSeries), label: 'period' }
      : undefined;
  const netTrend =
    netSeries.length >= 2
      ? { value: pctChange(netSeries), label: 'period' }
      : undefined;

  const healthLabel =
    healthScore >= 80
      ? 'Excellent'
      : healthScore >= 60
        ? 'Good'
        : healthScore >= 40
          ? 'Fair'
          : 'Poor';

  return [
    {
      key: 'total-balance',
      label: 'Total Balance',
      value: formatINR(summary.totalBalance ?? 0),
      icon: Wallet,
      tone: 'success',
      sparkline: closingSeries,
      trend: closingTrend,
    },
    {
      key: 'available-balance',
      label: 'Available Balance',
      value: formatINR(summary.availableBalance ?? 0),
      icon: Landmark,
      tone: 'info',
      subtitle: 'Withdrawable now',
    },
    {
      key: 'todays-credits',
      label: "Today's Credits",
      value: formatINR(summary.todaysCredits ?? 0),
      icon: ArrowDownLeft,
      tone: 'success',
      sparkline: inflowSeries,
      trend: inflowTrend,
    },
    {
      key: 'todays-debits',
      label: "Today's Debits",
      value: formatINR(summary.todaysDebits ?? 0),
      icon: ArrowUpRight,
      tone: 'danger',
      sparkline: outflowSeries,
    },
    {
      key: 'pending-reconciliation',
      label: 'Pending Reconciliation',
      value: formatCount(summary.pendingReconciliation ?? 0),
      icon: RefreshCw,
      tone: 'warning',
      subtitle: 'Awaiting match',
    },
    {
      key: 'connected-accounts',
      label: 'Connected Accounts',
      value: formatCount(summary.connectedAccounts ?? 0),
      icon: Building2,
      tone: 'neutral',
      subtitle: 'Active banks',
    },
    {
      key: 'cash-flow-month',
      label: 'Cash Flow (Month)',
      value: formatINR(netCashFlow),
      icon: TrendingUp,
      tone: netTone,
      sparkline: netSeries,
      trend: netTrend,
    },
    {
      key: 'bank-health-score',
      label: 'Bank Health Score',
      value: `${Math.round(healthScore)}`,
      icon: Zap,
      tone: healthTone,
      gauge: { value: healthScore, max: 100 },
      subtitle: healthLabel,
    },
  ];
}

// ─── Single card ───────────────────────────────────────────────────────────────

interface BankingKpiCardProps {
  config: BankingKpiCardConfig;
  index: number;
}

const BankingKpiCard = memo(function BankingKpiCard({
  config,
  index,
}: BankingKpiCardProps) {
  const tone = TONES[config.tone];
  const Icon = config.icon;
  const hasSparkline = config.sparkline && config.sparkline.length > 1;
  const hasGauge = !!config.gauge;
  const hasSubtitle = !hasSparkline && !hasGauge && !!config.subtitle;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
      className="h-full"
    >
      <div className="glass-surface gst-card-hover group h-full rounded-2xl border border-white/[0.06] p-4 transition-colors duration-300 hover:border-white/[0.12]">
        {/* Top row: label + value (left) and icon chip (right) */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="gst-text-label">
              {config.label}
            </div>
            <div className="gst-text-metric gst-text-tabular !text-xl md:!text-2xl truncate">
              {config.value}
            </div>
          </div>
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone.iconBg} transition-transform duration-300 group-hover:scale-110`}
          >
            <Icon className={`h-4 w-4 ${tone.iconColor}`} />
          </div>
        </div>

        {/* Sparkline / Gauge / Subtitle slot (consistent 40px tall) */}
        <div className="h-10">
          {hasSparkline ? (
            <MiniSparkline data={config.sparkline!} hex={tone.sparkHex} />
          ) : hasGauge ? (
            <GaugeBar
              value={config.gauge!.value}
              max={config.gauge!.max}
              color={tone.barColor}
              delay={index * 0.06 + 0.2}
            />
          ) : hasSubtitle ? (
            <div className="flex h-10 items-end">
              <span className="text-[11px] text-muted-foreground">
                {config.subtitle}
              </span>
            </div>
          ) : null}
        </div>

        {/* Trend indicator */}
        {config.trend && (
          <div className="mt-2 flex items-center gap-1">
            {config.trend.value >= 0 ? (
              <TrendingUp className="h-3 w-3 text-blue-400" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-400" />
            )}
            <span
              className={`text-[11px] font-medium tabular-nums ${
                config.trend.value >= 0 ? 'text-blue-400' : 'text-red-400'
              }`}
            >
              {config.trend.value >= 0 ? '+' : ''}
              {config.trend.value.toFixed(1)}%
            </span>
            <span className="text-[11px] text-muted-foreground">
              {config.trend.label}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
});

// ─── KPI grid (the public component) ───────────────────────────────────────────

interface BankingKpiCardsProps {
  summary: BankingDashboardSummary;
}

export function BankingKpiCards({ summary }: BankingKpiCardsProps) {
  const cards = React.useMemo(() => computeBankingKpis(summary), [summary]);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 xl:grid-cols-8">
      {cards.map((config, i) => (
        <BankingKpiCard key={config.key} config={config} index={i} />
      ))}
    </div>
  );
}

export default BankingKpiCards;
