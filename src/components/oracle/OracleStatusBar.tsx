'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Status Bar (Phase 3 — Agent Engine™)
//
// A slim status indicator reflecting Oracle's current operational state.
// Like Claude Code's status line / Cursor Agent's status pill.
//
// States:
//   idle       → soft gray dot, "Oracle ready"
//   thinking   → animated pulsing dots, "Oracle thinking…"
//   working    → spinner + task title, "Oracle working · <task>"
//   waiting    → amber dot, "Oracle waiting for your input"
//   completed  → green check, "Oracle completed · just now"
//
// Also shows live counts: Running / Scheduled / Completed tasks (right side).
// ═══════════════════════════════════════════════════════════════════════════════

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, Loader2, MessageSquare, Timer } from 'lucide-react';
import type { OracleAgentStatus } from './oracle-types';
import { cn } from '@/lib/utils';

export interface OracleStatusBarProps {
  status: OracleAgentStatus;
  /** When status === 'working', the active task title */
  workingTitle?: string;
  /** Live task counts shown on the right */
  counts?: { running: number; scheduled: number; completed: number };
  /** Click handler for the counts cluster (opens the Agent Panel) */
  onOpenAgent?: () => void;
  className?: string;
}

// ─── Status Definition ───────────────────────────────────────────────────────

interface StatusDef {
  label: string;
  dotClass: string;
  textClass: string;
  bgClass: string;
}

function statusDef(status: OracleAgentStatus): StatusDef {
  switch (status) {
    case 'thinking':
      return {
        label: 'Oracle thinking',
        dotClass: 'bg-cyan-400',
        textClass: 'text-foreground',
        bgClass: 'bg-cyan-500/[0.08] border-cyan-500/20',
      };
    case 'working':
      return {
        label: 'Oracle working',
        dotClass: 'bg-cyan-400',
        textClass: 'text-foreground',
        bgClass: 'bg-cyan-500/[0.08] border-cyan-500/20',
      };
    case 'waiting':
      return {
        label: 'Waiting for your input',
        dotClass: 'bg-amber-400',
        textClass: 'text-amber-600 dark:text-amber-400',
        bgClass: 'bg-amber-500/[0.08] border-amber-500/20',
      };
    case 'completed':
      return {
        label: 'Oracle completed',
        dotClass: 'bg-cyan-400',
        textClass: 'text-cyan-600 dark:text-cyan-400',
        bgClass: 'bg-cyan-500/[0.06] border-cyan-500/15',
      };
    case 'idle':
    default:
      return {
        label: 'Oracle ready',
        dotClass: 'bg-slate-400',
        textClass: 'text-muted-foreground',
        bgClass: 'bg-card/[0.3] border-border',
      };
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function OracleStatusBar({
  status,
  workingTitle,
  counts,
  onOpenAgent,
  className,
}: OracleStatusBarProps) {
  const def = statusDef(status);
  const hasCounts = counts && (counts.running > 0 || counts.scheduled > 0 || counts.completed > 0);

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs',
        def.bgClass,
        className,
      )}
    >
      {/* Status indicator (left) */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {status === 'thinking' && (
          <span className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className={cn('h-1.5 w-1.5 rounded-full', def.dotClass)}
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
              />
            ))}
          </span>
        )}
        {status === 'working' && (
          <Loader2 className={cn('h-3.5 w-3.5 animate-spin', def.textClass)} />
        )}
        {status === 'waiting' && (
          <MessageSquare className={cn('h-3.5 w-3.5', def.textClass)} />
        )}
        {status === 'completed' && (
          <CheckCircle2 className={cn('h-3.5 w-3.5', def.textClass)} />
        )}
        {status === 'idle' && (
          <Circle className={cn('h-3 w-3', def.dotClass)} />
        )}

        <span className={cn('truncate font-medium', def.textClass)}>
          {def.label}
          {status === 'working' && workingTitle && (
            <span className="text-muted-foreground"> · {workingTitle}</span>
          )}
        </span>
      </div>

      {/* Counts cluster (right) */}
      {hasCounts && (
        <button
          onClick={onOpenAgent}
          className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card/[0.4] px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-card/[0.7] hover:text-foreground"
          aria-label="Open Oracle Tasks panel"
        >
          <AnimatePresence mode="popLayout">
            {counts.running > 0 && (
              <motion.span
                key="running"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400"
              >
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                {counts.running}
              </motion.span>
            )}
            {counts.scheduled > 0 && (
              <motion.span
                key="scheduled"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1 text-amber-600 dark:text-amber-400"
              >
                <Timer className="h-2.5 w-2.5" />
                {counts.scheduled}
              </motion.span>
            )}
            {counts.completed > 0 && (
              <motion.span
                key="completed"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"
              >
                <CheckCircle2 className="h-2.5 w-2.5" />
                {counts.completed}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      )}
    </div>
  );
}

export default OracleStatusBar;
