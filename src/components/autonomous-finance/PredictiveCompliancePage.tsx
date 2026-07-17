'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Predictive Compliance Page (Phase Delta · 5)
// AI forecasts of compliance risks, weeks before deadlines.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldAlert, Calendar, AlertTriangle, Sparkles, TrendingDown, Clock,
} from 'lucide-react';
import {
  useFireReturns, useFireInvoices, useFireBankTransactions, useFireTasks, useFireNotices,
} from '@/hooks/use-firestore';
import {
  computePredictiveCompliance, type ComplianceAlert,
} from '@/lib/autonomous-finance/predictive-compliance';
import { ProfessionalEmptyState } from '@/components/shared/ProfessionalEmptyState';
import { TrustBar } from '@/components/shared/TrustBar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useApp } from '@/contexts/AppContext';

const EASE = [0.16, 1, 0.3, 1] as const;

function sevColor(s: string) {
  return s === 'critical' ? 'border-rose-400/30 bg-rose-500/[0.04]' :
    s === 'warning' ? 'border-amber-400/30 bg-amber-500/[0.04]' :
    'border-emerald-400/30 bg-emerald-500/[0.04]';
}
function sevText(s: string) {
  return s === 'critical' ? 'text-rose-300' : s === 'warning' ? 'text-amber-300' : 'text-emerald-300';
}

