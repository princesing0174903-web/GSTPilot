'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — InvoiceOraclePanel
//
// A premium right-side Oracle AI panel that lights up when an invoice is
// selected. Mirrors the Returns module's Oracle panel design language:
//   • Amber/gold accent (Sparkles icon, "Oracle AI" branding)
//   • Emerald success / red danger / cyan info / amber warning tones
//   • Framer Motion staggered entrance per card
//   • Skeleton while insights are loading
//   • Friendly error card with retry when insights fail to load
//
// Sections (top to bottom):
//   1. Header — Oracle AI branding + Live insights (green pulsing dot)
//   2. Payment Prediction Card — likely pay date, confidence %, reasoning
//   3. Late Payment Risk Card — level, score gauge, factors
//   4. Anomalies List — icon + message, empty state
//   5. Duplicate Detection — list with confidence, empty state
//   6. GST Mismatch Warning — red warning / green verified
//   7. Collection Suggestion — action card with channel icon
//   8. One-Click Fixes — emerald buttons per fix
//   9. Footer — "Powered by Oracle AI™ — deterministic heuristics, not legal advice."
//
// Spec compliance: Task 3-c (Oracle Panel + Details Sheet).
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  TrendingUp,
  ShieldAlert,
  Info,
  AlertTriangle,
  AlertOctagon,
  Copy,
  CheckCircle2,
  Mail,
  MessageSquare,
  Phone,
  Zap,
  RefreshCw,
  CheckCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { InvoiceInsights } from '@/hooks/useInvoicesApi';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface InvoiceOraclePanelProps {
  invoiceId: string | null;
  fetchInsights: (id: string) => Promise<InvoiceInsights | null>;
  onOneClickFix?: (
    fixId: string,
    endpoint: string,
    method: 'POST' | 'PATCH',
    body: Record<string, unknown>,
  ) => void;
  loading?: boolean;
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

const formatRelative = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const ms = d.getTime() - now.getTime();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 1 && days <= 14) return `In ${days} days`;
  if (days < -1 && days >= -14) return `${Math.abs(days)} days ago`;
  return formatDate(iso);
};

const RISK_LEVEL_CFG: Record<
  InvoiceInsights['latePaymentRisk']['level'],
  { label: string; bar: string; text: string; chip: string; glow: string }
> = {
  low: {
    label: 'Low',
    bar: 'bg-emerald-500',
    text: 'text-emerald-400',
    chip: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
    glow: 'from-emerald-500/20',
  },
  medium: {
    label: 'Medium',
    bar: 'bg-amber-500',
    text: 'text-amber-400',
    chip: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
    glow: 'from-amber-500/20',
  },
  high: {
    label: 'High',
    bar: 'bg-orange-500',
    text: 'text-orange-400',
    chip: 'bg-orange-500/10 text-orange-300 border-orange-500/25',
    glow: 'from-orange-500/20',
  },
  critical: {
    label: 'Critical',
    bar: 'bg-red-500',
    text: 'text-red-400',
    chip: 'bg-red-500/10 text-red-300 border-red-500/25',
    glow: 'from-red-500/20',
  },
};

const ANOMALY_CFG: Record<
  InvoiceInsights['anomalies'][number]['severity'],
  { icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  info: { icon: Info, tone: 'text-cyan-400' },
  warning: { icon: AlertTriangle, tone: 'text-amber-400' },
  critical: { icon: AlertOctagon, tone: 'text-red-400' },
};

const CHANNEL_CFG: Record<
  InvoiceInsights['collectionSuggestion']['channel'],
  { icon: React.ComponentType<{ className?: string }>; label: string; tone: string }
> = {
  email: { icon: Mail, label: 'Email', tone: 'text-cyan-400' },
  whatsapp: { icon: MessageSquare, label: 'WhatsApp', tone: 'text-emerald-400' },
  call: { icon: Phone, label: 'Phone', tone: 'text-amber-400' },
};

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay: i * 0.06, ease: 'easeOut' as const },
});

// ─── Skeleton ────────────────────────────────────────────────────────────────

function OraclePanelSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-20 w-full rounded-2xl bg-white/[0.04]" />
      <Skeleton className="h-32 w-full rounded-2xl bg-white/[0.04]" />
      <Skeleton className="h-40 w-full rounded-2xl bg-white/[0.04]" />
      <Skeleton className="h-24 w-full rounded-2xl bg-white/[0.04]" />
      <Skeleton className="h-28 w-full rounded-2xl bg-white/[0.04]" />
      <Skeleton className="h-28 w-full rounded-2xl bg-white/[0.04]" />
    </div>
  );
}

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
  icon: React.ComponentType<{ className?: string }>;
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

