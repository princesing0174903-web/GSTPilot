'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Users,
  BarChart3,
  Target,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Lightbulb,
  Activity,
  Zap,
  Shield,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, formatNumber } from '@/lib/gst-utils';
import { EmptyState } from '@/components/shared/EmptyState';
import { Lightbulb as LightbulbIcon } from 'lucide-react';
import { CHART_COLORS } from '@/lib/chart-theme';

// ─── Color Palette ────────────────────────────────────────────────────────
// Sourced from @/lib/chart-theme so every chart in this module stays aligned
// with the GSTPilot Infinity™ brand system (blue primary, violet secondary,
// amber for warning, red for danger, green reserved for success only).
// The COLORS keys are kept (legacy compatibility) but every value now points
// at a chart-theme constant — no raw hexes here.
const COLORS = {
  emerald: CHART_COLORS.primary,        // blue-600   (was '#2563EB' — already blue)
  emeraldDark: CHART_COLORS.primary,    // blue-600   (was '#1D4ED8')
  emeraldLight: 'rgba(16, 185, 129, 0.15)', // emerald tint (was '#d1fae5' light-green)
  teal: CHART_COLORS.primarySoft,       // blue-400   (was '#14b8a6' teal)
  tealDark: CHART_COLORS.primary,       // blue-600   (was '#2563EB' — already blue)
  purple: CHART_COLORS.secondary,       // violet-500 (was '#8b5cf6' — kept)
  purpleLight: 'rgba(6, 182, 212, 0.15)', // cyan tint (was '#ede9fe')
  amber: CHART_COLORS.warning,          // amber-500  (was '#f59e0b')
  red: CHART_COLORS.danger,             // red-500    (was '#ef4444')
  slate: CHART_COLORS.neutral,          // slate-500  (was '#64748b')
  cyan: CHART_COLORS.primarySoft,       // blue-400   (was '#3B82F6')
  rose: CHART_COLORS.danger,            // red-500    (was '#f43f5e')
};

// ─── Types ─────────────────────────────────────────────────────────────────
interface MonthlyRevenue {
  period: string;
  totalRevenue: number;
}

interface ClientGrowthEntry {
  month: string;
  count: number;
}

interface EmployeeProductivityEntry {
  id: string;
  name: string;
  period: string;
  invoicesProcessed: number;
  reviewsCompleted: number;
  approvalsCompleted: number;
  averageAccuracy: number;
  averageTurnaround: number;
  totalActions: number;
  score: number;
}

interface AnalyticsData {
  monthlyRevenue: MonthlyRevenue[];
  clientGrowth: ClientGrowthEntry[];
  gstProcessed: number;
  teamUtilization: number;
  profitability: number;
  activeClients: number;
  employeeProductivity: EmployeeProductivityEntry[];
  aiInsights: string[];
}

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

// ─── Animated Card Wrapper ─────────────────────────────────────────────────
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
function KPISkeleton() {
  return (
    <div className="p-4 rounded-xl border border-border/30">
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-24" />
        </div>
      </div>
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="space-y-4 p-2">
      <Skeleton className="h-52 w-full rounded-lg" />
    </div>
  );
}

function InsightSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl">
      <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

