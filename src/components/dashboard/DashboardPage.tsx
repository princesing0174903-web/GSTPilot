'use client';

import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { ProSkeleton } from '@/components/ui-pro';
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  FileText,
  ShieldCheck,
  ClipboardCheck,
  Users,
  IndianRupee,
  Plus,
  ArrowRight,
  Loader2,
  Rocket,
  Activity,
  CheckSquare,
  Brain,
  Plug,
  MessageSquare,
  Zap,
  TrendingUp,
  ShieldAlert,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useApp, type AppView } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  useLiveDashboardMetrics,
  useFireClients,
  useFireReturns,
  useFireRecentActivities,
  useFirmExecutiveScores,
  useFireMemberships,
  useFirePriorities,
} from '@/hooks/use-firestore';
import { useInvoices } from '@/hooks/useInvoices';
import type {
  FirestoreClient,
  LiveDashboardMetrics,
} from '@/lib/firestore-schema';
import { fileReturn } from '@/lib/firestore-service';
import { periodToLabel, isOverdue, getFilingDueDate } from '@/lib/gst-utils';
import { toast } from 'sonner';

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
  if (!name) return 'Prince';
  const first = name.trim().split(/\s+/)[0];
  return first || 'Prince';
}

// One-sentence AI insight derived from live metrics.
function buildInsightSentence(
  metrics: LiveDashboardMetrics,
  pendingCollection: number,
): string {
  const parts: string[] = [];
  if (metrics.overdueReturns > 0) {
    parts.push(
      `${metrics.overdueReturns} overdue return${metrics.overdueReturns > 1 ? 's' : ''}`,
    );
  } else if (metrics.pendingReturns > 0) {
    parts.push(
      `${metrics.pendingReturns} return${metrics.pendingReturns > 1 ? 's' : ''} to file`,
    );
  }
  if (pendingCollection > 0) {
    parts.push(`₹${formatINR(pendingCollection)} pending collection`);
  }
  if (metrics.criticalIssues > 0) {
    parts.push(
      `${metrics.criticalIssues} critical issue${metrics.criticalIssues > 1 ? 's' : ''}`,
    );
  }
  if (parts.length === 0) {
    return `All clear — ${metrics.filedReturns} returns filed and ${metrics.totalClients} clients in good standing.`;
  }
  if (parts.length === 1) return `${parts[0]}.`;
  const last = parts.pop();
  return `${parts.join(', ')} and ${last}.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY ICON — returns just the icon shape; color is applied via accent-text
// ═══════════════════════════════════════════════════════════════════════════════

function activityIcon(type: string): React.ReactNode {
  if (type.includes('filed')) return <CheckCircle2 className="h-3.5 w-3.5 accent-text" />;
  if (type.includes('upload') || type.includes('document'))
    return <Upload className="h-3.5 w-3.5 accent-text" />;
  if (type.includes('review')) return <ClipboardCheck className="h-3.5 w-3.5 accent-text" />;
  if (type.includes('client')) return <Users className="h-3.5 w-3.5 accent-text" />;
  if (type.includes('reconcil') || type.includes('mismatch'))
    return <AlertTriangle className="h-3.5 w-3.5 accent-text" />;
  if (type.includes('invoice') || type.includes('extract'))
    return <FileText className="h-3.5 w-3.5 accent-text" />;
  return <Activity className="h-3.5 w-3.5 accent-text" />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// KPI CARD
// ═══════════════════════════════════════════════════════════════════════════════

interface KpiCardProps {
  label: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  index: number;
}

function KpiCard({ label, value, subtitle, icon, index }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: 'easeOut' }}
      className="h-full"
    >
      <div className="glass-surface rounded-2xl p-6 h-full transition-shadow hover-lift hover:shadow-[0_0_32px_-8px_rgba(59,130,246,0.25)]">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {label}
            </p>
            <p className="text-3xl font-bold text-foreground tracking-tight truncate">
              {value}
            </p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
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
// SECTION CARD — glass wrapper with header (icon chip + title + optional action)
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
      transition={{ duration: 0.5, delay: 0.24 + index * 0.08, ease: 'easeOut' }}
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
// BUSINESS HEALTH SCORE — prominent SVG gauge (0-100)
// ═══════════════════════════════════════════════════════════════════════════════

function healthTier(score: number): { label: string; tone: string } {
  if (score >= 85) return { label: 'Excellent', tone: 'text-emerald-400' };
  if (score >= 70) return { label: 'Healthy', tone: 'text-emerald-400' };
  if (score >= 50) return { label: 'At Risk', tone: 'text-amber-400' };
  return { label: 'Critical', tone: 'text-amber-400' };
}

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
  const tier = healthTier(score);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.12, ease: 'easeOut' }}
      className="h-full"
    >
      <div className="glass-surface rounded-2xl p-6 md:p-8 flex flex-col sm:flex-row items-center gap-6 md:gap-10 h-full">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <defs>
              <linearGradient id="bhsGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="60%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#f59e0b" />
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
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
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
              Updated just now
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCORE CARD — small 0-100 score with progress bar
// ═══════════════════════════════════════════════════════════════════════════════

interface ScoreCardProps {
  label: string;
  score: number; // 0-100
  subtitle: string;
  icon: React.ReactNode;
  index: number;
  tone?: 'emerald' | 'amber' | 'cyan';
}

function ScoreCard({
  label,
  score,
  subtitle,
  icon,
  index,
  tone = 'emerald',
}: ScoreCardProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const barColor =
    tone === 'amber'
      ? 'from-amber-500 to-amber-400'
      : tone === 'cyan'
        ? 'from-cyan-500 to-cyan-400'
        : 'from-emerald-500 to-emerald-400';
  const textColor =
    tone === 'amber'
      ? 'text-amber-400'
      : tone === 'cyan'
        ? 'text-cyan-400'
        : 'text-emerald-400';
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: 'easeOut' }}
      className="h-full"
    >
      <div className="glass-surface rounded-2xl p-5 h-full hover-lift">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="space-y-1 min-w-0">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {label}
            </p>
            <p className={`text-2xl font-bold tracking-tight ${textColor}`}>
              {Math.round(clamped)}
              <span className="text-sm text-muted-foreground ml-0.5">/100</span>
            </p>
          </div>
          <div className="flex items-center justify-center h-9 w-9 rounded-lg accent-gradient-soft shrink-0">
            {icon}
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${clamped}%` }}
            transition={{ duration: 0.8, delay: 0.3 + index * 0.05, ease: 'easeOut' }}
            className={`h-full rounded-full bg-gradient-to-r ${barColor}`}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">{subtitle}</p>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING SKELETON — matches new layout (3 KPI + 3 sections)
