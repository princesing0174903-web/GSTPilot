'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Minimalist Enterprise Dashboard
// ═══════════════════════════════════════════════════════════════════════════════
// A focused, fast, and minimal dashboard inspired by Vercel & OpenAI.
//
// Key Principles:
//   1. Clean 1px borders, #0A0A0A canvas, #111111 cards.
//   2. High signal-to-noise ratio: no competing multi-color badges or bloated widgets.
//   3. Single clear primary action: Create Invoice [C].
//   4. Zero-state aware: onboarding checklist when all values are zero.
//   5. Unified operations: Financial Vitals + Live Workflow + Action Stream.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ProSkeleton, AnimatedNumber } from '@/components/ui-pro';
import { boot } from '@/lib/perf/boot-tracer';
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
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
  Zap,
  RefreshCw,
  Wallet,
  Receipt,
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
import { useLiveDashboardMetrics, useFireReturns } from '@/hooks/use-firestore';
import { useTimelineEvents } from '@/hooks/useTimelineEvents';
import { useAIRecommendations } from '@/hooks/useAIRecommendations';
import { useWorkflowPipeline } from '@/hooks/useWorkflowPipeline';
import { useOracleDailyBriefing } from '@/hooks/useOracleDailyBriefing';
import { periodToLabel, getFilingDueDate } from '@/lib/gst-utils';
import type { TimelineEvent } from '@/lib/timeline/emit';

// ── Currency and string formatters ──────────────────────────────────────────
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

