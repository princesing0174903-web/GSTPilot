'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Sparkline (pure SVG, no external chart deps)
// ═══════════════════════════════════════════════════════════════════════════════
//
// A tiny inline SVG sparkline (80×30 by default) that renders a smooth
// polyline with a subtle gradient fill underneath. Used inside KPI stat
// cards so each metric carries a 7-point trend glyph — a hallmark of
// "trillion-dollar SaaS" dashboards (Stripe / Linear / Bloomberg).
//
// Implementation notes:
//   • Pure SVG <path> + <polyline> + <defs><linearGradient>. NO recharts,
//     victory, d3, or any external chart library.
//   • Stroke is 1.5px with rounded line-caps / line-join for a premium feel.
//   • Color is selected via the `trend` prop: 'up' = emerald, 'down' = rose,
//     'flat' = muted gray.
//   • The fill gradient fades from ~28% opacity (top) to 0 (bottom) so the
//     sparkline never visually competes with the metric value above it.
//   • Auto-scales to the min/max of the data so any numeric series works.

import { useMemo } from 'react';

export type SparklineTrend = 'up' | 'down' | 'flat';

interface SparklineProps {
  /** Numeric series (any length ≥ 2). */
  data: number[];
  /** Visual trend — controls stroke + fill color. */
  trend?: SparklineTrend;
  /** SVG width in px (default 80). */
  width?: number;
  /** SVG height in px (default 30). */
  height?: number;
  /** Stroke width in px (default 1.5). */
  strokeWidth?: number;
  /** Unique id suffix for the gradient def — required when rendering multiple
   *  sparklines on the same page so each <linearGradient> has a distinct id. */
  idSuffix?: string;
  /** Optional className for the root <svg>. */
  className?: string;
}

const TREND_COLORS: Record<SparklineTrend, { stroke: string; fillTop: string; fillBottom: string }> = {
  up: { stroke: '#2563EB', fillTop: 'rgba(16,185,129,0.28)', fillBottom: 'rgba(16,185,129,0)' },
  down: { stroke: '#F43F5E', fillTop: 'rgba(244,63,94,0.28)', fillBottom: 'rgba(244,63,94,0)' },
  flat: { stroke: '#9CA3AF', fillTop: 'rgba(156,163,175,0.22)', fillBottom: 'rgba(156,163,175,0)' },
};

export function Sparkline({
  data,
  trend = 'flat',
  width = 80,
  height = 30,
  strokeWidth = 1.5,
  idSuffix = 'spark',
  className,
}: SparklineProps) {
  const { linePath, areaPath } = useMemo(() => {
    // Defensive: need at least 2 points to draw a line.
    const safe = data && data.length >= 2 ? data : [0, 0];
    const min = Math.min(...safe);
    const max = Math.max(...safe);
    const range = max - min || 1; // avoid divide-by-zero for flat data

    const pad = strokeWidth; // keep stroke inside the viewBox
    const w = width - pad * 2;
    const h = height - pad * 2;

    const points = safe.map((v, i) => {
      const x = pad + (safe.length === 1 ? 0 : (i / (safe.length - 1)) * w);
      // Invert Y so larger values appear higher in the SVG.
      const y = pad + h - ((v - min) / range) * h;
      return [x, y] as const;
    });

    // Smooth polyline using Catmull-Rom → cubic Bézier conversion. Falls back
    // to a straight polyline if there are exactly 2 points (no curve needed).
    let line: string;
    if (points.length === 2) {
      line = `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]}`;
    } else {
      const segs: string[] = [`M ${points[0][0]} ${points[0][1]}`];
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i - 1] ?? points[i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] ?? p2;
        // Catmull-Rom → Bézier (tension 0.5).
        const c1x = p1[0] + (p2[0] - p0[0]) / 6;
        const c1y = p1[1] + (p2[1] - p0[1]) / 6;
        const c2x = p2[0] - (p3[0] - p1[0]) / 6;
        const c2y = p2[1] - (p3[1] - p1[1]) / 6;
        segs.push(`C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`);
      }
      line = segs.join(' ');
    }

    // Area fill = line + down-to-baseline + close.
    const baselineY = height - pad;
    const area = `${line} L ${points[points.length - 1][0]} ${baselineY} L ${points[0][0]} ${baselineY} Z`;

    return { linePath: line, areaPath: area };
  }, [data, width, height, strokeWidth]);

  const colors = TREND_COLORS[trend];
  const gradId = `spark-grad-${idSuffix}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={colors.fillTop} />
          <stop offset="100%" stopColor={colors.fillBottom} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
      <path
        d={linePath}
        fill="none"
        stroke={colors.stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default Sparkline;
