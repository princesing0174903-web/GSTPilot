'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared';
import {
  IndianRupee,
  TrendingUp,
  Building2,
  Landmark,
  Activity,
  Users,
  ShoppingBag,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  CheckCircle,
  Clock,
  AlertTriangle,
  Award,
  Eye,
  Gavel,
  Plus,
  ChevronRight,
  BarChart3,
  Wallet,
  Zap,
  HandCoins,
  Coins,
  TrendingDown,
  ArrowRight,
  Calendar,
  MapPin,
  Layers,
  Briefcase,
  Banknote,
  Target,
  Percent,
  Sparkles,
  Scale,
  FileText,
  Check,
  ChevronLeft,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatINR(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN');
}

function formatINRShort(amount: number): string {
  if (amount >= 10000000) return '₹' + (amount / 10000000).toFixed(2) + 'Cr';
  if (amount >= 100000) return '₹' + (amount / 100000).toFixed(2) + 'L';
  if (amount >= 1000) return '₹' + (amount / 1000).toFixed(1) + 'K';
  return '₹' + amount;
}

function formatNumber(num: number): string {
  return num.toLocaleString('en-IN');
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function trustBadge(score: number): { label: string; color: string; bg: string } {
  if (score >= 90) return { label: 'AAA Trust', color: 'text-emerald-700', bg: 'bg-emerald-100' };
  if (score >= 80) return { label: 'AA Trust', color: 'text-teal-700', bg: 'bg-teal-100' };
  if (score >= 70) return { label: 'A Trust', color: 'text-amber-700', bg: 'bg-amber-100' };
  return { label: 'BBB Trust', color: 'text-slate-600', bg: 'bg-slate-100' };
}

function statusBadge(status: string): { label: string; color: string; bg: string } {
  switch (status) {
    case 'listed':
      return { label: 'Listed', color: 'text-slate-700', bg: 'bg-slate-100' };
    case 'bid-received':
      return { label: 'Bid Received', color: 'text-amber-700', bg: 'bg-amber-100' };
    case 'sold':
      return { label: 'Sold', color: 'text-emerald-700', bg: 'bg-emerald-100' };
    case 'expired':
      return { label: 'Expired', color: 'text-rose-700', bg: 'bg-rose-100' };
    default:
      return { label: status, color: 'text-slate-700', bg: 'bg-slate-100' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface MarketInvoice {
  id: string;
  invoiceNo: string;
  seller: string;
  sellerInitials: string;
  sellerColor: string;
  buyer: string;
  industry: string;
  amount: number;
  discountRate: number;
  netAmount: number;
  maturityDays: number;
  trustScore: number;
  rating: 'AAA' | 'AA' | 'A' | 'BBB';
  listedDate: string;
  dueDate: string;
}

interface MyInvoice {
  id: string;
  invoiceNo: string;
  buyer: string;
  amount: number;
  listingDate: string;
  discount: number;
  status: 'listed' | 'bid-received' | 'sold' | 'expired';
  bidsCount: number;
  bestOffer: number | null;
}

interface Bid {
  id: string;
  bidder: string;
  bidderInitials: string;
  bidderColor: string;
  amount: number;
  discountRate: number;
  time: string;
  type: 'NBFC' | 'Bank' | 'Investor' | 'Fund';
}

interface TickerEntry {
  seller: string;
  amount: number;
  rate: number;
  buyer: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA (empty placeholders — populated by real APIs when available)
// ═══════════════════════════════════════════════════════════════════════════════

// TICKER_ENTRIES — empty until a real invoice-exchange ticker API is wired.
const TICKER_ENTRIES: TickerEntry[] = [];

// TOP_BUYERS — empty until a real invoice-exchange top-buyers API is wired.
const TOP_BUYERS: { name: string; initials: string; color: string; volume: number; trades: number; type: string }[] = [];

const TOP_SELLERS: { name: string; initials: string; color: string; sold: number; count: number }[] = [];

// 30-day daily volume (in crores) — empty until real API is wired
const VOLUME_30D: number[] = [];

const INDUSTRIES = [
  'All Industries',
  'IT Services',
  'Manufacturing',
  'Pharmaceuticals',
  'Steel & Metals',
  'Textiles',
  'Automotive',
  'Construction',
  'Chemicals',
  'FMCG',
  'Telecom',
  'Energy',
];

const MARKETPLACE_INVOICES: MarketInvoice[] = [];
const MY_INVOICES: MyInvoice[] = [];
const SAMPLE_BIDS: Bid[] = [];
const INDUSTRY_VOLUME: { name: string; volume: number; color: string }[] = [];
const BUYER_TYPE_DIST: { label: string; value: number; color: string }[] = [];
const DISCOUNT_TREND_12M: { month: string; rate: number }[] = [];
const STATE_HEATMAP: { name: string; code: string; volume: number }[] = [];
const TOP_PERFORMING_INVOICES: { invoiceNo: string; seller: string; buyer: string; amount: number; discountSaved: number; discountPct: number }[] = [];
const RISK_DISTRIBUTION: { rating: string; count: number; volume: number; color: string; bg: string; text: string }[] = [];

// ═══════════════════════════════════════════════════════════════════════════════
// SVG CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

function VolumeLineChart() {
  if (VOLUME_30D.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No marketplace data yet"
        description="Daily exchange volume will appear here once invoices are listed."
        compact
      />
    );
  }
  const width = 760;
  const height = 220;
  const padding = { top: 20, right: 24, bottom: 32, left: 48 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(...VOLUME_30D) * 1.1;
  const minVal = 0;
  const yScale = (v: number) => chartH - ((v - minVal) / (maxVal - minVal)) * chartH;
  const xScale = (i: number) => (i / (VOLUME_30D.length - 1)) * chartW;

  const linePath = VOLUME_30D.map((d, i) =>
    `${i === 0 ? 'M' : 'L'} ${xScale(i) + padding.left} ${yScale(d) + padding.top}`
  ).join(' ');

  const areaPath = linePath +
    ` L ${xScale(VOLUME_30D.length - 1) + padding.left} ${chartH + padding.top}` +
    ` L ${padding.left} ${chartH + padding.top} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <defs>
        <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
        <line
          key={frac}
          x1={padding.left}
          y1={padding.top + chartH * (1 - frac)}
          x2={width - padding.right}
          y2={padding.top + chartH * (1 - frac)}
          stroke="#e2e8f0"
          strokeWidth="0.5"
          strokeDasharray="4,4"
        />
      ))}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const val = Math.round(maxVal * frac);
        return (
          <text
            key={frac}
            x={padding.left - 8}
            y={padding.top + chartH * (1 - frac) + 3}
            textAnchor="end"
            className="text-[9px] fill-slate-400"
          >
            {frac === 0 ? '0' : `₹${val}Cr`}
          </text>
        );
      })}
      <motion.path
        d={areaPath}
        fill="url(#volGrad)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      />
      <motion.path
        d={linePath}
        fill="none"
        stroke="#10b981"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: 'easeInOut' as const }}
      />
      {VOLUME_30D.map((d, i) => (
        <motion.circle
          key={i}
          cx={xScale(i) + padding.left}
          cy={yScale(d) + padding.top}
          r="2.5"
          fill="white"
          stroke="#10b981"
          strokeWidth="1.5"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5 + i * 0.02 }}
        />
      ))}
      {[0, 7, 14, 21, 29].map((i) => (
        <text
          key={i}
          x={xScale(i) + padding.left}
          y={height - 8}
          textAnchor="middle"
          className="text-[9px] fill-slate-500"
        >
          Day {i + 1}
        </text>
      ))}
    </svg>
  );
}

function IndustryVolumeBarChart() {
  if (INDUSTRY_VOLUME.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No industry data yet"
        description="Industry volume breakdown will appear here once invoices are listed."
        compact
      />
    );
  }
  const width = 760;
  const height = 280;
  const padding = { top: 20, right: 24, bottom: 50, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxVal = Math.max(...INDUSTRY_VOLUME.map(d => d.volume)) * 1.1;
  const barW = chartW / INDUSTRY_VOLUME.length - 12;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
        <line
          key={frac}
          x1={padding.left}
          y1={padding.top + chartH * (1 - frac)}
          x2={width - padding.right}
          y2={padding.top + chartH * (1 - frac)}
          stroke="#e2e8f0"
          strokeWidth="0.5"
          strokeDasharray="4,4"
        />
      ))}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const val = Math.round(maxVal * frac);
        return (
          <text
            key={frac}
            x={padding.left - 8}
            y={padding.top + chartH * (1 - frac) + 3}
            textAnchor="end"
            className="text-[9px] fill-slate-400"
          >
            {frac === 0 ? '0' : `₹${val}Cr`}
          </text>
        );
      })}
      {INDUSTRY_VOLUME.map((d, i) => {
        const barH = (d.volume / maxVal) * chartH;
        const x = padding.left + i * (chartW / INDUSTRY_VOLUME.length) + 6;
        const y = padding.top + chartH - barH;
        return (
          <g key={i}>
            <motion.rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              fill={d.color}
              rx="3"
              initial={{ height: 0, y: padding.top + chartH }}
              animate={{ height: barH, y }}
              transition={{ delay: i * 0.05, duration: 0.6, ease: 'easeOut' as const }}
            />
            <text
              x={x + barW / 2}
              y={y - 6}
              textAnchor="middle"
              className="text-[9px] fill-slate-600 font-semibold"
            >
              {d.volume}
            </text>
            <text
              x={x + barW / 2}
              y={height - 30}
              textAnchor="middle"
              className="text-[8px] fill-slate-500"
              transform={`rotate(-25, ${x + barW / 2}, ${height - 30})`}
            >
              {d.name.length > 10 ? d.name.slice(0, 10) + '…' : d.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function BuyerTypeDonut() {
  if (BUYER_TYPE_DIST.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No buyer data yet"
        description="Buyer type distribution will appear here once trades occur."
        compact
      />
    );
  }
  const cx = 90;
  const cy = 90;
  const r = 70;
  const innerR = 45;
  const total = BUYER_TYPE_DIST.reduce((s, d) => s + d.value, 0);

  // Pre-compute cumulative angles (immutable)
  const cumulative = BUYER_TYPE_DIST.reduce<number[]>((acc, d, i) => {
    const prev = i > 0 ? acc[i - 1] : -90;
    return [...acc, prev + (d.value / total) * 360];
  }, []);

  const arcs = BUYER_TYPE_DIST.map((d, i) => {
    const startAngle = i > 0 ? cumulative[i - 1] : -90;
    const endAngle = cumulative[i];
    const angle = endAngle - startAngle;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const largeArc = angle > 180 ? 1 : 0;
    const outerStart = { x: cx + r * Math.cos(startRad), y: cy + r * Math.sin(startRad) };
    const outerEnd = { x: cx + r * Math.cos(endRad), y: cy + r * Math.sin(endRad) };
    const innerStart = { x: cx + innerR * Math.cos(endRad), y: cy + innerR * Math.sin(endRad) };
    const innerEnd = { x: cx + innerR * Math.cos(startRad), y: cy + innerR * Math.sin(startRad) };
    const path = [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
      `L ${innerStart.x} ${innerStart.y}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
      'Z',
    ].join(' ');
    return { ...d, path };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg viewBox="0 0 180 180" className="w-36 h-36 shrink-0">
        {arcs.map((arc, i) => (
          <motion.path
            key={i}
            d={arc.path}
            fill={arc.color}
            opacity="0.85"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.85, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            style={{ transformOrigin: 'center' }}
          />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" className="text-[12px] fill-slate-700 font-bold">
          847
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" className="text-[8px] fill-slate-400">
          Investors
        </text>
      </svg>
      <div className="space-y-3 w-full">
        {BUYER_TYPE_DIST.map((d, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: d.color }} />
            <span className="text-sm text-slate-600">{d.label}</span>
            <span className="text-sm font-semibold text-slate-800 ml-auto">{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DiscountTrendChart() {
  if (DISCOUNT_TREND_12M.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No trend data yet"
        description="Average discount rate trend will appear here once trades occur."
        compact
      />
    );
  }
  const width = 760;
  const height = 220;
  const padding = { top: 20, right: 24, bottom: 32, left: 48 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxVal = 6;
  const minVal = 3;
  const yScale = (v: number) => chartH - ((v - minVal) / (maxVal - minVal)) * chartH;
  const xScale = (i: number) => (i / (DISCOUNT_TREND_12M.length - 1)) * chartW;

  const linePath = DISCOUNT_TREND_12M.map((d, i) =>
    `${i === 0 ? 'M' : 'L'} ${xScale(i) + padding.left} ${yScale(d.rate) + padding.top}`
  ).join(' ');

  const areaPath = linePath +
    ` L ${xScale(DISCOUNT_TREND_12M.length - 1) + padding.left} ${chartH + padding.top}` +
    ` L ${padding.left} ${chartH + padding.top} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <defs>
        <linearGradient id="discountGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[3, 4, 5, 6].map((v) => (
        <g key={v}>
          <line
            x1={padding.left}
            y1={padding.top + yScale(v) - padding.top}
            x2={width - padding.right}
            y2={padding.top + yScale(v) - padding.top}
            stroke="#e2e8f0"
            strokeWidth="0.5"
            strokeDasharray="4,4"
          />
          <text
            x={padding.left - 8}
            y={padding.top + yScale(v) - padding.top + 3}
            textAnchor="end"
            className="text-[9px] fill-slate-400"
          >
            {v}%
          </text>
        </g>
      ))}
      <motion.path
        d={areaPath}
        fill="url(#discountGrad)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      />
      <motion.path
        d={linePath}
        fill="none"
        stroke="#f59e0b"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: 'easeInOut' as const }}
      />
      {DISCOUNT_TREND_12M.map((d, i) => (
        <motion.circle
          key={i}
          cx={xScale(i) + padding.left}
          cy={yScale(d.rate) + padding.top}
          r="3"
          fill="white"
          stroke="#f59e0b"
          strokeWidth="2"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5 + i * 0.04 }}
        />
      ))}
      {DISCOUNT_TREND_12M.map((d, i) => (
        <text
          key={i}
          x={xScale(i) + padding.left}
          y={height - 8}
          textAnchor="middle"
          className="text-[9px] fill-slate-500"
        >
          {d.month}
        </text>
      ))}
    </svg>
  );
}

function StateHeatmap() {
  if (STATE_HEATMAP.length === 0) {
    return (
      <EmptyState
        icon={MapPin}
        title="No state data yet"
        description="State-wise invoice volume will appear here once invoices are listed."
        compact
      />
    );
  }
  const colorFor = (vol: number) => {
    if (vol >= 75) return '#059669';
    if (vol >= 50) return '#10b981';
    if (vol >= 30) return '#34d399';
    if (vol >= 15) return '#86efac';
    if (vol >= 5) return '#bbf7d0';
    return '#f1f5f9';
  };
  const textFor = (vol: number) => (vol >= 30 ? 'text-white' : 'text-slate-700');

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
      {STATE_HEATMAP.map((s, i) => (
        <motion.div
          key={s.code}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.025 }}
          whileHover={{ scale: 1.05 }}
          className="aspect-square rounded-md flex flex-col items-center justify-center cursor-default p-1"
          style={{ backgroundColor: colorFor(s.volume) }}
          title={`${s.name}: ${s.volume}Cr volume`}
        >
          <span className={`text-[10px] font-bold ${textFor(s.volume)}`}>{s.code}</span>
          <span className={`text-[9px] ${textFor(s.volume)} opacity-80`}>₹{s.volume}Cr</span>
        </motion.div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE TICKER
// ═══════════════════════════════════════════════════════════════════════════════

function LiveTicker() {
  if (TICKER_ENTRIES.length === 0) {
    return (
      <div className="overflow-hidden bg-slate-900 dark:bg-slate-950 border-y border-emerald-500/20 py-2.5">
        <div className="flex items-center gap-3 px-4">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Live</span>
          </div>
          <p className="text-xs text-slate-400">No live trades yet. The ticker will show real-time trades as they occur.</p>
        </div>
      </div>
    );
  }
  const entries = [...TICKER_ENTRIES, ...TICKER_ENTRIES];
  return (
    <div className="overflow-hidden bg-slate-900 dark:bg-slate-950 border-y border-emerald-500/20 py-2.5">
      <div className="flex items-center gap-3 px-4">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Live</span>
        </div>
        <div className="relative flex-1 overflow-hidden">
          <motion.div
            className="flex gap-8 whitespace-nowrap"
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 35, repeat: Infinity, ease: 'linear' as const }}
          >
            {entries.map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-emerald-400">{e.seller}</span>
                <span className="text-slate-300">Invoice</span>
                <span className="text-white font-semibold">{formatINRShort(e.amount)}</span>
                <span className="text-slate-500">@</span>
                <span className="text-amber-400 font-mono">{e.rate}</span>
                <ArrowRight className="h-3 w-3 text-slate-500" />
                <span className="text-teal-400 font-medium">{e.buyer}</span>
                <span className="text-slate-700">•</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAT CARD
// ═══════════════════════════════════════════════════════════════════════════════

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down';
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <Card className="relative overflow-hidden border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              {sub && <p className="text-xs text-slate-500">{sub}</p>}
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Icon className="h-5 w-5" />
              </div>
              {trend && (
                <div className={`flex items-center gap-0.5 text-xs font-semibold ${trend === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  12%
                </div>
              )}
            </div>
          </div>
        </CardContent>
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-400 opacity-60" />
      </Card>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════════════════════════════════════════════

function LeaderboardRow({
  rank,
  name,
  initials,
  color,
  primary,
  secondary,
  type,
  delay,
}: {
  rank: number;
  name: string;
  initials: string;
  color: string;
  primary: string;
  secondary: string;
  type?: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
    >
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 shrink-0">
        {rank}
      </div>
      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${color} text-white text-xs font-bold shrink-0`}>
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
        <p className="text-xs text-slate-500">{secondary}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-slate-900">{primary}</p>
        {type && <p className="text-[10px] text-slate-500">{type}</p>}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETPLACE INVOICE CARD
// ═══════════════════════════════════════════════════════════════════════════════

function InvoiceCard({
  inv,
  index,
  onBuy,
}: {
  inv: MarketInvoice;
  index: number;
  onBuy: (inv: MarketInvoice) => void;
}) {
  const trust = trustBadge(inv.trustScore);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.5), duration: 0.4 }}
      whileHover={{ y: -4 }}
    >
      <Card className="h-full border-slate-200 shadow-sm hover:shadow-lg hover:border-emerald-300 transition-all">
        <CardContent className="p-5 flex flex-col h-full gap-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${inv.sellerColor} text-white text-xs font-bold shrink-0`}>
                {inv.sellerInitials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{inv.seller}</p>
                <p className="text-[10px] text-slate-500 font-mono truncate">{inv.invoiceNo}</p>
              </div>
            </div>
            <Badge variant="secondary" className={`${trust.bg} ${trust.color} border-0 text-[10px] shrink-0`}>
              <Shield className="h-2.5 w-2.5 mr-1" />
              {inv.rating}
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-[10px]">
            <Badge variant="outline" className="text-slate-600 border-slate-200 font-normal">
              <Building2 className="h-2.5 w-2.5 mr-1" />
              {inv.industry}
            </Badge>
            <span className="text-slate-400">·</span>
            <span className="text-slate-500 truncate">Debtor: {inv.buyer}</span>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Invoice Amount</p>
              <p className="text-lg font-bold text-slate-900">{formatINRShort(inv.amount)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Net to Seller</p>
              <p className="text-lg font-bold text-emerald-700">{formatINRShort(inv.netAmount)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Discount</p>
              <p className="text-sm font-semibold text-amber-600">{inv.discountRate}%</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Maturity</p>
              <p className="text-sm font-semibold text-slate-700">{inv.maturityDays} days</p>
            </div>
          </div>

          <div className="mt-auto pt-2">
            <div className="flex items-center justify-between mb-2 text-[10px] text-slate-500">
              <span>Trust Score</span>
              <span className="font-semibold text-slate-700">{inv.trustScore}/100</span>
            </div>
            <Progress value={inv.trustScore} className="h-1.5" />
            <Button
              className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700 text-white"
              size="sm"
              onClick={() => onBuy(inv)}
            >
              <HandCoins className="h-3.5 w-3.5 mr-1.5" />
              Buy Invoice
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUY INVOICE DIALOG
// ═══════════════════════════════════════════════════════════════════════════════

function BuyInvoiceDialog({
  inv,
  open,
  onOpenChange,
}: {
  inv: MarketInvoice | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [confirmed, setConfirmed] = useState(false);

  React.useEffect(() => {
    if (!open) {
      const t = setTimeout(() => setConfirmed(false), 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!inv) return null;

  const discountAmount = inv.amount - inv.netAmount;
  const exchangeFee = Math.round(inv.netAmount * 0.0015);
  const gstOnFee = Math.round(exchangeFee * 0.18);
  const totalPayable = inv.netAmount + exchangeFee + gstOnFee;
  const trust = trustBadge(inv.trustScore);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            <HandCoins className="h-4 w-4 text-emerald-600" />
            Purchase Invoice
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${inv.sellerColor} text-white text-xs font-bold`}>
              {inv.sellerInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 truncate">{inv.seller}</p>
              <p className="text-[11px] text-slate-500 font-mono">{inv.invoiceNo}</p>
            </div>
            <Badge className={`${trust.bg} ${trust.color} border-0`}>{inv.rating}</Badge>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Invoice Face Value</span>
              <span className="font-semibold text-slate-800">{formatINR(inv.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Discount ({inv.discountRate}%)</span>
              <span className="font-semibold text-amber-600">- {formatINR(discountAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Net Amount to Seller</span>
              <span className="font-semibold text-emerald-700">{formatINR(inv.netAmount)}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-slate-500">Exchange Fee (0.15%)</span>
              <span className="text-slate-700">{formatINR(exchangeFee)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">GST on Fee (18%)</span>
              <span className="text-slate-700">{formatINR(gstOnFee)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-base">
              <span className="font-semibold text-slate-800">Total Payable</span>
              <span className="font-bold text-slate-900">{formatINR(totalPayable)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Maturity in</span>
              <span className="text-slate-700 font-medium">{inv.maturityDays} days · {formatDate(inv.dueDate)}</span>
            </div>
          </div>

          <div className="text-xs text-slate-500 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <div className="flex items-start gap-2">
              <Shield className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
              <span>
                Escrow-protected transaction. Funds released to seller only after invoice assignment confirmation.
                Expected yield: <span className="font-semibold text-emerald-700">{((discountAmount / totalPayable) * (365 / inv.maturityDays)).toFixed(2)}% annualized</span>.
              </span>
            </div>
          </div>

          {confirmed ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-semibold">Purchase confirmed! Settlement in T+1.</span>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => setConfirmed(true)}
            disabled={confirmed}
          >
            {confirmed ? (
              <>
                <Check className="h-4 w-4 mr-1" />
                Confirmed
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-1" />
                Confirm Purchase
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIEW BIDS DIALOG
// ═══════════════════════════════════════════════════════════════════════════════

function ViewBidsDialog({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: MyInvoice | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!invoice) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            <Gavel className="h-4 w-4 text-emerald-600" />
            Bids on {invoice.invoiceNo}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm">
            <div>
              <p className="font-semibold text-slate-800">Invoice: {formatINR(invoice.amount)}</p>
              <p className="text-xs text-slate-500">Buyer (debtor): {invoice.buyer}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">{invoice.bidsCount} active bids</p>
              <p className="text-xs text-emerald-700 font-semibold">Best: {invoice.bestOffer ? formatINR(invoice.bestOffer) : '-'}</p>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {SAMPLE_BIDS.length === 0 ? (
              <EmptyState
                icon={Gavel}
                title="No bids yet"
                description="Bids from NBFCs, banks and investors will appear here once your invoice is listed."
                compact
              />
            ) : (
              SAMPLE_BIDS.map((bid, i) => (
                <motion.div
                  key={bid.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${i === 0 ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full ${bid.bidderColor} text-white text-[10px] font-bold shrink-0`}>
                    {bid.bidderInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800 truncate">{bid.bidder}</p>
                      {i === 0 && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[9px] px-1.5 py-0">
                          <Award className="h-2.5 w-2.5 mr-0.5" />Best
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500">{bid.type} · {bid.time}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900">{formatINR(bid.amount)}</p>
                    <p className="text-[10px] text-amber-600">@ {bid.discountRate}%</p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Check className="h-4 w-4 mr-1" />
            Accept Best Bid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIST NEW INVOICE DIALOG (Multi-step)
// ═══════════════════════════════════════════════════════════════════════════════

function ListInvoiceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [step, setStep] = useState(1);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [buyer, setBuyer] = useState('');
  const [amount, setAmount] = useState('');
  const [industry, setIndustry] = useState('IT Services');
  const [dueDate, setDueDate] = useState('');
  const [discount, setDiscount] = useState(3);
  const [listed, setListed] = useState(false);

  React.useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep(1);
        setInvoiceNo('');
        setBuyer('');
        setAmount('');
        setIndustry('IT Services');
        setDueDate('');
        setDiscount(3);
        setListed(false);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  const amountNum = Number(amount) || 0;
  const netAmount = Math.round(amountNum * (1 - discount / 100));
  const exchangeFee = Math.round(netAmount * 0.0015);

  const canNext1 = invoiceNo.trim() && buyer.trim() && amountNum > 0 && dueDate;
  const canNext2 = true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            <Plus className="h-4 w-4 text-emerald-600" />
            List New Invoice
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${s <= step ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                {s < step ? <Check className="h-3 w-3" /> : s}
              </div>
              {s < 4 && <div className={`flex-1 h-0.5 ${s < step ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {!listed && step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="space-y-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Step 1 — Invoice Details</p>
              <div className="space-y-2">
                <Label className="text-xs">Invoice Number</Label>
                <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="INV-2026-0001" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Buyer (Debtor) Name</Label>
                <Input value={buyer} onChange={(e) => setBuyer(e.target.value)} placeholder="Reliance Retail Ltd" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Invoice Amount (₹)</Label>
                  <Input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} placeholder="4500000" type="text" inputMode="numeric" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Due Date</Label>
                  <Input value={dueDate} onChange={(e) => setDueDate(e.target.value)} type="date" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Industry</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.filter(i => i !== 'All Industries').map((i) => (
                      <SelectItem key={i} value={i}>{i}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </motion.div>
          )}

          {!listed && step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="space-y-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Step 2 — Set Discount Rate</p>
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Invoice Amount</span>
                  <span className="font-semibold text-slate-800">{formatINR(amountNum)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Discount Rate</span>
                  <span className="font-semibold text-amber-600">{discount}%</span>
                </div>
                <Separator />
                <div className="flex justify-between text-base">
                  <span className="font-semibold text-slate-800">You Receive</span>
                  <span className="font-bold text-emerald-700">{formatINR(netAmount)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <Label className="text-xs">Discount Rate (%)</Label>
                  <span className="font-bold text-slate-700">{discount}%</span>
                </div>
                <Slider value={[discount]} min={1} max={10} step={0.1} onValueChange={(v) => setDiscount(v[0])} />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>1%</span>
                  <span>5%</span>
                  <span>10%</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Lower discounts attract more bids from NBFCs and banks. The exchange recommends a discount
                between 2.5% and 4.5% based on your trust score.
              </p>
            </motion.div>
          )}

          {!listed && step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="space-y-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Step 3 — Review</p>
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Invoice Number</span><span className="font-medium text-slate-800">{invoiceNo}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Buyer (Debtor)</span><span className="font-medium text-slate-800">{buyer}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Industry</span><span className="font-medium text-slate-800">{industry}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Invoice Amount</span><span className="font-medium text-slate-800">{formatINR(amountNum)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Due Date</span><span className="font-medium text-slate-800">{dueDate}</span></div>
                <Separator />
                <div className="flex justify-between"><span className="text-slate-500">Discount</span><span className="font-medium text-amber-600">{discount}%</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Net to Seller</span><span className="font-medium text-emerald-700">{formatINR(netAmount)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Exchange Fee (0.15%)</span><span className="font-medium text-slate-700">{formatINR(exchangeFee)}</span></div>
              </div>
              <p className="text-[11px] text-slate-500">
                By listing, you authorize GSTPilot Invoice Exchange to assign this invoice to the highest bidder.
                Funds will be credited to your linked account within T+1 of acceptance.
              </p>
            </motion.div>
          )}

          {listed && (
            <motion.div
              key="listed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center py-6 space-y-3"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle className="h-7 w-7" />
              </div>
              <p className="text-lg font-bold text-slate-800">Invoice Listed Successfully</p>
              <p className="text-sm text-slate-500">
                Your invoice is now visible to 847 active investors. You'll receive bid notifications in real-time.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {!listed && (
          <DialogFooter>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white ml-auto"
                disabled={step === 1 ? !canNext1 : !canNext2}
                onClick={() => setStep(step + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white ml-auto"
                onClick={() => setListed(true)}
              >
                <Zap className="h-4 w-4 mr-1" />
                Confirm Listing
              </Button>
            )}
          </DialogFooter>
        )}
        {listed && (
          <DialogFooter>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white ml-auto" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — EXCHANGE DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

function DashboardTab() {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-emerald-900 to-teal-900 p-6 sm:p-8"
      >
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }} />
        <div className="relative space-y-3">
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30">
            <Sparkles className="h-3 w-3 mr-1" />
            GSTPilot Financial Exchange
          </Badge>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
            Invoice Exchange — India&apos;s First B2B Invoice Marketplace
          </h1>
          <p className="text-sm sm:text-base text-emerald-100/80 max-w-2xl">
            A real-time marketplace where MSMEs list invoices for financing and verified NBFCs, banks,
            and institutional investors bid competitively. Powered by escrow-protected settlement and
            GSTN-validated trust scoring.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button className="bg-emerald-500 hover:bg-emerald-400 text-white">
              <ShoppingBag className="h-4 w-4 mr-1.5" />
              Browse Marketplace
            </Button>
            <Button variant="outline" className="bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white">
              <Plus className="h-4 w-4 mr-1.5" />
              List an Invoice
            </Button>
          </div>
        </div>
      </motion.div>

      <LiveTicker />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={IndianRupee} label="Today's Volume" value="₹0" sub="No trades yet today" delay={0.05} />
        <StatCard icon={FileText} label="Invoices Listed" value="0" sub="No invoices listed yet" delay={0.1} />
        <StatCard icon={Users} label="Active Investors" value="0" sub="No investors active yet" delay={0.15} />
        <StatCard icon={Percent} label="Avg Discount" value="—" sub="No trades yet" delay={0.2} />
      </div>

      {/* Volume chart */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-slate-800 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-600" />
              Daily Exchange Volume
            </CardTitle>
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-0">Last 30 days</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <VolumeLineChart />
        </CardContent>
      </Card>

      {/* Leaderboards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-800 flex items-center gap-2">
              <Landmark className="h-4 w-4 text-emerald-600" />
              Top Buyers — Today
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <ScrollArea className="max-h-96 overflow-y-auto pr-2">
              <div className="space-y-1">
                {TOP_BUYERS.length === 0 ? (
                  <EmptyState
                    icon={Landmark}
                    title="No buyer activity yet"
                    description="Top buyers will appear here once trades occur on the exchange."
                    compact
                  />
                ) : (
                  TOP_BUYERS.map((b, i) => (
                    <LeaderboardRow
                      key={b.name}
                      rank={i + 1}
                      name={b.name}
                      initials={b.initials}
                      color={b.color}
                      primary={formatINRShort(b.volume)}
                      secondary={`${b.trades} trades today`}
                      type={b.type}
                      delay={i * 0.04}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-800 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-teal-600" />
              Top Sellers — Today
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <ScrollArea className="max-h-96 overflow-y-auto pr-2">
              <div className="space-y-1">
                {TOP_SELLERS.length === 0 ? (
                  <EmptyState
                    icon={Building2}
                    title="No seller activity yet"
                    description="Top sellers will appear here once invoices are traded on the exchange."
                    compact
                  />
                ) : (
                  TOP_SELLERS.map((s, i) => (
                    <LeaderboardRow
                      key={s.name}
                      rank={i + 1}
                      name={s.name}
                      initials={s.initials}
                      color={s.color}
                      primary={formatINRShort(s.sold)}
                      secondary={`${s.count} invoices sold`}
                      delay={i * 0.04}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — INVOICE MARKETPLACE
// ═══════════════════════════════════════════════════════════════════════════════

type SortOption = 'best-discount' | 'highest-amount' | 'lowest-risk' | 'closest-maturity';

function MarketplaceTab() {
  const [industry, setIndustry] = useState('All Industries');
  const [amountRange, setAmountRange] = useState<number[]>([0, 20000000]);
  const [discountMax, setDiscountMax] = useState(10);
  const [trustMin, setTrustMin] = useState(60);
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [sort, setSort] = useState<SortOption>('best-discount');
  const [visible, setVisible] = useState(9);
  const [buyTarget, setBuyTarget] = useState<MarketInvoice | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = MARKETPLACE_INVOICES.filter((inv) => {
      if (industry !== 'All Industries' && inv.industry !== industry) return false;
      if (inv.amount < amountRange[0] || inv.amount > amountRange[1]) return false;
      if (inv.discountRate > discountMax) return false;
      if (inv.trustScore < trustMin) return false;
      if (dueFrom) {
        const from = new Date(dueFrom);
        if (new Date(inv.dueDate) < from) return false;
      }
      if (dueTo) {
        const to = new Date(dueTo);
        if (new Date(inv.dueDate) > to) return false;
      }
      return true;
    });

    switch (sort) {
      case 'best-discount':
        list = [...list].sort((a, b) => a.discountRate - b.discountRate);
        break;
      case 'highest-amount':
        list = [...list].sort((a, b) => b.amount - a.amount);
        break;
      case 'lowest-risk':
        list = [...list].sort((a, b) => b.trustScore - a.trustScore);
        break;
      case 'closest-maturity':
        list = [...list].sort((a, b) => a.maturityDays - b.maturityDays);
        break;
    }
    return list;
  }, [industry, amountRange, discountMax, trustMin, dueFrom, dueTo, sort]);

  const handleBuy = (inv: MarketInvoice) => {
    setBuyTarget(inv);
    setBuyOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-slate-800 flex items-center gap-2">
            <Filter className="h-4 w-4 text-emerald-600" />
            Filter Marketplace
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Industry</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((i) => (
                    <SelectItem key={i} value={i}>{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">
                Discount Rate — max {discountMax}%
              </Label>
              <Slider value={[discountMax]} min={1} max={10} step={0.5} onValueChange={(v) => setDiscountMax(v[0])} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">
                Min Trust Score — {trustMin}
              </Label>
              <Slider value={[trustMin]} min={50} max={100} step={1} onValueChange={(v) => setTrustMin(v[0])} />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs text-slate-500">
                Invoice Amount — {formatINRShort(amountRange[0])} to {formatINRShort(amountRange[1])}
              </Label>
              <Slider
                value={amountRange}
                min={0}
                max={20000000}
                step={100000}
                onValueChange={(v) => setAmountRange(v as number[])}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Due From</Label>
                <Input type="date" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} className="text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Due To</Label>
                <Input type="date" value={dueTo} onChange={(e) => setDueTo(e.target.value)} className="text-xs" />
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Showing</span>
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-0">
                {filtered.length} invoices
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Sort by</span>
              <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="best-discount">Best Discount</SelectItem>
                  <SelectItem value="highest-amount">Highest Amount</SelectItem>
                  <SelectItem value="lowest-risk">Lowest Risk</SelectItem>
                  <SelectItem value="closest-maturity">Closest Maturity</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Grid */}
      {filtered.length === 0 ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-12 text-center">
            <AlertTriangle className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No invoices match your filters. Try widening the criteria.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.slice(0, visible).map((inv, i) => (
              <InvoiceCard key={inv.id} inv={inv} index={i} onBuy={handleBuy} />
            ))}
          </div>
          {visible < filtered.length && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => setVisible((v) => v + 6)}
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                Load More Invoices
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}

      <BuyInvoiceDialog inv={buyTarget} open={buyOpen} onOpenChange={setBuyOpen} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — MY INVOICES
// ═══════════════════════════════════════════════════════════════════════════════

function MyInvoicesTab() {
  const [bidsTarget, setBidsTarget] = useState<MyInvoice | null>(null);
  const [bidsOpen, setBidsOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  const stats = useMemo(() => {
    const listed = MY_INVOICES.filter(i => i.status === 'listed' || i.status === 'bid-received');
    const sold = MY_INVOICES.filter(i => i.status === 'sold');
    const totalListed = listed.reduce((s, i) => s + i.amount, 0);
    const totalSold = sold.reduce((s, i) => s + i.amount, 0);
    const avgDiscount = MY_INVOICES.length > 0
      ? MY_INVOICES.reduce((s, i) => s + i.discount, 0) / MY_INVOICES.length
      : 0;
    const totalFees = Math.round(totalSold * 0.0015);
    return { totalListed, totalSold, avgDiscount, totalFees };
  }, []);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Wallet} label="Total Listed" value={formatINRShort(stats.totalListed)} sub={`${MY_INVOICES.filter(i => i.status === 'listed' || i.status === 'bid-received').length} active listings`} delay={0.05} />
        <StatCard icon={CheckCircle} label="Total Sold" value={formatINRShort(stats.totalSold)} sub={`${MY_INVOICES.filter(i => i.status === 'sold').length} invoices settled`} trend="up" delay={0.1} />
        <StatCard icon={Percent} label="Avg Discount" value={`${stats.avgDiscount.toFixed(2)}%`} sub="across all listings" delay={0.15} />
        <StatCard icon={Coins} label="Total Fees Paid" value={formatINRShort(stats.totalFees)} sub="0.15% exchange fee" delay={0.2} />
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base text-slate-800 flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" />
              My Listed Invoices
            </CardTitle>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setListOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              List New Invoice
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">Invoice #</TableHead>
                  <TableHead className="text-xs">Buyer (Debtor)</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                  <TableHead className="text-xs">Listed</TableHead>
                  <TableHead className="text-xs text-right">Disc.</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Bids</TableHead>
                  <TableHead className="text-xs text-right">Best Offer</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MY_INVOICES.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-10">
                      <EmptyState
                        icon={FileText}
                        title="No invoices listed yet"
                        description="Click 'List New Invoice' to put your first invoice on the exchange."
                        compact
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  MY_INVOICES.map((inv, i) => {
                  const sb = statusBadge(inv.status);
                  return (
                    <motion.tr
                      key={inv.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.04 }}
                      className="group"
                    >
                      <TableCell className="font-mono text-xs text-slate-700 py-3">{inv.invoiceNo}</TableCell>
                      <TableCell className="text-xs text-slate-700 py-3">{inv.buyer}</TableCell>
                      <TableCell className="text-xs font-semibold text-slate-900 text-right py-3">{formatINR(inv.amount)}</TableCell>
                      <TableCell className="text-xs text-slate-500 py-3">{formatDate(inv.listingDate)}</TableCell>
                      <TableCell className="text-xs text-amber-600 font-medium text-right py-3">{inv.discount}%</TableCell>
                      <TableCell className="py-3">
                        <Badge className={`${sb.bg} ${sb.color} border-0 text-[10px]`}>{sb.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right py-3">
                        <span className="font-semibold text-slate-700">{inv.bidsCount}</span>
                      </TableCell>
                      <TableCell className="text-xs text-right py-3 font-medium text-emerald-700">
                        {inv.bestOffer ? formatINR(inv.bestOffer) : '—'}
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px] text-slate-600 hover:text-emerald-700 hover:bg-emerald-50"
                            onClick={() => { setBidsTarget(inv); setBidsOpen(true); }}
                          >
                            <Eye className="h-3 w-3 mr-0.5" />
                            Bids
                          </Button>
                          {inv.status === 'listed' || inv.status === 'bid-received' ? (
                            <>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-amber-600 hover:bg-amber-50">
                                <TrendingDown className="h-3 w-3 mr-0.5" />
                                Lower
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-rose-600 hover:bg-rose-50">
                                Withdraw
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </motion.tr>
                  );
                })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <ViewBidsDialog invoice={bidsTarget} open={bidsOpen} onOpenChange={setBidsOpen} />
      <ListInvoiceDialog open={listOpen} onOpenChange={setListOpen} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4 — EXCHANGE ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

function AnalyticsTab() {
  const totalRiskVol = RISK_DISTRIBUTION.reduce((s, r) => s + r.volume, 0);
  const totalRiskCount = RISK_DISTRIBUTION.reduce((s, r) => s + r.count, 0);

  return (
    <div className="space-y-4">
      {/* Top row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-slate-800 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-600" />
              Volume by Industry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <IndustryVolumeBarChart />
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-slate-800 flex items-center gap-2">
              <Target className="h-4 w-4 text-teal-600" />
              Buyer Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BuyerTypeDonut />
          </CardContent>
        </Card>
      </div>

      {/* Discount trend */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-slate-800 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-600" />
              Average Discount Rate Trend
            </CardTitle>
            <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-0">12 months</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <DiscountTrendChart />
        </CardContent>
      </Card>

      {/* State Heatmap */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-slate-800 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-600" />
              Invoice Volume by State
            </CardTitle>
            <div className="flex items-center gap-2 text-[10px] text-slate-500">
              <span>Low</span>
              <div className="flex gap-0.5">
                <div className="w-3 h-3 rounded bg-slate-100" />
                <div className="w-3 h-3 rounded bg-emerald-200" />
                <div className="w-3 h-3 rounded bg-emerald-400" />
                <div className="w-3 h-3 rounded bg-emerald-600" />
                <div className="w-3 h-3 rounded bg-emerald-800" />
              </div>
              <span>High</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <StateHeatmap />
        </CardContent>
      </Card>

      {/* Risk Distribution + Top Performing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-800 flex items-center gap-2">
              <Scale className="h-4 w-4 text-emerald-600" />
              Risk Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {RISK_DISTRIBUTION.length === 0 ? (
              <EmptyState
                icon={Scale}
                title="No risk data yet"
                description="Risk distribution will appear here once invoices are traded on the exchange."
                compact
              />
            ) : (
              <>
                {RISK_DISTRIBUTION.map((r, i) => {
                  const volPct = (r.volume / totalRiskVol) * 100;
                  const countPct = (r.count / totalRiskCount) * 100;
                  return (
                    <motion.div
                      key={r.rating}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-12 items-center justify-center rounded font-bold text-xs text-white" style={{ backgroundColor: r.color }}>
                            {r.rating}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-700">{formatNumber(r.count)} invoices</p>
                            <p className="text-[10px] text-slate-500">{formatINRShort(r.volume)} volume</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-slate-800">{volPct.toFixed(1)}%</p>
                          <p className="text-[10px] text-slate-500">{countPct.toFixed(1)}% count</p>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: r.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${volPct}%` }}
                          transition={{ delay: 0.3 + i * 0.08, duration: 0.6 }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
                <Separator />
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Total invoices</span>
                  <span className="font-semibold text-slate-800">{formatNumber(totalRiskCount)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Total volume</span>
                  <span className="font-semibold text-slate-800">{formatINRShort(totalRiskVol)}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-800 flex items-center gap-2">
              <Award className="h-4 w-4 text-emerald-600" />
              Top Performing Invoices
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Invoice</TableHead>
                    <TableHead className="text-xs">Seller / Buyer</TableHead>
                    <TableHead className="text-xs text-right">Amount</TableHead>
                    <TableHead className="text-xs text-right">Saved</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {TOP_PERFORMING_INVOICES.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10">
                        <EmptyState
                          icon={Award}
                          title="No performing invoices yet"
                          description="Top performing invoices will appear here once trades are settled."
                          compact
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    TOP_PERFORMING_INVOICES.map((inv, i) => (
                      <motion.tr
                        key={inv.invoiceNo}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <TableCell className="font-mono text-[10px] text-slate-700 py-2.5">{inv.invoiceNo}</TableCell>
                        <TableCell className="py-2.5">
                          <p className="text-xs font-medium text-slate-800">{inv.seller}</p>
                          <p className="text-[10px] text-slate-500">{inv.buyer}</p>
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-slate-900 text-right py-2.5">{formatINRShort(inv.amount)}</TableCell>
                        <TableCell className="text-right py-2.5">
                          <p className="text-xs font-bold text-emerald-700">{formatINRShort(inv.discountSaved)}</p>
                          <p className="text-[10px] text-slate-500">{inv.discountPct}%</p>
                        </TableCell>
                      </motion.tr>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function InvoiceExchangePage() {
  const [tab, setTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center justify-between flex-wrap gap-3"
        >
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <Banknote className="h-4 w-4" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Invoice Exchange</h1>
              <Badge className="bg-emerald-100 text-emerald-700 border-0">
                <span className="relative flex h-1.5 w-1.5 mr-1">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                Live
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1 ml-10">
              GSTPilot Financial Exchange — B2B invoice marketplace for India
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-slate-600">
              <Activity className="h-3.5 w-3.5 mr-1" />
              Market Status: <span className="text-emerald-600 font-semibold ml-1">Open</span>
            </Button>
          </div>
        </motion.div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="bg-white border border-slate-200 shadow-sm h-auto p-1 flex flex-wrap gap-1">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-600 text-xs sm:text-sm">
              <BarChart3 className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="marketplace" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-600 text-xs sm:text-sm">
              <ShoppingBag className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Marketplace</span>
            </TabsTrigger>
            <TabsTrigger value="my-invoices" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-600 text-xs sm:text-sm">
              <Briefcase className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">My Invoices</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-600 text-xs sm:text-sm">
              <Layers className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-0 focus-visible:outline-none">
            <DashboardTab />
          </TabsContent>
          <TabsContent value="marketplace" className="mt-0 focus-visible:outline-none">
            <MarketplaceTab />
          </TabsContent>
          <TabsContent value="my-invoices" className="mt-0 focus-visible:outline-none">
            <MyInvoicesTab />
          </TabsContent>
          <TabsContent value="analytics" className="mt-0 focus-visible:outline-none">
            <AnalyticsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
