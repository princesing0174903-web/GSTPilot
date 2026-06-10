'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  GitCompare,
  Sparkles,
  Shield,
  Clock,
  BarChart3,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '@/lib/gst-utils';

// ─── Color Palette ─────────────────────────────────────────────────────────
const COLORS = {
  emerald: '#10b981',
  emeraldDark: '#059669',
  teal: '#14b8a6',
  purple: '#8b5cf6',
  amber: '#f59e0b',
  red: '#ef4444',
  slate: '#64748b',
  blue: '#3b82f6',
};

// ─── Types ─────────────────────────────────────────────────────────────────
interface BenchmarkMetric {
  name: string;
  clientValue: number;
  industryAverage: number;
  stateAverage: number;
  firmAverage: number;
  industryPercentile: number;
  statePercentile: number;
  firmPercentile: number;
  unit: string;
  inverted?: boolean; // lower is better (e.g., risk score)
  icon: React.ElementType;
  color: string;
}

interface ClientBenchmark {
  id: string;
  name: string;
  complianceScore: number;
  filingTimeliness: number;
  gstVolume: number;
  riskScore: number;
  overallPercentile: number;
}

// ─── Mock Data ─────────────────────────────────────────────────────────────
const mockClientMetrics: Record<string, BenchmarkMetric[]> = {
  'techcorp-india': [
    {
      name: 'Compliance Score',
      clientValue: 87,
      industryAverage: 72,
      stateAverage: 68,
      firmAverage: 79,
      industryPercentile: 82,
      statePercentile: 88,
      firmPercentile: 71,
      unit: '%',
      icon: Shield,
      color: COLORS.emerald,
    },
    {
      name: 'Filing Timeliness',
      clientValue: 92,
      industryAverage: 78,
      stateAverage: 74,
      firmAverage: 85,
      industryPercentile: 90,
      statePercentile: 93,
      firmPercentile: 78,
      unit: '%',
      icon: Clock,
      color: COLORS.teal,
    },
    {
      name: 'GST Volume',
      clientValue: 2450000,
      industryAverage: 1800000,
      stateAverage: 1500000,
      firmAverage: 2100000,
      industryPercentile: 75,
      statePercentile: 82,
      firmPercentile: 65,
      unit: '₹',
      icon: BarChart3,
      color: COLORS.purple,
    },
    {
      name: 'Risk Score',
      clientValue: 18,
      industryAverage: 35,
      stateAverage: 40,
      firmAverage: 28,
      industryPercentile: 88,
      statePercentile: 91,
      firmPercentile: 76,
      unit: '',
      inverted: true,
      icon: AlertTriangle,
      color: COLORS.amber,
    },
  ],
};

const defaultMetrics: BenchmarkMetric[] = [
  {
    name: 'Compliance Score',
    clientValue: 82,
    industryAverage: 72,
    stateAverage: 68,
    firmAverage: 79,
    industryPercentile: 78,
    statePercentile: 84,
    firmPercentile: 68,
    unit: '%',
    icon: Shield,
    color: COLORS.emerald,
  },
  {
    name: 'Filing Timeliness',
    clientValue: 88,
    industryAverage: 78,
    stateAverage: 74,
    firmAverage: 85,
    industryPercentile: 85,
    statePercentile: 89,
    firmPercentile: 72,
    unit: '%',
    icon: Clock,
    color: COLORS.teal,
  },
  {
    name: 'GST Volume',
    clientValue: 1850000,
    industryAverage: 1800000,
    stateAverage: 1500000,
    firmAverage: 2100000,
    industryPercentile: 55,
    statePercentile: 68,
    firmPercentile: 42,
    unit: '₹',
    icon: BarChart3,
    color: COLORS.purple,
  },
  {
    name: 'Risk Score',
    clientValue: 25,
    industryAverage: 35,
    stateAverage: 40,
    firmAverage: 28,
    industryPercentile: 80,
    statePercentile: 85,
    firmPercentile: 70,
    unit: '',
    inverted: true,
    icon: AlertTriangle,
    color: COLORS.amber,
  },
];

