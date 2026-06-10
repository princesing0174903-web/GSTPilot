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
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  ShieldCheck,
  Sparkles,
  Activity,
  AlertTriangle,
  AlertCircle,
  Shield,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Users,
  FileWarning,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatNumber } from '@/lib/gst-utils';

// ─── Color Palette (Emerald/Red — Risk theme) ────────────────────────────
const COLORS = {
  emerald: '#10b981',
  emeraldDark: '#059669',
  red: '#ef4444',
  redLight: '#fee2e2',
  amber: '#f59e0b',
  amberLight: '#fef3c7',
  orange: '#f97316',
  orangeLight: '#ffedd5',
  purple: '#8b5cf6',
  slate: '#64748b',
};

// ─── Types ────────────────────────────────────────────────────────────────
interface ClientRiskData {
  clientId: string;
  clientName: string;
  gstin: string;
  overallScore: number;
  riskLevel: string;
  lateFilings: number;
  noticeFrequency: number;
  gstMismatches: number;
  vendorRisk: number;
  itcRisk: number;
}

interface AggregateStats {
  low: number;
  medium: number;
  high: number;
  critical: number;
  averageScore: number;
}

interface HeatmapEntry {
  clientId: string;
  clientName: string;
  scores: {
    lateFilings: number;
    noticeFrequency: number;
    gstMismatches: number;
    vendorRisk: number;
    itcRisk: number;
  };
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
        className={`hover:shadow-lg hover:shadow-red-500/5 transition-all duration-300 border-border/50 backdrop-blur-sm bg-card/80 ${className}`}
      >
        {children}
      </Card>
    </motion.div>
  );
}

// ─── Risk Level Badge ─────────────────────────────────────────────────────
function RiskLevelBadge({ level }: { level: string }) {
  const config: Record<string, { cls: string; label: string }> = {
    low: {
      cls: 'border-emerald-200 text-emerald-700 bg-emerald-50/80 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/40',
      label: 'Low',
    },
    medium: {
      cls: 'border-amber-200 text-amber-700 bg-amber-50/80 dark:border-amber-800 dark:text-amber-400 dark:bg-amber-950/40',
      label: 'Medium',
    },
    high: {
      cls: 'border-orange-200 text-orange-700 bg-orange-50/80 dark:border-orange-800 dark:text-orange-400 dark:bg-orange-950/40',
      label: 'High',
    },
    critical: {
      cls: 'border-red-200 text-red-700 bg-red-50/80 dark:border-red-800 dark:text-red-400 dark:bg-red-950/40',
      label: 'Critical',
    },
  };
  const c = config[level] || config.low;

  return (
    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 font-semibold ${c.cls}`}>
      {c.label}
    </Badge>
  );
}

// ─── Risk Score Bar ───────────────────────────────────────────────────────
function RiskScoreBar({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 75) return 'bg-red-500';
    if (s >= 50) return 'bg-orange-500';
    if (s >= 25) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${getColor(score)}`}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs font-semibold text-foreground w-8 text-right">{score}</span>
    </div>
  );
}

// ─── Heatmap Cell ─────────────────────────────────────────────────────────
function getHeatmapCellColor(value: number, maxVal: number): string {
  if (maxVal === 0) return 'bg-emerald-100 dark:bg-emerald-900/30';
  const ratio = value / maxVal;
  if (ratio >= 0.75) return 'bg-red-400 dark:bg-red-500';
  if (ratio >= 0.5) return 'bg-orange-400 dark:bg-orange-500';
  if (ratio >= 0.25) return 'bg-amber-300 dark:bg-amber-500';
  if (value > 0) return 'bg-emerald-300 dark:bg-emerald-500';
  return 'bg-emerald-100 dark:bg-emerald-900/30';
}

// ─── Skeleton Loaders ─────────────────────────────────────────────────────
function SummaryCardSkeleton() {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4 flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-12" />
        </div>
      </CardContent>
    </Card>
  );
}

function HeatmapSkeleton() {
  return (
    <div className="space-y-3 p-4">
      <div className="grid grid-cols-6 gap-2">
        {Array.from({ length: 30 }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-md" />
        ))}
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-lg" />
      ))}
    </div>
  );
}

function RecommendationsSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ─── Generate Risk Recommendations ────────────────────────────────────────
function generateRecommendations(
  aggregate: AggregateStats,
  clients: ClientRiskData[]
) {
  const recs: {
    icon: React.ReactNode;
    title: string;
    description: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
  }[] = [];

  if (aggregate.critical > 0) {
    const criticalClients = clients
      .filter((c) => c.riskLevel === 'critical')
      .slice(0, 3)
      .map((c) => c.clientName)
      .join(', ');
    recs.push({
      icon: <AlertCircle className="h-4 w-4" />,
      title: 'Immediate attention required for critical-risk clients',
      description: `${criticalClients} — schedule compliance review and remediation immediately.`,
      priority: 'critical',
    });
  }

  if (aggregate.high > 0) {
    recs.push({
      icon: <AlertTriangle className="h-4 w-4" />,
      title: 'High-risk clients need proactive monitoring',
      description: `${aggregate.high} client(s) scored above 50. Set up weekly risk monitoring and escalation workflows.`,
      priority: 'high',
    });
  }

  const highLateFilings = clients.filter((c) => c.lateFilings > 2);
  if (highLateFilings.length > 0) {
    recs.push({
      icon: <Clock className="h-4 w-4" />,
      title: 'Address recurring late filings',
      description: `${highLateFilings.length} client(s) have 3+ late filings. Implement automated reminders and dedicated filing timelines.`,
      priority: 'high',
    });
  }

  const highMismatch = clients.filter((c) => c.gstMismatches > 3);
  if (highMismatch.length > 0) {
    recs.push({
      icon: <FileWarning className="h-4 w-4" />,
      title: 'Resolve GST mismatches systematically',
      description: `${highMismatch.length} client(s) have significant GST mismatches. Run reconciliation and vendor verification.`,
      priority: 'medium',
    });
  }

  if (aggregate.low > 0) {
    recs.push({
      icon: <CheckCircle2 className="h-4 w-4" />,
      title: 'Maintain compliance for low-risk clients',
      description: `${aggregate.low} client(s) are in good standing. Continue regular monitoring and share compliance reports.`,
      priority: 'low',
    });
  }

  if (recs.length === 0) {
    recs.push({
      icon: <Shield className="h-4 w-4" />,
      title: 'Risk assessment complete — no critical issues',
      description: 'All clients are within acceptable risk thresholds. Continue periodic reviews.',
      priority: 'low',
    });
  }

  return recs;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function AIRiskEnginePage() {
  const [clients, setClients] = useState<ClientRiskData[]>([]);
  const [aggregate, setAggregate] = useState<AggregateStats>({
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
    averageScore: 0,
  });
  const [heatmapData, setHeatmapData] = useState<HeatmapEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>('overallScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // ── Data Fetching ──────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/ai-risk');
      if (!res.ok) throw new Error('Failed to fetch AI Risk data');
      const data = await res.json();
      setClients(data.clients ?? []);
      setAggregate(
        data.aggregate ?? { low: 0, medium: 0, high: 0, critical: 0, averageScore: 0 }
      );
      setHeatmapData(data.heatmapData ?? []);
    } catch (err) {
      console.error('AI Risk fetch error:', err);
      setError('Failed to load risk data. Using fallback data.');
      // Fallback mock data
      setClients([
        { clientId: '1', clientName: 'Acme Corp', gstin: '27AADCA1234F1Z5', overallScore: 85, riskLevel: 'critical', lateFilings: 5, noticeFrequency: 3, gstMismatches: 8, vendorRisk: 72, itcRisk: 65 },
        { clientId: '2', clientName: 'Beta Industries', gstin: '27AADCB5678G2Z3', overallScore: 62, riskLevel: 'high', lateFilings: 3, noticeFrequency: 2, gstMismatches: 5, vendorRisk: 45, itcRisk: 38 },
        { clientId: '3', clientName: 'Gamma Solutions', gstin: '27AADCG9012H3Z1', overallScore: 40, riskLevel: 'medium', lateFilings: 1, noticeFrequency: 1, gstMismatches: 2, vendorRisk: 25, itcRisk: 20 },
        { clientId: '4', clientName: 'Delta Traders', gstin: '27AADCD3456I4Z9', overallScore: 15, riskLevel: 'low', lateFilings: 0, noticeFrequency: 0, gstMismatches: 1, vendorRisk: 8, itcRisk: 5 },
        { clientId: '5', clientName: 'Epsilon Ltd', gstin: '27AADCE7890J5Z7', overallScore: 78, riskLevel: 'high', lateFilings: 4, noticeFrequency: 2, gstMismatches: 6, vendorRisk: 60, itcRisk: 55 },
      ]);
      setAggregate({ low: 1, medium: 1, high: 2, critical: 1, averageScore: 56 });
      setHeatmapData([
        { clientId: '1', clientName: 'Acme Corp', scores: { lateFilings: 5, noticeFrequency: 3, gstMismatches: 8, vendorRisk: 72, itcRisk: 65 } },
        { clientId: '2', clientName: 'Beta Industries', scores: { lateFilings: 3, noticeFrequency: 2, gstMismatches: 5, vendorRisk: 45, itcRisk: 38 } },
        { clientId: '3', clientName: 'Gamma Solutions', scores: { lateFilings: 1, noticeFrequency: 1, gstMismatches: 2, vendorRisk: 25, itcRisk: 20 } },
        { clientId: '4', clientName: 'Delta Traders', scores: { lateFilings: 0, noticeFrequency: 0, gstMismatches: 1, vendorRisk: 8, itcRisk: 5 } },
        { clientId: '5', clientName: 'Epsilon Ltd', scores: { lateFilings: 4, noticeFrequency: 2, gstMismatches: 6, vendorRisk: 60, itcRisk: 55 } },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Sorting ────────────────────────────────────────────────────────────
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortedClients = [...clients].sort((a, b) => {
    const aVal = a[sortField as keyof ClientRiskData] as number;
    const bVal = b[sortField as keyof ClientRiskData] as number;
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ChevronDown className="h-3 w-3 opacity-30" />;
    return sortDir === 'desc' ? (
      <ChevronDown className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
    ) : (
      <ChevronUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
    );
  };

  // ── Recommendations ────────────────────────────────────────────────────
  const recommendations = generateRecommendations(aggregate, clients);

  // ── Heatmap max values per column ──────────────────────────────────────
  const heatmapCategories = [
    { key: 'lateFilings', label: 'Late Filings' },
    { key: 'noticeFrequency', label: 'Notice Freq.' },
    { key: 'gstMismatches', label: 'GST Mismatches' },
    { key: 'vendorRisk', label: 'Vendor Risk' },
    { key: 'itcRisk', label: 'ITC Risk' },
  ] as const;

  const maxValues: Record<string, number> = {};
  for (const cat of heatmapCategories) {
    const key = cat.key;
    maxValues[key] = Math.max(
      1,
      ...heatmapData.map((h) => h.scores[key])
    );
  }

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
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-500/20">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              AI Risk Engine
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              GST risk scoring and analysis
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
            className="gap-1.5 px-3 py-1.5 border-red-200 text-red-700 bg-red-50/80 dark:border-red-800 dark:text-red-400 dark:bg-red-950/40"
          >
            <Activity className="h-3.5 w-3.5 animate-pulse" />
            Live Scoring
          </Badge>
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

      {/* ═══ RISK SUMMARY ROW (4 cards) ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SummaryCardSkeleton key={i} />)
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.05, duration: 0.5, ease: 'easeOut' }}
            >
              <Card className="border-border/50 hover:shadow-lg hover:shadow-emerald-500/5 transition-all overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-emerald-500 to-emerald-300" />
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600/70 dark:text-emerald-400/70">
                      Low Risk
                    </p>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                      {aggregate.low}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5, ease: 'easeOut' }}
            >
              <Card className="border-border/50 hover:shadow-lg hover:shadow-amber-500/5 transition-all overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-amber-500 to-amber-300" />
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600/70 dark:text-amber-400/70">
                      Medium Risk
                    </p>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                      {aggregate.medium}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.15, duration: 0.5, ease: 'easeOut' }}
            >
              <Card className="border-border/50 hover:shadow-lg hover:shadow-orange-500/5 transition-all overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-orange-500 to-orange-300" />
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-600/70 dark:text-orange-400/70">
                      High Risk
                    </p>
                    <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                      {aggregate.high}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5, ease: 'easeOut' }}
            >
              <Card className="border-border/50 hover:shadow-lg hover:shadow-red-500/5 transition-all overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-red-500 to-red-300" />
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-red-600/70 dark:text-red-400/70">
                      Critical Risk
                    </p>
                    <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                      {aggregate.critical}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </div>

      {/* ═══ RISK HEATMAP ═══ */}
      <AnimatedCard delay={0.25}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5 text-emerald-500" />
            Risk Heatmap
          </CardTitle>
          <CardDescription>Risk severity by client and category</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <HeatmapSkeleton />
          ) : heatmapData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No risk data available for heatmap
            </div>
          ) : (
            <ScrollArea className="max-h-80">
              <div className="min-w-[500px]">
                {/* Header row */}
                <div className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: '140px repeat(5, 1fr)' }}>
                  <div className="text-xs font-semibold text-muted-foreground flex items-center px-2">
                    Client
                  </div>
                  {heatmapCategories.map((cat) => (
                    <div
                      key={cat.key}
                      className="text-[10px] font-semibold text-muted-foreground text-center uppercase tracking-wider px-1"
                    >
                      {cat.label}
                    </div>
                  ))}
                </div>
                {/* Data rows */}
                {heatmapData.slice(0, 10).map((entry, idx) => (
                  <motion.div
                    key={entry.clientId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + idx * 0.05, duration: 0.3 }}
                    className="grid gap-1.5 mb-1.5"
                    style={{ gridTemplateColumns: '140px repeat(5, 1fr)' }}
                  >
                    <div className="text-xs font-medium text-foreground truncate flex items-center px-2">
                      {entry.clientName}
                    </div>
                    {heatmapCategories.map((cat) => {
                      const val = entry.scores[cat.key];
                      const maxVal = maxValues[cat.key];
                      return (
                        <div
                          key={cat.key}
                          className={`flex items-center justify-center h-9 rounded-md text-xs font-semibold ${getHeatmapCellColor(val, maxVal)} text-white dark:text-white/90 transition-all hover:scale-105`}
                          title={`${cat.label}: ${val}`}
                        >
                          {cat.key === 'vendorRisk' || cat.key === 'itcRisk'
                            ? `${val}%`
                            : val}
                        </div>
                      );
                    })}
                  </motion.div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/30">
                <span className="text-[10px] font-medium text-muted-foreground">Severity:</span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-sm bg-emerald-300 dark:bg-emerald-500" />
                    <span className="text-[10px] text-muted-foreground">Low</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-sm bg-amber-300 dark:bg-amber-500" />
                    <span className="text-[10px] text-muted-foreground">Medium</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-sm bg-orange-400 dark:bg-orange-500" />
                    <span className="text-[10px] text-muted-foreground">High</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-sm bg-red-400 dark:bg-red-500" />
                    <span className="text-[10px] text-muted-foreground">Critical</span>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </AnimatedCard>

      {/* ═══ CLIENT RISK TABLE ═══ */}
      <AnimatedCard delay={0.3}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-emerald-500" />
            Client Risk Analysis
          </CardTitle>
          <CardDescription>Click column headers to sort</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton />
          ) : clients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No client risk data available
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Client Name</TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handleSort('overallScore')}
                    >
                      <div className="flex items-center gap-1">
                        Risk Score
                        <SortIcon field="overallScore" />
                      </div>
                    </TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handleSort('lateFilings')}
                    >
                      <div className="flex items-center gap-1">
                        Late Filings
                        <SortIcon field="lateFilings" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handleSort('noticeFrequency')}
                    >
                      <div className="flex items-center gap-1">
                        Notice Freq.
                        <SortIcon field="noticeFrequency" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handleSort('gstMismatches')}
                    >
                      <div className="flex items-center gap-1">
                        GST Mismatches
                        <SortIcon field="gstMismatches" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handleSort('vendorRisk')}
                    >
                      <div className="flex items-center gap-1">
                        Vendor Risk
                        <SortIcon field="vendorRisk" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handleSort('itcRisk')}
                    >
                      <div className="flex items-center gap-1">
                        ITC Risk
                        <SortIcon field="itcRisk" />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {sortedClients.map((client, idx) => (
                      <motion.tr
                        key={client.clientId}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + idx * 0.03, duration: 0.3 }}
                        className="hover:bg-muted/50 border-b transition-colors"
                      >
                        <TableCell className="font-medium text-sm">
                          {client.clientName}
                        </TableCell>
                        <TableCell>
                          <RiskScoreBar score={client.overallScore} />
                        </TableCell>
                        <TableCell>
                          <RiskLevelBadge level={client.riskLevel} />
                        </TableCell>
                        <TableCell className="text-sm">
                          {client.lateFilings}
                        </TableCell>
                        <TableCell className="text-sm">
                          {client.noticeFrequency}
                        </TableCell>
                        <TableCell className="text-sm">
                          {client.gstMismatches}
                        </TableCell>
                        <TableCell className="text-sm">
                          {client.vendorRisk}%
                        </TableCell>
                        <TableCell className="text-sm">
                          {client.itcRisk}%
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </AnimatedCard>

      {/* ═══ RISK RECOMMENDATIONS ═══ */}
      <AnimatedCard delay={0.35}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-emerald-500" />
              AI Risk Recommendations
            </CardTitle>
            <Badge
              variant="outline"
              className="text-[10px] px-2 py-0.5 border-emerald-200 text-emerald-700 bg-emerald-50/80 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/40"
            >
              AI Generated
            </Badge>
          </div>
          <CardDescription>Actionable insights based on risk patterns</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <RecommendationsSkeleton />
          ) : (
            <ScrollArea className="max-h-80">
              <div className="space-y-2 pr-2">
                <AnimatePresence>
                  {recommendations.map((rec, index) => {
                    const priorityConfig: Record<string, { cls: string; iconCls: string }> = {
                      critical: {
                        cls: 'border-red-200 text-red-700 bg-red-50/80 dark:border-red-800 dark:text-red-400 dark:bg-red-950/40',
                        iconCls: 'text-red-500 bg-red-50 dark:bg-red-950/40',
                      },
                      high: {
                        cls: 'border-orange-200 text-orange-700 bg-orange-50/80 dark:border-orange-800 dark:text-orange-400 dark:bg-orange-950/40',
                        iconCls: 'text-orange-500 bg-orange-50 dark:bg-orange-950/40',
                      },
                      medium: {
                        cls: 'border-amber-200 text-amber-700 bg-amber-50/80 dark:border-amber-800 dark:text-amber-400 dark:bg-amber-950/40',
                        iconCls: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40',
                      },
                      low: {
                        cls: 'border-emerald-200 text-emerald-700 bg-emerald-50/80 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/40',
                        iconCls: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40',
                      },
                    };
                    const pCfg = priorityConfig[rec.priority] || priorityConfig.low;

                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + index * 0.08, duration: 0.4 }}
                        whileHover={{
                          x: 4,
                          backgroundColor: 'rgba(16, 185, 129, 0.03)',
                        }}
                        className="flex items-center gap-3 p-3 rounded-xl border border-border/30 hover:border-emerald-200/50 dark:hover:border-emerald-800/50 transition-all cursor-pointer group"
                      >
                        <div
                          className={`flex items-center justify-center h-9 w-9 rounded-lg shrink-0 ${pCfg.iconCls}`}
                        >
                          {rec.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {rec.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {rec.description}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-2 py-0.5 font-semibold shrink-0 ${pCfg.cls}`}
                        >
                          {rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1)}
                        </Badge>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </AnimatedCard>
    </div>
  );
}
