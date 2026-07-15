'use client'

/**
 * ExecutiveDashboard — flagship landing screen for FinOS.
 * Shows KPIs, P&L trend, cash flow, AI insights feed, recent activity,
 * and quick actions. All data comes from the shared data.ts store.
 */

import * as React from 'react'
import {
  Brain, TrendingUp, Wallet, Receipt, Clock, Landmark, ShieldCheck,
  Package, Users, Sparkles, ChevronRight, FileText, Send, Zap,
  ArrowRight, type LucideIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LineChart, BarChart, CHART_COLORS } from '@/components/finos/ui/charts'
import {
  SectionHeader, KpiCard, ChartCard, SeverityBadge, Pill, accentClasses,
} from '@/components/finos/ui/primitives'
import {
  executiveKpis, revenueTrend, cashFlow, aiInsights, auditLog,
} from '@/lib/finos/data'
import { formatINRCompact, formatRelative } from '@/lib/finos/format'
import { cn } from '@/lib/utils'

// Map the KPI.icon string → actual lucide component.
const ICON_MAP: Record<string, LucideIcon> = {
  TrendingUp, Wallet, Receipt, Clock, Landmark, ShieldCheck, Package, Users,
}

const QUICK_ACTIONS = [
  { label: 'Create Invoice', icon: FileText, accent: 'emerald' as const },
  { label: 'File GSTR-1', icon: Receipt, accent: 'amber' as const },
  { label: 'Run Payroll', icon: Users, accent: 'sky' as const },
  { label: 'Ask Oracle', icon: Sparkles, accent: 'violet' as const },
]

export function ExecutiveDashboard() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Executive Dashboard"
        subtitle="Real-time KPIs, P&L, cash flow, AI briefings"
        icon={Brain}
        accent="emerald"
        action={
          <Badge variant="secondary" className="hidden sm:inline-flex">
            <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live · FY 2024-25
          </Badge>
        }
      />

      {/* ── KPI grid (8 cards, 1/2/4 cols) ─────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {executiveKpis.map((k) => {
          const Icon = ICON_MAP[k.icon] || TrendingUp
          return (
            <KpiCard
              key={k.id}
              label={k.label}
              value={k.value}
              changePct={k.changePct}
              icon={Icon}
              accent={k.accent}
              insight={k.insight}
              trend={k.trend}
            />
          )
        })}
      </div>

      {/* ── Quick actions ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_ACTIONS.map((qa) => {
          const a = accentClasses[qa.accent]
          return (
            <Button
              key={qa.label}
              variant="outline"
              className="h-auto justify-start gap-3 border-border/60 py-3 text-sm font-medium hover:bg-muted"
            >
              <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', a.bg, a.text)}>
                <qa.icon className="h-4 w-4" />
              </span>
              <span className="flex-1 text-left">{qa.label}</span>
            </Button>
          )
        })}
      </div>

      {/* ── P&L + Cash flow charts ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          title="Revenue · Expense · Profit (12 mo)"
          subtitle="Monthly P&L trend"
          className="lg:col-span-2"
          action={<Pill accent="emerald">+12.4% YoY</Pill>}
        >
          <LineChart
            series={[
              { name: 'Revenue', color: CHART_COLORS.emerald, data: revenueTrend.map((t) => t.revenue) },
              { name: 'Expense', color: CHART_COLORS.rose, data: revenueTrend.map((t) => t.expense) },
              { name: 'Profit', color: CHART_COLORS.violet, data: revenueTrend.map((t) => t.profit) },
            ]}
            labels={revenueTrend.map((t) => t.month)}
            height={288}
            yFormat={formatINRCompact}
          />
        </ChartCard>

        <ChartCard
          title="Cash Flow (6 mo)"
          subtitle="Inflow vs outflow"
          action={<Pill accent="sky">Net +₹6.5L</Pill>}
        >
          <BarChart
            series={[
              { name: 'Inflow', data: cashFlow.map((c) => c.inflow) },
              { name: 'Outflow', data: cashFlow.map((c) => c.outflow) },
            ]}
            labels={cashFlow.map((c) => c.month)}
            colors={[CHART_COLORS.sky, CHART_COLORS.amber]}
            height={288}
            yFormat={formatINRCompact}
          />
        </ChartCard>
      </div>

      {/* ── AI Insights Feed + Recent Activity ─────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* AI insights (left, spans 2 cols) */}
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">AI Insights Feed</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">8 active briefings from your AI CFO</p>
              </div>
            </div>
            <Badge variant="secondary" className="text-[10px] font-semibold uppercase">Auto-refreshed</Badge>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
              {aiInsights.map((ins) => (
                <InsightCard key={ins.id} insight={ins} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent activity (right) */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
                <Zap className="h-4 w-4" />
              </span>
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">Recent Activity</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Last 6 actions</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
              {auditLog.slice(0, 6).map((entry) => (
                <li key={entry.id} className="flex gap-3">
                  <div className="relative flex flex-col items-center">
                    <span className={cn(
                      'mt-1 h-2 w-2 shrink-0 rounded-full',
                      entry.actor === 'System' ? 'bg-sky-500' : 'bg-emerald-500',
                    )} />
                    <span className="mt-1 w-px flex-1 bg-border/60" />
                  </div>
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <p className="text-sm font-medium text-foreground">{entry.action}</p>
                      <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-medium uppercase">{entry.module}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{entry.detail}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                      {entry.actor} · {formatRelative(entry.timestamp)} · {entry.ip}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── InsightCard (collapsible) ────────────────────────────────────────────────
function InsightCard({ insight }: { insight: typeof aiInsights[number] }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-4 transition-colors hover:bg-muted/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={insight.severity} />
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{insight.category}</span>
          </div>
          <h4 className="mt-2 text-sm font-semibold text-foreground">{insight.title}</h4>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{insight.summary}</p>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Recommendation</p>
            <p className="mt-0.5 text-xs leading-relaxed text-foreground">{insight.recommendation}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Impact</p>
            <p className="mt-0.5 text-xs leading-relaxed text-foreground">{insight.impact}</p>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={() => setOpen((p) => !p)}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
        >
          {open ? 'Show less' : 'Show recommendation'}
          <ChevronRight className={cn('h-3 w-3 transition-transform', open && 'rotate-90')} />
        </button>
        <button className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
          Go to {insight.module}
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
