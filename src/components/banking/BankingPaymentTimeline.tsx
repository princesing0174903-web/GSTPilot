'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Module™ — Payment Timeline (Premium Edition)
//
// A beautiful vertical timeline that traces the lifecycle of a single payment:
//
//   Invoice Created → Reminder Sent → Payment Received → Bank Settled → GST Updated
//
// Each stage is derived from a `BankingTransaction` record:
//   • Stage 1 "Invoice Created" — always present. Uses createdAt (minus a few days
//     for visual spacing) or the matched invoice's issue context when available.
//   • Stage 2 "Reminder Sent"   — shown if the transaction is unmatched OR older
//     than 7 days. Amber-pulsing "current" tone when applicable.
//   • Stage 3 "Payment Received" — shown if `type === 'credit'` (incoming money).
//     Uses `transaction.date`.
//   • Stage 4 "Bank Settled"    — always present. Uses `transaction.date` and the
//     optional `valueDate` if set.
//   • Stage 5 "GST Updated"     — shown if `category === 'gst'` OR `matchedInvoiceId`
//     exists (i.e. the payment has been tied back to an invoice/GST return).
//
// Each stage carries an icon, name, timestamp, status (done / current / pending),
// and a short human description. The animated progress line fills emerald as
// stages complete (Framer Motion `height` animation).
//
// A `compact` horizontal variant is available for embedding inside cards / rows.
//
// Design tokens: pure-black GSTPilot theme. Primary emerald — NO indigo/blue.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Bell,
  Banknote,
  CheckCircle2,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type { BankingTransaction } from '@/lib/banking-prisma/types';
import { formatINR } from '@/components/banking/BankingKpiCards';

// ─── Types ────────────────────────────────────────────────────────────────────

type StageStatus = 'done' | 'current' | 'pending';

interface TimelineStage {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  timestamp: string | null;
  status: StageStatus;
}

