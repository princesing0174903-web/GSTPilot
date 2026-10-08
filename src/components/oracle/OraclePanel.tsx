'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Right AI Panel (Infinity™ V16)
// Two sections only: Today's Focus + live AI Activity.
// When no real AI activities exist, we rotate simulated activity every 4s to
// make Oracle feel alive. All focus items derived from live Firestore data.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrandLogo, BrandLogoPulse } from '@/components/brand';
import {
  Brain, Wallet, FileText, Receipt, ChevronRight, Activity, Lightbulb,
  ShieldCheck, CreditCard, Sparkles, type LucideIcon,
} from 'lucide-react';
import type { AppView } from '@/contexts/AppContext';
import { useLiveDashboardMetrics, useFireActivities } from '@/hooks/use-firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { OracleWorkspace } from './OracleWorkspace';
import { useAuth } from '@/contexts/AuthContext';
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
 * 'ai' | 'workflow' | 'automation', and (b) AI-adjacent ActivityTypes produced
 * by automation workflows (extraction, reconciliation, etc.).
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

// ─── Simulated live AI activity ───────────────────────────────────────────────
// When there are no real AI activities (common for new users), rotate through
// these every 4 seconds to make Oracle feel alive.

const SIMULATED_ACTIVITIES: { label: string; icon: LucideIcon }[] = [
  { label: 'Oracle analyzing invoices…', icon: FileText },
  { label: 'Oracle reading GST data…', icon: ShieldCheck },
  { label: 'Oracle generating recommendations…', icon: Lightbulb },
  { label: 'Oracle monitoring compliance…', icon: Activity },
  { label: 'Oracle checking payment status…', icon: CreditCard },
];

// ─── Tone colors (blue accent · amber for recover · NO green/cyan) ────────────
const TONE = {
  amber: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  cyan: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
  emerald: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
} as const;

type Tone = keyof typeof TONE;

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
      <div className="space-y-1">{children}</div>
    </section>
  );
}

// ─── Focus card ───────────────────────────────────────────────────────────────

interface FocusCardProps {
  icon: LucideIcon;
  title: string;
  hint: string;
  tone: Tone;
  view: AppView;
  onNavigate: (view: AppView) => void;
}

function FocusCard({ icon: Icon, title, hint, tone, view, onNavigate }: FocusCardProps) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(view)}
      className={cn(
        'group flex w-full items-center gap-3 rounded-2xl p-3 text-left',
        'transition-colors hover-lift hover:bg-white/[0.04]',
      )}
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl"
        style={{ background: TONE[tone] }}
      >
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-zinc-100">{title}</span>
        <span className="block text-[11px] text-muted-foreground">{hint}</span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

// ─── Live activity item (shared by real + simulated) ─────────────────────────

