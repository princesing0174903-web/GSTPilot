'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store, Search, Star, Download, FileText, Workflow,
  BarChart3, Check, ChevronRight, Shield, Clock,
  ArrowRight, Sparkles, Zap, Tag, Users, Settings2,
  X, Heart, Package, Filter,
  BadgeCheck, TrendingUp, CreditCard,
  FileSpreadsheet, Calculator, RefreshCw,
  Bot, Activity, Building2, Briefcase, Scale,
  ShieldCheck, IndianRupee, Eye, LayoutDashboard,
  PlusCircle, ArrowUpRight, ArrowDownRight, Wallet,
  PieChart, CircleDollarSign, Clock4, CheckCircle2,
  Store as StoreIcon, PackageOpen, Award, CircleCheck,
  ChevronLeft, ExternalLink, Lock, Crown, Rocket,
  MessageSquare, ThumbsUp, Share2, MoreHorizontal,
  Bell, Globe,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type MarketplaceCategory = 'templates' | 'automations' | 'ai-agents' | 'compliance-packs' | 'dashboards' | 'custom-reports';
type SellerType = 'CA Firm' | 'Tax Consultant' | 'Accountant' | 'GST Expert' | 'Lawyer';
type PricingTier = 'Free' | 'Pro' | 'Enterprise';
type SortOption = 'popular' | 'newest' | 'highest-rated' | 'trending';

interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  category: MarketplaceCategory;
  icon: string;
  rating: number;
  reviewCount: number;
  downloads: number;
  price: PricingTier;
  version: string;
  author: string;
  authorType: SellerType;
  lastUpdated: string;
  tags: string[];
  installed: boolean;
  featured: boolean;
  subscriptionPrice: number;
  annualPrice: number;
  sellerVerified: boolean;
  totalRevenue: number;
  monthlyViews: number;
}

