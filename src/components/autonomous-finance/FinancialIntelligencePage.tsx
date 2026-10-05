'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Financial Intelligence Page (Phase Delta · 3)
// AI-powered analysis dashboard: insights, risks, recommendations, confidence,
// historical comparison, overall health score.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, TrendingUp, TrendingDown, Minus, Sparkles, AlertTriangle,
  Lightbulb, RefreshCw,
} from 'lucide-react';
import {
  useFireInvoices, useFireReturns, useFireBankTransactions, useFireClients, useFirePayments,
} from '@/hooks/use-firestore';
import { useBusinessSnapshot } from '@/hooks/useBusinessSnapshot';
import {
  computeFinancialIntelligence, formatCurrency,
  type FinancialIntelligenceSnapshot,
  type FinancialInsight,
} from '@/lib/autonomous-finance/financial-intelligence';
import { ProfessionalEmptyState } from '@/components/shared/ProfessionalEmptyState';
import { TrustBar } from '@/components/shared/TrustBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const EASE = [0.16, 1, 0.3, 1] as const;

function trendIcon(t?: 'up' | 'down' | 'flat') {
  if (t === 'up') return <TrendingUp className="h-3 w-3 text-emerald-400" />;
  if (t === 'down') return <TrendingDown className="h-3 w-3 text-rose-400" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function severityColor(s: string) {
  return s === 'critical' ? 'border-rose-400/30 bg-rose-500/[0.04] text-rose-300' :
    s === 'warning' ? 'border-amber-400/30 bg-amber-500/[0.04] text-amber-300' :
    'border-emerald-400/30 bg-emerald-500/[0.04] text-emerald-300';
}

function InsightCard({ ins, delay }: { ins: FinancialInsight; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay }}
      className={`rounded-2xl border p-4 ${severityColor(ins.severity)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4" />
          <h4 className="text-sm font-semibold text-foreground">{ins.title}</h4>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative h-7 w-7">
            <svg className="h-7 w-7 -rotate-90" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white/[0.06]" />
              <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 13}
                strokeDashoffset={2 * Math.PI * 13 * (1 - ins.confidence)} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold">{Math.round(ins.confidence * 100)}</span>
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{ins.description}</p>
      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">{ins.metric.label}:</span>
        <span className="font-medium text-foreground">
          {ins.metric.unit === 'INR' ? formatCurrency(ins.metric.value) : `${ins.metric.value.toFixed(1)}${ins.metric.unit}`}
        </span>
        {trendIcon(ins.metric.trend)}
      </div>
      {ins.historicalComparison && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          vs {ins.historicalComparison.period}: {ins.historicalComparison.deltaPct >= 0 ? '+' : ''}{ins.historicalComparison.deltaPct.toFixed(1)}%
        </p>
      )}
      <p className="mt-2 flex items-start gap-1.5 text-xs text-foreground/80">
        <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" /> {ins.recommendation}
      </p>
    </motion.div>
  );
}

export function FinancialIntelligencePage() {
  const { data: invoices, loading: invLoading } = useFireInvoices();
  const { data: returns } = useFireReturns();
  const { data: bankTx } = useFireBankTransactions();
  const { data: clients } = useFireClients();
  const { data: payments } = useFirePayments();
  // Canonical Business Snapshot — the single source of truth for revenue /
  // cash / receivables / payables / GST / health score. The Firestore-hook
  // records are still used for record-level detail (top customers, sparkline)
  // that the snapshot doesn't expose. See AUDIT-DUP-1 + task DUP-CLEANUP.
  const { snapshot } = useBusinessSnapshot();
  const [refreshKey, setRefreshKey] = useState(0);

  const report = useMemo(() => computeFinancialIntelligence({
    invoices: invoices as unknown as Array<Record<string, unknown>>,
    bankTransactions: bankTx as unknown as Array<Record<string, unknown>>,
    returns: returns as unknown as Array<Record<string, unknown>>,
    clients: clients as unknown as Array<Record<string, unknown>>,
    payments: payments as unknown as Array<Record<string, unknown>>,
    // Cast through `unknown` because useBusinessSnapshot's TS type is the
    // legacy `BusinessSnapshot` from `@/lib/financial-engine` (nested shape)
    // while the actual API response from `/api/business/snapshot` is the
    // unified shape that ALSO includes the flat fields this engine consumes.
    // The runtime values are correct; the TS type just hasn't been migrated.
    // See AUDIT-DUP-1 + task DUP-CLEANUP in worklog.md.
    snapshot: snapshot as unknown as FinancialIntelligenceSnapshot,
  }), [invoices, bankTx, returns, clients, payments, snapshot, refreshKey]);

  const hasData = invoices.length > 0 || bankTx.length > 0 || returns.length > 0;
  const score = report.overallHealthScore;
  const scoreColor = score >= 70 ? 'text-emerald-400' : score >= 45 ? 'text-amber-400' : 'text-rose-400';
  const scoreLabel = score >= 70 ? 'Excellent' : score >= 45 ? 'At Risk' : 'Critical';

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground md:text-3xl">Financial Intelligence</h1>
              <p className="mt-1 text-sm text-muted-foreground">AI-powered analysis of your financial operations</p>
            </div>
            <TrustBar
              connected={hasData}
              connecting={invLoading}
              lastSync={report.generatedAt}
              onRefresh={() => { setRefreshKey((k) => k + 1); toast.success('Recomputed'); }}
            />
          </div>

          {!hasData ? (
            <ProfessionalEmptyState
              icon={Brain}
              title="No financial data yet"
              description="Connect your invoices, bank accounts, and GST returns to unlock AI-powered financial intelligence — revenue trends, cash flow forecasts, concentration risk, and a real-time health score."
              accent="cyan"
              action={{ label: 'Connect data sources', onClick: () => toast.info('Navigate to Settings → Connections') }}
            />
          ) : (
            <>
              {/* Health score gauge + summary */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Overall Health Score</p>
                  <div className="mt-3 flex items-center gap-4">
                    <div className="relative h-24 w-24">
                      <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" className="text-white/[0.06]" />
                        <motion.circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"
                          className={scoreColor}
                          strokeDasharray={2 * Math.PI * 42}
                          initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                          animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - score / 100) }}
                          transition={{ duration: 1.2, ease: EASE }} />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-2xl font-bold ${scoreColor}`}>{score}</span>
                        <span className="text-[10px] uppercase text-muted-foreground">{scoreLabel}</span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <p>Blended score from profitability, growth, cash flow, concentration risk, and tax compliance.</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:col-span-2">
                  {[
                    { label: 'Revenue', value: report.summary.revenueTrend.value, unit: 'INR', trend: report.summary.revenueTrend.trend, accent: 'text-emerald-300' },
                    { label: 'Expenses', value: report.summary.expenseTrend.value, unit: 'INR', trend: report.summary.expenseTrend.trend, accent: 'text-rose-300' },
                    { label: 'Cash Flow 30d', value: report.summary.cashflowForecast.value, unit: 'INR', accent: 'text-cyan-300' },
                    { label: 'Working Capital', value: report.summary.workingCapital.value, unit: 'INR', accent: 'text-cyan-300' },
                    { label: 'Tax Exposure', value: report.summary.taxExposure.value, unit: 'INR', accent: 'text-amber-300' },
                    { label: 'Profit Margin', value: report.summary.profitabilityMargin.value, unit: '%', accent: 'text-teal-300' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className={`text-lg font-semibold ${s.accent}`}>{s.unit === 'INR' ? formatCurrency(s.value) : `${s.value.toFixed(1)}%`}</span>
                        {trendIcon(s.trend)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Insights grid */}
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">All Insights ({report.insights.length})</h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {report.insights.map((ins, i) => <InsightCard key={ins.id} ins={ins} delay={i * 0.04} />)}
                </div>
              </div>

              {/* Risks */}
              {report.risks.length > 0 && (
                <div>
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    <AlertTriangle className="h-4 w-4 text-amber-400" /> Risks ({report.risks.length})
                  </h2>
                  <div className="space-y-2">
                    {report.risks.map((r) => (
                      <div key={r.id} className="flex items-start gap-3 rounded-lg border border-amber-400/20 bg-amber-500/[0.03] p-3">
                        <AlertTriangle className={`mt-0.5 h-4 w-4 ${r.severity === 'critical' ? 'text-rose-400' : 'text-amber-400'}`} />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{r.title}</p>
                          <p className="text-xs text-muted-foreground">{r.description}</p>
                          <p className="mt-1 text-xs text-amber-300">→ {r.recommendation}</p>
                        </div>
                        <Button size="sm" variant="outline" className="border-amber-400/30 text-amber-300"
                          onClick={() => toast.success('Recommendation noted — assign to workflow')}>
                          Apply
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