function LiveActivityItem({ icon: Icon, label, sublabel }: { icon: LucideIcon; label: string; sublabel?: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl p-3">
      <div className="relative">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl accent-gradient-soft">
          <Icon className="h-3.5 w-3.5 accent-text" />
        </div>
        {/* Pulsing blue dot to show "live" */}
        <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3B82F6] opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#3B82F6]" />
        </span>
      </div>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs text-zinc-200">{label}</span>
        {sublabel && <span className="block text-[10px] text-muted-foreground">{sublabel}</span>}
      </span>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function OracleSkeleton() {
  return (
    <div className="flex-1 space-y-6 overflow-hidden p-4">
      {/* Branded loading state — Animated VEYRO logo + “Initializing Financial Brain…” */}
      <div className="flex flex-col items-center justify-center gap-4 py-6">
        <BrandLogoPulse size={56} label="Initializing Financial Brain…" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function OraclePanel({ onNavigate }: OraclePanelProps) {
  const { metrics, loading: metricsLoading } = useLiveDashboardMetrics();
  const { data: activities, loading: activitiesLoading } = useFireActivities();
  const { user } = useAuth();

  // 2.5s graceful timeout — fall back to empty states if Firestore is slow.
  const [timedOut, setTimedOut] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  // Prefilled prompt forwarded into the workspace (e.g. from the CommandBar
  // `oracle-ask` event). Cleared once the workspace consumes it.
  const [pendingPrompt, setPendingPrompt] = useState<string | undefined>(undefined);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 2500);
    return () => clearTimeout(t);
  }, []);

  // ── Listen for `oracle-ask` custom events (dispatched by the CommandBar and
  //    any other launcher) so the full-screen Oracle workspace is reachable on
  //    EVERY screen size — not just xl+ where the right panel is visible.
  useEffect(() => {
    const handler = (e: Event) => {
      const question = (e as CustomEvent<string>).detail;
      if (typeof question !== 'string' || !question.trim()) return;
      setPendingPrompt(question);
      setWorkspaceOpen(true);
    };
    window.addEventListener('oracle-ask', handler as EventListener);
    return () => window.removeEventListener('oracle-ask', handler as EventListener);
  }, []);

  const isLoading = (metricsLoading || activitiesLoading) && !timedOut;

  // ─── Section 1: Today's Focus ──────────────────────────────────────────────
  const focusItems = useMemo(() => {
    const items: { icon: LucideIcon; title: string; hint: string; tone: Tone; view: AppView }[] = [];

    // 1. Recover Collections — amber tone. Shows actionable when matchPercentage
    //    < 95 OR criticalIssues > 0. Empty state: "No collections to recover".
    const needsRecover = metrics.matchPercentage < 95 || metrics.criticalIssues > 0;
    if (needsRecover) {
      const hintParts: string[] = [];
      if (metrics.criticalIssues > 0) {
        hintParts.push(`${metrics.criticalIssues} critical`);
      }
      if (metrics.matchPercentage < 95) {
        hintParts.push(`${metrics.matchPercentage}% match`);
      }
      items.push({
        icon: Wallet,
        title: 'Recover Collections',
        hint: hintParts.join(' · ') || 'Review collections',
        tone: 'amber',
        view: 'reconcile',
      });
    } else {
      items.push({
        icon: Wallet,
        title: 'Recover Collections',
        hint: 'No collections to recover',
        tone: 'amber',
        view: 'reconcile',
      });
    }

    // 2. File Returns — cyan tone. Actionable when pendingReturns > 0 OR
    //    overdueReturns > 0. Empty state: "All returns filed".
    const needsFile = metrics.pendingReturns > 0 || metrics.overdueReturns > 0;
    if (needsFile) {
      const hintParts: string[] = [];
      if (metrics.pendingReturns > 0) {
        hintParts.push(`${metrics.pendingReturns} pending`);
      }
      if (metrics.overdueReturns > 0) {
        hintParts.push(`${metrics.overdueReturns} overdue`);
      }
      items.push({
        icon: FileText,
        title: 'File Returns',
        hint: hintParts.join(' · '),
        tone: 'cyan',
        view: 'returns',
      });
    } else {
      items.push({
        icon: FileText,
        title: 'File Returns',
        hint: 'All returns filed',
        tone: 'cyan',
        view: 'returns',
      });
    }

    // 3. Review Expenses — emerald tone. Always shows as a gentle nudge.
    items.push({
      icon: Receipt,
      title: 'Review Expenses',
      hint: 'Expenses up to date',
      tone: 'emerald',
      view: 'invoices',
    });

    return items;
  }, [metrics]);

  // ─── Section 2: AI Activity ────────────────────────────────────────────────
  const aiActivities = useMemo(
    () => activities.filter((a) => isAiActivity(a.type)).slice(0, 5),
    [activities],
  );

  // Rotate simulated activity every 4s ONLY when there are no real activities.
  const [simIndex, setSimIndex] = useState(0);
  useEffect(() => {
    if (aiActivities.length > 0) return; // only simulate when empty
    const t = setInterval(
      () => setSimIndex((i) => (i + 1) % SIMULATED_ACTIVITIES.length),
      4000,
    );
    return () => clearInterval(t);
  }, [aiActivities.length]);

  const SimIcon = SIMULATED_ACTIVITIES[simIndex].icon;
  const simLabel = SIMULATED_ACTIVITIES[simIndex].label;

  return (
    <>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' as const }}
      className="glass-surface flex h-full w-full flex-col rounded-3xl"
    >
      {/* ─── Header (click to open full Oracle workspace) ──────────────────── */}
      <button
        type="button"
        onClick={() => setWorkspaceOpen(true)}
        className="group flex w-full items-center gap-2.5 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
        aria-label="Open VEYRO AI workspace"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg">
          <BrandLogo variant="icon" theme="dark" size={32} disableGlow />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-baseline gap-0.5">
            <span className="text-sm font-semibold text-zinc-100">VEYRO AI</span>
            <sup className="text-[9px] font-medium text-muted-foreground">™</sup>
          </div>
          <div className="flex items-center gap-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3B82F6] opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#3B82F6]" />
            </span>
            <span className="text-[10px] text-muted-foreground">Live · Tap to chat</span>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
      </button>

      {/* ─── Divider ────────────────────────────────────────────────────────── */}
      <div className="border-t border-white/[0.06]" />

      {/* ─── Body ───────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <OracleSkeleton />
      ) : (
        <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-4">
          {/* Section 1: Today's Focus */}
          <Section icon={Brain} title="Today's Focus">
            {focusItems.map((f, i) => (
              <FocusCard
                key={`focus-${i}`}
                icon={f.icon}
                title={f.title}
                hint={f.hint}
                tone={f.tone}
                view={f.view}
                onNavigate={onNavigate}
              />
            ))}
          </Section>

          {/* Section 2: AI Activity (LIVE — V16 differentiator) */}
          <Section icon={Activity} title="AI Activity">
            {aiActivities.length > 0 ? (
              // Real AI activities timeline
              aiActivities.map((a) => (
                <LiveActivityItem
                  key={a.id}
                  icon={Activity}
                  label={a.title || 'AI activity'}
                  sublabel={timeAgo(a.createdAt)}
                />
              ))
            ) : (
              // Simulated live activity — rotates every 4s
              <AnimatePresence mode="wait">
                <motion.div
                  key={simIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4 }}
                  className="flex items-center gap-2.5 rounded-2xl p-3"
                >
                  <div className="relative">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl accent-gradient-soft">
                      <SimIcon className="h-3.5 w-3.5 accent-text" />
                    </div>
                    {/* Pulsing dot to show "live" */}
                    <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3B82F6] opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#3B82F6]" />
                    </span>
                  </div>
                  <span className="text-xs text-zinc-200">{simLabel}</span>
                </motion.div>
              </AnimatePresence>
            )}
          </Section>

          {/* ─── Ask VEYRO AI CTA ─────────────────────────────────────────────── */}
          <button
            type="button"
            onClick={() => setWorkspaceOpen(true)}
            className="group flex w-full items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 text-left transition-all hover:border-emerald-500/30 hover:bg-emerald-500/[0.04]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl accent-gradient shadow-lg shadow-emerald-500/20">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-zinc-100">Ask VEYRO AI Anything</span>
              <span className="block text-[11px] text-muted-foreground">
                GST · ITC · Cash flow · 10 languages
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
          </button>

          {/* Brand footer */}
          <p className="px-1 pt-1 text-center text-[10px] leading-relaxed text-muted-foreground/60">
            VEYRO AI<span className="align-super text-[7px]">™</span> · The AI Operating System for Business
            <br />
            <span className="text-muted-foreground/50">Founded &amp; developed by Prince Singh</span>
          </p>
        </div>
      )}
    </motion.div>

      {/* ═══ Full-screen Oracle workspace overlay (rendered as a sibling so the
          parent glass-surface backdrop-filter does not trap the fixed layer) ═══ */}
      <OracleWorkspace
        open={workspaceOpen}
        onClose={() => {
          setWorkspaceOpen(false);
          setPendingPrompt(undefined);
        }}
        onNavigate={onNavigate}
        userName={user?.name}
        userId={user?.id}
        firmName={undefined}
        gstin={undefined}
        initialPrompt={pendingPrompt}
      />
    </>
  );
}

export default OraclePanel;
