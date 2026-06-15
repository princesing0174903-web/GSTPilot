'use client';

import React, { useState, useMemo, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  GitCompareArrows,
  XCircle,
  Search,
  FileWarning,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Loader2,
  X,
  Users,
  IndianRupee,
  TrendingUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import type { AppView } from '@/contexts/AppContext';
import {
  useDashboardMetrics,
  useClients,
  useFilings,
  useIssues,
  useUploadedFiles,
  useActivities,
  useUpdateFilingStatus,
} from '@/hooks/api';
import { formatCurrency, periodToLabel, isOverdue, getFilingDueDate } from '@/lib/gst-utils';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Client, GSTRFiling, Issue } from '@/types/gst';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface MetricCard {
  id: string;
  label: string;
  value: number;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  subtitle: string;
}

interface PriorityItem {
  id: string;
  clientName: string;
  clientInitials: string;
  clientId: string;
  returnType: string;
  period: string;
  dueDate: string;
  daysRemaining: number;
  urgency: 'overdue' | 'due-soon' | 'upcoming';
  reason: string;
  actionLabel: string;
  actionView: string;
}

interface ReadyToFileItem {
  id: string;
  clientId: string;
  clientName: string;
  clientInitials: string;
  returnType: string;
  invoiceCount: number;
  taxAmount: number;
  period: string;
}

interface BlockingIssue {
  id: string;
  clientId: string;
  clientName: string;
  clientInitials: string;
  category: 'gstin_error' | 'missing_invoice' | 'recon_mismatch' | 'validation_failure';
  title: string;
  detail: string;
  invoiceRef?: string;
  amount?: number;
  actionLabel: string;
  actionView: string;
}