const mockClients: ClientBenchmark[] = [
  { id: 'techcorp-india', name: 'TechCorp India Pvt Ltd', complianceScore: 87, filingTimeliness: 92, gstVolume: 2450000, riskScore: 18, overallPercentile: 84 },
  { id: 'sharma-enterprises', name: 'Sharma Enterprises', complianceScore: 72, filingTimeliness: 68, gstVolume: 890000, riskScore: 42, overallPercentile: 56 },
  { id: 'global-traders', name: 'Global Traders Ltd', complianceScore: 91, filingTimeliness: 95, gstVolume: 3200000, riskScore: 12, overallPercentile: 92 },
  { id: 'patel-industries', name: 'Patel Industries', complianceScore: 65, filingTimeliness: 58, gstVolume: 1200000, riskScore: 55, overallPercentile: 38 },
  { id: 'sunrise-exports', name: 'Sunrise Exports', complianceScore: 78, filingTimeliness: 82, gstVolume: 1800000, riskScore: 30, overallPercentile: 66 },
  { id: 'metro-retail', name: 'Metro Retail Chain', complianceScore: 84, filingTimeliness: 88, gstVolume: 5600000, riskScore: 22, overallPercentile: 78 },
  { id: 'kv-associates', name: 'KV Associates', complianceScore: 55, filingTimeliness: 45, gstVolume: 450000, riskScore: 68, overallPercentile: 22 },
  { id: 'prime-construction', name: 'Prime Construction', complianceScore: 76, filingTimeliness: 71, gstVolume: 2100000, riskScore: 35, overallPercentile: 60 },
  { id: 'indus-pharma', name: 'Indus Pharma Ltd', complianceScore: 93, filingTimeliness: 97, gstVolume: 4800000, riskScore: 8, overallPercentile: 95 },
  { id: 'green-energy-co', name: 'Green Energy Co', complianceScore: 69, filingTimeliness: 62, gstVolume: 780000, riskScore: 48, overallPercentile: 44 },
];

// ─── Animated Card ─────────────────────────────────────────────────────────
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

// ─── Skeletons ─────────────────────────────────────────────────────────────
function MetricCardSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-8 w-20" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map(i => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

// ─── Comparison Bar Component ──────────────────────────────────────────────
function ComparisonBar({
  clientValue,
  maxValue,
  color,
  inverted,
}: {
  clientValue: number;
  maxValue: number;
  color: string;
  inverted?: boolean;
}) {
  const pct = Math.min((clientValue / maxValue) * 100, 100);

  return (
    <div className="h-2.5 w-full rounded-full bg-muted/30 overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
      />
    </div>
  );
}

// ─── Percentile Badge ──────────────────────────────────────────────────────
function PercentileBadge({ label, value }: { label: string; value: number }) {
  const getColor = (v: number) => {
    if (v >= 75) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400';
    if (v >= 50) return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400';
    return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400';
  };

  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-muted-foreground min-w-[48px]">{label}</span>
      <Badge
        className={`text-[10px] px-1.5 py-0.5 font-semibold border-0 ${getColor(value)}`}
      >
        P{value}
      </Badge>
    </div>
  );
}

// ─── Format value based on unit ────────────────────────────────────────────
function formatMetricValue(value: number, unit: string): string {
  if (unit === '₹') return formatCurrency(value);
  if (unit === '%') return `${value}%`;
  return value.toString();
}

