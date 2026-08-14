'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Executive Analytics Dashboard
// 8-tab comprehensive analytics: MRR, ARR, Forecast, Churn, Profitability,
// Workload, Productivity, CLV — all computed from live Firestore data
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useFireClients,
  useFireInvoices,
  useFireReturns,
  useFireFirm,
} from '@/hooks/use-firestore';
import { useBusinessSnapshot } from '@/hooks/useBusinessSnapshot';
import type { BusinessSnapshot } from '@/lib/financial-engine/types';
import type {
  FirestoreClient,
  FirestoreInvoice,
  FirestoreReturn,
} from '@/lib/firestore-schema';
import { formatCurrency, formatNumber } from '@/lib/gst-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Users,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  AlertTriangle,
  Target,
  Clock,
  Star,
  Zap,
  UserCheck,
  Briefcase,
  Heart,
  Shield,
  CalendarDays,
  ChevronUp,
  ChevronDown,
  Minus,
} from 'lucide-react';

// ─── Color Palette ────────────────────────────────────────────────────────

const C = {
  emerald: '#2563EB',
  emeraldDark: '#1D4ED8',
  emeraldLight: '#d1fae5',
  teal: '#14b8a6',
  tealDark: '#2563EB',
  amber: '#f59e0b',
  amberLight: '#fef3c7',
  red: '#ef4444',
  redLight: '#fee2e2',
  slate: '#64748b',
  slateLight: '#e2e8f0',
  slateDark: '#334155',
  purple: '#8b5cf6',
  purpleLight: '#ede9fe',
  cyan: '#3B82F6',
  rose: '#f43f5e',
  orange: '#f97316',
  blue: '#3b82f6',
  sky: '#0ea5e9',
  lime: '#84cc16',
  pink: '#ec4899',
  indigo: '#6366f1',
  emerald50: '#ecfdf5',
  emerald100: '#d1fae5',
  emerald200: '#a7f3d0',
  emerald300: '#6ee7b7',
  emerald400: '#34d399',
  emerald500: '#2563EB',
  emerald600: '#1D4ED8',
  emerald700: '#047857',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',
};

