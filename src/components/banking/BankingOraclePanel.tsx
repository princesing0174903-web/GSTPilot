'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — BankingOraclePanel
//
// A premium Oracle AI panel for the Banking module. Surfaces 10 deterministic
// "AI" insights derived from the organization's bank accounts and transactions:
//
//   1.  Cash Flow Analysis      — health pill + score gauge + burn/runway
//   2.  Next Month Prediction   — predicted balance + confidence + inflow/outflow
//   3.  Large Withdrawals       — flagged debit list with severity pills
//   4.  Duplicate Payments      — grouped amounts with total exposure
//   5.  GST Payment Readiness   — liability vs. available balance banner
//   6.  Collection Efficiency   — rate % gauge + outstanding / overdue
//   7.  Unmatched Transactions  — count + credit/debit split + reconcile CTA
//   8.  Late Collections        — overdue invoices list with days-late
//   9.  Fraud Indicators        — signals with severity + transaction link
//   10. Recommendations         — prioritized action / impact pairs
//
// Design language mirrors InvoiceOraclePanel:
//   • Amber/gold Sparkles chip + "Oracle AI" + amber "Live" badge
//   • Green pulsing dot indicating live insights
//   • `glass-surface rounded-2xl border border-white/[0.06] p-4` cards
//   • Oracle wrapper carries the amber gradient wash
//   • Framer Motion staggered entrance (index × 0.06s)
//
// Controlled vs. auto-fetch:
//   • If `insights` is supplied (incl. `null`), the parent owns loading/error
//     and refresh.
//   • If `insights` is `undefined`, the panel auto-fetches on mount via
//     `useBankingApi().fetchOracleInsights()` inside a keyed inner component
//     (so React auto-resets the fetch lifecycle on remount and no setState
//     runs synchronously inside an effect body).
//
// Spec compliance: TASK 12 (Banking Module) — Oracle panel sub-task 4-f.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Search,
  Clock,
  ShieldAlert,
  Lightbulb,
  RefreshCw,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  AlertOctagon,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useBankingApi } from '@/hooks/useBankingApi';
import { BankingOracleSkeleton } from '@/components/banking/BankingSkeletons';
import { formatINR } from '@/components/banking/BankingKpiCards';
import type { BankingOracleInsights } from '@/lib/banking-prisma/types';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface BankingOraclePanelProps {
  /** If `undefined`, the panel auto-fetches on mount. `null` = explicit empty. */
  insights?: BankingOracleInsights | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onRunReconciliation?: () => void;
  className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const clampPct = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

// ─── Tone configs ────────────────────────────────────────────────────────────

type Severity = 'info' | 'warning' | 'critical';

interface SeverityCfg {
  label: string;
  text: string;
  chip: string;
  bar: string;
  dot: string;
}

const SEVERITY_CFG: Record<Severity, SeverityCfg> = {
  info: {
    label: 'Info',
    text: 'text-cyan-400',
    chip: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25',
    bar: 'bg-cyan-500',
    dot: 'bg-cyan-400',
  },
  warning: {
    label: 'Warning',
    text: 'text-amber-400',
    chip: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
    bar: 'bg-amber-500',
    dot: 'bg-amber-400',
  },
  critical: {
    label: 'Critical',
    text: 'text-red-400',
    chip: 'bg-red-500/10 text-red-300 border-red-500/25',
    bar: 'bg-red-500',
    dot: 'bg-red-400',
  },
};

type CashHealth = BankingOracleInsights['cashFlowAnalysis']['health'];

interface HealthCfg {
  label: string;
  text: string;
  chip: string;
  bar: string;
  dot: string;
}

const HEALTH_CFG: Record<CashHealth, HealthCfg> = {
  excellent: {
    label: 'Excellent',
    text: 'text-emerald-400',
    chip: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
    bar: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
    dot: 'bg-emerald-400',
  },
  good: {
    label: 'Good',
    text: 'text-amber-400',
    chip: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
    bar: 'bg-gradient-to-r from-emerald-500 to-amber-400',
    dot: 'bg-amber-400',
  },
  fair: {
    label: 'Fair',
    text: 'text-amber-400',
    chip: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
    bar: 'bg-gradient-to-r from-amber-500 to-amber-400',
    dot: 'bg-amber-400',
  },
  poor: {
    label: 'Poor',
    text: 'text-red-400',
    chip: 'bg-red-500/10 text-red-300 border-red-500/25',
    bar: 'bg-gradient-to-r from-red-500 to-red-400',
    dot: 'bg-red-400',
  },
};

type Priority = 'high' | 'medium' | 'low';

interface PriorityCfg {
  label: string;
  badge: string;
  dot: string;
}

const PRIORITY_CFG: Record<Priority, PriorityCfg> = {
  high: {
    label: 'High',
    badge: 'bg-red-500/10 text-red-300 border-red-500/25',
    dot: 'bg-red-400',
  },
  medium: {
    label: 'Medium',
    badge: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
    dot: 'bg-amber-400',
  },
  low: {
    label: 'Low',
    badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
    dot: 'bg-emerald-400',
  },
};

// ─── Motion presets ──────────────────────────────────────────────────────────

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay: i * 0.06, ease: 'easeOut' as const },
});

