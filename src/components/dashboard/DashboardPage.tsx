'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — HOME (Financial Operating System)
// ═══════════════════════════════════════════════════════════════════════════════
//
// A premium command center inspired by Stripe, Linear, Notion, Vercel & Ramp.
//
// The dashboard tells the user exactly what to do next. Every section has a
// purpose; every card answers "Why should this exist?". Six connected sections:
//
//   1. Hero — greeting, Business Health Score, Today's Revenue, Pending GST,
//      and the 3 most important quick actions.
//   2. Oracle AI — a single built-in assistant card. No "Activate" buttons,
//      no duplicate Oracle CTAs.
//   3. Business Snapshot — Revenue, Profit, Expenses, Cash Flow, Invoices,
//      Clients, GST Returns. Real numbers + a real MoM indicator.
//   4. Action Center — everything requiring action, each row clickable.
//   5. AI Recommendations — Oracle's prioritized recommendations, each with
//      View Details.
//   6. Recent Activity — a single chronological feed of every business event
//      (invoices, returns, payments, bank sync, Zoho sync, Google Drive).
//
// DATA CONTRACT
//   Every number on this page comes from ONE of three real sources:
//     • useBusinessSnapshot()  → /api/business/snapshot  (Prisma, single source
//       of truth for revenue, profit, cash, GST, customers, invoices, returns,
//       health score, forecast, runway).
//     • useTimelineEvents()    → /api/timeline            (Prisma BusinessEvent).
//     • useAIRecommendations() → /api/recommendations     (rules engine over
//       the snapshot + targeted Prisma queries).
//   No Math.random, no fake sparklines, no fabricated percentages, no mock
//   widgets. When a value is 0, we show 0 with an honest subtitle.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ProSkeleton, AnimatedNumber } from '@/components/ui-pro';
import {
  FileText,
  Users,
  ShieldCheck,
  IndianRupee,
  ArrowRight,
  Sparkles,
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
  Zap,
  RefreshCw,
  LifeBuoy,
  Receipt,
  Wallet,
  Landmark,
  Database,
  Cloud,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useApp, type AppView } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBusinessSnapshot } from '@/hooks/useBusinessSnapshot';
import {
  useLiveDashboardMetrics,
  useFireReturns,
} from '@/hooks/use-firestore';
import { useTimelineEvents } from '@/hooks/useTimelineEvents';
import { useAIRecommendations } from '@/hooks/useAIRecommendations';
import { useWorkflowPipeline } from '@/hooks/useWorkflowPipeline';
import { useOracleDailyBriefing } from '@/hooks/useOracleDailyBriefing';
import { WorkflowPipeline } from '@/components/workflow/WorkflowPipeline';
import { ProactiveOracleBriefing } from '@/components/oracle/ProactiveOracleBriefing';
import { periodToLabel, getFilingDueDate } from '@/lib/gst-utils';
import { toast } from 'sonner';
import type { Recommendation as AIRecommendation } from '@/lib/recommendations/engine';
import type { TimelineEvent } from '@/lib/timeline/emit';

// ═══════════════════════════════════════════════════════════════════════════════
// LAZY BELOW-THE-FOLD — defers mounting of below-the-fold sections until the
// user scrolls near them. Prevents expensive initial render of Action Center,
// AI Recommendations, and Recent Activity when the user first lands on the
// dashboard (they only see the Hero + Oracle + Snapshot above the fold).
// ═══════════════════════════════════════════════════════════════════════════════
function useInView(rootMargin = '400px 0px'): { ref: React.RefCallback<HTMLDivElement>; inView: boolean } {
  const [inView, setInView] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (node && !inView) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            setInView(true);
            observerRef.current?.disconnect();
            observerRef.current = null;
          }
        },
        { rootMargin },
      );
      observerRef.current.observe(node);
      // Fallback: if the observer hasn't fired within 1.5s (e.g. in headless
      // browsers or when the element is already in view on mount), force-show
      // the section. This prevents content from being permanently hidden.
      setTimeout(() => {
        setInView((prev) => {
          if (!prev) {
            observerRef.current?.disconnect();
            observerRef.current = null;
          }
          return true;
        });
      }, 1500);
    }
  }, [inView, rootMargin]);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  return { ref, inView };
}

