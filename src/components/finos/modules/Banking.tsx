'use client'

/**
 * Banking — connected accounts, transactions, and auto-reconciliation.
 * Donut of cash position, recent transactions table, match-rate progress.
 */

import * as React from 'react'
import {
  Landmark, Plus, Upload, RefreshCw, Search,
  ArrowDownLeft, ArrowUpRight, CheckCircle2, Circle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import { DonutChart, CHART_COLORS } from '@/components/finos/ui/charts'
import {
  SectionHeader, ChartCard, Pill, EmptyState,
} from '@/components/finos/ui/primitives'
import { bankAccounts, bankTransactions } from '@/lib/finos/data'
import { formatINR, formatINRCompact, formatRelative } from '@/lib/finos/format'
import { cn } from '@/lib/utils'

// ─── Transaction filter tabs ──────────────────────────────────────────────────
const FILTERS = ['All', 'Credits', 'Debits', 'Unmatched'] as const
type FilterKey = (typeof FILTERS)[number]

// ─── Donut chart colors per account ───────────────────────────────────────────
const DONUT_COLORS = [CHART_COLORS.sky, CHART_COLORS.emerald, CHART_COLORS.amber, CHART_COLORS.violet]

// ─── Account type badge accent ────────────────────────────────────────────────
const TYPE_ACCENT: Record<string, string> = {
  Current: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/20',
  CC: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/20',
  OD: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20',
  Savings: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
}

export function Banking() {
  const [filter, setFilter] = React.useState<FilterKey>('All')
  const [query, setQuery] = React.useState('')

  // Total balance across all accounts.
  const totalBalance = React.useMemo(
    () => bankAccounts.reduce((s, a) => s + a.balance, 0),
    [],
  )

  // Donut chart data for cash position.
  const pieData = React.useMemo(
    () => bankAccounts.map((a, i) => ({ label: a.bank, value: a.balance, color: DONUT_COLORS[i % DONUT_COLORS.length] })),
    [],
  )

  // Filtered transactions.
  const rows = React.useMemo(() => {
    return bankTransactions
      .filter((t) => {
        if (filter === 'Credits') return t.type === 'Credit'
        if (filter === 'Debits') return t.type === 'Debit'
        if (filter === 'Unmatched') return !t.matched
        return true
      })
      .filter((t) => {
        if (!query.trim()) return true
        const q = query.toLowerCase()
        return (
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.account.toLowerCase().includes(q)
        )
      })
  }, [filter, query])

  // Reconciliation stats.
  const matchedCount = bankTransactions.filter((t) => t.matched).length
  const matchRate = Math.round((matchedCount / bankTransactions.length) * 100)

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Banking & Reconciliation"
        subtitle="Connected accounts · live feeds · auto-matching"
        icon={Landmark}
        accent="sky"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Pill accent="sky">4 accounts · ₹{(totalBalance / 10000000).toFixed(2)}Cr total</Pill>
            <Button size="sm" className="h-8 gap-1.5 bg-sky-600 hover:bg-sky-700">
              <RefreshCw className="h-3.5 w-3.5" /> Sync all
            </Button>
          </div>
        }
      />

      {/* ── Quick actions ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick actions</span>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Connect Account
        </Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Upload className="h-3.5 w-3.5" /> Import Statement
        </Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Reconcile Now
        </Button>
      </div>

      {/* ── Bank account cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {bankAccounts.map((acc) => (
          <Card key={acc.id} className="group border-border/60 transition-all hover:shadow-md hover:border-border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
                    <Landmark className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{acc.bank}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{acc.accountNumber}</p>
                  </div>
                </div>
                <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', TYPE_ACCENT[acc.type])}>
                  {acc.type}
                </span>
              </div>
              <div className="mt-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Available balance</p>
                <p className="mt-0.5 text-xl font-bold tracking-tight text-foreground tabular-nums">{formatINR(acc.balance)}</p>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-[11px]">
                <span className="text-muted-foreground">IFSC <span className="font-mono text-foreground/80">{acc.ifsc}</span></span>
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {formatRelative(acc.syncedAt)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Cash Position donut + Auto-Reconciliation ────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Cash Position"
          subtitle="Distribution across connected accounts"
          action={<Pill accent="sky">{formatINRCompact(totalBalance)} total</Pill>}
        >
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="shrink-0">
              <DonutChart
                data={pieData}
                height={224}
                centerLabel="Total"
                centerValue={formatINRCompact(totalBalance)}
              />
            </div>
            <ul className="flex-1 space-y-2 self-center">
              {pieData.map((d) => (
                <li key={d.label} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
                    <span className="truncate">{d.label}</span>
                  </span>
                  <span className="font-medium text-foreground tabular-nums">{formatINRCompact(d.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </ChartCard>

        {/* Auto-reconciliation panel */}
        <Card className="border-border/60">
          <CardHeader className="space-y-0 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">Auto-Reconciliation</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Fuzzy match engine · last run 2 min ago</p>
              </div>
              <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Live
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide">Matched</span>
                </div>
                <p className="mt-1 text-2xl font-bold text-foreground">{matchedCount}</p>
                <p className="text-[10px] text-muted-foreground">of {bankTransactions.length} transactions</p>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <Circle className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide">Unmatched</span>
                </div>
                <p className="mt-1 text-2xl font-bold text-foreground">{bankTransactions.length - matchedCount}</p>
                <p className="text-[10px] text-muted-foreground">need manual review</p>
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Match rate</span>
                <span className="font-semibold text-foreground">{matchRate}%</span>
              </div>
              <Progress value={matchRate} className="h-2" />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                3 transactions pending match — review suggested matches from vendor bills & sales invoices.
              </p>
            </div>

            <Button className="w-full gap-1.5 bg-sky-600 hover:bg-sky-700" size="sm">
              <RefreshCw className="h-3.5 w-3.5" /> Run auto-reconciliation
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Transactions table ────────────────────────────────────────── */}
      <Card className="border-border/60">
        <CardHeader className="flex flex-col gap-3 space-y-0 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-foreground">Recent Transactions</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">Last 10 entries · auto-categorized</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search description, category…"
                className="h-8 w-full pl-8 text-xs sm:w-60"
              />
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
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {rows.length === 0 ? (
            <EmptyState icon={Search} title="No transactions found" description="Adjust your search or filter." />
          ) : (
            <div className="max-h-[26rem] overflow-y-auto pr-1">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow className="border-border/60">
                    <TableHead className="text-xs uppercase tracking-wide">Date</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide">Account</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide">Description</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide">Type</TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wide">Amount</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide">Category</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide">Matched</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((t) => {
                    const isCredit = t.type === 'Credit'
                    return (
                      <TableRow key={t.id} className="border-border/60">
                        <TableCell className="text-xs text-muted-foreground">{formatRelative(t.date)}</TableCell>
                        <TableCell className="font-mono text-[11px] text-foreground/80">{t.account}</TableCell>
                        <TableCell className="max-w-[14rem] truncate text-sm font-medium text-foreground">{t.description}</TableCell>
                        <TableCell>
                          <span className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                            isCredit
                              ? 'border-emerald-500/20 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : 'border-rose-500/20 bg-rose-500/15 text-rose-700 dark:text-rose-300',
                          )}>
                            {isCredit ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                            {t.type}
                          </span>
                        </TableCell>
                        <TableCell className={cn(
                          'text-right text-sm font-semibold tabular-nums',
                          isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
                        )}>
                          {isCredit ? '+' : '−'}{formatINR(t.amount)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.category}</TableCell>
                        <TableCell>
                          {t.matched ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                              <Circle className="h-3.5 w-3.5" /> No
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Showing {rows.length} of {bankTransactions.length} transactions</span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Auto-synced from bank feeds
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
