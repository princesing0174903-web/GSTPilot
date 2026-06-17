'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Business Digital DNA™
// A consolidated view of 6 business scores that let AI understand who you are,
// how your business behaves, and what may happen next.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  ShieldCheck,
  TrendingUp,
  Wallet,
  Activity,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import {
  useLiveDashboardMetrics,
  useFireClients,
  useFireInvoices,
  useFireReturns,
} from '@/hooks/use-firestore';

// ─── Types ───────────────────────────────────────────────────────────────────

type ScoreKey =
  | 'trust'
  | 'credit'
  | 'compliance'
  | 'growth'
  | 'payment'
  | 'operational';

interface DnaScore {
  key: ScoreKey;
  label: string;
  icon: LucideIcon;
  value: number | null; // null = cannot be computed (no underlying data)
  insight: string;
  supportingMetric?: string; // small label like "12 of 15 returns filed"
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function scoreColorClass(score: number | null): string {
  if (score === null) return 'text-muted-foreground';
  if (score >= 85) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function tierLabel(score: number | null): string {
  if (score === null) return 'unrated';
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'strong';
  if (score >= 60) return 'developing';
  return 'at risk';
}

function trustTier(trust: number | null): string {
  if (trust === null) return 'still being profiled';
  if (trust >= 85) return 'highly trusted';
  if (trust >= 70) return 'trusted';
  if (trust >= 60) return 'developing trust';
  return 'at risk';
}

// ─── Score Computation ───────────────────────────────────────────────────────

function computeScores(
  metrics: {
    totalClients: number;
    activeClients: number;
    totalInvoices: number;
    filedReturns: number;
    pendingReturns: number;
    overdueReturns: number;
    criticalIssues: number;
    averageHealthScore: number;
    matchPercentage: number;
    documentsProcessed: number;
    extractionsPending: number;
  },
  clientsLength: number,
  invoicesLength: number,
): DnaScore[] {
  // ── Compliance ────────────────────────────────────────────────────────────
  const totalReturnEntries =
    metrics.filedReturns + metrics.pendingReturns + metrics.overdueReturns;
  let compliance: number | null;
  let complianceInsight: string;
  let complianceSupporting: string | undefined;
  if (totalReturnEntries === 0) {
    compliance = null;
    complianceInsight = 'No returns due yet';
    complianceSupporting = undefined;
  } else {
    compliance = clamp(
      Math.round((metrics.filedReturns / totalReturnEntries) * 100),
    );
    if (compliance >= 85) {
      complianceInsight = 'Excellent filing track record';
    } else if (compliance >= 60) {
      complianceInsight = `${metrics.pendingReturns} return${
        metrics.pendingReturns === 1 ? '' : 's'
      } pending`;
    } else {
      complianceInsight =
        metrics.overdueReturns > 0
          ? `${metrics.overdueReturns} overdue — file now`
          : 'Filing behind schedule';
    }
    complianceSupporting = `${metrics.filedReturns}/${totalReturnEntries} filed`;
  }

  // ── Credit ────────────────────────────────────────────────────────────────
  let credit: number | null;
  let creditInsight: string;
  let creditSupporting: string | undefined;
  if (clientsLength === 0) {
    credit = null;
    creditInsight = 'Add clients to compute';
    creditSupporting = undefined;
  } else {
    credit = clamp(
      metrics.averageHealthScore - metrics.criticalIssues * 3,
    );
    if (credit >= 85) {
      creditInsight = 'Healthy financial profile';
    } else if (credit >= 60) {
      creditInsight = 'Watch financial indicators';
    } else {
      creditInsight =
        metrics.criticalIssues > 0
          ? `${metrics.criticalIssues} critical issue${
              metrics.criticalIssues === 1 ? '' : 's'
            } flagged`
          : 'Critical financial risks';
    }
    creditSupporting = `Health ${metrics.averageHealthScore}/100`;
  }

  // ── Payment ───────────────────────────────────────────────────────────────
  let payment: number | null;
  let paymentInsight: string;
  let paymentSupporting: string | undefined;
  if (invoicesLength === 0) {
    payment = null;
    paymentInsight = 'Add invoices to compute';
    paymentSupporting = undefined;
  } else {
    // matchPercentage is already 0-100. Subtract a penalty for invoices that
    // are still in 'draft' (not yet collected/approved) using a ratio derived
    // from the live invoice list. We don't have the per-invoice status counts
    // from metrics, so we use matchPercentage alone — the underlying
    // reconciliation rate IS the collections health proxy.
    payment = clamp(metrics.matchPercentage);
    if (payment >= 85) {
      paymentInsight = 'Collections on track';
    } else if (payment >= 60) {
      paymentInsight = 'Some collections pending';
    } else {
      paymentInsight = 'Collections need attention';
    }
    paymentSupporting = `${payment}% match rate`;
  }

  // ── Growth ────────────────────────────────────────────────────────────────
  let growth: number | null;
  let growthInsight: string;
  let growthSupporting: string | undefined;
  if (clientsLength === 0) {
    growth = null;
    growthInsight = 'Add clients to compute';
    growthSupporting = undefined;
  } else {
    growth = clamp(
      Math.round((metrics.activeClients / metrics.totalClients) * 100),
    );
    if (growth >= 85) {
      growthInsight = 'Strong client momentum';
    } else if (growth >= 60) {
      growthInsight = 'Steady client base';
    } else {
      growthInsight = 'Review client retention';
    }
    growthSupporting = `${metrics.activeClients}/${metrics.totalClients} active`;
  }

  // ── Operational ───────────────────────────────────────────────────────────
  let operational: number | null;
  let operationalInsight: string;
  let operationalSupporting: string | undefined;
  const totalDocs =
    metrics.documentsProcessed + metrics.extractionsPending;
  if (totalDocs === 0) {
    operational = null;
    operationalInsight = 'Upload documents to compute';
    operationalSupporting = undefined;
  } else {
    operational = clamp(
      Math.round((metrics.documentsProcessed / totalDocs) * 100),
    );
    if (operational >= 85) {
      operationalInsight = 'Smooth operations';
    } else if (operational >= 60) {
      operationalInsight = 'Some extraction backlog';
    } else {
      operationalInsight = 'Operational bottlenecks';
    }
    operationalSupporting = `${metrics.documentsProcessed}/${totalDocs} processed`;
  }

  // ── Trust (weighted blend of the other 5) ─────────────────────────────────
  // Weights: Compliance 25%, Credit 20%, Payment 20%, Growth 15%, Operational 20%
  const components: Array<{ value: number | null; weight: number }> = [
    { value: compliance, weight: 0.25 },
    { value: credit, weight: 0.2 },
    { value: payment, weight: 0.2 },
    { value: growth, weight: 0.15 },
    { value: operational, weight: 0.2 },
  ];
  const computable = components.filter((c) => c.value !== null);
  let trust: number | null;
  let trustInsight: string;
  let trustSupporting: string | undefined;
  if (computable.length === 0) {
    trust = null;
    trustInsight = 'Add data to compute';
    trustSupporting = undefined;
  } else {
    // Re-normalize weights over the available components.
    const totalWeight = computable.reduce((s, c) => s + c.weight, 0);
    trust = clamp(
      Math.round(
        computable.reduce((s, c) => s + (c.value as number) * c.weight, 0) /
          totalWeight,
      ),
    );
    if (computable.length < 5) {
      trustInsight = `Based on ${computable.length} of 5 signals`;
    } else if (trust >= 85) {
      trustInsight = 'Strong overall digital profile';
    } else if (trust >= 60) {
      trustInsight = 'Mixed signals across units';
    } else {
      trustInsight = 'Multiple risk areas need attention';
    }
    trustSupporting = `${computable.length}/5 signals live`;
  }

  return [
    { key: 'trust', label: 'Trust Score', icon: ShieldCheck, value: trust, insight: trustInsight, supportingMetric: trustSupporting },
    { key: 'credit', label: 'Credit Score', icon: Wallet, value: credit, insight: creditInsight, supportingMetric: creditSupporting },
    { key: 'compliance', label: 'Compliance Score', icon: CheckCircle2, value: compliance, insight: complianceInsight, supportingMetric: complianceSupporting },
    { key: 'growth', label: 'Growth Score', icon: TrendingUp, value: growth, insight: growthInsight, supportingMetric: growthSupporting },
    { key: 'payment', label: 'Payment Score', icon: Sparkles, value: payment, insight: paymentInsight, supportingMetric: paymentSupporting },
    { key: 'operational', label: 'Operational Score', icon: Activity, value: operational, insight: operationalInsight, supportingMetric: operationalSupporting },
  ];
}

// ─── Circular Gauge ──────────────────────────────────────────────────────────

function CircularGauge({ value }: { value: number | null }) {
  const size = 120;
  const stroke = 8;
  const radius = (size - stroke) / 2; // 56
  const circumference = 2 * Math.PI * radius; // ≈ 351.86
  const pct = value === null ? 0 : value / 100;
  const offset = circumference * (1 - pct);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="block"
      aria-hidden
    >
      <defs>
        <linearGradient id="dnaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="50%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={stroke}
      />
      {/* Progress arc (rotated so it starts at top) */}
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#dnaGradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </g>
    </svg>
  );
}

// ─── Score Card ──────────────────────────────────────────────────────────────

function ScoreCard({ score, index }: { score: DnaScore; index: number }) {
  const Icon = score.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: 'easeOut' }}
      className="glass-surface rounded-2xl p-6 flex flex-col items-center text-center hover:shadow-[0_0_32px_-8px_rgba(6,182,212,0.18)] transition-shadow"
    >
      <div className="flex items-center justify-center gap-1.5 mb-4">
        <Icon className="h-3.5 w-3.5 accent-text" />
        <span className="text-xs tracking-wider uppercase text-muted-foreground">
          {score.label}
        </span>
      </div>

      <div className="relative flex items-center justify-center">
        <CircularGauge value={score.value} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`text-4xl font-bold leading-none ${scoreColorClass(
              score.value,
            )}`}
          >
            {score.value === null ? '—' : score.value}
          </span>
          <span className="text-sm text-muted-foreground mt-1">/100</span>
        </div>
      </div>

      {score.supportingMetric && (
        <span className="mt-3 text-[11px] text-muted-foreground/80 tracking-wide">
          {score.supportingMetric}
        </span>
      )}

      <p className="mt-2 text-sm text-foreground/80 leading-snug">
        {score.insight}
      </p>
    </motion.div>
  );
}

