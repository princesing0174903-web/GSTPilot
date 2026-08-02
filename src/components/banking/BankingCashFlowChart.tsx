'use client';

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { CashFlowPoint } from '@/lib/banking-prisma/types';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Module™ — Cash Flow Chart (Premium Edition)
//
// Dual-area SVG chart: emerald = inflow, red = outflow, cyan dashed = net.
// Renders in a glass-surface card with a legend, period selector (7D/30D/90D/1Y)
// and a hover tooltip that shows date, inflow, outflow, net, and closing balance.
//
// No external chart libraries — pure SVG with linear-gradient area fills. Width
// is tracked via ResizeObserver so paths render at true pixel density (no aspect
// ratio distortion, no stretched strokes, no distorted text labels).
//
// Wrapped in React.memo so parent re-renders don't cascade when
// {data, period, onPeriodChange} refs are stable.
// ═══════════════════════════════════════════════════════════════════════════════

export type CashFlowPeriod = '7d' | '30d' | '90d' | '1y';

interface BankingCashFlowChartProps {
  data: CashFlowPoint[];
  period: CashFlowPeriod;
  onPeriodChange: (period: CashFlowPeriod) => void;
}

// ─── Formatters ────────────────────────────────────────────────────────────────

const inrFormatter = new Intl.NumberFormat('en-IN', {
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatINR(n: number): string {
  return `₹${inrFormatter.format(n)}`;
}

function formatAxisINR(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(1)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(1)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${Math.round(abs)}`;
}

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

function formatDateLabel(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, '0');
  return `${day} ${MONTHS_SHORT[d.getMonth()]}`;
}

// ─── Chart geometry ────────────────────────────────────────────────────────────

const HEIGHT = 220;
const MARGIN = { top: 12, right: 16, bottom: 28, left: 56 } as const;

const PERIODS: { value: CashFlowPeriod; label: string }[] = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: '1y', label: '1Y' },
];

// ─── Path helpers ──────────────────────────────────────────────────────────────

interface Pt { x: number; y: number; }

function buildLinePath(pts: Pt[]): string {
  if (pts.length === 0) return '';
  let path = `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    path += ` L ${pts[i].x.toFixed(2)},${pts[i].y.toFixed(2)}`;
  }
  return path;
}

function buildAreaPath(pts: Pt[], baselineY: number): string {
  if (pts.length === 0) return '';
  let path = `M ${pts[0].x.toFixed(2)},${baselineY.toFixed(2)}`;
  for (const p of pts) {
    path += ` L ${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  }
  path += ` L ${pts[pts.length - 1].x.toFixed(2)},${baselineY.toFixed(2)} Z`;
  return path;
}

// ─── Period selector ───────────────────────────────────────────────────────────

function ChartHeader({
  period,
  onPeriodChange,
}: {
  period: CashFlowPeriod;
  onPeriodChange: (p: CashFlowPeriod) => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          Cash Flow
        </h3>
        <p className="text-xs text-muted-foreground">
          Daily inflow, outflow and net movement
        </p>
      </div>
      <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
        {PERIODS.map((p) => {
          const active = p.value === period;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => onPeriodChange(p.value)}
              aria-pressed={active}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                active
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { color: '#34d399', label: 'Inflow' },
    { color: '#f87171', label: 'Outflow' },
    { color: '#22d3ee', label: 'Net' },
  ];
  return (
    <div className="mb-3 flex items-center gap-4">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: item.color }}
          />
          <span className="text-[11px] text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Tooltip ───────────────────────────────────────────────────────────────────

interface TooltipProps {
  point: CashFlowPoint;
  leftPx: number;
  chartWidth: number;
}

function TooltipRow({
  icon: Icon,
  color,
  label,
  value,
}: {
  icon: typeof ArrowDownLeft;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3 w-3 ${color}`} />
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <span className="text-[11px] font-semibold tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}

function Tooltip({ point, leftPx, chartWidth }: TooltipProps) {
  const isNetPositive = point.net >= 0;
  const tooltipWidth = 200;
  // Keep tooltip inside chart bounds
  const clampedLeft = Math.max(
    tooltipWidth / 2 + 4,
    Math.min(chartWidth - tooltipWidth / 2 - 4, leftPx),
  );

  return (
    <div
      className="pointer-events-none absolute top-2 z-10 -translate-x-1/2"
      style={{ left: `${clampedLeft}px` }}
    >
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="glass-surface min-w-[180px] rounded-lg border border-white/[0.1] bg-black/80 px-3 py-2 shadow-xl backdrop-blur"
      >
        <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {formatDateLabel(point.date)}
        </div>
        <div className="space-y-1">
          <TooltipRow
            icon={ArrowDownLeft}
            color="text-emerald-400"
            label="Inflow"
            value={formatINR(point.inflow)}
          />
          <TooltipRow
            icon={ArrowUpRight}
            color="text-red-400"
            label="Outflow"
            value={formatINR(point.outflow)}
          />
          <TooltipRow
            icon={isNetPositive ? TrendingUp : TrendingDown}
            color={isNetPositive ? 'text-emerald-400' : 'text-red-400'}
            label="Net"
            value={formatINR(point.net)}
          />
          <div className="mt-1 border-t border-white/[0.06] pt-1">
            <TooltipRow
              icon={Activity}
              color="text-cyan-400"
              label="Closing"
              value={formatINR(point.closingBalance)}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({
  period,
  onPeriodChange,
}: {
  period: CashFlowPeriod;
  onPeriodChange: (p: CashFlowPeriod) => void;
}) {
  return (
    <div className="glass-surface rounded-2xl border border-white/[0.06] p-6">
      <ChartHeader period={period} onPeriodChange={onPeriodChange} />
      <div className="flex h-[220px] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04]">
            <Activity className="h-6 w-6 text-muted-foreground/60" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              No cash flow data yet
            </p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Connect a bank account or import a statement to see your daily
              cash flow here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main chart ────────────────────────────────────────────────────────────────

function BankingCashFlowChartImpl({
  data,
  period,
  onPeriodChange,
}: BankingCashFlowChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Track container width so the SVG renders at true pixel density.
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setContainerWidth(w);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const width = Math.max(320, containerWidth);
  const innerWidth = Math.max(10, width - MARGIN.left - MARGIN.right);
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

  // Scales + point arrays + axis ticks
  const {
    inflowPts,
    outflowPts,
    netPts,
    yMin,
    yMax,
    zeroY,
    xTicks,
    yTicks,
  } = useMemo(() => {
    if (data.length === 0) {
      return {
        inflowPts: [] as Pt[],
        outflowPts: [] as Pt[],
        netPts: [] as Pt[],
        yMin: 0,
        yMax: 1,
        zeroY: MARGIN.top + innerHeight,
        xTicks: [] as { x: number; label: string }[],
        yTicks: [] as { y: number; value: number }[],
      };
    }

    const inflows = data.map((d) => d.inflow);
    const outflows = data.map((d) => d.outflow);
    const nets = data.map((d) => d.net);

    const maxPositive = Math.max(0, ...inflows, ...outflows, ...nets);
    const minNegative = Math.min(0, ...nets);

    const yMax = maxPositive * 1.1 || 1;
    const yMin = minNegative < 0 ? minNegative * 1.1 : 0;
    const yRange = yMax - yMin || 1;

    const xScale = (i: number) =>
      MARGIN.left + (i / Math.max(1, data.length - 1)) * innerWidth;
    const yScale = (v: number) =>
      MARGIN.top + innerHeight - ((v - yMin) / yRange) * innerHeight;

    const inflowPts = data.map((d, i) => ({ x: xScale(i), y: yScale(d.inflow) }));
    const outflowPts = data.map((d, i) => ({ x: xScale(i), y: yScale(d.outflow) }));
    const netPts = data.map((d, i) => ({ x: xScale(i), y: yScale(d.net) }));

    const zeroY = yScale(0);

    // X-axis: pick at most ~7 evenly-spaced labels (always include last point)
    const maxLabels = 7;
    const step = Math.max(1, Math.ceil(data.length / maxLabels));
    const xTicks: { x: number; label: string }[] = [];
    for (let i = 0; i < data.length; i += step) {
      xTicks.push({ x: xScale(i), label: formatDateLabel(data[i].date) });
    }
    if (data.length > 1 && (data.length - 1) % step !== 0) {
      xTicks.push({
        x: xScale(data.length - 1),
        label: formatDateLabel(data[data.length - 1].date),
      });
    }

    // Y-axis: 5 ticks between yMin and yMax
    const yTicks: { y: number; value: number }[] = [0, 0.25, 0.5, 0.75, 1].map(
      (f) => {
        const v = yMin + yRange * f;
        return { y: yScale(v), value: v };
      },
    );

    return { inflowPts, outflowPts, netPts, yMin, yMax, zeroY, xTicks, yTicks };
  }, [data, innerWidth, innerHeight]);

  // Mouse handlers
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current || data.length === 0) return;
      const rect = svgRef.current.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const x = relX - MARGIN.left;
      if (x < 0 || x > innerWidth) {
        setHoverIndex(null);
        return;
      }
      const idx = Math.round((x / innerWidth) * (data.length - 1));
      setHoverIndex(Math.max(0, Math.min(data.length - 1, idx)));
    },
    [data.length, innerWidth],
  );

  const handleMouseLeave = useCallback(() => setHoverIndex(null), []);

  // Empty state
  if (data.length === 0) {
    return <EmptyState period={period} onPeriodChange={onPeriodChange} />;
  }

  const hoverPoint = hoverIndex !== null ? data[hoverIndex] : null;
  const hoverX =
    hoverIndex !== null
      ? MARGIN.left +
        (hoverIndex / Math.max(1, data.length - 1)) * innerWidth
      : 0;

  return (
    <div className="glass-surface rounded-2xl border border-white/[0.06] p-6">
      <ChartHeader period={period} onPeriodChange={onPeriodChange} />
      <Legend />

      <div ref={containerRef} className="relative w-full">
        <svg
          ref={svgRef}
          width={width}
          height={HEIGHT}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="overflow-visible"
          role="img"
          aria-label="Cash flow chart"
        >
          <defs>
            <linearGradient id="cf-inflow-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="cf-outflow-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f87171" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#f87171" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Y-axis grid lines + labels */}
          {yTicks.map((t, i) => (
            <g key={`y-${i}`}>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={t.y}
                y2={t.y}
                stroke="currentColor"
                strokeWidth="1"
                className="text-white/[0.05]"
              />
              <text
                x={MARGIN.left - 8}
                y={t.y + 3}
                textAnchor="end"
                className="fill-muted-foreground text-[9px]"
              >
                {formatAxisINR(t.value)}
              </text>
            </g>
          ))}

          {/* Zero baseline (dashed) */}
          {yMin < 0 && (
            <line
              x1={MARGIN.left}
              x2={width - MARGIN.right}
              y1={zeroY}
              y2={zeroY}
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="3,3"
              className="text-white/[0.15]"
            />
          )}

          {/* Outflow area + line (drawn first so inflow sits on top visually) */}
          <path
            d={buildAreaPath(outflowPts, zeroY)}
            fill="url(#cf-outflow-grad)"
          />
          <path
            d={buildLinePath(outflowPts)}
            fill="none"
            stroke="#f87171"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Inflow area + line */}
          <path d={buildAreaPath(inflowPts, zeroY)} fill="url(#cf-inflow-grad)" />
          <path
            d={buildLinePath(inflowPts)}
            fill="none"
            stroke="#34d399"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Net flow line (cyan, dashed, thinner) */}
          <path
            d={buildLinePath(netPts)}
            fill="none"
            stroke="#22d3ee"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="4,3"
          />

          {/* X-axis baseline */}
          <line
            x1={MARGIN.left}
            x2={width - MARGIN.right}
            y1={MARGIN.top + innerHeight}
            y2={MARGIN.top + innerHeight}
            stroke="currentColor"
            strokeWidth="1"
            className="text-white/[0.08]"
          />

          {/* X-axis labels */}
          {xTicks.map((t, i) => (
            <text
              key={`x-${i}`}
              x={t.x}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[9px]"
            >
              {t.label}
            </text>
          ))}

          {/* Hover guide line + dots */}
          {hoverPoint && hoverIndex !== null && (
            <g>
              <line
                x1={hoverX}
                x2={hoverX}
                y1={MARGIN.top}
                y2={MARGIN.top + innerHeight}
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="3,3"
                className="text-white/30"
              />
              <circle
                cx={hoverX}
                cy={inflowPts[hoverIndex].y}
                r="3.5"
                fill="#34d399"
                stroke="#0a0a0a"
                strokeWidth="1.5"
              />
              <circle
                cx={hoverX}
                cy={outflowPts[hoverIndex].y}
                r="3.5"
                fill="#f87171"
                stroke="#0a0a0a"
                strokeWidth="1.5"
              />
              <circle
                cx={hoverX}
                cy={netPts[hoverIndex].y}
                r="3.5"
                fill="#22d3ee"
                stroke="#0a0a0a"
                strokeWidth="1.5"
              />
            </g>
          )}
        </svg>

        {hoverPoint && hoverIndex !== null && (
          <Tooltip
            point={hoverPoint}
            leftPx={hoverX}
            chartWidth={width}
          />
        )}
      </div>
    </div>
  );
}

export const BankingCashFlowChart = memo(BankingCashFlowChartImpl);
export default BankingCashFlowChart;
