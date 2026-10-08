'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Agent Execution Panel (Phase 3 — Agent Engine™)
//
// A right-side panel showing Oracle's task queue, grouped by status:
//   • Running    (with live progress bar + step timeline)
//   • Scheduled  (with scheduled-for time)
//   • Completed  (with result summary)
//   • Failed     (with error message)
//
// Like Cursor Agent's task list / Manus's activity feed / ChatGPT Agent's
// run history. Gives the user the feeling of "I hired an AI employee".
//
// Header carries live counts + a "Clear" button to drop completed/failed tasks.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { InfinitySymbol } from '@/components/layout/InfinityMark';
import type { OracleTask, OracleTaskStatus } from './oracle-types';
import { ACTION_LIBRARY } from './oracle-actions';
import { cn } from '@/lib/utils';

export interface OracleAgentPanelProps {
  tasks: OracleTask[];
  onClear?: () => void;
  onTaskClick?: (task: OracleTask) => void;
  className?: string;
}

// ─── Status Group Definitions ────────────────────────────────────────────────

interface StatusGroupDef {
  key: OracleTaskStatus;
  label: string;
  icon: LucideIcon;
  iconClass: string;
  emptyHint: string;
}

const STATUS_GROUPS: StatusGroupDef[] = [
  { key: 'running', label: 'Running', icon: Loader2, iconClass: 'text-cyan-500 animate-spin', emptyHint: 'Oracle is idle.' },
  { key: 'scheduled', label: 'Scheduled', icon: CalendarClock, iconClass: 'text-amber-500', emptyHint: 'No scheduled tasks.' },
  { key: 'completed', label: 'Completed', icon: CheckCircle2, iconClass: 'text-emerald-500', emptyHint: 'Nothing completed yet.' },
  { key: 'failed', label: 'Failed', icon: AlertTriangle, iconClass: 'text-red-500', emptyHint: 'No failures. Good.' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function OracleAgentPanel({
  tasks,
  onClear,
  onTaskClick,
  className,
}: OracleAgentPanelProps) {
  const grouped = useMemo(() => {
    const g: Record<OracleTaskStatus, OracleTask[]> = {
      running: [],
      scheduled: [],
      completed: [],
      failed: [],
      pending: [],
    };
    for (const t of tasks) g[t.status].push(t);
    return g;
  }, [tasks]);

  const counts = {
    running: grouped.running.length,
    scheduled: grouped.scheduled.length,
    completed: grouped.completed.length,
    failed: grouped.failed.length,
  };

  return (
    <aside className={cn('glass-surface flex h-full w-full flex-col rounded-3xl', className)}>
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border px-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg accent-gradient-soft">
          <InfinitySymbol size={15} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs font-semibold text-foreground">Oracle Tasks</span>
          <span className="text-[9px] text-muted-foreground">
            {counts.running > 0
              ? `${counts.running} running · ${counts.scheduled} scheduled`
              : counts.completed > 0
                ? `${counts.completed} completed · ${counts.scheduled} scheduled`
                : 'Agent ready to execute'}
          </span>
        </div>
        {(counts.completed > 0 || counts.failed > 0) && onClear && (
          <button
            onClick={onClear}
            aria-label="Clear completed tasks"
            title="Clear completed"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-card/[0.5] hover:text-red-500"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* ─── Body ──────────────────────────────────────────────────────────── */}
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {tasks.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {STATUS_GROUPS.map((group) => {
              const items = grouped[group.key];
              if (items.length === 0) return null;
              return (
                <div key={group.key}>
                  {/* Group header */}
                  <div className="mb-1.5 flex items-center gap-1.5 px-1">
                    <group.icon className={cn('h-3 w-3', group.iconClass)} />
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </span>
                    <span className="text-[9px] font-medium text-muted-foreground/70">
                      {items.length}
                    </span>
                  </div>
                  {/* Task cards */}
                  <div className="space-y-1.5">
                    <AnimatePresence initial={false}>
                      {items.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onClick={() => onTaskClick?.(task)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="relative">
        <div className="absolute inset-0 -m-3 rounded-full accent-gradient-soft breathe-glow blur-lg" />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl accent-gradient-soft">
          <InfinitySymbol size={22} />
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-foreground">Oracle is ready to execute</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Click any action card below an Oracle answer to spawn a task here. Oracle will run it end-to-end.
        </p>
      </div>
    </div>
  );
}

// ─── Task Card ───────────────────────────────────────────────────────────────

function TaskCard({ task, onClick }: { task: OracleTask; onClick?: () => void }) {
  const meta = ACTION_LIBRARY[task.kind];
  const Icon = meta?.icon ?? CheckCircle2;

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
      whileHover={{ x: 1 }}
      onClick={onClick}
      className={cn(
        'group flex w-full flex-col gap-2 rounded-xl border bg-card/[0.3] p-2.5 text-left transition-all hover:bg-card/[0.55]',
        meta?.borderClass ?? 'border-border',
      )}
    >
      {/* Title row */}
      <div className="flex items-center gap-2">
        <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md', meta?.tintClass)}>
          <Icon className={cn('h-3 w-3', meta?.colorClass)} />
        </div>
        <p className="min-w-0 flex-1 truncate text-[11px] font-semibold text-foreground">
          {task.title}
        </p>
        <StatusBadge status={task.status} />
      </div>

      {/* Description */}
      <p className="line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">
        {task.description}
      </p>

      {/* Progress bar (running) */}
      {task.status === 'running' && (
        <div className="space-y-1.5">
          <div className="h-1 overflow-hidden rounded-full bg-border">
            <motion.div
              className="h-full accent-gradient"
              animate={{ width: `${task.progress}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' as const }}
            />
          </div>
          {/* Active step */}
          {task.steps.find((s) => s.state === 'active') && (
            <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
              <Loader2 className="h-2 w-2 animate-spin text-cyan-500" />
              <span className="truncate">
                {task.steps.find((s) => s.state === 'active')?.label}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Step timeline (running) — collapsed by default, expandable via hover */}
      {task.status === 'running' && task.steps.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.steps.map((step, i) => (
            <div
              key={i}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                step.state === 'done'
                  ? 'bg-emerald-400'
                  : step.state === 'active'
                    ? 'bg-cyan-400'
                    : 'bg-border',
              )}
              title={step.label}
            />
          ))}
        </div>
      )}

      {/* Result (completed) */}
      {task.status === 'completed' && task.result && (
        <div className="flex items-start gap-1.5 rounded-md bg-emerald-500/[0.06] p-1.5">
          <CheckCircle2 className="mt-0.5 h-2.5 w-2.5 shrink-0 text-emerald-500" />
          <p className="text-[10px] leading-relaxed text-foreground/80">{task.result}</p>
        </div>
      )}

      {/* Error (failed) */}
      {task.status === 'failed' && task.error && (
        <div className="flex items-start gap-1.5 rounded-md bg-red-500/[0.06] p-1.5">
          <AlertTriangle className="mt-0.5 h-2.5 w-2.5 shrink-0 text-red-500" />
          <p className="text-[10px] leading-relaxed text-red-600 dark:text-red-400">{task.error}</p>
        </div>
      )}

      {/* Scheduled-for (scheduled) */}
      {task.status === 'scheduled' && task.scheduledFor && (
        <div className="flex items-center gap-1.5 text-[9px] text-amber-600 dark:text-amber-400">
          <CalendarClock className="h-2.5 w-2.5" />
          <span>
            Scheduled for {new Date(task.scheduledFor).toLocaleString('en-IN', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      )}

      {/* Footer: open result view hint */}
      {(task.status === 'completed' || task.status === 'running') && task.resultView && (
        <div className="flex items-center justify-end gap-0.5 text-[9px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          Open {task.resultView}
          <ChevronRight className="h-2.5 w-2.5" />
        </div>
      )}
    </motion.button>
  );
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: OracleTaskStatus }) {
  const map: Record<OracleTaskStatus, { label: string; cls: string }> = {
    running: { label: 'Running', cls: 'bg-cyan-500/[0.12] text-cyan-600 dark:text-cyan-400' },
    scheduled: { label: 'Scheduled', cls: 'bg-amber-500/[0.12] text-amber-600 dark:text-amber-400' },
    completed: { label: 'Done', cls: 'bg-emerald-500/[0.12] text-emerald-600 dark:text-emerald-400' },
    failed: { label: 'Failed', cls: 'bg-red-500/[0.12] text-red-600 dark:text-red-400' },
    pending: { label: 'Pending', cls: 'bg-slate-500/[0.12] text-slate-600 dark:text-slate-400' },
  };
  const m = map[status];
  return (
    <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider', m.cls)}>
      {m.label}
    </span>
  );
}

export default OracleAgentPanel;
