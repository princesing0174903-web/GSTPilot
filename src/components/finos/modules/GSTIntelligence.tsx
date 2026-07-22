'use client'

/**
 * GSTIntelligence — GST compliance & reconciliation module.
 * Returns calendar, ITC reconciliation, GSTR-1 vs GSTR-3B comparison,
 * quick filing actions.
 */

import * as React from 'react'
import {
  Receipt, FileText, Download, Sparkles, CheckCircle2, AlertTriangle,
  Wallet, IndianRupee, FileCheck2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import { BarChart, CHART_COLORS } from '@/components/finos/ui/charts'
import {
  SectionHeader, KpiCard, ChartCard, StatusPill, Pill, EmptyState,
} from '@/components/finos/ui/primitives'
import { gstReturns, type ReturnStatus } from '@/lib/finos/data'
import { formatINR, formatINRCompact, formatDate } from '@/lib/finos/format'
import { cn } from '@/lib/utils'

// ─── Filter tabs for the returns calendar ─────────────────────────────────────
const FILTERS = ['All', 'Filed', 'Pending', 'Overdue', 'Draft'] as const
type FilterKey = (typeof FILTERS)[number]

// ─── Mock comparison data ─────────────────────────────────────────────────────
const ITC_RECON = [
  { label: 'ITC as per Books', value: 910000, fill: '#10b981' },
  { label: 'ITC as per GSTR-2B', value: 790000, fill: '#0ea5e9' },
  { label: 'Gap (Unreconciled)', value: 120000, fill: '#f43f5e' },
]

const GSTR_COMPARE = [
  { month: 'Apr', gstr1: 3100000, gstr3b: 3000000 },
  { month: 'May', gstr1: 2800000, gstr3b: 2700000 },
  { month: 'Jun', gstr1: 3400000, gstr3b: 3200000 },
]

export function GSTIntelligence() {
  const [filter, setFilter] = React.useState<FilterKey>('All')

  // KPI derivations from `gstReturns` (latest period = Jul 2025).
  const filedCount = React.useMemo(() => gstReturns.filter((r) => r.status === 'Filed').length, [])
  const pendingMtd = React.useMemo(
    () => gstReturns.find((r) => r.type === 'GSTR-3B' && r.status === 'Pending'),
    [],
  )
  const itcAvailable = React.useMemo(
    () => gstReturns.find((r) => r.type === 'GSTR-2B')?.inputTaxCredit ?? 0,
    [],
  )

  const liabilityMtd = pendingMtd?.taxLiability ?? 0
  const netPayableMtd = pendingMtd?.netPayable ?? 0

  // Filtered table rows.
  const rows = React.useMemo(() => {
    if (filter === 'All') return gstReturns
    return gstReturns.filter((r) => r.status === (filter as ReturnStatus))
  }, [filter])

  return (
    <div className="space-y-6">
      <SectionHeader
        title="GST Intelligence"
        subtitle="Returns calendar, ITC reconciliation & e-filing"
        icon={Receipt}
        accent="amber"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Pill accent="amber">GSTIN 27AABCA1234L1Z5</Pill>
            <Button size="sm" className="h-8 gap-1.5 bg-amber-600 hover:bg-amber-700">
              <Sparkles className="h-3.5 w-3.5" /> AI Reconcile
            </Button>
          </div>
        }
      />

      {/* ── KPI row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="GST Liability MTD"
          value={formatINRCompact(liabilityMtd)}
          changePct={7.9}
          icon={IndianRupee}
          accent="amber"
          insight="GSTR-3B Jul 2025 — gross output tax before ITC"
          trend={[28.1, 27.4, 30.4, 28.6, 31.2, 32.8]}
        />
        <KpiCard
          label="ITC Available"
          value={formatINRCompact(itcAvailable)}
          changePct={3.9}
          icon={Wallet}
          accent="emerald"
          insight="Per GSTR-2B auto-drafted from supplier filings"
          trend={[68, 72, 70, 74, 76, 79]}
        />
        <KpiCard
          label="Net Payable"
          value={formatINRCompact(netPayableMtd)}
          changePct={9.6}
          icon={FileCheck2}
          accent="rose"
          insight="Liability minus ITC — due 20 Aug 2025"
          trend={[20.4, 19.8, 22.8, 21.6, 23.1, 24.9]}
        />
        <KpiCard
          label="Returns Filed"
          value={`${filedCount} / ${gstReturns.length}`}
          changePct={-12.5}
          icon={FileText}
          accent="sky"
          insight="1 pending, 1 overdue — ITC-04 needs immediate filing"
          trend={[4, 5, 4, 5, 3, 4]}
        />
      </div>

      {/* ── Quick actions ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick actions</span>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <FileText className="h-3.5 w-3.5" /> File GSTR-3B
        </Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Sparkles className="h-3.5 w-3.5" /> Reconcile ITC
        </Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Download className="h-3.5 w-3.5" /> Download JSON
        </Button>
      </div>

      {/* ── GST Returns Calendar ────────────────────────────────────────────── */}
      <Card className="border-border/60">
        <CardHeader className="flex flex-col gap-3 space-y-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-foreground">GST Returns Calendar</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">All pending & filed returns for FY 2025-26</p>
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  filter === f
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {rows.length === 0 ? (
            <EmptyState icon={FileText} title="No returns found" description={`No ${filter.toLowerCase()} GST returns.`} />
          ) : (
            <div className="max-h-[26rem] overflow-y-auto pr-1">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow className="border-border/60">
                    <TableHead className="text-xs uppercase tracking-wide">Type</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide">Period</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide">Due Date</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide">Status</TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wide">Tax Liability</TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wide">ITC</TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wide">Net Payable</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide">Filing / Ack</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id} className="border-border/60">
                      <TableCell className="font-mono text-xs font-semibold text-foreground">{r.type}</TableCell>
                      <TableCell className="text-sm text-foreground">{r.period}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(r.dueDate)}</TableCell>
                      <TableCell><StatusPill status={r.status} /></TableCell>
                      <TableCell className="text-right text-sm text-foreground tabular-nums">
                        {r.taxLiability > 0 ? formatINR(r.taxLiability) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {r.inputTaxCredit > 0 ? formatINR(r.inputTaxCredit) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold text-foreground tabular-nums">
                        {r.netPayable > 0 ? formatINR(r.netPayable) : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.filingDate ? (
                          <div className="flex flex-col gap-0.5">
                            <span>{formatDate(r.filingDate)}</span>
                            <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">{r.ackNo}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/70">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── ITC Reconciliation + GSTR-1 vs 3B Comparison ─────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ITC Reconciliation panel */}
        <Card className="border-border/60">
          <CardHeader className="space-y-0 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">ITC Reconciliation</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Books vs GSTR-2B · Jul 2025</p>
              </div>
              <Badge variant="outline" className="gap-1 border-rose-500/30 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-3 w-3" /> Gap detected
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {/* Status summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide">Reconciled</span>
                </div>
                <p className="mt-1 text-xl font-bold text-foreground">38</p>
                <p className="text-[10px] text-muted-foreground">invoices matched</p>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide">Pending</span>
                </div>
                <p className="mt-1 text-xl font-bold text-foreground">4</p>
                <p className="text-[10px] text-muted-foreground">awaiting supplier</p>
              </div>
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
                <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide">Mismatch</span>
                </div>
                <p className="mt-1 text-xl font-bold text-foreground">2</p>
                <p className="text-[10px] text-muted-foreground">value mismatch</p>
              </div>
            </div>

            {/* Comparison bar chart */}
            <BarChart
              series={[
                { name: 'Amount', data: ITC_RECON.map((d) => d.value) },
              ]}
              labels={ITC_RECON.map((d) => d.label)}
              colors={[CHART_COLORS.sky]}
              height={192}
              yFormat={formatINRCompact}
            />

            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Unreconciled gap blocking ITC claim</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">₹1,20,000</span>
            </div>
          </CardContent>
        </Card>

        {/* GSTR-1 vs GSTR-3B comparison */}
        <ChartCard
          title="GSTR-1 vs GSTR-3B Comparison"
          subtitle="Tax liability mismatch — last 3 months"
          action={<Pill accent="amber">Avg gap ₹1.3L</Pill>}
        >
          <BarChart
            series={[
              { name: 'GSTR-1', data: GSTR_COMPARE.map((d) => d.gstr1) },
              { name: 'GSTR-3B', data: GSTR_COMPARE.map((d) => d.gstr3b) },
            ]}
            labels={GSTR_COMPARE.map((d) => d.month)}
            colors={[CHART_COLORS.amber, CHART_COLORS.violet]}
            height={288}
            yFormat={formatINRCompact}
          />
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
            <span className="text-xs text-muted-foreground">3-month reconciliation accuracy</span>
            <div className="flex items-center gap-2">
              <Progress value={94} className="h-1.5 w-24" />
              <span className="text-xs font-semibold text-foreground">94%</span>
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  )
}
