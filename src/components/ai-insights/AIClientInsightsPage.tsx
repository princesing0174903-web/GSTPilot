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
  Lightbulb,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Eye,
  Activity,
  BarChart3,
  ArrowUpRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatNumber } from '@/lib/gst-utils';

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

// ─── Types ────────────────────────────────────────────────────────────────
interface AIObservation {
  id: string;
  text: string;
  confidence: number;
  category: string;
  isTrending?: boolean;
}

interface ClientInsight {
  id: string;
  clientName: string;
  gstin: string;
  healthScore: number;
  trends: {
    growth: 'up' | 'down' | 'stable';
    compliance: 'up' | 'down' | 'stable';
    risk: 'up' | 'down' | 'stable';
    gst: 'up' | 'down' | 'stable';
    payment: 'up' | 'down' | 'stable';
  };
  observations: AIObservation[];
}

interface InsightsData {
  totalObservations: number;
  highConfidence: number;
  trending: number;
  clients: ClientInsight[];
}

// ─── Default / Mock Data ──────────────────────────────────────────────────
const mockInsightsData: InsightsData = {
  totalObservations: 47,
  highConfidence: 32,
  trending: 8,
  clients: [
    {
      id: '1',
      clientName: 'TechVista Solutions Pvt Ltd',
      gstin: '27AABCT1234F1ZP',
      healthScore: 87,
      trends: { growth: 'up', compliance: 'up', risk: 'stable', gst: 'up', payment: 'up' },
      observations: [
        { id: 'o1', text: 'Consistent improvement in filing timeliness over the past 3 quarters suggests improved internal processes.', confidence: 94, category: 'Compliance', isTrending: true },
        { id: 'o2', text: 'Revenue growth of 18% QoQ outpaces industry average of 12%, indicating strong market position.', confidence: 89, category: 'Growth' },
        { id: 'o3', text: 'ITC claims have increased proportionally with input purchases — no anomalous patterns detected.', confidence: 92, category: 'GST' },
        { id: 'o4', text: 'Payment history shows zero delays in the last 6 months — excellent cash flow management.', confidence: 97, category: 'Payment' },
        { id: 'o5', text: 'Risk score has decreased by 15% since last review, now well within low-risk threshold.', confidence: 85, category: 'Risk' },
      ],
    },
    {
      id: '2',
      clientName: 'Maharashtra Traders Corp',
      gstin: '27AADCM5678G2ZR',
      healthScore: 62,
      trends: { growth: 'stable', compliance: 'down', risk: 'up', gst: 'down', payment: 'stable' },
      observations: [
        { id: 'o6', text: 'Two consecutive quarters of delayed GSTR-3B filings detected. Pattern suggests cash flow constraints.', confidence: 91, category: 'Compliance', isTrending: true },
        { id: 'o7', text: 'ITC reversal amounts have increased 22% — potential classification errors in purchase invoices.', confidence: 78, category: 'GST' },
        { id: 'o8', text: 'Risk profile has shifted from medium to medium-high due to recent compliance gaps.', confidence: 86, category: 'Risk' },
        { id: 'o9', text: 'Revenue has remained flat for 2 quarters despite seasonal uptick in industry.', confidence: 72, category: 'Growth' },
      ],
    },
    {
      id: '3',
      clientName: 'GreenLeaf Exports Ltd',
      gstin: '27AABCG9012H3ZK',
      healthScore: 45,
      trends: { growth: 'down', compliance: 'down', risk: 'up', gst: 'down', payment: 'down' },
      observations: [
        { id: 'o10', text: 'Critical: Three mismatch entries in GSTR-2B reconciliation requiring immediate attention.', confidence: 96, category: 'GST', isTrending: true },
        { id: 'o11', text: 'Export turnover declined 30% — may warrant a review of HSN code classifications.', confidence: 83, category: 'Growth' },
        { id: 'o12', text: 'Outstanding tax liability of ₹4.2L detected — payment overdue by 45 days.', confidence: 95, category: 'Payment' },
        { id: 'o13', text: 'Risk of show-cause notice due to persistent ITC claim discrepancies in 3 return periods.', confidence: 88, category: 'Risk' },
      ],
    },
    {
      id: '4',
      clientName: 'Sunrise Retail Chain',
      gstin: '27AABCS3456J4ZL',
      healthScore: 78,
      trends: { growth: 'up', compliance: 'up', risk: 'stable', gst: 'stable', payment: 'up' },
      observations: [
        { id: 'o14', text: 'Multi-location compliance is well-managed with consistent filing across all 5 GSTIN registrations.', confidence: 90, category: 'Compliance' },
        { id: 'o15', text: 'B2C small invoice volume increased 40% — ensure correct E-invoice thresholds are met.', confidence: 82, category: 'GST' },
        { id: 'o16', text: 'Payment patterns are improving with advance tax payments observed in the last 2 months.', confidence: 87, category: 'Payment' },
      ],
    },
    {
      id: '5',
      clientName: 'Pinnacle Infrastructure Pvt Ltd',
      gstin: '27AABCP7890K5ZM',
      healthScore: 71,
      trends: { growth: 'up', compliance: 'stable', risk: 'up', gst: 'stable', payment: 'down' },
      observations: [
        { id: 'o17', text: 'Large project-based revenue spikes may trigger scrutiny — ensure proportional ITC documentation.', confidence: 79, category: 'Risk', isTrending: true },
        { id: 'o18', text: 'Compliance status stable but one delayed filing in Q3 may impact composite score.', confidence: 84, category: 'Compliance' },
        { id: 'o19', text: 'Working capital pressure indicated by delayed vendor payments — monitor GST outflow timing.', confidence: 76, category: 'Payment' },
        { id: 'o20', text: 'Construction sector GST rate changes from next quarter may affect current invoicing patterns.', confidence: 88, category: 'GST' },
      ],
    },
    {
      id: '6',
      clientName: 'Digital Dreams Software',
      gstin: '27AABCD1234L6ZN',
      healthScore: 93,
      trends: { growth: 'up', compliance: 'up', risk: 'down', gst: 'up', payment: 'up' },
      observations: [
        { id: 'o21', text: 'Exemplary compliance record — all filings on time with zero discrepancies for 12 consecutive months.', confidence: 99, category: 'Compliance' },
        { id: 'o22', text: 'ITC optimization opportunity: ₹1.8L in unclaimed input credit from overseas software subscriptions.', confidence: 81, category: 'GST' },
        { id: 'o23', text: 'Low risk profile maintained — eligible for simplified compliance pathway under new CBIC framework.', confidence: 93, category: 'Risk' },
      ],
    },
  ],
};

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
      <Card className={`hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 border-border/50 backdrop-blur-sm bg-card/80 ${className}`}>
        {children}
      </Card>
    </motion.div>
  );
}