function cleanFirstName(name: string | undefined | null, email?: string | null): string {
  let raw = (name || '').trim();
  if (!raw && email) raw = email.split('@')[0];
  raw = raw.replace(/@.*$/, '').replace(/\d+$/, '').replace(/[._-]/g, ' ').trim();
  const first = raw.split(/\s+/)[0];
  if (!first || first.length < 2) return '';
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
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

function MiniSparkline({ trend = 'up' }: { trend?: 'up' | 'down' | 'flat' }) {
  const points = trend === 'up'
    ? '0,13 8,11 16,12 24,8 32,9 40,5 48,6 56,2'
    : trend === 'down'
    ? '0,2 8,6 16,5 24,9 32,8 40,12 48,11 56,14'
    : '0,8 8,8 16,8 24,8 32,8 40,8 48,8 56,8';
  return (
    <svg className="w-14 h-3.5 overflow-visible shrink-0 text-[#A1A1A1] opacity-40 group-hover:opacity-75 transition-opacity" viewBox="0 0 56 16">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function activityIconFor(type: string, source: string): { icon: LucideIcon; tone: string } {
  const t = type.toLowerCase();
  const s = source.toLowerCase();
  if (t.includes('oracle') || t.includes('brain')) return { icon: Sparkles, tone: 'text-[#A1A1A1]' };
  if (t.includes('zoho') || s.includes('zoho')) return { icon: BookOpen, tone: 'text-[#A1A1A1]' };
  if (t.includes('google') || s.includes('google') || t.includes('drive') || t.includes('gmail')) return { icon: Cloud, tone: 'text-[#A1A1A1]' };
  if (t.includes('bank') || s.includes('bank')) return { icon: Landmark, tone: 'text-[#A1A1A1]' };
  if (t.includes('payment') || t.includes('paid') || t.includes('collect')) return { icon: Wallet, tone: 'text-[#A1A1A1]' };
  if (t.includes('invoice') || t.includes('bill')) return { icon: FileText, tone: 'text-[#A1A1A1]' };
  if (t.includes('return') || t.includes('gst') || t.includes('filing')) return { icon: Receipt, tone: 'text-[#A1A1A1]' };
  if (t.includes('client') || t.includes('customer')) return { icon: Users, tone: 'text-[#A1A1A1]' };
  if (t.includes('reconcil')) return { icon: AlertTriangle, tone: 'text-amber-400' };
  if (t.includes('filed') || t.includes('completed') || t.includes('success')) return { icon: CheckCircle2, tone: 'text-[#EDEDED]' };
  return { icon: Activity, tone: 'text-[#888888]' };
}

interface ActionItem {
  id: string;
  icon: LucideIcon;
  tone: 'rose' | 'amber' | 'blue' | 'emerald';
  title: string;
  detail: string;
  view: AppView;
}

// ── Compact Metric Card ─────────────────────────────────────────────────────
function CompactMetricCard({
  label,
  value,
  subtitle,
  change,
  trend = 'flat',
  index,
}: {
  label: string;
  value: string;
  subtitle?: string;
  change?: { value: string; positive: boolean } | null;
  trend?: 'up' | 'down' | 'flat';
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: 'easeOut' as const }}
      className="rounded-[12px] border border-white/[0.08] bg-[#111111] p-4 sm:p-5 transition-colors hover:border-white/20 group flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
          <span className="text-xs text-[#A1A1A1] font-normal">{label}</span>
          <MiniSparkline trend={trend} />
        </div>
        <div className="text-xl sm:text-2xl font-mono font-medium text-[#EDEDED] tracking-tight">
          {value}
        </div>
      </div>
      <div className="mt-2 sm:mt-3 flex items-center justify-between text-[11px] text-[#666666]">
        {subtitle && <span className="truncate">{subtitle}</span>}
        {change && (
          <span className={`font-mono shrink-0 ml-auto ${change.positive ? 'text-emerald-400/90' : 'text-rose-400/90'}`}>
            {change.value}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ── Main Dashboard Component ────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const { setCurrentView } = useApp();
  const { user } = useAuth();

  // Real data hooks
  const { snapshot, loading: snapshotLoading, error: snapshotError, refresh: refreshSnapshot } = useBusinessSnapshot();
  const { metrics, loading: metricsLoading } = useLiveDashboardMetrics();
  const { data: returns } = useFireReturns();
  const { events: timelineEvents, loading: timelineLoading } = useTimelineEvents(15);
  const { recommendations: aiRecommendations, loading: aiRecsLoading } = useAIRecommendations();
  const { pipeline, loading: pipelineLoading, refresh: refreshPipeline } = useWorkflowPipeline();
  const { briefing, loading: briefingLoading, refresh: refreshBriefing } = useOracleDailyBriefing();

  // Active tab state in the right-side stream: 'tasks' vs 'activity'
  const [activeStreamTab, setActiveStreamTab] = useState<'tasks' | 'activity'>('tasks');

  // Loading safety timer
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const allLoading = snapshotLoading || metricsLoading || timelineLoading;

  useEffect(() => {
    boot.mark('dashboard data started');
    if (!allLoading) {
      boot.mark('dashboard data complete');
      boot.measure('interactive');
      const id = setTimeout(() => setLoadingTimedOut(false), 0);
      return () => clearTimeout(id);
    }
    const t = setTimeout(() => {
      setLoadingTimedOut(true);
      boot.mark('dashboard data complete (timeout)');
    }, 8_000);
    return () => clearTimeout(t);
  }, [allLoading]);

  // Derived metrics
  const pendingGst = snapshot.gst?.netLiability ?? 0;
  const todaysRevenue = snapshot.revenueThisMonth ?? 0;

  const revenueMom = useMemo(() => {
    const cur = snapshot.revenueThisMonth ?? 0;
    const prev = snapshot.revenueLastMonth ?? 0;
    if (prev === 0 && cur === 0) return { pct: 0, direction: 'flat' as const };
    if (prev === 0) return { pct: 100, direction: 'up' as const };
    const pct = Math.round(((cur - prev) / prev) * 100);
    if (Math.abs(pct) < 1) return { pct: 0, direction: 'flat' as const };
    return { pct: Math.abs(pct), direction: pct > 0 ? 'up' as const : 'down' as const };
  }, [snapshot.revenueThisMonth, snapshot.revenueLastMonth]);

  // Action Items
  const actionItems = useMemo<ActionItem[]>(() => {
    const items: ActionItem[] = [];

    // 1. Overdue GST returns
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
        detail: `${top.r.returnType} · ${periodToLabel(top.r.period)} · ${Math.abs(top.days)}d past due`,
        view: 'returns',
      });
    }

    // 2. Overdue Invoices
    if (snapshot.overdueInvoiceCount > 0) {
      items.push({
        id: 'overdue-invoices',
        icon: FileText,
        tone: 'rose',
        title: `${snapshot.overdueInvoiceCount} overdue invoice${snapshot.overdueInvoiceCount > 1 ? 's' : ''}`,
        detail: `${abbreviateINR(snapshot.overdueReceivables ?? 0)} past due · follow up`,
        view: 'invoices',
      });
    }

    // 3. Pending Collections
    const outstanding = snapshot.collections?.totalOutstanding ?? 0;
    if (outstanding > 0 && snapshot.overdueInvoiceCount === 0) {
      items.push({
        id: 'pending-collection',
        icon: Wallet,
        tone: 'amber',
        title: `${abbreviateINR(outstanding)} pending collection`,
        detail: 'Awaiting customer payment',
        view: 'invoices',
      });
    }

    // 4. Critical compliance issues
    if (metrics.criticalIssues > 0) {
      items.push({
        id: 'critical-issues',
        icon: AlertTriangle,
        tone: 'amber',
        title: `${metrics.criticalIssues} reconciliation issue${metrics.criticalIssues > 1 ? 's' : ''}`,
        detail: 'Review bank reconciliation before filing',
        view: 'reconcile',
      });
    }

    // 5. Pending GST liability
    if (pendingGst > 0) {
      items.push({
        id: 'gst-liability',
        icon: Receipt,
        tone: 'amber',
        title: `${abbreviateINR(pendingGst)} GST liability pending`,
        detail: 'Net tax payable after input credit',
        view: 'returns',
      });
    }

    return items;
  }, [returns, snapshot, metrics, pendingGst]);

  // Keyboard shortcut listener for quick actions (C, R, A)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setCurrentView('invoices');
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setCurrentView('returns');
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        setCurrentView('clients');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setCurrentView]);

  if (allLoading && !loadingTimedOut) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-10 space-y-6">
        <div className="space-y-2">
          <ProSkeleton className="h-8 w-60" />
          <ProSkeleton className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProSkeleton key={i} className="h-28 rounded-[12px]" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <ProSkeleton className="lg:col-span-7 h-72 rounded-[12px]" />
          <ProSkeleton className="lg:col-span-5 h-72 rounded-[12px]" />
        </div>
      </div>
    );
  }

  const firstName = cleanFirstName(user?.name, user?.email);
  const greetingText = firstName ? `${getGreeting()}, ${firstName}` : getGreeting();
  const todayStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date());

  const subtitleLine = actionItems.length > 0
    ? `${actionItems.length} item${actionItems.length === 1 ? '' : 's'} require attention`
    : 'Workspace active and up to date';

  const isAllZero = (snapshot.bankBalance === 0 || !snapshot.bankBalance) &&
    (todaysRevenue === 0 || !todaysRevenue) &&
    (pendingGst === 0) &&
    (snapshot.invoices?.count === 0 || !snapshot.invoices?.count);

  const onboardingSteps = [
    {
      title: 'Add business details',
      description: 'Set legal name, GSTIN, and registered address',
      completed: Boolean(user?.orgName || (user as Record<string, unknown>)?.businessName),
      action: () => setCurrentView('settings'),
    },
    {
      title: 'Connect bank account',
      description: 'Real-time cash balance and transaction sync',
      completed: (snapshot.bankBalance ?? 0) > 0,
      action: () => setCurrentView('banking'),
    },
    {
      title: 'Add first client',
      description: 'Client details and GSTIN for invoicing',
      completed: (snapshot.customers ?? 0) > 0,
      action: () => setCurrentView('clients'),
    },
    {
      title: 'Create first invoice',
      description: 'Issue GST-compliant tax invoices and track payment',
      completed: (snapshot.invoices?.count ?? 0) > 0,
      action: () => setCurrentView('invoices'),
    },
    {
      title: 'Connect Zoho or Google',
      description: 'Sync email invoices, drive attachments, and ledgers',
      completed: false,
      action: () => setCurrentView('zoho-books'),
    },
  ];

  const completedStepsCount = onboardingSteps.filter((s) => s.completed).length;

  // Real revenue vs expenses calculation
  const totalRevExp = snapshot.revenue + snapshot.expenses;
  const revPct = totalRevExp > 0 ? (snapshot.revenue / totalRevExp) * 100 : 0;
  const expPct = totalRevExp > 0 ? (snapshot.expenses / totalRevExp) * 100 : 0;

  return (
    <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8 space-y-6">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[#EDEDED]">
            {greetingText}
          </h1>
          <p className="text-xs text-[#A1A1A1] mt-0.5">
            {todayStr} · {subtitleLine}
          </p>
        </div>

        {/* Primary & secondary action cluster */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setCurrentView('invoices')}
            className="h-8 gap-2 bg-white text-black hover:bg-white/90 font-medium px-3.5 rounded-lg text-xs shadow-none cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5 text-black" strokeWidth={1.5} />
            <span>Create Invoice</span>
            <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono px-1 py-0.2 rounded bg-black/10 text-black/70">C</kbd>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView('returns')}
            className="h-8 gap-2 border border-white/[0.08] hover:border-white/20 bg-transparent text-[#A1A1A1] hover:text-[#EDEDED] hover:bg-white/[0.04] font-medium px-3.5 rounded-lg text-xs cursor-pointer"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-[#A1A1A1]" strokeWidth={1.5} />
            <span>File GST</span>
            <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono px-1 py-0.2 rounded bg-white/[0.06] text-[#A1A1A1]">R</kbd>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView('clients')}
            className="h-8 gap-2 border border-white/[0.08] hover:border-white/20 bg-transparent text-[#A1A1A1] hover:text-[#EDEDED] hover:bg-white/[0.04] font-medium px-3.5 rounded-lg text-xs cursor-pointer"
          >
            <Users className="h-3.5 w-3.5 text-[#A1A1A1]" strokeWidth={1.5} />
            <span>Add Client</span>
            <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono px-1 py-0.2 rounded bg-white/[0.06] text-[#A1A1A1]">A</kbd>
          </Button>
        </div>
      </motion.div>

      {/* ── METRIC CARDS / ONBOARDING ───────────────────────────────────── */}
      {isAllZero ? (
        <div className="rounded-[12px] border border-white/[0.08] bg-[#111111] p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#EDEDED] tracking-[-0.01em]">
                Get started with Veyro
              </h2>
              <p className="text-xs text-[#A1A1A1] mt-0.5">
                Complete these steps to set up your financial operating system.
              </p>
            </div>
            <span className="text-xs font-mono text-[#A1A1A1]">
              {completedStepsCount} of 5 completed
            </span>
          </div>

          <div className="h-1 w-full bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-500 rounded-full"
              style={{ width: `${(completedStepsCount / 5) * 100}%` }}
            />
          </div>

          <div className="divide-y divide-white/[0.06]">
            {onboardingSteps.map((step, idx) => (
              <button
                key={idx}
                type="button"
                onClick={step.action}
                className="w-full text-left py-3 flex items-center justify-between gap-4 group hover:bg-white/[0.02] px-2 -mx-2 rounded-lg transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] transition-colors ${
                    step.completed
                      ? 'bg-white text-black font-semibold'
                      : 'border border-white/20 text-[#666666] group-hover:border-white/40'
                  }`}>
                    {step.completed ? <CheckCircle2 className="h-3.5 w-3.5 stroke-[2.5]" /> : (idx + 1)}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-medium truncate ${
                      step.completed ? 'text-[#888888] line-through' : 'text-[#EDEDED] group-hover:text-white'
                    }`}>
                      {step.title}
                    </p>
                    <p className="text-[11px] text-[#666666] truncate mt-0.5">
                      {step.description}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-[#666666] group-hover:text-[#EDEDED] group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <CompactMetricCard
            index={0}
            label="Cash position"
            value={abbreviateINR(snapshot.bankBalance)}
            subtitle="Bank balance"
            change={
              snapshot.netCashFlow !== 0
                ? {
                    value: `${snapshot.netCashFlow > 0 ? '+' : ''}${abbreviateINR(snapshot.netCashFlow)} net`,
                    positive: snapshot.netCashFlow > 0,
                  }
                : null
            }
            trend="up"
          />

          <CompactMetricCard
            index={1}
            label="Revenue this month"
            value={abbreviateINR(todaysRevenue)}
            subtitle={todaysRevenue > 0 ? `FY ${abbreviateINR(snapshot.revenue)}` : 'No sales yet'}
            change={
              revenueMom.direction !== 'flat'
                ? {
                    value: `${revenueMom.direction === 'up' ? '+' : '-'}${revenueMom.pct}% vs last mo.`,
                    positive: revenueMom.direction === 'up',
                  }
                : null
            }
            trend={revenueMom.direction}
          />

          <CompactMetricCard
            index={2}
            label="Pending GST"
            value={abbreviateINR(pendingGst)}
            subtitle={pendingGst > 0 ? 'Net liability due' : 'All offset by ITC'}
            trend={pendingGst > 0 ? 'down' : 'flat'}
          />

          <CompactMetricCard
            index={3}
            label="Outstanding invoices"
            value={abbreviateINR(snapshot.collections?.totalOutstanding ?? snapshot.overdueReceivables ?? 0)}
            subtitle={
              snapshot.overdueInvoiceCount > 0
                ? `${snapshot.overdueInvoiceCount} overdue`
                : `${snapshot.invoices.count} issued`
            }
            trend="flat"
          />
        </div>
      )}

      {/* ── CORE OPERATIONS: 2-COLUMN COMMAND CENTER ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (7 cols): Financial Vitals & Workflow Overview */}
        <div className="lg:col-span-7 space-y-6">
          {/* Financial Vitals Card */}
          <div className="rounded-[12px] border border-white/[0.08] bg-[#111111] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-[#A1A1A1]" />
                <h2 className="text-xs font-medium text-[#EDEDED]">Financial Vitals</h2>
              </div>
              <button
                type="button"
                onClick={() => setCurrentView('reports')}
                className="text-[11px] text-[#A1A1A1] hover:text-[#EDEDED] flex items-center gap-1 transition-colors cursor-pointer"
              >
                View reports
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            {/* 4-cell metric grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => setCurrentView('invoices')}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-left hover:border-white/20 transition-all cursor-pointer active:scale-[0.98]"
              >
                <span className="text-[11px] text-[#A1A1A1] block">Total Revenue</span>
                <span className="text-base font-mono font-medium text-[#EDEDED] mt-1 block">
                  {abbreviateINR(snapshot.revenue)}
                </span>
                <span className="text-[10px] text-[#666666] mt-0.5 block">FY to date</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentView('expenses')}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-left hover:border-white/20 transition-all cursor-pointer active:scale-[0.98]"
              >
                <span className="text-[11px] text-[#A1A1A1] block">Total Expenses</span>
                <span className="text-base font-mono font-medium text-[#EDEDED] mt-1 block">
                  {abbreviateINR(snapshot.expenses)}
                </span>
                <span className="text-[10px] text-[#666666] mt-0.5 block">Operating costs</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentView('reports')}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-left hover:border-white/20 transition-all cursor-pointer active:scale-[0.98]"
              >
                <span className="text-[11px] text-[#A1A1A1] block">Net Profit</span>
                <span className="text-base font-mono font-medium text-[#EDEDED] mt-1 block">
                  {abbreviateINR(snapshot.profit)}
                </span>
                <span className="text-[10px] text-[#666666] mt-0.5 block">
                  {snapshot.profitMargin > 0 ? `${(snapshot.profitMargin * 100).toFixed(0)}% margin` : 'Net balance'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentView('clients')}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-left hover:border-white/20 transition-all cursor-pointer active:scale-[0.98]"
              >
                <span className="text-[11px] text-[#A1A1A1] block">Active Clients</span>
                <span className="text-base font-mono font-medium text-[#EDEDED] mt-1 block">
                  {snapshot.customers}
                </span>
                <span className="text-[10px] text-[#666666] mt-0.5 block">In registry</span>
              </button>
            </div>

            {/* Clean Revenue vs Expenses ratio bar */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="text-[#A1A1A1]">Revenue: {abbreviateINR(snapshot.revenue)}</span>
                <span className="text-[#A1A1A1]">Expenses: {abbreviateINR(snapshot.expenses)}</span>
              </div>
              <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden flex">
                <div style={{ width: `${revPct}%` }} className="bg-white/80 h-full" />
                <div style={{ width: `${expPct}%` }} className="bg-white/20 h-full" />
              </div>
            </div>
          </div>

          {/* Streamlined Live Workflow Card */}
          <div className="rounded-[12px] border border-white/[0.08] bg-[#111111] p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#A1A1A1]" />
                <h2 className="text-xs font-medium text-[#EDEDED]">Operations Pipeline</h2>
              </div>
              <span className="text-[11px] text-[#666666] font-mono">
                {pipeline.invoicesUnpaid} pending payment
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setCurrentView('invoices')}
                className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all text-left cursor-pointer active:scale-[0.98]"
              >
                <span className="text-[11px] text-[#666666] block">1. Invoicing</span>
                <span className="text-sm font-mono font-medium text-[#EDEDED] mt-0.5 block">
                  {pipeline.invoicesUnpaid} unpaid
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentView('banking')}
                className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all text-left cursor-pointer active:scale-[0.98]"
              >
                <span className="text-[11px] text-[#666666] block">2. Banking</span>
                <span className="text-sm font-mono font-medium text-[#EDEDED] mt-0.5 block">
                  {pipeline.bankCreditsUnreconciled} credits
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentView('gst-reconciliation')}
                className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all text-left cursor-pointer active:scale-[0.98]"
              >
                <span className="text-[11px] text-[#666666] block">3. Matching</span>
                <span className="text-sm font-mono font-medium text-[#EDEDED] mt-0.5 block">
                  {pipeline.gstr2bUnmatched} 2B items
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentView('returns')}
                className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all text-left cursor-pointer active:scale-[0.98]"
              >
                <span className="text-[11px] text-[#666666] block">4. GST Returns</span>
                <span className="text-sm font-mono font-medium text-[#EDEDED] mt-0.5 block">
                  {pipeline.returnsPrepared} ready
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (5 cols): Activity & Action Items Stream */}
        <div className="lg:col-span-5 rounded-[12px] border border-white/[0.08] bg-[#111111] p-5 flex flex-col min-h-[380px]">
          {/* Stream Header & Tab Switcher */}
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-3">
            <div className="flex items-center gap-1.5 bg-white/[0.04] p-0.5 rounded-lg border border-white/[0.06]">
              <button
                type="button"
                onClick={() => setActiveStreamTab('tasks')}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  activeStreamTab === 'tasks'
                    ? 'bg-white/10 text-[#EDEDED] font-medium'
                    : 'text-[#A1A1A1] hover:text-[#EDEDED]'
                }`}
              >
                Tasks ({actionItems.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveStreamTab('activity')}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  activeStreamTab === 'activity'
                    ? 'bg-white/10 text-[#EDEDED] font-medium'
                    : 'text-[#A1A1A1] hover:text-[#EDEDED]'
                }`}
              >
                Activity
              </button>
            </div>

            {activeStreamTab === 'activity' && (
              <button
                type="button"
                onClick={() => setCurrentView('timeline')}
                className="text-[11px] text-[#A1A1A1] hover:text-[#EDEDED] flex items-center gap-1 transition-colors cursor-pointer"
              >
                Full timeline
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Stream Content */}
          <div className="flex-1 flex flex-col">
            {activeStreamTab === 'tasks' ? (
              actionItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12 flex-1">
                  <div className="flex items-center justify-center h-9 w-9 rounded-full bg-white/[0.04] border border-white/[0.08] mb-2.5">
                    <CheckCircle2 className="h-4 w-4 text-[#EDEDED]" />
                  </div>
                  <h3 className="text-xs font-medium text-[#EDEDED]">All tasks complete</h3>
                  <p className="text-[11px] text-[#666666] mt-1 max-w-xs leading-relaxed">
                    No urgent actions pending. New tasks appear automatically when returns or invoices require attention.
                  </p>
                </div>
              ) : (
                <ScrollArea className="max-h-[380px] -mx-1 px-1">
                  <div className="space-y-2">
                    {actionItems.map((item, idx) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.id}
                          onClick={() => setCurrentView(item.view)}
                          className="group flex items-start gap-3 p-3 rounded-lg border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.1] transition-all cursor-pointer active:scale-[0.98]"
                        >
                          <div className="flex items-center justify-center h-7 w-7 rounded-md border border-white/[0.08] bg-white/[0.04] text-[#EDEDED] shrink-0 mt-0.5">
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-[#EDEDED] leading-snug">{item.title}</p>
                            <p className="text-[11px] text-[#666666] mt-0.5 truncate">{item.detail}</p>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-[#666666] group-hover:text-[#EDEDED] group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )
            ) : (
              timelineEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12 flex-1">
                  <Activity className="h-6 w-6 text-[#666666] mb-2" />
                  <h3 className="text-xs font-medium text-[#EDEDED]">No recent activity</h3>
                  <p className="text-[11px] text-[#666666] mt-1 max-w-xs leading-relaxed">
                    Actions you take will be logged chronologically here.
                  </p>
                </div>
              ) : (
                <ScrollArea className="max-h-[380px] -mx-1 px-1">
                  <ul className="space-y-2">
                    {timelineEvents.slice(0, 8).map((ev: TimelineEvent) => {
                      const { icon: Icon } = activityIconFor(ev.type, ev.source);
                      return (
                        <li key={ev.id} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                          <div className="flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] shrink-0 mt-0.5">
                            <Icon className="h-3 w-3 text-[#A1A1A1]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="text-xs font-medium text-[#EDEDED] truncate">{ev.title}</p>
                              <span className="text-[10px] text-[#666666] shrink-0 font-mono">
                                {ev.createdAt ? timeAgo(ev.createdAt) : ''}
                              </span>
                            </div>
                            {ev.description && (
                              <p className="text-[11px] text-[#666666] truncate mt-0.5">{ev.description}</p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </ScrollArea>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