interface Review {
  id: string;
  author: string;
  rating: number;
  comment: string;
  date: string;
  helpful: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGS
// ═══════════════════════════════════════════════════════════════════════════════

const SELLER_TYPE_CONFIG: Record<SellerType, { color: string; bg: string; border: string; icon: string }> = {
  'CA Firm': { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'Building2' },
  'Tax Consultant': { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: 'Briefcase' },
  'Accountant': { color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200', icon: 'Calculator' },
  'GST Expert': { color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', icon: 'Shield' },
  'Lawyer': { color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', icon: 'Scale' },
};

const CATEGORY_CONFIG: Record<MarketplaceCategory, { label: string; icon: string; color: string; bg: string; border: string }> = {
  'templates': { label: 'Templates', icon: 'FileText', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'automations': { label: 'Automations', icon: 'Workflow', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  'ai-agents': { label: 'AI Agents', icon: 'Bot', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  'compliance-packs': { label: 'Compliance Packs', icon: 'ShieldCheck', color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200' },
  'dashboards': { label: 'Dashboards', icon: 'BarChart3', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
  'custom-reports': { label: 'Custom Reports', icon: 'FileSpreadsheet', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatINR(amount: number): string {
  const str = amount.toString();
  if (amount >= 10000000) {
    const cr = amount / 10000000;
    return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    const lakhs = amount / 100000;
    return `₹${lakhs % 1 === 0 ? lakhs.toFixed(0) : lakhs.toFixed(2)} L`;
  }
  const lastThree = str.substring(str.length - 3);
  const otherNumbers = str.substring(0, str.length - 3);
  const formatted = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + (otherNumbers ? ',' : '') + lastThree;
  return `₹${formatted}`;
}

function formatINRFull(amount: number): string {
  const str = amount.toString();
  const lastThree = str.substring(str.length - 3);
  const otherNumbers = str.substring(0, str.length - 3);
  const formatted = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + (otherNumbers ? ',' : '') + lastThree;
  return `₹${formatted}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function formatDownloads(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const ICON_MAP: Record<string, React.ElementType> = {
  FileText, Workflow, Bot, ShieldCheck, BarChart3, FileSpreadsheet,
  Building2, Briefcase, Calculator, Shield, Scale, Zap, Sparkles,
  Package, CreditCard, Globe, Eye, LayoutDashboard, CheckCircle2,
  Store: StoreIcon,
};

function getIcon(name: string): React.ElementType {
  return ICON_MAP[name] || FileText;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SAMPLE DATA — 36 Marketplace Items
// ═══════════════════════════════════════════════════════════════════════════════

// MARKETPLACE_ITEMS — previously a 300-line hardcoded mock catalog of 30+ fake
// marketplace items (templates, automations, AI agents, reports) with fabricated
// ratings / downloads / revenue. Removed during mock-data audit (Task 7).
// The marketplace grid now renders an empty state until a real marketplace
// catalog API is wired.
const MARKETPLACE_ITEMS: MarketplaceItem[] = [];

// ═══════════════════════════════════════════════════════════════════════════════
// SAMPLE REVIEWS
// ═══════════════════════════════════════════════════════════════════════════════

// SAMPLE_REVIEWS — previously 6 hardcoded mock reviews by "Rajesh Gupta",
// "Priya Sharma", "Anand Patel", "Kavitha Nair", "Suresh Reddy", "Deepa Iyer"
// with fabricated ratings and comments. Removed during mock-data audit (Task 7).
const SAMPLE_REVIEWS: Review[] = [];

// ═══════════════════════════════════════════════════════════════════════════════
// SELLER DATA
// ═══════════════════════════════════════════════════════════════════════════════

const SELLER_PRODUCTS = MARKETPLACE_ITEMS.filter(i => i.author === 'Sharma & Associates');
// PAYOUT_HISTORY — previously 4 hardcoded mock payouts. Removed during mock-data
// audit (Task 7). Empty until a real seller-payouts API is wired.
const PAYOUT_HISTORY: { id: string; date: string; amount: number; status: 'paid' | 'pending'; period: string }[] = [];

// REVENUE_DATA — previously 6 hardcoded mock monthly revenue figures. Removed
// during mock-data audit (Task 7). Empty until a real seller-revenue API is wired.
const REVENUE_DATA: { month: string; revenue: number }[] = [];

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <Star
          key={star}
          size={size}
          className={star <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
        />
      ))}
    </div>
  );
}

function DynamicIcon({ name, ...props }: { name: string } & React.ComponentProps<typeof FileText>) {
  const Comp = getIcon(name);
  return React.createElement(Comp, props);
}

function SellerBadge({ type, verified }: { type: SellerType; verified: boolean }) {
  const config = SELLER_TYPE_CONFIG[type];
  return (
    <div className="flex items-center gap-1">
      <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${config.bg} ${config.color} ${config.border} border`}>
        <DynamicIcon name={config.icon} size={10} />
        {type}
      </span>
      {verified && <BadgeCheck size={14} className="text-emerald-500" />}
    </div>
  );
}

function PricingBadge({ price }: { price: PricingTier }) {
  const styles: Record<PricingTier, string> = {
    'Free': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Pro': 'bg-amber-50 text-amber-700 border-amber-200',
    'Enterprise': 'bg-violet-50 text-violet-700 border-violet-200',
  };
  const icons: Record<PricingTier, React.ReactNode> = {
    'Free': <Zap size={10} />,
    'Pro': <Crown size={10} />,
    'Enterprise': <Rocket size={10} />,
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${styles[price]}`}>
      {icons[price]}
      {price}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

function RevenueBarChart({ data, height = 200 }: { data: { month: string; revenue: number }[]; height?: number }) {
  const maxVal = Math.max(...data.map(d => d.revenue));
  const barWidth = 40;
  const gap = 24;
  const totalWidth = data.length * (barWidth + gap);
  const chartPadding = 60;
  const chartHeight = height - chartPadding;

  return (
    <svg viewBox={`0 0 ${totalWidth + 80} ${height}`} className="w-full" style={{ minHeight: height }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
        const y = chartPadding + chartHeight * (1 - pct);
        return (
          <g key={i}>
            <line x1={40} y1={y} x2={totalWidth + 60} y2={y} stroke="#e2e8f0" strokeDasharray={pct === 0 ? '0' : '4,4'} />
            <text x={35} y={y + 4} textAnchor="end" className="fill-slate-400" fontSize="10">
              {formatINR(maxVal * pct)}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const barHeight = (d.revenue / maxVal) * chartHeight;
        const x = 50 + i * (barWidth + gap);
        const y = chartPadding + chartHeight - barHeight;
        return (
          <g key={i}>
            <defs>
              <linearGradient id={`bar-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#059669" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>
            <motion.rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={4}
              fill={`url(#bar-grad-${i})`}
              initial={{ height: 0, y: chartPadding + chartHeight }}
              animate={{ height: barHeight, y }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
            />
            <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" className="fill-emerald-700" fontSize="10" fontWeight="600">
              {formatINR(d.revenue)}
            </text>
            <text x={x + barWidth / 2} y={chartPadding + chartHeight + 16} textAnchor="middle" className="fill-slate-500" fontSize="11">
              {d.month}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function RevenueTrendChart({ height = 180 }: { height?: number }) {
  const data = [
    { month: 'Jul', value: 28 },
    { month: 'Aug', value: 35 },
    { month: 'Sep', value: 42 },
    { month: 'Oct', value: 38 },
    { month: 'Nov', value: 55 },
    { month: 'Dec', value: 62 },
    { month: 'Jan', value: 71 },
    { month: 'Feb', value: 84 },
  ];
  const maxVal = 100;
  const width = 500;
  const chartW = width - 60;
  const chartH = height - 50;
  const points = data.map((d, i) => ({
    x: 30 + (i / (data.length - 1)) * chartW,
    y: 20 + chartH * (1 - d.value / maxVal),
    ...d,
  }));
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = pathD + ` L ${points[points.length - 1].x} ${20 + chartH} L ${points[0].x} ${20 + chartH} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minHeight: height }}>
      <defs>
        <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#059669" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#059669" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
        const y = 20 + chartH * (1 - pct);
        return <line key={i} x1={30} y1={y} x2={width - 30} y2={y} stroke="#e2e8f0" strokeDasharray="4,4" />;
      })}
      <path d={areaD} fill="url(#area-grad)" />
      <path d={pathD} fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill="#059669" stroke="white" strokeWidth={2} />
          <text x={p.x} y={p.y - 10} textAnchor="middle" className="fill-slate-600" fontSize="9" fontWeight="500">
            {formatINR(p.value * 20000)}
          </text>
          <text x={p.x} y={20 + chartH + 16} textAnchor="middle" className="fill-slate-400" fontSize="10">
            {p.month}
          </text>
        </g>
      ))}
    </svg>
  );
}

function DonutChart({ percentage, size = 120, color = '#059669' }: { percentage: number; size?: number; color?: string }) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percentage / 100);
  const center = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={center} cy={center} r={radius} fill="none" stroke="#e2e8f0" strokeWidth="8" />
      <circle
        cx={center} cy={center} r={radius} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${center} ${center})`}
        className="transition-all duration-1000"
      />
      <text x={center} y={center - 4} textAnchor="middle" className="fill-slate-800" fontSize="18" fontWeight="700">
        {percentage}%
      </text>
      <text x={center} y={center + 12} textAnchor="middle" className="fill-slate-400" fontSize="9">
        share
      </text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT CARD
// ═══════════════════════════════════════════════════════════════════════════════

function ProductCard({ item, onClick, onInstall }: { item: MarketplaceItem; onClick: () => void; onInstall: () => void }) {
  const catConfig = CATEGORY_CONFIG[item.category];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className="cursor-pointer border-slate-200 bg-white hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-100/50 transition-all duration-300 overflow-hidden group"
        onClick={onClick}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`flex-shrink-0 rounded-xl p-2.5 ${catConfig.bg} ${catConfig.border} border`}>
              <DynamicIcon name={item.icon} size={22} className={catConfig.color} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-800 text-sm leading-tight group-hover:text-emerald-700 transition-colors line-clamp-1">
                  {item.name}
                </h3>
                {item.featured && (
                  <Badge className="flex-shrink-0 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[9px] px-1.5 py-0 border-0">
                    <Sparkles size={9} className="mr-0.5" /> Featured
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <SellerBadge type={item.authorType} verified={item.sellerVerified} />
                <PricingBadge price={item.price} />
              </div>
              <div className="mt-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <StarRating rating={item.rating} size={11} />
                    <span className="text-[10px] font-medium text-slate-600">{item.rating}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">({item.reviewCount})</span>
                  <Separator orientation="vertical" className="h-3" />
                  <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                    <Download size={9} /> {formatDownloads(item.downloads)}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant={item.installed ? 'outline' : 'default'}
                  className={`h-7 text-[11px] px-2.5 ${
                    item.installed
                      ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                  onClick={(e) => { e.stopPropagation(); onInstall(); }}
                >
                  {item.installed ? (
                    <><Check size={11} className="mr-0.5" /> Installed</>
                  ) : (
                    <><Download size={11} className="mr-0.5" /> Install</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT DETAIL DIALOG
// ═══════════════════════════════════════════════════════════════════════════════

function ProductDetailDialog({ item, open, onClose, onInstall }: { item: MarketplaceItem | null; open: boolean; onClose: () => void; onInstall: () => void }) {
  const [activeReviewTab, setActiveReviewTab] = useState<'overview' | 'reviews'>('overview');

  if (!item) return null;
  const catConfig = CATEGORY_CONFIG[item.category];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{item.name}</DialogTitle>
          <DialogDescription>{item.description}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[85vh]">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className={`rounded-xl p-3 ${catConfig.bg} ${catConfig.border} border`}>
                <DynamicIcon name={item.icon} size={28} className={catConfig.color} />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">{item.name}</h2>
                    <p className="text-sm text-slate-500 mt-0.5">by {item.author}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                    <X size={16} />
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <SellerBadge type={item.authorType} verified={item.sellerVerified} />
                  <PricingBadge price={item.price} />
                  <Badge variant="outline" className="text-[10px]">v{item.version}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1">
                    <StarRating rating={item.rating} size={13} />
                    <span className="text-sm font-semibold text-slate-700">{item.rating}</span>
                    <span className="text-xs text-slate-400">({item.reviewCount} reviews)</span>
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Download size={12} /> {formatDownloads(item.downloads)} downloads
                  </span>
                  <Separator orientation="vertical" className="h-4" />
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Eye size={12} /> {formatDownloads(item.monthlyViews)}/mo views
                  </span>
                </div>
              </div>
            </div>

            {/* Screenshot placeholder */}
            <div className="mt-5 rounded-xl bg-gradient-to-br from-emerald-50 via-slate-50 to-emerald-50 border border-emerald-100 h-48 flex items-center justify-center">
              <div className="text-center">
                <DynamicIcon name={item.icon} size={40} className="mx-auto text-emerald-400 mb-2" />
                <p className="text-sm text-emerald-600 font-medium">App Preview</p>
                <p className="text-xs text-emerald-400">Screenshots & Demo</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-5 flex gap-4 border-b border-slate-200">
              <button
                className={`pb-2 text-sm font-medium transition-colors ${activeReviewTab === 'overview' ? 'text-emerald-700 border-b-2 border-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setActiveReviewTab('overview')}
              >
                Overview
              </button>
              <button
                className={`pb-2 text-sm font-medium transition-colors ${activeReviewTab === 'reviews' ? 'text-emerald-700 border-b-2 border-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setActiveReviewTab('reviews')}
              >
                Reviews ({item.reviewCount})
              </button>
            </div>

            <AnimatePresence mode="wait">
              {activeReviewTab === 'overview' ? (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-4"
                >
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">About this product</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.longDescription}</p>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Last Updated</p>
                      <p className="text-sm font-medium text-slate-700 flex items-center gap-1 mt-0.5">
                        <Clock size={12} /> {formatDate(item.lastUpdated)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Version</p>
                      <p className="text-sm font-medium text-slate-700 mt-0.5">{item.version}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Category</p>
                      <p className={`text-sm font-medium mt-0.5 flex items-center gap-1 ${catConfig.color}`}>
                        <DynamicIcon name={catConfig.icon} size={12} />
                        {catConfig.label}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Seller Revenue</p>
                      <p className="text-sm font-medium text-slate-700 mt-0.5 flex items-center gap-1">
                        <IndianRupee size={12} /> {formatINR(item.totalRevenue)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {item.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[10px] bg-slate-100 text-slate-600 hover:bg-slate-100">
                        <Tag size={8} className="mr-0.5" /> {tag}
                      </Badge>
                    ))}
                  </div>

                  {/* Pricing section */}
                  <div className="mt-5 rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Pricing</h3>
                    {item.price === 'Free' ? (
                      <div className="text-center py-3">
                        <p className="text-2xl font-bold text-emerald-600">Free</p>
                        <p className="text-xs text-slate-400 mt-1">No subscription required</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <div className={`rounded-lg border-2 p-3 ${item.price === 'Pro' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                          <p className="text-[10px] text-amber-600 font-semibold uppercase">Pro Monthly</p>
                          <p className="text-lg font-bold text-slate-800">{formatINRFull(item.subscriptionPrice)}<span className="text-xs font-normal text-slate-400">/mo</span></p>
                        </div>
                        <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-3">
                          <p className="text-[10px] text-emerald-600 font-semibold uppercase">Pro Annual</p>
                          <p className="text-lg font-bold text-slate-800">{formatINRFull(item.annualPrice)}<span className="text-xs font-normal text-slate-400">/yr</span></p>
                          <p className="text-[10px] text-emerald-600 font-medium mt-0.5">Save {formatINRFull(item.subscriptionPrice * 12 - item.annualPrice)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="reviews"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-4"
                >
                  {/* Rating summary */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-slate-800">{item.rating}</p>
                      <StarRating rating={item.rating} size={14} />
                      <p className="text-xs text-slate-400 mt-1">{item.reviewCount} reviews</p>
                    </div>
                    <div className="flex-1 space-y-1">
                      {[5, 4, 3, 2, 1].map(star => {
                        const pct = star === 5 ? 55 : star === 4 ? 28 : star === 3 ? 10 : star === 2 ? 5 : 2;
                        return (
                          <div key={star} className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 w-3">{star}</span>
                            <Star size={9} className="fill-amber-400 text-amber-400" />
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <motion.div
                                className="h-full bg-amber-400 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.5, delay: (5 - star) * 0.1 }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-400 w-8">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Separator className="my-3" />

                  {/* Review list */}
                  <div className="space-y-4 max-h-64 overflow-y-auto">
                    {SAMPLE_REVIEWS.map(review => (
                      <div key={review.id} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center">
                              <span className="text-xs font-semibold text-emerald-700">{review.author[0]}</span>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-slate-700">{review.author}</p>
                              <p className="text-[10px] text-slate-400">{review.date}</p>
                            </div>
                          </div>
                          <StarRating rating={review.rating} size={10} />
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed pl-9">{review.comment}</p>
                        <div className="flex items-center gap-2 pl-9">
                          <button className="text-[10px] text-slate-400 hover:text-emerald-600 flex items-center gap-0.5 transition-colors">
                            <ThumbsUp size={9} /> Helpful ({review.helpful})
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action buttons */}
            <div className="mt-5 flex items-center gap-3">
              <Button
                className={`flex-1 h-10 ${
                  item.installed
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
                onClick={onInstall}
              >
                {item.installed ? (
                  <><CheckCircle2 size={16} className="mr-2" /> Installed</>
                ) : (
                  <><Download size={16} className="mr-2" /> Install {item.price !== 'Free' ? `— ${formatINRFull(item.subscriptionPrice)}/mo` : ''}</>
                )}
              </Button>
              <Button variant="outline" size="icon" className="h-10 w-10 border-slate-200">
                <Heart size={16} />
              </Button>
              <Button variant="outline" size="icon" className="h-10 w-10 border-slate-200">
                <Share2 size={16} />
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPLORE TAB
// ═══════════════════════════════════════════════════════════════════════════════

function ExploreTab({ items, onProductClick, onInstall }: { items: MarketplaceItem[]; onProductClick: (item: MarketplaceItem) => void; onInstall: (item: MarketplaceItem) => void }) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MarketplaceCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('popular');

  const filtered = useMemo(() => {
    let result = items;
    if (selectedCategory !== 'all') {
      result = result.filter(i => i.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.author.toLowerCase().includes(q) ||
        i.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    switch (sortBy) {
      case 'popular': return [...result].sort((a, b) => b.downloads - a.downloads);
      case 'newest': return [...result].sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
      case 'highest-rated': return [...result].sort((a, b) => b.rating - a.rating);
      case 'trending': return [...result].sort((a, b) => b.monthlyViews - a.monthlyViews);
      default: return result;
    }
  }, [items, selectedCategory, search, sortBy]);

  const featured = items.filter(i => i.featured);
  const trending = [...items].sort((a, b) => b.monthlyViews - a.monthlyViews).slice(0, 6);
  const categories: MarketplaceCategory[] = ['templates', 'automations', 'ai-agents', 'compliance-packs', 'dashboards', 'custom-reports'];

  return (
    <div className="space-y-6">
      {/* Featured Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 p-6 md:p-8"
      >
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
        <div className="relative z-10">
          <Badge className="bg-white/20 text-white hover:bg-white/20 border-0 mb-3 text-[10px]">
            <Sparkles size={10} className="mr-1" /> Featured Collection
          </Badge>
          <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
            GST Marketplace for Professionals
          </h2>
          <p className="text-emerald-100 text-sm max-w-lg">
            Discover templates, automations, AI agents, and compliance tools built by India&apos;s top CA firms and GST experts.
          </p>
          <div className="flex items-center gap-4 mt-4">
            <div className="text-center">
              <p className="text-xl font-bold text-white">{items.length}+</p>
              <p className="text-[10px] text-emerald-200">Products</p>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div className="text-center">
              <p className="text-xl font-bold text-white">{new Set(items.map(i => i.author)).size}</p>
              <p className="text-[10px] text-emerald-200">Sellers</p>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div className="text-center">
              <p className="text-xl font-bold text-white">{formatDownloads(items.reduce((s, i) => s + i.downloads, 0))}</p>
              <p className="text-[10px] text-emerald-200">Downloads</p>
            </div>
          </div>
        </div>
        <div className="absolute top-4 right-4 hidden md:block opacity-20">
          <Store size={120} className="text-white" />
        </div>
      </motion.div>

      {/* Trending Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <TrendingUp size={16} className="text-emerald-600" /> Trending Now
          </h3>
        </div>
        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-2" style={{ minWidth: 'max-content' }}>
            {trending.map(item => {
              const catConfig = CATEGORY_CONFIG[item.category];
              return (
                <motion.div
                  key={item.id}
                  whileHover={{ scale: 1.03 }}
                  className="flex-shrink-0 w-56 cursor-pointer"
                  onClick={() => onProductClick(item)}
                >
                  <Card className="border-slate-200 hover:border-emerald-300 transition-colors overflow-hidden">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`rounded-lg p-1.5 ${catConfig.bg}`}>
                          <DynamicIcon name={item.icon} size={16} className={catConfig.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-700 truncate">{item.name}</p>
                          <p className="text-[10px] text-slate-400">{item.author}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Star size={10} className="fill-amber-400 text-amber-400" />
                          <span className="text-[10px] font-medium text-slate-600">{item.rating}</span>
                        </div>
                        <PricingBadge price={item.price} />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Category Grid */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
          <Package size={16} className="text-emerald-600" /> Browse by Category
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {categories.map(cat => {
            const config = CATEGORY_CONFIG[cat];
            const count = items.filter(i => i.category === cat).length;
            const isSelected = selectedCategory === cat;
            return (
              <motion.button
                key={cat}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedCategory(isSelected ? 'all' : cat)}
                className={`rounded-xl border-2 p-3 text-center transition-all ${
                  isSelected
                    ? `${config.bg} ${config.border} border-2`
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <DynamicIcon name={config.icon} size={20} className={`mx-auto mb-1.5 ${isSelected ? config.color : 'text-slate-400'}`} />
                <p className={`text-[11px] font-semibold ${isSelected ? config.color : 'text-slate-600'}`}>{config.label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{count} items</p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Filters and Sort */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search products, sellers, tags..."
            className="pl-9 h-9 border-slate-200 focus:border-emerald-400 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          {(['popular', 'newest', 'highest-rated', 'trending'] as SortOption[]).map(option => (
            <Button
              key={option}
              size="sm"
              variant={sortBy === option ? 'default' : 'outline'}
              className={`h-7 text-[11px] px-2.5 ${
                sortBy === option
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'border-slate-200 text-slate-600 hover:border-emerald-300'
              }`}
              onClick={() => setSortBy(option)}
            >
              {option === 'highest-rated' ? 'Top Rated' : option.charAt(0).toUpperCase() + option.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Results info */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          Showing {filtered.length} product{filtered.length !== 1 ? 's' : ''}
          {selectedCategory !== 'all' && ` in ${CATEGORY_CONFIG[selectedCategory].label}`}
        </p>
        {selectedCategory !== 'all' && (
          <Button variant="ghost" size="sm" className="h-6 text-[11px] text-emerald-600" onClick={() => setSelectedCategory('all')}>
            Clear filter <X size={10} className="ml-1" />
          </Button>
        )}
      </div>

      {/* Product Grid */}
      <AnimatePresence mode="popLayout">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(item => (
            <ProductCard
              key={item.id}
              item={item}
              onClick={() => onProductClick(item)}
              onInstall={() => onInstall(item)}
            />
          ))}
        </div>
      </AnimatePresence>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <PackageOpen size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-400">No products found matching your criteria</p>
          <Button variant="link" className="text-emerald-600 text-sm mt-1" onClick={() => { setSearch(''); setSelectedCategory('all'); }}>
            Clear all filters
          </Button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MY APPS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function MyAppsTab({ items, onProductClick, onInstall }: { items: MarketplaceItem[]; onProductClick: (item: MarketplaceItem) => void; onInstall: (item: MarketplaceItem) => void }) {
  const installed = items.filter(i => i.installed);
  const subscribed = installed.filter(i => i.price !== 'Free');
  const freeApps = installed.filter(i => i.price === 'Free');
  const totalMonthlySpend = subscribed.reduce((s, i) => s + i.subscriptionPrice, 0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Installed Apps', value: String(installed.length), icon: Package, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Active Subscriptions', value: String(subscribed.length), icon: CreditCard, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Free Apps', value: String(freeApps.length), icon: Zap, color: 'text-sky-600', bg: 'bg-sky-50' },
          { label: 'Monthly Spend', value: formatINRFull(totalMonthlySpend), icon: IndianRupee, color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map(stat => (
          <Card key={stat.label} className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className={`rounded-lg p-2 ${stat.bg}`}>
                  <stat.icon size={18} className={stat.color} />
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-800">{stat.value}</p>
                  <p className="text-[10px] text-slate-400">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Subscriptions */}
      {subscribed.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
            <CreditCard size={16} className="text-amber-600" /> Active Subscriptions
          </h3>
          <div className="space-y-3">
            {subscribed.map(item => {
              const catConfig = CATEGORY_CONFIG[item.category];
              return (
                <Card key={item.id} className="border-slate-200 hover:border-emerald-300 transition-colors cursor-pointer" onClick={() => onProductClick(item)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-xl p-2 ${catConfig.bg} ${catConfig.border} border`}>
                          <DynamicIcon name={item.icon} size={20} className={catConfig.color} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">{item.name}</p>
                          <p className="text-xs text-slate-400">by {item.author}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-800">{formatINRFull(item.subscriptionPrice)}<span className="text-xs font-normal text-slate-400">/mo</span></p>
                        <Badge className={`text-[9px] ${item.price === 'Enterprise' ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700'} border-0`}>
                          {item.price}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50">
                          <CheckCircle2 size={9} className="mr-0.5" /> Active
                        </Badge>
                        <span className="text-[10px] text-slate-400">Next billing: 01/04/2026</span>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] text-slate-500 hover:text-emerald-600">
                          Manage
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] text-slate-500 hover:text-rose-600">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Installed Products Grid */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
          <Package size={16} className="text-emerald-600" /> Installed Products
        </h3>
        {installed.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {installed.map(item => (
              <ProductCard key={item.id} item={item} onClick={() => onProductClick(item)} onInstall={() => onInstall(item)} />
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-slate-300">
            <CardContent className="p-8 text-center">
              <PackageOpen size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-400">No apps installed yet</p>
              <p className="text-xs text-slate-400 mt-1">Explore the marketplace to find tools for your practice</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Subscription Plans */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
          <Crown size={16} className="text-amber-600" /> Subscription Plans
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { tier: 'Free' as PricingTier, price: 0, desc: 'Basic templates and tools', features: ['5 Free templates', 'Basic automation', 'Community support', '1 GSTIN'], color: 'emerald' },
            { tier: 'Pro' as PricingTier, price: 499, desc: 'For growing practices', features: ['All templates', 'Advanced automations', 'AI Agents access', 'Up to 10 GSTINs', 'Priority support'], color: 'amber', popular: true },
            { tier: 'Enterprise' as PricingTier, price: 1999, desc: 'For large firms & enterprises', features: ['Everything in Pro', 'Custom AI Agents', 'Compliance Packs', 'Unlimited GSTINs', 'Dedicated support', 'API access'], color: 'violet' },
          ].map(plan => (
            <Card key={plan.tier} className={`relative border-2 ${plan.popular ? 'border-emerald-400 shadow-lg shadow-emerald-100' : 'border-slate-200'}`}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 border-0 text-[10px] px-3">
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardContent className="p-5">
                <div className="text-center mb-4">
                  <PricingBadge price={plan.tier} />
                  <p className="text-2xl font-bold text-slate-800 mt-2">
                    {plan.price === 0 ? 'Free' : <>{formatINRFull(plan.price)}<span className="text-sm font-normal text-slate-400">/mo</span></>}
                  </p>
                  {plan.price > 0 && (
                    <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                      Annual: {formatINRFull(plan.price * 10)}/yr (Save {formatINRFull(plan.price * 12 - plan.price * 10)})
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">{plan.desc}</p>
                </div>
                <Separator className="my-3" />
                <ul className="space-y-2">
                  {plan.features.map(f => (
                    <li key={f} className="text-xs text-slate-600 flex items-center gap-1.5">
                      <Check size={12} className="text-emerald-500 flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full mt-4 h-9 ${
                    plan.popular
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {plan.price === 0 ? 'Current Plan' : 'Upgrade'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SELL TAB
// ═══════════════════════════════════════════════════════════════════════════════

function SellTab({ items, onProductClick, onInstall }: { items: MarketplaceItem[]; onProductClick: (item: MarketplaceItem) => void; onInstall: (item: MarketplaceItem) => void }) {
  const [isSeller, setIsSeller] = useState(true);
  const [annualBilling, setAnnualBilling] = useState(false);

  const sellerItems = SELLER_PRODUCTS;
  const totalRevenue = sellerItems.reduce((s, i) => s + i.totalRevenue, 0);
  const totalViews = sellerItems.reduce((s, i) => s + i.monthlyViews, 0);
  const totalDownloads = sellerItems.reduce((s, i) => s + i.downloads, 0);
  const sellerShare = Math.round(totalRevenue * 0.7);
  const platformShare = Math.round(totalRevenue * 0.3);

  if (!isSeller) {
    return (
      <div className="space-y-6">
        {/* Become a Seller CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 p-8 text-center"
        >
          <div className="absolute inset-0 opacity-10">
            <svg width="100%" height="100%">
              <defs>
                <pattern id="sell-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <circle cx="15" cy="15" r="1.5" fill="white" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#sell-grid)" />
            </svg>
          </div>
          <div className="relative z-10">
            <div className="inline-flex items-center justify-center rounded-2xl bg-white/20 p-4 mb-4">
              <Store size={40} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Become a GSTPilot Seller</h2>
            <p className="text-emerald-100 max-w-md mx-auto text-sm">
              List your templates, automations, AI agents, and compliance tools. Reach thousands of GST professionals across India.
            </p>
            <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto mt-6">
              <div>
                <p className="text-2xl font-bold text-white">70%</p>
                <p className="text-[10px] text-emerald-200">Revenue Share</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">50k+</p>
                <p className="text-[10px] text-emerald-200">Active Users</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">36+</p>
                <p className="text-[10px] text-emerald-200">Categories</p>
              </div>
            </div>
            <Button
              className="mt-6 bg-white text-emerald-700 hover:bg-emerald-50 font-semibold h-11 px-8"
              onClick={() => setIsSeller(true)}
            >
              <Rocket size={16} className="mr-2" /> Start Selling Today
            </Button>
          </div>
        </motion.div>

        {/* Seller Types */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Who can sell on GSTPilot?</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(Object.entries(SELLER_TYPE_CONFIG) as [SellerType, typeof SELLER_TYPE_CONFIG[SellerType]][]).map(([type, config]) => {
              return (
                <Card key={type} className={`${config.border} border`}>
                  <CardContent className="p-4 text-center">
                    <div className={`rounded-xl p-2.5 ${config.bg} w-fit mx-auto mb-2`}>
                      <DynamicIcon name={config.icon} size={22} className={config.color} />
                    </div>
                    <p className={`text-xs font-semibold ${config.color}`}>{type}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* How it Works */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">How it works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { step: '1', title: 'Create Your Products', desc: 'Build templates, automations, or AI agents using our tools.', icon: Package },
              { step: '2', title: 'Set Your Pricing', desc: 'Choose Free, Pro, or Enterprise tiers with monthly/annual billing.', icon: IndianRupee },
              { step: '3', title: 'Earn Revenue', desc: 'Get 70% of every sale. Payouts processed monthly.', icon: Wallet },
            ].map(s => (
              <Card key={s.step} className="border-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 rounded-xl bg-emerald-50 p-2.5">
                      <s.icon size={20} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700">Step {s.step}: {s.title}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{s.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Seller Dashboard
  return (
    <div className="space-y-6">
      {/* Revenue Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Revenue', value: formatINR(totalRevenue), icon: IndianRupee, color: 'text-emerald-600', bg: 'bg-emerald-50', change: '+18%', up: true },
          { label: 'Your Share (70%)', value: formatINR(sellerShare), icon: Wallet, color: 'text-amber-600', bg: 'bg-amber-50', change: '+18%', up: true },
          { label: 'Monthly Views', value: formatDownloads(totalViews), icon: Eye, color: 'text-sky-600', bg: 'bg-sky-50', change: '+24%', up: true },
          { label: 'Total Downloads', value: formatDownloads(totalDownloads), icon: Download, color: 'text-violet-600', bg: 'bg-violet-50', change: '+12%', up: true },
        ].map(stat => (
          <Card key={stat.label} className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className={`rounded-lg p-1.5 ${stat.bg}`}>
                  <stat.icon size={14} className={stat.color} />
                </div>
                <span className={`text-[10px] font-medium flex items-center gap-0.5 ${stat.up ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {stat.up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />} {stat.change}
                </span>
              </div>
              <p className="text-lg font-bold text-slate-800 mt-2">{stat.value}</p>
              <p className="text-[10px] text-slate-400">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue Chart */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <BarChart3 size={16} className="text-emerald-600" /> Revenue Trend
            </CardTitle>
            <div className="flex items-center gap-2">
              <Label className="text-[10px] text-slate-400">Annual</Label>
              <Switch checked={annualBilling} onCheckedChange={setAnnualBilling} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <RevenueBarChart data={REVENUE_DATA} height={220} />
        </CardContent>
      </Card>

      {/* Revenue Sharing Breakdown */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <PieChart size={16} className="text-emerald-600" /> Revenue Sharing Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <DonutChart percentage={70} size={130} color="#059669" />
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-3 border border-emerald-100">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-emerald-600" />
                  <span className="text-sm font-medium text-slate-700">Your Share (70%)</span>
                </div>
                <span className="text-sm font-bold text-emerald-700">{formatINRFull(sellerShare)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 border border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-slate-400" />
                  <span className="text-sm font-medium text-slate-700">Platform Fee (30%)</span>
                </div>
                <span className="text-sm font-bold text-slate-600">{formatINRFull(platformShare)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between px-3">
                <span className="text-sm font-medium text-slate-700">Total Revenue</span>
                <span className="text-sm font-bold text-slate-800">{formatINRFull(totalRevenue)}</span>
              </div>
              <p className="text-[10px] text-slate-400 px-3">
                Revenue share is calculated on net revenue after GST. Payouts are processed by the 5th of each month for the previous month&apos;s earnings.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product Management */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <Package size={16} className="text-emerald-600" /> Your Products ({sellerItems.length})
          </h3>
          <Button size="sm" className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700">
            <PlusCircle size={12} className="mr-1" /> Add Product
          </Button>
        </div>
        <div className="space-y-3">
          {sellerItems.map(item => {
            const catConfig = CATEGORY_CONFIG[item.category];
            return (
              <Card key={item.id} className="border-slate-200 hover:border-emerald-300 transition-colors cursor-pointer" onClick={() => onProductClick(item)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-xl p-2 ${catConfig.bg} ${catConfig.border} border`}>
                        <DynamicIcon name={item.icon} size={18} className={catConfig.color} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{item.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <PricingBadge price={item.price} />
                          <span className="text-[10px] text-slate-400">v{item.version}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-800">{formatINR(item.totalRevenue)}</p>
                      <p className="text-[10px] text-slate-400">{formatDownloads(item.monthlyViews)} views/mo</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Star size={11} className="fill-amber-400 text-amber-400" />
                      <span className="text-[11px] font-medium text-slate-600">{item.rating}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">{formatDownloads(item.downloads)} downloads</span>
                    <span className="text-[11px] text-slate-400">{item.reviewCount} reviews</span>
                    <div className="flex-1" />
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] text-emerald-600 hover:text-emerald-700">
                      <Settings2 size={10} className="mr-0.5" /> Manage
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Payout History */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <Wallet size={16} className="text-emerald-600" /> Payout History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {PAYOUT_HISTORY.map(payout => (
              <div key={payout.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-1.5 ${payout.status === 'paid' ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                    {payout.status === 'paid' ? <CheckCircle2 size={14} className="text-emerald-600" /> : <Clock4 size={14} className="text-amber-600" />}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-700">{payout.period}</p>
                    <p className="text-[10px] text-slate-400">Processed: {payout.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-800">{formatINRFull(payout.amount)}</p>
                  <Badge className={`text-[9px] ${payout.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} border-0`}>
                    {payout.status === 'paid' ? 'Paid' : 'Pending'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function AnalyticsTab({ items }: { items: MarketplaceItem[] }) {
  const totalProducts = items.length;
  const totalSellers = new Set(items.map(i => i.author)).size;
  const totalRevenue = items.reduce((s, i) => s + i.totalRevenue, 0);
  const totalDownloads = items.reduce((s, i) => s + i.downloads, 0);
  const avgRating = items.length > 0
    ? items.reduce((s, i) => s + i.rating, 0) / items.length
    : 0;

  const categoryStats = (Object.entries(CATEGORY_CONFIG) as [MarketplaceCategory, typeof CATEGORY_CONFIG[MarketplaceCategory]][]).map(([cat, config]) => {
    const catItems = items.filter(i => i.category === cat);
    return {
      category: cat,
      label: config.label,
      color: config.color,
      bg: config.bg,
      icon: config.icon,
      count: catItems.length,
      revenue: catItems.reduce((s, i) => s + i.totalRevenue, 0),
      downloads: catItems.reduce((s, i) => s + i.downloads, 0),
    };
  });

  const topProducts = [...items].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 5);
  const topRated = [...items].sort((a, b) => b.rating - a.rating).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Platform Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Products', value: String(totalProducts), icon: Package, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Active Sellers', value: String(totalSellers), icon: Users, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Total Revenue', value: formatINR(totalRevenue), icon: IndianRupee, color: 'text-sky-600', bg: 'bg-sky-50' },
          { label: 'Total Downloads', value: formatDownloads(totalDownloads), icon: Download, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Avg Rating', value: avgRating.toFixed(1), icon: Star, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(stat => (
          <Card key={stat.label} className="border-slate-200">
            <CardContent className="p-4">
              <div className={`rounded-lg p-1.5 ${stat.bg} w-fit`}>
                <stat.icon size={14} className={stat.color} />
              </div>
              <p className="text-lg font-bold text-slate-800 mt-2">{stat.value}</p>
              <p className="text-[10px] text-slate-400">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue Trend */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <TrendingUp size={16} className="text-emerald-600" /> Platform Revenue Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueTrendChart height={200} />
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <Activity size={16} className="text-emerald-600" /> Category Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {categoryStats.map(cat => {
              const maxRevenue = Math.max(...categoryStats.map(c => c.revenue));
              const pct = maxRevenue > 0 ? (cat.revenue / maxRevenue) * 100 : 0;
              return (
                <div key={cat.category} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DynamicIcon name={cat.icon} size={14} className={cat.color} />
                      <span className="text-xs font-medium text-slate-700">{cat.label}</span>
                      <Badge variant="outline" className="text-[9px]">{cat.count} items</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-400">{formatDownloads(cat.downloads)} downloads</span>
                      <span className="text-xs font-semibold text-slate-700">{formatINR(cat.revenue)}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-emerald-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top Products by Revenue */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
          <Award size={16} className="text-amber-600" /> Top Products by Revenue
        </h3>
        <div className="space-y-2">
          {topProducts.map((item, i) => {
            const catConfig = CATEGORY_CONFIG[item.category];
            return (
              <Card key={item.id} className="border-slate-200">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold w-6 text-center ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-700' : 'text-slate-400'}`}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </span>
                    <div className={`rounded-lg p-1.5 ${catConfig.bg}`}>
                      <DynamicIcon name={item.icon} size={16} className={catConfig.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{item.name}</p>
                      <p className="text-[10px] text-slate-400">{item.author}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-800">{formatINR(item.totalRevenue)}</p>
                      <p className="text-[10px] text-slate-400">{formatDownloads(item.downloads)} downloads</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Top Rated */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
          <Star size={16} className="text-amber-500" /> Top Rated Products
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {topRated.map(item => {
            const catConfig = CATEGORY_CONFIG[item.category];
            return (
              <Card key={item.id} className="border-slate-200">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-1.5 ${catConfig.bg}`}>
                      <DynamicIcon name={item.icon} size={16} className={catConfig.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{item.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <StarRating rating={item.rating} size={10} />
                        <span className="text-[10px] font-medium text-slate-600">{item.rating}</span>
                        <span className="text-[10px] text-slate-400">({item.reviewCount})</span>
                      </div>
                    </div>
                    <PricingBadge price={item.price} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Seller Type Distribution */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <Users size={16} className="text-emerald-600" /> Seller Type Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(Object.entries(SELLER_TYPE_CONFIG) as [SellerType, typeof SELLER_TYPE_CONFIG[SellerType]][]).map(([type, config]) => {
              const count = items.filter(i => i.authorType === type).length;
              const revenue = items.filter(i => i.authorType === type).reduce((s, i) => s + i.totalRevenue, 0);
              return (
                <div key={type} className={`rounded-xl border-2 p-3 ${config.border} ${config.bg}`}>
                  <DynamicIcon name={config.icon} size={20} className={`mx-auto mb-1.5 ${config.color}`} />
                  <p className={`text-center text-xs font-semibold ${config.color}`}>{type}</p>
                  <p className="text-center text-lg font-bold text-slate-800 mt-1">{count}</p>
                  <p className="text-center text-[10px] text-slate-400">products</p>
                  <p className="text-center text-[10px] font-medium text-slate-600 mt-1">{formatINR(revenue)}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function MarketplacePage() {
  const [activeTab, setActiveTab] = useState('explore');
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [items, setItems] = useState<MarketplaceItem[]>(MARKETPLACE_ITEMS);

  const handleProductClick = (item: MarketplaceItem) => {
    setSelectedProduct(item);
    setDialogOpen(true);
  };

  const handleInstall = (item: MarketplaceItem) => {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, installed: !i.installed } : i));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-slate-200">
        <div className="px-4 md:px-6 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-emerald-600 p-2">
                <Store size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-800">GSTPilot Marketplace</h1>
                <p className="text-[10px] text-slate-400">Discover tools built by India&apos;s top GST professionals</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50">
                <CircleCheck size={10} className="mr-0.5" /> {items.filter(i => i.installed).length} Installed
              </Badge>
              <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50">
                <CreditCard size={10} className="mr-0.5" /> {items.filter(i => i.installed && i.price !== 'Free').length} Active Subs
              </Badge>
            </div>
          </div>

          {/* Tab Navigation */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-slate-100 p-1 h-9">
              <TabsTrigger value="explore" className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white h-7">
                <Search size={12} className="mr-1" /> Explore
              </TabsTrigger>
              <TabsTrigger value="my-apps" className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white h-7">
                <Package size={12} className="mr-1" /> My Apps
              </TabsTrigger>
              <TabsTrigger value="sell" className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white h-7">
                <Store size={12} className="mr-1" /> Sell
              </TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white h-7">
                <BarChart3 size={12} className="mr-1" /> Analytics
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-4 md:px-6 py-6 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'explore' && (
            <motion.div key="explore" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <ExploreTab items={items} onProductClick={handleProductClick} onInstall={handleInstall} />
            </motion.div>
          )}
          {activeTab === 'my-apps' && (
            <motion.div key="my-apps" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <MyAppsTab items={items} onProductClick={handleProductClick} onInstall={handleInstall} />
            </motion.div>
          )}
          {activeTab === 'sell' && (
            <motion.div key="sell" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <SellTab items={items} onProductClick={handleProductClick} onInstall={handleInstall} />
            </motion.div>
          )}
          {activeTab === 'analytics' && (
            <motion.div key="analytics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <AnalyticsTab items={items} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Product Detail Dialog */}
      <ProductDetailDialog
        item={selectedProduct}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onInstall={() => {
          if (selectedProduct) handleInstall(selectedProduct);
        }}
      />
    </div>
  );
}