export function PredictiveCompliancePage() {
  const { setCurrentView } = useApp();
  const { data: returns, loading: retLoading } = useFireReturns();
  const { data: invoices } = useFireInvoices();
  const { data: bankTx } = useFireBankTransactions();
  const { data: tasks } = useFireTasks();
  const { data: notices } = useFireNotices();
  const [refreshKey, setRefreshKey] = useState(0);

  const report = useMemo(() => computePredictiveCompliance({
    returns: returns as unknown as Array<Record<string, unknown>>,
    invoices: invoices as unknown as Array<Record<string, unknown>>,
    bankTransactions: bankTx as unknown as Array<Record<string, unknown>>,
    tasks: tasks as unknown as Array<Record<string, unknown>>,
    notices: notices as unknown as Array<Record<string, unknown>>,
  }), [returns, invoices, bankTx, tasks, notices, refreshKey]);

  const hasData = returns.length > 0 || tasks.length > 0;
  const riskColor = report.riskScore >= 60 ? 'text-rose-400' : report.riskScore >= 30 ? 'text-amber-400' : 'text-emerald-400';
  const riskLabel = report.riskScore >= 60 ? 'High Risk' : report.riskScore >= 30 ? 'Moderate Risk' : 'Low Risk';

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground md:text-3xl">Predictive Compliance</h1>
              <p className="mt-1 text-sm text-muted-foreground">AI forecasts of compliance risks, weeks before deadlines</p>
            </div>
            <TrustBar connected={hasData} connecting={retLoading} lastSync={report.generatedAt} onRefresh={() => { setRefreshKey((k) => k + 1); toast.success('Recomputed'); }} />
          </div>

          {!hasData ? (
            <ProfessionalEmptyState
              icon={ShieldAlert}
              title="No compliance data yet"
              description="Add GST returns or tasks to unlock predictive compliance — late filing probability, GST mismatch risk, penalty prediction, cash shortage alerts, and proactive reminders weeks before deadlines."
              accent="amber"
              action={{ label: 'Go to Returns', onClick: () => setCurrentView('returns'), icon: Calendar }}
            />
          ) : (
            <>
              {/* Risk score + summary */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Compliance Risk Score</p>
                  <div className="mt-3 flex items-center gap-4">
                    <div className="relative h-24 w-24">
                      <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" className="text-white/[0.06]" />
                        <motion.circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"
                          className={riskColor}
                          strokeDasharray={2 * Math.PI * 42}
                          initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                          animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - report.riskScore / 100) }}
                          transition={{ duration: 1.2, ease: EASE }} />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-2xl font-bold ${riskColor}`}>{report.riskScore}</span>
                        <span className="text-[10px] uppercase text-muted-foreground">{riskLabel}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Weighted by severity, probability, and penalty exposure across all returns.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:col-span-2">
                  {[
                    { label: 'Late Filing Prob', value: `${Math.round(report.summary.lateFilingProb * 100)}%`, accent: 'text-rose-300', icon: Clock },
                    { label: 'GST Mismatch Prob', value: `${Math.round(report.summary.gstMismatchProb * 100)}%`, accent: 'text-amber-300', icon: TrendingDown },
                    { label: 'Predicted Penalty', value: `₹${report.summary.predictedPenalty.toLocaleString('en-IN')}`, accent: 'text-rose-300', icon: AlertTriangle },
                    { label: 'Cash Shortage Risk', value: `${Math.round(report.summary.cashShortageRisk * 100)}%`, accent: 'text-amber-300', icon: ShieldAlert },
                    { label: 'Filing Overload Risk', value: `${Math.round(report.summary.filingOverloadRisk * 100)}%`, accent: 'text-violet-300', icon: Calendar },
                    { label: 'Missing Docs Risk', value: `${Math.round(report.summary.missingDocsRisk * 100)}%`, accent: 'text-amber-300', icon: AlertTriangle },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <div className="flex items-center gap-1.5">
                        <s.icon className={`h-3 w-3 ${s.accent}`} />
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</span>
                      </div>
                      <p className={`mt-1 text-lg font-semibold ${s.accent}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alerts */}
              <div>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 text-amber-400" /> Predictive Alerts ({report.alerts.length})
                </h2>
                {report.alerts.length === 0 ? (
                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.03] p-6 text-center">
                    <Sparkles className="mx-auto h-8 w-8 text-emerald-400" />
                    <p className="mt-2 text-sm text-emerald-300">No compliance risks predicted — you're on track.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {report.alerts.map((a: ComplianceAlert, i) => (
                      <motion.div
                        key={a.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: EASE, delay: i * 0.03 }}
                        className={`rounded-xl border p-4 ${sevColor(a.severity)}`}
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className={`h-4 w-4 ${sevText(a.severity)}`} />
                              <h4 className="text-sm font-semibold text-foreground">{a.title}</h4>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>
                            <p className="mt-1.5 text-xs text-amber-300">→ {a.recommendation}</p>
                          </div>
                          <div className="flex flex-shrink-0 flex-wrap gap-1.5 md:flex-col md:items-end">
                            <Badge variant="outline" className={`text-[10px] ${sevText(a.severity)}`}>{a.severity}</Badge>
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">{Math.round(a.probability * 100)}% prob</Badge>
                            {a.impactAmount > 0 && <Badge variant="outline" className="text-[10px] text-rose-300">₹{a.impactAmount.toLocaleString('en-IN')}</Badge>}
                            {a.weeksAhead !== undefined && (
                              <Badge variant="outline" className={`text-[10px] ${a.weeksAhead < 0 ? 'text-rose-300' : 'text-amber-300'}`}>
                                {a.weeksAhead >= 0 ? `in ${a.weeksAhead}w` : `${Math.abs(a.weeksAhead)}w overdue`}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Upcoming deadlines */}
              {report.upcomingDeadlines.length > 0 && (
                <div>
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    <Calendar className="h-4 w-4 text-cyan-400" /> Upcoming Deadlines
                  </h2>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {report.upcomingDeadlines.map((d, i) => (
                      <div key={i} className="min-w-[160px] rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                        <p className="text-xs font-medium text-foreground">{d.label}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                        <Badge variant="outline" className={`mt-2 text-[10px] ${d.daysAway < 0 ? 'border-rose-400/30 text-rose-300' : d.daysAway <= 7 ? 'border-amber-400/30 text-amber-300' : 'border-emerald-400/30 text-emerald-300'}`}>
                          {d.daysAway < 0 ? `${Math.abs(d.daysAway)}d overdue` : `${d.daysAway}d away`}
                        </Badge>
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