// ─── Get performance color ─────────────────────────────────────────────────
function getPerformanceColor(percentile: number): string {
  if (percentile >= 75) return 'text-emerald-600 dark:text-emerald-400';
  if (percentile >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function getPerformanceBg(percentile: number): string {
  if (percentile >= 75) return 'bg-emerald-50 dark:bg-emerald-950/30';
  if (percentile >= 50) return 'bg-amber-50 dark:bg-amber-950/30';
  return 'bg-red-50 dark:bg-red-950/30';
}

function getPerformanceBorder(percentile: number): string {
  if (percentile >= 75) return 'border-emerald-200 dark:border-emerald-800';
  if (percentile >= 50) return 'border-amber-200 dark:border-amber-800';
  return 'border-red-200 dark:border-red-800';
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function AIBenchmarkPage() {
  // ── State ────────────────────────────────────────────────────────────────
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [clients, setClients] = useState<ClientBenchmark[]>([]);
  const [metrics, setMetrics] = useState<BenchmarkMetric[]>(defaultMetrics);
  const [loading, setLoading] = useState(true);
  const [sortColumn, setSortColumn] = useState<string>('overallPercentile');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // ── Fetch data ───────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/ai-benchmark');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.clients) && data.clients.length > 0) {
          setClients(data.clients);
        } else {
          setClients(mockClients);
        }
        if (data.metrics) {
          setMetrics(data.metrics);
        } else {
          setMetrics(defaultMetrics);
        }
      } else {
        setClients(mockClients);
        setMetrics(defaultMetrics);
      }
    } catch {
      setClients(mockClients);
      setMetrics(defaultMetrics);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Update metrics when client changes ───────────────────────────────────
  useEffect(() => {
    if (selectedClient === 'all') {
      // Show firm-wide averages
      setMetrics(defaultMetrics);
    } else {
      const clientMetrics = mockClientMetrics[selectedClient];
      if (clientMetrics) {
        setMetrics(clientMetrics);
      } else {
        // Generate varied metrics for other clients
        const client = clients.find(c => c.id === selectedClient);
        if (client) {
          setMetrics([
            {
              name: 'Compliance Score',
              clientValue: client.complianceScore,
              industryAverage: 72,
              stateAverage: 68,
              firmAverage: 79,
              industryPercentile: Math.round(client.complianceScore * 0.95),
              statePercentile: Math.round(client.complianceScore * 1.02),
              firmPercentile: Math.round(client.complianceScore * 0.87),
              unit: '%',
              icon: Shield,
              color: COLORS.emerald,
            },
            {
              name: 'Filing Timeliness',
              clientValue: client.filingTimeliness,
              industryAverage: 78,
              stateAverage: 74,
              firmAverage: 85,
              industryPercentile: Math.round(client.filingTimeliness * 0.97),
              statePercentile: Math.round(client.filingTimeliness * 1.01),
              firmPercentile: Math.round(client.filingTimeliness * 0.85),
              unit: '%',
              icon: Clock,
              color: COLORS.teal,
            },
            {
              name: 'GST Volume',
              clientValue: client.gstVolume,
              industryAverage: 1800000,
              stateAverage: 1500000,
              firmAverage: 2100000,
              industryPercentile: Math.round(40 + Math.random() * 45),
              statePercentile: Math.round(50 + Math.random() * 40),
              firmPercentile: Math.round(30 + Math.random() * 50),
              unit: '₹',
              icon: BarChart3,
              color: COLORS.purple,
            },
            {
              name: 'Risk Score',
              clientValue: client.riskScore,
              industryAverage: 35,
              stateAverage: 40,
              firmAverage: 28,
              industryPercentile: 100 - Math.round(client.riskScore * 1.1),
              statePercentile: 100 - Math.round(client.riskScore * 1.15),
              firmPercentile: 100 - Math.round(client.riskScore * 0.95),
              unit: '',
              inverted: true,
              icon: AlertTriangle,
              color: COLORS.amber,
            },
          ]);
        }
      }
    }
  }, [selectedClient, clients]);

  // ── Percentile Rankings Chart Data ───────────────────────────────────────
  const percentileChartData = useMemo(() => [
    {
      metric: 'Compliance',
      Industry: metrics[0]?.industryPercentile ?? 0,
      State: metrics[0]?.statePercentile ?? 0,
      Firm: metrics[0]?.firmPercentile ?? 0,
    },
    {
      metric: 'Filing',
      Industry: metrics[1]?.industryPercentile ?? 0,
      State: metrics[1]?.statePercentile ?? 0,
      Firm: metrics[1]?.firmPercentile ?? 0,
    },
    {
      metric: 'GST Volume',
      Industry: metrics[2]?.industryPercentile ?? 0,
      State: metrics[2]?.statePercentile ?? 0,
      Firm: metrics[2]?.firmPercentile ?? 0,
    },
    {
      metric: 'Risk',
      Industry: metrics[3]?.industryPercentile ?? 0,
      State: metrics[3]?.statePercentile ?? 0,
      Firm: metrics[3]?.firmPercentile ?? 0,
    },
  ], [metrics]);

  const percentileChartConfig = {
    Industry: { label: 'Industry', color: COLORS.emerald },
    State: { label: 'State', color: COLORS.purple },
    Firm: { label: 'Firm', color: COLORS.amber },
  };

  // ── Sort clients ─────────────────────────────────────────────────────────
  const sortedClients = useMemo(() => {
    const sorted = [...clients].sort((a, b) => {
      const aVal = a[sortColumn as keyof ClientBenchmark] as number;
      const bVal = b[sortColumn as keyof ClientBenchmark] as number;
      return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
    });
    return sorted;
  }, [clients, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/50">
            <GitCompare className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              AI Benchmark
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Compare clients against industry and firm averages
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
        </div>
      </motion.div>

      {/* ═══ CLIENT SELECTOR ═══ */}
      <AnimatedCard delay={0.05}>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <span className="text-sm font-medium text-foreground">Select Client:</span>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-full sm:w-72 border-emerald-200 focus:border-emerald-500 dark:border-emerald-800">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients (Firm Average)</SelectItem>
                {clients.map(client => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedClient !== 'all' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2"
              >
                <Badge
                  className={`font-semibold border-0 ${
                    (clients.find(c => c.id === selectedClient)?.overallPercentile ?? 0) >= 75
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                      : (clients.find(c => c.id === selectedClient)?.overallPercentile ?? 0) >= 50
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                  }`}
                >
                  Overall P{clients.find(c => c.id === selectedClient)?.overallPercentile ?? 0}
                </Badge>
              </motion.div>
            )}
          </div>
        </CardContent>
      </AnimatedCard>

      {/* ═══ BENCHMARK DASHBOARD: 4 METRIC CARDS ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          metrics.map((metric, index) => {
            const maxValue = Math.max(
              metric.clientValue,
              metric.industryAverage,
              metric.stateAverage,
              metric.firmAverage
            ) * 1.15;

            return (
              <AnimatedCard key={metric.name} delay={0.1 + index * 0.05}>
                <CardContent className="p-5">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${metric.color}15` }}
                        >
                          <metric.icon className="h-4 w-4" style={{ color: metric.color }} />
                        </div>
                        <span className="text-sm font-semibold text-foreground">{metric.name}</span>
                      </div>
                      {metric.inverted && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1.5 py-0 border-amber-200 text-amber-600 bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:bg-amber-950/30"
                        >
                          Lower is better
                        </Badge>
                      )}
                    </div>

                    {/* Client Value (Large) */}
                    <div>
                      <span
                        className="text-3xl font-bold"
                        style={{ color: metric.color }}
                      >
                        {formatMetricValue(metric.clientValue, metric.unit)}
                      </span>
                      {!metric.inverted && metric.clientValue > metric.industryAverage && (
                        <span className="ml-2 inline-flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <TrendingUp className="h-3 w-3 mr-0.5" />
                          Above avg
                        </span>
                      )}
                      {!metric.inverted && metric.clientValue <= metric.industryAverage && (
                        <span className="ml-2 inline-flex items-center text-xs font-medium text-red-600 dark:text-red-400">
                          <TrendingDown className="h-3 w-3 mr-0.5" />
                          Below avg
                        </span>
                      )}
                      {metric.inverted && metric.clientValue < metric.industryAverage && (
                        <span className="ml-2 inline-flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <TrendingDown className="h-3 w-3 mr-0.5" />
                          Good
                        </span>
                      )}
                    </div>

                    {/* Comparison Bars */}
                    <div className="space-y-2.5">
                      {/* Client */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground">Client</span>
                          <span className="font-semibold" style={{ color: metric.color }}>
                            {formatMetricValue(metric.clientValue, metric.unit)}
                          </span>
                        </div>
                        <ComparisonBar
                          clientValue={metric.clientValue}
                          maxValue={maxValue}
                          color={metric.color}
                          inverted={metric.inverted}
                        />
                      </div>
                      {/* Industry Average */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Industry Avg</span>
                          <span className="text-muted-foreground">
                            {formatMetricValue(metric.industryAverage, metric.unit)}
                          </span>
                        </div>
                        <ComparisonBar
                          clientValue={metric.industryAverage}
                          maxValue={maxValue}
                          color={COLORS.emerald}
                          inverted={metric.inverted}
                        />
                      </div>
                      {/* State Average */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">State Avg</span>
                          <span className="text-muted-foreground">
                            {formatMetricValue(metric.stateAverage, metric.unit)}
                          </span>
                        </div>
                        <ComparisonBar
                          clientValue={metric.stateAverage}
                          maxValue={maxValue}
                          color={COLORS.purple}
                          inverted={metric.inverted}
                        />
                      </div>
                      {/* Firm Average */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Firm Avg</span>
                          <span className="text-muted-foreground">
                            {formatMetricValue(metric.firmAverage, metric.unit)}
                          </span>
                        </div>
                        <ComparisonBar
                          clientValue={metric.firmAverage}
                          maxValue={maxValue}
                          color={COLORS.amber}
                          inverted={metric.inverted}
                        />
                      </div>
                    </div>

                    {/* Percentile Badges */}
                    <div className="flex items-center gap-3 pt-1 border-t border-border/20">
                      <PercentileBadge label="Industry" value={metric.industryPercentile} />
                      <PercentileBadge label="State" value={metric.statePercentile} />
                      <PercentileBadge label="Firm" value={metric.firmPercentile} />
                    </div>
                  </div>
                </CardContent>
              </AnimatedCard>
            );
          })
        )}
      </div>

      {/* ═══ PERCENTILE RANKINGS CHART ═══ */}
      <AnimatedCard delay={0.35}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-emerald-500" />
            Percentile Rankings
          </CardTitle>
          <CardDescription>
            Client percentile rankings across benchmark metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <ChartSkeleton />
          ) : (
            <ChartContainer config={percentileChartConfig} className="h-72 w-full">
              <BarChart data={percentileChartData} barCategoryGap="20%" barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-700/50" />
                <XAxis
                  dataKey="metric"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  domain={[0, 100]}
                  tickFormatter={(v: number) => `P${v}`}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
                />
                <Bar dataKey="Industry" fill={COLORS.emerald} radius={[3, 3, 0, 0]} />
                <Bar dataKey="State" fill={COLORS.purple} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Firm" fill={COLORS.amber} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </AnimatedCard>

      {/* ═══ ALL CLIENTS COMPARISON TABLE ═══ */}
      <AnimatedCard delay={0.4}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <GitCompare className="h-4 w-4 text-emerald-500" />
                All Clients Comparison
              </CardTitle>
              <CardDescription>
                Client benchmark scores across all metrics
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] px-2 py-0.5 border-emerald-200 text-emerald-700 bg-emerald-50/80 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/40"
            >
              {clients.length} clients
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold">Client</TableHead>
                    <SortableHeader
                      label="Compliance %"
                      column="complianceScore"
                      currentColumn={sortColumn}
                      direction={sortDirection}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Filing %"
                      column="filingTimeliness"
                      currentColumn={sortColumn}
                      direction={sortDirection}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="GST Volume"
                      column="gstVolume"
                      currentColumn={sortColumn}
                      direction={sortDirection}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Risk Score"
                      column="riskScore"
                      currentColumn={sortColumn}
                      direction={sortDirection}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Overall Percentile"
                      column="overallPercentile"
                      currentColumn={sortColumn}
                      direction={sortDirection}
                      onSort={handleSort}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {sortedClients.map((client, index) => (
                      <motion.tr
                        key={client.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.03 * index, duration: 0.3 }}
                        className={`group cursor-pointer transition-colors ${
                          selectedClient === client.id
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
                            : 'hover:bg-emerald-50/20 dark:hover:bg-emerald-950/10'
                        }`}
                        onClick={() => setSelectedClient(client.id)}
                      >
                        <TableCell className="text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${
                              client.overallPercentile >= 75
                                ? 'bg-emerald-500'
                                : client.overallPercentile >= 50
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`} />
                            {client.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm font-semibold ${getPerformanceColor(client.complianceScore)}`}>
                            {client.complianceScore}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm font-semibold ${getPerformanceColor(client.filingTimeliness)}`}>
                            {client.filingTimeliness}%
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatCurrency(client.gstVolume)}
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm font-semibold ${
                            client.riskScore <= 25
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : client.riskScore <= 50
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {client.riskScore}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 rounded-full bg-muted/30 overflow-hidden">
                              <motion.div
                                className={`h-full rounded-full ${
                                  client.overallPercentile >= 75
                                    ? 'bg-emerald-500'
                                    : client.overallPercentile >= 50
                                    ? 'bg-amber-500'
                                    : 'bg-red-500'
                                }`}
                                initial={{ width: 0 }}
                                animate={{ width: `${client.overallPercentile}%` }}
                                transition={{ duration: 0.8, delay: 0.1 * index, ease: 'easeOut' }}
                              />
                            </div>
                            <Badge
                              className={`text-[10px] px-1.5 py-0.5 font-semibold border-0 ${getPerformanceBg(client.overallPercentile)} ${getPerformanceColor(client.overallPercentile)}`}
                            >
                              P{client.overallPercentile}
                            </Badge>
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </AnimatedCard>
    </div>
  );
}

// ─── Sortable Table Header ─────────────────────────────────────────────────
function SortableHeader({
  label,
  column,
  currentColumn,
  direction,
  onSort,
}: {
  label: string;
  column: string;
  currentColumn: string;
  direction: 'asc' | 'desc';
  onSort: (column: string) => void;
}) {
  const isActive = currentColumn === column;

  return (
    <TableHead className="text-xs font-semibold">
      <button
        onClick={() => onSort(column)}
        className={`flex items-center gap-1 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors ${
          isActive ? 'text-emerald-600 dark:text-emerald-400' : ''
        }`}
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 ${isActive ? 'text-emerald-500' : 'text-muted-foreground/50'}`} />
        {isActive && (
          <span className="text-[9px] text-muted-foreground">
            {direction === 'desc' ? '↓' : '↑'}
          </span>
        )}
      </button>
    </TableHead>
  );
}