// ═══════════════════════════════════════════════════════════════════════════════

function DashboardSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-10 space-y-8">
      <div className="space-y-3">
        <ProSkeleton className="h-9 w-64" />
        <ProSkeleton className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <ProSkeleton key={i} className="h-32 rounded-2xl" />
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
// EMPTY STATE — Fresh onboarding (re-styled with accent gradient logo)
// ═══════════════════════════════════════════════════════════════════════════════

function WelcomeEmptyState({
  onAddClient,
  onUploadDoc,
}: {
  onAddClient: () => void;
  onUploadDoc: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center text-center py-20 px-4"
    >
      <div className="relative mb-6">
        <div className="flex items-center justify-center h-20 w-20 rounded-2xl accent-gradient accent-ring">
          <Rocket className="h-10 w-10 text-white" />
        </div>
        <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full accent-gradient flex items-center justify-center">
          <Sparkles className="h-3 w-3 text-white" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-foreground tracking-tight">
        Welcome to GSTPilot
      </h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md">
        Start by adding your first client to unlock the full workflow —
        from document upload to automated GST filing.
      </p>
      <div className="flex items-center gap-3 mt-6">
        <Button
          onClick={onAddClient}
          className="accent-gradient text-white hover:opacity-90 gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Add Client
        </Button>
        <Button
          variant="outline"
          onClick={onUploadDoc}
          className="gap-1.5 border-border"
        >
          <Upload className="h-4 w-4" />
          Upload Document
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-6 mt-10 text-center max-w-sm">
        {[
          { icon: <Users className="h-5 w-5 accent-text" />, label: 'Add Clients' },
          { icon: <FileText className="h-5 w-5 accent-text" />, label: 'Upload Docs' },
          { icon: <CheckCircle2 className="h-5 w-5 accent-text" />, label: 'File Returns' },
        ].map((step, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg accent-gradient-soft">
              {step.icon}
            </div>
            <span className="text-[11px] text-muted-foreground">{step.label}</span>
          </div>
        ))}
      </div>
    </motion.div>
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
  const { setCurrentView, setSelectedClientId, setReturnPrepCtx } = useApp();
  const { user } = useAuth();

  // ── Firebase Firestore hooks ──────────────────────────────────────────
  const { metrics, loading, error } = useLiveDashboardMetrics();
  const { data: clients } = useFireClients();
  const { data: returns } = useFireReturns();
  const { data: recentActivities } = useFireRecentActivities(10);
  const { scores: execScores } = useFirmExecutiveScores();
  const { data: memberships } = useFireMemberships(null);
  const { data: priorityQueue } = useFirePriorities('pending');

  // ── Real Invoice Engine™ — org-scoped, real-time, server-calculated ──
  // Replaces the old firmId-scoped useFireInvoices() for revenue / outstanding
  // KPIs. The engine computes totals server-side (subtotal, taxes, grandTotal,
  // paidAmount, balanceDue) and exposes a stats aggregate via computeInvoiceStats.
  const {
    invoices: engineInvoices,
    stats: invoiceStats,
    loading: invoicesLoading,
  } = useInvoices();

  // ── Filing state ──────────────────────────────────────────────────────
  const [filingInProgress, setFilingInProgress] = useState<Set<string>>(new Set());

  // ── Client lookup map ─────────────────────────────────────────────────
  const clientMap = useMemo(() => {
    const map = new Map<string, FirestoreClient & { id: string }>();
    for (const c of clients) map.set(c.clientId, c);
    return map;
  }, [clients]);

  // ── KPI derivations ───────────────────────────────────────────────────
  const pendingComplianceCount = useMemo(
    () => returns.filter((r) => r.status !== 'filed').length,
    [returns],
  );

  const pendingInvoices = useMemo(
    () =>
      engineInvoices.filter(
        (i) =>
          i.balanceDue > 0 && i.status !== 'cancelled' && i.status !== 'draft',
      ),
    [engineInvoices],
  );

  // Real outstanding from the invoice engine — Σ balanceDue of non-draft,
  // non-cancelled invoices (server-calculated per invoice).
  const pendingCollection = invoiceStats.totalOutstanding;

  const insight = useMemo(
    () => buildInsightSentence(metrics, pendingCollection),
    [metrics, pendingCollection],
  );

  // ── Business Health Score (firmHealth from executive scores, fallback to metrics) ──
  const businessHealthScore = useMemo<number>(() => {
    if (execScores && typeof execScores.firmHealth === 'number' && execScores.firmHealth > 0) {
      return execScores.firmHealth;
    }
    if (metrics.averageHealthScore > 0) return metrics.averageHealthScore;
    // Fallback computation — start at 100, subtract weighted penalties
    let score = 100;
    score -= metrics.criticalIssues * 6;
    score -= metrics.warnings * 2;
    score -= metrics.overdueReturns * 8;
    score -= metrics.pendingReturns * 2;
    return Math.max(0, Math.min(100, Math.round(score)));
  }, [execScores, metrics]);

  // ── Compliance Score (0-100): filed vs total returns, blended with exec score ──
  const complianceScore = useMemo<number>(() => {
    if (execScores && typeof execScores.compliance === 'number' && execScores.compliance > 0) {
      return execScores.compliance;
    }
    const totalReturns = returns.length;
    if (totalReturns === 0) return 100;
    const filed = returns.filter((r) => r.status === 'filed').length;
    return Math.round((filed / totalReturns) * 100);
  }, [execScores, returns]);

  // ── Collection Score (0-100): match percentage from reconciliation ──
  const collectionScore = useMemo<number>(() => {
    if (execScores && typeof execScores.cashFlow === 'number' && execScores.cashFlow > 0) {
      // Use a blend: cashFlow score and match percentage
      return Math.round((execScores.cashFlow + metrics.matchPercentage) / 2);
    }
    return Math.round(metrics.matchPercentage);
  }, [execScores, metrics.matchPercentage]);

  // ── Risk Score (0-100): inverse of risk percentage, with critical issues penalty ──
  const riskScore = useMemo<number>(() => {
    // riskScore represents risk POSTURE (higher = safer), not raw risk
    const baseRisk = Math.max(0, Math.min(100, 100 - metrics.riskPercentage));
    const criticalPenalty = Math.min(50, metrics.criticalIssues * 8);
    const overduePenalty = Math.min(30, metrics.overdueReturns * 6);
    return Math.max(0, Math.min(100, Math.round(baseRisk - criticalPenalty - overduePenalty)));
  }, [metrics]);

  // ── Today's Priorities: from priority queue hook, fallback to derived priorities ──
  const todaysPriorities = useMemo<
    Array<{ id: string; label: string; category: string; urgency: number; view: AppView }>
  >(() => {
    // 1. Use real priority queue data if available
    if (priorityQueue && priorityQueue.length > 0) {
      return priorityQueue.slice(0, 5).map((p) => ({
        id: p.priorityId || p.id,
        label: p.title || 'Untitled priority',
        category: p.category || 'general',
        urgency: p.urgency || 5,
        view: 'tasks' as AppView,
      }));
    }
    // 2. Fallback: derive from live metrics
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
    if (metrics.extractionsPending > 0) {
      list.push({
        id: 'fb-extractions',
        label: `Review ${metrics.extractionsPending} pending extraction${metrics.extractionsPending > 1 ? 's' : ''}`,
        category: 'upload',
        urgency: 5,
        view: 'invoices',
      });
    }
    return list.slice(0, 5);
  }, [priorityQueue, metrics, pendingCollection]);

  // ── Connected services (static catalog — honest "Not connected" by default) ──
  const connectedServices = useMemo(
    () => [
      { id: 'gstn', name: 'GSTN', initial: 'G', connected: metrics.totalClients > 0 },
      { id: 'einvoice', name: 'E-Invoice', initial: 'E', connected: false },
      { id: 'gstr2b', name: 'GSTR-2B', initial: '2', connected: false },
      { id: 'bank', name: 'Bank APIs', initial: 'B', connected: false },
      { id: 'whatsapp', name: 'WhatsApp', initial: 'W', connected: false },
      { id: 'gmail', name: 'Gmail', initial: 'M', connected: false },
    ],
    [metrics.totalClients],
  );

  // ── Team members from memberships hook ──
  const teamMembers = useMemo(
    () => memberships.slice(0, 6).map((m) => ({
      id: m.membershipId || m.id,
      name: m.userId?.split('@')[0] || 'Team member',
      role: m.role || 'staff',
      status: m.status || 'invited',
    })),
    [memberships],
  );

  // ── Upcoming filings (non-filed, sorted by urgency) ───────────────────
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

  // ── AI Recommendations ────────────────────────────────────────────────
  const recommendations = useMemo<Recommendation[]>(() => {
    const recs: Recommendation[] = [];

    // Overdue returns → file now
    for (const r of returns) {
      if (recs.length >= 5) break;
      if (r.status === 'filed' || !isOverdue(r.period)) continue;
      const client = clientMap.get(r.clientId);
      const name = client?.tradeName ?? 'Unknown client';
      recs.push({
        id: `rec-overdue-${r.id}`,
        icon: <AlertTriangle className="h-3.5 w-3.5 accent-text" />,
        title: `File ${r.returnType} for ${name} — overdue`,
        actionLabel: 'File now',
        onAction: () => handleFileReturn(r.clientId, r.returnType, r.period),
      });
    }

    // Returns due soon (≤ 7 days)
    for (const r of returns) {
      if (recs.length >= 5) break;
      if (r.status === 'filed' || isOverdue(r.period)) continue;
      const dueDate = getFilingDueDate(r.returnType, r.period);
      const days = getDaysRemaining(dueDate);
      if (days > 7) continue;
      const client = clientMap.get(r.clientId);
      const name = client?.tradeName ?? 'Unknown client';
      recs.push({
        id: `rec-soon-${r.id}`,
        icon: <Clock className="h-3.5 w-3.5 accent-text" />,
        title: `File ${r.returnType} for ${name} — due in ${days} day${days === 1 ? '' : 's'}`,
        actionLabel: 'Prepare',
        onAction: () => handleFileReturn(r.clientId, r.returnType, r.period),
      });
    }

    // Low health score clients
    for (const c of clients) {
      if (recs.length >= 5) break;
      if (c.healthScore >= 60) continue;
      recs.push({
        id: `rec-health-${c.clientId}`,
        icon: <ShieldCheck className="h-3.5 w-3.5 accent-text" />,
        title: `${c.tradeName} — health score ${Math.round(c.healthScore)}% needs attention`,
        actionLabel: 'Open',
        onAction: () => handleOpenClient(c.clientId),
      });
    }

    // Pending collection
    if (recs.length < 5 && pendingCollection > 0) {
      recs.push({
        id: 'rec-collection',
        icon: <IndianRupee className="h-3.5 w-3.5 accent-text" />,
        title: `₹${formatINR(pendingCollection)} pending collection across ${pendingInvoices.length} invoice${pendingInvoices.length === 1 ? '' : 's'}`,
        actionLabel: 'Review',
        onAction: () => setCurrentView('invoices'),
      });
    }

    // Critical issues
    if (recs.length < 5 && metrics.criticalIssues > 0) {
      recs.push({
        id: 'rec-critical',
        icon: <AlertTriangle className="h-3.5 w-3.5 accent-text" />,
        title: `${metrics.criticalIssues} critical compliance issue${metrics.criticalIssues === 1 ? '' : 's'} need${metrics.criticalIssues === 1 ? 's' : ''} review`,
        actionLabel: 'Review',
        onAction: () => setCurrentView('reconcile'),
      });
    }

    return recs;
  }, [returns, clients, clientMap, pendingCollection, pendingInvoices.length, metrics.criticalIssues]);

  // ── Handlers ──────────────────────────────────────────────────────────
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

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Loading ───────────────────────────────────────────────────────────
  // Wait for both the live dashboard metrics AND the real invoice engine
  // initial subscription to settle before rendering — otherwise the Revenue
  // and Cash Position KPIs would briefly show "—" before the engine data
  // arrives.
  if (loading || invoicesLoading) return <DashboardSkeleton />;

  // ── Error ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-10">
        <Card className="glass-surface border-red-500/20">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <h3 className="font-semibold text-foreground">Failed to load dashboard</h3>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
            <Button
              variant="outline"
              className="mt-4 border-border"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Empty state — no clients at all ───────────────────────────────────
  if (metrics.totalClients === 0) {
    return (
      <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-10">
        <WelcomeEmptyState
          onAddClient={() => setCurrentView('clients')}
          onUploadDoc={() => setCurrentView('invoices')}
        />
      </div>
    );
  }

  // ── KPI values ────────────────────────────────────────────────────────
  // Revenue KPI: REAL revenue from the invoice engine — Σ grandTotal of
  // non-draft, non-cancelled invoices (server-calculated per invoice).
  const revenueValue =
    invoiceStats.totalRevenue > 0 ? `₹${formatINR(invoiceStats.totalRevenue)}` : '—';
  const complianceValue = String(pendingComplianceCount);
  // Cash Position KPI: REAL outstanding from the invoice engine — Σ balanceDue
  // of non-draft, non-cancelled invoices.
  const cashValue =
    invoiceStats.totalOutstanding > 0 ? `₹${formatINR(invoiceStats.totalOutstanding)}` : '—';

  const firstName = getFirstName(user?.name);

  return (
    <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-10">
      {/* ── Ambient radial glow at top ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.08),_transparent_60%)]"
      />

      {/* ── Content ── */}
      <div className="relative space-y-8">
        {/* ═══ GREETING + AI INSIGHT ═══ */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="space-y-2 min-w-0">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
              {getGreeting()}, {firstName} <span className="inline-block">👋</span>
            </h1>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 mt-0.5 shrink-0 accent-text" />
              <span className="leading-relaxed">{insight}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView('clients')}
            className="shrink-0 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Client
          </Button>
        </motion.div>

        {/* ═══ BUSINESS HEALTH SCORE — prominent gauge ═══ */}
        <BusinessHealthGauge
          score={businessHealthScore}
          insight={insight}
        />

        {/* ═══ KPI CARDS — exactly 3 ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <KpiCard
            index={0}
            label="Revenue"
            value={revenueValue}
            subtitle={`Total revenue · ${invoiceStats.count} invoice${invoiceStats.count === 1 ? '' : 's'}`}
            icon={<IndianRupee className="h-4 w-4 accent-text" />}
          />
          <KpiCard
            index={1}
            label="Pending Compliance"
            value={complianceValue}
            subtitle={
              pendingComplianceCount === 1
                ? 'Return to file'
                : 'Returns to file'
            }
            icon={<ShieldCheck className="h-4 w-4 accent-text" />}
          />
          <KpiCard
            index={2}
            label="Cash Position"
            value={cashValue}
            subtitle={
              pendingInvoices.length > 0
                ? `${pendingInvoices.length} invoice${pendingInvoices.length === 1 ? '' : 's'} · Pending collection`
                : 'Pending collection'
            }
            icon={<IndianRupee className="h-4 w-4 accent-text" />}
          />
        </div>

        {/* ═══ SCORE CARDS — Compliance / Collection / Risk (0-100) ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ScoreCard
            index={0}
            label="Compliance Score"
            score={complianceScore}
            subtitle={
              metrics.filedReturns > 0
                ? `${metrics.filedReturns} filed · ${metrics.pendingReturns + metrics.overdueReturns} pending`
                : 'Based on filed vs pending returns'
            }
            icon={<ShieldCheck className="h-4 w-4 accent-text" />}
            tone="emerald"
          />
          <ScoreCard
            index={1}
            label="Collection Score"
            score={collectionScore}
            subtitle={
              pendingCollection > 0
                ? `₹${formatINR(pendingCollection)} pending collection`
                : `${metrics.matchPercentage.toFixed(0)}% invoice match rate`
            }
            icon={<TrendingUp className="h-4 w-4 accent-text" />}
            tone="cyan"
          />
          <ScoreCard
            index={2}
            label="Risk Score"
            score={riskScore}
            subtitle={
              metrics.criticalIssues > 0
                ? `${metrics.criticalIssues} critical · ${metrics.overdueReturns} overdue`
                : 'Risk posture — higher is safer'
            }
            icon={<ShieldAlert className="h-4 w-4 accent-text" />}
            tone="amber"
          />
        </div>

        {/* ═══ BOTTOM SECTIONS — 3 in a row ═══ */}
        <div className="section-gap grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── AI Recommendations ─────────────────────────────────────── */}
          <SectionCard
            index={0}
            title="AI Recommendations"
            icon={<Sparkles className="h-4 w-4 accent-text" />}
          >
            {recommendations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="h-7 w-7 text-emerald-500/70 mb-2" />
                <p className="text-xs text-muted-foreground max-w-[220px]">
                  You&apos;re all caught up. Nothing needs your attention right now.
                </p>
              </div>
            ) : (
              <ul className="space-y-1">
                {recommendations.map((rec) => (
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

          {/* ── Today's Priorities ───────────────────────────────────── */}
          <SectionCard
            index={1}
            title="Today's Priorities"
            icon={<Zap className="h-4 w-4 accent-text" />}
            actionLabel="View all"
            onAction={() => setCurrentView('tasks')}
          >
            {todaysPriorities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="h-7 w-7 text-emerald-500/70 mb-2" />
                <p className="text-xs text-muted-foreground max-w-[220px]">
                  No priorities today — you&apos;re ahead of schedule!
                </p>
              </div>
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

          {/* ── Tasks (upcoming filings) ─────────────────────────────── */}
          <SectionCard
            index={2}
            title="Tasks"
            icon={<CheckSquare className="h-4 w-4 accent-text" />}
            actionLabel="View all"
            onAction={() => setCurrentView('returns')}
          >
            {upcomingFilings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="h-7 w-7 text-emerald-500/70 mb-2" />
                <p className="text-xs text-muted-foreground max-w-[220px]">
                  All returns filed — you&apos;re all caught up!
                </p>
              </div>
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
                          onClick={() =>
                            handleFileReturn(r.clientId, r.returnType, r.period)
                          }
                          className="w-full text-left p-2.5 rounded-lg hover:bg-white/5 transition-colors group"
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

        {/* ═══ ADDITIONAL WIDGETS — Activity / Services / Team ═══ */}
        <div className="section-gap grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Business Timeline (Recent Activity) ──────────────────── */}
          <SectionCard
            index={0}
            title="Business Timeline"
            icon={<Clock className="h-4 w-4 accent-text" />}
            actionLabel="View all"
            onAction={() => setCurrentView('timeline')}
          >
            {recentActivities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="h-7 w-7 text-muted-foreground/60 mb-2" />
                <p className="text-xs text-muted-foreground max-w-[220px]">
                  No activity yet — actions you take will appear here.
                </p>
              </div>
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
                          <span className="relative z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-emerald-400/30 bg-[#050505] shrink-0 mt-1">
                            <span className="h-1.5 w-1.5 rounded-full accent-gradient" />
                          </span>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <p className="text-[13px] font-medium text-foreground leading-snug">
                              {a.title}
                            </p>
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

          {/* ── Connected Services ───────────────────────────────────── */}
          <SectionCard
            index={1}
            title="Connected Services"
            icon={<Plug className="h-4 w-4 accent-text" />}
            actionLabel="Manage"
            onAction={() => setCurrentView('connections')}
          >
            <div className="grid grid-cols-2 gap-2">
              {connectedServices.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-[11px] font-bold text-muted-foreground shrink-0">
                      {s.initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {s.name}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            s.connected ? 'bg-emerald-400' : 'bg-muted-foreground/40'
                          }`}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          {s.connected ? 'Connected' : 'Not connected'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground text-center pt-3">
              Connect services to sync automatically.
            </p>
          </SectionCard>

          {/* ── Team Status ──────────────────────────────────────────── */}
          <SectionCard
            index={2}
            title="Team Status"
            icon={<Users className="h-4 w-4 accent-text" />}
            actionLabel="Manage"
            onAction={() => setCurrentView('team')}
          >
            {teamMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl accent-gradient-soft mb-2">
                  <Users className="h-4 w-4 accent-text" />
                </div>
                <p className="text-xs text-muted-foreground max-w-[220px]">
                  No team members yet — invite your team to collaborate.
                </p>
                <button
                  type="button"
                  onClick={() => setCurrentView('team')}
                  className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium accent-text hover:opacity-80 transition-opacity"
                >
                  [ Invite your team ]
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <ScrollArea className="max-h-[280px] -mx-1 px-1">
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
                                isActive ? 'bg-emerald-400' : 'bg-amber-400'
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
            )}
          </SectionCard>
        </div>

        {/* ═══ ORACLE QUICK-ASK — AI assistant entry ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.56, ease: 'easeOut' }}
          className="h-full"
        >
          <div className="glass-surface rounded-2xl p-6 hover-lift">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl accent-gradient shrink-0">
                  <Brain className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground tracking-tight">
                      Ask Oracle
                    </h3>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 h-5 border-emerald-500/30 text-emerald-400"
                    >
                      AI
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Ask any question about your clients, returns, or compliance — Oracle turns live firm data into instant answers and actions.
                  </p>
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
                        className="text-[11px] rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-muted-foreground hover:border-emerald-400/30 hover:text-foreground transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                className="accent-gradient text-white hover:opacity-90 gap-1.5 shrink-0"
                onClick={() => setCurrentView('ai-business-copilot')}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Ask Oracle
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </motion.div>

        {/* ── Ready-to-file quick action footer (subtle, optional) ── */}
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
              transition={{ duration: 0.5, delay: 0.56, ease: 'easeOut' }}
            >
              <div className="glass-surface rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
    </div>
  );
}
