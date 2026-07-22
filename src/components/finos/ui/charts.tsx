'use client'

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * FinOS — Lightweight SVG chart primitives (no recharts dependency)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Why not recharts? In the 4 GB sandbox cgroup, compiling 12 modules that each
 * import recharts (~500 KB minified) OOM-kills the Turbopack dev server. These
 * pure-SVG primitives are <2 KB total, render faster, and have zero compile
 * memory overhead.
 *
 * Supported:
 *   • LineChart   — multi-series line chart with grid + tooltip
 *   • AreaChart   — single-series area chart with gradient fill
 *   • BarChart    — vertical or grouped bars with rounded tops
 *   • DonutChart  — pie/donut with center label
 *   • GaugeChart  — semi-circular gauge (0-100) for health scores
 *
 * All charts accept number[] or {label, value}[] data and are responsive via
 * viewBox + preserveAspectRatio.
 */

import * as React from 'react'
import { cn } from '@/lib/utils'

// ─── Color palette (matches accentClasses) ────────────────────────────────────
export const CHART_COLORS: Record<string, string> = {
  emerald: '#10b981',
  sky: '#0ea5e9',
  amber: '#f59e0b',
  rose: '#f43f5e',
  violet: '#8b5cf6',
  cyan: '#06b6d4',
  slate: '#64748b',
}

// ─── Shared tooltip hook ───────────────────────────────────────────────────────
interface TooltipState {
  visible: boolean
  x: number
  y: number
  content: React.ReactNode
}

function useTooltip() {
  const [tip, setTip] = React.useState<TooltipState>({ visible: false, x: 0, y: 0, content: null })
  const show = React.useCallback((x: number, y: number, content: React.ReactNode) => {
    setTip({ visible: true, x, y, content })
  }, [])
  const hide = React.useCallback(() => setTip((t) => ({ ...t, visible: false })), [])
  return { tip, show, hide }
}

function Tooltip({ tip }: { tip: TooltipState }) {
  if (!tip.visible) return null
  return (
    <div
      className="pointer-events-none absolute z-20 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md"
      style={{ left: tip.x, top: tip.y, transform: 'translate(-50%, -110%)' }}
    >
      {tip.content}
    </div>
  )
}

// ─── LineChart ─────────────────────────────────────────────────────────────────
export interface LineSeries {
  name: string
  color: string
  data: number[]
}

export function LineChart({
  series,
  labels,
  height = 240,
  yFormat,
  className,
}: {
  series: LineSeries[]
  labels: string[]
  height?: number
  yFormat?: (v: number) => string
  className?: string
}) {
  const { tip, show, hide } = useTooltip()
  const w = 800
  const h = height
  const pad = { top: 16, right: 16, bottom: 28, left: 56 }
  const iw = w - pad.left - pad.right
  const ih = h - pad.top - pad.bottom

  const allValues = series.flatMap((s) => s.data)
  const max = Math.max(...allValues, 1)
  const min = 0
  const range = max - min || 1

  const xStep = labels.length > 1 ? iw / (labels.length - 1) : 0
  const x = (i: number) => pad.left + i * xStep
  const y = (v: number) => pad.top + ih - ((v - min) / range) * ih

  // Y-axis ticks (4 lines)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + t * range)

  return (
    <div className={cn('relative', className)} onMouseLeave={hide}>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="xMidYMid meet">
        {/* Y grid */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={pad.left} y1={y(t)} x2={w - pad.right} y2={y(t)} stroke="currentColor" strokeWidth={0.5} className="text-border" />
            <text x={pad.left - 8} y={y(t) + 3} textAnchor="end" fontSize={10} className="fill-muted-foreground">
              {yFormat ? yFormat(t) : t.toLocaleString('en-IN')}
            </text>
          </g>
        ))}
        {/* X labels */}
        {labels.map((l, i) => (
          <text key={i} x={x(i)} y={h - 8} textAnchor="middle" fontSize={10} className="fill-muted-foreground">
            {l}
          </text>
        ))}
        {/* Series */}
        {series.map((s) => {
          const d = s.data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ')
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              {s.data.map((v, i) => (
                <circle
                  key={i}
                  cx={x(i)}
                  cy={y(v)}
                  r={3}
                  fill={s.color}
                  className="cursor-pointer"
                  onMouseEnter={(e) => {
                    const rect = (e.currentTarget.ownerSVGElement?.parentElement as HTMLElement).getBoundingClientRect()
                    show(x(i) * (rect.width / w), y(v) * (rect.height / h) - 10, (
                      <div className="space-y-0.5">
                        <p className="font-semibold">{s.name}</p>
                        <p className="text-muted-foreground">{labels[i]}: <span className="font-medium text-foreground">{yFormat ? yFormat(v) : v.toLocaleString('en-IN')}</span></p>
                      </div>
                    ))
                  }}
                  onMouseLeave={hide}
                />
              ))}
            </g>
          )
        })}
      </svg>
      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-4 px-2">
        {series.map((s) => (
          <div key={s.name} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-xs text-muted-foreground">{s.name}</span>
          </div>
        ))}
      </div>
      <Tooltip tip={tip} />
    </div>
  )
}

