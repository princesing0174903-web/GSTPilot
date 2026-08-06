// GSTPilot Infinity™ — Professional Chart Theme
// ---------------------------------------------------------------------------
// Use these constants when defining recharts <Line>/<Area>/<Bar> components
// for consistent brand-aligned colors across every chart.
//
// Brand spec (per project rules):
//   · Pure black bg + emerald (#10B981) brand accent
//   · Semantic colors (amber for warning, red for danger) preserved
//   · Green is reserved for "success" only (CHART_COLORS.success = #22C55E)
//     and should NOT be used as a generic chart series color. The brand
//     emerald (#10B981) is used for the primary brand series — it visually
//     overlaps with green but represents the brand identity, distinct from
//     the semantic-success green (#22C55E).
// ---------------------------------------------------------------------------

export const CHART_COLORS = {
  primary: '#10B981',    // emerald-500 — main brand accent
  primarySoft: '#34D399', // emerald-400 — secondary series
  secondary: '#06B6D4',   // cyan-500 — tertiary series (semantic accent)
  warning: '#F59E0B',     // amber-500 — warnings / at-risk series
  danger: '#EF4444',      // red-500 — errors / overdue series
  success: '#22C55E',     // green-500 (intentional — semantic success)
  neutral: '#64748B',     // slate-500 — muted / baseline series
  grid: '#1A1A1A',
  axis: '#71717A',
  tooltipBg: '#1A1A1A',
  tooltipBorder: '#2A2A2A',
} as const;

// Ordered palette for multi-series charts (Pie/Bar/Line with N series).
// Picks from the brand palette first, then semantic accents.
export const CHART_PALETTE = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.warning,
  CHART_COLORS.danger,
  CHART_COLORS.neutral,
  CHART_COLORS.primarySoft,
] as const;

// Reusable gradient stop pairs for <Area> / <defs> fills.
export const CHART_GRADIENTS = {
  blueArea: {
    id: 'grad-blue',
    from: 'rgba(16, 185, 129, 0.25)',
    to: 'rgba(16, 185, 129, 0)',
  },
  violetArea: {
    id: 'grad-violet',
    from: 'rgba(6, 182, 212, 0.25)',
    to: 'rgba(6, 182, 212, 0)',
  },
} as const;

// Recharts <Tooltip> style prop — spread directly onto <Tooltip contentStyle={...} .../>.
// Use: <Tooltip {...CHART_TOOLTIP_STYLE} />
export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: '#1A1A1A',
    border: '1px solid #2A2A2A',
    borderRadius: '8px',
    padding: '8px 12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    fontSize: '13px',
  },
  labelStyle: {
    color: '#FFFFFF',
    fontSize: '13px',
    fontWeight: 600,
    marginBottom: '4px',
  },
  itemStyle: {
    color: '#D4D4D8',
    fontSize: '12px',
  },
} as const;

// Recharts axis tick style — spread onto <XAxis tick={...} /> / <YAxis tick={...} />.
// Use: <XAxis tick={CHART_AXIS_TICK} stroke={CHART_COLORS.axis} />
export const CHART_AXIS_TICK = {
  fill: '#71717A',
  fontSize: 11,
} as const;
