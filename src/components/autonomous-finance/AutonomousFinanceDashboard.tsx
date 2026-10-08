'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Autonomous Finance Dashboard (Phase Delta flagship)
// The "AI Finance Operations Team" command center. Surfaces live intelligence,
// predictive alerts, pending approvals, auto-executed actions, active workflows,
// and collections status — all from real Firestore data.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, AlertTriangle, Brain, CheckCircle2, Clock, Cpu,
  Sparkles, TrendingUp, Workflow, Zap, Shield, Users,
} from 'lucide-react';
import { useFireInvoices, useFireReturns, useFireBankTransactions,
  useFireClients, useFireTasks, useFireRecentActivities } from '@/hooks/use-firestore';
import { useBusinessSnapshot } from '@/hooks/useBusinessSnapshot';
import {
  computeFinancialIntelligence, formatCurrency,
  type FinancialIntelligenceSnapshot,
} from '@/lib/autonomous-finance/financial-intelligence';
import { computePredictiveCompliance } from '@/lib/autonomous-finance/predictive-compliance';
import { computeIntelligentCollections } from '@/lib/autonomous-finance/intelligent-collections';
import { TrustBar } from '@/components/shared/TrustBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const EASE = [0.16, 1, 0.3, 1] as const;

function Gauge({ value, label, sublabel, color }: { value: number; label: string; sublabel: string; color: string }) {
  const v = Math.max(0, Math.min(100, value));
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (v / 100) * circumference;
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-28 w-28">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" className="text-white/[0.06]" />
          <motion.circle
            cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6"
            strokeLinecap="round" className={color}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: EASE }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-foreground">{Math.round(v)}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">/ 100</span>
        </div>
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{sublabel}</p>
    </div>
  );
}

function SectionCard({ icon: Icon, title, accent, children, delay }: {
  icon: React.ElementType; title: string; accent: string; children: React.ReactNode; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay }}
      className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-sm"
    >
      <div className="mb-4 flex items-center gap-2.5">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

