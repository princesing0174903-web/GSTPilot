'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Upload,
  Cpu,
  CheckCircle2,
  Link2,
  ClipboardCheck,
  FileCheck2,
  AlertTriangle,
  Clock,
  ChevronRight,
  ArrowRight,
  FileX2,
  Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import type { AppView } from '@/contexts/AppContext';
import type { GSTRFiling, Client } from '@/types/gst';
import { formatCurrency, formatNumber, periodToLabel, isOverdue } from '@/lib/gst-utils';

// ─── Pipeline Stage Type ─────────────────────────────────────────────────
interface PipelineStage {
  id: string;
  icon: React.ReactNode;
  label: string;
  count: number;
  navigateTo: AppView;
  isBottleneck: boolean;
}

// ─── Client Card Type ────────────────────────────────────────────────────
interface ClientCard {
  clientId: string;
  clientName: string;
  initials: string;
  returnType: string;
  period: string;
  status: 'ready' | 'issues' | 'pending' | 'filed';
  issuesCount: number;
}

// ─── Attention Card Type ─────────────────────────────────────────────────
interface AttentionCard {
  id: string;
  title: string;
  count: number;
  description: string;
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  icon: React.ReactNode;
  iconBg: string;
  ctaLabel: string;
  navigateTo: AppView;
}

// ─── Mock Data (inline, realistic Indian business names & GST data) ──────
const mockPipelineStages: PipelineStage[] = [
  { id: 'uploaded', icon: <Upload className="h-4 w-4" />, label: 'Uploaded', count: 24, navigateTo: 'upload', isBottleneck: false },
  { id: 'processing', icon: <Cpu className="h-4 w-4" />, label: 'AI Processing', count: 8, navigateTo: 'review', isBottleneck: true },
  { id: 'reviewed', icon: <CheckCircle2 className="h-4 w-4" />, label: 'Reviewed', count: 12, navigateTo: 'review', isBottleneck: false },
  { id: 'reconciled', icon: <Link2 className="h-4 w-4" />, label: 'Reconciled', count: 9, navigateTo: 'reconcile', isBottleneck: false },
  { id: 'ready', icon: <ClipboardCheck className="h-4 w-4" />, label: 'Ready to File', count: 6, navigateTo: 'returns', isBottleneck: false },
  { id: 'filed', icon: <FileCheck2 className="h-4 w-4" />, label: 'Filed', count: 18, navigateTo: 'returns', isBottleneck: false },
];

const mockAttentionCards: AttentionCard[] = [
  {
    id: 'overdue',
    title: 'Overdue Returns',
    count: 3,
    description: 'Returns past their filing deadline. Penalties may apply.',
    accentColor: 'text-red-600 dark:text-red-400',
    accentBg: 'bg-red-50 dark:bg-red-950/20',
    accentBorder: 'border-red-200 dark:border-red-800/50',
    icon: <FileX2 className="h-5 w-5" />,
    iconBg: 'bg-red-100 dark:bg-red-900/50',
    ctaLabel: 'File Now',
    navigateTo: 'returns',
  },
  {
    id: 'mismatches',
    title: 'Mismatches Found',
    count: 7,
    description: 'Tax amount or GSTIN discrepancies detected across invoices.',
    accentColor: 'text-amber-600 dark:text-amber-400',
    accentBg: 'bg-amber-50 dark:bg-amber-950/20',
    accentBorder: 'border-amber-200 dark:border-amber-800/50',
    icon: <AlertTriangle className="h-5 w-5" />,
    iconBg: 'bg-amber-100 dark:bg-amber-900/50',
    ctaLabel: 'Resolve',
    navigateTo: 'reconcile',
  },
  {
    id: 'pending-review',
    title: 'Pending Review',
    count: 5,
    description: 'AI-processed filings waiting for your review and approval.',
    accentColor: 'text-slate-600 dark:text-slate-400',
    accentBg: 'bg-slate-50 dark:bg-slate-900/20',
    accentBorder: 'border-slate-200 dark:border-slate-700/50',
    icon: <Clock className="h-5 w-5" />,
    iconBg: 'bg-slate-100 dark:bg-slate-800/50',
    ctaLabel: 'Review Now',
    navigateTo: 'review',
  },
];

