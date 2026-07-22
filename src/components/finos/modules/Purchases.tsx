'use client'

/**
 * Purchases — vendor bills, payables, and procurement analytics.
 * Aging analysis, vendor LTV, procurement by category pie chart.
 */

import * as React from 'react'
import {
  ShoppingCart, Plus, Calendar, Sparkles, Search, Receipt, IndianRupee,
  Wallet, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import { BarChart, DonutChart, CHART_COLORS } from '@/components/finos/ui/charts'
import {
  SectionHeader, KpiCard, ChartCard, StatusPill, Pill, EmptyState,
} from '@/components/finos/ui/primitives'
import { bills, vendors, type BillStatus } from '@/lib/finos/data'
import { formatINR, formatINRCompact, formatDate } from '@/lib/finos/format'
import { cn } from '@/lib/utils'

const STATUS_FILTERS = ['All', 'Paid', 'Pending', 'Overdue', 'Scheduled'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

const CATEGORY_SPEND = [
  { name: 'Raw Material', value: 60500000, color: '#06b6d4' },
  { name: 'Utilities', value: 8420000, color: '#0ea5e9' },
  { name: 'Logistics', value: 5610000, color: '#10b981' },
  { name: 'IT Services', value: 12800000, color: '#8b5cf6' },
  { name: 'Equipment', value: 9870000, color: '#f59e0b' },
  { name: 'Fuel', value: 2190000, color: '#f43f5e' },
  { name: 'Consumables', value: 115640, color: '#64748b' },
]

const TH = 'text-xs uppercase tracking-wide'
const THR = 'text-right text-xs uppercase tracking-wide'

function daysOverdue(dueDate: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)))
}

