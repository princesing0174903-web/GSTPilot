'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — AI Mission Control™
// The ONE screen. Open GSTPilot in the morning → receive one screen.
// Greeting · Business Score · 3 mini stats · ONE AI Insight · RUN MY BUSINESS
// How can I help today? · AI Recommendations · Recent Activity
// No dashboards. No clutter. No menus.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState, useEffect, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles, TrendingDown, AlertTriangle, Clock, Brain,
  Rocket, Wallet, ArrowRight, IndianRupee, ShieldAlert,
  ArrowUp, Activity,
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

// ─── Relative time formatter (for Recent Activity) ────────────────────────────
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

  // 6. Always-on "Run My Business" nudge if nothing urgent
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

// ─── Mini Stat ────────────────────────────────────────────────────────────────

function MiniStat({
  label, value, icon: Icon, hint,
}: {
  label: string;
  value: string;
  icon: typeof IndianRupee;
  hint?: string;
}) {
  return (
    <div className="glass-surface rounded-xl p-4 flex items-center gap-3">
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

// ─── AI Insight Row ───────────────────────────────────────────────────────────

function InsightRow({
  insight, index, onAction,
}: {
  insight: AIInsight;
  index: number;
  onAction: (view: AppView) => void;
}) {
  const Icon = insight.icon;
  const toneColor =
    insight.tone === 'risk' ? 'text-amber-400' :
    insight.tone === 'success' ? 'text-emerald-400' :
    'text-cyan-400';

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.3 + index * 0.08 }}
      className="group flex items-start gap-4 rounded-xl p-4 hover:bg-white/[0.03] transition-colors"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-lg accent-gradient-soft shrink-0 mt-0.5">
        <Icon className={`h-4 w-4 ${toneColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{insight.what}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{insight.why}</p>
      </div>
      <button
        onClick={() => onAction(insight.actionView)}
        className="shrink-0 inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/20"
      >
        {insight.actionLabel}
        <ArrowRight className="h-3 w-3" />
      </button>
    </motion.div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function MissionControlSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-10 space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-10 w-72" />
      </div>
      <div className="flex flex-col lg:flex-row gap-8 items-center">
        <Skeleton className="h-56 w-56 rounded-full" />
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      </div>
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-14 max-w-2xl rounded-2xl mx-auto" />
      <Skeleton className="h-40 rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MissionControlPage() {
  const { setCurrentView } = useApp();
  const { user } = useAuth();
  const { metrics, loading, error } = useLiveDashboardMetrics();
  const { data: clients } = useFireClients();
  const { data: activities } = useFireActivities();

  // ── Ask-input local state ──
  const [askInput, setAskInput] = useState('');

  // ── Graceful loading timeout ──
  // If live data hasn't arrived in 3.5s (e.g. slow backend or offline), stop
  // blocking the UI — render with whatever metrics we have (empty → null score
  // + "all clear" insight). Premium UX never makes the user stare at a skeleton.
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

  // Hero insight (first) + remaining for AI Recommendations card
  const heroInsight = insights[0];
  const remainingInsights = insights.slice(1);

  const tier = scoreTier(businessScore);

  // ── Cash position label ──
  const cashLabel = useMemo(() => {
    if (metrics.totalTaxVolume === 0 && metrics.totalClients === 0) return '—';
    if (businessScore === null) return '—';
    if (businessScore >= 80) return 'Healthy';
    if (businessScore >= 60) return 'Stable';
    if (businessScore >= 40) return 'Tight';
    return 'Strained';
  }, [metrics.totalTaxVolume, metrics.totalClients, businessScore]);

  // ── Recent activities (top 6) ──
  const recentActivities = useMemo(() => activities.slice(0, 6), [activities]);

  // ── Ask GSTPilot Intelligence ──
  const ask = (q: string) => {
    const question = q.trim();
    if (!question) return;
    window.dispatchEvent(new CustomEvent('gstpilot-ask', { detail: question }));
  };

  const handleAskSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(askInput);
    setAskInput('');
  };

  // ── Suggestion chips ──
  const suggestions: Array<{ label: string; onClick: () => void }> = [
    { label: 'Show pending returns', onClick: () => ask('Show pending returns') },
    { label: 'Run my firm', onClick: () => setCurrentView('autopilot') },
    { label: 'Why did collections drop?', onClick: () => ask('Why did collections drop?') },
    { label: 'Show risky clients', onClick: () => setCurrentView('clients') },
    { label: 'Generate report', onClick: () => ask('Generate a business report') },
  ];

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
      {/* Subtle radial glow at top */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.10),_transparent_60%)]"
        aria-hidden
      />

      <div className="relative max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-8">

        {/* ═══ 1. HEADER ═══ */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="space-y-1.5"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 accent-text" />
            Today&apos;s Business Score
          </p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            {greeting()}, {firstName(user?.name)} 👋
          </h1>
        </motion.div>

        {/* ═══ 2 + 3. SCORE GAUGE + MINI STATS ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: 'easeOut' }}
          className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-center"
        >
          <div className="flex flex-col items-center gap-2">
            <ScoreGauge score={businessScore} />
            <div className="text-center">
              <span className={`text-sm font-semibold ${tier.color}`}>{tier.label}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full lg:flex-1">
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
              hint={metrics.matchPercentage < 100 ? `${metrics.matchPercentage.toFixed(0)}% reconciled` : 'Fully reconciled'}
            />
            <MiniStat
              label="Compliance"
              value={metrics.pendingReturns + metrics.overdueReturns > 0
                ? `${metrics.pendingReturns + metrics.overdueReturns} pending`
                : 'All clear'}
              icon={ShieldAlert}
              hint={metrics.overdueReturns > 0 ? `${metrics.overdueReturns} overdue` : `${metrics.filedReturns} filed`}
            />
          </div>
        </motion.div>

        {/* ═══ 4. AI INSIGHT (hero one-liner) ═══ */}
        {heroInsight && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16, ease: 'easeOut' }}
            className="glass-surface rounded-2xl p-5 md:p-6"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl accent-gradient shrink-0">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  AI Insight
                </p>
                <p className="text-base md:text-lg font-medium text-foreground leading-snug mt-1">
                  {heroInsight.what}
                </p>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  {heroInsight.why}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ 5. RUN MY BUSINESS (centerpiece) ═══ */}
        <div className="flex justify-center">
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.24, ease: 'easeOut' }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setCurrentView('run-my-business')}
            aria-label="Run my business"
            className="group w-full max-w-2xl flex items-center justify-center gap-3 rounded-2xl accent-gradient py-4 px-6 text-base md:text-lg font-semibold text-white shadow-lg shadow-emerald-500/30 transition-shadow hover:shadow-emerald-500/40"
          >
            <Rocket className="h-5 w-5" />
            <span>RUN MY BUSINESS</span>
            <ArrowRight className="h-4 w-4 opacity-70 transition-transform group-hover:translate-x-0.5" />
          </motion.button>
        </div>

        {/* ═══ 6. HOW CAN I HELP TODAY? ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.32, ease: 'easeOut' }}
          className="glass-surface rounded-2xl p-5 md:p-6 space-y-4"
        >
          <h3 className="text-sm font-semibold text-muted-foreground">
            How can I help today?
          </h3>

          {/* Hero input */}
          <form onSubmit={handleAskSubmit} className="relative">
            <input
              type="text"
              value={askInput}
              onChange={(e) => setAskInput(e.target.value)}
              placeholder="Ask GSTPilot Intelligence..."
              aria-label="Ask GSTPilot Intelligence"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-3.5 pl-4 pr-14 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-emerald-400/30 focus:bg-white/[0.05] transition-colors"
            />
            <button
              type="submit"
              disabled={!askInput.trim()}
              aria-label="Submit question"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg accent-gradient disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              <ArrowUp className="h-4 w-4 text-white" />
            </button>
          </form>

          {/* Suggestion chips */}
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.label}
                onClick={s.onClick}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/[0.07] hover:text-foreground transition-colors"
              >
                {s.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ═══ 7. AI RECOMMENDATIONS + RECENT ACTIVITY ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.40, ease: 'easeOut' }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* LEFT: AI Recommendations */}
          <div className="glass-surface rounded-2xl p-2 md:p-3 flex flex-col">
            <div className="flex items-center gap-2 px-4 py-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg accent-gradient-soft shrink-0">
                <Sparkles className="h-4 w-4 accent-text" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">AI Recommendations</h2>
            </div>
            <div className="max-h-80 overflow-y-auto custom-scrollbar pr-1">
              {remainingInsights.length > 0 ? (
                <div className="space-y-1">
                  {remainingInsights.map((insight, i) => (
                    <InsightRow
                      key={insight.id}
                      insight={insight}
                      index={i}
                      onAction={(v) => setCurrentView(v)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center px-6 py-10">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full accent-gradient-soft mb-3">
                    <Sparkles className="h-5 w-5 accent-text" />
                  </div>
                  <p className="text-sm text-foreground font-medium">You&apos;re all set</p>
                  <p className="text-xs text-muted-foreground mt-1">No further recommendations right now.</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Recent Activity */}
          <div className="glass-surface rounded-2xl p-2 md:p-3 flex flex-col">
            <div className="flex items-center gap-2 px-4 py-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg accent-gradient-soft shrink-0">
                <Activity className="h-4 w-4 accent-text" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
            </div>
            <div className="max-h-80 overflow-y-auto custom-scrollbar pr-1">
              {recentActivities.length > 0 ? (
                <div className="space-y-1">
                  {recentActivities.map((act, i) => (
                    <motion.div
                      key={act.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: 0.3 + i * 0.06, ease: 'easeOut' }}
                      className="flex items-start gap-3 rounded-xl px-4 py-3 hover:bg-white/[0.03] transition-colors"
                    >
                      <div className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald-400/20 shrink-0 mt-0.5">
                        <div className="h-1.5 w-1.5 rounded-full accent-gradient" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{act.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo(act.createdAt)}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center px-6 py-10">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full accent-gradient-soft mb-3">
                    <Activity className="h-5 w-5 accent-text" />
                  </div>
                  <p className="text-sm text-foreground font-medium">No recent activity yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Actions across your firm will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
