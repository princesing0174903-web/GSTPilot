'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Smart Reconciliation Page (Phase Delta · 4)
// AI-assisted matching with confidence scoring + review queue.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  GitCompareArrows, CheckCircle2, AlertCircle, Clock, FileWarning,
  Copy, Receipt, Sparkles, X,
} from 'lucide-react';
import {
  useFireInvoices, useFireBankTransactions, useFirePayments,
} from '@/hooks/use-firestore';
import {
  runSmartReconciliation, type ReconciliationMatch,
} from '@/lib/autonomous-finance/smart-reconciliation';
import { formatCurrency } from '@/lib/autonomous-finance/financial-intelligence';
import { ProfessionalEmptyState } from '@/components/shared/ProfessionalEmptyState';
import { TrustBar } from '@/components/shared/TrustBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const EASE = [0.16, 1, 0.3, 1] as const;

type Filter = 'all' | 'auto_approved' | 'needs_review' | 'unmatched' | 'flagged';

const STATUS_COLOR: Record<string, string> = {
  auto_approved: 'border-emerald-400/30 text-emerald-300',
  needs_review: 'border-amber-400/30 text-amber-300',
  rejected: 'border-rose-400/30 text-rose-300',
};

const FLAG_ICON: Record<string, React.ElementType> = {
  duplicate: Copy, tax_mismatch: FileWarning, amount_mismatch: AlertCircle,
  late_payment: Clock, missing_invoice: Receipt, unmatched: X,
};

