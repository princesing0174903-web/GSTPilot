'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  AlertCircle,
  CircleSlash,
  Lightbulb,
  RefreshCw,
  Sparkles,
  Search,
  Link2,
  ArrowLeftRight,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProfessionalEmptyState } from '@/components/shared';
import { toast } from 'sonner';
import {
  useFetch,
  apiPost,
  fmtINR,
  fmtINRFull,
  fmtDate,
  RECONCILE_STATUS_META,
  SCROLLBAR_CLASS,
} from './helpers';
import type {
  ReconcileSummary,
  ReconcileResult,
  ReconcileCandidate,
  BankingTransaction,
} from '@/lib/banking-service/types';

interface SummaryResponse {
  ok: boolean;
  summary: ReconcileSummary;
}
interface ResultsResponse {
  ok: boolean;
  results: ReconcileResult[];
}
interface TxMapResponse {
  ok: boolean;
  rows: BankingTransaction[];
}

type FilterKind = 'all' | 'matched' | 'partial' | 'suggested' | 'unmatched';

// ─── Summary cards ────────────────────────────────────────────────────────────

function SummaryCards({ summary }: { summary: ReconcileSummary }) {
  const cards: Array<{
    key: FilterKind;
    label: string;
    value: number;
    color: string;
    bg: string;
    icon: typeof CheckCircle2;
  }> = [
    { key: 'matched', label: 'Matched', value: summary.matched, color: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-100 dark:bg-emerald-500/15', icon: CheckCircle2 },
    { key: 'partial', label: 'Partial', value: summary.partial, color: 'text-amber-600 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-500/15', icon: AlertCircle },
    { key: 'suggested', label: 'Suggested', value: summary.suggested, color: 'text-sky-600 dark:text-sky-300', bg: 'bg-sky-100 dark:bg-sky-500/15', icon: Lightbulb },
    { key: 'unmatched', label: 'Unmatched', value: summary.unmatched, color: 'text-muted-foreground', bg: 'bg-muted', icon: CircleSlash },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.key}>
            <CardContent className="space-y-2 py-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
                <span className={`flex h-7 w-7 items-center justify-center rounded-md ${c.bg}`}>
                  <Icon className={`h-4 w-4 ${c.color}`} />
                </span>
              </div>
              <div className="text-2xl font-semibold tracking-tight">{c.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Reconciled ring ──────────────────────────────────────────────────────────

function ReconcileRing({ pct }: { pct: number }) {
  const r = 32;
  const c = 2 * Math.PI * r;
  const dash = c - (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label={`${pct.toFixed(0)}% reconciled`}>
      <circle cx="42" cy="42" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted-foreground/15" />
      <circle
        cx="42"
        cy="42"
        r={r}
        fill="none"
        stroke="#10b981"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={dash}
        transform="rotate(-90 42 42)"
      />
      <text x="42" y="40" textAnchor="middle" className="fill-emerald-600 dark:fill-emerald-300 text-sm font-bold">{pct.toFixed(0)}%</text>
      <text x="42" y="54" textAnchor="middle" className="fill-muted-foreground text-[8px]">Reconciled</text>
    </svg>
  );
}

// ─── Candidate row ────────────────────────────────────────────────────────────

function CandidateRow({
  candidate,
  onConfirm,
  confirming,
}: {
  candidate: ReconcileCandidate;
  onConfirm: () => void;
  confirming: boolean;
}) {
  const pct = Math.round(candidate.confidence * 100);
  return (
    <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-2">
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium">{candidate.label}</span>
          <Badge variant="outline" className="text-[10px] capitalize">{candidate.kind}</Badge>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>{fmtDate(candidate.date)}</span>
          <span>·</span>
          <span>{fmtINRFull(candidate.amount)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Progress value={pct} className="h-1 w-16" />
          <span className="text-[10px] text-muted-foreground">{pct}%</span>
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onConfirm} loading={confirming}>
        Confirm
      </Button>
    </div>
  );
}

// ─── Result card ──────────────────────────────────────────────────────────────

function ResultCard({
  result,
  tx,
  onMark,
  onManual,
  confirmingId,
}: {
  result: ReconcileResult;
  tx?: BankingTransaction;
  onMark: (transactionId: string, candidate: ReconcileCandidate) => void;
  onManual: (transactionId: string) => void;
  confirmingId: string | null;
}) {
  const meta = RECONCILE_STATUS_META[result.status] ?? RECONCILE_STATUS_META.unmatched;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-1">
              {tx ? (
                <>
                  <div className="text-sm font-medium">{tx.description}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{fmtDate(tx.date)}</span>
                    <span>·</span>
                    <span className={tx.type === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                      {tx.type === 'credit' ? '+' : '−'}{fmtINRFull(tx.amount)}
                    </span>
                    {tx.counterparty && (
                      <>
                        <span>·</span>
                        <span>{tx.counterparty}</span>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-sm font-medium">{result.transactionId}</div>
              )}
              {result.reason && (
                <p className="text-[11px] italic text-muted-foreground">{result.reason}</p>
              )}
            </div>
            <Badge variant="outline" className={meta.color}>{meta.label}</Badge>
          </div>

          {(result.status === 'matched' || result.status === 'suggested' || result.status === 'partial') && result.candidates.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {result.status === 'partial' ? 'Candidates (pick one)' : 'Best match'}
              </div>
              {result.candidates.slice(0, result.status === 'partial' ? 5 : 1).map((c, i) => (
                <CandidateRow
                  key={i}
                  candidate={c}
                  onConfirm={() => onMark(result.transactionId, c)}
                  confirming={confirmingId === result.transactionId}
                />
              ))}
            </div>
          )}

          {result.status === 'unmatched' && (
            <div className="flex items-center justify-between rounded-md border border-dashed bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">No matching invoice/payment found.</p>
              <Button size="sm" variant="ghost" onClick={() => onManual(result.transactionId)}>
                <Search className="h-3.5 w-3.5" /> Find Manually
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Manual find dialog ───────────────────────────────────────────────────────

function ManualFindDialog({
  transactionId,
  open,
  onOpenChange,
  onSaved,
}: {
  transactionId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [candidateId, setCandidateId] = React.useState('');
  const [candidateKind, setCandidateKind] = React.useState('invoice');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setCandidateId('');
      setCandidateKind('invoice');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!transactionId || !candidateId.trim()) return;
    setSaving(true);
    try {
      await apiPost('/api/banking-intel/reconcile/mark', {
        transactionId,
        candidateId: candidateId.trim(),
        candidateKind,
      });
      toast.success('Marked as reconciled');
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Mark failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-emerald-500" />
            Link Manually
          </DialogTitle>
          <DialogDescription>
            Enter the invoice / payment / expense id to link this transaction to.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cid">Candidate ID</Label>
            <Input id="cid" placeholder="inv-001" value={candidateId} onChange={(e) => setCandidateId(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Candidate kind</Label>
            <Select value={candidateKind} onValueChange={setCandidateKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="invoice">Invoice</SelectItem>
                <SelectItem value="payment">Payment</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="refund">Refund</SelectItem>
                <SelectItem value="receipt">Receipt</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Link</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ReconcileSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-xl" />
      ))}
    </div>
  );
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

export function ReconciliationTab() {
  const { data: summaryData, loading: summaryLoading, error: summaryError, refetch: refetchSummary } =
    useFetch<SummaryResponse>('/api/banking-intel/reconcile');

  const [results, setResults] = React.useState<ReconcileResult[] | null>(null);
  const [resultsLoading, setResultsLoading] = React.useState(false);
  const [resultsError, setResultsError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<FilterKind>('all');
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);
  const [manualOpen, setManualOpen] = React.useState(false);
  const [manualTxId, setManualTxId] = React.useState<string | null>(null);

  // Fetch all transactions (to enrich result cards with description/amount)
  const txRes = useFetch<TxMapResponse>('/api/banking-intel/transactions?limit=500');
  const txMap = React.useMemo(() => {
    const m = new Map<string, BankingTransaction>();
    (txRes.data?.rows ?? []).forEach((t) => m.set(t.id, t));
    return m;
  }, [txRes.data]);

  const summary = summaryData?.summary;

  const runAuto = async () => {
    setResultsLoading(true);
    setResultsError(null);
    try {
      const res = await apiPost<ResultsResponse>('/api/banking-intel/reconcile', {});
      setResults(res.results);
      toast.success(`Reconciled ${res.results.length} transaction${res.results.length === 1 ? '' : 's'}`);
      refetchSummary();
      txRes.refetch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Reconcile failed';
      setResultsError(msg);
      toast.error(msg);
    } finally {
      setResultsLoading(false);
    }
  };

  const handleMark = async (transactionId: string, candidate: ReconcileCandidate) => {
    setConfirmingId(transactionId);
    try {
      await apiPost('/api/banking-intel/reconcile/mark', {
        transactionId,
        candidateId: candidate.id,
        candidateKind: candidate.kind,
      });
      toast.success('Match confirmed');
      // Remove the confirmed result from the list
      setResults((prev) => prev?.filter((r) => r.transactionId !== transactionId) ?? null);
      refetchSummary();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Confirm failed');
    } finally {
      setConfirmingId(null);
    }
  };

  const handleManual = (transactionId: string) => {
    setManualTxId(transactionId);
    setManualOpen(true);
  };

  const filteredResults = React.useMemo(() => {
    if (!results) return [];
    if (filter === 'all') return results;
    return results.filter((r) => r.status === filter);
  }, [results, filter]);

  if (summaryLoading) return <ReconcileSkeleton />;

  if (summaryError || !summary) {
    return (
      <Card>
        <CardContent className="py-10">
          <ProfessionalEmptyState
            icon={AlertCircle}
            title="Couldn't load reconciliation summary"
            description={summaryError || 'Unknown error'}
            accent="rose"
            action={{ label: 'Retry', onClick: refetchSummary, icon: RefreshCw }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ─── Summary ─── */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-4">
            <ReconcileRing pct={summary.reconciledPct} />
            <div>
              <div className="text-sm font-medium">Reconciliation progress</div>
              <div className="text-xs text-muted-foreground">
                {summary.matched + summary.partial + summary.suggested} of {summary.total} transactions reviewed
              </div>
            </div>
          </div>
          <Button onClick={runAuto} loading={resultsLoading}>
            {!resultsLoading && <Sparkles className="h-4 w-4 text-violet-300" />}
            Run Auto-Reconciliation
          </Button>
        </CardContent>
      </Card>

      <SummaryCards summary={summary} />

      {/* ─── Filter chips ─── */}
      {results && (
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'matched', 'partial', 'suggested', 'unmatched'] as FilterKind[]).map((k) => {
            const count = k === 'all' ? results.length : results.filter((r) => r.status === k).length;
            const active = filter === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${
                  active
                    ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {k} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* ─── Results ─── */}
      {resultsError && (
        <Card>
          <CardContent className="py-8">
            <ProfessionalEmptyState
              icon={AlertCircle}
              title="Reconcile failed"
              description={resultsError}
              accent="rose"
              action={{ label: 'Retry', onClick: runAuto, icon: RefreshCw }}
            />
          </CardContent>
        </Card>
      )}

      {results && filteredResults.length === 0 && !resultsError && (
        <Card>
          <CardContent className="py-10">
            <ProfessionalEmptyState
              icon={ArrowLeftRight}
              title={results.length === 0 ? 'Nothing to reconcile' : 'No results match this filter'}
              description={
                results.length === 0
                  ? 'All your transactions are already reconciled.'
                  : 'Try a different filter chip above.'
              }
              accent="emerald"
            />
          </CardContent>
        </Card>
      )}

      {filteredResults.length > 0 && (
        <div className={`max-h-[600px] space-y-3 overflow-y-auto pr-1 ${SCROLLBAR_CLASS}`}>
          {filteredResults.map((r) => (
            <ResultCard
              key={r.transactionId}
              result={r}
              tx={txMap.get(r.transactionId)}
              onMark={handleMark}
              onManual={handleManual}
              confirmingId={confirmingId}
            />
          ))}
        </div>
      )}

      {!results && !resultsLoading && !resultsError && (
        <Card>
          <CardContent className="py-10">
            <ProfessionalEmptyState
              icon={Sparkles}
              title="Run auto-reconciliation"
              description="Click the button above to match transactions against your invoices, payments, and expenses."
              accent="violet"
              action={{ label: 'Run now', onClick: runAuto, icon: Sparkles }}
            />
          </CardContent>
        </Card>
      )}

      <ManualFindDialog
        transactionId={manualTxId}
        open={manualOpen}
        onOpenChange={setManualOpen}
        onSaved={() => {
          setResults((prev) => prev?.filter((r) => r.transactionId !== manualTxId) ?? null);
          refetchSummary();
        }}
      />
    </div>
  );
}

export default ReconciliationTab;