// ─── AreaChart (single series with gradient) ───────────────────────────────────
export function AreaChart({
  data,
  labels,
  color = '#10b981',
  height = 240,
  yFormat,
  className,
}: {
  data: number[]
  labels: string[]
  color?: string
  height?: number
  yFormat?: (v: number) => string
  className?: string
}) {
  const { tip, show, hide } = useTooltip()
  const w = 800
  const h = height
  const pad = { top: 16, right: 16, bottom: 28, left: 56 }
  const iw = w - pad.left - pad.right
  const ih = h - pad.top - pad.bottom
  const max = Math.max(...data, 1)
  const range = max || 1
  const xStep = labels.length > 1 ? iw / (labels.length - 1) : 0
  const x = (i: number) => pad.left + i * xStep
  const y = (v: number) => pad.top + ih - (v / range) * ih
  const path = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ')
  const areaPath = `${path} L ${x(data.length - 1)} ${pad.top + ih} L ${x(0)} ${pad.top + ih} Z`
  const gradId = `area-grad-${color.replace('#', '')}`
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * range)

  return (
    <div className={cn('relative', className)} onMouseLeave={hide}>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={pad.left} y1={y(t)} x2={w - pad.right} y2={y(t)} stroke="currentColor" strokeWidth={0.5} className="text-border" />
            <text x={pad.left - 8} y={y(t) + 3} textAnchor="end" fontSize={10} className="fill-muted-foreground">
              {yFormat ? yFormat(t) : t.toLocaleString('en-IN')}
            </text>
          </g>
        ))}
        {labels.map((l, i) => (
          <text key={i} x={x(i)} y={h - 8} textAnchor="middle" fontSize={10} className="fill-muted-foreground">
            {l}
          </text>
        ))}
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {data.map((v, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(v)}
            r={3}
            fill={color}
            className="cursor-pointer"
            onMouseEnter={() => show(x(i), y(v) - 10, (
              <p className="font-medium">{labels[i]}: <span className="text-primary">{yFormat ? yFormat(v) : v.toLocaleString('en-IN')}</span></p>
            ))}
            onMouseLeave={hide}
          />
        ))}
      </svg>
      <Tooltip tip={tip} />
    </div>
  )
}

// ─── BarChart (single or grouped) ──────────────────────────────────────────────
export function BarChart({
  series,
  labels,
  height = 240,
  yFormat,
  className,
  colors,
}: {
  series: { name: string; data: number[] }[]
  labels: string[]
  height?: number
  yFormat?: (v: number) => string
  className?: string
  colors?: string[]
}) {
  const { tip, show, hide } = useTooltip()
  const w = 800
  const h = height
  const pad = { top: 16, right: 16, bottom: 28, left: 56 }
  const iw = w - pad.left - pad.right
  const ih = h - pad.top - pad.bottom
  const allValues = series.flatMap((s) => s.data)
  const max = Math.max(...allValues, 1)
  const range = max || 1
  const groupW = iw / labels.length
  const barW = (groupW * 0.7) / series.length
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * range)
  const palette = colors || ['#10b981', '#0ea5e9', '#f59e0b', '#f43f5e', '#8b5cf6']

  return (
    <div className={cn('relative', className)} onMouseLeave={hide}>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="xMidYMid meet">
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={pad.left} y1={pad.top + ih - (t / range) * ih} x2={w - pad.right} y2={pad.top + ih - (t / range) * ih} stroke="currentColor" strokeWidth={0.5} className="text-border" />
            <text x={pad.left - 8} y={pad.top + ih - (t / range) * ih + 3} textAnchor="end" fontSize={10} className="fill-muted-foreground">
              {yFormat ? yFormat(t) : t.toLocaleString('en-IN')}
            </text>
          </g>
        ))}
        {labels.map((l, i) => (
          <text key={i} x={pad.left + i * groupW + groupW / 2} y={h - 8} textAnchor="middle" fontSize={10} className="fill-muted-foreground">
            {l}
          </text>
        ))}
        {labels.map((_, i) => (
          <g key={i}>
            {series.map((s, si) => {
              const v = s.data[i] || 0
              const bh = (v / range) * ih
              const bx = pad.left + i * groupW + (groupW * 0.15) + si * barW
              const by = pad.top + ih - bh
              const color = palette[si % palette.length]
              return (
                <rect
                  key={si}
                  x={bx}
                  y={by}
                  width={barW - 2}
                  height={bh}
                  rx={2}
                  fill={color}
                  className="cursor-pointer transition-opacity hover:opacity-80"
                  onMouseEnter={() => show(bx + barW / 2, by - 10, (
                    <div className="space-y-0.5">
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-muted-foreground">{labels[i]}: <span className="font-medium text-foreground">{yFormat ? yFormat(v) : v.toLocaleString('en-IN')}</span></p>
                    </div>
                  ))}
                  onMouseLeave={hide}
                />
              )
            })}
          </g>
        ))}
      </svg>
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-4 px-2">
          {series.map((s, si) => (
            <div key={s.name} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: palette[si % palette.length] }} />
              <span className="text-xs text-muted-foreground">{s.name}</span>
            </div>
          ))}
        </div>
      )}
      <Tooltip tip={tip} />
    </div>
  )
}

