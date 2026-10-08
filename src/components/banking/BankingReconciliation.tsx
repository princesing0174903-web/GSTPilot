'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  FileText,
  CreditCard,
  Landmark,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  Copy,
  TrendingUp,
  TrendingDown,
  Search,
  Clock,
  AlertTriangle,
  ArrowRight,
  Check,
  X,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MatchTypePill, StaggeredItem } from './BankingStatusPills';
import { BankingReconciliationSkeleton } from './BankingSkeletons';
import { useBankingApi } from '@/hooks/useBankingApi';
import { toast } from 'sonner';
import type {
  BankReconciliationRecord,
  ReconciliationSummary,
  ReconciliationMatchType,
} from '@/lib/banking-prisma/types';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Module™ — Reconciliation Panel (TASK 12)
//
// The complete bank reconciliation workflow:
//   Invoice → Payment → Bank Credit → Reconciled
//
// Detects: exact match, partial match, duplicate, overpayment, underpayment,
// missing payment, suspicious transaction. Auto-matches via the engine; user
// can approve, reject, or manually match.
// ═══════════════════════════════════════════════════════════════════════════════

const fmtINR = new Intl.NumberFormat('en-IN', { currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const formatINR = (n: number) => '₹' + fmtINR.format(n);
const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ─── Match type config ────────────────────────────────────────────────────────

interface MatchCfg {
  label: string;
  icon: typeof ShieldCheck;
  tone: string; // text color
  bg: string;
  border: string;
  bar: string; // bar color
}

const MATCH_CFG: Record<string, MatchCfg> = {
  exact: { label: 'Exact Match', icon: ShieldCheck, tone: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/25', bar: 'bg-blue-400' },
  partial: { label: 'Partial', icon: Clock, tone: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25', bar: 'bg-amber-400' },
  duplicate: { label: 'Duplicate', icon: Copy, tone: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/25', bar: 'bg-red-400' },
  overpayment: { label: 'Overpayment', icon: TrendingUp, tone: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/25', bar: 'bg-cyan-400' },
  underpayment: { label: 'Underpayment', icon: TrendingDown, tone: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25', bar: 'bg-amber-400' },
  missing: { label: 'Missing', icon: Search, tone: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/25', bar: 'bg-red-400' },
  suspicious: { label: 'Suspicious', icon: ShieldAlert, tone: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/25', bar: 'bg-red-400' },
};

// ─── Summary card config ──────────────────────────────────────────────────────

interface SummaryCard {
  key: string;
  label: string;
  count: number;
  amount: number;
  cfg: MatchCfg;
}

// ─── Workflow stages ──────────────────────────────────────────────────────────

const STAGES = [
  { key: 'invoice', label: 'Invoice', icon: FileText },
  { key: 'payment', label: 'Payment', icon: CreditCard },
  { key: 'bank', label: 'Bank Credit', icon: Landmark },
  { key: 'reconciled', label: 'Reconciled', icon: CheckCircle2 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export interface BankingReconciliationProps {
  summary: ReconciliationSummary;
  records: BankReconciliationRecord[];
  loading?: boolean;
  onRunReconciliation?: () => Promise<void>;
  onApprove?: (id: string) => Promise<void>;
  onReject?: (id: string, reason: string) => Promise<void>;
  onManualMatch?: (txnId: string, invId: string) => Promise<void>;
  className?: string;
}

export function BankingReconciliation({
  summary,
  records,
  loading,
  onRunReconciliation,
  onApprove,
  onReject,
  className,
}: BankingReconciliationProps) {
  const api = useBankingApi();
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const handleRun = useCallback(async () => {
    setRunning(true);
    try {
      const fn = onRunReconciliation ?? (() => api.runReconciliation().then(() => undefined));
      await fn();
      toast.success('Reconciliation complete', { description: 'Bank transactions matched against invoices.' });
    } catch (err) {
      toast.error('Reconciliation failed', { description: (err as Error).message });
    } finally {
      setRunning(false);
    }
  }, [onRunReconciliation, api]);

  const handleApprove = useCallback(async (id: string) => {
    try {
      const fn = onApprove ?? ((rid: string) => api.approveReconciliation(rid).then(() => undefined));
      await fn(id);
      toast.success('Reconciliation approved');
    } catch (err) {
      toast.error('Approval failed', { description: (err as Error).message });
    }
  }, [onApprove, api]);

  const handleReject = useCallback(async (id: string, reason: string) => {
    try {
      const fn = onReject ?? ((rid: string, rsn: string) => api.rejectReconciliation(rid, rsn).then(() => undefined));
      await fn(id, reason);
      toast.success('Reconciliation rejected');
      setRejectingId(null);
      setRejectReason('');
    } catch (err) {
      toast.error('Rejection failed', { description: (err as Error).message });
    }
  }, [onReject, api]);

  // ─── Summary cards ──────────────────────────────────────────────────────────
  const summaryCards: SummaryCard[] = useMemo(() => [
    { key: 'exact', label: 'Exact Match', count: summary.matched, amount: summary.totalMatchedAmount, cfg: MATCH_CFG.exact },
    { key: 'partial', label: 'Partial', count: summary.partiallyMatched, amount: 0, cfg: MATCH_CFG.partial },
    { key: 'duplicate', label: 'Duplicate', count: summary.duplicate, amount: 0, cfg: MATCH_CFG.duplicate },
    { key: 'overpayment', label: 'Overpayment', count: summary.overpayment, amount: 0, cfg: MATCH_CFG.overpayment },
    { key: 'underpayment', label: 'Underpayment', count: summary.underpayment, amount: 0, cfg: MATCH_CFG.underpayment },
    { key: 'missing', label: 'Missing', count: summary.missing, amount: 0, cfg: MATCH_CFG.missing },
    { key: 'suspicious', label: 'Suspicious', count: summary.suspicious, amount: 0, cfg: MATCH_CFG.suspicious },
  ], [summary]);

  // ─── Filtered records ───────────────────────────────────────────────────────
  const filteredRecords = useMemo(() => {
    if (activeTab === 'all') return records;
    return records.filter((r) => r.matchType === activeTab);
  }, [records, activeTab]);

  // ─── Filter tabs ─────────────────────────────────────────────────────────────
  const tabs = useMemo(() => {
    const base = [
      { key: 'all', label: 'All', count: records.length },
      { key: 'exact', label: 'Exact', count: summary.matched },
      { key: 'partial', label: 'Partial', count: summary.partiallyMatched },
      { key: 'duplicate', label: 'Duplicate', count: summary.duplicate },
      { key: 'suspicious', label: 'Suspicious', count: summary.suspicious },
      { key: 'missing', label: 'Missing', count: summary.missing },
    ];
    return base;
  }, [records.length, summary]);

  const reconRate = summary.reconciliationRate;
  const rateTone = reconRate >= 80 ? 'text-blue-400' : reconRate >= 50 ? 'text-amber-400' : 'text-red-400';
  const rateBg = reconRate >= 80 ? 'bg-blue-500/10 border-blue-500/25' : reconRate >= 50 ? 'bg-amber-500/10 border-amber-500/25' : 'bg-red-500/10 border-red-500/25';

  if (loading) return <BankingReconciliationSkeleton />;

  return (
    <div className={`space-y-6 ${className ?? ''}`}>
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div className="glass-surface flex flex-col gap-4 rounded-2xl border border-white/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
            <RefreshCw className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Bank Reconciliation</h3>
            <p className="text-xs text-muted-foreground">Auto-match transactions against invoices</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${rateBg}`}>
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className={`text-xs font-semibold ${rateTone}`}>{reconRate.toFixed(1)}% reconciled</span>
          </div>
          <Button
            onClick={handleRun}
            disabled={running}
            className="gap-2 bg-blue-500 text-zinc-950 hover:bg-blue-400"
          >
            {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {running ? 'Running...' : 'Run Reconciliation'}
          </Button>
        </div>
      </div>

      {/* ─── Workflow diagram ──────────────────────────────────────────────── */}
      <div className="glass-surface rounded-2xl border border-white/[0.06] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">Reconciliation Pipeline</h4>
          <span className="text-xs text-muted-foreground">{summary.total} transactions processed</span>
        </div>
        <div className="flex items-center justify-between overflow-x-auto">
          {STAGES.map((stage, i) => {
            const counts = [summary.total, summary.total - summary.unmatched, summary.matched, summary.matched];
            const isActive = i <= 2;
            const isDone = i < 3;
            return (
              <React.Fragment key={stage.key}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex flex-col items-center gap-2"
                >
                  <div
                    className={`relative flex h-12 w-12 items-center justify-center rounded-xl border ${
                      isDone
                        ? 'border-blue-500/30 bg-blue-500/10'
                        : isActive
                        ? 'border-amber-500/30 bg-amber-500/10'
                        : 'border-white/[0.08] bg-white/[0.02]'
                    }`}
                  >
                    <stage.icon className={`h-5 w-5 ${isDone ? 'text-blue-400' : isActive ? 'text-amber-400' : 'text-zinc-500'}`} />
                    {isActive && !isDone && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
                      </span>
                    )}
                  </div>
                  <span className={`text-xs font-medium ${isDone ? 'text-blue-300' : isActive ? 'text-amber-300' : 'text-zinc-500'}`}>
                    {stage.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{counts[i]} txns</span>
                </motion.div>
                {i < STAGES.length - 1 && (
                  <div className="relative mx-2 h-px flex-1 min-w-[40px] bg-white/[0.08]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: isDone ? '100%' : '0%' }}
                      transition={{ delay: i * 0.15, duration: 0.5 }}
                      className="absolute left-0 top-0 h-px bg-blue-400"
                    />
                    <ArrowRight className="absolute -right-1 -top-1.5 h-3 w-3 text-muted-foreground" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ─── Summary cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        {summaryCards.map((card, i) => {
          const Icon = card.cfg.icon;
          return (
            <StaggeredItem key={card.key} index={i}>
              <div className={`glass-surface rounded-xl border border-l-2 ${card.cfg.border} border-white/[0.06] p-3`}>
                <div className="mb-2 flex items-center gap-2">
                  <Icon className={`h-3.5 w-3.5 ${card.cfg.tone}`} />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{card.label}</span>
                </div>
                <p className={`text-xl font-bold tabular-nums ${card.cfg.tone}`}>{card.count}</p>
                {card.amount > 0 && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{formatINR(card.amount)}</p>
                )}
              </div>
            </StaggeredItem>
          );
        })}
      </div>

      {/* ─── Filter tabs ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-white/[0.06] pb-px">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-blue-400 text-blue-300'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${activeTab === tab.key ? 'bg-blue-500/20 text-blue-300' : 'bg-white/[0.06] text-muted-foreground'}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ─── Records list ──────────────────────────────────────────────────── */}
      {filteredRecords.length === 0 ? (
        <div className="glass-surface flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] p-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10">
            <Search className="h-6 w-6 text-cyan-400" />
          </div>
          <p className="mb-1 text-sm font-medium text-foreground">No {activeTab !== 'all' ? activeTab : ''} records</p>
          <p className="text-xs text-muted-foreground">Run reconciliation to auto-match transactions against invoices.</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[600px]">
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {filteredRecords.map((record, i) => (
                <ReconciliationRecordCard
                  key={record.id}
                  record={record}
                  index={i}
                  onApprove={handleApprove}
                  onReject={(id) => {
                    setRejectingId(id);
                    setRejectReason('');
                  }}
                  rejectingId={rejectingId}
                  rejectReason={rejectReason}
                  setRejectReason={setRejectReason}
                  onConfirmReject={handleReject}
                  onCancelReject={() => {
                    setRejectingId(null);
                    setRejectReason('');
                  }}
                />
              ))}
            </AnimatePresence>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECORD CARD
// ═══════════════════════════════════════════════════════════════════════════════

interface RecordCardProps {
  record: BankReconciliationRecord;
  index: number;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => void;
  rejectingId: string | null;
  rejectReason: string;
  setRejectReason: (r: string) => void;
  onConfirmReject: (id: string, reason: string) => Promise<void>;
  onCancelReject: () => void;
}

const ReconciliationRecordCard = React.memo(function ReconciliationRecordCard({
  record,
  index,
  onApprove,
  onReject,
  rejectingId,
  rejectReason,
  setRejectReason,
  onConfirmReject,
  onCancelReject,
}: RecordCardProps) {
  const cfg = MATCH_CFG[record.matchType] || MATCH_CFG.partial;
  const Icon = cfg.icon;
  const diff = record.difference;
  const diffTone = diff > 0 ? 'text-cyan-400' : diff < 0 ? 'text-amber-400' : 'text-blue-400';
  const isRejecting = rejectingId === record.id;
  const statusTone =
    record.status === 'approved'
      ? 'bg-blue-500/10 text-blue-300 border-blue-500/25'
      : record.status === 'rejected'
      ? 'bg-red-500/10 text-red-300 border-red-500/25'
      : 'bg-amber-500/10 text-amber-300 border-amber-500/25';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
      className={`glass-surface rounded-xl border border-l-2 ${cfg.border} border-white/[0.06] p-4 hover:border-white/[0.12]`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: match info */}
        <div className="flex items-start gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}>
            <Icon className={`h-4 w-4 ${cfg.tone}`} />
          </div>
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <MatchTypePill matchType={record.matchType} />
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusTone}`}>
                {record.status}
              </span>
              <span className="text-[11px] text-muted-foreground">
                by {record.matchedBy} · {formatDate(record.matchedAt)}
              </span>
            </div>
            <p className="truncate text-sm text-foreground">
              Txn <span className="font-mono text-xs text-muted-foreground">{record.transactionId.slice(-8)}</span>
              {record.invoiceId && (
                <>
                  {' → Invoice '}
                  <span className="font-mono text-xs text-muted-foreground">{record.invoiceId.slice(-8)}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Right: amounts + confidence */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Expected</p>
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {record.expectedAmount != null ? formatINR(record.expectedAmount) : '—'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Actual</p>
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {record.actualAmount != null ? formatINR(record.actualAmount) : '—'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Diff</p>
            <p className={`text-sm font-semibold tabular-nums ${diffTone}`}>
              {diff > 0 ? '+' : ''}{formatINR(diff)}
            </p>
          </div>
          <div className="w-16">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Conf.</span>
              <span className="text-[11px] font-medium text-foreground">{Math.round(record.confidence * 100)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${record.confidence * 100}%` }}
                transition={{ duration: 0.5 }}
                className={`h-full ${cfg.bar}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {record.notes && (
        <p className="mt-2 border-t border-white/[0.04] pt-2 text-xs italic text-muted-foreground">{record.notes}</p>
      )}

      {/* Actions */}
      {record.status === 'pending' && (
        <div className="mt-3 flex items-center gap-2 border-t border-white/[0.04] pt-3">
          {!isRejecting ? (
            <>
              <Button
                size="sm"
                onClick={() => onApprove(record.id)}
                className="gap-1.5 bg-blue-500 text-zinc-950 hover:bg-blue-400"
              >
                <Check className="h-3.5 w-3.5" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReject(record.id)}
                className="gap-1.5 border-red-500/25 text-red-300 hover:bg-red-500/10"
              >
                <X className="h-3.5 w-3.5" />
                Reject
              </Button>
            </>
          ) : (
            <div className="flex w-full items-center gap-2">
              <Input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection (required)..."
                className="h-8 flex-1 text-xs"
                autoFocus
              />
              <Button
                size="sm"
                onClick={() => onConfirmReject(record.id, rejectReason || 'Rejected by user')}
                disabled={!rejectReason.trim()}
                className="gap-1.5 bg-red-500 text-white hover:bg-red-400"
              >
                Confirm
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancelReject} className="text-xs">
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
});

export default BankingReconciliation;