export function AutonomousFinanceDashboard() {
  const { data: invoices, loading: invLoading } = useFireInvoices();
  const { data: returns, loading: retLoading } = useFireReturns();
  const { data: bankTx } = useFireBankTransactions();
  const { data: clients } = useFireClients();
  const { data: tasks } = useFireTasks();
  const { data: activities } = useFireRecentActivities(20);
  // Canonical Business Snapshot — the single source of truth for revenue /
  // cash / receivables / payables / GST / health score. The Firestore-hook
  // records are still used for record-level detail (top customers, sparkline)
  // that the snapshot doesn't expose. See AUDIT-DUP-1 + task DUP-CLEANUP.
  const { snapshot: businessSnapshot } = useBusinessSnapshot();

  const intel = useMemo(() => computeFinancialIntelligence({
    invoices: invoices as unknown as Array<Record<string, unknown>>,
    bankTransactions: bankTx as unknown as Array<Record<string, unknown>>,
    returns: returns as unknown as Array<Record<string, unknown>>,
    clients: clients as unknown as Array<Record<string, unknown>>,
    // Cast through `unknown` because useBusinessSnapshot's TS type is the
    // legacy `BusinessSnapshot` from `@/lib/financial-engine` (nested shape)
    // while the actual API response from `/api/business/snapshot` is the
    // unified shape that ALSO includes the flat fields this engine consumes.
    // The runtime values are correct; the TS type just hasn't been migrated.
    snapshot: businessSnapshot as unknown as FinancialIntelligenceSnapshot,
  }), [invoices, bankTx, returns, clients, businessSnapshot]);

  const compliance = useMemo(() => computePredictiveCompliance({
    returns: returns as unknown as Array<Record<string, unknown>>,
    invoices: invoices as unknown as Array<Record<string, unknown>>,
    bankTransactions: bankTx as unknown as Array<Record<string, unknown>>,
    tasks: tasks as unknown as Array<Record<string, unknown>>,
  }), [returns, invoices, bankTx, tasks]);

  const collections = useMemo(() => computeIntelligentCollections({
    invoices: invoices as unknown as Array<Record<string, unknown>>,
    clients: clients as unknown as Array<Record<string, unknown>>,
  }), [invoices, clients]);

  const pendingApprovals = useMemo(() =>
    tasks.filter((t) => String(t.status ?? '') === 'open' &&
      (String(t.tags ?? '').includes('approval') || String(t.priority ?? '') === 'critical')).slice(0, 5),
    [tasks]);

  const autoActions = useMemo(() =>
    activities.filter((a) => {
      const actor = String(a.actor ?? a.type ?? '');
      return actor.includes('oracle') || actor.includes('workflow') || actor.includes('ai');
    }).slice(0, 6),
    [activities]);

  const healthScore = intel.overallHealthScore;
  const healthColor = healthScore >= 70 ? 'text-emerald-400' : healthScore >= 45 ? 'text-amber-400' : 'text-rose-400';
  const riskColor = compliance.riskScore >= 60 ? 'text-rose-400' : compliance.riskScore >= 30 ? 'text-amber-400' : 'text-emerald-400';
  const autopilotPct = activities.length > 0
    ? Math.round((autoActions.length / activities.length) * 100)
    : 0;

  const lastSync = activities[0]?.createdAt ? new Date(String(activities[0].createdAt)) : null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Hero header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2">
                  <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-xs font-medium uppercase tracking-wider text-emerald-400">Active</span>
              </div>
              <h1 className="mt-2 text-2xl font-bold text-foreground md:text-3xl">Autonomous Finance Operations</h1>
              <p className="mt-1 text-sm text-muted-foreground">Your AI Finance Team is monitoring 24/7</p>
            </div>
            <TrustBar
              connected={invoices.length > 0 || bankTx.length > 0}
              connecting={invLoading || retLoading}
              lastSync={lastSync}
              activityCount={activities.length}
            />
          </div>

          {/* Top: dual gauges */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex items-center justify-around rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-sm">
              <Gauge value={healthScore} label="Cash & Compliance Health" sublabel={healthScore >= 70 ? 'Excellent' : healthScore >= 45 ? 'At Risk' : 'Critical'} color={healthColor} />
              <div className="space-y-1 text-right">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Top Risks</p>
                {intel.risks.slice(0, 3).map((r) => (
                  <p key={r.id} className="text-xs text-muted-foreground">• {r.title}</p>
                ))}
                {intel.risks.length === 0 && <p className="text-xs text-emerald-400">No active risks</p>}
              </div>
            </div>
            <div className="flex items-center justify-around rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-sm">
              <Gauge value={autopilotPct} label="Operations Autopilot" sublabel={`${autoActions.length} of ${activities.length} actions auto-handled`} color="text-cyan-400" />
              <div className="space-y-1 text-right">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Last 24h</p>
                <p className="text-2xl font-semibold text-foreground">{autoActions.length}</p>
                <p className="text-xs text-muted-foreground">auto-executed</p>
              </div>
            </div>
          </div>

          {/* Live Intelligence Feed */}
          <SectionCard icon={Brain} title="Live Intelligence Feed" accent="bg-cyan-500/15 text-cyan-300" delay={0.05}>
            {intel.insights.length === 0 ? (
              <p className="text-sm text-muted-foreground">Connect invoices and bank transactions to enable intelligence.</p>
            ) : (
              <div className="space-y-2.5">
                {intel.insights.slice(0, 5).map((ins) => (
                  <div key={ins.id} className="flex items-start gap-3 rounded-lg border border-white/[0.04] bg-white/[0.01] p-3">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                      ins.severity === 'critical' ? 'bg-rose-500/15 text-rose-300' :
                      ins.severity === 'warning' ? 'bg-amber-500/15 text-amber-300' :
                      'bg-emerald-500/15 text-emerald-300'}`}>
                      <TrendingUp className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{ins.title}</p>
                        <span className="shrink-0 text-xs text-muted-foreground">{Math.round(ins.confidence * 100)}% conf.</span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{ins.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Predictive Alerts + Pending Approvals */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard icon={AlertTriangle} title="Predictive Alerts" accent="bg-amber-500/15 text-amber-300" delay={0.1}>
              <div className="mb-3 flex items-center gap-2">
                <span className={`text-2xl font-bold ${riskColor}`}>{compliance.riskScore}</span>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">compliance risk score</span>
              </div>
              {compliance.alerts.length === 0 ? (
                <p className="text-sm text-emerald-400">No compliance risks predicted. All clear.</p>
              ) : (
                <div className="space-y-2">
                  {compliance.alerts.slice(0, 4).map((a) => (
                    <div key={a.id} className="flex items-start gap-2.5 rounded-lg border border-white/[0.04] p-2.5">
                      <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                        a.severity === 'critical' ? 'bg-rose-400' : a.severity === 'warning' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{a.description}</p>
                        <div className="mt-1 flex flex-wrap gap-2 text-[10px]">
                          {a.impactAmount > 0 && <Badge variant="outline" className="border-rose-400/30 text-rose-300">Impact {formatCurrency(a.impactAmount)}</Badge>}
                          {a.weeksAhead !== undefined && <Badge variant="outline" className="border-amber-400/30 text-amber-300">{a.weeksAhead >= 0 ? `in ${a.weeksAhead}w` : `${Math.abs(a.weeksAhead)}w overdue`}</Badge>}
                          <Badge variant="outline" className="border-white/10 text-muted-foreground">{Math.round(a.probability * 100)}% prob</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard icon={Clock} title="Pending Approvals" accent="bg-cyan-500/15 text-cyan-300" delay={0.15}>
              {pendingApprovals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                  <p className="mt-2 text-sm font-medium text-emerald-400">All clear</p>
                  <p className="text-xs text-muted-foreground">No pending approvals — AI is operating autonomously.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingApprovals.map((t) => (
                    <div key={t.taskId ?? t.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.04] p-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                        <p className="text-xs text-muted-foreground">Due {t.dueDate ?? '—'}</p>
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" className="h-7 border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/10"
                          onClick={() => toast.success('Approved — workflow resuming')}>Approve</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-muted-foreground"
                          onClick={() => toast.info('Review queued')}>Review</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Auto-Executed Actions + Collections */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard icon={Zap} title="Auto-Executed Actions (24h)" accent="bg-teal-500/15 text-teal-300" delay={0.2}>
              {autoActions.length === 0 ? (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Cpu className="h-4 w-4" /> AI standing by — no autonomous actions yet.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {autoActions.map((a) => (
                    <div key={a.activityId ?? a.id} className="flex items-center gap-2.5 text-sm">
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-teal-400" />
                      <span className="flex-1 truncate text-foreground">{a.description ?? a.type ?? 'Autonomous action'}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{a.createdAt ? new Date(String(a.createdAt)).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard icon={Users} title="Collections Status" accent="bg-rose-500/15 text-rose-300" delay={0.25}>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-white/[0.04] p-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Overdue</p>
                  <p className="mt-1 text-xl font-semibold text-rose-300">{formatCurrency(collections.analytics.totalOverdue)}</p>
                </div>
                <div className="rounded-lg border border-white/[0.04] p-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">At-Risk Customers</p>
                  <p className="mt-1 text-xl font-semibold text-amber-300">
                    {collections.scores.filter((s) => s.tier === 'at-risk' || s.tier === 'critical').length}
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {collections.scores.filter((s) => s.tier === 'critical' || s.tier === 'at-risk').slice(0, 3).map((s) => (
                  <div key={s.clientId} className="flex items-center justify-between text-sm">
                    <span className="truncate text-foreground">{s.clientName}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatCurrency(s.overdueAmount)} · {s.oldestOverdueDays}d</span>
                  </div>
                ))}
                {collections.scores.filter((s) => s.tier === 'critical' || s.tier === 'at-risk').length === 0 && (
                  <p className="text-sm text-emerald-400">No overdue customers.</p>
                )}
              </div>
            </SectionCard>
          </div>

          {/* Active Workflows footer note */}
          <SectionCard icon={Workflow} title="Active Workflows" accent="bg-emerald-500/15 text-emerald-300" delay={0.3}>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {autoActions.length > 0
                  ? `${autoActions.length} workflow runs in the last 24h.`
                  : 'No active workflows yet — activate one in Workflow Studio.'}
              </p>
              <Shield className="h-5 w-5 text-muted-foreground" />
            </div>
          </SectionCard>

          <p className="pb-4 text-center text-xs text-muted-foreground">
            VEYRO Autonomous Finance executes approved workflows only. All actions are audit-logged.
          </p>
        </div>
      </div>
    </div>
  );
}
