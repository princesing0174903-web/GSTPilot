'use client'

/**
 * AIAccountant — transaction classification, journal entry, and GST treatment Q&A.
 * Left: searchable, filterable table of recent bank transactions.
 * Right: AI Q&A panel that talks to /api/finos/accountant.
 */

import * as React from 'react'
import {
  Calculator, Search, Send, Loader2, AlertTriangle,
  CheckCircle2, Circle, Sparkles, type LucideIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  SectionHeader, StatusPill, Pill, accentClasses,
} from '@/components/finos/ui/primitives'
import { bankTransactions } from '@/lib/finos/data'
import { formatINR, formatDate } from '@/lib/finos/format'
import { cn } from '@/lib/utils'

const PRESET_QUESTIONS = [
  "What's the journal entry for salary payment?",
  'Is this GST-eligible?',
  'How should I categorize this vendor payment?',
  "What's the ITC eligibility of this bill?",
]

const TYPE_FILTERS = ['All', 'Credit', 'Debit'] as const
type TypeFilter = (typeof TYPE_FILTERS)[number]

export function AIAccountant() {
  // Table state.
  const [query, setQuery] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>('All')
  const [selectedTx, setSelectedTx] = React.useState<(typeof bankTransactions)[number] | null>(null)

  // AI Q&A state.
  const [question, setQuestion] = React.useState('')
  const [response, setResponse] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Filtered rows.
  const rows = React.useMemo(() => {
    return bankTransactions
      .filter((t) => typeFilter === 'All' || t.type === typeFilter)
      .filter((t) => {
        if (!query.trim()) return true
        const q = query.toLowerCase()
        return (
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.account.toLowerCase().includes(q)
        )
      })
  }, [query, typeFilter])

  const ask = React.useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (!trimmed || loading) return
    setLoading(true)
    setError(null)
    setResponse('')
    setQuestion('')
    try {
      const res = await fetch('/api/finos/accountant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
      })
      const data = await res.json()
      if (data.ok) setResponse(data.content)
      else setError(data.error || 'Accountant failed to respond')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [loading])

  const onRowClick = (tx: (typeof bankTransactions)[number]) => {
    setSelectedTx(tx)
    setQuestion(`Explain the journal entry for: ${tx.description} ₹${tx.amount.toLocaleString('en-IN')}`)
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="AI Accountant"
        subtitle="Auto categorization, journal entries, ledger review"
        icon={Calculator}
        accent="violet"
        action={<Badge variant="secondary" className="hidden sm:inline-flex">Ind AS · GST aware</Badge>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Left: transaction table ─────────────────────────────────────── */}
        <Card className="border-border/60">
          <CardHeader className="space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">Recent Bank Transactions</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">Click a row to ask the AI about it</p>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {/* Search + filter */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search description, category, account…"
                  className="h-9 w-full rounded-md border border-border/60 bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30"
                />
              </div>
              <div className="flex gap-1 rounded-md border border-border/60 bg-card p-0.5">
                {TYPE_FILTERS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={cn(
                      'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                      typeFilter === t
                        ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-border/60">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow className="border-border/60">
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide text-muted-foreground">Date</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide text-muted-foreground">Description</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide text-muted-foreground">Type</TableHead>
                    <TableHead className="h-9 text-right text-[11px] uppercase tracking-wide text-muted-foreground">Amount</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide text-muted-foreground">Matched</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        No transactions match your filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((tx) => {
                      const isSelected = selectedTx?.id === tx.id
                      const isCredit = tx.type === 'Credit'
                      return (
                        <TableRow
                          key={tx.id}
                          onClick={() => onRowClick(tx)}
                          className={cn(
                            'cursor-pointer border-border/60 transition-colors',
                            isSelected ? 'bg-violet-500/10' : 'hover:bg-muted/40',
                          )}
                        >
                          <TableCell className="whitespace-nowrap py-2.5 text-xs text-muted-foreground">
                            {formatDate(tx.date)}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div className="text-xs font-medium text-foreground line-clamp-1">{tx.description}</div>
                            <div className="mt-0.5 text-[10px] text-muted-foreground">{tx.category} · {tx.account}</div>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <StatusPill status={tx.type} />
                          </TableCell>
                          <TableCell className={cn(
                            'whitespace-nowrap py-2.5 text-right text-xs font-semibold tabular-nums',
                            isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
                          )}>
                            {isCredit ? '+' : '−'}{formatINR(tx.amount)}
                          </TableCell>
                          <TableCell className="py-2.5">
                            {tx.matched ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="h-3 w-3" /> Matched
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                <Circle className="h-3 w-3" /> Unmatched
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Showing {rows.length} of {bankTransactions.length} transactions
            </p>
          </CardContent>
        </Card>

        {/* ── Right: AI Q&A panel ─────────────────────────────────────────── */}
        <Card className="flex flex-col border-border/60">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">Ask the AI Accountant</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Journal entries, GST treatment, categorization</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3 pt-0">
            {/* Preset chips */}
            <div className="flex flex-wrap gap-1.5">
              {PRESET_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  disabled={loading}
                  className="rounded-full border border-border/60 bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Question input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    ask(question)
                  }
                }}
                placeholder="Ask about classification, journal entries, GST treatment…"
                className="h-10 flex-1 rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30"
              />
              <Button
                onClick={() => ask(question)}
                disabled={loading || !question.trim()}
                className="bg-violet-600 hover:bg-violet-700"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="sr-only">Ask</span>
              </Button>
            </div>

            {/* Response area */}
            <div className="min-h-[16rem] flex-1 overflow-y-auto rounded-xl border border-border/60 bg-muted/30 p-4">
              {loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing…
                </div>
              )}
              {!loading && error && (
                <div className="flex items-start gap-2 text-sm text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {!loading && !error && !response && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Calculator className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    Ready to help
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Pick a preset question above, click any transaction on the left to ask about its journal entry, or type your own question. The AI has full context on your recent transactions, vendor bills, and sales invoices.
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Pill accent="violet">Journal entries</Pill>
                    <Pill accent="amber">GST treatment</Pill>
                    <Pill accent="emerald">ITC eligibility</Pill>
                    <Pill accent="sky">Ind AS heads</Pill>
                  </div>
                </div>
              )}
              {!loading && response && (
                <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">{response}</pre>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
