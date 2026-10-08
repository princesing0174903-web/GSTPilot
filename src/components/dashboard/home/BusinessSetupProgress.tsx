'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, ChevronDown, Sparkles } from 'lucide-react';
import {
  Cloud,
  BookOpen,
  FileText,
  Users,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * VEYRO Home — Business Setup Progress (collapsible, demoted)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Per Task 6 (Dashboard Premium Polish — Point 1): this card is now
 * COLLAPSIBLE and COLLAPSED BY DEFAULT. The full 6-item checklist was
 * stealing the spotlight from Oracle, so we demote it: when collapsed the
 * user sees only a compact one-line summary ("Setup: 5 of 6 complete · 83%")
 * with a chevron to expand. When expanded, AnimatePresence animates the
 * height auto so the reveal feels premium (Stripe / Linear tier).
 *
 * Layout note: the parent (DashboardPage) renders this AFTER the KPI stats
 * and Oracle banner so it no longer competes for first-paint attention.
 *
 * The progress bar still swipes in from width:0 → pct% on first paint
 * (Point 9 — entrance animation).
 */

export interface SetupTask {
  id: string;
  label: string;
  icon: LucideIcon;
  done: boolean;
  /** Called when the user clicks an incomplete task. */
  onAction: () => void;
  /**
   * When true, this incomplete task is rendered with a premium accent
   * highlight + a small CTA button. Use for the single highest-leverage
   * step (e.g. "Activate Oracle") so it stands out from the regular
   * checklist items and draws the user toward the core value prop.
   */
  highlight?: boolean;
}

interface BusinessSetupProgressProps {
  tasks: SetupTask[];
}

export function BusinessSetupProgress({ tasks }: BusinessSetupProgressProps) {
  const completed = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isComplete = completed === total;

  // Collapsed by default — the full checklist only appears when the user
  // explicitly asks for it. The compact summary is enough at-a-glance.
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' as const }}
      className="glass-surface rounded-2xl"
      aria-label="Business setup progress"
    >
      {/* Compact header — clickable to toggle. Always visible. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="setup-progress-body"
        className="w-full flex items-center justify-between gap-4 p-4 md:p-5 text-left transition-colors hover:bg-white/[0.02] rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg accent-gradient-soft shrink-0">
            <Sparkles className="h-4 w-4 accent-text" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground tracking-tight">
              Business Setup Progress
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isComplete
                ? 'Your workspace is fully configured'
                : `Setup: ${completed} of ${total} complete · ${pct}%`}
            </p>
          </div>
        </div>

        {/* Compact inline progress bar (always visible) */}
        <div className="hidden sm:block w-32 shrink-0">
          <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' as const }}
              className="h-full rounded-full accent-gradient"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isComplete ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Ready
            </span>
          ) : (
            <span className="text-sm font-bold accent-text tabular-nums">{pct}%</span>
          )}
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground"
          >
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </div>
      </button>

      {/* Expandable body — height-auto animation via AnimatePresence */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id="setup-progress-body"
            key="setup-progress-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as const }}
            className="overflow-hidden"
          >
            <div className="px-4 md:px-5 pb-5">
              {/* Full-width progress bar (visible only when expanded) */}
              <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden mb-5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' as const }}
                  className="h-full rounded-full accent-gradient"
                />
              </div>

              {/* Checklist */}
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5">
                {tasks.map((task) => {
                  const Icon = task.icon;
                  const showHighlight = !!task.highlight && !task.done;
                  return (
                    <li key={task.id}>
                      {showHighlight ? (
                        /* Highlighted task — the one step that unlocks the core value
                           prop (Activate Oracle). Visually distinct so the user's
                           eye lands here:
                             • accent-gradient-soft background (vs. plain glass for others)
                             • Sparkles icon in an accent-gradient chip that pulses
                               when not yet done, to draw attention
                             • "CORE FEATURE" pill next to the label
                             • Filled accent-gradient CTA (not ghost) */
                        <button
                          type="button"
                          onClick={task.onAction}
                          className="group w-full flex items-center gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/[0.06] px-2.5 py-2 text-left transition-colors hover:border-amber-500/60 cursor-pointer"
                        >
                          <span
                            className={`relative flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-amber-400 to-amber-600 ${!task.done ? 'animate-pulse' : ''}`}
                          >
                            <Sparkles className="h-3 w-3 text-white" />
                          </span>
                          <Icon className="h-4 w-4 shrink-0 text-amber-400" />
                          <span className="text-[12px] font-semibold text-foreground truncate flex-1 min-w-0">
                            {task.label}
                          </span>
                          <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[8px] font-bold uppercase tracking-wider text-amber-400 shrink-0">
                            Core Feature
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-amber-400 to-amber-500 px-2 py-0.5 text-[11px] font-bold text-white shrink-0 shadow-[0_0_16px_-4px_rgba(245,158,11,0.6)]">
                            <Sparkles className="h-2.5 w-2.5" />
                            Activate
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => !task.done && task.onAction()}
                          disabled={task.done}
                          className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
                            task.done
                              ? 'cursor-default'
                              : 'hover:bg-white/[0.04] cursor-pointer'
                          }`}
                        >
                          {task.done ? (
                            <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                          )}
                          <Icon
                            className={`h-3.5 w-3.5 shrink-0 ${
                              task.done ? 'text-blue-400/80' : 'text-muted-foreground'
                            }`}
                          />
                          <span
                            className={`text-[12px] truncate ${
                              task.done
                                ? 'text-muted-foreground line-through decoration-blue-400/40'
                                : 'text-foreground/90'
                            }`}
                          >
                            {task.label}
                          </span>
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

export default BusinessSetupProgress;

// Re-export the icons used by the parent so the task list stays co-located.
export const SetupIcons = {
  Cloud,
  BookOpen,
  FileText,
  Users,
  UserPlus,
  Sparkles,
};
