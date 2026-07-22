'use client'

/**
 * AutomationBuilder — no-code workflow automation builder.
 * KPIs for active/runs/time-saved, category bar chart, searchable
 * automations table with toggle Activate/Pause + expandable flow
 * diagram, templates panel, mock visual builder canvas.
 */

import * as React from 'react'
import {
  Workflow, Plus, Upload, Eye, Search, ChevronDown, ChevronRight,
  Zap, Activity, Clock, TrendingUp, Play, Pause, ArrowRight,
  Mail, Bell, FileText, RefreshCw, ShoppingCart, Users, ShieldCheck, CheckCircle2,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import { BarChart, CHART_COLORS } from '@/components/finos/ui/charts'
import {
  SectionHeader, KpiCard, ChartCard, StatusPill, Pill, EmptyState, accentClasses,
} from '@/components/finos/ui/primitives'
import { automations, type Automation } from '@/lib/finos/data'
import { formatNumber, formatRelative } from '@/lib/finos/format'
import { cn } from '@/lib/utils'

const TABS = ['all', 'active', 'paused', 'drafts'] as const
type TabKey = (typeof TABS)[number]

const TH = 'text-xs uppercase tracking-wide'
const THR = 'text-right text-xs uppercase tracking-wide'

const CAT_COLORS: Record<Automation['category'], string> = {
  GST: '#f59e0b',
  Banking: '#0ea5e9',
  Sales: '#10b981',
  Payroll: '#8b5cf6',
  Compliance: '#f43f5e',
}

// ─── Templates panel ──────────────────────────────────────────────────────────
const TEMPLATES: { id: string; name: string; description: string; icon: LucideIcon; accent: string }[] = [
  { id: 't1', name: 'Auto-Reconcile Bank', description: 'Match NEFT/IMPS to invoices on new bank transaction.', icon: RefreshCw, accent: 'sky' },
  { id: 't2', name: 'GST Filing Reminder', description: 'Notify finance team 3 days before every GST due date.', icon: Bell, accent: 'amber' },
  { id: 't3', name: 'Vendor Bill Approval', description: 'Route vendor bills > ₹1L to CFO for approval on entry.', icon: ShoppingCart, accent: 'cyan' },
  { id: 't4', name: 'Payroll Pre-Run Check', description: 'Verify PF/TDS challans ready 24h before payroll run.', icon: Users, accent: 'violet' },
]

// ─── Builder canvas nodes (mock — visual only) ────────────────────────────────
const NODES: { id: string; label: string; icon: LucideIcon; accent: string; desc: string }[] = [
  { id: 'trigger', label: 'Trigger', icon: Zap, accent: 'amber', desc: 'When something happens' },
  { id: 'condition', label: 'Condition', icon: CheckCircle2, accent: 'sky', desc: 'If / then / branch' },
  { id: 'action', label: 'Action', icon: ArrowRight, accent: 'emerald', desc: 'Do something' },
]

// ─── Per-automation toggle state hook ─────────────────────────────────────────
function useToggleStates() {
  const [states, setStates] = React.useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const a of automations) init[a.id] = a.status === 'Active'
    return init
  })
  const toggle = React.useCallback((id: string) => {
    setStates((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])
  return { states, toggle }
}

export function AutomationBuilder() {
  const [tab, setTab] = React.useState<TabKey>('all')
  const [query, setQuery] = React.useState('')
  const [expanded, setExpanded] = React.useState<string | null>(null)
  const { states, toggle } = useToggleStates()

  // ─── KPI derivations ────────────────────────────────────────────────────────
  const kpis = React.useMemo(() => {
    const activeCount = automations.filter((a) => states[a.id]).length
    const totalRuns = automations.reduce((s, a) => s + a.runs, 0)
    const runsThisMonth = 340
    return { activeCount, totalRuns, runsThisMonth, timeSaved: '284 hours' }
  }, [states])

  // ─── Category bar chart ─────────────────────────────────────────────────────
  const byCategory = React.useMemo(() => {
    const map = new Map<Automation['category'], number>()
    for (const a of automations) map.set(a.category, (map.get(a.category) ?? 0) + a.runs)
    return Array.from(map.entries()).map(([category, runs]) => ({ category, runs, color: CAT_COLORS[category] }))
  }, [])

  // ─── Filtered automations ───────────────────────────────────────────────────
  const filtered = React.useMemo(() => {
    let list = automations
    if (tab === 'active') list = list.filter((a) => states[a.id])
    else if (tab === 'paused') list = list.filter((a) => a.status === 'Paused' && !states[a.id])
    else if (tab === 'drafts') list = list.filter((a) => a.status === 'Draft')
    return list.filter((a) => {
      if (!query.trim()) return true
      const q = query.toLowerCase()
      return a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.trigger.toLowerCase().includes(q) || a.action.toLowerCase().includes(q) || a.category.toLowerCase().includes(q)
    })
  }, [tab, query, states])

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Automation Builder"
        subtitle="No-code workflows across GST · Banking · Sales · Payroll · Compliance"
        icon={Workflow}
        accent="cyan"
        action={<Pill accent="cyan">{kpis.activeCount} active · {formatNumber(kpis.totalRuns)} total runs</Pill>}
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active Automations" value={String(kpis.activeCount)} changePct={12.5} icon={Zap} accent="emerald" insight="Running across all modules" trend={[4, 5, 5, 6, 6, 7]} />
        <KpiCard label="Total Runs" value={formatNumber(kpis.totalRuns)} changePct={18.2} icon={Activity} accent="cyan" insight="Lifetime executions across all workflows" trend={[180, 220, 280, 340, 410, 480]} />
        <KpiCard label="Runs This Month" value={formatNumber(kpis.runsThisMonth)} changePct={8.4} icon={TrendingUp} accent="sky" insight="August — daily run rate trending up" trend={[8, 9, 11, 10, 12, 14]} />
        <KpiCard label="Time Saved" value={kpis.timeSaved} changePct={22.1} icon={Clock} accent="violet" insight="Manual hours saved this month" trend={[180, 210, 240, 250, 270, 284]} />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick actions</span>
        <Button variant="outline" size="sm" className="h-8 gap-1.5"><Plus className="h-3.5 w-3.5" /> Create Automation</Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5"><Upload className="h-3.5 w-3.5" /> Import Workflow</Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5"><Eye className="h-3.5 w-3.5" /> View Logs</Button>
      </div>

      {/* Category bar chart */}
      <ChartCard title="Automations by Category" subtitle="Total run counts grouped by business module" action={<Pill accent="cyan">{byCategory.length} categories</Pill>}>
        <BarChart
          series={[{ name: 'Runs', data: byCategory.map((c) => c.runs) }]}
          labels={byCategory.map((c) => c.category)}
          colors={[CHART_COLORS.cyan]}
          height={256}
        />
      </ChartCard>

      {/* Tabs: All / Active / Paused / Drafts */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="h-9">
          <TabsTrigger value="all" className="gap-1.5 text-xs"><Workflow className="h-3.5 w-3.5" /> All Automations</TabsTrigger>
          <TabsTrigger value="active" className="gap-1.5 text-xs"><Zap className="h-3.5 w-3.5" /> Active</TabsTrigger>
          <TabsTrigger value="paused" className="gap-1.5 text-xs"><Pause className="h-3.5 w-3.5" /> Paused</TabsTrigger>
          <TabsTrigger value="drafts" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> Drafts</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="space-y-3">
          <Card className="border-border/60">
            <CardHeader className="flex flex-col gap-3 space-y-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">All Automations</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">{filtered.length} of {automations.length} shown</p>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, trigger, action…" className="h-8 w-full pl-8 text-xs sm:w-72" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {filtered.length === 0 ? (
                <EmptyState icon={Workflow} title="No automations found" description="Adjust your filters or create a new automation." />
              ) : (
                <div className="max-h-[28rem] overflow-x-auto overflow-y-auto pr-1">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow className="border-border/60">
                        <TableHead className="w-8" />
                        <TableHead className={TH}>Name</TableHead>
                        <TableHead className={TH}>Description</TableHead>
                        <TableHead className={TH}>Trigger</TableHead>
                        <TableHead className={TH}>Action</TableHead>
                        <TableHead className={TH}>Category</TableHead>
                        <TableHead className={THR}>Runs</TableHead>
                        <TableHead className={TH}>Last Run</TableHead>
                        <TableHead className={TH}>Status</TableHead>
                        <TableHead className={TH}>Toggle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((a) => {
                        const isOpen = expanded === a.id
                        const isActive = states[a.id]
                        const a2 = accentClasses[CAT_COLORS[a.category] ? 'cyan' : 'cyan']
                        return (
                          <React.Fragment key={a.id}>
                            <TableRow className="cursor-pointer border-border/60" onClick={() => setExpanded(isOpen ? null : a.id)}>
                              <TableCell className="text-muted-foreground">{isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</TableCell>
                              <TableCell className="text-sm font-medium text-foreground">{a.name}</TableCell>
                              <TableCell className="max-w-[14rem] truncate text-xs text-muted-foreground">{a.description}</TableCell>
                              <TableCell className="max-w-[10rem] truncate text-xs text-muted-foreground">{a.trigger}</TableCell>
                              <TableCell className="max-w-[12rem] truncate text-xs text-muted-foreground">{a.action}</TableCell>
                              <TableCell>
                                <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium', a2.bg, a2.text)}>{a.category}</span>
                              </TableCell>
                              <TableCell className="text-right text-xs font-semibold text-foreground tabular-nums">{formatNumber(a.runs)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{formatRelative(a.lastRun)}</TableCell>
                              <TableCell><StatusPill status={isActive ? 'Active' : a.status === 'Draft' ? 'Draft' : 'Paused'} /></TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-2">
                                  <Switch checked={isActive} onCheckedChange={() => toggle(a.id)} aria-label={`Toggle ${a.name}`} />
                                  <span className="text-[10px] text-muted-foreground">{isActive ? 'On' : 'Off'}</span>
                                </div>
                              </TableCell>
                            </TableRow>
                            {isOpen && (
                              <TableRow className="bg-muted/30 border-border/60">
                                <TableCell colSpan={10} className="p-4">
                                  {/* Visual flow diagram: Trigger → Action → Output */}
                                  <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                                    <FlowNode icon={Zap} label="Trigger" sub={a.trigger} accent="amber" />
                                    <FlowArrow />
                                    <FlowNode icon={ArrowRight} label="Action" sub={a.action} accent="cyan" />
                                    <FlowArrow />
                                    <FlowNode icon={CheckCircle2} label="Output" sub={`Logged + ${a.category} module updated`} accent="emerald" />
                                  </div>
                                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total Runs</p>
                                      <p className="mt-0.5 font-semibold text-foreground">{formatNumber(a.runs)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Last Run</p>
                                      <p className="mt-0.5 font-semibold text-foreground">{formatRelative(a.lastRun)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Category</p>
                                      <p className="mt-0.5 font-semibold text-foreground">{a.category}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Description</p>
                                      <p className="mt-0.5 leading-relaxed text-muted-foreground">{a.description}</p>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Templates + Builder canvas row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Templates panel */}
        <Card className="border-border/60">
          <CardHeader className="space-y-0 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">Templates</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Pre-built workflows — click to install</p>
              </div>
              <Pill accent="cyan">{TEMPLATES.length} templates</Pill>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TEMPLATES.map((t) => {
                const a = accentClasses[t.accent]
                const Icon = t.icon
                return (
                  <div key={t.id} className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 transition-all hover:border-border hover:shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', a.bg, a.text)}><Icon className="h-4 w-4" /></div>
                      <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">{t.description}</p>
                    <Button size="sm" variant="outline" className="mt-auto h-7 gap-1.5 text-xs">Use Template</Button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Builder canvas (mock) */}
        <Card className="border-border/60">
          <CardHeader className="space-y-0 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">Workflow Builder</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Drag a trigger to start — visual canvas</p>
              </div>
              <Badge variant="outline" className="gap-1 border-cyan-500/30 text-cyan-600 dark:text-cyan-400"><Workflow className="h-3 w-3" /> Draft</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex min-h-[14rem] flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-border/60 bg-muted/30 p-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                <Workflow className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Drag a trigger to start</p>
                <p className="mt-1 text-xs text-muted-foreground">Connect nodes to build your automation flow</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {NODES.map((n, i) => {
                  const a = accentClasses[n.accent]
                  const Icon = n.icon
                  return (
                    <React.Fragment key={n.id}>
                      <div className="flex w-24 flex-col items-center gap-1.5 rounded-xl border border-border/60 bg-card p-3 shadow-sm transition-all hover:shadow-md">
                        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', a.bg, a.text)}><Icon className="h-4 w-4" /></div>
                        <p className="text-xs font-semibold text-foreground">{n.label}</p>
                        <p className="text-[10px] leading-tight text-muted-foreground">{n.desc}</p>
                      </div>
                      {i < NODES.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    </React.Fragment>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Flow node (used in expandable automation detail) ─────────────────────────
function FlowNode({ icon: Icon, label, sub, accent }: { icon: LucideIcon; label: string; sub: string; accent: string }) {
  const a = accentClasses[accent]
  return (
    <div className="flex flex-1 items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', a.bg, a.text)}><Icon className="h-4 w-4" /></div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-xs font-medium text-foreground">{sub}</p>
      </div>
    </div>
  )
}

function FlowArrow() {
  return <ArrowRight className="hidden h-5 w-5 shrink-0 text-muted-foreground sm:block" />
}
