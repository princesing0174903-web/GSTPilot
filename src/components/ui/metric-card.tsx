'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Premium MetricCard
// ═══════════════════════════════════════════════════════════════════════════════
//
// Enterprise-grade KPI card inspired by Stripe / Linear / Vercel dashboards.
//
// Features:
//   • Icon with tinted background
//   • Title (label) + main number (tabular-nums, count-up on mount)
//   • Change indicator (delta vs previous period) with up/down arrow
//   • Mini sparkline (inline SVG, animated draw-in)
//   • Tooltip on hover (via title attribute or Tooltip wrapper)
//   • Hover lift animation (gst-metric-card)
//   • Loading skeleton state
//   • Zero external deps (sparkline is hand-drawn SVG)
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { cn } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight, TrendingFlat } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ─── Mini Sparkline ──────────────────────────────────────────────────────────
// Pure inline SVG. Animates the path draw on mount using strokeDasharray.
const MiniSparkline = React.memo(function MiniSparkline({
  data,
  width = 80,
  height = 28,
  positive = true,
}: {
  data: number[];
  width?: number;
  height?: number;
  positive?: boolean;
}) {
  if (!data || data.length < 2) {
    return <div style={{ width, height }} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });

  const pathD = points
    .map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`))
    .join(' ');

  const areaD =
    `${pathD} L ${width} ${height} L 0 ${height} Z`;

  const stroke = positive ? '#3B82F6' : '#F87171';
  const fillId = positive ? 'spark-fill-pos' : 'spark-fill-neg';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.2" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${fillId})`} />
      <path
        d={pathD}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 200,
          strokeDashoffset: 200,
          animation: 'gst-spark-draw 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards',
        }}
      />
      <style>{`
        @keyframes gst-spark-draw {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </svg>
  );
});

// ─── Count-up number ─────────────────────────────────────────────────────────
// Animates from 0 to target on mount. Respects reduced motion.
function CountUpNumber({
  value,
  format,
  duration = 700,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (prefersReduced) {
      setDisplay(value);
      return;
    }

    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  const formatted = format ? format(display) : Math.round(display).toString();
  return <span className="gst-text-tabular">{formatted}</span>;
}

// ─── Main MetricCard ─────────────────────────────────────────────────────────
export interface MetricCardProps {
  title: string;
  value: number;
  /** Format the number for display (e.g. currency, %, compact) */
  format?: (n: number) => string;
  /** Percentage change vs previous period. null = no change shown. */
  change?: number | null;
  /** Label for the change (e.g. "vs last month") */
  changeLabel?: string;
  /** Sparkline data points. Omit to hide. */
  sparkline?: number[];
  /** Icon component */
  icon?: React.ComponentType<{ className?: string }>;
  /** Tooltip content */
  tooltip?: string;
  /** Loading state */
  loading?: boolean;
  className?: string;
  /** Optional click handler — makes the card interactive */
  onClick?: () => void;
}

export function MetricCard({
  title,
  value,
  format,
  change = null,
  changeLabel,
  sparkline,
  icon: Icon,
  tooltip,
  loading = false,
  className,
  onClick,
}: MetricCardProps) {
  const isPositive = change !== null && change >= 0;
  const isNeutral = change === null;
  const isClickable = !!onClick;

  const ChangeIcon = isNeutral
    ? TrendingFlat
    : isPositive
      ? ArrowUpRight
      : ArrowDownRight;

  const changeColor = isNeutral
    ? 'text-muted-foreground'
    : isPositive
      ? 'text-blue-400 dark:text-blue-400'
      : 'text-red-400 dark:text-red-400';

  const card = (
    <div
      className={cn(
        'gst-metric-card relative rounded-xl border bg-card p-5',
        isClickable && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {loading ? (
        <MetricCardSkeleton />
      ) : (
        <>
          {/* Top row: icon + label */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {Icon && (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
              )}
              <span className="gst-text-label">{title}</span>
            </div>
            {sparkline && sparkline.length >= 2 && (
              <div className="opacity-70 transition-opacity hover:opacity-100">
                <MiniSparkline
                  data={sparkline}
                  positive={isPositive !== false}
                />
              </div>
            )}
          </div>

          {/* Main number */}
          <div className="mt-3 gst-text-metric text-foreground">
            <CountUpNumber value={value} format={format} />
          </div>

          {/* Change row */}
          {!isNeutral && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-xs font-semibold',
                  changeColor
                )}
              >
                <ChangeIcon className="h-3 w-3" />
                {Math.abs(change).toFixed(1)}%
              </span>
              {changeLabel && (
                <span className="gst-text-caption">{changeLabel}</span>
              )}
            </div>
          )}
          {isNeutral && changeLabel && (
            <div className="mt-1.5">
              <span className="gst-text-caption">{changeLabel}</span>
            </div>
          )}
        </>
      )}
    </div>
  );

  if (tooltip) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>{card}</TooltipTrigger>
          <TooltipContent
            side="bottom"
            className="gst-tooltip-content max-w-xs"
          >
            <p className="text-xs">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return card;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function MetricCardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="gst-shimmer-premium h-8 w-8 rounded-lg" />
        <div className="gst-shimmer-premium h-3 w-20 rounded" />
      </div>
      <div className="gst-shimmer-premium h-7 w-28 rounded" />
      <div className="gst-shimmer-premium h-3 w-16 rounded" />
    </div>
  );
}

// ─── Grid wrapper ─────────────────────────────────────────────────────────────
export function MetricCardGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4',
        className
      )}
    >
      {children}
    </div>
  );
}

export default MetricCard;
