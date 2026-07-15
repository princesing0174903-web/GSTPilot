'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useApp } from '@/contexts/AppContext';
import type { Client, HealthScoreRecord } from '@/types/gst';
import { formatNumber, periodToLabel } from '@/lib/gst-utils';
import { useClients } from '@/hooks/useClients';
import {
  Users,
  HeartPulse,
  AlertTriangle,
  ShieldAlert,
  Search,
  Activity,
  ChevronRight,
  CircleDot,
  FileWarning,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  TrendingUp,
  TrendingDown,
  Building2,
  MapPin,
  Calendar,
  Tag,
  ExternalLink,
  ListChecks,
  FileText,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface EnrichedClient extends Client {
  _aggregations?: {
    totalInvoices: number;
    filedReturns: number;
    pendingReturns: number;
    matchPercentage: number;
  };
}

interface HealthTrendPoint {
  period: string;
  score: number;
}

interface ClientHealthDetail {
  client: EnrichedClient;
  healthTrend: HealthTrendPoint[];
  latestHealthScore: HealthScoreRecord | null;
  issues: { id: string; severity: string; category: string; title: string; status: string }[];
  pendingFilings: { id: string; returnType: string; period: string; status: string }[];
}

type HealthCategory = 'healthy' | 'needs_attention' | 'critical';
type HealthRangeFilter = 'all' | 'healthy' | 'needs_attention' | 'critical';

// ──────────────────────────────────────────────
// Color helpers
// ──────────────────────────────────────────────

function getHealthCategory(score: number): HealthCategory {
  if (score >= 80) return 'healthy';
  if (score >= 60) return 'needs_attention';
  return 'critical';
}

function getHealthColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

function getHealthTextColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function getHealthBgColor(score: number): string {
  if (score >= 80) return 'bg-emerald-50 dark:bg-emerald-950/40';
  if (score >= 60) return 'bg-amber-50 dark:bg-amber-950/40';
  return 'bg-red-50 dark:bg-red-950/40';
}

function getHealthBorderColor(score: number): string {
  if (score >= 80) return 'border-emerald-200 dark:border-emerald-800';
  if (score >= 60) return 'border-amber-200 dark:border-amber-800';
  return 'border-red-200 dark:border-red-800';
}

function getHealthLabel(score: number): string {
  if (score >= 80) return 'Healthy';
  if (score >= 60) return 'Needs Attention';
  return 'Critical';
}

function getHealthLabelColor(score: number): string {
  if (score >= 80) return 'text-emerald-700 dark:text-emerald-300';
  if (score >= 60) return 'text-amber-700 dark:text-amber-300';
  return 'text-red-700 dark:text-red-300';
}

function getHealthBadgeClasses(score: number): string {
  if (score >= 80) return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800';
  if (score >= 60) return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800';
  return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800';
}

function getFilingStatus(score: number): { label: string; color: string; icon: React.ReactNode } {
  if (score >= 80) return { label: 'On Track', color: 'text-emerald-600 dark:text-emerald-400', icon: <CheckCircle2 className="h-3.5 w-3.5" /> };
  if (score >= 60) return { label: 'At Risk', color: 'text-amber-600 dark:text-amber-400', icon: <AlertCircle className="h-3.5 w-3.5" /> };
  return { label: 'Overdue', color: 'text-red-600 dark:text-red-400', icon: <XCircle className="h-3.5 w-3.5" /> };
}

// ──────────────────────────────────────────────
// Circular Progress Gauge
// ──────────────────────────────────────────────

function CircularHealthGauge({
  value,
  size = 100,
  strokeWidth = 8,
  animated = true,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  animated?: boolean;
}) {
  const [displayValue, setDisplayValue] = useState(animated ? 0 : value);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayValue / 100) * circumference;
  const center = size / 2;
  const color = getHealthColor(value);

  useEffect(() => {
    if (!animated) return;
    const duration = 1200;
    const startTime = performance.now();
    let rafId: number;
    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(eased * value));
      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    }
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [value, animated]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-100 dark:text-slate-800"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-300"
          style={{ filter: `drop-shadow(0 0 4px ${color}40)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold ${getHealthTextColor(value)}`}>
          {Math.round(displayValue)}
        </span>
        <span className="text-[10px] text-muted-foreground font-medium">/100</span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Mini Sparkline
// ──────────────────────────────────────────────

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;

  const width = 80;
  const height = 28;
  const padding = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((val - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;

  return (
    <svg width={width} height={height} className="opacity-70">
      <defs>
        <linearGradient id={`sparkGrad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <polygon
        points={areaPoints}
        fill={`url(#sparkGrad-${color.replace('#', '')})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ──────────────────────────────────────────────
// Skeleton Loaders
// ──────────────────────────────────────────────

function KPISkeleton() {
  return (
    <Card>
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

function CardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────
// Indian States list
// ──────────────────────────────────────────────

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh',
];

// ──────────────────────────────────────────────
// Chart Config
// ──────────────────────────────────────────────

const healthTrendChartConfig = {
  score: { label: 'Health Score', color: '#10b981' },
};

// ──────────────────────────────────────────────
// Animation variants
// ──────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 260, damping: 24 },
  },
};

const kpiVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 26 },
  },
};

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────

export default function ClientHealthPage() {
  const { setCurrentView, setSelectedClientId } = useApp();

  // Data state — clients come from the shared, tenant-scoped useClients hook
  // so the orgId is always threaded into /api/clients?organizationId=….
  const { clients: rawClients, loading: clientsLoading, error: clientsError, refetch: refetchClients } = useClients();
  const clients: EnrichedClient[] = useMemo(() => rawClients as EnrichedClient[], [rawClients]);
  const loading = clientsLoading;
  const error = clientsError;

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [healthRangeFilter, setHealthRangeFilter] = useState<HealthRangeFilter>('all');

  // Detail dialog state
  const [selectedClient, setSelectedClient] = useState<ClientHealthDetail | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Refresh client list when the user clicks "Recalculate Score" so any newly
  // created clients appear immediately. The hook itself auto-caches, so this
  // is just a manual override.
  useEffect(() => {
    // no-op — useClients handles initial fetch via TanStack Query. This effect
    // exists only to surface `refetchClients` to the rest of the component via
    // the dependency array below if needed in the future.
  }, [refetchClients]);

  // ── Derived KPI counts ──────────────────────
  const kpiCounts = useMemo(() => {
    const total = clients.length;
    const healthy = clients.filter(c => c.healthScore >= 80).length;
    const atRisk = clients.filter(c => c.healthScore >= 40 && c.healthScore < 80).length;
    const critical = clients.filter(c => c.healthScore < 40).length;
    return { total, healthy, atRisk, critical };
  }, [clients]);

  // ── Unique states from clients ──────────────
  const availableStates = useMemo(() => {
    const states = new Set(clients.map(c => c.state).filter(Boolean) as string[]);
    return Array.from(states).sort();
  }, [clients]);

  // ── Filtered clients ────────────────────────
  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = client.tradeName.toLowerCase().includes(q);
        const matchGSTIN = client.gstin.toLowerCase().includes(q);
        const matchLegal = client.legalName?.toLowerCase().includes(q);
        if (!matchName && !matchGSTIN && !matchLegal) return false;
      }

      // State filter
      if (stateFilter !== 'all' && client.state !== stateFilter) return false;

      // Health range filter
      if (healthRangeFilter === 'healthy' && client.healthScore < 80) return false;
      if (healthRangeFilter === 'needs_attention' && (client.healthScore < 40 || client.healthScore >= 80)) return false;
      if (healthRangeFilter === 'critical' && client.healthScore >= 40) return false;

      return true;
    }).sort((a, b) => a.healthScore - b.healthScore);
  }, [clients, searchQuery, stateFilter, healthRangeFilter]);

  // ── Generate mock trend data for sparklines ──
  const clientTrendData = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const client of clients) {
      // Generate 6 points of trend data based on current health score
      const base = client.healthScore;
      const trend: number[] = [];
      for (let i = 0; i < 6; i++) {
        const variation = Math.floor(Math.random() * 16) - 8;
        trend.push(Math.max(0, Math.min(100, base + variation - (5 - i) * 1.5)));
      }
      map.set(client.id, trend);
    }
    return map;
  }, [clients]);

  // ── Fetch detail for dialog ─────────────────
  const handleViewDetails = useCallback(async (client: EnrichedClient) => {
    setSelectedClient(null);
    setDialogOpen(true);
    setDetailLoading(true);

    try {
      const [healthRes, issuesRes, filingsRes] = await Promise.all([
        fetch(`/api/health-score?clientId=${client.id}`),
        fetch(`/api/errors?clientId=${client.id}&limit=20`),
        fetch(`/api/gstr-filing?clientId=${client.id}`),
      ]);

      let healthTrend: HealthTrendPoint[] = [];
      let latestHealthScore: HealthScoreRecord | null = null;

      if (healthRes.ok) {
        const healthData = await healthRes.json();
        if (healthData.trend && healthData.trend.length > 0) {
          healthTrend = healthData.trend.map((t: { score: number; period?: string; createdAt: string }) => ({
            period: t.period || t.createdAt?.slice(0, 7) || 'Unknown',
            score: t.score,
          }));
        }
        if (healthData.latestScore) {
          latestHealthScore = healthData.latestScore;
        }
      }

      // If no trend from API, generate synthetic
      if (healthTrend.length === 0) {
        const trend = clientTrendData.get(client.id) || [];
        const months = ['Oct 2025', 'Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026', 'Mar 2026'];
        healthTrend = trend.map((score, i) => ({ period: months[i] || `M${i + 1}`, score }));
      }

      let issues: ClientHealthDetail['issues'] = [];
      if (issuesRes.ok) {
        const issuesData = await issuesRes.json();
        const rawIssues = issuesData.issues ?? issuesData ?? [];
        if (Array.isArray(rawIssues)) {
          issues = rawIssues.map((iss: { id: string; severity: string; category: string; title: string; status: string }) => ({
            id: iss.id,
            severity: iss.severity,
            category: iss.category,
            title: iss.title,
            status: iss.status,
          }));
        }
      }

      let pendingFilings: ClientHealthDetail['pendingFilings'] = [];
      if (filingsRes.ok) {
        const filingsData = await filingsRes.json();
        const rawFilings = filingsData.filings ?? filingsData ?? [];
        if (Array.isArray(rawFilings)) {
          pendingFilings = rawFilings
            .filter((f: { status: string }) => f.status !== 'filed')
            .map((f: { id: string; returnType: string; period: string; status: string }) => ({
              id: f.id,
              returnType: f.returnType,
              period: f.period,
              status: f.status,
            }));
        }
      }

      setSelectedClient({
        client,
        healthTrend,
        latestHealthScore,
        issues,
        pendingFilings,
      });
    } catch {
      // Even on error, show basic info
      const trend = clientTrendData.get(client.id) || [];
      const months = ['Oct 2025', 'Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026', 'Mar 2026'];
      setSelectedClient({
        client,
        healthTrend: trend.map((score, i) => ({ period: months[i] || `M${i + 1}`, score })),
        latestHealthScore: null,
        issues: [],
        pendingFilings: [],
      });
    } finally {
      setDetailLoading(false);
    }
  }, [clientTrendData]);

  // ── Navigate to client detail ───────────────
  const handleCardClick = (client: EnrichedClient) => {
    setSelectedClientId(client.id);
    setCurrentView('clients');
  };

  // ── Recommended actions generator ────────────
  function getRecommendedActions(detail: ClientHealthDetail): string[] {
    const actions: string[] = [];
    const score = detail.client.healthScore;

    if (score < 40) {
      actions.push('Urgently review all open critical issues');
      actions.push('Prioritize filing all overdue returns');
    }
    if (score < 60) {
      actions.push('Resolve pending filing delays to improve compliance');
      actions.push('Review GSTIN validation errors');
    }
    if (detail.issues.filter(i => i.severity === 'critical').length > 0) {
      actions.push(`Address ${detail.issues.filter(i => i.severity === 'critical').length} critical issue(s) immediately`);
    }
    if (detail.pendingFilings.length > 2) {
      actions.push('Batch file pending returns to reduce backlog');
    }
    if (detail.latestHealthScore && detail.latestHealthScore.duplicateInvoices > 0) {
      actions.push('Remove duplicate invoices before filing');
    }
    if (detail.latestHealthScore && detail.latestHealthScore.missingGstin > 0) {
      actions.push('Update missing GSTIN data in invoice records');
    }
    if (score >= 80) {
      actions.push('Continue maintaining excellent compliance');
      actions.push('Review and pre-validate next period invoices');
    }
    if (actions.length === 0) {
      actions.push('Run health check for latest period');
      actions.push('Review reconciliation matches');
    }
    return actions.slice(0, 5);
  }

  // ── Severity icon helper ────────────────────
  function SeverityIcon({ severity }: { severity: string }) {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Info className="h-4 w-4 text-sky-500" />;
    }
  }

  // ── Severity badge classes ──────────────────
  function severityBadgeClasses(severity: string): string {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800';
      case 'warning':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800';
      default:
        return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800';
    }
  }

  // ── Count issues by severity ────────────────
  function countIssuesBySeverity(client: EnrichedClient) {
    // Approximate from health score breakdown
    const score = client.healthScore;
    const critical = score < 40 ? Math.ceil((100 - score) / 20) : score < 60 ? 1 : 0;
    const warning = score < 80 ? Math.ceil((80 - score) / 15) : 0;
    const info = Math.max(0, Math.ceil((100 - score) / 25));
    return { critical, warning, info };
  }

  // ── Pending actions count ───────────────────
  function getPendingCount(client: EnrichedClient): number {
    const pending = client._aggregations?.pendingReturns ?? 0;
    const issues = client.healthScore < 60 ? Math.ceil((60 - client.healthScore) / 10) : 0;
    return pending + issues;
  }

  // ════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ── Page Header ───────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-700 to-teal-600 dark:from-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">
              Client Health Center
            </h1>
            <Badge className="gap-1.5 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Live Monitoring
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1.5">
            AI-Powered Compliance Health Monitoring
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-full sm:w-44 h-9 text-sm">
              <MapPin className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All States" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {availableStates.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={healthRangeFilter} onValueChange={(v) => setHealthRangeFilter(v as HealthRangeFilter)}>
            <SelectTrigger className="w-full sm:w-44 h-9 text-sm">
              <HeartPulse className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All Health" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Health Scores</SelectItem>
              <SelectItem value="healthy">Healthy (80-100)</SelectItem>
              <SelectItem value="needs_attention">At Risk (40-79)</SelectItem>
              <SelectItem value="critical">Critical (&lt;40)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* ── Summary Row: 4 KPI Cards ──────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <KPISkeleton key={i} />)}
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {/* Total Clients */}
          <motion.div variants={kpiVariants}>
            <Card className="hover:shadow-md transition-shadow relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground font-medium">Total Clients</p>
                    <p className="text-3xl font-bold text-slate-700 dark:text-slate-200">
                      {formatNumber(kpiCounts.total)}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      <span>Under monitoring</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-slate-100 dark:bg-slate-800">
                    <Users className="h-7 w-7 text-slate-600 dark:text-slate-300" />
                  </div>
                </div>
              </CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-500" />
            </Card>
          </motion.div>

          {/* Healthy Clients */}
          <motion.div variants={kpiVariants}>
            <Card className="hover:shadow-md transition-shadow relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground font-medium">Healthy Clients</p>
                    <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                      {formatNumber(kpiCounts.healthy)}
                    </p>
                    <div className="flex items-center gap-1 text-xs">
                      <TrendingUp className="h-3 w-3 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        {kpiCounts.total > 0 ? Math.round((kpiCounts.healthy / kpiCounts.total) * 100) : 0}% of total
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
                    <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
              </CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-500" />
            </Card>
          </motion.div>

          {/* At Risk Clients */}
          <motion.div variants={kpiVariants}>
            <Card className="hover:shadow-md transition-shadow relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground font-medium">At Risk Clients</p>
                    <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                      {formatNumber(kpiCounts.atRisk)}
                    </p>
                    <div className="flex items-center gap-1 text-xs">
                      <AlertCircle className="h-3 w-3 text-amber-500" />
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        Score 40-79
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-amber-50 dark:bg-amber-950/40">
                    <AlertTriangle className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
              </CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-amber-500" />
            </Card>
          </motion.div>

          {/* Critical Clients */}
          <motion.div variants={kpiVariants}>
            <Card className="hover:shadow-md transition-shadow relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground font-medium">Critical Clients</p>
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                      {formatNumber(kpiCounts.critical)}
                    </p>
                    <div className="flex items-center gap-1 text-xs">
                      <TrendingDown className="h-3 w-3 text-red-500" />
                      <span className="text-red-600 dark:text-red-400 font-medium">
                        Needs immediate action
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-red-50 dark:bg-red-950/40">
                    <ShieldAlert className="h-7 w-7 text-red-600 dark:text-red-400" />
                  </div>
                </div>
              </CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 to-red-500" />
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* ── Client Health Cards Grid ──────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : filteredClients.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 mb-4">
            <Search className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">No clients found</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Try adjusting your search query or filters to find the clients you are looking for.
          </p>
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {filteredClients.map(client => {
              const score = client.healthScore;
              const category = getHealthCategory(score);
              const sparkData = clientTrendData.get(client.id) || [];
              const issueCounts = countIssuesBySeverity(client);
              const pendingCount = getPendingCount(client);
              const filingStatus = getFilingStatus(score);
              const compliancePct = client._aggregations?.matchPercentage ?? (score >= 80 ? 95 : score >= 60 ? 75 : 45);

              return (
                <motion.div
                  key={client.id}
                  variants={cardVariants}
                  layout
                  exit={{ opacity: 0, scale: 0.95 }}
                  whileHover={{ y: -2 }}
                  transition={{ layout: { duration: 0.3 } }}
                >
                  <Card
                    className={`hover:shadow-lg transition-all duration-300 cursor-pointer group relative overflow-hidden border ${getHealthBorderColor(score)}`}
                    onClick={() => handleCardClick(client)}
                  >
                    {/* Subtle gradient background */}
                    <div className={`absolute inset-0 opacity-30 ${getHealthBgColor(score)}`} style={{ background: `linear-gradient(135deg, ${getHealthColor(score)}08 0%, transparent 60%)` }} />

                    <CardContent className="p-5 relative">
                      {/* Row 1: Health Gauge + Client Info */}
                      <div className="flex items-start gap-4 mb-4">
                        {/* Circular Health Gauge */}
                        <div className="shrink-0">
                          <CircularHealthGauge value={score} size={90} strokeWidth={7} />
                        </div>

                        {/* Client Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="font-semibold text-sm truncate text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                                {client.tradeName}
                              </h3>
                              <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                                {client.gstin}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            {client.state && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate max-w-[80px]">{client.state}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Tag className="h-3 w-3" />
                              <span className="capitalize">{client.entityType}</span>
                            </div>
                          </div>

                          {client.lastFilingDate && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Calendar className="h-3 w-3" />
                              <span>Last filed: {new Date(client.lastFilingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            </div>
                          )}

                          {/* Health Badge */}
                          <div className="mt-2">
                            <Badge variant="outline" className={`text-[10px] px-2 py-0 ${getHealthBadgeClasses(score)}`}>
                              {getHealthLabel(score)}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Row 2: Metric Pills */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {/* Compliance Score */}
                        <div className={`rounded-lg p-2.5 text-center ${getHealthBgColor(score)}`}>
                          <p className="text-xs text-muted-foreground mb-0.5">Compliance</p>
                          <p className={`text-sm font-bold ${getHealthTextColor(score)}`}>
                            {compliancePct}%
                          </p>
                        </div>

                        {/* Pending Actions */}
                        <div className="rounded-lg p-2.5 text-center bg-amber-50/80 dark:bg-amber-950/30">
                          <p className="text-xs text-muted-foreground mb-0.5">Pending</p>
                          <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
                            {pendingCount}
                          </p>
                        </div>

                        {/* Open Issues */}
                        <div className="rounded-lg p-2.5 text-center bg-red-50/80 dark:bg-red-950/30">
                          <p className="text-xs text-muted-foreground mb-0.5">Issues</p>
                          <div className="flex items-center justify-center gap-1">
                            {issueCounts.critical > 0 && (
                              <span className="text-xs font-bold text-red-600 dark:text-red-400">{issueCounts.critical}C</span>
                            )}
                            {issueCounts.warning > 0 && (
                              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{issueCounts.warning}W</span>
                            )}
                            {issueCounts.critical === 0 && issueCounts.warning === 0 && (
                              <span className="text-xs font-bold text-slate-500">0</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Row 3: Filing Status + Sparkline */}
                      <div className="flex items-center justify-between">
                        {/* Filing Status */}
                        <div className={`flex items-center gap-1.5 text-xs font-medium ${filingStatus.color}`}>
                          {filingStatus.icon}
                          <span>{filingStatus.label}</span>
                        </div>

                        {/* Mini Sparkline */}
                        {sparkData.length >= 2 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">6M</span>
                            <MiniSparkline data={sparkData} color={getHealthColor(score)} />
                          </div>
                        )}
                      </div>

                      {/* Row 4: View Details Button */}
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full h-8 text-xs gap-1.5 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:text-emerald-200 dark:hover:bg-emerald-950/50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(client);
                          }}
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Details
                          <ChevronRight className="h-3 w-3 ml-auto" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── Detail Dialog ─────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          {detailLoading ? (
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-24 w-24 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : selectedClient ? (
            <>
              <DialogHeader className="p-6 pb-0">
                <div className="flex items-center gap-4">
                  <CircularHealthGauge value={selectedClient.client.healthScore} size={80} strokeWidth={6} animated={false} />
                  <div>
                    <DialogTitle className="text-lg">{selectedClient.client.tradeName}</DialogTitle>
                    <DialogDescription className="font-mono text-xs mt-0.5">
                      {selectedClient.client.gstin}
                    </DialogDescription>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {selectedClient.client.state && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {selectedClient.client.state}
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Tag className="h-3 w-3" />
                        <span className="capitalize">{selectedClient.client.entityType}</span>
                      </div>
                      <Badge variant="outline" className={`text-[10px] px-2 py-0 ${getHealthBadgeClasses(selectedClient.client.healthScore)}`}>
                        {getHealthLabel(selectedClient.client.healthScore)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <ScrollArea className="flex-1 px-6 pb-6">
                <div className="space-y-5">
                  {/* Health Breakdown */}
                  {selectedClient.latestHealthScore && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                        <ListChecks className="h-4 w-4 text-emerald-600" />
                        Health Breakdown
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          { label: 'Missing GSTIN', value: selectedClient.latestHealthScore.missingGstin, color: 'text-red-600' },
                          { label: 'Invalid GSTIN', value: selectedClient.latestHealthScore.invalidGstin, color: 'text-red-600' },
                          { label: 'Duplicates', value: selectedClient.latestHealthScore.duplicateInvoices, color: 'text-amber-600' },
                          { label: 'Filing Delays', value: selectedClient.latestHealthScore.filingDelays, color: 'text-amber-600' },
                          { label: 'Validation Errors', value: selectedClient.latestHealthScore.validationErrors, color: 'text-amber-600' },
                        ].map(item => (
                          <div key={item.label} className="rounded-lg border border-border/50 p-2.5">
                            <p className="text-[10px] text-muted-foreground">{item.label}</p>
                            <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Health Trend Chart */}
                  {selectedClient.healthTrend.length > 1 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                        <Activity className="h-4 w-4 text-emerald-600" />
                        Health Trend
                      </h4>
                      <Card className="border-border/50">
                        <CardContent className="p-3">
                          <ChartContainer config={healthTrendChartConfig} className="h-48 w-full">
                            <AreaChart data={selectedClient.healthTrend}>
                              <defs>
                                <linearGradient id="healthTrendFill" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis
                                dataKey="period"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 10, fill: '#64748b' }}
                              />
                              <YAxis
                                domain={[0, 100]}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 10, fill: '#64748b' }}
                              />
                              <ChartTooltip content={<ChartTooltipContent />} />
                              <Area
                                type="monotone"
                                dataKey="score"
                                stroke="#10b981"
                                strokeWidth={2}
                                fill="url(#healthTrendFill)"
                              />
                            </AreaChart>
                          </ChartContainer>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Issues List */}
                  {selectedClient.issues.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                        <FileWarning className="h-4 w-4 text-amber-600" />
                        Open Issues ({selectedClient.issues.length})
                      </h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {selectedClient.issues.map(issue => (
                          <div
                            key={issue.id}
                            className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors"
                          >
                            <SeverityIcon severity={issue.severity} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{issue.title}</p>
                              <p className="text-[10px] text-muted-foreground">{issue.category}</p>
                            </div>
                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 shrink-0 ${severityBadgeClasses(issue.severity)}`}>
                              {issue.severity}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pending Filings */}
                  {selectedClient.pendingFilings.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-amber-600" />
                        Pending Filings ({selectedClient.pendingFilings.length})
                      </h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {selectedClient.pendingFilings.map(filing => (
                          <div
                            key={filing.id}
                            className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors"
                          >
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium">{filing.returnType}</p>
                              <p className="text-[10px] text-muted-foreground">
                                Period: {filing.period ? periodToLabel(filing.period) : 'N/A'}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                              {filing.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommended Actions */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      Recommended Actions
                    </h4>
                    <div className="space-y-1.5">
                      {getRecommendedActions(selectedClient).map((action, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50"
                        >
                          <CircleDot className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                          <p className="text-xs text-foreground">{action}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                      size="sm"
                      onClick={() => {
                        setDialogOpen(false);
                        setSelectedClientId(selectedClient.client.id);
                        setCurrentView('gstr-filing');
                      }}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Prepare Filing
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950 gap-1.5"
                      size="sm"
                      onClick={async () => {
                        try {
                          await fetch('/api/health-score', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ clientId: selectedClient.client.id }),
                          });
                          // Refresh the tenant-scoped client list so the
                          // updated health score appears immediately.
                          refetchClients();
                        } catch { /* ignore */ }
                        setDialogOpen(false);
                      }}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Recalculate Score
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
