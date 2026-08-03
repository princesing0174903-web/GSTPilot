'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — WorkflowPipeline™
// ═══════════════════════════════════════════════════════════════════════════════
//
// The premium visual pipeline that shows the live state of the canonical
// business workflow:
//
//   Invoice Created → Customer Pays → Bank Detects → Auto-Match →
//     GST Updates → Oracle Reviews → User Approves → Done
//
// Each stage is a clickable glass card with:
//   • an icon (lucide-react)
//   • a big live count (tabular-nums) — 0 renders as "✓"
//   • a status dot (emerald / amber / rose / zinc)
//   • a short description
//   • a hover popover showing up to 3 sample items (when count > 0)
//
// The "User Approves" stage glows with a subtle amber pulse when it has items
// waiting — it's the action bottleneck that needs the user's attention.
//
// Data source: `WorkflowPipeline` from `@/lib/workflow/engine` (real Prisma
// counts, no mocks).
//
// Theme: pure-black GSTPilot dark theme. Glass surfaces, emerald primary,
// amber warning, rose critical, zinc clear. NO indigo, NO blue as primary.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Workflow as WorkflowIcon,
  FileText,
  Wallet,
  Landmark,
  GitBranch,
  Receipt,
  Brain,
  CheckCircle2,
  Trophy,
  ChevronRight,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  MinusCircle,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from '@/components/ui/hover-card';
import type {
  WorkflowPipeline,
  WorkflowStage,
  WorkflowStageId,
  StageStatus,
} from '@/lib/workflow/engine';

// ─── Stage visual metadata ───────────────────────────────────────────────────

interface StageMeta {
  icon: LucideIcon;
  shortLabel: string;
}

const STAGE_META: Record<WorkflowStageId, StageMeta> = {
  'invoice-created': { icon: FileText, shortLabel: 'Invoice' },
  'customer-pays': { icon: Wallet, shortLabel: 'Payment' },
  'bank-detects': { icon: Landmark, shortLabel: 'Bank' },
  'auto-match': { icon: GitBranch, shortLabel: 'Match' },
  'gst-updates': { icon: Receipt, shortLabel: 'GST' },
  'oracle-reviews': { icon: Brain, shortLabel: 'Oracle' },
  'user-approves': { icon: CheckCircle2, shortLabel: 'Approve' },
  'done': { icon: Trophy, shortLabel: 'Done' },
};

// Ordered stage ids — drives the render order
const STAGE_ORDER: WorkflowStageId[] = [
  'invoice-created',
  'customer-pays',
  'bank-detects',
  'auto-match',
  'gst-updates',
  'oracle-reviews',
  'user-approves',
  'done',
];

// ─── Status styling tokens ───────────────────────────────────────────────────

interface StatusStyle {
  dot: string;
  iconWrap: string;
  iconColor: string;
  countColor: string;
  borderHover: string;
  ring: string;
  shadow: string;
}

const STATUS_STYLES: Record<StageStatus, StatusStyle> = {
  healthy: {
    dot: 'bg-emerald-500',
    iconWrap: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    countColor: 'text-emerald-300',
    borderHover: 'hover:border-emerald-500/40',
    ring: 'ring-emerald-500/20',
    shadow: 'shadow-[0_0_24px_-6px_rgba(16,185,129,0.25)]',
  },
  warning: {
    dot: 'bg-amber-500',
    iconWrap: 'bg-amber-500/10',
    iconColor: 'text-amber-400',
    countColor: 'text-amber-300',
    borderHover: 'hover:border-amber-500/40',
    ring: 'ring-amber-500/20',
    shadow: 'shadow-[0_0_24px_-6px_rgba(245,158,11,0.25)]',
  },
  critical: {
    dot: 'bg-rose-500',
    iconWrap: 'bg-rose-500/10',
    iconColor: 'text-rose-400',
    countColor: 'text-rose-300',
    borderHover: 'hover:border-rose-500/40',
    ring: 'ring-rose-500/20',
    shadow: 'shadow-[0_0_24px_-6px_rgba(244,63,94,0.3)]',
  },
  clear: {
    dot: 'bg-zinc-600',
    iconWrap: 'bg-white/[0.04]',
    iconColor: 'text-zinc-500',
    countColor: 'text-zinc-400',
    borderHover: 'hover:border-white/[0.12]',
    ring: 'ring-white/[0.04]',
    shadow: '',
  },
};

