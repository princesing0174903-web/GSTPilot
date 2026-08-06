'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle — OracleDailyBrief
// ═══════════════════════════════════════════════════════════════════════════════
//
// Replaces the old "Activate Oracle AI CFO" banner on the Home dashboard.
// Oracle is positioned as the intelligence layer of the platform — NOT an
// advertised feature. This card surfaces real, data-driven insight lines
// derived from the live business snapshot, GST returns, AI recommendations,
// dashboard metrics, and Oracle insights. The entire card is clickable and
// opens the Oracle page (router.push('/oracle')).
//
// DESIGN
//   • Premium card with the Oracle amber/gold accent (Brain icon, amber ring).
//   • Subtle framer-motion fade-in. Single column on mobile, two columns on
//     lg+ (insights list on the left, key metrics strip on the right).
//   • Every value derives from a real hook. If a value is zero / unavailable,
//     we render an honest empty state — never a fabricated number.
//
// DATA SOURCES (all REAL — see VERIFICATION CHECKLIST in the task brief)
//   • useBusinessSnapshot()         → revenue, cash, overdue, health score, GST
//   • useLiveDashboardMetrics()     → criticalIssues, overdueReturns
//   • useFireReturns()              → upcoming filing deadlines
//   • useAIRecommendations()        → top 1-2 AI recs
//   • useOracleInsights()           → Oracle-generated business summary / risks
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Brain,
  AlertCircle,
  Clock,
  ShieldCheck,
  TrendingUp,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
import { useBusinessSnapshot } from '@/hooks/useBusinessSnapshot';
import {
  useLiveDashboardMetrics,
  useFireReturns,
} from '@/hooks/use-firestore';
import { useAIRecommendations } from '@/hooks/useAIRecommendations';
import { useOracleInsights } from '@/hooks/useOracleInsights';
import { getFilingDueDate, periodToLabel } from '@/lib/gst-utils';
import { cn } from '@/lib/utils';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatINR(amount: number): string {
  return amount.toLocaleString('en-IN');
}