interface BankingPaymentTimelineProps {
  transaction: BankingTransaction | null;
  compact?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatTimestamp(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDate(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Stage derivation ─────────────────────────────────────────────────────────
//
// Build the list of applicable stages from a BankingTransaction. Each stage
// records its absolute timestamp (or null for "not applicable") and a derived
// status: 'done' for completed stages, 'current' for the next-up stage, and
// 'pending' for stages beyond that. The first stage without a timestamp is the
// "current" stage; everything after is 'pending'.

function deriveStages(txn: BankingTransaction | null): TimelineStage[] {
  if (!txn) return [];

  const createdAt = parseDate(txn.createdAt) ?? new Date();
  const txnDate = parseDate(txn.date) ?? createdAt;
  const valueDate = parseDate(txn.valueDate);
  const now = new Date();

  // Older than 7 days (based on txn date)?
  const ageDays = (now.getTime() - txnDate.getTime()) / DAY_MS;
  const isStale = ageDays >= 7;
  const isUnmatched = !txn.matched && !txn.matchedInvoiceId;

  // Stage 1 — Invoice Created (always present)
  // Use createdAt minus 3 days as a visual proxy for the invoice issue date.
  const invoiceDate = new Date(createdAt.getTime() - 3 * DAY_MS);

  // Stage 2 — Reminder Sent (only if unmatched OR stale)
  const showReminder = isUnmatched || isStale;
  const reminderDate: Date | null = showReminder
    ? new Date(txnDate.getTime() - 1 * DAY_MS)
    : null;

  // Stage 3 — Payment Received (only for credits)
  const showPayment = txn.type === 'credit';
  const paymentDate: Date | null = showPayment ? txnDate : null;

  // Stage 4 — Bank Settled (always present)
  const settledDate: Date | null = valueDate ?? txnDate;

  // Stage 5 — GST Updated (if category gst OR matched to invoice)
  const showGst = txn.category === 'gst' || Boolean(txn.matchedInvoiceId);
  const gstDate: Date | null = showGst
    ? new Date((settledDate ?? txnDate).getTime() + 1 * DAY_MS)
    : null;

  const rawStages: Array<{
    id: string;
    name: string;
    description: string;
    icon: LucideIcon;
    timestamp: Date | null;
  }> = [
    {
      id: 'invoice',
      name: 'Invoice Created',
      description: txn.matchedInvoiceId
        ? `Linked to invoice · ${txn.referenceNo ?? txn.reference ?? '—'}`
        : 'Initial invoice generated for the counterparty.',
      icon: FileText,
      timestamp: invoiceDate,
    },
    {
      id: 'reminder',
      name: 'Reminder Sent',
      description: isUnmatched
        ? 'Auto-reminder dispatched (transaction is unmatched).'
        : 'Payment follow-up reminder sent to the counterparty.',
      icon: Bell,
      timestamp: reminderDate,
    },
    {
      id: 'payment',
      name: 'Payment Received',
      description: `Incoming credit of ${formatINR(txn.amount)} from ${
        txn.counterparty ?? 'customer'
      }.`,
      icon: Banknote,
      timestamp: paymentDate,
    },
    {
      id: 'bank',
      name: 'Bank Settled',
      description: valueDate
        ? `Cleared on value date ${formatDate(valueDate) ?? '—'}.`
        : 'Transaction posted to the bank ledger.',
      icon: CheckCircle2,
      timestamp: settledDate,
    },
    {
      id: 'gst',
      name: 'GST Updated',
      description: txn.matchedInvoiceId
        ? 'Reconciled against the invoice and GST register.'
        : 'Liability recorded in the GST return schedule.',
      icon: ShieldCheck,
      timestamp: gstDate,
    },
  ];

  // Filter out stages that don't apply (Reminder, Payment, GST are conditional).
  const stages = rawStages.filter((s) => {
    if (s.id === 'reminder') return showReminder;
    if (s.id === 'payment') return showPayment;
    if (s.id === 'gst') return showGst;
    return true;
  });

  // Compute status: walk stages, mark all with timestamp as 'done' until the
  // first one without a timestamp — that's 'current'. Everything after is 'pending'.
  let foundCurrent = false;
  return stages.map((s) => {
    let status: StageStatus;
    if (s.timestamp) {
      status = foundCurrent ? 'pending' : 'done';
    } else {
      if (!foundCurrent) {
        status = 'current';
        foundCurrent = true;
      } else {
        status = 'pending';
      }
    }
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      icon: s.icon,
      timestamp: formatTimestamp(s.timestamp),
      status,
    };
  });
}

// ─── Status visual config ─────────────────────────────────────────────────────

interface StatusStyle {
  dot: string;
  ring: string;
  iconColor: string;
  iconBg: string;
  label: string;
  labelText: string;
  line: string;
  pulse: boolean;
}

const STATUS_STYLES: Record<StageStatus, StatusStyle> = {
  done: {
    dot: 'bg-blue-400',
    ring: 'ring-blue-500/30',
    iconColor: 'text-blue-300',
    iconBg: 'bg-blue-500/10 border-blue-500/25',
    label: 'Done',
    labelText: 'text-blue-300',
    line: 'bg-blue-500/40',
    pulse: false,
  },
  current: {
    dot: 'bg-amber-400',
    ring: 'ring-amber-500/30',
    iconColor: 'text-amber-300',
    iconBg: 'bg-amber-500/10 border-amber-500/25',
    label: 'Current',
    labelText: 'text-amber-300',
    line: 'bg-white/[0.06]',
    pulse: true,
  },
  pending: {
    dot: 'bg-zinc-600',
    ring: 'ring-white/[0.06]',
    iconColor: 'text-zinc-400',
    iconBg: 'bg-white/[0.03] border-white/[0.06]',
    label: 'Pending',
    labelText: 'text-zinc-500',
    line: 'bg-white/[0.06]',
    pulse: false,
  },
};

// ─── Vertical Timeline ────────────────────────────────────────────────────────

interface VerticalTimelineProps {
  stages: TimelineStage[];
}

function VerticalTimeline({ stages }: VerticalTimelineProps) {
  if (stages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04] border border-white/[0.06]">
          <FileText className="h-5 w-5 text-zinc-500" />
        </div>
        <p className="text-sm text-muted-foreground">No payment timeline available</p>
      </div>
    );
  }

  // Compute progress: count of 'done' stages. The fill height is
  // (doneCount / totalStages) * 100% — measured against the full rail height.
  const doneCount = stages.filter((s) => s.status === 'done').length;
  const progressPct = stages.length > 0 ? (doneCount / stages.length) * 100 : 0;

