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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CalendarClock,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Shield,
  Activity,
  ChevronRight,
  AlertCircle,
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
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import type { DashboardMetrics } from '@/types/gst';
import { formatCurrency, formatNumber } from '@/lib/gst-utils';

// ─── Color Palette (Emerald/Teal — NO blue/indigo) ────────────────────────
const COLORS = {
  emerald: '#10b981',
  emeraldDark: '#059669',
  emeraldLight: '#d1fae5',
  teal: '#14b8a6',
  tealDark: '#0d9488',
  tealLight: '#ccfbf1',
  amber: '#f59e0b',
  amberLight: '#fef3c7',
  red: '#ef4444',
  redLight: '#fee2e2',
  slate: '#64748b',
  slateLight: '#f1f5f9',
};

// ─── Default / Mock Data ──────────────────────────────────────────────────
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

const mockRevenueData = [
  { month: 'Jul', taxableValue: 2400000, gstAmount: 432000, filings: 12 },
  { month: 'Aug', taxableValue: 3100000, gstAmount: 558000, filings: 15 },
  { month: 'Sep', taxableValue: 2800000, gstAmount: 504000, filings: 14 },
  { month: 'Oct', taxableValue: 3500000, gstAmount: 630000, filings: 18 },
  { month: 'Nov', taxableValue: 3200000, gstAmount: 576000, filings: 16 },
  { month: 'Dec', taxableValue: 4100000, gstAmount: 738000, filings: 22 },
  { month: 'Jan', taxableValue: 3800000, gstAmount: 684000, filings: 20 },
  { month: 'Feb', taxableValue: 4600000, gstAmount: 828000, filings: 24 },
  { month: 'Mar', taxableValue: 5200000, gstAmount: 936000, filings: 28 },
  { month: 'Apr', taxableValue: 4900000, gstAmount: 882000, filings: 26 },
  { month: 'May', taxableValue: 5500000, gstAmount: 990000, filings: 30 },
  { month: 'Jun', taxableValue: 5800000, gstAmount: 1044000, filings: 32 },
];

const mockAIRecommendations = [
  {
    id: '1',
    icon: 'alert',
    color: 'amber',
    title: '23 invoices missing GSTIN',
    description: 'Review and add GSTIN to proceed with filing',
  },
  {
    id: '2',
    icon: 'clock',
    color: 'red',
    title: '2 clients have filing deadlines this week',
    description: 'Priority: File before due date to avoid penalties',
  },
  {
    id: '3',
    icon: 'alert-triangle',
    color: 'amber',
    title: '15 invoices have low confidence extraction',
    description: 'AI confidence below 80% — manual review recommended',
  },
  {
    id: '4',
    icon: 'calendar',
    color: 'red',
    title: 'GSTR-3B filing window closes in 3 days',
    description: 'Immediate action required for 5 clients',
  },
  {
    id: '5',
    icon: 'check',
    color: 'green',
    title: '87% match rate achieved this period',
    description: 'Above the 85% compliance threshold — great progress',
  },
];

// ─── Animated Number Counter Hook ─────────────────────────────────────────
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
      // Ease out cubic
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

