'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — OracleDailyBriefing
// ═══════════════════════════════════════════════════════════════════════════════
//
// The single most important card on the dashboard. Oracle wakes up with
// knowledge — it tells the user what it already did overnight + what needs
// their sign-off. Replaces the old passive Oracle widget.
//
// Layout (single full-width card, premium glass surface, amber-tinted border):
//
//   ┌─ Oracle AI   [Built-in · Live]            [mood badge] [Open →] ─┐
//   │                                                                │
//   │  "I've done 3 tasks — 2 need your sign-off"                    │
//   │   Review and approve to keep the workflow moving.              │
//   │                                                                │
//   │  ┌── DONE (emerald) ────┐  ┌── NEEDS APPROVAL (amber) ──────┐ │
//   │  │ ✓ matched 6 payments │  │ ⚠ 2 payments need review [→]   │ │
//   │  │ ✓ 3 invoices collected│ │ ⚠ GST prepared — file now [→]   │ │
//   │  └──────────────────────┘  └────────────────────────────────┘ │
//   │                                                                │
//   │  Watching: 1 return not started · 0 overdue invoices           │
//   └────────────────────────────────────────────────────────────────┘
//
// Props: briefing (OracleDailyBriefing | null), loading?, onNavigate?, onOpenOracle?
// States: loading skeleton → empty/welcome → populated
// ═══════════════════════════════════════════════════════════════════════════════

import { memo } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Zap,
  Eye,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  OracleDailyBriefing as OracleDailyBriefingData,
  BriefingItem,
} from '@/lib/oracle/daily-briefing';

// ─── Mood badge config ────────────────────────────────────────────────────────
//
// Maps Oracle's `mood` field → label + Tailwind classes. The label is what
// the user sees; the colors reinforce the mood (amber = proactive, emerald =
// on track, rose = concerned, zinc = monitoring / neutral).

type Mood = 'proactive' | 'monitoring' | 'celebrating' | 'concerned';

interface MoodConfig {
  label: string;
  badge: string;
  dot: string;
}

const MOOD_CONFIG: Record<Mood, MoodConfig> = {
  proactive: {
    label: 'Proactive',
    badge: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    dot: 'bg-amber-400',
  },
  monitoring: {
    label: 'Monitoring',
    badge: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
    dot: 'bg-zinc-400',
  },
  celebrating: {
    label: 'On Track',
    badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    dot: 'bg-emerald-400',
  },
  concerned: {
    label: 'Needs Attention',
    badge: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    dot: 'bg-rose-400',
  },
};

