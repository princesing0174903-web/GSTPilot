'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Action Cards (Phase 3 — Agent Engine™)
//
// Every Oracle response ends with 3 large glass Action Cards. Single click
// spawns an Oracle Task in the Agent Execution Panel.
//
// Design:
//   • Premium glass surface, accent glow on hover
//   • Action-kind-driven icon + tint (each action type has a unique color)
//   • Title (action verb) + description + impact line
//   • "Run" pill on the right that animates on hover
//
// Layout: responsive — 3 columns on desktop, 1 column on mobile.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import { ArrowRight, Play, Sparkles, Zap } from 'lucide-react';
import type { OracleActionCard } from './oracle-types';
import { ACTION_LIBRARY } from './oracle-actions';
import { cn } from '@/lib/utils';

export interface OracleActionCardsProps {
  cards: OracleActionCard[];
  /** Click handler — receives the card. The parent spawns the Oracle Task. */
  onRun?: (card: OracleActionCard) => void;
  /** Disable all cards (e.g. while a task is already running) */
  disabled?: boolean;
  className?: string;
}

export function OracleActionCards({
  cards,
  onRun,
  disabled = false,
  className,
}: OracleActionCardsProps) {
  if (!cards || cards.length === 0) return null;

  return (
    <div className={cn('space-y-2.5', className)}>
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Zap className="h-3.5 w-3.5 accent-text" />
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Suggested Actions
        </h4>
        <span className="text-[9px] text-muted-foreground/60">
          · Click to execute
        </span>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {cards.slice(0, 3).map((card, i) => (
          <ActionCard
            key={i}
            card={card}
            index={i}
            disabled={disabled}
            onRun={() => onRun?.(card)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Single Action Card ──────────────────────────────────────────────────────

function ActionCard({
  card,
  index,
  disabled,
  onRun,
}: {
  card: OracleActionCard;
  index: number;
  disabled?: boolean;
  onRun: () => void;
}) {
  const meta = ACTION_LIBRARY[card.kind];
  const Icon = meta?.icon ?? Sparkles;
  const colorClass = meta?.colorClass ?? 'text-emerald-500';
  const tintClass = meta?.tintClass ?? 'bg-emerald-500/[0.10]';
  const borderClass = meta?.borderClass ?? 'border-emerald-500/25';

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      whileHover={disabled ? undefined : { y: -3, scale: 1.01 }}
      whileTap={disabled ? undefined : { scale: 0.99 }}
      onClick={() => {
        if (disabled) return;
        onRun();
      }}
      disabled={disabled}
      className={cn(
        'group relative flex flex-col gap-2.5 overflow-hidden rounded-2xl border bg-card/[0.4] p-3.5 text-left backdrop-blur-xl transition-all',
        borderClass,
        disabled
          ? 'cursor-not-allowed opacity-60'
          : 'cursor-pointer hover:bg-card/[0.6] hover:shadow-[0_8px_32px_-12px_rgba(0,229,255,0.18)]',
      )}
    >
      {/* Glow accent on hover */}
      <div
        className={cn(
          'pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100',
          tintClass,
        )}
      />

      {/* Header: icon + run pill */}
      <div className="relative flex items-center justify-between">
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg',
            tintClass,
          )}
        >
          <Icon className={cn('h-4 w-4', colorClass)} />
        </div>
        <div
          className={cn(
            'flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider opacity-0 transition-all group-hover:opacity-100',
            tintClass,
            colorClass,
          )}
        >
          <Play className="h-2.5 w-2.5 fill-current" />
          Run
        </div>
      </div>

      {/* Title */}
      <p className="relative text-sm font-semibold leading-snug text-foreground">
        {card.title}
      </p>

      {/* Description */}
      <p className="relative line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
        {card.description}
      </p>

      {/* Impact line (optional) */}
      {card.impact && (
        <div className="relative mt-auto flex items-center gap-1 pt-1 text-[10px] font-medium">
          <ArrowRight className={cn('h-2.5 w-2.5', colorClass)} />
          <span className={colorClass}>{card.impact}</span>
        </div>
      )}
    </motion.button>
  );
}

export default OracleActionCards;