// ─── AI DNA Summary ──────────────────────────────────────────────────────────

function buildDnaSummary(scores: DnaScore[]): {
  paragraph: React.ReactNode;
} {
  const trust = scores.find((s) => s.key === 'trust')?.value ?? null;
  const computable = scores.filter((s) => s.value !== null && s.key !== 'trust');

  if (computable.length === 0) {
    return {
      paragraph: (
        <>
          Your Business Digital DNA is{' '}
          <span className="accent-text font-medium">still forming</span>. Add
          clients, invoices, and returns to let GSTPilot AI understand who you
          are, how you behave, and what&apos;s next.
        </>
      ),
    };
  }

  // Top + weak scores among the 5 sub-scores
  const sorted = [...computable].sort((a, b) => (b.value as number) - (a.value as number));
  const top = sorted[0];
  const weak = sorted[sorted.length - 1];

  // Predicted next 30 days insight — derived from weakest signal
  let prediction: string;
  if (weak.value !== null && weak.value < 60) {
    switch (weak.key) {
      case 'compliance':
        prediction = 'expect overdue return notices — prioritize filing';
        break;
      case 'credit':
        prediction = 'financial health may dip — review critical issues';
        break;
      case 'payment':
        prediction = 'cash flow strain likely — chase pending collections';
        break;
      case 'growth':
        prediction = 'client churn risk — re-engage inactive accounts';
        break;
      case 'operational':
        prediction = 'document backlog will grow — automate extraction';
        break;
      default:
        prediction = 'monitor signals closely';
    }
  } else if (trust !== null && trust >= 85) {
    prediction = 'sustained growth — scale operations confidently';
  } else {
    prediction = 'steady state — address weakest signal to unlock momentum';
  }

  const topTier = tierLabel(top.value);
  const weakTier = tierLabel(weak.value);
  const trustTierLabel = trustTier(trust);

  return {
    paragraph: (
      <>
        Your business is{' '}
        <span className="accent-text font-medium">{trustTierLabel}</span> with
        strong{' '}
        <span className="accent-text font-medium">
          {top.label.replace(' Score', '').toLowerCase()}
        </span>{' '}
        ({topTier}) but{' '}
        <span className="accent-text font-medium">
          {weak.label.replace(' Score', '').toLowerCase()}
        </span>{' '}
        ({weakTier}) needs attention. Predicted next 30 days:{' '}
        <span className="accent-text font-medium">{prediction}</span>.
      </>
    ),
  };
}

