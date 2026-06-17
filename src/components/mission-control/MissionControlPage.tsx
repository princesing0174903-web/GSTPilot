'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ V15 — Mission Control
// The main workspace hero: Greeting · AI Insight · Business Score · 3 KPI · 5 Widgets.
// The global Command Bar (bottom) + Oracle Panel (right) are separate surfaces,
// built by other agents. This file is purely the focused home workspace.
// No clutter. No menus. No fake data. Calm, premium, expensive.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState, useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles, TrendingDown, AlertTriangle, Clock, Brain,
  Wallet, ArrowRight, IndianRupee, ShieldAlert,
  ListTodo, Plug, Users, Lightbulb, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useApp, type AppView } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  useLiveDashboardMetrics,
  useFireClients,
  useFireActivities,
} from '@/hooks/use-firestore';
import type { FirestoreClient, FirestoreReturn } from '@/lib/firestore-schema';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(amount: number): string {
  if (!isFinite(amount) || isNaN(amount)) return '₹0';
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function firstName(name?: string): string {
  if (!name) return 'there';
  return name.split(' ')[0];
}

// ─── Relative time formatter (for Business Timeline widget) ───────────────────
// Firestore timestamps are converted to ISO strings by use-firestore's convertDoc,
// but we defensively handle Date objects and raw Firestore Timestamps too.

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

// ─── Business Score computation ───────────────────────────────────────────────
// Start at 100. Subtract weighted penalties for risk signals. Clamp 0–100.
// If there is no data at all, return null (UI shows welcoming state).

function computeBusinessScore(opts: {
  totalClients: number;
  criticalIssues: number;
  warnings: number;
  pendingReturns: number;
  overdueReturns: number;
  averageHealthScore: number;
  matchPercentage: number;
}): number | null {
  const { totalClients, criticalIssues, warnings, pendingReturns, overdueReturns, averageHealthScore, matchPercentage } = opts;
  if (totalClients === 0 && pendingReturns === 0 && overdueReturns === 0) return null;

  let score = 100;
  score -= criticalIssues * 6;      // critical issues are serious
  score -= warnings * 2;            // warnings are minor
  score -= overdueReturns * 8;      // overdue returns hurt most
  score -= pendingReturns * 2;      // pending returns are a mild drag
  // Health score gap: if avg health < 80, drag down
  if (averageHealthScore > 0) {
    score -= Math.max(0, 80 - averageHealthScore) * 0.6;
  }
  // Reconciliation gap: if match % < 100, mild drag
  score -= Math.max(0, 100 - matchPercentage) * 0.3;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreTier(score: number | null): { label: string; color: string } {
  if (score === null) return { label: '—', color: 'text-muted-foreground' };
  if (score >= 85) return { label: 'Excellent', color: 'text-emerald-400' };
  if (score >= 70) return { label: 'Healthy', color: 'text-cyan-400' };
  if (score >= 50) return { label: 'At Risk', color: 'text-amber-400' };
  return { label: 'Critical', color: 'text-red-400' };
}

// ─── AI Insight engine ────────────────────────────────────────────────────────
// Each insight: { icon, what (the observation), why (reasoning), action (label + view) }
// Answers the 3 questions: What happened? Why? What should I do next?

interface AIInsight {
  id: string;
  icon: typeof Sparkles;
  tone: 'risk' | 'info' | 'success';
  what: string;
  why: string;
  actionLabel: string;
  actionView: AppView;
}

function buildInsights(opts: {
  metrics: {
    totalClients: number;
    pendingReturns: number;
    overdueReturns: number;
    criticalIssues: number;
    warnings: number;
    totalTaxVolume: number;
    averageHealthScore: number;
    matchPercentage: number;
    upcomingFilings: FirestoreReturn[];
  };
  clients: Array<FirestoreClient & { id: string }>;
}): AIInsight[] {
  const { metrics, clients } = opts;
  const insights: AIInsight[] = [];

  // 1. Overdue returns — most urgent
  if (metrics.overdueReturns > 0) {
    insights.push({
      id: 'overdue-returns',
      icon: AlertTriangle,
      tone: 'risk',
      what: `${metrics.overdueReturns} GST return${metrics.overdueReturns > 1 ? 's are' : ' is'} overdue`,
      why: 'Overdue returns trigger notices and late fees. File immediately to avoid penalties.',
      actionLabel: 'File Now',
      actionView: 'returns',
    });
  }

  // 2. Pending returns due soon (next filing in upcomingFilings)
  const nextFiling = metrics.upcomingFilings[0];
  if (nextFiling && metrics.pendingReturns > 0 && metrics.overdueReturns === 0) {
    insights.push({
      id: 'gst-due',
      icon: Clock,
      tone: 'info',
      what: `GST filing due — ${nextFiling.returnType} for ${nextFiling.period}`,
      why: `${metrics.pendingReturns} return${metrics.pendingReturns > 1 ? 's' : ''} pending. Filing on time keeps compliance score high.`,
      actionLabel: 'File GST',
      actionView: 'returns',
    });
  }

  // 3. Critical issues / risky clients
  const riskyClients = clients.filter(c => (c.healthScore ?? 100) < 60);
  if (metrics.criticalIssues > 0 || riskyClients.length > 0) {
    insights.push({
      id: 'churn-risk',
      icon: TrendingDown,
      tone: 'risk',
      what: riskyClients.length > 0
        ? `${riskyClients.length} client${riskyClients.length > 1 ? 's may' : ' may'} churn`
        : `${metrics.criticalIssues} critical issue${metrics.criticalIssues > 1 ? 's' : ''} need attention`,
      why: riskyClients.length > 0
        ? 'Low health scores signal dissatisfaction. Reach out before they leave.'
        : 'Critical issues compound into bigger problems if left unaddressed.',
      actionLabel: riskyClients.length > 0 ? 'View Clients' : 'Review Issues',
      actionView: riskyClients.length > 0 ? 'clients' : 'ai-operating-room',
    });
  }

  // 4. Cash position / collections
  if (metrics.totalTaxVolume > 0) {
    insights.push({
      id: 'collections',
      icon: Wallet,
      tone: metrics.matchPercentage < 90 ? 'risk' : 'info',
      what: metrics.matchPercentage < 90
        ? 'Collections may drop — reconciliation gaps detected'
        : 'Cash position is healthy',
      why: metrics.matchPercentage < 90
        ? `${metrics.matchPercentage.toFixed(0)}% of invoices reconciled. Unmatched invoices mean uncollected revenue.`
        : `${metrics.matchPercentage.toFixed(0)}% invoice match rate. Keep chasing pending collections to maintain runway.`,
      actionLabel: 'Fix Collections',
      actionView: 'reconcile',
    });
  }

  // 5. Compliance score insight
  if (metrics.averageHealthScore > 0) {
    const tier = metrics.averageHealthScore >= 80 ? 'success' : 'info';
    insights.push({
      id: 'compliance',
      icon: ShieldAlert,
      tone: tier,
      what: `Compliance health at ${metrics.averageHealthScore.toFixed(0)}%`,
      why: metrics.averageHealthScore >= 80
        ? 'Strong compliance posture. Maintain by filing on time and resolving warnings.'
        : 'Below optimal. Address pending returns and warnings to lift your score.',
      actionLabel: 'View Compliance',
      actionView: 'returns',
    });
  }

  // 6. Always-on "all clear" nudge if nothing urgent
  if (insights.length === 0) {
    insights.push({
      id: 'all-clear',
      icon: Sparkles,
      tone: 'success',
      what: 'Everything looks good today',
      why: 'No urgent issues. Hand control to AI and let it run the routine work.',
      actionLabel: 'Run My Business',
      actionView: 'run-my-business',
    });
  }

  return insights.slice(0, 6);
}

// ─── Business Score Gauge (SVG) ───────────────────────────────────────────────

function ScoreGauge({ score }: { score: number | null }) {
  const size = 220;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = score === null ? 0 : score / 100;
  const offset = c * (1 - pct);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="missionScoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="50%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />
        {/* Progress arc */}
        {score !== null && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="url(#missionScoreGradient)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {score === null ? (
          <span className="text-4xl font-bold text-muted-foreground">—</span>
        ) : (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className={`text-6xl font-bold tracking-tight ${scoreTier(score).color}`}
          >
            {score}
          </motion.span>
        )}
        <span className="text-xs text-muted-foreground tracking-wider uppercase mt-1">
          / 100
        </span>
      </div>
    </div>
  );
}

