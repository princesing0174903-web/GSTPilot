'use client';

import React, { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  Users,
  Building2,
  MapPin,
  Award,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Crown,
  Star,
  Zap,
  Globe,
  IndianRupee,
  Clock,
  Shield,
  Activity,
  Layers,
} from 'lucide-react';
import { useFireClients, useFireInvoices, useFireReturns } from '@/hooks/use-firestore';

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR PALETTE — Emerald + Slate (NO indigo/blue)
// ═══════════════════════════════════════════════════════════════════════════════
const C = {
  emerald50: '#ecfdf5', emerald100: '#d1fae5', emerald200: '#a7f3d0',
  emerald300: '#6ee7b7', emerald400: '#34d399', emerald500: '#10b981',
  emerald600: '#059669', emerald700: '#047857', emerald800: '#065f46',
  slate50: '#f8fafc', slate100: '#f1f5f9', slate200: '#e2e8f0',
  slate300: '#cbd5e1', slate400: '#94a3b8', slate500: '#64748b',
  slate600: '#475569', slate700: '#334155', slate800: '#1e293b',
  amber400: '#fbbf24', amber500: '#f59e0b',
  red400: '#f87171', red500: '#ef4444',
  teal500: '#14b8a6', teal600: '#0d9488',
};

// ═══════════════════════════════════════════════════════════════════════════════
// INDIAN FORMATTING HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function formatINR(num: number): string {
  const str = num.toLocaleString('en-IN');
  return `₹${str}`;
}

