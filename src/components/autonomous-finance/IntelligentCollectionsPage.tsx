'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Intelligent Collections Page (Phase Delta · 6)
// AI-scored customer payment behavior with smart escalation + analytics.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Clock, AlertTriangle, TrendingUp, Bell, TrendingDown,
} from 'lucide-react';
import {
  useFireInvoices, useFireClients, useFirePayments,
} from '@/hooks/use-firestore';
import {
  computeIntelligentCollections, ESCALATION_LADDER,
  type CustomerPaymentScore,
} from '@/lib/autonomous-finance/intelligent-collections';
import { formatCurrency } from '@/lib/autonomous-finance/financial-intelligence';
import { ProfessionalEmptyState } from '@/components/shared/ProfessionalEmptyState';
import { TrustBar } from '@/components/shared/TrustBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const EASE = [0.16, 1, 0.3, 1] as const;

const TIER_COLOR: Record<string, string> = {
  excellent: 'border-emerald-400/30 text-emerald-300',
  good: 'border-cyan-400/30 text-cyan-300',
  'at-risk': 'border-amber-400/30 text-amber-300',
  critical: 'border-rose-400/30 text-rose-300',
};
const TIER_RING: Record<string, string> = {
  excellent: 'text-emerald-400', good: 'text-cyan-400',
  'at-risk': 'text-amber-400', critical: 'text-rose-400',
};
const AGE_COLOR = ['text-emerald-400', 'text-amber-400', 'text-orange-400', 'text-rose-400'];

export function IntelligentCollectionsPage() {
  const { data: invoices, loading: invLoading } = useFireInvoices();
  const { data: clients } = useFireClients();
  const { data: payments } = useFirePayments();

  const report = useMemo(() => computeIntelligentCollections({
    invoices: invoices as unknown as Array<Record<string, unknown>>,
    clients: clients as unknown as Array<Record<string, unknown>>,
    payments: payments as unknown as Array<Record<string, unknown>>,
  }), [invoices, clients, payments]);

  const hasData = invoices.length > 0;
  const a = report.analytics;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground md:text-3xl">Intelligent Collections</h1>
              <p className="mt-1 text-sm text-muted-foreground">AI-scored customer payment behavior with smart escalation</p>
            </div>
            <TrustBar connected={hasData} connecting={invLoading} lastSync={report.generatedAt} activityCount={report.scores.length} />
          </div>

          {!hasData ? (
            <ProfessionalEmptyState
              icon={Users}
              title="No invoices to collect"
              description="Create invoices to unlock intelligent collections — customer payment scoring, predicted pay dates, smart escalation ladders, and collection effectiveness analytics."
              accent="rose"
              action={{ label: 'Create invoice', onClick: () => toast.info('Navigate to Invoices → New') }}
            />
          ) : (
            <>
              {/* Analytics row */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  { label: 'Total Outstanding', value: formatCurrency(a.totalOutstanding), icon: Users, accent: 'text-amber-300' },
                  { label: 'Total Overdue', value: formatCurrency(a.totalOverdue), icon: AlertTriangle, accent: 'text-rose-300' },
                  { label: 'Avg Days to Pay', value: `${a.avgDaysToPayOverall}d`, icon: Clock, accent: 'text-cyan-300' },
                  { label: 'Collection Effectiveness', value: `${a.collectionEffectiveness}%`, icon: TrendingUp, accent: 'text-emerald-300' },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center gap-2">
                      <s.icon className={`h-3.5 w-3.5 ${s.accent}`} />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</span>
                    </div>
                    <p className={`mt-1 text-xl font-semibold ${s.accent}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Age bucket bar chart */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Overdue Aging</h3>
                <div className="space-y-2">
                  {(['0-30', '31-60', '61-90', '90+'] as const).map((bucket, i) => {
                    const val = a.byAgeBucket[bucket];
                    const max = Math.max(...Object.values(a.byAgeBucket), 1);
                    const pct = (val / max) * 100;
                    return (
                      <div key={bucket} className="flex items-center gap-3">
                        <span className="w-14 text-xs text-muted-foreground">{bucket} days</span>
                        <div className="h-6 flex-1 overflow-hidden rounded-md bg-white/[0.02]">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, ease: EASE, delay: i * 0.1 }}
                            className={`h-full rounded-md ${AGE_COLOR[i].replace('text-', 'bg-')}`}
                          />
                        </div>
                        <span className={`w-20 text-right text-xs font-medium ${AGE_COLOR[i]}`}>{formatCurrency(val)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tier distribution */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {(['excellent', 'good', 'at-risk', 'critical'] as const).map((tier) => (
                  <div key={tier} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <Badge variant="outline" className={`text-[10px] capitalize ${TIER_COLOR[tier]}`}>{tier.replace('-', ' ')}</Badge>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{a.byTier[tier].count}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(a.byTier[tier].amount)}</p>
                  </div>
                ))}
              </div>

              {/* Customer scorecards */}
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Customer Scorecards ({report.scores.length})</h2>
                {report.scores.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
                    <p className="text-sm text-muted-foreground">No outstanding invoices — all customers are current.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {report.scores.map((s: CustomerPaymentScore, i) => (
                      <motion.div
                        key={s.clientId}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: EASE, delay: i * 0.02 }}
                        className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-3">
                            {/* Score ring */}
                            <div className="relative h-12 w-12">
                              <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48">
                                <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="3" className="text-white/[0.06]" />
                                <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                                  className={TIER_RING[s.tier]}
                                  strokeDasharray={2 * Math.PI * 20}
                                  strokeDashoffset={2 * Math.PI * 20 * (1 - s.score / 100)} />
                              </svg>
                              <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-foreground">{s.score}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">{s.clientName}</p>
                              <div className="mt-0.5 flex flex-wrap gap-1.5">
                                <Badge variant="outline" className={`text-[10px] capitalize ${TIER_COLOR[s.tier]}`}>{s.tier.replace('-', ' ')}</Badge>
                                <Badge variant="outline" className="text-[10px] text-muted-foreground">Lvl {s.escalationLevel}</Badge>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs md:flex md:gap-4">
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground">Outstanding</p>
                              <p className="font-medium text-amber-300">{formatCurrency(s.totalOutstanding)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground">Overdue</p>
                              <p className="font-medium text-rose-300">{formatCurrency(s.overdueAmount)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground">Avg Days</p>
                              <p className="font-medium text-cyan-300">{s.avgDaysToPay}d</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground">Oldest</p>
                              <p className="font-medium text-cyan-300">{s.oldestOverdueDays}d</p>
                            </div>
                          </div>

                          <Button size="sm" variant="outline" className="border-cyan-400/30 text-cyan-300 hover:bg-cyan-500/10"
                            onClick={() => toast.success(`Reminder queued for ${s.clientName}`)}>
                            <Bell className="mr-1.5 h-3.5 w-3.5" /> Remind
                          </Button>
                        </div>
                        {s.escalationLevel > 0 && (
                          <p className="mt-2 text-xs text-amber-300">→ {s.recommendedAction}</p>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Escalation ladder */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <TrendingDown className="h-4 w-4 text-cyan-300" /> Escalation Ladder
                </h3>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
                  {ESCALATION_LADDER.map((step) => (
                    <div key={step.level} className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-3">
                      <Badge variant="outline" className="text-[10px] text-cyan-300">Level {step.level}</Badge>
                      <p className="mt-1.5 text-xs font-medium text-foreground">{step.action}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{step.triggerDays}d overdue · {step.channel}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