function LazySection({ children, placeholderHeight = 320 }: { children: (inView: boolean) => React.ReactNode; placeholderHeight?: number }) {
  const { ref, inView } = useInView();
  return (
    <div ref={ref} style={{ minHeight: inView ? undefined : placeholderHeight }}>
      {children(inView)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Compact Indian-system currency abbreviation: ₹1.09L, ₹1.09Cr, ₹9.5K. */
function abbreviateINR(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getFirstName(name: string | undefined | null): string {
  if (!name) return 'there';
  const first = name.trim().split(/\s+/)[0];
  return first || 'there';
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getDaysRemaining(dueDateStr: string): number {
  const dueDate = new Date(dueDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING SKELETON
// ═══════════════════════════════════════════════════════════════════════════════

function DashboardSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-10 space-y-8">
      <div className="space-y-3">
        <ProSkeleton className="h-9 w-72" />
        <ProSkeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <ProSkeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <ProSkeleton className="h-28 rounded-2xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <ProSkeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProSkeleton className="h-80 rounded-2xl" />
        <ProSkeleton className="h-80 rounded-2xl" />
      </div>
      <ProSkeleton className="h-72 rounded-2xl" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HERO STAT TILE
// ═══════════════════════════════════════════════════════════════════════════════

interface HeroStatProps {
  label: string;
  /** Numeric value for count-up animation. */
  numericValue?: number;
  /** Format: 'currency' = ₹1,18,000, 'currencyCompact' = ₹1.18L, 'integer' = 42, 'decimal' = 68.5 */
  numericFormat?: 'currency' | 'currencyCompact' | 'integer' | 'decimal';
  /** Fallback string when numericValue is undefined. */
  valueString?: string;
  subtitle: string;
  icon: React.ReactNode;
  /** Accent color for the left bar + icon chip. */
  accent: 'emerald' | 'amber' | 'blue';
  index: number;
  /** Optional CTA link rendered below the subtitle. */
  cta?: { label: string; onClick: () => void };
  /** Optional inline badge (e.g. health tier). */
  badge?: { label: string; tone: 'emerald' | 'amber' | 'rose' };
  children?: React.ReactNode;
}

const HERO_ACCENT: Record<HeroStatProps['accent'], { bar: string; chip: string; glow: string }> = {
  emerald: {
    bar: 'bg-gradient-to-b from-emerald-400 to-emerald-600',
    chip: 'bg-emerald-500/10 border border-emerald-500/20',
    glow: 'hover:shadow-[0_0_32px_-8px_rgba(16,185,129,0.22)]',
  },
  amber: {
    bar: 'bg-gradient-to-b from-amber-400 to-amber-600',
    chip: 'bg-amber-500/10 border border-amber-500/20',
    glow: 'hover:shadow-[0_0_32px_-8px_rgba(245,158,11,0.22)]',
  },
  blue: {
    bar: 'bg-gradient-to-b from-blue-400 to-blue-600',
    chip: 'bg-blue-500/10 border border-blue-500/20',
    glow: 'hover:shadow-[0_0_32px_-8px_rgba(59,130,246,0.22)]',
  },
};

const BADGE_TONE: Record<NonNullable<HeroStatProps['badge']>['tone'], string> = {
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  rose: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
};

function HeroStat({
  label,
  numericValue,
  numericFormat = 'integer',
  valueString,
  subtitle,
  icon,
  accent,
  index,
  cta,
  badge,
  children,
}: HeroStatProps) {
  const cfg = HERO_ACCENT[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: 'easeOut' as const }}
      className="h-full"
    >
      <div className={`relative glass-surface rounded-2xl p-5 h-full overflow-hidden transition-shadow hover-lift ${cfg.glow}`}>
        <div aria-hidden className={`absolute left-0 top-0 h-full w-[3px] rounded-l-2xl ${cfg.bar}`} />
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
              {label}
            </p>
          </div>
          <div className={`flex items-center justify-center h-9 w-9 rounded-xl shrink-0 ${cfg.chip}`}>
            {icon}
          </div>
        </div>
        <div className="flex items-baseline gap-2 flex-wrap">
          {numericValue !== undefined ? (
            <AnimatedNumber value={numericValue} format={numericFormat} className="text-2xl md:text-3xl font-bold text-foreground tracking-tight tabular-nums" />
          ) : (
            <span className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">{valueString ?? '—'}</span>
          )}
          {badge && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${BADGE_TONE[badge.tone]}`}>
              {badge.label}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed break-words">{subtitle}</p>
        {children}
        {cta && (
          <button
            type="button"
            onClick={cta.onClick}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold accent-text hover:opacity-80 transition-opacity"
          >
            {cta.label}
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SNAPSHOT TILE (Section 3)
// ═══════════════════════════════════════════════════════════════════════════════

interface SnapshotTileProps {
  label: string;
  numericValue?: number;
  numericFormat?: 'currency' | 'currencyCompact' | 'integer' | 'decimal';
  valueString?: string;
  subtitle: string;
  icon: React.ReactNode;
  /** Real month-over-month delta: { pct: 12, direction: 'up'|'down'|'flat' }. Derived from real snapshot fields. */
  mom?: { pct: number; direction: 'up' | 'down' | 'flat' };
  index: number;
  onClick?: () => void;
}

const MOM_STYLE: Record<'up' | 'down' | 'flat', { icon: LucideIcon; cls: string; verb: string }> = {
  up: { icon: TrendingUp, cls: 'text-emerald-400', verb: 'vs last month' },
  down: { icon: TrendingDown, cls: 'text-rose-400', verb: 'vs last month' },
  flat: { icon: Minus, cls: 'text-muted-foreground', verb: 'no change' },
};

function SnapshotTile({
  label,
  numericValue,
  numericFormat = 'integer',
  valueString,
  subtitle,
  icon,
  mom,
  index,
  onClick,
}: SnapshotTileProps) {
  const MomIcon = mom ? MOM_STYLE[mom.direction].icon : null;
  const interactive = Boolean(onClick);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: 'easeOut' as const }}
      className="h-full"
    >
      <button
        type="button"
        onClick={onClick}
        disabled={!interactive}
        className={`group relative w-full text-left glass-surface rounded-2xl p-4 h-full overflow-hidden transition-all ${interactive ? 'hover-lift cursor-pointer hover:border-white/10' : 'cursor-default'}`}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em] truncate">
            {label}
          </p>
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-white/[0.04] border border-white/[0.06] shrink-0">
            {icon}
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          {numericValue !== undefined ? (
            <AnimatedNumber value={numericValue} format={numericFormat} className="text-xl font-bold text-foreground tracking-tight tabular-nums" />
          ) : (
            <span className="text-xl font-bold text-foreground tracking-tight">{valueString ?? '—'}</span>
          )}
        </div>
        {mom && MomIcon && (
          <div className={`flex items-center gap-1 mt-1 ${MOM_STYLE[mom.direction].cls}`}>
            <MomIcon className="h-3 w-3" />
            <span className="text-[10px] font-semibold tabular-nums">
              {mom.direction === 'flat' ? '—' : `${mom.pct > 0 ? '+' : ''}${mom.pct}%`}
            </span>
            <span className="text-[10px] text-muted-foreground">{MOM_STYLE[mom.direction].verb}</span>
          </div>
        )}
        {!mom && (
          <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed truncate">{subtitle}</p>
        )}
      </button>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REVENUE vs EXPENSES MINI BAR (real data, pure SVG)
// ═══════════════════════════════════════════════════════════════════════════════

function RevenueExpenseBar({ revenue, expenses }: { revenue: number; expenses: number }) {
  const total = revenue + expenses;
  const revPct = total > 0 ? (revenue / total) * 100 : 0;
  const expPct = total > 0 ? (expenses / total) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Revenue
          <span className="font-semibold text-foreground tabular-nums">{abbreviateINR(revenue)}</span>
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{abbreviateINR(expenses)}</span>
          Expenses
          <span className="h-2 w-2 rounded-full bg-rose-400" />
        </span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${revPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' as const }}
          className="bg-gradient-to-r from-emerald-400 to-emerald-600"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${expPct}%` }}
          transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' as const }}
          className="bg-gradient-to-r from-rose-400 to-rose-600"
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        {total > 0
          ? `${revPct.toFixed(0)}% revenue · ${expPct.toFixed(0)}% expenses (FY-to-date)`
          : 'No revenue or expenses recorded yet for this financial year.'}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION HEADER
// ═══════════════════════════════════════════════════════════════════════════════

function SectionHeader({
  title,
  icon,
  actionLabel,
  onAction,
}: {
  title: string;
  icon: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg accent-gradient-soft shrink-0">
          {icon}
        </div>
        <h2 className="text-sm font-semibold text-foreground tracking-tight truncate">
          {title}
        </h2>
      </div>
      {actionLabel && onAction && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onAction}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
        >
          {actionLabel}
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY SOURCE ICON (Section 6)
// ═══════════════════════════════════════════════════════════════════════════════

function activityIconFor(type: string, source: string): { icon: LucideIcon; tone: string } {
  const t = type.toLowerCase();
  const s = source.toLowerCase();
  if (t.includes('oracle') || t.includes('brain')) return { icon: Sparkles, tone: 'text-amber-400' };
  if (t.includes('zoho') || s.includes('zoho')) return { icon: BookOpen, tone: 'text-rose-400' };
  if (t.includes('google') || s.includes('google') || t.includes('drive') || t.includes('gmail')) return { icon: Cloud, tone: 'text-blue-400' };
  if (t.includes('bank') || s.includes('bank')) return { icon: Landmark, tone: 'text-cyan-400' };
  if (t.includes('payment') || t.includes('paid') || t.includes('collect')) return { icon: Wallet, tone: 'text-emerald-400' };
  if (t.includes('invoice') || t.includes('bill')) return { icon: FileText, tone: 'text-violet-400' };
  if (t.includes('return') || t.includes('gst') || t.includes('filing')) return { icon: Receipt, tone: 'text-amber-400' };
  if (t.includes('client') || t.includes('customer')) return { icon: Users, tone: 'text-blue-400' };
  if (t.includes('reconcil')) return { icon: AlertTriangle, tone: 'text-amber-400' };
  if (t.includes('filed') || t.includes('completed') || t.includes('success')) return { icon: CheckCircle2, tone: 'text-emerald-400' };
  return { icon: Activity, tone: 'text-muted-foreground' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION ITEM (Section 4)
// ═══════════════════════════════════════════════════════════════════════════════

interface ActionItem {
  id: string;
  icon: LucideIcon;
  tone: 'rose' | 'amber' | 'blue' | 'emerald';
  title: string;
  detail: string;
  view: AppView;
}

const ACTION_TONE: Record<ActionItem['tone'], { chip: string; bar: string }> = {
  rose: { chip: 'bg-rose-500/10 border-rose-500/20 text-rose-400', bar: 'bg-rose-400' },
  amber: { chip: 'bg-amber-500/10 border-amber-500/20 text-amber-400', bar: 'bg-amber-400' },
  blue: { chip: 'bg-blue-500/10 border-blue-500/20 text-blue-400', bar: 'bg-blue-400' },
  emerald: { chip: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', bar: 'bg-emerald-400' },
};

function ActionRow({ item, index }: { item: ActionItem; index: number }) {
  const Icon = item.icon;
  const tone = ACTION_TONE[item.tone];
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: 'easeOut' as const }}
      className="group w-full text-left flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors"
    >
      <div className={`flex items-center justify-center h-9 w-9 rounded-lg border shrink-0 ${tone.chip}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-foreground truncate">{item.title}</p>
        <p className="text-[11px] text-muted-foreground truncate">{item.detail}</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const router = useRouter();
  const { setCurrentView } = useApp();
  const { user } = useAuth();

  // ═══════════════════════════════════════════════════════════════════════════
  // REAL DATA HOOKS (single source of truth)
  // ═══════════════════════════════════════════════════════════════════════════
  const { snapshot, loading: snapshotLoading, error: snapshotError, refresh: refreshSnapshot } = useBusinessSnapshot();
  const { metrics, loading: metricsLoading } = useLiveDashboardMetrics();
  const { data: returns } = useFireReturns();
  const { events: timelineEvents, loading: timelineLoading } = useTimelineEvents(15);
  const { recommendations: aiRecommendations, loading: aiRecsLoading } = useAIRecommendations();

  // ── Workflow Pipeline + Proactive Oracle Briefing (Task 12 · Steps 1 & 3) ──
  // The workflow pipeline is the CENTRAL visual element — it shows the live
  // state of every business object as it flows through Invoice → Payment →
  // Bank → Match → GST → Oracle → Approve → Done.
  // The Oracle daily briefing makes Oracle proactive — it wakes up with
  // knowledge instead of waiting for prompts.
  const { pipeline, loading: pipelineLoading, refresh: refreshPipeline } = useWorkflowPipeline();
  const { briefing, loading: briefingLoading, refresh: refreshBriefing } = useOracleDailyBriefing();

  // ── Loading safety timer (12s) — never let the skeleton hang forever ──
  // The timer is armed while loading; if it fires before loading clears, we
  // surface whatever data we have. We avoid calling setState synchronously in
  // the effect body (which would trigger cascading renders) by only setting
  // state from inside the async timeout callback.
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const allLoading = snapshotLoading || metricsLoading || timelineLoading;
  useEffect(() => {
    if (!allLoading) {
      // Loading cleared naturally — reset the flag on the NEXT tick via a
      // microtask so we never call setState synchronously inside the effect.
      const id = setTimeout(() => setLoadingTimedOut(false), 0);
      return () => clearTimeout(id);
    }
    const t = setTimeout(() => setLoadingTimedOut(true), 12_000);
    return () => clearTimeout(t);
  }, [allLoading]);

  // ═══════════════════════════════════════════════════════════════════════════
  // DERIVED HOOKS — all useMemo calls MUST run before any early return.
  // React Rules of Hooks: hooks cannot be called conditionally or after a
  // conditional return. We compute every derived value up-front here so the
  // loading / error early-returns below are safe.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Health score tier (real, from snapshot.healthScore) ──
  const hasHealthScore = snapshot.healthScore > 0 && snapshot.hasLiveData;
  const healthTier = useMemo(() => {
    if (!hasHealthScore) return null;
    const s = snapshot.healthScore;
    if (s >= 85) return { label: 'Excellent', tone: 'emerald' as const };
    if (s >= 70) return { label: 'Healthy', tone: 'emerald' as const };
    if (s >= 50) return { label: 'At Risk', tone: 'amber' as const };
    return { label: 'Critical', tone: 'amber' as const };
  }, [hasHealthScore, snapshot.healthScore]);

  // ── Pending GST = net GST liability (output tax − input tax) ──
  const pendingGst = snapshot.gst?.netLiability ?? 0;

  // ── Real month-over-month revenue delta ──
  const revenueMom = useMemo(() => {
    const cur = snapshot.revenueThisMonth ?? 0;
    const prev = snapshot.revenueLastMonth ?? 0;
    if (prev === 0 && cur === 0) return { pct: 0, direction: 'flat' as const };
    if (prev === 0) return { pct: 100, direction: 'up' as const };
    const pct = Math.round(((cur - prev) / prev) * 100);
    if (Math.abs(pct) < 1) return { pct: 0, direction: 'flat' as const };
    return { pct: Math.abs(pct), direction: pct > 0 ? 'up' as const : 'down' as const };
  }, [snapshot.revenueThisMonth, snapshot.revenueLastMonth]);

  // ── Action Center items (real, derived from snapshot + returns + metrics) ──
  const actionItems = useMemo<ActionItem[]>(() => {
    const items: ActionItem[] = [];

    // 1. Overdue GST returns (from real returns with due dates)
    const overdueReturnsList = returns
      .filter((r) => r.status !== 'filed')
      .map((r) => ({ r, days: getDaysRemaining(getFilingDueDate(r.returnType, r.period)) }))
      .filter((x) => x.days < 0)
      .sort((a, b) => a.days - b.days);
    if (overdueReturnsList.length > 0) {
      const top = overdueReturnsList[0];
      items.push({
        id: 'overdue-return',
        icon: AlertCircle,
        tone: 'rose',
        title: `${overdueReturnsList.length} GST return${overdueReturnsList.length > 1 ? 's' : ''} overdue`,
        detail: `Most urgent: ${top.r.returnType} · ${periodToLabel(top.r.period)} · ${Math.abs(top.days)}d past due`,
        view: 'returns',
      });
    } else {
      // Nearest upcoming filing (due soon)
      const upcoming = returns
        .filter((r) => r.status !== 'filed')
        .map((r) => ({ r, days: getDaysRemaining(getFilingDueDate(r.returnType, r.period)) }))
        .filter((x) => x.days >= 0)
        .sort((a, b) => a.days - b.days);
      if (upcoming.length > 0) {
        const top = upcoming[0];
        const dueLabel = top.days === 0 ? 'due today' : top.days === 1 ? 'due tomorrow' : `due in ${top.days}d`;
        items.push({
          id: 'upcoming-return',
          icon: Clock,
          tone: top.days <= 2 ? 'amber' : 'blue',
          title: `${top.r.returnType} ${dueLabel}`,
          detail: `${periodToLabel(top.r.period)} · ${returns.filter((r) => r.status !== 'filed').length} return${returns.filter((r) => r.status !== 'filed').length > 1 ? 's' : ''} pending`,
          view: 'returns',
        });
      }
    }

    // 2. Overdue invoices (real snapshot.overdueInvoiceCount)
    if (snapshot.overdueInvoiceCount > 0) {
      items.push({
        id: 'overdue-invoices',
        icon: FileText,
        tone: 'rose',
        title: `${snapshot.overdueInvoiceCount} overdue invoice${snapshot.overdueInvoiceCount > 1 ? 's' : ''}`,
        detail: `${abbreviateINR(snapshot.overdueReceivables ?? 0)} past due · click to follow up`,
        view: 'invoices',
      });
    }

    // 3. Pending collections (real snapshot.collections.totalOutstanding)
    const outstanding = snapshot.collections?.totalOutstanding ?? 0;
    if (outstanding > 0 && snapshot.overdueInvoiceCount === 0) {
      items.push({
        id: 'pending-collection',
        icon: Wallet,
        tone: 'amber',
        title: `${abbreviateINR(outstanding)} pending collection`,
        detail: `${snapshot.invoices.count} invoice${snapshot.invoices.count === 1 ? '' : 's'} outstanding · click to chase`,
        view: 'invoices',
      });
    }

    // 4. Critical compliance issues (real metrics.criticalIssues)
    if (metrics.criticalIssues > 0) {
      items.push({
        id: 'critical-issues',
        icon: AlertTriangle,
        tone: 'amber',
        title: `${metrics.criticalIssues} reconciliation issue${metrics.criticalIssues > 1 ? 's' : ''}`,
        detail: 'Bank reconciliation needs review — resolve before next filing',
        view: 'reconcile',
      });
    }

    // 5. Pending GST liability (real snapshot.gst.netLiability)
    if (pendingGst > 0) {
      items.push({
        id: 'gst-liability',
        icon: Receipt,
        tone: 'amber',
        title: `${abbreviateINR(pendingGst)} GST liability pending`,
        detail: 'Net output tax − input tax credit · file to settle',
        view: 'returns',
      });
    }

    // NOTE: "Bank reconciliation up to date" was previously shown here as a
    // pseudo-action. Removed — it was a status, not an action, and added
    // noise to the Action Center. Real actions only now.

    return items;
  }, [returns, snapshot, metrics, pendingGst]);

  // ═══════════════════════════════════════════════════════════════════════════
  // EARLY RETURNS — safe now because every hook above ran unconditionally.
  // ═══════════════════════════════════════════════════════════════════════════
  if (allLoading && !loadingTimedOut) {
    return <DashboardSkeleton />;
  }

  // ── Hard error state (only for non-permission, non-network failures) ──
  const isPermissionOrNetworkError = (msg: string | null): boolean => {
    if (!msg) return false;
    return /permission|insufficient|unauthenticated|not authorized|missing or|network|fetch|failed to fetch|load failed/i.test(msg);
  };
  if (snapshotError && !isPermissionOrNetworkError(snapshotError)) {
    return (
      <div className="relative max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-10">
        <div className="glass-surface rounded-2xl p-8 text-center border border-rose-500/20">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 mx-auto mb-4">
            <AlertTriangle className="h-6 w-6 text-rose-400" />
          </div>
          <h3 className="font-semibold text-foreground text-lg">
            We couldn&apos;t load your dashboard
          </h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
            Something went wrong while fetching your business data. Please try again.
          </p>
          <div className="flex items-center justify-center gap-2 mt-5">
            <Button onClick={refreshSnapshot} className="accent-gradient text-white hover:opacity-90 gap-1.5">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()} className="gap-1.5">
              Reload page
            </Button>
            <Button variant="ghost" onClick={() => setCurrentView('settings')} className="text-muted-foreground gap-1.5">
              <LifeBuoy className="h-4 w-4" />
              Support
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NON-HOOK DERIVED VALUES (safe to compute after the early returns above)
  // ═══════════════════════════════════════════════════════════════════════════
  const firstName = getFirstName(user?.name);
  const todaysRevenue = snapshot.revenueThisMonth ?? 0;

  // ── AI recommendation icon mapping ──
  const iconForAIRec = (type: AIRecommendation['type']): LucideIcon => {
    switch (type) {
      case 'cash': return IndianRupee;
      case 'receivables': return Clock;
      case 'compliance': return FileText;
      case 'growth': return TrendingUp;
      case 'risk': return AlertTriangle;
      case 'customer': return Users;
      default: return Sparkles;
    }
  };

  const priorityTone: Record<string, ActionItem['tone']> = {
    critical: 'rose',
    high: 'amber',
    medium: 'blue',
    low: 'emerald',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
      <div className="relative z-10 space-y-6 md:space-y-8">
        {/* ════════════════════════════════════════════════════════════════════
            SECTION 1 — HERO
            Greeting + 3 hero stats (Health Score, Today's Revenue, Pending GST)
            + 3 quick actions.
        ════════════════════════════════════════════════════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' as const }}
          className="space-y-6"
        >
          {/* Greeting — single line, no redundant summary (tiles below show the numbers) */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {getGreeting()},{' '}
                <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {firstName}
                </span>
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {snapshot.hasLiveData
                  ? `${actionItems.length > 0 ? `${actionItems.length} action${actionItems.length === 1 ? '' : 's'} pending` : 'You\'re all caught up'} · ${abbreviateINR(snapshot.bankBalance)} cash on hand`
                  : 'Your workspace is ready — create your first invoice to see live business data here.'}
              </p>
            </div>
            {/* Health Score badge — moved out of hero stats into a compact pill */}
            {hasHealthScore && healthTier && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-surface shrink-0">
                <Brain className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs font-medium text-muted-foreground">Health</span>
                <span className="text-sm font-bold text-foreground tabular-nums">{snapshot.healthScore}</span>
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0 rounded-full ${BADGE_TONE[healthTier.tone]}`}>
                  {healthTier.label}
                </span>
              </div>
            )}
          </div>

          {/* 3 Hero Stats — EXECUTIVE PRIORITY ORDER:
              1. Cash Position  → "How much money do I have?"
              2. This Month's Revenue → revenue performance
              3. Pending GST → compliance status
              No per-stat CTAs (they duplicated the quick-action buttons below). */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Cash Position — bank balance + net cash flow */}
            <HeroStat
              index={0}
              label="Cash Position"
              numericValue={snapshot.bankBalance}
              numericFormat="currencyCompact"
              subtitle={
                snapshot.bankBalance > 0
                  ? `Bank balance · ${snapshot.netCashFlow >= 0 ? '+' : ''}${abbreviateINR(snapshot.netCashFlow)} net flow this FY`
                  : 'Connect your bank account to see live cash position'
              }
              icon={<Wallet className="h-4 w-4 text-emerald-400" />}
              accent="emerald"
            />

            {/* 2. This Month's Revenue */}
            <HeroStat
              index={1}
              label="This Month's Revenue"
              numericValue={todaysRevenue}
              numericFormat="currencyCompact"
              subtitle={
                todaysRevenue > 0
                  ? `${snapshot.invoices.count} invoice${snapshot.invoices.count === 1 ? '' : 's'} issued · FY total ${abbreviateINR(snapshot.revenue)}`
                  : 'No invoices issued this month yet'
              }
              icon={<IndianRupee className="h-4 w-4 text-blue-400" />}
              accent="blue"
            >
              {todaysRevenue > 0 && revenueMom.direction !== 'flat' && (
                <div className={`flex items-center gap-1 mt-1.5 text-[11px] font-medium ${revenueMom.direction === 'up' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {revenueMom.direction === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {revenueMom.pct}% vs last month
                </div>
              )}
            </HeroStat>

            {/* 3. Pending GST */}
            <HeroStat
              index={2}
              label="Pending GST"
              numericValue={pendingGst}
              numericFormat="currencyCompact"
              subtitle={
                pendingGst > 0
                  ? `Output ${abbreviateINR(snapshot.gst?.outputTax ?? 0)} − ITC ${abbreviateINR(snapshot.gst?.inputTax ?? 0)} · file to settle`
                  : 'No net GST liability · all output tax offset by input tax credit'
              }
              icon={<Receipt className="h-4 w-4 text-amber-400" />}
              accent="amber"
            />
          </div>

          {/* Primary Quick Actions — ONE entry point per feature, no duplication */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              size="sm"
              onClick={() => setCurrentView('invoices')}
              className="gap-2 accent-gradient text-white px-4 py-2 shadow-[0_4px_14px_rgba(0,0,0,0.25)] transition-all hover:scale-[1.02] hover:shadow-md active:scale-95"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/20">
                <FileText className="h-3.5 w-3.5 text-white" />
              </span>
              Create Invoice
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentView('returns')}
              className="gap-2 border border-border bg-transparent px-4 py-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-all hover:scale-[1.02] hover:shadow-md active:scale-95"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-md accent-gradient-soft">
                <ShieldCheck className="h-3.5 w-3.5 accent-text" />
              </span>
              File GST Return
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentView('clients')}
              className="gap-2 border border-border bg-transparent px-4 py-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-all hover:scale-[1.02] hover:shadow-md active:scale-95"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-md accent-gradient-soft">
                <Users className="h-3.5 w-3.5 accent-text" />
              </span>
              Add Client
            </Button>
          </div>
        </motion.section>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 2 — WORKFLOW PIPELINE (Task 12 · Step 1)
            The CENTRAL visual element. Shows the live state of every business
            object as it flows through the canonical workflow:
              Invoice → Payment → Bank → Match → GST → Oracle → Approve → Done
            Every stage count comes from real Prisma data. Clicking a stage
            navigates to the relevant module. The "User Approves" stage pulses
            when it has items waiting — it's the action bottleneck.
        ════════════════════════════════════════════════════════════════════ */}
        <WorkflowPipeline
          pipeline={pipeline}
          loading={pipelineLoading}
          onNavigate={(view) => setCurrentView(view as AppView)}
          onRefresh={refreshPipeline}
        />

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 3 — PROACTIVE ORACLE BRIEFING (Task 12 · Step 3)
            Oracle does NOT wait for prompts. Oracle wakes up with knowledge.
            This renders the daily briefing as a CFO would speak — what Oracle
            already done, what needs the user's sign-off, and what Oracle is
            watching. One-click approve/review actions on every attention item.
        ════════════════════════════════════════════════════════════════════ */}
        <ProactiveOracleBriefing
          briefing={briefing}
          loading={briefingLoading}
          onNavigate={(view) => setCurrentView(view as AppView)}
          onRefresh={refreshBriefing}
          onOpenOracle={() => router.push('/oracle')}
        />

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 3 — BUSINESS SNAPSHOT
            7 tiles: Revenue, Profit, Expenses, Cash Flow, Invoices, Clients,
            GST Returns. Real numbers + real MoM indicator + a real revenue vs
            expenses bar.
        ════════════════════════════════════════════════════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.16, ease: 'easeOut' as const }}
          className="glass-surface rounded-2xl p-5 md:p-6"
        >
          <SectionHeader
            title="Business Snapshot"
            icon={<Database className="h-4 w-4 accent-text" />}
            actionLabel="View analytics"
            onAction={() => setCurrentView('analytics')}
          />

          {/* 7-tile responsive grid: 2 cols mobile, 4 cols tablet, 7 cols desktop */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <SnapshotTile
              index={0}
              label="Revenue"
              numericValue={snapshot.revenue}
              numericFormat="currencyCompact"
              subtitle="FY-to-date invoiced sales"
              icon={<IndianRupee className="h-3.5 w-3.5 text-emerald-400" />}
              mom={revenueMom}
              onClick={() => setCurrentView('invoices')}
            />
            <SnapshotTile
              index={1}
              label="Profit"
              numericValue={snapshot.profit}
              numericFormat="currencyCompact"
              subtitle={`${snapshot.profitMargin > 0 ? `${(snapshot.profitMargin * 100).toFixed(0)}% margin` : 'revenue − expenses'}`}
              icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-400" />}
              onClick={() => setCurrentView('analytics')}
            />
            <SnapshotTile
              index={2}
              label="Expenses"
              numericValue={snapshot.expenses}
              numericFormat="currencyCompact"
              subtitle="Purchases + operating costs"
              icon={<TrendingDown className="h-3.5 w-3.5 text-rose-400" />}
              onClick={() => setCurrentView('expenses')}
            />
            <SnapshotTile
              index={3}
              label="Cash Flow"
              numericValue={snapshot.netCashFlow}
              numericFormat="currencyCompact"
              subtitle={`Collected − paid · bank ${abbreviateINR(snapshot.bankBalance)}`}
              icon={<Wallet className="h-3.5 w-3.5 text-cyan-400" />}
              onClick={() => setCurrentView('banking')}
            />
            <SnapshotTile
              index={4}
              label="Invoices"
              numericValue={snapshot.invoices.count}
              numericFormat="integer"
              subtitle={`${snapshot.invoices.overdue > 0 ? `${snapshot.invoices.overdue} overdue` : 'none overdue'}`}
              icon={<FileText className="h-3.5 w-3.5 text-violet-400" />}
              onClick={() => setCurrentView('invoices')}
            />
            <SnapshotTile
              index={5}
              label="Clients"
              numericValue={snapshot.customers}
              numericFormat="integer"
              subtitle={`${snapshot.customers === 1 ? '1 active client' : `${snapshot.customers} active clients`}`}
              icon={<Users className="h-3.5 w-3.5 text-blue-400" />}
              onClick={() => setCurrentView('clients')}
            />
            <SnapshotTile
              index={6}
              label="GST Returns"
              numericValue={snapshot.filedReturns + snapshot.pendingReturns}
              numericFormat="integer"
              subtitle={`${snapshot.filedReturns} filed · ${snapshot.pendingReturns} pending`}
              icon={<Receipt className="h-3.5 w-3.5 text-amber-400" />}
              onClick={() => setCurrentView('returns')}
            />
          </div>

          {/* Revenue vs Expenses real bar */}
          <div className="mt-5 pt-5 border-t border-white/[0.06]">
            <RevenueExpenseBar revenue={snapshot.revenue} expenses={snapshot.expenses} />
          </div>
        </motion.section>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 4 — ACTION CENTER + SECTION 5 — AI RECOMMENDATIONS
            (side by side on desktop, lazy-loaded when scrolled into view)
        ════════════════════════════════════════════════════════════════════ */}
        <LazySection placeholderHeight={380}>
          {(inView) => inView ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SECTION 4 — ACTION CENTER */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.22, ease: 'easeOut' as const }}
            className="glass-surface rounded-2xl p-5 md:p-6 flex flex-col"
          >
            <SectionHeader
              title="Action Center"
              icon={<Zap className="h-4 w-4 accent-text" />}
            />
            {actionItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-10 flex-1">
                <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">You&apos;re all caught up</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                  Nothing requires your attention right now. New actions will appear here as invoices come due, returns need filing, or syncs complete.
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-[420px] -mx-1 px-1 flex-1">
                <div className="space-y-1">
                  {actionItems.map((item, i) => (
                    <div key={item.id} onClick={() => setCurrentView(item.view)}>
                      <ActionRow item={item} index={i} />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </motion.section>

          {/* SECTION 5 — AI RECOMMENDATIONS */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.28, ease: 'easeOut' as const }}
            className="glass-surface rounded-2xl p-5 md:p-6 flex flex-col"
          >
            <SectionHeader
              title="AI Recommendations"
              icon={<Sparkles className="h-4 w-4 accent-text" />}
              actionLabel={aiRecommendations.length > 0 ? `View all (${aiRecommendations.length})` : undefined}
              onAction={aiRecommendations.length > 0 ? () => router.push('/oracle') : undefined}
            />
            {aiRecsLoading ? (
              <div className="space-y-2 flex-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-white/[0.04] animate-pulse" />
                ))}
              </div>
            ) : aiRecommendations.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-10 flex-1">
                <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-3">
                  <Brain className="h-6 w-6 text-amber-400" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">No recommendations yet</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                  Oracle generates recommendations from your live business data. Connect Zoho Books or create invoices to unlock AI-driven insights on GST liability, cash flow, and risk.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push('/oracle')}
                  className="mt-3 gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                >
                  <Brain className="h-3.5 w-3.5" />
                  Open Oracle
                </Button>
              </div>
            ) : (
              <ScrollArea className="max-h-[420px] -mx-1 px-1 flex-1">
                <div className="space-y-2">
                  {aiRecommendations.slice(0, 6).map((rec, i) => {
                    const Icon = iconForAIRec(rec.type);
                    const tone = priorityTone[rec.priority] ?? 'blue';
                    const actionCfg = ACTION_TONE[tone];
                    return (
                      <motion.div
                        key={rec.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.04, ease: 'easeOut' as const }}
                        className="group flex items-start gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors"
                      >
                        <div className={`flex items-center justify-center h-9 w-9 rounded-lg border shrink-0 ${actionCfg.chip}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="text-[13px] font-medium text-foreground leading-snug">{rec.title}</p>
                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${actionCfg.chip} capitalize`}>
                              {rec.priority}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{rec.description}</p>
                          <button
                            type="button"
                            onClick={() => rec.actionView ? setCurrentView(rec.actionView as AppView) : router.push('/oracle')}
                            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold accent-text hover:opacity-80 transition-opacity"
                          >
                            View Details
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </motion.section>
        </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-surface rounded-2xl p-5 md:p-6 h-[380px] flex items-center justify-center">
                <ProSkeleton className="h-8 w-32" />
              </div>
              <div className="glass-surface rounded-2xl p-5 md:p-6 h-[380px] flex items-center justify-center">
                <ProSkeleton className="h-8 w-32" />
              </div>
            </div>
          )}
        </LazySection>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 6 — RECENT ACTIVITY (lazy-loaded when scrolled into view)
            A single chronological feed of every business event: invoices,
            returns, payments, bank sync, Zoho sync, Google Drive.
        ════════════════════════════════════════════════════════════════════ */}
        <LazySection placeholderHeight={360}>
          {(inView) => inView ? (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.34, ease: 'easeOut' as const }}
          className="glass-surface rounded-2xl p-5 md:p-6"
        >
          <SectionHeader
            title="Recent Activity"
            icon={<Activity className="h-4 w-4 accent-text" />}
            actionLabel="View timeline"
            onAction={() => setCurrentView('timeline')}
          />
          {timelineLoading && timelineEvents.length === 0 ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white/[0.04] animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-1/2 rounded bg-white/[0.04] animate-pulse" />
                    <div className="h-2.5 w-1/4 rounded bg-white/[0.04] animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : timelineEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-10">
              <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] mb-3">
                <Activity className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">No activity yet</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">
                Actions you take — invoices created, returns filed, payments received, bank/Zoho/Google syncs — will appear here chronologically.
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[440px] -mx-1 px-1">
              <div className="relative">
                <ul className="space-y-0">
                  {timelineEvents.slice(0, 12).map((ev: TimelineEvent, i: number) => {
                    const isLast = i === Math.min(timelineEvents.length, 12) - 1;
                    const { icon: Icon, tone } = activityIconFor(ev.type, ev.source);
                    return (
                      <li key={ev.id} className="relative flex gap-3 pb-4 last:pb-0">
                        {!isLast && (
                          <span
                            className="absolute left-[15px] top-8 bottom-0 w-px bg-white/[0.06]"
                            aria-hidden
                          />
                        )}
                        <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] shrink-0 mt-0.5">
                          <Icon className={`h-4 w-4 ${tone}`} />
                        </span>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[13px] font-medium text-foreground leading-snug">
                              {ev.title}
                            </p>
                            <span className="text-[10px] text-muted-foreground/70 shrink-0 tabular-nums">
                              {ev.createdAt ? timeAgo(ev.createdAt) : ''}
                            </span>
                          </div>
                          {ev.description && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                              {ev.description}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                              {ev.source}
                            </span>
                            {ev.severity && ev.severity !== 'info' && (
                              <span className={`text-[9px] font-semibold uppercase tracking-wider ${
                                ev.severity === 'critical' ? 'text-rose-400'
                                : ev.severity === 'warning' ? 'text-amber-400'
                                : 'text-emerald-400'
                              }`}>
                                · {ev.severity}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </ScrollArea>
          )}
        </motion.section>
          ) : (
            <div className="glass-surface rounded-2xl p-5 md:p-6 h-[360px] flex items-center justify-center">
              <ProSkeleton className="h-8 w-32" />
            </div>
          )}
        </LazySection>
      </div>
    </div>
  );
}
