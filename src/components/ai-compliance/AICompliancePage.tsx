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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Eye,
  Sparkles,
  Activity,
  AlertTriangle,
  AlertCircle,
  FileWarning,
  IndianRupee,
  Shield,
  Clock,
  CheckCircle2,
  Lightbulb,
  FileText,
  ArrowRight,
  CalendarClock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '@/lib/gst-utils';

// ─── Color Palette (Emerald/Amber/Red — Compliance theme) ────────────────
const COLORS = {
  emerald: '#10b981',
  emeraldDark: '#059669',
  amber: '#f59e0b',
  amberDark: '#d97706',
  red: '#ef4444',
  redDark: '#dc2626',
  orange: '#f97316',
  purple: '#8b5cf6',
  slate: '#64748b',
};

// ─── Types ────────────────────────────────────────────────────────────────
interface ComplianceForecastItem {
  clientId: string | null;
  clientName: string | null;
  forecastType: string;
  predictedEvent: string;
  probability: number;
  confidence: number;
  expectedDate: string | null;
  impact: string;
  mitigatingActions: string[];
}

interface ForecastsByType {
  notice: ComplianceForecastItem[];
  filing_delay: ComplianceForecastItem[];
  reconciliation_issue: ComplianceForecastItem[];
  itc_loss: ComplianceForecastItem[];
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
        className={`hover:shadow-lg hover:shadow-amber-500/5 transition-all duration-300 border-border/50 backdrop-blur-sm bg-card/80 ${className}`}
      >
        {children}
      </Card>
    </motion.div>
  );
}