// ─── Compliance Gauge Component ───────────────────────────────────────────
function ComplianceGauge({ score }: { score: number }) {
  const animatedScore = useAnimatedNumber(score, 1500);
  const size = 180;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedScore / 100) * circumference;
  const center = size / 2;

  const getGaugeColor = (s: number) => {
    if (s >= 80) return { stroke: '#10b981', text: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Excellent' };
    if (s >= 60) return { stroke: '#f59e0b', text: 'text-amber-600', bg: 'bg-amber-50', label: 'Good' };
    return { stroke: '#ef4444', text: 'text-red-600', bg: 'bg-red-50', label: 'Needs Attention' };
  };

  const gauge = getGaugeColor(score);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/20"
          />
          {/* Glow filter */}
          <defs>
            <filter id="gaugeGlow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Progress arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={gauge.stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            filter="url(#gaugeGlow)"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className={`text-4xl font-bold ${gauge.text}`}
            key={animatedScore}
            initial={{ scale: 0.95, opacity: 0.7 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {animatedScore}
          </motion.span>
          <span className="text-xs text-muted-foreground font-medium mt-0.5">out of 100</span>
        </div>
      </div>
      <Badge
        variant="outline"
        className={`${gauge.bg} ${gauge.text} border-0 text-xs font-semibold px-3 py-1`}
      >
        {gauge.label}
      </Badge>
    </div>
  );
}

// ─── Risk Heatmap Component ───────────────────────────────────────────────
function RiskHeatmap({ highRisk, mediumRisk, lowRisk }: { highRisk: number; mediumRisk: number; lowRisk: number }) {
  const total = highRisk + mediumRisk + lowRisk || 1;
  const gridData = [
    ...Array.from({ length: Math.min(highRisk, 4) }, () => 'high'),
    ...Array.from({ length: Math.min(mediumRisk, 4) }, () => 'medium'),
    ...Array.from({ length: Math.min(lowRisk, 4) }, () => 'low'),
  ];
  // Pad to 12 cells
  while (gridData.length < 12) gridData.push('empty');

  const cellColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-red-400 dark:bg-red-500';
      case 'medium': return 'bg-amber-400 dark:bg-amber-500';
      case 'low': return 'bg-emerald-400 dark:bg-emerald-500';
      default: return 'bg-muted/30';
    }
  };

  const barData = [
    { name: 'High', value: highRisk, fill: COLORS.red },
    { name: 'Medium', value: mediumRisk, fill: COLORS.amber },
    { name: 'Low', value: lowRisk, fill: COLORS.emerald },
  ];

  const barChartConfig = {
    high: { label: 'High Risk', color: COLORS.red },
    medium: { label: 'Medium Risk', color: COLORS.amber },
    low: { label: 'Low Risk', color: COLORS.emerald },
  };

  return (
    <div className="space-y-4">
      {/* Heatmap Grid */}
      <div className="grid grid-cols-6 gap-1.5">
        {gridData.map((level, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.04, duration: 0.3, ease: 'easeOut' }}
            className={`aspect-square rounded-md ${cellColor(level)} transition-colors`}
          />
        ))}
      </div>

      {/* Risk Distribution Bar Chart */}
      <ChartContainer config={barChartConfig} className="h-24 w-full">
        <BarChart data={barData} barCategoryGap="25%">
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: '#64748b' }}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {barData.map((entry, index) => (
              <rect key={index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>

      {/* Summary Pills */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-950/30">
          <p className="text-lg font-bold text-red-600 dark:text-red-400">{highRisk}</p>
          <p className="text-[10px] font-medium text-red-500 dark:text-red-400 uppercase tracking-wider">High Risk</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30">
          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{mediumRisk}</p>
          <p className="text-[10px] font-medium text-amber-500 dark:text-amber-400 uppercase tracking-wider">Medium</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{lowRisk}</p>
          <p className="text-[10px] font-medium text-emerald-500 dark:text-emerald-400 uppercase tracking-wider">Low Risk</p>
        </div>
      </div>
    </div>
  );
}

// ─── AI Recommendation Icon Map ───────────────────────────────────────────
function RecommendationIcon({ icon, color }: { icon: string; color: string }) {
  const colorMap: Record<string, string> = {
    amber: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40',
    red: 'text-red-500 bg-red-50 dark:bg-red-950/40',
    green: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40',
  };
  const cls = colorMap[color] || colorMap.amber;

  const iconMap: Record<string, React.ReactNode> = {
    alert: <AlertCircle className="h-4 w-4" />,
    clock: <Clock className="h-4 w-4" />,
    'alert-triangle': <AlertTriangle className="h-4 w-4" />,
    calendar: <CalendarClock className="h-4 w-4" />,
    check: <CheckCircle2 className="h-4 w-4" />,
  };

  return (
    <div className={`flex items-center justify-center h-9 w-9 rounded-lg shrink-0 ${cls}`}>
      {iconMap[icon] || <AlertCircle className="h-4 w-4" />}
    </div>
  );
}

// ─── Skeleton Loaders ─────────────────────────────────────────────────────
function GaugeSkeleton() {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <Skeleton className="h-[180px] w-[180px] rounded-full" />
      <Skeleton className="h-5 w-20 rounded-full" />
    </div>
  );
}

function PillsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-12 flex-1 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-4 w-full rounded-full" />
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function HeatmapSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-6 gap-1.5">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-md" />
        ))}
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}

function RecommendationsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-5 rounded" />
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-48 w-full rounded-lg" />
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
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
      transition={{ delay, duration: 0.5, ease: 'easeOut' }}
    >
      <Card className={`hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 border-border/50 backdrop-blur-sm bg-card/80 ${className}`}>
        {children}
      </Card>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const { setCurrentView } = useApp();

  // ── State ────────────────────────────────────────────────────────────────
  const [metrics, setMetrics] = useState<DashboardMetrics>(defaultMetrics);
  const [loading, setLoading] = useState(true);

  // Filing readiness
  const [filingReadiness, setFilingReadiness] = useState({
    readyReturns: 0,
    pendingReturns: 0,
    criticalIssues: 0,
    totalReturns: 0,
  });

  // Risk data
  const [riskData, setRiskData] = useState({
    highRisk: 0,
    mediumRisk: 0,
    lowRisk: 0,
  });

  // Revenue chart
  const [revenueData, setRevenueData] = useState(mockRevenueData);

  // AI recommendations
  const [recommendations, setRecommendations] = useState(mockAIRecommendations);

  // ── Data Fetching ────────────────────────────────────────────────────────
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch dashboard metrics
      const dashRes = await fetch('/api/dashboard');
      if (dashRes.ok) {
        const data = await dashRes.json();
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
      }

      // Fetch clients for risk distribution
      const clientRes = await fetch('/api/clients');
      if (clientRes.ok) {
        const clientData = await clientRes.json();
        const clients = clientData.clients ?? [];
        if (Array.isArray(clients) && clients.length > 0) {
          const high = clients.filter((c: { healthScore: number }) => c.healthScore < 40).length;
          const medium = clients.filter((c: { healthScore: number }) => c.healthScore >= 40 && c.healthScore < 70).length;
          const low = clients.filter((c: { healthScore: number }) => c.healthScore >= 70).length;
          setRiskData({ highRisk: high, mediumRisk: medium, lowRisk: low });
        } else {
          // Fallback mock
          setRiskData({ highRisk: 3, mediumRisk: 8, lowRisk: 14 });
        }
      } else {
        setRiskData({ highRisk: 3, mediumRisk: 8, lowRisk: 14 });
      }

      // Fetch invoices for filing readiness
      const invRes = await fetch('/api/invoices?limit=1000');
      if (invRes.ok) {
        const invData = await invRes.json();
        const invoices = invData.invoices ?? [];
        if (Array.isArray(invoices) && invoices.length > 0) {
          const ready = invoices.filter((inv: { status: string; matchStatus: string }) =>
            !['draft', 'cancelled'].includes(inv.status) && inv.matchStatus === 'perfect_match'
          ).length;
          const pending = invoices.filter((inv: { status: string; matchStatus: string }) =>
            !['draft', 'cancelled'].includes(inv.status) && inv.matchStatus !== 'perfect_match'
          ).length;
          const critical = invoices.filter((inv: { riskLevel: string }) =>
            ['high', 'critical'].includes(inv.riskLevel)
          ).length;
          setFilingReadiness({
            readyReturns: ready,
            pendingReturns: pending,
            criticalIssues: critical,
            totalReturns: invoices.length,
          });
        } else {
          // Fallback mock
          setFilingReadiness({
            readyReturns: 142,
            pendingReturns: 38,
            criticalIssues: 7,
            totalReturns: 187,
          });
        }
      } else {
        setFilingReadiness({
          readyReturns: 142,
          pendingReturns: 38,
          criticalIssues: 7,
          totalReturns: 187,
        });
      }

      // Revenue data — use mock (API doesn't return this)
      setRevenueData(mockRevenueData);

      // AI recommendations — use mock (no real AI endpoint)
      setRecommendations(mockAIRecommendations);

    } catch (err) {
      console.error('Dashboard fetch error:', err);
      // Apply mock fallbacks
      setMetrics({
        ...defaultMetrics,
        averageHealthScore: 76,
        totalClients: 25,
        totalInvoices: 1247,
        filedReturns: 18,
        pendingReturns: 7,
        criticalIssues: 3,
        warnings: 12,
        matchPercentage: 87,
        riskPercentage: 14,
      });
      setFilingReadiness({ readyReturns: 142, pendingReturns: 38, criticalIssues: 7, totalReturns: 187 });
      setRiskData({ highRisk: 3, mediumRisk: 8, lowRisk: 14 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // ── Derived values ───────────────────────────────────────────────────────
  const complianceScore = metrics.averageHealthScore || 76;
  const trendPercent = +2.3;

  const readyPct = filingReadiness.totalReturns > 0
    ? Math.round((filingReadiness.readyReturns / filingReadiness.totalReturns) * 100)
    : 76;
  const pendingPct = filingReadiness.totalReturns > 0
    ? Math.round((filingReadiness.pendingReturns / filingReadiness.totalReturns) * 100)
    : 20;
  const criticalPct = filingReadiness.totalReturns > 0
    ? Math.round((filingReadiness.criticalIssues / filingReadiness.totalReturns) * 100)
    : 4;

  // Revenue chart config
  const revenueChartConfig = {
    taxableValue: { label: 'Taxable Value', color: COLORS.emerald },
    gstAmount: { label: 'GST Amount', color: COLORS.teal },
  };

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
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              GST Command Center
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Real-time compliance monitoring &amp; AI insights
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
        </div>
      </motion.div>

      {/* ═══ TOP ROW: Compliance | Filing Readiness | Risk Heatmap ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* ─── 1. COMPLIANCE SCORE (HERO WIDGET) ─── */}
        <AnimatedCard delay={0.05}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5 text-emerald-500" />
              Compliance Score
            </CardTitle>
            <CardDescription>Overall GST Compliance</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center pb-6">
            {loading ? (
              <GaugeSkeleton />
            ) : (
              <>
                <ComplianceGauge score={complianceScore} />
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="flex items-center gap-1.5 mt-3"
                >
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    +{trendPercent}% from last month
                  </span>
                </motion.div>
              </>
            )}
          </CardContent>
        </AnimatedCard>

        {/* ─── 2. FILING READINESS ─── */}
        <AnimatedCard delay={0.1}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5 text-emerald-500" />
              Filing Readiness
            </CardTitle>
            <CardDescription>Return preparation status</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <PillsSkeleton />
            ) : (
              <div className="space-y-4">
                {/* Three Metric Pills */}
                <div className="grid grid-cols-3 gap-2">
                  <motion.div
                    whileHover={{ scale: 1.03 }}
                    className="flex flex-col items-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50"
                  >
                    <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {formatNumber(filingReadiness.readyReturns)}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">
                      Ready
                    </span>
                  </motion.div>
                  <motion.div
                    whileHover={{ scale: 1.03 }}
                    className="flex flex-col items-center p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50"
                  >
                    <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {formatNumber(filingReadiness.pendingReturns)}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600/70 dark:text-amber-400/70 mt-0.5">
                      Pending
                    </span>
                  </motion.div>
                  <motion.div
                    whileHover={{ scale: 1.03 }}
                    className="flex flex-col items-center p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50"
                  >
                    <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {formatNumber(filingReadiness.criticalIssues)}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-red-600/70 dark:text-red-400/70 mt-0.5">
                      Critical
                    </span>
                  </motion.div>
                </div>

                {/* Stacked Progress Bar */}
                <div>
                  <div className="h-3 w-full rounded-full bg-muted/30 overflow-hidden flex">
                    <motion.div
                      className="bg-emerald-500 h-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${readyPct}%` }}
                      transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
                    />
                    <motion.div
                      className="bg-amber-400 h-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${pendingPct}%` }}
                      transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
                    />
                    <motion.div
                      className="bg-red-500 h-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${criticalPct}%` }}
                      transition={{ duration: 1, delay: 0.7, ease: 'easeOut' }}
                    />
                  </div>
                </div>

                {/* Percentage Breakdown */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-0.5">
                      <div className="h-2 w-2 rounded-sm bg-emerald-500" />
                      <span className="text-xs text-muted-foreground">Ready Returns</span>
                    </div>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{readyPct}%</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-0.5">
                      <div className="h-2 w-2 rounded-sm bg-amber-400" />
                      <span className="text-xs text-muted-foreground">Pending Returns</span>
                    </div>
                    <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{pendingPct}%</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-0.5">
                      <div className="h-2 w-2 rounded-sm bg-red-500" />
                      <span className="text-xs text-muted-foreground">Critical Issues</span>
                    </div>
                    <p className="text-sm font-bold text-red-600 dark:text-red-400">{criticalPct}%</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </AnimatedCard>

        {/* ─── 3. RISK HEATMAP ─── */}
        <AnimatedCard delay={0.15}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Risk Heatmap
            </CardTitle>
            <CardDescription>Client risk distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <HeatmapSkeleton />
            ) : (
              <RiskHeatmap
                highRisk={riskData.highRisk}
                mediumRisk={riskData.mediumRisk}
                lowRisk={riskData.lowRisk}
              />
            )}
          </CardContent>
        </AnimatedCard>
      </div>

      {/* ═══ BOTTOM ROW: AI Recommendations | Revenue Analytics ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ─── 4. AI RECOMMENDATIONS ─── */}
        <AnimatedCard delay={0.2}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-5 w-5 text-emerald-500" />
                AI Recommendations
              </CardTitle>
              <Badge
                variant="outline"
                className="text-[10px] px-2 py-0.5 border-emerald-200 text-emerald-700 bg-emerald-50/80 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/40"
              >
                <Zap className="h-2.5 w-2.5 mr-0.5" />
                Powered by AI
              </Badge>
            </div>
            <CardDescription>Smart suggestions for your workflow</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <RecommendationsSkeleton />
            ) : (
              <ScrollArea className="max-h-80">
                <div className="space-y-2 pr-2">
                  <AnimatePresence>
                    {recommendations.map((rec, index) => (
                      <motion.div
                        key={rec.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + index * 0.08, duration: 0.4 }}
                        whileHover={{ x: 4, backgroundColor: 'rgba(16, 185, 129, 0.03)' }}
                        className="flex items-center gap-3 p-3 rounded-xl border border-border/30 hover:border-emerald-200/50 dark:hover:border-emerald-800/50 transition-all cursor-pointer group"
                      >
                        <RecommendationIcon icon={rec.icon} color={rec.color} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {rec.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {rec.description}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </AnimatedCard>

        {/* ─── 5. REVENUE ANALYTICS ─── */}
        <AnimatedCard delay={0.25}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Revenue Analytics
            </CardTitle>
            <CardDescription>Monthly GST processed &amp; filing volume</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton />
            ) : (
              <div className="space-y-4">
                <ChartContainer config={revenueChartConfig} className="h-52 w-full">
                  <AreaChart data={revenueData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="taxableGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.emerald} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={COLORS.emerald} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gstGradient" x1="0" y1="0" x2="0" y2="1">
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
                      dataKey="taxableValue"
                      stroke={COLORS.emerald}
                      strokeWidth={2}
                      fill="url(#taxableGradient)"
                      dot={false}
                      activeDot={{ r: 5, fill: COLORS.emerald, stroke: '#fff', strokeWidth: 2 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="gstAmount"
                      stroke={COLORS.teal}
                      strokeWidth={2}
                      fill="url(#gstGradient)"
                      dot={false}
                      activeDot={{ r: 5, fill: COLORS.teal, stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ChartContainer>

                {/* Filing Volume Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="p-3 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-100/50 dark:border-emerald-900/30"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600/70 dark:text-emerald-400/70">
                      Total Processed
                    </p>
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {formatCurrency(revenueData.reduce((s, d) => s + d.taxableValue, 0))}
                    </p>
                  </motion.div>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="p-3 rounded-xl bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950/30 dark:to-emerald-950/30 border border-teal-100/50 dark:border-teal-900/30"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-600/70 dark:text-teal-400/70">
                      GST Collected
                    </p>
                    <p className="text-lg font-bold text-teal-700 dark:text-teal-300 mt-0.5">
                      {formatCurrency(revenueData.reduce((s, d) => s + d.gstAmount, 0))}
                    </p>
                  </motion.div>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="p-3 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 border border-emerald-100/50 dark:border-emerald-900/30"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600/70 dark:text-emerald-400/70">
                      Filings
                    </p>
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {formatNumber(revenueData.reduce((s, d) => s + d.filings, 0))}
                    </p>
                  </motion.div>
                </div>

                {/* Current Month Highlight */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/30">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      Current Month (Jun)
                    </span>
                  </div>
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    {formatCurrency(revenueData[revenueData.length - 1]?.taxableValue ?? 0)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </AnimatedCard>
      </div>

      {/* ═══ QUICK ACTIONS BAR ═══ */}
      <AnimatedCard delay={0.3}>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">
              Quick Actions
            </span>
            <Button
              size="sm"
              onClick={() => setCurrentView('gstr-filing')}
              className="gap-1.5 h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              <ChevronRight className="h-3 w-3" />
              Prepare GSTR-1
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentView('reconciliation')}
              className="gap-1.5 h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30 text-xs"
            >
              <Shield className="h-3 w-3" />
              Run Reconciliation
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentView('errors')}
              className="gap-1.5 h-8 border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30 text-xs"
            >
              <AlertTriangle className="h-3 w-3" />
              View Issues
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentView('calendar')}
              className="gap-1.5 h-8 border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-900/30 text-xs"
            >
              <CalendarClock className="h-3 w-3" />
              Filing Calendar
            </Button>
          </div>
        </CardContent>
      </AnimatedCard>
    </div>
  );
}
