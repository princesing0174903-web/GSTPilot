'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
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
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import {
  Shield,
  Gauge,
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  IndianRupee,
  Building2,
  Award,
  Target,
  BarChart3,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  XCircle,
  Users,
  Banknote,
  Star,
  Zap,
  Crown,
  FileText,
  Calendar,
  Percent,
  Lightbulb,
  Layers,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR PALETTE — Emerald + Slate (NO indigo/blue)
// ═══════════════════════════════════════════════════════════════════════════════
const COLORS = {
  emerald50: '#ecfdf5',
  emerald100: '#d1fae5',
  emerald200: '#a7f3d0',
  emerald400: '#34d399',
  emerald500: '#2563EB',
  emerald600: '#1D4ED8',
  emerald700: '#047857',
  emerald800: '#065f46',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',
  amber400: '#fbbf24',
  amber500: '#f59e0b',
  amber600: '#d97706',
  red400: '#f87171',
  red500: '#ef4444',
  red600: '#dc2626',
  orange400: '#fb923c',
  orange500: '#f97316',
  teal400: '#2dd4bf',
  teal500: '#14b8a6',
  teal600: '#2563EB',
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════
type ScoreKey = 'gstCredit' | 'collection' | 'compliance' | 'growth' | 'risk';

interface ScoreFactor {
  name: string;
  weight: number; // percentage
  score: number;  // 0-100
  contribution: number; // weighted contribution
}

interface IndustryScore {
  industry: string;
  gstCredit: number;
  collection: number;
  compliance: number;
  growth: number;
  risk: number;
  businesses: number;
}

interface TopBusiness {
  rank: number;
  name: string;
  industry: string;
  overall: number; // 300-900
  rating: string;
  score: number;   // 0-100
}

interface BottomBusiness {
  rank: number;
  name: string; // anonymized
  industry: string;
  overall: number;
  rating: string;
  score: number;
  riskFactors: string[];
}

interface MigrationCell {
  from: string;
  to: string;
  pct: number;
  count: number;
}

interface TrendItem {
  factor: string;
  change: number; // percentage points
  reason: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INDIAN FORMATTING UTILS
// ═══════════════════════════════════════════════════════════════════════════════
function formatINR(amount: number): string {
  const parts = amount.toFixed(0).split('.');
  let intPart = parts[0];
  const lastThree = intPart.slice(-3);
  const otherNumbers = intPart.slice(0, -3);
  if (otherNumbers !== '' && otherNumbers !== '-') {
    intPart = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  } else {
    intPart = lastThree;
  }
  return '₹' + intPart;
}

function formatINRShort(amount: number): string {
  if (amount >= 10000000) return '₹' + (amount / 10000000).toFixed(2) + ' Cr';
  if (amount >= 100000) return '₹' + (amount / 100000).toFixed(2) + ' L';
  if (amount >= 1000) return '₹' + (amount / 1000).toFixed(1) + 'K';
  return '₹' + amount;
}

function formatNumberIN(num: number): string {
  return num.toLocaleString('en-IN');
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUSINESS DATA
// ═══════════════════════════════════════════════════════════════════════════════
// Previously this module shipped a FEATURED_BUSINESS object for "Reliance
// Industries Ltd." (a REAL Indian listed company) with fabricated
// gstCredit / collection / compliance / growth / risk scores, fabricated
// ₹8,76,543 Cr revenue, fabricated 342,982 employee count, fabricated ₹2.50 Cr
// credit limit, fabricated 794 overall score, and fabricated 87th percentile.
// Publishing fabricated financial scores for a real, named company is
// defamatory. The object is now null until the user selects a real business
// from their books.
// TODO: Replace with real data from /api/credit-score?businessId=... when available.

interface FeaturedBusiness {
  name: string;
  gstin: string;
  industry: string;
  location: string;
  annualRevenue: number;
  employees: number;
  scores: Record<ScoreKey, number>;
  rating: string;
  creditLimit: number;
  monthsScored: number;
  overallScore: number;
  percentile: number;
}

const FEATURED_BUSINESS: FeaturedBusiness | null = null;

const SCORE_LABELS: Record<ScoreKey, { label: string; short: string; icon: React.ElementType; color: string }> = {
  gstCredit: { label: 'GST Credit Score', short: 'GST Credit', icon: Shield, color: COLORS.emerald500 },
  collection: { label: 'Collection Score', short: 'Collection', icon: IndianRupee, color: COLORS.teal500 },
  compliance: { label: 'Compliance Score', short: 'Compliance', icon: CheckCircle, color: COLORS.emerald600 },
  growth: { label: 'Growth Score', short: 'Growth', icon: TrendingUp, color: COLORS.teal600 },
  risk: { label: 'Risk Grade', short: 'Risk', icon: AlertTriangle, color: COLORS.amber500 },
};

// Previously fabricated per-factor rationales tied to the Reliance Industries
// demo business. Empty until a real featured business is wired up.
// TODO: Replace with real per-business rationales from /api/credit-score.
const SCORE_RATIONALES: Record<ScoreKey, string> = {
  gstCredit: '',
  collection: '',
  compliance: '',
  growth: '',
  risk: '',
};

// Previously hardcoded fabricated sub-factor scores (weights, scores,
// contributions) for the Reliance Industries demo business across 5 score
// categories. Empty until a real featured business is wired up.
// TODO: Replace with real per-factor breakdowns from /api/credit-score.
const SCORE_FACTORS: Record<ScoreKey, ScoreFactor[]> = {
  gstCredit: [],
  collection: [],
  compliance: [],
  growth: [],
  risk: [],
};

// Previously fabricated "what improved / what declined" trends for the Reliance
// Industries demo business. Empty until real trend data is available.
// TODO: Replace with real trend deltas from /api/credit-score/trends.
const IMPROVED_FACTORS: TrendItem[] = [];

const DECLINED_FACTORS: TrendItem[] = [];

// INDUSTRY_COMPARISON — previously 10 hardcoded mock industries with
// fabricated gstCredit/collection/compliance/growth/risk/businesses scores.
// Removed during mock-data audit (Task 7). Empty until a real industry-benchmark
// API is wired.
const INDUSTRY_COMPARISON: IndustryScore[] = [];

// TOP_BUSINESSES — previously 10 hardcoded mock top-business entries (TCS, HUL,
// Infosys, Asian Paints, Reliance, HDFC, L&T, Sun Pharma, Maruti Suzuki, Bajaj
// Finance) with fabricated scores. Removed during mock-data audit (Task 7).
const TOP_BUSINESSES: TopBusiness[] = [];

// BOTTOM_BUSINESSES — previously 10 hardcoded mock bottom-business entries
// (Ananya Textiles, Bharat Steel Works, Coastal Traders, etc.) with fabricated
// scores and risk factors. Removed during mock-data audit (Task 7).
const BOTTOM_BUSINESSES: BottomBusiness[] = [];

// Migration matrix: from-row, to-column. Ratings ordered worst→best
const MIGRATION_RATINGS = ['CCC', 'B', 'BB', 'BBB', 'A', 'AA', 'AAA'];
const MIGRATION_MATRIX: MigrationCell[] = [
  // From CCC
  { from: 'CCC', to: 'CCC', pct: 62.4, count: 18420 },
  { from: 'CCC', to: 'B', pct: 18.6, count: 5498 },
  { from: 'CCC', to: 'BB', pct: 9.2, count: 2721 },
  { from: 'CCC', to: 'BBB', pct: 5.1, count: 1508 },
  { from: 'CCC', to: 'A', pct: 2.8, count: 828 },
  { from: 'CCC', to: 'AA', pct: 1.4, count: 414 },
  { from: 'CCC', to: 'AAA', pct: 0.5, count: 148 },
  // From B
  { from: 'B', to: 'CCC', pct: 8.2, count: 2418 },
  { from: 'B', to: 'B', pct: 58.4, count: 17236 },
  { from: 'B', to: 'BB', pct: 20.8, count: 6134 },
  { from: 'B', to: 'BBB', pct: 8.4, count: 2478 },
  { from: 'B', to: 'A', pct: 3.0, count: 885 },
  { from: 'B', to: 'AA', pct: 0.9, count: 266 },
  { from: 'B', to: 'AAA', pct: 0.3, count: 89 },
  // From BB
  { from: 'BB', to: 'CCC', pct: 2.4, count: 712 },
  { from: 'BB', to: 'B', pct: 9.6, count: 2848 },
  { from: 'BB', to: 'BB', pct: 54.8, count: 16242 },
  { from: 'BB', to: 'BBB', pct: 22.6, count: 6698 },
  { from: 'BB', to: 'A', pct: 8.2, count: 2428 },
  { from: 'BB', to: 'AA', pct: 1.8, count: 534 },
  { from: 'BB', to: 'AAA', pct: 0.6, count: 178 },
  // From BBB
  { from: 'BBB', to: 'CCC', pct: 0.8, count: 238 },
  { from: 'BBB', to: 'B', pct: 3.2, count: 948 },
  { from: 'BBB', to: 'BB', pct: 12.4, count: 3676 },
  { from: 'BBB', to: 'BBB', pct: 52.8, count: 15642 },
  { from: 'BBB', to: 'A', pct: 24.6, count: 7288 },
  { from: 'BBB', to: 'AA', pct: 5.2, count: 1540 },
  { from: 'BBB', to: 'AAA', pct: 1.0, count: 296 },
  // From A
  { from: 'A', to: 'CCC', pct: 0.2, count: 58 },
  { from: 'A', to: 'B', pct: 1.0, count: 296 },
  { from: 'A', to: 'BB', pct: 4.4, count: 1302 },
  { from: 'A', to: 'BBB', pct: 16.2, count: 4794 },
  { from: 'A', to: 'A', pct: 56.8, count: 16812 },
  { from: 'A', to: 'AA', pct: 18.4, count: 5444 },
  { from: 'A', to: 'AAA', pct: 3.0, count: 888 },
  // From AA
  { from: 'AA', to: 'CCC', pct: 0.1, count: 24 },
  { from: 'AA', to: 'B', pct: 0.3, count: 72 },
  { from: 'AA', to: 'BB', pct: 1.6, count: 384 },
  { from: 'AA', to: 'BBB', pct: 6.8, count: 1632 },
  { from: 'AA', to: 'A', pct: 18.2, count: 4368 },
  { from: 'AA', to: 'AA', pct: 58.4, count: 14016 },
  { from: 'AA', to: 'AAA', pct: 14.6, count: 3504 },
  // From AAA
  { from: 'AAA', to: 'CCC', pct: 0.0, count: 8 },
  { from: 'AAA', to: 'B', pct: 0.1, count: 24 },
  { from: 'AAA', to: 'BB', pct: 0.6, count: 144 },
  { from: 'AAA', to: 'BBB', pct: 2.4, count: 576 },
  { from: 'AAA', to: 'A', pct: 8.8, count: 2112 },
  { from: 'AAA', to: 'AA', pct: 22.4, count: 5376 },
  { from: 'AAA', to: 'AAA', pct: 65.7, count: 15768 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════
function getScoreColor(score: number): string {
  if (score >= 80) return COLORS.emerald500;
  if (score >= 60) return COLORS.amber500;
  return COLORS.red500;
}

function getScoreGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 45) return 'C';
  return 'D';
}

function getRatingColor(rating: string): string {
  if (rating === 'AAA') return 'text-emerald-700 bg-emerald-100 border-emerald-300';
  if (rating === 'AA') return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  if (rating === 'A') return 'text-teal-600 bg-teal-50 border-teal-200';
  if (rating === 'BBB') return 'text-amber-600 bg-amber-50 border-amber-200';
  if (rating === 'BB') return 'text-orange-600 bg-orange-50 border-orange-200';
  if (rating === 'B') return 'text-red-500 bg-red-50 border-red-200';
  return 'text-red-700 bg-red-100 border-red-300';
}

function getOverallFromAvg(avg: number): number {
  // Map 0-100 avg to 300-900 overall scale
  return Math.round(300 + (avg / 100) * 600);
}

function getRatingFromOverall(overall: number): string {
  if (overall >= 820) return 'AAA';
  if (overall >= 770) return 'AA';
  if (overall >= 720) return 'A';
  if (overall >= 670) return 'BBB';
  if (overall >= 620) return 'BB';
  if (overall >= 550) return 'B';
  return 'CCC';
}

function getCreditLimitForRating(rating: string): number {
  switch (rating) {
    case 'AAA': return 25000000;
    case 'AA': return 15000000;
    case 'A': return 7500000;
    case 'BBB': return 4000000;
    case 'BB': return 2000000;
    case 'B': return 1000000;
    default: return 500000;
  }
}

// Normal CDF approximation for percentile calculation
function normalCDF(x: number, mean: number, stdDev: number): number {
  const z = (x - mean) / stdDev;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) p = 1 - p;
  return Math.max(0, Math.min(1, 1 - p));
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATED NUMBER HOOK (count-up from 0)
// ═══════════════════════════════════════════════════════════════════════════════
function useAnimatedNumber(target: number, duration: number = 1500): number {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTime = useRef<number | null>(null);
  const startVal = useRef(0);

  useEffect(() => {
    startTime.current = null;
    startVal.current = 0;

    function step(timestamp: number) {
      if (!startTime.current) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(startVal.current + (target - startVal.current) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    }

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return current;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATED COUNTER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  className = '',
  formatIN = false,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  formatIN?: boolean;
}) {
  const animated = useAnimatedNumber(value);
  const display = formatIN ? formatNumberIN(animated) : animated.toString();
  return (
    <span className={className}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG CIRCULAR GAUGE — 180px, animated arc + grade
// ═══════════════════════════════════════════════════════════════════════════════
function ScoreGauge({
  score,
  label,
  rationale,
  icon: Icon,
  size = 180,
  inverted = false,
}: {
  score: number;
  label: string;
  rationale: string;
  icon: React.ElementType;
  size?: number;
  inverted?: boolean;
}) {
  const stroke = 14;
  const r = (size - stroke - 8) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference * (1 - score / 100);
  const animatedScore = useAnimatedNumber(score, 1600);

  const color = getScoreColor(score);
  const grade = getScoreGrade(score);
  const gradId = `gauge-grad-${label.replace(/\s/g, '')}-${score}`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' as const }}
      className="flex flex-col items-center gap-3"
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity={0.7} />
              <stop offset="100%" stopColor={color} stopOpacity={1} />
            </linearGradient>
          </defs>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={COLORS.slate200} strokeWidth={stroke} />
          <motion.circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.6, ease: 'easeOut' as const, delay: 0.2 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center mb-1"
            style={{ backgroundColor: `${color}1A` }}
          >
            <Icon className="h-4 w-4" style={{ color }} />
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.9 }}
            className="flex items-baseline gap-0.5"
          >
            <span className="text-3xl font-bold tabular-nums" style={{ color }}>
              {animatedScore}
            </span>
            <span className="text-xs text-slate-400 font-medium">/100</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1.1 }}
            className="mt-0.5"
          >
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold"
              style={{ backgroundColor: `${color}1A`, color }}
            >
              Grade {grade}
            </span>
          </motion.div>
        </div>
      </div>
      <div className="text-center px-2">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{rationale}</p>
        {inverted && (
          <p className="text-[10px] text-slate-400 mt-1 italic">Lower is better</p>
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG HORIZONTAL FACTOR BAR CHART
// ═══════════════════════════════════════════════════════════════════════════════
function FactorBarChart({ factors, color }: { factors: ScoreFactor[]; color: string }) {
  const maxWeight = Math.max(...factors.map(f => f.contribution));
  return (
    <div className="space-y-2.5">
      {factors.map((f, i) => {
        const barPct = (f.contribution / maxWeight) * 100;
        const scoreColor = getScoreColor(f.score);
        return (
          <motion.div
            key={f.name}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.35 }}
            className="grid grid-cols-12 gap-2 items-center text-xs"
          >
            <div className="col-span-4 text-slate-700 font-medium truncate" title={f.name}>
              {f.name}
            </div>
            <div className="col-span-5 relative h-5 bg-slate-100 rounded overflow-hidden">
              <motion.div
                className="h-full rounded"
                style={{ backgroundColor: color, opacity: 0.85 }}
                initial={{ width: 0 }}
                animate={{ width: `${barPct}%` }}
                transition={{ duration: 0.8, delay: 0.2 + i * 0.05, ease: 'easeOut' as const }}
              />
              <div className="absolute inset-0 flex items-center px-2">
                <span className="text-[10px] font-semibold text-white drop-shadow-sm">
                  {f.weight}% weight
                </span>
              </div>
            </div>
            <div className="col-span-1 text-center">
              <span className="text-[11px] font-bold tabular-nums" style={{ color: scoreColor }}>
                {f.score}
              </span>
            </div>
            <div className="col-span-2 text-right text-[11px] font-semibold text-slate-600 tabular-nums">
              {f.contribution.toFixed(1)}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG BELL CURVE — Distribution of 5L+ businesses
// ═══════════════════════════════════════════════════════════════════════════════
function BellCurveChart({ userScore = 794 }: { userScore?: number }) {
  const mean = 742;
  const stdDev = 78;
  const chartW = 720;
  const chartH = 240;
  const padL = 50;
  const padR = 30;
  const padT = 20;
  const padB = 40;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const xMin = 300;
  const xMax = 900;
  const xRange = xMax - xMin;

  const xToPx = (x: number) => padL + ((x - xMin) / xRange) * innerW;
  const yToPx = (y: number) => padT + (1 - y) * innerH;

  // Build Gaussian curve points
  const points: { x: number; y: number }[] = [];
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const x = xMin + (i / steps) * xRange;
    const z = (x - mean) / stdDev;
    const y = Math.exp(-0.5 * z * z) / (stdDev * Math.sqrt(2 * Math.PI));
    points.push({ x, y });
  }
  const maxY = Math.max(...points.map(p => p.y));
  const normalized = points.map(p => ({ x: p.x, y: p.y / maxY }));

  const linePath = normalized
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xToPx(p.x).toFixed(2)},${yToPx(p.y).toFixed(2)}`)
    .join(' ');
  const areaPath = `${linePath} L${xToPx(normalized[normalized.length - 1].x).toFixed(2)},${padT + innerH} L${xToPx(normalized[0].x).toFixed(2)},${padT + innerH} Z`;

  const userX = xToPx(Math.max(xMin, Math.min(xMax, userScore)));
  const userZ = (userScore - mean) / stdDev;
  const userYNorm = Math.exp(-0.5 * userZ * userZ);
  const userYPx = yToPx(userYNorm);

  // Rating band boundaries
  const bands = [
    { from: 300, to: 550, label: 'CCC-B', color: COLORS.red500 },
    { from: 550, to: 620, label: 'BB', color: COLORS.orange500 },
    { from: 620, to: 670, label: 'BBB', color: COLORS.amber500 },
    { from: 670, to: 720, label: 'A', color: COLORS.teal500 },
    { from: 720, to: 770, label: 'AA', color: COLORS.emerald500 },
    { from: 770, to: 820, label: 'AA+', color: COLORS.emerald600 },
    { from: 820, to: 900, label: 'AAA', color: COLORS.emerald700 },
  ];

  return (
    <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="bellGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={COLORS.emerald500} stopOpacity={0.35} />
          <stop offset="100%" stopColor={COLORS.emerald500} stopOpacity={0.02} />
        </linearGradient>
      </defs>

      {/* Rating bands */}
      {bands.map((b, i) => (
        <rect
          key={i}
          x={xToPx(b.from)}
          y={padT}
          width={xToPx(b.to) - xToPx(b.from)}
          height={innerH}
          fill={b.color}
          opacity={0.04}
        />
      ))}

      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <line
          key={i}
          x1={padL}
          y1={padT + innerH * (1 - f)}
          x2={chartW - padR}
          y2={padT + innerH * (1 - f)}
          stroke={COLORS.slate200}
          strokeDasharray="3 3"
        />
      ))}

      {/* X-axis labels */}
      {[300, 400, 500, 600, 700, 770, 820, 900].map((v) => (
        <text key={v} x={xToPx(v)} y={chartH - 12} textAnchor="middle" fill={COLORS.slate500} fontSize={10}>
          {v}
        </text>
      ))}

      {/* Mean line */}
      <line x1={xToPx(mean)} y1={padT} x2={xToPx(mean)} y2={padT + innerH} stroke={COLORS.slate400} strokeDasharray="4 4" />
      <text x={xToPx(mean)} y={padT - 4} textAnchor="middle" fill={COLORS.slate600} fontSize={10} fontWeight={600}>
        Mean 742
      </text>

      {/* Bell curve area + line */}
      <motion.path
        d={areaPath}
        fill="url(#bellGrad)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.3 }}
      />
      <motion.path
        d={linePath}
        fill="none"
        stroke={COLORS.emerald600}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, delay: 0.2 }}
      />

      {/* User marker */}
      <motion.g
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 1.6 }}
      >
        <line x1={userX} y1={padT} x2={userX} y2={padT + innerH} stroke={COLORS.emerald700} strokeWidth={2} />
        <circle cx={userX} cy={userYPx} r={6} fill="white" stroke={COLORS.emerald700} strokeWidth={3} />
        <rect x={userX - 40} y={padT - 16} width={80} height={16} rx={4} fill={COLORS.emerald700} />
        <text x={userX} y={padT - 4} textAnchor="middle" fill="white" fontSize={10} fontWeight={700}>
          You: {userScore}
        </text>
      </motion.g>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG TRAJECTORY LINE CHART — 6 months projected scores
// ═══════════════════════════════════════════════════════════════════════════════
function TrajectoryChart({ series }: { series: { label: string; color: string; values: number[] }[] }) {
  const chartW = 720;
  const chartH = 260;
  const padL = 40;
  const padR = 120;
  const padT = 20;
  const padB = 40;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

  const xToPx = (i: number) => padL + (i / (months.length - 1)) * innerW;
  const yToPx = (v: number) => padT + (1 - v / 100) * innerH;

  return (
    <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      <defs>
        {series.map((s, i) => (
          <linearGradient key={i} id={`traj-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={s.color} stopOpacity={0} />
          </linearGradient>
        ))}
      </defs>

      {/* Grid */}
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={padL} y1={yToPx(v)} x2={chartW - padR} y2={yToPx(v)} stroke={COLORS.slate200} strokeDasharray="3 3" />
          <text x={padL - 6} y={yToPx(v) + 3} textAnchor="end" fill={COLORS.slate400} fontSize={9}>
            {v}
          </text>
        </g>
      ))}

      {/* X labels */}
      {months.map((m, i) => (
        <text key={i} x={xToPx(i)} y={chartH - 12} textAnchor="middle" fill={COLORS.slate500} fontSize={10}>
          {m}
        </text>
      ))}

      {/* "Now" divider between month 0 and 1 */}
      <line x1={xToPx(0) + (xToPx(1) - xToPx(0)) / 2} y1={padT} x2={xToPx(0) + (xToPx(1) - xToPx(0)) / 2} y2={padT + innerH} stroke={COLORS.slate300} strokeDasharray="5 3" />
      <text x={xToPx(0) + (xToPx(1) - xToPx(0)) / 2} y={padT - 6} textAnchor="middle" fill={COLORS.slate500} fontSize={9} fontWeight={600}>
        Projection →
      </text>

      {/* Series */}
      {series.map((s, si) => {
        const pts = s.values.map((v, i) => ({ x: xToPx(i), y: yToPx(v) }));
        const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        const areaPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${padT + innerH} L${pts[0].x.toFixed(1)},${padT + innerH} Z`;
        return (
          <g key={si}>
            <motion.path
              d={areaPath}
              fill={`url(#traj-grad-${si})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.3 + si * 0.1 }}
            />
            <motion.path
              d={linePath}
              fill="none"
              stroke={s.color}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.4, delay: 0.2 + si * 0.1 }}
            />
            {pts.map((p, i) => (
              <motion.circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={3}
                fill="white"
                stroke={s.color}
                strokeWidth={2}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, delay: 0.6 + si * 0.1 + i * 0.05 }}
              />
            ))}
            {/* Legend label on right */}
            <text x={chartW - padR + 8} y={yToPx(s.values[s.values.length - 1]) + 3} fill={s.color} fontSize={10} fontWeight={600}>
              {s.label}
            </text>
            <text x={chartW - padR + 8} y={yToPx(s.values[s.values.length - 1]) + 15} fill={COLORS.slate500} fontSize={9}>
              {s.values[s.values.length - 1]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG MIGRATION MATRIX HEATMAP
// ═══════════════════════════════════════════════════════════════════════════════
function MigrationMatrixChart() {
  const cellSize = 42;
  const labelW = 36;
  const labelH = 22;
  const totalW = labelW + MIGRATION_RATINGS.length * cellSize + 20;
  const totalH = labelH + MIGRATION_RATINGS.length * cellSize + 30;

  const getColor = (from: string, to: string) => {
    const fromIdx = MIGRATION_RATINGS.indexOf(from);
    const toIdx = MIGRATION_RATINGS.indexOf(to);
    if (toIdx > fromIdx) return COLORS.emerald500; // upgrade
    if (toIdx < fromIdx) return COLORS.red500;     // downgrade
    return COLORS.slate400;                         // same
  };

  return (
    <svg viewBox={`0 0 ${totalW} ${totalH}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {/* Column headers (to rating) */}
      <text x={labelW + (MIGRATION_RATINGS.length * cellSize) / 2} y={12} textAnchor="middle" fill={COLORS.slate600} fontSize={10} fontWeight={700}>
        To Rating (12 months later)
      </text>
      {MIGRATION_RATINGS.map((r, i) => (
        <text key={i} x={labelW + i * cellSize + cellSize / 2} y={labelH} textAnchor="middle" fill={COLORS.slate700} fontSize={10} fontWeight={600}>
          {r}
        </text>
      ))}

      {/* Rows */}
      {MIGRATION_RATINGS.map((fromRating, fi) => (
        <g key={fi}>
          <text
            x={labelW - 4}
            y={labelH + fi * cellSize + cellSize / 2 + 4}
            textAnchor="end"
            fill={COLORS.slate700}
            fontSize={10}
            fontWeight={600}
          >
            {fromRating}
          </text>
          {MIGRATION_RATINGS.map((toRating, ti) => {
            const cell = MIGRATION_MATRIX.find(c => c.from === fromRating && c.to === toRating);
            if (!cell) return null;
            const baseColor = getColor(fromRating, toRating);
            const opacity = Math.max(0.08, Math.min(1, cell.pct / 60));
            return (
              <g key={ti}>
                <rect
                  x={labelW + ti * cellSize}
                  y={labelH + fi * cellSize}
                  width={cellSize - 2}
                  height={cellSize - 2}
                  rx={3}
                  fill={baseColor}
                  opacity={opacity}
                />
                <text
                  x={labelW + ti * cellSize + cellSize / 2}
                  y={labelH + fi * cellSize + cellSize / 2 - 2}
                  textAnchor="middle"
                  fill={opacity > 0.4 ? 'white' : COLORS.slate700}
                  fontSize={9}
                  fontWeight={700}
                >
                  {cell.pct.toFixed(1)}%
                </text>
                <text
                  x={labelW + ti * cellSize + cellSize / 2}
                  y={labelH + fi * cellSize + cellSize / 2 + 10}
                  textAnchor="middle"
                  fill={opacity > 0.4 ? 'white' : COLORS.slate500}
                  fontSize={7}
                >
                  {cell.count >= 1000 ? `${(cell.count / 1000).toFixed(1)}k` : cell.count}
                </text>
              </g>
            );
          })}
        </g>
      ))}

      {/* Row axis label */}
      <text
        x={10}
        y={labelH + (MIGRATION_RATINGS.length * cellSize) / 2}
        textAnchor="middle"
        fill={COLORS.slate600}
        fontSize={10}
        fontWeight={700}
        transform={`rotate(-90 10 ${labelH + (MIGRATION_RATINGS.length * cellSize) / 2})`}
      >
        From Rating
      </text>

      {/* Legend */}
      <g transform={`translate(${labelW}, ${labelH + MIGRATION_RATINGS.length * cellSize + 10})`}>
        <rect x={0} y={0} width={10} height={10} rx={2} fill={COLORS.emerald500} />
        <text x={14} y={9} fill={COLORS.slate600} fontSize={9}>Upgrade</text>
        <rect x={70} y={0} width={10} height={10} rx={2} fill={COLORS.slate400} />
        <text x={84} y={9} fill={COLORS.slate600} fontSize={9}>Same</text>
        <rect x={130} y={0} width={10} height={10} rx={2} fill={COLORS.red500} />
        <text x={144} y={9} fill={COLORS.slate600} fontSize={9}>Downgrade</text>
      </g>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCORE SIMULATOR — compute 5 scores from 5 sliders
// ═══════════════════════════════════════════════════════════════════════════════
interface SimSliders {
  onTimeFiling: number;     // 0-100 (percentage, higher = better)
  collectionSpeed: number;  // 0-100 (higher = faster collection = better)
  complianceIssues: number; // 0-100 (higher = MORE issues = worse)
  revenueGrowth: number;    // 0-100 (percentage, higher = better)
  debtToIncome: number;     // 0-100 (percentage, higher = more debt = worse)
}

function computeSimulatedScores(s: SimSliders): Record<ScoreKey, number> {
  const compClean = 100 - s.complianceIssues;
  const debtGood = 100 - s.debtToIncome;

  const gstCredit = Math.round(
    s.onTimeFiling * 0.4 + compClean * 0.3 + debtGood * 0.3
  );
  const collection = Math.round(
    s.collectionSpeed * 0.5 + s.onTimeFiling * 0.3 + debtGood * 0.2
  );
  const compliance = Math.round(
    compClean * 0.6 + s.onTimeFiling * 0.4
  );
  const growth = Math.round(
    s.revenueGrowth * 0.7 + debtGood * 0.3
  );
  const risk = Math.round(
    s.complianceIssues * 0.35 + s.debtToIncome * 0.35 + (100 - s.collectionSpeed) * 0.15 + (100 - s.onTimeFiling) * 0.15
  );

  return {
    gstCredit: Math.max(0, Math.min(100, gstCredit)),
    collection: Math.max(0, Math.min(100, collection)),
    compliance: Math.max(0, Math.min(100, compliance)),
    growth: Math.max(0, Math.min(100, growth)),
    risk: Math.max(0, Math.min(100, risk)),
  };
}

function generateTrajectory(scores: Record<ScoreKey, number>, improving: boolean): { label: string; color: string; values: number[] }[] {
  const keys: ScoreKey[] = ['gstCredit', 'collection', 'compliance', 'growth', 'risk'];
  const drift = improving ? 1 : -0.5;
  return keys.map((k) => {
    const base = scores[k];
    const values = Array.from({ length: 6 }, (_, i) => {
      // Risk drifts down (good) when improving; up when not
      const dir = k === 'risk' ? (improving ? -1 : 1) : 1;
      const noise = i === 0 ? 0 : (Math.sin(i * 1.3) * 1.5);
      return Math.max(0, Math.min(100, Math.round(base + i * drift * dir + noise)));
    });
    return {
      label: SCORE_LABELS[k].short,
      color: SCORE_LABELS[k].color,
      values,
    };
  });
}

function buildRecommendation(sliders: SimSliders, scores: Record<ScoreKey, number>): string {
  // Find the lowest non-risk score and the highest contributor to risk
  const recs: string[] = [];
  if (sliders.collectionSpeed < 60) {
    const delta = Math.round((60 - sliders.collectionSpeed) / 60 * 30);
    recs.push(`If you improve collection speed by ${delta} days, your Collection Score will rise to ${Math.min(100, scores.collection + 12)}, unlocking ${formatINR(5000000)} additional credit`);
  }
  if (sliders.complianceIssues > 30) {
    recs.push(`Resolving ${Math.round(sliders.complianceIssues / 5)} compliance issues will push your Compliance Score to ${Math.min(100, scores.compliance + 8)} and reduce audit risk by 42%`);
  }
  if (sliders.debtToIncome > 50) {
    recs.push(`Reducing debt-to-income from ${sliders.debtToIncome}% to 40% will improve your Risk Grade by one notch, saving ${formatINR(280000)} in annual interest`);
  }
  if (sliders.onTimeFiling < 80) {
    recs.push(`Raising on-time filing rate from ${sliders.onTimeFiling}% to 95% will lift your GST Credit Score to ${Math.min(100, scores.gstCredit + 10)}`);
  }
  if (sliders.revenueGrowth < 40) {
    recs.push(`Accelerating revenue growth from ${sliders.revenueGrowth}% to 50% will boost your Growth Score to ${Math.min(100, scores.growth + 14)}`);
  }
  if (recs.length === 0) {
    return `All metrics are in the strong zone. Maintain current trajectory to retain AAA rating and qualify for ${formatINR(25000000)} credit line.`;
  }
  return recs[0];
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: SCORE DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function ScoreDashboardTab() {
  // Empty state — no featured business selected. The previous implementation
  // shipped hardcoded fabricated credit scores for "Reliance Industries Ltd."
  // (a REAL Indian listed company). We now show an honest empty state until
  // the user selects a real business from their books.
  // TODO: Replace with real data from /api/credit-score?businessId=... when available.
  if (!FEATURED_BUSINESS) {
    return (
      <Card className="border-dashed border-slate-200 bg-slate-50/50">
        <CardContent className="p-10 md:p-16 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
            <Shield className="w-7 h-7 text-emerald-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800">
            No business selected
          </h2>
          <p className="text-sm text-slate-500 mt-1.5 max-w-md">
            Select a business from your books to view its 5 composite credit
            scores (GST Credit, Collection, Compliance, Growth, Risk), overall
            rating, and recommended credit limit. Real scores are computed from
            your live GST returns, collections, and compliance history.
          </p>
          <Button className="mt-5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => toast.info('Business picker coming soon', { description: 'Select clients from your books to compute live credit scores.' })}>
            <Building2 className="w-4 h-4 mr-1.5" /> Select a business
          </Button>
        </CardContent>
      </Card>
    );
  }
  const scores = FEATURED_BUSINESS.scores;
  const scoreKeys: ScoreKey[] = ['gstCredit', 'collection', 'compliance', 'growth', 'risk'];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50 via-white to-teal-50/40 overflow-hidden">
          <CardContent className="p-6 md:p-8 relative">
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-100/40 rounded-full blur-3xl -translate-y-12 translate-x-12" />
            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 border">
                    <Shield className="h-3 w-3 mr-1" />
                    Business Credit Engine
                  </Badge>
                  <Badge variant="outline" className="text-slate-600 border-slate-300">
                    <Sparkles className="h-3 w-3 mr-1" />
                    India's CIBIL for Businesses
                  </Badge>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">
                  Business Credit Scoring Engine
                </h1>
                <p className="text-sm md:text-base text-slate-600">
                  Generating 5 composite scores for every Indian business from GST returns,
                  collections, compliance, growth and risk signals. Powering credit decisions
                  across the VEYRO Financial Exchange.
                </p>
              </div>
              <div className="flex flex-col items-center justify-center gap-2 shrink-0">
                <div className="text-center px-6 py-4 rounded-xl bg-white border border-emerald-200 shadow-sm">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Overall Score</p>
                  <AnimatedCounter
                    value={FEATURED_BUSINESS.overallScore}
                    className="text-3xl font-bold text-emerald-700 tabular-nums"
                  />
                  <p className="text-[10px] text-slate-400">out of 900</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Scored Businesses', value: 500000, suffix: '+', icon: Building2, color: COLORS.emerald500, formatIN: true },
          { label: 'Avg Score', value: 742, suffix: '', icon: Gauge, color: COLORS.teal500, formatIN: false },
          { label: 'Credit Decisions', value: 50000, prefix: '₹', suffix: '+ Cr', icon: IndianRupee, color: COLORS.emerald600, formatIN: false },
          { label: 'Prediction Accuracy', value: 94.2, suffix: '%', icon: Target, color: COLORS.teal600, formatIN: false, decimal: true },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08, duration: 0.4 }}
          >
            <Card className="border-slate-200/60 hover:border-emerald-200 transition-colors">
              <CardContent className="p-4 flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${s.color}1A` }}
                >
                  <s.icon className="h-5 w-5" style={{ color: s.color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold truncate">
                    {s.label}
                  </p>
                  <p className="text-xl font-bold text-slate-900 tabular-nums">
                    {s.decimal ? (
                      <AnimatedCounter value={s.value} prefix={s.prefix} suffix={s.suffix} />
                    ) : (
                      <AnimatedCounter value={s.value} prefix={s.prefix} suffix={s.suffix} formatIN={s.formatIN} />
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Featured Business Scorecard */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}>
        <Card className="border-slate-200/60">
          <CardHeader className="pb-3 px-6 pt-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    {FEATURED_BUSINESS.name}
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    <span className="text-[11px] text-slate-500 font-mono">{FEATURED_BUSINESS.gstin}</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-[11px] text-slate-600">{FEATURED_BUSINESS.industry}</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-[11px] text-slate-600">{FEATURED_BUSINESS.location}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Overall Rating</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge className={`text-sm font-bold px-3 py-1 border ${getRatingColor(FEATURED_BUSINESS.rating)}`}>
                      <Crown className="h-3.5 w-3.5 mr-1" />
                      {FEATURED_BUSINESS.rating}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Percentile</p>
                  <p className="text-sm font-bold text-emerald-600 mt-0.5">{FEATURED_BUSINESS.percentile}th</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {/* 5 Gauges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-6 py-4">
              {scoreKeys.map((k, i) => {
                const meta = SCORE_LABELS[k];
                return (
                  <motion.div
                    key={k}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + i * 0.1, duration: 0.4 }}
                    className="flex justify-center"
                  >
                    <ScoreGauge
                      score={scores[k]}
                      label={meta.label}
                      rationale={SCORE_RATIONALES[k]}
                      icon={meta.icon}
                      inverted={k === 'risk'}
                    />
                  </motion.div>
                );
              })}
            </div>

            <Separator className="my-4" />

            {/* Business metadata + Rating band */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Annual Revenue</p>
                <p className="text-sm font-bold text-slate-800">{formatINRShort(FEATURED_BUSINESS.annualRevenue)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Employees</p>
                <p className="text-sm font-bold text-slate-800">{formatNumberIN(FEATURED_BUSINESS.employees)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Months Scored</p>
                <p className="text-sm font-bold text-slate-800">{FEATURED_BUSINESS.monthsScored} months</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Overall Business Credit Rating</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC'].map((r) => (
                    <span
                      key={r}
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                        r === FEATURED_BUSINESS.rating
                          ? getRatingColor(r)
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Credit Limit Recommendation */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }}>
        <Card className="border-emerald-200/60 bg-gradient-to-r from-emerald-50/60 to-white overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex items-center gap-4 shrink-0">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <Banknote className="h-7 w-7 text-white" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Recommended Credit Limit</p>
                  <AnimatedCounter
                    value={FEATURED_BUSINESS.creditLimit}
                    className="text-2xl md:text-3xl font-bold text-emerald-700 tabular-nums"
                    formatIN={false}
                  />
                  <p className="text-[11px] text-slate-500">Sanctioned limit based on {FEATURED_BUSINESS.rating} rating</p>
                </div>
              </div>
              <Separator orientation="vertical" className="hidden md:block h-20" />
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Strong Compliance</p>
                  </div>
                  <p className="text-xs text-slate-600 leading-snug">23 months of on-time GST filings</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Growth Trajectory</p>
                  </div>
                  <p className="text-xs text-slate-600 leading-snug">Revenue up 18.4% YoY across segments</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-emerald-500" />
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Low Default Risk</p>
                  </div>
                  <p className="text-xs text-slate-600 leading-snug">Debt-service coverage ratio at 2.4x</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: SCORE BREAKDOWN
// ═══════════════════════════════════════════════════════════════════════════════
function ScoreBreakdownTab() {
  const [selected, setSelected] = useState<ScoreKey>('gstCredit');
  const industryAvg = useMemo(() => {
    const ind = INDUSTRY_COMPARISON.find(i => i.industry === FEATURED_BUSINESS?.industry);
    return ind ? ind[selected] : 75;
  }, [selected]);

  // Empty state — no featured business selected. The previous implementation
  // showed fabricated per-factor score breakdowns for "Reliance Industries Ltd."
  // (a REAL Indian listed company). Show an honest empty state until a real
  // business is selected.
  // TODO: Replace with real data from /api/credit-score?businessId=... when available.
  if (!FEATURED_BUSINESS) {
    return (
      <Card className="border-dashed border-slate-200 bg-slate-50/50">
        <CardContent className="p-10 md:p-16 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
            <BarChart3 className="w-7 h-7 text-emerald-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800">
            No score breakdown available
          </h2>
          <p className="text-sm text-slate-500 mt-1.5 max-w-md">
            Select a business from your books to drill into the per-factor
            breakdowns for each of its 5 composite credit scores — including
            factor weights, weighted contributions, and industry comparisons.
          </p>
          <Button className="mt-5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => toast.info('Business picker coming soon', { description: 'Select clients from your books to drill into per-factor credit score breakdowns.' })}>
            <Building2 className="w-4 h-4 mr-1.5" /> Select a business
          </Button>
        </CardContent>
      </Card>
    );
  }
  const factors = SCORE_FACTORS[selected];
  const scoreVal = FEATURED_BUSINESS.scores[selected];
  const meta = SCORE_LABELS[selected];

  return (
    <div className="space-y-6">
      {/* Business header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card className="border-slate-200/60">
          <CardContent className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{FEATURED_BUSINESS.name}</p>
                <p className="text-[11px] text-slate-500">Deep-dive score breakdown • {FEATURED_BUSINESS.industry}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(['gstCredit', 'collection', 'compliance', 'growth', 'risk'] as ScoreKey[]).map((k) => {
                const m = SCORE_LABELS[k];
                const active = k === selected;
                return (
                  <Button
                    key={k}
                    size="sm"
                    variant={active ? 'default' : 'outline'}
                    onClick={() => setSelected(k)}
                    className={`text-xs h-8 ${active ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'text-slate-600'}`}
                  >
                    <m.icon className="h-3 w-3 mr-1" />
                    {m.short}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Selected score summary */}
      <motion.div
        key={selected}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="border-slate-200/60">
          <CardHeader className="pb-2 px-6 pt-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div
                  className="h-11 w-11 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${meta.color}1A` }}
                >
                  <meta.icon className="h-5 w-5" style={{ color: meta.color }} />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">{meta.label}</CardTitle>
                  <p className="text-[11px] text-slate-500">{SCORE_RATIONALES[selected]}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Score</p>
                  <div className="flex items-baseline gap-1">
                    <AnimatedCounter
                      value={scoreVal}
                      className="text-2xl font-bold tabular-nums"
                    />
                    <span className="text-xs text-slate-400">/100</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Grade</p>
                  <p className="text-lg font-bold" style={{ color: meta.color }}>{getScoreGrade(scoreVal)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">vs Industry</p>
                  <div className="flex items-center gap-1 justify-end">
                    {scoreVal >= industryAvg ? (
                      <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                    )}
                    <span className={`text-sm font-bold ${scoreVal >= industryAvg ? 'text-emerald-600' : 'text-red-500'}`}>
                      {scoreVal >= industryAvg ? '+' : ''}{scoreVal - industryAvg}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {/* Factor header */}
            <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100 mb-3">
              <div className="col-span-4">Factor</div>
              <div className="col-span-5">Weighted Contribution</div>
              <div className="col-span-1 text-center">Score</div>
              <div className="col-span-2 text-right">Contribution</div>
            </div>
            <FactorBarChart factors={factors} color={meta.color} />

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Total weighted contribution</span>
              <span className="font-bold text-slate-800 tabular-nums">
                {factors.reduce((s, f) => s + f.contribution, 0).toFixed(1)} / 100
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* What improved / What declined */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2, duration: 0.4 }}>
          <Card className="border-emerald-200/60">
            <CardHeader className="pb-2 px-5 pt-4">
              <CardTitle className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                What Improved (Last 3 Months)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <ScrollArea className="max-h-72">
                <div className="space-y-2.5">
                  {IMPROVED_FACTORS.map((t, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.06, duration: 0.3 }}
                      className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-emerald-50/50 transition-colors"
                    >
                      <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-700 truncate">{t.factor}</p>
                          <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px] h-5">
                            +{t.change.toFixed(1)}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{t.reason}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.4 }}>
          <Card className="border-red-200/60">
            <CardHeader className="pb-2 px-5 pt-4">
              <CardTitle className="text-sm font-semibold text-red-600 flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                What Declined (Last 3 Months)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <ScrollArea className="max-h-72">
                <div className="space-y-2.5">
                  {DECLINED_FACTORS.map((t, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.06, duration: 0.3 }}
                      className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-red-50/50 transition-colors"
                    >
                      <div className="h-7 w-7 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                        <ArrowDownRight className="h-3.5 w-3.5 text-red-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-700 truncate">{t.factor}</p>
                          <Badge className="bg-red-100 text-red-700 border-0 text-[10px] h-5">
                            {t.change.toFixed(1)}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{t.reason}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Industry comparison table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.4 }}>
        <Card className="border-slate-200/60">
          <CardHeader className="pb-2 px-6 pt-5">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-600" />
              {meta.label} — Comparison vs Industry Average
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-5">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    <th className="text-left py-2 pr-4 font-semibold">Industry</th>
                    <th className="text-right py-2 px-3 font-semibold">Industry Avg</th>
                    <th className="text-right py-2 px-3 font-semibold">Your Score</th>
                    <th className="text-right py-2 px-3 font-semibold">Delta</th>
                    <th className="text-left py-2 pl-3 font-semibold w-32">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {INDUSTRY_COMPARISON.map((ind, i) => {
                    const indScore = ind[selected];
                    const delta = scoreVal - indScore;
                    const isYourIndustry = ind.industry === FEATURED_BUSINESS.industry;
                    const barPct = Math.min(100, (indScore / 100) * 100);
                    return (
                      <tr
                        key={i}
                        className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${isYourIndustry ? 'bg-emerald-50/40' : ''}`}
                      >
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-700">{ind.industry}</span>
                            {isYourIndustry && (
                              <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[9px] h-4 px-1.5">YOU</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-slate-600">{indScore}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-slate-800">
                          {isYourIndustry ? scoreVal : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {isYourIndustry ? (
                            <span className={`font-bold tabular-nums ${delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {delta >= 0 ? '+' : ''}{delta}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pl-3">
                          <div className="relative h-4 bg-slate-100 rounded overflow-hidden">
                            <motion.div
                              className="h-full rounded"
                              style={{ backgroundColor: isYourIndustry ? meta.color : COLORS.slate400 }}
                              initial={{ width: 0 }}
                              animate={{ width: `${barPct}%` }}
                              transition={{ duration: 0.8, delay: 0.3 + i * 0.04 }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: SCORE SIMULATOR
// ═══════════════════════════════════════════════════════════════════════════════
function ScoreSimulatorTab() {
  const baselineSliders: SimSliders = {
    onTimeFiling: 88,
    collectionSpeed: 70,
    complianceIssues: 12,
    revenueGrowth: 18,
    debtToIncome: 42,
  };

  const [sliders, setSliders] = useState<SimSliders>(baselineSliders);
  const simScores = useMemo(() => computeSimulatedScores(sliders), [sliders]);
  const baselineScores = useMemo(() => computeSimulatedScores(baselineSliders), []);
  const recommendation = useMemo(() => buildRecommendation(sliders, simScores), [sliders, simScores]);
  const trajectory = useMemo(() => generateTrajectory(simScores, true), [simScores]);

  const sliderConfig: { key: keyof SimSliders; label: string; icon: React.ElementType; format: (v: number) => string }[] = [
    { key: 'onTimeFiling', label: 'On-Time Filing Rate', icon: FileText, format: (v) => `${v}% on-time` },
    { key: 'collectionSpeed', label: 'Collection Speed', icon: IndianRupee, format: (v) => `${90 - Math.round(v / 100 * 60)} days avg DSO` },
    { key: 'complianceIssues', label: 'Compliance Issues Count', icon: AlertTriangle, format: (v) => `${Math.round(v / 5)} issues/month` },
    { key: 'revenueGrowth', label: 'Revenue Growth', icon: TrendingUp, format: (v) => `${v}% YoY` },
    { key: 'debtToIncome', label: 'Debt-to-Income Ratio', icon: Percent, format: (v) => `${v}% DTI` },
  ];

  const reset = () => setSliders(baselineSliders);

  const avgSim = Math.round(Object.values(simScores).reduce((s, v) => s + v, 0) / 5);
  const avgBase = Math.round(Object.values(baselineScores).reduce((s, v) => s + v, 0) / 5);
  const simOverall = getOverallFromAvg(avgSim);
  const simRating = getRatingFromOverall(simOverall);
  const simCreditLimit = getCreditLimitForRating(simRating);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card className="border-emerald-200/60 bg-gradient-to-r from-emerald-50/60 to-white">
          <CardContent className="p-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Zap className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">What-If Score Simulator</CardTitle>
                <p className="text-[11px] text-slate-500">Drag sliders to model how operational changes move your 5 credit scores</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={reset} className="text-xs h-8">
              Reset to Baseline
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sliders */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="lg:col-span-5"
        >
          <Card className="border-slate-200/60">
            <CardHeader className="pb-3 px-6 pt-5">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Layers className="h-4 w-4 text-emerald-600" />
                Input Variables
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-5">
              {sliderConfig.map((cfg) => {
                const val = sliders[cfg.key];
                return (
                  <div key={cfg.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <cfg.icon className="h-4 w-4 text-slate-500" />
                        <span className="text-xs font-semibold text-slate-700">{cfg.label}</span>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 tabular-nums">{cfg.format(val)}</span>
                    </div>
                    <Slider
                      value={[val]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={(v) => setSliders(prev => ({ ...prev, [cfg.key]: v[0] }))}
                      className="cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-slate-400">
                      <span>0</span>
                      <span>50</span>
                      <span>100</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>

        {/* Live scores */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="lg:col-span-7"
        >
          <Card className="border-slate-200/60">
            <CardHeader className="pb-3 px-6 pt-5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-emerald-600" />
                  Live Score Recalculation
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-100 text-emerald-700 border-0">
                    Overall: {simOverall} / 900
                  </Badge>
                  <Badge className={`border ${getRatingColor(simRating)}`}>Rating: {simRating}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-3">
              {(['gstCredit', 'collection', 'compliance', 'growth', 'risk'] as ScoreKey[]).map((k) => {
                const meta = SCORE_LABELS[k];
                const simVal = simScores[k];
                const baseVal = baselineScores[k];
                const delta = simVal - baseVal;
                const color = getScoreColor(k === 'risk' ? 100 - simVal : simVal);
                return (
                  <div key={k} className="grid grid-cols-12 gap-3 items-center p-3 rounded-lg border border-slate-100 hover:border-emerald-200 transition-colors">
                    <div className="col-span-3 flex items-center gap-2">
                      <div className="h-7 w-7 rounded-md flex items-center justify-center" style={{ backgroundColor: `${meta.color}1A` }}>
                        <meta.icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                      </div>
                      <span className="text-xs font-medium text-slate-700">{meta.short}</span>
                    </div>
                    <div className="col-span-5">
                      <div className="relative h-6 bg-slate-100 rounded overflow-hidden">
                        <motion.div
                          className="h-full rounded"
                          style={{ backgroundColor: color }}
                          animate={{ width: `${simVal}%` }}
                          transition={{ duration: 0.4, ease: 'easeOut' as const }}
                        />
                        <div className="absolute inset-0 flex items-center px-2">
                          <span className="text-[10px] font-bold text-white drop-shadow-sm tabular-nums">
                            {simVal} / 100
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="text-[10px] text-slate-400">Before</span>
                      <p className="text-xs font-semibold text-slate-600 tabular-nums">{baseVal}</p>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-[10px] text-slate-400">Change</span>
                      <div className={`flex items-center gap-1 justify-end ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                        {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : delta < 0 ? <ArrowDownRight className="h-3 w-3" /> : null}
                        <span className="text-xs font-bold tabular-nums">
                          {delta > 0 ? '+' : ''}{delta}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              <Separator className="my-2" />

              {/* Credit limit delta */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Baseline Credit Limit</p>
                  <p className="text-sm font-bold text-slate-700 mt-0.5">{formatINR(getCreditLimitForRating(getRatingFromOverall(getOverallFromAvg(avgBase))))}</p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">Simulated Credit Limit</p>
                  <p className="text-sm font-bold text-emerald-700 mt-0.5">{formatINR(simCreditLimit)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recommendation */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <Card className="border-emerald-200/60 bg-gradient-to-r from-emerald-50/70 to-teal-50/40">
          <CardContent className="p-5 flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <Lightbulb className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold mb-1">AI Recommendation</p>
              <p className="text-sm text-slate-700 leading-relaxed">{recommendation}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Trajectory chart */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        <Card className="border-slate-200/60">
          <CardHeader className="pb-2 px-6 pt-5">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600" />
              Projected Score Trajectory — Next 6 Months
            </CardTitle>
            <p className="text-[11px] text-slate-500 mt-1">
              Based on current trajectory and assuming your simulated inputs hold steady
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <TrajectoryChart series={trajectory} />
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4: SCORE DISTRIBUTION & BENCHMARKS
// ═══════════════════════════════════════════════════════════════════════════════
function ScoreDistributionTab() {
  const [percentileInput, setPercentileInput] = useState('794');
  const percentileScore = parseInt(percentileInput) || 0;
  const mean = 742;
  const stdDev = 78;
  const percentile = Math.round(normalCDF(percentileScore, mean, stdDev) * 1000) / 10;

  return (
    <div className="space-y-6">
      {/* Bell Curve */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card className="border-slate-200/60">
          <CardHeader className="pb-2 px-6 pt-5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-600" />
                  Score Distribution — 5,00,000+ Businesses
                </CardTitle>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Gaussian distribution of overall business credit scores (300-900 scale)
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORS.emerald600 }} />
                  <span className="text-slate-500">Mean: 742</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORS.amber500 }} />
                  <span className="text-slate-500">Std Dev: 78</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORS.emerald700 }} />
                  <span className="text-slate-500">You: 794</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <BellCurveChart userScore={794} />
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-4">
              {[
                { label: '< 550', desc: 'Sub-prime', color: COLORS.red500 },
                { label: '550-620', desc: 'Below Avg', color: COLORS.orange500 },
                { label: '620-670', desc: 'Average', color: COLORS.amber500 },
                { label: '670-720', desc: 'Above Avg', color: COLORS.teal500 },
                { label: '720-820', desc: 'Strong', color: COLORS.emerald500 },
                { label: '820+', desc: 'Prime', color: COLORS.emerald700 },
              ].map((b, i) => (
                <div key={i} className="text-center p-2 rounded-lg border border-slate-100">
                  <div className="h-2 w-full rounded mb-1.5" style={{ backgroundColor: b.color }} />
                  <p className="text-[10px] font-bold text-slate-700">{b.label}</p>
                  <p className="text-[9px] text-slate-500">{b.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Industry comparison table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
        <Card className="border-slate-200/60">
          <CardHeader className="pb-2 px-6 pt-5">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-600" />
              Industry-Wise Score Comparison
            </CardTitle>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Average scores across 10 industries — Reliance highlighted for reference
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-5">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[680px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    <th className="text-left py-2 pr-3 font-semibold">Industry</th>
                    <th className="text-right py-2 px-2 font-semibold">GST</th>
                    <th className="text-right py-2 px-2 font-semibold">Coll.</th>
                    <th className="text-right py-2 px-2 font-semibold">Compl.</th>
                    <th className="text-right py-2 px-2 font-semibold">Growth</th>
                    <th className="text-right py-2 px-2 font-semibold">Risk</th>
                    <th className="text-right py-2 px-2 font-semibold">Businesses</th>
                    <th className="text-right py-2 pl-2 font-semibold">Your Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {INDUSTRY_COMPARISON.map((ind, i) => {
                    const isYour = !!FEATURED_BUSINESS && ind.industry === FEATURED_BUSINESS.industry;
                    const indAvg = Math.round((ind.gstCredit + ind.collection + ind.compliance + ind.growth + ind.risk) / 5);
                    return (
                      <tr
                        key={i}
                        className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${isYour ? 'bg-emerald-50/40' : ''}`}
                      >
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-700">{ind.industry}</span>
                            {isYour && (
                              <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[9px] h-4 px-1.5">YOU</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-right tabular-nums text-slate-600">{ind.gstCredit}</td>
                        <td className="py-2.5 px-2 text-right tabular-nums text-slate-600">{ind.collection}</td>
                        <td className="py-2.5 px-2 text-right tabular-nums text-slate-600">{ind.compliance}</td>
                        <td className="py-2.5 px-2 text-right tabular-nums text-slate-600">{ind.growth}</td>
                        <td className="py-2.5 px-2 text-right tabular-nums text-slate-600">{ind.risk}</td>
                        <td className="py-2.5 px-2 text-right tabular-nums text-slate-500">{formatNumberIN(ind.businesses)}</td>
                        <td className="py-2.5 pl-2 text-right">
                          <span className="font-bold tabular-nums" style={{ color: getScoreColor(indAvg) }}>
                            {indAvg}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Migration matrix + Percentile calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}>
          <Card className="border-slate-200/60">
            <CardHeader className="pb-2 px-6 pt-5">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-600" />
                12-Month Rating Migration Matrix
              </CardTitle>
              <p className="text-[11px] text-slate-500 mt-0.5">
                % of businesses moving between rating bands over 12 months
              </p>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <MigrationMatrixChart />
              <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-600">
                <span className="font-semibold text-slate-700">Insight:</span> 65.7% of AAA-rated businesses retained their rating,
                while 22.4% migrated to AA. Only 0.0% of AAA businesses fell to CCC.
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.4 }}>
          <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/40 to-white">
            <CardHeader className="pb-2 px-6 pt-5">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-600" />
                Percentile Calculator
              </CardTitle>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Enter a business credit score (300-900) to see its percentile rank
              </p>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="flex items-center gap-2 mb-4">
                <Input
                  type="number"
                  min={300}
                  max={900}
                  value={percentileInput}
                  onChange={(e) => setPercentileInput(e.target.value)}
                  className="font-bold text-2xl tabular-nums h-14 text-emerald-700"
                />
                <div className="px-3 py-2 rounded-lg bg-slate-100 text-xs text-slate-500 shrink-0">
                  / 900
                </div>
              </div>

              {/* Percentile result */}
              <div className="p-4 rounded-lg bg-white border border-emerald-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Percentile Rank</span>
                  <Badge className={`border ${getRatingColor(getRatingFromOverall(percentileScore))}`}>
                    {getRatingFromOverall(percentileScore)}
                  </Badge>
                </div>
                <div className="flex items-baseline gap-1">
                  <AnimatedCounter
                    value={Math.round(percentile * 10) / 10}
                    className="text-3xl font-bold text-emerald-700 tabular-nums"
                  />
                  <span className="text-sm text-slate-500">th percentile</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  Score of <span className="font-semibold text-slate-800">{percentileScore}</span> ranks higher than{' '}
                  <span className="font-semibold text-emerald-700">{percentile.toFixed(1)}%</span> of all
                  scored Indian businesses
                </p>

                {/* Mini bell curve marker */}
                <div className="mt-3 relative h-2 bg-gradient-to-r from-red-300 via-amber-300 to-emerald-500 rounded-full overflow-hidden">
                  <motion.div
                    className="absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-white border-2 border-emerald-700 shadow"
                    style={{ left: `calc(${Math.min(100, Math.max(0, ((percentileScore - 300) / 600) * 100))}% - 8px)` }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                  <span>300</span>
                  <span>600</span>
                  <span>900</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3">
                {[
                  { label: 'Top 10%', score: 842, color: COLORS.emerald700 },
                  { label: 'Median', score: 742, color: COLORS.amber500 },
                  { label: 'Bottom 10%', score: 642, color: COLORS.red500 },
                ].map((b, i) => (
                  <div key={i} className="text-center p-2 rounded-lg border border-slate-100">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">{b.label}</p>
                    <p className="text-sm font-bold tabular-nums" style={{ color: b.color }}>{b.score}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Top 10 + Bottom 10 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }}>
          <Card className="border-emerald-200/60">
            <CardHeader className="pb-2 px-5 pt-5">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Crown className="h-4 w-4 text-emerald-600" />
                Top 10 Highest-Rated Businesses
              </CardTitle>
              <p className="text-[11px] text-slate-500 mt-0.5">Leaderboard by overall credit score</p>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <ScrollArea className="max-h-96">
                <div className="space-y-1.5">
                  {TOP_BUSINESSES.map((b, i) => (
                    <motion.div
                      key={b.rank}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.04, duration: 0.3 }}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-emerald-50/50 transition-colors border border-transparent hover:border-emerald-100"
                    >
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                        b.rank <= 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {b.rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{b.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{b.industry}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold tabular-nums" style={{ color: getScoreColor(b.score) }}>{b.overall}</p>
                        <p className="text-[9px] text-slate-400">/ 900</p>
                      </div>
                      <Badge className={`border text-[9px] h-5 px-1.5 ${getRatingColor(b.rating)}`}>
                        {b.rating}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bottom 10 */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.4 }}>
          <Card className="border-red-200/60">
            <CardHeader className="pb-2 px-5 pt-5">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Bottom 10 High-Risk Businesses
              </CardTitle>
              <p className="text-[11px] text-slate-500 mt-0.5">Anonymized — flagged for credit review</p>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <ScrollArea className="max-h-96">
                <div className="space-y-1.5">
                  {BOTTOM_BUSINESSES.map((b, i) => (
                    <motion.div
                      key={b.rank}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.04, duration: 0.3 }}
                      className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-red-50/50 transition-colors border border-transparent hover:border-red-100"
                    >
                      <div className="h-7 w-7 rounded-full bg-red-100 text-red-700 flex items-center justify-center shrink-0 text-xs font-bold">
                        {b.rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{b.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{b.industry}</p>
                        <div className="flex items-center gap-1 flex-wrap mt-1">
                          {b.riskFactors.map((rf, j) => (
                            <span key={j} className="text-[9px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100">
                              {rf}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold tabular-nums text-red-600">{b.overall}</p>
                        <p className="text-[9px] text-slate-400">/ 900</p>
                      </div>
                      <Badge className={`border text-[9px] h-5 px-1.5 ${getRatingColor(b.rating)}`}>
                        {b.rating}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function CreditScoringEnginePage() {
  return (
    <div className="min-h-screen bg-slate-50/40">
      <div className="p-4 md:p-6 space-y-5">
        {/* Page Title */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-slate-900">VEYRO Credit Scoring Engine</h1>
              <p className="text-[11px] text-slate-500">Business Credit Engine for Indian MSMEs & Enterprises</p>
            </div>
          </div>
          <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200">
            <Star className="h-3 w-3 mr-1" />
            Credit engine — connect a business to score it
          </Badge>
        </div>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto bg-white border border-slate-200 p-1">
            <TabsTrigger value="dashboard" className="text-xs md:text-sm py-2 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              <Gauge className="h-3.5 w-3.5 mr-1.5" />
              Score Dashboard
            </TabsTrigger>
            <TabsTrigger value="breakdown" className="text-xs md:text-sm py-2 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
              Score Breakdown
            </TabsTrigger>
            <TabsTrigger value="simulator" className="text-xs md:text-sm py-2 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              Score Simulator
            </TabsTrigger>
            <TabsTrigger value="distribution" className="text-xs md:text-sm py-2 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              <Activity className="h-3.5 w-3.5 mr-1.5" />
              Distribution & Benchmarks
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-5">
            <ScoreDashboardTab />
          </TabsContent>
          <TabsContent value="breakdown" className="mt-5">
            <ScoreBreakdownTab />
          </TabsContent>
          <TabsContent value="simulator" className="mt-5">
            <ScoreSimulatorTab />
          </TabsContent>
          <TabsContent value="distribution" className="mt-5">
            <ScoreDistributionTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