function moodConfigFor(mood: Mood | undefined): MoodConfig {
  if (!mood) return MOOD_CONFIG.monitoring;
  return MOOD_CONFIG[mood] ?? MOOD_CONFIG.monitoring;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Human-friendly "Updated Xm ago" / "Updated just now" label.
 * Falls back to empty string on invalid dates.
 */
function formatComputedAt(iso: string | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return 'Updated just now';
    if (diffMin < 60) return `Updated ${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `Updated ${diffHr}h ago`;
    return `Updated ${d.toLocaleDateString()}`;
  } catch {
    return '';
  }
}

// ─── Skeleton line ────────────────────────────────────────────────────────────

function SkeletonLine({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-white/[0.06]', className)}
    />
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function BriefingSkeleton() {
  return (
    <section className="relative overflow-hidden rounded-2xl glass-surface border-amber-500/15 p-5 md:p-6">
      {/* Ghost glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full bg-amber-500/[0.05] blur-3xl"
      />

      {/* Header */}
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-400/70 to-amber-600/70" />
          <div className="space-y-2">
            <SkeletonLine className="h-3.5 w-20" />
            <SkeletonLine className="h-2.5 w-14" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SkeletonLine className="h-6 w-20 rounded-full" />
          <SkeletonLine className="h-8 w-16" />
        </div>
      </div>

      {/* Headline */}
      <div className="relative mt-6 space-y-2.5">
        <SkeletonLine className="h-5 w-[85%]" />
        <SkeletonLine className="h-3.5 w-[55%]" />
      </div>

      {/* Two-column skeletons */}
      <div className="relative mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1].map((col) => (
          <div
            key={col}
            className={cn(
              'rounded-xl border p-3.5',
              col === 0
                ? 'border-emerald-500/15 bg-emerald-500/[0.03]'
                : 'border-amber-500/15 bg-amber-500/[0.03]',
            )}
          >
            <SkeletonLine
              className={cn(
                'mb-2.5 h-3 w-32',
                col === 0 ? 'bg-emerald-500/20' : 'bg-amber-500/20',
              )}
            />
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <SkeletonLine className="mt-0.5 h-4 w-4 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <SkeletonLine className="h-3 w-[80%]" />
                    <SkeletonLine className="h-2.5 w-[50%]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Empty / welcome state ────────────────────────────────────────────────────

interface BriefingEmptyProps {
  onOpenOracle?: () => void;
}

function BriefingEmpty({ onOpenOracle }: BriefingEmptyProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl glass-surface border-amber-500/15 p-5 md:p-6">
      {/* Amber glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full bg-amber-500/[0.07] blur-3xl"
      />

      <div className="relative flex items-start gap-4">
        {/* Pulsing Oracle logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-[0_0_20px_-4px_rgba(245,158,11,0.55)]"
        >
          <Brain className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-black" />
          </span>
        </motion.div>

        <div className="flex-1 pt-0.5">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold text-white">Oracle AI</h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
              <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400" />
              Built-in
            </span>
          </div>

          <motion.h3
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05, ease: 'easeOut' }}
            className="mt-3 text-lg font-semibold leading-snug text-white md:text-xl"
          >
            Welcome — I&apos;m Oracle, your AI CFO.
          </motion.h3>
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1, ease: 'easeOut' }}
            className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground"
          >
            Create your first invoice and I&apos;ll start watching your workflows —
            matching payments, preparing returns, and surfacing what needs your
            attention.
          </motion.p>

          {onOpenOracle && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15, ease: 'easeOut' }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenOracle}
                className="mt-4 h-8 border-amber-500/30 px-3 text-[12px] text-amber-400 hover:bg-amber-500/10"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Meet Oracle
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Column header ────────────────────────────────────────────────────────────

interface ColumnHeaderProps {
  icon: LucideIcon;
  label: string;
  count: number;
  tone: 'emerald' | 'amber';
}

function ColumnHeader({ icon: Icon, label, count, tone }: ColumnHeaderProps) {
  const chipClasses =
    tone === 'emerald'
      ? 'bg-emerald-500/15 text-emerald-400'
      : 'bg-amber-500/15 text-amber-400';
  const labelClasses =
    tone === 'emerald' ? 'text-emerald-300/80' : 'text-amber-300/80';

  return (
    <div className="mb-2.5 flex items-center gap-2 px-1">
      <div
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-md',
          chipClasses,
        )}
      >
        <Icon className="h-3 w-3" />
      </div>
      <span
        className={cn(
          'text-[10.5px] font-semibold uppercase tracking-wider',
          labelClasses,
        )}
      >
        {label}
        <span className="ml-1.5 tabular-nums opacity-70">· {count}</span>
      </span>
    </div>
  );
}

// ─── Done item ────────────────────────────────────────────────────────────────

interface DoneItemProps {
  item: BriefingItem;
  index: number;
}

const DoneItem = memo(function DoneItem({ item, index }: DoneItemProps) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.08 + index * 0.06, ease: 'easeOut' }}
      className="flex items-start gap-2.5 rounded-lg border border-emerald-500/10 bg-emerald-500/[0.03] p-2.5 transition-colors hover:border-emerald-500/20 hover:bg-emerald-500/[0.06]"
    >
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-snug text-white">
          {item.title}
        </p>
        {item.detail && (
          <p className="mt-0.5 text-[11.5px] leading-snug text-emerald-300/70">
            {item.detail}
          </p>
        )}
      </div>
      {typeof item.amount === 'number' && item.amount > 0 && (
        <span className="shrink-0 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10.5px] font-medium tabular-nums text-emerald-300">
          {formatAmount(item.amount)}
        </span>
      )}
    </motion.li>
  );
});

// ─── Attention item ───────────────────────────────────────────────────────────

interface AttentionItemProps {
  item: BriefingItem;
  index: number;
  onNavigate?: (view: string) => void;
}

const AttentionItem = memo(function AttentionItem({
  item,
  index,
  onNavigate,
}: AttentionItemProps) {
  const actionLabel = item.actionLabel ?? 'Review';
  const canNavigate = Boolean(item.actionView) && typeof onNavigate === 'function';

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.08 + index * 0.06, ease: 'easeOut' }}
      className="flex items-start gap-2.5 rounded-lg border border-amber-500/15 bg-amber-500/[0.03] p-2.5 transition-colors hover:border-amber-500/25 hover:bg-amber-500/[0.06]"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-snug text-white">
          {item.title}
        </p>
        {item.detail && (
          <p className="mt-0.5 text-[11.5px] leading-snug text-amber-200/70">
            {item.detail}
          </p>
        )}
      </div>
      {canNavigate && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (item.actionView) onNavigate?.(item.actionView);
          }}
          className="h-7 shrink-0 border-amber-500/30 px-2.5 text-[11px] text-amber-400 hover:bg-amber-500/10"
        >
          {actionLabel}
          <ArrowRight className="h-3 w-3" />
        </Button>
      )}
    </motion.li>
  );
});

// ─── Empty column copy ────────────────────────────────────────────────────────

function EmptyColumnCopy({ tone }: { tone: 'emerald' | 'amber' }) {
  if (tone === 'emerald') {
    return (
      <p className="px-1 py-2 text-[12px] leading-relaxed text-muted-foreground">
        Nothing yet — Oracle will surface wins here as invoices are collected
        and payments are matched.
      </p>
    );
  }
  return (
    <p className="px-1 py-2 text-[12px] leading-relaxed text-muted-foreground">
      All clear — nothing waiting on you right now.
    </p>
  );
}

// ─── Amount formatter (mirrors daily-briefing engine) ─────────────────────────

function formatAmount(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface OracleDailyBriefingProps {
  briefing: OracleDailyBriefingData | null;
  loading?: boolean;
  onNavigate?: (view: string) => void;
  onOpenOracle?: () => void;
}

function OracleDailyBriefingImpl({
  briefing,
  loading,
  onNavigate,
  onOpenOracle,
}: OracleDailyBriefingProps) {
  // Loading state — skeleton, but keep the card visible so the dashboard
  // doesn't shift on first paint.
  if (loading && !briefing) {
    return <BriefingSkeleton />;
  }

  // Empty / welcome state — first-time users see Oracle introducing itself.
  if (!briefing) {
    return <BriefingEmpty onOpenOracle={onOpenOracle} />;
  }

  const mood = moodConfigFor(briefing.mood as Mood);
  const doneItems = briefing.done.slice(0, 4);
  const attentionItems = briefing.needsAttention.slice(0, 4);
  const watchItems = briefing.watchlist.slice(0, 4);

  const updatedAt = formatComputedAt(briefing.computedAt);
  const hasColumns = doneItems.length > 0 || attentionItems.length > 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-2xl glass-surface border-amber-500/15 p-5 md:p-6"
      aria-label="Oracle daily briefing"
    >
      {/* Background amber glow — top right corner */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full bg-amber-500/[0.06] blur-3xl"
      />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="relative flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {/* Oracle logo — gradient amber square with Brain + live ping */}
          <div className="relative">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-[0_0_20px_-4px_rgba(245,158,11,0.55)]"
            >
              <Brain className="h-5 w-5" />
            </motion.div>
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5"
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-black" />
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="truncate text-[15px] font-semibold text-white">
                Oracle AI
              </h2>
              {/* Built-in live pulse badge */}
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400" />
                Built-in
              </span>
            </div>
            {updatedAt && (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {updatedAt}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Mood badge */}
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
              mood.badge,
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', mood.dot)} />
            {mood.label}
          </span>

          {/* Open Oracle button */}
          {onOpenOracle && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenOracle}
              className="h-8 border-amber-500/30 px-2.5 text-[12px] text-amber-400 hover:bg-amber-500/10"
            >
              Open
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </header>

      {/* ── Headline ──────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05, ease: 'easeOut' }}
        className="relative mt-5"
      >
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 hidden h-4 w-4 shrink-0 text-amber-400/80 sm:block" />
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold leading-snug text-white md:text-xl">
              &ldquo;{briefing.headline}&rdquo;
            </h3>
            {briefing.subheadline && (
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {briefing.subheadline}
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Two columns: Done + Needs Approval ───────────────────────── */}
      {hasColumns && (
        <div className="relative mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* DONE column */}
          <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.02] p-3.5">
            <ColumnHeader
              icon={CheckCircle2}
              label="Done"
              count={doneItems.length}
              tone="emerald"
            />
            {doneItems.length > 0 ? (
              <ul className="space-y-2">
                {doneItems.map((item, i) => (
                  <DoneItem key={item.id} item={item} index={i} />
                ))}
              </ul>
            ) : (
              <EmptyColumnCopy tone="emerald" />
            )}
          </div>

          {/* ATTENTION column */}
          <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.02] p-3.5">
            <ColumnHeader
              icon={AlertTriangle}
              label="Needs Approval"
              count={attentionItems.length}
              tone="amber"
            />
            {attentionItems.length > 0 ? (
              <ul className="space-y-2">
                {attentionItems.map((item, i) => (
                  <AttentionItem
                    key={item.id}
                    item={item}
                    index={i}
                    onNavigate={onNavigate}
                  />
                ))}
              </ul>
            ) : (
              <EmptyColumnCopy tone="amber" />
            )}
          </div>
        </div>
      )}

      {/* ── Watchlist footer ─────────────────────────────────────────── */}
      {watchItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.22, ease: 'easeOut' }}
          className="relative mt-4 flex items-center gap-2 border-t border-white/[0.04] pt-3 text-[11.5px]"
        >
          <Eye className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          <span className="shrink-0 text-zinc-400/80">Watching:</span>
          <span className="truncate text-muted-foreground">
            {watchItems.map((w) => w.title).join(' · ')}
          </span>
        </motion.div>
      )}
    </motion.section>
  );
}

// React.memo at the top level so parent re-renders don't reflow the briefing
// unless its props actually change.
export const OracleDailyBriefing = memo(OracleDailyBriefingImpl);
export default OracleDailyBriefing;