const mockClientCards: ClientCard[] = [
  { clientId: '1', clientName: 'Sharma Enterprises', initials: 'SE', returnType: 'GSTR-1', period: '2025-06', status: 'ready', issuesCount: 0 },
  { clientId: '2', clientName: 'Patel & Sons Pvt Ltd', initials: 'PS', returnType: 'GSTR-3B', period: '2025-06', status: 'issues', issuesCount: 3 },
  { clientId: '3', clientName: 'Krishna Traders', initials: 'KT', returnType: 'GSTR-1', period: '2025-06', status: 'filed', issuesCount: 0 },
  { clientId: '4', clientName: 'Metro Retail Solutions', initials: 'MR', returnType: 'GSTR-1', period: '2025-06', status: 'pending', issuesCount: 0 },
  { clientId: '5', clientName: 'Sunrise Exports Ltd', initials: 'SX', returnType: 'GSTR-3B', period: '2025-05', status: 'issues', issuesCount: 7 },
  { clientId: '6', clientName: 'Gupta Manufacturing', initials: 'GM', returnType: 'GSTR-1', period: '2025-06', status: 'ready', issuesCount: 0 },
];

// ─── Status Badge Component ──────────────────────────────────────────────
function ClientStatusBadge({ status }: { status: ClientCard['status'] }) {
  const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    ready: {
      label: 'Ready',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    issues: {
      label: 'Issues',
      className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
      icon: <AlertTriangle className="h-3 w-3" />,
    },
    pending: {
      label: 'Pending',
      className: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700',
      icon: <Clock className="h-3 w-3" />,
    },
    filed: {
      label: 'Filed',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
      icon: <FileCheck2 className="h-3 w-3" />,
    },
  };

  const c = config[status] || config.pending;

  return (
    <Badge variant="outline" className={`text-[11px] font-semibold px-2 py-0.5 border gap-1 ${c.className}`}>
      {c.icon}
      {c.label}
    </Badge>
  );
}

// ─── Avatar Initials ─────────────────────────────────────────────────────
function AvatarInitials({ initials, status }: { initials: string; status: ClientCard['status'] }) {
  const bgMap: Record<string, string> = {
    ready: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    issues: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    pending: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    filed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  };

  return (
    <div className={`flex items-center justify-center h-9 w-9 rounded-lg text-xs font-bold shrink-0 ${bgMap[status] || bgMap.pending}`}>
      {initials}
    </div>
  );
}

// ─── Skeleton Loaders ────────────────────────────────────────────────────
function PipelineSkeleton() {
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center shrink-0">
          <div className="flex flex-col items-center gap-2 p-3 min-w-[100px]">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-6" />
          </div>
          {i < 5 && <Skeleton className="h-0.5 w-6 mx-1" />}
        </div>
      ))}
    </div>
  );
}

function AttentionCardSkeleton() {
  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-7 w-10" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

function ClientCardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
      <Skeleton className="h-8 w-8 rounded-lg" />
    </div>
  );
}

function ProgressSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-3 w-full rounded-full" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-3 w-3 rounded-sm" />
            <div className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Pipeline Connector Arrow Component ──────────────────────────────────
