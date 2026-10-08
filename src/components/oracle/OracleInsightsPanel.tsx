'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Insights Panel (Phase 2 — VEYRO AI Intelligence™)
//
// A live, always-on strategic signal panel. Shows 5 insights derived from
// the live Business Memory:
//
//   • Top Opportunity   — where to act next (green)
//   • Top Risk          — what threatens the business (red/amber)
//   • Growth Signal     — revenue/expansion indicator (green/neutral)
//   • Compliance Signal — filings/ITC posture (amber/green)
//   • Cash Signal       — liquidity position (neutral/amber)
//
// Two display modes:
//   • `variant="grid"`    — 5 cards in a responsive grid (used in empty state)
//   • `variant="strip"`   — compact horizontal strip (used above input bar)
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { OracleInsights, OracleInsight, InsightTone } from './oracle-types';
import { cn } from '@/lib/utils';

// ─── Tone → Style mapping ────────────────────────────────────────────────────

const TONE_STYLE: Record<
  InsightTone,
  { dot: string; chipBg: string; chipText: string; border: string; iconColor: string }
> = {
  positive: {
    dot: 'bg-emerald-400',
    chipBg: 'bg-emerald-500/[0.08]',
    chipText: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/20',
    iconColor: 'text-emerald-500',
  },
  negative: {
    dot: 'bg-red-400',
    chipBg: 'bg-red-500/[0.08]',
    chipText: 'text-red-600 dark:text-red-400',
    border: 'border-red-500/20',
    iconColor: 'text-red-500',
  },
  warning: {
    dot: 'bg-amber-400',
    chipBg: 'bg-amber-500/[0.08]',
    chipText: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/20',
    iconColor: 'text-amber-500',
  },
  neutral: {
    dot: 'bg-slate-400',
    chipBg: 'bg-slate-500/[0.08]',
    chipText: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-500/15',
    iconColor: 'text-slate-500',
  },
};

// ─── Insight Slot Definitions ────────────────────────────────────────────────

interface SlotDef {
  key: keyof OracleInsights;
  label: string;
  icon: LucideIcon;
}

const SLOTS: SlotDef[] = [
  { key: 'topOpportunity', label: 'Top Opportunity', icon: Sparkles },
  { key: 'topRisk', label: 'Top Risk', icon: AlertTriangle },
  { key: 'growthSignal', label: 'Growth Signal', icon: TrendingUp },
  { key: 'complianceSignal', label: 'Compliance Signal', icon: ShieldCheck },
  { key: 'cashSignal', label: 'Cash Signal', icon: Banknote },
];

// ─── Component ───────────────────────────────────────────────────────────────

export interface OracleInsightsPanelProps {
  insights: OracleInsights;
  variant?: 'grid' | 'strip';
  /** Optional click handler — when set, the panel becomes interactive. */
  onInsightClick?: (key: keyof OracleInsights, insight: OracleInsight) => void;
  className?: string;
}

export function OracleInsightsPanel({
  insights,
  variant = 'grid',
  onInsightClick,
  className,
}: OracleInsightsPanelProps) {
  if (variant === 'strip') {
    return (
      <div
        className={cn(
          'flex items-stretch gap-2 overflow-x-auto custom-scrollbar',
          className,
        )}
      >
        {SLOTS.map((slot) => (
          <InsightChip
            key={slot.key}
            slot={slot}
            insight={insights[slot.key]}
            onClick={
              onInsightClick
                ? () => onInsightClick(slot.key, insights[slot.key])
                : undefined
            }
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {SLOTS.map((slot, i) => (
        <InsightCard
          key={slot.key}
          slot={slot}
          insight={insights[slot.key]}
          index={i}
          onClick={
            onInsightClick
              ? () => onInsightClick(slot.key, insights[slot.key])
              : undefined
          }
        />
      ))}
    </div>
  );
}

// ─── Insight Card (grid variant) ─────────────────────────────────────────────

function InsightCard({
  slot,
  insight,
  index,
  onClick,
}: {
  slot: SlotDef;
  insight: OracleInsight;
  index: number;
  onClick?: () => void;
}) {
  const Icon = slot.icon;
  const style = TONE_STYLE[insight.tone];
  const Comp = onClick ? motion.button : motion.div;

  return (
    <Comp
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={onClick ? { y: -2 } : undefined}
      onClick={onClick}
      className={cn(
        'group flex flex-col gap-1.5 rounded-2xl border bg-card/[0.3] p-3 text-left transition-all',
        style.border,
        onClick && 'cursor-pointer hover:bg-card/[0.5]',
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-md',
            style.chipBg,
          )}
        >
          <Icon className={cn('h-3 w-3', style.iconColor)} />
        </div>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {slot.label}
        </span>
        <span className={cn('ml-auto h-1.5 w-1.5 rounded-full', style.dot)} />
      </div>
      <p className="text-sm font-medium text-foreground">{insight.label}</p>
      <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
        {insight.detail}
      </p>
    </Comp>
  );
}

// ─── Insight Chip (strip variant) ────────────────────────────────────────────

function InsightChip({
  slot,
  insight,
  onClick,
}: {
  slot: SlotDef;
  insight: OracleInsight;
  onClick?: () => void;
}) {
  const Icon = slot.icon;
  const style = TONE_STYLE[insight.tone];

  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex shrink-0 items-center gap-2 rounded-xl border bg-card/[0.3] px-2.5 py-1.5 text-left transition-all hover:bg-card/[0.55]',
        style.border,
      )}
      title={insight.detail}
    >
      <div
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-md',
          style.chipBg,
        )}
      >
        <Icon className={cn('h-2.5 w-2.5', style.iconColor)} />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">
          {slot.label}
        </span>
        <span className="truncate text-[11px] font-medium text-foreground">
          {insight.label}
        </span>
      </div>
      <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-foreground/70" />
    </button>
  );
}

export default OracleInsightsPanel;
