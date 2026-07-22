'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle } from 'lucide-react';
import {
  Cloud,
  BookOpen,
  FileText,
  Users,
  UserPlus,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GSTPilot Home — Business Setup Progress (real onboarding engine)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Replaces the old "4 Steps Away" placeholder with a real checklist that
 * updates automatically as each task completes.
 *
 * Stabilization directive: only show integrations that ACTUALLY exist.
 *   ☐ Connect Google       → useGoogleWorkspace().connected
 *   ☐ Connect Zoho Books   → useZohoBooks().connected
 *   ☐ Create First Invoice → invoiceCount > 0
 *   ☐ Create First Customer → customers > 0
 *   ☐ Invite Team          → memberships.length > 0
 *   ☐ Activate Oracle      → organization.integrations.oracle.connected
 *
 * GSTN / Bank / WhatsApp / Gmail are NOT in this checklist because those
 * integrations are not yet implemented — including them would imply they
 * can be connected, which would be dishonest.
 *
 * The progress bar + percentage update in real time as items complete.
 * Clicking an incomplete item triggers its onAction handler.
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

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' as const }}
      className="glass-surface rounded-2xl p-5 md:p-6"
      aria-label="Business setup progress"
    >
      {/* Header + percentage */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg accent-gradient-soft shrink-0">
            <Sparkles className="h-4 w-4 accent-text" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground tracking-tight">
              Business Setup Progress
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {isComplete
                ? 'Your workspace is fully configured'
                : `${completed} of ${total} steps complete`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isComplete ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
              <Sparkles className="h-3.5 w-3.5" />
              Ready
            </span>
          ) : (
            <span className="text-lg font-bold accent-text tabular-nums">{pct}%</span>
          )}
        </div>
      </div>

      {/* Progress bar */}
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
                   prop. Visually distinct so the user's eye lands here. */
                <button
                  type="button"
                  onClick={task.onAction}
                  className="group w-full flex items-center gap-2.5 rounded-lg border border-[#2563EB]/40 bg-[#2563EB]/[0.08] px-2.5 py-2 text-left transition-colors hover:bg-[#2563EB]/[0.14] cursor-pointer"
                >
                  <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                    <span className="absolute inline-flex h-3.5 w-3.5 rounded-full bg-[#2563EB]/40 opacity-75 animate-ping" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#2563EB]" />
                  </span>
                  <Icon className="h-3.5 w-3.5 shrink-0 accent-text" />
                  <span className="text-[12px] font-semibold text-foreground truncate flex-1 min-w-0">
                    {task.label}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md accent-gradient px-2 py-0.5 text-[10px] font-bold text-white shrink-0">
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
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  )}
                  <Icon
                    className={`h-3.5 w-3.5 shrink-0 ${
                      task.done ? 'text-emerald-400/80' : 'text-muted-foreground'
                    }`}
                  />
                  <span
                    className={`text-[12px] truncate ${
                      task.done
                        ? 'text-muted-foreground line-through decoration-emerald-400/40'
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
