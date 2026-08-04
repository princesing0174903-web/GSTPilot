'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Proactive Oracle Briefing (Task 12 · Step 3)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Oracle does NOT wait for prompts. Oracle wakes up with knowledge.
//
// This component renders the daily briefing as a CFO would speak:
//
//   "I've done 1 task — 2 need your sign-off"
//   ✓ I matched 54 payments (₹2.36L reconciled)
//   ⚠ 1 payment needs review → [Review]
//   ✓ I auto-matched 54 transactions → [Approve all]
//
// The design feels like an intelligent CFO giving a morning brief — NOT a
// chatbot. No input bar, no "Ask Oracle" prompt. Oracle speaks FIRST.
//
// Data source: useOracleDailyBriefing() → /api/oracle/daily-briefing
// Theme: pure-black GSTPilot dark. Gold/amber Oracle brand. Glass surfaces.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  CheckCircle2,
  AlertCircle,
  Eye,
  ArrowRight,
  RefreshCw,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OracleDailyBriefing, BriefingItem } from '@/lib/oracle/daily-briefing';

// ─── Tone styling ────────────────────────────────────────────────────────────

interface ToneStyle {
  iconWrap: string;
  iconColor: string;
  border: string;
  bg: string;
  title: string;
  detail: string;
}

const TONE_STYLES: Record<BriefingItem['tone'], ToneStyle> = {
  emerald: {
    iconWrap: 'bg-emerald-500/10 border-emerald-500/20',
    iconColor: 'text-emerald-400',
    border: 'border-emerald-500/15',
    bg: 'bg-emerald-500/[0.03]',
    title: 'text-zinc-100',
    detail: 'text-zinc-400',
  },
  amber: {
    iconWrap: 'bg-amber-500/10 border-amber-500/20',
    iconColor: 'text-amber-400',
    border: 'border-amber-500/15',
    bg: 'bg-amber-500/[0.03]',
    title: 'text-zinc-100',
    detail: 'text-zinc-400',
  },
  blue: {
    iconWrap: 'bg-cyan-500/10 border-cyan-500/20',
    iconColor: 'text-cyan-400',
    border: 'border-cyan-500/15',
    bg: 'bg-cyan-500/[0.03]',
    title: 'text-zinc-100',
    detail: 'text-zinc-400',
  },
};

const KIND_ICON: Record<BriefingItem['kind'], LucideIcon> = {
  done: CheckCircle2,
  attention: AlertCircle,
  watch: Eye,
};

// ─── Briefing Item Card ──────────────────────────────────────────────────────

interface ItemCardProps {
  item: BriefingItem;
  index: number;
  onAction?: (view: string) => void;
}