// ─── Mini Stat (KPI card) ─────────────────────────────────────────────────────

function MiniStat({
  label, value, icon: Icon, hint,
}: {
  label: string;
  value: string;
  icon: typeof IndianRupee;
  hint?: string;
}) {
  return (
    <div className="glass-surface rounded-2xl p-4 flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg accent-gradient-soft shrink-0">
        <Icon className="h-4 w-4 accent-text" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{label}</p>
        <p className="text-lg font-bold text-foreground leading-tight truncate">{value}</p>
        {hint && <p className="text-[10px] text-muted-foreground truncate">{hint}</p>}
      </div>
    </div>
  );
}

// ─── Widget Card wrapper ──────────────────────────────────────────────────────

function WidgetCard({
  icon: Icon, title, children, delay = 0, className,
}: {
  icon: typeof Sparkles;
  title: string;
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={`glass-surface rounded-3xl p-5 flex flex-col ${className ?? ''}`}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg accent-gradient-soft shrink-0">
          <Icon className="h-4 w-4 accent-text" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </motion.div>
  );
}

// ─── Calm Empty State ─────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon, title, subtitle, actionLabel, onAction,
}: {
  icon: typeof Sparkles;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 px-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full accent-gradient-soft mb-3">
        <Icon className="h-5 w-5 accent-text" />
      </div>
      <p className="text-sm text-foreground font-medium">{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">{subtitle}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-3 inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/20"
        >
          {actionLabel}
          <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function MissionControlSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-10">
      <div className="space-y-3">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-24 rounded-3xl" />
      </div>
      <div className="flex justify-center">
        <Skeleton className="h-56 w-56 rounded-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Skeleton className="h-48 rounded-3xl" />
        <Skeleton className="h-48 rounded-3xl" />
        <Skeleton className="h-48 rounded-3xl" />
        <Skeleton className="h-48 rounded-3xl" />
        <Skeleton className="h-56 rounded-3xl lg:col-span-2" />
      </div>
    </div>
  );
}

