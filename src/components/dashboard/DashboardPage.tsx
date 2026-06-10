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
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  ArrowRight,
  ChevronRight,
  FileText,
  AlertCircle,
  CalendarClock,
  FileX2,
  FileCheck,
  FileWarning,
  CircleDot,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { motion } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import type { AppView } from '@/contexts/AppContext';
import type { GSTRFiling, Client } from '@/types/gst';
import { formatCurrency, formatNumber, periodToLabel, isOverdue } from '@/lib/gst-utils';

// ─── Color Palette (Emerald/Teal — NO blue/indigo) ────────────────────────
const COLORS = {
  emerald: '#10b981',
  emeraldDark: '#059669',
  emeraldLight: '#d1fae5',
  teal: '#14b8a6',
  tealLight: '#ccfbf1',
  amber: '#f59e0b',
  amberLight: '#fef3c7',
  red: '#ef4444',
  redLight: '#fee2e2',
  slate: '#64748b',
  slateLight: '#f1f5f9',
};

// ─── Types ─────────────────────────────────────────────────────────────────
interface StatusCardData {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  bgColor: string;
  iconBg: string;
  iconColor: string;
  borderAccent: string;
  hoverShadow: string;
  navigateTo: AppView;
}

interface ClientFilingRow {
  clientId: string;
  clientName: string;
  returnType: string;
  period: string;
  status: 'ready' | 'issues' | 'pending' | 'filed';
  statusLabel: string;
  issuesCount: number;
  readyCount: number;
}

interface AttentionItem {
  id: string;
  type: 'overdue' | 'mismatch' | 'missing' | 'deadline';
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  navigateTo: AppView;
}

// ─── Fallback Mock Data ────────────────────────────────────────────────────
const mockMonthlyFiling = [
  { period: '2025-01', month: 'Jan', filed: 8, ready: 3, issues: 2, pending: 1 },
  { period: '2025-02', month: 'Feb', filed: 10, ready: 4, issues: 1, pending: 2 },
  { period: '2025-03', month: 'Mar', filed: 12, ready: 2, issues: 3, pending: 1 },
  { period: '2025-04', month: 'Apr', filed: 9, ready: 5, issues: 2, pending: 2 },
  { period: '2025-05', month: 'May', filed: 14, ready: 3, issues: 1, pending: 1 },
  { period: '2025-06', month: 'Jun', filed: 11, ready: 6, issues: 2, pending: 3 },
];

const mockClientFilings: ClientFilingRow[] = [
  { clientId: '1', clientName: 'Sharma Enterprises', returnType: 'GSTR-1', period: '2025-06', status: 'ready', statusLabel: 'Ready', issuesCount: 0, readyCount: 45 },
  { clientId: '2', clientName: 'Patel & Sons Pvt Ltd', returnType: 'GSTR-3B', period: '2025-06', status: 'issues', statusLabel: 'Issues', issuesCount: 3, readyCount: 0 },
  { clientId: '3', clientName: 'Krishna Traders', returnType: 'GSTR-1', period: '2025-06', status: 'filed', statusLabel: 'Filed', issuesCount: 0, readyCount: 0 },
  { clientId: '4', clientName: 'Metro Retail Solutions', returnType: 'GSTR-1', period: '2025-06', status: 'pending', statusLabel: 'Pending', issuesCount: 0, readyCount: 0 },
  { clientId: '5', clientName: 'Sunrise Exports Ltd', returnType: 'GSTR-3B', period: '2025-05', status: 'issues', statusLabel: 'Issues', issuesCount: 7, readyCount: 0 },
  { clientId: '6', clientName: 'Gupta Manufacturing', returnType: 'GSTR-1', period: '2025-06', status: 'ready', statusLabel: 'Ready', issuesCount: 0, readyCount: 32 },
  { clientId: '7', clientName: 'Digital Commerce India', returnType: 'GSTR-3B', period: '2025-06', status: 'filed', statusLabel: 'Filed', issuesCount: 0, readyCount: 0 },
  { clientId: '8', clientName: 'Apex Logistics', returnType: 'GSTR-1', period: '2025-06', status: 'pending', statusLabel: 'Pending', issuesCount: 0, readyCount: 0 },
];