function DnaSummary({ scores }: { scores: DnaScore[] }) {
  const { paragraph } = useMemo(() => buildDnaSummary(scores), [scores]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.48, ease: 'easeOut' }}
      className="glass-surface rounded-2xl p-6 sm:p-8"
    >
      <div className="flex items-start gap-4">
        <div className="flex items-center justify-center h-11 w-11 rounded-xl accent-gradient-soft shrink-0">
          <Brain className="h-5 w-5 accent-text" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              AI DNA Summary
            </h2>
            <span className="text-[10px] tracking-wider uppercase text-muted-foreground/70">
              Synthesized
            </span>
          </div>
          <p className="mt-2 text-sm sm:text-[15px] leading-relaxed text-foreground/85">
            {paragraph}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Skeletons / States ──────────────────────────────────────────────────────

function ScoreCardSkeleton() {
  return (
    <div className="glass-surface rounded-2xl p-6 flex flex-col items-center gap-4">
      <Skeleton className="h-3 w-24 rounded-full" />
      <div className="relative">
        <Skeleton className="h-[120px] w-[120px] rounded-full" />
      </div>
      <Skeleton className="h-3 w-16 rounded-full" />
      <Skeleton className="h-4 w-32 rounded-full" />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <ScoreCardSkeleton key={i} />
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="glass-surface rounded-2xl p-10 flex flex-col items-center text-center gap-3">
      <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-red-500/10">
        <AlertTriangle className="h-6 w-6 text-red-400" />
      </div>
      <h3 className="text-base font-semibold text-foreground">
        Couldn&apos;t load your DNA
      </h3>
      <p className="text-sm text-muted-foreground max-w-md">{message}</p>
    </div>
  );
}

