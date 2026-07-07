'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI CFO™ Phase 1 — FINANCIAL INTELLIGENCE SECTIONS
//
// Renders the Phase 1 Financial Intelligence Engine bundle on top of the
// existing AI CFO Dashboard. Does NOT modify or replace any existing UI —
// this component is additive and is inserted into AICFODashboardPage.
//
// Sections (per Phase 1 spec):
//   1.  Executive Summary
//   2.  Real Financial Health Score (0-100, 10 factors with explanations)
//   3.  Revenue Analytics (monthly/quarterly/yearly/by-client/by-industry/forecast)
//   4.  Profitability (Gross/Net/Operating/EBITDA/Expense Ratio/Customer/Vendor)
//   5.  Cash Flow Engine (current/burn/runway/7d/30d/90d/365d/why decreasing)
//   6.  Working Capital (CA/CL/WC/Ratio/Quick Ratio/Liquidity Risk)
//   7.  Expense Engine (9 categories + MoM + trends + top vendors)
//   8.  Collection Engine (late payments/probability/bad debt/recovery strategy)
//   9.  GST & ITC Position (liability/ITC/at-risk/upcoming dues/filing history)
//  10.  Forecast Engine (6 metrics × 4 horizons with confidence)
//  11.  Business Risk Engine (10 risks × Low/Medium/High/Critical)
//  12.  AI CFO Recommendations (with Reason/Impact/Priority/Confidence)
//
// Tagline: GSTPilot AI CFO™ — Every business deserves a world-class CFO.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, TrendingUp, TrendingDown, Wallet, IndianRupee, FileText, CreditCard,
  Sparkles, AlertTriangle, CheckCircle2, Lightbulb, Activity, Clock,
  RefreshCw, ChevronRight, Target, ShieldAlert, Users, Gauge,
  Building2, PieChart, BarChart3, Flame, Banknote, ArrowUpRight, ArrowDownRight,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type {
  FinancialIntelligenceBundle,
  SeverityLevel,
  RecommendationPriority,
  AIRecommendation,
  HealthScoreFactor,
  BusinessRisk,
  CashFlowProjection,
  ForecastRow,
  ExpenseCategoryBreakdown,
  CollectionRow,
} from '@/lib/cfo/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function formatINRFull(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function formatPct(p: number): string {
  const sign = p > 0 ? '+' : '';
  return `${sign}${p.toFixed(1)}%`;
}

function severityColor(s: SeverityLevel): string {
  switch (s) {
    case 'critical': return 'text-red-400';
    case 'high': return 'text-orange-400';
    case 'medium': return 'text-amber-400';
    default: return 'text-emerald-400';
  }
}

function severityBg(s: SeverityLevel): string {
  switch (s) {
    case 'critical': return 'border-red-500/30 bg-red-500/[0.06]';
    case 'high': return 'border-orange-500/30 bg-orange-500/[0.05]';
    case 'medium': return 'border-amber-500/30 bg-amber-500/[0.05]';
    default: return 'border-emerald-500/30 bg-emerald-500/[0.04]';
  }
}

function priorityColor(p: RecommendationPriority): string {
  switch (p) {
    case 'critical': return 'border-red-500/40 bg-red-500/[0.08]';
    case 'high': return 'border-orange-500/30 bg-orange-500/[0.06]';
    case 'medium': return 'border-amber-500/30 bg-amber-500/[0.05]';
    default: return 'border-cyan-500/30 bg-cyan-500/[0.04]';
  }
}

function priorityBadge(p: RecommendationPriority): string {
  switch (p) {
    case 'critical': return 'bg-red-500/15 text-red-300 border-red-500/30';
    case 'high': return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
    case 'medium': return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    default: return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
  }
}

