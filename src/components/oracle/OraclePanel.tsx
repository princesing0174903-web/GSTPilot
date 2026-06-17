'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Right AI Panel (Infinity™ V15)
// A persistent glass panel: Today's Actions · Recommendations · AI Activity ·
// Notifications · Pending Decisions. All derived from live Firestore data.
// Never fake data — calm empty states when nothing is happening.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, Zap, Lightbulb, Activity, Bot, Bell, ClipboardCheck,
  AlertCircle, ChevronRight, CheckCircle2, type LucideIcon,
} from 'lucide-react';
import type { AppView } from '@/contexts/AppContext';
import {
  useLiveDashboardMetrics,
  useFireActivities,
  useFireNotifications,
} from '@/hooks/use-firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface OraclePanelProps {
  onNavigate: (view: AppView) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Defensive relative-time formatter: handles ISO string / Date / Firestore Timestamp. */
function timeAgo(createdAt: unknown): string {
  if (!createdAt) return 'just now';
  let date: Date;
  if (createdAt instanceof Date) {
    date = createdAt;
  } else if (typeof createdAt === 'string') {
    date = new Date(createdAt);
  } else if (
    typeof createdAt === 'object' &&
    createdAt !== null &&
    'toDate' in createdAt &&
    typeof (createdAt as { toDate: () => Date }).toDate === 'function'
  ) {
    date = (createdAt as { toDate: () => Date }).toDate();
  } else {
    return 'just now';
  }
  if (isNaN(date.getTime())) return 'just now';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

/**
 * Identify AI-driven activities. We accept (a) types whose name contains
 * 'ai' | 'workflow' | 'automation', and (b) the AI-adjacent ActivityTypes that
 * are produced by automation workflows (extraction, reconciliation, etc.).
 * No data is fabricated — if nothing matches we render a calm empty state.
 */
const AI_ACTIVITY_TYPES = new Set<string>([
  'document_processed',
  'invoice_extracted',
  'invoice_corrected',
  'reconciliation_run',
  'mismatch_resolved',
  'return_prepared',
]);

function isAiActivity(type: unknown): boolean {
  if (typeof type !== 'string' || !type) return false;
  const lower = type.toLowerCase();
  if (lower.includes('ai') || lower.includes('workflow') || lower.includes('automation')) return true;
  return AI_ACTIVITY_TYPES.has(lower);
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

interface SectionProps {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}

function Section({ icon: Icon, title, children }: SectionProps) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1.5 px-1">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <h3 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      </div>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

// ─── Row variants ─────────────────────────────────────────────────────────────

interface ActionItem {
  label: string;
  hint?: string;
  view: AppView;
}

function ActionRow({ label, hint, view, onNavigate }: ActionItem & { onNavigate: (v: AppView) => void }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(view)}
      className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs text-zinc-200">{label}</span>
        {hint && <span className="block truncate text-[10px] text-muted-foreground">{hint}</span>}
      </span>
      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

type Tone = 'risk' | 'info' | 'success';

interface RecItem {
  label: string;
  tone: Tone;
  view?: AppView;
}

const toneIconClass: Record<Tone, string> = {
  risk: 'text-amber-400',
  info: 'text-cyan-400',
  success: 'text-emerald-400',
};

function RecRow({ label, tone, view, onNavigate }: RecItem & { onNavigate: (v: AppView) => void }) {
  const Icon = tone === 'risk' ? AlertCircle : tone === 'info' ? Lightbulb : CheckCircle2;
  const clickable = Boolean(view);
  return (
    <button
      type="button"
      onClick={view ? () => onNavigate(view) : undefined}
      disabled={!clickable}
      className={cn(
        'group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors',
        clickable ? 'cursor-pointer hover:bg-white/[0.04]' : 'cursor-default',
      )}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0', toneIconClass[tone])} />
      <span className="truncate text-xs text-zinc-200">{label}</span>
    </button>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
      <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/30" />
      <span className="text-xs text-muted-foreground/70">{label}</span>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function OracleSkeleton() {
  return (
    <div className="flex-1 space-y-5 overflow-hidden p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-8 w-full rounded-lg" />
          <Skeleton className="h-8 w-3/4 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function OraclePanel({ onNavigate }: OraclePanelProps) {
  const { metrics, loading: metricsLoading } = useLiveDashboardMetrics();
  const { data: activities, loading: activitiesLoading } = useFireActivities();
  const { data: notifications, loading: notificationsLoading } = useFireNotifications();

  // 2.5s graceful timeout — fall back to empty states if Firestore is slow.
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 2500);
    return () => clearTimeout(t);
  }, []);

  const isLoading = (metricsLoading || activitiesLoading || notificationsLoading) && !timedOut;

  // ─── 1. Today's Actions ────────────────────────────────────────────────────
  const { actions, actionEmpty } = useMemo<{ actions: ActionItem[]; actionEmpty: string | null }>(() => {
    const list: ActionItem[] = [];
    if (metrics.overdueReturns > 0) {
      list.push({
        label: 'File GSTR-3B',
        hint: `${metrics.overdueReturns} overdue return${metrics.overdueReturns > 1 ? 's' : ''}`,
        view: 'returns',
      });
    }
    if (metrics.pendingReturns > 0) {
      list.push({
        label: 'File GSTR-1',
        hint: `${metrics.pendingReturns} pending`,
        view: 'returns',
      });
    }
    if (metrics.matchPercentage < 90) {
      list.push({
        label: 'Reconcile invoices',
        hint: `${metrics.matchPercentage}% match rate`,
        view: 'reconcile',
      });
    }
    if (metrics.criticalIssues > 0) {
      list.push({
        label: 'Resolve critical issues',
        hint: `${metrics.criticalIssues} critical`,
        view: 'reconcile',
      });
    }
    if (metrics.extractionsPending > 0) {
      list.push({
        label: 'Review document extractions',
        hint: `${metrics.extractionsPending} pending`,
        view: 'documents',
      });
    }
    if (list.length === 0) {
      const emptyLabel = metrics.totalClients === 0
        ? 'Connect bank to unlock actions'
        : 'No actions pending';
      return { actions: [], actionEmpty: emptyLabel };
    }
    return { actions: list.slice(0, 5), actionEmpty: null };
  }, [metrics]);

  // ─── 2. Recommendations ────────────────────────────────────────────────────
  const recs = useMemo<RecItem[]>(() => {
    const list: RecItem[] = [];
    if (metrics.criticalIssues > 0) {
      list.push({
        label: `Resolve ${metrics.criticalIssues} critical issue${metrics.criticalIssues > 1 ? 's' : ''}`,
        tone: 'risk',
        view: 'reconcile',
      });
    }
    if (metrics.overdueReturns > 0) {
      list.push({
        label: `File ${metrics.overdueReturns} overdue return${metrics.overdueReturns > 1 ? 's' : ''}`,
        tone: 'risk',
        view: 'returns',
      });
    }
    if (metrics.matchPercentage < 90) {
      list.push({
        label: 'Reconcile to recover revenue',
        tone: 'info',
        view: 'reconcile',
      });
    }
    if (metrics.warnings > 0) {
      list.push({
        label: `Review ${metrics.warnings} warning${metrics.warnings > 1 ? 's' : ''}`,
        tone: 'info',
        view: 'reconcile',
      });
    }
    if (list.length === 0) {
      list.push({ label: 'Business is running smoothly', tone: 'success' });
    }
    return list.slice(0, 5);
  }, [metrics]);

  // ─── 3. AI Activity ────────────────────────────────────────────────────────
  const aiActivities = useMemo(
    () => activities.filter((a) => isAiActivity(a.type)).slice(0, 5),
    [activities],
  );

  // ─── 4. Notifications ──────────────────────────────────────────────────────
  const notifs = useMemo(() => notifications.slice(0, 5), [notifications]);

  // ─── 5. Pending Decisions ──────────────────────────────────────────────────
  const { decisions, decisionEmpty } = useMemo<{ decisions: ActionItem[]; decisionEmpty: string | null }>(() => {
    const list: ActionItem[] = [];
    if (metrics.pendingReturns > 0) {
      list.push({
        label: 'Approve GSTR-3B filing',
        hint: `${metrics.pendingReturns} awaiting approval`,
        view: 'returns',
      });
    }
    if (metrics.criticalIssues > 0) {
      list.push({
        label: `Review ${metrics.criticalIssues} mismatch${metrics.criticalIssues !== 1 ? 'es' : ''}`,
        hint: 'Needs reconciliation review',
        view: 'reconcile',
      });
    }
    if (metrics.extractionsPending > 0) {
      list.push({
        label: 'Approve invoice extractions',
        hint: `${metrics.extractionsPending} pending`,
        view: 'invoices',
      });
    }
    if (list.length === 0) {
      return { decisions: [], decisionEmpty: 'No decisions pending' };
    }
    return { decisions: list.slice(0, 5), decisionEmpty: null };
  }, [metrics]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="glass-surface flex h-full w-full flex-col rounded-3xl"
    >
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        <div className="accent-gradient flex h-8 w-8 items-center justify-center rounded-lg shadow-lg shadow-emerald-500/20">
          <Brain className="h-4 w-4 text-white" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-baseline gap-0.5">
            <span className="text-sm font-semibold text-zinc-100">GSTPilot Oracle</span>
            <sup className="text-[9px] font-medium text-muted-foreground">™</sup>
          </div>
          <div className="flex items-center gap-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[10px] text-muted-foreground">Live</span>
          </div>
        </div>
      </div>

      {/* ─── Divider ────────────────────────────────────────────────────────── */}
      <div className="border-t border-white/[0.06]" />

      {/* ─── Body ───────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <OracleSkeleton />
      ) : (
        <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto p-4">
          {/* 1. Today's Actions */}
          <Section icon={Zap} title="Today's Actions">
            {actionEmpty ? (
              <EmptyRow label={actionEmpty} />
            ) : (
              actions.map((a, i) => (
                <ActionRow key={`act-${i}`} label={a.label} hint={a.hint} view={a.view} onNavigate={onNavigate} />
              ))
            )}
          </Section>

          {/* 2. Recommendations */}
          <Section icon={Lightbulb} title="Recommendations">
            {recs.map((r, i) => (
              <RecRow key={`rec-${i}`} label={r.label} tone={r.tone} view={r.view} onNavigate={onNavigate} />
            ))}
          </Section>

          {/* 3. AI Activity */}
          <Section icon={Activity} title="AI Activity">
            {aiActivities.length === 0 ? (
              <EmptyRow label="AI is monitoring your business" />
            ) : (
              aiActivities.map((a) => (
                <div key={a.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                  <Bot className="h-3.5 w-3.5 shrink-0 text-cyan-400/80" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-zinc-200">
                      {a.title || 'AI activity'}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {timeAgo(a.createdAt)}
                    </span>
                  </span>
                </div>
              ))
            )}
          </Section>

          {/* 4. Notifications */}
          <Section icon={Bell} title="Notifications">
            {notifs.length === 0 ? (
              <EmptyRow label="No new notifications" />
            ) : (
              notifs.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-2 py-1.5',
                    !n.read && 'bg-white/[0.04]',
                  )}
                >
                  <Bell className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-zinc-200">
                      {n.title || 'Notification'}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {timeAgo(n.createdAt)}
                    </span>
                  </span>
                </div>
              ))
            )}
          </Section>

          {/* 5. Pending Decisions */}
          <Section icon={ClipboardCheck} title="Pending Decisions">
            {decisionEmpty ? (
              <EmptyRow label={decisionEmpty} />
            ) : (
              decisions.map((d, i) => (
                <div
                  key={`dec-${i}`}
                  className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-400/80" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-zinc-200">{d.label}</span>
                    {d.hint && (
                      <span className="block truncate text-[10px] text-muted-foreground">{d.hint}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate(d.view)}
                    className="shrink-0 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-zinc-300 transition-colors hover:border-emerald-400/30 hover:text-emerald-300"
                  >
                    Review
                  </button>
                </div>
              ))
            )}
          </Section>
        </div>
      )}
    </motion.div>
  );
}

export default OraclePanel;
