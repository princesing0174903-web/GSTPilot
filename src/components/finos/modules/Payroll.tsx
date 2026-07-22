'use client'

/**
 * Payroll — employees, pay runs, and statutory compliance.
 * Payroll trend line, department distribution pie, statutory cards,
 * searchable employee table with expandable rows, pay runs table,
 * August payroll breakdown bar chart.
 */

import * as React from 'react'
import {
  Users, Plus, Play, FileText, Search, ChevronDown, ChevronRight,
  IndianRupee, Wallet, Building2, TrendingUp, Clock, BadgeCheck,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import { LineChart, BarChart, DonutChart, CHART_COLORS } from '@/components/finos/ui/charts'
import {
  SectionHeader, KpiCard, ChartCard, StatusPill, Pill, EmptyState, accentClasses,
} from '@/components/finos/ui/primitives'
import { employees, payrollRuns } from '@/lib/finos/data'
import { formatINR, formatINRCompact, formatDate } from '@/lib/finos/format'
import { cn } from '@/lib/utils'

const DEPT_FILTERS = ['All', 'Finance', 'Operations', 'HR', 'Sales'] as const
type DeptFilter = (typeof DEPT_FILTERS)[number]

const TH = 'text-xs uppercase tracking-wide'
const THR = 'text-right text-xs uppercase tracking-wide'

const DEPT_COLORS: Record<string, string> = {
  Finance: '#0ea5e9',
  Operations: '#10b981',
  HR: '#f59e0b',
  Sales: '#8b5cf6',
}

// ─── Statutory compliance cards data ──────────────────────────────────────────
const STATUTORY = [
  { id: 'pf', label: 'Provident Fund', amount: 218000, status: 'Compliant', dueDate: '2025-08-15', note: 'Deposited via EPFO portal', accent: 'emerald' as const },
  { id: 'esi', label: 'ESI Contribution', amount: 84000, status: 'Due Soon', dueDate: '2025-08-21', note: '₹84K pending — 11 days remaining', accent: 'amber' as const },
  { id: 'tds', label: 'TDS (Salary)', amount: 244000, status: 'Compliant', dueDate: '2025-09-07', note: 'Next deposit: Sep 7', accent: 'emerald' as const },
]

// ─── August payroll breakdown bar chart data ──────────────────────────────────
const AUG_BREAKDOWN = [
  { label: 'Gross', amount: 1820000, color: '#0ea5e9' },
  { label: 'Tax (TDS)', amount: 244000, color: '#f43f5e' },
  { label: 'PF', amount: 218400, color: '#f59e0b' },
  { label: 'Net', amount: 1357560, color: '#10b981' },
]

export function Payroll() {
  const [tab, setTab] = React.useState<'employees' | 'payruns' | 'statutory'>('employees')
  const [deptFilter, setDeptFilter] = React.useState<DeptFilter>('All')
  const [query, setQuery] = React.useState('')
  const [expanded, setExpanded] = React.useState<string | null>(null)

  // ─── Derived KPI values ─────────────────────────────────────────────────────
  const kpis = React.useMemo(() => {
    const totalEmployees = employees.length
    const monthlyPayroll = employees.reduce((s, e) => s + e.net, 0)
    const ytdPayroll = monthlyPayroll * 7
    const avgCtc = employees.reduce((s, e) => s + e.ctc, 0) / totalEmployees
    return { totalEmployees, monthlyPayroll, ytdPayroll, avgCtc }
  }, [])

  // ─── Payroll trend (last 4 months from payrollRuns) ─────────────────────────
  const trend = React.useMemo(() => {
    return [...payrollRuns]
      .filter((r) => r.status === 'Completed' || r.status === 'Scheduled')
      .sort((a, b) => new Date(a.runDate).getTime() - new Date(b.runDate).getTime())
      .slice(-4)
      .map((r) => ({ month: r.month.split(' ')[0], gross: r.grossPaid }))
  }, [])

  // ─── Department headcount distribution ──────────────────────────────────────
  const deptDist = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const e of employees) map.set(e.department, (map.get(e.department) ?? 0) + 1)
    return Array.from(map.entries()).map(([label, value]) => ({ label, value, color: DEPT_COLORS[label] ?? '#64748b' }))
  }, [])

  // ─── Filtered employees ─────────────────────────────────────────────────────
  const filtered = React.useMemo(() => {
    return employees
      .filter((e) => deptFilter === 'All' || e.department === deptFilter)
      .filter((e) => {
        if (!query.trim()) return true
        const q = query.toLowerCase()
        return e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.pan.toLowerCase().includes(q) || e.uan.toLowerCase().includes(q)
      })
  }, [deptFilter, query])

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Payroll & HR"
        subtitle="Employees · pay runs · PF/TDS statutory compliance"
        icon={Users}
        accent="sky"
        action={<Pill accent="sky">{kpis.totalEmployees} employees · {formatINRCompact(kpis.monthlyPayroll)}/mo</Pill>}
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Employees" value={String(kpis.totalEmployees)} changePct={4.4} icon={Users} accent="sky" insight="47 active · 0 on leave · 0 resigned" trend={[42, 43, 45, 45, 47, 47]} />
        <KpiCard label="Monthly Payroll" value={formatINRCompact(kpis.monthlyPayroll)} changePct={4.6} icon={IndianRupee} accent="emerald" insight="Net payable for August 2025" trend={[13.4, 13.8, 14.1, 14.2, 13.6, 14.3]} />
        <KpiCard label="YTD Payroll" value={formatINRCompact(kpis.ytdPayroll)} changePct={9.2} icon={Wallet} accent="violet" insight="Apr–Oct cumulative net payouts" trend={[94, 108, 122, 136, 150, 164]} />
        <KpiCard label="Avg CTC" value={formatINRCompact(kpis.avgCtc)} changePct={3.1} icon={TrendingUp} accent="amber" insight="Across all 12 active employees" trend={[12.4, 12.6, 12.8, 13.0, 13.1, 13.5]} />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick actions</span>
        <Button variant="outline" size="sm" className="h-8 gap-1.5"><Play className="h-3.5 w-3.5" /> Run Payroll</Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5"><Plus className="h-3.5 w-3.5" /> Add Employee</Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5"><FileText className="h-3.5 w-3.5" /> Generate Payslips</Button>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Payroll Trend" subtitle="Gross paid — last 4 months" action={<Pill accent="sky">+4.6% MoM</Pill>}>
          <LineChart
            series={[{ name: 'Gross Paid', color: CHART_COLORS.sky, data: trend.map((t) => t.gross) }]}
            labels={trend.map((t) => t.month)}
            height={256}
            yFormat={formatINRCompact}
          />
        </ChartCard>

        <ChartCard title="Department Distribution" subtitle="Headcount by department" action={<Pill accent="sky">{deptDist.length} departments</Pill>}>
          <DonutChart
            data={deptDist}
            height={256}
            centerLabel="Employees"
            centerValue={String(kpis.totalEmployees)}
          />
        </ChartCard>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="h-9">
          <TabsTrigger value="employees" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" /> Employees</TabsTrigger>
          <TabsTrigger value="payruns" className="gap-1.5 text-xs"><Clock className="h-3.5 w-3.5" /> Pay Runs</TabsTrigger>
          <TabsTrigger value="statutory" className="gap-1.5 text-xs"><BadgeCheck className="h-3.5 w-3.5" /> Statutory</TabsTrigger>
        </TabsList>

        {/* Employees tab */}
        <TabsContent value="employees" className="space-y-3">
          <Card className="border-border/60">
            <CardHeader className="flex flex-col gap-3 space-y-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">All Employees</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">{filtered.length} of {employees.length} shown</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, role, PAN, UAN…" className="h-8 w-full pl-8 text-xs sm:w-60" />
                </div>
                <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
                  {DEPT_FILTERS.map((f) => (
                    <button key={f} onClick={() => setDeptFilter(f)} className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors', deptFilter === f ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{f}</button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {filtered.length === 0 ? (
                <EmptyState icon={Users} title="No employees found" description="Adjust your filters." />
              ) : (
                <div className="max-h-[28rem] overflow-x-auto overflow-y-auto pr-1">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow className="border-border/60">
                        <TableHead className="w-8" />
                        <TableHead className={TH}>Name</TableHead>
                        <TableHead className={TH}>Role</TableHead>
                        <TableHead className={TH}>Department</TableHead>
                        <TableHead className={TH}>Joined</TableHead>
                        <TableHead className={THR}>CTC</TableHead>
                        <TableHead className={THR}>Gross</TableHead>
                        <TableHead className={THR}>Net</TableHead>
                        <TableHead className={TH}>PAN</TableHead>
                        <TableHead className={TH}>UAN</TableHead>
                        <TableHead className={TH}>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((e) => {
                        const isOpen = expanded === e.id
                        return (
                          <React.Fragment key={e.id}>
                            <TableRow className="cursor-pointer border-border/60" onClick={() => setExpanded(isOpen ? null : e.id)}>
                              <TableCell className="text-muted-foreground">{isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</TableCell>
                              <TableCell className="text-sm font-medium text-foreground">{e.name}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{e.role}</TableCell>
                              <TableCell><span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium', accentClasses[DEPT_COLORS[e.department] ? 'sky' : 'emerald'].bg, 'text-foreground')}>{e.department}</span></TableCell>
                              <TableCell className="text-xs text-muted-foreground">{formatDate(e.joinedAt)}</TableCell>
                              <TableCell className="text-right text-xs font-semibold text-foreground tabular-nums">{formatINR(e.ctc)}</TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground tabular-nums">{formatINR(e.gross)}</TableCell>
                              <TableCell className="text-right text-sm font-semibold text-foreground tabular-nums">{formatINR(e.net)}</TableCell>
                              <TableCell className="font-mono text-[11px] text-muted-foreground">{e.pan}</TableCell>
                              <TableCell className="font-mono text-[11px] text-muted-foreground">{e.uan}</TableCell>
                              <TableCell><StatusPill status={e.status} /></TableCell>
                            </TableRow>
                            {isOpen && (
                              <TableRow className="bg-muted/30 border-border/60">
                                <TableCell colSpan={11} className="p-4">
                                  <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Email</p>
                                      <p className="mt-0.5 truncate text-foreground">{e.email}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Tenure</p>
                                      <p className="mt-0.5 font-semibold text-foreground">{Math.max(0, Math.floor((Date.now() - new Date(e.joinedAt).getTime()) / (1000 * 60 * 60 * 24 * 365)))} years</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Annual CTC</p>
                                      <p className="mt-0.5 font-semibold text-foreground">{formatINR(e.ctc)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Monthly Net</p>
                                      <p className="mt-0.5 font-semibold text-foreground">{formatINR(e.net)}</p>
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

        {/* Pay Runs tab */}
        <TabsContent value="payruns" className="space-y-3">
          <Card className="border-border/60">
            <CardHeader className="space-y-0 pb-3">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">Pay Runs</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">{payrollRuns.length} runs — current and historical</p>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60">
                      <TableHead className={TH}>Month</TableHead>
                      <TableHead className={TH}>Run Date</TableHead>
                      <TableHead className={THR}>Employees</TableHead>
                      <TableHead className={THR}>Gross Paid</TableHead>
                      <TableHead className={THR}>Tax Deducted</TableHead>
                      <TableHead className={THR}>PF Deposited</TableHead>
                      <TableHead className={TH}>Status</TableHead>
                      <TableHead className={TH}>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollRuns.map((r) => (
                      <TableRow key={r.id} className="border-border/60">
                        <TableCell className="text-sm font-medium text-foreground">{r.month}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(r.runDate)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground tabular-nums">{r.employees}</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-foreground tabular-nums">{formatINR(r.grossPaid)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground tabular-nums">{formatINR(r.taxDeducted)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground tabular-nums">{formatINR(r.pfDeposited)}</TableCell>
                        <TableCell><StatusPill status={r.status} /></TableCell>
                        <TableCell>
                          {r.status === 'Scheduled' ? (
                            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"><Play className="h-3 w-3" /> Run Payroll</Button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statutory tab */}
        <TabsContent value="statutory" className="space-y-3">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {STATUTORY.map((s) => {
              const a = accentClasses[s.accent]
              return (
                <Card key={s.id} className="border-border/60">
                  <CardHeader className="space-y-0 pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm font-semibold text-foreground">{s.label}</CardTitle>
                      <StatusPill status={s.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Amount</p>
                      <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{formatINR(s.amount)}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Clock className={cn('h-3.5 w-3.5', a.text)} />
                      <span className="text-muted-foreground">Due {formatDate(s.dueDate)}</span>
                    </div>
                    <div className={cn('rounded-lg border p-2.5 text-[11px] leading-relaxed', a.border, a.bg, a.text)}>
                      {s.note}
                    </div>
                    <Button size="sm" variant="outline" className="h-7 w-full gap-1.5 text-xs">View Challan</Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* August Payroll Breakdown */}
      <ChartCard title="August Payroll Breakdown" subtitle="Gross → Tax + PF deductions → Net payout" action={<Pill accent="sky">August 2025</Pill>}>
        <BarChart
          series={[{ name: 'Amount', data: AUG_BREAKDOWN.map((d) => d.amount) }]}
          labels={AUG_BREAKDOWN.map((d) => d.label)}
          colors={[CHART_COLORS.sky]}
          height={224}
          yFormat={formatINRCompact}
        />
      </ChartCard>
    </div>
  )
}