// ─── Mini Circular Health Gauge ───────────────────────────────────────────
function MiniHealthGauge({ score }: { score: number }) {
  const size = 56;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const center = size / 2;

  const getColor = (s: number) => {
    if (s >= 80) return '#10b981';
    if (s >= 60) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="relative shrink-0">
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
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={getColor(score)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-xs font-bold ${score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
          {score}
        </span>
      </div>
    </div>
  );
}

// ─── Trend Badge ──────────────────────────────────────────────────────────
function TrendBadge({ trend, label }: { trend: 'up' | 'down' | 'stable'; label: string }) {
  const config = {
    up: { icon: <TrendingUp className="h-3 w-3" />, color: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800' },
    down: { icon: <TrendingDown className="h-3 w-3" />, color: 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/40 dark:border-red-800' },
    stable: { icon: <Minus className="h-3 w-3" />, color: 'text-slate-700 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-950/40 dark:border-slate-700' },
  };
  const c = config[trend];

  return (
    <Badge variant="outline" className={`gap-0.5 px-1.5 py-0.5 text-[10px] font-medium border ${c.color}`}>
      {c.icon}
      {label}
    </Badge>
  );
}

// ─── Confidence Badge ─────────────────────────────────────────────────────
function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color =
    confidence >= 90
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800'
      : confidence >= 75
        ? 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/40 dark:border-amber-800'
        : 'text-slate-700 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-950/40 dark:border-slate-700';

  return (
    <Badge variant="outline" className={`px-1.5 py-0.5 text-[10px] font-semibold border ${color}`}>
      {confidence}% conf.
    </Badge>
  );
}

// ─── Category Badge ───────────────────────────────────────────────────────
function CategoryBadge({ category }: { category: string }) {
  const catColors: Record<string, string> = {
    Compliance: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800',
    Growth: 'text-teal-700 bg-teal-50 border-teal-200 dark:text-teal-400 dark:bg-teal-950/40 dark:border-teal-800',
    Risk: 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/40 dark:border-red-800',
    GST: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/40 dark:border-amber-800',
    Payment: 'text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950/40 dark:border-orange-800',
  };
  const cls = catColors[category] || 'text-slate-700 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-950/40 dark:border-slate-700';

  return (
    <Badge variant="outline" className={`px-1.5 py-0.5 text-[10px] font-medium border ${cls}`}>
      {category}
    </Badge>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────
function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ClientCardSkeleton() {
  return (
    <Card className="border-border/50">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-5 w-16 rounded-full" />
            ))}
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function AIClientInsightsPage() {
  const [data, setData] = useState<InsightsData>(mockInsightsData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

  // ── Fetch data ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/ai-insights');
      if (res.ok) {
        const json = await res.json();
        if (json.clients && json.clients.length > 0) {
          setData(json);
        } else {
          setData(mockInsightsData);
        }
      } else {
        setData(mockInsightsData);
      }
    } catch (err) {
      console.error('AI Insights fetch error:', err);
      setData(mockInsightsData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Toggle expand ───────────────────────────────────────────────────────
  function toggleExpand(clientId: string) {
    setExpandedClientId((prev) => (prev === clientId ? null : clientId));
  }

  // ── Render ──────────────────────────────────────────────────────────────
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
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
            <Lightbulb className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              AI Client Insights
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              AI-powered client analysis and observations
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

      {/* ═══ SUMMARY STATS ROW ═══ */}
      {loading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <AnimatedCard delay={0.05}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                  <Eye className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Observations
                  </p>
                  <p className="text-3xl font-bold text-foreground">
                    {formatNumber(data.totalObservations)}
                  </p>
                </div>
              </div>
            </CardContent>
          </AnimatedCard>

          <AnimatedCard delay={0.1}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/50">
                  <Activity className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    High Confidence
                  </p>
                  <p className="text-3xl font-bold text-foreground">
                    {formatNumber(data.highConfidence)}
                  </p>
                </div>
              </div>
            </CardContent>
          </AnimatedCard>

          <AnimatedCard delay={0.15}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50">
                  <BarChart3 className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Trending
                  </p>
                  <p className="text-3xl font-bold text-foreground">
                    {formatNumber(data.trending)}
                  </p>
                </div>
              </div>
            </CardContent>
          </AnimatedCard>
        </div>
      )}

      {/* ═══ ERROR STATE ═══ */}
      {error && !loading && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ═══ CLIENT INSIGHT CARDS ═══ */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <ClientCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AnimatePresence>
            {data.clients.map((client, index) => {
              const isExpanded = expandedClientId === client.id;
              const visibleObservations = isExpanded
                ? client.observations
                : client.observations.slice(0, 3);

              return (
                <AnimatedCard key={client.id} delay={0.2 + index * 0.06}>
                  <CardContent className="p-4 md:p-6">
                    {/* ─── Client Header ─── */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <MiniHealthGauge score={client.healthScore} />
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-foreground truncate">
                            {client.clientName}
                          </h3>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">
                            {client.gstin}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpand(client.id)}
                        className="shrink-0 h-8 w-8 p-0 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {/* ─── Trend Indicators ─── */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      <TrendBadge trend={client.trends.growth} label="Growth" />
                      <TrendBadge trend={client.trends.compliance} label="Compliance" />
                      <TrendBadge trend={client.trends.risk} label="Risk" />
                      <TrendBadge trend={client.trends.gst} label="GST" />
                      <TrendBadge trend={client.trends.payment} label="Payment" />
                    </div>

                    {/* ─── AI Observations ─── */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        AI Observations
                      </p>
                      <ScrollArea className={isExpanded ? 'max-h-80' : ''}>
                        <div className="space-y-2 pr-1">
                          <AnimatePresence>
                            {visibleObservations.map((obs, obsIdx) => (
                              <motion.div
                                key={obs.id}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ delay: obsIdx * 0.05, duration: 0.3 }}
                                className="flex items-start gap-2 p-2.5 rounded-lg border border-border/30 hover:border-emerald-200/50 dark:hover:border-emerald-800/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10 transition-all group"
                              >
                                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-foreground italic leading-relaxed">
                                    {obs.text}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-1.5">
                                    <ConfidenceBadge confidence={obs.confidence} />
                                    <CategoryBadge category={obs.category} />
                                    {obs.isTrending && (
                                      <Badge
                                        variant="outline"
                                        className="px-1.5 py-0.5 text-[10px] font-semibold border border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:bg-amber-950/40"
                                      >
                                        <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
                                        Trending
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      </ScrollArea>

                      {/* Show more / less indicator */}
                      {client.observations.length > 3 && !isExpanded && (
                        <button
                          onClick={() => toggleExpand(client.id)}
                          className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium flex items-center gap-1 mt-1 transition-colors"
                        >
                          <ChevronDown className="h-3 w-3" />
                          View all {client.observations.length} observations
                        </button>
                      )}
                      {isExpanded && (
                        <button
                          onClick={() => toggleExpand(client.id)}
                          className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium flex items-center gap-1 mt-1 transition-colors"
                        >
                          <ChevronUp className="h-3 w-3" />
                          Show less
                        </button>
                      )}
                    </div>
                  </CardContent>
                </AnimatedCard>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
