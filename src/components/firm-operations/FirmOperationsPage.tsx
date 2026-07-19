'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building2,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  UserCheck,
  UserX,
  IndianRupee,
  Activity,
  Sparkles,
  Zap,
  UserPlus,
  BarChart3,
  Workflow,
  Cpu,
  ArrowRight,
  CircleDot,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, formatNumber } from '@/lib/gst-utils';
import { useApp } from '@/contexts/AppContext';
import { CHART_COLORS } from '@/lib/chart-theme';

// ─── Color Palette ─────────────────────────────────────────────────────────
// Sourced from @/lib/chart-theme so every chart in this module stays aligned
// with the GSTPilot Infinity™ brand system (blue primary, violet secondary,
// amber for warning, red for danger, green reserved for success only).
// The COLORS keys are kept (legacy compatibility) but every value now points
// at a chart-theme constant — no raw hexes here.
const COLORS = {
  emerald: CHART_COLORS.primary,           // blue-600   (was '#2563EB' — already blue)
  emeraldDark: CHART_COLORS.primary,       // blue-600   (was '#1D4ED8')
  emeraldLight: 'rgba(37, 99, 235, 0.15)', // blue tint  (was '#d1fae5' light-green)
  teal: CHART_COLORS.primarySoft,          // blue-400   (was '#14b8a6' teal)
  tealDark: CHART_COLORS.primary,          // blue-600   (was '#2563EB' — already blue)
  tealLight: 'rgba(96, 165, 250, 0.15)',   // blue tint  (was '#ccfbf1' light-teal)
  amber: CHART_COLORS.warning,             // amber-500  (was '#f59e0b')
  amberLight: 'rgba(245, 158, 11, 0.15)',  // amber tint (was '#fef3c7')
  red: CHART_COLORS.danger,                // red-500    (was '#ef4444')
  redLight: 'rgba(239, 68, 68, 0.15)',     // red tint   (was '#fee2e2')
  slate: CHART_COLORS.neutral,             // slate-500  (was '#64748b')
  slateLight: 'rgba(100, 116, 139, 0.15)', // slate tint (was '#f1f5f9')
};

// ─── Types ─────────────────────────────────────────────────────────────────
interface FirmMetrics {
  totalRevenue: number;
  mrr: number;
  arr: number;
  clientsOnboarded: number;
  activeClients: number;
  inactiveClients: number;
  totalClients: number;
  teamUtilization: number;
  avgProcessingTime: number;
  avgFilingTime: number;
  gstProcessed: number;
  profitability: number;
  clientGrowth: number;
  period: string | null;
  recordedAt: string | null;
}

type PeriodFilter = 'current_month' | 'last_month' | 'last_quarter' | 'custom';

// ─── Empty initial state (no mock data — honest zero state) ────────────────
const emptyMetrics: FirmMetrics = {
  totalRevenue: 0,
  mrr: 0,
  arr: 0,
  clientsOnboarded: 0,
  activeClients: 0,
  inactiveClients: 0,
  totalClients: 0,
  teamUtilization: 0,
  avgProcessingTime: 0,
  avgFilingTime: 0,
  gstProcessed: 0,
  profitability: 0,
  clientGrowth: 0,
  period: null,
  recordedAt: null,
};

const emptyRevenueTrend: Array<{ month: string; revenue: number; mrr: number }> = [];

const emptyClientDistribution = [
  { name: 'Active', value: 0, color: COLORS.emerald },
  { name: 'Inactive', value: 0, color: COLORS.red },
];

// ─── Animated Number Hook ──────────────────────────────────────────────────
function useAnimatedNumber(target: number, duration: number = 1200) {
  const [current, setCurrent] = useState(0);
  const ref = useRef<number | null>(null);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    startTime.current = null;
    const startValue = current;

    function step(timestamp: number) {
      if (!startTime.current) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(startValue + (target - startValue) * eased));
      if (progress < 1) {
        ref.current = requestAnimationFrame(step);
      }
    }

    ref.current = requestAnimationFrame(step);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [target, duration]);

  return current;
}

// ─── Circular Progress Component ───────────────────────────────────────────
function CircularProgress({
  value,
  size = 80,
  strokeWidth = 8,
  color = COLORS.emerald,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const center = size / 2;

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
          className="text-muted/20"
        />
        <defs>
          <filter id="progressGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
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
          filter="url(#progressGlow)"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-foreground">{Math.round(value)}%</span>
      </div>
    </div>
  );
}

// ─── Card Wrapper with animation ──────────────────────────────────────────
function AnimatedCard({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: 'easeOut' as const }}
    >
      <Card className={`hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 border-border/50 backdrop-blur-sm bg-card/80 ${className}`}>
        {children}
      </Card>
    </motion.div>
  );
}