// ─── Insight Icon Map ──────────────────────────────────────────────────────
function InsightIcon({ icon, color }: { icon: string; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40',
    amber: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40',
    red: 'text-red-500 bg-red-50 dark:bg-red-950/40',
    purple: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/40',
  };
  const cls = colorMap[color] || colorMap.emerald;

  const iconMap: Record<string, React.ReactNode> = {
    'trending-up': <TrendingUp className="h-4 w-4" />,
    'trending-down': <TrendingDown className="h-4 w-4" />,
    alert: <AlertTriangle className="h-4 w-4" />,
    lightbulb: <Lightbulb className="h-4 w-4" />,
  };

  return (
    <div className={`flex items-center justify-center h-8 w-8 rounded-lg shrink-0 ${cls}`}>
      {iconMap[icon] || <Lightbulb className="h-4 w-4" />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function ExecutiveAnalyticsPage() {
  // ── State ────────────────────────────────────────────────────────────────
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('monthly');

  // ── Fetch data ───────────────────────────────────────────────────────────
  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/executive-analytics');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setError('Failed to fetch analytics data');
      }
    } catch (err) {
      console.error('ExecutiveAnalytics fetch error:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // ── Derived / Enriched Data ──────────────────────────────────────────────
  const revenueData = (data?.monthlyRevenue?.length ?? 0) > 0
    ? data!.monthlyRevenue.map((r, i) => ({
        month: r.period?.slice(5) || r.period?.slice(0, 3) || `M${i + 1}`,
        totalRevenue: r.totalRevenue,
        period: r.period,
      }))
    : [];

  const clientGrowthData = (data?.clientGrowth?.length ?? 0) > 0
    ? data!.clientGrowth.map((c, i) => ({
        month: c.month?.slice(5) || c.month?.slice(0, 3) || `M${i + 1}`,
        newClients: i === 0 ? c.count : c.count - (data!.clientGrowth[i - 1]?.count ?? 0),
        count: c.count,
      }))
    : [];

  const gstData: Array<{ month: string; cgst: number; sgst: number; igst: number }> = [];

  const productivityData = (data?.employeeProductivity?.length ?? 0) > 0
    ? (() => {
        const deptMap: Record<string, { accuracy: number[]; speed: number[]; volume: number[]; reviews: number[] }> = {};
        data!.employeeProductivity.forEach((p) => {
          const dept = p.period || 'General';
          if (!deptMap[dept]) deptMap[dept] = { accuracy: [], speed: [], volume: [], reviews: [] };
          deptMap[dept].accuracy.push(p.averageAccuracy);
          deptMap[dept].speed.push(100 - p.averageTurnaround);
          deptMap[dept].volume.push(Math.min(p.invoicesProcessed, 100));
          deptMap[dept].reviews.push(p.reviewsCompleted + p.approvalsCompleted);
        });
        return Object.entries(deptMap).map(([dept, vals]) => ({
          department: dept,
          accuracy: Math.round(vals.accuracy.reduce((a, b) => a + b, 0) / vals.accuracy.length),
          speed: Math.round(vals.speed.reduce((a, b) => a + b, 0) / vals.speed.length),
          volume: Math.round(vals.volume.reduce((a, b) => a + b, 0) / vals.volume.length),
          reviews: Math.min(100, Math.round(vals.reviews.reduce((a, b) => a + b, 0) / vals.reviews.length)),
        }));
      })()
    : [];

  const aiInsights = (data?.aiInsights?.length ?? 0) > 0
    ? data!.aiInsights.map((text, i) => ({
        id: String(i + 1),
        icon: 'lightbulb',
        color: 'emerald',
        text,
        confidence: 0,
        action: 'Review',
      }))
    : [];

  // ── KPI values ───────────────────────────────────────────────────────────
  const monthlyRevenue = revenueData.length > 0 ? revenueData[revenueData.length - 1]?.totalRevenue ?? 0 : 0;
  const clientGrowthPct = clientGrowthData.length >= 2
    ? (() => {
        const prev = clientGrowthData[clientGrowthData.length - 2]?.count ?? 0;
        const curr = clientGrowthData[clientGrowthData.length - 1]?.count ?? 0;
        return prev > 0 ? ((curr - prev) / prev) * 100 : 0;
      })()
    : 0;
  const gstProcessed = data?.gstProcessed ?? 0;
  const teamProductivity = data?.teamUtilization ?? 0;
  const profitability = data?.profitability ?? 0;

  const animRevenue = useAnimatedNumber(Math.round(monthlyRevenue / 1000), 1500);
  const animGst = useAnimatedNumber(Math.round(gstProcessed / 1000), 1500);
  const animProductivity = useAnimatedNumber(Math.round(teamProductivity), 1200);
  const animProfitability = useAnimatedNumber(Math.round(profitability * 10), 1200);

  // ── Chart configs ────────────────────────────────────────────────────────
  const revenueChartConfig = {
    totalRevenue: { label: 'Revenue', color: COLORS.emerald },
  };

  const clientChartConfig = {
    newClients: { label: 'New Clients', color: COLORS.emerald },
    count: { label: 'Total Clients', color: COLORS.teal },
  };

  const gstChartConfig = {
    cgst: { label: 'CGST', color: COLORS.emerald },
    sgst: { label: 'SGST', color: COLORS.teal },
    igst: { label: 'IGST', color: COLORS.purple },
  };

  const productivityChartConfig = {
    accuracy: { label: 'Accuracy', color: COLORS.emerald },
    speed: { label: 'Speed', color: COLORS.teal },
    volume: { label: 'Volume', color: COLORS.purple },
    reviews: { label: 'Reviews', color: COLORS.amber },
  };

  // ── Period comparison ─────────────────────────────────────────────────────
  const revenueChange = revenueData.length >= 2
    ? (() => {
        const prev = revenueData[revenueData.length - 2]?.totalRevenue ?? 0;
        const curr = revenueData[revenueData.length - 1]?.totalRevenue ?? 0;
        return prev > 0 ? ((curr - prev) / prev) * 100 : 0;
      })()
    : 0;
  const clientChange = clientGrowthPct;
  const filingEfficiencyChange = 0;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* ═══ HEADER ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-600/20">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Executive Analytics
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Comprehensive business intelligence and AI-powered insights
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
          <Badge
            variant="outline"
            className="gap-1.5 px-3 py-1.5 border-emerald-200 text-emerald-700 bg-emerald-50/80 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/40 font-medium"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Insights
          </Badge>
        </div>
      </motion.div>

      {/* ═══ KPI ROW ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Monthly Revenue */}
        <AnimatedCard delay={0.05}>
          <CardContent className="p-4">
            {loading ? (
              <KPISkeleton />
            ) : (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50">
                    <IndianRupee className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Monthly Revenue
                    </p>
                    <p className="text-xl font-bold text-foreground">
                      ₹{formatNumber(animRevenue * 1000)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {revenueChange >= 0 ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                  )}
                  <span className={`text-xs font-semibold ${revenueChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {revenueChange >= 0 ? '+' : ''}{revenueChange.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-muted-foreground">vs last period</span>
                </div>
              </>
            )}
          </CardContent>
        </AnimatedCard>

        {/* Client Growth */}
        <AnimatedCard delay={0.1}>
          <CardContent className="p-4">
            {loading ? (
              <KPISkeleton />
            ) : (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-900/50">
                    <Users className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Client Growth
                    </p>
                    <p className="text-xl font-bold text-foreground">
                      {clientChange >= 0 ? '+' : ''}{clientChange.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {clientChange >= 0 ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {data?.activeClients ?? 0} active clients
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </AnimatedCard>

        {/* GST Processed */}
        <AnimatedCard delay={0.15}>
          <CardContent className="p-4">
            {loading ? (
              <KPISkeleton />
            ) : (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-100 dark:border-cyan-900/50">
                    <BarChart3 className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      GST Processed
                    </p>
                    <p className="text-xl font-bold text-foreground">
                      ₹{formatNumber(animGst * 1000)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-cyan-500" />
                  <span className="text-[10px] text-muted-foreground">
                    This fiscal year
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </AnimatedCard>

        {/* Team Productivity */}
        <AnimatedCard delay={0.2}>
          <CardContent className="p-4">
            {loading ? (
              <KPISkeleton />
            ) : (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/50">
                    <Target className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Team Productivity
                    </p>
                    <p className="text-xl font-bold text-foreground">
                      {animProductivity}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {teamProductivity > 75 ? (
                    <Shield className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {teamProductivity > 75 ? 'Healthy range' : 'Below target'}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </AnimatedCard>

        {/* Profitability Margin */}
        <AnimatedCard delay={0.25}>
          <CardContent className="p-4">
            {loading ? (
              <KPISkeleton />
            ) : (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50">
                    <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Profitability
                    </p>
                    <p className="text-xl font-bold text-foreground">
                      {(animProfitability / 10).toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {profitability > 20 ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5 text-amber-500" />
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {profitability > 20 ? 'Strong margins' : 'Review pricing'}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </AnimatedCard>
      </div>

      {/* ═══ CHARTS GRID (2x2) ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ─── 1. Monthly Revenue - AreaChart ─── */}
        <AnimatedCard delay={0.3}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Monthly Revenue
            </CardTitle>
            <CardDescription>Revenue trend over the past 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton />
            ) : (
              <ChartContainer config={revenueChartConfig} className="h-64 w-full">
                <AreaChart data={revenueData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.emerald} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.emerald} stopOpacity={0} />
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
                    tickFormatter={(v: number) => `₹${(v / 100000).toFixed(0)}L`}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="totalRevenue"
                    stroke={COLORS.emerald}
                    strokeWidth={2.5}
                    fill="url(#revenueGradient)"
                    dot={false}
                    activeDot={{ r: 5, fill: COLORS.emerald, stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </AnimatedCard>

        {/* ─── 2. Client Growth - BarChart ─── */}
        <AnimatedCard delay={0.35}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-teal-500" />
              Client Growth
            </CardTitle>
            <CardDescription>New clients acquired per month</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton />
            ) : (
              <ChartContainer config={clientChartConfig} className="h-64 w-full">
                <BarChart data={clientGrowthData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="newClients"
                    fill={COLORS.emerald}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </AnimatedCard>

        {/* ─── 3. GST Processed - LineChart ─── */}
        <AnimatedCard delay={0.4}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5 text-cyan-500" />
              GST Processed
            </CardTitle>
            <CardDescription>CGST, SGST & IGST breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton />
            ) : (
              <ChartContainer config={gstChartConfig} className="h-64 w-full">
                <LineChart data={gstData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
                    tickFormatter={(v: number) => `₹${(v / 100000).toFixed(0)}L`}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="cgst"
                    stroke={COLORS.emerald}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: COLORS.emerald, stroke: '#fff', strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sgst"
                    stroke={COLORS.teal}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: COLORS.teal, stroke: '#fff', strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="igst"
                    stroke={COLORS.purple}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: COLORS.purple, stroke: '#fff', strokeWidth: 2 }}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </AnimatedCard>

        {/* ─── 4. Employee Productivity - RadarChart ─── */}
        <AnimatedCard delay={0.45}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-5 w-5 text-amber-500" />
              Employee Productivity
            </CardTitle>
            <CardDescription>Department performance comparison</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton />
            ) : (
              <ChartContainer config={productivityChartConfig} className="h-64 w-full">
                <RadarChart data={productivityData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="#e2e8f0" className="dark:stroke-slate-700/50" />
                  <PolarAngleAxis
                    dataKey="department"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fontSize: 9, fill: '#94a3b8' }}
                  />
                  <Radar
                    name="Accuracy"
                    dataKey="accuracy"
                    stroke={COLORS.emerald}
                    fill={COLORS.emerald}
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                  <Radar
                    name="Speed"
                    dataKey="speed"
                    stroke={COLORS.teal}
                    fill={COLORS.teal}
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                  <Radar
                    name="Volume"
                    dataKey="volume"
                    stroke={COLORS.purple}
                    fill={COLORS.purple}
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                </RadarChart>
              </ChartContainer>
            )}
          </CardContent>
        </AnimatedCard>
      </div>

      {/* ═══ BOTTOM ROW: AI Insights | Performance Comparison ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ─── AI INSIGHTS PANEL ─── */}
        <AnimatedCard delay={0.5} className="relative overflow-hidden">
          {/* Gradient border effect */}
          <div className="absolute inset-0 rounded-lg p-[1px] bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-500 opacity-60" />
          <div className="relative bg-card rounded-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-5 w-5 text-emerald-500" />
                  AI-Powered Insights
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-[10px] px-2 py-0.5 border-cyan-200 text-cyan-700 bg-cyan-50/80 dark:border-cyan-800 dark:text-cyan-400 dark:bg-cyan-950/40"
                >
                  <Zap className="h-2.5 w-2.5 mr-0.5" />
                  AI Generated
                </Badge>
              </div>
              <CardDescription>Intelligent recommendations based on your data</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <InsightSkeleton key={i} />
                  ))}
                </div>
              ) : aiInsights.length === 0 ? (
                <EmptyState
                  icon={LightbulbIcon}
                  title="No AI insights yet"
                  description="AI-powered insights will appear here once analytics data is available."
                />
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {aiInsights.map((insight, index) => (
                      <motion.div
                        key={insight.id}
                        initial={{ opacity: 0, x: -15 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + index * 0.08, duration: 0.4 }}
                        whileHover={{ x: 4, backgroundColor: 'rgba(37,99,235, 0.03)' }}
                        className="flex items-start gap-3 p-3 rounded-xl border border-border/30 hover:border-emerald-200/50 dark:hover:border-emerald-800/50 transition-all cursor-pointer group"
                      >
                        <InsightIcon icon={insight.icon} color={insight.color} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground leading-snug">
                            {insight.text}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1.5 py-0 border-0 font-semibold ${
                                insight.confidence >= 85
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                  : insight.confidence >= 70
                                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                                  : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                            >
                              {insight.confidence}% confidence
                            </Badge>
                            <span className="text-[10px] text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                              → {insight.action}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </div>
        </AnimatedCard>

        {/* ─── PERFORMANCE COMPARISON ─── */}
        <AnimatedCard delay={0.55}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5 text-teal-500" />
              Performance Comparison
            </CardTitle>
            <CardDescription>Current vs Previous period</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-xl">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-2 w-full rounded-full" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Revenue Change */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="p-4 rounded-xl border border-border/30 hover:border-emerald-200/50 dark:hover:border-emerald-800/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                        <IndianRupee className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="text-sm font-medium text-foreground">Revenue</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs font-semibold px-2 py-0.5 border-0 ${
                        revenueChange >= 0
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                      }`}
                    >
                      {revenueChange >= 0 ? '+' : ''}{revenueChange.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted/30 overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(Math.abs(revenueChange) * 3, 100)}%` }}
                      transition={{ duration: 1, delay: 0.6, ease: 'easeOut' as const }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    Current: {formatCurrency(monthlyRevenue)} vs Previous: {formatCurrency(monthlyRevenue * (1 - revenueChange / 100))}
                  </p>
                </motion.div>

                {/* Client Change */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="p-4 rounded-xl border border-border/30 hover:border-teal-200/50 dark:hover:border-teal-800/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-teal-50 dark:bg-teal-950/30">
                        <Users className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                      </div>
                      <span className="text-sm font-medium text-foreground">Clients</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs font-semibold px-2 py-0.5 border-0 ${
                        clientChange >= 0
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                      }`}
                    >
                      {clientChange >= 0 ? '+' : ''}{clientChange.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted/30 overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-teal-400 to-teal-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(Math.abs(clientChange) * 4, 100)}%` }}
                      transition={{ duration: 1, delay: 0.7, ease: 'easeOut' as const }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {data?.activeClients ?? 0} active clients ({clientChange >= 0 ? 'growing' : 'declining'})
                  </p>
                </motion.div>

                {/* Filing Efficiency Change */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="p-4 rounded-xl border border-border/30 hover:border-cyan-200/50 dark:hover:border-cyan-800/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-cyan-50 dark:bg-cyan-950/30">
                        <Shield className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <span className="text-sm font-medium text-foreground">Filing Efficiency</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs font-semibold px-2 py-0.5 border-0 ${
                        filingEfficiencyChange >= 0
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                      }`}
                    >
                      {filingEfficiencyChange >= 0 ? '+' : ''}{filingEfficiencyChange.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted/30 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        filingEfficiencyChange >= 0
                          ? 'bg-gradient-to-r from-cyan-400 to-cyan-500'
                          : 'bg-gradient-to-r from-amber-400 to-amber-500'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(Math.abs(filingEfficiencyChange) * 5, 100)}%` }}
                      transition={{ duration: 1, delay: 0.8, ease: 'easeOut' as const }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {filingEfficiencyChange >= 0 ? 'Improved' : 'Needs attention'} — review compliance processes
                  </p>
                </motion.div>
              </div>
            )}
          </CardContent>
        </AnimatedCard>
      </div>
    </div>
  );
}
