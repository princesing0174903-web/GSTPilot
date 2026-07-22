'use client'

/**
 * ComplianceCenter — compliance calendar, notices, statutory payments.
 * Large semi-circular health-score gauge, vertical compliance calendar
 * timeline with category filter, upcoming deadlines panel, overdue
 * alert panel with penalty accrual, statutory payments summary table.
 */

import * as React from 'react'
import {
  ShieldCheck, FileText, IndianRupee, CalendarClock, AlertOctagon,
  Receipt, Landmark, Briefcase, Building2, PiggyBank, ArrowRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import {
  SectionHeader, KpiCard, ChartCard, StatusPill, SeverityBadge, Pill, EmptyState, accentClasses,
} from '@/components/finos/ui/primitives'
import { GaugeChart, CHART_COLORS } from '@/components/finos/ui/charts'
import { complianceItems, type ComplianceItem } from '@/lib/finos/data'
import { formatINR, formatINRCompact, formatDate } from '@/lib/finos/format'
import { cn } from '@/lib/utils'

const CAT_FILTERS = ['All', 'GST', 'TDS', 'PF', 'ESI', 'ROC', 'Income Tax'] as const
type CatFilter = (typeof CAT_FILTERS)[number]

const TH = 'text-xs uppercase tracking-wide'
const THR = 'text-right text-xs uppercase tracking-wide'

// ─── Category icon + accent map ───────────────────────────────────────────────
const CAT_META: Record<ComplianceItem['category'], { icon: typeof Receipt; accent: string }> = {
  GST: { icon: Receipt, accent: 'amber' },
  TDS: { icon: IndianRupee, accent: 'emerald' },
  PF: { icon: PiggyBank, accent: 'sky' },
  ESI: { icon: Briefcase, accent: 'violet' },
  ROC: { icon: Building2, accent: 'cyan' },
  'Income Tax': { icon: Landmark, accent: 'rose' },
}

// ─── Statutory payments summary ───────────────────────────────────────────────
const STATUTORY_PAYMENTS = [
  { id: 'pf', label: 'PF (July)', amount: 218000, status: 'Compliant', dueDate: '2025-08-15' },
  { id: 'esi', label: 'ESI (July)', amount: 84000, status: 'Pending', dueDate: '2025-08-21' },
  { id: 'tds-q1', label: 'TDS Q1 (Apr-Jun)', amount: 412000, status: 'Compliant', dueDate: '2025-08-07' },
  { id: 'adv-tax-q2', label: 'Advance Tax Q2', amount: 1840000, status: 'Due', dueDate: '2025-09-15' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysUntil(iso: string): number {
  return Math.floor((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}
function daysOverdue(iso: string): number {
  return Math.max(0, -daysUntil(iso))
}

export function ComplianceCenter() {
  const [catFilter, setCatFilter] = React.useState<CatFilter>('All')

  // ─── KPI counts by status ───────────────────────────────────────────────────
  const kpis = React.useMemo(() => {
    const compliant = complianceItems.filter((c) => c.status === 'Compliant').length
    const dueSoon = complianceItems.filter((c) => c.status === 'Due Soon').length
    const overdue = complianceItems.filter((c) => c.status === 'Overdue').length
    const actionNeeded = complianceItems.filter((c) => c.status === 'Action Needed').length
    return { compliant, dueSoon, overdue, actionNeeded }
  }, [])

  // ─── Filtered calendar timeline (sorted by dueDate) ─────────────────────────
  const timeline = React.useMemo(() => {
    return [...complianceItems]
      .filter((c) => catFilter === 'All' || c.category === catFilter)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
  }, [catFilter])

  // ─── Upcoming deadlines (next 30 days) ──────────────────────────────────────
  const upcoming = React.useMemo(() => {
    return complianceItems
      .filter((c) => {
        const d = daysUntil(c.dueDate)
        return d >= 0 && d <= 30
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
  }, [])

  // ─── Overdue items ──────────────────────────────────────────────────────────
  const overdueItems = React.useMemo(() => complianceItems.filter((c) => c.status === 'Overdue'), [])

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Compliance Center"
        subtitle="GST · TDS · PF · ESI · ROC · Income Tax — calendar + notices"
        icon={ShieldCheck}
        accent="rose"
        action={<Pill accent="rose">{kpis.overdue} overdue · {kpis.dueSoon} due soon</Pill>}
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Compliant" value={String(kpis.compliant)} changePct={6.4} icon={ShieldCheck} accent="emerald" insight="Filed and deposited on time" trend={[3, 4, 4, 5, 5, 5]} />
        <KpiCard label="Due Soon" value={String(kpis.dueSoon)} changePct={-2.1} icon={CalendarClock} accent="amber" insight="Within 30 days — schedule payment" trend={[4, 3, 4, 3, 2, 2]} />
        <KpiCard label="Overdue" value={String(kpis.overdue)} changePct={-1.4} icon={AlertOctagon} accent="rose" insight="Penalty accruing ₹200/day — file now" trend={[3, 2, 2, 1, 2, 1]} />
        <KpiCard label="Action Needed" value={String(kpis.actionNeeded)} changePct={0.8} icon={FileText} accent="violet" insight="Auditor or board approval required" trend={[1, 2, 2, 2, 1, 2]} />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick actions</span>
        <Button variant="outline" size="sm" className="h-8 gap-1.5"><FileText className="h-3.5 w-3.5" /> File ITC-04</Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5"><IndianRupee className="h-3.5 w-3.5" /> Pay ESI</Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Schedule Advance Tax</Button>
      </div>

      {/* Health gauge + Statutory payments summary */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-border/60 lg:col-span-1">
          <CardHeader className="space-y-0 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">Compliance Health Score</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Weighted by severity & deadline proximity</p>
              </div>
              <Badge variant="outline" className="gap-1 border-violet-500/30 text-violet-600 dark:text-violet-400"><ShieldCheck className="h-3 w-3" /> Strong</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3 pt-0">
            <GaugeChart value={94} max={100} label="Strong" color={CHART_COLORS.violet} height={150} />
            <div className="grid w-full grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Filed</p>
                <p className="mt-0.5 text-sm font-bold text-foreground tabular-nums">{kpis.compliant}</p>
              </div>
              <div className="rounded-lg bg-muted p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pending</p>
                <p className="mt-0.5 text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums">{kpis.dueSoon + kpis.actionNeeded}</p>
              </div>
              <div className="rounded-lg bg-muted p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Overdue</p>
                <p className="mt-0.5 text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums">{kpis.overdue}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 lg:col-span-2">
          <CardHeader className="space-y-0 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">Statutory Payments Summary</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">PF · ESI · TDS · Advance Tax — current quarter</p>
              </div>
              <Pill accent="emerald">{formatINRCompact(STATUTORY_PAYMENTS.reduce((s, p) => s + p.amount, 0))} total</Pill>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60">
                    <TableHead className={TH}>Payment</TableHead>
                    <TableHead className={THR}>Amount</TableHead>
                    <TableHead className={TH}>Due Date</TableHead>
                    <TableHead className={TH}>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {STATUTORY_PAYMENTS.map((p) => (
                    <TableRow key={p.id} className="border-border/60">
                      <TableCell className="text-sm font-medium text-foreground">{p.label}</TableCell>
                      <TableCell className="text-right text-sm font-semibold text-foreground tabular-nums">{formatINR(p.amount)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(p.dueDate)}</TableCell>
                      <TableCell><StatusPill status={p.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Calendar — vertical timeline */}
      <Card className="border-border/60">
        <CardHeader className="flex flex-col gap-3 space-y-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-foreground">Compliance Calendar</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">{timeline.length} of {complianceItems.length} items — sorted by due date</p>
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
            {CAT_FILTERS.map((f) => (
              <button key={f} onClick={() => setCatFilter(f)} className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors', catFilter === f ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{f}</button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {timeline.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No compliance items" description="No items match this category." />
          ) : (
            <div className="max-h-[28rem] space-y-0 overflow-y-auto pr-1">
              {timeline.map((c, i) => {
                const meta = CAT_META[c.category]
                const Icon = meta.icon
                const a = accentClasses[meta.accent]
                const d = daysUntil(c.dueDate)
                const od = daysOverdue(c.dueDate)
                return (
                  <div key={c.id} className="relative flex gap-3 pb-4">
                    {/* timeline line */}
                    {i < timeline.length - 1 && (
                      <span className="absolute left-5 top-10 bottom-0 w-px bg-border" aria-hidden />
                    )}
                    <div className={cn('relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', a.bg, a.text)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1 rounded-lg border border-border/60 bg-card p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{c.title}</span>
                          <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium', a.bg, a.text)}>{c.category}</span>
                          <SeverityBadge severity={c.severity} />
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusPill status={c.status} />
                        </div>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{c.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
                        <span className="flex items-center gap-1 text-muted-foreground"><CalendarClock className="h-3 w-3" /> Due {formatDate(c.dueDate)}</span>
                        <span className={cn('font-semibold', od > 0 ? 'text-rose-600 dark:text-rose-400' : d <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>
                          {od > 0 ? `${od} days overdue` : d === 0 ? 'Due today' : `${d} days remaining`}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming + Overdue panels */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Upcoming Deadlines */}
        <Card className="border-border/60">
          <CardHeader className="space-y-0 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">Upcoming Deadlines</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Next 30 days — sorted by due date</p>
              </div>
              <Badge variant="outline" className="gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400"><CalendarClock className="h-3 w-3" /> {upcoming.length} items</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {upcoming.length === 0 ? (
                <EmptyState icon={CalendarClock} title="No upcoming deadlines" description="Nothing due in the next 30 days." />
              ) : (
                upcoming.map((c) => {
                  const meta = CAT_META[c.category]
                  const d = daysUntil(c.dueDate)
                  const a = accentClasses[meta.accent]
                  return (
                    <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', a.bg, a.text)}>
                        <meta.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{c.title}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">Due {formatDate(c.dueDate)} · {c.category}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={cn('text-sm font-bold tabular-nums', d <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>{d}d</p>
                        <p className="text-[10px] text-muted-foreground">remaining</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Overdue Items */}
        <Card className="border-rose-500/30">
          <CardHeader className="space-y-0 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">Overdue Items</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Penalty accruing at ₹200/day per item</p>
              </div>
              <Badge variant="outline" className="gap-1 border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"><AlertOctagon className="h-3 w-3" /> Critical</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {overdueItems.length === 0 ? (
                <EmptyState icon={ShieldCheck} title="No overdue items" description="All compliance filings are on time." />
              ) : (
                overdueItems.map((c) => {
                  const od = daysOverdue(c.dueDate)
                  const penalty = od * 200
                  return (
                    <div key={c.id} className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{c.title}</span>
                          <SeverityBadge severity={c.severity} />
                        </div>
                        <StatusPill status={c.status} />
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{c.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
                        <span className="text-muted-foreground">Due {formatDate(c.dueDate)}</span>
                        <span className="font-semibold text-rose-600 dark:text-rose-400">{od} days overdue</span>
                        <span className="ml-auto flex items-center gap-1 rounded-md bg-rose-500/15 px-2 py-0.5 font-semibold text-rose-700 dark:text-rose-300">
                          <IndianRupee className="h-3 w-3" /> Penalty: {formatINR(penalty)}
                        </span>
                      </div>
                      <Button size="sm" variant="outline" className="mt-2 h-7 gap-1.5 text-xs"><FileText className="h-3 w-3" /> File Now <ArrowRight className="h-3 w-3" /></Button>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