// ─── Section cards ───────────────────────────────────────────────────────────

function PaymentPredictionCard({
  data,
  index,
}: {
  data: InvoiceInsights['paymentPrediction'];
  index: number;
}) {
  const confidencePct = Math.max(0, Math.min(100, Math.round(data.confidence * 100)));
  const isPaid = data.likelyPayDate === null && data.confidence >= 1;

  return (
    <motion.div {...stagger(index)}>
      <OracleCard>
        <CardLabel icon={TrendingUp}>Payment Prediction</CardLabel>

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Likely Pay Date
            </p>
            <p className="mt-0.5 text-xl font-bold text-white">
              {isPaid ? 'Already Paid' : formatRelative(data.likelyPayDate)}
            </p>
            {!isPaid && data.likelyPayDate && (
              <p className="text-[11px] text-zinc-500">
                {formatDate(data.likelyPayDate)}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Confidence
            </p>
            <p className="text-xl font-bold text-emerald-400 tabular-nums">
              {confidencePct}%
            </p>
          </div>
        </div>

        {/* Confidence bar */}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${confidencePct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
          />
        </div>

        {data.reasoning && (
          <p className="mt-3 text-xs leading-relaxed text-zinc-400">
            {data.reasoning}
          </p>
        )}
      </OracleCard>
    </motion.div>
  );
}

function LatePaymentRiskCard({
  data,
  index,
}: {
  data: InvoiceInsights['latePaymentRisk'];
  index: number;
}) {
  const cfg = RISK_LEVEL_CFG[data.level] ?? RISK_LEVEL_CFG.low;
  const score = Math.max(0, Math.min(100, Math.round(data.score)));

  return (
    <motion.div {...stagger(index)}>
      <OracleCard>
        <CardLabel icon={ShieldAlert} tone={cfg.text}>
          Late Payment Risk
        </CardLabel>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Risk Level
            </p>
            <span
              className={cn(
                'mt-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                cfg.chip,
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', cfg.bar)} />
              {cfg.label}
            </span>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Risk Score
            </p>
            <p className={cn('text-2xl font-bold tabular-nums', cfg.text)}>
              {score}
              <span className="text-sm text-zinc-500">/100</span>
            </p>
          </div>
        </div>

        {/* Risk score horizontal gauge */}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className={cn('h-full rounded-full', cfg.bar)}
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
          />
        </div>

        {data.factors.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Contributing Factors
            </p>
            <ul className="space-y-1">
              {data.factors.map((f, i) => (
                <li
                  key={`factor-${i}`}
                  className="flex items-start gap-2 text-xs text-zinc-400"
                >
                  <span
                    className={cn(
                      'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                      cfg.bar,
                    )}
                  />
                  <span className="leading-relaxed">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </OracleCard>
    </motion.div>
  );
}

function AnomaliesCard({
  anomalies,
  index,
}: {
  anomalies: InvoiceInsights['anomalies'];
  index: number;
}) {
  const hasItems = anomalies.length > 0;

  return (
    <motion.div {...stagger(index)}>
      <OracleCard>
        <CardLabel icon={AlertTriangle} tone="text-amber-300">
          Anomalies
        </CardLabel>

        {hasItems ? (
          <ul className="space-y-2">
            {anomalies.map((a, i) => {
              const cfg = ANOMALY_CFG[a.severity] ?? ANOMALY_CFG.info;
              const Icon = cfg.icon;
              return (
                <li
                  key={`anomaly-${i}`}
                  className="flex items-start gap-2.5 rounded-lg bg-white/[0.02] p-2.5 ring-1 ring-white/[0.04]"
                >
                  <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', cfg.tone)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      {a.severity}
                    </p>
                    <p className="text-xs leading-relaxed text-zinc-300">
                      {a.message}
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
              No anomalies detected — all good! ✓
            </p>
          </div>
        )}
      </OracleCard>
    </motion.div>
  );
}

function DuplicateDetectionCard({
  duplicates,
  index,
}: {
  duplicates: InvoiceInsights['duplicateDetection'];
  index: number;
}) {
  const hasItems = duplicates.length > 0;

  return (
    <motion.div {...stagger(index)}>
      <OracleCard>
        <CardLabel icon={Copy} tone="text-cyan-300">
          Duplicate Detection
        </CardLabel>

        {hasItems ? (
          <ul className="space-y-2">
            {duplicates.map((d, i) => {
              const conf = Math.max(0, Math.min(100, Math.round(d.confidence * 100)));
              return (
                <li
                  key={`dup-${i}`}
                  className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.02] p-2.5 ring-1 ring-white/[0.04]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-zinc-200">
                      {d.invoiceNumber || 'Untitled invoice'}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                      {d.reason}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                      {conf}% match
                    </span>
                    <a
                      href={`/invoices/${encodeURIComponent(d.invoiceId)}`}
                      className="inline-flex items-center gap-1 rounded-md border border-cyan-500/25 bg-cyan-500/10 px-2 py-1 text-[11px] font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20"
                    >
                      Open
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-cyan-500/[0.05] p-3 ring-1 ring-cyan-500/15">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-400" />
            <p className="text-xs font-medium text-cyan-300">
              No duplicates found
            </p>
          </div>
        )}
      </OracleCard>
    </motion.div>
  );
}

function GstMismatchCard({
  data,
  index,
}: {
  data: InvoiceInsights['gstMismatch'];
  index: number;
}) {
  if (data.hasMismatch) {
    return (
      <motion.div {...stagger(index)}>
        <div className="glass-surface rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-4">
          <CardLabel icon={AlertOctagon} tone="text-red-400">
            GST Mismatch
          </CardLabel>
          <div className="rounded-lg bg-red-500/[0.08] p-3 ring-1 ring-red-500/20">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-300">
              ⚠ Calculation discrepancy detected
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-300">
              {data.details}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div {...stagger(index)}>
      <div className="glass-surface rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
        <CardLabel icon={CheckCheck} tone="text-emerald-400">
          GST Verification
        </CardLabel>
        <div className="flex items-center gap-2.5 rounded-lg bg-emerald-500/[0.08] p-3 ring-1 ring-emerald-500/20">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <div>
            <p className="text-xs font-semibold text-emerald-300">
              GST calculations verified
            </p>
            <p className="mt-0.5 text-[11px] text-emerald-400/80">
              Tax breakdown reconciles with the invoice total.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function CollectionSuggestionCard({
  data,
  index,
}: {
  data: InvoiceInsights['collectionSuggestion'];
  index: number;
}) {
  const cfg = CHANNEL_CFG[data.channel] ?? CHANNEL_CFG.email;
  const Icon = cfg.icon;

  return (
    <motion.div {...stagger(index)}>
      <OracleCard>
        <CardLabel icon={MessageSquare} tone="text-amber-300">
          Collection Suggestion
        </CardLabel>

        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.08]',
            )}
          >
            <Icon className={cn('h-5 w-5', cfg.tone)} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-white">{data.action}</p>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                  'border-white/10 bg-white/[0.04] text-zinc-300',
                )}
              >
                <Icon className="h-2.5 w-2.5" />
                {cfg.label}
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
              {data.message}
            </p>
          </div>
        </div>
      </OracleCard>
    </motion.div>
  );
}

function OneClickFixesCard({
  fixes,
  onOneClickFix,
  index,
}: {
  fixes: InvoiceInsights['oneClickFixes'];
  onOneClickFix?: InvoiceOraclePanelProps['onOneClickFix'];
  index: number;
}) {
  const [applying, setApplying] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  const handle = (fix: InvoiceInsights['oneClickFixes'][number]) => {
    if (!onOneClickFix) return;
    setApplying(fix.id);
    try {
      onOneClickFix(fix.id, fix.endpoint, fix.method, fix.body);
      setApplied((prev) => new Set(prev).add(fix.id));
    } finally {
      // Clear applying after a short delay so the user sees confirmation.
      setTimeout(() => setApplying(null), 600);
    }
  };

  if (fixes.length === 0) {
    return (
      <motion.div {...stagger(index)}>
        <OracleCard>
          <CardLabel icon={Zap} tone="text-emerald-300">
            One-Click Fixes
          </CardLabel>
          <div className="flex items-center gap-2 rounded-lg bg-white/[0.02] p-3 ring-1 ring-white/[0.04]">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <p className="text-xs text-zinc-400">
              No fixes needed — this invoice is in great shape.
            </p>
          </div>
        </OracleCard>
      </motion.div>
    );
  }

  return (
    <motion.div {...stagger(index)}>
      <OracleCard>
        <CardLabel icon={Zap} tone="text-emerald-300">
          One-Click Fixes
        </CardLabel>

        <div className="space-y-2">
          {fixes.map((fix) => {
            const isApplying = applying === fix.id;
            const isApplied = applied.has(fix.id);
            return (
              <div
                key={fix.id}
                className="rounded-lg bg-white/[0.02] p-3 ring-1 ring-white/[0.04]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-zinc-200">
                      {fix.label}
                    </p>
                    {fix.description && (
                      <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                        {fix.description}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handle(fix)}
                  disabled={!onOneClickFix || isApplying || isApplied}
                  loading={isApplying}
                  className={cn(
                    'mt-2.5 w-full gap-1.5 rounded-xl text-xs font-semibold shadow-lg',
                    isApplied
                      ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                      : 'bg-emerald-500 text-white shadow-emerald-500/25 hover:bg-emerald-400',
                  )}
                >
                  {isApplied ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Applied
                    </>
                  ) : (
                    <>
                      <Zap className="h-3.5 w-3.5" />
                      Apply Fix
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </OracleCard>
    </motion.div>
  );
}

function Footer() {
  return (
    <div className="px-1 pb-1 pt-2 text-center">
      <p className="text-[10px] leading-relaxed text-zinc-600">
        Powered by <span className="font-semibold text-amber-300/80">Oracle AI™</span> —
        deterministic heuristics, not legal advice.
      </p>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function InvoiceOraclePanel({
  invoiceId,
  fetchInsights,
  onOneClickFix,
  loading = false,
  className,
}: InvoiceOraclePanelProps) {
  // When no invoice is selected we render the empty state directly. The fetch
  // lifecycle only runs inside the keyed inner component below, so we never
  // call setState synchronously inside an effect to "clear" stale state —
  // React auto-resets the inner component's state when `key={invoiceId}`
  // changes (i.e. when the user picks a different invoice).
  if (!invoiceId) {
    return (
      <div className={cn('flex flex-col gap-3', className)}>
        <OracleHeader />
        <div className="glass-surface flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 ring-1 ring-amber-400/20">
            <Sparkles className="h-6 w-6 text-amber-300" />
          </div>
          <p className="mt-3 text-sm font-semibold text-zinc-200">
            Select an invoice
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Oracle AI will analyse the selected invoice and surface payment
            predictions, risk signals, and one-click fixes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <OraclePanelInner
      key={invoiceId}
      invoiceId={invoiceId}
      fetchInsights={fetchInsights}
      onOneClickFix={onOneClickFix}
      loading={loading}
      className={className}
    />
  );
}

/**
 * Inner panel — mounted with `key={invoiceId}` so React auto-resets state
 * when the selected invoice changes. All setState calls inside the effect
 * happen in async callbacks (`.then` / `.catch` / `.finally`), never
 * synchronously in the effect body.
 */
function OraclePanelInner({
  invoiceId,
  fetchInsights,
  onOneClickFix,
  loading = false,
  className,
}: InvoiceOraclePanelProps) {
  const [insights, setInsights] = useState<InvoiceInsights | null>(null);
  // Start in loading state so the first render after mount shows the skeleton
  // before the effect's async callback resolves.
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchInsights(invoiceId)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setError('We couldn\'t load Oracle insights for this invoice. Please retry.');
          setInsights(null);
        } else {
          setInsights(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[InvoiceOraclePanel] fetchInsights failed:', err);
        setError('We couldn\'t load Oracle insights for this invoice. Please retry.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [invoiceId, fetchInsights]);

  const retry = useCallback(() => {
    setIsLoading(true);
    setError(null);
    fetchInsights(invoiceId)
      .then((data) => {
        if (!data) {
          setError('We couldn\'t load Oracle insights for this invoice. Please retry.');
          setInsights(null);
        } else {
          setInsights(data);
          setError(null);
        }
      })
      .catch((err) => {
        console.error('[InvoiceOraclePanel] retry failed:', err);
        setError('We couldn\'t load Oracle insights for this invoice. Please retry.');
      })
      .finally(() => setIsLoading(false));
  }, [invoiceId, fetchInsights]);

  const showLoading = isLoading || loading;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <OracleHeader />

      {/* ─── Loading skeleton ────────────────────────────────────────────── */}
      {showLoading && <OraclePanelSkeleton />}

      {/* ─── Error card with retry ───────────────────────────────────────── */}
      {!showLoading && error && (
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
              <Button
                type="button"
                size="sm"
                onClick={retry}
                className="mt-3 gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                variant="outline"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Insights cards ──────────────────────────────────────────────── */}
      {!showLoading && !error && insights && (
        <>
          <PaymentPredictionCard data={insights.paymentPrediction} index={0} />
          <LatePaymentRiskCard data={insights.latePaymentRisk} index={1} />
          <AnomaliesCard anomalies={insights.anomalies} index={2} />
          <DuplicateDetectionCard duplicates={insights.duplicateDetection} index={3} />
          <GstMismatchCard data={insights.gstMismatch} index={4} />
          <CollectionSuggestionCard data={insights.collectionSuggestion} index={5} />
          <OneClickFixesCard
            fixes={insights.oneClickFixes}
            onOneClickFix={onOneClickFix}
            index={6}
          />
          <Footer />
        </>
      )}
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
          <p className="text-[11px] text-zinc-400">Live insights</p>
        </div>
      </div>
    </div>
  );
}

export default InvoiceOraclePanel;