// ─── Circular Gauge Component ─────────────────────────────────────────────
function ConfidenceGauge({ score }: { score: number }) {
  const animatedScore = useAnimatedNumber(score, 1500);
  const size = 180;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedScore / 100) * circumference;
  const center = size / 2;

  const getGaugeColor = (s: number) => {
    if (s >= 80) return { stroke: COLORS.emerald, text: 'text-emerald-600', bg: 'bg-emerald-50', label: 'High Confidence' };
    if (s >= 60) return { stroke: COLORS.amber, text: 'text-amber-600', bg: 'bg-amber-50', label: 'Moderate' };
    return { stroke: COLORS.red, text: 'text-red-600', bg: 'bg-red-50', label: 'Low Confidence' };
  };

  const gauge = getGaugeColor(score);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
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
            <filter id="complianceGaugeGlow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
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
            stroke={gauge.stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            filter="url(#complianceGaugeGlow)"
            className="transition-all duration-700 ease-out"
          />
        </svg>
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

// ─── Impact Badge ─────────────────────────────────────────────────────────
function ImpactBadge({ impact }: { impact: string }) {
  const config: Record<string, { cls: string }> = {
    low: {
      cls: 'border-emerald-200 text-emerald-700 bg-emerald-50/80 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/40',
    },
    medium: {
      cls: 'border-amber-200 text-amber-700 bg-amber-50/80 dark:border-amber-800 dark:text-amber-400 dark:bg-amber-950/40',
    },
    high: {
      cls: 'border-orange-200 text-orange-700 bg-orange-50/80 dark:border-orange-800 dark:text-orange-400 dark:bg-orange-950/40',
    },
    critical: {
      cls: 'border-red-200 text-red-700 bg-red-50/80 dark:border-red-800 dark:text-red-400 dark:bg-red-950/40',
    },
  };
  const c = config[impact] || config.low;

  return (
    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 font-semibold ${c.cls}`}>
      {impact.charAt(0).toUpperCase() + impact.slice(1)}
    </Badge>
  );
}

// ─── Forecast Item Component ──────────────────────────────────────────────
function ForecastItem({
  item,
  index,
  isITCLoss,
}: {
  item: ComplianceForecastItem;
  index: number;
  isITCLoss?: boolean;
}) {
  const probabilityPct = Math.round(item.probability * 100);
  const confidencePct = Math.round(item.confidence * 100);

  const probColor =
    probabilityPct >= 75
      ? 'text-red-600 dark:text-red-400'
      : probabilityPct >= 50
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-emerald-600 dark:text-emerald-400';

  const probProgressColor =
    probabilityPct >= 75
      ? '[&>div]:bg-red-500'
      : probabilityPct >= 50
        ? '[&>div]:bg-amber-500'
        : '[&>div]:bg-emerald-500';

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 + index * 0.06, duration: 0.4 }}
      whileHover={{
        x: 4,
        backgroundColor: 'rgba(245, 158, 11, 0.03)',
      }}
      className="p-3 rounded-xl border border-border/30 hover:border-amber-200/50 dark:hover:border-amber-800/50 transition-all cursor-pointer group"
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        {/* Left: Client & Event */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {item.clientName && (
              <span className="text-sm font-semibold text-foreground">
                {item.clientName}
              </span>
            )}
            <ImpactBadge impact={item.impact} />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {item.predictedEvent}
          </p>

          {/* Mitigating Actions */}
          {item.mitigatingActions.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Mitigating Actions
              </p>
              {item.mitigatingActions.slice(0, 3).map((action, aIdx) => (
                <div key={aIdx} className="flex items-start gap-1.5">
                  <ArrowRight className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                  <span className="text-[11px] text-muted-foreground">{action}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Metrics */}
        <div className="flex flex-row sm:flex-col items-center sm:items-end gap-3 sm:gap-2 shrink-0">
          {/* Probability */}
          <div className="min-w-[100px]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-muted-foreground">Probability</span>
              <span className={`text-xs font-bold ${probColor}`}>{probabilityPct}%</span>
            </div>
            <Progress value={probabilityPct} className={`h-1.5 ${probProgressColor}`} />
          </div>

          {/* Confidence */}
          <Badge
            variant="outline"
            className="text-[10px] px-2 py-0.5 border-purple-200 text-purple-700 bg-purple-50/80 dark:border-purple-800 dark:text-purple-400 dark:bg-purple-950/40 shrink-0"
          >
            {confidencePct}% conf.
          </Badge>

          {/* Expected Date */}
          {item.expectedDate && (
            <div className="flex items-center gap-1 shrink-0">
              <CalendarClock className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                {new Date(item.expectedDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Skeleton Loaders ─────────────────────────────────────────────────────
function GaugeSkeleton() {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <Skeleton className="h-[180px] w-[180px] rounded-full" />
      <Skeleton className="h-5 w-24 rounded-full" />
    </div>
  );
}

function ForecastSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-3 rounded-xl border border-border/30">
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-full mb-1" />
          <Skeleton className="h-3 w-3/4" />
          <div className="flex items-center gap-2 mt-2">
            <Skeleton className="h-1.5 flex-1 rounded-full" />
            <Skeleton className="h-4 w-12 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function RecommendationsSkeleton() {
  return (
    <div className="space-y-3">
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

// ─── Generate AI Recommendations ──────────────────────────────────────────
function generateRecommendations(forecasts: ForecastsByType) {
  const recs: {
    icon: React.ReactNode;
    title: string;
    description: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
  }[] = [];

  const criticalNotices = forecasts.notice.filter(
    (f) => f.impact === 'critical' || f.probability >= 0.7
  );
  if (criticalNotices.length > 0) {
    recs.push({
      icon: <AlertCircle className="h-4 w-4" />,
      title: 'Prevent high-probability GST notices',
      description: `${criticalNotices.length} client(s) at risk of receiving GST notices. Initiate compliance remediation immediately.`,
      priority: 'critical',
    });
  }

  const filingDelays = forecasts.filing_delay.filter((f) => f.probability >= 0.5);
  if (filingDelays.length > 0) {
    recs.push({
      icon: <Clock className="h-4 w-4" />,
      title: 'Set up proactive filing reminders',
      description: `${filingDelays.length} client(s) likely to file late. Configure automated reminders 15 days before due dates.`,
      priority: 'high',
    });
  }

  const reconIssues = forecasts.reconciliation_issue.filter((f) => f.probability >= 0.5);
  if (reconIssues.length > 0) {
    recs.push({
      icon: <FileWarning className="h-4 w-4" />,
      title: 'Schedule pre-filing reconciliation',
      description: `${reconIssues.length} reconciliation issue(s) predicted. Run 2B matching before filing period begins.`,
      priority: 'medium',
    });
  }

  const itcLosses = forecasts.itc_loss.filter((f) => f.impact === 'high' || f.impact === 'critical');
  if (itcLosses.length > 0) {
    recs.push({
      icon: <IndianRupee className="h-4 w-4" />,
      title: 'Review ITC claims for potential losses',
      description: `${itcLosses.length} client(s) at risk of ITC loss. Verify claims against GSTR-2B and flag discrepancies.`,
      priority: 'high',
    });
  }

  if (recs.length === 0) {
    recs.push({
      icon: <CheckCircle2 className="h-4 w-4" />,
      title: 'Compliance outlook is positive',
      description: 'No significant risks detected. Continue regular monitoring and periodic health checks.',
      priority: 'low',
    });
  }

  return recs;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function AICompliancePage() {
  const [forecasts, setForecasts] = useState<ForecastsByType>({
    notice: [],
    filing_delay: [],
    reconciliation_issue: [],
    itc_loss: [],
  });
  const [overallConfidence, setOverallConfidence] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Data Fetching ──────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/ai-compliance');
      if (!res.ok) throw new Error('Failed to fetch AI Compliance data');
      const data = await res.json();
      setForecasts(data.forecasts ?? { notice: [], filing_delay: [], reconciliation_issue: [], itc_loss: [] });
      setOverallConfidence(data.overallConfidence ?? 0);
    } catch (err) {
      console.error('AI Compliance fetch error:', err);
      setError('Failed to load compliance forecasts. Using fallback data.');
      // Fallback mock data
      setForecasts({
        notice: [
          {
            clientId: '1',
            clientName: 'Acme Corp',
            forecastType: 'notice',
            predictedEvent: 'GST notice likely for Acme Corp due to low compliance health (45/100)',
            probability: 0.55,
            confidence: 0.78,
            expectedDate: '2026-05-15',
            impact: 'high',
            mitigatingActions: ['Ensure timely filing of all pending GSTR returns', 'Respond to all open notices within due date', 'Schedule compliance health review with client'],
          },
          {
            clientId: '2',
            clientName: 'Beta Industries',
            forecastType: 'notice',
            predictedEvent: 'GST notice possible for Beta Industries due to repeated mismatches',
            probability: 0.38,
            confidence: 0.72,
            expectedDate: '2026-06-01',
            impact: 'medium',
            mitigatingActions: ['Verify vendor GSTIN details', 'Maintain proper documentation for all transactions'],
          },
        ],
        filing_delay: [
          {
            clientId: '1',
            clientName: 'Acme Corp',
            forecastType: 'filing_delay',
            predictedEvent: 'Filing delay expected for Acme Corp - 3 late filing(s) in history',
            probability: 0.65,
            confidence: 0.82,
            expectedDate: '2026-04-01',
            impact: 'high',
            mitigatingActions: ['Set up automated filing reminders 15 days before due date', 'Assign dedicated team member for this client\'s filings', 'Pre-validate invoice data before filing period starts'],
          },
        ],
        reconciliation_issue: [
          {
            clientId: '2',
            clientName: 'Beta Industries',
            forecastType: 'reconciliation_issue',
            predictedEvent: '5 reconciliation mismatch(es) expected for Beta Industries',
            probability: 0.7,
            confidence: 0.75,
            expectedDate: '2026-04-01',
            impact: 'high',
            mitigatingActions: ['Run reconciliation before filing period', 'Verify vendor GSTIN details before booking invoices', 'Enable automated 2B matching alerts'],
          },
          {
            clientId: '3',
            clientName: 'Gamma Solutions',
            forecastType: 'reconciliation_issue',
            predictedEvent: '2 reconciliation mismatch(es) expected for Gamma Solutions',
            probability: 0.4,
            confidence: 0.65,
            expectedDate: '2026-04-01',
            impact: 'medium',
            mitigatingActions: ['Run reconciliation before filing period', 'Enable automated 2B matching alerts'],
          },
        ],
        itc_loss: [
          {
            clientId: '1',
            clientName: 'Acme Corp',
            forecastType: 'itc_loss',
            predictedEvent: 'Potential ITC loss of ₹1,25,000 for Acme Corp',
            probability: 0.45,
            confidence: 0.68,
            expectedDate: '2026-05-01',
            impact: 'high',
            mitigatingActions: ['Verify all ITC claims against GSTR-2B before filing', 'Flag and resolve mismatched invoices immediately', 'Implement vendor compliance verification process'],
          },
        ],
      });
      setOverallConfidence(0.72);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Recommendations ────────────────────────────────────────────────────
  const recommendations = generateRecommendations(forecasts);

  // ── Count items per tab ────────────────────────────────────────────────
  const tabCounts = {
    notice: forecasts.notice.length,
    filing_delay: forecasts.filing_delay.length,
    reconciliation_issue: forecasts.reconciliation_issue.length,
    itc_loss: forecasts.itc_loss.length,
  };

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
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-emerald-600 text-white shadow-lg shadow-amber-500/20">
            <Eye className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              AI Compliance Forecast
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Predict compliance issues before they happen
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="gap-1.5 px-3 py-1.5 border-amber-200 text-amber-700 bg-amber-50/80 dark:border-amber-800 dark:text-amber-400 dark:bg-amber-950/40 font-medium"
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

      {/* ═══ OVERALL CONFIDENCE + SUMMARY ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ─── Confidence Gauge ─── */}
        <AnimatedCard delay={0.05}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5 text-emerald-500" />
              Prediction Confidence
            </CardTitle>
            <CardDescription>Overall AI prediction accuracy</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center pb-6">
            {loading ? (
              <GaugeSkeleton />
            ) : (
              <ConfidenceGauge score={Math.round(overallConfidence * 100)} />
            )}
          </CardContent>
        </AnimatedCard>

        {/* ─── Summary Cards ─── */}
        <AnimatedCard delay={0.1} className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Forecast Summary
            </CardTitle>
            <CardDescription>Quick overview of predicted compliance events</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  className="flex flex-col items-center p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50"
                >
                  <AlertCircle className="h-5 w-5 text-red-500 mb-1" />
                  <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {tabCounts.notice}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-red-500/70 dark:text-red-400/70 mt-0.5">
                    GST Notices
                  </span>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  className="flex flex-col items-center p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50"
                >
                  <Clock className="h-5 w-5 text-amber-500 mb-1" />
                  <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {tabCounts.filing_delay}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-500/70 dark:text-amber-400/70 mt-0.5">
                    Filing Delays
                  </span>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  className="flex flex-col items-center p-4 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900/50"
                >
                  <FileWarning className="h-5 w-5 text-orange-500 mb-1" />
                  <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {tabCounts.reconciliation_issue}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-500/70 dark:text-orange-400/70 mt-0.5">
                    Recon Issues
                  </span>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  className="flex flex-col items-center p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50"
                >
                  <IndianRupee className="h-5 w-5 text-emerald-500 mb-1" />
                  <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {tabCounts.itc_loss}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500/70 dark:text-emerald-400/70 mt-0.5">
                    ITC Loss
                  </span>
                </motion.div>
              </div>
            )}
          </CardContent>
        </AnimatedCard>
      </div>

      {/* ═══ FORECAST TABS ═══ */}
      <AnimatedCard delay={0.15}>
        <CardContent className="p-4 md:p-6">
          {loading ? (
            <ForecastSkeleton />
          ) : (
            <Tabs defaultValue="notice" className="w-full">
              <TabsList className="w-full sm:w-auto mb-4">
                <TabsTrigger value="notice" className="gap-1.5 text-xs">
                  <AlertCircle className="h-3.5 w-3.5" />
                  GST Notices
                  {tabCounts.notice > 0 && (
                    <Badge
                      variant="outline"
                      className="ml-1 h-4 px-1 text-[10px] border-red-200 text-red-700 bg-red-50/80 dark:border-red-800 dark:text-red-400 dark:bg-red-950/40"
                    >
                      {tabCounts.notice}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="filing_delay" className="gap-1.5 text-xs">
                  <Clock className="h-3.5 w-3.5" />
                  Filing Delays
                  {tabCounts.filing_delay > 0 && (
                    <Badge
                      variant="outline"
                      className="ml-1 h-4 px-1 text-[10px] border-amber-200 text-amber-700 bg-amber-50/80 dark:border-amber-800 dark:text-amber-400 dark:bg-amber-950/40"
                    >
                      {tabCounts.filing_delay}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="reconciliation_issue" className="gap-1.5 text-xs">
                  <FileWarning className="h-3.5 w-3.5" />
                  Recon Issues
                  {tabCounts.reconciliation_issue > 0 && (
                    <Badge
                      variant="outline"
                      className="ml-1 h-4 px-1 text-[10px] border-orange-200 text-orange-700 bg-orange-50/80 dark:border-orange-800 dark:text-orange-400 dark:bg-orange-950/40"
                    >
                      {tabCounts.reconciliation_issue}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="itc_loss" className="gap-1.5 text-xs">
                  <IndianRupee className="h-3.5 w-3.5" />
                  ITC Loss
                  {tabCounts.itc_loss > 0 && (
                    <Badge
                      variant="outline"
                      className="ml-1 h-4 px-1 text-[10px] border-emerald-200 text-emerald-700 bg-emerald-50/80 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/40"
                    >
                      {tabCounts.itc_loss}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Notice Tab */}
              <TabsContent value="notice">
                <ScrollArea className="max-h-96">
                  <div className="space-y-2 pr-2">
                    {forecasts.notice.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                        No notice risks predicted
                      </div>
                    ) : (
                      forecasts.notice.map((item, idx) => (
                        <ForecastItem key={item.clientId ?? idx} item={item} index={idx} />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Filing Delays Tab */}
              <TabsContent value="filing_delay">
                <ScrollArea className="max-h-96">
                  <div className="space-y-2 pr-2">
                    {forecasts.filing_delay.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                        No filing delay risks predicted
                      </div>
                    ) : (
                      forecasts.filing_delay.map((item, idx) => (
                        <ForecastItem key={item.clientId ?? idx} item={item} index={idx} />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Reconciliation Issues Tab */}
              <TabsContent value="reconciliation_issue">
                <ScrollArea className="max-h-96">
                  <div className="space-y-2 pr-2">
                    {forecasts.reconciliation_issue.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                        No reconciliation issues predicted
                      </div>
                    ) : (
                      forecasts.reconciliation_issue.map((item, idx) => (
                        <ForecastItem key={item.clientId ?? idx} item={item} index={idx} />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* ITC Loss Tab */}
              <TabsContent value="itc_loss">
                <ScrollArea className="max-h-96">
                  <div className="space-y-2 pr-2">
                    {forecasts.itc_loss.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                        No ITC loss risks predicted
                      </div>
                    ) : (
                      forecasts.itc_loss.map((item, idx) => (
                        <ForecastItem key={item.clientId ?? idx} item={item} index={idx} isITCLoss />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </AnimatedCard>

      {/* ═══ AI RECOMMENDATIONS ═══ */}
      <AnimatedCard delay={0.2}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-amber-500" />
              AI Preventive Recommendations
            </CardTitle>
            <Badge
              variant="outline"
              className="text-[10px] px-2 py-0.5 border-amber-200 text-amber-700 bg-amber-50/80 dark:border-amber-800 dark:text-amber-400 dark:bg-amber-950/40"
            >
              AI Generated
            </Badge>
          </div>
          <CardDescription>Proactive actions to prevent compliance issues</CardDescription>
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
                        transition={{ delay: 0.3 + index * 0.08, duration: 0.4 }}
                        whileHover={{
                          x: 4,
                          backgroundColor: 'rgba(245, 158, 11, 0.03)',
                        }}
                        className="flex items-center gap-3 p-3 rounded-xl border border-border/30 hover:border-amber-200/50 dark:hover:border-amber-800/50 transition-all cursor-pointer group"
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
