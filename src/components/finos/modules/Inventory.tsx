'use client'

/**
 * Inventory — stock, products, warehouses, reorder alerts.
 * Stock value by category pie, status distribution donut,
 * searchable/filterable Products table with expandable rows,
 * Low Stock tab with PO action, Warehouses capacity cards,
 * reorder alerts panel.
 */

import * as React from 'react'
import {
  Package, Plus, FileText, ClipboardCheck, Search, ChevronDown, ChevronRight,
  Boxes, IndianRupee, AlertTriangle, PackageX, MapPin, TrendingDown,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import { DonutChart, CHART_COLORS } from '@/components/finos/ui/charts'
import {
  SectionHeader, KpiCard, ChartCard, StatusPill, SeverityBadge, Pill, EmptyState, accentClasses,
} from '@/components/finos/ui/primitives'
import { products } from '@/lib/finos/data'
import { formatINR, formatINRCompact, formatNumber, formatPct } from '@/lib/finos/format'
import { cn } from '@/lib/utils'

const STATUS_FILTERS = ['All', 'In Stock', 'Low Stock', 'Out of Stock'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

const TH = 'text-xs uppercase tracking-wide'
const THR = 'text-right text-xs uppercase tracking-wide'

const CAT_COLORS = ['#f59e0b', '#0ea5e9', '#8b5cf6', '#10b981', '#06b6d4', '#f43f5e', '#64748b']
const STATUS_COLORS: Record<string, string> = {
  'In Stock': '#10b981',
  'Low Stock': '#f59e0b',
  'Out of Stock': '#f43f5e',
}

// ─── Mock warehouse capacity data ─────────────────────────────────────────────
const WAREHOUSES = [
  { id: 'Pune-W1', name: 'Pune Warehouse 1', location: 'MIDC Bhosari, Pune', capacity: 5000, used: 3850, skus: 7 },
  { id: 'Pune-W2', name: 'Pune Warehouse 2', location: 'Chakan, Pune', capacity: 3500, used: 2980, skus: 4 },
]

export function Inventory() {
  const [tab, setTab] = React.useState<'products' | 'lowstock' | 'warehouses'>('products')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('All')
  const [query, setQuery] = React.useState('')
  const [expanded, setExpanded] = React.useState<string | null>(null)

  // ─── Derived KPI values ─────────────────────────────────────────────────────
  const kpis = React.useMemo(() => {
    const totalSkus = products.length
    const inventoryValue = products.reduce((s, p) => s + p.stock * p.cost, 0)
    const lowStock = products.filter((p) => p.status === 'Low Stock').length
    const outOfStock = products.filter((p) => p.status === 'Out of Stock').length
    return { totalSkus, inventoryValue, lowStock, outOfStock }
  }, [])

  // ─── Stock value grouped by category ────────────────────────────────────────
  const byCategory = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const p of products) {
      map.set(p.category, (map.get(p.category) ?? 0) + p.stock * p.cost)
    }
    return Array.from(map.entries()).map(([label, value], i) => ({
      label, value, color: CAT_COLORS[i % CAT_COLORS.length],
    }))
  }, [])

  // ─── Status distribution (for donut) ────────────────────────────────────────
  const statusDist = React.useMemo(() => {
    const counts: Record<string, number> = { 'In Stock': 0, 'Low Stock': 0, 'Out of Stock': 0 }
    for (const p of products) counts[p.status] = (counts[p.status] ?? 0) + 1
    return Object.entries(counts).map(([label, value]) => ({ label, value, color: STATUS_COLORS[label] }))
  }, [])

  // ─── Filtered products (Products tab) ───────────────────────────────────────
  const filtered = React.useMemo(() => {
    return products
      .filter((p) => statusFilter === 'All' || p.status === statusFilter)
      .filter((p) => {
        if (!query.trim()) return true
        const q = query.toLowerCase()
        return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
      })
  }, [statusFilter, query])

  // ─── Low stock list ─────────────────────────────────────────────────────────
  const lowStockList = React.useMemo(() => products.filter((p) => p.status !== 'In Stock'), [])

  // ─── Reorder alerts (stock below reorderLevel) ──────────────────────────────
  const reorderAlerts = React.useMemo(() => {
    return products
      .filter((p) => p.stock < p.reorderLevel)
      .map((p) => {
        const daysOfStock = Math.max(0, Math.round((p.stock / p.reorderLevel) * 7))
        const recommendedPO = Math.max(p.reorderLevel * 2 - p.stock, p.reorderLevel)
        return { ...p, daysOfStock, recommendedPO }
      })
  }, [])

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Inventory & Stock"
        subtitle="SKUs · warehouses · reorder automation · valuation"
        icon={Package}
        accent="amber"
        action={<Pill accent="amber">{kpis.totalSkus} SKUs · {formatINRCompact(kpis.inventoryValue)} value</Pill>}
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total SKUs" value={formatNumber(kpis.totalSkus)} changePct={4.2} icon={Boxes} accent="amber" insight="Across 2 warehouses in Pune" trend={[8, 9, 9, 10, 10, 10]} />
        <KpiCard label="Inventory Value" value={formatINRCompact(kpis.inventoryValue)} changePct={6.8} icon={IndianRupee} accent="emerald" insight="At cost basis · landed price" trend={[3.2, 3.4, 3.5, 3.6, 3.8, 4.1]} />
        <KpiCard label="Low Stock Items" value={formatNumber(kpis.lowStock)} changePct={-2.1} icon={AlertTriangle} accent="amber" insight="Below reorder level — review today" trend={[5, 4, 3, 4, 3, 2]} />
        <KpiCard label="Out of Stock" value={formatNumber(kpis.outOfStock)} changePct={-1.4} icon={PackageX} accent="rose" insight="2 SKUs unavailable — expedite PO" trend={[3, 2, 2, 1, 2, 2]} />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick actions</span>
        <Button variant="outline" size="sm" className="h-8 gap-1.5"><Plus className="h-3.5 w-3.5" /> Add Product</Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5"><FileText className="h-3.5 w-3.5" /> Create PO</Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5"><ClipboardCheck className="h-3.5 w-3.5" /> Stock Take</Button>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Stock Value by Category" subtitle="Inventory value grouped by product category" action={<Pill accent="amber">{byCategory.length} categories</Pill>}>
          <DonutChart
            data={byCategory}
            height={256}
            centerLabel="Total"
            centerValue={formatINRCompact(kpis.inventoryValue)}
          />
        </ChartCard>

        <ChartCard title="Stock Status Distribution" subtitle="In Stock vs Low vs Out of Stock" action={<Pill accent="emerald">{kpis.totalSkus} SKUs</Pill>}>
          <DonutChart
            data={statusDist}
            height={256}
            centerLabel="SKUs"
            centerValue={String(kpis.totalSkus)}
          />
        </ChartCard>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="h-9">
          <TabsTrigger value="products" className="gap-1.5 text-xs"><Package className="h-3.5 w-3.5" /> Products</TabsTrigger>
          <TabsTrigger value="lowstock" className="gap-1.5 text-xs"><AlertTriangle className="h-3.5 w-3.5" /> Low Stock</TabsTrigger>
          <TabsTrigger value="warehouses" className="gap-1.5 text-xs"><MapPin className="h-3.5 w-3.5" /> Warehouses</TabsTrigger>
        </TabsList>

        {/* Products tab */}
        <TabsContent value="products" className="space-y-3">
          <Card className="border-border/60">
            <CardHeader className="flex flex-col gap-3 space-y-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">All Products</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">{filtered.length} of {products.length} shown</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search SKU, name, category…" className="h-8 w-full pl-8 text-xs sm:w-60" />
                </div>
                <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
                  {STATUS_FILTERS.map((f) => (
                    <button key={f} onClick={() => setStatusFilter(f)} className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors', statusFilter === f ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{f}</button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {filtered.length === 0 ? (
                <EmptyState icon={Package} title="No products found" description="Adjust your filters." />
              ) : (
                <div className="max-h-[28rem] overflow-x-auto overflow-y-auto pr-1">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow className="border-border/60">
                        <TableHead className="w-8" />
                        <TableHead className={TH}>SKU</TableHead>
                        <TableHead className={TH}>Name</TableHead>
                        <TableHead className={TH}>Category</TableHead>
                        <TableHead className={TH}>HSN</TableHead>
                        <TableHead className={TH}>Stock</TableHead>
                        <TableHead className={THR}>Cost</TableHead>
                        <TableHead className={THR}>Price</TableHead>
                        <TableHead className={THR}>Margin</TableHead>
                        <TableHead className={TH}>Warehouse</TableHead>
                        <TableHead className={TH}>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((p) => {
                        const isOpen = expanded === p.id
                        const marginPct = ((p.price - p.cost) / p.price) * 100
                        const stockPct = Math.min(100, Math.round((p.stock / Math.max(p.reorderLevel * 2, 1)) * 100))
                        return (
                          <React.Fragment key={p.id}>
                            <TableRow className="cursor-pointer border-border/60" onClick={() => setExpanded(isOpen ? null : p.id)}>
                              <TableCell className="text-muted-foreground">{isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</TableCell>
                              <TableCell className="font-mono text-xs font-semibold text-foreground">{p.sku}</TableCell>
                              <TableCell className="text-sm font-medium text-foreground">{p.name}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{p.category}</TableCell>
                              <TableCell className="font-mono text-[11px] text-muted-foreground">{p.hsn}</TableCell>
                              <TableCell>
                                <div className="flex w-28 flex-col gap-1">
                                  <span className="text-xs font-semibold text-foreground tabular-nums">{formatNumber(p.stock)} <span className="text-[10px] text-muted-foreground">{p.unit}</span></span>
                                  <Progress value={stockPct} className="h-1.5" />
                                  <span className="text-[10px] text-muted-foreground">RL: {p.reorderLevel}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground tabular-nums">{formatINR(p.cost)}</TableCell>
                              <TableCell className="text-right text-sm font-semibold text-foreground tabular-nums">{formatINR(p.price)}</TableCell>
                              <TableCell className="text-right text-xs font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">{formatPct(marginPct)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{p.warehouse}</TableCell>
                              <TableCell><StatusPill status={p.status} /></TableCell>
                            </TableRow>
                            {isOpen && (
                              <TableRow className="bg-muted/30 border-border/60">
                                <TableCell colSpan={11} className="p-4">
                                  <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Reorder Level</p>
                                      <p className="mt-0.5 font-semibold text-foreground">{formatNumber(p.reorderLevel)} {p.unit}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Recommended PO Qty</p>
                                      <p className="mt-0.5 font-semibold text-amber-600 dark:text-amber-400">{formatNumber(Math.max(p.reorderLevel * 2 - p.stock, p.reorderLevel))} {p.unit}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Inventory Value</p>
                                      <p className="mt-0.5 font-semibold text-foreground">{formatINR(p.stock * p.cost)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Est. Days of Stock</p>
                                      <p className={cn('mt-0.5 font-semibold', p.stock < p.reorderLevel ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>{Math.max(0, Math.round((p.stock / p.reorderLevel) * 7))} days</p>
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

        {/* Low Stock tab */}
        <TabsContent value="lowstock" className="space-y-3">
          <Card className="border-border/60">
            <CardHeader className="space-y-0 pb-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-semibold text-foreground">Reorder Queue</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">{lowStockList.length} SKUs below safe stock — generate POs to replenish</p>
                </div>
                <Badge variant="outline" className="gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400"><TrendingDown className="h-3 w-3" /> Action needed</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
                {lowStockList.length === 0 ? (
                  <EmptyState icon={Package} title="No low stock items" description="All SKUs are above reorder level." />
                ) : (
                  lowStockList.map((p) => {
                    const recommendedPO = Math.max(p.reorderLevel * 2 - p.stock, p.reorderLevel)
                    return (
                      <div key={p.id} className="flex flex-col gap-3 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-foreground">{p.sku}</span>
                            <StatusPill status={p.status} />
                            <span className="text-[10px] text-muted-foreground">{p.warehouse}</span>
                          </div>
                          <p className="mt-1 truncate text-sm text-foreground">{p.name}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">Stock: <span className="font-semibold text-rose-600 dark:text-rose-400">{formatNumber(p.stock)}</span> · Reorder Level: {formatNumber(p.reorderLevel)} · Recommended PO: <span className="font-semibold text-amber-600 dark:text-amber-400">{formatNumber(recommendedPO)} {p.unit}</span></p>
                        </div>
                        <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1.5 text-xs"><FileText className="h-3 w-3" /> Generate PO</Button>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Warehouses tab */}
        <TabsContent value="warehouses" className="space-y-3">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {WAREHOUSES.map((w) => {
              const whProducts = products.filter((p) => p.warehouse === w.id)
              const whValue = whProducts.reduce((s, p) => s + p.stock * p.cost, 0)
              const util = Math.round((w.used / w.capacity) * 100)
              const a = accentClasses.amber
              return (
                <Card key={w.id} className="border-border/60">
                  <CardHeader className="space-y-0 pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', a.bg, a.text)}><MapPin className="h-5 w-5" /></div>
                        <div>
                          <CardTitle className="text-sm font-semibold text-foreground">{w.name}</CardTitle>
                          <p className="mt-0.5 text-xs text-muted-foreground">{w.location}</p>
                        </div>
                      </div>
                      <Pill accent={util > 80 ? 'rose' : 'amber'}>{util}% utilized</Pill>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">SKUs</p>
                        <p className="mt-1 text-lg font-bold text-foreground tabular-nums">{w.skus}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Stock Value</p>
                        <p className="mt-1 text-lg font-bold text-foreground tabular-nums">{formatINRCompact(whValue)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Capacity</p>
                        <p className="mt-1 text-lg font-bold text-foreground tabular-nums">{formatNumber(w.used)}<span className="text-xs text-muted-foreground">/{formatNumber(w.capacity)}</span></p>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Capacity utilization</span>
                        <span className={cn('font-semibold', util > 80 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400')}>{util}%</span>
                      </div>
                      <Progress value={util} className="mt-1.5 h-2" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {whProducts.map((p) => (
                        <span key={p.id} className={cn('inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-mono', p.status === 'Out of Stock' ? 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300' : p.status === 'Low Stock' ? 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'border-border/60 bg-muted text-muted-foreground')}>{p.sku}</span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Reorder Alerts panel */}
      <Card className="border-border/60">
        <CardHeader className="space-y-0 pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">Reorder Alerts</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">{reorderAlerts.length} SKUs below reorder level — auto-PO triggered by automation engine</p>
            </div>
            <Badge variant="outline" className="gap-1 border-rose-500/30 text-rose-600 dark:text-rose-400"><AlertTriangle className="h-3 w-3" /> Critical</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {reorderAlerts.length === 0 ? (
              <EmptyState icon={Package} title="No reorder alerts" description="All SKUs are above reorder level." />
            ) : (
              reorderAlerts.map((p) => (
                <div key={p.id} className="flex flex-col gap-2 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400"><SeverityBadge severity="high" /></div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-foreground">{p.sku}</span>
                        <span className="truncate text-sm text-foreground">{p.name}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">Stock <span className="font-semibold text-rose-600 dark:text-rose-400">{formatNumber(p.stock)}</span> / RL {formatNumber(p.reorderLevel)} · Est. {p.daysOfStock} days of stock remaining · Recommended PO: <span className="font-semibold text-amber-600 dark:text-amber-400">{formatNumber(p.recommendedPO)} {p.unit}</span></p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1.5 text-xs"><FileText className="h-3 w-3" /> Generate PO</Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