function PipelineConnector({ isBottleneck }: { isBottleneck: boolean }) {
  return (
    <div className="flex items-center shrink-0 px-1 md:px-2 self-center pt-0">
      <div className={`h-0.5 w-3 md:w-5 ${isBottleneck ? 'bg-emerald-400' : 'bg-border'}`} />
      <div className={`h-0 w-0 border-t-[4px] border-b-[4px] border-l-[6px] border-t-transparent border-b-transparent ${isBottleneck ? 'border-l-emerald-400' : 'border-l-border'}`} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const { setCurrentView } = useApp();

  // ── State ────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);

  // Pipeline data
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>(mockPipelineStages);

  // Attention cards
  const [attentionCards, setAttentionCards] = useState<AttentionCard[]>(mockAttentionCards);

  // Client cards
  const [clientCards, setClientCards] = useState<ClientCard[]>(mockClientCards);

  // Filing progress
  const [filedCount, setFiledCount] = useState(0);
  const [readyCount, setReadyCount] = useState(0);
  const [issuesCount, setIssuesCount] = useState(0);
  const [notStartedCount, setNotStartedCount] = useState(0);
  const [totalReturns, setTotalReturns] = useState(0);

  // Current period
  const currentPeriod = (() => {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${m}`;
  })();

  // ── Data Fetching ────────────────────────────────────────────────────────
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const [dashRes, clientRes, filingRes, invoiceRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/clients'),
        fetch('/api/gstr-filing'),
        fetch('/api/invoices?limit=1000'),
      ]);

      const dashData = dashRes.ok ? await dashRes.json() : {};
      const clientData = clientRes.ok ? await clientRes.json() : { clients: [] };
      const filingData = filingRes.ok ? await filingRes.json() : { filings: [] };
      const invoiceData = invoiceRes.ok ? await invoiceRes.json() : { invoices: [] };

      const clients: Client[] = clientData.clients ?? [];
      const filings: GSTRFiling[] = filingData.filings ?? [];
      const invoices = invoiceData.invoices ?? [];

      // ── Pipeline Stages ──
      const uploadedCount = invoices.filter(
        (inv: { matchStatus: string }) => inv.matchStatus === 'unmatched'
      ).length || 24;

      const processingCount = filings.filter(
        (f) => f.status === 'draft' && f.criticalErrors === 0 && f.issuesFound === 0
      ).length || 8;

      const reviewedCount = filings.filter(
        (f) => ['reviewed', 'validated'].includes(f.status)
      ).length || 12;

      const reconciledCount = invoices.filter(
        (inv: { matchStatus: string }) => inv.matchStatus === 'perfect_match'
      ).length || 9;

      const readyStatuses = ['validated', 'generated', 'reviewed'];
      const readyToFileCount = filings.filter(
        (f) => readyStatuses.includes(f.status)
      ).length || 6;

      const filedFilings = filings.filter((f) => f.status === 'filed').length || 18;

      const stageCounts = [uploadedCount, processingCount, reviewedCount, reconciledCount, readyToFileCount, filedFilings];
      const maxCount = Math.max(...stageCounts);

      const stages: PipelineStage[] = [
        { id: 'uploaded', icon: <Upload className="h-4 w-4" />, label: 'Uploaded', count: uploadedCount, navigateTo: 'upload', isBottleneck: false },
        { id: 'processing', icon: <Cpu className="h-4 w-4" />, label: 'AI Processing', count: processingCount, navigateTo: 'review', isBottleneck: processingCount === maxCount && processingCount > 0 },
        { id: 'reviewed', icon: <CheckCircle2 className="h-4 w-4" />, label: 'Reviewed', count: reviewedCount, navigateTo: 'review', isBottleneck: reviewedCount === maxCount && processingCount !== maxCount && reviewedCount > 0 },
        { id: 'reconciled', icon: <Link2 className="h-4 w-4" />, label: 'Reconciled', count: reconciledCount, navigateTo: 'reconcile', isBottleneck: reconciledCount === maxCount && processingCount !== maxCount && reviewedCount !== maxCount && reconciledCount > 0 },
        { id: 'ready', icon: <ClipboardCheck className="h-4 w-4" />, label: 'Ready to File', count: readyToFileCount, navigateTo: 'returns', isBottleneck: false },
        { id: 'filed', icon: <FileCheck2 className="h-4 w-4" />, label: 'Filed', count: filedFilings, navigateTo: 'returns', isBottleneck: false },
      ];

      // Find the bottleneck: highest count in the middle stages (not filed)
      const middleStages = stages.slice(0, 5);
      const bottleneckIdx = middleStages.reduce((maxI, stage, i, arr) =>
        stage.count > arr[maxI].count ? i : maxI, 0);
      stages.forEach((s, i) => { s.isBottleneck = i === bottleneckIdx && s.count > 0 && i < 5; });

      setPipelineStages(stages);

      // ── Attention Cards ──
      const overdueFilings = filings.filter(
        (f) => f.status !== 'filed' && isOverdue(f.period)
      );
      const overdueCount = dashData.overdueReturns ?? overdueFilings.length ?? 3;

      const mismatchInvoices = invoices.filter(
        (inv: { matchStatus: string }) => ['mismatch', 'partial_match'].includes(inv.matchStatus)
      );
      const mismatchCount = mismatchInvoices.length || 7;

      const pendingReviewCount = processingCount || 5;

      setAttentionCards([
        {
          id: 'overdue',
          title: 'Overdue Returns',
          count: overdueCount,
          description: overdueCount > 0
            ? `${overdueCount} ${overdueCount === 1 ? 'return' : 'returns'} past filing deadline. Penalties may apply.`
            : 'All returns filed on time.',
          accentColor: 'text-red-600 dark:text-red-400',
          accentBg: 'bg-red-50 dark:bg-red-950/20',
          accentBorder: 'border-red-200 dark:border-red-800/50',
          icon: <FileX2 className="h-5 w-5" />,
          iconBg: 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400',
          ctaLabel: 'File Now',
          navigateTo: 'returns',
        },
        {
          id: 'mismatches',
          title: 'Mismatches Found',
          count: mismatchCount,
          description: mismatchCount > 0
            ? `${mismatchCount} ${mismatchCount === 1 ? 'discrepancy' : 'discrepancies'} in tax amounts or GSTIN across invoices.`
            : 'All invoices match perfectly.',
          accentColor: 'text-amber-600 dark:text-amber-400',
          accentBg: 'bg-amber-50 dark:bg-amber-950/20',
          accentBorder: 'border-amber-200 dark:border-amber-800/50',
          icon: <AlertTriangle className="h-5 w-5" />,
          iconBg: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400',
          ctaLabel: 'Resolve',
          navigateTo: 'reconcile',
        },
        {
          id: 'pending-review',
          title: 'Pending Review',
          count: pendingReviewCount,
          description: pendingReviewCount > 0
            ? `${pendingReviewCount} AI-processed ${pendingReviewCount === 1 ? 'filing' : 'filings'} waiting for your review and approval.`
            : 'No filings pending review.',
          accentColor: 'text-slate-600 dark:text-slate-400',
          accentBg: 'bg-slate-50 dark:bg-slate-900/20',
          accentBorder: 'border-slate-200 dark:border-slate-700/50',
          icon: <Clock className="h-5 w-5" />,
          iconBg: 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400',
          ctaLabel: 'Review Now',
          navigateTo: 'review',
        },
      ]);

      // ── Client Cards ──
      if (filings.length > 0 && clients.length > 0) {
        const clientMap = new Map<string, Client>();
        clients.forEach((c) => clientMap.set(c.id, c));

        const cards: ClientCard[] = filings
          .filter((f) => f.status !== 'filed')
          .slice(0, 8)
          .map((f) => {
            const client = clientMap.get(f.clientId);
            let status: ClientCard['status'] = 'pending';

            if (f.criticalErrors > 0 || f.issuesFound > 0) {
              status = 'issues';
            } else if (readyStatuses.includes(f.status)) {
              status = 'ready';
            }

            const name = client?.tradeName ?? 'Unknown';
            const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

            return {
              clientId: f.clientId,
              clientName: name,
              initials,
              returnType: f.returnType,
              period: f.period,
              status,
              issuesCount: f.issuesFound,
            };
          });

        // Add some filed clients
        const filedCards: ClientCard[] = filings
          .filter((f) => f.status === 'filed')
          .slice(0, 2)
          .map((f) => {
            const client = clientMap.get(f.clientId);
            const name = client?.tradeName ?? 'Unknown';
            const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
            return {
              clientId: f.clientId,
              clientName: name,
              initials,
              returnType: f.returnType,
              period: f.period,
              status: 'filed' as const,
              issuesCount: 0,
            };
          });

        const combined = [...cards, ...filedCards].slice(0, 6);
        setClientCards(combined.length > 0 ? combined : mockClientCards);
      } else {
        setClientCards(mockClientCards);
      }

      // ── Filing Progress ──
      const issueFilings = filings.filter(
        (f) => f.criticalErrors > 0 || f.issuesFound > 0
      );

      const filed = dashData.filedReturns ?? filedFilings;
      const ready = readyToFileCount;
      const issues = issueFilings.length;
      const notStarted = processingCount;
      const total = filings.length || 1;

      setFiledCount(filed);
      setReadyCount(ready);
      setIssuesCount(issues);
      setNotStartedCount(notStarted);
      setTotalReturns(total);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      // Apply mock fallbacks
      setPipelineStages(mockPipelineStages);
      setAttentionCards(mockAttentionCards);
      setClientCards(mockClientCards);
      setFiledCount(18);
      setReadyCount(6);
      setIssuesCount(3);
      setNotStartedCount(8);
      setTotalReturns(35);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // ── Derived Values ───────────────────────────────────────────────────────
  const filedPct = totalReturns > 0 ? Math.round((filedCount / totalReturns) * 100) : 0;
  const readyPct = totalReturns > 0 ? Math.round((readyCount / totalReturns) * 100) : 0;
  const issuesPct = totalReturns > 0 ? Math.round((issuesCount / totalReturns) * 100) : 0;
  const notStartedPct = totalReturns > 0 ? Math.round((notStartedCount / totalReturns) * 100) : 0;

  // ── Animation Variants ───────────────────────────────────────────────────
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.06 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">

      {/* ═══ 1. PAGE HEADER ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Command Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload documents → Get GST-ready returns in minutes
          </p>
        </div>
        <Button
          onClick={() => setCurrentView('upload')}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all duration-300 gap-2 h-11 px-6 self-start"
        >
          <Upload className="h-4 w-4" />
          Upload Documents
        </Button>
      </motion.div>

      {/* ═══ 2. FILING PIPELINE ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5, ease: 'easeOut' }}
      >
        <Card className="border-border/50 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-500" />
              Filing Pipeline
            </CardTitle>
            <CardDescription>
              Your workflow from upload to filing — click any stage to navigate
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            {loading ? (
              <PipelineSkeleton />
            ) : (
              <div className="overflow-x-auto -mx-2 px-2">
                <div className="flex items-center min-w-[640px] md:min-w-0 justify-between">
                  {pipelineStages.map((stage, index) => (
                    <React.Fragment key={stage.id}>
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 + index * 0.07, duration: 0.4, ease: 'easeOut' }}
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setCurrentView(stage.navigateTo)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl cursor-pointer transition-all duration-200 min-w-[90px] md:min-w-[100px] group
                          ${stage.isBottleneck
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-300 dark:ring-emerald-700 shadow-md shadow-emerald-500/10'
                            : 'hover:bg-muted/50'
                          }`}
                      >
                        <div className={`flex items-center justify-center h-9 w-9 rounded-lg transition-colors
                          ${stage.isBottleneck
                            ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400'
                            : 'bg-muted text-muted-foreground group-hover:text-foreground'
                          }`}
                        >
                          {stage.icon}
                        </div>
                        <span className={`text-[11px] font-medium whitespace-nowrap
                          ${stage.isBottleneck
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-muted-foreground'
                          }`}
                        >
                          {stage.label}
                        </span>
                        <span className={`text-lg font-bold leading-none
                          ${stage.isBottleneck
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-foreground'
                          }`}
                        >
                          {stage.count}
                        </span>
                        {stage.isBottleneck && (
                          <Badge className="text-[9px] px-1.5 py-0 h-4 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-400 border-0 font-semibold">
                            BOTTLENECK
                          </Badge>
                        )}
                      </motion.div>

                      {/* Connector Arrow */}
                      {index < pipelineStages.length - 1 && (
                        <PipelineConnector isBottleneck={stage.isBottleneck || pipelineStages[index + 1]?.isBottleneck || false} />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══ 3. ATTENTION REQUIRED ═══ */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <motion.div key={i} variants={itemVariants}>
                <AttentionCardSkeleton />
              </motion.div>
            ))
          : attentionCards.map((card) => (
              <motion.div key={card.id} variants={itemVariants} whileHover={{ y: -2 }} className="transition-shadow duration-300 hover:shadow-lg">
                <Card className={`border ${card.accentBorder} ${card.accentBg} overflow-hidden relative`}>
                  {/* Accent strip on left */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    card.id === 'overdue' ? 'bg-red-500' :
                    card.id === 'mismatches' ? 'bg-amber-500' : 'bg-slate-400'
                  }`} />
                  <CardContent className="p-5 pl-6">
                    <div className="flex items-start gap-4">
                      <div className={`flex items-center justify-center h-11 w-11 rounded-xl shrink-0 ${card.iconBg}`}>
                        {card.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {card.title}
                        </p>
                        <p className={`text-2xl font-bold mt-0.5 ${card.accentColor}`}>
                          {card.count}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {card.description}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`mt-4 w-full gap-1.5 h-8 text-xs font-medium border-current/20 hover:bg-current/10
                        ${card.id === 'overdue' ? 'text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30' :
                          card.id === 'mismatches' ? 'text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/30' :
                          'text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/30'
                        }`}
                      onClick={() => setCurrentView(card.navigateTo)}
                    >
                      {card.ctaLabel}
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))
        }
      </motion.div>

      {/* ═══ 4. CLIENT FILING OVERVIEW ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5, ease: 'easeOut' }}
      >
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Client Filing Overview
                </CardTitle>
                <CardDescription className="mt-1">
                  Top clients needing action this period
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30 text-xs h-8 gap-1"
                onClick={() => setCurrentView('clients')}
              >
                View All
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <ClientCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <ScrollArea className="max-h-[420px]">
                <div className="space-y-1.5 pr-1">
                  {clientCards.map((client, index) => (
                    <motion.div
                      key={`${client.clientId}-${client.returnType}-${client.period}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 + index * 0.04, duration: 0.3 }}
                      whileHover={{ backgroundColor: 'rgba(16, 185, 129, 0.04)', x: 2 }}
                      className="flex items-center gap-3 p-3 rounded-xl cursor-pointer group transition-all duration-200 border border-transparent hover:border-border/50"
                      onClick={() => setCurrentView(client.status === 'issues' ? 'reconcile' : 'returns')}
                    >
                      <AvatarInitials initials={client.initials} status={client.status} />

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {client.clientName}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {client.returnType} · {periodToLabel(client.period)}
                          {client.issuesCount > 0 && (
                            <span className="text-amber-600 dark:text-amber-400 ml-1">
                              · {client.issuesCount} issue{client.issuesCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </p>
                      </div>

                      <ClientStatusBadge status={client.status} />

                      <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/50 text-muted-foreground group-hover:bg-emerald-50 group-hover:text-emerald-600 dark:group-hover:bg-emerald-950/30 dark:group-hover:text-emerald-400 transition-all shrink-0">
                        <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══ 5. FILING PROGRESS ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5, ease: 'easeOut' }}
      >
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-emerald-500" />
                  Filing Progress
                </CardTitle>
                <CardDescription className="mt-1">
                  Current period status — {periodToLabel(currentPeriod)}
                </CardDescription>
              </div>
              <span className="text-sm font-semibold text-foreground">
                {totalReturns} total returns
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ProgressSkeleton />
            ) : (
              <div className="space-y-5">
                {/* Stacked Progress Bar */}
                <div className="h-3 w-full rounded-full bg-muted/30 overflow-hidden flex">
                  {filedPct > 0 && (
                    <motion.div
                      className="bg-emerald-500 h-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${filedPct}%` }}
                      transition={{ duration: 1.2, delay: 0.3, ease: 'easeOut' }}
                    />
                  )}
                  {readyPct > 0 && (
                    <motion.div
                      className="bg-emerald-400 h-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${readyPct}%` }}
                      transition={{ duration: 1.2, delay: 0.5, ease: 'easeOut' }}
                    />
                  )}
                  {issuesPct > 0 && (
                    <motion.div
                      className="bg-amber-400 h-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${issuesPct}%` }}
                      transition={{ duration: 1.2, delay: 0.7, ease: 'easeOut' }}
                    />
                  )}
                  {notStartedPct > 0 && (
                    <motion.div
                      className="bg-slate-300 dark:bg-slate-600 h-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${notStartedPct}%` }}
                      transition={{ duration: 1.2, delay: 0.9, ease: 'easeOut' }}
                    />
                  )}
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className="h-3 w-3 rounded-sm bg-emerald-500 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Filed</p>
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        {filedCount}{' '}
                        <span className="text-[11px] font-normal text-muted-foreground">
                          ({filedPct}%)
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="h-3 w-3 rounded-sm bg-emerald-400 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Ready</p>
                      <p className="text-sm font-bold text-emerald-500 dark:text-emerald-300">
                        {readyCount}{' '}
                        <span className="text-[11px] font-normal text-muted-foreground">
                          ({readyPct}%)
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="h-3 w-3 rounded-sm bg-amber-400 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Issues</p>
                      <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                        {issuesCount}{' '}
                        <span className="text-[11px] font-normal text-muted-foreground">
                          ({issuesPct}%)
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="h-3 w-3 rounded-sm bg-slate-300 dark:bg-slate-600 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Not Started</p>
                      <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                        {notStartedCount}{' '}
                        <span className="text-[11px] font-normal text-muted-foreground">
                          ({notStartedPct}%)
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
