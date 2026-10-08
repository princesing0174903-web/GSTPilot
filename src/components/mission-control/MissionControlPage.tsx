'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ V16 — Mission Control
// Obsidian Black 2.0 · Glass 28px blur · Emerald → Cyan → Blue accent
//
// Sections:
//   1. Hero — Greeting + Business Status pill + "X steps away" line + 4 checklist cards
//   2. Business Health Score — Gauge OR premium empty state with [ Connect Data ] CTA
//   3. KPI — exactly 3 cards (Revenue / Cash Position / Compliance), premium empty states
//   4. Widgets — exactly 5 (Today's Priorities · Timeline · Services · Team · AI Recommendations)
//
// Design principles:
//   • No red / orange / purple anywhere. Only Emerald / Cyan / Blue.
//   • Every empty state is helpful, premium, and has a clear CTA button.
//   • Calm framer-motion fade-up (opacity 0, y 12 → 1, 0), staggered 0–0.56s.
//   • 3.5s graceful loading timeout — never make the user stare at a skeleton.
//   • Honest data: never fake connected services, team members, or AI insights.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState, useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, ListTodo, Clock, Plug, Users, Lightbulb, CheckCircle2, ArrowRight,
  Sparkles, TrendingDown, AlertTriangle, Wallet, IndianRupee, ShieldAlert,
  Package, FileText, Database, Building2, Receipt, ArrowRightLeft,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useApp, type AppView } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  useLiveDashboardMetrics,
  useFireActivities,
  useFireClients,
} from '@/hooks/use-firestore';
import { useGSTpilotCustomers } from '@/hooks/useGSTpilotCustomers';
import { useGSTpilotProducts } from '@/hooks/useGSTpilotProducts';
import { useGSTpilotInvoices } from '@/hooks/useGSTpilotInvoices';
import { useGSTpilotVendors } from '@/hooks/useGSTpilotVendors';
import { useGSTpilotExpenses } from '@/hooks/useGSTpilotExpenses';
import { useGSTpilotPayments } from '@/hooks/useGSTpilotPayments';
import { useBusinessSnapshot } from '@/hooks/useBusinessSnapshot';
import { TrustBar } from '@/components/shared/TrustBar';
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

// Relative time formatter — defensively handles ISO string / Date / Firestore Timestamp.
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

// ─── Business Score ───────────────────────────────────────────────────────────
//
// Previously this page computed its OWN client-side 7-input penalty-based
// "Business Score" (start at 100, subtract weighted penalties for
// criticalIssues / warnings / overdueReturns / pendingReturns / avgHealthScore
// / matchPercentage). That formula was a SIXTH independent health engine —
// different from the canonical 8-factor Health Score in
// `src/lib/business/snapshot.ts`.
//
// We now delegate to the canonical Business Snapshot via `useBusinessSnapshot()`
// so Mission Control shows EXACTLY the same Health Score as the Home Dashboard,
// Oracle chat, AI CFO, and Run Business pages. The local `computeBusinessScore`
// function has been removed.
//

// V16 palette — only Emerald / Cyan / Blue. No amber, no red.
function scoreTier(score: number | null): { label: string; color: string } {
  if (score === null) return { label: '—', color: 'text-muted-foreground' };
  if (score >= 85) return { label: 'Excellent', color: 'text-emerald-400' };
  if (score >= 70) return { label: 'Healthy', color: 'text-cyan-400' };
  if (score >= 50) return { label: 'At Risk', color: 'text-blue-400' };
  return { label: 'Critical', color: 'text-blue-300' };
}

// ─── AI Insight engine ────────────────────────────────────────────────────────
// Each insight: { icon, tone, what, why, action (label + view) }
// Answers the 3 questions: What happened? Why? What should I do next?