export function SmartReconciliationPage() {
  const { data: invoices, loading: invLoading } = useFireInvoices();
  const { data: bankTx } = useFireBankTransactions();
  const { data: payments } = useFirePayments();
  const [filter, setFilter] = useState<Filter>('all');
  const [resolved, setResolved] = useState<Record<string, 'approved' | 'rejected'>>({});

  const report = useMemo(() => runSmartReconciliation({
    invoices: invoices as unknown as Array<Record<string, unknown>>,
    bankTransactions: bankTx as unknown as Array<Record<string, unknown>>,
    payments: payments as unknown as Array<Record<string, unknown>>,
  }), [invoices, bankTx, payments]);

  const filtered = useMemo(() => {
    return report.matches.filter((m) => {
      if (resolved[m.id]) return false;
      if (filter === 'all') return true;
      if (filter === 'auto_approved') return m.status === 'auto_approved';
      if (filter === 'needs_review') return m.status === 'needs_review';
      if (filter === 'unmatched') return m.flags.includes('unmatched') || m.flags.includes('missing_invoice');
      if (filter === 'flagged') return m.flags.length > 0;
      return true;
    });
  }, [report.matches, filter, resolved]);

  const stats = report.stats;
  const hasData = invoices.length > 0 || bankTx.length > 0;

  function resolve(id: string, decision: 'approved' | 'rejected') {
    setResolved((p) => ({ ...p, [id]: decision }));
    toast.success(decision === 'approved' ? 'Match approved' : 'Match rejected');
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground md:text-3xl">Smart Reconciliation</h1>
              <p className="mt-1 text-sm text-muted-foreground">AI-assisted matching with confidence scoring</p>
            </div>
            <TrustBar connected={hasData} connecting={invLoading} lastSync={report.generatedAt} />
          </div>

          {!hasData ? (
            <ProfessionalEmptyState
              icon={GitCompareArrows}
              title="Nothing to reconcile yet"
              description="Import invoices or connect a bank account to start AI-assisted reconciliation. The engine matches invoices to bank transactions and payments with confidence scoring, and auto-approves high-confidence matches."
              accent="cyan"
              action={{ label: 'Import invoices', onClick: () => toast.info('Navigate to Invoices → Import') }}
              secondaryAction={{ label: 'Connect bank', onClick: () => toast.info('Navigate to Banking → Connect') }}
            />
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {[
                  { label: 'Total', value: stats.total, icon: GitCompareArrows, accent: 'text-foreground' },
                  { label: 'Auto-Approved', value: stats.autoApproved, icon: CheckCircle2, accent: 'text-emerald-300' },
                  { label: 'Needs Review', value: stats.needsReview, icon: AlertCircle, accent: 'text-amber-300' },
                  { label: 'Unmatched', value: stats.unmatched + stats.missingInvoices, icon: X, accent: 'text-rose-300' },
                  { label: 'Matched Value', value: formatCurrency(report.totalMatchedValue), icon: Sparkles, accent: 'text-teal-300' },
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

              {/* Flag summary */}
              {(stats.duplicates > 0 || stats.taxMismatches > 0 || stats.amountMismatches > 0 || stats.latePayments > 0) && (
                <div className="flex flex-wrap gap-2">
                  {stats.duplicates > 0 && <Badge variant="outline" className="border-rose-400/30 text-rose-300">{stats.duplicates} duplicates</Badge>}
                  {stats.taxMismatches > 0 && <Badge variant="outline" className="border-amber-400/30 text-amber-300">{stats.taxMismatches} tax mismatches</Badge>}
                  {stats.amountMismatches > 0 && <Badge variant="outline" className="border-amber-400/30 text-amber-300">{stats.amountMismatches} amount mismatches</Badge>}
                  {stats.latePayments > 0 && <Badge variant="outline" className="border-violet-400/30 text-violet-300">{stats.latePayments} late payments</Badge>}
                  {stats.missingInvoices > 0 && <Badge variant="outline" className="border-rose-400/30 text-rose-300">{stats.missingInvoices} missing invoices</Badge>}
                </div>
              )}

              {/* Filter tabs */}
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'auto_approved', 'needs_review', 'unmatched', 'flagged'] as Filter[]).map((f) => (
                  <button key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                      filter === f ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:bg-white/5'
                    }`}>
                    {f.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>

              {/* Match list */}
              <div className="space-y-2">
                {filtered.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
                    <p className="mt-2 text-sm text-muted-foreground">All matches resolved for this filter.</p>
                  </div>
                ) : (
                  filtered.map((m: ReconciliationMatch, i) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease: EASE, delay: i * 0.02 }}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {m.invoiceNumber || '(missing invoice)'}
                            </span>
                            <Badge variant="outline" className={`text-[10px] ${STATUS_COLOR[m.status]}`}>{m.status.replace(/_/g, ' ')}</Badge>
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">{m.matchType}</Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{m.counterparty}</p>
                          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>Expected: <span className="text-foreground">{formatCurrency(m.expectedAmount)}</span></span>
                            {m.matchedAmount !== undefined && <span>Matched: <span className="text-foreground">{formatCurrency(m.matchedAmount)}</span></span>}
                            {m.matchedDate && <span>Date: <span className="text-foreground">{m.matchedDate.slice(0, 10)}</span></span>}
                          </div>
                          {/* Evidence + flags */}
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {m.evidence.slice(0, 3).map((ev, idx) => (
                              <span key={idx} className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] text-muted-foreground">{ev}</span>
                            ))}
                            {m.flags.map((fl) => {
                              const FIcon = FLAG_ICON[fl] ?? AlertCircle;
                              return <span key={fl} className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300"><FIcon className="h-2.5 w-2.5" /> {fl.replace(/_/g, ' ')}</span>;
                            })}
                          </div>
                        </div>

                        {/* Confidence + actions */}
                        <div className="flex items-center gap-3">
                          <div className="text-center">
                            <div className="relative h-10 w-10">
                              <svg className="h-10 w-10 -rotate-90" viewBox="0 0 40 40">
                                <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3" className="text-white/[0.06]" />
                                <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                                  className={m.confidence >= 0.9 ? 'text-emerald-400' : m.confidence >= 0.75 ? 'text-amber-400' : 'text-rose-400'}
                                  strokeDasharray={2 * Math.PI * 16}
                                  strokeDashoffset={2 * Math.PI * 16 * (1 - m.confidence)} />
                              </svg>
                              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-foreground">{Math.round(m.confidence * 100)}</span>
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            {m.status === 'needs_review' && (
                              <>
                                <Button size="sm" variant="outline" className="h-7 border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/10" onClick={() => resolve(m.id, 'approved')}>
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 border-rose-400/30 text-rose-300 hover:bg-rose-500/10" onClick={() => resolve(m.id, 'rejected')}>
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