function trendIcon(t: 'up' | 'down' | 'stable') {
  if (t === 'up') return <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />;
  if (t === 'down') return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Activity className="h-3.5 w-3.5 text-muted-foreground" />;
}

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' as const }}
    >
      {children}
    </motion.div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, action }: { icon: LucideIcon; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg accent-gradient-soft">
          <Icon className="h-4 w-4 accent-text" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ─── Health Score Gauge (0-100) ───────────────────────────────────────────────

function HealthGauge({ score, size = 160 }: { score: number; size?: number }) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const tier = score >= 80 ? 'Excellent' : score >= 65 ? 'Healthy' : score >= 50 ? 'Needs Attention' : score >= 35 ? 'At Risk' : 'Critical';
  const color = score >= 80 ? '#10b981' : score >= 65 ? '#06b6d4' : score >= 50 ? '#f59e0b' : score >= 35 ? '#f97316' : '#ef4444';
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="phase1HealthGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity={0.6} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#phase1HealthGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: 'easeOut' as const }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="text-4xl font-bold"
          style={{ color }}
        >
          {score}
        </motion.span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">/ 100</span>
        <span className="mt-1 text-xs font-medium" style={{ color }}>{tier}</span>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Phase1Skeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AICFOPhase1Sections() {
  const [data, setData] = useState<FinancialIntelligenceBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/ai-cfo/intelligence', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as FinancialIntelligenceBundle;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load CFO intelligence');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) return <Phase1Skeleton />;

  if (error || !data) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Card className="max-w-md border-white/[0.06] bg-card/60">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-400" />
            <p className="text-sm font-medium text-foreground">Phase 1 intelligence unavailable</p>
            <p className="mt-1 text-xs text-muted-foreground">{error || 'Unknown error'}</p>
            <Button onClick={fetchData} variant="outline" className="mt-4 border-white/10 bg-white/[0.03]">
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { executiveSummary: exec, healthScore, revenue, profitability, cashFlow, workingCapital, expenses, collections, gst, forecast, risks, recommendations: recs } = data;

  return (
    <div className="space-y-8">
      {/* ═══ PHASE 1 HEADER ═══ */}
      <FadeIn>
        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] via-cyan-500/[0.04] to-transparent p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl accent-gradient shadow-lg shadow-emerald-500/20">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold tracking-tight text-foreground">
                    AI CFO<span className="accent-text">™</span> Phase 1 — Financial Intelligence Engine
                  </h2>
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300 text-[10px]">
                    LIVE
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Every business deserves a world-class CFO · {data.dataSources.length} data sources connected · {data.invoiceCount} invoices analyzed
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchData}
              disabled={refreshing}
              className="border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* ═══ 1. EXECUTIVE SUMMARY ═══ */}
      <FadeIn delay={0.05}>
        <Card className="border-white/[0.06] bg-gradient-to-br from-emerald-500/[0.04] via-card/60 to-cyan-500/[0.04] backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 accent-text" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Executive Summary</h3>
              </div>
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300 text-[10px]">
                Health: {exec.healthScore}/100 · {exec.healthTier}
              </Badge>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-foreground/90">{exec.headline}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              {exec.keyMetrics.map((m) => (
                <div key={m.label} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.label}</span>
                    {m.trend && trendIcon(m.trend)}
                  </div>
                  <p className="text-xs font-bold text-foreground">{m.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-red-500/20 bg-red-500/[0.03] p-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 text-red-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400">Top Risk</span>
                </div>
                <p className="text-xs text-foreground/80">{exec.topRisk}</p>
              </div>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] p-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <Lightbulb className="h-3 w-3 text-emerald-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Top Opportunity</span>
                </div>
                <p className="text-xs text-foreground/80">{exec.topOpportunity}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* ═══ 2. REAL FINANCIAL HEALTH SCORE ═══ */}
      <div>
        <SectionHeader
          icon={Gauge}
          title="Real Financial Health Score"
          subtitle="0-100 weighted score across 10 factors — with full explanation"
          action={<Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-300">{healthScore.tier}</Badge>}
        />
        <FadeIn delay={0.1}>
          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex flex-col gap-6 lg:flex-row">
                {/* Gauge + summary */}
                <div className="flex flex-col items-center gap-4 lg:w-64">
                  <HealthGauge score={healthScore.overall} />
                  <div className="text-center">
                    <p className="text-xs leading-relaxed text-muted-foreground">{healthScore.summary}</p>
                  </div>
                  <div className="w-full space-y-2 rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                    <div className="flex items-center gap-2">
                      <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Top Driver</span>
                    </div>
                    <p className="text-[11px] text-foreground/80">{healthScore.topDriver}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <ArrowDownRight className="h-3 w-3 text-red-400" />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Top Drag</span>
                    </div>
                    <p className="text-[11px] text-foreground/80">{healthScore.topDrag}</p>
                  </div>
                </div>
                {/* 10 factors */}
                <div className="flex-1">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">10 Factors — Click to expand</span>
                    <span className="text-[10px] text-muted-foreground">Weights sum to 100%</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {healthScore.factors.map((f, i) => (
                      <FactorCard key={f.key} factor={f} delay={i * 0.03} />
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* ═══ 3. REVENUE ANALYTICS ═══ */}
      <div>
        <SectionHeader
          icon={TrendingUp}
          title="Revenue Analytics"
          subtitle="Monthly · Quarterly · Yearly · By Client · By Industry · Forecast"
          action={
            <div className="flex items-center gap-2">
              {trendIcon(revenue.trend)}
              <span className="text-xs font-medium text-muted-foreground">{formatPct(revenue.growthPct)} MoM</span>
            </div>
          }
        />
        <FadeIn delay={0.15}>
          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardContent className="p-5">
              {/* Top metrics row */}
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <MetricBox label="Today" value={formatINR(revenue.today)} />
                <MetricBox label="This Week" value={formatINR(revenue.thisWeek)} />
                <MetricBox label="This Month" value={formatINR(revenue.thisMonth)} />
                <MetricBox label="This Quarter" value={formatINR(revenue.thisQuarter)} />
                <MetricBox label="YTD" value={formatINR(revenue.thisYear)} />
                <MetricBox label="YoY Growth" value={formatPct(revenue.yoyGrowthPct)} trend={revenue.trend} />
              </div>
              {/* Monthly sparkline */}
              {revenue.sparkline.length > 1 && (
                <div className="mb-5">
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">12-Month Revenue Trend</p>
                  <BarChart data={revenue.sparkline} labels={revenue.periods.monthly.map((m) => m.month)} color="#10b981" />
                </div>
              )}
              {/* Top Clients */}
              {revenue.topClients.length > 0 && (
                <div className="mb-5">
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Top Clients by Revenue</p>
                  <div className="space-y-1.5">
                    {revenue.topClients.map((c, i) => (
                      <div key={i} className="flex items-center justify-between rounded-md border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded bg-white/[0.04] text-[10px] font-bold">{i + 1}</span>
                          <span className="font-medium text-foreground">{c.name}</span>
                          {trendIcon(c.trend)}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">{c.sharePct}%</span>
                          <span className="font-bold text-foreground">{formatINR(c.revenue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Forecast */}
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] p-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">Revenue Forecast</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <MetricBox label="30 Days" value={formatINR(revenue.forecast.thirtyDay)} />
                  <MetricBox label="90 Days" value={formatINR(revenue.forecast.ninetyDay)} />
                  <MetricBox label="Year End" value={formatINR(revenue.forecast.yearEnd)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* ═══ 4. PROFITABILITY ═══ */}
      <div>
        <SectionHeader
          icon={PieChart}
          title="Profitability Engine"
          subtitle="Gross · Net · Operating · EBITDA · Expense Ratio · Customer · Vendor"
          action={trendIcon(profitability.trend)}
        />
        <FadeIn delay={0.2}>
          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardContent className="p-5">
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <MetricBox label="Gross Profit" value={formatINR(profitability.grossProfit)} sub={`${profitability.grossMarginPct}% margin`} />
                <MetricBox label="Net Profit" value={formatINR(profitability.netProfit)} sub={`${profitability.netMarginPct}% margin`} />
                <MetricBox label="Operating Margin" value={`${profitability.operatingMarginPct}%`} />
                <MetricBox label="EBITDA" value={formatINR(profitability.ebitda)} sub={`${profitability.ebitdaMarginPct}% margin`} />
                <MetricBox label="Expense Ratio" value={`${profitability.expenseRatioPct}%`} />
              </div>
              {/* Monthly trends */}
              {profitability.monthlyTrends.length > 0 && (
                <div className="mb-5">
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">6-Month Profit Trend</p>
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full min-w-[600px] text-xs">
                      <thead>
                        <tr className="border-b border-white/[0.06] text-muted-foreground">
                          <th className="py-2 pr-3 text-left font-medium">Month</th>
                          <th className="py-2 px-3 text-right font-medium">Revenue</th>
                          <th className="py-2 px-3 text-right font-medium">COGS</th>
                          <th className="py-2 px-3 text-right font-medium">Gross</th>
                          <th className="py-2 px-3 text-right font-medium">OpEx</th>
                          <th className="py-2 px-3 text-right font-medium">EBITDA</th>
                          <th className="py-2 px-3 text-right font-medium">Net</th>
                          <th className="py-2 pl-3 text-right font-medium">Net %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profitability.monthlyTrends.map((t) => (
                          <tr key={t.month} className="border-b border-white/[0.03]">
                            <td className="py-2 pr-3 font-medium text-foreground">{t.month}</td>
                            <td className="py-2 px-3 text-right text-foreground/80">{formatINR(t.revenue)}</td>
                            <td className="py-2 px-3 text-right text-muted-foreground">{formatINR(t.cogs)}</td>
                            <td className="py-2 px-3 text-right text-foreground/80">{formatINR(t.grossProfit)}</td>
                            <td className="py-2 px-3 text-right text-muted-foreground">{formatINR(t.opex)}</td>
                            <td className="py-2 px-3 text-right text-foreground/80">{formatINR(t.ebitda)}</td>
                            <td className="py-2 px-3 text-right font-medium text-emerald-300">{formatINR(t.netProfit)}</td>
                            <td className="py-2 pl-3 text-right text-muted-foreground">{t.netMarginPct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {/* Top vendors */}
              {profitability.vendorCosts.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Top Vendors by Spend</p>
                  <div className="space-y-1.5">
                    {profitability.vendorCosts.slice(0, 5).map((v, i) => (
                      <div key={i} className="flex items-center justify-between rounded-md border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded bg-white/[0.04] text-[10px] font-bold">{i + 1}</span>
                          <span className="font-medium text-foreground">{v.vendorName}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">{v.sharePct}%</span>
                          <span className="font-bold text-foreground">{formatINR(v.totalSpend)}</span>
                          {v.overdueAmount > 0 && <Badge variant="outline" className="border-red-500/30 bg-red-500/[0.05] text-red-300 text-[9px]">{formatINR(v.overdueAmount)} overdue</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* ═══ 5. CASH FLOW ENGINE ═══ */}
      <div>
        <SectionHeader
          icon={Wallet}
          title="Cash Flow Engine"
          subtitle="Current · Burn · Runway · 7d/30d/90d/365d Projections · Why Decreasing"
          action={trendIcon(cashFlow.trend)}
        />
        <FadeIn delay={0.25}>
          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardContent className="p-5">
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <MetricBox label="Current Cash" value={formatINR(cashFlow.currentCash)} />
                <MetricBox label="Available" value={formatINR(cashFlow.availableCash)} />
                <MetricBox label="Daily Burn" value={formatINR(cashFlow.burnRatePerDay)} icon={Flame} />
                <MetricBox label="Monthly Burn" value={formatINR(cashFlow.burnRatePerMonth)} icon={Flame} />
                <MetricBox
                  label="Runway"
                  value={cashFlow.runwayDays > 0 ? `${cashFlow.runwayDays} days` : '> 1 year'}
                  sub={cashFlow.runwayDate || undefined}
                />
              </div>
              {/* This month cash flow */}
              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
                  <div className="mb-1 flex items-center gap-1.5">
                    <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                    <span className="text-[10px] uppercase tracking-wider text-emerald-400">Inflow (MTD)</span>
                  </div>
                  <p className="text-lg font-bold text-foreground">{formatINR(cashFlow.inflowThisMonth)}</p>
                </div>
                <div className="rounded-lg border border-red-500/20 bg-red-500/[0.04] p-3">
                  <div className="mb-1 flex items-center gap-1.5">
                    <ArrowDownRight className="h-3 w-3 text-red-400" />
                    <span className="text-[10px] uppercase tracking-wider text-red-400">Outflow (MTD)</span>
                  </div>
                  <p className="text-lg font-bold text-foreground">{formatINR(cashFlow.outflowThisMonth)}</p>
                </div>
                <div className={`rounded-lg border p-3 ${cashFlow.netThisMonth >= 0 ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : 'border-red-500/20 bg-red-500/[0.04]'}`}>
                  <div className="mb-1 flex items-center gap-1.5">
                    <Activity className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Net (MTD)</span>
                  </div>
                  <p className={`text-lg font-bold ${cashFlow.netThisMonth >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{formatINR(cashFlow.netThisMonth)}</p>
                </div>
              </div>
              {/* Projections */}
              <div className="mb-5">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Cash Flow Projections</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {cashFlow.projections.map((p) => (
                    <ProjectionCard key={p.period} proj={p} />
                  ))}
                </div>
              </div>
              {/* Why decreasing */}
              {cashFlow.whyDecreasing.length > 0 && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-amber-400" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">Why Cash Is Changing</span>
                  </div>
                  <ul className="space-y-1">
                    {cashFlow.whyDecreasing.map((w, i) => (
                      <li key={i} className="text-xs text-foreground/80">• {w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* ═══ 6. WORKING CAPITAL ═══ */}
      <div>
        <SectionHeader
          icon={Banknote}
          title="Working Capital Engine"
          subtitle="Current Assets · Liabilities · WC Ratio · Quick Ratio · Liquidity Risk"
          action={
            <Badge variant="outline" className={`${severityBg(workingCapital.liquidityRisk)} ${severityColor(workingCapital.liquidityRisk)}`}>
              {workingCapital.liquidityRisk.toUpperCase()} RISK
            </Badge>
          }
        />
        <FadeIn delay={0.3}>
          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardContent className="p-5">
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <MetricBox label="Current Assets" value={formatINR(workingCapital.currentAssets)} />
                <MetricBox label="Current Liabilities" value={formatINR(workingCapital.currentLiabilities)} />
                <MetricBox
                  label="Working Capital"
                  value={formatINR(workingCapital.workingCapital)}
                  sub={workingCapital.workingCapital >= 0 ? 'Positive' : 'Negative'}
                />
                <MetricBox label="WC Ratio" value={workingCapital.workingCapitalRatio === 999 ? '∞' : workingCapital.workingCapitalRatio.toFixed(2)} sub="Target: 1.5-2.0" />
                <MetricBox label="Quick Ratio" value={workingCapital.quickRatio === 999 ? '∞' : workingCapital.quickRatio.toFixed(2)} sub="Target: > 1.0" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Current Assets Breakdown</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Cash</span><span className="font-medium text-foreground">{formatINR(workingCapital.currentAssets - workingCapital.accountsReceivable - workingCapital.inventoryValue - workingCapital.prepaidExpenses)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Accounts Receivable</span><span className="font-medium text-foreground">{formatINR(workingCapital.accountsReceivable)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Inventory</span><span className="font-medium text-foreground">{formatINR(workingCapital.inventoryValue)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Prepaid Expenses</span><span className="font-medium text-foreground">{formatINR(workingCapital.prepaidExpenses)}</span></div>
                  </div>
                </div>
                <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Current Liabilities Breakdown</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Accounts Payable</span><span className="font-medium text-foreground">{formatINR(workingCapital.accountsPayable)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Short-term Debt</span><span className="font-medium text-foreground">{formatINR(workingCapital.shortTermDebt)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">GST Payable (est.)</span><span className="font-medium text-foreground">{formatINR(Math.max(workingCapital.currentLiabilities - workingCapital.accountsPayable - workingCapital.shortTermDebt, 0))}</span></div>
                  </div>
                </div>
              </div>
              <div className={`mt-3 rounded-lg border p-3 ${severityBg(workingCapital.liquidityRisk)}`}>
                <p className="text-xs text-foreground/80">
                  <span className={`font-semibold ${severityColor(workingCapital.liquidityRisk)}`}>Liquidity Assessment:</span> {workingCapital.liquidityRiskReason}
                </p>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* ═══ 7. EXPENSE ENGINE ═══ */}
      <div>
        <SectionHeader
          icon={CreditCard}
          title="Expense Engine"
          subtitle="9 Categories · MoM Comparison · Trends · Top Vendors · Recurring vs One-time"
          action={
            <div className="flex items-center gap-2">
              {trendIcon(expenses.trend)}
              <span className="text-xs font-medium text-muted-foreground">{formatPct(expenses.momChangePct)} MoM</span>
            </div>
          }
        />
        <FadeIn delay={0.35}>
          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardContent className="p-5">
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricBox label="This Month" value={formatINR(expenses.totalThisMonth)} />
                <MetricBox label="Last Month" value={formatINR(expenses.totalLastMonth)} />
                <MetricBox label="6-mo Average" value={formatINR(expenses.avgMonthly)} />
                <MetricBox label="Recurring" value={formatINR(expenses.recurringExpenses)} sub={`One-time: ${formatINR(expenses.oneTimeExpenses)}`} />
              </div>
              {expenses.byCategory.length > 0 && (
                <div className="mb-5">
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">By Category (This Month)</p>
                  <div className="space-y-2">
                    {expenses.byCategory.map((c) => (
                      <CategoryBar key={c.category} cat={c} />
                    ))}
                  </div>
                </div>
              )}
              {expenses.topVendors.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Top Vendors (This Month)</p>
                  <div className="flex flex-wrap gap-2">
                    {expenses.topVendors.map((v, i) => (
                      <Badge key={i} variant="outline" className="border-white/10 bg-white/[0.03] py-1.5">
                        <span className="text-muted-foreground mr-1.5">{v.vendor}:</span>
                        <span className="font-medium text-foreground">{formatINR(v.amount)}</span>
                        <span className="ml-1.5 text-[10px] text-muted-foreground">({v.count})</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* ═══ 8. COLLECTION ENGINE ═══ */}
      <div>
        <SectionHeader
          icon={IndianRupee}
          title="Collection Engine"
          subtitle="Late Payments · Outstanding · Expected · Probability · Bad Debt · Recovery Strategy"
          action={
            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/[0.05] text-amber-300">
              {collections.overdueCount} overdue · {formatINR(collections.overdueAmount)}
            </Badge>
          }
        />
        <FadeIn delay={0.4}>
          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardContent className="p-5">
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <MetricBox label="Outstanding" value={formatINR(collections.totalOutstanding)} />
                <MetricBox label="Overdue" value={formatINR(collections.overdueAmount)} sub={`${collections.overdueCount} invoices`} />
                <MetricBox label="Expected 30d" value={formatINR(collections.expectedCollections30d)} />
                <MetricBox label="Avg Days to Pay" value={`${collections.averageDaysToPay}d`} />
                <MetricBox label="Collection Eff." value={`${collections.collectionEfficiencyPct}%`} />
                <MetricBox label="Bad Debt Reserve" value={formatINR(collections.badDebtReserve)} />
              </div>
              {/* Recovery strategy */}
              {collections.recoveryStrategy.length > 0 && (
                <div className="mb-5 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] p-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Target className="h-3 w-3 text-cyan-400" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">Recovery Strategy</span>
                  </div>
                  <ul className="space-y-1">
                    {collections.recoveryStrategy.map((s, i) => (
                      <li key={i} className="text-xs text-foreground/80">• {s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {/* Late payments table */}
              {collections.latePayments.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Late Payments (sorted by days overdue)</p>
                  <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-1.5">
                    {collections.latePayments.slice(0, 15).map((r) => (
                      <CollectionRowCard key={r.invoiceId} row={r} />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* ═══ 9. GST & ITC POSITION ═══ */}
      <div>
        <SectionHeader
          icon={FileText}
          title="GST & ITC Position"
          subtitle="Output Liability · ITC Available · Net Payable · At-Risk · Upcoming Dues"
          action={
            <Badge variant="outline" className={gst.overdueFilings > 0 ? 'border-red-500/30 bg-red-500/[0.05] text-red-300' : 'border-emerald-500/30 bg-emerald-500/[0.05] text-emerald-300'}>
              {gst.overdueFilings > 0 ? `${gst.overdueFilings} overdue` : 'Compliant'}
            </Badge>
          }
        />
        <FadeIn delay={0.45}>
          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardContent className="p-5">
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <MetricBox label="Output Liability" value={formatINR(gst.outputLiability)} />
                <MetricBox label="ITC Available" value={formatINR(gst.inputTaxCredit)} />
                <MetricBox label="Net GST Payable" value={formatINR(gst.netGSTPayable)} sub={`${gst.itcUtilizationPct}% ITC used`} />
                <MetricBox label="ITC At Risk" value={formatINR(gst.itcAtRisk)} sub=">180 days" />
                <MetricBox label="Pending Filings" value={String(gst.pendingFilings)} sub={`${gst.overdueFilings} overdue`} />
              </div>
              {/* Upcoming dues */}
              {gst.upcomingDueDates.length > 0 && (
                <div className="mb-5">
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Upcoming GST Due Dates (60 days)</p>
                  <div className="space-y-1.5">
                    {gst.upcomingDueDates.map((d, i) => (
                      <div key={i} className="flex items-center justify-between rounded-md border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-xs">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-300 text-[10px]">{d.returnType}</Badge>
                          <span className="font-medium text-foreground">{d.period}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">Liability: {formatINR(d.liability)}</span>
                          <span className={d.daysLeft < 0 ? 'font-bold text-red-300' : d.daysLeft <= 7 ? 'font-bold text-amber-300' : 'font-medium text-foreground'}>
                            {d.daysLeft < 0 ? `${Math.abs(d.daysLeft)}d overdue` : `${d.daysLeft}d left`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Filing history */}
              {gst.filingHistory.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Filing History (6 months)</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {gst.filingHistory.map((f, i) => (
                      <div key={i} className={`rounded-md border p-2 text-center ${f.filed ? (f.onTime ? 'border-emerald-500/30 bg-emerald-500/[0.04]' : 'border-amber-500/30 bg-amber-500/[0.04]') : 'border-red-500/30 bg-red-500/[0.04]'}`}>
                        <p className="text-[9px] text-muted-foreground">{f.period}</p>
                        <p className={`text-xs font-bold ${f.filed ? (f.onTime ? 'text-emerald-400' : 'text-amber-400') : 'text-red-400'}`}>
                          {f.filed ? (f.onTime ? 'On Time' : 'Late') : 'Pending'}
                        </p>
                        {f.liability > 0 && <p className="text-[9px] text-muted-foreground">{formatINR(f.liability)}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* ═══ 10. FORECAST ENGINE ═══ */}
      <div>
        <SectionHeader
          icon={Brain}
          title="Forecast Engine"
          subtitle="6 Metrics × 4 Horizons (7d · 30d · 90d · 365d) with Confidence Scores"
          action={
            <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-300">
              {forecast.overallConfidencePct}% confidence
            </Badge>
          }
        />
        <FadeIn delay={0.5}>
          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardContent className="p-5">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full min-w-[700px] text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-muted-foreground">
                      <th className="py-2 pr-3 text-left font-medium">Metric</th>
                      <th className="py-2 px-3 text-right font-medium">Current</th>
                      <th className="py-2 px-3 text-right font-medium">7 Days</th>
                      <th className="py-2 px-3 text-right font-medium">30 Days</th>
                      <th className="py-2 px-3 text-right font-medium">90 Days</th>
                      <th className="py-2 px-3 text-right font-medium">Year End</th>
                      <th className="py-2 px-3 text-right font-medium">Conf.</th>
                      <th className="py-2 pl-3 text-center font-medium">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.rows.map((row) => (
                      <ForecastRowCard key={row.metric} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Methodology</p>
                <p className="text-[11px] leading-relaxed text-foreground/70">{forecast.methodology}</p>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* ═══ 11. BUSINESS RISK ENGINE ═══ */}
      <div>
        <SectionHeader
          icon={ShieldAlert}
          title="Business Risk Engine"
          subtitle="10 Risks · Low · Medium · High · Critical"
          action={
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`${severityBg(risks.overallRiskLevel)} ${severityColor(risks.overallRiskLevel)}`}>
                {risks.overallRiskLevel.toUpperCase()}
              </Badge>
              {risks.criticalCount > 0 && (
                <Badge variant="outline" className="border-red-500/40 bg-red-500/[0.1] text-red-300">
                  {risks.criticalCount} critical
                </Badge>
              )}
            </div>
          }
        />
        <FadeIn delay={0.55}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {risks.risks.slice(0, 9).map((risk, i) => (
              <RiskCard key={risk.type} risk={risk} delay={i * 0.04} />
            ))}
          </div>
        </FadeIn>
      </div>

      {/* ═══ 12. AI CFO RECOMMENDATIONS ═══ */}
      <div>
        <SectionHeader
          icon={Lightbulb}
          title="AI CFO Recommendations"
          subtitle="Executive Advice with Reason · Financial Impact · Priority · Confidence"
          action={
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300">
              {recs.recommendations.length} active · {formatINR(recs.totalImpactValue)} impact
            </Badge>
          }
        />
        <FadeIn delay={0.6}>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {recs.recommendations.slice(0, 8).map((rec, i) => (
              <RecommendationCardV2 key={rec.id} rec={rec} delay={i * 0.04} />
            ))}
          </div>
        </FadeIn>
      </div>

      {/* ═══ PHASE 1 FOOTER ═══ */}
      <FadeIn delay={0.65}>
        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] to-cyan-500/[0.04] p-5 text-center">
          <p className="text-sm font-medium text-foreground">
            GSTPilot AI CFO<span className="accent-text">™</span> — Every business deserves a world-class CFO.
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {data.dataSources.join(' · ')} · {data.invoiceCount} invoices · {data.clientCount} clients · Generated {new Date(data.generatedAt).toLocaleTimeString('en-IN')}
          </p>
        </div>
      </FadeIn>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricBox({ label, value, sub, trend, icon: Icon }: { label: string; value: string; sub?: string; trend?: 'up' | 'down' | 'stable'; icon?: LucideIcon }) {
  return (
    <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
        {trend && trendIcon(trend)}
      </div>
      <p className="text-sm font-bold text-foreground">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function FactorCard({ factor, delay }: { factor: HealthScoreFactor; delay: number }) {
  const color = factor.score >= 70 ? '#10b981' : factor.score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3"
    >
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {trendIcon(factor.direction)}
          <span className="text-[11px] font-medium text-foreground">{factor.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-muted-foreground">{Math.round(factor.weight * 100)}%</span>
          <span className="text-xs font-bold" style={{ color }}>{factor.score}</span>
        </div>
      </div>
      <div className="mb-1.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.05]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${factor.score}%` }}
          transition={{ duration: 0.8, delay: delay + 0.2 }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
      <p className="text-[10px] leading-relaxed text-muted-foreground">{factor.explanation}</p>
      {factor.benchmark && (
        <p className="mt-1 text-[9px] text-muted-foreground/70">Benchmark: {factor.benchmark}</p>
      )}
    </motion.div>
  );
}

function BarChart({ data, labels, color = '#10b981', height = 60 }: { data: number[]; labels?: string[]; color?: string; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((v, i) => {
        const h = Math.max(2, (v / max) * (height - 16));
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: h }}
              transition={{ duration: 0.6, delay: i * 0.04 }}
              className="w-full rounded-t-sm"
              style={{ background: color, minHeight: 2, opacity: 0.85 }}
            />
            {labels && <span className="text-[8px] text-muted-foreground">{labels[i]}</span>}
          </div>
        );
      })}
    </div>
  );
}

function ProjectionCard({ proj }: { proj: CashFlowProjection }) {
  const positive = proj.net >= 0;
  return (
    <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{proj.period}</span>
        <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-[9px]">{proj.confidencePct}%</Badge>
      </div>
      <p className={`text-base font-bold ${positive ? 'text-emerald-300' : 'text-red-300'}`}>{formatINR(proj.endingCash)}</p>
      <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
        <div className="flex justify-between"><span>Inflow</span><span className="text-emerald-400">+{formatINR(proj.inflow)}</span></div>
        <div className="flex justify-between"><span>Outflow</span><span className="text-red-400">-{formatINR(proj.outflow)}</span></div>
        <div className="flex justify-between font-medium"><span>Net</span><span className={positive ? 'text-emerald-300' : 'text-red-300'}>{positive ? '+' : ''}{formatINR(proj.net)}</span></div>
      </div>
    </div>
  );
}

function CategoryBar({ cat }: { cat: ExpenseCategoryBreakdown }) {
  const color = cat.trend === 'up' ? '#f59e0b' : cat.trend === 'down' ? '#10b981' : '#06b6d4';
  return (
    <div className="rounded-md border border-white/[0.04] bg-white/[0.02] p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {trendIcon(cat.trend)}
          <span className="text-xs font-medium text-foreground">{cat.label}</span>
          <span className="text-[10px] text-muted-foreground">{cat.invoiceCount} bills</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{formatPct(cat.momChangePct)} MoM</span>
          <span className="text-xs font-bold text-foreground">{formatINR(cat.amount)}</span>
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${cat.sharePct}%` }}
          transition={{ duration: 0.8 }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">{cat.sharePct}% of total expenses</p>
    </div>
  );
}

function CollectionRowCard({ row }: { row: CollectionRow }) {
  return (
    <div className={`rounded-md border p-2.5 ${severityBg(row.badDebtRisk)}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground">{row.invoiceNumber}</span>
            <span className={`text-[9px] font-bold ${severityColor(row.badDebtRisk)}`}>{row.badDebtRisk.toUpperCase()}</span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{row.clientName}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-foreground">{formatINR(row.outstandingAmount)}</p>
          <p className="text-[10px] text-muted-foreground">{row.daysOverdue}d overdue</p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Collection probability:</span>
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.05]">
            <div
              className="h-full rounded-full"
              style={{ width: `${row.collectionProbabilityPct}%`, background: row.collectionProbabilityPct >= 70 ? '#10b981' : row.collectionProbabilityPct >= 45 ? '#f59e0b' : '#ef4444' }}
            />
          </div>
          <span className="text-[10px] font-medium text-foreground">{row.collectionProbabilityPct}%</span>
        </div>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground/80">→ {row.recoveryStrategy}</p>
    </div>
  );
}

function ForecastRowCard({ row }: { row: ForecastRow }) {
  const trendUp = row.trend === 'up';
  return (
    <tr className="border-b border-white/[0.03]">
      <td className="py-2.5 pr-3">
        <div className="flex items-center gap-2">
          {trendIcon(row.trend)}
          <span className="font-medium text-foreground">{row.label}</span>
        </div>
      </td>
      <td className="py-2.5 px-3 text-right text-foreground/80">{formatINR(row.currentValue)}</td>
      <td className="py-2.5 px-3 text-right text-muted-foreground">{formatINR(row.sevenDay)}</td>
      <td className="py-2.5 px-3 text-right text-muted-foreground">{formatINR(row.thirtyDay)}</td>
      <td className="py-2.5 px-3 text-right text-foreground/80">{formatINR(row.ninetyDay)}</td>
      <td className="py-2.5 px-3 text-right font-medium text-foreground">{formatINR(row.yearEnd)}</td>
      <td className="py-2.5 px-3 text-right">
        <span className={row.confidencePct >= 70 ? 'text-emerald-400' : row.confidencePct >= 50 ? 'text-amber-400' : 'text-red-400'}>
          {row.confidencePct}%
        </span>
      </td>
      <td className="py-2.5 pl-3 text-center">
        {trendUp ? <ArrowUpRight className="mx-auto h-3.5 w-3.5 text-emerald-400" /> : row.trend === 'down' ? <ArrowDownRight className="mx-auto h-3.5 w-3.5 text-red-400" /> : <span className="text-muted-foreground">—</span>}
      </td>
    </tr>
  );
}

function RiskCard({ risk, delay }: { risk: BusinessRisk; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={`rounded-xl border p-4 ${severityBg(risk.severity)}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className={`h-4 w-4 ${severityColor(risk.severity)}`} />
          <span className="text-sm font-semibold text-foreground">{risk.label}</span>
        </div>
        <span className={`text-[10px] font-bold ${severityColor(risk.severity)}`}>{risk.severity.toUpperCase()}</span>
      </div>
      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${risk.score}%` }}
          transition={{ duration: 0.8, delay: delay + 0.2 }}
          className={`h-full rounded-full ${risk.severity === 'critical' ? 'bg-red-500' : risk.severity === 'high' ? 'bg-orange-500' : risk.severity === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`}
        />
      </div>
      <p className="mb-2 text-[11px] leading-relaxed text-foreground/80">{risk.current}</p>
      <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground"><span className="font-medium">Impact:</span> {risk.impact}</p>
      <div className="rounded-md bg-white/[0.03] p-2">
        <p className="text-[10px] leading-relaxed text-foreground/80">
          <span className="font-medium">Action:</span> {risk.recommendation}
        </p>
      </div>
    </motion.div>
  );
}

function RecommendationCardV2({ rec, delay }: { rec: AIRecommendation; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={`rounded-xl border p-4 ${priorityColor(rec.priority)}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Lightbulb className="h-4 w-4 mt-0.5 accent-text" />
          <div>
            <p className="text-sm font-semibold text-foreground">{rec.title}</p>
            <div className="mt-1 flex items-center gap-1.5">
              <Badge variant="outline" className={`${priorityBadge(rec.priority)} text-[9px] py-0`}>{rec.priority.toUpperCase()}</Badge>
              <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-[9px] py-0">{rec.timeframe.replace('_', ' ')}</Badge>
              <span className="text-[10px] text-muted-foreground">{rec.confidencePct}% confidence</span>
            </div>
          </div>
        </div>
        {rec.financialImpactValue > 0 && (
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Impact</p>
            <p className="text-sm font-bold text-emerald-300">{formatINR(rec.financialImpactValue)}</p>
          </div>
        )}
      </div>
      <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground"><span className="font-medium text-foreground/80">Reason:</span> {rec.reason}</p>
      <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground"><span className="font-medium text-emerald-300">Financial Impact:</span> {rec.financialImpact}</p>
      <div className="space-y-1">
        {rec.actions.slice(0, 4).map((action, i) => (
          <div key={i} className="flex items-start gap-2 text-[11px] text-foreground/80">
            <ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
            <span>{action}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