interface AIInsight {
  id: string;
  icon: LucideIcon;
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
  /** True when the firm has real Firestore data. Gates the "all clear" insight
   *  so we never say "Everything looks good today" when there's no data at all. */
  hasData: boolean;
}): AIInsight[] {
  const { metrics, clients, hasData } = opts;
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

  // 2. Pending returns due soon
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

  // 6. Always-on "all clear" nudge — only when we actually have data.
  // Never say "Everything looks good today" when there is no data at all;
  // in that case the widget shows its own honest empty state instead.
  if (hasData && insights.length === 0) {
    insights.push({
      id: 'all-clear',
      icon: Sparkles,
      tone: 'success',
      what: 'Everything looks good today',
      why: 'No urgent issues. Hand control to Oracle and let it run the routine work.',
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
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="50%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />
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
            transition={{ duration: 1.2, ease: 'easeOut' as const, delay: 0.2 }}
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

// ─── Premium Empty State (V16 differentiator) ─────────────────────────────────
// Helpful · Premium · Intentional. Every empty state has a clear CTA.

function PremiumEmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  onCta,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl glass-surface">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground max-w-[240px] mx-auto leading-relaxed">{description}</p>
      </div>
      {ctaLabel && onCta && (
        <button
          type="button"
          onClick={onCta}
          className="accent-gradient rounded-2xl px-4 py-2 text-xs font-semibold text-white hover-lift mt-1"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

// ─── Checklist Card (Hero Getting Started) ────────────────────────────────────
// Clickable card. Checkbox state is derived from live data — clicking navigates
// the user to the right place to complete that step (it never fakes completion).

function ChecklistCard({
  label,
  description,
  checked,
  delay,
  onClick,
}: {
  label: string;
  description: string;
  checked: boolean;
  delay: number;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' as const }}
      className={`group glass-surface rounded-2xl p-4 text-left hover-lift transition-colors w-full ${
        checked ? 'ring-1 ring-emerald-400/20' : 'hover:bg-white/[0.05]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-6 w-6 items-center justify-center rounded-lg shrink-0 transition-all ${
            checked
              ? 'accent-gradient'
              : 'border border-white/[0.15] bg-white/[0.02] group-hover:border-emerald-400/40'
          }`}
        >
          {checked && <CheckCircle2 className="h-4 w-4 text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground truncate">{label}</p>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-emerald-400/70 transition-colors shrink-0" />
          </div>
          <p className={`text-[11px] mt-0.5 truncate ${checked ? 'text-emerald-400/80' : 'text-muted-foreground'}`}>
            {checked ? 'Connected' : description}
          </p>
        </div>
      </div>
    </motion.button>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
// Tall card with header (icon + label) and either the value or premium empty state.

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  delay,
  hasData,
  emptyTitle,
  emptyDescription,
  ctaLabel,
  onCta,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  delay: number;
  hasData: boolean;
  emptyTitle: string;
  emptyDescription: string;
  ctaLabel: string;
  onCta: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' as const }}
      className="glass-surface rounded-3xl p-5 flex flex-col min-h-[160px]"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl accent-gradient-soft shrink-0">
          <Icon className="h-4 w-4 accent-text" />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      {hasData ? (
        <div className="flex-1 flex flex-col justify-end">
          <p className="text-2xl font-bold text-foreground tracking-tight leading-tight">{value}</p>
          {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <PremiumEmptyState
            icon={Icon}
            title={emptyTitle}
            description={emptyDescription}
            ctaLabel={ctaLabel}
            onCta={onCta}
          />
        </div>
      )}
    </motion.div>
  );
}

// ─── Widget Card wrapper ──────────────────────────────────────────────────────

function WidgetCard({
  icon: Icon, title, children, delay = 0, className,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' as const }}
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

// ─── Registry Stat Card ───────────────────────────────────────────────────────
// Compact 5-per-row stat card for the Live Business Registry section.
// Backed by real-time Firestore onSnapshot via the useGSTpilot* hooks.
// `value === null` renders a skeleton (while the first snapshot loads).

function RegistryStatCard({
  icon: Icon,
  label,
  value,
  onClick,
  delay,
  accent = 'emerald',
}: {
  icon: LucideIcon;
  label: string;
  value: string | null;
  onClick: () => void;
  delay: number;
  accent?: 'emerald' | 'amber';
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' as const }}
      className="glass-surface rounded-2xl p-4 flex flex-col gap-2 min-h-[110px] text-left hover:bg-white/[0.05] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 group"
    >
      <div className="flex items-center justify-between">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-lg shrink-0 ${
            accent === 'amber' ? 'bg-amber-500/10' : 'accent-gradient-soft'
          }`}
        >
          <Icon
            className={`h-3.5 w-3.5 ${accent === 'amber' ? 'text-amber-400' : 'accent-text'}`}
          />
        </div>
        <ArrowRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-emerald-400/70 transition-colors" />
      </div>
      <div className="flex-1 flex flex-col justify-end">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {value === null ? (
          <Skeleton className="h-5 w-20 mt-1.5" />
        ) : (
          <p className="text-xl font-bold text-foreground tracking-tight leading-tight mt-0.5 tabular-nums truncate">
            {value}
          </p>
        )}
      </div>
    </motion.button>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function MissionControlSkeleton() {
  return (
    <div className="relative max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-12">
      {/* Hero skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-5 w-96" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      </div>
      {/* Score skeleton */}
      <div className="flex justify-center">
        <Skeleton className="h-56 w-56 rounded-full" />
      </div>
      {/* KPI skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-40 rounded-3xl" />
        ))}
      </div>
      {/* Widgets skeleton */}
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

// ─── Connected Services catalog ───────────────────────────────────────────────
// Honest: all "Not connected" by default. V16 does not fake integrations.

const CONNECTED_SERVICES: Array<{ id: string; name: string; initial: string }> = [
  { id: 'google',   name: 'Google',     initial: 'G' },
  { id: 'gmail',    name: 'Gmail',      initial: 'M' },
  { id: 'outlook',  name: 'Outlook',    initial: 'O' },
  { id: 'gstn',     name: 'GSTN',       initial: 'G' },
  { id: 'whatsapp', name: 'WhatsApp',   initial: 'W' },
  { id: 'bank',     name: 'Bank APIs',  initial: 'B' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MissionControlPage() {
  const { setCurrentView } = useApp();
  const { user } = useAuth();
  const { metrics, loading, error } = useLiveDashboardMetrics();
  // ── Canonical Business Snapshot ──
  // Replaces the former local 7-input penalty-based "Business Score" with the
  // canonical Health Score from `getBusinessSnapshot()` — the single source of
  // truth shared by every page in the app.
  const { snapshot: businessSnapshot, loading: snapshotLoading } = useBusinessSnapshot();
  const { data: activities } = useFireActivities();
  // Real clients list — used by buildInsights() to detect churn-risk. This is
  // the same Firestore subscription useLiveDashboardMetrics opens internally;
  // Firestore multiplexes the listener so there is no extra cost.
  const { data: fireClients } = useFireClients();

  // ── VEYRO live registry (organizations/GSTpilot_SAAS/{customers,products,invoices}) ──
  // Real-time onSnapshot — Firestore is the only source of truth for these.
  // Each hook opens its own listener; Firestore multiplexes them server-side.
  const { stats: customerStats, loading: customersLoading } = useGSTpilotCustomers();
  const { stats: productStats, loading: productsLoading } = useGSTpilotProducts();
  const { stats: invoiceStats, loading: invoicesLoading } = useGSTpilotInvoices();
  const { stats: vendorStats, loading: vendorsLoading } = useGSTpilotVendors();
  const { stats: expenseStats, loading: expensesLoading } = useGSTpilotExpenses();
  const { stats: paymentStats, loading: paymentsLoading } = useGSTpilotPayments();
  const registryLoading =
    customersLoading || productsLoading || invoicesLoading ||
    vendorsLoading || expensesLoading || paymentsLoading;

  // ── Priority checkbox toggle state (visual only, local to Today's Priorities widget) ──
  const [done, setDone] = useState<Record<string, boolean>>({});

  // ── Graceful loading timeout ──
  // If live data hasn't arrived in 3.5s (e.g. slow backend or offline), stop
  // blocking the UI — render with whatever metrics we have (empty → null score
  // + premium empty states). Premium UX never makes the user stare at a skeleton.
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  useEffect(() => {
    if (!loading && !snapshotLoading) return;
    const t = setTimeout(() => setLoadingTimedOut(true), 3500);
    return () => clearTimeout(t);
  }, [loading, snapshotLoading]);
  const showLoading = (loading || snapshotLoading) && !loadingTimedOut;

  // ── Trust indicator: last sync time ──
  // Stamp a Date whenever real (non-loading) data lands. onSnapshot delivers
  // a fresh snapshot on every backend write, so this reflects the true last
  // update from Firestore — not a polling interval.
  const [lastSync, setLastSync] = useState<Date | null>(null);
  useEffect(() => {
    if (loading) return;
    setLastSync(new Date());
  }, [metrics, loading]);

  // ── Business Score ──
  // Sourced from the canonical Business Snapshot — the same Health Score shown
  // on the Home Dashboard, Oracle chat, AI CFO, and Run Business pages. Returns
  // null when the snapshot has no live data (UI shows the premium empty state).
  const businessScore = useMemo(() => {
    if (!businessSnapshot.hasLiveData) return null;
    const score = Math.round(businessSnapshot.healthScore || 0);
    return score > 0 ? score : null;
  }, [businessSnapshot.hasLiveData, businessSnapshot.healthScore]);

  // ── "Has data" flag — drives honest empty vs premium states ──
  const hasData = useMemo(() => (
    metrics.totalClients > 0 ||
    metrics.pendingReturns > 0 ||
    metrics.overdueReturns > 0 ||
    metrics.totalTaxVolume > 0
  ), [metrics]);

  // ── AI Insights ──
  // Real clients feed the churn-risk detector. hasData gates the "all clear"
  // insight so we never claim "Everything looks good today" when the firm has
  // no Firestore data at all.
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
    clients: fireClients as Array<FirestoreClient & { id: string }>,
    hasData,
  }), [metrics, fireClients, hasData]);

  // V16: AI Recommendations widget shows up to 4 insights (no hero insight slice —
  // the hero is now the Getting Started checklist, so all insights go to the widget).
  const recommendations = useMemo(() => insights.slice(0, 4), [insights]);

  const tier = scoreTier(businessScore);

  // ── Collection Score (0-100): how well are receivables being recovered ──
  const collectionScore = useMemo(() => {
    if (!hasData) return null;
    const matchRate = metrics.matchPercentage;
    const invoiceCoverage = metrics.totalInvoices > 0
      ? Math.min(100, (metrics.documentsProcessed / Math.max(metrics.totalInvoices, 1)) * 100)
      : 50;
    return Math.round(matchRate * 0.6 + invoiceCoverage * 0.4);
  }, [metrics, hasData]);

  // ── Risk Score (0-100, higher = safer): inverse of risk indicators ──
  const riskScore = useMemo(() => {
    if (!hasData) return null;
    let score = 100;
    score -= Math.min(40, metrics.criticalIssues * 8);
    score -= Math.min(30, metrics.overdueReturns * 10);
    score -= Math.min(20, metrics.riskPercentage * 0.2);
    return Math.max(0, Math.round(score));
  }, [metrics, hasData]);

  // ── Getting Started checklist (derived from live data per spec) ──
  // totalClients > 0 → "Connect GSTN" is checked as a proxy for "GSTN connected".
  // The other three (Connect Bank, Invite Team, Activate Oracle) are never checked
  // in this version — we don't fabricate connection state.
  const checklist = useMemo(() => {
    const gstnConnected = metrics.totalClients > 0;
    return [
      {
        id: 'gstn',
        label: 'Connect GSTN',
        description: 'Link your GST account',
        checked: gstnConnected,
        view: 'returns' as AppView,
      },
      {
        id: 'bank',
        label: 'Connect Bank',
        description: 'Link your bank account',
        checked: false,
        view: 'banking' as AppView,
      },
      {
        id: 'team',
        label: 'Invite Team',
        description: 'Add team members',
        checked: false,
        view: 'team' as AppView,
      },
      {
        id: 'oracle',
        label: 'Activate Oracle',
        description: 'Turn on AI autopilot',
        checked: false,
        view: 'ai-operating-room' as AppView,
      },
    ];
  }, [metrics.totalClients]);

  const completedCount = checklist.filter(c => c.checked).length;
  const stepsAway = checklist.length - completedCount;
  const allComplete = completedCount === checklist.length;
  const businessStatus = allComplete ? 'Operational' : 'Getting Started';

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
  // Permission errors are NEVER shown as a wall. The firestore hooks already
  // degrade permission errors to empty data, but if a residual permission
  // error string reaches here, treat it as "no data" and render the dashboard
  // with premium empty states instead of blocking the user.
  const isPermissionErr = !!error && (
    /permission|insufficient|unauthenticated|not authorized|missing or/i.test(error)
  );
  if (error && !isPermissionErr) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="glass-surface rounded-3xl p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl glass-surface mx-auto mb-4">
            <AlertTriangle className="h-5 w-5 text-blue-300" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Couldn&apos;t load your mission control</h3>
          <p className="text-sm text-muted-foreground mt-1.5">{error}</p>
          <Button variant="outline" className="mt-5" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ── Helpers for navigation ──
  const goToSettings = () => setCurrentView('settings');

  // ── Trust indicator derived state ──
  // Permission errors are swallowed by the hooks (never reach `error`), so a
  // non-null `error` here is always a genuine network/index failure — surface
  // it to TrustBar so the user sees the red "Connection error" state.
  const trustError = isPermissionErr ? null : error;
  const trustConnected = !loading && !trustError;
  const trustConnecting = loading;

  return (
    <div className="relative max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-12">

      {/* ═══ 0. TRUST BAR — connection status, last sync, activity count ═══ */}
      <TrustBar
        lastSync={lastSync}
        connected={trustConnected}
        connecting={trustConnecting}
        error={trustError}
        activityCount={activities.length}
        onRefresh={() => window.location.reload()}
      />

      {/* ═══ 1. HERO — Greeting + Business Status + Getting Started checklist ═══ */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' as const }}
        className="space-y-6"
      >
        {/* Eyebrow + status pill */}
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Business Status
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${
              allComplete
                ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300'
                : 'border-cyan-400/25 bg-cyan-500/10 text-cyan-300'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                allComplete ? 'bg-emerald-400' : 'bg-cyan-400 animate-pulse'
              }`}
            />
            {businessStatus}
          </span>
        </div>

        {/* Greeting */}
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
          {greeting()}, {firstName(user?.name)} <span className="inline-block">👋</span>
        </h1>

        {/* Steps-away line */}
        <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
          You are{' '}
          <span className="accent-text font-semibold">
            {stepsAway} step{stepsAway !== 1 ? 's' : ''}
          </span>
          {' '}away from activating your Financial Brain.
        </p>

        {/* 4 clickable checklist cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {checklist.map((item, i) => (
            <ChecklistCard
              key={item.id}
              label={item.label}
              description={item.description}
              checked={item.checked}
              delay={0.05 * (i + 1)}
              onClick={() => setCurrentView(item.view)}
            />
          ))}
        </div>
      </motion.section>

      {/* ═══ 2. BUSINESS HEALTH SCORE ═══ */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08, ease: 'easeOut' as const }}
      >
        <div className="glass-surface rounded-3xl p-6 md:p-8 flex flex-col items-center justify-center min-h-[260px]">
          {businessScore === null || businessScore === 0 ? (
            <PremiumEmptyState
              icon={Brain}
              title="Activate your Financial Brain"
              description="Connect your business data to unlock AI insights and your real-time business health score."
              ctaLabel="[ Connect Data ]"
              onCta={goToSettings}
            />
          ) : (
            <>
              <ScoreGauge score={businessScore} />
              <div className="text-center mt-3">
                <span className={`text-sm font-semibold ${tier.color}`}>{tier.label}</span>
                <p className="text-[11px] text-muted-foreground mt-0.5 tracking-wider uppercase">
                  Business Health Score
                </p>
              </div>
            </>
          )}
        </div>
      </motion.section>

      {/* ═══ 3. KPI SECTION — exactly 3 cards ═══ */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          icon={IndianRupee}
          label="Revenue"
          value={metrics.totalTaxVolume > 0 ? formatINR(metrics.totalTaxVolume) : '—'}
          hint={metrics.totalTaxVolume > 0 ? 'Total tax volume' : undefined}
          delay={0.16}
          hasData={metrics.totalTaxVolume > 0}
          emptyTitle="Revenue awaits your data"
          emptyDescription="Connect GSTN and Banking to unlock live financial insights."
          ctaLabel="[ Connect Data ]"
          onCta={goToSettings}
        />
        <KpiCard
          icon={Wallet}
          label="Cash Position"
          value={cashLabel}
          hint={hasData
            ? (metrics.matchPercentage < 100
              ? `${metrics.matchPercentage.toFixed(0)}% reconciled`
              : 'Fully reconciled')
            : undefined}
          delay={0.24}
          hasData={hasData && businessScore !== null}
          emptyTitle="Cash position awaits"
          emptyDescription="Connect your bank account to monitor cash position."
          ctaLabel="[ Connect Bank ]"
          onCta={goToSettings}
        />
        <KpiCard
          icon={ShieldAlert}
          label="Compliance"
          value={metrics.pendingReturns + metrics.overdueReturns > 0
            ? `${metrics.pendingReturns + metrics.overdueReturns} pending`
            : (hasData ? 'Safe' : '—')}
          hint={hasData
            ? (metrics.overdueReturns > 0
              ? `${metrics.overdueReturns} overdue`
              : `${metrics.filedReturns} filed`)
            : undefined}
          delay={0.32}
          hasData={hasData}
          emptyTitle="Compliance awaits GSTN"
          emptyDescription="Connect GSTN to track compliance score."
          ctaLabel="[ Connect GSTN ]"
          onCta={goToSettings}
        />
      </section>

      {/* ═══ 3c. LIVE BUSINESS REGISTRY — real Firestore data (organizations/GSTpilot_SAAS) ═══ */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4, ease: 'easeOut' as const }}
        className="space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 accent-text" />
            <h2 className="text-sm font-semibold text-foreground">Live Business Registry</h2>
            <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider hidden sm:inline">
              organizations/GSTpilot_SAAS · real-time
            </span>
          </div>
          {!registryLoading && (
            <span className="text-[10px] text-emerald-400/70 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              synced
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* 1. Total Customers */}
          <RegistryStatCard
            icon={Users}
            label="Total Customers"
            value={customersLoading ? null : String(customerStats.count)}
            onClick={() => setCurrentView('crm')}
            delay={0.42}
          />
          {/* 2. Total Products */}
          <RegistryStatCard
            icon={Package}
            label="Total Products"
            value={productsLoading ? null : String(productStats.count)}
            onClick={() => setCurrentView('inventory')}
            delay={0.46}
          />
          {/* 3. Total Invoices */}
          <RegistryStatCard
            icon={FileText}
            label="Total Invoices"
            value={invoicesLoading ? null : String(invoiceStats.count)}
            onClick={() => setCurrentView('invoices')}
            delay={0.50}
          />
          {/* 4. Revenue (total invoiced, ₹ INR) */}
          <RegistryStatCard
            icon={IndianRupee}
            label="Revenue"
            value={invoicesLoading ? null : formatINR(invoiceStats.totalInvoiced)}
            onClick={() => setCurrentView('invoices')}
            delay={0.54}
          />
          {/* 5. Outstanding Amount (₹ INR) — amber accent when > 0 */}
          <RegistryStatCard
            icon={Wallet}
            label="Outstanding"
            value={invoicesLoading ? null : formatINR(invoiceStats.totalOutstanding)}
            onClick={() => setCurrentView('invoices')}
            delay={0.58}
            accent={!invoicesLoading && invoiceStats.totalOutstanding > 0 ? 'amber' : 'emerald'}
          />
          {/* 6. Total Vendors */}
          <RegistryStatCard
            icon={Building2}
            label="Total Vendors"
            value={vendorsLoading ? null : String(vendorStats.count)}
            onClick={() => setCurrentView('vendors')}
            delay={0.62}
          />
          {/* 7. Expenses (₹ INR) — amber accent */}
          <RegistryStatCard
            icon={Receipt}
            label="Expenses"
            value={expensesLoading ? null : formatINR(expenseStats.totalAmount)}
            onClick={() => setCurrentView('expenses')}
            delay={0.66}
            accent="amber"
          />
          {/* 8. Payments — total received (₹ INR) */}
          <RegistryStatCard
            icon={ArrowRightLeft}
            label="Payments"
            value={paymentsLoading ? null : formatINR(paymentStats.totalReceived)}
            onClick={() => setCurrentView('payments')}
            delay={0.70}
          />
        </div>
      </motion.section>

      {/* ═══ 3b. SCORES — Collection Score + Risk Score (restored) ═══ */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Collection Score */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.36 }}
          className="glass-surface rounded-3xl p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10">
                <Wallet className="h-4 w-4 text-cyan-400" />
              </div>
              <span className="text-sm font-medium text-foreground">Collection Score</span>
            </div>
          </div>
          {hasData && collectionScore !== null ? (
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold text-foreground">{collectionScore}</span>
                <span className="text-sm text-muted-foreground">/ 100</span>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${collectionScore}%`,
                    background: 'linear-gradient(90deg, #3B82F6 0%, #2563EB 100%)',
                  }}
                />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {metrics.matchPercentage.toFixed(0)}% invoices reconciled
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Connect data to measure collections.</p>
          )}
        </motion.div>

        {/* Risk Score */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.40 }}
          className="glass-surface rounded-3xl p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                <ShieldAlert className="h-4 w-4 text-blue-400" />
              </div>
              <span className="text-sm font-medium text-foreground">Risk Score</span>
            </div>
          </div>
          {hasData && riskScore !== null ? (
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold text-foreground">{riskScore}</span>
                <span className="text-sm text-muted-foreground">/ 100 · safer</span>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${riskScore}%`,
                    background: 'linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%)',
                  }}
                />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {metrics.criticalIssues} critical · {metrics.overdueReturns} overdue
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Connect data to assess risk.</p>
          )}
        </motion.div>
      </section>

      {/* ═══ 4. WIDGETS — exactly 5 (2-col grid, 5th spans full width) ═══ */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Widget 1: Today's Priorities */}
        <WidgetCard icon={ListTodo} title="Today's Priorities" delay={0.40}>
          {hasData && priorities.length > 0 ? (
            <div className="space-y-1">
              {priorities.map((p) => {
                const isDone = !!done[p.id];
                return (
                  <div
                    key={p.id}
                    className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
                  >
                    <button
                      type="button"
                      aria-label={`Mark ${p.label} as ${isDone ? 'incomplete' : 'complete'}`}
                      aria-pressed={isDone}
                      onClick={() => {
                        setDone((d) => ({ ...d, [p.id]: !d[p.id] }));
                      }}
                      className={`flex h-5 w-5 items-center justify-center rounded-full border shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${
                        isDone
                          ? 'accent-gradient border-transparent'
                          : 'border-white/[0.15] hover:border-emerald-400/40'
                      }`}
                    >
                      {isDone && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentView(p.view)}
                      className="flex flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 rounded-md"
                      aria-label={`Open ${p.label}`}
                    >
                      <span className={`text-sm flex-1 ${isDone ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                        {p.label}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-emerald-400/70 transition-colors shrink-0" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : hasData ? (
            <PremiumEmptyState
              icon={CheckCircle2}
              title="You're all caught up"
              description="No priorities right now. Oracle will surface new ones as your business changes."
            />
          ) : (
            <PremiumEmptyState
              icon={ListTodo}
              title="VEYRO AI is ready"
              description="Connect your business data to receive priorities."
              ctaLabel="[ Connect Services ]"
              onCta={goToSettings}
            />
          )}
        </WidgetCard>

        {/* Widget 2: Business Timeline */}
        <WidgetCard icon={Clock} title="Business Timeline" delay={0.48}>
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
                    <span className="relative z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-emerald-400/30 bg-background shrink-0 mt-0.5">
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
            <PremiumEmptyState
              icon={Clock}
              title="No activity yet"
              description="Connect your services to see live business timeline."
            />
          )}
        </WidgetCard>

        {/* Widget 3: Connected Services */}
        <WidgetCard icon={Plug} title="Connected Services" delay={0.56}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CONNECTED_SERVICES.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3"
                >
                  <div className="flex items-center gap-2">
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
                  <button
                    type="button"
                    onClick={goToSettings}
                    className="self-start text-[11px] font-medium text-cyan-300 hover:text-cyan-200 transition-colors"
                  >
                    [ Connect ]
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground text-center pt-1">
              Connect services to sync automatically.
            </p>
          </div>
        </WidgetCard>

        {/* Widget 4: Team Status */}
        <WidgetCard icon={Users} title="Team Status" delay={0.64}>
          {/* Honest empty state — we don't have team data yet */}
          <PremiumEmptyState
            icon={Users}
            title="No team members yet"
            description="Invite your team to collaborate on clients, returns, and reconciliations."
            ctaLabel="[ Invite your team ]"
            onCta={() => setCurrentView('team')}
          />
        </WidgetCard>

        {/* Widget 5: AI Recommendations — full width */}
        <WidgetCard icon={Lightbulb} title="AI Recommendations" delay={0.72} className="lg:col-span-2">
          {hasData && recommendations.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recommendations.map((insight) => {
                const Icon = insight.icon;
                // V16 palette: only Emerald / Cyan / Blue. No amber, no red.
                const toneColor =
                  insight.tone === 'risk' ? 'text-blue-400' :
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
          ) : hasData ? (
            <PremiumEmptyState
              icon={CheckCircle2}
              title="No recommendations right now"
              description="Your business is in good shape — Oracle will surface new guidance as it learns."
            />
          ) : (
            <PremiumEmptyState
              icon={Lightbulb}
              title="VEYRO AI is ready"
              description="Connect your business data to receive AI recommendations."
              ctaLabel="[ Connect Services ]"
              onCta={goToSettings}
            />
          )}
        </WidgetCard>

        {/* Widget 6: Ask VEYRO AI (restored) */}
        <WidgetCard icon={Brain} title="Ask VEYRO AI" delay={0.80} className="lg:col-span-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl accent-gradient shadow-lg shadow-emerald-500/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                Ask VEYRO AI anything
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                GST · ITC · Cash flow · Compliance — replies in your language, 24/7.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {['What is my compliance score?', 'GST kya hota hai?', 'How do I file GSTR-3B?'].map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('oracle-ask', { detail: q }));
                    }}
                    className="rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-emerald-400/30 hover:text-foreground"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
            <Button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('oracle-ask', { detail: '' }));
              }}
              className="shrink-0 accent-gradient text-white border-0 hover:opacity-90"
            >
              Ask VEYRO AI
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </WidgetCard>

      </section>
    </div>
  );
}