// ─── Health badge metadata ───────────────────────────────────────────────────

interface HealthMeta {
  label: string;
  dot: string;
  text: string;
  chip: string;
  Icon: LucideIcon;
}

const HEALTH_META: Record<StageStatus, HealthMeta> = {
  healthy: {
    label: 'Healthy',
    dot: 'bg-emerald-500',
    text: 'text-emerald-300',
    chip: 'bg-emerald-500/10 border-emerald-500/25',
    Icon: CheckCircle,
  },
  warning: {
    label: 'Warning',
    dot: 'bg-amber-500',
    text: 'text-amber-300',
    chip: 'bg-amber-500/10 border-amber-500/25',
    Icon: AlertTriangle,
  },
  critical: {
    label: 'Critical',
    dot: 'bg-rose-500',
    text: 'text-rose-300',
    chip: 'bg-rose-500/10 border-rose-500/25',
    Icon: AlertOctagon,
  },
  clear: {
    label: 'Clear',
    dot: 'bg-zinc-600',
    text: 'text-zinc-400',
    chip: 'bg-white/[0.04] border-white/[0.06]',
    Icon: MinusCircle,
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtINR = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
});
function formatAmount(n?: number): string | null {
  if (n == null || !isFinite(n)) return null;
  return '₹' + fmtINR.format(n);
}

