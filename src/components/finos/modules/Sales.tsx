'use client'

/**
 * Sales — invoices, customers, and receivables module.
 * Aging analysis, expandable invoice rows, customer LTV, sales trend chart.
 */

import * as React from 'react'
import {
  TrendingUp, Plus, Bell, FileDown, Search, ChevronDown, ChevronRight,
  Receipt, IndianRupee, Wallet, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import { BarChart, CHART_COLORS } from '@/components/finos/ui/charts'
import {
  SectionHeader, KpiCard, ChartCard, StatusPill, Pill, EmptyState,
} from '@/components/finos/ui/primitives'
import { invoices, customers, type InvoiceStatus } from '@/lib/finos/data'
import { formatINR, formatINRCompact, formatDate } from '@/lib/finos/format'
import { cn } from '@/lib/utils'

const STATUS_FILTERS = ['All', 'Paid', 'Pending', 'Overdue', 'Draft'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

const SALES_TREND = [
  { month: 'Feb', invoiced: 14200000 }, { month: 'Mar', invoiced: 16500000 },
  { month: 'Apr', invoiced: 17800000 }, { month: 'May', invoiced: 18400000 },
  { month: 'Jun', invoiced: 17200000 }, { month: 'Jul', invoiced: 18800000 },
]

const TH = 'text-xs uppercase tracking-wide'
const THR = 'text-right text-xs uppercase tracking-wide'

function daysOverdue(dueDate: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)))
}

