'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  Shield,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Zap,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { useApp } from '@/contexts/AppContext';
import type { DashboardMetrics, FilingCalendarItem } from '@/types/gst';
import { formatCurrency, formatNumber } from '@/lib/gst-utils';

// --- Mock / default data for when API hasn't responded yet ---
const defaultMetrics: DashboardMetrics = {
  totalClients: 0,
  totalInvoices: 0,
  filedReturns: 0,
  pendingReturns: 0,
  overdueReturns: 0,
  averageHealthScore: 0,
  criticalIssues: 0,
  warnings: 0,
  matchPercentage: 0,
  riskPercentage: 0,
};

const defaultCalendarItems: FilingCalendarItem[] = [];

interface RecentActivityEntry {
  id: string;
  action: string;
  timestamp: string;
  clientName: string;
  entity?: string;
}

const defaultRecentActivity: RecentActivityEntry[] = [];

// Chart color palette (emerald / amber / red themed)
const CHART_COLORS = {
  emerald: '#10b981',
  emeraldLight: '#d1fae5',
  amber: '#f59e0b',
  amberLight: '#fef3c7',
  red: '#ef4444',
  redLight: '#fee2e2',
  slate: '#64748b',
  slateLight: '#e2e8f0',
};

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#64748b'];

// --- Helper: Health score color ---
function getHealthColor(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function getHealthBg(score: number): string {
  if (score >= 80) return 'bg-emerald-50';
  if (score >= 60) return 'bg-amber-50';
  return 'bg-red-50';
}

function getHealthStroke(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

// --- Circular Progress Component ---
function CircularProgress({
  value,
  size = 120,
  strokeWidth = 10,
  label,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={getHealthStroke(value)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className={`text-3xl font-bold ${getHealthColor(value)}`}>{Math.round(value)}</span>
        {label && <span className="text-xs text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}

// --- Skeleton Loaders ---
function KPISkeleton() {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-12 w-12 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  );
}

function ListSkeleton() {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ===================== MAIN COMPONENT =====================
export default function DashboardPage() {
  const { setCurrentView } = useApp();

  const [metrics, setMetrics] = useState<DashboardMetrics>(defaultMetrics);
  const [calendarItems, setCalendarItems] = useState<FilingCalendarItem[]>(defaultCalendarItems);
  const [recentActivity, setRecentActivity] = useState<RecentActivityEntry[]>(defaultRecentActivity);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filing readiness state
  const [filingReadiness, setFilingReadiness] = useState({
    totalInvoices: 0,
    readyForFiling: 0,
    issuesFound: 0,
    criticalErrors: 0,
    warnings: 0,
  });

  // Monthly filing chart data
  const [monthlyFilingData, setMonthlyFilingData] = useState<
    { month: string; filed: number; pending: number }[]
  >([]);

  // Client health distribution data
  const [healthDistribution, setHealthDistribution] = useState<
    { name: string; value: number; color: string }[]
  >([]);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setLoading(true);
        const res = await fetch('/api/dashboard');
        if (!res.ok) throw new Error('Failed to fetch dashboard data');
        const data = await res.json();

        // API returns flat structure - map to component state
        setMetrics({
          totalClients: data.totalClients ?? 0,
          totalInvoices: data.totalInvoices ?? 0,
          filedReturns: data.filedReturns ?? 0,
          pendingReturns: data.pendingReturns ?? 0,
          overdueReturns: data.overdueReturns ?? 0,
          averageHealthScore: data.averageHealthScore ?? 0,
          criticalIssues: data.criticalIssues ?? 0,
          warnings: data.warnings ?? 0,
          matchPercentage: data.matchPercentage ?? 0,
          riskPercentage: data.riskPercentage ?? 0,
        });

        // Map calendar items from filingCalendar
        if (data.filingCalendar) {
          setCalendarItems(data.filingCalendar);
        }

        // Map recent activity from audit logs
        if (data.recentAuditLogs) {
          setRecentActivity(
            data.recentAuditLogs.map((log: { id: string; action: string; timestamp: string; client: { tradeName: string } | null; entity?: string }) => ({
              id: log.id,
              action: log.action,
              timestamp: log.timestamp,
              clientName: log.client?.tradeName ?? 'Unknown',
              entity: log.entity,
            }))
          );
        }

        // Calculate filing readiness from invoices
        const invRes = await fetch('/api/invoices?limit=1000');
        if (invRes.ok) {
          const invData = await invRes.json();
          const invoices = invData.invoices ?? invData ?? [];
          const total = Array.isArray(invoices) ? invoices.length : 0;
          const approved = Array.isArray(invoices) ? invoices.filter((inv: { status: string }) => !['draft', 'cancelled'].includes(inv.status)).length : 0;
          const issues = Array.isArray(invoices) ? invoices.filter((inv: { matchStatus: string }) => ['mismatch', 'missing_in_books', 'missing_in_gstr'].includes(inv.matchStatus)).length : 0;
          const critical = Array.isArray(invoices) ? invoices.filter((inv: { riskLevel: string }) => inv.riskLevel === 'critical').length : 0;
          const warn = Array.isArray(invoices) ? invoices.filter((inv: { riskLevel: string }) => inv.riskLevel === 'high').length : 0;
          setFilingReadiness({
            totalInvoices: total,
            readyForFiling: approved,
            issuesFound: issues,
            criticalErrors: critical,
            warnings: warn,
          });
        }

        // Map monthly filing status to chart data
        if (data.monthlyFilingStatus) {
          setMonthlyFilingData(
            data.monthlyFilingStatus.map((m: { period: string; filed: number; pending: number; overdue: number }) => ({
              month: m.period ? m.period.split('-')[1] + '/' + m.period.split('-')[0].slice(2) : '',
              filed: m.filed,
              pending: m.pending + m.overdue,
            }))
          );
        }

        // Calculate health distribution from clients
        const clientRes = await fetch('/api/clients');
        if (clientRes.ok) {
          const clientData = await clientRes.json();
          const clients = clientData.clients ?? clientData ?? [];
          if (Array.isArray(clients)) {
            const excellent = clients.filter((c: { healthScore: number }) => c.healthScore >= 80).length;
            const good = clients.filter((c: { healthScore: number }) => c.healthScore >= 60 && c.healthScore < 80).length;
            const atRisk = clients.filter((c: { healthScore: number }) => c.healthScore >= 40 && c.healthScore < 60).length;
            const critical = clients.filter((c: { healthScore: number }) => c.healthScore < 40).length;
            setHealthDistribution([
              { name: 'Excellent (80-100)', value: excellent, color: PIE_COLORS[0] },
              { name: 'Good (60-79)', value: good, color: PIE_COLORS[1] },
              { name: 'At Risk (40-59)', value: atRisk, color: PIE_COLORS[2] },
              { name: 'Critical (<40)', value: critical, color: PIE_COLORS[3] },
            ]);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  // Chart configs
  const monthlyFilingChartConfig = {
    filed: { label: 'Filed', color: CHART_COLORS.emerald },
    pending: { label: 'Pending', color: CHART_COLORS.amber },
  };

  const healthDistChartConfig = {
    excellent: { label: 'Excellent', color: PIE_COLORS[0] },
    good: { label: 'Good', color: PIE_COLORS[1] },
    atRisk: { label: 'At Risk', color: PIE_COLORS[2] },
    critical: { label: 'Critical', color: PIE_COLORS[3] },
  };

  // --- Helper: format relative time ---
  function formatRelativeTime(timestamp: string): string {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  function formatDueDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function getStatusBadge(status: FilingCalendarItem['status']) {
    switch (status) {
      case 'filed':
        return <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200">Filed</Badge>;
      case 'pending':
        return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200">Pending</Badge>;
      case 'overdue':
        return <Badge className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200">Overdue</Badge>;
      case 'upcoming':
        return <Badge className="bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200">Upcoming</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  }

  // ==================== RENDER ====================
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            GST Compliance Overview &middot; Real-time monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 px-3 py-1">
            <Activity className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-emerald-700">Live</span>
          </Badge>
        </div>
      </div>

      {/* ===== ROW 1: KPI Cards ===== */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KPISkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: GST Health Score */}
          <Card className="hover:shadow-md transition-shadow relative overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground font-medium">GST Health Score</p>
                  <p className={`text-3xl font-bold ${getHealthColor(metrics.averageHealthScore)}`}>
                    {metrics.averageHealthScore}
                    <span className="text-lg font-normal text-muted-foreground">/100</span>
                  </p>
                  <div className="flex items-center gap-1 text-xs">
                    {metrics.averageHealthScore >= 80 ? (
                      <>
                        <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-emerald-600 font-medium">Healthy</span>
                      </>
                    ) : metrics.averageHealthScore >= 60 ? (
                      <>
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-amber-600 font-medium">Needs Attention</span>
                      </>
                    ) : (
                      <>
                        <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                        <span className="text-red-600 font-medium">Critical</span>
                      </>
                    )}
                  </div>
                </div>
                <div className={`flex items-center justify-center h-14 w-14 rounded-xl ${getHealthBg(metrics.averageHealthScore)}`}>
                  <Shield className={`h-7 w-7 ${getHealthColor(metrics.averageHealthScore)}`} />
                </div>
              </div>
              <Progress
                value={metrics.averageHealthScore}
                className="mt-3 h-1.5"
              />
            </CardContent>
          </Card>

          {/* KPI 2: Returns Filed */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground font-medium">Returns Filed</p>
                  <p className="text-3xl font-bold text-emerald-600">
                    {formatNumber(metrics.filedReturns)}
                  </p>
                  <div className="flex items-center gap-1 text-xs">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-emerald-600 font-medium">+12% from last month</span>
                  </div>
                </div>
                <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-emerald-50">
                  <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI 3: Returns Pending */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground font-medium">Returns Pending</p>
                  <p className="text-3xl font-bold text-amber-600">
                    {formatNumber(metrics.pendingReturns)}
                  </p>
                  <div className="flex items-center gap-1 text-xs">
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-amber-600 font-medium">
                      {metrics.overdueReturns} overdue
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-amber-50">
                  <Clock className="h-7 w-7 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI 4: Critical Issues */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground font-medium">Critical Issues</p>
                  <p className="text-3xl font-bold text-red-600">
                    {formatNumber(metrics.criticalIssues)}
                  </p>
                  <div className="flex items-center gap-1 text-xs">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-red-600 font-medium">
                      {metrics.warnings} warnings
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-red-50">
                  <AlertTriangle className="h-7 w-7 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== ROW 2: Filing Readiness + Match & Risk ===== */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Filing Readiness Card */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5 text-emerald-600" />
                Filing Readiness
              </CardTitle>
              <CardDescription>Invoice readiness breakdown for current period</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stacked bar visual */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Invoices</span>
                  <span className="font-semibold">{formatNumber(filingReadiness.totalInvoices)}</span>
                </div>
                {/* Stacked progress bar */}
                <div className="h-4 w-full rounded-full bg-slate-100 overflow-hidden flex">
                  {filingReadiness.totalInvoices > 0 && (
                    <>
                      <div
                        className="bg-emerald-500 h-full transition-all duration-500"
                        style={{
                          width: `${(filingReadiness.readyForFiling / filingReadiness.totalInvoices) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-amber-400 h-full transition-all duration-500"
                        style={{
                          width: `${(filingReadiness.issuesFound / filingReadiness.totalInvoices) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-red-500 h-full transition-all duration-500"
                        style={{
                          width: `${(filingReadiness.criticalErrors / filingReadiness.totalInvoices) * 100}%`,
                        }}
                      />
                    </>
                  )}
                </div>
                {/* Legend */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm bg-emerald-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Ready for Filing</p>
                      <p className="text-sm font-semibold text-emerald-700">
                        {formatNumber(filingReadiness.readyForFiling)}
                        <span className="text-xs font-normal text-muted-foreground ml-1">
                          ({filingReadiness.totalInvoices > 0 ? Math.round((filingReadiness.readyForFiling / filingReadiness.totalInvoices) * 100) : 0}%)
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm bg-amber-400" />
                    <div>
                      <p className="text-xs text-muted-foreground">Issues Found</p>
                      <p className="text-sm font-semibold text-amber-700">
                        {formatNumber(filingReadiness.issuesFound)}
                        <span className="text-xs font-normal text-muted-foreground ml-1">
                          ({filingReadiness.totalInvoices > 0 ? Math.round((filingReadiness.issuesFound / filingReadiness.totalInvoices) * 100) : 0}%)
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm bg-red-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Critical Errors</p>
                      <p className="text-sm font-semibold text-red-700">
                        {formatNumber(filingReadiness.criticalErrors)}
                        <span className="text-xs font-normal text-muted-foreground ml-1">
                          ({filingReadiness.totalInvoices > 0 ? Math.round((filingReadiness.criticalErrors / filingReadiness.totalInvoices) * 100) : 0}%)
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm bg-amber-200" />
                    <div>
                      <p className="text-xs text-muted-foreground">Warnings</p>
                      <p className="text-sm font-semibold text-amber-600">
                        {formatNumber(filingReadiness.warnings)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Match & Risk Overview Card */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-5 w-5 text-emerald-600" />
                Match &amp; Risk Overview
              </CardTitle>
              <CardDescription>Reconciliation quality and risk assessment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-around">
                {/* Match % gauge */}
                <div className="flex flex-col items-center gap-2 relative">
                  <div className="relative">
                    <CircularProgress value={metrics.matchPercentage} size={130} strokeWidth={12} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-emerald-700">Match %</p>
                    <p className="text-xs text-muted-foreground">Perfect matches</p>
                  </div>
                </div>

                {/* Risk % gauge */}
                <div className="flex flex-col items-center gap-2 relative">
                  <div className="relative">
                    <CircularProgress value={metrics.riskPercentage} size={130} strokeWidth={12} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-red-700">Risk %</p>
                    <p className="text-xs text-muted-foreground">High/Critical risk</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== ROW 3: Charts ===== */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Monthly Filing Status Chart */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-5 w-5 text-emerald-600" />
                Monthly Filing Status
              </CardTitle>
              <CardDescription>Returns filed vs pending per month</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={monthlyFilingChartConfig} className="h-64 w-full">
                <BarChart data={monthlyFilingData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="filed" fill="var(--color-filed)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pending" fill="var(--color-pending)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Client Health Distribution Chart */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5 text-emerald-600" />
                Client Health Distribution
              </CardTitle>
              <CardDescription>Breakdown of client compliance health scores</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={healthDistChartConfig} className="h-64 w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                  <Pie
                    data={healthDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {healthDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index]} />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== ROW 4: Deadlines & Activity ===== */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ListSkeleton />
          <ListSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Upcoming Filing Deadlines */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-5 w-5 text-amber-500" />
                Upcoming Filing Deadlines
              </CardTitle>
              <CardDescription>Next 30 days filing schedule</CardDescription>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto">
              <div className="space-y-3">
                {calendarItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No upcoming deadlines
                  </p>
                ) : (
                  calendarItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors"
                    >
                      <div
                        className={`flex items-center justify-center h-10 w-10 rounded-lg shrink-0 ${
                          item.status === 'overdue'
                            ? 'bg-red-50'
                            : item.status === 'pending'
                            ? 'bg-amber-50'
                            : item.status === 'filed'
                            ? 'bg-emerald-50'
                            : 'bg-slate-50'
                        }`}
                      >
                        <FileText
                          className={`h-5 w-5 ${
                            item.status === 'overdue'
                              ? 'text-red-600'
                              : item.status === 'pending'
                              ? 'text-amber-600'
                              : item.status === 'filed'
                              ? 'text-emerald-600'
                              : 'text-slate-500'
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">
                            {item.returnType}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {item.period}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.clientName}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {getStatusBadge(item.status)}
                        <span className="text-xs text-muted-foreground">
                          {formatDueDate(item.dueDate)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-5 w-5 text-emerald-500" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest audit log entries</CardDescription>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto">
              <div className="space-y-3">
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No recent activity
                  </p>
                ) : (
                  recentActivity.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald-50 shrink-0 mt-0.5">
                        <Activity className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{entry.action}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground truncate">
                            {entry.clientName}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                        {formatRelativeTime(entry.timestamp)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== ROW 5: Quick Actions ===== */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-5 w-5 text-emerald-500" />
            Quick Actions
          </CardTitle>
          <CardDescription>Jump to common tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button
              onClick={() => setCurrentView('gstr-filing')}
              className="justify-start gap-2 h-11 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <FileText className="h-4 w-4" />
              Prepare GSTR-1
            </Button>
            <Button
              onClick={() => setCurrentView('reconciliation')}
              variant="outline"
              className="justify-start gap-2 h-11 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              <Shield className="h-4 w-4" />
              Run Reconciliation
            </Button>
            <Button
              onClick={() => setCurrentView('errors')}
              variant="outline"
              className="justify-start gap-2 h-11 border-amber-200 text-amber-700 hover:bg-amber-50"
            >
              <AlertTriangle className="h-4 w-4" />
              View Issues
            </Button>
            <Button
              onClick={() => setCurrentView('calendar')}
              variant="outline"
              className="justify-start gap-2 h-11 border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Clock className="h-4 w-4" />
              View Calendar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