// ─── Card primitives ─────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

function OracleCard({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        'glass-surface rounded-2xl border border-white/[0.06] p-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

function CardLabel({
  icon: Icon,
  children,
  tone = 'text-amber-300',
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] ring-1 ring-white/[0.06]">
        <Icon className={cn('h-3.5 w-3.5', tone)} />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        {children}
      </p>
    </div>
  );
}

// Small label/value pair used inside cards for mini-stats.
function MiniStat({
  label,
  value,
  tone = 'text-zinc-100',
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="flex-1 rounded-lg bg-white/[0.02] p-2.5 ring-1 ring-white/[0.04]">
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className={cn('mt-0.5 text-sm font-semibold tabular-nums', tone)}>
        {value}
      </p>
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

function OracleHeader() {
  return (
    <div className="glass-surface flex items-center gap-3 rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-500/[0.08] via-amber-500/[0.03] to-transparent p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 shadow-lg shadow-amber-500/30">
        <Sparkles className="h-5 w-5 text-zinc-900" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-white">Oracle AI</h3>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
            Live
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          <p className="text-[11px] text-zinc-400">Banking intelligence</p>
        </div>
      </div>
    </div>
  );
}

// ─── 1. Cash Flow Analysis ───────────────────────────────────────────────────

function CashFlowAnalysisCard({
  data,
  index,
}: {
  data: BankingOracleInsights['cashFlowAnalysis'];
  index: number;
}) {
  const cfg = HEALTH_CFG[data.health] ?? HEALTH_CFG.fair;
  const score = clampPct(data.score);

  return (
    <motion.div {...stagger(index)}>
      <OracleCard>
        <CardLabel icon={TrendingUp} tone={cfg.text}>
          Cash Flow Analysis
        </CardLabel>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Health
            </p>
            <span
              className={cn(
                'mt-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize',
                cfg.chip,
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
              {cfg.label}
            </span>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Score
            </p>
            <p className={cn('text-2xl font-bold tabular-nums', cfg.text)}>
              {score}
              <span className="text-sm text-zinc-500">/100</span>
            </p>
          </div>
        </div>

        {/* Score gauge bar */}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className={cn('h-full rounded-full', cfg.bar)}
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
          />
        </div>

        {data.insight && (
          <p className="mt-3 text-xs leading-relaxed text-zinc-300">
            {data.insight}
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <MiniStat
            label="Avg Daily Burn"
            value={formatINR(data.avgDailyBurn)}
            tone="text-red-400"
          />
          <MiniStat
            label="Runway"
            value={`${data.runwayDays}d`}
            tone={
              data.runwayDays >= 60
                ? 'text-emerald-400'
                : data.runwayDays >= 30
                  ? 'text-amber-400'
                  : 'text-red-400'
            }
          />
        </div>
      </OracleCard>
    </motion.div>
  );
}

// ─── 2. Next Month Prediction ────────────────────────────────────────────────

function NextMonthPredictionCard({
  data,
  index,
}: {
  data: BankingOracleInsights['nextMonthPrediction'];
  index: number;
}) {
  const confidence = clampPct(data.confidence * 100);
  const net = data.expectedInflow - data.expectedOutflow;
  const isPositive = net >= 0;

  return (
    <motion.div {...stagger(index)}>
      <OracleCard>
        <CardLabel icon={Sparkles}>Next Month Prediction</CardLabel>

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Predicted Balance
            </p>
            <p className="mt-0.5 text-xl font-bold text-white tabular-nums">
              {formatINR(data.predictedBalance)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Confidence
            </p>
            <p className="text-xl font-bold text-emerald-400 tabular-nums">
              {confidence}%
            </p>
          </div>
        </div>

        {/* Confidence bar */}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${confidence}%` }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
          />
        </div>

        <div className="mt-3 flex gap-2">
          <MiniStat
            label="Expected Inflow"
            value={formatINR(data.expectedInflow)}
            tone="text-emerald-400"
          />
          <MiniStat
            label="Expected Outflow"
            value={formatINR(data.expectedOutflow)}
            tone="text-red-400"
          />
        </div>

        <div className="mt-2 flex items-center gap-1.5 text-[11px]">
          <span className="text-zinc-500">Net:</span>
          <span
            className={cn(
              'font-semibold tabular-nums',
              isPositive ? 'text-emerald-400' : 'text-red-400',
            )}
          >
            {isPositive ? '+' : '−'}
            {formatINR(Math.abs(net))}
          </span>
        </div>

        {data.reasoning && (
          <p className="mt-3 text-xs italic leading-relaxed text-zinc-500">
            {data.reasoning}
          </p>
        )}
      </OracleCard>
    </motion.div>
  );
}

// ─── 3. Large Withdrawals ────────────────────────────────────────────────────

function LargeWithdrawalsCard({
  items,
  index,
}: {
  items: BankingOracleInsights['largeWithdrawals'];
  index: number;
}) {
  const hasItems = items.length > 0;

  return (
    <motion.div {...stagger(index)}>
      <OracleCard>
        <CardLabel icon={AlertTriangle} tone="text-amber-300">
          Large Withdrawals
        </CardLabel>

        {hasItems ? (
          <ul className="space-y-2">
            {items.map((w, i) => {
              const cfg = SEVERITY_CFG[w.severity] ?? SEVERITY_CFG.info;
              return (
                <li
                  key={`withdrawal-${i}`}
                  className="rounded-lg bg-white/[0.02] p-2.5 ring-1 ring-white/[0.04]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-zinc-500">
                          {formatDate(w.date)}
                        </span>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                            cfg.chip,
                          )}
                        >
                          <span className={cn('h-1 w-1 rounded-full', cfg.dot)} />
                          {cfg.label}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs font-semibold text-zinc-200">
                        {w.counterparty || w.description || 'Withdrawal'}
                      </p>
                      {w.description && w.counterparty && (
                        <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                          {w.description}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-sm font-bold text-red-400 tabular-nums">
                      −{formatINR(w.amount)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/[0.06] p-3 ring-1 ring-emerald-500/15">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <p className="text-xs font-medium text-emerald-300">
              No large withdrawals detected
            </p>
          </div>
        )}
      </OracleCard>
    </motion.div>
  );
}

// ─── 4. Duplicate Payments ───────────────────────────────────────────────────

function DuplicatePaymentsCard({
  items,
  index,
}: {
  items: BankingOracleInsights['duplicatePayments'];
  index: number;
}) {
  const hasItems = items.length > 0;

  return (
    <motion.div {...stagger(index)}>
      <OracleCard>
        <CardLabel icon={Copy} tone="text-cyan-300">
          Duplicate Payments
        </CardLabel>

        {hasItems ? (
          <ul className="space-y-2">
            {items.map((d, i) => (
              <li
                key={`dup-${i}`}
                className="rounded-lg bg-white/[0.02] p-2.5 ring-1 ring-white/[0.04]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-zinc-100 tabular-nums">
                        {formatINR(d.amount)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-300">
                        {d.count} {d.count === 1 ? 'payment' : 'payments'}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[11px] text-zinc-400">
                      {d.counterparty || 'Unknown counterparty'}
                    </p>
                    {d.dates.length > 0 && (
                      <p className="mt-0.5 truncate text-[10px] text-zinc-600">
                        {d.dates.slice(0, 3).map(formatDate).join(' · ')}
                        {d.dates.length > 3 ? ` +${d.dates.length - 3} more` : ''}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[9px] font-medium uppercase tracking-wider text-zinc-500">
                      Exposure
                    </p>
                    <p className="text-sm font-bold text-red-400 tabular-nums">
                      {formatINR(d.totalExposure)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-cyan-500/[0.05] p-3 ring-1 ring-cyan-500/15">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-400" />
            <p className="text-xs font-medium text-cyan-300">
              No duplicate payments detected
            </p>
          </div>
        )}
      </OracleCard>
    </motion.div>
  );
}

// ─── 5. GST Payment Readiness ────────────────────────────────────────────────

function GstPaymentReadinessCard({
  data,
  index,
}: {
  data: BankingOracleInsights['gstPaymentReadiness'];
  index: number;
}) {
  const ready = data.ready;
  const hasShortfall = data.shortfall > 0;

  return (
    <motion.div {...stagger(index)}>
      <div
        className={cn(
          'glass-surface rounded-2xl p-4',
          ready
            ? 'border border-emerald-500/25 bg-emerald-500/[0.04]'
            : 'border border-red-500/25 bg-red-500/[0.04]',
        )}
      >
        <CardLabel
          icon={ShieldCheck}
          tone={ready ? 'text-emerald-400' : 'text-red-400'}
        >
          GST Payment Readiness
        </CardLabel>

        {/* Banner */}
        <div
          className={cn(
            'flex items-center gap-2.5 rounded-lg p-3 ring-1',
            ready
              ? 'bg-emerald-500/[0.08] ring-emerald-500/20'
              : 'bg-red-500/[0.08] ring-red-500/20',
          )}
        >
          {ready ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          ) : (
            <AlertOctagon className="h-5 w-5 shrink-0 text-red-400" />
          )}
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'text-xs font-semibold',
                ready ? 'text-emerald-300' : 'text-red-300',
              )}
            >
              {ready ? 'Ready to file GST' : 'Insufficient balance for GST'}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-400">
              {data.nextDueDate
                ? `Next due: ${formatDate(data.nextDueDate)}`
                : 'No upcoming due date'}
            </p>
          </div>
        </div>

        {/* Big liability figure */}
        <div className="mt-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Estimated Liability
          </p>
          <p className="mt-0.5 text-2xl font-bold text-white tabular-nums">
            {formatINR(data.estimatedLiability)}
          </p>
        </div>

        <div className="mt-3 flex gap-2">
          <MiniStat
            label="Available Balance"
            value={formatINR(data.availableBalance)}
            tone="text-emerald-400"
          />
          <MiniStat
            label="Shortfall"
            value={formatINR(data.shortfall)}
            tone={hasShortfall ? 'text-red-400' : 'text-zinc-300'}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ─── 6. Collection Efficiency ────────────────────────────────────────────────

function CollectionEfficiencyCard({
  data,
  index,
}: {
  data: BankingOracleInsights['collectionEfficiency'];
  index: number;
}) {
  const rate = clampPct(data.rate * 100);

  return (
    <motion.div {...stagger(index)}>
      <OracleCard>
        <CardLabel icon={TrendingUp} tone="text-emerald-300">
          Collection Efficiency
        </CardLabel>

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Collection Rate
            </p>
            <p className="mt-0.5 text-2xl font-bold text-emerald-400 tabular-nums">
              {rate}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Avg Days
            </p>
            <p className="text-xl font-bold text-zinc-100 tabular-nums">
              {data.avgCollectionDays}
              <span className="text-sm text-zinc-500">d</span>
            </p>
          </div>
        </div>

        {/* Rate gauge bar */}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${rate}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
          />
        </div>

        <div className="mt-3 flex gap-2">
          <MiniStat
            label="Outstanding"
            value={formatINR(data.totalOutstanding)}
            tone="text-amber-400"
          />
          <MiniStat
            label="Overdue"
            value={formatINR(data.overdueAmount)}
            tone="text-red-400"
          />
        </div>
      </OracleCard>
    </motion.div>
  );
}

// ─── 7. Unmatched Transactions ───────────────────────────────────────────────

function UnmatchedTransactionsCard({
  data,
  onRunReconciliation,
  index,
}: {
  data: BankingOracleInsights['unmatchedTransactions'];
  onRunReconciliation?: () => void;
  index: number;
}) {
  const total = data.byType.credit + data.byType.debit;

  return (
    <motion.div {...stagger(index)}>
      <OracleCard>
        <CardLabel icon={Search} tone="text-amber-300">
          Unmatched Transactions
        </CardLabel>

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Count
            </p>
            <p className="mt-0.5 text-2xl font-bold text-amber-400 tabular-nums">
              {data.count}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Total Amount
            </p>
            <p className="text-xl font-bold text-white tabular-nums">
              {formatINR(data.totalAmount)}
            </p>
          </div>
        </div>

        {/* Credit / Debit breakdown */}
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            <span className="flex items-center gap-1 text-emerald-400">
              <ArrowDownRight className="h-3 w-3" />
              Credit
            </span>
            <span className="flex items-center gap-1 text-red-400">
              <ArrowUpRight className="h-3 w-3" />
              Debit
            </span>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
            {total > 0 && (
              <>
                <motion.div
                  className="h-full bg-emerald-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${(data.byType.credit / total) * 100}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
                />
                <motion.div
                  className="h-full bg-red-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${(data.byType.debit / total) * 100}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
                />
              </>
            )}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] tabular-nums">
            <span className="font-semibold text-emerald-400">
              {data.byType.credit} credit
            </span>
            <span className="font-semibold text-red-400">
              {data.byType.debit} debit
            </span>
          </div>
        </div>

        {onRunReconciliation && (
          <Button
            type="button"
            size="sm"
            onClick={onRunReconciliation}
            className="mt-3 w-full gap-1.5 rounded-xl bg-emerald-500 text-xs font-semibold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-400"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Run Reconciliation
          </Button>
        )}
      </OracleCard>
    </motion.div>
  );
}

// ─── 8. Late Collections ─────────────────────────────────────────────────────

function LateCollectionsCard({
  items,
  index,
}: {
  items: BankingOracleInsights['lateCollections'];
  index: number;
}) {
  const hasItems = items.length > 0;

  return (
    <motion.div {...stagger(index)}>
      <OracleCard>
        <CardLabel icon={Clock} tone="text-amber-300">
          Late Collections
        </CardLabel>

        {hasItems ? (
          <ul className="space-y-2">
            {items.map((c, i) => (
              <li
                key={`late-${i}`}
                className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.02] p-2.5 ring-1 ring-white/[0.04]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-zinc-200">
                    {c.invoiceNumber}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                    {c.clientName}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold text-red-400">
                    {c.daysOverdue} {c.daysOverdue === 1 ? 'day' : 'days'} late
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold text-zinc-100 tabular-nums">
                  {formatINR(c.amount)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/[0.06] p-3 ring-1 ring-emerald-500/15">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <p className="text-xs font-medium text-emerald-300">
              No late collections
            </p>
          </div>
        )}
      </OracleCard>
    </motion.div>
  );
}

// ─── 9. Fraud Indicators ─────────────────────────────────────────────────────

function FraudIndicatorsCard({
  items,
  index,
}: {
  items: BankingOracleInsights['fraudIndicators'];
  index: number;
}) {
  const hasItems = items.length > 0;

  return (
    <motion.div {...stagger(index)}>
      <OracleCard>
        <CardLabel icon={ShieldAlert} tone="text-red-400">
          Fraud Indicators
        </CardLabel>

        {hasItems ? (
          <ul className="space-y-2">
            {items.map((f, i) => {
              const cfg = SEVERITY_CFG[f.severity] ?? SEVERITY_CFG.info;
              return (
                <li
                  key={`fraud-${i}`}
                  className="rounded-lg bg-white/[0.02] p-2.5 ring-1 ring-white/[0.04]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold text-zinc-200">
                          {f.type}
                        </p>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                            cfg.chip,
                          )}
                        >
                          <span
                            className={cn('h-1 w-1 rounded-full', cfg.dot)}
                          />
                          {cfg.label}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                        {f.description}
                      </p>
                      {f.transactionId && (
                        <a
                          href={`/banking/transactions/${encodeURIComponent(f.transactionId)}`}
                          className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-cyan-300 hover:text-cyan-200"
                        >
                          View transaction →
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/[0.06] p-3 ring-1 ring-emerald-500/15">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <p className="text-xs font-medium text-emerald-300">
              No fraud indicators detected
            </p>
          </div>
        )}
      </OracleCard>
    </motion.div>
  );
}

// ─── 10. Recommendations ─────────────────────────────────────────────────────

function RecommendationsCard({
  items,
  index,
}: {
  items: BankingOracleInsights['recommendations'];
  index: number;
}) {
  const hasItems = items.length > 0;

  return (
    <motion.div {...stagger(index)}>
      <OracleCard>
        <CardLabel icon={Lightbulb} tone="text-amber-300">
          Recommendations
        </CardLabel>

        {hasItems ? (
          <ul className="space-y-2">
            {items.map((r, i) => {
              const cfg = PRIORITY_CFG[r.priority] ?? PRIORITY_CFG.low;
              return (
                <motion.li
                  key={`rec-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.3,
                    delay: index * 0.06 + i * 0.05,
                    ease: 'easeOut',
                  }}
                  className="rounded-lg bg-white/[0.02] p-2.5 ring-1 ring-white/[0.04]"
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        'mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                        cfg.badge,
                      )}
                    >
                      <span
                        className={cn('h-1 w-1 rounded-full', cfg.dot)}
                      />
                      {cfg.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-zinc-100">
                        {r.action}
                      </p>
                      {r.impact && (
                        <p className="mt-0.5 text-[11px] leading-relaxed text-emerald-400/80">
                          Impact: {r.impact}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/[0.06] p-3 ring-1 ring-emerald-500/15">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <p className="text-xs font-medium text-emerald-300">
              No recommendations — banking looks healthy.
            </p>
          </div>
        )}
      </OracleCard>
    </motion.div>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <div className="px-1 pb-1 pt-2 text-center">
      <p className="text-[10px] leading-relaxed text-zinc-600">
        Powered by <span className="font-semibold text-amber-300/80">Oracle AI™</span> —
        deterministic heuristics, not financial advice.
      </p>
    </div>
  );
}

// ─── Inner content (renders cards from insights) ─────────────────────────────

interface PanelContentProps {
  insights: BankingOracleInsights | null;
  loading: boolean;
  error: string | null;
  onRefresh?: () => void;
  onRunReconciliation?: () => void;
  className?: string;
}

function BankingOraclePanelContent({
  insights,
  loading,
  error,
  onRefresh,
  onRunReconciliation,
  className,
}: PanelContentProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <OracleHeader />

      {/* Loading skeleton */}
      {loading && <BankingOracleSkeleton />}

      {/* Error card with retry */}
      {!loading && error && (
        <div className="glass-surface rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10 ring-1 ring-red-500/20">
              <AlertOctagon className="h-4 w-4 text-red-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-red-300">
                Insights unavailable
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">
                {error}
              </p>
              {onRefresh && (
                <Button
                  type="button"
                  size="sm"
                  onClick={onRefresh}
                  variant="outline"
                  className="mt-3 gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty state — no data yet */}
      {!loading && !error && !insights && (
        <div className="glass-surface flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 ring-1 ring-amber-400/20">
            <Sparkles className="h-6 w-6 text-amber-300" />
          </div>
          <p className="mt-3 text-sm font-semibold text-zinc-200">
            Select data to analyze
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Oracle AI will analyse your banking activity and surface cash flow
            predictions, anomalies, and prioritized recommendations.
          </p>
        </div>
      )}

      {/* Insights cards */}
      {!loading && !error && insights && (
        <>
          <CashFlowAnalysisCard data={insights.cashFlowAnalysis} index={0} />
          <NextMonthPredictionCard data={insights.nextMonthPrediction} index={1} />
          <LargeWithdrawalsCard items={insights.largeWithdrawals} index={2} />
          <DuplicatePaymentsCard items={insights.duplicatePayments} index={3} />
          <GstPaymentReadinessCard data={insights.gstPaymentReadiness} index={4} />
          <CollectionEfficiencyCard data={insights.collectionEfficiency} index={5} />
          <UnmatchedTransactionsCard
            data={insights.unmatchedTransactions}
            onRunReconciliation={onRunReconciliation}
            index={6}
          />
          <LateCollectionsCard items={insights.lateCollections} index={7} />
          <FraudIndicatorsCard items={insights.fraudIndicators} index={8} />
          <RecommendationsCard items={insights.recommendations} index={9} />
          <Footer />
        </>
      )}
    </div>
  );
}

// ─── Auto-fetch inner (keyed) ────────────────────────────────────────────────
//
// Mounted with `key="banking-oracle-auto"` so React auto-resets the fetch
// lifecycle on remount. All setState calls happen in async `.then` / `.catch`
// / `.finally` callbacks — never synchronously inside the effect body, which
// keeps the `react-hooks/set-state-in-effect` lint rule happy.

function BankingOraclePanelAuto({
  onRefresh,
  onRunReconciliation,
  className,
}: {
  onRefresh?: () => void;
  onRunReconciliation?: () => void;
  className?: string;
}) {
  const api = useBankingApi();
  const [insights, setInsights] = useState<BankingOracleInsights | null>(null);
  // Start in loading state so the first render after mount shows the skeleton
  // before the effect's async callback resolves.
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    const maxAttempts = 3;

    const run = () => {
      api.fetchOracleInsights()
        .then((data) => {
          if (cancelled) return;
          setInsights(data);
          setError(null);
          setLoading(false);
        })
        .catch((err) => {
          if (cancelled) return;
          attempt += 1;
          // Transient errors (route still compiling, network blip) → retry with
          // backoff. Only surface an error to the user after the final attempt.
          if (attempt < maxAttempts) {
            setTimeout(run, 800 * attempt);
            return;
          }
          console.warn('[BankingOraclePanel] fetchOracleInsights failed after retries:', err?.message ?? err);
          setError(
            'We couldn\'t load Oracle insights for your banking data. Please retry.',
          );
          setLoading(false);
        });
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    api.fetchOracleInsights()
      .then((data) => {
        setInsights(data);
        setError(null);
      })
      .catch((err) => {
        console.warn('[BankingOraclePanel] retry failed:', err?.message ?? err);
        setError(
          'We couldn\'t load Oracle insights for your banking data. Please retry.',
        );
      })
      .finally(() => setLoading(false));
  }, [api]);

  return (
    <BankingOraclePanelContent
      insights={insights}
      loading={loading}
      error={error}
      onRefresh={onRefresh ?? retry}
      onRunReconciliation={onRunReconciliation}
      className={className}
    />
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function BankingOraclePanel({
  insights,
  loading = false,
  error = null,
  onRefresh,
  onRunReconciliation,
  className,
}: BankingOraclePanelProps) {
  // If `insights` is `undefined`, the parent wants the panel to self-manage
  // its fetch lifecycle. We delegate to the keyed auto-fetch inner so the
  // fetch happens in a clean lifecycle (no setState in render).
  if (insights === undefined) {
    return (
      <BankingOraclePanelAuto
        key="banking-oracle-auto"
        onRefresh={onRefresh}
        onRunReconciliation={onRunReconciliation}
        className={className}
      />
    );
  }

  return (
    <BankingOraclePanelContent
      insights={insights}
      loading={loading}
      error={error}
      onRefresh={onRefresh}
      onRunReconciliation={onRunReconciliation}
      className={className}
    />
  );
}

export default BankingOraclePanel;