function abbreviateINR(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

function getDaysRemaining(dueDateStr: string): number {
  const dueDate = new Date(dueDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDaysRemaining(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'due today';
  if (days === 1) return 'tomorrow';
  return `in ${days}d`;
}

// ─── Insight line model ────────────────────────────────────────────────────

interface InsightLine {
  id: string;
  icon: LucideIcon;
  tone: 'positive' | 'warning' | 'negative' | 'neutral';
  text: string;
}

const TONE_CLASSES: Record<InsightLine['tone'], string> = {
  positive: 'text-blue-400',
  warning: 'text-amber-400',
  negative: 'text-red-400',
  neutral: 'text-muted-foreground',
};

// ─── Component ──────────────────────────────────────────────────────────────

export function OracleDailyBrief() {
  const router = useRouter();

  const { snapshot, loading: snapLoading } = useBusinessSnapshot();
  const { metrics, loading: metricsLoading } = useLiveDashboardMetrics();
  const { data: returns } = useFireReturns();
  const { recommendations, loading: recsLoading } = useAIRecommendations();
  const { insights: oracleInsights, loading: insightsLoading } = useOracleInsights();

  const loading = snapLoading || metricsLoading;

  // ── Health status (derived from real snapshot.healthScore) ──
  const health = useMemo(() => {
    if (snapshot.healthScore >= 70) {
      return { label: 'Healthy', tone: 'positive' as const, score: snapshot.healthScore };
    }
    if (snapshot.healthScore >= 40) {
      return { label: 'Moderate', tone: 'warning' as const, score: snapshot.healthScore };
    }
    if (snapshot.healthScore > 0) {
      return { label: 'At Risk', tone: 'negative' as const, score: snapshot.healthScore };
    }
    return null; // No health score yet — don't fabricate one
  }, [snapshot.healthScore]);

  // ── Cash flow status (derived from real bankBalance + forecast) ──
  const cashStatus = useMemo(() => {
    if (!snapshot.hasLiveData && snapshot.bankBalance === 0) {
      return null; // No bank data yet
    }
    if (snapshot.risks.cashFlowRisk >= 60) {
      return { label: 'Tight', tone: 'negative' as const };
    }
    if (snapshot.bankBalance > 0 && snapshot.runway.isProfitable) {
      return { label: 'Healthy', tone: 'positive' as const };
    }
    if (snapshot.bankBalance > 0) {
      return { label: 'Stable', tone: 'neutral' as const };
    }
    return null;
  }, [snapshot.bankBalance, snapshot.hasLiveData, snapshot.risks.cashFlowRisk, snapshot.runway.isProfitable]);

  // ── Nearest upcoming filing (real FirestoreReturn, sorted by due date) ──
  const nearestFiling = useMemo(() => {
    const upcoming = returns
      .filter((r) => r.status !== 'filed')
      .map((r) => {
        const dueDateStr = getFilingDueDate(r.returnType, r.period);
        return {
          id: r.id,
          returnType: r.returnType,
          period: r.period,
          status: r.status,
          dueDateStr,
          days: getDaysRemaining(dueDateStr),
        };
      })
      .sort((a, b) => a.days - b.days);
    return upcoming[0] ?? null;
  }, [returns]);

  // ── Build insight lines (only from real data; omit when unavailable) ──
  const insightLines = useMemo<InsightLine[]>(() => {
    const lines: InsightLine[] = [];

    // 1. Overdue collection
    if (snapshot.invoices.overdue > 0) {
      lines.push({
        id: 'overdue-invoices',
        icon: AlertCircle,
        tone: 'negative',
        text: `Collect ${abbreviateINR(snapshot.invoices.overdue)} from ${snapshot.invoices.overdue} overdue invoice${snapshot.invoices.overdue > 1 ? 's' : ''}.`,
      });
    } else if (snapshot.collections.totalOutstanding > 0) {
      lines.push({
        id: 'pending-collection',
        icon: Clock,
        tone: 'warning',
        text: `${abbreviateINR(snapshot.collections.totalOutstanding)} pending collection across ${snapshot.invoices.count} invoice${snapshot.invoices.count === 1 ? '' : 's'}.`,
      });
    }

    // 2. Upcoming GST filing deadline
    if (nearestFiling) {
      const overdue = nearestFiling.days < 0;
      lines.push({
        id: 'gst-filing',
        icon: ShieldCheck,
        tone: overdue ? 'negative' : nearestFiling.days <= 5 ? 'warning' : 'neutral',
        text: overdue
          ? `${nearestFiling.returnType} for ${periodToLabel(nearestFiling.period)} is ${formatDaysRemaining(nearestFiling.days)}.`
          : `${nearestFiling.returnType} for ${periodToLabel(nearestFiling.period)} is ${formatDaysRemaining(nearestFiling.days)}.`,
      });
    } else if (returns.length === 0) {
      lines.push({
        id: 'no-returns',
        icon: ShieldCheck,
        tone: 'neutral',
        text: 'No GST returns yet — create your first return to track deadlines.',
      });
    }

    // 3. Revenue trend (only if Oracle insights expose a real changePercent)
    if (oracleInsights && oracleInsights.revenueTrend && oracleInsights.revenueTrend.changePercent !== 0) {
      const dir = oracleInsights.revenueTrend.direction;
      const pct = Math.abs(Math.round(oracleInsights.revenueTrend.changePercent));
      const verb = dir === 'up' ? 'increased' : dir === 'down' ? 'decreased' : 'held steady';
      const tone = dir === 'up' ? 'positive' : dir === 'down' ? 'warning' : 'neutral';
      lines.push({
        id: 'revenue-trend',
        icon: TrendingUp,
        tone,
        text: dir === 'flat'
          ? `Revenue held steady at ${abbreviateINR(oracleInsights.revenueTrend.currentRevenue)}.`
          : `Revenue ${verb} ${pct}% to ${abbreviateINR(oracleInsights.revenueTrend.currentRevenue)}.`,
      });
    } else if (snapshot.revenue > 0) {
      lines.push({
        id: 'revenue-flat',
        icon: TrendingUp,
        tone: 'neutral',
        text: `Revenue stands at ${abbreviateINR(snapshot.revenue)} across ${snapshot.invoices.count} invoice${snapshot.invoices.count === 1 ? '' : 's'}.`,
      });
    }

    // 4. Cash flow status
    if (cashStatus) {
      const cashTone = cashStatus.tone;
      lines.push({
        id: 'cash-flow',
        icon: Sparkles,
        tone: cashTone,
        text: `Cash flow is ${cashStatus.label.toLowerCase()} — bank balance ${abbreviateINR(snapshot.bankBalance)}.`,
      });
    }

    // 5. Top AI recommendation (real, from the recommendations engine)
    if (recommendations.length > 0) {
      const top = recommendations[0];
      lines.push({
        id: 'ai-rec',
        icon: Brain,
        tone: 'neutral',
        text: top.title,
      });
      if (recommendations[1]) {
        lines.push({
          id: 'ai-rec-2',
          icon: Brain,
          tone: 'neutral',
          text: recommendations[1].title,
        });
      }
    }

    // 6. Critical compliance issues (real, from useLiveDashboardMetrics)
    if (metrics.criticalIssues > 0) {
      lines.push({
        id: 'critical-issues',
        icon: AlertCircle,
        tone: 'negative',
        text: `${metrics.criticalIssues} compliance issue${metrics.criticalIssues > 1 ? 's need' : ' needs'} your attention.`,
      });
    } else if (metrics.overdueReturns > 0) {
      lines.push({
        id: 'overdue-returns',
        icon: AlertCircle,
        tone: 'warning',
        text: `${metrics.overdueReturns} overdue GST return${metrics.overdueReturns > 1 ? 's' : ''} to file.`,
      });
    }

    // 7. Oracle business opportunity (real, from oracleInsights.risks/aiAlerts)
    if (oracleInsights && oracleInsights.aiAlerts.length > 0) {
      const firstAlert = oracleInsights.aiAlerts[0];
      lines.push({
        id: 'oracle-alert',
        icon: Sparkles,
        tone: firstAlert.severity === 'high' ? 'negative' : firstAlert.severity === 'medium' ? 'warning' : 'neutral',
        text: firstAlert.title,
      });
    }

    return lines;
  }, [snapshot, nearestFiling, returns.length, oracleInsights, cashStatus, recommendations, metrics]);

  // ── Right-side metric strip (real numbers) ──
  const rightMetrics = useMemo(() => {
    const items: Array<{ label: string; value: string; tone: InsightLine['tone']; icon: LucideIcon }> = [];
    if (health) {
      items.push({
        label: 'Health',
        value: `${Math.round(health.score)}/100`,
        tone: health.tone,
        icon: ShieldCheck,
      });
    }
    items.push({
      label: 'Revenue',
      value: snapshot.revenue > 0 ? abbreviateINR(snapshot.revenue) : '—',
      tone: snapshot.revenue > 0 ? 'positive' : 'neutral',
      icon: TrendingUp,
    });
    items.push({
      label: 'Cash',
      value: snapshot.bankBalance > 0 ? abbreviateINR(snapshot.bankBalance) : '—',
      tone: snapshot.bankBalance > 0 ? 'positive' : 'neutral',
      icon: Sparkles,
    });
    if (snapshot.gst.netLiability > 0) {
      items.push({
        label: 'GST Due',
        value: abbreviateINR(snapshot.gst.netLiability),
        tone: 'warning',
        icon: ShieldCheck,
      });
    }
    return items;
  }, [health, snapshot]);

  const handleClick = () => {
    router.push('/oracle');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  // ── Honest empty state: nothing to brief on yet ──
  // (e.g. fresh workspace with no data — show a friendly prompt instead of fake
  // insight lines)
  const hasAnyData =
    snapshot.hasLiveData ||
    returns.length > 0 ||
    metrics.criticalIssues > 0 ||
    recommendations.length > 0 ||
    oracleInsights != null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' as const }}
      role="button"
      tabIndex={0}
      aria-label="Oracle Daily Brief — open Oracle"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="group relative cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
    >
      {/* Subtle amber border + glass surface */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.04] via-transparent to-transparent pointer-events-none transition-colors group-hover:border-amber-500/35"
      />
      <div className="relative rounded-2xl glass-surface p-5 md:p-6">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_18px_-4px_rgba(245,158,11,0.55)] shrink-0">
              <Brain className="h-4.5 w-4.5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-foreground tracking-tight">
                  Oracle Daily Brief
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/[0.08] px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider text-amber-400">
                  <span className="h-1 w-1 rounded-full bg-amber-400 animate-pulse" />
                  Live
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Your business at a glance — click to ask Oracle anything.
              </p>
            </div>
          </div>
          <div
            aria-hidden
            className="hidden sm:flex items-center gap-1 text-[11px] font-medium text-amber-400 transition-transform group-hover:translate-x-0.5"
          >
            Open Oracle
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </div>

        {/* ── Body ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Left: insight lines (3/5 width on lg) */}
          <div className="lg:col-span-3 min-w-0">
            {loading ? (
              <BriefSkeleton />
            ) : insightLines.length === 0 ? (
              hasAnyData ? (
                <div className="flex items-start gap-2.5 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-[12.5px] text-muted-foreground leading-relaxed">
                    All clear — nothing needs your attention right now. Open Oracle to dig deeper.
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 py-2">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-[12.5px] text-muted-foreground leading-relaxed">
                    Connect Google or Zoho Books, or create your first invoice — Oracle will surface daily insights here as your data grows.
                  </p>
                </div>
              )
            ) : (
              <ul className="space-y-2.5">
                {insightLines.slice(0, 6).map((line) => {
                  const Icon = line.icon;
                  return (
                    <li key={line.id} className="flex items-start gap-2.5">
                      <Icon className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', TONE_CLASSES[line.tone])} />
                      <p className="text-[12.5px] text-foreground/90 leading-relaxed">
                        {line.text}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Right: key metrics strip (2/5 width on lg) */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-2 self-start">
            {rightMetrics.map((m) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.label}
                  className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-2"
                >
                  <div className="flex items-center gap-1 mb-0.5">
                    <Icon className={cn('h-3 w-3', TONE_CLASSES[m.tone])} />
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {m.label}
                    </span>
                  </div>
                  <p className={cn('text-sm font-semibold tabular-nums', TONE_CLASSES[m.tone])}>
                    {m.value}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Footer (mobile) ── */}
        <div className="mt-4 flex items-center justify-end sm:hidden">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400">
            Open Oracle
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </motion.section>
  );
}

// ─── Brief skeleton (real loading state — no fake numbers) ─────────────────

function BriefSkeleton() {
  return (
    <ul className="space-y-2.5">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-start gap-2.5">
          <div className="h-3.5 w-3.5 mt-0.5 rounded bg-white/[0.06] animate-pulse shrink-0" />
          <div className="h-3 flex-1 rounded bg-white/[0.06] animate-pulse" />
        </li>
      ))}
    </ul>
  );
}

export default OracleDailyBrief;