export function Purchases() {
  const [tab, setTab] = React.useState<'bills' | 'vendors' | 'payables'>('bills')
  const [billFilter, setBillFilter] = React.useState<StatusFilter>('All')
  const [billQuery, setBillQuery] = React.useState('')
  const [vendorQuery, setVendorQuery] = React.useState('')

  const kpis = React.useMemo(() => {
    const billsMtd = bills.filter((b) => new Date(b.date).getMonth() === 7).reduce((s, b) => s + b.total, 0)
    const paid = bills.filter((b) => b.status === 'Paid').reduce((s, b) => s + b.total, 0)
    const outstanding = bills.filter((b) => b.status === 'Pending' || b.status === 'Overdue' || b.status === 'Scheduled').reduce((s, b) => s + b.total, 0)
    const overdueAmt = bills.filter((b) => b.status === 'Overdue').reduce((s, b) => s + b.total, 0)
    return { billsMtd, paid, outstanding, overdueAmt }
  }, [])

  const filteredBills = React.useMemo(() => {
    return bills
      .filter((b) => billFilter === 'All' || b.status === (billFilter as BillStatus))
      .filter((b) => {
        if (!billQuery.trim()) return true
        const q = billQuery.toLowerCase()
        return b.number.toLowerCase().includes(q) || b.vendor.toLowerCase().includes(q) || (b.vendorGstin ?? '').toLowerCase().includes(q) || b.category.toLowerCase().includes(q)
      })
  }, [billFilter, billQuery])

  const filteredVendors = React.useMemo(() => {
    if (!vendorQuery.trim()) return vendors
    const q = vendorQuery.toLowerCase()
    return vendors.filter((v) => v.name.toLowerCase().includes(q) || (v.gstin ?? '').toLowerCase().includes(q) || v.category.toLowerCase().includes(q))
  }, [vendorQuery])

  const aging = React.useMemo(() => {
    const open = bills.filter((b) => b.status === 'Pending' || b.status === 'Overdue' || b.status === 'Scheduled')
    const b = { '0-30': 0, '31-60': 0, '60+': 0 }
    for (const x of open) {
      const d = daysOverdue(x.dueDate)
      if (d > 60) b['60+'] += x.total
      else if (d > 30) b['31-60'] += x.total
      else b['0-30'] += x.total
    }
    return [
      { bucket: '0-30 days', amount: b['0-30'], fill: '#06b6d4' },
      { bucket: '31-60 days', amount: b['31-60'], fill: '#f59e0b' },
      { bucket: '60+ days', amount: b['60+'], fill: '#f43f5e' },
    ]
  }, [])

  const overdueBills = bills.filter((b) => b.status === 'Overdue')
  const totalSpend = CATEGORY_SPEND.reduce((s, c) => s + c.value, 0)

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Purchases & Payables"
        subtitle="Vendor bills, procurement analytics, payment scheduling"
        icon={ShoppingCart}
        accent="cyan"
        action={<Pill accent="cyan">{bills.length} bills · {formatINRCompact(kpis.outstanding)} open</Pill>}
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Bills MTD" value={formatINRCompact(kpis.billsMtd)} changePct={4.2} icon={Receipt} accent="cyan" insight="Vendor bills received in August" trend={[12.4, 11.8, 13.2, 12.6, 13.8, 14.2]} />
        <KpiCard label="Paid" value={formatINRCompact(kpis.paid)} changePct={6.1} icon={Wallet} accent="emerald" insight="Bills settled — avg cycle 14 days" trend={[8.2, 9.4, 10.1, 9.8, 11.2, 12.4]} />
        <KpiCard label="Outstanding" value={formatINRCompact(kpis.outstanding)} changePct={-2.4} icon={IndianRupee} accent="amber" insight="Pending + overdue + scheduled payables" trend={[42, 38, 40, 36, 34, 33]} />
        <KpiCard label="Overdue Amount" value={formatINRCompact(kpis.overdueAmt)} changePct={-12.8} icon={AlertTriangle} accent="rose" insight="1 bill past due — Blue Star ₹2.89L" trend={[8.4, 7.2, 6.4, 5.2, 4.1, 2.9]} />
      </div>

      {/* Procurement by Category */}
      <ChartCard title="Procurement by Category" subtitle="Total spend distribution — FY 2024-25" action={<Pill accent="cyan">{formatINRCompact(totalSpend)} total</Pill>}>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="shrink-0">
            <DonutChart
              data={CATEGORY_SPEND.map((c) => ({ label: c.name, value: c.value, color: c.color }))}
              height={224}
              centerLabel="Total Spend"
              centerValue={formatINRCompact(totalSpend)}
            />
          </div>
          <ul className="grid flex-1 grid-cols-1 gap-x-4 gap-y-2 self-stretch sm:grid-cols-2">
            {CATEGORY_SPEND.map((c) => {
              const pct = (c.value / totalSpend) * 100
              return (
                <li key={c.name} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: c.color }} />
                    <span className="truncate">{c.name}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-medium text-foreground tabular-nums">{formatINRCompact(c.value)}</span>
                    <span className="text-[10px] text-muted-foreground">{pct.toFixed(1)}%</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </ChartCard>

      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick actions</span>
        <Button variant="outline" size="sm" className="h-8 gap-1.5"><Plus className="h-3.5 w-3.5" /> Add Bill</Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5"><Calendar className="h-3.5 w-3.5" /> Schedule Payment</Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Reconcile ITC</Button>
      </div>

      {/* Tabs: Bills / Vendors / Payables */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="h-9">
          <TabsTrigger value="bills" className="gap-1.5 text-xs"><Receipt className="h-3.5 w-3.5" /> Bills</TabsTrigger>
          <TabsTrigger value="vendors" className="gap-1.5 text-xs"><Wallet className="h-3.5 w-3.5" /> Vendors</TabsTrigger>
          <TabsTrigger value="payables" className="gap-1.5 text-xs"><AlertTriangle className="h-3.5 w-3.5" /> Payables</TabsTrigger>
        </TabsList>

        {/* Bills tab */}
        <TabsContent value="bills" className="space-y-3">
          <Card className="border-border/60">
            <CardHeader className="flex flex-col gap-3 space-y-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">All Vendor Bills</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">{filteredBills.length} of {bills.length} shown</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input value={billQuery} onChange={(e) => setBillQuery(e.target.value)} placeholder="Search bill, vendor, GSTIN…" className="h-8 w-full pl-8 text-xs sm:w-60" />
                </div>
                <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
                  {STATUS_FILTERS.map((f) => (
                    <button key={f} onClick={() => setBillFilter(f)} className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors', billFilter === f ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{f}</button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {filteredBills.length === 0 ? (
                <EmptyState icon={Receipt} title="No bills found" description="Adjust your filters." />
              ) : (
                <div className="max-h-[28rem] overflow-y-auto pr-1">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow className="border-border/60">
                        <TableHead className={TH}>Number</TableHead>
                        <TableHead className={TH}>Vendor</TableHead>
                        <TableHead className={TH}>Date</TableHead>
                        <TableHead className={TH}>Due</TableHead>
                        <TableHead className={TH}>Category</TableHead>
                        <TableHead className={THR}>Amount</TableHead>
                        <TableHead className={THR}>Tax</TableHead>
                        <TableHead className={THR}>Total</TableHead>
                        <TableHead className={TH}>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBills.map((b) => (
                        <TableRow key={b.id} className="border-border/60">
                          <TableCell className="font-mono text-xs font-semibold text-foreground">{b.number}</TableCell>
                          <TableCell className="text-sm font-medium text-foreground">{b.vendor}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(b.date)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(b.dueDate)}</TableCell>
                          <TableCell><span className="inline-flex items-center rounded-md bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-700 dark:text-cyan-300">{b.category}</span></TableCell>
                          <TableCell className="text-right text-sm text-foreground tabular-nums">{formatINR(b.amount)}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground tabular-nums">{formatINR(b.tax)}</TableCell>
                          <TableCell className="text-right text-sm font-semibold text-foreground tabular-nums">{formatINR(b.total)}</TableCell>
                          <TableCell><StatusPill status={b.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vendors tab */}
        <TabsContent value="vendors" className="space-y-3">
          <Card className="border-border/60">
            <CardHeader className="flex flex-col gap-3 space-y-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">Vendors</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">{filteredVendors.length} of {vendors.length} shown</p>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={vendorQuery} onChange={(e) => setVendorQuery(e.target.value)} placeholder="Search name, GSTIN, category…" className="h-8 w-full pl-8 text-xs sm:w-60" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="max-h-[28rem] overflow-y-auto pr-1">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow className="border-border/60">
                      <TableHead className={TH}>Name</TableHead>
                      <TableHead className={TH}>GSTIN</TableHead>
                      <TableHead className={TH}>Category</TableHead>
                      <TableHead className={TH}>Place</TableHead>
                      <TableHead className={THR}>Outstanding</TableHead>
                      <TableHead className={THR}>Lifetime Spend</TableHead>
                      <TableHead className={TH}>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVendors.map((v) => (
                      <TableRow key={v.id} className="border-border/60">
                        <TableCell className="text-sm font-medium text-foreground">{v.name}</TableCell>
                        <TableCell className="font-mono text-[11px] text-muted-foreground">{v.gstin ?? '—'}</TableCell>
                        <TableCell><span className="inline-flex items-center rounded-md bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-700 dark:text-cyan-300">{v.category}</span></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{v.place}</TableCell>
                        <TableCell className={cn('text-right text-sm font-semibold tabular-nums', v.outstanding > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>{v.outstanding > 0 ? formatINR(v.outstanding) : '—'}</TableCell>
                        <TableCell className="text-right text-sm text-foreground tabular-nums">{formatINRCompact(v.lifetimeSpend)}</TableCell>
                        <TableCell><StatusPill status={v.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payables tab */}
        <TabsContent value="payables" className="space-y-3">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="Payables Aging" subtitle="Outstanding amount by days past due" action={<Pill accent="amber">{formatINRCompact(kpis.outstanding)} open</Pill>}>
              <BarChart
                series={[{ name: 'Outstanding', data: aging.map((a) => a.amount) }]}
                labels={aging.map((a) => a.bucket)}
                colors={[CHART_COLORS.cyan]}
                height={256}
                yFormat={formatINRCompact}
              />
            </ChartCard>

            <Card className="border-border/60">
              <CardHeader className="space-y-0 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-semibold text-foreground">Overdue Bills</CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">{overdueBills.length} bills need scheduling</p>
                  </div>
                  <Badge variant="outline" className="gap-1 border-rose-500/30 text-rose-600 dark:text-rose-400"><AlertTriangle className="h-3 w-3" /> Action needed</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {overdueBills.length === 0 ? (
                    <EmptyState icon={CheckCircle2} title="No overdue bills" description="All payables are within terms." />
                  ) : (
                    overdueBills.map((b) => (
                      <div key={b.id} className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-foreground">{b.number}</span>
                            <StatusPill status={b.status} />
                          </div>
                          <p className="mt-1 truncate text-sm text-foreground">{b.vendor}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">Due {formatDate(b.dueDate)} · {daysOverdue(b.dueDate)} days late · <span className="font-semibold text-rose-600 dark:text-rose-400">{formatINR(b.total)}</span></p>
                        </div>
                        <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1.5 text-xs"><Calendar className="h-3 w-3" /> Schedule Payment</Button>
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
