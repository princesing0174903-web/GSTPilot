'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Smart Reconciliation Page (Prisma-backed · ARCHITECTURE FIX)
//
// ROOT CAUSE (previously):
//   This page imported `useFireInvoices` / `useFireBankTransactions` /
//   `useFirePayments` from `@/hooks/use-firestore`. Those hooks attach
//   Firebase Firestore `onSnapshot` listeners to the `invoices`,
//   `bank_transactions`, and `payments` collections. The Firestore security
//   rules require `organization_members/{orgId}_{uid}` to exist for every
//   tenant-scoped read. In the sandbox / preview environment there is no
//   real Firebase Auth session and no membership document, so Firestore
//   rejects every read with:
//
//        "Missing or insufficient permissions."
//
// PERMANENT FIX:
//   The entire reconciliation pipeline has been migrated to Prisma + SQLite,
//   matching the architecture already used for Clients and Invoices:
//
//     • Data  → useBankingApi()  → /api/banking/reconcile   (Prisma)
//              useInvoicesApi() → /api/invoices             (Prisma)
//              fetchTransactions → /api/banking/transactions(Prisma)
//     • Engine → runReconciliation(orgId) runs SERVER-SIDE in
//               src/lib/banking-prisma/reconciliation.ts and persists
//               BankReconciliation rows + updates BankTransaction flags.
//     • Actions → approve / reject / manualMatch hit real REST endpoints
//                that write audit logs and update transaction state.
//
//   No Firestore call is made from this page. The "Missing or insufficient
//   permissions" error is eliminated permanently.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  GitCompareArrows, CheckCircle2, AlertCircle, Clock, FileWarning,
  Copy, Receipt, Sparkles, X, Zap, RefreshCw, ShieldAlert,
  TrendingUp, TrendingDown, Banknote,
} from 'lucide-react';
import { useBankingApi } from '@/hooks/useBankingApi';
import { useInvoicesApi, type ApiInvoice } from '@/hooks/useInvoicesApi';
import type {
  BankReconciliationRecord,
  ReconciliationSummary,
  BankingTransaction,
} from '@/lib/banking-prisma/types';
import { formatCurrency } from '@/lib/autonomous-finance/financial-intelligence';
import { ProfessionalEmptyState } from '@/components/shared/ProfessionalEmptyState';
import { TrustBar } from '@/components/shared/TrustBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const EASE = [0.16, 1, 0.3, 1] as const;

type Filter = 'all' | 'approved' | 'pending' | 'unmatched' | 'flagged';

// ─── Display maps ────────────────────────────────────────────────────────────

const MATCH_TYPE_LABEL: Record<string, string> = {
  exact: 'Exact Match',
  partial: 'Partial Match',
  duplicate: 'Duplicate',
  overpayment: 'Overpayment',
  underpayment: 'Underpayment',
  missing: 'Missing Invoice',
  suspicious: 'Suspicious',
};

const MATCH_TYPE_COLOR: Record<string, string> = {
  exact: 'border-emerald-400/30 text-emerald-300',
  partial: 'border-sky-400/30 text-sky-300',
  duplicate: 'border-rose-400/30 text-rose-300',
  overpayment: 'border-amber-400/30 text-amber-300',
  underpayment: 'border-amber-400/30 text-amber-300',
  missing: 'border-violet-400/30 text-violet-300',
  suspicious: 'border-rose-400/30 text-rose-300',
};

const STATUS_COLOR: Record<string, string> = {
  approved: 'border-emerald-400/30 text-emerald-300',
  pending: 'border-amber-400/30 text-amber-300',
  rejected: 'border-rose-400/30 text-rose-300',
};

const FLAG_ICON: Record<string, React.ElementType> = {
  duplicate: Copy,
  overpayment: TrendingUp,
  underpayment: TrendingDown,
  missing: Receipt,
  suspicious: ShieldAlert,
  late_payment: Clock,
  amount_mismatch: AlertCircle,
  tax_mismatch: FileWarning,
  unmatched: X,
};