const BriefingItemCard = React.memo(function BriefingItemCard({
  item,
  index,
  onAction,
}: ItemCardProps) {
  const tone = TONE_STYLES[item.tone] ?? TONE_STYLES.emerald;
  const Icon = KIND_ICON[item.kind] ?? CheckCircle2;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: 'easeOut' }}
      className={`group relative flex items-center gap-3 rounded-xl border ${tone.border} ${tone.bg} px-3 py-2.5 transition-colors hover:bg-white/[0.04]`}
    >
      {/* Icon */}
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${tone.iconWrap}`}>
        <Icon className={`size-4 ${tone.iconColor}`} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className={`text-[13px] font-semibold leading-tight ${tone.title}`}>
          {item.title}
        </p>
        <p className={`text-[11px] mt-0.5 leading-tight ${tone.detail}`}>
          {item.detail}
        </p>
      </div>

      {/* Action button */}
      {item.actionLabel && item.actionView && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAction?.(item.actionView!)}
          className="shrink-0 gap-1 h-7 px-2.5 text-[11px] font-semibold text-zinc-300 hover:bg-white/[0.08] hover:text-white"
        >
          {item.actionLabel}
          <ArrowRight className="size-3" />
        </Button>
      )}
    </motion.div>
  );
});

// ─── Skeleton ────────────────────────────────────────────────────────────────

function BriefingSkeleton() {
  return (
    <div className="space-y-2.5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-3/4 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function BriefingEmpty() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/[0.06]">
        <Brain className="size-5 text-amber-400/70" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-zinc-200">Oracle is calibrating</p>
        <p className="max-w-sm text-xs text-zinc-500">
          Create an invoice or connect a bank account to unlock Oracle&apos;s
          proactive briefings — automatic payment matching, GST prep, and
          one-click approvals.
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export interface ProactiveOracleBriefingProps {
  briefing: OracleDailyBriefing | null;
  loading?: boolean;
  onNavigate?: (view: string) => void;
  onRefresh?: () => void;
  onOpenOracle?: () => void;
}

function ProactiveOracleBriefingImpl({
  briefing,
  loading = false,
  onNavigate,
  onRefresh,
  onOpenOracle,
}: ProactiveOracleBriefingProps) {
  const doneItems = useMemo(() => briefing?.done ?? [], [briefing]);
  const attentionItems = useMemo(() => briefing?.needsAttention ?? [], [briefing]);
  const watchItems = useMemo(() => briefing?.watchlist ?? [], [briefing]);
  const isEmpty = !briefing || (doneItems.length === 0 && attentionItems.length === 0 && watchItems.length === 0);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.05, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-500/[0.04] via-zinc-950 to-zinc-950 p-5 md:p-6"
      aria-label="Oracle proactive briefing"
    >
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-amber-500/[0.08] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-emerald-500/[0.04] blur-3xl"
      />

      {/* ─── Header ─── */}
      <header className="relative mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3.5 min-w-0">
          {/* Oracle avatar with live pulse */}
          <div className="relative flex items-center justify-center h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_24px_-6px_rgba(245,158,11,0.5)]">
            <Brain className="size-5 text-white" />
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 border border-zinc-950" />
            </span>
          </div>

          {/* Headline — CFO voice */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-zinc-100 tracking-tight">
                Oracle
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/[0.08] px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider text-amber-400">
                <span className="h-1 w-1 rounded-full bg-amber-400 animate-pulse" />
                {briefing?.mood === 'proactive' ? 'Working' : briefing?.mood ?? 'Ready'}
              </span>
            </div>
            {loading ? (
              <div className="mt-1.5 space-y-1.5">
                <div className="h-4 w-64 animate-pulse rounded bg-white/[0.06]" />
                <div className="h-3 w-48 animate-pulse rounded bg-white/[0.04]" />
              </div>
            ) : briefing ? (
              <>
                <p className="mt-1 text-[15px] font-semibold leading-snug text-zinc-50">
                  {briefing.headline}
                </p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-400">
                  {briefing.subheadline}
                </p>
              </>
            ) : null}
          </div>
        </div>

        {/* Refresh */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="shrink-0 h-8 w-8 p-0 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </header>

      {/* ─── Body ─── */}
      <div className="relative">
        {loading ? (
          <BriefingSkeleton />
        ) : isEmpty ? (
          <BriefingEmpty />
        ) : (
          <div className="space-y-3">
            {/* Done items — what Oracle already finished */}
            {doneItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 px-1">
                  <CheckCircle2 className="size-3 text-emerald-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/80">
                    Done for you
                  </span>
                </div>
                <AnimatePresence mode="popLayout">
                  {doneItems.map((item, i) => (
                    <BriefingItemCard
                      key={item.id}
                      item={item}
                      index={i}
                      onAction={onNavigate}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Needs attention — what Oracle needs from you */}
            {attentionItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 px-1">
                  <AlertCircle className="size-3 text-amber-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/80">
                    Needs your sign-off
                  </span>
                </div>
                <AnimatePresence mode="popLayout">
                  {attentionItems.map((item, i) => (
                    <BriefingItemCard
                      key={item.id}
                      item={item}
                      index={i}
                      onAction={onNavigate}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Watchlist — things Oracle is monitoring */}
            {watchItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 px-1">
                  <Eye className="size-3 text-cyan-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400/80">
                    Watching
                  </span>
                </div>
                {watchItems.map((item, i) => (
                  <BriefingItemCard
                    key={item.id}
                    item={item}
                    index={i}
                    onAction={onNavigate}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Footer ─── */}
      {!isEmpty && !loading && (
        <footer className="relative mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
          <div className="flex items-center gap-3 text-[10px] text-zinc-500">
            {briefing?.stats && (
              <>
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="size-2.5 text-amber-400/60" />
                  {briefing.stats.paymentsMatched} matched
                </span>
                <span>·</span>
                <span>{briefing.stats.invoicesIssued} invoices</span>
                <span>·</span>
                <span>{briefing.stats.returnsPrepared} returns prepped</span>
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenOracle}
            className="gap-1.5 h-7 px-2.5 text-[11px] font-semibold text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
          >
            <Brain className="size-3" />
            Ask Oracle
            <ArrowRight className="size-3" />
          </Button>
        </footer>
      )}
    </motion.section>
  );
}

export const ProactiveOracleBriefing = React.memo(ProactiveOracleBriefingImpl);
export default ProactiveOracleBriefing;