function formatCount(n: number): string {
  return fmtINR.format(n);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function HealthBadge({ health }: { health: StageStatus }) {
  const meta = HEALTH_META[health] ?? HEALTH_META.clear;
  const Icon = meta.Icon;
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${meta.chip}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {health !== 'clear' && (
          <motion.span
            className={`absolute inline-flex h-full w-full rounded-full ${meta.dot} opacity-60`}
            animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      </span>
      <span className={`text-[10px] font-semibold uppercase tracking-wider ${meta.text}`}>
        {meta.label}
      </span>
      <Icon className={`size-3 ${meta.text}`} />
    </div>
  );
}

// ─── Stage Card ──────────────────────────────────────────────────────────────

interface StageCardProps {
  stage: WorkflowStage;
  index: number;
  onNavigate?: (view: string) => void;
}

const StageCard = React.memo(function StageCard({
  stage,
  index,
  onNavigate,
}: StageCardProps) {
  const meta = STAGE_META[stage.id];
  const Icon = meta.icon;
  const styles = STATUS_STYLES[stage.status] ?? STATUS_STYLES.clear;
  const isApproveStage = stage.id === 'user-approves';
  const isDoneStage = stage.id === 'done';
  const hasItems = stage.count > 0 && stage.items.length > 0;
  const isPulsing = isApproveStage && stage.count > 0;
  const isClear = stage.count === 0;

  const handleClick = useCallback(() => {
    if (stage.view && onNavigate) onNavigate(stage.view);
  }, [stage.view, onNavigate]);

  const card = (
    <motion.button
      type="button"
      onClick={handleClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
      className={`
        group relative w-full overflow-hidden rounded-2xl border border-white/[0.06]
        bg-white/[0.02] p-3 text-left transition-colors duration-300
        focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40
        ${styles.borderHover}
        ${stage.view ? 'cursor-pointer' : 'cursor-default'}
      `}
    >
      {/* Pulsing glow for the action bottleneck (User Approves with items) */}
      {isPulsing && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-amber-400/40"
          animate={{ opacity: [0.35, 0.85, 0.35] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      {isPulsing && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-1 rounded-2xl bg-amber-500/10 blur-md"
          animate={{ opacity: [0.2, 0.55, 0.2] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Top row: icon + status dot */}
      <div className="relative mb-2 flex items-center justify-between">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${styles.iconWrap}`}
        >
          <Icon className={`size-3.5 ${styles.iconColor}`} />
        </div>
        <span
          className={`inline-flex h-1.5 w-1.5 rounded-full ${styles.dot}`}
          title={stage.status}
        />
      </div>

      {/* Big count or ✓ */}
      <div className="relative">
        {isClear ? (
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-bold tabular-nums ${styles.countColor}`}>
              ✓
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Clear
            </span>
          </div>
        ) : (
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-bold tabular-nums ${styles.countColor}`}>
              {formatCount(stage.count)}
            </span>
            {isDoneStage && (
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                this mo.
              </span>
            )}
          </div>
        )}
      </div>

      {/* Label */}
      <p className="relative mt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-300">
        {meta.shortLabel}
      </p>

      {/* Description */}
      <p className="relative mt-0.5 line-clamp-2 text-[10px] leading-tight text-zinc-500">
        {stage.description}
      </p>

      {/* Hover hint chevron if clickable */}
      {stage.view && (
        <ChevronRight
          className="absolute right-2 top-2 size-3 text-zinc-600 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          aria-hidden
        />
      )}
    </motion.button>
  );

  // If no sample items, render the card directly (no hover popover)
  if (!hasItems) {
    return card;
  }

  // Otherwise, wrap in a HoverCard showing up to 3 sample items
  return (
    <HoverCard openDelay={250} closeDelay={150}>
      <HoverCardTrigger asChild>{card}</HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="center"
        sideOffset={6}
        className="z-50 w-60 border border-white/[0.08] bg-zinc-950/95 p-2 text-zinc-200 backdrop-blur-xl"
      >
        <div className="mb-1.5 flex items-center gap-1.5 px-1">
          <Sparkles className="size-3 text-emerald-400" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            {stage.count} active · sample
          </span>
        </div>
        <ul className="space-y-1">
          {stage.items.slice(0, 3).map((item, i) => {
            const amt = formatAmount(item.amount);
            return (
              <li
                key={item.id ?? i}
                className="flex items-start justify-between gap-2 rounded-md bg-white/[0.03] px-2 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-zinc-200">
                    {item.title}
                  </p>
                  <p className="truncate text-[10px] text-zinc-500">
                    {item.subtitle}
                  </p>
                </div>
                {amt && (
                  <span className="shrink-0 text-[10px] font-semibold tabular-nums text-emerald-300">
                    {amt}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {stage.view && (
          <p className="mt-1.5 px-1 text-[10px] text-zinc-500">
            Click to open →
          </p>
        )}
      </HoverCardContent>
    </HoverCard>
  );
});

// ─── Skeleton Card (loading state) ───────────────────────────────────────────

function SkeletonCard({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: 'easeOut' }}
      className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="h-7 w-7 animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/[0.08]" />
      </div>
      <div className="h-7 w-12 animate-pulse rounded-md bg-white/[0.06]" />
      <div className="mt-2 h-2.5 w-16 animate-pulse rounded bg-white/[0.06]" />
      <div className="mt-1.5 h-2 w-20 animate-pulse rounded bg-white/[0.04]" />
    </motion.div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.06] bg-emerald-500/[0.06]">
        <Trophy className="size-5 text-emerald-400/80" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-zinc-200">
          Your workflow is quiet
        </p>
        <p className="max-w-sm text-xs text-zinc-500">
          Create an invoice to start the pipeline — payments, bank matching,
          GST updates, and Oracle reviews will flow through here automatically.
        </p>
      </div>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export interface WorkflowPipelineProps {
  pipeline: WorkflowPipeline | null;
  loading?: boolean;
  onNavigate?: (view: string) => void;
  onRefresh?: () => void;
}

function WorkflowPipelineImpl({
  pipeline,
  loading = false,
  onNavigate,
  onRefresh,
}: WorkflowPipelineProps) {
  // Order stages according to STAGE_ORDER (defensive — pipeline.stages may be
  // in any order or missing entries; we always render all 8 slots).
  const stages = useMemo<WorkflowStage[]>(() => {
    if (!pipeline?.stages?.length) return [];
    const byId = new Map(pipeline.stages.map((s) => [s.id, s]));
    return STAGE_ORDER.map((id) => byId.get(id)).filter(Boolean) as WorkflowStage[];
  }, [pipeline]);

  const isEmpty = useMemo(() => {
    if (!pipeline) return true;
    if (stages.length === 0) return true;
    return stages.every((s) => s.count === 0);
  }, [pipeline, stages]);

  const health: StageStatus = pipeline?.health ?? 'clear';
  const totalActive: number = pipeline?.totalActive ?? 0;

  const handleRefresh = useCallback(() => {
    onRefresh?.();
  }, [onRefresh]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="glass-surface rounded-2xl border border-white/[0.06] p-4 md:p-5"
      aria-label="Today's workflow pipeline"
    >
      {/* ─── Header ─── */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
            <WorkflowIcon className="size-4 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              Today&apos;s Workflow
            </h2>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">
              Live pipeline · 8 stages
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Health badge */}
          <HealthBadge health={health} />

          {/* Total active count */}
          <div className="hidden items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 sm:inline-flex">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Active
            </span>
            <span className="text-[11px] font-bold tabular-nums text-zinc-200">
              {formatCount(totalActive)}
            </span>
          </div>

          {/* Refresh */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="h-8 gap-1.5 px-2.5 text-[11px] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
          >
            <RefreshCw
              className={`size-3 ${loading ? 'animate-spin' : ''}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </header>

      {/* ─── Body ─── */}
      {loading ? (
        // Loading: 8 skeleton cards in the same responsive grid
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:flex-row lg:items-stretch lg:gap-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <React.Fragment key={i}>
              <div className="lg:min-w-0 lg:flex-1">
                <SkeletonCard index={i} />
              </div>
              {i < 7 && (
                <div className="hidden lg:flex lg:w-4 lg:shrink-0 lg:items-center lg:justify-center">
                  <ChevronRight className="size-3 text-white/15" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      ) : isEmpty ? (
        <EmptyState />
      ) : (
        // Render the 8 stages with arrow connectors on lg+
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:flex-row lg:items-stretch lg:gap-0">
          {stages.map((stage, i) => (
            <React.Fragment key={stage.id}>
              <div className="lg:min-w-0 lg:flex-1">
                <StageCard
                  stage={stage}
                  index={i}
                  onNavigate={onNavigate}
                />
              </div>
              {i < stages.length - 1 && (
                <div className="hidden lg:flex lg:w-4 lg:shrink-0 lg:items-center lg:justify-center">
                  <ChevronRight className="size-3 text-white/15" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* ─── Footer legend (desktop only) ─── */}
      {!loading && !isEmpty && (
        <footer className="mt-4 hidden items-center gap-4 border-t border-white/[0.04] pt-3 md:flex">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            Status:
          </span>
          <LegendDot color="bg-emerald-500" label="Healthy" />
          <LegendDot color="bg-amber-500" label="Warning" />
          <LegendDot color="bg-rose-500" label="Critical" />
          <LegendDot color="bg-zinc-600" label="Clear" />
          <span className="ml-auto text-[10px] text-zinc-600">
            {pipeline?.computedAt
              ? `Updated ${new Date(pipeline.computedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
              : null}
          </span>
        </footer>
      )}
    </motion.section>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      <span className="text-[10px] text-zinc-400">{label}</span>
    </span>
  );
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export const WorkflowPipeline = React.memo(WorkflowPipelineImpl);
export default WorkflowPipeline;