function confidenceTone(c: number): string {
  if (c >= 0.9) return 'text-emerald-400';
  if (c >= 0.75) return 'text-amber-400';
  return 'text-rose-400';
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SmartReconciliationPage() {
  const api = useBankingApi();
  const { invoices, loading: invLoading } = useInvoicesApi();

  const [records, setRecords] = useState<BankReconciliationRecord[]>([]);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [transactions, setTransactions] = useState<BankingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [lastRun, setLastRun] = useState<string | null>(null);

  // ── Load reconciliation data + transactions (for enrichment) ──
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reconData, txnData] = await Promise.all([
        api.fetchReconciliationSummary(),
        api.fetchTransactions({ limit: 500 }).catch(() => ({
          transactions: [] as BankingTransaction[],
          total: 0,
          totalInflow: 0,
          totalOutflow: 0,
          netFlow: 0,
          hasLiveData: false,
        })),
      ]);
      setRecords(reconData.records);
      setSummary(reconData.summary);
      setTransactions(txnData.transactions);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'We could not load your reconciliation data. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ── Run reconciliation (server-side engine) ──
  const handleRun = useCallback(async () => {
    setRunning(true);
    try {
      const result = await api.runReconciliation();
      setRecords(result.matched);
      setSummary(result.summary);
      setLastRun(new Date().toISOString());
      // Refresh the full dataset so summary + enriched lookups are fresh.
      await loadData();
      const count = result.matched.length;
      toast.success(
        count > 0
          ? `Reconciliation complete — ${count} match${count === 1 ? '' : 'es'} found.`
          : 'Reconciliation complete — no new matches. All transactions are already reconciled or unmatched.',
      );
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Reconciliation failed. Please try again.',
      );
    } finally {
      setRunning(false);
    }
  }, [api, loadData]);

  // ── Approve a match ──
  const handleApprove = useCallback(
    async (id: string) => {
      // Optimistic: mark locally so the UI feels instant.
      setRecords((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'approved' as const } : r)),
      );
      try {
        await api.approveReconciliation(id);
        toast.success('Match approved — transaction marked as reconciled.');
        // Refresh summary so the stats update.
        const reconData = await api.fetchReconciliationSummary();
        setSummary(reconData.summary);
        setRecords(reconData.records);
      } catch (err) {
        // Roll back.
        setRecords((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: 'pending' as const } : r)),
        );
        toast.error(
          err instanceof Error ? err.message : 'Failed to approve. Please try again.',
        );
      }
    },
    [api],
  );

  // ── Reject a match ──
  const handleReject = useCallback(
    async (id: string) => {
      setRecords((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'rejected' as const } : r)),
      );
      try {
        await api.rejectReconciliation(id, 'Rejected by reviewer');
        toast.success('Match rejected — transaction returned to unmatched pool.');
        const reconData = await api.fetchReconciliationSummary();
        setSummary(reconData.summary);
        setRecords(reconData.records);
      } catch (err) {
        setRecords((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: 'pending' as const } : r)),
        );
        toast.error(
          err instanceof Error ? err.message : 'Failed to reject. Please try again.',
        );
      }
    },
    [api],
  );

  // ── Enrichment lookups ──
  const invoiceMap = useMemo(() => {
    const m = new Map<string, ApiInvoice>();
    for (const inv of invoices) m.set(inv.id, inv);
    return m;
  }, [invoices]);

  const txnMap = useMemo(() => {
    const m = new Map<string, BankingTransaction>();
    for (const t of transactions) m.set(t.id, t);
    return m;
  }, [transactions]);

  // ── Filtering ──
  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (filter === 'all') return true;
      if (filter === 'approved') return r.status === 'approved';
      if (filter === 'pending') return r.status === 'pending';
      if (filter === 'unmatched')
        return r.matchType === 'missing' || r.matchType === 'suspicious';
      if (filter === 'flagged')
        return ['duplicate', 'overpayment', 'underpayment', 'suspicious'].includes(
          r.matchType,
        );
      return true;
    });
  }, [records, filter]);

  const hasBankData = transactions.length > 0;
  const hasInvoiceData = invoices.length > 0;
  const hasAnyData = hasBankData || hasInvoiceData;
  const showEmptyState = !loading && !hasAnyData;

  // ── Render: premium loading skeleton ──
  if (loading && records.length === 0) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96" />
              </div>
              <Skeleton className="h-9 w-40 rounded-md" />
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: error state ──
  if (error && records.length === 0) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-7xl">
            <div className="rounded-xl border border-rose-400/20 bg-rose-500/5 p-8 text-center">
              <AlertCircle className="mx-auto h-10 w-10 text-rose-400" />
              <h2 className="mt-3 text-lg font-semibold text-foreground">
                We could not load your reconciliation data
              </h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                {error}
              </p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => void loadData()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: empty state (no bank transactions or invoices) ──
  if (showEmptyState) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground md:text-3xl">
                Smart Reconciliation
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                AI-assisted matching with confidence scoring
              </p>
            </div>
            <ProfessionalEmptyState
              icon={GitCompareArrows}
              title="Nothing to reconcile yet"
              description="Import bank transactions or create invoices to start AI-assisted reconciliation. The engine matches bank credits to open invoices with confidence scoring, detects duplicates and overpayments, and auto-approves exact matches."
              accent="cyan"
              action={{
                label: 'Go to Banking',
                onClick: () => toast.info('Navigate to Banking to import a statement'),
              }}
              secondaryAction={{
                label: 'Create invoice',
                onClick: () => toast.info('Navigate to Invoices to create one'),
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Render: main view ──
  const stats = summary;
  const pendingCount = records.filter((r) => r.status === 'pending').length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground md:text-3xl">
                Smart Reconciliation
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                AI-assisted matching with confidence scoring
              </p>
            </div>
            <div className="flex items-center gap-2">
              <TrustBar
                connected={hasAnyData}
                connecting={loading || invLoading}
                lastSync={lastRun ? new Date(lastRun) : undefined}
              />
              <Button
                onClick={() => void handleRun()}
                disabled={running || !hasAnyData}
                className="gap-2"
              >
                {running ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                {running ? 'Running…' : 'Run Reconciliation'}
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              {
                label: 'Total Transactions',
                value: stats?.total ?? 0,
                icon: GitCompareArrows,
                accent: 'text-foreground',
              },
              {
                label: 'Matched',
                value: (stats?.matched ?? 0) + (stats?.partiallyMatched ?? 0),
                icon: CheckCircle2,
                accent: 'text-emerald-300',
              },
              {
                label: 'Needs Review',
                value: pendingCount,
                icon: AlertCircle,
                accent: 'text-amber-300',
              },
              {
                label: 'Unmatched',
                value: stats?.unmatched ?? 0,
                icon: X,
                accent: 'text-rose-300',
              },
              {
                label: 'Matched Value',
                value: formatCurrency(stats?.totalMatchedAmount ?? 0),
                icon: Sparkles,
                accent: 'text-teal-300',
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <div className="flex items-center gap-2">
                  <s.icon className={`h-3.5 w-3.5 ${s.accent}`} />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </span>
                </div>
                <p className={`mt-1 text-xl font-semibold ${s.accent}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Reconciliation rate + secondary stats */}
          {stats && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-sky-300" />
                <span className="text-sm text-muted-foreground">Reconciliation rate</span>
                <span className="text-sm font-semibold text-foreground">
                  {stats.reconciliationRate}%
                </span>
              </div>
              <div className="h-4 w-px bg-white/10" />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Unmatched value</span>
                <span className="text-sm font-semibold text-rose-300">
                  {formatCurrency(stats.totalUnmatchedAmount)}
                </span>
              </div>
              {stats.duplicate > 0 && (
                <>
                  <div className="h-4 w-px bg-white/10" />
                  <Badge variant="outline" className="border-rose-400/30 text-rose-300">
                    {stats.duplicate} duplicates
                  </Badge>
                </>
              )}
              {stats.overpayment > 0 && (
                <Badge variant="outline" className="border-amber-400/30 text-amber-300">
                  {stats.overpayment} overpayments
                </Badge>
              )}
              {stats.underpayment > 0 && (
                <Badge variant="outline" className="border-amber-400/30 text-amber-300">
                  {stats.underpayment} underpayments
                </Badge>
              )}
              {stats.suspicious > 0 && (
                <Badge variant="outline" className="border-rose-400/30 text-rose-300">
                  {stats.suspicious} suspicious
                </Badge>
              )}
              {stats.missing > 0 && (
                <Badge variant="outline" className="border-violet-400/30 text-violet-300">
                  {stats.missing} missing invoices
                </Badge>
              )}
            </div>
          )}

          {/* No records yet (data exists but reconciliation hasn't run) */}
          {records.length === 0 && hasAnyData ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10">
                <Zap className="h-6 w-6 text-cyan-300" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-foreground">
                Ready to reconcile
              </h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                You have {transactions.length} bank transaction
                {transactions.length === 1 ? '' : 's'} and {invoices.length} invoice
                {invoices.length === 1 ? '' : 's'}. Run the reconciliation engine to
                match them automatically.
              </p>
              <Button
                className="mt-4 gap-2"
                onClick={() => void handleRun()}
                disabled={running}
              >
                {running ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                {running ? 'Running…' : 'Run Reconciliation Now'}
              </Button>
            </div>
          ) : (
            <>
              {/* Filter tabs */}
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    'all',
                    'pending',
                    'approved',
                    'unmatched',
                    'flagged',
                  ] as Filter[]
                ).map((f) => {
                  const count =
                    f === 'all'
                      ? records.length
                      : f === 'approved'
                        ? records.filter((r) => r.status === 'approved').length
                        : f === 'pending'
                          ? records.filter((r) => r.status === 'pending').length
                          : f === 'unmatched'
                            ? records.filter(
                                (r) =>
                                  r.matchType === 'missing' ||
                                  r.matchType === 'suspicious',
                              ).length
                            : records.filter((r) =>
                                [
                                  'duplicate',
                                  'overpayment',
                                  'underpayment',
                                  'suspicious',
                                ].includes(r.matchType),
                              ).length;
                  return (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                        filter === f
                          ? 'bg-white/10 text-foreground'
                          : 'text-muted-foreground hover:bg-white/5'
                      }`}
                    >
                      {f.replace(/_/g, ' ')}
                      {count > 0 && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Match list */}
              <div className="space-y-2">
                {filtered.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      No matches in this filter.
                    </p>
                  </div>
                ) : (
                  filtered.map((rec, i) => {
                    const inv = rec.invoiceId
                      ? invoiceMap.get(rec.invoiceId)
                      : undefined;
                    const txn = txnMap.get(rec.transactionId);
                    const invoiceNumber = inv?.invoiceNumber ?? '(unknown invoice)';
                    const counterparty =
                      txn?.counterparty ||
                      inv?.buyerName ||
                      txn?.description ||
                      'Unknown';
                    const expected = rec.expectedAmount ?? inv?.totalAmount ?? 0;
                    const actual = rec.actualAmount ?? 0;
                    const diff = rec.difference ?? 0;
                    const matchedDate = txn?.date ?? rec.matchedAt;
                    const flags: string[] = [];
                    if (rec.matchType === 'duplicate') flags.push('duplicate');
                    if (rec.matchType === 'overpayment') flags.push('overpayment');
                    if (rec.matchType === 'underpayment') flags.push('underpayment');
                    if (rec.matchType === 'suspicious') flags.push('suspicious');
                    if (rec.matchType === 'missing') flags.push('missing_invoice');
                    if (Math.abs(diff) > 0.01 && rec.matchType !== 'missing')
                      flags.push('amount_mismatch');

                    return (
                      <motion.div
                        key={rec.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: EASE, delay: i * 0.02 }}
                        className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          {/* Left: identity + amounts */}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-foreground">
                                {invoiceNumber}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${MATCH_TYPE_COLOR[rec.matchType] ?? 'text-muted-foreground'}`}
                              >
                                {MATCH_TYPE_LABEL[rec.matchType] ?? rec.matchType}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${STATUS_COLOR[rec.status] ?? 'text-muted-foreground'}`}
                              >
                                {rec.status}
                              </Badge>
                              {rec.matchedBy === 'manual' && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] text-sky-300"
                                >
                                  manual
                                </Badge>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {counterparty}
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <span>
                                Expected:{' '}
                                <span className="text-foreground">
                                  {formatCurrency(expected)}
                                </span>
                              </span>
                              {actual > 0 && (
                                <span>
                                  Received:{' '}
                                  <span className="text-foreground">
                                    {formatCurrency(actual)}
                                  </span>
                                </span>
                              )}
                              {Math.abs(diff) > 0.01 && (
                                <span
                                  className={
                                    diff > 0 ? 'text-amber-300' : 'text-rose-300'
                                  }
                                >
                                  Diff: {diff > 0 ? '+' : ''}
                                  {formatCurrency(diff)}
                                </span>
                              )}
                              {matchedDate && (
                                <span>
                                  Date:{' '}
                                  <span className="text-foreground">
                                    {String(matchedDate).slice(0, 10)}
                                  </span>
                                </span>
                              )}
                              {rec.matchedAt && (
                                <span className="text-muted-foreground/70">
                                  matched {timeAgo(rec.matchedAt)}
                                </span>
                              )}
                            </div>
                            {/* Evidence / notes */}
                            {(rec.notes || flags.length > 0) && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {rec.notes && (
                                  <span className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] text-muted-foreground">
                                    {rec.notes}
                                  </span>
                                )}
                                {flags.map((fl) => {
                                  const FIcon = FLAG_ICON[fl] ?? AlertCircle;
                                  return (
                                    <span
                                      key={fl}
                                      className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300"
                                    >
                                      <FIcon className="h-2.5 w-2.5" />{' '}
                                      {fl.replace(/_/g, ' ')}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Right: confidence + actions */}
                          <div className="flex items-center gap-3">
                            <div className="text-center">
                              <div className="relative h-10 w-10">
                                <svg
                                  className="h-10 w-10 -rotate-90"
                                  viewBox="0 0 40 40"
                                >
                                  <circle
                                    cx="20"
                                    cy="20"
                                    r="16"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    className="text-white/[0.06]"
                                  />
                                  <circle
                                    cx="20"
                                    cy="20"
                                    r="16"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    className={confidenceTone(rec.confidence)}
                                    strokeDasharray={2 * Math.PI * 16}
                                    strokeDashoffset={
                                      2 * Math.PI * 16 * (1 - rec.confidence)
                                    }
                                  />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-foreground">
                                  {Math.round(rec.confidence * 100)}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-1.5">
                              {rec.status === 'pending' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/10"
                                    onClick={() => void handleApprove(rec.id)}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 border-rose-400/30 text-rose-300 hover:bg-rose-500/10"
                                    onClick={() => void handleReject(rec.id)}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                              {rec.status === 'approved' && (
                                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                              )}
                              {rec.status === 'rejected' && (
                                <X className="h-5 w-5 text-rose-400/60" />
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