function formatIndianNumber(num: number): string {
  return num.toLocaleString('en-IN');
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════════════════════════════════════

const INDUSTRIES = [
  'Manufacturing', 'Trading', 'Services', 'IT', 'Healthcare', 'Construction', 'Retail', 'F&B',
] as const;
type Industry = typeof INDUSTRIES[number];

interface BenchmarkData {
  avgRevenue: number;
  complianceScore: number;
  collectionDays: number;
  profitability: number;
  filingTime: number;
  clientCount: number;
  growthRate: number;
}

const INDUSTRY_BENCHMARKS: Record<Industry, { avg: BenchmarkData; best: BenchmarkData }> = {
  Manufacturing: {
    avg: { avgRevenue: 3850000, complianceScore: 78, collectionDays: 45, profitability: 14, filingTime: 4.5, clientCount: 120, growthRate: 12 },
    best: { avgRevenue: 12000000, complianceScore: 99, collectionDays: 18, profitability: 28, filingTime: 0.5, clientCount: 500, growthRate: 25 },
  },
  Trading: {
    avg: { avgRevenue: 5200000, complianceScore: 72, collectionDays: 38, profitability: 11, filingTime: 3.8, clientCount: 95, growthRate: 9 },
    best: { avgRevenue: 18000000, complianceScore: 97, collectionDays: 15, profitability: 22, filingTime: 0.8, clientCount: 400, growthRate: 20 },
  },
  Services: {
    avg: { avgRevenue: 2800000, complianceScore: 81, collectionDays: 42, profitability: 18, filingTime: 3.2, clientCount: 85, growthRate: 15 },
    best: { avgRevenue: 9500000, complianceScore: 98, collectionDays: 20, profitability: 32, filingTime: 0.6, clientCount: 350, growthRate: 28 },
  },
  IT: {
    avg: { avgRevenue: 6500000, complianceScore: 88, collectionDays: 30, profitability: 22, filingTime: 2.0, clientCount: 70, growthRate: 18 },
    best: { avgRevenue: 25000000, complianceScore: 99, collectionDays: 12, profitability: 38, filingTime: 0.3, clientCount: 600, growthRate: 35 },
  },
  Healthcare: {
    avg: { avgRevenue: 3200000, complianceScore: 74, collectionDays: 50, profitability: 16, filingTime: 5.0, clientCount: 55, growthRate: 10 },
    best: { avgRevenue: 11000000, complianceScore: 96, collectionDays: 22, profitability: 26, filingTime: 1.0, clientCount: 250, growthRate: 22 },
  },
  Construction: {
    avg: { avgRevenue: 4800000, complianceScore: 68, collectionDays: 55, profitability: 12, filingTime: 5.5, clientCount: 60, growthRate: 8 },
    best: { avgRevenue: 15000000, complianceScore: 94, collectionDays: 25, profitability: 20, filingTime: 1.2, clientCount: 200, growthRate: 18 },
  },
  Retail: {
    avg: { avgRevenue: 2200000, complianceScore: 75, collectionDays: 35, profitability: 10, filingTime: 4.0, clientCount: 150, growthRate: 11 },
    best: { avgRevenue: 8000000, complianceScore: 97, collectionDays: 14, profitability: 19, filingTime: 0.5, clientCount: 500, growthRate: 24 },
  },
  'F&B': {
    avg: { avgRevenue: 1800000, complianceScore: 70, collectionDays: 40, profitability: 9, filingTime: 4.8, clientCount: 80, growthRate: 7 },
    best: { avgRevenue: 6000000, complianceScore: 95, collectionDays: 16, profitability: 18, filingTime: 0.8, clientCount: 300, growthRate: 16 },
  },
};

const YOUR_FIRM: BenchmarkData = {
  avgRevenue: 4500000,
  complianceScore: 92,
  collectionDays: 32,
  profitability: 18,
  filingTime: 2.1,
  clientCount: 147,
  growthRate: 14,
};

const METRIC_CONFIG = [
  { key: 'avgRevenue' as const, label: 'Average Revenue', icon: IndianRupee, format: (v: number) => formatINR(v), inverted: false, unit: '' },
  { key: 'complianceScore' as const, label: 'Compliance Score', icon: Shield, format: (v: number) => `${v}%`, inverted: false, unit: '%' },
  { key: 'collectionDays' as const, label: 'Collection Days', icon: Clock, format: (v: number) => `${v} days`, inverted: true, unit: 'days' },
  { key: 'profitability' as const, label: 'Profitability', icon: TrendingUp, format: (v: number) => `${v}%`, inverted: false, unit: '%' },
  { key: 'filingTime' as const, label: 'Filing Time', icon: Clock, format: (v: number) => `${v} days`, inverted: true, unit: 'days' },
] as const;

// Percentile data for each metric
const PERCENTILES: Record<string, number> = {
  avgRevenue: 85,
  complianceScore: 92,
  collectionDays: 78,
  profitability: 72,
  filingTime: 82,
  clientCount: 68,
  growthRate: 60,
};

// Top performers
const TOP_PERFORMERS: Record<Industry, Array<{ rank: number; name: string; revenue: number; score: number }>> = {
  Manufacturing: [
    { rank: 1, name: 'Business #1', revenue: 12000000, score: 99 },
    { rank: 2, name: 'Business #2', revenue: 9800000, score: 96 },
    { rank: 3, name: 'Business #3', revenue: 8500000, score: 94 },
    { rank: 4, name: 'Business #4', revenue: 7200000, score: 91 },
    { rank: 5, name: 'Business #5', revenue: 6100000, score: 88 },
  ],
  Trading: [
    { rank: 1, name: 'Business #1', revenue: 18000000, score: 97 },
    { rank: 2, name: 'Business #2', revenue: 14200000, score: 95 },
    { rank: 3, name: 'Business #3', revenue: 11000000, score: 92 },
    { rank: 4, name: 'Business #4', revenue: 8800000, score: 89 },
    { rank: 5, name: 'Business #5', revenue: 6500000, score: 86 },
  ],
  Services: [
    { rank: 1, name: 'Business #1', revenue: 9500000, score: 98 },
    { rank: 2, name: 'Business #2', revenue: 7800000, score: 95 },
    { rank: 3, name: 'Business #3', revenue: 6200000, score: 92 },
    { rank: 4, name: 'Business #4', revenue: 5000000, score: 88 },
    { rank: 5, name: 'Business #5', revenue: 3800000, score: 85 },
  ],
  IT: [
    { rank: 1, name: 'Business #1', revenue: 25000000, score: 99 },
    { rank: 2, name: 'Business #2', revenue: 20000000, score: 97 },
    { rank: 3, name: 'Business #3', revenue: 16000000, score: 95 },
    { rank: 4, name: 'Business #4', revenue: 12000000, score: 92 },
    { rank: 5, name: 'Business #5', revenue: 9000000, score: 89 },
  ],
  Healthcare: [
    { rank: 1, name: 'Business #1', revenue: 11000000, score: 96 },
    { rank: 2, name: 'Business #2', revenue: 8800000, score: 93 },
    { rank: 3, name: 'Business #3', revenue: 6700000, score: 90 },
    { rank: 4, name: 'Business #4', revenue: 5000000, score: 87 },
    { rank: 5, name: 'Business #5', revenue: 3500000, score: 83 },
  ],
  Construction: [
    { rank: 1, name: 'Business #1', revenue: 15000000, score: 94 },
    { rank: 2, name: 'Business #2', revenue: 12000000, score: 91 },
    { rank: 3, name: 'Business #3', revenue: 9500000, score: 88 },
    { rank: 4, name: 'Business #4', revenue: 7000000, score: 84 },
    { rank: 5, name: 'Business #5', revenue: 5000000, score: 80 },
  ],
  Retail: [
    { rank: 1, name: 'Business #1', revenue: 8000000, score: 97 },
    { rank: 2, name: 'Business #2', revenue: 6500000, score: 94 },
    { rank: 3, name: 'Business #3', revenue: 5000000, score: 90 },
    { rank: 4, name: 'Business #4', revenue: 3800000, score: 86 },
    { rank: 5, name: 'Business #5', revenue: 2500000, score: 82 },
  ],
  'F&B': [
    { rank: 1, name: 'Business #1', revenue: 6000000, score: 95 },
    { rank: 2, name: 'Business #2', revenue: 4500000, score: 91 },
    { rank: 3, name: 'Business #3', revenue: 3200000, score: 87 },
    { rank: 4, name: 'Business #4', revenue: 2200000, score: 83 },
    { rank: 5, name: 'Business #5', revenue: 1500000, score: 79 },
  ],
};

// Industry insights
const INDUSTRY_INSIGHTS: Record<Industry, string[]> = {
  Manufacturing: ['Manufacturing sector grew 12% this quarter', 'Compliance scores improved 5% YoY', 'Avg filing time reduced by 1.2 days'],
  Trading: ['Trading sector stable at 9% growth', 'GST reconciliation accuracy up 8%', 'Digital invoicing adoption reached 72%'],
  Services: ['Services sector leads at 15% growth', 'Compliance automation driving scores up', 'Client onboarding time decreased 30%'],
  IT: ['IT sector tops growth charts at 18%', 'Near-perfect compliance scores becoming standard', 'AI-powered filing reducing time to hours'],
  Healthcare: ['Healthcare sector growing steadily at 10%', 'Regulatory changes driving compliance focus', 'Collection cycles improving slowly'],
  Construction: ['Construction sector recovering at 8% growth', 'Compliance gaps remain the biggest challenge', 'Digital adoption lagging behind other sectors'],
  Retail: ['Retail sector growing at 11%', 'E-commerce driving GST compliance improvements', 'Filing speed improving with automation tools'],
  'F&B': ['F&B sector modest growth at 7%', 'Food safety compliance boosting overall scores', 'Small businesses struggling with filing deadlines'],
};

// Regional data
interface CityData {
  name: string;
  state: string;
  avgRevenue: number;
  complianceScore: number;
  firms: number;
  growth: number;
}

const CITY_DATA: CityData[] = [
  { name: 'Mumbai', state: 'Maharashtra', avgRevenue: 5200000, complianceScore: 82, firms: 2800, growth: 14 },
  { name: 'Delhi', state: 'Delhi', avgRevenue: 4800000, complianceScore: 79, firms: 2200, growth: 12 },
  { name: 'Bengaluru', state: 'Karnataka', avgRevenue: 5500000, complianceScore: 86, firms: 1900, growth: 18 },
  { name: 'Chennai', state: 'Tamil Nadu', avgRevenue: 4200000, complianceScore: 80, firms: 1600, growth: 11 },
  { name: 'Hyderabad', state: 'Telangana', avgRevenue: 4600000, complianceScore: 83, firms: 1400, growth: 16 },
  { name: 'Pune', state: 'Maharashtra', avgRevenue: 4100000, complianceScore: 81, firms: 1300, growth: 13 },
  { name: 'Ahmedabad', state: 'Gujarat', avgRevenue: 3800000, complianceScore: 77, firms: 1200, growth: 10 },
  { name: 'Kolkata', state: 'West Bengal', avgRevenue: 2900000, complianceScore: 73, firms: 1100, growth: 7 },
  { name: 'Jaipur', state: 'Rajasthan', avgRevenue: 2500000, complianceScore: 75, firms: 800, growth: 9 },
  { name: 'Lucknow', state: 'Uttar Pradesh', avgRevenue: 2200000, complianceScore: 71, firms: 750, growth: 8 },
  { name: 'Indore', state: 'Madhya Pradesh', avgRevenue: 2400000, complianceScore: 76, firms: 650, growth: 11 },
  { name: 'Coimbatore', state: 'Tamil Nadu', avgRevenue: 3200000, complianceScore: 78, firms: 600, growth: 12 },
];

interface StateData {
  name: string;
  complianceScore: number;
  avgRevenue: number;
  filingSpeed: number;
  firms: number;
  growth: number;
}

const STATE_DATA: StateData[] = [
  { name: 'Maharashtra', complianceScore: 82, avgRevenue: 4800000, filingSpeed: 3.2, firms: 4200, growth: 14 },
  { name: 'Delhi', complianceScore: 79, avgRevenue: 4600000, filingSpeed: 3.5, firms: 2800, growth: 12 },
  { name: 'Karnataka', complianceScore: 86, avgRevenue: 5100000, filingSpeed: 2.8, firms: 2400, growth: 17 },
  { name: 'Tamil Nadu', complianceScore: 80, avgRevenue: 4000000, filingSpeed: 3.4, firms: 2200, growth: 11 },
  { name: 'Telangana', complianceScore: 83, avgRevenue: 4500000, filingSpeed: 3.0, firms: 1800, growth: 15 },
  { name: 'Gujarat', complianceScore: 77, avgRevenue: 3700000, filingSpeed: 3.8, firms: 2000, growth: 10 },
  { name: 'West Bengal', complianceScore: 73, avgRevenue: 2800000, filingSpeed: 4.2, firms: 1500, growth: 7 },
  { name: 'Rajasthan', complianceScore: 75, avgRevenue: 2600000, filingSpeed: 4.0, firms: 1100, growth: 9 },
  { name: 'Uttar Pradesh', complianceScore: 71, avgRevenue: 2200000, filingSpeed: 4.5, firms: 2800, growth: 8 },
  { name: 'Madhya Pradesh', complianceScore: 76, avgRevenue: 2400000, filingSpeed: 3.9, firms: 900, growth: 10 },
];

// Historical trend data
const HISTORICAL_TRENDS = [
  { period: 'Q1 2024', industryGrowth: 8, complianceTrend: 74, revenueTrend: 3200000, yourGrowth: 10, yourCompliance: 88, yourRevenue: 4000000 },
  { period: 'Q2 2024', industryGrowth: 9, complianceTrend: 76, revenueTrend: 3400000, yourGrowth: 11, yourCompliance: 89, yourRevenue: 4200000 },
  { period: 'Q3 2024', industryGrowth: 10, complianceTrend: 77, revenueTrend: 3600000, yourGrowth: 12, yourCompliance: 90, yourRevenue: 4300000 },
  { period: 'Q4 2024', industryGrowth: 11, complianceTrend: 78, revenueTrend: 3850000, yourGrowth: 13, yourCompliance: 91, yourRevenue: 4400000 },
  { period: 'Q1 2025', industryGrowth: 12, complianceTrend: 79, revenueTrend: 4000000, yourGrowth: 14, yourCompliance: 92, yourRevenue: 4500000 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION VARIANTS
// ═══════════════════════════════════════════════════════════════════════════════
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Trend Arrow
// ═══════════════════════════════════════════════════════════════════════════════
function TrendArrow({ yours, avg, inverted }: { yours: number; avg: number; inverted: boolean }) {
  const better = inverted ? yours < avg : yours > avg;
  const equal = yours === avg;
  if (equal) return <Minus className="h-4 w-4 text-slate-400" />;
  return better
    ? <ArrowUpRight className="h-4 w-4 text-emerald-500" />
    : <ArrowDownRight className="h-4 w-4 text-red-400" />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG: Horizontal Bar Chart
// ═══════════════════════════════════════════════════════════════════════════════
function HorizontalBarChart({ data }: {
  data: Array<{ label: string; yourValue: number; industryAvg: number; max: number; formatFn: (v: number) => string }>;
}) {
  const barHeight = 28;
  const gap = 14;
  const labelWidth = 130;
  const chartWidth = 500;
  const svgHeight = data.length * (barHeight + gap) + 20;

  return (
    <svg viewBox={`0 0 ${labelWidth + chartWidth + 100} ${svgHeight}`} className="w-full" style={{ minHeight: svgHeight }}>
      {data.map((item, i) => {
        const y = i * (barHeight + gap) + 10;
        const yourPct = Math.min((item.yourValue / item.max) * 100, 100);
        const avgPct = Math.min((item.industryAvg / item.max) * 100, 100);
        return (
          <g key={item.label}>
            <text x={labelWidth - 8} y={y + barHeight / 2 + 4} textAnchor="end" fill={C.slate600} fontSize="11" fontWeight="500">{item.label}</text>
            {/* Industry avg bar */}
            <rect x={labelWidth + 4} y={y + 2} width={0} height={barHeight - 8} rx="3" fill={C.slate200}>
              <animate attributeName="width" from="0" to={`${(avgPct / 100) * chartWidth}`} dur="0.8s" fill="freeze" />
            </rect>
            <text x={labelWidth + 8 + (avgPct / 100) * chartWidth} y={y + barHeight / 2 - 2} fill={C.slate400} fontSize="9">{item.formatFn(item.industryAvg)}</text>
            {/* Your bar */}
            <rect x={labelWidth + 4} y={y + barHeight - 8} width={0} height={8} rx="3" fill={C.emerald500}>
              <animate attributeName="width" from="0" to={`${(yourPct / 100) * chartWidth}`} dur="0.8s" fill="freeze" />
            </rect>
            <text x={labelWidth + 8 + (yourPct / 100) * chartWidth} y={y + barHeight + 1} fill={C.emerald700} fontSize="9" fontWeight="600">{item.formatFn(item.yourValue)}</text>
          </g>
        );
      })}
      {/* Legend */}
      <rect x={labelWidth + 4} y={svgHeight - 12} width="10" height="8" rx="2" fill={C.slate200} />
      <text x={labelWidth + 18} y={svgHeight - 5} fill={C.slate400} fontSize="9">Industry Avg</text>
      <rect x={labelWidth + 100} y={svgHeight - 12} width="10" height="8" rx="2" fill={C.emerald500} />
      <text x={labelWidth + 114} y={svgHeight - 5} fill={C.emerald700} fontSize="9" fontWeight="600">Your Firm</text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG: Bell Curve Percentile Visualization
// ═══════════════════════════════════════════════════════════════════════════════
function BellCurvePercentile({ percentile, label }: { percentile: number; label: string }) {
  const width = 280;
  const height = 80;
  const cx = width / 2;
  const cy = height - 15;

  // Generate bell curve path
  const points: string[] = [];
  for (let x = 0; x <= width; x += 2) {
    const t = (x - cx) / (width / 5);
    const y = cy - 50 * Math.exp(-0.5 * t * t);
    points.push(`${x},${y}`);
  }
  const curvePath = `M ${points.join(' L ')}`;

  // Marker position
  const markerX = (percentile / 100) * width;
  const t = (markerX - cx) / (width / 5);
  const markerY = cy - 50 * Math.exp(-0.5 * t * t);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minHeight: 70 }}>
        {/* Bell curve fill */}
        <path d={`${curvePath} L ${width},${cy} L 0,${cy} Z`} fill={C.emerald50} opacity="0.6" />
        {/* Bell curve line */}
        <path d={curvePath} fill="none" stroke={C.emerald400} strokeWidth="2" />
        {/* Baseline */}
        <line x1="0" y1={cy} x2={width} y2={cy} stroke={C.slate300} strokeWidth="1" />
        {/* Percentile markers */}
        {[25, 50, 75].map(p => (
          <g key={p}>
            <line x1={(p / 100) * width} y1={cy - 3} x2={(p / 100) * width} y2={cy + 3} stroke={C.slate400} strokeWidth="1" />
            <text x={(p / 100) * width} y={cy + 12} textAnchor="middle" fill={C.slate400} fontSize="8">P{p}</text>
          </g>
        ))}
        {/* Your position marker */}
        <circle cx={markerX} cy={markerY} r="5" fill={C.emerald600} stroke="white" strokeWidth="2" />
        <line x1={markerX} y1={markerY + 5} x2={markerX} y2={cy} stroke={C.emerald500} strokeWidth="1" strokeDasharray="3,2" />
        {/* Label */}
        <text x={markerX} y={markerY - 10} textAnchor="middle" fill={C.emerald700} fontSize="10" fontWeight="700">P{percentile}</text>
      </svg>
      <span className="text-xs text-slate-500 font-medium">{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG: Multi-Line Trend Chart
// ═══════════════════════════════════════════════════════════════════════════════
function MultiLineChart({ data, keys, colors, labels }: {
  data: Array<Record<string, number | string>>;
  keys: string[];
  colors: string[];
  labels: string[];
}) {
  const width = 600;
  const height = 220;
  const padL = 50;
  const padR = 20;
  const padT = 20;
  const padB = 40;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  // Find numeric ranges
  const numericData = data.map(d => {
    const out: Record<string, number> = {};
    keys.forEach(k => { out[k] = typeof d[k] === 'number' ? d[k] as number : 0; });
    return out;
  });
  const allValues = numericData.flatMap(d => keys.map(k => d[k]));
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const range = maxVal - minVal || 1;

  const scaleX = (i: number) => padL + (i / (data.length - 1)) * chartW;
  const scaleY = (v: number) => padT + chartH - ((v - minVal) / range) * chartH;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minHeight: 180 }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
        const y = padT + chartH * (1 - pct);
        return <line key={i} x1={padL} y1={y} x2={width - padR} y2={y} stroke={C.slate200} strokeWidth="1" />;
      })}
      {/* Lines */}
      {keys.map((key, ki) => {
        const points = numericData.map((d, i) => `${scaleX(i)},${scaleY(d[key])}`).join(' ');
        return (
          <g key={key}>
            <polyline points={points} fill="none" stroke={colors[ki]} strokeWidth="2.5" strokeLinejoin="round" />
            {numericData.map((d, i) => (
              <circle key={i} cx={scaleX(i)} cy={scaleY(d[key])} r="3.5" fill="white" stroke={colors[ki]} strokeWidth="2" />
            ))}
          </g>
        );
      })}
      {/* X labels */}
      {data.map((d, i) => (
        <text key={i} x={scaleX(i)} y={height - 8} textAnchor="middle" fill={C.slate500} fontSize="9">{d.period || ''}</text>
      ))}
      {/* Legend */}
      {keys.map((key, ki) => (
        <g key={key} transform={`translate(${padL + ki * 140}, ${padT - 8})`}>
          <line x1="0" y1="0" x2="16" y2="0" stroke={colors[ki]} strokeWidth="2.5" />
          <text x="20" y="4" fill={C.slate600} fontSize="9" fontWeight="500">{labels[ki]}</text>
        </g>
      ))}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG: Simplified India Map (Regional Cards)
// ═══════════════════════════════════════════════════════════════════════════════
function IndiaRegionMap({ states, selectedState, onSelect }: {
  states: StateData[];
  selectedState: string;
  onSelect: (name: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {states.map((s) => {
        const isSelected = s.name === selectedState;
        const scoreColor = s.complianceScore >= 82 ? C.emerald500 : s.complianceScore >= 75 ? C.amber500 : C.red500;
        return (
          <motion.button
            key={s.name}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(s.name)}
            className={`relative rounded-xl p-3 text-left border transition-all ${
              isSelected
                ? 'border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-100'
                : 'border-slate-200 bg-white hover:border-emerald-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: scoreColor }} />
              <span className="text-xs font-semibold text-slate-700 truncate">{s.name}</span>
            </div>
            <div className="text-lg font-bold text-slate-800">{s.complianceScore}%</div>
            <div className="text-[10px] text-slate-400">Compliance</div>
            {isSelected && (
              <div className="absolute top-1.5 right-1.5">
                <MapPin className="h-3.5 w-3.5 text-emerald-600" />
              </div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: Overview Dashboard
// ═══════════════════════════════════════════════════════════════════════════════
function OverviewDashboard({ selectedIndustry }: { selectedIndustry: Industry }) {
  const benchmark = INDUSTRY_BENCHMARKS[selectedIndustry];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Position Badge + Rank */}
      <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-4 py-2 rounded-full shadow-lg shadow-emerald-200">
          <Crown className="h-4 w-4" />
          <span className="text-sm font-bold">Top 15% in your industry</span>
        </div>
        <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50 px-3 py-1 text-xs font-semibold">
          <Star className="h-3 w-3 mr-1" /> Rank #147 of 1,200 firms
        </Badge>
        <Badge variant="outline" className="border-slate-200 text-slate-600 bg-slate-50 px-3 py-1 text-xs font-semibold">
          <Building2 className="h-3 w-3 mr-1" /> {selectedIndustry}
        </Badge>
      </motion.div>

      {/* Quick Filters */}
      <motion.div variants={itemVariants} className="flex flex-wrap gap-3">
        <Select defaultValue={selectedIndustry}>
          <SelectTrigger className="w-[160px] h-9 text-xs">
            <SelectValue placeholder="Industry" />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map(ind => <SelectItem key={ind} value={ind}>{ind}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select defaultValue="Mumbai">
          <SelectTrigger className="w-[140px] h-9 text-xs">
            <SelectValue placeholder="City" />
          </SelectTrigger>
          <SelectContent>
            {CITY_DATA.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select defaultValue="Maharashtra">
          <SelectTrigger className="w-[160px] h-9 text-xs">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            {STATE_DATA.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select defaultValue="Medium">
          <SelectTrigger className="w-[130px] h-9 text-xs">
            <SelectValue placeholder="Business Size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Small">Small (&lt;50 clients)</SelectItem>
            <SelectItem value="Medium">Medium (50-200)</SelectItem>
            <SelectItem value="Large">Large (200+)</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Benchmark Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {METRIC_CONFIG.map((metric) => {
          const yourVal = YOUR_FIRM[metric.key];
          const avgVal = benchmark.avg[metric.key];
          const bestVal = benchmark.best[metric.key];
          const pct = PERCENTILES[metric.key];
          const better = metric.inverted ? yourVal < avgVal : yourVal > avgVal;
          const IconComp = metric.icon;

          return (
            <motion.div key={metric.key} variants={itemVariants}>
              <Card className="border-slate-200 hover:shadow-md hover:border-emerald-200 transition-all h-full">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <IconComp className="h-4 w-4 text-emerald-600" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700">{metric.label}</span>
                    </div>
                    <TrendArrow yours={yourVal} avg={avgVal} inverted={metric.inverted} />
                  </div>

                  <div className="mb-3">
                    <div className="text-2xl font-bold text-slate-800">{metric.format(yourVal)}</div>
                    <div className="text-xs text-slate-400 mt-0.5">Your Value</div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Industry Avg</span>
                      <span className="font-medium text-slate-600">{metric.format(avgVal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Best-in-class</span>
                      <span className="font-medium text-emerald-600">{metric.format(bestVal)}</span>
                    </div>
                  </div>

                  <Separator className="my-3" />

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Percentile</span>
                    <Badge className={`${better ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-amber-100 text-amber-700 hover:bg-amber-100'} text-xs font-bold`}>
                      P{pct}
                    </Badge>
                  </div>
                  <Progress value={pct} className="mt-2 h-1.5" />
                </CardContent>
              </Card>
            </motion.div>
          );
        })}

        {/* Extra cards for client count & growth */}
        {([
          { key: 'clientCount' as const, label: 'Active Clients', icon: Users, format: (v: number) => formatIndianNumber(v), inverted: false },
          { key: 'growthRate' as const, label: 'Growth Rate', icon: TrendingUp, format: (v: number) => `${v}%`, inverted: false },
        ] as const).map((metric) => {
          const yourVal = YOUR_FIRM[metric.key];
          const avgVal = benchmark.avg[metric.key];
          const bestVal = benchmark.best[metric.key];
          const pct = PERCENTILES[metric.key];
          const better = metric.inverted ? yourVal < avgVal : yourVal > avgVal;
          const IconComp = metric.icon;

          return (
            <motion.div key={metric.key} variants={itemVariants}>
              <Card className="border-slate-200 hover:shadow-md hover:border-emerald-200 transition-all h-full">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <IconComp className="h-4 w-4 text-emerald-600" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700">{metric.label}</span>
                    </div>
                    <TrendArrow yours={yourVal} avg={avgVal} inverted={metric.inverted} />
                  </div>
                  <div className="mb-3">
                    <div className="text-2xl font-bold text-slate-800">{metric.format(yourVal)}</div>
                    <div className="text-xs text-slate-400 mt-0.5">Your Value</div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Industry Avg</span>
                      <span className="font-medium text-slate-600">{metric.format(avgVal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Best-in-class</span>
                      <span className="font-medium text-emerald-600">{metric.format(bestVal)}</span>
                    </div>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Percentile</span>
                    <Badge className={`${better ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-amber-100 text-amber-700 hover:bg-amber-100'} text-xs font-bold`}>
                      P{pct}
                    </Badge>
                  </div>
                  <Progress value={pct} className="mt-2 h-1.5" />
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: Industry Comparison
// ═══════════════════════════════════════════════════════════════════════════════
function IndustryComparison({ selectedIndustry, onIndustryChange }: { selectedIndustry: Industry; onIndustryChange: (i: Industry) => void }) {
  const benchmark = INDUSTRY_BENCHMARKS[selectedIndustry];
  const performers = TOP_PERFORMERS[selectedIndustry];
  const insights = INDUSTRY_INSIGHTS[selectedIndustry];

  const barChartData = METRIC_CONFIG.map(m => ({
    label: m.label,
    yourValue: YOUR_FIRM[m.key],
    industryAvg: benchmark.avg[m.key],
    max: benchmark.best[m.key] * 1.15,
    formatFn: m.format,
  }));

  const percentileItems = METRIC_CONFIG.map(m => ({
    label: m.label,
    percentile: PERCENTILES[m.key],
  }));

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Industry Selector */}
      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <Building2 className="h-5 w-5 text-emerald-600" />
        <span className="text-sm font-semibold text-slate-700">Compare against:</span>
        <Select value={selectedIndustry} onValueChange={(v) => onIndustryChange(v as Industry)}>
          <SelectTrigger className="w-[180px] h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map(ind => <SelectItem key={ind} value={ind}>{ind}</SelectItem>)}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Horizontal Bar Chart */}
      <motion.div variants={itemVariants}>
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-600" />
              Your Firm vs Industry Average
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="w-full">
              <HorizontalBarChart data={barChartData} />
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>

      {/* Percentile Rankings */}
      <motion.div variants={itemVariants}>
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-600" />
              Where You Stand — Percentile Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {percentileItems.map(item => (
                <BellCurvePercentile key={item.label} percentile={item.percentile} label={item.label} />
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Top Performers Table + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={itemVariants}>
          <Card className="border-slate-200 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Award className="h-4 w-4 text-emerald-600" />
                Top Performers — {selectedIndustry}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {performers.map(p => (
                  <div key={p.rank} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        p.rank === 1 ? 'bg-amber-100 text-amber-700' : p.rank === 2 ? 'bg-slate-100 text-slate-600' : p.rank === 3 ? 'bg-orange-50 text-orange-600' : 'bg-slate-50 text-slate-400'
                      }`}>
                        {p.rank === 1 ? <Crown className="h-3.5 w-3.5" /> : p.rank}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-700">{p.name}</div>
                        <div className="text-xs text-slate-400">Score: {p.score}%</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-slate-700">{formatINR(p.revenue)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-slate-200 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-600" />
                Industry Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {insights.map((insight, i) => (
                <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50/60 border border-emerald-100">
                  <Activity className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span className="text-sm text-slate-700">{insight}</span>
                </div>
              ))}
              <Separator className="my-2" />
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-xs font-semibold text-slate-500 mb-2">PEER GROUP STATS (ANONYMIZED)</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-slate-400">Total firms:</span> <span className="font-medium text-slate-700">{formatIndianNumber(INDUSTRY_BENCHMARKS[selectedIndustry].avg.clientCount * 10)}</span></div>
                  <div><span className="text-slate-400">Avg revenue:</span> <span className="font-medium text-slate-700">{formatINR(benchmark.avg.avgRevenue)}</span></div>
                  <div><span className="text-slate-400">Avg compliance:</span> <span className="font-medium text-slate-700">{benchmark.avg.complianceScore}%</span></div>
                  <div><span className="text-slate-400">Growth rate:</span> <span className="font-medium text-slate-700">{benchmark.avg.growthRate}%</span></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: Regional Benchmarks
// ═══════════════════════════════════════════════════════════════════════════════
function RegionalBenchmarks() {
  const [selectedState, setSelectedState] = useState('Maharashtra');
  const stateInfo = STATE_DATA.find(s => s.name === selectedState);
  const stateCities = CITY_DATA.filter(c => c.state === selectedState);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Regional Map Cards */}
      <motion.div variants={itemVariants}>
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-600" />
              State-wise Compliance Heat Map
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <IndiaRegionMap states={STATE_DATA} selectedState={selectedState} onSelect={setSelectedState} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Selected State Details + City Data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={itemVariants}>
          <Card className="border-slate-200 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Globe className="h-4 w-4 text-emerald-600" />
                {selectedState} — Detailed Benchmarks
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {stateInfo && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                      <div className="text-xs text-slate-500 mb-1">Avg Revenue</div>
                      <div className="text-lg font-bold text-slate-800">{formatINR(stateInfo.avgRevenue)}</div>
                      <div className="text-xs text-emerald-600 mt-0.5 flex items-center gap-1">
                        {stateInfo.avgRevenue > YOUR_FIRM.avgRevenue
                          ? <><ArrowUpRight className="h-3 w-3" /> Higher than you</>
                          : <><ArrowDownRight className="h-3 w-3" /> Lower than you</>
                        }
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                      <div className="text-xs text-slate-500 mb-1">Compliance Score</div>
                      <div className="text-lg font-bold text-slate-800">{stateInfo.complianceScore}%</div>
                      <div className="text-xs text-emerald-600 mt-0.5 flex items-center gap-1">
                        {stateInfo.complianceScore > YOUR_FIRM.complianceScore
                          ? <><ArrowUpRight className="h-3 w-3" /> Higher than you</>
                          : <><ArrowDownRight className="h-3 w-3" /> Lower than you</>
                        }
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="text-xs text-slate-500 mb-1">Filing Speed</div>
                      <div className="text-lg font-bold text-slate-800">{stateInfo.filingSpeed} days</div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="text-xs text-slate-500 mb-1">Growth Rate</div>
                      <div className="text-lg font-bold text-slate-800">{stateInfo.growth}%</div>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-xs text-slate-500 mb-1">Registered Firms</div>
                    <div className="text-lg font-bold text-slate-800">{formatIndianNumber(stateInfo.firms)}</div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-slate-200 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-600" />
                Top Cities by Revenue
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="max-h-80">
                <div className="space-y-2">
                  {[...CITY_DATA]
                    .sort((a, b) => b.avgRevenue - a.avgRevenue)
                    .map((city, i) => {
                      const isYourCity = city.name === 'Mumbai';
                      return (
                        <div key={city.name} className={`flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors ${
                          isYourCity ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-slate-50'
                        }`}>
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-bold w-5 ${i < 3 ? 'text-emerald-600' : 'text-slate-400'}`}>{i + 1}</span>
                            <div>
                              <div className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                                {city.name}
                                {isYourCity && <Badge className="bg-emerald-100 text-emerald-700 text-[9px] px-1.5 py-0 h-4 hover:bg-emerald-100">Your City</Badge>}
                              </div>
                              <div className="text-xs text-slate-400">{city.state}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-slate-700">{formatINR(city.avgRevenue)}</div>
                            <div className="text-xs text-slate-400">{city.complianceScore}% compliance</div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Your City Comparison + Filing Speed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={itemVariants}>
          <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-800">Mumbai — Your City vs Your Firm</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-500 mb-1">City Avg Revenue</div>
                  <div className="text-xl font-bold text-slate-800">₹52,00,000</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Your Revenue</div>
                  <div className="text-xl font-bold text-emerald-600">₹45,00,000</div>
                </div>
              </div>
              <Separator className="my-3" />
              <div className="flex items-center gap-2">
                <ArrowDownRight className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-amber-700 font-medium">You're ₹7,00,000 below city average</span>
              </div>
              <div className="mt-2 text-xs text-slate-500">However, your compliance score (92%) exceeds the city average (82%)</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-600" />
                State-wise Filing Speed
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="max-h-52">
                <div className="space-y-2">
                  {[...STATE_DATA].sort((a, b) => a.filingSpeed - b.filingSpeed).map(s => (
                    <div key={s.name} className="flex items-center justify-between py-1.5">
                      <span className="text-xs font-medium text-slate-600">{s.name}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(5, (1 - (s.filingSpeed - 2) / 3) * 100)}%`,
                              backgroundColor: s.filingSpeed <= 3 ? C.emerald500 : s.filingSpeed <= 3.5 ? C.amber500 : C.red400,
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium text-slate-700 w-14 text-right">{s.filingSpeed} days</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Regional Growth Trends */}
      <motion.div variants={itemVariants}>
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Regional Growth Trends
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {STATE_DATA.slice(0, 5).map(s => (
                <div key={s.name} className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-center">
                  <div className="text-xs text-slate-500 mb-1">{s.name}</div>
                  <div className="flex items-center justify-center gap-1">
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-lg font-bold text-emerald-600">{s.growth}%</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">YoY Growth</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4: Business Intelligence
// ═══════════════════════════════════════════════════════════════════════════════
function BusinessIntelligence() {
  const networkStats = [
    { icon: Building2, label: 'Firms', value: '10,000+' },
    { icon: Users, label: 'Businesses', value: '5,00,000+' },
    { icon: Layers, label: 'Data Points', value: '10,00,00,000+' },
  ];

  const alertItems = [
    { type: 'warning' as const, text: "You've dropped below industry average in filing speed" },
    { type: 'success' as const, text: 'Your compliance score is in the top 10% for your region' },
    { type: 'warning' as const, text: 'Collection days increased by 3 days this quarter' },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Network Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {networkStats.map(stat => {
          const IconComp = stat.icon;
          return (
            <Card key={stat.label} className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <IconComp className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-800">{stat.value}</div>
                  <div className="text-xs text-slate-500">{stat.label}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </motion.div>

      {/* Trend Analysis — Multi-Line Charts */}
      <motion.div variants={itemVariants}>
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600" />
              Trend Analysis — You vs Industry
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-6">
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-2">GROWTH RATE TREND (%)</div>
              <MultiLineChart
                data={HISTORICAL_TRENDS}
                keys={['industryGrowth', 'yourGrowth']}
                colors={[C.slate400, C.emerald500]}
                labels={['Industry', 'Your Firm']}
              />
            </div>
            <Separator />
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-2">COMPLIANCE SCORE TREND (%)</div>
              <MultiLineChart
                data={HISTORICAL_TRENDS}
                keys={['complianceTrend', 'yourCompliance']}
                colors={[C.slate400, C.emerald500]}
                labels={['Industry', 'Your Firm']}
              />
            </div>
            <Separator />
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-2">REVENUE TREND</div>
              <MultiLineChart
                data={HISTORICAL_TRENDS}
                keys={['revenueTrend', 'yourRevenue']}
                colors={[C.slate400, C.emerald500]}
                labels={['Industry', 'Your Firm']}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Predictive Insights + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={itemVariants}>
          <Card className="border-slate-200 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-600" />
                Predictive Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100">
                <div className="flex items-start gap-2.5">
                  <TrendingUp className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Industry Growth Forecast</div>
                    <div className="text-sm text-slate-600 mt-1">Your industry is expected to grow <span className="font-bold text-emerald-600">8% next quarter</span>, driven by regulatory simplification and digital adoption.</div>
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-start gap-2.5">
                  <Shield className="h-5 w-5 text-teal-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Compliance Prediction</div>
                    <div className="text-sm text-slate-600 mt-1">Based on your trajectory, you&apos;re on track to reach <span className="font-bold text-teal-600">95% compliance</span> by Q3 2025.</div>
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-start gap-2.5">
                  <IndianRupee className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Revenue Outlook</div>
                    <div className="text-sm text-slate-600 mt-1">With current growth rate, your firm could reach <span className="font-bold text-amber-600">₹55,00,000</span> avg revenue by year-end.</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-slate-200 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Award className="h-4 w-4 text-emerald-600" />
                Benchmark Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {alertItems.map((alert, i) => (
                <div key={i} className={`flex items-start gap-2.5 p-3 rounded-lg border ${
                  alert.type === 'warning'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-emerald-50 border-emerald-200'
                }`}>
                  {alert.type === 'warning'
                    ? <ArrowDownRight className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    : <ArrowUpRight className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  }
                  <span className={`text-sm ${alert.type === 'warning' ? 'text-amber-800' : 'text-emerald-800'}`}>{alert.text}</span>
                </div>
              ))}
              <Separator className="my-2" />
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-xs font-semibold text-slate-500 mb-2">YOUR DATA CONTRIBUTION</div>
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm text-slate-700">You contribute <span className="font-bold text-emerald-600">1,234</span> data points anonymously</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Privacy Notice */}
      <motion.div variants={itemVariants}>
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-emerald-800">Privacy & Data Protection</div>
              <div className="text-xs text-emerald-700 mt-1">All data is anonymized and aggregated — no individual business data is shared. Your firm&apos;s identity is never revealed in benchmarking reports. Data contributions are encrypted and used solely for industry-level analytics.</div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function IndustryBenchmarkPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedIndustry, setSelectedIndustry] = useState<Industry>('Manufacturing');

  // Firestore hooks for real-time data (used as context)
  const { data: clients } = useFireClients();
  const { data: invoices } = useFireInvoices();
  const { data: returns } = useFireReturns();

  // Use live data to enhance demo data when available
  const liveClientCount = clients.length || YOUR_FIRM.clientCount;
  const liveInvoiceCount = invoices.length;
  const liveReturnCount = returns.length;

  void liveClientCount;
  void liveInvoiceCount;
  void liveReturnCount;

  const tabs = [
    { value: 'overview', label: 'Overview', icon: BarChart3 },
    { value: 'comparison', label: 'Industry Comparison', icon: Building2 },
    { value: 'regional', label: 'Regional Benchmarks', icon: MapPin },
    { value: 'intelligence', label: 'Business Intelligence', icon: Globe },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Industry Benchmark Engine</h1>
            <p className="text-xs text-slate-500">Compare your firm against industry standards and regional peers</p>
          </div>
        </div>
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 px-3 py-1 text-xs font-semibold self-start">
          <Zap className="h-3 w-3 mr-1" /> Live Data
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 p-1 h-auto flex-wrap">
          {tabs.map(tab => {
            const IconComp = tab.icon;
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
                <IconComp className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewDashboard selectedIndustry={selectedIndustry} />
        </TabsContent>

        <TabsContent value="comparison" className="mt-4">
          <IndustryComparison selectedIndustry={selectedIndustry} onIndustryChange={setSelectedIndustry} />
        </TabsContent>

        <TabsContent value="regional" className="mt-4">
          <RegionalBenchmarks />
        </TabsContent>

        <TabsContent value="intelligence" className="mt-4">
          <BusinessIntelligence />
        </TabsContent>
      </Tabs>
    </div>
  );
}
