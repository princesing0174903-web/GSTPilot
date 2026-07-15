'use client'

/**
 * AICFO — AI-powered CFO module.
 * Left: analysis, KPIs, forecast chart, working-capital gauge.
 * Right: scenario analysis chat panel powered by /api/finos/cfo-insights.
 */

import * as React from 'react'
import {
  Brain, TrendingUp, Wallet, Receipt, Landmark, Sparkles,
  Send, Loader2, LineChart as LineIcon, AlertTriangle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AreaChart, GaugeChart, CHART_COLORS } from '@/components/finos/ui/charts'
import {
  SectionHeader, KpiCard, ChartCard, Pill, accentClasses,
} from '@/components/finos/ui/primitives'
import { executiveKpis, cashFlow } from '@/lib/finos/data'
import { formatINRCompact } from '@/lib/finos/format'
import { cn } from '@/lib/utils'

// Icon lookup for the 4 KPIs surfaced in this module.
const KPI_ICONS = { TrendingUp, Wallet, Receipt, Landmark } as const

const PRESET_TOPICS = [
  'Q2 forecast',
  'Working capital optimization',
  'GST liability August',
  'Vendor concentration risk',
  'Receivables acceleration',
]

// Linear projection of net cash flow for the next 3 months, based on the
// average slope of the last 3 actual months. Keeps the chart honest —
// the AI narrative comes from the LLM.
function useForecast() {
  return React.useMemo(() => {
    const last3 = cashFlow.slice(-3)
    const avgNet = last3.reduce((s, m) => s + m.net, 0) / last3.length
    const trend = (last3[2].net - last3[0].net) / 2 // slope over 2 intervals
    const months = ['Aug', 'Sep', 'Oct']
    return months.map((m, i) => ({
      month: m,
      projected: Math.round(avgNet + trend * (i + 1)),
      type: 'Forecast',
    }))
  }, [])
}

export function AICFO() {
  const forecast = useForecast()

  // Pick the 4 KPIs we want for this view (Revenue MTD, Net Profit, GST Liability, Cash Balance).
  const cfoKpis = React.useMemo(
    () => ['revenue', 'netProfit', 'gstLiability', 'cashBalance']
      .map((id) => executiveKpis.find((k) => k.id === id)!)
      .filter(Boolean),
    [],
  )

  // Scenario analysis state.
  const [activeTopic, setActiveTopic] = React.useState<string | null>(null)
  const [question, setQuestion] = React.useState('')
  const [response, setResponse] = React.useState<string>('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const runAnalysis = React.useCallback(async (topic: string) => {
    setLoading(true)
    setError(null)
    setResponse('')
    setActiveTopic(topic)
    try {
      const res = await fetch('/api/finos/cfo-insights', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic }),
      })
      const data = await res.json()
      if (data.ok) setResponse(data.content)
      else setError(data.error || 'Analysis failed')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  const submitQuestion = () => {
    const q = question.trim()
    if (!q || loading) return
    setQuestion('')
    runAnalysis(q)
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="AI CFO"
        subtitle="Financial intelligence, forecasts, and what-if simulations"
        icon={Brain}
        accent="violet"
        action={<Badge variant="secondary" className="hidden sm:inline-flex">Powered by Z.ai</Badge>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* ── Left column: analysis (3/5) ────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-3">
          {/* KPI row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cfoKpis.map((k) => {
              const Icon = KPI_ICONS[k.icon as keyof typeof KPI_ICONS] || TrendingUp
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

          {/* Cash flow forecast chart */}
          <ChartCard
            title="Cash Flow Forecast (Next 3 Months)"
            subtitle="Linear projection from last 3 months net cash flow"
            action={<Pill accent="violet"><LineIcon className="h-3 w-3" />Projected</Pill>}
          >
            <AreaChart
              data={forecast.map((f) => f.projected)}
              labels={forecast.map((f) => f.month)}
              color={CHART_COLORS.violet}
              height={256}
              yFormat={formatINRCompact}
            />
          </ChartCard>

          {/* Working capital gauge */}
          <Card className="border-border/60">
            <CardHeader className="space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">Working Capital Health</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">Composite score · current ratio, DSO, inventory turn</p>
            </CardHeader>
            <CardContent className="pt-0">
              <WorkingCapitalGauge score={78} />
            </CardContent>
          </Card>
        </div>

        {/* ── Right column: AI scenario panel (2/5) ──────────────────────── */}
        <div className="lg:col-span-2">
          <Card className="flex h-full flex-col border-border/60">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <CardTitle className="text-sm font-semibold text-foreground">AI Scenario Analysis</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">Pick a topic or ask your own</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4 pt-0">
              {/* Preset topics */}
              <div className="flex flex-wrap gap-2">
                {PRESET_TOPICS.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => runAnalysis(topic)}
                    disabled={loading}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      'disabled:opacity-50',
                      activeTopic === topic
                        ? 'border-violet-500/40 bg-violet-500/15 text-violet-700 dark:text-violet-300'
                        : 'border-border/60 bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {topic}
                  </button>
                ))}
              </div>

              {/* Response area */}
              <div className="flex-1 overflow-y-auto rounded-xl border border-border/60 bg-muted/30 p-4">
                {loading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing {activeTopic}…
                  </div>
                )}
                {!loading && error && (
                  <div className="flex items-start gap-2 text-sm text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                {!loading && !error && !response && (
                  <div className="text-sm text-muted-foreground">
                    Select a preset topic above, or ask the CFO anything below. The AI will produce a structured briefing with headline, analysis, recommendations, risks, and expected impact.
                  </div>
                )}
                {!loading && response && (
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">{response}</pre>
                )}
              </div>

              {/* Ask anything input */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Ask the CFO anything
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        submitQuestion()
                      }
                    }}
                    placeholder="e.g. What's our burn rate if Q2 revenue drops 15%?"
                    className="flex h-10 flex-1 rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30"
                  />
                  <Button
                    onClick={submitQuestion}
                    disabled={loading || !question.trim()}
                    className="bg-violet-600 hover:bg-violet-700"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    <span className="sr-only">Send</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ─── Semi-circular gauge for working capital health ──────────────────────────
function WorkingCapitalGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score))
  const color = clamped >= 75 ? CHART_COLORS.emerald : clamped >= 50 ? CHART_COLORS.amber : CHART_COLORS.rose
  const label = clamped >= 75 ? 'Healthy' : clamped >= 50 ? 'Watch' : 'Critical'
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-around">
      <GaugeChart value={clamped} max={100} label={label} color={color} height={170} />
      <div className="space-y-2 text-center sm:text-left">
        <div className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: color }} />
          <span className="text-sm font-semibold text-foreground">{label}</span>
        </div>
        <p className="max-w-[18rem] text-xs leading-relaxed text-muted-foreground">
          Current ratio 1.8×, DSO 38 days, inventory turn 7.2×. Healthy but watch the 2 SKUs at reorder and the ITC-04 penalty accruing.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Pill accent="emerald">DSO ↓8d</Pill>
          <Pill accent="amber">2 SKUs low</Pill>
          <Pill accent="rose">ITC-04 overdue</Pill>
        </div>
      </div>
    </div>
  )
}