interface RecentUpload {
  id: string;
  filename: string;
  uploadTime: string;
  status: 'processing' | 'extracted' | 'failed';
  clientName: string;
  rowCount?: number;
  invoiceCount?: number;
  accuracy?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS & STATIC DATA
// ═══════════════════════════════════════════════════════════════════════════════

const CURRENT_PERIOD = '2025-06';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getDaysRemaining(dueDateStr: string): number {
  const dueDate = new Date(dueDateStr);
  const today = new Date('2025-07-08');
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
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const issueCategoryConfig: Record<BlockingIssue['category'], { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  gstin_error: {
    label: 'GSTIN Error',
    icon: <XCircle className="h-3.5 w-3.5" />,
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
  },
  missing_invoice: {
    label: 'Missing Invoice',
    icon: <FileWarning className="h-3.5 w-3.5" />,
    color: 'text-orange-700',
    bg: 'bg-orange-50 border-orange-200',
  },
  recon_mismatch: {
    label: 'Recon Mismatch',
    icon: <GitCompareArrows className="h-3.5 w-3.5" />,
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
  },
  validation_failure: {
    label: 'Validation Failure',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    color: 'text-purple-700',
    bg: 'bg-purple-50 border-purple-200',
  },
};

const uploadStatusConfig: Record<RecentUpload['status'], { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  processing: { label: 'Processing', icon: <Clock className="h-3.5 w-3.5" />, color: 'text-amber-600', bg: 'bg-amber-50' },
  extracted: { label: 'Extracted', icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  failed: { label: 'Failed', icon: <AlertTriangle className="h-3.5 w-3.5" />, color: 'text-red-600', bg: 'bg-red-50' },
};

// Map Issue category to BlockingIssue category
function mapIssueCategory(issue: Issue): BlockingIssue['category'] {
  const cat = issue.category?.toLowerCase() ?? '';
  if (cat.includes('gstin')) return 'gstin_error';
  if (cat.includes('missing') || cat.includes('invoice')) return 'missing_invoice';
  if (cat.includes('recon') || cat.includes('mismatch')) return 'recon_mismatch';
  return 'validation_failure';
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const { setCurrentView, setSelectedClientId, setReturnPrepCtx } = useApp();

  // ── React Query hooks ────────────────────────────────────────────────────
  const { data: dashData, isLoading: dashLoading } = useDashboardMetrics();
  const { data: clientsData, isLoading: clientsLoading } = useClients();
  const { data: filingsData, isLoading: filingsLoading } = useFilings();
  const { data: issuesData, isLoading: issuesLoading } = useIssues();
  const { data: uploadsData, isLoading: uploadsLoading } = useUploadedFiles();
  const { data: activitiesData } = useActivities();

  const fileReturnMutation = useUpdateFilingStatus();

  // ── Track which filing IDs have been toasted ─────────────────────────────
  const toastedFilingIds = useRef<Set<string>>(new Set());

  // ── Derived data ─────────────────────────────────────────────────────────
  const isLoading = dashLoading || filingsLoading;

  const clients = clientsData?.clients ?? [];
  const clientMap = useMemo(() => {
    const map = new Map<string, Client & { _aggregations?: { totalInvoices: number; filedReturns: number; pendingReturns: number; matchPercentage: number } }>();
    for (const c of clients) {
      map.set(c.id, c);
    }
    return map;
  }, [clients]);

  const filings = filingsData?.filings ?? [];
  const issues = issuesData?.issues ?? [];

  const currentPeriodLabel = periodToLabel(CURRENT_PERIOD);

  // ── Metrics from dashboard API ───────────────────────────────────────────
  const metrics: MetricCard[] = useMemo(() => {
    const readyCount = filings.filter(f => f.status === 'reviewed' || f.status === 'generated').length;
    const criticalCount = dashData?.criticalIssues ?? 0;
    const pendingCount = dashData?.pendingReturns ?? 0;
    const filedCount = dashData?.filedReturns ?? 0;
    const totalReturns = filedCount + pendingCount;

    return [
      {
        id: 'ready',
        label: 'Ready to File',
        value: readyCount,
        icon: <ShieldCheck className="h-4 w-4" />,
        iconColor: 'text-emerald-600',
        iconBg: 'bg-emerald-50',
        subtitle: 'Validated & approved',
      },
      {
        id: 'critical',
        label: 'Critical Issues',
        value: criticalCount,
        icon: <AlertOctagon className="h-4 w-4" />,
        iconColor: 'text-red-600',
        iconBg: 'bg-red-50',
        subtitle: `Blocking ${Math.min(criticalCount, pendingCount)} filings`,
      },
      {
        id: 'pending',
        label: 'Pending Returns',
        value: pendingCount,
        icon: <Clock className="h-4 w-4" />,
        iconColor: 'text-amber-600',
        iconBg: 'bg-amber-50',
        subtitle: 'Due this month',
      },
      {
        id: 'filed',
        label: 'Filed This Month',
        value: filedCount,
        icon: <CheckCircle2 className="h-4 w-4" />,
        iconColor: 'text-emerald-600',
        iconBg: 'bg-emerald-50',
        subtitle: `of ${totalReturns} total`,
      },
    ];
  }, [dashData, filings]);

  // ── Additional summary metrics ───────────────────────────────────────────
  const totalTaxVolume = useMemo(() => {
    return filings.reduce((sum, f) => sum + f.totalTax, 0);
  }, [filings]);

  const avgCompliance = dashData?.averageHealthScore ?? 0;

  // ── Priorities: unfiled filings sorted by urgency ────────────────────────
  const priorities: PriorityItem[] = useMemo(() => {
    const unfiled = filings
      .filter(f => f.status !== 'filed')
      .sort((a, b) => {
        const aOverdue = isOverdue(a.period) ? 0 : 1;
        const bOverdue = isOverdue(b.period) ? 0 : 1;
        return aOverdue - bOverdue || a.period.localeCompare(b.period);
      });

    return unfiled.slice(0, 5).map((f) => {
      const client = clientMap.get(f.clientId);
      const name = client?.tradeName ?? f.client?.tradeName ?? 'Unknown';
      const dueDateStr = getFilingDueDate(f.returnType, f.period);
      const days = getDaysRemaining(dueDateStr);

      let urgency: PriorityItem['urgency'] = 'upcoming';
      if (days < 0) urgency = 'overdue';
      else if (days <= 5) urgency = 'due-soon';

      return {
        id: f.id,
        clientName: name,
        clientInitials: getInitials(name),
        clientId: f.clientId,
        returnType: f.returnType,
        period: f.period,
        dueDate: dueDateStr,
        daysRemaining: days,
        urgency,
        reason: urgency === 'overdue'
          ? `${f.returnType} overdue — late fee accruing`
          : urgency === 'due-soon'
          ? `${f.returnType} due in ${days} days`
          : `${f.totalInvoices} invoices pending`,
        actionLabel: urgency === 'overdue' ? 'File Now' : urgency === 'due-soon' ? 'File Return' : 'Prepare',
        actionView: 'returns',
      };
    });
  }, [filings, clientMap]);

  // ── Ready to File: filings in reviewed/generated status ──────────────────
  const readyToFile: ReadyToFileItem[] = useMemo(() => {
    return filings
      .filter(f => f.status === 'reviewed' || f.status === 'generated')
      .slice(0, 5)
      .map((f) => {
        const client = clientMap.get(f.clientId);
        const name = client?.tradeName ?? f.client?.tradeName ?? 'Unknown';
        return {
          id: f.id,
          clientId: f.clientId,
          clientName: name,
          clientInitials: getInitials(name),
          returnType: f.returnType,
          invoiceCount: f.totalInvoices,
          taxAmount: f.totalTax,
          period: f.period,
        };
      });
  }, [filings, clientMap]);

  // ── Blocking Issues from API ─────────────────────────────────────────────
  const blockingIssues: BlockingIssue[] = useMemo(() => {
    return issues
      .filter(i => i.severity === 'critical' && i.status === 'open')
      .slice(0, 10)
      .map((issue) => {
        const client = clientMap.get(issue.clientId ?? '');
        const name = client?.tradeName ?? issue.client?.tradeName ?? 'Unknown';
        const category = mapIssueCategory(issue);

        let actionLabel = 'Review Issue';
        let actionView = 'returns';

        if (category === 'recon_mismatch') {
          actionLabel = 'Run Reconciliation';
          actionView = 'reconcile';
        } else if (category === 'missing_invoice') {
          actionLabel = 'Upload Missing Document';
          actionView = 'invoices';
        } else if (category === 'gstin_error') {
          actionLabel = 'Review Issue';
          actionView = 'reconcile';
        }

        return {
          id: issue.id,
          clientId: issue.clientId ?? '',
          clientName: name,
          clientInitials: getInitials(name),
          category,
          title: issue.title,
          detail: issue.description ?? '',
          invoiceRef: issue.invoiceId,
          actionLabel,
          actionView,
        };
      });
  }, [issues, clientMap]);

  // ── Recent Uploads from API ──────────────────────────────────────────────
  const recentUploads: RecentUpload[] = useMemo(() => {
    const docs = uploadsData?.documents ?? [];
    return docs.slice(0, 4).map((doc: Record<string, unknown>) => ({
      id: (doc.id as string) ?? '',
      filename: (doc.filename as string) ?? (doc.name as string) ?? 'Upload',
      uploadTime: doc.createdAt ? new Date(doc.createdAt as string).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '',
      status: ((doc.status as string) === 'completed' ? 'extracted' : (doc.status as string) === 'failed' ? 'failed' : 'processing') as RecentUpload['status'],
      clientName: (doc.clientName as string) ?? 'Unknown',
      rowCount: doc.rowCount as number | undefined,
      invoiceCount: doc.invoiceCount as number | undefined,
      accuracy: doc.accuracy as number | undefined,
    }));
  }, [uploadsData]);

  // ── AI Recommendations derived from issues ──────────────────────────────
  const aiRecommendations = useMemo(() => {
    const recs: Array<{
      id: string;
      title: string;
      description: string;
      icon: React.ReactNode;
      iconBg: string;
      iconColor: string;
      actionLabel: string;
      actionView: string;
      urgency: 'high' | 'medium' | 'info';
      clientName?: string;
    }> = [];

    // Generate recommendations from open issues
    const openIssues = issues.filter(i => i.status === 'open');
    const seenCategories = new Set<string>();

    for (const issue of openIssues.slice(0, 6)) {
      const client = clientMap.get(issue.clientId ?? '');
      const cat = mapIssueCategory(issue);
      const key = `${issue.clientId}-${cat}`;
      if (seenCategories.has(key)) continue;
      seenCategories.add(key);

      const config = issueCategoryConfig[cat];
      let actionView: string = 'returns';
      let actionLabel = 'Review';

      if (cat === 'recon_mismatch') {
        actionView = 'reconcile';
        actionLabel = 'Run Reconciliation';
      } else if (cat === 'missing_invoice') {
        actionView = 'invoices';
        actionLabel = 'Upload Document';
      } else if (cat === 'gstin_error') {
        actionView = 'reconcile';
        actionLabel = 'Fix GSTIN';
      }

      recs.push({
        id: issue.id,
        title: issue.title,
        description: issue.description ?? `Issue detected for ${client?.tradeName ?? 'client'}`,
        icon: config.icon,
        iconBg: config.bg,
        iconColor: config.color,
        actionLabel,
        actionView,
        urgency: issue.severity === 'critical' ? 'high' : issue.severity === 'warning' ? 'medium' : 'info',
        clientName: client?.tradeName,
      });
    }

    // If no issues, add filing recommendations from pending filings
    if (recs.length === 0) {
      const pendingFilings = filings.filter(f => f.status !== 'filed').slice(0, 3);
      for (const f of pendingFilings) {
        const client = clientMap.get(f.clientId);
        const overdue = isOverdue(f.period);
        recs.push({
          id: `rec-${f.id}`,
          title: overdue ? `${f.returnType} Overdue for ${client?.tradeName ?? 'Client'}` : `${f.returnType} Due Soon`,
          description: overdue
            ? `${f.returnType} for period ${periodToLabel(f.period)} is overdue. Late fees may apply.`
            : `${f.returnType} for period ${periodToLabel(f.period)} needs to be filed.`,
          icon: <CalendarClock className="h-4 w-4" />,
          iconBg: 'bg-emerald-50',
          iconColor: 'text-emerald-600',
          actionLabel: 'File Return',
          actionView: 'returns',
          urgency: overdue ? 'high' : 'medium',
          clientName: client?.tradeName,
        });
      }
    }

    return recs;
  }, [issues, filings, clientMap]);

  // ── Recent Activities from audit logs ────────────────────────────────────
  const recentActivities = activitiesData?.logs ?? [];

  // ── Filing in-progress tracking (local state) ───────────────────────────
  const [filingInProgressIds, setFilingInProgressIds] = useState<Set<string>>(new Set());
  const [filedReturnIds, setFiledReturnIds] = useState<Set<string>>(new Set());

  // ── Helpers ───────────────────────────────────────────────────────────────
  const handleOpenClient = (clientId: string) => {
    const resolvedId = clientMap.has(clientId) ? clientId : (clients[0]?.id ?? clientId);
    setSelectedClientId(resolvedId);
    setCurrentView('client-workspace');
  };

  const handleFileReturn = (clientId: string, returnType: string, period: string) => {
    const resolvedId = clientMap.has(clientId) ? clientId : (clients[0]?.id ?? clientId);
    setSelectedClientId(resolvedId);
    setReturnPrepCtx({
      clientId: resolvedId,
      returnType: (returnType === 'GSTR-3B' ? 'GSTR-3B' : 'GSTR-1') as 'GSTR-1' | 'GSTR-3B',
      period,
    });
    setCurrentView('return-prep');
  };

  const handleQuickFile = (filingId: string, clientName: string, returnType: string) => {
    if (filingInProgressIds.has(filingId) || filedReturnIds.has(filingId)) return;

    setFilingInProgressIds(prev => new Set(prev).add(filingId));

    fileReturnMutation.mutate(
      { id: filingId, status: 'filed' },
      {
        onSuccess: () => {
          setFilingInProgressIds(prev => {
            const next = new Set(prev);
            next.delete(filingId);
            return next;
          });
          setFiledReturnIds(prev => new Set(prev).add(filingId));
          const arn = `AA${String(new Date().getDate()).padStart(2, '0')}${String(new Date().getMonth() + 1).padStart(2, '0')}25${String(Date.now() % 999999).padStart(6, '0')}`;
          toast.success(`${returnType} Filed Successfully`, {
            description: `${clientName} — ARN: ${arn}`,
          });
        },
        onError: (err) => {
          setFilingInProgressIds(prev => {
            const next = new Set(prev);
            next.delete(filingId);
            return next;
          });
          toast.error('Filing Failed', {
            description: err.message,
          });
        },
      }
    );
  };

  // ── Animation ─────────────────────────────────────────────────────────────
  const stagger = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Hero empty state when no clients exist (fresh start) ─────────────────
  if (clients.length === 0 && !isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        <EmptyState
          icon={Sparkles}
          title="Welcome to GSTPilot"
          description="No GST documents uploaded yet. Start by adding a client or uploading your first document."
          action={{
            label: 'Upload Documents',
            onClick: () => setCurrentView('invoices'),
            icon: Upload,
          }}
          secondaryAction={{
            label: 'Add Client',
            onClick: () => setCurrentView('clients'),
            icon: Users,
            variant: 'outline',
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-8">

      {/* ═══════════════════════════════════════════════════════════════════════
          HEADER
          ═══════════════════════════════════════════════════════════════════════ */}
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
          <Badge variant="outline" className="text-xs font-medium px-3 py-1.5 gap-1.5 text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            {currentPeriodLabel}
          </Badge>
          <Button
            size="sm"
            onClick={() => setCurrentView('invoices')}
            className="h-8 gap-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </Button>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SUMMARY STRIP — Tax Volume + Avg Compliance
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.35 }}
        className="grid grid-cols-2 gap-3"
      >
        <div className="border border-border/60 rounded-xl p-4 hover:border-border transition-colors cursor-default group">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-50 transition-transform group-hover:scale-105">
              <IndianRupee className="h-4 w-4 text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Tax Volume
            </span>
          </div>
          <div className="text-2xl font-bold text-foreground leading-none">
            {isLoading ? <Skeleton className="h-7 w-24 inline-block" /> : formatCurrency(totalTaxVolume)}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Across all filings
          </p>
        </div>
        <div className="border border-border/60 rounded-xl p-4 hover:border-border transition-colors cursor-default group">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-50 transition-transform group-hover:scale-105">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Avg Compliance
            </span>
          </div>
          <div className="text-2xl font-bold text-foreground leading-none">
            {isLoading ? <Skeleton className="h-7 w-8 inline-block" /> : avgCompliance}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Health score average
          </p>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TOP ROW — 4 METRICS
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <motion.div key={i} variants={fadeUp}>
                <div className="border border-border/60 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-7 w-8" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </motion.div>
            ))
          : metrics.map((metric) => (
              <motion.div
                key={metric.id}
                variants={fadeUp}
                whileHover={{ y: -2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <div className="border border-border/60 rounded-xl p-4 hover:border-border transition-colors cursor-default group">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className={`flex items-center justify-center h-8 w-8 rounded-lg ${metric.iconBg} transition-transform group-hover:scale-105`}>
                      <span className={metric.iconColor}>{metric.icon}</span>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {metric.label}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-foreground leading-none">
                    {metric.value}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {metric.subtitle}
                  </p>
                </div>
              </motion.div>
            ))
        }
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1: TODAY'S PRIORITIES
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.45, ease: 'easeOut' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Today&apos;s Priorities
          </h2>
          <Badge variant="outline" className="text-[11px] font-medium text-muted-foreground">
            {priorities.filter(p => p.urgency === 'overdue').length} overdue
          </Badge>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border border-border/40 rounded-lg p-3.5 flex gap-3">
                <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-7 w-20 rounded-md" />
              </div>
            ))}
          </div>
        ) : priorities.length === 0 ? (
          <div className="border border-border/60 rounded-xl p-8 flex flex-col items-center justify-center text-center">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-50 mb-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-foreground">All caught up!</p>
            <p className="text-xs text-muted-foreground mt-1">No pending filings require attention</p>
          </div>
        ) : (
          <div className="border border-border/60 rounded-xl divide-y divide-border/40 overflow-hidden">
            <AnimatePresence>
              {priorities.map((priority, index) => (
                <motion.div
                  key={priority.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + index * 0.05, duration: 0.35 }}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors group"
                >
                  {/* Urgency indicator */}
                  <div className={`h-8 w-1 rounded-full shrink-0 ${
                    priority.urgency === 'overdue' ? 'bg-red-500'
                    : priority.urgency === 'due-soon' ? 'bg-amber-500'
                    : 'bg-slate-300'
                  }`} />

                  {/* Client avatar */}
                  <button
                    onClick={() => handleOpenClient(priority.clientId)}
                    className={`flex items-center justify-center h-8 w-8 rounded-lg text-xs font-bold shrink-0 transition-colors ${
                      priority.urgency === 'overdue'
                        ? 'bg-red-50 text-red-700 hover:bg-red-100'
                        : priority.urgency === 'due-soon'
                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {priority.clientInitials}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenClient(priority.clientId)}
                        className="text-sm font-medium text-foreground hover:text-emerald-600 transition-colors"
                      >
                        {priority.clientName}
                      </button>
                      <span className="text-xs text-muted-foreground">
                        {priority.returnType} · {periodToLabel(priority.period)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {priority.reason}
                    </p>
                  </div>

                  {/* Days remaining */}
                  <span className={`text-xs font-medium shrink-0 ${
                    priority.urgency === 'overdue' ? 'text-red-600'
                    : priority.urgency === 'due-soon' ? 'text-amber-600'
                    : 'text-muted-foreground'
                  }`}>
                    {formatDaysRemaining(priority.daysRemaining)}
                  </span>

                  {/* Action button */}
                  <Button
                    size="sm"
                    className={`h-7 text-xs font-medium px-3 shrink-0 ${
                      priority.urgency === 'overdue'
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : priority.urgency === 'due-soon'
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                    onClick={() => {
                      if (priority.actionView === 'returns') {
                        handleFileReturn(priority.clientId, priority.returnType, priority.period);
                      } else {
                        setCurrentView(priority.actionView as AppView);
                      }
                    }}
                  >
                    {priority.actionLabel}
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════════════════
          TWO-COLUMN: READY TO FILE + ISSUES BLOCKING
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* SECTION 2: READY TO FILE QUEUE */}
        <motion.section
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25, duration: 0.45, ease: 'easeOut' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Ready to File
            </h2>
            <Badge variant="outline" className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border-emerald-200">
              {readyToFile.length} returns
            </Badge>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border border-border/40 rounded-lg p-3.5 flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-7 w-16 rounded-md" />
                </div>
              ))}
            </div>
          ) : readyToFile.length === 0 ? (
            <div className="border border-border/60 rounded-xl p-8 flex flex-col items-center justify-center text-center">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-slate-50 mb-3">
                <FileCheck2 className="h-5 w-5 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-foreground">No returns ready to file</p>
              <p className="text-xs text-muted-foreground mt-1">
                Filings will appear here once validated
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                onClick={() => setCurrentView('returns')}
              >
                View All Returns
              </Button>
            </div>
          ) : (
            <div className="border border-border/60 rounded-xl divide-y divide-border/40 overflow-hidden">
              <AnimatePresence>
                {readyToFile.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.05, duration: 0.35 }}
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-emerald-50/30 transition-colors group"
                  >
                    {/* Client avatar */}
                    <button
                      onClick={() => handleOpenClient(item.clientId)}
                      className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold shrink-0 hover:bg-emerald-100 transition-colors"
                    >
                      {item.clientInitials}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenClient(item.clientId)}
                          className="text-sm font-medium text-foreground hover:text-emerald-600 transition-colors"
                        >
                          {item.clientName}
                        </button>
                        <span className="text-xs text-muted-foreground">
                          {item.returnType} · {periodToLabel(item.period)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.invoiceCount} invoices · {formatCurrency(item.taxAmount)} tax
                      </p>
                    </div>

                    {/* File button */}
                    {filedReturnIds.has(item.id) ? (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-2 py-0.5 gap-1 shrink-0">
                        <CheckCircle2 className="size-2.5" /> Filed
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        className={`h-7 text-xs font-medium px-3 shrink-0 ${filingInProgressIds.has(item.id) ? 'bg-amber-500 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                        disabled={filingInProgressIds.has(item.id)}
                        onClick={() => handleQuickFile(item.id, item.clientName, item.returnType)}
                      >
                        {filingInProgressIds.has(item.id) ? (
                          <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Filing...</>
                        ) : (
                          'File Return'
                        )}
                      </Button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* View All */}
          <div className="mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-8 gap-1"
              onClick={() => setCurrentView('returns')}
            >
              View All Returns
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </motion.section>

        {/* SECTION 3: ISSUES BLOCKING FILING */}
        <motion.section
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.45, ease: 'easeOut' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Issues Blocking Filing
            </h2>
            <Badge variant="outline" className="text-[11px] font-medium text-red-700 bg-red-50 border-red-200">
              {blockingIssues.length} issues
            </Badge>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border border-border/40 rounded-lg p-3.5 flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-7 w-20 rounded-md" />
                </div>
              ))}
            </div>
          ) : blockingIssues.length === 0 ? (
            <div className="border border-border/60 rounded-xl p-8 flex flex-col items-center justify-center text-center">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-50 mb-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <p className="text-sm font-medium text-foreground">No blocking issues</p>
              <p className="text-xs text-muted-foreground mt-1">All filings are clear of critical errors</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[420px]">
              <div className="border border-border/60 rounded-xl divide-y divide-border/40 overflow-hidden">
                <AnimatePresence>
                  {blockingIssues.map((issue, index) => {
                    const catConfig = issueCategoryConfig[issue.category];
                    return (
                      <motion.div
                        key={issue.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 + index * 0.05, duration: 0.35 }}
                        className="px-4 py-3.5 hover:bg-red-50/20 transition-colors group"
                      >
                        <div className="flex items-start gap-3">
                          {/* Client avatar */}
                          <button
                            onClick={() => handleOpenClient(issue.clientId)}
                            className="flex items-center justify-center h-8 w-8 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold shrink-0 hover:bg-slate-200 transition-colors mt-0.5"
                          >
                            {issue.clientInitials}
                          </button>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <button
                                onClick={() => handleOpenClient(issue.clientId)}
                                className="text-sm font-medium text-foreground hover:text-emerald-600 transition-colors"
                              >
                                {issue.clientName}
                              </button>
                              <Badge variant="outline" className={`text-[10px] font-medium px-1.5 py-0 h-4 border ${catConfig.bg} ${catConfig.color}`}>
                                {catConfig.label}
                              </Badge>
                            </div>
                            <p className="text-xs font-medium text-foreground/80 leading-snug">
                              {issue.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                              {issue.detail}
                            </p>
                          </div>

                          {/* Action button */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs font-medium px-3 shrink-0 border-border/60 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                            onClick={() => setCurrentView(issue.actionView as AppView)}
                          >
                            {issue.actionLabel}
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </motion.section>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 4: RECENT UPLOADS
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.45, ease: 'easeOut' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Recent Uploads
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-7 gap-1"
            onClick={() => setCurrentView('invoices')}
          >
            View All
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border border-border/40 rounded-lg p-4 space-y-2.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-6 w-16 rounded-md" />
              </div>
            ))}
          </div>
        ) : recentUploads.length === 0 ? (
          <div className="border border-border/60 rounded-xl p-8 flex flex-col items-center justify-center text-center">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-slate-50 mb-3">
              <Upload className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-foreground">No uploads yet</p>
            <p className="text-xs text-muted-foreground mt-1">Upload invoices to get started</p>
            <Button
              size="sm"
              className="mt-3 gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setCurrentView('invoices')}
            >
              <Upload className="h-3.5 w-3.5" />
              Upload Documents
            </Button>
          </div>
        ) : (
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          >
            {recentUploads.map((upload) => {
              const statusConfig = uploadStatusConfig[upload.status];
              return (
                <motion.div
                  key={upload.id}
                  variants={fadeUp}
                  whileHover={{ y: -2 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <div className="border border-border/60 rounded-xl p-4 hover:border-border transition-colors cursor-pointer group"
                    onClick={() => setCurrentView('invoices')}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`flex items-center justify-center h-8 w-8 rounded-lg shrink-0 ${statusConfig.bg}`}>
                        <span className={statusConfig.color}>{statusConfig.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate" title={upload.filename}>
                          {upload.filename}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {upload.clientName} · {upload.uploadTime}
                        </p>
                      </div>
                    </div>

                    {/* Extraction metadata */}
                    {upload.status === 'extracted' && (
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-3">
                        {upload.rowCount && <span>{upload.rowCount} rows</span>}
                        {upload.invoiceCount && <span>{upload.invoiceCount} invoices</span>}
                        {upload.accuracy && <span className="text-emerald-600 font-medium">{upload.accuracy}% accuracy</span>}
                      </div>
                    )}

                    {upload.status === 'processing' && (
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-amber-500 rounded-full"
                            initial={{ width: '0%' }}
                            animate={{ width: '72%' }}
                            transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
                          />
                        </div>
                        <span className="text-[11px] text-amber-600 font-medium">72%</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold px-2 py-0 h-5 border ${statusConfig.bg} ${statusConfig.color}`}
                      >
                        {statusConfig.label}
                      </Badge>
                      {upload.status === 'failed' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[11px] font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-2"
                          onClick={(e) => { e.stopPropagation(); setCurrentView('invoices'); }}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      ) : upload.status === 'extracted' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[11px] font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2"
                          onClick={(e) => { e.stopPropagation(); setCurrentView('returns'); }}
                        >
                          File Return
                          <ArrowRight className="h-3 w-3 ml-0.5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 5: AI RECOMMENDATIONS
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.45, ease: 'easeOut' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            AI Recommendations
          </h2>
          <Badge variant="outline" className="text-[11px] font-medium text-muted-foreground">
            {aiRecommendations.filter(r => r.urgency === 'high').length} urgent
          </Badge>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border border-border/40 rounded-lg p-4 flex gap-3">
                <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : aiRecommendations.length === 0 ? (
          <div className="border border-border/60 rounded-xl p-8 flex flex-col items-center justify-center text-center">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-50 mb-3">
              <Sparkles className="h-5 w-5 text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-foreground">No recommendations</p>
            <p className="text-xs text-muted-foreground mt-1">
              AI insights will appear as you add clients and process filings
            </p>
            <Button
              size="sm"
              className="mt-3 gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setCurrentView('clients')}
            >
              <Users className="h-3.5 w-3.5" />
              Add Your First Client
            </Button>
          </div>
        ) : (
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {aiRecommendations.map((rec) => (
              <motion.div
                key={rec.id}
                variants={fadeUp}
                whileHover={{ y: -2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="border border-border/60 rounded-xl p-4 hover:border-border transition-colors cursor-pointer group"
                onClick={() => setCurrentView(rec.actionView as AppView)}
              >
                <div className="flex gap-3">
                  <div className={`flex items-center justify-center h-8 w-8 rounded-lg shrink-0 ${rec.iconBg} transition-transform group-hover:scale-105`}>
                    <span className={rec.iconColor}>{rec.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground leading-snug">
                        {rec.title}
                      </p>
                      {rec.urgency === 'high' && (
                        <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded shrink-0">
                          URGENT
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                      {rec.description}
                    </p>
                    <button
                      className="mt-2.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 group-hover:gap-1.5 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentView(rec.actionView as AppView);
                      }}
                    >
                      {rec.actionLabel}
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 6: RECENT ACTIVITY
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.45, ease: 'easeOut' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Recent Activity
          </h2>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border border-border/40 rounded-lg p-3.5 flex gap-3">
                <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : recentActivities.length === 0 ? (
          <div className="border border-border/60 rounded-xl p-8 flex flex-col items-center justify-center text-center">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-slate-50 mb-3">
              <ClipboardCheck className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-foreground">No activity yet</p>
            <p className="text-xs text-muted-foreground mt-1">Actions will appear here as you work</p>
          </div>
        ) : (
          <div className="border border-border/60 rounded-xl divide-y divide-border/40 overflow-hidden">
            {recentActivities.slice(0, 5).map((activity, index) => (
              <div key={activity.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-slate-50 text-slate-500 shrink-0">
                  <ClipboardCheck className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {activity.action}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {activity.details ?? activity.entity ?? ''} · {activity.client?.tradeName ?? ''}
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {new Date(activity.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.section>

    </div>
  );
}