// ─── DonutChart ────────────────────────────────────────────────────────────────
export function DonutChart({
  data,
  height = 220,
  centerLabel,
  centerValue,
  className,
}: {
  data: { label: string; value: number; color: string }[]
  height?: number
  centerLabel?: string
  centerValue?: string
  className?: string
}) {
  const { tip, show, hide } = useTooltip()
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const size = 220
  const r = 80
  const innerR = 50
  const cx = size / 2
  const cy = size / 2
  let angle = -Math.PI / 2 // start at top

  const arcs = data.map((d) => {
    const sweep = (d.value / total) * Math.PI * 2
    const start = angle
    const end = angle + sweep
    angle = end
    const x1 = cx + r * Math.cos(start)
    const y1 = cy + r * Math.sin(start)
    const x2 = cx + r * Math.cos(end)
    const y2 = cy + r * Math.sin(end)
    const xi1 = cx + innerR * Math.cos(end)
    const yi1 = cy + innerR * Math.sin(end)
    const xi2 = cx + innerR * Math.cos(start)
    const yi2 = cy + innerR * Math.sin(start)
    const large = sweep > Math.PI ? 1 : 0
    return {
      d: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${innerR} ${innerR} 0 ${large} 0 ${xi2} ${yi2} Z`,
      color: d.color,
      label: d.label,
      value: d.value,
      mid: (start + end) / 2,
    }
  })

  return (
    <div className={cn('relative flex flex-col items-center', className)} onMouseLeave={hide}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ height, width: height }} preserveAspectRatio="xMidYMid meet">
        {arcs.map((a, i) => (
          <path
            key={i}
            d={a.d}
            fill={a.color}
            className="cursor-pointer transition-opacity hover:opacity-80"
            onMouseEnter={() => {
              const lx = cx + (r - 12) * Math.cos(a.mid)
              const ly = cy + (r - 12) * Math.sin(a.mid)
              show(lx, ly, (
                <div className="space-y-0.5">
                  <p className="font-semibold">{a.label}</p>
                  <p className="text-muted-foreground">₹{(a.value / 100000).toFixed(2)}L · {((a.value / total) * 100).toFixed(1)}%</p>
                </div>
              ))
            }}
            onMouseLeave={hide}
          />
        ))}
        {centerValue && (
          <text x={cx} y={cy - 4} textAnchor="middle" fontSize={20} fontWeight={700} className="fill-foreground">
            {centerValue}
          </text>
        )}
        {centerLabel && (
          <text x={cx} y={cy + 14} textAnchor="middle" fontSize={10} className="fill-muted-foreground">
            {centerLabel}
          </text>
        )}
      </svg>
      <div className="mt-3 grid w-full grid-cols-2 gap-2 px-2">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: d.color }} />
            <span className="truncate text-xs text-muted-foreground">{d.label}</span>
          </div>
        ))}
      </div>
      <Tooltip tip={tip} />
    </div>
  )
}

// ─── GaugeChart (semi-circular 0-100) ──────────────────────────────────────────
export function GaugeChart({
  value,
  max = 100,
  label,
  color = '#8b5cf6',
  height = 160,
  className,
}: {
  value: number
  max?: number
  label?: string
  color?: string
  height?: number
  className?: string
}) {
  const size = 220
  const r = 80
  const cx = size / 2
  const cy = size / 2 + 20
  const pct = Math.min(value / max, 1)
  const startAngle = Math.PI
  const endAngle = 0
  const valueAngle = startAngle - pct * Math.PI

  const arc = (from: number, to: number, radius: number) => {
    const x1 = cx + radius * Math.cos(from)
    const y1 = cy + radius * Math.sin(from)
    const x2 = cx + radius * Math.cos(to)
    const y2 = cy + radius * Math.sin(to)
    const large = Math.abs(from - to) > Math.PI ? 1 : 0
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`
  }

  return (
    <div className={cn('relative flex flex-col items-center', className)}>
      <svg viewBox={`0 0 ${size} ${size - 20}`} style={{ height, width: height * 1.3 }} preserveAspectRatio="xMidYMid meet">
        {/* Track */}
        <path d={arc(startAngle, endAngle, r)} fill="none" stroke="currentColor" strokeWidth={12} strokeLinecap="round" className="text-muted/40" />
        {/* Value */}
        <path d={arc(startAngle, valueAngle, r)} fill="none" stroke={color} strokeWidth={12} strokeLinecap="round" />
        {/* Center text */}
        <text x={cx} y={cy - 12} textAnchor="middle" fontSize={28} fontWeight={700} className="fill-foreground">
          {value}
        </text>
        <text x={cx} y={cy + 6} textAnchor="middle" fontSize={11} className="fill-muted-foreground">
          / {max}
        </text>
        {label && (
          <text x={cx} y={cy + 24} textAnchor="middle" fontSize={11} fontWeight={500} className="fill-foreground">
            {label}
          </text>
        )}
      </svg>
    </div>
  )
}