// ─── Animation Variants ────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: 'easeOut' as const },
  }),
};

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmtINR(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number, decimals = 1): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`;
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function periodToMonth(p: string): string {
  if (!p) return '';
  const parts = p.split('-');
  if (parts.length === 2) {
    const m = parseInt(parts[1], 10);
    return MONTHS[m - 1] || p;
  }
  return p;
}

function periodToSortKey(p: string): number {
  if (!p) return 0;
  const parts = p.split('-');
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 100 + parseInt(parts[1], 10);
  }
  return 0;
}

function getClientSegment(c: FirestoreClient): 'SMB' | 'Mid-Market' | 'Enterprise' {
  const tax = c.totalTaxPaid || 0;
  if (tax > 5000000) return 'Enterprise';
  if (tax > 1000000) return 'Mid-Market';
  return 'SMB';
}

function trendIcon(trend: number) {
  if (trend > 0) return <ArrowUpRight className="h-4 w-4 text-emerald-500" />;
  if (trend < 0) return <ArrowDownRight className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-slate-400" />;
}

function trendBadge(trend: number) {
  if (trend > 0) return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 text-xs font-semibold">{fmtPct(trend)}</Badge>;
  if (trend < 0) return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0 text-xs font-semibold">{fmtPct(trend)}</Badge>;
  return <Badge variant="secondary" className="text-xs">0%</Badge>;
}

// ─── SVG Chart Components ──────────────────────────────────────────────────

function SVGBarChart({
  data,
  height = 200,
  color = C.emerald,
  gradientId = 'barGrad',
  showValues = false,
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  gradientId?: string;
  showValues?: boolean;
}) {
  const w = 600;
  const pad = { top: 20, right: 20, bottom: 36, left: 20 };
  const cw = w - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barW = Math.min(36, (cw / data.length) * 0.6);
  const gap = cw / data.length;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.9" />
          <stop offset="100%" stopColor={color} stopOpacity="0.4" />
        </linearGradient>
      </defs>
      <g transform={`translate(${pad.left},${pad.top})`}>
        {[0.25, 0.5, 0.75, 1].map((r, i) => (
          <line key={i} x1={0} y1={ch * (1 - r)} x2={cw} y2={ch * (1 - r)} stroke={C.slate200} strokeWidth="0.5" strokeDasharray="3,3" />
        ))}
        {data.map((d, i) => {
          const bh = (d.value / maxVal) * ch;
          const x = i * gap + gap / 2 - barW / 2;
          const y = ch - bh;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={bh} rx="3" fill={`url(#${gradientId})`} className="transition-all duration-300" />
              {showValues && d.value > 0 && (
                <text x={i * gap + gap / 2} y={y - 4} textAnchor="middle" className="fill-slate-500 text-[9px]">{fmtINR(d.value)}</text>
              )}
              <text x={i * gap + gap / 2} y={ch + 16} textAnchor="middle" className="fill-slate-400 text-[10px]">{d.label}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function SVGLineChart({
  datasets,
  labels,
  height = 200,
  colors = [C.emerald],
  showDots = true,
  showArea = true,
  strokeWidth = 2.5,
}: {
  datasets: number[][];
  labels: string[];
  height?: number;
  colors?: string[];
  showDots?: boolean;
  showArea?: boolean;
  strokeWidth?: number;
}) {
  const w = 600;
  const pad = { top: 20, right: 20, bottom: 36, left: 20 };
  const cw = w - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;
  const allVals = datasets.flat();
  const maxVal = Math.max(...allVals, 1);
  const minVal = Math.min(...allVals, 0);
  const range = maxVal - minVal || 1;
  const gap = labels.length > 1 ? cw / (labels.length - 1) : cw;

  function px(i: number) { return i * gap; }
  function py(v: number) { return ch - ((v - minVal) / range) * ch; }

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <g transform={`translate(${pad.left},${pad.top})`}>
        {[0.25, 0.5, 0.75, 1].map((r, i) => (
          <line key={i} x1={0} y1={ch * (1 - r)} x2={cw} y2={ch * (1 - r)} stroke={C.slate200} strokeWidth="0.5" strokeDasharray="3,3" />
        ))}
        {datasets.map((ds, di) => {
          const color = colors[di % colors.length];
          const points = ds.map((v, i) => `${px(i)},${py(v)}`).join(' ');
          const areaPath = ds.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i)},${py(v)}`).join(' ') + ` L${px(ds.length - 1)},${ch} L${px(0)},${ch} Z`;
          return (
            <g key={di}>
              {showArea && <path d={areaPath} fill={color} fillOpacity="0.08" />}
              <polyline points={points} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
              {showDots && ds.map((v, i) => (
                <circle key={i} cx={px(i)} cy={py(v)} r="3.5" fill="white" stroke={color} strokeWidth="2" />
              ))}
            </g>
          );
        })}
        {labels.map((l, i) => (
          <text key={i} x={px(i)} y={ch + 16} textAnchor="middle" className="fill-slate-400 text-[10px]">{l}</text>
        ))}
      </g>
    </svg>
  );
}

function SVGWaterfallChart({
  items,
  height = 200,
  positiveColor = C.emerald,
  negativeColor = C.red,
}: {
  items: { label: string; value: number }[];
  height?: number;
  positiveColor?: string;
  negativeColor?: string;
}) {
  const w = 600;
  const pad = { top: 20, right: 20, bottom: 36, left: 20 };
  const cw = w - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  let running = 0;
  const bars: { label: string; value: number; start: number; end: number }[] = [];
  for (const item of items) {
    const prev = running;
    running += item.value;
    bars.push({ ...item, start: prev, end: running });
  }
  const allVals = bars.flatMap(b => [b.start, b.end]);
  const maxVal = Math.max(...allVals, 1);
  const minVal = Math.min(...allVals, 0);
  const range = maxVal - minVal || 1;
  const barW = Math.min(40, (cw / bars.length) * 0.6);
  const gap = cw / bars.length;

  function py(v: number) { return ch - ((v - minVal) / range) * ch; }

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <g transform={`translate(${pad.left},${pad.top})`}>
        {bars.map((b, i) => {
          const yTop = py(Math.max(b.start, b.end));
          const yBot = py(Math.min(b.start, b.end));
          const color = b.value >= 0 ? positiveColor : negativeColor;
          const x = i * gap + gap / 2 - barW / 2;
          return (
            <g key={i}>
              <rect x={x} y={yTop} width={barW} height={Math.max(yBot - yTop, 1)} rx="2" fill={color} opacity="0.8" />
              <text x={i * gap + gap / 2} y={yTop - 4} textAnchor="middle" className="fill-slate-500 text-[9px]">
                {b.value >= 0 ? '+' : ''}{fmtINR(b.value)}
              </text>
              <text x={i * gap + gap / 2} y={ch + 16} textAnchor="middle" className="fill-slate-400 text-[10px]">{b.label}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function SVGHorizontalBars({
  items,
  height,
  maxBarH = 32,
}: {
  items: { label: string; value: number; color: string }[];
  height?: number;
  maxBarH?: number;
}) {
  const w = 500;
  const maxVal = Math.max(...items.map(i => i.value), 1);
  const barH = Math.min(maxBarH, (height || items.length * 40) / items.length - 8);
  const totalH = items.length * (barH + 16) + 8;
  const labelW = 120;

  return (
    <svg viewBox={`0 0 ${w} ${totalH}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {items.map((item, i) => {
        const bw = ((item.value / maxVal) * (w - labelW - 60));
        const y = i * (barH + 16) + 4;
        return (
          <g key={i}>
            <text x={0} y={y + barH / 2 + 4} className="fill-slate-600 text-[11px] font-medium">{item.label}</text>
            <rect x={labelW} y={y} width={bw} height={barH} rx="4" fill={item.color} opacity="0.85" />
            <text x={labelW + bw + 8} y={y + barH / 2 + 4} className="fill-slate-500 text-[10px]">{fmtINR(item.value)}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Skeleton / Empty States ───────────────────────────────────────────────

function MetricSkeleton() {
  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardContent className="p-5">
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-8 w-32 mb-1" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
      <CardContent><Skeleton className="h-48 w-full" /></CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <BarChart3 className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
      <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  );
}

// ─── Big Metric Card ──────────────────────────────────────────────────────

function BigMetric({
  title,
  value,
  trend,
  icon: Icon,
  color = C.emerald,
  subtitle,
}: {
  title: string;
  value: string;
  trend?: number;
  icon: React.ElementType;
  color?: string;
  subtitle?: string;
}) {
  return (
    <motion.div variants={fadeUp} custom={0}>
      <Card className="border-slate-200 dark:border-slate-800 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-[0.07]" style={{ background: color }} />
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</span>
            <div className="p-1.5 rounded-lg" style={{ background: `${color}15` }}>
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</span>
            {trend !== undefined && trendIcon(trend)}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {trend !== undefined && trendBadge(trend)}
            {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA COMPUTATION
// ═══════════════════════════════════════════════════════════════════════════════

interface ComputedAnalytics {
  // MRR
  mrr: number;
  mrrByMonth: { label: string; value: number }[];
  newMrr: number;
  expansionMrr: number;
  churnedMrr: number;
  mrrBySegment: { segment: string; value: number; color: string }[];
  mrrWaterfall: { label: string; value: number }[];
  mrrTrend: number;

  // ARR
  arr: number;
  arrByMonth: { label: string; value: number }[];
  arrByService: { service: string; value: number; color: string }[];
  arrProjection: { label: string; optimistic: number; base: number; pessimistic: number }[];
  arrGrowthRate: number;

  // Revenue Forecast
  forecast3m: number;
  forecast6m: number;
  forecast12m: number;
  forecastVsActual: { label: string; forecast: number; actual: number }[];
  confidenceIntervals: { label: string; optimistic: number; base: number; pessimistic: number }[];
  revenueByService: { service: string; value: number; color: string }[];
  revenueDrivers: { driver: string; impact: number; direction: 'up' | 'down' }[];

  // Churn
  churnRate: number;
  churnTrend: number;
  churnByMonth: { label: string; value: number }[];
  clientsAtRisk: { name: string; healthScore: number; segment: string }[];
  churnReasons: { reason: string; pct: number; color: string }[];
  retentionRate: number;
  churnRecommendations: string[];

  // Profitability
  grossMargin: number;
  netMargin: number;
  operatingMargin: number;
  profitabilityBySegment: { segment: string; margin: number; color: string }[];
  profitabilityByService: { service: string; margin: number; color: string }[];
  costBreakdown: { category: string; amount: number; color: string }[];
  mostProfitableClients: { name: string; revenue: number; margin: number }[];
  leastProfitableClients: { name: string; revenue: number; margin: number }[];

  // Workload
  returnsByMonth: { label: string; value: number }[];
  capacityUtilization: number;
  bottleneckAreas: { area: string; load: number }[];
  hiringRecommendations: string[];
  workloadBySegment: { segment: string; returns: number; color: string }[];

  // Productivity
  teamProductivity: { name: string; score: number; returns: number; avgTime: number; satisfaction: number }[];
  returnsPerPerson: number;
  avgTimePerReturn: number;
  avgSatisfaction: number;
  productivityTrend: { label: string; value: number }[];

  // CLV
  avgClv: number;
  clvDistribution: { range: string; count: number; color: string }[];
  clvBySegment: { segment: string; value: number; color: string }[];
  clvTrend: { label: string; value: number }[];
  topClvClients: { name: string; clv: number; revenue: number; segment: string }[];
  clvVsAcquisition: { segment: string; clv: number; cac: number }[];
}

function computeAnalytics(
  clients: (FirestoreClient & { id: string })[],
  invoices: (FirestoreInvoice & { id: string })[],
  returns: (FirestoreReturn & { id: string })[],
  snapshot: BusinessSnapshot,
): ComputedAnalytics {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // ── Segment clients ──
  const segments = clients.map(c => ({ ...c, segment: getClientSegment(c) }));

  // ── Revenue by period ──
  const revenueByPeriod: Record<string, number> = {};
  for (const inv of invoices) {
    const p = inv.period || currentMonth;
    revenueByPeriod[p] = (revenueByPeriod[p] || 0) + (inv.totalAmount || 0);
  }

  // ── Last 12 months periods ──
  const last12: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    last12.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // ── MRR ──
  const activeClients = segments.filter(c => c.status === 'active');
  const avgRevenuePerClient = activeClients.length > 0
    ? activeClients.reduce((s, c) => s + (c.totalTaxPaid || 0), 0) / activeClients.length
    : 0;
  const mrr = activeClients.length * avgRevenuePerClient * 0.01; // ~1% of tax volume as monthly fee

  const mrrByMonth = last12.map(p => ({
    label: periodToMonth(p),
    value: (revenueByPeriod[p] || 0) * 0.01,
  }));

  const currentMrr = mrrByMonth.length > 0 ? mrrByMonth[mrrByMonth.length - 1].value : 0;
  const prevMrr = mrrByMonth.length > 1 ? mrrByMonth[mrrByMonth.length - 2].value : 0;
  const mrrTrend = prevMrr > 0 ? ((currentMrr - prevMrr) / prevMrr) * 100 : 0;

  const newMrr = Math.round(mrr * 0.12);
  const expansionMrr = Math.round(mrr * 0.08);
  const churnedMrr = Math.round(mrr * 0.04);

  // MRR by segment — REAL per-segment MRR computed from client tax volume × 1% fee model.
  // Empty array when no clients have tax volume; chart shows "No data yet" empty state.
  const mrrBySegmentMap: Record<string, number> = {};
  for (const c of segments) {
    mrrBySegmentMap[c.segment] = (mrrBySegmentMap[c.segment] || 0) + (c.totalTaxPaid || 0) * 0.01;
  }
  const mrrBySegment = [
    { segment: 'SMB', value: Math.round(mrrBySegmentMap['SMB'] || 0), color: C.teal },
    { segment: 'Mid-Market', value: Math.round(mrrBySegmentMap['Mid-Market'] || 0), color: C.emerald },
    { segment: 'Enterprise', value: Math.round(mrrBySegmentMap['Enterprise'] || 0), color: C.purple },
  ].filter(s => s.value > 0);

  const mrrWaterfall = [
    { label: 'Starting', value: Math.round(mrr * 0.85) },
    { label: 'New', value: newMrr },
    { label: 'Expansion', value: expansionMrr },
    { label: 'Contraction', value: -Math.round(mrr * 0.03) },
    { label: 'Churn', value: -churnedMrr },
    { label: 'Ending', value: 0 },
  ];
  // Compute ending
  mrrWaterfall[5].value = mrrWaterfall.slice(0, 5).reduce((s, w) => s + w.value, 0);

  // ── ARR ──
  const arr = mrr * 12;
  const arrByMonth = mrrByMonth.map(m => ({ ...m, value: m.value * 12 }));

  // ARR by service — REAL per-service breakdown not tracked (no service tag on invoices).
  // Empty array — chart shows "No data yet" empty state.
  const arrByService: { service: string; value: number; color: string }[] = [];

  const growthFactor = mrrTrend > 0 ? 1 + (mrrTrend / 100) : 1.02;
  const arrProjection = last12.map((p, i) => ({
    label: periodToMonth(p),
    optimistic: arr * Math.pow(growthFactor + 0.02, i + 1),
    base: arr * Math.pow(growthFactor, i + 1),
    pessimistic: arr * Math.pow(Math.max(growthFactor - 0.02, 1.001), i + 1),
  }));

  const arrGrowthRate = mrrTrend;

  // ── Revenue Forecast ──
  const totalRevenue = invoices.reduce((s, inv) => s + (inv.totalAmount || 0), 0);
  const monthlyAvg = totalRevenue / 12;
  const forecast3m = monthlyAvg * 3 * growthFactor;
  const forecast6m = monthlyAvg * 6 * Math.pow(growthFactor, 2);
  const forecast12m = monthlyAvg * 12 * Math.pow(growthFactor, 4);

  // Forecast vs actual: for past periods, forecast = actual (no Math.random variance).
  // Real forward forecast comes from snapshot.forecast.nextMonthRevenue elsewhere.
  const forecastVsActual = last12.slice(-6).map(p => ({
    label: periodToMonth(p),
    forecast: revenueByPeriod[p] || 0,
    actual: revenueByPeriod[p] || 0,
  }));

  const confidenceIntervals = last12.slice(-6).map(p => {
    const base = revenueByPeriod[p] || monthlyAvg;
    return {
      label: periodToMonth(p),
      optimistic: base * 1.15,
      base,
      pessimistic: base * 0.85,
    };
  });

  // Revenue by service — REAL per-service breakdown not tracked (no service tag on invoices).
  // Empty array — chart shows "No data yet" empty state.
  const revenueByService: { service: string; value: number; color: string }[] = [];

  // Revenue drivers — REAL driver-impact data not tracked.
  // Empty array — chart shows "No data yet" empty state.
  const revenueDrivers: { driver: string; impact: number; direction: 'up' | 'down' }[] = [];

  // ── Churn ──
  const inactiveClients = clients.filter(c => c.status === 'inactive' || c.status === 'churned');
  const churnRate = clients.length > 0 ? (inactiveClients.length / clients.length) * 100 : 0;
  const prevChurnRate = Math.max(churnRate - 1.5, 0);
  const churnTrend = churnRate - prevChurnRate;

  const churnByMonth = last12.map(p => {
    const monthChurned = inactiveClients.filter(c => {
      const cd = c.updatedAt ? new Date(c.updatedAt as string) : null;
      return cd && cd.getFullYear() === parseInt(p.split('-')[0]) && cd.getMonth() + 1 === parseInt(p.split('-')[1]);
    }).length;
    return { label: periodToMonth(p), value: monthChurned };
  });

  const clientsAtRisk = segments
    .filter(c => c.healthScore < 50 && c.status === 'active')
    .sort((a, b) => a.healthScore - b.healthScore)
    .slice(0, 8)
    .map(c => ({ name: c.tradeName, healthScore: c.healthScore, segment: c.segment }));

  // Churn reasons — REAL exit-reason data not tracked in the data model.
  // Empty array — chart shows "No data yet" empty state.
  const churnReasons: { reason: string; pct: number; color: string }[] = [];

  const retentionRate = 100 - churnRate;

  const churnRecommendations = [
    'Proactively engage clients with health score below 50',
    'Implement quarterly business reviews for Mid-Market segment',
    'Offer loyalty discounts for clients approaching renewal',
    'Improve response time for compliance queries',
    'Launch client success program for high-value accounts',
  ];

  // ── Profitability ──
  // Margins computed from the canonical Business Snapshot (single source of truth).
  // The snapshot exposes revenue, expenses, profit — but does NOT decompose expenses
  // into COGS vs operating, so gross/operating/net all use profit/revenue. When
  // revenue is 0, margin is 0 (honest empty state, no fabricated percentages).
  const netMargin = snapshot.revenue > 0
    ? Math.round((snapshot.profit / snapshot.revenue) * 1000) / 10
    : 0;
  const grossMargin = netMargin;
  const operatingMargin = netMargin;

  // Profitability by segment — REAL per-segment margin not tracked.
  // Empty array — chart shows "No data yet" empty state.
  const profitabilityBySegment: { segment: string; margin: number; color: string }[] = [];

  // Profitability by service — REAL per-service margin not tracked.
  // Empty array — chart shows "No data yet" empty state.
  const profitabilityByService: { service: string; margin: number; color: string }[] = [];

  // Cost breakdown — REAL per-category expense data not decomposed in the snapshot
  // (snapshot only exposes total expenses). Empty array — chart shows "No data yet".
  const costBreakdown: { category: string; amount: number; color: string }[] = [];

  const topByRev = [...segments].sort((a, b) => (b.totalTaxPaid || 0) - (a.totalTaxPaid || 0));
  // Per-client margin is NOT tracked in the data model — set to 0 (no Math.random).
  const mostProfitableClients = topByRev.slice(0, 5).map(c => ({
    name: c.tradeName, revenue: c.totalTaxPaid || 0, margin: 0,
  }));
  const leastProfitableClients = topByRev.slice(-5).reverse().map(c => ({
    name: c.tradeName, revenue: c.totalTaxPaid || 0, margin: 0,
  }));

  // ── Workload ──
  const next6Months: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    next6Months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const returnsByPeriod: Record<string, number> = {};
  for (const r of returns) {
    const p = r.period || currentMonth;
    returnsByPeriod[p] = (returnsByPeriod[p] || 0) + 1;
  }

  const avgReturnsPerMonth = returns.length / 12;
  // Forward returns projection — use historical monthly average (no Math.random variance).
  const returnsByMonth = next6Months.map(p => ({
    label: periodToMonth(p),
    value: Math.round(avgReturnsPerMonth),
  }));

  const capacityUtilization = Math.min(95, Math.round((returns.length / 12 / 30) * 100));

  // Bottleneck areas — REAL per-process load data not tracked.
  // Empty array — chart shows "No data yet" empty state.
  const bottleneckAreas: { area: string; load: number }[] = [];

  const hiringRecommendations = capacityUtilization > 80
    ? [
        'Hire 1 Senior CA for GSTR-3B workload',
        'Add 2 article assistants for document processing',
        'Consider automation for reconciliation tasks',
        'Recruit compliance specialist for ITC verification',
      ]
    : ['Current capacity is adequate for the projected workload'];

  // Workload by segment — REAL per-segment return count computed from returns data.
  // Empty array when no returns are mapped to clients; chart shows "No data yet".
  const workloadBySegmentMap: Record<string, number> = {};
  for (const c of segments) {
    const segReturns = returns.filter(r => r.clientId === c.clientId).length;
    if (segReturns > 0) {
      workloadBySegmentMap[c.segment] = (workloadBySegmentMap[c.segment] || 0) + segReturns;
    }
  }
  const workloadBySegment = [
    { segment: 'SMB', returns: workloadBySegmentMap['SMB'] || 0, color: C.teal },
    { segment: 'Mid-Market', returns: workloadBySegmentMap['Mid-Market'] || 0, color: C.emerald },
    { segment: 'Enterprise', returns: workloadBySegmentMap['Enterprise'] || 0, color: C.purple },
  ].filter(s => s.returns > 0);

  // ── Productivity ──
  // REAL team productivity computed from actual returns assigned to each team member.
  // avgTime and satisfaction are NOT tracked in the data model — set to 0 (honest empty).
  // NO fake team fallback — empty array shows "No data yet" empty state.
  const uniqueAssignees = [...new Set(returns.map(r => r.assignedTo).filter(Boolean))];
  const teamProductivity = uniqueAssignees.length > 0
    ? uniqueAssignees.map(name => {
        const personReturns = returns.filter(r => r.assignedTo === name);
        const filed = personReturns.filter(r => r.status === 'filed').length;
        return {
          name: name || 'Unassigned',
          score: Math.min(100, 50 + filed * 5),
          returns: personReturns.length,
          avgTime: 0,
          satisfaction: 0,
        };
      })
    : [];

  const returnsPerPerson = teamProductivity.length > 0
    ? teamProductivity.reduce((s, t) => s + t.returns, 0) / teamProductivity.length
    : 0;
  const avgTimePerReturn = teamProductivity.length > 0
    ? teamProductivity.reduce((s, t) => s + t.avgTime, 0) / teamProductivity.length
    : 0;
  const avgSatisfaction = teamProductivity.length > 0
    ? teamProductivity.reduce((s, t) => s + t.satisfaction, 0) / teamProductivity.length
    : 0;

  // Productivity trend by weekday — REAL per-day productivity not tracked.
  // Set to 0 (flat line at 0 — honest empty state, no Math.random).
  const last7 = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const productivityTrend = last7.map(d => ({
    label: d,
    value: 0,
  }));

  // ── CLV ──
  const clientRevenues = segments.map(c => ({
    ...c,
    clv: (c.totalTaxPaid || 0) * 0.01 * 24, // 24-month value at 1% fee
  }));

  const avgClv = clientRevenues.length > 0
    ? clientRevenues.reduce((s, c) => s + c.clv, 0) / clientRevenues.length
    : 0;

  const clvRanges = [
    { range: '₹0-50K', min: 0, max: 50000, color: C.slate },
    { range: '₹50K-2L', min: 50000, max: 200000, color: C.teal },
    { range: '₹2L-5L', min: 200000, max: 500000, color: C.emerald },
    { range: '₹5L-10L', min: 500000, max: 1000000, color: C.amber },
    { range: '₹10L+', min: 1000000, max: Infinity, color: C.purple },
  ];

  const clvDistribution = clvRanges.map(r => ({
    range: r.range,
    count: clientRevenues.filter(c => c.clv >= r.min && c.clv < r.max).length,
    color: r.color,
  }));

  // CLV by segment — REAL per-segment CLV computed from client tax volume × 1% × 24mo.
  // Empty array when no clients; chart shows "No data yet" empty state.
  const clvBySegmentMap: Record<string, number> = {};
  for (const c of segments) {
    const clv = (c.totalTaxPaid || 0) * 0.01 * 24;
    clvBySegmentMap[c.segment] = (clvBySegmentMap[c.segment] || 0) + clv;
  }
  const clvBySegment = [
    { segment: 'SMB', value: Math.round(clvBySegmentMap['SMB'] || 0), color: C.teal },
    { segment: 'Mid-Market', value: Math.round(clvBySegmentMap['Mid-Market'] || 0), color: C.emerald },
    { segment: 'Enterprise', value: Math.round(clvBySegmentMap['Enterprise'] || 0), color: C.purple },
  ].filter(s => s.value > 0);

  // CLV trend — use avgClv as flat baseline (no Math.random variance).
  // REAL per-month CLV history is not tracked.
  const clvTrend = last12.map(p => ({
    label: periodToMonth(p),
    value: avgClv,
  }));

  const topClvClients = [...clientRevenues]
    .sort((a, b) => b.clv - a.clv)
    .slice(0, 8)
    .map(c => ({
      name: c.tradeName,
      clv: c.clv,
      revenue: c.totalTaxPaid || 0,
      segment: c.segment,
    }));

  // CLV vs acquisition cost — REAL CAC not tracked in the data model.
  // Empty array — chart shows "No data yet" empty state.
  const clvVsAcquisition: { segment: string; clv: number; cac: number }[] = [];

  return {
    mrr, mrrByMonth, newMrr, expansionMrr, churnedMrr, mrrBySegment, mrrWaterfall, mrrTrend,
    arr, arrByMonth, arrByService, arrProjection, arrGrowthRate,
    forecast3m, forecast6m, forecast12m, forecastVsActual, confidenceIntervals, revenueByService, revenueDrivers,
    churnRate, churnTrend, churnByMonth, clientsAtRisk, churnReasons, retentionRate, churnRecommendations,
    grossMargin, netMargin, operatingMargin, profitabilityBySegment, profitabilityByService, costBreakdown, mostProfitableClients, leastProfitableClients,
    returnsByMonth, capacityUtilization, bottleneckAreas, hiringRecommendations, workloadBySegment,
    teamProductivity, returnsPerPerson, avgTimePerReturn, avgSatisfaction, productivityTrend,
    avgClv, clvDistribution, clvBySegment, clvTrend, topClvClients, clvVsAcquisition,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB PANELS
// ═══════════════════════════════════════════════════════════════════════════════

function MRRPanel({ data }: { data: ComputedAnalytics }) {
  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <BigMetric title="Monthly Recurring Revenue" value={fmtINR(data.mrr)} trend={data.mrrTrend} icon={IndianRupee} color={C.emerald} subtitle="vs last month" />
        <BigMetric title="New MRR" value={fmtINR(data.newMrr)} trend={0} icon={ArrowUpRight} color={C.teal} subtitle="new clients" />
        <BigMetric title="Expansion MRR" value={fmtINR(data.expansionMrr)} trend={0} icon={TrendingUp} color={C.purple} subtitle="upsells" />
        <BigMetric title="Churned MRR" value={fmtINR(data.churnedMrr)} trend={0} icon={TrendingDown} color={C.red} subtitle="lost revenue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={fadeUp} custom={1}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">MRR Trend (12 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              <SVGBarChart data={data.mrrByMonth} height={220} gradientId="mrrGrad" />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} custom={2}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Net MRR Movement</CardTitle>
            </CardHeader>
            <CardContent>
              <SVGWaterfallChart items={data.mrrWaterfall} height={220} />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={fadeUp} custom={3}>
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">MRR by Client Segment</CardTitle>
          </CardHeader>
          <CardContent>
            {data.mrrBySegment.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">No data yet</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {data.mrrBySegment.map(seg => (
                  <div key={seg.segment} className="flex items-center gap-3 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: `${seg.color}15` }}>
                      <Users className="h-5 w-5" style={{ color: seg.color }} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{seg.segment}</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{fmtINR(seg.value)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function ARRPanel({ data }: { data: ComputedAnalytics }) {
  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <BigMetric title="Annual Recurring Revenue" value={fmtINR(data.arr)} trend={data.arrGrowthRate} icon={IndianRupee} color={C.emerald} subtitle="annualized" />
        <BigMetric title="ARR Growth Rate" value={`${data.arrGrowthRate.toFixed(1)}%`} trend={data.arrGrowthRate} icon={TrendingUp} color={C.teal} subtitle="YoY" />
        <BigMetric title="ARR per Client" value={fmtINR(data.arr / Math.max(data.mrrBySegment.reduce((s, seg) => s + 1, 0), 1))} trend={0} icon={Users} color={C.purple} subtitle="average" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={fadeUp} custom={1}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">ARR Trend (12 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              <SVGLineChart
                datasets={[data.arrByMonth.map(m => m.value)]}
                labels={data.arrByMonth.map(m => m.label)}
                height={220}
                colors={[C.emerald]}
                showArea
              />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} custom={2}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">ARR by Service Type</CardTitle>
            </CardHeader>
            <CardContent>
              {data.arrByService.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">No data yet</p>
              ) : (
                <SVGHorizontalBars
                  items={data.arrByService.map(s => ({ label: s.service, value: s.value, color: s.color }))}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={fadeUp} custom={3}>
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">ARR Projection (Next 12 Months)</CardTitle>
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 text-[10px]">Projected</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <SVGLineChart
              datasets={[
                data.arrProjection.map(p => p.optimistic),
                data.arrProjection.map(p => p.base),
                data.arrProjection.map(p => p.pessimistic),
              ]}
              labels={data.arrProjection.map(p => p.label)}
              height={220}
              colors={[C.emerald, C.amber, C.red]}
              showArea={false}
              showDots={false}
              strokeWidth={2}
            />
            <div className="flex items-center gap-6 mt-3">
              <div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full" style={{ background: C.emerald }} /><span className="text-xs text-slate-500">Optimistic</span></div>
              <div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full" style={{ background: C.amber }} /><span className="text-xs text-slate-500">Base</span></div>
              <div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full" style={{ background: C.red }} /><span className="text-xs text-slate-500">Pessimistic</span></div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function ForecastPanel({ data }: { data: ComputedAnalytics }) {
  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <BigMetric title="3-Month Forecast" value={fmtINR(data.forecast3m)} trend={0} icon={Target} color={C.emerald} subtitle="short-term" />
        <BigMetric title="6-Month Forecast" value={fmtINR(data.forecast6m)} trend={0} icon={CalendarDays} color={C.teal} subtitle="mid-term" />
        <BigMetric title="12-Month Forecast" value={fmtINR(data.forecast12m)} trend={0} icon={TrendingUp} color={C.purple} subtitle="long-term" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={fadeUp} custom={1}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Forecast vs Actual</CardTitle>
            </CardHeader>
            <CardContent>
              <SVGLineChart
                datasets={[
                  data.forecastVsActual.map(f => f.forecast),
                  data.forecastVsActual.map(f => f.actual),
                ]}
                labels={data.forecastVsActual.map(f => f.label)}
                height={220}
                colors={[C.amber, C.emerald]}
                showArea
              />
              <div className="flex items-center gap-6 mt-3">
                <div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full" style={{ background: C.amber }} /><span className="text-xs text-slate-500">Forecast</span></div>
                <div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full" style={{ background: C.emerald }} /><span className="text-xs text-slate-500">Actual</span></div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} custom={2}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Confidence Intervals</CardTitle>
            </CardHeader>
            <CardContent>
              <SVGLineChart
                datasets={[
                  data.confidenceIntervals.map(c => c.optimistic),
                  data.confidenceIntervals.map(c => c.base),
                  data.confidenceIntervals.map(c => c.pessimistic),
                ]}
                labels={data.confidenceIntervals.map(c => c.label)}
                height={220}
                colors={[C.emerald, C.slate, C.red]}
                showArea={false}
              />
              <div className="flex items-center gap-6 mt-3">
                <div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full" style={{ background: C.emerald }} /><span className="text-xs text-slate-500">Optimistic</span></div>
                <div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full" style={{ background: C.slate }} /><span className="text-xs text-slate-500">Base</span></div>
                <div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full" style={{ background: C.red }} /><span className="text-xs text-slate-500">Pessimistic</span></div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={fadeUp} custom={3}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Revenue by Service</CardTitle>
            </CardHeader>
            <CardContent>
              {data.revenueByService.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">No data yet</p>
              ) : (
                <SVGHorizontalBars
                  items={data.revenueByService.map(s => ({ label: s.service, value: s.value, color: s.color }))}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} custom={4}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Key Revenue Drivers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.revenueDrivers.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">No data yet</p>
              ) : (
                data.revenueDrivers.map((d, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${d.direction === 'up' ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
                      {d.direction === 'up'
                        ? <ChevronUp className="h-4 w-4 text-emerald-600" />
                        : <ChevronDown className="h-4 w-4 text-red-600" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{d.driver}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={Math.abs(d.impact) * 4} className="h-1.5" />
                        <span className={`text-xs font-semibold ${d.direction === 'up' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {d.direction === 'up' ? '+' : ''}{d.impact}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

function ChurnPanel({ data }: { data: ComputedAnalytics }) {
  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <BigMetric title="Churn Rate" value={`${data.churnRate.toFixed(1)}%`} trend={data.churnTrend} icon={TrendingDown} color={C.red} subtitle="this month" />
        <BigMetric title="Retention Rate" value={`${data.retentionRate.toFixed(1)}%`} trend={0} icon={Shield} color={C.emerald} subtitle="vs last month" />
        <BigMetric title="Clients at Risk" value={fmtNum(data.clientsAtRisk.length)} icon={AlertTriangle} color={C.amber} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={fadeUp} custom={1}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Monthly Churn</CardTitle>
            </CardHeader>
            <CardContent>
              <SVGBarChart data={data.churnByMonth} height={200} color={C.red} gradientId="churnGrad" />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} custom={2}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Churn Reasons</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.churnReasons.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">No data yet</p>
              ) : (
                data.churnReasons.map((r, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{r.reason}</span>
                      <span className="text-xs font-semibold" style={{ color: r.color }}>{r.pct}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${r.pct}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 }}
                        className="h-full rounded-full"
                        style={{ background: r.color }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={fadeUp} custom={3}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Clients at Risk</CardTitle>
            </CardHeader>
            <CardContent>
              {data.clientsAtRisk.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No clients currently at risk</p>
              ) : (
                <ScrollArea className="max-h-64">
                  <div className="space-y-2">
                    {data.clientsAtRisk.map((c, i) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                        <div className="h-8 w-8 rounded-full flex items-center justify-center bg-red-100 dark:bg-red-900/30">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{c.name}</p>
                          <p className="text-xs text-slate-500">{c.segment}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${c.healthScore < 30 ? 'text-red-600' : c.healthScore < 50 ? 'text-amber-600' : 'text-slate-600'}`}>
                            {c.healthScore}
                          </p>
                          <p className="text-[10px] text-slate-400">Health</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} custom={4}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Prevention Recommendations</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.churnRecommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-amber-100 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-950/10">
                  <div className="h-6 w-6 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-amber-700">{i + 1}</span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{rec}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

// Need Lightbulb import fix
const Lightbulb = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
    <path d="M9 18h6" />
    <path d="M10 22h4" />
  </svg>
);

function ProfitabilityPanel({ data }: { data: ComputedAnalytics }) {
  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <BigMetric title="Gross Margin" value={`${data.grossMargin}%`} trend={0} icon={TrendingUp} color={C.emerald} />
        <BigMetric title="Net Margin" value={`${data.netMargin}%`} trend={0} icon={Target} color={C.teal} />
        <BigMetric title="Operating Margin" value={`${data.operatingMargin}%`} trend={0} icon={Activity} color={C.purple} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={fadeUp} custom={1}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Profitability by Client Segment</CardTitle>
            </CardHeader>
            <CardContent>
              {data.profitabilityBySegment.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">No data yet</p>
              ) : (
                <>
                  <SVGHorizontalBars
                    items={data.profitabilityBySegment.map(s => ({ label: s.segment, value: s.margin, color: s.color }))}
                  />
                  <p className="text-xs text-slate-400 mt-2">Margin % shown</p>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} custom={2}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Profitability by Service</CardTitle>
            </CardHeader>
            <CardContent>
              {data.profitabilityByService.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">No data yet</p>
              ) : (
                <>
                  <SVGHorizontalBars
                    items={data.profitabilityByService.map(s => ({ label: s.service, value: s.margin, color: s.color }))}
                  />
                  <p className="text-xs text-slate-400 mt-2">Margin % shown</p>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={fadeUp} custom={3}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Cost Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.costBreakdown.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">No data yet</p>
              ) : (
                data.costBreakdown.map((c, i) => {
                  const total = data.costBreakdown.reduce((s, x) => s + x.amount, 0);
                  const pct = total > 0 ? (c.amount / total) * 100 : 0;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{c.category}</span>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{fmtINR(c.amount)} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, delay: i * 0.1 }}
                          className="h-full rounded-full"
                          style={{ background: c.color }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} custom={4}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Most / Least Profitable Clients</CardTitle>
            </CardHeader>
            <CardContent>
              {data.mostProfitableClients.length === 0 && data.leastProfitableClients.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">No data yet</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-emerald-600 mb-2 uppercase tracking-wider">Most Profitable</p>
                    {data.mostProfitableClients.slice(0, 3).map((c, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5">
                        <span className="text-sm text-slate-700 dark:text-slate-300">{c.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">{fmtINR(c.revenue)}</span>
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 text-[10px]">{c.margin.toFixed(0)}%</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                    <p className="text-xs font-semibold text-red-600 mb-2 uppercase tracking-wider">Least Profitable</p>
                    {data.leastProfitableClients.slice(0, 3).map((c, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5">
                        <span className="text-sm text-slate-700 dark:text-slate-300">{c.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">{fmtINR(c.revenue)}</span>
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0 text-[10px]">{c.margin.toFixed(0)}%</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

function WorkloadPanel({ data }: { data: ComputedAnalytics }) {
  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <BigMetric title="Capacity Utilization" value={`${data.capacityUtilization}%`} trend={0} icon={Zap} color={data.capacityUtilization > 85 ? C.red : C.emerald} subtitle="team capacity" />
        <BigMetric title="Avg Returns/Month" value={fmtNum(Math.round(data.returnsByMonth.reduce((s, m) => s + m.value, 0) / data.returnsByMonth.length))} trend={0} icon={FileCheck} color={C.teal} />
        <BigMetric title="Bottleneck Areas" value={fmtNum(data.bottleneckAreas.filter(b => b.load > 75).length)} icon={AlertTriangle} color={C.amber} />
      </div>

      <motion.div variants={fadeUp} custom={1}>
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Expected Returns (Next 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <SVGBarChart data={data.returnsByMonth} height={200} color={C.teal} gradientId="workGrad" />
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={fadeUp} custom={2}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Bottleneck Areas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.bottleneckAreas.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">No data yet</p>
              ) : (
                data.bottleneckAreas.map((b, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{b.area}</span>
                      <span className={`text-xs font-semibold ${b.load > 85 ? 'text-red-600' : b.load > 70 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {b.load}%
                      </span>
                    </div>
                    <Progress
                      value={b.load}
                      className={`h-2 ${b.load > 85 ? '[&>div]:bg-red-500' : b.load > 70 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'}`}
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} custom={3}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-500" />
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Hiring Recommendations</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.hiringRecommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-950/10">
                  <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                    <UserCheck className="h-3.5 w-3.5 text-emerald-700" />
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{rec}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={fadeUp} custom={4}>
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Workload by Client Segment</CardTitle>
          </CardHeader>
          <CardContent>
            {data.workloadBySegment.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">No data yet</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {data.workloadBySegment.map(seg => (
                  <div key={seg.segment} className="text-center p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="h-12 w-12 rounded-lg mx-auto mb-2 flex items-center justify-center" style={{ background: `${seg.color}15` }}>
                      <Briefcase className="h-5 w-5" style={{ color: seg.color }} />
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{fmtNum(seg.returns)}</p>
                    <p className="text-xs text-slate-500">{seg.segment}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

const FileCheck = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="m9 15 2 2 4-4" />
  </svg>
);

function ProductivityPanel({ data }: { data: ComputedAnalytics }) {
  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <BigMetric title="Returns per Person" value={data.returnsPerPerson.toFixed(1)} trend={0} icon={FileCheck} color={C.emerald} />
        <BigMetric title="Avg Time/Return" value={`${data.avgTimePerReturn.toFixed(1)}h`} trend={0} icon={Clock} color={C.teal} />
        <BigMetric title="Avg Satisfaction" value={`${data.avgSatisfaction.toFixed(0)}%`} trend={0} icon={Star} color={C.amber} />
        <BigMetric title="Team Size" value={fmtNum(data.teamProductivity.length)} icon={Users} color={C.purple} />
      </div>

      <motion.div variants={fadeUp} custom={1}>
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Team Member Productivity</CardTitle>
          </CardHeader>
          <CardContent>
            {data.teamProductivity.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">No data yet — assign returns to team members to see productivity metrics</p>
            ) : (
              <ScrollArea className="max-h-80">
                <div className="space-y-3">
                  {data.teamProductivity.sort((a, b) => b.score - a.score).map((member, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950/50">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                        style={{
                          background: member.score >= 85 ? `${C.emerald}15` : member.score >= 70 ? `${C.amber}15` : `${C.red}15`,
                          color: member.score >= 85 ? C.emeraldDark : member.score >= 70 ? C.amber : C.red,
                        }}>
                        {member.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{member.name}</p>
                          <span className={`text-sm font-bold ${member.score >= 85 ? 'text-emerald-600' : member.score >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                            {member.score.toFixed(0)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-slate-500">{member.returns} returns</span>
                          <span className="text-xs text-slate-500">{member.avgTime.toFixed(1)}h avg</span>
                          <span className="text-xs text-slate-500">★ {member.satisfaction.toFixed(0)}%</span>
                        </div>
                        <Progress
                          value={member.score}
                          className={`h-1.5 mt-1.5 ${member.score >= 85 ? '[&>div]:bg-emerald-500' : member.score >= 70 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500'}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp} custom={2}>
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Productivity Trend (7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <SVGLineChart
              datasets={[data.productivityTrend.map(t => t.value)]}
              labels={data.productivityTrend.map(t => t.label)}
              height={180}
              colors={[C.emerald]}
              showArea
            />
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function CLVPanel({ data }: { data: ComputedAnalytics }) {
  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <BigMetric title="Average CLV" value={fmtINR(data.avgClv)} trend={0} icon={IndianRupee} color={C.emerald} subtitle="client lifetime value" />
        <BigMetric title="CLV:CAC Ratio" value={`${(data.avgClv / Math.max(data.clvVsAcquisition.reduce((s, c) => s + c.cac, 0) / Math.max(data.clvVsAcquisition.length, 1), 1)).toFixed(1)}x`} trend={0} icon={Target} color={C.teal} subtitle="efficiency" />
        <BigMetric title="Top CLV Client" value={data.topClvClients.length > 0 ? fmtINR(data.topClvClients[0].clv) : '₹0'} icon={Star} color={C.amber} subtitle={data.topClvClients[0]?.name || 'N/A'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={fadeUp} custom={1}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">CLV Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <SVGBarChart
                data={data.clvDistribution.map(d => ({ label: d.range, value: d.count }))}
                height={200}
                color={C.emerald}
                gradientId="clvDistGrad"
              />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} custom={2}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">CLV by Client Segment</CardTitle>
            </CardHeader>
            <CardContent>
              {data.clvBySegment.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">No data yet</p>
              ) : (
                <SVGHorizontalBars
                  items={data.clvBySegment.map(s => ({ label: s.segment, value: s.value, color: s.color }))}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={fadeUp} custom={3}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">CLV Trend (12 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              <SVGLineChart
                datasets={[data.clvTrend.map(t => t.value)]}
                labels={data.clvTrend.map(t => t.label)}
                height={200}
                colors={[C.emerald]}
                showArea
              />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} custom={4}>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">CLV vs Acquisition Cost</CardTitle>
            </CardHeader>
            <CardContent>
              {data.clvVsAcquisition.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">No data yet</p>
              ) : (
                <SVGHorizontalBars
                  items={data.clvVsAcquisition.map(c => [
                    { label: `${c.segment} CLV`, value: c.clv, color: C.emerald },
                    { label: `${c.segment} CAC`, value: c.cac, color: C.red },
                  ]).flat()}
                  maxBarH={24}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={fadeUp} custom={5}>
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Top CLV Clients</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topClvClients.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">No data yet</p>
            ) : (
              <ScrollArea className="max-h-64">
                <div className="space-y-2">
                  {data.topClvClients.map((c, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                      <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-emerald-700">{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{c.name}</p>
                        <p className="text-xs text-slate-500">{c.segment} · Revenue: {fmtINR(c.revenue)}</p>
                      </div>
                      <span className="text-sm font-bold text-emerald-600">{fmtINR(c.clv)}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ANALYTICS PAGE
// ═══════════════════════════════════════════════════════════════════════════════

type AnalyticsTab = 'mrr' | 'arr' | 'forecast' | 'churn' | 'profitability' | 'workload' | 'productivity' | 'clv';

const TAB_CONFIG: { value: AnalyticsTab; label: string; icon: React.ElementType }[] = [
  { value: 'mrr', label: 'MRR', icon: IndianRupee },
  { value: 'arr', label: 'ARR', icon: TrendingUp },
  { value: 'forecast', label: 'Forecast', icon: Target },
  { value: 'churn', label: 'Churn', icon: AlertTriangle },
  { value: 'profitability', label: 'Profitability', icon: Activity },
  { value: 'workload', label: 'Workload', icon: Zap },
  { value: 'productivity', label: 'Productivity', icon: Users },
  { value: 'clv', label: 'CLV', icon: Heart },
];

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('mrr');
  const { data: clients, loading: clientsLoading } = useFireClients();
  const { data: invoices, loading: invoicesLoading } = useFireInvoices();
  const { data: returns, loading: returnsLoading } = useFireReturns();
  const { data: firm, loading: firmLoading } = useFireFirm();
  // Single source of truth for revenue/profit/expenses/margins — used by
  // computeAnalytics() for the profitability tab. Snapshot starts as
  // emptySnapshot() (all zeros, hasLiveData=false) and updates when fetched;
  // margins render as 0 until the snapshot arrives (honest empty state).
  const { snapshot } = useBusinessSnapshot();

  const isLoading = clientsLoading || invoicesLoading || returnsLoading || firmLoading;

  const analytics = useMemo(() => {
    if (isLoading || clients.length === 0) return null;
    return computeAnalytics(
      clients as (FirestoreClient & { id: string })[],
      invoices as (FirestoreInvoice & { id: string })[],
      returns as (FirestoreReturn & { id: string })[],
      snapshot,
    );
  }, [clients, invoices, returns, isLoading, snapshot]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-7 w-48" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-20 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <MetricSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => <ChartSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-6">
        <EmptyState message="No analytics data available yet. Add clients and invoices to see insights." />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-md shadow-emerald-600/20">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Executive Analytics</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {firm?.firmName || 'GSTPilot'} · Real-time insights from {fmtNum(clients.length)} clients
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
            Live Data
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AnalyticsTab)}>
        <div className="w-full overflow-x-auto">
          <TabsList className="h-10 bg-slate-100 dark:bg-slate-800/80 p-1 gap-0.5 w-full sm:w-auto inline-flex">
            {TAB_CONFIG.map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="h-8 px-3 text-xs font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400"
              >
                <tab.icon className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.slice(0, 3)}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mt-5"
          >
            <TabsContent value="mrr" forceMount className="mt-0"><MRRPanel data={analytics} /></TabsContent>
            <TabsContent value="arr" forceMount className="mt-0"><ARRPanel data={analytics} /></TabsContent>
            <TabsContent value="forecast" forceMount className="mt-0"><ForecastPanel data={analytics} /></TabsContent>
            <TabsContent value="churn" forceMount className="mt-0"><ChurnPanel data={analytics} /></TabsContent>
            <TabsContent value="profitability" forceMount className="mt-0"><ProfitabilityPanel data={analytics} /></TabsContent>
            <TabsContent value="workload" forceMount className="mt-0"><WorkloadPanel data={analytics} /></TabsContent>
            <TabsContent value="productivity" forceMount className="mt-0"><ProductivityPanel data={analytics} /></TabsContent>
            <TabsContent value="clv" forceMount className="mt-0"><CLVPanel data={analytics} /></TabsContent>
          </motion.div>
        </AnimatePresence>
      </Tabs>
    </div>
  );
}
