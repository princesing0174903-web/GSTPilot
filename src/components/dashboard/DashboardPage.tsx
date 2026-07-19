'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — HOME (Production Command Center)
// ═══════════════════════════════════════════════════════════════════════════════
//
// This is the canonical HOME page. Per the stabilization directive:
//
//   • Only show integrations that ACTUALLY exist (Google + Zoho Books).
//   • GSTN / Bank / WhatsApp / Gmail / Outlook → "Coming Soon" modal.
//   • No fake scores (Health / Compliance / Risk / Collection). If the
//     underlying data is unavailable, show "Unavailable — connect supported
//     integrations to generate this metric."
//   • Business Health Score is NOT shown until real data is connected.
//   • Every Connect button routes to the real integration page or the
//     Coming Soon modal — never to a deleted Connections page.
//   • Single source of truth: useBusinessSnapshot() → /api/business/snapshot.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ProSkeleton, AnimatedNumber } from '@/components/ui-pro';
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  FileText,
  ShieldCheck,
  Users,
  IndianRupee,
  Plus,
  ArrowRight,
  Loader2,
  Activity,
  CheckSquare,
  Brain,
  MessageSquare,
  Zap,
  TrendingUp,
  ShieldAlert,
  Mail,
  UserPlus,
  RefreshCw,
  LifeBuoy,
  ChevronRight,
  Cloud,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { useApp, type AppView } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { useBusinessSnapshot } from '@/hooks/useBusinessSnapshot';
import {
  useLiveDashboardMetrics,
  useFireClients,
  useFireReturns,
  useFirmExecutiveScores,
  useFireMemberships,
  useFirePriorities,
  useFireRecentActivities,
} from '@/hooks/use-firestore';
import { useTimelineEvents } from '@/hooks/useTimelineEvents';
import { useInvoices } from '@/hooks/useInvoices';
// NOTE: useInvoices (Firestore) is imported for legacy compatibility but the
// Dashboard no longer reads invoice DATA from it — all financial figures come
// from useBusinessSnapshot() (Prisma). This is the Phase 3 "One Business
// Snapshot" architecture: every number on this page traces back to a single
// server-side calculation.
import { useAIRecommendations } from '@/hooks/useAIRecommendations';
import { useGoogleWorkspace } from '@/hooks/useGoogleWorkspace';
import { useZohoBooks } from '@/hooks/useZohoBooks';
import { useOracleInsights } from '@/hooks/useOracleInsights';
import { fileReturn } from '@/lib/firestore-service';
import { periodToLabel, isOverdue, getFilingDueDate } from '@/lib/gst-utils';
import { toast } from 'sonner';