// ─── Connected Services catalog (honest: all not-connected by default) ────────

const CONNECTED_SERVICES: Array<{ id: string; name: string; initial: string }> = [
  { id: 'google', name: 'Google', initial: 'G' },
  { id: 'gmail', name: 'Gmail', initial: 'M' },
  { id: 'outlook', name: 'Outlook', initial: 'O' },
  { id: 'gstn', name: 'GSTN', initial: 'G' },
  { id: 'whatsapp', name: 'WhatsApp', initial: 'W' },
  { id: 'bank', name: 'Bank APIs', initial: 'B' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MissionControlPage() {
  const { setCurrentView } = useApp();
  const { user } = useAuth();
  const { metrics, loading, error } = useLiveDashboardMetrics();
  const { data: clients } = useFireClients();
  const { data: activities } = useFireActivities();

  // ── Priority checkbox toggle state (visual only, local) ──
  const [done, setDone] = useState<Record<string, boolean>>({});

  // ── Graceful loading timeout ──
  // If live data hasn't arrived in 3.5s (e.g. slow backend or offline), stop
  // blocking the UI — render with whatever metrics we have (empty → null score
  // + welcoming state). Premium UX never makes the user stare at a skeleton.
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setLoadingTimedOut(true), 3500);
    return () => clearTimeout(t);
  }, [loading]);
  const showLoading = loading && !loadingTimedOut;

  // ── Business Score ──
  const businessScore = useMemo(() => computeBusinessScore({
    totalClients: metrics.totalClients,
    criticalIssues: metrics.criticalIssues,
    warnings: metrics.warnings,
    pendingReturns: metrics.pendingReturns,
    overdueReturns: metrics.overdueReturns,
    averageHealthScore: metrics.averageHealthScore,
    matchPercentage: metrics.matchPercentage,
  }), [metrics]);

  // ── AI Insights ──
  const insights = useMemo(() => buildInsights({
    metrics: {
      totalClients: metrics.totalClients,
      pendingReturns: metrics.pendingReturns,
      overdueReturns: metrics.overdueReturns,
      criticalIssues: metrics.criticalIssues,
      warnings: metrics.warnings,
      totalTaxVolume: metrics.totalTaxVolume,
      averageHealthScore: metrics.averageHealthScore,
      matchPercentage: metrics.matchPercentage,
      upcomingFilings: metrics.upcomingFilings,
    },
    clients: clients as unknown as Array<FirestoreClient & { id: string }>,
  }), [metrics, clients]);

  // Hero insight (first) + compact recommendations (up to 4 more)
  const heroInsight = insights[0];
  const recommendations = useMemo(() => insights.slice(1, 5), [insights]);

  const tier = scoreTier(businessScore);

  // ── "Has data" flag — drives honest empty vs welcoming states ──
  const hasData = useMemo(() => (
    metrics.totalClients > 0 ||
    metrics.pendingReturns > 0 ||
    metrics.overdueReturns > 0 ||
    metrics.totalTaxVolume > 0
  ), [metrics]);

  // ── Cash position label ──
  const cashLabel = useMemo(() => {
    if (!hasData) return '—';
    if (businessScore === null) return '—';
    if (businessScore >= 80) return 'Healthy';
    if (businessScore >= 60) return 'Stable';
    if (businessScore >= 40) return 'Tight';
    return 'Strained';
  }, [hasData, businessScore]);

  // ── Today's Priorities (derived from live data) ──
  const priorities = useMemo<Array<{ id: string; label: string; view: AppView }>>(() => {
    if (!hasData) return [];
    const list: Array<{ id: string; label: string; view: AppView }> = [];
    if (metrics.matchPercentage < 95 || metrics.criticalIssues > 0) {
      list.push({ id: 'collections', label: 'Recover Collections', view: 'reconcile' });
    }
    if (metrics.pendingReturns > 0 || metrics.overdueReturns > 0) {
      list.push({ id: 'gst', label: 'File GST Returns', view: 'returns' });
    }
    // Gentle nudge — always shown when there's data
    list.push({ id: 'expenses', label: 'Review Expenses', view: 'invoices' });
    return list.slice(0, 4);
  }, [hasData, metrics.matchPercentage, metrics.criticalIssues, metrics.pendingReturns, metrics.overdueReturns]);

  // ── Business Timeline (top 5 recent activities) ──
  const timelineActivities = useMemo(() => activities.slice(0, 5), [activities]);

  // ── Loading ──
  if (showLoading) return <MissionControlSkeleton />;

  // ── Error ──
  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="glass-surface rounded-2xl p-8">
          <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-foreground">Couldn&apos;t load your mission control</h3>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      {/* Subtle radial glow at top — adds depth, premium feel */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.10),_transparent_60%)]"
        aria-hidden
      />

      <div className="relative max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-10">

        {/* ═══ 1. HERO — Greeting + AI Insight ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="space-y-6"
        >
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            {greeting()}, {firstName(user?.name)} 👋
          </h1>

          <div className="glass-surface rounded-3xl p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl accent-gradient shrink-0">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  AI Insight
                </p>
                {hasData && heroInsight ? (
                  <>
                    <p className="text-base font-medium text-foreground leading-snug mt-1">
                      {heroInsight.what}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                      {heroInsight.why}
                    </p>
                  </>
                ) : (
                  <p className="text-base font-medium text-foreground leading-snug mt-1">
                    Connect your business data to unlock AI insights.
                  </p>
                )}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══ 2. BUSINESS HEALTH SCORE ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: 'easeOut' }}
          className="flex flex-col items-center gap-2"
        >
          <ScoreGauge score={businessScore} />
          <div className="text-center">
            <span className={`text-sm font-semibold ${tier.color}`}>{tier.label}</span>
          </div>
          {businessScore === null && (
            <p className="text-xs text-muted-foreground text-center max-w-[260px] mt-1">
              Connect your business data to unlock AI insights.
            </p>
          )}
        </motion.section>

        {/* ═══ 3. KPI SECTION — exactly 3 cards ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.16, ease: 'easeOut' }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <MiniStat
            label="Revenue"
            value={metrics.totalTaxVolume > 0 ? formatINR(metrics.totalTaxVolume) : '—'}
            icon={IndianRupee}
            hint="Total tax volume"
          />
          <MiniStat
            label="Cash Position"
            value={cashLabel}
            icon={Wallet}
            hint={hasData
              ? (metrics.matchPercentage < 100
                ? `${metrics.matchPercentage.toFixed(0)}% reconciled`
                : 'Fully reconciled')
              : 'Awaiting data'}
          />
          <MiniStat
            label="Compliance"
            value={metrics.pendingReturns + metrics.overdueReturns > 0
              ? `${metrics.pendingReturns + metrics.overdueReturns} pending`
              : (hasData ? 'Safe' : '—')}
            icon={ShieldAlert}
            hint={hasData
              ? (metrics.overdueReturns > 0
                ? `${metrics.overdueReturns} overdue`
                : `${metrics.filedReturns} filed`)
              : 'Awaiting data'}
          />
        </motion.section>

        {/* ═══ 4. WIDGETS — exactly 5 ═══ */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Widget 1: Today's Priorities */}
          <WidgetCard icon={ListTodo} title="Today's Priorities" delay={0.24}>
            {priorities.length > 0 ? (
              <div className="space-y-1">
                {priorities.map((p) => {
                  const isDone = !!done[p.id];
                  return (
                    <div
                      key={p.id}
                      onClick={() => setCurrentView(p.view)}
                      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.03] transition-colors cursor-pointer"
                    >
                      <button
                        type="button"
                        aria-label={`Mark ${p.label} as ${isDone ? 'incomplete' : 'complete'}`}
                        aria-pressed={isDone}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDone((d) => ({ ...d, [p.id]: !d[p.id] }));
                        }}
                        className={`flex h-5 w-5 items-center justify-center rounded-full border shrink-0 transition-colors ${
                          isDone
                            ? 'accent-gradient border-transparent'
                            : 'border-white/[0.15] hover:border-emerald-400/40'
                        }`}
                      >
                        {isDone && <CheckCircle2 className="h-3 w-3 text-white" />}
                      </button>
                      <span className={`text-sm flex-1 ${isDone ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                        {p.label}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-emerald-400/70 transition-colors shrink-0" />
                    </div>
                  );
                })}
              </div>
            ) : hasData ? (
              <EmptyState
                icon={ListTodo}
                title="You're all caught up"
                subtitle="No priorities right now."
              />
            ) : (
              <EmptyState
                icon={ListTodo}
                title="No priorities yet"
                subtitle="Connect your business data to see priorities."
              />
            )}
          </WidgetCard>

          {/* Widget 2: Business Timeline */}
          <WidgetCard icon={Clock} title="Business Timeline" delay={0.32}>
            {timelineActivities.length > 0 ? (
              <div className="relative">
                {timelineActivities.map((act, i) => {
                  const isLast = i === timelineActivities.length - 1;
                  return (
                    <div key={act.id} className="relative flex gap-3 pb-4 last:pb-0">
                      {!isLast && (
                        <span
                          className="absolute left-[9px] top-6 bottom-0 w-px bg-white/[0.08]"
                          aria-hidden
                        />
                      )}
                      <span className="relative z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-emerald-400/30 bg-[#09090B] shrink-0 mt-0.5">
                        <span className="h-1.5 w-1.5 rounded-full accent-gradient" />
                      </span>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-sm text-foreground leading-snug">{act.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo(act.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={Clock}
                title="No recent activity"
                subtitle="Actions across your firm will appear here."
              />
            )}
          </WidgetCard>

          {/* Widget 3: Connected Services */}
          <WidgetCard icon={Plug} title="Connected Services" delay={0.40}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CONNECTED_SERVICES.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-[11px] font-bold text-muted-foreground shrink-0">
                      {s.initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{s.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                        <span className="text-[10px] text-muted-foreground">Not connected</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground text-center pt-1">
                Connect services to sync automatically.
              </p>
            </div>
          </WidgetCard>

          {/* Widget 4: Team Status */}
          <WidgetCard icon={Users} title="Team Status" delay={0.48}>
            {/* Honest empty state — we don't have team data yet */}
            <EmptyState
              icon={Users}
              title="No team members yet"
              subtitle="Invite your team to collaborate on clients, returns, and reconciliations."
              actionLabel="Invite your team"
              onAction={() => setCurrentView('team')}
            />
          </WidgetCard>

          {/* Widget 5: AI Recommendations — full width */}
          <WidgetCard icon={Lightbulb} title="AI Recommendations" delay={0.56} className="lg:col-span-2">
            {hasData && recommendations.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recommendations.map((insight) => {
                  const Icon = insight.icon;
                  const toneColor =
                    insight.tone === 'risk' ? 'text-amber-400' :
                    insight.tone === 'success' ? 'text-emerald-400' :
                    'text-cyan-400';
                  return (
                    <div
                      key={insight.id}
                      className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg accent-gradient-soft shrink-0">
                          <Icon className={`h-4 w-4 ${toneColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground leading-snug">{insight.what}</p>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{insight.why}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setCurrentView(insight.actionView)}
                        className="self-start inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/20"
                      >
                        {insight.actionLabel}
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={Lightbulb}
                title={hasData ? 'No recommendations right now' : 'No recommendations yet'}
                subtitle={hasData
                  ? 'Your business is in good shape — check back later for new guidance.'
                  : 'Connect your business data for personalized AI guidance.'}
              />
            )}
          </WidgetCard>

        </section>
      </div>
    </div>
  );
}
