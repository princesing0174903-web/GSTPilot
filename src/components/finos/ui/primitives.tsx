'use client'

/**
 * Shared FinOS UI primitives — KpiCard, ChartCard, DataTable, SectionHeader,
 * StatusPill, Sparkline. All modules consume these so the look-and-feel is
 * consistent across the 12-module product.
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react'

// ─── Accent color tokens (Tailwind) ────────────────────────────────────────────
export const accentClasses: Record<string, { bg: string; text: string; border: string; soft: string; ring: string }> = {
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20', soft: 'bg-emerald-500/10', ring: 'ring-emerald-500/30' },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-500/20', soft: 'bg-rose-500/10', ring: 'ring-rose-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20', soft: 'bg-amber-500/10', ring: 'ring-amber-500/30' },
  sky: { bg: 'bg-sky-500/15', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-500/20', soft: 'bg-sky-500/10', ring: 'ring-sky-500/30' },
  violet: { bg: 'bg-violet-500/15', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-500/20', soft: 'bg-violet-500/10', ring: 'ring-violet-500/30' },
  cyan: { bg: 'bg-cyan-500/15', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-500/20', soft: 'bg-cyan-500/10', ring: 'ring-cyan-500/30' },
}

// ─── SectionHeader ─────────────────────────────────────────────────────────────
export function SectionHeader({
  title,
  subtitle,
  icon: Icon,
  accent = 'emerald',
  action,
}: {
  title: string
  subtitle?: string
  icon?: LucideIcon
  accent?: keyof typeof accentClasses | string
  action?: React.ReactNode
}) {
  const a = accentClasses[accent] || accentClasses.emerald
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', a.bg, a.text)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h2 className="text-lg font-semibold text-foreground tracking-tight sm:text-xl">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  )
}

// ─── KpiCard ───────────────────────────────────────────────────────────────────
export function KpiCard({
  label,
  value,
  changePct,
  icon: Icon,
  accent = 'emerald',
  insight,
  trend,
}: {
  label: string
  value: string
  changePct: number
  icon: LucideIcon
  accent?: keyof typeof accentClasses | string
  insight?: string
  trend?: number[]
}) {
  const a = accentClasses[accent] || accentClasses.emerald
  const positive = changePct >= 0
  return (
    <Card className="group relative overflow-hidden border-border/60 transition-all hover:shadow-md hover:border-border">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</p>
          </div>
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', a.bg, a.text)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-semibold',
              positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
            )}
          >
            {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {Math.abs(changePct).toFixed(1)}%
          </span>
          <span className="text-xs text-muted-foreground">vs last month</span>
        </div>
        {trend && trend.length > 0 && <Sparkline data={trend} accent={accent} />}
        {insight && (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-2">{insight}</p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Sparkline (no chart lib needed — pure SVG) ────────────────────────────────
export function Sparkline({ data, accent = 'emerald' }: { data: number[]; accent?: string }) {
  const a = accentClasses[accent] || accentClasses.emerald
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 100
  const h = 28
  const step = data.length > 1 ? w / (data.length - 1) : w
  const points = data.map((d, i) => `${i * step},${h - ((d - min) / range) * h}`).join(' ')
  const strokeClass = a.text.replace('text-', 'stroke-')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-7 w-full" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={strokeClass}
      />
    </svg>
  )
}

// ─── ChartCard ─────────────────────────────────────────────────────────────────
export function ChartCard({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn('border-border/60', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div className="min-w-0">
          <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  )
}

// ─── StatusPill ────────────────────────────────────────────────────────────────
const statusVariants: Record<string, string> = {
  // generic
  Paid: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  Pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20',
  Overdue: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20',
  Draft: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/20',
  Cancelled: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/20',
  Filed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  Scheduled: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/20',
  Active: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  Inactive: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/20',
  'On Leave': 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20',
  Resigned: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/20',
  Completed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  Processing: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/20',
  Paused: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20',
  Compliant: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  'Due Soon': 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20',
  'Action Needed': 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/20',
  'In Stock': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  'Low Stock': 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20',
  'Out of Stock': 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20',
  Credit: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  Debit: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20',
}

export function StatusPill({ status }: { status: string }) {
  const cls = statusVariants[status] || 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/20'
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', cls)}>
      {status}
    </span>
  )
}

// ─── SeverityBadge ─────────────────────────────────────────────────────────────
export function SeverityBadge({ severity }: { severity: 'info' | 'success' | 'warning' | 'critical' | 'low' | 'medium' | 'high' }) {
  const map: Record<string, string> = {
    info: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/20',
    success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
    warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20',
    critical: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20',
    low: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/20',
    medium: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20',
    high: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20',
  }
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', map[severity])}>
      {severity}
    </span>
  )
}

// ─── EmptyState ────────────────────────────────────────────────────────────────
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 p-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

// ─── Pill (small label) ────────────────────────────────────────────────────────
export function Pill({ children, accent = 'emerald' }: { children: React.ReactNode; accent?: string }) {
  const a = accentClasses[accent] || accentClasses.emerald
  return <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium', a.bg, a.text)}>{children}</span>
}

// Re-export for convenience
export { Badge }
