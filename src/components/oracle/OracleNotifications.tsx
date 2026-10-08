'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Proactive Notifications (Phase 3 — Agent Engine™)
//
// Oracle pushes intelligent notifications based on business memory — due dates,
// cash warnings, client behaviour signals, compliance drift. Like a real CFO
// who taps you on the shoulder before something breaks.
//
// Toast style: top-right of VEYRO AI workspace. Auto-dismisses after 12s
// unless hovered. Each toast carries an optional "Act now" button that spawns
// the linked Oracle Task.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Info,
  X,
  type LucideIcon,
} from 'lucide-react';
import { InfinitySymbol } from '@/components/layout/InfinityMark';
import type {
  OracleActionCard,
  ProactiveNotification,
  ProactiveTone,
} from './oracle-types';
import { ACTION_LIBRARY } from './oracle-actions';
import { cn } from '@/lib/utils';

export interface OracleNotificationsProps {
  /** The current proactive notification to surface (or null when none). */
  notification: ProactiveNotification | null;
  /** Called when the user dismisses the notification (X or auto-timeout). */
  onDismiss: (notification: ProactiveNotification) => void;
  /** Called when the user clicks "Act now" — spawns the linked Oracle Task. */
  onAct: (card: OracleActionCard, notification: ProactiveNotification) => void;
}

// ─── Tone → Style mapping ────────────────────────────────────────────────────

const TONE_META: Record<
  ProactiveTone,
  { icon: LucideIcon; iconClass: string; border: string; bg: string; accent: string }
> = {
  critical: {
    icon: AlertTriangle,
    iconClass: 'text-red-500',
    border: 'border-red-500/30',
    bg: 'bg-red-500/[0.06]',
    accent: 'bg-red-500',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-amber-500',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/[0.06]',
    accent: 'bg-amber-500',
  },
  info: {
    icon: Info,
    iconClass: 'text-cyan-500',
    border: 'border-cyan-500/30',
    bg: 'bg-cyan-500/[0.06]',
    accent: 'bg-cyan-500',
  },
  positive: {
    icon: CheckCircle2,
    iconClass: 'text-emerald-500',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/[0.06]',
    accent: 'bg-emerald-500',
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function OracleNotifications({
  notification,
  onDismiss,
  onAct,
}: OracleNotificationsProps) {
  const [hovering, setHovering] = useState(false);

  // Auto-dismiss after 12s unless hovered.
  useEffect(() => {
    if (!notification) return;
    if (hovering) return;
    const timer = setTimeout(() => {
      onDismiss(notification);
    }, 12000);
    return () => clearTimeout(timer);
  }, [notification, hovering, onDismiss]);

  const handleAct = useCallback(() => {
    if (!notification || !notification.actionKind) return;
    const meta = ACTION_LIBRARY[notification.actionKind];
    const card: OracleActionCard = {
      kind: notification.actionKind,
      title: notification.actionLabel ?? meta?.label ?? 'Run action',
      description: notification.detail,
      impact: notification.title,
    };
    onAct(card, notification);
  }, [notification, onAct]);

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-50 w-[340px] max-w-[calc(100vw-1.5rem)]">
      <AnimatePresence mode="wait">
        {notification && (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ duration: 0.3, ease: 'easeOut' as const }}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            className={cn(
              'pointer-events-auto overflow-hidden rounded-2xl border bg-card/90 shadow-2xl backdrop-blur-2xl',
              TONE_META[notification.tone].border,
            )}
          >
            {/* Accent bar on the left */}
            <div className={cn('absolute left-0 top-0 h-full w-1', TONE_META[notification.tone].accent)} />

            <div className="flex gap-2.5 p-3 pl-4">
              {/* Icon */}
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  TONE_META[notification.tone].bg,
                )}
              >
                {(() => {
                  const ToneIcon = TONE_META[notification.tone].icon;
                  return <ToneIcon className={cn('h-4 w-4', TONE_META[notification.tone].iconClass)} />;
                })()}
              </div>

              {/* Body */}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Bell className="h-2.5 w-2.5 text-muted-foreground" />
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Proactive · Oracle
                  </span>
                </div>
                <p className="text-xs font-semibold leading-snug text-foreground">
                  {notification.title}
                </p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {notification.detail}
                </p>

                {/* Action row */}
                {notification.actionKind && (
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      onClick={handleAct}
                      className={cn(
                        'flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors',
                        TONE_META[notification.tone].bg,
                        TONE_META[notification.tone].iconClass,
                        'hover:opacity-80',
                      )}
                    >
                      {notification.actionLabel ?? 'Act now'}
                    </button>
                    <button
                      onClick={() => onDismiss(notification)}
                      className="rounded-full px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>

              {/* Close button */}
              <button
                onClick={() => onDismiss(notification)}
                aria-label="Dismiss notification"
                className="shrink-0 rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-card/[0.5] hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>

            {/* Progress bar (auto-dismiss countdown) */}
            {!hovering && (
              <motion.div
                className={cn('h-0.5', TONE_META[notification.tone].accent)}
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 12, ease: 'linear' as const }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Compact Proactive Bell (header) ─────────────────────────────────────────
// Shown in VEYRO AI header when there are undismissed proactive signals.
// Clicking it surfaces the next notification.

export interface ProactiveBellProps {
  count: number;
  onClick?: () => void;
}

export function ProactiveBell({ count, onClick }: ProactiveBellProps) {
  if (count === 0) return null;
  return (
    <button
      onClick={onClick}
      aria-label={`${count} proactive notification${count === 1 ? '' : 's'}`}
      className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/[0.08] text-amber-600 transition-colors hover:bg-amber-500/[0.15] dark:text-amber-400"
    >
      <Bell className="h-3.5 w-3.5" />
      <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-500 px-1 text-[8px] font-bold text-white">
        {count > 9 ? '9+' : count}
      </span>
    </button>
  );
}

// ─── Proactive Strip (shown in empty state) ──────────────────────────────────
// A compact horizontal strip of upcoming proactive signals, shown in the
// Oracle empty state so the user immediately feels Oracle is watching.

export interface ProactiveStripProps {
  notifications: ProactiveNotification[];
  onDismiss?: (n: ProactiveNotification) => void;
  onAct?: (card: OracleActionCard, n: ProactiveNotification) => void;
}

export function ProactiveStrip({ notifications, onDismiss, onAct }: ProactiveStripProps) {
  if (notifications.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <InfinitySymbol size={12} />
        Proactive signals
      </div>
      {notifications.slice(0, 3).map((n) => {
        const meta = TONE_META[n.tone];
        const ToneIcon = meta.icon;
        return (
          <motion.button
            key={n.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -1 }}
            onClick={() => {
              if (n.actionKind) {
                const cardMeta = ACTION_LIBRARY[n.actionKind];
                onAct?.(
                  {
                    kind: n.actionKind,
                    title: n.actionLabel ?? cardMeta?.label ?? 'Run action',
                    description: n.detail,
                    impact: n.title,
                  },
                  n,
                );
              } else {
                onDismiss?.(n);
              }
            }}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors',
              meta.border,
              meta.bg,
              meta.iconClass,
            )}
            title={n.detail}
          >
            <ToneIcon className="h-2.5 w-2.5" />
            <span className="max-w-[180px] truncate">{n.title}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

export default OracleNotifications;