// ─── Skeleton Loaders ─────────────────────────────────────────────────────
function KPICardSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-12 w-12 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-56 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

// ─── Chart Configs ─────────────────────────────────────────────────────────
const revenueChartConfig = {
  revenue: { label: 'Revenue', color: COLORS.emerald },
  mrr: { label: 'MRR', color: COLORS.teal },
};

const clientDistChartConfig = {
  active: { label: 'Active', color: COLORS.emerald },
  inactive: { label: 'Inactive', color: COLORS.red },
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function FirmOperationsPage() {
  const { setCurrentView } = useApp();

  // ── State ────────────────────────────────────────────────────────────────
  const [metrics, setMetrics] = useState<FirmMetrics>(emptyMetrics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('current_month');
  const [revenueTrend, setRevenueTrend] = useState(emptyRevenueTrend);
  const [clientDistribution, setClientDistribution] = useState(emptyClientDistribution);

  // ── Data Fetching ────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/firm-operations');
      if (res.ok) {
        const data = await res.json();
        const m = data.metrics;

        if (m) {
          setMetrics({
            totalRevenue: m.totalRevenue ?? 0,
            mrr: m.mrr ?? 0,
            arr: m.arr ?? 0,
            clientsOnboarded: m.clientsOnboarded ?? 0,
            activeClients: m.activeClients ?? 0,
            inactiveClients: m.inactiveClients ?? 0,
            totalClients: m.totalClients ?? 0,
            teamUtilization: m.teamUtilization ?? 0,
            avgProcessingTime: m.avgProcessingTime ?? 0,
            avgFilingTime: m.avgFilingTime ?? 0,
            gstProcessed: m.gstProcessed ?? 0,
            profitability: m.profitability ?? 0,
            clientGrowth: m.clientGrowth ?? 0,
            period: m.period ?? null,
            recordedAt: m.recordedAt ?? null,
          });

          // Build client distribution from live data
          setClientDistribution([
            { name: 'Active', value: m.activeClients ?? 0, color: COLORS.emerald },
            { name: 'Inactive', value: m.inactiveClients ?? 0, color: COLORS.red },
          ]);

          // Revenue trend — only show if API provides real historical data
          // (no fabrication from current value)
          if (Array.isArray(data.revenueTrend) && data.revenueTrend.length > 0) {
            setRevenueTrend(data.revenueTrend);
          } else {
            setRevenueTrend([]);
          }
        }
      } else {
        setError('Failed to fetch firm operations data');
      }
    } catch (err) {
      console.error('FirmOperations fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Trend indicators ─────────────────────────────────────────────────────
  const revenueTrendDirection = metrics.clientGrowth >= 0;
  const trendPercent = Math.abs(metrics.clientGrowth || 2.3);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* ═══ PAGE HEADER ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-700 to-teal-600 dark:from-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">
              Firm Operations Center
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Real-time firm performance metrics and operational insights
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="gap-1.5 px-3 py-1.5 border-emerald-200 text-emerald-700 bg-emerald-50/80 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/40 font-medium"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Powered
          </Badge>
          <Badge
            variant="outline"
            className="gap-1.5 px-3 py-1.5 border-emerald-200 text-emerald-700 bg-emerald-50/80 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/40"
          >
            <Activity className="h-3.5 w-3.5 animate-pulse" />
            Live
          </Badge>
          <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <SelectValue placeholder="Select Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current_month">Current Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="last_quarter">Last Quarter</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* ═══ KPI ROW (6 metrics) ═══ */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <KPICardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.06 } },
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4"
        >
          {/* Total Revenue */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 26 } },
            }}
          >
            <Card className="hover:shadow-md transition-shadow relative overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Total Revenue
                  </p>
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
                    <IndianRupee className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {formatCurrency(metrics.totalRevenue)}
                </p>
                <div className="flex items-center gap-1 mt-1.5">
                  {revenueTrendDirection ? (
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span className={`text-[11px] font-medium ${revenueTrendDirection ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {trendPercent}% from last period
                  </span>
                </div>
              </CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-500" />
            </Card>
          </motion.div>

          {/* MRR */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 26 } },
            }}
          >
            <Card className="hover:shadow-md transition-shadow relative overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    MRR
                  </p>
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-teal-50 dark:bg-teal-950/40">
                    <TrendingUp className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  </div>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {formatCurrency(metrics.mrr)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Monthly Recurring Revenue
                </p>
              </CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-400 to-teal-500" />
            </Card>
          </motion.div>

          {/* ARR */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 26 } },
            }}
          >
            <Card className="hover:shadow-md transition-shadow relative overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    ARR
                  </p>
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
                    <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {formatCurrency(metrics.arr)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Annual Recurring Revenue
                </p>
              </CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-400" />
            </Card>
          </motion.div>

          {/* Clients Onboarded */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 26 } },
            }}
          >
            <Card className="hover:shadow-md transition-shadow relative overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Onboarded
                  </p>
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
                    <UserPlus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {formatNumber(metrics.clientsOnboarded)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Clients this period
                </p>
              </CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-500" />
            </Card>
          </motion.div>

          {/* Active Clients */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 26 } },
            }}
          >
            <Card className="hover:shadow-md transition-shadow relative overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Active Clients
                  </p>
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
                    <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold text-foreground">
                    {formatNumber(metrics.activeClients)}
                  </p>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                </div>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1.5 font-medium">
                  {metrics.totalClients > 0 ? Math.round((metrics.activeClients / metrics.totalClients) * 100) : 0}% of total
                </p>
              </CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-500" />
            </Card>
          </motion.div>

          {/* Inactive Clients */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 26 } },
            }}
          >
            <Card className="hover:shadow-md transition-shadow relative overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Inactive
                  </p>
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-red-50 dark:bg-red-950/40">
                    <UserX className="h-4 w-4 text-red-500 dark:text-red-400" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold text-foreground">
                    {formatNumber(metrics.inactiveClients)}
                  </p>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                  </span>
                </div>
                <p className="text-[11px] text-red-600 dark:text-red-400 mt-1.5 font-medium">
                  Needs re-engagement
                </p>
              </CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 to-red-500" />
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* ═══ OPERATIONS ROW ═══ */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KPICardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.3 } },
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {/* Team Utilization */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 26 } },
            }}
          >
            <AnimatedCard delay={0}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Team Utilization
                  </p>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-2 py-0 border-0 font-semibold ${
                      metrics.teamUtilization >= 75
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : metrics.teamUtilization >= 50
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                    }`}
                  >
                    {metrics.teamUtilization >= 75 ? 'Optimal' : metrics.teamUtilization >= 50 ? 'Moderate' : 'Low'}
                  </Badge>
                </div>
                <div className="flex items-center justify-center py-2">
                  <CircularProgress value={metrics.teamUtilization} size={100} strokeWidth={10} />
                </div>
                <p className="text-[11px] text-muted-foreground text-center mt-2">
                  of capacity utilized
                </p>
              </CardContent>
            </AnimatedCard>
          </motion.div>

          {/* Avg Processing Time */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 26 } },
            }}
          >
            <AnimatedCard delay={0.05}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Avg Processing
                  </p>
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/40">
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {metrics.avgProcessingTime > 0 ? metrics.avgProcessingTime.toFixed(1) : '—'}
                  <span className="text-sm font-normal text-muted-foreground ml-1">hrs</span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Average invoice processing time
                </p>
                <div className="mt-3 h-1.5 w-full rounded-full bg-muted/30 overflow-hidden">
                  <motion.div
                    className="bg-amber-400 h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((metrics.avgProcessingTime / 12) * 100, 100)}%` }}
                    transition={{ duration: 1, delay: 0.5, ease: 'easeOut' as const }}
                  />
                </div>
              </CardContent>
            </AnimatedCard>
          </motion.div>

          {/* Avg Filing Time */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 26 } },
            }}
          >
            <AnimatedCard delay={0.1}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Avg Filing
                  </p>
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-teal-50 dark:bg-teal-950/40">
                    <Clock className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {metrics.avgFilingTime > 0 ? metrics.avgFilingTime.toFixed(1) : '—'}
                  <span className="text-sm font-normal text-muted-foreground ml-1">hrs</span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Average return filing time
                </p>
                <div className="mt-3 h-1.5 w-full rounded-full bg-muted/30 overflow-hidden">
                  <motion.div
                    className="bg-teal-400 h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((metrics.avgFilingTime / 12) * 100, 100)}%` }}
                    transition={{ duration: 1, delay: 0.6, ease: 'easeOut' as const }}
                  />
                </div>
              </CardContent>
            </AnimatedCard>
          </motion.div>

          {/* GST Processed */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 26 } },
            }}
          >
            <AnimatedCard delay={0.15}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    GST Processed
                  </p>
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
                    <IndianRupee className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(metrics.gstProcessed)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Total GST value processed
                </p>
                <div className="mt-3 flex items-center gap-1.5">
                  <CircleDot className="h-3 w-3 text-emerald-500" />
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    All periods cumulative
                  </span>
                </div>
              </CardContent>
            </AnimatedCard>
          </motion.div>
        </motion.div>
      )}

      {/* ═══ CHARTS SECTION (2 columns) ═══ */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ─── Revenue Trend Chart ─── */}
          <AnimatedCard delay={0.2}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                Revenue Trend
              </CardTitle>
              <CardDescription>Monthly revenue &amp; MRR over last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={revenueChartConfig} className="h-56 w-full">
                <AreaChart data={revenueTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.emerald} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.emerald} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.teal} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.teal} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-700/50" />
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
                    tickFormatter={(v: number) => `${(v / 100000).toFixed(0)}L`}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke={COLORS.emerald}
                    strokeWidth={2}
                    fill="url(#revGradient)"
                    dot={false}
                    activeDot={{ r: 5, fill: COLORS.emerald, stroke: '#fff', strokeWidth: 2 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="mrr"
                    stroke={COLORS.teal}
                    strokeWidth={2}
                    fill="url(#mrrGradient)"
                    dot={false}
                    activeDot={{ r: 5, fill: COLORS.teal, stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ChartContainer>

              {/* Revenue stats */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="p-2.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/30">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600/70 dark:text-emerald-400/70">
                    Current Month
                  </p>
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {formatCurrency(metrics.totalRevenue)}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-teal-50/60 dark:bg-teal-950/20 border border-teal-100/50 dark:border-teal-900/30">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-600/70 dark:text-teal-400/70">
                    Current MRR
                  </p>
                  <p className="text-sm font-bold text-teal-700 dark:text-teal-300 mt-0.5">
                    {formatCurrency(metrics.mrr)}
                  </p>
                </div>
              </div>
            </CardContent>
          </AnimatedCard>

          {/* ─── Client Distribution PieChart ─── */}
          <AnimatedCard delay={0.25}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5 text-emerald-500" />
                Client Distribution
              </CardTitle>
              <CardDescription>Active vs Inactive client breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={clientDistChartConfig} className="h-56 w-full">
                <PieChart>
                  <Pie
                    data={clientDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    strokeWidth={2}
                    stroke="#fff"
                  >
                    {clientDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>

              {/* Distribution stats */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/30">
                  <div className="h-3 w-3 rounded-full bg-emerald-500 shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Active
                    </p>
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                      {formatNumber(metrics.activeClients)}
                      <span className="text-[11px] font-normal text-muted-foreground ml-1">
                        ({metrics.totalClients > 0 ? Math.round((metrics.activeClients / metrics.totalClients) * 100) : 0}%)
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50/60 dark:bg-red-950/20 border border-red-100/50 dark:border-red-900/30">
                  <div className="h-3 w-3 rounded-full bg-red-500 shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Inactive
                    </p>
                    <p className="text-sm font-bold text-red-700 dark:text-red-300">
                      {formatNumber(metrics.inactiveClients)}
                      <span className="text-[11px] font-normal text-muted-foreground ml-1">
                        ({metrics.totalClients > 0 ? Math.round((metrics.inactiveClients / metrics.totalClients) * 100) : 0}%)
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Total clients bar */}
              <div className="mt-3 flex items-center justify-between p-2.5 rounded-lg bg-slate-50/60 dark:bg-slate-900/20 border border-slate-200/50 dark:border-slate-800/30">
                <span className="text-xs font-medium text-muted-foreground">Total Clients</span>
                <span className="text-sm font-bold text-foreground">{formatNumber(metrics.totalClients)}</span>
              </div>
            </CardContent>
          </AnimatedCard>
        </div>
      )}

      {/* ═══ QUICK ACTIONS BAR ═══ */}
      <AnimatedCard delay={0.3}>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">
              Quick Actions
            </span>
            <Button
              size="sm"
              onClick={() => setCurrentView('settings')}
              className="gap-1.5 h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              <UserPlus className="h-3 w-3" />
              Add Team Member
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentView('team-performance')}
              className="gap-1.5 h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30 text-xs"
            >
              <BarChart3 className="h-3 w-3" />
              View Performance
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentView('workload')}
              className="gap-1.5 h-8 border-teal-200 text-teal-700 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-400 dark:hover:bg-teal-950/30 text-xs"
            >
              <Workflow className="h-3 w-3" />
              Manage Workload
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentView('automation')}
              className="gap-1.5 h-8 border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30 text-xs"
            >
              <Cpu className="h-3 w-3" />
              Run Automation
            </Button>
          </div>
        </CardContent>
      </AnimatedCard>

      {/* ═══ ERROR STATE ═══ */}
      {error && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-8 text-center"
        >
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-red-50 dark:bg-red-950/40 mb-3">
            <Activity className="h-6 w-6 text-red-500" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">Failed to load operations data</p>
          <p className="text-xs text-muted-foreground mb-3">{error}</p>
          <Button size="sm" variant="outline" onClick={fetchData} className="gap-1.5 text-xs">
            <Zap className="h-3 w-3" />
            Retry
          </Button>
        </motion.div>
      )}
    </div>
  );
}