function EmptyState({ onAddClient }: { onAddClient: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="glass-surface rounded-2xl p-12 flex flex-col items-center text-center gap-4"
    >
      <div className="relative">
        <div className="flex items-center justify-center h-20 w-20 rounded-2xl accent-gradient accent-ring">
          <Brain className="h-10 w-10 text-white" />
        </div>
        <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full accent-gradient flex items-center justify-center">
          <Sparkles className="h-3 w-3 text-white" />
        </div>
      </div>
      <h3 className="text-xl font-bold tracking-tight text-foreground">
        Add your first client to unlock your Business DNA
      </h3>
      <p className="text-sm text-muted-foreground max-w-md">
        GSTPilot AI needs at least one client, invoice, or return to start
        computing your 6 business scores. Once added, your DNA updates live.
      </p>
      <Button
        onClick={onAddClient}
        className="accent-gradient text-white hover:opacity-90 gap-1.5 mt-2"
      >
        <Sparkles className="h-4 w-4" />
        Add Client
      </Button>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function BusinessDNApage() {
  const { setCurrentView } = useApp();
  const { metrics, loading, error } = useLiveDashboardMetrics();
  const { data: clients } = useFireClients();
  const { data: invoices } = useFireInvoices();
  const { data: returns } = useFireReturns();

  // Graceful loading timeout — never block the UI forever on a slow backend.
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setLoadingTimedOut(true), 3500);
    return () => clearTimeout(t);
  }, [loading]);
  const showLoading = loading && !loadingTimedOut;

  const scores = useMemo(
    () =>
      computeScores(
        {
          totalClients: metrics.totalClients,
          activeClients: metrics.activeClients,
          totalInvoices: metrics.totalInvoices,
          filedReturns: metrics.filedReturns,
          pendingReturns: metrics.pendingReturns,
          overdueReturns: metrics.overdueReturns,
          criticalIssues: metrics.criticalIssues,
          averageHealthScore: metrics.averageHealthScore,
          matchPercentage: metrics.matchPercentage,
          documentsProcessed: metrics.documentsProcessed,
          extractionsPending: metrics.extractionsPending,
        },
        clients.length,
        invoices.length,
      ),
    [metrics, clients.length, invoices.length],
  );

  const hasNoData =
    !loading &&
    !error &&
    clients.length === 0 &&
    invoices.length === 0 &&
    returns.length === 0;

  return (
    <div className="relative min-h-screen">
      {/* Radial glow background */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.08),_transparent_60%)]"
        aria-hidden
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="mb-8 sm:mb-10"
        >
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full accent-gradient shadow-[0_0_12px_rgba(16,185,129,0.6)]" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Business Digital DNA&trade;
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1.5 ml-5">
            Who you are. How you behave. What&apos;s next.
          </p>
        </motion.header>

        {/* States */}
        {showLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : hasNoData ? (
          <EmptyState onAddClient={() => setCurrentView('clients')} />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {scores.map((score, i) => (
                <ScoreCard key={score.key} score={score} index={i} />
              ))}
            </div>
            <DnaSummary scores={scores} />
          </div>
        )}
      </div>
    </div>
  );
}