  return (
    <div className="relative pl-2">
      {/* Static background rail */}
      <div
        className="absolute left-[19px] top-3 bottom-3 w-px bg-white/[0.06]"
        aria-hidden
      />
      {/* Animated emerald progress fill */}
      <motion.div
        className="absolute left-[19px] top-3 w-px bg-gradient-to-b from-blue-400 to-blue-500"
        initial={{ height: 0 }}
        animate={{ height: `${progressPct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
        style={{ maxHeight: 'calc(100% - 1.5rem)' }}
        aria-hidden
      />

      <ol className="space-y-5">
        {stages.map((stage, idx) => {
          const cfg = STATUS_STYLES[stage.status];
          const Icon = stage.icon;
          return (
            <motion.li
              key={stage.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.08, ease: 'easeOut' }}
              className="relative flex items-start gap-4"
            >
              {/* Dot / icon node */}
              <div className="relative z-10 flex-shrink-0">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border ring-4 ring-offset-0 ring-offset-background ${cfg.iconBg} ${cfg.ring}`}
                >
                  <Icon className={`h-4.5 w-4.5 ${cfg.iconColor}`} style={{ width: 18, height: 18 }} />
                </div>
                {/* Status dot badge */}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${cfg.dot} ${
                    cfg.pulse ? 'animate-pulse' : ''
                  }`}
                >
                  {cfg.pulse && (
                    <span
                      className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${cfg.dot}`}
                    />
                  )}
                </span>
              </div>

              {/* Stage body */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{stage.name}</h4>
                  <span
                    className={`text-[10px] font-medium uppercase tracking-wider ${cfg.labelText}`}
                  >
                    {cfg.label}
                  </span>
                </div>
                {stage.timestamp && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                    {stage.timestamp}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {stage.description}
                </p>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

// ─── Compact Horizontal Timeline ──────────────────────────────────────────────
//
// Embeddable inside a card row. Renders dots on a horizontal line with stage
// labels below. Drops the description text to keep it small.

function CompactTimeline({ stages }: VerticalTimelineProps) {
  if (stages.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <FileText className="h-3.5 w-3.5 text-zinc-500" />
        <span>No payment timeline available</span>
      </div>
    );
  }

  const doneCount = stages.filter((s) => s.status === 'done').length;
  const progressPct = stages.length > 1 ? (doneCount / (stages.length - 1)) * 100 : 0;

  return (
    <div className="w-full">
      <div className="relative">
        {/* Background rail */}
        <div className="absolute left-0 right-0 top-[11px] h-px bg-white/[0.08]" aria-hidden />
        {/* Progress fill */}
        <motion.div
          className="absolute left-0 top-[11px] h-px bg-gradient-to-r from-blue-400 to-blue-500"
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
          aria-hidden
        />
        <ol className="relative flex justify-between">
          {stages.map((stage, idx) => {
            const cfg = STATUS_STYLES[stage.status];
            const Icon = stage.icon;
            return (
              <motion.li
                key={stage.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: idx * 0.06, ease: 'easeOut' }}
                className="flex flex-col items-center gap-1.5"
                style={{ width: `${100 / stages.length}%` }}
              >
                <div
                  className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border ${cfg.iconBg} ${
                    cfg.pulse ? 'animate-pulse' : ''
                  }`}
                >
                  <Icon className="h-3 w-3" style={{ color: 'currentColor' }} />
                  <span className={`absolute -mt-3 ${cfg.iconColor}`}>
                    <Icon style={{ width: 11, height: 11 }} />
                  </span>
                </div>
                <span
                  className={`text-[10px] font-medium text-center leading-tight ${
                    stage.status === 'pending' ? 'text-zinc-500' : 'text-foreground'
                  }`}
                >
                  {stage.name}
                </span>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

// ─── Main exported component ──────────────────────────────────────────────────

function BankingPaymentTimelineImpl({ transaction, compact = false }: BankingPaymentTimelineProps) {
  const stages = useMemo(() => deriveStages(transaction), [transaction]);

  if (compact) {
    return <CompactTimeline stages={stages} />;
  }
  return (
    <div className="glass-surface rounded-2xl border border-white/[0.06] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Banknote className="h-3.5 w-3.5 text-blue-300" />
          </div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            Payment Lifecycle
          </h3>
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {stages.filter((s) => s.status === 'done').length}/{stages.length} complete
        </span>
      </div>
      <VerticalTimeline stages={stages} />
    </div>
  );
}

export const BankingPaymentTimeline = memo(BankingPaymentTimelineImpl);

export type { BankingPaymentTimelineProps, TimelineStage, StageStatus };