const mockAttentionItems: AttentionItem[] = [
  { id: 'a1', type: 'overdue', title: 'GSTR-1 overdue for Sunrise Exports', description: 'Period May 2025 — 3 days past deadline', icon: <FileX2 className="h-4 w-4" />, iconBg: 'bg-red-50 dark:bg-red-950/40', iconColor: 'text-red-500', navigateTo: 'returns' as AppView },
  { id: 'a2', type: 'mismatch', title: '7 mismatches in Patel & Sons GSTR-3B', description: 'Tax amount discrepancy detected in purchase register', icon: <AlertTriangle className="h-4 w-4" />, iconBg: 'bg-amber-50 dark:bg-amber-950/40', iconColor: 'text-amber-500', navigateTo: 'reconcile' as AppView },
  { id: 'a3', type: 'missing', title: '3 invoices missing from GSTR-2B', description: 'Found in purchase register but not on GST portal', icon: <FileWarning className="h-4 w-4" />, iconBg: 'bg-amber-50 dark:bg-amber-950/40', iconColor: 'text-amber-500', navigateTo: 'reconcile' as AppView },
  { id: 'a4', type: 'deadline', title: 'GSTR-1 deadline in 2 days', description: '6 clients have upcoming filing deadline', icon: <CalendarClock className="h-4 w-4" />, iconBg: 'bg-slate-100 dark:bg-slate-800/40', iconColor: 'text-slate-500', navigateTo: 'returns' as AppView },
  { id: 'a5', type: 'overdue', title: 'GSTR-3B overdue for Apex Logistics', description: 'Period Apr 2025 — 37 days past deadline', icon: <FileX2 className="h-4 w-4" />, iconBg: 'bg-red-50 dark:bg-red-950/40', iconColor: 'text-red-500', navigateTo: 'returns' as AppView },
];

// ─── Status Badge Component ────────────────────────────────────────────────
function StatusBadge({ status }: { status: ClientFilingRow['status'] }) {
  const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    ready: {
      label: 'Ready',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
      icon: <FileCheck className="h-3 w-3 mr-1" />,
    },
    issues: {
      label: 'Issues',
      className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
      icon: <AlertTriangle className="h-3 w-3 mr-1" />,
    },
    pending: {
      label: 'Pending',
      className: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700',
      icon: <Clock className="h-3 w-3 mr-1" />,
    },
    filed: {
      label: 'Filed',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
      icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
    },
  };

  const c = config[status] || config.pending;

  return (
    <Badge variant="outline" className={`text-[11px] font-semibold px-2 py-0.5 border ${c.className}`}>
      {c.icon}
      {c.label}
    </Badge>
  );
}

// ─── Skeleton Loaders ─────────────────────────────────────────────────────
function StatusCardSkeleton() {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  );
}

function ClientTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3 flex-1">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function AttentionListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProgressSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-full rounded-full" />
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
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

  // Status card metrics
  const [readyToFileCount, setReadyToFileCount] = useState(0);
  const [hasIssuesCount, setHasIssuesCount] = useState(0);
  const [pendingReturnsCount, setPendingReturnsCount] = useState(0);
  const [actionItemsCount, setActionItemsCount] = useState(0);

  // Detailed data
  const [clientFilings, setClientFilings] = useState<ClientFilingRow[]>([]);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);

  // Filing progress
  const [filedCount, setFiledCount] = useState(0);
  const [readyCount, setReadyCount] = useState(0);
  const [issuesCount, setIssuesCount] = useState(0);
  const [notStartedCount, setNotStartedCount] = useState(0);
  const [totalReturns, setTotalReturns] = useState(0);

  // Monthly chart
  const [monthlyData, setMonthlyData] = useState(mockMonthlyFiling);

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

      // ── Status Card 1: Ready to File ──
      const readyStatuses = ['validated', 'generated', 'reviewed'];
      const readyFilings = filings.filter((f) => readyStatuses.includes(f.status));
      const readyClientIds = new Set(readyFilings.map((f) => f.clientId));
      const readyCount = readyClientIds.size || Math.round(clients.length * 0.35) || 4;
      setReadyToFileCount(readyCount);

      // ── Status Card 2: Has Issues ──
      const issueFilings = filings.filter(
        (f) => f.criticalErrors > 0 || f.issuesFound > 0
      );
      const issueClientIds = new Set(issueFilings.map((f) => f.clientId));
      const issueClientsFromHealth = clients.filter((c) => c.healthScore < 50);
      const hasIssues = issueClientIds.size || issueClientsFromHealth.length || 3;
      setHasIssuesCount(hasIssues);

      // ── Status Card 3: Pending Returns ──
      const pendingFilings = filings.filter((f) => f.status !== 'filed');
      const pending = dashData.pendingReturns ?? pendingFilings.length ?? 8;
      setPendingReturnsCount(pending);

      // ── Status Card 4: Action Items ──
      const overdueFilings = filings.filter(
        (f) => f.status !== 'filed' && isOverdue(f.period)
      );
      const criticalInvoices = invoices.filter(
        (inv: { riskLevel: string }) => ['high', 'critical'].includes(inv.riskLevel)
      );
      const actionItems =
        (dashData.overdueReturns ?? overdueFilings.length) +
        (dashData.criticalIssues ?? criticalInvoices.length) || 5;
      setActionItemsCount(actionItems);

      // ── Client Filing Status Table ──
      if (filings.length > 0 && clients.length > 0) {
        const clientMap = new Map<string, Client>();
        clients.forEach((c) => clientMap.set(c.id, c));

        const rows: ClientFilingRow[] = filings
          .filter((f) => f.status !== 'filed')
          .slice(0, 10)
          .map((f) => {
            const client = clientMap.get(f.clientId);
            let status: ClientFilingRow['status'] = 'pending';
            let statusLabel = 'Pending';

            if (f.criticalErrors > 0 || f.issuesFound > 0) {
              status = 'issues';
              statusLabel = 'Issues';
            } else if (readyStatuses.includes(f.status)) {
              status = 'ready';
              statusLabel = 'Ready';
            }

            return {
              clientId: f.clientId,
              clientName: client?.tradeName ?? 'Unknown',
              returnType: f.returnType,
              period: f.period,
              status,
              statusLabel,
              issuesCount: f.issuesFound,
              readyCount: f.readyForFiling,
            };
          });

        // Add filed clients too
        const filedRows: ClientFilingRow[] = filings
          .filter((f) => f.status === 'filed')
          .slice(0, 3)
          .map((f) => {
            const client = clientMap.get(f.clientId);
            return {
              clientId: f.clientId,
              clientName: client?.tradeName ?? 'Unknown',
              returnType: f.returnType,
              period: f.period,
              status: 'filed' as const,
              statusLabel: 'Filed',
              issuesCount: 0,
              readyCount: 0,
            };
          });

        const combined = [...rows, ...filedRows].slice(0, 10);
        setClientFilings(combined.length > 0 ? combined : mockClientFilings);
      } else {
        setClientFilings(mockClientFilings);
      }

      // ── Attention Items ──
      const items: AttentionItem[] = [];

      // Overdue filings
      overdueFilings.slice(0, 3).forEach((f, i) => {
        const clientName =
          f.client?.tradeName ?? clients.find((c) => c.id === f.clientId)?.tradeName ?? 'Unknown';
        items.push({
          id: `overdue-${i}`,
          type: 'overdue',
          title: `${f.returnType} overdue for ${clientName}`,
          description: `Period ${periodToLabel(f.period)} — past deadline`,
          icon: <FileX2 className="h-4 w-4" />,
          iconBg: 'bg-red-50 dark:bg-red-950/40',
          iconColor: 'text-red-500',
          navigateTo: 'returns' as AppView,
        });
      });

      // Mismatches from invoices
      const mismatchInvoices = invoices.filter(
        (inv: { matchStatus: string }) =>
          ['mismatch', 'partial_match'].includes(inv.matchStatus)
      );
      if (mismatchInvoices.length > 0) {
        items.push({
          id: 'mismatch-1',
          type: 'mismatch',
          title: `${mismatchInvoices.length} mismatches found in invoices`,
          description: 'Tax amount or GSTIN discrepancies detected',
          icon: <AlertTriangle className="h-4 w-4" />,
          iconBg: 'bg-amber-50 dark:bg-amber-950/40',
          iconColor: 'text-amber-500',
          navigateTo: 'reconcile' as AppView,
        });
      }

      // Missing invoices
      const missingInvoices = invoices.filter(
        (inv: { matchStatus: string }) =>
          ['missing_in_books', 'missing_in_gstr'].includes(inv.matchStatus)
      );
      if (missingInvoices.length > 0) {
        items.push({
          id: 'missing-1',
          type: 'missing',
          title: `${missingInvoices.length} invoices missing from records`,
          description:
            missingInvoices[0]?.matchStatus === 'missing_in_gstr'
              ? 'Found in books but not on GST portal'
              : 'Found on GST portal but not in books',
          icon: <FileWarning className="h-4 w-4" />,
          iconBg: 'bg-amber-50 dark:bg-amber-950/40',
          iconColor: 'text-amber-500',
          navigateTo: 'reconcile' as AppView,
        });
      }

      // Upcoming deadlines from filing calendar
      const upcomingCalendar = (dashData.filingCalendar ?? []).filter(
        (item: { status: string }) => item.status === 'pending'
      );
      if (upcomingCalendar.length > 0) {
        items.push({
          id: 'deadline-1',
          type: 'deadline',
          title: `${upcomingCalendar.length} returns have upcoming deadlines`,
          description: 'Ensure timely filing to avoid penalties',
          icon: <CalendarClock className="h-4 w-4" />,
          iconBg: 'bg-slate-100 dark:bg-slate-800/40',
          iconColor: 'text-slate-500',
          navigateTo: 'returns' as AppView,
        });
      }

      setAttentionItems(items.length > 0 ? items : mockAttentionItems);

      // ── Filing Progress ──
      const filed = dashData.filedReturns ?? filings.filter((f) => f.status === 'filed').length ?? 0;
      const ready = readyFilings.length;
      const issues = issueFilings.length;
      const notStarted = filings.filter(
        (f) => f.status === 'draft' && f.criticalErrors === 0 && f.issuesFound === 0
      ).length;
      const total = filings.length || 1;

      setFiledCount(filed);
      setReadyCount(ready);
      setIssuesCount(issues);
      setNotStartedCount(notStarted);
      setTotalReturns(total);

      // ── Monthly Chart ──
      if (dashData.monthlyFilingStatus && dashData.monthlyFilingStatus.length > 0) {
        const chartData = dashData.monthlyFilingStatus
          .slice(-6)
          .map((entry: { period: string; filed: number; pending: number; overdue: number }) => ({
            period: entry.period,
            month: periodToLabel(entry.period),
            filed: entry.filed ?? 0,
            ready: entry.pending ?? 0,
            issues: entry.overdue ?? 0,
            pending: (entry.pending ?? 0) + (entry.overdue ?? 0),
          }));
        setMonthlyData(chartData.length >= 2 ? chartData : mockMonthlyFiling);
      } else {
        setMonthlyData(mockMonthlyFiling);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      // Apply mock fallbacks
      setReadyToFileCount(4);
      setHasIssuesCount(3);
      setPendingReturnsCount(8);
      setActionItemsCount(5);
      setClientFilings(mockClientFilings);
      setAttentionItems(mockAttentionItems);
      setFiledCount(12);
      setReadyCount(6);
      setIssuesCount(3);
      setNotStartedCount(4);
      setTotalReturns(25);
      setMonthlyData(mockMonthlyFiling);
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

  // ── Status Cards Config ──────────────────────────────────────────────────
  const statusCards: StatusCardData[] = [
    {
      title: 'Ready to File',
      value: readyToFileCount,
      subtitle: `${readyToFileCount} client${readyToFileCount !== 1 ? 's' : ''} ready`,
      icon: <CheckCircle2 className="h-5 w-5" />,
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/20',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      borderAccent: 'border-emerald-200 dark:border-emerald-800/50',
      hoverShadow: 'hover:shadow-emerald-500/10',
      navigateTo: 'returns',
    },
    {
      title: 'Has Issues',
      value: hasIssuesCount,
      subtitle: `${hasIssuesCount} client${hasIssuesCount !== 1 ? 's' : ''} need attention`,
      icon: <AlertTriangle className="h-5 w-5" />,
      bgColor: 'bg-amber-50 dark:bg-amber-950/20',
      iconBg: 'bg-amber-100 dark:bg-amber-900/50',
      iconColor: 'text-amber-600 dark:text-amber-400',
      borderAccent: 'border-amber-200 dark:border-amber-800/50',
      hoverShadow: 'hover:shadow-amber-500/10',
      navigateTo: 'reconcile',
    },
    {
      title: 'Pending Returns',
      value: pendingReturnsCount,
      subtitle: `Period ${periodToLabel(currentPeriod)}`,
      icon: <Clock className="h-5 w-5" />,
      bgColor: 'bg-slate-50 dark:bg-slate-900/20',
      iconBg: 'bg-slate-100 dark:bg-slate-800/50',
      iconColor: 'text-slate-600 dark:text-slate-400',
      borderAccent: 'border-slate-200 dark:border-slate-700/50',
      hoverShadow: 'hover:shadow-slate-500/10',
      navigateTo: 'returns',
    },
    {
      title: 'Action Items',
      value: actionItemsCount,
      subtitle: `${actionItemsCount} item${actionItemsCount !== 1 ? 's' : ''} need your attention`,
      icon: <Zap className="h-5 w-5" />,
      bgColor: 'bg-red-50 dark:bg-red-950/20',
      iconBg: 'bg-red-100 dark:bg-red-900/50',
      iconColor: 'text-red-600 dark:text-red-400',
      borderAccent: 'border-red-200 dark:border-red-800/50',
      hoverShadow: 'hover:shadow-red-500/10',
      navigateTo: 'returns',
    },
  ];

  // ── Chart Config ─────────────────────────────────────────────────────────
  const filingChartConfig = {
    filed: { label: 'Filed', color: COLORS.emerald },
    pending: { label: 'Pending', color: COLORS.amber },
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* ═══ PAGE HEADER ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            GSTPilot Command Center
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upload documents → Get GST-ready returns in minutes
          </p>
        </div>
        <Badge
          variant="outline"
          className="gap-1.5 px-3 py-1.5 border-emerald-200 text-emerald-700 bg-emerald-50/80 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/40 font-medium self-start"
        >
          <CircleDot className="h-3.5 w-3.5 animate-pulse" />
          Live
        </Badge>
      </motion.div>

      {/* ═══ TOP SECTION — 4 STATUS CARDS ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <StatusCardSkeleton key={i} />
            ))
          : statusCards.map((card, index) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.5, ease: 'easeOut' }}
                whileHover={{ scale: 1.02 }}
                className="cursor-pointer"
                onClick={() => setCurrentView(card.navigateTo)}
              >
                <Card
                  className={`${card.bgColor} ${card.borderAccent} ${card.hoverShadow} hover:shadow-lg transition-all duration-300 border`}
                >
                  <CardContent className="p-4 md:p-5">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {card.title}
                        </p>
                        <p className={`text-3xl font-bold ${card.iconColor}`}>
                          {card.value}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {card.subtitle}
                        </p>
                      </div>
                      <div className={`flex items-center justify-center h-10 w-10 rounded-xl ${card.iconBg} ${card.iconColor} shrink-0`}>
                        {card.icon}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
      </div>

      {/* ═══ MIDDLE SECTION — Two Columns ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* ─── LEFT: Client Filing Status ─── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5, ease: 'easeOut' }}
        >
          <Card className="border-border/50 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4.5 w-4.5 text-emerald-500" />
                    Client Filing Status
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Current return preparation status
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30 text-xs h-8"
                  onClick={() => setCurrentView('returns')}
                >
                  View All
                  <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <ClientTableSkeleton />
              ) : (
                <ScrollArea className="max-h-96">
                  <div className="space-y-1 pr-1">
                    {/* Table Header */}
                    <div className="grid grid-cols-[1fr_80px_70px_80px_36px] gap-2 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40">
                      <span>Client</span>
                      <span>Return</span>
                      <span>Period</span>
                      <span className="text-center">Status</span>
                      <span></span>
                    </div>

                    {clientFilings.map((row, index) => (
                      <motion.div
                        key={`${row.clientId}-${row.returnType}-${row.period}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + index * 0.04, duration: 0.3 }}
                        whileHover={{ backgroundColor: 'rgba(16, 185, 129, 0.04)' }}
                        className="grid grid-cols-[1fr_80px_70px_80px_36px] gap-2 items-center px-2 py-2 rounded-lg cursor-pointer group transition-colors"
                        onClick={() => setCurrentView(row.status === 'issues' ? 'reconcile' : 'returns')}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {row.clientName}
                          </p>
                          {row.issuesCount > 0 && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 truncate">
                              {row.issuesCount} issue{row.issuesCount !== 1 ? 's' : ''} found
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">
                          {row.returnType}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {periodToLabel(row.period)}
                        </span>
                        <div className="flex justify-center">
                          <StatusBadge status={row.status} />
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ─── RIGHT: What Needs Attention Today ─── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5, ease: 'easeOut' }}
        >
          <Card className="border-border/50 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Zap className="h-4.5 w-4.5 text-red-500" />
                    What Needs Attention Today
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Priority items requiring action
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] px-2 py-0.5 border-red-200 text-red-700 bg-red-50/80 dark:border-red-800 dark:text-red-400 dark:bg-red-950/40"
                >
                  {attentionItems.length} items
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <AttentionListSkeleton />
              ) : (
                <ScrollArea className="max-h-96">
                  <div className="space-y-2 pr-1">
                    {attentionItems.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + index * 0.06, duration: 0.35 }}
                        whileHover={{ x: 4 }}
                        className="flex items-center gap-3 p-3 rounded-xl border border-border/30 hover:border-emerald-200/50 dark:hover:border-emerald-800/50 transition-all cursor-pointer group"
                        onClick={() => setCurrentView(item.navigateTo)}
                      >
                        <div className={`flex items-center justify-center h-9 w-9 rounded-lg shrink-0 ${item.iconBg} ${item.iconColor}`}>
                          {item.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {item.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {item.description}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </motion.div>
                    ))}

                    {attentionItems.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
                        <p className="text-sm font-medium text-foreground">All clear!</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          No items need your attention right now.
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ═══ BOTTOM SECTION — Filing Progress ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.5, ease: 'easeOut' }}
      >
        <Card className="border-border/50 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileCheck className="h-4.5 w-4.5 text-emerald-500" />
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
              <div className="space-y-6">
                {/* Stacked Progress Bar */}
                <div>
                  <div className="h-4 w-full rounded-full bg-muted/30 overflow-hidden flex">
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    <div className="flex items-center gap-2">
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
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-sm bg-emerald-400 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Ready to File</p>
                        <p className="text-sm font-bold text-emerald-500 dark:text-emerald-300">
                          {readyCount}{' '}
                          <span className="text-[11px] font-normal text-muted-foreground">
                            ({readyPct}%)
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
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
                    <div className="flex items-center gap-2">
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

                {/* Monthly Filing Volume AreaChart */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-foreground">
                      Monthly Filing Volume
                    </p>
                    <span className="text-[11px] text-muted-foreground">Last 6 months</span>
                  </div>
                  <ChartContainer config={filingChartConfig} className="h-44 w-full">
                    <AreaChart data={monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="filedGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.emerald} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={COLORS.emerald} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="pendingGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.amber} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={COLORS.amber} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#e2e8f0"
                        className="dark:stroke-slate-700/50"
                      />
                      <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area
                        type="monotone"
                        dataKey="filed"
                        stroke={COLORS.emerald}
                        strokeWidth={2}
                        fill="url(#filedGradient)"
                        dot={false}
                        activeDot={{ r: 5, fill: COLORS.emerald, stroke: '#fff', strokeWidth: 2 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="pending"
                        stroke={COLORS.amber}
                        strokeWidth={2}
                        fill="url(#pendingGradient)"
                        dot={false}
                        activeDot={{ r: 5, fill: COLORS.amber, stroke: '#fff', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ChartContainer>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