export function Sales() {
  const [tab, setTab] = React.useState<'invoices' | 'customers' | 'receivables'>('invoices')
  const [invFilter, setInvFilter] = React.useState<StatusFilter>('All')
  const [invQuery, setInvQuery] = React.useState('')
  const [expanded, setExpanded] = React.useState<string | null>(null)
  const [custQuery, setCustQuery] = React.useState('')

  const kpis = React.useMemo(() => {
    const invoicedMtd = invoices.filter((i) => new Date(i.date).getMonth() === 7).reduce((s, i) => s + i.total, 0)
    const collectedMtd = invoices.filter((i) => i.status === 'Paid').reduce((s, i) => s + i.total, 0)
    const outstanding = invoices.filter((i) => i.status === 'Pending' || i.status === 'Overdue').reduce((s, i) => s + i.total, 0)
    const overdueAmt = invoices.filter((i) => i.status === 'Overdue').reduce((s, i) => s + i.total, 0)
    return { invoicedMtd, collectedMtd, outstanding, overdueAmt }
  }, [])

  const filteredInvoices = React.useMemo(() => {
    return invoices
      .filter((i) => invFilter === 'All' || i.status === (invFilter as InvoiceStatus))
      .filter((i) => {
        if (!invQuery.trim()) return true
        const q = invQuery.toLowerCase()
        return i.number.toLowerCase().includes(q) || i.customer.toLowerCase().includes(q) || (i.customerGstin ?? '').toLowerCase().includes(q)
      })
  }, [invFilter, invQuery])

  const filteredCustomers = React.useMemo(() => {
    if (!custQuery.trim()) return customers
    const q = custQuery.toLowerCase()
    return customers.filter((c) => c.name.toLowerCase().includes(q) || (c.gstin ?? '').toLowerCase().includes(q) || c.place.toLowerCase().includes(q))
  }, [custQuery])

  const aging = React.useMemo(() => {
    const open = invoices.filter((i) => i.status === 'Pending' || i.status === 'Overdue')
    const b = { '0-30': 0, '31-60': 0, '60+': 0 }
    for (const i of open) {
      const d = daysOverdue(i.dueDate)
      if (d > 60) b['60+'] += i.total
      else if (d > 30) b['31-60'] += i.total
      else b['0-30'] += i.total
    }
    return [
      { bucket: '0-30 days', amount: b['0-30'], fill: '#10b981' },
      { bucket: '31-60 days', amount: b['31-60'], fill: '#f59e0b' },
      { bucket: '60+ days', amount: b['60+'], fill: '#f43f5e' },
    ]
  }, [])

  const overdueInvoices = invoices.filter((i) => i.status === 'Overdue')

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Sales & Receivables"
        subtitle="Invoices, customers, aging analysis, e-invoicing"
        icon={TrendingUp}
        accent="emerald"
        action={<Pill accent="emerald">10 invoices · {formatINRCompact(kpis.outstanding)} open</Pill>}
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Invoiced MTD" value={formatINRCompact(kpis.invoicedMtd)} changePct={12.4} icon={Receipt} accent="emerald" insight="August invoicing across 5 active customers" trend={[14.2, 16.5, 17.8, 18.4, 17.2, 18.8]} />
        <KpiCard label="Collected" value={formatINRCompact(kpis.collectedMtd)} changePct={18.2} icon={Wallet} accent="sky" insight="Paid invoices — DSO improved to 38 days" trend={[12, 14, 16, 13, 17, 19]} />
        <KpiCard label="Outstanding" value={formatINRCompact(kpis.outstanding)} changePct={-4.1} icon={IndianRupee} accent="amber" insight="Pending + overdue receivables" trend={[32, 28, 26, 30, 28, 27]} />
        <KpiCard label="Overdue Amount" value={formatINRCompact(kpis.overdueAmt)} changePct={-8.6} icon={AlertTriangle} accent="rose" insight="2 invoices past due — send reminders" trend={[8.4, 7.2, 6.4, 5.2, 4.1, 2.9]} />
      </div>

      {/* Sales trend chart */}
      <ChartCard title="Sales Trend" subtitle="Total invoiced amount — last 6 months" action={<Pill accent="emerald">+12.4% MoM avg</Pill>}>
        <BarChart
          series={[{ name: 'Invoiced', data: SALES_TREND.map((s) => s.invoiced) }]}
          labels={SALES_TREND.map((s) => s.month)}
          colors={[CHART_COLORS.emerald]}
          height={256}
          yFormat={formatINRCompact}
        />
      </ChartCard>

      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick actions</span>
        <Button variant="outline" size="sm" className="h-8 gap-1.5"><Plus className="h-3.5 w-3.5" /> Create Invoice</Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5"><Bell className="h-3.5 w-3.5" /> Send Reminder</Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5"><FileDown className="h-3.5 w-3.5" /> Export GSTR-1</Button>
      </div>

      {/* Tabs: Invoices / Customers / Receivables */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="h-9">
          <TabsTrigger value="invoices" className="gap-1.5 text-xs"><Receipt className="h-3.5 w-3.5" /> Invoices</TabsTrigger>
          <TabsTrigger value="customers" className="gap-1.5 text-xs"><Wallet className="h-3.5 w-3.5" /> Customers</TabsTrigger>
          <TabsTrigger value="receivables" className="gap-1.5 text-xs"><AlertTriangle className="h-3.5 w-3.5" /> Receivables</TabsTrigger>
        </TabsList>

        {/* Invoices tab */}
        <TabsContent value="invoices" className="space-y-3">
          <Card className="border-border/60">
            <CardHeader className="flex flex-col gap-3 space-y-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">All Invoices</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">{filteredInvoices.length} of {invoices.length} shown</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input value={invQuery} onChange={(e) => setInvQuery(e.target.value)} placeholder="Search number, customer, GSTIN…" className="h-8 w-full pl-8 text-xs sm:w-60" />
                </div>
                <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
                  {STATUS_FILTERS.map((f) => (
                    <button key={f} onClick={() => setInvFilter(f)} className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors', invFilter === f ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{f}</button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {filteredInvoices.length === 0 ? (
                <EmptyState icon={Receipt} title="No invoices found" description="Adjust your filters." />
              ) : (
                <div className="max-h-[28rem] overflow-y-auto pr-1">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow className="border-border/60">
                        <TableHead className="w-8" />
                        <TableHead className={TH}>Number</TableHead>
                        <TableHead className={TH}>Customer</TableHead>
                        <TableHead className={TH}>Date</TableHead>
                        <TableHead className={TH}>Due</TableHead>
                        <TableHead className={THR}>Amount</TableHead>
                        <TableHead className={THR}>Tax</TableHead>
                        <TableHead className={THR}>Total</TableHead>
                        <TableHead className={TH}>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices.map((inv) => {
                        const isOpen = expanded === inv.id
                        return (
                          <React.Fragment key={inv.id}>
                            <TableRow className="cursor-pointer border-border/60" onClick={() => setExpanded(isOpen ? null : inv.id)}>
                              <TableCell className="text-muted-foreground">{isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</TableCell>
                              <TableCell className="font-mono text-xs font-semibold text-foreground">{inv.number}</TableCell>
                              <TableCell className="text-sm font-medium text-foreground">{inv.customer}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{formatDate(inv.date)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{formatDate(inv.dueDate)}</TableCell>
                              <TableCell className="text-right text-sm text-foreground tabular-nums">{formatINR(inv.amount)}</TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground tabular-nums">{formatINR(inv.tax)}</TableCell>
                              <TableCell className="text-right text-sm font-semibold text-foreground tabular-nums">{formatINR(inv.total)}</TableCell>
                              <TableCell><StatusPill status={inv.status} /></TableCell>
                            </TableRow>
                            {isOpen && (
                              <TableRow className="bg-muted/30 border-border/60">
                                <TableCell colSpan={9} className="p-4">
                                  <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Customer GSTIN</p>
                                      <p className="mt-0.5 font-mono text-foreground">{inv.customerGstin ?? '—'}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Place of Supply</p>
                                      <p className="mt-0.5 text-foreground">{inv.place}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Paid Date</p>
                                      <p className="mt-0.5 text-foreground">{inv.paidDate ? formatDate(inv.paidDate) : '—'}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Days Over Due</p>
                                      <p className={cn('mt-0.5 font-semibold', daysOverdue(inv.dueDate) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>{daysOverdue(inv.dueDate)} days</p>
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

        {/* Customers tab */}
        <TabsContent value="customers" className="space-y-3">
          <Card className="border-border/60">
            <CardHeader className="flex flex-col gap-3 space-y-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">Customers</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">{filteredCustomers.length} of {customers.length} shown</p>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={custQuery} onChange={(e) => setCustQuery(e.target.value)} placeholder="Search name, GSTIN, place…" className="h-8 w-full pl-8 text-xs sm:w-60" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="max-h-[28rem] overflow-y-auto pr-1">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow className="border-border/60">
                      <TableHead className={TH}>Name</TableHead>
                      <TableHead className={TH}>GSTIN</TableHead>
                      <TableHead className={TH}>Place</TableHead>
                      <TableHead className={THR}>Outstanding</TableHead>
                      <TableHead className={THR}>Lifetime Value</TableHead>
                      <TableHead className={TH}>Last Invoice</TableHead>
                      <TableHead className={TH}>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.map((c) => (
                      <TableRow key={c.id} className="border-border/60">
                        <TableCell className="text-sm font-medium text-foreground">{c.name}</TableCell>
                        <TableCell className="font-mono text-[11px] text-muted-foreground">{c.gstin ?? '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.place}</TableCell>
                        <TableCell className={cn('text-right text-sm font-semibold tabular-nums', c.outstanding > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>{c.outstanding > 0 ? formatINR(c.outstanding) : '—'}</TableCell>
                        <TableCell className="text-right text-sm text-foreground tabular-nums">{formatINRCompact(c.lifetimeValue)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.lastInvoice ? formatDate(c.lastInvoice) : '—'}</TableCell>
                        <TableCell><StatusPill status={c.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Receivables tab */}
        <TabsContent value="receivables" className="space-y-3">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="Receivables Aging" subtitle="Outstanding amount by days past due" action={<Pill accent="amber">{formatINRCompact(kpis.outstanding)} open</Pill>}>
              <BarChart
                series={[{ name: 'Outstanding', data: aging.map((a) => a.amount) }]}
                labels={aging.map((a) => a.bucket)}
                colors={[CHART_COLORS.amber]}
                height={256}
                yFormat={formatINRCompact}
              />
            </ChartCard>

            <Card className="border-border/60">
              <CardHeader className="space-y-0 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-semibold text-foreground">Overdue Invoices</CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">{overdueInvoices.length} invoices need reminders</p>
                  </div>
                  <Badge variant="outline" className="gap-1 border-rose-500/30 text-rose-600 dark:text-rose-400"><AlertTriangle className="h-3 w-3" /> Action needed</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {overdueInvoices.length === 0 ? (
                    <EmptyState icon={CheckCircle2} title="No overdue invoices" description="All receivables are within terms." />
                  ) : (
                    overdueInvoices.map((inv) => (
                      <div key={inv.id} className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-foreground">{inv.number}</span>
                            <StatusPill status={inv.status} />
                          </div>
                          <p className="mt-1 truncate text-sm text-foreground">{inv.customer}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">Due {formatDate(inv.dueDate)} · {daysOverdue(inv.dueDate)} days late · <span className="font-semibold text-rose-600 dark:text-rose-400">{formatINR(inv.total)}</span></p>
                        </div>
                        <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1.5 text-xs"><Bell className="h-3 w-3" /> Send Reminder</Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