// ── Home sub-components ──────────────────────────────────────────────────────
import { BusinessSetupProgress, type SetupTask } from '@/components/dashboard/home/BusinessSetupProgress';
import { InviteTeamModal } from '@/components/dashboard/home/InviteTeamModal';
import { ActivateOracleWizard } from '@/components/dashboard/home/ActivateOracleWizard';
import { ConnectedServicesCard, type ServiceRow } from '@/components/dashboard/home/ConnectedServicesCard';
import { EmptyState } from '@/components/dashboard/home/EmptyState';
import type { Recommendation as AIRecommendation } from '@/lib/recommendations/engine';
import type {
  FirestoreClient,
  LiveDashboardMetrics,
} from '@/lib/firestore-schema';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getDaysRemaining(dueDateStr: string): number {
  const dueDate = new Date(dueDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDaysRemaining(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Tomorrow';
  return `${days}d left`;
}

function formatINR(amount: number): string {
  return amount.toLocaleString('en-IN');
}

function formatDateIN(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
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

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function getFirstName(name: string | undefined | null): string {
  if (!name) return 'there';
  const first = name.trim().split(/\s+/)[0];
  return first || 'there';
}

// One-sentence insight. Never invents numbers — only uses snapshot values or
// suggests connecting an integration.
function buildInsightSentence(
  snapshot: ReturnType<typeof useBusinessSnapshot>['snapshot'],
  pendingCollection: number,
  hasAnyIntegration: boolean,
): string {
  if (!hasAnyIntegration && !snapshot.hasLiveData) {
    return 'Connect Google or Zoho Books to start syncing real business data.';
  }
  if (!snapshot.hasLiveData) {
    return 'Your workspace is ready. Create a customer or invoice to see live insights here.';
  }
  const parts: string[] = [];
  if (snapshot.invoices.overdue > 0) {
    parts.push(`${snapshot.invoices.overdue} overdue invoice${snapshot.invoices.overdue > 1 ? 's' : ''}`);
  } else if (pendingCollection > 0) {
    parts.push(`₹${formatINR(pendingCollection)} pending collection`);
  }
  if (snapshot.revenue > 0) {
    parts.push(`₹${formatINR(snapshot.revenue)} revenue`);
  }
  if (parts.length === 0) {
    return `All clear — ${snapshot.customers} customers, ${snapshot.invoices.count} invoices.`;
  }
  if (parts.length === 1) return `${parts[0]}.`;
  const last = parts.pop();
  return `${parts.join(', ')} and ${last}.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY ICON
// ═══════════════════════════════════════════════════════════════════════════════

function activityIcon(type: string): React.ReactNode {
  if (type.includes('oracle')) return <Sparkles className="h-3.5 w-3.5 accent-text" />;
  if (type.includes('filed')) return <CheckCircle2 className="h-3.5 w-3.5 accent-text" />;
  if (type.includes('upload') || type.includes('document'))
    return <Upload className="h-3.5 w-3.5 accent-text" />;
  if (type.includes('review')) return <CheckSquare className="h-3.5 w-3.5 accent-text" />;
  if (type.includes('client')) return <Users className="h-3.5 w-3.5 accent-text" />;
  if (type.includes('reconcil') || type.includes('mismatch'))
    return <AlertTriangle className="h-3.5 w-3.5 accent-text" />;
  if (type.includes('invoice') || type.includes('extract'))
    return <FileText className="h-3.5 w-3.5 accent-text" />;
  return <Activity className="h-3.5 w-3.5 accent-text" />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION CARD
// ═══════════════════════════════════════════════════════════════════════════════

interface SectionCardProps {
  title: string;
  icon: React.ReactNode;
  index: number;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}

function SectionCard({
  title,
  icon,
  index,
  actionLabel,
  onAction,
  children,
}: SectionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.24 + index * 0.08, ease: 'easeOut' as const }}
      className="h-full"
    >
      <div className="glass-surface rounded-2xl h-full flex flex-col hover-lift">
        <div className="flex items-center justify-between gap-3 p-6 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg accent-gradient-soft shrink-0">
              {icon}
            </div>
            <h3 className="text-sm font-semibold text-foreground tracking-tight truncate">
              {title}
            </h3>
          </div>
          {actionLabel && onAction && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAction}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              {actionLabel}
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
        <div className="px-6 pb-6 flex-1 min-h-0">{children}</div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// KPI CARD — with empty-state support
// ═══════════════════════════════════════════════════════════════════════════════

interface KpiCardProps {
  label: string;
  /** Numeric value for count-up animation. When provided, takes precedence over `value`. */
  numericValue?: number;
  /** Format for the animated number: 'currency' = ₹1,18,000, 'integer' = 1,180, 'decimal' = 68.5 */
  numericFormat?: 'currency' | 'integer' | 'decimal';
  /** Fallback string value (used when numericValue is not provided). */
  value?: string;
  subtitle: string;
  icon: React.ReactNode;
  index: number;
  /** Optional inline CTA rendered as a small link below the subtitle.
   *  Used for empty/half-empty states so the real value (e.g. ₹0) stays
   *  visible while still offering a path forward. */
  cta?: {
    label: string;
    onClick: () => void;
  };
}

function KpiCard({ label, numericValue, numericFormat = 'integer', value, subtitle, icon, index, cta }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: 'easeOut' as const }}
      className="h-full"
    >
      <div className="glass-surface p-6 h-full transition-shadow hover-lift hover:shadow-[0_0_32px_-8px_rgba(37,99,235,0.2)]">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0 flex-1">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {label}
            </p>
            <p className="text-3xl font-bold text-foreground tracking-tight truncate tabular">
              {numericValue !== undefined ? (
                <AnimatedNumber value={numericValue} format={numericFormat} />
              ) : (
                value ?? '—'
              )}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">{subtitle}</p>
            {cta && (
              <button
                type="button"
                onClick={cta.onClick}
                className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold accent-text hover:opacity-80 transition-opacity"
              >
                {cta.label}
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="flex items-center justify-center h-10 w-10 rounded-xl accent-gradient-soft shrink-0">
            {icon}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// METRIC UNAVAILABLE CARD — replaces fake scores (Health/Compliance/Risk)
// ═══════════════════════════════════════════════════════════════════════════════

interface UnavailableMetricCardProps {
  label: string;
  icon: React.ReactNode;
  index: number;
  reason: string;
  ctaLabel?: string;
  onCta?: () => void;
  /** Optional phase label, e.g. "Coming in Phase 2". Shows a premium badge. */
  phase?: string;
  /** Optional list of features this metric will unlock once data is connected. */
  unlocks?: string[];
}

function UnavailableMetricCard({
  label,
  icon,
  index,
  reason,
  ctaLabel,
  onCta,
  phase,
  unlocks,
}: UnavailableMetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: 'easeOut' as const }}
      className="h-full"
    >
      <div className="glass-surface rounded-2xl p-5 h-full flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="space-y-1 min-w-0">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {label}
            </p>
            <p className="text-sm font-semibold text-muted-foreground/80">
              {phase ?? 'Unavailable'}
            </p>
          </div>
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-white/[0.04] shrink-0">
            {icon}
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
          <div className="h-full w-0" />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
          {reason}
        </p>
        {unlocks && unlocks.length > 0 && (
          <div className="mt-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
            <p className="text-[9px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-1.5">
              This will unlock
            </p>
            <ul className="space-y-1">
              {unlocks.map((u) => (
                <li key={u} className="flex items-center gap-1.5 text-[11px] text-muted-foreground/90">
                  <span className="h-1 w-1 rounded-full bg-emerald-400/60 shrink-0" />
                  {u}
                </li>
              ))}
            </ul>
          </div>
        )}
        {ctaLabel && onCta && (
          <button
            type="button"
            onClick={onCta}
            className="mt-auto pt-3 inline-flex items-center gap-1 text-[11px] font-medium accent-text hover:opacity-80 transition-opacity"
          >
            {ctaLabel}
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUSINESS HEALTH — Unavailable state (no fake score)
// ═══════════════════════════════════════════════════════════════════════════════

function BusinessHealthUnavailable({ onConnect }: { onConnect: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.12, ease: 'easeOut' as const }}
      className="h-full"
    >
      <div className="glass-surface p-6 md:p-8 flex flex-col sm:flex-row items-center gap-6 md:gap-10 h-full">
        <div className="relative shrink-0 flex items-center justify-center h-[180px] w-[180px]">
          <svg width={180} height={180} className="-rotate-90">
            <circle
              cx={90}
              cy={90}
              r={84}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={12}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
              <Brain className="h-6 w-6 text-muted-foreground" />
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-3 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg accent-gradient-soft">
              <Brain className="h-4 w-4 accent-text" />
            </div>
            <h3 className="text-sm font-semibold text-foreground tracking-tight">
              Business Health Score
            </h3>
            <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/[0.06] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-400/90">
              <Clock className="h-2.5 w-2.5" />
              Awaiting Data
            </span>
          </div>
          <p className="text-lg font-semibold text-muted-foreground">Connect to activate</p>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
            Your health score is a composite of profitability, liquidity,
            collections, and compliance — calculated from your real financial
            data. We never invent a number.
          </p>
          <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-left">
            <p className="text-[9px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-1.5">
              Connecting data will unlock
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {['Profitability score', 'Liquidity tracking', 'Collection rate', 'Compliance status'].map((u) => (
                <div key={u} className="flex items-center gap-1.5 text-[11px] text-muted-foreground/90">
                  <span className="h-1 w-1 rounded-full bg-emerald-400/60 shrink-0" />
                  {u}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
            <Button
              size="sm"
              onClick={onConnect}
              className="accent-gradient text-white hover:opacity-90 gap-1.5 h-8"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Connect Integration
            </Button>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Google · Zoho Books available now
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING SKELETON
// ═══════════════════════════════════════════════════════════════════════════════

function DashboardSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-10 space-y-8">
      <div className="space-y-3">
        <ProSkeleton className="h-9 w-64" />
        <ProSkeleton className="h-4 w-80" />
      </div>
      <ProSkeleton className="h-24 rounded-2xl" />
      <ProSkeleton className="h-40 rounded-2xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <ProSkeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <ProSkeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <ProSkeleton key={i} className="h-72 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface Recommendation {
  id: string;
  icon: React.ReactNode;
  title: string;
  actionLabel: string;
  onAction: () => void;
}

export default function DashboardPage() {
  const {
    setCurrentView,
    setSelectedClientId,
    setReturnPrepCtx,
    setPendingSettingsSection,
  } = useApp();
  const { user } = useAuth();
  const { organization, reload: reloadOrg } = useOrg();
  const orgId = organization?.id ?? null;

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 15 — Single Source of Truth: Business Snapshot
  // ═══════════════════════════════════════════════════════════════════════════
  const { snapshot: businessSnapshot, loading: snapshotLoading, error: snapshotError, refresh: refreshSnapshot } = useBusinessSnapshot();

  // ── Firebase hooks (clients, returns, activities, memberships) ──
  const { metrics, loading: metricsLoading, error: metricsError } = useLiveDashboardMetrics();
  const { data: clients } = useFireClients();
  const { data: returns } = useFireReturns();
  const { data: recentActivities } = useFireRecentActivities(10);
  const { data: memberships } = useFireMemberships(null);
  const { data: priorityQueue } = useFirePriorities('pending');

  // ── AI Oracle recommendations ──
  const { recommendations: aiRecommendations, loading: aiRecsLoading } = useAIRecommendations();

  // ── Oracle Insights (the "Oracle is alive" payload) ──
  // Only fetched when Oracle is activated — the hook short-circuits to null
  // when orgId is null. We pass it through to the "Oracle is live" panel
  // below the Ask Oracle card so the user sees real generated content
  // (business summary + top priority + health badge) immediately after
  // activation, not just an "Online" badge.
  const { insights: oracleInsights, loading: oracleInsightsLoading } = useOracleInsights();

  // ── Legacy Firestore invoice hook (loading-state only) ──
  // We no longer read invoice DATA from Firestore — the Business Snapshot
  // (Prisma) is the single source of truth. This hook is retained only so
  // the loading gate doesn't flash stale content; it resolves to false
  // quickly when Firestore is unavailable.
  const { loading: invoicesLoading } = useInvoices();

  // ── REAL integrations: Google + Zoho Books ──
  const { status: googleStatus, loading: googleLoading } = useGoogleWorkspace();
  const { status: zohoStatus, loading: zohoLoading } = useZohoBooks();

  // ── Filing state ──
  const [filingInProgress, setFilingInProgress] = useState<Set<string>>(new Set());

  // ═══════════════════════════════════════════════════════════════════════════
  // Modal open-states
  // ═══════════════════════════════════════════════════════════════════════════
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [oracleWizardOpen, setOracleWizardOpen] = useState(false);

  // ── Client lookup map ──
  const clientMap = useMemo(() => {
    const map = new Map<string, FirestoreClient & { id: string }>();
    for (const c of clients) map.set(c.clientId, c);
    return map;
  }, [clients]);

  // ── Real integration state ──
  const googleConnected = googleStatus?.connected ?? false;
  const zohoConnected = zohoStatus?.connected ?? false;
  const oracleActivated = Boolean(
    organization?.integrations &&
      (organization.integrations as Record<string, { connected?: boolean }> | null)?.oracle?.connected,
  );

  const hasInvoices = businessSnapshot.invoices.count > 0;
  const hasCustomers = businessSnapshot.customers > 0;
  const hasAnyIntegration = googleConnected || zohoConnected;
  // A real health score requires actual financial data (invoices + expenses
  // + bank). Until then we NEVER display an invented number.
  const canComputeHealthScore =
    businessSnapshot.hasLiveData &&
    businessSnapshot.invoices.count > 0 &&
    businessSnapshot.healthScore > 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5 — Real Onboarding Engine (only real integrations)
  // ═══════════════════════════════════════════════════════════════════════════
  const setupTasks: SetupTask[] = useMemo(
    () => [
      {
        id: 'google',
        label: 'Connect Google',
        icon: Cloud,
        done: googleConnected,
        onAction: () => setCurrentView('google-workspace'),
      },
      {
        id: 'zoho',
        label: 'Connect Zoho Books',
        icon: BookOpen,
        done: zohoConnected,
        onAction: () => setCurrentView('zoho-books'),
      },
      {
        id: 'invoice',
        label: 'Create First Invoice',
        icon: FileText,
        done: hasInvoices,
        onAction: () => setCurrentView('invoices'),
      },
      {
        id: 'customer',
        label: 'Create First Customer',
        icon: Users,
        done: hasCustomers,
        onAction: () => setCurrentView('clients'),
      },
      {
        id: 'team',
        label: 'Invite Team',
        icon: UserPlus,
        done: memberships.length > 0,
        onAction: () => setInviteModalOpen(true),
      },
      {
        id: 'oracle',
        label: oracleActivated ? 'Oracle Online' : 'Activate Oracle',
        icon: Sparkles,
        done: oracleActivated,
        onAction: () => setOracleWizardOpen(true),
      },
    ],
    [googleConnected, zohoConnected, hasInvoices, hasCustomers, memberships.length, oracleActivated, setCurrentView],
  );

  const setupComplete = setupTasks.filter((t) => t.done).length;
  const setupTotal = setupTasks.length;
  const onboardingDone = setupComplete === setupTotal;

  // ── KPI derivations ──
  const pendingComplianceCount = useMemo(
    () => returns.filter((r) => r.status !== 'filed').length,
    [returns],
  );

  // Phase 3 — Single Source of Truth: all invoice/collection numbers come
  // from the Business Snapshot (Prisma), NOT from the Firestore-based
  // useInvoices hook (which fails with permission-denied in preview mode).
  // This guarantees the Dashboard's "pending collection" figure always
  // matches the revenue figure and the Oracle's view of the business.
  const pendingCollection = businessSnapshot.collections.totalOutstanding;

  const insight = useMemo(
    () => buildInsightSentence(businessSnapshot, pendingCollection, hasAnyIntegration),
    [businessSnapshot, pendingCollection, hasAnyIntegration],
  );

  // ── Today's Priorities ──
  const todaysPriorities = useMemo<
    Array<{ id: string; label: string; category: string; urgency: number; view: AppView }>
  >(() => {
    if (priorityQueue && priorityQueue.length > 0) {
      return priorityQueue.slice(0, 5).map((p) => ({
        id: p.priorityId || p.id,
        label: p.title || 'Untitled priority',
        category: p.category || 'general',
        urgency: p.urgency || 5,
        view: 'tasks' as AppView,
      }));
    }
    const list: Array<{ id: string; label: string; category: string; urgency: number; view: AppView }> = [];
    if (metrics.overdueReturns > 0) {
      list.push({
        id: 'fb-overdue',
        label: `File ${metrics.overdueReturns} overdue return${metrics.overdueReturns > 1 ? 's' : ''}`,
        category: 'filing',
        urgency: 10,
        view: 'returns',
      });
    }
    if (metrics.criticalIssues > 0) {
      list.push({
        id: 'fb-critical',
        label: `Resolve ${metrics.criticalIssues} critical issue${metrics.criticalIssues > 1 ? 's' : ''}`,
        category: 'reconciliation',
        urgency: 9,
        view: 'reconcile',
      });
    }
    if (pendingCollection > 0) {
      list.push({
        id: 'fb-collections',
        label: `Collect ₹${formatINR(pendingCollection)} pending`,
        category: 'payment',
        urgency: 7,
        view: 'invoices',
      });
    }
    return list.slice(0, 5);
  }, [priorityQueue, metrics, pendingCollection]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Connected Services — ONLY Google + Zoho Books (real integrations)
  // ═══════════════════════════════════════════════════════════════════════════
  const connectedServices: ServiceRow[] = useMemo(
    () => [
      {
        id: 'google',
        name: 'Google',
        icon: Cloud,
        color: '#ea4335',
        connected: googleConnected,
        lastSync: googleStatus?.connectedAt ?? null,
        account: googleStatus?.userEmail ?? null,
        health: googleConnected ? 'healthy' : 'unknown',
      },
      {
        id: 'zoho',
        name: 'Zoho Books',
        icon: BookOpen,
        color: '#e43536',
        connected: zohoConnected,
        lastSync: zohoStatus?.connectedAt ?? null,
        account: zohoStatus?.organizationName ?? zohoStatus?.userEmail ?? null,
        health: zohoConnected ? 'healthy' : 'unknown',
      },
    ],
    [googleConnected, zohoConnected, googleStatus, zohoStatus],
  );

  const handleConnectService = (serviceId: 'google' | 'zoho') => {
    if (serviceId === 'google') setCurrentView('google-workspace');
    else if (serviceId === 'zoho') setCurrentView('zoho-books');
  };

  // ── Team members ──
  const teamMembers = useMemo(
    () => memberships.slice(0, 6).map((m) => ({
      id: m.id,
      name: m.userDisplayName || (m.userEmail ? m.userEmail.split('@')[0] : 'Team member'),
      role: m.role || 'staff',
      status: m.status || 'invited',
    })),
    [memberships],
  );

  // ── Upcoming filings ──
  const upcomingFilings = useMemo(() => {
    return returns
      .filter((r) => r.status !== 'filed')
      .sort((a, b) => {
        const aOverdue = isOverdue(a.period) ? 0 : 1;
        const bOverdue = isOverdue(b.period) ? 0 : 1;
        if (aOverdue !== bOverdue) return aOverdue - bOverdue;
        return a.period.localeCompare(b.period);
      })
      .slice(0, 5);
  }, [returns]);

  // ── Handlers ──
  const handleOpenClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setCurrentView('client-workspace');
  };

  const handleFileReturn = (clientId: string, returnType: string, period: string) => {
    setSelectedClientId(clientId);
    setReturnPrepCtx({
      clientId,
      returnType: (returnType === 'GSTR-3B' ? 'GSTR-3B' : 'GSTR-1') as 'GSTR-1' | 'GSTR-3B',
      period,
    });
    setCurrentView('return-prep');
  };

  const handleQuickFile = async (returnId: string, clientName: string, returnType: string) => {
    if (filingInProgress.has(returnId)) return;
    setFilingInProgress((prev) => new Set(prev).add(returnId));
    try {
      const arn = await fileReturn(returnId);
      toast.success(`${returnType} Filed Successfully`, {
        description: `${clientName} — ARN: ${arn}`,
      });
    } catch (err) {
      toast.error('Filing Failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setFilingInProgress((prev) => {
        const next = new Set(prev);
        next.delete(returnId);
        return next;
      });
    }
  };

  // ── AI recommendation icon mapping ──
  // Maps each recommendation type to an icon. The new engine emits one of:
  //   cash | receivables | compliance | growth | risk | customer
  const iconForAIRec = (type: AIRecommendation['type']): React.ReactNode => {
    switch (type) {
      case 'cash':
        return <IndianRupee className="h-3.5 w-3.5 accent-text" />;
      case 'receivables':
        return <Clock className="h-3.5 w-3.5 accent-text" />;
      case 'compliance':
        return <FileText className="h-3.5 w-3.5 accent-text" />;
      case 'growth':
        return <TrendingUp className="h-3.5 w-3.5 accent-text" />;
      case 'risk':
        return <AlertTriangle className="h-3.5 w-3.5 accent-text" />;
      case 'customer':
        return <Users className="h-3.5 w-3.5 accent-text" />;
      default:
        return <Sparkles className="h-3.5 w-3.5 accent-text" />;
    }
  };

  const handleAIRecAction = (rec: AIRecommendation) => {
    // The new recommendations engine exposes `actionView` (an AppView name)
    // for direct navigation. Fall back to the dashboard if absent.
    if (rec.actionView) {
      setCurrentView(rec.actionView as AppView);
      return;
    }
    setCurrentView('dashboard');
  };

  const mappedAIRecommendations = useMemo<Recommendation[]>(() => {
    return aiRecommendations.slice(0, 5).map((rec) => ({
      id: rec.id,
      icon: iconForAIRec(rec.type),
      title: rec.title,
      // Engine always sets actionLabel, but the type marks it optional — fall
      // back to a sensible default to satisfy the local Recommendation type.
      actionLabel: rec.actionLabel ?? 'Review',
      onAction: () => handleAIRecAction(rec),
    }));
  }, [aiRecommendations]);

  // ── Background AI analysis trigger (only when Oracle active) ──
  const bgAnalysisTriggered = useRef(false);
  useEffect(() => {
    if (bgAnalysisTriggered.current) return;
    if (!orgId) return;
    if (aiRecsLoading) return;
    if (!oracleActivated) return;
    if (aiRecommendations.length > 0) {
      bgAnalysisTriggered.current = true;
      return;
    }
    bgAnalysisTriggered.current = true;
    void fetch('/api/ai/analyze/background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: orgId }),
    }).catch(() => {});
  }, [orgId, aiRecsLoading, aiRecommendations.length, oracleActivated]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  if (snapshotLoading || metricsLoading || invoicesLoading || googleLoading || zohoLoading) {
    return <DashboardSkeleton />;
  }

  // ── Error state ──
  // The dashboard is designed to degrade gracefully. In preview mode (no real
  // Firestore), several hooks surface "permission-denied" errors — those are
  // EXPECTED and must NOT block the dashboard from rendering. We only show
  // the hard error screen for genuine, non-permission failures that mean we
  // truly cannot render anything useful.
  const isPermissionOrNetworkError = (msg: string | null): boolean => {
    if (!msg) return false;
    return /permission|insufficient|unauthenticated|not authorized|missing or|network|fetch|failed to fetch|load failed/i.test(msg);
  };
  const combinedError =
    (snapshotError && !isPermissionOrNetworkError(snapshotError) ? snapshotError : null)
    ?? (metricsError && !isPermissionOrNetworkError(metricsError) ? metricsError : null);
  if (combinedError) {
    return (
      <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-10">
        <Card className="glass-surface border-red-500/20">
          <CardContent className="p-8 text-center">
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-red-500/10 border border-red-500/20 mx-auto mb-4">
              <AlertTriangle className="h-6 w-6 text-red-400" />
            </div>
            <h3 className="font-semibold text-foreground text-lg">
              We couldn&apos;t load your dashboard
            </h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
              {combinedError.includes('permission') || combinedError.includes('Permission')
                ? 'Your workspace data is unreachable right now. This is usually a permissions issue — retry, or contact support if it persists.'
                : 'Something went wrong while fetching your business data. Please try again.'}
            </p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <Button
                onClick={refreshSnapshot}
                className="accent-gradient text-white hover:opacity-90 gap-1.5"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="border-border gap-1.5"
              >
                Reload page
              </Button>
              <Button
                variant="ghost"
                onClick={() => setCurrentView('settings')}
                className="text-muted-foreground gap-1.5"
              >
                <LifeBuoy className="h-4 w-4" />
                Support
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── KPI values (Single Source of Truth: Business Snapshot) ──
  // IMPORTANT: We ALWAYS show the real value, even when it is ₹0. The
  // AnimatedNumber component handles the count-up animation. We never
  // substitute "—" or hide the number behind an empty-state card. The user
  // asked to "see 0, not fake data" — so ₹0 is shown with an honest subtitle
  // explaining why it is zero and a CTA to start populating it.

  // Empty-state flags (used to pick an honest subtitle + CTA, NOT to hide the value)
  const revenueEmpty = businessSnapshot.revenue === 0;
  const cashEmpty = businessSnapshot.bankBalance === 0;
  const complianceEmpty = pendingComplianceCount === 0 && returns.length === 0;

  const revenueSubtitle = revenueEmpty
    ? 'No revenue recorded yet · connect Zoho Books or create invoices'
    : `Total revenue · ${businessSnapshot.invoices.count} invoice${businessSnapshot.invoices.count === 1 ? '' : 's'}`;
  const complianceSubtitle = complianceEmpty
    ? 'GSTN integration coming in Phase 2 · create returns manually for now'
    : `${pendingComplianceCount === 1 ? 'Return to file' : 'Returns to file'} · ${metrics.filedReturns} filed`;
  const cashSubtitle = cashEmpty
    ? 'Banking integration coming in Phase 2 · will unlock cash position, reconciliation & cash flow'
    : `Bank balance · ₹${formatINR(businessSnapshot.bankBalance)}`;

  const firstName = getFirstName(user?.name);

  return (
    <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-10">
      {/* ── Ambient radial glow ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,_rgba(37,99,235,0.08),_transparent_60%)]"
      />

      <div className="relative page-rhythm space-y-12">
        {/* ═══ GREETING + QUICK ACTIONS ═══ */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' as const }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="space-y-2 min-w-0">
            <h1 className="text-display text-foreground">
              {getGreeting()}, {firstName}
            </h1>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 mt-0.5 shrink-0 accent-text" />
              <span className="leading-relaxed">{insight}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentView('clients')}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Users className="h-3.5 w-3.5" />
              Add Client
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentView('invoices')}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <FileText className="h-3.5 w-3.5" />
              Create Invoice
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentView('returns')}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Create Return
            </Button>
          </div>
        </motion.div>

        {/* ═══ Business Setup Progress ═══ */}
        {!onboardingDone && (
          <BusinessSetupProgress tasks={setupTasks} />
        )}

        {/* ═══ 3. KPI CARDS — Revenue / Customers / Invoices / Pending Compliance ═══ */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard
            index={0}
            label="Revenue"
            numericValue={businessSnapshot.revenue}
            numericFormat="currency"
            subtitle={revenueSubtitle}
            icon={<IndianRupee className="h-4 w-4 accent-text" />}
            cta={revenueEmpty ? {
              label: 'Connect Zoho Books',
              onClick: () => setCurrentView('zoho-books'),
            } : undefined}
          />

          {/* Customers — inline KPI matching KpiCard visual style */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: 'easeOut' as const }}
            className="h-full"
          >
            <div className="glass-surface p-6 h-full transition-shadow hover-lift hover:shadow-[0_0_32px_-8px_rgba(37,99,235,0.2)]">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Customers
                  </p>
                  <p className="text-3xl font-bold text-foreground tracking-tight truncate tabular">
                    <AnimatedNumber value={businessSnapshot.customers} format="integer" />
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {businessSnapshot.customers === 0
                      ? 'No customers yet · add your first client to begin'
                      : `${businessSnapshot.customers} active client${businessSnapshot.customers === 1 ? '' : 's'}`}
                  </p>
                  {businessSnapshot.customers === 0 && (
                    <button
                      type="button"
                      onClick={() => setCurrentView('clients')}
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold accent-text hover:opacity-80 transition-opacity"
                    >
                      Add Client
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-center h-10 w-10 rounded-xl accent-gradient-soft shrink-0">
                  <Users className="h-4 w-4 accent-text" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Invoices — inline KPI matching KpiCard visual style */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16, ease: 'easeOut' as const }}
            className="h-full"
          >
            <div className="glass-surface p-6 h-full transition-shadow hover-lift hover:shadow-[0_0_32px_-8px_rgba(37,99,235,0.2)]">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Invoices
                  </p>
                  <p className="text-3xl font-bold text-foreground tracking-tight truncate tabular">
                    <AnimatedNumber value={businessSnapshot.invoices.count} format="integer" />
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {businessSnapshot.invoices.count === 0
                      ? 'No invoices yet · create one to track revenue'
                      : `${businessSnapshot.invoices.count} invoice${businessSnapshot.invoices.count === 1 ? '' : 's'} issued`}
                  </p>
                  {businessSnapshot.invoices.count === 0 && (
                    <button
                      type="button"
                      onClick={() => setCurrentView('invoices')}
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold accent-text hover:opacity-80 transition-opacity"
                    >
                      Create Invoice
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-center h-10 w-10 rounded-xl accent-gradient-soft shrink-0">
                  <FileText className="h-4 w-4 accent-text" />
                </div>
              </div>
            </div>
          </motion.div>

          <KpiCard
            index={3}
            label="Pending Compliance"
            numericValue={pendingComplianceCount}
            numericFormat="integer"
            subtitle={complianceSubtitle}
            icon={<ShieldCheck className="h-4 w-4 accent-text" />}
            cta={complianceEmpty ? {
              label: 'Create Return',
              onClick: () => setCurrentView('returns'),
            } : undefined}
          />
        </section>

        {/* ═══ 4. ORACLE AI — Live Panel (left) + Ask Oracle (right) ═══ */}
        <div className={`grid grid-cols-1 gap-6 ${oracleActivated ? 'lg:grid-cols-2' : ''}`}>
          {oracleActivated && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.04, ease: 'easeOut' as const }}
              className="h-full"
            >
              <div className="glass-surface p-5 border-[#1F1F1F] h-full">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-2.5 w-2.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-[#3B82F6] opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#2563EB]" />
                    </span>
                    <h3 className="text-sm font-semibold text-foreground tracking-tight">
                      Oracle is live
                    </h3>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 h-5 border-[#2563EB]/40 text-[#3B82F6] bg-[#2563EB]/10"
                    >
                      Insights active
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] gap-1.5 border-border"
                    onClick={() => setCurrentView('ai-business-copilot')}
                  >
                    View Oracle Insights
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>

                {oracleInsightsLoading && !oracleInsights ? (
                  <OracleInsightsSkeleton />
                ) : oracleInsights ? (
                  <OracleLivePanel
                    insights={oracleInsights}
                    onPriorityClick={(view) => setCurrentView(view as AppView)}
                    onAskOracle={() => setCurrentView('ai-business-copilot')}
                  />
                ) : (
                  <div className="text-[12px] text-muted-foreground leading-relaxed">
                    Oracle was activated but insights are not yet available. Refresh in a moment.
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Ask Oracle — full-width when not activated, right column when activated */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.56, ease: 'easeOut' as const }}
            className="h-full"
          >
            <div className="glass-surface p-6 hover-lift h-full">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`flex items-center justify-center h-10 w-10 rounded-xl shrink-0 relative ${oracleActivated ? 'accent-gradient' : 'accent-gradient-soft'}`}>
                    <Brain className={`h-5 w-5 ${oracleActivated ? 'text-white' : 'accent-text'}`} />
                    {oracleActivated && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3B82F6] opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-[#2563EB] border border-background" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground tracking-tight">
                        Ask Oracle
                      </h3>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 h-5 ${
                          oracleActivated
                            ? 'border-[#2563EB]/40 text-[#3B82F6] bg-[#2563EB]/10'
                            : 'border-amber-500/30 text-amber-400'
                        }`}
                      >
                        {oracleActivated ? 'Online' : 'Not Activated'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {oracleActivated
                        ? 'Ask any question about your clients, returns, or compliance — Oracle turns live firm data into instant answers and actions.'
                        : 'Connect your business data to unlock Oracle. Activate to enable advanced analysis, predictions, and automated actions.'}
                    </p>
                    {oracleActivated && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-3">
                        {[
                          'What should I prioritize today?',
                          'Show overdue returns',
                          'Which clients are at risk?',
                        ].map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => setCurrentView('ai-business-copilot')}
                            className="text-[11px] rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-muted-foreground hover:border-[#2563EB]/30 hover:text-foreground transition-colors"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {oracleActivated ? (
                  <Button
                    size="sm"
                    className="accent-gradient text-white hover:opacity-90 gap-1.5 shrink-0"
                    onClick={() => setCurrentView('ai-business-copilot')}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Ask Oracle
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="accent-gradient text-white hover:opacity-90 gap-1.5 shrink-0"
                    onClick={() => setOracleWizardOpen(true)}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Activate Oracle
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* ═══ 5. BUSINESS HEALTH — Gauge + Cash Position (left) + Score Cards (right) ═══ */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="grid grid-cols-1 gap-6">
            {canComputeHealthScore ? (
              <BusinessHealthGauge
                score={businessSnapshot.healthScore}
                insight={insight}
              />
            ) : (
              <BusinessHealthUnavailable
                onConnect={() => {
                  // Prefer the already-connected integration; otherwise open Google.
                  if (zohoConnected) setCurrentView('zoho-books');
                  else setCurrentView('google-workspace');
                }}
              />
            )}
            <KpiCard
              index={0}
              label="Cash Position"
              numericValue={businessSnapshot.bankBalance}
              numericFormat="currency"
              subtitle={cashSubtitle}
              icon={<IndianRupee className="h-4 w-4 accent-text" />}
              cta={cashEmpty ? {
                label: 'View Integrations',
                onClick: () => setCurrentView('google-workspace'),
              } : undefined}
            />
          </div>
          <div className="grid grid-cols-1 gap-6">
            <UnavailableMetricCard
              index={0}
              label="Compliance Score"
              icon={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
              phase="Awaiting Data"
              reason="Connect Zoho Books or create GST returns to calculate your filing compliance score from real return data."
              unlocks={['Filing timeliness tracking', 'GST return status monitor', 'Late fee risk alerts']}
              ctaLabel="Create Return"
              onCta={() => setCurrentView('returns')}
            />
            <UnavailableMetricCard
              index={1}
              label="Collection Score"
              icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
              phase="Awaiting Data"
              reason="Connect Zoho Books or create invoices to measure how fast you collect payments from real invoice + payment data."
              unlocks={['Collection rate tracking', 'Average days-to-pay', 'Overdue receivable alerts']}
              ctaLabel="Connect Zoho Books"
              onCta={() => setCurrentView('zoho-books')}
            />
            <UnavailableMetricCard
              index={2}
              label="Risk Score"
              icon={<ShieldAlert className="h-4 w-4 text-muted-foreground" />}
              phase="Awaiting Data"
              reason="Connect Zoho Books to evaluate overdue exposure, cash-flow risk, and customer concentration from real financials."
              unlocks={['Overdue exposure analysis', 'Cash-flow risk scoring', 'Customer concentration alerts']}
              ctaLabel="Connect Zoho Books"
              onCta={() => setCurrentView('zoho-books')}
            />
          </div>
        </section>

        {/* ═══ AI Recommendations + Today's Priorities + Tasks ═══ */}
        <div className="section-gap grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SectionCard
            index={0}
            title="AI Recommendations"
            icon={<Sparkles className="h-4 w-4 accent-text" />}
          >
            {!oracleActivated ? (
              <EmptyState
                icon={Brain}
                title="Oracle requires connected business data"
                description="Activate Oracle to generate AI-powered recommendations from your live business snapshot."
                primaryLabel="Activate Oracle"
                onPrimary={() => setOracleWizardOpen(true)}
                compact
              />
            ) : mappedAIRecommendations.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="You're all caught up"
                description="Oracle has no recommendations right now. Connect more data sources for richer insights."
                compact
                tone="emerald"
              />
            ) : (
              <ul className="space-y-1">
                {mappedAIRecommendations.map((rec) => (
                  <li key={rec.id}>
                    <div className="group flex items-start gap-3 py-2.5">
                      <div className="flex items-center justify-center h-6 w-6 rounded-md accent-gradient-soft shrink-0 mt-0.5">
                        {rec.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-foreground leading-snug">
                          {rec.title}
                        </p>
                        <button
                          type="button"
                          onClick={rec.onAction}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium accent-text hover:opacity-80 transition-opacity"
                        >
                          {rec.actionLabel}
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            index={1}
            title="Today's Priorities"
            icon={<Zap className="h-4 w-4 accent-text" />}
            actionLabel="View all"
            onAction={() => setCurrentView('tasks')}
          >
            {todaysPriorities.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No priorities today"
                description="You're ahead of schedule. New priorities will appear here as they arise."
                compact
                tone="emerald"
              />
            ) : (
              <ScrollArea className="max-h-[280px] -mx-1 px-1">
                <ul className="space-y-1">
                  {todaysPriorities.map((p) => {
                    const urgencyHigh = p.urgency >= 8;
                    const urgencyMed = p.urgency >= 5 && p.urgency < 8;
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setCurrentView(p.view)}
                          className="w-full text-left p-2.5 rounded-lg hover:bg-white/5 transition-colors group"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-medium text-foreground truncate">
                                {p.label}
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">
                                {p.category} · urgency {p.urgency}/10
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 h-5 shrink-0 ${
                                urgencyHigh
                                  ? 'border-amber-500/30 text-amber-400'
                                  : urgencyMed
                                    ? 'border-cyan-500/30 text-cyan-400'
                                    : 'border-border text-muted-foreground'
                              }`}
                            >
                              {urgencyHigh ? 'High' : urgencyMed ? 'Med' : 'Low'}
                            </Badge>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            )}
          </SectionCard>

          <SectionCard
            index={2}
            title="Tasks"
            icon={<CheckSquare className="h-4 w-4 accent-text" />}
            actionLabel="View all"
            onAction={() => setCurrentView('returns')}
          >
            {upcomingFilings.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="All returns filed"
                description="You're all caught up! New filing tasks will appear here."
                compact
                tone="emerald"
              />
            ) : (
              <ScrollArea className="max-h-[280px] -mx-1 px-1">
                <ul className="space-y-1">
                  {upcomingFilings.map((r) => {
                    const client = clientMap.get(r.clientId);
                    const name = client?.tradeName ?? 'Unknown client';
                    const dueDateStr = getFilingDueDate(r.returnType, r.period);
                    const days = getDaysRemaining(dueDateStr);
                    const overdue = days < 0;
                    const dueSoon = days >= 0 && days <= 5;
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => handleFileReturn(r.clientId, r.returnType, r.period)}
                          className="w-full text-left p-2.5 rounded-lg hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-medium text-foreground truncate">
                                {name}
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {r.returnType} · {periodToLabel(r.period)} ·{' '}
                                {formatDateIN(dueDateStr)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`text-[11px] font-medium ${
                                  overdue
                                    ? 'text-red-400'
                                    : dueSoon
                                      ? 'text-amber-400'
                                      : 'text-muted-foreground'
                                }`}
                              >
                                {formatDaysRemaining(days)}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 h-5 ${
                                  overdue
                                    ? 'border-red-500/30 text-red-400'
                                    : dueSoon
                                      ? 'border-amber-500/30 text-amber-400'
                                      : 'border-border text-muted-foreground'
                                }`}
                              >
                                {r.status}
                              </Badge>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            )}
          </SectionCard>
        </div>

        {/* ═══ Timeline + Connected Services + Team ═══ */}
        <div className="section-gap grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SectionCard
            index={0}
            title="Business Timeline"
            icon={<Clock className="h-4 w-4 accent-text" />}
            actionLabel="View all"
            onAction={() => setCurrentView('timeline')}
          >
            {recentActivities.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No activity yet"
                description="Actions you take — invoices created, returns filed, integrations connected — will appear here."
                compact
              />
            ) : (
              <ScrollArea className="max-h-[280px] -mx-1 px-1">
                <div className="relative">
                  <ul className="space-y-0">
                    {recentActivities.slice(0, 6).map((a, i) => {
                      const isLast = i === Math.min(recentActivities.length, 6) - 1;
                      return (
                        <li key={a.id} className="relative flex gap-3 pb-3 last:pb-0">
                          {!isLast && (
                            <span
                              className="absolute left-[9px] top-7 bottom-0 w-px bg-white/[0.08]"
                              aria-hidden
                            />
                          )}
                          <span className="relative z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[#232323] bg-[#0A0A0A] shrink-0 mt-1">
                            <span className="h-1.5 w-1.5 rounded-full accent-gradient" />
                          </span>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <div className="flex items-center gap-1.5">
                              {activityIcon(a.type)}
                              <p className="text-[13px] font-medium text-foreground leading-snug">
                                {a.title}
                              </p>
                            </div>
                            {a.description && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                                {a.description}
                              </p>
                            )}
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                              {a.createdAt ? timeAgo(a.createdAt as string) : ''}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </ScrollArea>
            )}
          </SectionCard>

          <ConnectedServicesCard
            services={connectedServices}
            onConnect={handleConnectService}
          />

          <SectionCard
            index={2}
            title="Team Status"
            icon={<Users className="h-4 w-4 accent-text" />}
            actionLabel="Manage"
            onAction={() => {
              setPendingSettingsSection('team');
              setCurrentView('settings');
            }}
          >
            {teamMembers.length === 0 ? (
              <EmptyState
                icon={UserPlus}
                title="No team members yet"
                description="Invite your team to collaborate on clients, returns, and filings."
                primaryLabel="Invite Team"
                onPrimary={() => setInviteModalOpen(true)}
                compact
              />
            ) : (
              <>
                <ScrollArea className="max-h-[240px] -mx-1 px-1">
                  <ul className="space-y-1">
                    {teamMembers.map((m) => {
                      const initials = m.name.slice(0, 2).toUpperCase();
                      const isActive = m.status === 'active';
                      return (
                        <li key={m.id}>
                          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full accent-gradient text-[11px] font-bold text-white shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-medium text-foreground truncate capitalize">
                                {m.name}
                              </p>
                              <p className="text-[11px] text-muted-foreground capitalize">
                                {m.role}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  isActive ? 'bg-[#22C55E]' : 'bg-amber-400'
                                }`}
                              />
                              <span
                                className={`text-[10px] capitalize ${
                                  isActive ? 'text-emerald-400' : 'text-amber-400'
                                }`}
                              >
                                {m.status}
                              </span>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </ScrollArea>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInviteModalOpen(true)}
                  className="w-full mt-3 border-border gap-1.5 h-8"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Invite Member
                </Button>
              </>
            )}
          </SectionCard>
        </div>

        {/* ── Ready-to-file footer ── */}
        {(() => {
          const ready = returns.filter((r) =>
            ['validated', 'reviewed', 'generated'].includes(r.status),
          );
          if (ready.length === 0) return null;
          const first = ready[0];
          const client = clientMap.get(first.clientId);
          const name = client?.tradeName ?? 'Unknown client';
          return (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.56, ease: 'easeOut' as const }}
            >
              <div className="glass-surface p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg accent-gradient-soft shrink-0">
                    <CheckCircle2 className="h-4 w-4 accent-text" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {ready.length} return{ready.length === 1 ? '' : 's'} ready to file
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Next up: {first.returnType} · {name} · {periodToLabel(first.period)}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="accent-gradient text-white hover:opacity-90 gap-1.5 shrink-0"
                  onClick={() => handleQuickFile(first.id, name, first.returnType)}
                  disabled={filingInProgress.has(first.id)}
                >
                  {filingInProgress.has(first.id) ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Quick File
                </Button>
              </div>
            </motion.div>
          );
        })()}
      </div>

      {/* ═══ Premium Modals ═══ */}
      <InviteTeamModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        onInvited={() => reloadOrg()}
      />
      <ActivateOracleWizard
        open={oracleWizardOpen}
        onOpenChange={setOracleWizardOpen}
        onActivated={() => {
          reloadOrg();
          refreshSnapshot();
        }}
        integrations={{
          gstn: false,
          bank: false,
          google: googleConnected,
          zoho: zohoConnected,
          invoices: hasInvoices,
        }}
        dataQuality={{
          customers: businessSnapshot.customers,
          invoices: businessSnapshot.invoices.count,
          hasRevenue: businessSnapshot.revenue > 0,
        }}
      />
    </div>
  );
}

// Local BusinessHealthGauge kept for the rare case the snapshot DOES have a
// real, data-backed health score (e.g. after Zoho sync completes). In that
// case we render the gauge; otherwise we render BusinessHealthUnavailable.
function BusinessHealthGauge({
  score,
  insight,
}: {
  score: number;
  insight: string;
}) {
  const size = 180;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const offset = c * (1 - pct);
  const tier =
    score >= 85 ? { label: 'Excellent', tone: 'text-emerald-400' }
      : score >= 70 ? { label: 'Healthy', tone: 'text-emerald-400' }
        : score >= 50 ? { label: 'At Risk', tone: 'text-amber-400' }
          : { label: 'Critical', tone: 'text-amber-400' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.12, ease: 'easeOut' as const }}
      className="h-full"
    >
      <div className="glass-surface p-6 md:p-8 flex flex-col sm:flex-row items-center gap-6 md:gap-10 h-full">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <defs>
              <linearGradient id="bhsGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2563EB" />
                <stop offset="60%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="url(#bhsGradient)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={c}
              initial={{ strokeDashoffset: c }}
              animate={{ strokeDashoffset: score > 0 ? offset : c }}
              transition={{ duration: 1.2, ease: 'easeOut' as const, delay: 0.3 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className={`text-5xl font-bold tracking-tight ${tier.tone}`}
            >
              {Math.round(score)}
            </motion.span>
            <span className="text-[10px] text-muted-foreground tracking-wider uppercase mt-1">
              / 100
            </span>
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-2 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg accent-gradient-soft">
              <Brain className="h-4 w-4 accent-text" />
            </div>
            <h3 className="text-sm font-semibold text-foreground tracking-tight">
              Business Health Score
            </h3>
          </div>
          <p className={`text-lg font-semibold ${tier.tone}`}>{tier.label}</p>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
            {insight}
          </p>
          <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Live · auto-refreshing
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// OracleLivePanel — Compact "Oracle is live" insights summary
// ═══════════════════════════════════════════════════════════════════════════════
//
// Renders the persisted Oracle insights (Business Summary, Top Priority, Health
// badge, Alert/Risk counts) in a compact horizontal layout. Shown on the home
// page immediately after Oracle activation so the user sees real, data-driven
// content instead of just an "Online" badge.
//
// All numbers derive from the real BusinessSnapshot via generateOracleInsights().

function OracleLivePanel({
  insights,
  onPriorityClick,
  onAskOracle,
}: {
  insights: import('@/app/api/oracle/activate/route').OracleInsights;
  onPriorityClick: (view: string) => void;
  onAskOracle: () => void;
}) {
  const topPriority = insights.todaysPriorities[0] ?? null;
  const health = insights.financialHealth;

  const healthTone =
    health.status === 'healthy'
      ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
      : health.status === 'moderate'
        ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
        : 'border-red-500/40 text-red-400 bg-red-500/10';

  const healthLabel =
    health.status === 'healthy'
      ? 'Healthy'
      : health.status === 'moderate'
        ? 'Moderate'
        : 'At Risk';

  const priorityTone =
    topPriority?.priority === 'high'
      ? 'border-red-500/30 text-red-400 bg-red-500/5'
      : topPriority?.priority === 'medium'
        ? 'border-amber-500/30 text-amber-400 bg-amber-500/5'
        : 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Business Summary */}
      <div className="md:col-span-2 space-y-3">
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="h-3 w-3 accent-text" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Business Summary
            </span>
          </div>
          <p className="text-[13px] text-foreground leading-relaxed line-clamp-2">
            {insights.businessSummary}
          </p>
        </div>

        {topPriority && (
          <button
            type="button"
            onClick={() => onPriorityClick(topPriority.actionView)}
            className="w-full text-left p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap className="h-3 w-3 text-amber-400 shrink-0" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Today&apos;s Top Priority
                  </span>
                </div>
                <p className="text-[12px] font-medium text-foreground truncate">
                  {topPriority.title}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                  {topPriority.reason}
                </p>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 h-5 shrink-0 ${priorityTone}`}
              >
                {topPriority.priority}
              </Badge>
            </div>
          </button>
        )}
      </div>

      {/* Right column: Health + Alert/Risk counts */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={onAskOracle}
          className="w-full text-left p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3 accent-text" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Health
              </span>
            </div>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${healthTone}`}>
              {health.score}/100
            </Badge>
          </div>
          <p className="text-[12px] font-medium text-foreground">{healthLabel}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {health.drivers.length} drivers · {health.drivers.filter((d) => d.impact === 'positive').length} positive
          </p>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center gap-1 mb-0.5">
              <AlertTriangle className="h-3 w-3 text-amber-400" />
              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                Alerts
              </span>
            </div>
            <p className="text-base font-semibold text-foreground">
              {insights.aiAlerts.length}
            </p>
          </div>
          <div className="p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center gap-1 mb-0.5">
              <ShieldAlert className="h-3 w-3 text-red-400" />
              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                Risks
              </span>
            </div>
            <p className="text-base font-semibold text-foreground">
              {insights.risks.length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// OracleInsightsSkeleton — Loading state for the OracleLivePanel
// ═══════════════════════════════════════════════════════════════════════════════

function OracleInsightsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-2 space-y-3">
        <div>
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4 mt-1" />
        </div>
        <div className="p-3 rounded-lg border border-white/[0.06]">
          <Skeleton className="h-3 w-32 mb-2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-2/3 mt-1" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="p-3 rounded-lg border border-white/[0.06]">
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-24 mt-1" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-lg border border-white/[0.06]">
            <Skeleton className="h-3 w-12 mb-1" />
            <Skeleton className="h-6 w-8" />
          </div>
          <div className="p-2.5 rounded-lg border border-white/[0.06]">
            <Skeleton className="h-3 w-12 mb-1" />
            <Skeleton className="h-6 w-8" />
          </div>
        </div>
      </div>
    </div>
  );
}
