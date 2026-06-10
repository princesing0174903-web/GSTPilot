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
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Brain,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  IndianRupee,
  Users,
  FileCheck,
  Activity,
  AlertTriangle,
  Lightbulb,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, formatNumber } from '@/lib/gst-utils';

// ─── Color Palette (Emerald/Purple — AI theme) ────────────────────────────
const COLORS = {
  emerald: '#10b981',
  emeraldDark: '#059669',
  emeraldLight: '#d1fae5',
  purple: '#8b5cf6',
  purpleDark: '#7c3aed',
  purpleLight: '#ede9fe',
  teal: '#14b8a6',
  amber: '#f59e0b',
  red: '#ef4444',
  slate: '#64748b',
};

// ─── Types ────────────────────────────────────────────────────────────────
interface CategoryPrediction {
  category: string;
  predictedValue: number;
  confidence: number;
  lowerBound: number;
  upperBound: number;
  trend: string;
}

interface MonthlyDataPoint {
  month: string;
  category: string;
  value: number;
  isPredicted: boolean;
}

// ─── Animated Number Hook ─────────────────────────────────────────────────
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

// ─── Mini Sparkline Component ─────────────────────────────────────────────
function MiniSparkline({
  data,
  color,
  width = 80,
  height = 32,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;

  const points = data
    .map((v, i) => {
      const x = padding + (i / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((v - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  const areaPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;

  return (
    <svg width={width} height={height} className="shrink-0">
      <defs>
        <linearGradient id={`sparkGrad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
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
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Animated Card Wrapper ────────────────────────────────────────────────
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
      <Card
        className={`hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-300 border-border/50 backdrop-blur-sm bg-card/80 ${className}`}
      >
        {children}
      </Card>
    </motion.div>
  );
}

// ─── Prediction Card Component ────────────────────────────────────────────
function PredictionCard({
  title,
  value,
  trend,
  confidence,
  lowerBound,
  upperBound,
  icon,
  sparkData,
  color,
  isCurrency,
  isPercent,
  delay,
}: {
  title: string;
  value: number;
  trend: string;
  confidence: number;
  lowerBound: number;
  upperBound: number;
  icon: React.ReactNode;
  sparkData: number[];
  color: string;
  isCurrency?: boolean;
  isPercent?: boolean;
  delay: number;
}) {
  const animatedValue = useAnimatedNumber(Math.round(value));

  const formatValue = (v: number) => {
    if (isCurrency) return formatCurrency(v);
    if (isPercent) return `${v.toFixed(1)}%`;
    return formatNumber(v);
  };

  const trendIcon =
    trend === 'up' ? (
      <ArrowUpRight className="h-3.5 w-3.5" />
    ) : trend === 'down' ? (
      <ArrowDownRight className="h-3.5 w-3.5" />
    ) : (
      <Minus className="h-3 w-3" />
    );

  const trendColor =
    trend === 'up'
      ? 'text-emerald-600 dark:text-emerald-400'
      : trend === 'down'
        ? 'text-red-600 dark:text-red-400'
        : 'text-slate-500';

  const glowClass =
    color === 'purple'
      ? 'shadow-purple-500/10 hover:shadow-purple-500/20'
      : 'shadow-emerald-500/10 hover:shadow-emerald-500/20';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.5, ease: 'easeOut' }}
    >
      <Card
        className={`relative overflow-hidden hover:shadow-xl ${glowClass} transition-all duration-300 border-border/50 bg-card/80`}
      >
        {/* Glow accent */}
        <div
          className={`absolute top-0 left-0 w-full h-0.5 ${
            color === 'purple'
              ? 'bg-gradient-to-r from-purple-500 to-purple-300'
              : 'bg-gradient-to-r from-emerald-500 to-emerald-300'
          }`}
        />
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center justify-center h-8 w-8 rounded-lg ${
                  color === 'purple'
                    ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {icon}
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {title}
              </span>
            </div>
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0.5 ${
                trend === 'up'
                  ? 'border-emerald-200 text-emerald-700 bg-emerald-50/80 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/40'
                  : trend === 'down'
                    ? 'border-red-200 text-red-700 bg-red-50/80 dark:border-red-800 dark:text-red-400 dark:bg-red-950/40'
                    : 'border-slate-200 text-slate-600 bg-slate-50/80 dark:border-slate-700 dark:text-slate-400 dark:bg-slate-900/40'
              }`}
            >
              {trendIcon}
            </Badge>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <p className="text-xl font-bold text-foreground tracking-tight">
                {formatValue(animatedValue)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 border-purple-200 text-purple-700 bg-purple-50/80 dark:border-purple-800 dark:text-purple-400 dark:bg-purple-950/40"
                >
                  {Math.round(confidence * 100)}% confidence
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {isCurrency
                    ? `${formatCurrency(lowerBound)} - ${formatCurrency(upperBound)}`
                    : isPercent
                      ? `${lowerBound.toFixed(1)}% - ${upperBound.toFixed(1)}%`
                      : `${formatNumber(lowerBound)} - ${formatNumber(upperBound)}`}
                </span>
              </div>
            </div>
            <MiniSparkline
              data={sparkData}
              color={color === 'purple' ? COLORS.purple : COLORS.emerald}
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Skeleton Loaders ─────────────────────────────────────────────────────
function PredictionCardSkeleton() {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-6 w-32 mb-2" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-20 rounded-full" />
          <Skeleton className="h-3 w-28" />
        </div>
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-56 w-full rounded-lg" />
    </div>
  );
}

function InsightsSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ─── AI Insights Data (derived from predictions) ──────────────────────────
function generateInsights(predictions: Record<string, CategoryPrediction>) {
  const insights: {
    icon: React.ReactNode;
    text: string;
    confidence: number;
    color: string;
  }[] = [];

  const revenue = predictions['revenue'];
  const gstLiability = predictions['gst_liability'];
  const churn = predictions['churn'];
  const filingLoad = predictions['filing_load'];
  const teamLoad = predictions['team_load'];
  const collections = predictions['collections'];

  if (revenue) {
    insights.push({
      icon: <TrendingUp className="h-4 w-4" />,
      text:
        revenue.trend === 'up'
          ? `Revenue is trending upward at ${formatCurrency(revenue.predictedValue)}. Maintain current client engagement strategies.`
          : `Revenue is projected at ${formatCurrency(revenue.predictedValue)}. Consider proactive outreach to boost collections.`,
      confidence: revenue.confidence,
      color: revenue.trend === 'up' ? 'emerald' : 'amber',
    });
  }

  if (gstLiability) {
    insights.push({
      icon: <IndianRupee className="h-4 w-4" />,
      text: `GST liability forecast at ${formatCurrency(gstLiability.predictedValue)}. Ensure adequate cash reserves by the 20th of filing month.`,
      confidence: gstLiability.confidence,
      color: gstLiability.trend === 'up' ? 'amber' : 'emerald',
    });
  }

  if (churn && churn.predictedValue > 5) {
    insights.push({
      icon: <AlertTriangle className="h-4 w-4" />,
      text: `Client churn risk at ${churn.predictedValue.toFixed(1)}%. Identify at-risk clients and schedule retention reviews.`,
      confidence: churn.confidence,
      color: 'red',
    });
  }

  if (filingLoad && filingLoad.predictedValue > 10) {
    insights.push({
      icon: <FileCheck className="h-4 w-4" />,
      text: `Filing load of ${formatNumber(filingLoad.predictedValue)} returns expected. Optimize team allocation to avoid bottlenecks.`,
      confidence: filingLoad.confidence,
      color: 'amber',
    });
  }

  if (teamLoad && teamLoad.predictedValue > 75) {
    insights.push({
      icon: <Users className="h-4 w-4" />,
      text: `Team utilization projected at ${teamLoad.predictedValue.toFixed(0)}%. Consider temporary resources to prevent burnout.`,
      confidence: teamLoad.confidence,
      color: 'amber',
    });
  }

  if (insights.length === 0) {
    insights.push({
      icon: <Lightbulb className="h-4 w-4" />,
      text: 'All metrics are within normal range. Continue monitoring for emerging trends.',
      confidence: 0.8,
      color: 'emerald',
    });
  }

  return insights;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function AICFODashboardPage() {
  const [predictions, setPredictions] = useState<Record<string, CategoryPrediction>>({});
  const [monthlyData, setMonthlyData] = useState<MonthlyDataPoint[]>([]);
  const [overallConfidence, setOverallConfidence] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Data Fetching ──────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/ai-cfo');
      if (!res.ok) throw new Error('Failed to fetch AI CFO data');
      const data = await res.json();
      setPredictions(data.predictions ?? {});
      setMonthlyData(data.monthlyData ?? []);
      setOverallConfidence(data.confidence ?? 0);
    } catch (err) {
      console.error('AI CFO fetch error:', err);
      setError('Failed to load predictions. Using fallback data.');
      // Fallback mock data
      setPredictions({
        revenue: { category: 'revenue', predictedValue: 4500000, confidence: 0.82, lowerBound: 3825000, upperBound: 5175000, trend: 'up' },
        gst_liability: { category: 'gst_liability', predictedValue: 810000, confidence: 0.78, lowerBound: 712800, upperBound: 907200, trend: 'up' },
        collections: { category: 'collections', predictedValue: 3825000, confidence: 0.75, lowerBound: 3060000, upperBound: 4016250, trend: 'stable' },
        churn: { category: 'churn', predictedValue: 8.5, confidence: 0.7, lowerBound: 6.5, upperBound: 11.5, trend: 'up' },
        filing_load: { category: 'filing_load', predictedValue: 18, confidence: 0.85, lowerBound: 16, upperBound: 23, trend: 'up' },
        team_load: { category: 'team_load', predictedValue: 78, confidence: 0.8, lowerBound: 68, upperBound: 88, trend: 'up' },
      });
      setOverallConfidence(0.78);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Build chart data ───────────────────────────────────────────────────
  const revenueChartData = monthlyData
    .filter((d) => d.category === 'revenue')
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((d) => ({
      month: d.month,
      value: d.value,
      isPredicted: d.isPredicted,
    }));

  const gstChartData = monthlyData
    .filter((d) => d.category === 'gst_liability')
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((d) => ({
      month: d.month,
      value: d.value,
      isPredicted: d.isPredicted,
    }));

  // Sparkline data for each category
  const getSparkData = (category: string): number[] => {
    const items = monthlyData
      .filter((d) => d.category === category)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((d) => d.value);
    return items.length > 1 ? items : [0, 0];
  };

  // AI insights
  const insights = generateInsights(predictions);

  // Chart configs
  const revenueChartConfig = {
    value: { label: 'Revenue', color: COLORS.purple },
  };

  const gstChartConfig = {
    value: { label: 'GST Liability', color: COLORS.emerald },
  };

  // Find the boundary month (last historical)
  const findPredictionStart = (data: { month: string; isPredicted: boolean }[]) => {
    const firstPredicted = data.find((d) => d.isPredicted);
    return firstPredicted?.month ?? null;
  };

  const revenuePredStart = findPredictionStart(revenueChartData);
  const gstPredStart = findPredictionStart(gstChartData);

  // ── Render ─────────────────────────────────────────────────────────────
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
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 text-white shadow-lg shadow-purple-500/20">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              AI CFO Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Predictive financial intelligence for your firm
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="gap-1.5 px-3 py-1.5 border-purple-200 text-purple-700 bg-purple-50/80 dark:border-purple-800 dark:text-purple-400 dark:bg-purple-950/40 font-medium"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Powered
          </Badge>
          {overallConfidence > 0 && (
            <Badge
              variant="outline"
              className="gap-1.5 px-3 py-1.5 border-emerald-200 text-emerald-700 bg-emerald-50/80 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/40"
            >
              <Activity className="h-3.5 w-3.5" />
              {Math.round(overallConfidence * 100)}% Confidence
            </Badge>
          )}
        </div>
      </motion.div>

      {/* ═══ ERROR BANNER ═══ */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ PREDICTIVE ANALYTICS ROW (6 cards) ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <PredictionCardSkeleton key={i} />
          ))
        ) : (
          <>
            <PredictionCard
              title="Predicted Revenue"
              value={predictions['revenue']?.predictedValue ?? 0}
              trend={predictions['revenue']?.trend ?? 'stable'}
              confidence={predictions['revenue']?.confidence ?? 0}
              lowerBound={predictions['revenue']?.lowerBound ?? 0}
              upperBound={predictions['revenue']?.upperBound ?? 0}
              icon={<IndianRupee className="h-4 w-4" />}
              sparkData={getSparkData('revenue')}
              color="purple"
              isCurrency
              delay={0.05}
            />
            <PredictionCard
              title="Predicted GST Liability"
              value={predictions['gst_liability']?.predictedValue ?? 0}
              trend={predictions['gst_liability']?.trend ?? 'stable'}
              confidence={predictions['gst_liability']?.confidence ?? 0}
              lowerBound={predictions['gst_liability']?.lowerBound ?? 0}
              upperBound={predictions['gst_liability']?.upperBound ?? 0}
              icon={<IndianRupee className="h-4 w-4" />}
              sparkData={getSparkData('gst_liability')}
              color="emerald"
              isCurrency
              delay={0.1}
            />
            <PredictionCard
              title="Expected Collections"
              value={predictions['collections']?.predictedValue ?? 0}
              trend={predictions['collections']?.trend ?? 'stable'}
              confidence={predictions['collections']?.confidence ?? 0}
              lowerBound={predictions['collections']?.lowerBound ?? 0}
              upperBound={predictions['collections']?.upperBound ?? 0}
              icon={<TrendingUp className="h-4 w-4" />}
              sparkData={getSparkData('collections')}
              color="purple"
              isCurrency
              delay={0.15}
            />
            <PredictionCard
              title="Expected Client Churn"
              value={predictions['churn']?.predictedValue ?? 0}
              trend={predictions['churn']?.trend ?? 'stable'}
              confidence={predictions['churn']?.confidence ?? 0}
              lowerBound={predictions['churn']?.lowerBound ?? 0}
              upperBound={predictions['churn']?.upperBound ?? 0}
              icon={<Users className="h-4 w-4" />}
              sparkData={getSparkData('churn')}
              color="emerald"
              isPercent
              delay={0.2}
            />
            <PredictionCard
              title="Expected Filing Load"
              value={predictions['filing_load']?.predictedValue ?? 0}
              trend={predictions['filing_load']?.trend ?? 'stable'}
              confidence={predictions['filing_load']?.confidence ?? 0}
              lowerBound={predictions['filing_load']?.lowerBound ?? 0}
              upperBound={predictions['filing_load']?.upperBound ?? 0}
              icon={<FileCheck className="h-4 w-4" />}
              sparkData={getSparkData('filing_load')}
              color="purple"
              delay={0.25}
            />
            <PredictionCard
              title="Expected Team Load"
              value={predictions['team_load']?.predictedValue ?? 0}
              trend={predictions['team_load']?.trend ?? 'stable'}
              confidence={predictions['team_load']?.confidence ?? 0}
              lowerBound={predictions['team_load']?.lowerBound ?? 0}
              upperBound={predictions['team_load']?.upperBound ?? 0}
              icon={<Activity className="h-4 w-4" />}
              sparkData={getSparkData('team_load')}
              color="emerald"
              isPercent
              delay={0.3}
            />
          </>
        )}
      </div>

      {/* ═══ CHARTS SECTION ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ─── Revenue Forecast Chart ─── */}
        <AnimatedCard delay={0.35}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              Revenue Forecast
            </CardTitle>
            <CardDescription>6 months historical + 3 months predicted</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton />
            ) : (
              <div className="space-y-3">
                <ChartContainer config={revenueChartConfig} className="h-56 w-full">
                  <AreaChart data={revenueChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.purple} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={COLORS.purple} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-700/50" />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={(v: string) => {
                        const parts = v.split('-');
                        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                        return months[parseInt(parts[1]) - 1] + " '" + parts[0].slice(2);
                      }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={(v: number) => `${(v / 100000).toFixed(0)}L`}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    {revenuePredStart && (
                      <ReferenceLine
                        x={revenuePredStart}
                        stroke={COLORS.purple}
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{
                          value: 'Forecast',
                          position: 'top',
                          fill: COLORS.purple,
                          fontSize: 10,
                        }}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={COLORS.purple}
                      strokeWidth={2}
                      fill="url(#revenueGradient)"
                      dot={(props: Record<string, unknown>) => {
                        const { cx, cy, payload } = props as { cx: number; cy: number; payload: { isPredicted: boolean } };
                        if (payload?.isPredicted) {
                          return (
                            <circle
                              key={`dot-${cx}-${cy}`}
                              cx={cx}
                              cy={cy}
                              r={3}
                              fill={COLORS.purple}
                              stroke="#fff"
                              strokeWidth={1.5}
                              strokeDasharray="2 2"
                            />
                          );
                        }
                        return (
                          <circle
                            key={`dot-${cx}-${cy}`}
                            cx={cx}
                            cy={cy}
                            r={3}
                            fill={COLORS.purple}
                            stroke="#fff"
                            strokeWidth={1.5}
                          />
                        );
                      }}
                      activeDot={{ r: 5, fill: COLORS.purple, stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ChartContainer>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-4 rounded-sm bg-purple-500" />
                    <span>Historical</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-4 rounded-sm bg-purple-300 border border-dashed border-purple-400" />
                    <span>Predicted</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </AnimatedCard>

        {/* ─── GST Liability Forecast Chart ─── */}
        <AnimatedCard delay={0.4}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <IndianRupee className="h-5 w-5 text-emerald-500" />
              GST Liability Forecast
            </CardTitle>
            <CardDescription>6 months historical + 3 months predicted</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton />
            ) : (
              <div className="space-y-3">
                <ChartContainer config={gstChartConfig} className="h-56 w-full">
                  <LineChart data={gstChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-700/50" />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={(v: string) => {
                        const parts = v.split('-');
                        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                        return months[parseInt(parts[1]) - 1] + " '" + parts[0].slice(2);
                      }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={(v: number) => `${(v / 100000).toFixed(0)}L`}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    {gstPredStart && (
                      <ReferenceLine
                        x={gstPredStart}
                        stroke={COLORS.emerald}
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{
                          value: 'Forecast',
                          position: 'top',
                          fill: COLORS.emerald,
                          fontSize: 10,
                        }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={COLORS.emerald}
                      strokeWidth={2}
                      dot={(props: Record<string, unknown>) => {
                        const { cx, cy, payload } = props as { cx: number; cy: number; payload: { isPredicted: boolean } };
                        if (payload?.isPredicted) {
                          return (
                            <circle
                              key={`dot-${cx}-${cy}`}
                              cx={cx}
                              cy={cy}
                              r={3}
                              fill={COLORS.emerald}
                              stroke="#fff"
                              strokeWidth={1.5}
                              strokeDasharray="2 2"
                            />
                          );
                        }
                        return (
                          <circle
                            key={`dot-${cx}-${cy}`}
                            cx={cx}
                            cy={cy}
                            r={3}
                            fill={COLORS.emerald}
                            stroke="#fff"
                            strokeWidth={1.5}
                          />
                        );
                      }}
                      activeDot={{ r: 5, fill: COLORS.emerald, stroke: '#fff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ChartContainer>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-4 rounded-sm bg-emerald-500" />
                    <span>Historical</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-4 rounded-sm bg-emerald-300 border border-dashed border-emerald-400" />
                    <span>Predicted</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </AnimatedCard>
      </div>

      {/* ═══ AI INSIGHTS PANEL ═══ */}
      <AnimatedCard delay={0.45} className="relative overflow-hidden">
        {/* Gradient border effect */}
        <div className="absolute inset-0 rounded-xl p-[2px] bg-gradient-to-r from-purple-500 via-purple-400 to-emerald-500">
          <div className="h-full w-full rounded-xl bg-card" />
        </div>
        <div className="relative z-10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Brain className="h-5 w-5 text-purple-500" />
                AI Insights
              </CardTitle>
              <Badge
                variant="outline"
                className="gap-1.5 px-2 py-0.5 border-purple-200 text-purple-700 bg-purple-50/80 dark:border-purple-800 dark:text-purple-400 dark:bg-purple-950/40 text-[10px]"
              >
                <Sparkles className="h-2.5 w-2.5" />
                AI Generated
              </Badge>
            </div>
            <CardDescription>Predictive intelligence based on your firm&apos;s data patterns</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <InsightsSkeleton />
            ) : (
              <ScrollArea className="max-h-80">
                <div className="space-y-2 pr-2">
                  <AnimatePresence>
                    {insights.map((insight, index) => {
                      const colorMap: Record<string, string> = {
                        emerald: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40',
                        purple: 'text-purple-500 bg-purple-50 dark:bg-purple-950/40',
                        amber: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40',
                        red: 'text-red-500 bg-red-50 dark:bg-red-950/40',
                      };
                      const cls = colorMap[insight.color] || colorMap.emerald;

                      return (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.5 + index * 0.08, duration: 0.4 }}
                          whileHover={{
                            x: 4,
                            backgroundColor: 'rgba(139, 92, 246, 0.03)',
                          }}
                          className="flex items-center gap-3 p-3 rounded-xl border border-border/30 hover:border-purple-200/50 dark:hover:border-purple-800/50 transition-all cursor-pointer group"
                        >
                          <div
                            className={`flex items-center justify-center h-9 w-9 rounded-lg shrink-0 ${cls}`}
                          >
                            {insight.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground leading-snug">
                              {insight.text}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="text-[10px] px-2 py-0.5 shrink-0 border-purple-200 text-purple-700 bg-purple-50/80 dark:border-purple-800 dark:text-purple-400 dark:bg-purple-950/40"
                          >
                            {Math.round(insight.confidence * 100)}%
                          </Badge>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </div>
      </AnimatedCard>
    </div>
  );
}
