'use client';

import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  FileCheck2,
  CalendarClock,
  Sparkles,
  FileText,
  ShieldCheck,
  AlertOctagon,
  ClipboardCheck,
  Users,
  IndianRupee,
  TrendingUp,
  Plus,
  ArrowRight,
  Loader2,
  Rocket,
  Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import {
  useLiveDashboardMetrics,
  useFireClients,
  useFireReturns,
  useFireRecentActivities,
} from '@/hooks/use-firestore';
import type {
  FirestoreClient,
  FirestoreReturn,
  LiveDashboardMetrics,
} from '@/lib/firestore-schema';
import { fileReturn } from '@/lib/firestore-service';
import { formatCurrency, periodToLabel, isOverdue, getFilingDueDate } from '@/lib/gst-utils';
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

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatINR(amount: number): string {
  return amount.toLocaleString('en-IN');
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

// ═══════════════════════════════════════════════════════════════════════════════
// METRIC CARD
// ═══════════════════════════════════════════════════════════════════════════════

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  subtitle: string;
  index: number;
}

function MetricCard({ label, value, icon, iconColor, iconBg, subtitle, index }: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
    >
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {label}
              </p>
              <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
              <p className="text-[11px] text-muted-foreground">{subtitle}</p>
            </div>
            <div className={`flex items-center justify-center h-9 w-9 rounded-lg ${iconBg}`}>
              <span className={iconColor}>{icon}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY ICON
// ═══════════════════════════════════════════════════════════════════════════════

function activityIcon(type: string): { icon: React.ReactNode; color: string; bg: string } {
  if (type.includes('filed')) return { icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: 'text-emerald-600', bg: 'bg-emerald-50' };
  if (type.includes('upload') || type.includes('document')) return { icon: <Upload className="h-3.5 w-3.5" />, color: 'text-blue-600', bg: 'bg-blue-50' };
  if (type.includes('review')) return { icon: <ClipboardCheck className="h-3.5 w-3.5" />, color: 'text-violet-600', bg: 'bg-violet-50' };
  if (type.includes('client')) return { icon: <Users className="h-3.5 w-3.5" />, color: 'text-sky-600', bg: 'bg-sky-50' };
  if (type.includes('reconcil') || type.includes('mismatch')) return { icon: <AlertTriangle className="h-3.5 w-3.5" />, color: 'text-amber-600', bg: 'bg-amber-50' };
  if (type.includes('invoice') || type.includes('extract')) return { icon: <FileText className="h-3.5 w-3.5" />, color: 'text-teal-600', bg: 'bg-teal-50' };
  return { icon: <Activity className="h-3.5 w-3.5" />, color: 'text-slate-500', bg: 'bg-slate-50' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING SKELETON
// ═══════════════════════════════════════════════════════════════════════════════

function DashboardSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <Skeleton className="lg:col-span-2 h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY STATE — Fresh onboarding
// ═══════════════════════════════════════════════════════════════════════════════

function WelcomeEmptyState({ onAddClient, onUploadDoc }: { onAddClient: () => void; onUploadDoc: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center text-center py-20 px-4"
    >
      <div className="relative mb-6">
        <div className="flex items-center justify-center h-20 w-20 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200">
          <Rocket className="h-10 w-10 text-emerald-600" />
        </div>
        <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
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
          className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Add Client
        </Button>
        <Button variant="outline" onClick={onUploadDoc} className="gap-1.5">
          <Upload className="h-4 w-4" />
          Upload Document
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-6 mt-10 text-center max-w-sm">
        {[
          { icon: <Users className="h-5 w-5" />, label: 'Add Clients' },
          { icon: <FileText className="h-5 w-5" />, label: 'Upload Docs' },
          { icon: <CheckCircle2 className="h-5 w-5" />, label: 'File Returns' },
        ].map((step, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-slate-100 text-slate-500">
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

export default function DashboardPage() {
  const { setCurrentView, setSelectedClientId, setReturnPrepCtx } = useApp();

  // ── Firebase Firestore hooks ──────────────────────────────────────────
  const { metrics, loading, error } = useLiveDashboardMetrics();
  const { data: clients } = useFireClients();
  const { data: returns } = useFireReturns();
  const { data: recentActivities } = useFireRecentActivities(10);

  // ── Filing state ──────────────────────────────────────────────────────
  const [filingInProgress, setFilingInProgress] = useState<Set<string>>(new Set());

  // ── Client lookup map ─────────────────────────────────────────────────
  const clientMap = useMemo(() => {
    const map = new Map<string, FirestoreClient & { id: string }>();
    for (const c of clients) map.set(c.clientId, c);
    return map;
  }, [clients]);

  // ── Metric cards from LiveDashboardMetrics ────────────────────────────
  const metricCards = useMemo(() => {
    const complianceScore = metrics.averageHealthScore > 0
      ? Math.round(metrics.averageHealthScore)
      : metrics.totalClients > 0 ? 0 : 100;

    return [
      {
        label: 'Active Clients',
        value: metrics.activeClients,
        icon: <Users className="h-4 w-4" />,
        iconColor: 'text-sky-600',
        iconBg: 'bg-sky-50',
        subtitle: `of ${metrics.totalClients} total`,
      },
      {
        label: 'Ready to File',
        value: metrics.readyToFile,
        icon: <ShieldCheck className="h-4 w-4" />,
        iconColor: 'text-emerald-600',
        iconBg: 'bg-emerald-50',
        subtitle: 'Validated & reviewed',
      },
      {
        label: 'Critical Issues',
        value: metrics.criticalIssues,
        icon: <AlertOctagon className="h-4 w-4" />,
        iconColor: 'text-red-600',
        iconBg: 'bg-red-50',
        subtitle: `+ ${metrics.warnings} warnings`,
      },
      {
        label: 'Tax Volume',
        value: formatCurrency(metrics.totalTaxVolume),
        icon: <IndianRupee className="h-4 w-4" />,
        iconColor: 'text-emerald-600',
        iconBg: 'bg-emerald-50',
        subtitle: `${formatINR(metrics.totalInvoices)} invoices`,
      },
      {
        label: 'Filed Returns',
        value: metrics.filedReturns,
        icon: <FileCheck2 className="h-4 w-4" />,
        iconColor: 'text-teal-600',
        iconBg: 'bg-teal-50',
        subtitle: `${metrics.pendingReturns} pending`,
      },
      {
        label: 'Compliance',
        value: `${complianceScore}%`,
        icon: <TrendingUp className="h-4 w-4" />,
        iconColor: complianceScore >= 80 ? 'text-emerald-600' : complianceScore >= 50 ? 'text-amber-600' : 'text-red-600',
        iconBg: complianceScore >= 80 ? 'bg-emerald-50' : complianceScore >= 50 ? 'bg-amber-50' : 'bg-red-50',
        subtitle: 'Avg health score',
      },
    ];
  }, [metrics]);

  // ── Ready-to-file returns ─────────────────────────────────────────────
  const readyReturns = useMemo(() => {
    return returns
      .filter(r => ['validated', 'reviewed', 'generated'].includes(r.status))
      .slice(0, 5);
  }, [returns]);

  // ── Upcoming filings (unfiled, sorted by urgency) ────────────────────
  const upcomingFilings = useMemo(() => {
    return returns
      .filter(r => r.status !== 'filed')
      .sort((a, b) => {
        const aOverdue = isOverdue(a.period) ? 0 : 1;
        const bOverdue = isOverdue(b.period) ? 0 : 1;
        return aOverdue - bOverdue || a.period.localeCompare(b.period);
      })
      .slice(0, 5);
  }, [returns]);

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
    setFilingInProgress(prev => new Set(prev).add(returnId));
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
      setFilingInProgress(prev => {
        const next = new Set(prev);
        next.delete(returnId);
        return next;
      });
    }
  };

  // ── Animations ────────────────────────────────────────────────────────
  const stagger = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const fadeUp = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Loading ───────────────────────────────────────────────────────────
  if (loading) return <DashboardSkeleton />;

  // ── Error ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <h3 className="font-semibold text-red-800">Failed to load dashboard</h3>
            <p className="text-sm text-red-600 mt-1">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
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
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        <WelcomeEmptyState
          onAddClient={() => setCurrentView('clients')}
          onUploadDoc={() => setCurrentView('invoices')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-8">

      {/* ═══ HEADER ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Command Center
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            What needs your attention today
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentView('clients')}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Client
          </Button>
          <Button
            size="sm"
            onClick={() => setCurrentView('invoices')}
            className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </Button>
        </div>
      </motion.div>

      {/* ═══ METRIC CARDS ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metricCards.map((m, i) => (
          <MetricCard key={m.label} {...m} index={i} />
        ))}
      </div>

      {/* ═══ MAIN CONTENT GRID ═══ */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* ── Left: Ready to File + Upcoming ──────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Ready to File */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Ready to File
                    {metrics.readyToFile > 0 && (
                      <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700">
                        {metrics.readyToFile}
                      </Badge>
                    )}
                  </CardTitle>
                  {returns.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 gap-1"
                      onClick={() => setCurrentView('returns')}
                    >
                      View all <ChevronRight className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {readyReturns.length === 0 ? (
                  <div className="py-6 text-center">
                    <FileCheck2 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      No returns ready for filing yet
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      className="text-xs text-emerald-600 mt-1"
                      onClick={() => setCurrentView('returns')}
                    >
                      Go to Returns →
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {readyReturns.map((r) => {
                      const client = clientMap.get(r.clientId);
                      const name = client?.tradeName ?? 'Unknown';
                      return (
                        <div
                          key={r.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold shrink-0">
                              {getInitials(name)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {name}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {r.returnType} · {periodToLabel(r.period)} · {r.totalInvoices} invoices
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                            >
                              {r.status}
                            </Badge>
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 gap-1"
                              onClick={() => handleQuickFile(r.id, name, r.returnType)}
                              disabled={filingInProgress.has(r.id)}
                            >
                              {filingInProgress.has(r.id) ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <FileCheck2 className="h-3 w-3" />
                              )}
                              File
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Upcoming Filing Deadlines */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-amber-600" />
                  Upcoming Deadlines
                  {metrics.overdueReturns > 0 && (
                    <Badge variant="secondary" className="text-[10px] bg-red-50 text-red-700">
                      {metrics.overdueReturns} overdue
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingFilings.length === 0 ? (
                  <div className="py-6 text-center">
                    <CheckCircle2 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">All returns filed — you&apos;re all caught up!</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-64">
                    <div className="space-y-2">
                      {upcomingFilings.map((r) => {
                        const client = clientMap.get(r.clientId);
                        const name = client?.tradeName ?? 'Unknown';
                        const dueDateStr = getFilingDueDate(r.returnType, r.period);
                        const days = getDaysRemaining(dueDateStr);
                        const overdue = days < 0;
                        const dueSoon = days >= 0 && days <= 5;

                        return (
                          <div
                            key={r.id}
                            className={`flex items-center justify-between p-3 rounded-lg border ${
                              overdue ? 'border-red-200 bg-red-50/50' : dueSoon ? 'border-amber-200 bg-amber-50/50' : 'border-slate-100 bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-semibold shrink-0 ${
                                overdue ? 'bg-red-100 text-red-700' : dueSoon ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {getInitials(name)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{name}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {r.returnType} · {periodToLabel(r.period)} · {r.status}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-xs font-medium ${
                                overdue ? 'text-red-600' : dueSoon ? 'text-amber-600' : 'text-muted-foreground'
                              }`}>
                                {formatDaysRemaining(days)}
                              </span>
                              <Button
                                variant={overdue ? 'default' : 'outline'}
                                size="sm"
                                className={`h-7 text-xs gap-1 ${
                                  overdue ? 'bg-red-600 hover:bg-red-700' : ''
                                }`}
                                onClick={() => handleFileReturn(r.clientId, r.returnType, r.period)}
                              >
                                <ArrowRight className="h-3 w-3" />
                                {overdue ? 'File Now' : 'Prepare'}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* ── Right Sidebar: Activity + Quick Actions ─────────────────── */}
        <div className="space-y-6">

          {/* Recent Activity */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-violet-600" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentActivities.length === 0 ? (
                  <div className="py-6 text-center">
                    <Activity className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">No activity yet</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-72">
                    <div className="space-y-3">
                      {recentActivities.map((a) => {
                        const { icon, color, bg } = activityIcon(a.type);
                        return (
                          <div key={a.id} className="flex items-start gap-2.5">
                            <div className={`flex items-center justify-center h-7 w-7 rounded-full shrink-0 mt-0.5 ${bg}`}>
                              <span className={color}>{icon}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-foreground leading-tight">
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
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Actions */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Add Client', icon: <Plus className="h-4 w-4" />, view: 'clients' as const, color: 'text-sky-600 bg-sky-50 hover:bg-sky-100' },
                    { label: 'Upload Doc', icon: <Upload className="h-4 w-4" />, view: 'invoices' as const, color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' },
                    { label: 'File Return', icon: <FileCheck2 className="h-4 w-4" />, view: 'returns' as const, color: 'text-violet-600 bg-violet-50 hover:bg-violet-100' },
                    { label: 'Reconcile', icon: <ClipboardCheck className="h-4 w-4" />, view: 'reconcile' as const, color: 'text-amber-600 bg-amber-50 hover:bg-amber-100' },
                  ].map((action) => (
                    <button
                      key={action.label}
                      onClick={() => setCurrentView(action.view)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg transition-colors ${action.color}`}
                    >
                      {action.icon}
                      <span className="text-[11px] font-medium">{action.label}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Summary Stats */}
          {metrics.documentsProcessed > 0 && (
            <motion.div variants={fadeUp} initial="hidden" animate="visible">
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Documents Processed</span>
                      <span className="font-semibold">{metrics.documentsProcessed}</span>
                    </div>
                    {metrics.extractionsPending > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Extractions Pending</span>
                        <Badge variant="secondary" className="text-[10px] bg-amber-50 text-amber-700">
                          {metrics.extractionsPending}
                        </Badge>
                      </div>
                    )}
                    {metrics.matchPercentage < 100 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Match Rate</span>
                        <span className="font-semibold">{metrics.matchPercentage}%</span>
                      </div>
                    )}
                    {metrics.riskPercentage > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Risk Rate</span>
                        <span className={`font-semibold ${metrics.riskPercentage > 20 ? 'text-red-600' : 'text-amber-600'}`}>
                          {metrics.riskPercentage}%
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Overdue Returns</span>
                      <span className={`font-semibold ${metrics.overdueReturns > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {metrics.overdueReturns}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
